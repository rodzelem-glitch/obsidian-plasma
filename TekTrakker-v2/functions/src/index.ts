import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { BudgetServiceClient } from '@google-cloud/billing-budgets';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { CloudBillingClient } from '@google-cloud/billing';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { syncOrganizationShiftsToSquare } from "./squareUtils";
import { CommissionSettings, PlatformSettings } from "./types";

try {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
} catch (e) {}

const auth = admin.auth();
const db = admin.firestore();
const billingBudgetsClient = new BudgetServiceClient();
const monitoringClient = new MetricServiceClient();
const billingClient = new CloudBillingClient();

const DEFAULT_COMMISSION_RULES: CommissionSettings = {
    baseRate: 0.25, acceleratorRate: 0.30, annualQuota: 500000, renewalRate: 0.05,
    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
};

const BID_HELPER_COST_USD = 2.00;

const GEMINI_FLASH_MODEL = "gemini-2.5-flash"; 
const GEMINI_PRO_MODEL = "gemini-3.1-flash";

// --- NEW COMMISSION LOGIC ---
export const generateCommissionOnSubscriptionPayment = functions.firestore
    .document('organizations/{orgId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        if (before.subscriptionStatus !== 'active' && after.subscriptionStatus === 'active') {
            const org = after;
            const salesRepId = org.salesRepId;

            if (!salesRepId) {
                functions.logger.info(`Org ${org.id} became active but has no sales rep.`);
                return null;
            }

            const settingsDocs = await Promise.all([
                db.collection('platformSettings').limit(1).get(),
                db.collection('settings').doc('commission_rules').get()
            ]);
            
            const platformSettings = settingsDocs[0].docs[0]?.data() as PlatformSettings;
            const rules: CommissionSettings = settingsDocs[1].exists ? (settingsDocs[1].data() as CommissionSettings) : DEFAULT_COMMISSION_RULES;

            if (!platformSettings) {
                functions.logger.error("Platform settings not found. Cannot calculate commission.");
                return null;
            }

            type PlanName = 'starter' | 'growth' | 'enterprise';
            const planName: PlanName = org.plan || 'starter';
            const planDetails = platformSettings.plans[planName];
            const saleValue = planDetails?.annual || 0;

            if (saleValue <= 0) {
                 functions.logger.info(`Org ${org.id} has a plan with no value. No commission generated.`);
                 return null;
            }
            
            let rateToUse = rules.baseRate;
            
            const commsSnap = await db.collection('platformCommissions').where('repId', '==', salesRepId).get();
            const totalRevenueYTD = commsSnap.docs.reduce((sum, doc) => sum + doc.data().baseAmount, 0);

            if (totalRevenueYTD >= rules.annualQuota) {
                rateToUse = rules.acceleratorRate;
            } else if (totalRevenueYTD + saleValue > rules.annualQuota) {
                const amountBefore = rules.annualQuota - totalRevenueYTD;
                const amountAfter = totalRevenueYTD + saleValue - rules.annualQuota;
                const weightedRate = ((amountBefore / saleValue) * rules.baseRate) + ((amountAfter / saleValue) * rules.acceleratorRate);
                rateToUse = weightedRate;
            }

            const commission = {
                repId: salesRepId,
                organizationId: org.id,
                organizationName: org.name,
                jobId: null,
                invoiceId: `sub_${org.id}_${Date.now()}`,
                amount: saleValue * rateToUse,
                status: 'Pending',
                dateEarned: new Date().toISOString(),
                baseAmount: saleValue,
                rateUsed: rateToUse
            };
            
            return db.collection('platformCommissions').add(commission);
        }
        return null;
    });

// --- PLATFORM ANALYTICS ---

export const setUserRole = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'master_admin') {
        throw new functions.https.HttpsError("permission-denied", "Only Master Admins can set roles.");
    }
    await auth.setCustomUserClaims(data.uid, { role: data.role });
    await db.collection('users').doc(data.uid).update({ role: data.role });
    return { success: true };
});

export const getPlatformMetrics = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'master_admin') {
        throw new functions.https.HttpsError("permission-denied", "Only master admins can fetch platform metrics.");
    }

    const appProjectId = process.env.APP_PROJECT_ID;
    const ideProjectId = process.env.IDE_PROJECT_ID;
    const billingAccountId = process.env.BILLING_ACCOUNT_ID;

    if (!appProjectId || !ideProjectId || !billingAccountId) {
        functions.logger.error("Missing required environment variables for getPlatformMetrics.");
        throw new functions.https.HttpsError("internal", "Server configuration error: missing billing/project details.");
    }
    
    functions.logger.info(`Fetching metrics for projects: ${appProjectId}, ${ideProjectId}`);

    try {
        const [appMetrics, ideMetrics] = await Promise.all([
            getMetricsForProject(appProjectId, billingAccountId),
            getMetricsForProject(ideProjectId, billingAccountId)
        ]);

        return {
            appMetrics,
            ideMetrics
        };

    } catch (error) {
        functions.logger.error("Fatal error in getPlatformMetrics:", error);
        if (error instanceof Error) {
             throw new functions.https.HttpsError("internal", error.message);
        }
        throw new functions.https.HttpsError("internal", "An unknown error occurred.");
    }
});

async function getMetricsForProject(projectId: string, billingAccountId: string) {
    try {
        const billingInfo = await getBillingData(projectId, billingAccountId);
        const apiUsage = await getApiUsageMetrics(projectId);
        const dau = await getDAU(projectId);
        return { dau, billing: billingInfo, apiUsage };
    } catch (error) {
         functions.logger.error(`Failed to get metrics for project ${projectId}`, error);
         return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

async function getDAU(projectId: string) {
    if (projectId !== process.env.APP_PROJECT_ID) {
        return { count: 0 };
    }
    try {
        const listUsersResult = await auth.listUsers();
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const recentUsers = listUsersResult.users.filter(user => 
            user.metadata.lastSignInTime && new Date(user.metadata.lastSignInTime) >= twentyFourHoursAgo
        );
        return { count: recentUsers.length };
    } catch (e) {
        return { count: 0, error: "Auth access limited" };
    }
}

async function getBillingData(projectId: string, billingAccountId: string) {
    const billingAccountName = `billingAccounts/${billingAccountId}`;
    
    try {
        const [projectBillingInfo] = await billingClient.getProjectBillingInfo({ name: `projects/${projectId}` });
        if (!projectBillingInfo.billingEnabled) {
            return { costAmount: 0, budgetAmount: "0 (Billing Disabled)" };
        }
    } catch (e) {
        functions.logger.warn(`Could not check billing info for ${projectId}:`, e);
    }

    let budgetAmount = 0;
    try {
        const [budgets] = await billingBudgetsClient.listBudgets({ parent: billingAccountName });
        
        let targetBudget = budgets.find(budget => {
            const projects = budget.budgetFilter?.projects || [];
            return projects.some(p => p.includes(projectId));
        });

        if (!targetBudget) {
            targetBudget = budgets.find(budget => {
                const displayName = budget.displayName?.toLowerCase() || "";
                return displayName.includes(projectId.toLowerCase()) || 
                       (projectId === process.env.IDE_PROJECT_ID && displayName.includes(process.env.APP_PROJECT_ID?.toLowerCase() || "tektrakker"));
            });
        }

        if (!targetBudget) {
            targetBudget = budgets.find(budget => (budget.budgetFilter?.projects || []).length === 0);
        }

        if (targetBudget && targetBudget.amount?.specifiedAmount?.units) {
            budgetAmount = Number(targetBudget.amount.specifiedAmount.units);
        }
    } catch (e) {
        functions.logger.warn(`Could not fetch budget for ${billingAccountName}:`, e);
    }
    
    let costAmount = 0;
    try {
        const now = new Date();
        const startTime = new Date(now.getFullYear(), now.getMonth(), 1);
        const [timeSeries] = await monitoringClient.listTimeSeries({
            name: `projects/${projectId}`,
            filter: 'metric.type = "billing.googleapis.com/cost"',
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(now.getTime() / 1000) }
            },
        });
        costAmount = timeSeries[0]?.points?.[0]?.value?.doubleValue ?? 0;
    } catch (e: any) {
        // Expected if billing export is not configured
    }
    
    return { costAmount, budgetAmount: String(budgetAmount) };
}

async function getApiUsageMetrics(projectId: string) {
    const usageMetrics: { [key: string]: number } = {};
    const now = Date.now();
    const startTime = new Date(now - 24 * 60 * 60 * 1000);
    const metricsToFetch = [
        'logging.googleapis.com/log_entry_count',
        'cloudfunctions.googleapis.com/function/invocations',
        'firestore.googleapis.com/read_document_count'
    ];
    
    for (const metricType of metricsToFetch) {
        try {
            const [timeSeries] = await monitoringClient.listTimeSeries({
                name: `projects/${projectId}`,
                filter: `metric.type = "${metricType}"`,
                interval: { startTime: { seconds: Math.floor(startTime.getTime() / 1000) }, endTime: { seconds: Math.floor(now / 1000) }},
                aggregation: { alignmentPeriod: { seconds: 86400 }, perSeriesAligner: 'ALIGN_SUM' }
            });
            usageMetrics[metricType] = timeSeries[0]?.points?.reduce((sum, point) => sum + Number(point.value?.int64Value ?? point.value?.doubleValue ?? 0), 0) ?? 0;
        } catch (error) {
            usageMetrics[metricType] = 0;
        }
    }
    return usageMetrics;
}

// --- MESSAGING ---

export const sendSms = functions.firestore.document('messages/{msgId}').onCreate(async (snap) => {
    const msg = snap.data();
    if (!msg || msg.type !== 'sms' || !msg.receiverId) return;

    try {
        const secretDoc = await db.collection('organizations').doc(msg.organizationId).collection('secrets').doc('config').get();
        const secrets = secretDoc.data() || {};
        const accountSid = secrets.twilioConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = secrets.twilioConfig?.authToken || process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken) {
             // Fallback routing: Send as native 1-Way Push Notification to Customer Portal
             await db.collection('customers').doc(msg.receiverId).collection('notifications').add({
                 title: 'New Message',
                 message: msg.content,
                 createdAt: new Date().toISOString(),
                 read: false,
                 type: 'message',
                 senderId: msg.senderId || 'Platform'
             });
             await snap.ref.update({ deliveryStatus: 'fallback-push', deliveryError: 'No Twilio Config - Routed as Portal Push Notification' });
             return;
        }

        const customerDoc = await db.collection('customers').doc(msg.receiverId).get();
        const customer = customerDoc.data();
        const toPhone = customer?.phone;

        if (!toPhone) {
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: 'Invalid Customer Phone' });
            return;
        }

        const body = new URLSearchParams({ To: toPhone, From: fromNumber, Body: msg.content });
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });

        if (response.ok) {
            await snap.ref.update({ deliveryStatus: 'sent' });
        } else {
            const err: any = await response.json();
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: err.message || 'Twilio Error' });
        }
    } catch (e: any) {
        functions.logger.error("SMS Send Error:", e);
        await snap.ref.update({ deliveryStatus: 'failed', deliveryError: e.message });
    }
});

// --- AUTH UTILS ---

export const deleteAuthUser = functions.firestore.document('users/{userId}').onDelete(async (snap, context) => {
    try {
        await auth.deleteUser(context.params.userId);
        functions.logger.log(`Successfully deleted auth user: ${context.params.userId}`);
    } catch (error) {
        functions.logger.error(`Error deleting auth user: ${context.params.userId}`, error);
    }
});

export const linkCustomerOnUserCreate = functions.firestore.document('users/{userId}').onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;
    const email = userData.email?.toLowerCase().trim();
    let orgId = userData.organizationId;
    
    if (!email) return;
    
    try {
        // If user registered without an invite link, find their organization globally
        if (!orgId || orgId === 'unaffiliated') {
            const globalSnap = await db.collection('customers').where('email', '==', email).get();
            let matchDoc = globalSnap.docs[0];
            
            // Try common case-variations if exact match fails
            if (!matchDoc) {
                 const capEmail = email.charAt(0).toUpperCase() + email.slice(1);
                 const capSnap = await db.collection('customers').where('email', '==', capEmail).get();
                 matchDoc = capSnap.docs[0];
            }
            if (!matchDoc) {
                 const upperEmail = email.toUpperCase();
                 const upperSnap = await db.collection('customers').where('email', '==', upperEmail).get();
                 matchDoc = upperSnap.docs[0];
            }
            
            if (matchDoc) {
                orgId = matchDoc.data().organizationId;
                await snap.ref.update({ organizationId: orgId });
                functions.logger.info(`Auto-assigned user ${userId} to org ${orgId}`);
                
                // Link immediately
                if (matchDoc.data().userId !== userId) {
                    await db.collection('customers').doc(matchDoc.id).update({ userId: userId });
                    functions.logger.info(`Successfully linked orphaned customer ${matchDoc.id} to user ${userId}`);
                }
                return; // Done processing
            }
            
            // If still no orgId, we can't do anything else
            if (!orgId || orgId === 'unaffiliated') return;
        }
        
        // Scope search to orgId if it was already provided
        const orgSnap = await db.collection('customers').where('organizationId', '==', orgId).get();
        const match = orgSnap.docs.find(d => (d.data().email || '').toLowerCase().trim() === email);
        
        if (match && match.data().userId !== userId) {
            await db.collection('customers').doc(match.id).update({ userId: userId });
            functions.logger.info(`Successfully linked customer ${match.id} to user ${userId}`);
        }
    } catch (e) {
        functions.logger.error(`Error linking customer for user ${userId}:`, e);
    }
});

// --- AI UTILS ---
export const generateReviewResponse = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) throw new functions.https.HttpsError("internal", "AI service configuration error.");

    const { review } = data;
    if (!review) throw new functions.https.HttpsError("invalid-argument", "Review object missing.");

    const prompt = `
        You are an expert customer service representative for a service company.
        A customer named ${review.customerName || 'a customer'} left a ${review.rating || 5}-star review on ${review.source || 'our platform'}.
        Review text: "${review.content || 'Great service!'}"
        
        Write a professional, highly empathetic, and polite response from the business addressing this review directly. 
        If the review is positive, express gratitude and encourage them to return or refer friends.
        If the review is negative, apologize for the experience, offer to make things right, and ask them to contact support.
        Do NOT put generic brackets like [Company Name]. Make it sound natural and finalized.
        Keep it under 3-4 sentences.
    `;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { text: response.text() };
    } catch (error: any) {
        functions.logger.error("Review GenAI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate review response.");
    }
});

export const callLandingChatbot = functions.https.onCall(async (data, context) => {
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) throw new functions.https.HttpsError("internal", "AI service config error.");

    const { prompt, systemInstruction } = data;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL, systemInstruction });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { text: response.text() };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const callGeminiAI = functions.runWith({ timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
        functions.logger.error("Missing GEMINI_API_KEY in environment variables.");
        throw new functions.https.HttpsError("internal", "AI service configuration error.");
    }

    const { prompt, modelName = GEMINI_FLASH_MODEL, config = {}, imageParts = [], image = null } = data;
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName, ...config });

        let result;
        const parts: any[] = [{ text: prompt }];

        if (imageParts && imageParts.length > 0) {
            imageParts.forEach((part: any) => {
                parts.push({
                    inlineData: {
                        data: part.base64Data,
                        mimeType: part.mimeType
                    }
                });
            });
        }
        
        if (image) {
             parts.push({
                inlineData: {
                    data: image.data,
                    mimeType: image.mimeType
                }
            });
        }

        result = await model.generateContent(parts);
        const response = await result.response;
        return { text: response.text() };

    } catch (error: any) {
        functions.logger.error("Gemini AI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate content.");
    }
});

// --- BID HELPER ---

export const analyzeRFP = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    
    const { files } = data;
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "No files provided.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError("internal", "AI service config error.");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const analyses = await Promise.all(files.map(async (file: any) => {
            const { fileData, mimeType } = file;
            const prompt = `Analyze this government RFP or solicitation document. Extract the following information in JSON format: 
            {
              "requirements": ["list", "of", "general", "requirements"],
              "deliverables": ["(Submittal) Must provide safety plan with bid", "(Contract) Monthly progress reports", "list", "of", "all", "deliverables, categorized by (Submittal) vs (Contract)"],
              "summary": "comprehensive overall summary of the scope of work",
              "solicitationNumber": "string",
              "agency": "string",
              "dueDate": "ISO date if found",
              "questions": [{"id": "q1", "text": "Question text based on document that requires user input", "answer": ""}],
              "lineItems": [{"id": "item1", "description": "Item description", "qty": 1, "unit": "EA"}]
            }
            
            Crucial Instructions:
            1. For 'deliverables', explicitly prepend each item with either '(Submittal)' if it must be included in the bid response package, or '(Contract)' if it is required after winning the award during execution.
            2. Identify key areas where the estimator needs to provide input (e.g., "What is the hourly rate for role X?", "Who is the project manager?", "What is the warranty period?") and add them to the 'questions' array.
            3. Identify all required services, products, or materials that need pricing and add them to the 'lineItems' array.
            4. Ensure output is STRICTLY valid JSON. Do not include markdown code block tags (\`\`\`json).`;

            const result = await model.generateContent([
                { inlineData: { data: fileData, mimeType } },
                { text: prompt }
            ]);

            const response = await result.response;
            let text = response.text();
            
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse AI response as JSON. Raw text:", text);
                 throw new Error("Failed to parse AI response as JSON for one of the files.");
            }
        }));

        return { analyses };

    } catch (error: any) {
        functions.logger.error("RFP Analysis Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to analyze RFP.");
    }
});

export const searchHistoricalBidData = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    
    const { bid } = data;
    if (!bid) throw new functions.https.HttpsError("invalid-argument", "No bid data provided.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError("internal", "AI service config error.");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const prompt = `Search for historical data and market research for this government solicitation: ${JSON.stringify(bid)}. 
        Simulate a search and provide a detailed report on similar past contracts, typical winning prices, and potential competitors. 
        Format the output as a clean HTML document.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { content: response.text() };
    } catch (error: any) {
        functions.logger.error("Historical Search Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to search historical data.");
    }
});

export const generateBidDocument = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in to generate bid documents.");
    }

    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;
    
    if (!orgId) {
        throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
    }

    const cost = BID_HELPER_COST_USD;
    functions.logger.info(`Bid generation for Org ${orgId}. Cost: $${cost}.`);

    try {
        await db.collection('organizations').doc(orgId).collection('charges').add({
            amount: cost,
            description: "Bid Helper - AI Document Generation",
            date: admin.firestore.FieldValue.serverTimestamp(),
            status: "pending",
            userId: context.auth.uid
        });
    } catch (e) {
        functions.logger.error("Failed to record charge for bid generation:", e);
    }

    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
        throw new functions.https.HttpsError("internal", "AI service is not configured.");
    }

    const { bid, orgContext, prompt, isGlobalEdit, docIndex } = data;
    if (!bid || !prompt) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with a 'bid' and 'prompt'.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });
        
        let fullPrompt = "";

        if (isGlobalEdit) {
            fullPrompt = `You are a professional proposal writer editing a bid package.
            Apply this instruction: "${prompt}" to the following document(s).
            Respond STRICTLY with a JSON array of objects representing the updated documents.
            Format: [{"title": "Document Title", "content": "<html content>"}]
            
            Current Documents to edit:
            ${JSON.stringify(bid.generatedDocs)}
            `;
        } else if (docIndex !== undefined) {
             const specificDocContent = bid.generatedDocs?.[docIndex]?.content || '';
             fullPrompt = `You are a professional proposal writer.
             Apply this instruction: "${prompt}" to the following specific document.
             Respond STRICTLY with the raw HTML content for the new document. Do not wrap in JSON.
             
             Current Document:
             ${specificDocContent}`;
        } else {
            // Updated prompt to explicitly mandate the use of the organization context
            fullPrompt = `You are an expert government contracting proposal manager. 
            Your task is to generate a PERFECT, complete, and ready-to-submit proposal package based on the provided Bid Information and Organization Context.
            
            ### BID INFORMATION:
            ${JSON.stringify(bid)}
            
            ### ORGANIZATION CONTEXT (CRITICAL):
            You MUST extract and heavily utilize the following company information throughout the proposal package. Do not use generic placeholders if this data is available:
            - Company Name: ${orgContext?.name || 'NOT PROVIDED'}
            - Phone: ${orgContext?.phone || 'NOT PROVIDED'}
            - Email: ${orgContext?.email || 'NOT PROVIDED'}
            - Address: ${orgContext?.address ? `${orgContext.address.street}, ${orgContext.address.city}, ${orgContext.address.state} ${orgContext.address.zip}` : 'NOT PROVIDED'}
            - UEI Number: ${orgContext?.ueid || 'NOT PROVIDED'}
            - CAGE Code: ${orgContext?.cageCode || 'NOT PROVIDED'}
            - Primary NAICS: ${orgContext?.primaryNaics || 'NOT PROVIDED'}
            - License Number: ${orgContext?.licenseNumber || 'NOT PROVIDED'}
            
            ### INSTRUCTIONS:
            1. Integrate the answers from the 'questions' array directly into the technical narrative and executive summary.
            2. Integrate the 'lineItems' into a professional Pricing Schedule table. Calculate the final total and present it clearly.
            3. Create a Cover Letter. The sender MUST be the company described in the Organization Context above. The recipient is the Agency.
            4. Ensure every document header or footer includes the Company Name, UEI, and CAGE code (if provided).
            5. Address all required '(Submittal)' deliverables mentioned in the bid data. Provide templates or drafted responses for these deliverables.
            6. The output must be a professional, highly persuasive, and fully fleshed-out proposal, ready for immediate submission.
            
            ### OUTPUT FORMAT:
            You MUST return a STRICT JSON array representing the different documents in the package. 
            Use clean semantic HTML (h1, h2, p, table, etc.) for the 'content'. DO NOT include markdown tags like \`\`\`json.
            
            Example Format:
            [
              {
                "title": "Cover Letter",
                "content": "<div style='text-align:center'><h1>[Company Name from Context]</h1><p>[Company Address from Context] | [Email] | [Phone]</p><p>UEI: [UEI] | CAGE: [CAGE]</p></div><hr/><h2>Cover Letter</h2><p>Dear [Agency],</p>..."
              },
              {
                "title": "Executive Summary & Technical Approach",
                "content": "<h2>Executive Summary</h2><p>...</p>"
              },
              {
                "title": "Pricing Schedule",
                "content": "<h2>Pricing</h2><table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>...</table>"
              }
            ]`;
        }
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let text = response.text();
        
        if (isGlobalEdit || docIndex === undefined) {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                const docs = JSON.parse(text);
                return { docs };
            } catch (e) {
                 functions.logger.error("Failed to parse document generation response", text);
                 throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly.");
            }
        } else {
             return { docs: [{ title: bid.generatedDocs[docIndex].title, content: text.replace(/```html/g, '').replace(/```/g, '').trim() }] };
        }

    } catch (error: any) {
        functions.logger.error("Error generating bid document:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate document.");
    }
});

// --- PARTNER HANDSHAKE ---

export const manageHandshake = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    const { action, targetOrgId, requestingOrgId, subcontractorId } = data;
    
    if (action === 'request') {
        if (!targetOrgId) throw new functions.https.HttpsError('invalid-argument', 'Target Org ID required.');
        if (!requestingOrgId) throw new functions.https.HttpsError('invalid-argument', 'Requesting Org ID required.');
        
        const requesterDoc = await db.collection('organizations').doc(requestingOrgId).get();
        const requesterName = requesterDoc.data()?.name || 'Unknown Org';

        await db.collection('organizations').doc(targetOrgId).update({
            partnerRequests: admin.firestore.FieldValue.arrayUnion({
                fromOrgId: requestingOrgId,
                fromOrgName: requesterName,
                subcontractorId: subcontractorId, // The ID of the sub doc in the requester's DB
                status: 'pending',
                timestamp: Date.now()
            })
        });
        
        return { success: true };
    }

    if (action === 'approve') {
        const batch = db.batch();
        
        // 1. Fetch Organization Data
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const requestOrgRef = db.collection('organizations').doc(requestingOrgId);
        
        const [targetOrgDoc, requestOrgDoc] = await Promise.all([targetOrgRef.get(), requestOrgRef.get()]);
        const targetOrgData = targetOrgDoc.data();
        const requestOrgData = requestOrgDoc.data();
        
        if (!targetOrgData || !requestOrgData) throw new functions.https.HttpsError('not-found', 'Organization not found.');

        const request = targetOrgData.partnerRequests?.find((r: any) => r.fromOrgId === requestingOrgId);
        if (!request) throw new functions.https.HttpsError('not-found', 'Request not found.');

        // 2. Remove Request & Link Organizations
        batch.update(targetOrgRef, {
            partnerRequests: admin.firestore.FieldValue.arrayRemove(request),
            linkedPartners: admin.firestore.FieldValue.arrayUnion(requestingOrgId)
        });
        batch.update(requestOrgRef, {
            linkedPartners: admin.firestore.FieldValue.arrayUnion(targetOrgId)
        });

        // 3. Update Requester's Subcontractor Doc (Status: Linked)
        if (request.subcontractorId) {
            const subRef = db.collection('subcontractors').doc(request.subcontractorId);
            // Also autofill details from the target org (Approver) into this sub doc
            batch.update(subRef, {
                handshakeStatus: 'Linked',
                companyName: targetOrgData.name,
                email: targetOrgData.email,
                phone: targetOrgData.phone,
                trade: targetOrgData.industry || 'General',
                linkedOrgId: targetOrgId
            });
        }

        // 4. Create Reciprocal Subcontractor Doc for Approver (Target)
        const newSubId = `sub_${targetOrgId}_${requestingOrgId}`;
        const newSubRef = db.collection('subcontractor').doc(newSubId);
        batch.set(newSubRef, {
            id: newSubId,
            organizationId: targetOrgId,
            companyName: requestOrgData.name,
            contactName: 'Partner Admin', // Default
            trade: requestOrgData.industry || 'General',
            email: requestOrgData.email,
            phone: requestOrgData.phone,
            status: 'Active',
            handshakeStatus: 'Linked',
            linkedOrgId: requestingOrgId,
            createdAt: new Date().toISOString()
        }, { merge: true });

        // 5. Create Customer Records for B2B Invoicing
        // Customer for Requester (representing Approver)
        const custReqId = `cust_partner_${targetOrgId}`;
        const custReqRef = db.collection('customers').doc(custReqId);
        batch.set(custReqRef, {
            id: custReqId,
            organizationId: requestingOrgId,
            name: targetOrgData.name,
            email: targetOrgData.email,
            phone: targetOrgData.phone,
            address: targetOrgData.address ? `${targetOrgData.address.street}, ${targetOrgData.address.city}, ${targetOrgData.address.state} ${targetOrgData.address.zip}` : '',
            type: 'Commercial',
            status: 'Active',
            linkedOrgId: targetOrgId,
            notes: 'Linked Partner Organization'
        }, { merge: true });

        // Customer for Approver (representing Requester)
        const custAppId = `cust_partner_${requestingOrgId}`;
        const custAppRef = db.collection('customers').doc(custAppId);
        batch.set(custAppRef, {
            id: custAppId,
            organizationId: targetOrgId,
            name: requestOrgData.name,
            email: requestOrgData.email,
            phone: requestOrgData.phone,
            address: requestOrgData.address ? `${requestOrgData.address.street}, ${requestOrgData.address.city}, ${requestOrgData.address.state} ${targetOrgData.address.zip}` : '',
            type: 'Commercial',
            status: 'Active',
            linkedOrgId: requestingOrgId,
            notes: 'Linked Partner Organization'
        }, { merge: true });

        await batch.commit();
        return { success: true };
    }

    if (action === 'reject') {
        const myOrgRef = db.collection('organizations').doc(targetOrgId);
        const myOrgDoc = await myOrgRef.get();
        const myOrgData = myOrgDoc.data();
        
        const request = myOrgData?.partnerRequests?.find((r: any) => r.fromOrgId === requestingOrgId);
         if (request) {
            await myOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });
            
             if (request.subcontractorId) {
                 try {
                     await db.collection('subcontractors').doc(request.subcontractorId).update({
                         handshakeStatus: 'None'
                     });
                 } catch(e) {
                     functions.logger.warn(`Could not update requester subcontractor doc ${request.subcontractorId}`, e);
                 }
            }
        }
        return { success: true };
    }
    
    if (action === 'cancel') {
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const targetOrgDoc = await targetOrgRef.get();
        const targetOrgData = targetOrgDoc.data();
        
        const request = targetOrgData?.partnerRequests?.find((r: any) => r.fromOrgId === requestingOrgId);
        if (request) {
            await targetOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });
        }
        
        if (subcontractorId) {
             await db.collection('subcontractors').doc(subcontractorId).update({
                 handshakeStatus: 'None'
             });
        }
        
        return { success: true };
    }

    if (action === 'unlink') {
        const batch = db.batch();
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const requestingOrgRef = db.collection('organizations').doc(requestingOrgId);

        batch.update(targetOrgRef, { linkedPartners: admin.firestore.FieldValue.arrayRemove(requestingOrgId) });
        batch.update(requestingOrgRef, { linkedPartners: admin.firestore.FieldValue.arrayRemove(targetOrgId) });
        
        if (subcontractorId) {
             batch.update(db.collection('subcontractors').doc(subcontractorId), { handshakeStatus: 'None' });
        }

        await batch.commit();
        return { success: true };
    }

    throw new functions.https.HttpsError('invalid-argument', 'Invalid action.');
});

export const processMailQueue = functions.firestore.document('mail_queue/{docId}').onCreate(async (snap, context) => {
    const payload = snap.data();
    const orgId = payload.organizationId;
    
    try {
        if (orgId && orgId !== 'unaffiliated') {
            const secretDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
            if (secretDoc.exists) {
                const secrets = secretDoc.data() || {};
                const smtp = secrets.smtpConfig;
                
                if (smtp && smtp.host && smtp.user && smtp.pass) {
                    payload.transport = {
                        host: smtp.host,
                        port: smtp.port || 587,
                        auth: {
                            user: smtp.user,
                            pass: smtp.pass
                        }
                    };
                    
                    if (smtp.fromName && smtp.fromEmail) {
                        if (!payload.message) payload.message = {};
                        payload.message.from = `"${smtp.fromName}" <${smtp.fromEmail}>`;
                    }
                }
            } else {
                // Backward compatibility during migration window: Try reading from main org document if secrets don't exist yet
                const orgDoc = await db.collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    const orgData = orgDoc.data() || {};
                    const smtp = orgData.smtpConfig;
                    if (smtp && smtp.host && smtp.user && smtp.pass) {
                        payload.transport = {
                            host: smtp.host,
                            port: smtp.port || 587,
                            auth: { user: smtp.user, pass: smtp.pass }
                        };
                        if (smtp.fromName && smtp.fromEmail) {
                            if (!payload.message) payload.message = {};
                            payload.message.from = `"${smtp.fromName}" <${smtp.fromEmail}>`;
                        }
                    }
                }
            }
        }
        
        // Forward the securely populated payload to the final 'mail' collection for delivery
        await db.collection('mail').add(payload);
        
        // Clean up the queue
        await snap.ref.delete();
    } catch (error) {
        functions.logger.error(`Failed to process mail queue for org ${orgId}`, error);
    }
});

export const measureQuickWebhook = functions.https.onRequest(async (req, res) => {
    // Only accept POST requests for incoming webhooks
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const payload = req.body;
        // NOTE: In production with live API keys, we would verify the measureQuick HMAC signature here.
        
        // Extract routing details
        const jobId = payload.jobId || req.query.jobId;
        const orgId = payload.organizationId || req.query.orgId;
        
        if (!jobId || !orgId) {
            res.status(400).send('Missing required routing parameters: jobId or organizationId');
            return;
        }

        // Construct the strictly-typed DiagnosticReport record
        const reportId = `mq_${Date.now()}`;
        const report = {
            id: reportId,
            jobId: jobId as string,
            organizationId: orgId as string,
            source: 'measureQuick',
            healthScore: payload.healthScore || null,
            systemType: payload.systemType || null,
            pdfReportUrl: payload.pdfReportUrl || null,
            measurements: payload.measurements || {},
            diagnostics: payload.diagnostics || [],
            createdAt: new Date().toISOString()
        };

        // Save it to the specific Job's sub-collection
        await db.collection('jobs').doc(jobId as string).collection('diagnostics').doc(reportId).set(report);
        
        functions.logger.info(`Successfully parsed measureQuick report for job ${jobId}`);
        res.status(200).send({ success: true, reportId });

    } catch (error) {
        functions.logger.error('Error processing measureQuick webhook payload', error);
        res.status(500).send('Internal Server Error');
    }
});

// --- APIFY REVIEW AGGREGATION ---
export const syncExternalReviews = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
    const orgId = data.organizationId;
    if (!orgId) throw new functions.https.HttpsError('invalid-argument', 'Missing organizationId');

    try {
        const [orgDoc, secretsDoc] = await Promise.all([
            db.collection('organizations').doc(orgId).get(),
            db.collection('platformSettings').doc('secrets').get() 
        ]);
        
        const orgData = orgDoc.data();
        const masterSecrets = secretsDoc.data();
        if (!orgData) throw new functions.https.HttpsError('not-found', 'Organization not found.');
        
        if (!masterSecrets || !masterSecrets.apifyMasterKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Platform Apify Key is not configured in backend secrets vault. Plase establish the Master Key.');
        }

        const reviewLinks = orgData.reviewLinks || {};
        const apifyToken = masterSecrets.apifyMasterKey;

        // Configuration mapping for Apify parallel tasks
        const tasks = [];
        if (reviewLinks.google) {
            tasks.push({
                source: 'google',
                actorId: 'compass~google-maps-reviews-scraper',
                url: reviewLinks.google
            });
        }
        if (reviewLinks.yelp) {
            tasks.push({
                source: 'yelp',
                actorId: 'jupri~yelp-reviews-scraper',
                url: reviewLinks.yelp
            });
        }
        if (reviewLinks.trustpilot) {
            tasks.push({
                source: 'trustpilot',
                actorId: 'mistic~trustpilot-reviews-scraper',
                url: reviewLinks.trustpilot
            });
        }
        if (reviewLinks.angi) {
            tasks.push({
                source: 'angi',
                actorId: 'epctex~angi-scraper',
                url: reviewLinks.angi
            });
        }
        if (reviewLinks.thumbtack) {
            tasks.push({
                source: 'thumbtack',
                actorId: 'epctex~thumbtack-scraper',
                url: reviewLinks.thumbtack
            });
        }
        if (reviewLinks.nextdoor) {
            tasks.push({
                source: 'nextdoor',
                actorId: 'jupri~nextdoor-scraper',
                url: reviewLinks.nextdoor
            });
        }

        if (tasks.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'No external review URLs provided in Settings.');
        }

        // Fire all Scraper Actors in parallel
        const fetchPromises = tasks.map(async (task) => {
            const apifyUrl = `https://api.apify.com/v2/acts/${task.actorId}/run-sync-get-dataset-items?token=${apifyToken}`;
            try {
                const response = await fetch(apifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startUrls: [{ url: task.url }],
                        maxReviews: 20,
                        sort: 'newest'
                    })
                });
                
                if (!response.ok) return { source: task.source, items: [] }; 
                const items = await response.json();
                return { source: task.source, items: Array.isArray(items) ? items : [] };
            } catch (err) {
                functions.logger.error(`Failed to execute Apify actor ${task.actorId}:`, err);
                return { source: task.source, items: [] };
            }
        });

        const results = await Promise.all(fetchPromises);

        let ingestedCount = 0;
        const batch = db.batch();

        for (const resultSet of results) {
            for (const review of resultSet.items) {
                // Generously normalize properties because different Apify actors return different schemas
                const rawId = review.reviewId || review.id || Math.random().toString(36).substring(7);
                const reviewId = `ext_${resultSet.source}_${rawId}`;
                const ref = db.collection('reviews').doc(reviewId);
                
                const existing = await ref.get();
                if (!existing.exists) {
                    const content = review.text || review.content || review.comment || review.reviewText || '';
                    const rating = review.stars || review.rating || review.score || 5;
                    const customerName = review.name || review.reviewerName || review.author || review.consumerName || review?.user?.name || `${resultSet.source} User`;
                    const dateStr = review.publishedAtDate || review.date || review.createdAt || review.time || new Date().toISOString();
                    const responseText = review.responseFromOwnerText || review.ownerResponse || null;

                    batch.set(ref, {
                        id: reviewId,
                        organizationId: orgId,
                        customerName,
                        rating,
                        content,
                        source: resultSet.source, 
                        date: dateStr,
                        responded: !!responseText,
                        responseContent: responseText || null,
                        aiDraft: null,
                        externalUrl: review.reviewUrl || review.url || ''
                    });
                    ingestedCount++;
                }
            }
        }

        await batch.commit();
        return { success: true, ingested: ingestedCount };

    } catch (e: any) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        functions.logger.error("Error syncing Apify reviews", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});

// --- ADMIN PROVISIONING ---
export const createUserAuth = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'master_admin') {
        throw new functions.https.HttpsError("permission-denied", "Only Master Admins can explicitly create Auth layers.");
    }
    const { email, password, displayName, role, organizationId } = data;
    
    if (!email || !password) throw new functions.https.HttpsError("invalid-argument", "Missing email or temporary password.");

    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: displayName || email,
        });

        if (role || organizationId) {
            await auth.setCustomUserClaims(userRecord.uid, { 
                role: role || 'user',
                organizationId: organizationId || 'unaffiliated'
            });
        }
        return { uid: userRecord.uid };
    } catch (error: any) {
        functions.logger.error("Admin Auth provisioning failed:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export * from "./widgets";
export * from "./promotions";
export * from "./quickbooks";

// --- EXPANDED ANALYTICS MODULE ---
export const trackEmailOpen = functions.https.onRequest(async (req, res) => {
    // Permit any email client (Gmail, Outlook, etc) to render the image
    res.set('Access-Control-Allow-Origin', '*');

    const campaignId = req.query.campaignId as string;
    const customerId = req.query.customerId as string;
    
    if (campaignId) {
        const campaignRef = db.collection('marketingCampaigns').doc(campaignId);
        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(campaignRef);
                if (doc.exists) {
                    const data = doc.data() || {};
                    const openedBy = data.openedBy || [];
                    
                    // Conditionally record the specific Customer ID natively
                    if (customerId && !openedBy.includes(customerId)) {
                        transaction.update(campaignRef, {
                            readCount: admin.firestore.FieldValue.increment(1),
                            openedBy: admin.firestore.FieldValue.arrayUnion(customerId)
                        });
                    } else if (!customerId) {
                        transaction.update(campaignRef, {
                            readCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                }
            });
        } catch (err) {
            functions.logger.error("Pixel Execution Dump:", err);
        }
    }
    try {
        const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get();
        for (const org of orgsSnap.docs) {
            try {
                const result = await syncOrganizationShiftsToSquare(org.id);
                if (result.processed > 0) {
                    functions.logger.log(`Successfully synced ${result.processed} shifts to Square for Org ${org.id}`);
                }
            } catch (err) {
                functions.logger.warn(`Skipped Square Sync for Org ${org.id}:`, err);
            }
        }
        let totalPayoutsProcessed = 0;

        for (const org of orgsSnap.docs) {
            const orgId = org.id;
            
            // Query for completed jobs needing flat-rate payouts
            const jobsSnap = await db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('jobStatus', '==', 'Completed')
                .where('payoutStatus', '==', 'pending')
                .get();

            if (jobsSnap.empty) continue;

            for (const jobDoc of jobsSnap.docs) {
                const job = jobDoc.data();
                
                if (job.assignedTechnicianId && job.subcontractorFlatRate) {
                    const techDoc = await db.collection('users').doc(job.assignedTechnicianId).get();
                    if (techDoc.exists && techDoc.data()?.role === 'Subcontractor') {
                        // Natively route flat-rate splits to external partners
                        const payoutRef = db.collection('payouts').doc();
                        await payoutRef.set({
                            id: payoutRef.id,
                            organizationId: orgId,
                            subcontractorId: techDoc.id,
                            jobId: job.id,
                            amount: job.subcontractorFlatRate,
                            status: 'processing',
                            initiatedAt: new Date().toISOString()
                        });

                        await jobDoc.ref.update({
                            payoutStatus: 'processing',
                            payoutId: payoutRef.id
                        });

                        totalPayoutsProcessed++;
                    }
                }
            }
        }
        functions.logger.info(`Successfully processed ${totalPayoutsProcessed} subcontractor payout splits natively.`);
    } catch (e) {
        functions.logger.error("Global Subcontractor Payout Sync Failed:", e);
    }
});

// ==========================================
// UNIVERSAL LEAD WEBHOOK (GOOGLE ADS, ZAPIER)
// ==========================================
export const incomingLeadWebhook = functions.runWith({
    timeoutSeconds: 30,
    memory: "256MB"
// @ts-ignore
}).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    try {
        const orgId = req.query.orgId as string || req.body.orgId || req.body.organizationId;
        if (!orgId) { res.status(400).send('Missing orgId (Query Parameter or JSON Body required)'); return; }

        const secretDoc = await admin.firestore().collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!secretDoc.exists) { res.status(403).send("Organization not configured for webhooks."); return; }

        const configuredKey = secretDoc.data()?.webhookSecretKey;
        if (!configuredKey) { res.status(403).send("Webhook secret key not generated for this organization."); return; }

        const providedKey = req.query.apiKey || req.headers.authorization?.replace('Bearer ', '') || req.body.google_key || req.body.googleKey || req.body.apiKey;
        if (providedKey !== configuredKey) { res.status(401).send("Unauthorized Webhook Key."); return; }

        let firstName = req.body.firstName || req.body.customerName || req.body.name || 'Unknown';
        let lastName = req.body.lastName || '';
        let phone = req.body.phone || req.body.phoneNumber || '';
        let email = req.body.email || req.body.emailAddress || '';
        let notes = req.body.notes || req.body.description || req.body.issue || 'Lead ingested via Webhook.';

        // Google Ads Form Payload Format
        if (req.body.user_column_data && Array.isArray(req.body.user_column_data)) {
            req.body.user_column_data.forEach((col: any) => {
                if (col.column_id === 'FIRST_NAME') firstName = col.string_value;
                if (col.column_id === 'LAST_NAME') lastName = col.string_value;
                if (col.column_id === 'PHONE_NUMBER') phone = col.string_value;
                if (col.column_id === 'EMAIL') email = col.string_value;
            });
            notes = 'Lead ingested via Google Ads Campaign.';
        }

        const customerName = `${firstName} ${lastName}`.trim();
        const db = admin.firestore();

        let customerId = '';
        const emailQuery = await db.collection('customers').where('organizationId', '==', orgId).where('email', '==', email).limit(1).get();
        if (email && !emailQuery.empty) customerId = emailQuery.docs[0].id;
        else {
            const phoneQuery = await db.collection('customers').where('organizationId', '==', orgId).where('phone', '==', phone).limit(1).get();
            if (phone && !phoneQuery.empty) customerId = phoneQuery.docs[0].id;
            else {
                const newCustomerRef = db.collection('customers').doc();
                await newCustomerRef.set({
                    organizationId: orgId, name: customerName, email, phone, status: 'active', tags: ['webhook-lead'],
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                });
                customerId = newCustomerRef.id;
            }
        }

        const jobId = `job-${Date.now()}`;
        await db.collection('jobs').doc(jobId).set({
            id: jobId, organizationId: orgId, customerId, title: 'New Webhook Lead', status: 'Unassigned', priority: 'Medium',
            description: notes, customerName, createdAt: new Date().toISOString()
        });

        functions.logger.info(`Successfully ingested lead job ${jobId} for Org ${orgId}`);
        res.status(200).send({ success: true, message: "Lead processed successfully." });
    } catch (error: any) {
        functions.logger.error("Webhook Error:", error);
        res.status(500).send({ error: "Internal Server Error processing webhook.", message: error.message });
    }
});
