"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postToX = exports.fetchShovelsPermits = exports.fetchIotDiagnostics = exports.enforceHardQuotas = exports.provisionCustomDomain = exports.automatedMaintenanceReminders = exports.twilioInboundVoice = exports.punchoutWebhook = exports.initiatePunchoutSession = exports.incomingLeadWebhook = exports.trackEmailOpen = exports.createUserAuth = exports.syncExternalReviews = exports.measureQuickWebhook = exports.processMailQueue = exports.manageHandshake = exports.suggestBidPricing = exports.generateBidDocument = exports.searchHistoricalBidData = exports.analyzeRFP = exports.callGeminiAI = exports.callLandingChatbot = exports.generateReviewResponse = exports.linkCustomerOnUserCreate = exports.deleteAuthUser = exports.sendSms = exports.getPlatformMetrics = exports.setUserRole = exports.generateCommissionOnSubscriptionPayment = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const twitter_api_v2_1 = require("twitter-api-v2");
const admin = __importStar(require("firebase-admin"));
const billing_budgets_1 = require("@google-cloud/billing-budgets");
const monitoring_1 = require("@google-cloud/monitoring");
const billing_1 = require("@google-cloud/billing");
const generative_ai_1 = require("@google/generative-ai");
const xml2js = __importStar(require("xml2js"));
const squareUtils_1 = require("./squareUtils");
const aiAgent_1 = require("./aiAgent");
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
catch (e) { }
const auth = admin.auth();
const db = admin.firestore();
const billingBudgetsClient = new billing_budgets_1.BudgetServiceClient();
const monitoringClient = new monitoring_1.MetricServiceClient();
const billingClient = new billing_1.CloudBillingClient();
const DEFAULT_COMMISSION_RULES = {
    baseRate: 0.25, acceleratorRate: 0.30, annualQuota: 500000, renewalRate: 0.05,
    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
};
const GEMINI_FLASH_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_PRO_MODEL = "gemini-3.1-pro-preview";
// --- NEW COMMISSION LOGIC ---
exports.generateCommissionOnSubscriptionPayment = functions.firestore
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
        const platformSettings = settingsDocs[0].docs[0]?.data();
        const rules = settingsDocs[1].exists ? settingsDocs[1].data() : DEFAULT_COMMISSION_RULES;
        if (!platformSettings) {
            functions.logger.error("Platform settings not found. Cannot calculate commission.");
            return null;
        }
        const planName = org.plan || 'starter';
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
        }
        else if (totalRevenueYTD + saleValue > rules.annualQuota) {
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
exports.setUserRole = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'master_admin') {
        throw new functions.https.HttpsError("permission-denied", "Only Master Admins can set roles.");
    }
    await auth.setCustomUserClaims(data.uid, { role: data.role });
    await db.collection('users').doc(data.uid).update({ role: data.role });
    return { success: true };
});
exports.getPlatformMetrics = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        functions.logger.error("Fatal error in getPlatformMetrics:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError("internal", error.message);
        }
        throw new functions.https.HttpsError("internal", "An unknown error occurred.");
    }
});
async function getMetricsForProject(projectId, billingAccountId) {
    try {
        const billingInfo = await getBillingData(projectId, billingAccountId);
        const apiUsage = await getApiUsageMetrics(projectId);
        const dau = await getDAU(projectId);
        return { dau, billing: billingInfo, apiUsage };
    }
    catch (error) {
        functions.logger.error(`Failed to get metrics for project ${projectId}`, error);
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}
async function getDAU(projectId) {
    if (projectId !== process.env.APP_PROJECT_ID) {
        return { count: 0 };
    }
    try {
        const listUsersResult = await auth.listUsers();
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const recentUsers = listUsersResult.users.filter(user => user.metadata.lastSignInTime && new Date(user.metadata.lastSignInTime) >= twentyFourHoursAgo);
        return { count: recentUsers.length };
    }
    catch (e) {
        return { count: 0, error: "Auth access limited" };
    }
}
async function getBillingData(projectId, billingAccountId) {
    const billingAccountName = `billingAccounts/${billingAccountId}`;
    try {
        const [projectBillingInfo] = await billingClient.getProjectBillingInfo({ name: `projects/${projectId}` });
        if (!projectBillingInfo.billingEnabled) {
            return { costAmount: 0, budgetAmount: "0 (Billing Disabled)" };
        }
    }
    catch (e) {
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
    }
    catch (e) {
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
    }
    catch (e) {
        // Expected if billing export is not configured
    }
    let aiCost = 0;
    if (projectId === process.env.APP_PROJECT_ID) {
        try {
            const snap = await admin.firestore().collection('aiUsage').get();
            snap.forEach(doc => {
                const totalTokensUsed = doc.data().totalTokensUsed || 0;
                const virtualTokensUsed = doc.data().virtualWorkerTokensUsed || 0;
                const combinedTokens = totalTokensUsed + virtualTokensUsed;
                // Match frontend AiUsageMaster.tsx logic: $10 / 1M blended rate
                aiCost += (combinedTokens / 1000000) * 10;
            });
        }
        catch (e) {
            functions.logger.warn('Could not fetch aiUsage costs:', e);
        }
    }
    // Merge aiCost into costAmount if monitoring fails to provide accurate >0 data
    if (costAmount === 0 && aiCost > 0) {
        costAmount = aiCost;
    }
    else {
        costAmount += aiCost;
    }
    return { costAmount, budgetAmount: String(budgetAmount) };
}
async function getApiUsageMetrics(projectId) {
    const usageMetrics = {};
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
                interval: { startTime: { seconds: Math.floor(startTime.getTime() / 1000) }, endTime: { seconds: Math.floor(now / 1000) } },
                aggregation: { alignmentPeriod: { seconds: 86400 }, perSeriesAligner: 'ALIGN_SUM' }
            });
            usageMetrics[metricType] = timeSeries[0]?.points?.reduce((sum, point) => sum + Number(point.value?.int64Value ?? point.value?.doubleValue ?? 0), 0) ?? 0;
        }
        catch (error) {
            usageMetrics[metricType] = 0;
        }
    }
    return usageMetrics;
}
// --- MESSAGING ---
exports.sendSms = functions.firestore.document('messages/{msgId}').onCreate(async (snap) => {
    const msg = snap.data();
    if (!msg || msg.type !== 'sms' || !msg.receiverId)
        return;
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
        }
        else {
            const err = await response.json();
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: err.message || 'Twilio Error' });
        }
    }
    catch (e) {
        functions.logger.error("SMS Send Error:", e);
        await snap.ref.update({ deliveryStatus: 'failed', deliveryError: e.message });
    }
});
// --- AUTH UTILS ---
exports.deleteAuthUser = functions.firestore.document('users/{userId}').onDelete(async (snap, context) => {
    try {
        await auth.deleteUser(context.params.userId);
        functions.logger.log(`Successfully deleted auth user: ${context.params.userId}`);
    }
    catch (error) {
        functions.logger.error(`Error deleting auth user: ${context.params.userId}`, error);
    }
});
exports.linkCustomerOnUserCreate = functions.firestore.document('users/{userId}').onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;
    const email = userData.email?.toLowerCase().trim();
    let orgId = userData.organizationId;
    if (!email)
        return;
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
            if (!orgId || orgId === 'unaffiliated')
                return;
        }
        // Scope search to orgId if it was already provided
        const orgSnap = await db.collection('customers').where('organizationId', '==', orgId).get();
        const match = orgSnap.docs.find(d => (d.data().email || '').toLowerCase().trim() === email);
        if (match && match.data().userId !== userId) {
            await db.collection('customers').doc(match.id).update({ userId: userId });
            functions.logger.info(`Successfully linked customer ${match.id} to user ${userId}`);
        }
    }
    catch (e) {
        functions.logger.error(`Error linking customer for user ${userId}:`, e);
    }
});
// --- AI USAGE TRACKING ---
async function trackAiUsage(orgId, taskName, modelName, tokenCount) {
    if (!orgId || orgId === 'unauthenticated' || tokenCount <= 0)
        return;
    try {
        const orgUsageRef = db.collection('aiUsage').doc(orgId);
        await orgUsageRef.set({
            organizationId: orgId,
            totalTokensUsed: admin.firestore.FieldValue.increment(tokenCount),
            [`tasks.${taskName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`models.${modelName.replace(/\./g, '_')}`]: admin.firestore.FieldValue.increment(tokenCount),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Check if limit hit
        const docSnap = await orgUsageRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data?.limitTokens && data.totalTokensUsed > data.limitTokens) {
                functions.logger.warn(`Org ${orgId} has exceeded their AI token limit (${data.totalTokensUsed} / ${data.limitTokens})`);
            }
        }
    }
    catch (e) {
        functions.logger.error("Failed to track AI usage:", e);
    }
}
// --- AI UTILS ---
exports.generateReviewResponse = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { review } = data;
    if (!review)
        throw new functions.https.HttpsError("invalid-argument", "Review object missing.");
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        await trackAiUsage(orgId, 'Review Response', GEMINI_FLASH_MODEL, tokens);
        return { text: response.text() };
    }
    catch (error) {
        functions.logger.error("Review GenAI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate review response.");
    }
});
exports.callLandingChatbot = functions.https.onCall(async (data, context) => {
    const orgId = context.auth?.token.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { prompt, systemInstruction } = data;
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL, systemInstruction });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        await trackAiUsage(orgId, 'Landing Chatbot', GEMINI_FLASH_MODEL, tokens);
        return { text: response.text() };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.callGeminiAI = functions.runWith({ timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    // Force rebuild for env variables
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { prompt, modelName = GEMINI_FLASH_MODEL, config = {}, imageParts = [], image = null, contextOrgId = null } = data;
    // Allow master admin to specify which org's context to load (defaults to caller's org)
    const contextTarget = contextOrgId || orgId;
    try {
        // Fetch org-specific AI training context (branding, legal, contact info)
        let orgContext = '';
        try {
            const ctxDoc = await db.collection('organizations').doc(contextTarget).collection('ai_context').doc('profile').get();
            if (ctxDoc.exists) {
                orgContext = ctxDoc.data()?.context || '';
            }
        }
        catch (ctxErr) {
            functions.logger.warn('Failed to load org AI context, proceeding without:', ctxErr);
        }
        const enrichedPrompt = orgContext
            ? `[ORGANIZATION CONTEXT - Use this for branding, logos, contact info, and legal terms]\n${orgContext}\n\n[END ORGANIZATION CONTEXT]\n\n${prompt}`
            : prompt;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName, ...config });
        let result;
        const parts = [{ text: enrichedPrompt }];
        if (imageParts && imageParts.length > 0) {
            imageParts.forEach((part) => {
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
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        await trackAiUsage(orgId, 'General AI Content', modelName, tokens);
        return { text: response.text() };
    }
    catch (error) {
        functions.logger.error("Gemini AI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate content.");
    }
});
// --- BID HELPER ---
exports.analyzeRFP = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const { files } = data;
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "No files provided.");
    }
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });
        const analyses = await Promise.all(files.map(async (file) => {
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
            try {
                const result = await model.generateContent([
                    { inlineData: { data: fileData, mimeType } },
                    { text: prompt }
                ]);
                const response = await result.response;
                const tokens = response.usageMetadata?.totalTokenCount || 0;
                await trackAiUsage(orgId, 'Analyze RFP', GEMINI_PRO_MODEL, tokens);
                let text = response.text();
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(text);
                }
                catch (e) {
                    console.error("Failed to parse AI response as JSON. Raw text:", text);
                    throw new Error("Failed to parse AI response as JSON for one of the files.");
                }
            }
            catch (err) {
                console.warn(`File analysis skipped or failed for ${mimeType}:`, err.message);
                if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                    console.warn("Pro model overloaded. Falling back to Flash model...");
                    try {
                        const fallbackModel = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
                        const fallbackResult = await fallbackModel.generateContent([
                            { inlineData: { data: fileData, mimeType } },
                            { text: prompt }
                        ]);
                        const fallbackResponse = await fallbackResult.response;
                        const tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                        await trackAiUsage(orgId, 'Analyze RFP', GEMINI_FLASH_MODEL, tokens);
                        let fallbackText = fallbackResponse.text();
                        fallbackText = fallbackText.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(fallbackText);
                    }
                    catch (fallbackErr) {
                        console.error("Fallback to Flash model also failed:", fallbackErr.message);
                        throw new Error(`AI Service is currently overloaded (503 High Demand). Please try again later. Details: ${fallbackErr.message}`);
                    }
                }
                if (err.message && err.message.includes("Unsupported MIME type")) {
                    return {
                        requirements: ["Notice: The system cannot directly read this file type (e.g. Excel/Word)."],
                        deliverables: ["Please convert files to PDF before uploading, or enter data manually."],
                        summary: `Unsupported file type (${mimeType}). Please upload a PDF.`,
                        solicitationNumber: "N/A",
                        agency: "N/A",
                        dueDate: null,
                        questions: [],
                        lineItems: []
                    };
                }
                throw err;
            }
        }));
        return { analyses };
    }
    catch (error) {
        functions.logger.error("RFP Analysis Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to analyze RFP.");
    }
});
exports.searchHistoricalBidData = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const { bid } = data;
    if (!bid)
        throw new functions.https.HttpsError("invalid-argument", "No bid data provided.");
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });
        const prompt = `Search for historical data and market research for this government solicitation: ${JSON.stringify(bid)}. 
        Simulate a search and provide a detailed report on similar past contracts, typical winning prices, and potential competitors. 
        Format the output as a clean HTML document.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        await trackAiUsage(orgId, 'Historical Bid Search', GEMINI_PRO_MODEL, tokens);
        return { content: response.text() };
    }
    catch (error) {
        functions.logger.error("Historical Search Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to search historical data.");
    }
});
exports.generateBidDocument = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in to generate bid documents.");
    }
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;
    if (!orgId) {
        throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
    }
    functions.logger.info(`Bid generation for Org ${orgId} initiated.`);
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { bid, orgContext, prompt, isGlobalEdit, docIndex } = data;
    if (!bid || !prompt) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with a 'bid' and 'prompt'.");
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
        }
        else if (docIndex !== undefined) {
            const specificDocContent = bid.generatedDocs?.[docIndex]?.content || '';
            fullPrompt = `You are a professional proposal writer.
             Apply this instruction: "${prompt}" to the following specific document.
             Respond STRICTLY with the raw HTML content for the new document. Do not wrap in JSON.
             
             Current Document:
             ${specificDocContent}`;
        }
        else {
            // Build an explicit pricing table so the AI uses EXACT prices
            const lineItems = bid.lineItems || [];
            let pricingTable = 'CLIN | Description | Unit | Qty | Unit Price | Total Price\n';
            pricingTable += '--- | --- | --- | --- | --- | ---\n';
            let grandTotal = 0;
            lineItems.forEach((item, idx) => {
                const qty = item.qty || 0;
                const unitPrice = item.unitPrice || 0;
                const totalPrice = item.totalPrice || (qty * unitPrice);
                grandTotal += totalPrice;
                pricingTable += `${idx + 1} | ${item.description || 'Item'} | ${item.unit || 'EA'} | ${qty} | $${unitPrice.toFixed(2)} | $${totalPrice.toFixed(2)}\n`;
            });
            pricingTable += `GRAND TOTAL | | | | | $${grandTotal.toFixed(2)}\n`;
            // Build Q&A context explicitly
            const questionsContext = (bid.questions || [])
                .filter((q) => q.answer && q.answer.trim())
                .map((q) => `Q: ${q.question || q.text || 'Unknown'}\nA: ${q.answer}`)
                .join('\n\n');
            // CSS stylesheet that MUST be embedded in every document
            const cssStylesheet = `<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#1e293b;line-height:1.7;max-width:900px;margin:0 auto;padding:24px}
.doc-header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:20px;margin-bottom:30px}
.doc-header h1{font-size:22px;color:#1e40af;margin:0 0 6px 0;font-weight:800;text-transform:uppercase;letter-spacing:1px}
.doc-header p{margin:2px 0;font-size:13px;color:#475569}
.doc-header .credentials{font-size:12px;color:#64748b;margin-top:8px}
h2{color:#1e40af;font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:32px;margin-bottom:16px;font-weight:700}
h3{color:#334155;font-size:15px;margin-top:20px;margin-bottom:10px;font-weight:600}
p{margin:8px 0;font-size:14px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th{background:#1e40af;color:white;padding:10px 12px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
tr:last-child td{border-bottom:2px solid #1e40af;font-weight:700}
.total-row{background:#eff6ff!important;font-weight:800;font-size:15px}
.total-row td{border-top:2px solid #1e40af;border-bottom:2px solid #1e40af}
ul,ol{padding-left:24px;margin:8px 0}
li{margin:4px 0;font-size:14px}
.signature-block{margin-top:48px;border-top:1px solid #e2e8f0;padding-top:20px}
.signature-line{border-top:1px solid #1e293b;width:300px;margin-top:40px;padding-top:4px;font-size:13px}
</style>`;
            fullPrompt = `You are an expert government contracting proposal manager producing a PERFECT, complete, ready-to-submit proposal package.

### COMPANY INFORMATION (use these EXACT values — never invent or substitute):
- Company Name: ${orgContext?.name || 'NOT PROVIDED'}
- Phone: ${orgContext?.phone || 'NOT PROVIDED'}
- Email: ${orgContext?.email || 'NOT PROVIDED'}
- Address: ${orgContext?.address ? `${orgContext.address.street}, ${orgContext.address.city}, ${orgContext.address.state} ${orgContext.address.zip}` : 'NOT PROVIDED'}
- UEI Number: ${orgContext?.ueid || 'NOT PROVIDED'}
- CAGE Code: ${orgContext?.cageCode || 'NOT PROVIDED'}
- Primary NAICS: ${orgContext?.primaryNaics || 'NOT PROVIDED'}
- License Number: ${orgContext?.licenseNumber || 'NOT PROVIDED'}

### BID METADATA:
- Title: ${bid.title || 'Untitled Bid'}
- Solicitation #: ${bid.solicitationNumber || 'N/A'}
- Agency: ${bid.agency || 'N/A'}
- Due Date: ${bid.dueDate || 'N/A'}
- Summary: ${bid.summary || 'N/A'}

### REQUIREMENTS:
${(bid.requirements || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || 'None extracted.'}

### DELIVERABLES:
${(bid.deliverables || []).map((d, i) => `${i + 1}. ${d}`).join('\n') || 'None extracted.'}

### QUESTIONS & ANSWERS (integrate these into the narrative):
${questionsContext || 'No Q&A provided.'}

### PRICING SCHEDULE — USE THESE EXACT DOLLAR AMOUNTS (DO NOT CHANGE ANY PRICES):
${pricingTable}

CRITICAL PRICING RULE: The Pricing Schedule document MUST use the EXACT unit prices, quantities, and totals shown above. The grand total MUST be exactly $${grandTotal.toFixed(2)}. Do NOT round, estimate, or change any dollar amount.

### DOCUMENT FORMATTING REQUIREMENTS:
Every document in the package MUST begin with this exact CSS stylesheet and header structure:

${cssStylesheet}

<div class="doc-header">
  <h1>[Company Name]</h1>
  <p>[Address] | [Email] | [Phone]</p>
  <p class="credentials">UEI: [UEI] | CAGE: [CAGE] | NAICS: [NAICS]</p>
</div>

### DOCUMENTS TO GENERATE:
Generate the following documents as separate items in the JSON array:
1. **Cover Letter** — Professional cover letter from the company to the Agency. Include a signature block.
2. **Executive Summary & Technical Approach** — Compelling narrative using the Q&A answers. Demonstrate understanding of the scope.
3. **Pricing Schedule** — Professional table using the EXACT pricing data above. Include CLIN numbers, descriptions, unit, qty, unit price, total, and grand total row.
4. **Past Performance & Qualifications** — Company capabilities, relevant experience, and qualifications.
5. **Compliance Matrix** — Table mapping each requirement/deliverable to the company's response approach.
${(bid.deliverables || []).some((d) => d.includes('(Submittal)')) ? '6. **Required Submittal Documents** — Draft responses for all (Submittal) deliverables.' : ''}

### OUTPUT FORMAT:
Return ONLY a JSON array. No markdown code fences. No explanation text before or after.
Each element: {"title": "Document Title", "content": "<full HTML with embedded CSS>"}

Example of correct output start:
[{"title":"Cover Letter","content":"<style>...</style><div class=\\"doc-header\\">...`;
        }
        let text = "";
        let tokens = 0;
        let usedModel = GEMINI_PRO_MODEL;
        try {
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            tokens = response.usageMetadata?.totalTokenCount || 0;
            text = response.text();
        }
        catch (err) {
            if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                functions.logger.warn("Pro model overloaded in document generation. Falling back to Flash model...");
                const fallbackModel = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
                const fallbackResult = await fallbackModel.generateContent(fullPrompt);
                const fallbackResponse = await fallbackResult.response;
                tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                text = fallbackResponse.text();
                usedModel = GEMINI_FLASH_MODEL;
            }
            else {
                throw err;
            }
        }
        await trackAiUsage(orgId, 'Generate Bid Document', usedModel, tokens);
        if (isGlobalEdit || docIndex === undefined) {
            // Robust JSON extraction: strip code fences, then try to find the JSON array
            text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            // Try direct parse first
            let docs;
            try {
                docs = JSON.parse(text);
            }
            catch (e) {
                // Fallback: find the outermost JSON array in the response
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    try {
                        docs = JSON.parse(arrayMatch[0]);
                    }
                    catch (e2) {
                        functions.logger.error("Failed to parse document generation response (both attempts)", text.substring(0, 500));
                        throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                    }
                }
                else {
                    functions.logger.error("No JSON array found in response", text.substring(0, 500));
                    throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                }
            }
            return { docs };
        }
        else {
            return { docs: [{ title: bid.generatedDocs[docIndex].title, content: text.replace(/```html/g, '').replace(/```/g, '').trim() }] };
        }
    }
    catch (error) {
        functions.logger.error("Error generating bid document:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate document.");
    }
});
exports.suggestBidPricing = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { bid } = data;
    if (!bid || !bid.lineItems || bid.lineItems.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Missing bid or line items.");
    }
    try {
        const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;
        if (!orgId) {
            throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
        }
        const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Using flash model for faster, consistent parsing
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        // 1. Gather historical context if available.
        // Similar to the historical research report, we find recent bids.
        const recentBidsSnap = await db.collection('bids')
            .where('organizationId', '==', bid.organizationId || orgId)
            .limit(10)
            .get();
        let historicalContext = '';
        if (!recentBidsSnap.empty) {
            historicalContext = recentBidsSnap.docs.map(doc => {
                const b = doc.data();
                return `Bid: ${b.title || 'Untitled'}\nAgency: ${b.agency || 'Unknown'}\nTotal Value: $${b.totalValue || 'Unknown'}\nItems: ${b.lineItems?.map((li) => `${li.description} - qty ${li.qty} @ $${li.unitPrice}`).join(', ') || 'None'}`;
            }).join('\n\n');
        }
        // 2. Prepare the prompt
        const prompt = `
You are an expert pricing strategist and bid estimator.
Your task is to analyze the provided Bid Line Items and suggest an optimized "Recommended Unit Price" for each item.
Your goal is to maximize profitability while remaining highly competitive to win the bid.

### Bid Context
Title: ${bid.title}
Agency/Customer: ${bid.agency}
Due Date: ${bid.dueDate}
Summary: ${bid.summary}

### Historical Pricing Context (Past Bids from this Organization)
${historicalContext ? historicalContext : "No historical data available."}

### Current Line Items to Price
${JSON.stringify(bid.lineItems.map((item) => ({
            id: item.id,
            description: item.description,
            unit: item.unit,
            qty: item.qty,
            currentUnitPrice: item.unitPrice
        })), null, 2)}

Instructions:
1. Review each line item's description, unit, and quantity.
2. Consider any historical pricing context provided. If an item is similar to a past bid, factor that in.
3. Suggest a realistic, competitive, and profitable unit price for each item.
4. If a currentUnitPrice is already provided (>0), use it as a baseline but optimize it if necessary.
5. Return ONLY a valid JSON array of objects. Do not include markdown formatting (like \`\`\`json).

Output Format:
[
  {
    "id": "item-id",
    "aiRecommendedPrice": 125.50
  }
]
`;
        let response;
        try {
            response = await model.generateContent([
                { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                { text: prompt }
            ]);
        }
        catch (error) {
            if (error.message?.includes("429") || error.status === 429) {
                functions.logger.warn(`429 Too Many Requests on gemini-2.0-flash, falling back to ${GEMINI_FLASH_MODEL}`);
                const fallbackModel = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
                response = await fallbackModel.generateContent([
                    { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                    { text: prompt }
                ]);
            }
            else {
                throw error;
            }
        }
        let text = response.response.text().trim();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let recommendations;
        try {
            recommendations = JSON.parse(text);
        }
        catch (e) {
            functions.logger.error("Failed to parse AI pricing recommendations:", text);
            throw new Error("AI returned invalid JSON.");
        }
        // 3. Map recommendations back to the original line items
        const updatedLineItems = bid.lineItems.map((item) => {
            const rec = recommendations.find((r) => r.id === item.id);
            if (rec && typeof rec.aiRecommendedPrice === 'number') {
                return { ...item, aiRecommendedPrice: rec.aiRecommendedPrice };
            }
            return item;
        });
        return { updatedLineItems };
    }
    catch (error) {
        functions.logger.error("Error generating AI pricing:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate AI pricing.");
    }
});
// --- PARTNER HANDSHAKE ---
exports.manageHandshake = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { action, targetOrgId, requestingOrgId, subcontractorId } = data;
    if (action === 'request') {
        if (!targetOrgId)
            throw new functions.https.HttpsError('invalid-argument', 'Target Org ID required.');
        if (!requestingOrgId)
            throw new functions.https.HttpsError('invalid-argument', 'Requesting Org ID required.');
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
        if (!targetOrgData || !requestOrgData)
            throw new functions.https.HttpsError('not-found', 'Organization not found.');
        const request = targetOrgData.partnerRequests?.find((r) => r.fromOrgId === requestingOrgId);
        if (!request)
            throw new functions.https.HttpsError('not-found', 'Request not found.');
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
        const request = myOrgData?.partnerRequests?.find((r) => r.fromOrgId === requestingOrgId);
        if (request) {
            await myOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });
            if (request.subcontractorId) {
                try {
                    await db.collection('subcontractors').doc(request.subcontractorId).update({
                        handshakeStatus: 'None'
                    });
                }
                catch (e) {
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
        const request = targetOrgData?.partnerRequests?.find((r) => r.fromOrgId === requestingOrgId);
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
exports.processMailQueue = functions.firestore.document('mail_queue/{docId}').onCreate(async (snap, context) => {
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
                        if (!payload.message)
                            payload.message = {};
                        payload.message.from = `"${smtp.fromName}" <${smtp.fromEmail}>`;
                    }
                }
            }
            else {
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
                            if (!payload.message)
                                payload.message = {};
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
    }
    catch (error) {
        functions.logger.error(`Failed to process mail queue for org ${orgId}`, error);
    }
});
exports.measureQuickWebhook = functions.https.onRequest(async (req, res) => {
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
            jobId: jobId,
            organizationId: orgId,
            source: 'measureQuick',
            healthScore: payload.healthScore || null,
            systemType: payload.systemType || null,
            pdfReportUrl: payload.pdfReportUrl || null,
            measurements: payload.measurements || {},
            diagnostics: payload.diagnostics || [],
            createdAt: new Date().toISOString()
        };
        // Save it to the specific Job's sub-collection
        await db.collection('jobs').doc(jobId).collection('diagnostics').doc(reportId).set(report);
        functions.logger.info(`Successfully parsed measureQuick report for job ${jobId}`);
        res.status(200).send({ success: true, reportId });
    }
    catch (error) {
        functions.logger.error('Error processing measureQuick webhook payload', error);
        res.status(500).send('Internal Server Error');
    }
});
// --- APIFY REVIEW AGGREGATION ---
exports.syncExternalReviews = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
    const orgId = data.organizationId;
    if (!orgId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing organizationId');
    try {
        const [orgDoc, secretsDoc] = await Promise.all([
            db.collection('organizations').doc(orgId).get(),
            db.collection('platformSettings').doc('secrets').get()
        ]);
        const orgData = orgDoc.data();
        const masterSecrets = secretsDoc.data();
        if (!orgData)
            throw new functions.https.HttpsError('not-found', 'Organization not found.');
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
                if (!response.ok)
                    return { source: task.source, items: [] };
                const items = await response.json();
                return { source: task.source, items: Array.isArray(items) ? items : [] };
            }
            catch (err) {
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
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        functions.logger.error("Error syncing Apify reviews", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});
// --- ADMIN PROVISIONING ---
exports.createUserAuth = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'master_admin') {
        throw new functions.https.HttpsError("permission-denied", "Only Master Admins can explicitly create Auth layers.");
    }
    const { email, password, displayName, role, organizationId } = data;
    if (!email || !password)
        throw new functions.https.HttpsError("invalid-argument", "Missing email or temporary password.");
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
    }
    catch (error) {
        functions.logger.error("Admin Auth provisioning failed:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});
__exportStar(require("./widgets"), exports);
__exportStar(require("./promotions"), exports);
__exportStar(require("./quickbooks"), exports);
// --- EXPANDED ANALYTICS MODULE ---
exports.trackEmailOpen = functions.https.onRequest(async (req, res) => {
    // Permit any email client (Gmail, Outlook, etc) to render the image
    res.set('Access-Control-Allow-Origin', '*');
    const campaignId = req.query.campaignId;
    const customerId = req.query.customerId;
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
                    }
                    else if (!customerId) {
                        transaction.update(campaignRef, {
                            readCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                }
            });
        }
        catch (err) {
            functions.logger.error("Pixel Execution Dump:", err);
        }
    }
    try {
        const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get();
        for (const org of orgsSnap.docs) {
            try {
                const result = await (0, squareUtils_1.syncOrganizationShiftsToSquare)(org.id);
                if (result.processed > 0) {
                    functions.logger.log(`Successfully synced ${result.processed} shifts to Square for Org ${org.id}`);
                }
            }
            catch (err) {
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
            if (jobsSnap.empty)
                continue;
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
    }
    catch (e) {
        functions.logger.error("Global Subcontractor Payout Sync Failed:", e);
    }
});
// ==========================================
// UNIVERSAL LEAD WEBHOOK (GOOGLE ADS, ZAPIER)
// ==========================================
exports.incomingLeadWebhook = functions.runWith({
    timeoutSeconds: 30,
    memory: "256MB"
    // @ts-ignore
}).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const orgId = req.query.orgId || req.body.orgId || req.body.organizationId;
        if (!orgId) {
            res.status(400).send('Missing orgId (Query Parameter or JSON Body required)');
            return;
        }
        const secretDoc = await admin.firestore().collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!secretDoc.exists) {
            res.status(403).send("Organization not configured for webhooks.");
            return;
        }
        const configuredKey = secretDoc.data()?.webhookSecretKey;
        if (!configuredKey) {
            res.status(403).send("Webhook secret key not generated for this organization.");
            return;
        }
        const providedKey = req.query.apiKey || req.headers.authorization?.replace('Bearer ', '') || req.body.google_key || req.body.googleKey || req.body.apiKey;
        if (providedKey !== configuredKey) {
            res.status(401).send("Unauthorized Webhook Key.");
            return;
        }
        let firstName = req.body.firstName || req.body.customerName || req.body.name || 'Unknown';
        let lastName = req.body.lastName || '';
        let phone = req.body.phone || req.body.phoneNumber || '';
        let email = req.body.email || req.body.emailAddress || '';
        let notes = req.body.notes || req.body.description || req.body.issue || 'Lead ingested via Webhook.';
        // Google Ads Form Payload Format
        if (req.body.user_column_data && Array.isArray(req.body.user_column_data)) {
            req.body.user_column_data.forEach((col) => {
                if (col.column_id === 'FIRST_NAME')
                    firstName = col.string_value;
                if (col.column_id === 'LAST_NAME')
                    lastName = col.string_value;
                if (col.column_id === 'PHONE_NUMBER')
                    phone = col.string_value;
                if (col.column_id === 'EMAIL')
                    email = col.string_value;
            });
            notes = 'Lead ingested via Google Ads Campaign.';
        }
        const customerName = `${firstName} ${lastName}`.trim();
        const db = admin.firestore();
        // --- Advanced Webhook Deduplication and Portal Invite ---
        let customerId = '';
        let existingCustomerData = null;
        const matchName = customerName.toLowerCase().trim();
        const matchPhone = phone.replace(/\D/g, '');
        const matchEmail = email.toLowerCase().trim();
        const customersSnapshot = await db.collection('customers').where('organizationId', '==', orgId).get();
        const existingDoc = customersSnapshot.docs.find(d => {
            const data = d.data();
            const dName = (data.name || '').toLowerCase().trim();
            const dPhone = (data.phone || '').replace(/\D/g, '');
            const dEmail = (data.email || '').toLowerCase().trim();
            if (dName === matchName && ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail)))
                return true;
            if ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail))
                return true;
            return false;
        });
        if (existingDoc) {
            customerId = existingDoc.id;
            existingCustomerData = existingDoc.data();
            const updates = {};
            if (phone && !existingCustomerData.phone)
                updates.phone = phone;
            if (email && !existingCustomerData.email)
                updates.email = email;
            if (Object.keys(updates).length > 0)
                await existingDoc.ref.update(updates);
        }
        else {
            const newCustomerRef = db.collection('customers').doc();
            await newCustomerRef.set({
                id: newCustomerRef.id,
                organizationId: orgId, name: customerName, email, phone, status: 'active', tags: ['webhook-lead'],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
            customerId = newCustomerRef.id;
        }
        const jobId = `job-${Date.now()}`;
        await db.collection('jobs').doc(jobId).set({
            id: jobId, organizationId: orgId, customerId, title: 'New Webhook Lead Request', status: 'Unassigned', priority: 'Medium',
            description: notes, customerName, customerPhone: phone || existingCustomerData?.phone || '', createdAt: new Date().toISOString()
        });
        // Trigger Automated Portal Invitation Location
        const targetEmail = email || existingCustomerData?.email;
        if (targetEmail) {
            await db.collection('mail').add({
                to: [targetEmail],
                organizationId: orgId,
                message: {
                    subject: "Your Service Request Has Been Received",
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Hi ${firstName || customerName.split(' ')[0]},</h2>
                            <p>Thanks for reaching out! We've secured your service request and our team is reviewing it now.</p>
                            <p>You can view your appointment details, update your information, and manage your account via our secure portal:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://app.tektrakker.com/portal/${customerId}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Portal</a>
                            </div>
                            <p>If you don't use the button above, copy and paste this link: https://app.tektrakker.com/portal/${customerId}</p>
                            <br/>
                            <p>Best regards,</p>
                            <p>Your Service Team</p>
                        </div>
                    `
                }
            });
        }
        functions.logger.info(`Successfully ingested lead job ${jobId} for Org ${orgId}`);
        res.status(200).send({ success: true, message: "Lead processed successfully." });
    }
    catch (error) {
        functions.logger.error("Webhook Error:", error);
        res.status(500).send({ error: "Internal Server Error processing webhook.", message: error.message });
    }
});
// --- B2B SUPPLIER PUNCHOUT (cXML) ---
exports.initiatePunchoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId;
    if (!orgId)
        throw new functions.https.HttpsError("permission-denied", "User has no organization tied.");
    // 1. Fetch the organization's settings
    const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
    const config = secretsDoc.data()?.punchoutConfig;
    if (!config || !config.setupUrl || !config.sharedSecret) {
        throw new functions.https.HttpsError("failed-precondition", "B2B PunchOut is not fully configured in your Settings.");
    }
    const { fromDomain, fromIdentity, toDomain, toIdentity, sharedSecret, setupUrl } = config;
    if (!fromIdentity || !toIdentity)
        throw new functions.https.HttpsError("failed-precondition", "PunchOut identity config is incomplete.");
    // The webhook URL built dynamically (We can also use req host if needed, but hardcoding the standard FB URL here for standard cloud functions)
    const browserFormPostURL = `https://${process.env.GCP_PROJECT || 'us-central1-tektrakker'}.cloudfunctions.net/punchoutWebhook?orgId=${orgId}`;
    // 2. Build the cXML Setup Request
    const payloadID = `setup_${Date.now()}@tektrakker`;
    const cxmlObject = {
        cXML: {
            $: {
                payloadID: payloadID,
                timestamp: new Date().toISOString(),
                version: "1.2.008",
                "xml:lang": "en-US"
            },
            Header: [{
                    From: [{ Credential: [{ $: { domain: fromDomain }, Identity: [fromIdentity] }] }],
                    To: [{ Credential: [{ $: { domain: toDomain }, Identity: [toIdentity] }] }],
                    Sender: [{
                            Credential: [{
                                    $: { domain: fromDomain },
                                    Identity: [fromIdentity],
                                    SharedSecret: [sharedSecret]
                                }],
                            UserAgent: ["TekTrakker B2B Agent"]
                        }]
                }],
            Request: [{
                    $: { deploymentMode: "production" },
                    PunchOutSetupRequest: [{
                            $: { operation: "create" },
                            BuyerCookie: [JSON.stringify({ userId: context.auth.uid, jobId: data.jobId || 'GENERAL' })],
                            Extrinsic: [{ $: { name: "UserEmail" }, _: context.auth.token.email || 'user@example.com' }],
                            BrowserFormPost: [{ URL: [browserFormPostURL] }],
                            Contact: [{
                                    Name: [{ $: { "xml:lang": "en" }, _: context.auth.token.name || 'TekTrakker Technician' }],
                                    Email: [context.auth.token.email || 'platform@tektrakker.com']
                                }]
                        }]
                }]
        }
    };
    // 3. Post to Supplier
    const builder = new xml2js.Builder({ headless: true });
    const xml = builder.buildObject(cxmlObject);
    const doctype = '<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">\n';
    const finalXml = doctype + xml;
    try {
        const response = await fetch(setupUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
            body: finalXml
        });
        const responseText = await response.text();
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(responseText);
        const statusCode = result?.cXML?.Response?.Status?.$?.code;
        if (statusCode === "200") {
            const startPageUrl = result?.cXML?.Response?.PunchOutSetupResponse?.StartPage?.URL;
            if (startPageUrl) {
                return { success: true, url: startPageUrl };
            }
        }
        const errMsg = result?.cXML?.Response?.Status?.$?.text || "Unknown supplier error";
        functions.logger.error("PunchOut Setup Failed", responseText);
        throw new functions.https.HttpsError("internal", "Supplier rejected standard handshake: " + errMsg);
    }
    catch (e) {
        functions.logger.error("PunchOut Fetch Error:", e);
        throw new functions.https.HttpsError("internal", e.message || "Failed to contact supplier.");
    }
});
exports.punchoutWebhook = functions.https.onRequest(async (req, res) => {
    // Standard cXML HTTP Post from supplier returning cart
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // Use rawBody buffer or string fallback
    const rawXml = req.rawBody ? req.rawBody.toString() : req.body;
    let orgId = req.query.orgId;
    if (!rawXml) {
        res.status(400).send("Empty payload");
        return;
    }
    try {
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(rawXml);
        const orderMessage = result?.cXML?.Message?.PunchOutOrderMessage;
        if (!orderMessage) {
            res.status(400).send("Not a valid PunchOutOrderMessage");
            return;
        }
        let buyerCookie = orderMessage.BuyerCookie;
        let jobId = 'GENERAL';
        let userId = 'SYSTEM';
        if (typeof buyerCookie === 'string' && buyerCookie.startsWith('{')) {
            try {
                const cookieMap = JSON.parse(buyerCookie);
                if (cookieMap.jobId)
                    jobId = cookieMap.jobId;
                if (cookieMap.userId)
                    userId = cookieMap.userId;
            }
            catch (e) { }
        }
        const totalAmount = parseFloat(orderMessage.PunchOutOrderMessageHeader?.Total?.Money?._ || '0');
        let itemsField = orderMessage.ItemIn || [];
        if (!Array.isArray(itemsField))
            itemsField = [itemsField]; // Normalize if single item
        const itemDescriptions = itemsField.map((i) => {
            const desc = i.ItemDetail?.Description?._ || i.ItemDetail?.Description || 'Unknown part';
            const price = i.ItemDetail?.UnitPrice?.Money?._ || '0.00';
            const qty = i.$?.quantity || '0';
            return `${qty}x ${desc} @ ${price}`;
        });
        const partsList = itemDescriptions.join(', ');
        // Push the order natively into the TekTrakker DB
        if (orgId) {
            const newPartOrder = {
                id: `po-${Date.now()}`,
                organizationId: orgId,
                jobId: jobId,
                parts: partsList || 'Unknown B2B Order',
                cost: totalAmount,
                status: 'Procured via Supplier Cart',
                fulfillmentMethod: 'B2B PunchOut Integration',
                orderedBy: userId,
                createdAt: new Date().toISOString(),
                supplierTransactionID: result?.cXML?.$?.payloadID || 'Unknown'
            };
            await db.collection('partOrders').doc(newPartOrder.id).set(newPartOrder);
        }
        // Must send 200 OK cXML back acknowledging receipt or supplier will retry
        const replyXml = `<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML payloadID="webhook_reply_${Date.now()}@tektrakker" timestamp="${new Date().toISOString()}" version="1.2.014">
   <Response>
      <Status code="200" text="OK"/>
   </Response>
</cXML>`;
        res.set('Content-Type', 'application/xml');
        res.status(200).send(replyXml);
    }
    catch (e) {
        functions.logger.error("PunchOut Webhook Parsing Error:", e);
        res.status(500).send('Internal Server Error parsing XML');
    }
});
exports.twilioInboundVoice = functions.https.onRequest(async (req, res) => {
    try {
        const orgId = req.query.orgId;
        if (!orgId) {
            res.status(400).send("Missing Organization ID in webhook URL");
            return;
        }
        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();
        const speechResult = req.body.SpeechResult;
        if (speechResult) {
            // Echo back until AI fully streaming hooked up
            twiml.say({ voice: 'Polly.Matthew-Neural' }, "I heard you say: " + speechResult + ". Our AI is processing your request.");
            twiml.pause({ length: 1 });
            twiml.gather({
                input: ['speech'],
                action: `/twilioInboundVoice?orgId=${orgId}`,
                timeout: 5
            }).say({ voice: 'Polly.Matthew-Neural' }, "Do you need assistance with anything else?");
        }
        else {
            const orgRef = await db.collection('organizations').doc(orgId).get();
            const orgName = orgRef.exists ? orgRef.data()?.name : "our company";
            twiml.say({ voice: 'Polly.Matthew-Neural' }, `Hi! You have reached the automated AI dispatcher for ${orgName}. How can I help you today?`);
            twiml.gather({
                input: ['speech'],
                action: `/twilioInboundVoice?orgId=${orgId}`,
                timeout: 5
            });
        }
        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    }
    catch (error) {
        functions.logger.error("Twilio Voice Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});
// --- AUTOMATED MAINTENANCE SWEEP & REMINDERS (CRON JOB) ---
exports.automatedMaintenanceReminders = functions.pubsub.schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
    try {
        const now = new Date();
        const customersSnap = await db.collection('customers').get();
        const batchOperations = [];
        const orgsCache = {};
        // Process sequentially since we need async fetches for orgs Cache
        for (const doc of customersSnap.docs) {
            const customer = doc.data();
            if (!customer.equipment || !Array.isArray(customer.equipment))
                continue;
            let orgName = 'Service Provider';
            let orgEmail = '';
            let orgLicense = '';
            if (customer.organizationId && customer.organizationId !== 'unaffiliated') {
                if (!orgsCache[customer.organizationId]) {
                    const orgDoc = await db.collection('organizations').doc(customer.organizationId).get();
                    orgsCache[customer.organizationId] = orgDoc.exists ? orgDoc.data() : { name: 'Service Provider' };
                }
                orgName = orgsCache[customer.organizationId]?.name || 'Service Provider';
                orgEmail = orgsCache[customer.organizationId]?.email || '';
                orgLicense = orgsCache[customer.organizationId]?.licenseNumber || orgsCache[customer.organizationId]?.license || '';
            }
            const licenseFooterText = orgLicense ? `\n\nState License: ${orgLicense}` : '';
            const licenseFooterHtml = orgLicense ? `<br/><br/><small style="color:#6b7280;font-size:12px;">State License: ${orgLicense}</small>` : '';
            let hasWarrantiedHVAC = false;
            customer.equipment.forEach((asset) => {
                if (asset.warranty?.requiresMaintenance && asset.warranty.maintenanceIntervalMonths) {
                    let nextDate = new Date();
                    if (asset.warranty.lastMaintenanceDate) {
                        nextDate = new Date(asset.warranty.lastMaintenanceDate);
                    }
                    else if (asset.warranty.manufacturerStartDate) {
                        nextDate = new Date(asset.warranty.manufacturerStartDate);
                        nextDate.setDate(nextDate.getDate() + 1); // fix offset
                    }
                    else {
                        return;
                    }
                    nextDate.setMonth(nextDate.getMonth() + asset.warranty.maintenanceIntervalMonths);
                    const diffTime = nextDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // Send reminder if exactly 30 days out or 7 days out
                    if (diffDays === 30 || diffDays === 7) {
                        if (customer.email) {
                            // Write to mail collection for Trigger Email Extension
                            const portalUrl = `https://tektrakker-v2.web.app/#/portal/auth?orgId=${customer.organizationId}`;
                            const mailDoc = {
                                toUids: [doc.id],
                                to: customer.email,
                                message: {
                                    from: `${orgName} <no-reply@tektrakker.com>`,
                                    ...(orgEmail ? { replyTo: orgEmail } : {}),
                                    subject: `Action Required: Maintenance due for your ${asset.brand || ''} Equipment`,
                                    text: `Hello ${customer.name || 'Valued Customer'},\n\nThis is an automated reminder from ${orgName} that your ${asset.brand || 'HVAC'} ${asset.type || 'system'} is due for routine warranty maintenance in ${diffDays} days.\n\nPlease schedule an appointment through your portal to maintain your warranty compliance: ${portalUrl}\n\nThank you,\n${orgName}${licenseFooterText}`,
                                    html: `<p>Hello <strong>${customer.name || 'Valued Customer'}</strong>,</p>
                                               <p>This is an automated reminder from <strong>${orgName}</strong> that your <strong>${asset.brand || 'HVAC'} ${asset.type || 'system'}</strong> is due for routine warranty maintenance in <strong>${diffDays} days</strong>.</p>
                                               <p>Please schedule an appointment through your portal to maintain your warranty coverage.</p>
                                               <p><a href="${portalUrl}" style="background-color:#2563eb;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Access Service Portal to Schedule</a></p>
                                               <p>Thank you,<br/><strong>${orgName}</strong></p>${licenseFooterHtml}`
                                }
                            };
                            batchOperations.push(db.collection('mail').add(mailDoc));
                        }
                    }
                }
                // Check if this is an HVAC asset with a warranty for the monthly filter reminder
                if (asset.warranty) {
                    const typeStr = (asset.type || '').toLowerCase();
                    if (typeStr.includes('ac') || typeStr.includes('heat') || typeStr.includes('furnace') || typeStr.includes('air') || typeStr.includes('hvac') || typeStr.includes('split') || typeStr.includes('handler') || typeStr.includes('condenser')) {
                        hasWarrantiedHVAC = true;
                    }
                }
            });
            // On the 1st of the month, send a filter reminder to those with warrantied HVAC systems
            if (now.getDate() === 1 && hasWarrantiedHVAC && customer.email) {
                const filterMailDoc = {
                    toUids: [doc.id],
                    to: customer.email,
                    message: {
                        from: `${orgName} <no-reply@tektrakker.com>`,
                        ...(orgEmail ? { replyTo: orgEmail } : {}),
                        subject: `Monthly Reminder: Time to Check Your Air Filters - ${orgName}`,
                        text: `Hello ${customer.name || 'Valued Customer'},\n\nThis is your monthly automated reminder from ${orgName} to check and replace the air filters in your HVAC system. Clean filters ensure your system runs efficiently and maintains its active warranty coverage.\n\nThank you,\n${orgName}${licenseFooterText}`,
                        html: `<p>Hello <strong>${customer.name || 'Valued Customer'}</strong>,</p>
                                    <p>This is your monthly automated reminder from <strong>${orgName}</strong> to <strong>check and replace the air filters</strong> in your HVAC system.</p>
                                    <p>Clean filters ensure your system runs efficiently, keeps your air clean, and prevents expensive damages that may void your active warranty coverage.</p>
                                    <p>Thank you for staying on top of your maintenance!<br/><strong>${orgName}</strong></p>${licenseFooterHtml}`
                    }
                };
                batchOperations.push(db.collection('mail').add(filterMailDoc));
            }
        }
        await Promise.all(batchOperations);
        functions.logger.info(`Automated Maintenance Sweep completed. Dispatched ${batchOperations.length} email reminders.`);
    }
    catch (error) {
        functions.logger.error("Failed to run automatedMaintenanceReminders:", error);
    }
});
__exportStar(require("./aiAgent"), exports);
exports.provisionCustomDomain = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    const { domainUrl, franchiseId } = data;
    if (!domainUrl || !franchiseId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing domainUrl or franchiseId');
    // Robust role check (fallbacks for delayed JWT claim propagation)
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data() || {};
    const isMaster = context.auth.token.role === 'master_admin' || userData.role === 'master_admin' || context.auth.token.email === 'rodzelem@gmail.com';
    const isOwner = userData.franchiseId === franchiseId && userData.role === 'franchise_admin';
    if (!isMaster && !isOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only master admins or franchise owners can provision domains.');
    }
    const cleanDomain = domainUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    try {
        const adminAuth = await admin.credential.applicationDefault().getAccessToken();
        const token = adminAuth.access_token;
        let fbConfig = {};
        try {
            fbConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        }
        catch (e) { }
        const projectId = fbConfig.projectId || process.env.GCLOUD_PROJECT || 'tektrakker';
        const siteId = 'tektrakker';
        // Use customDomains API
        const createUrl = `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/customDomains?customDomainId=${cleanDomain}`;
        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        const result = (await response.json());
        let finalResult = result;
        if (!response.ok) {
            functions.logger.error("Failed to provision domain via hosting API:", result);
            const errMsg = result.error?.message || "";
            if (errMsg.includes("not associated with project") || errMsg.includes("Mismatched sites") || errMsg.includes("already exists")) {
                // Mock the response so the UI wizard can display instructions in the demo environment
                finalResult = {
                    provisioningState: 'PENDING',
                    requiredDnsUpdates: {
                        desired: {
                            ownershipContent: { domainName: cleanDomain, txtRecord: `google-site-verification=mock-${Date.now()}` },
                            hostingA: { domainName: cleanDomain, records: ['199.36.158.100'] }
                        }
                    }
                };
            }
            else {
                throw new functions.https.HttpsError('internal', errMsg || "Firebase Hosting API Error");
            }
        }
        const requiredDns = finalResult.requiredDnsUpdates || null;
        let dnsRecords = {};
        if (requiredDns && requiredDns.desired) {
            dnsRecords = requiredDns.desired;
        }
        else if (finalResult.certProvisioning?.certRequiredDnsUpdates?.desired) {
            dnsRecords = finalResult.certProvisioning.certRequiredDnsUpdates.desired;
        }
        await admin.firestore().collection('franchises').doc(franchiseId).set({
            dnsConfig: {
                domain: cleanDomain,
                records: dnsRecords,
                status: finalResult.provisioningState || 'PENDING',
                provisionedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
        // Strip @type from the payload because Firebase client SDK crashes if it sees unrecognized @type values
        const cleanHostingResponse = JSON.parse(JSON.stringify(finalResult, (key, value) => {
            if (key === '@type')
                return undefined;
            return value;
        }));
        return { success: true, domain: cleanDomain, hostingResponse: cleanHostingResponse };
    }
    catch (error) {
        functions.logger.error("Domain Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Unknown Error');
    }
});
// --- INFRASTRUCTURE HARD QUOTA SAFETY NET ---
// Evaluates organization volume daily and permanently suspends any organization
// that exceeds the equivalent of ~/month in reads/writes/storage (e.g. huge document limits).
exports.enforceHardQuotas = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const orgsSnap = await db.collection('organizations').where('subscriptionStatus', '==', 'active').get();
    // Limits: 100,000 Customers or 100,000 Jobs per organization heavily translates to more than \/mo of reads/storage.
    const SAFETY_LIMIT_COUNT = 100000;
    for (const org of orgsSnap.docs) {
        const orgId = org.id;
        try {
            const customersSnap = await db.collection('customers').where('organizationId', '==', orgId).count().get();
            const jobsSnap = await db.collection('jobs').where('organizationId', '==', orgId).count().get();
            const totalDocs = customersSnap.data().count + jobsSnap.data().count;
            if (totalDocs > SAFETY_LIMIT_COUNT) {
                functions.logger.warn(`Org ${orgId} surpassed infra limit proxy (${totalDocs} docs). Suspending.`);
                await org.ref.update({ subscriptionStatus: 'suspended_quota' });
            }
        }
        catch (e) {
            console.error('Failed to analyze quota for', orgId, e);
        }
    }
});
exports.fetchIotDiagnostics = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId;
    if (!orgId)
        throw new functions.https.HttpsError("invalid-argument", "Organization ID required.");
    const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
    const secrets = secretsDoc.data() || {};
    const seamApiKey = secrets.seamApiKey;
    const nestProjectId = secrets.nestProjectId;
    const ecobeeApiKey = secrets.ecobeeApiKey;
    const honeywellApiKey = secrets.honeywellApiKey;
    if (!seamApiKey && !nestProjectId && !ecobeeApiKey && !honeywellApiKey) {
        throw new functions.https.HttpsError("failed-precondition", "No IoT API keys configured for this organization. Please set them in Admin Settings -> Integrations.");
    }
    const devices = [];
    // Option 1: Seam Unified API
    if (seamApiKey) {
        try {
            const resp = await fetch('https://connect.getseam.com/devices/list', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${seamApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // In production, filter by customerData.address
            });
            if (resp.ok) {
                const results = await resp.json();
                (results.devices || []).forEach((d) => {
                    if (d.device_type.includes('thermostat')) {
                        const status = d.properties?.online ? 'online' : 'offline';
                        const faults = [];
                        if (d.properties?.has_direct_power === false) {
                            faults.push({ code: 'PWR-01', description: 'Device is running on battery backup; C-wire or Rh power lost.', severity: 'critical' });
                        }
                        devices.push({
                            id: d.device_id,
                            brand: d.properties?.brand || 'Unknown',
                            name: d.properties?.name || 'Thermostat',
                            status: status,
                            lastConnection: new Date().toISOString(),
                            temperature: typeof d.properties?.temperature_fahrenheit === 'number' ? Math.round(d.properties.temperature_fahrenheit) : 72,
                            humidity: typeof d.properties?.relative_humidity === 'number' ? Math.round(d.properties.relative_humidity * 100) : 45,
                            mode: d.properties?.current_climate_setting?.hvac_mode_setting || 'auto',
                            activeFaults: faults
                        });
                    }
                });
            }
            else {
                functions.logger.error("Seam API Error:", await resp.text());
            }
        }
        catch (e) {
            functions.logger.error("Seam Catch Error:", e);
        }
    }
    // Option 2: Direct Google Nest API (Mock representation of Nest SDM OAuth flow)
    if (nestProjectId && !seamApiKey) {
        devices.push({
            id: 'nest-' + Math.random().toString(36).substr(2, 9),
            brand: 'Nest',
            name: 'Living Room',
            status: 'online',
            lastConnection: new Date().toISOString(),
            temperature: 68,
            humidity: 35,
            mode: 'heat',
            activeFaults: [
                { code: 'E73', description: 'No power to Rh wire (Check Condensate Overflow Switch)', severity: 'critical' }
            ]
        });
    }
    // Option 3: Ecobee / Honeywell (Mock representations)
    if ((ecobeeApiKey || honeywellApiKey) && devices.length === 0) {
        devices.push({
            id: 'demo-' + Math.random().toString(36).substr(2, 9),
            brand: ecobeeApiKey ? 'Ecobee' : 'Honeywell',
            name: 'Hallway',
            status: 'online',
            lastConnection: new Date().toISOString(),
            temperature: 70,
            humidity: 42,
            mode: 'cool',
            activeFaults: [
                { code: 'W22', description: 'Low WiFi Signal Quality detected', severity: 'warning' }
            ]
        });
    }
    return { devices };
});
/**
 * Shovels.ai Permit Tracking Webhook/Poller
 * Fetches building permits for a specific address.
 *
 * Uses standard v2 syntax: GET https://api.shovels.ai/v2/permits/search?address=...
 */
exports.fetchShovelsPermits = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const { orgId, addressString } = data;
    if (!orgId || !addressString) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing orgId or addressString');
    }
    try {
        // 1. Fetch the organization's settings for the Shovels API key
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Organization not found');
        }
        const orgData = orgDoc.data();
        const shovelsKey = orgData?.settings?.shovelsApiKey;
        if (!shovelsKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Organization has not configured a Shovels.ai API Key. Please visit Settings -> Integrations.');
        }
        // Tracking Usage (Optional, especially for limiting trials on their own)
        let usage = orgData?.settings?.shovelsUsageCount || 0;
        await db.collection('organizations').doc(orgId).update({
            'settings.shovelsUsageCount': usage + 1
        });
        // 2. Format the URL with proper encoding
        // The Shovels API likes %20 for spaces
        const encodedAddress = encodeURIComponent(addressString).replace(/%20/g, '+');
        const searchUrl = `https://api.shovels.ai/v2/permits/search?address=${encodedAddress}`;
        functions.logger.info(`Fetching permits from Shovels.ai: ${searchUrl}`);
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-API-Key': shovelsKey,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            functions.logger.error('Shovels API returned an error:', errorText);
            throw new functions.https.HttpsError('internal', `Shovels API Error: ${response.status} ${response.statusText}`);
        }
        const permitsData = await response.json();
        // Return raw parsed JSON straight to the frontend to render
        return {
            success: true,
            results: permitsData,
            usageLogged: usage + 1
        };
    }
    catch (e) {
        functions.logger.error('Error fetching Shovels.ai permits', e);
        throw new functions.https.HttpsError('internal', 'Internal server error while searching for permits', e.message);
    }
});
__exportStar(require("./gustoAgent"), exports);
__exportStar(require("./bofaAgent"), exports);
__exportStar(require("./googleBusiness"), exports);
// --- SOCIAL MEDIA INTEGRATION ---
exports.postToX = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { content, accessToken, accessSecret } = data;
    if (!content)
        throw new functions.https.HttpsError("invalid-argument", "Missing content.");
    // The Consumer Keys provided by the user for the platform App
    const appKey = "psTqiMOKuLwxAPADwZwUck4Rg";
    const appSecret = "6VlyOQawbslwdYCI9j2eekDNWR7hib4suKYa0DQ2kCQWuzuhUh";
    if (!accessToken || !accessSecret) {
        throw new functions.https.HttpsError("failed-precondition", "Missing X User Access Tokens. Please securely connect your X account first.");
    }
    try {
        const client = new twitter_api_v2_1.TwitterApi({
            appKey,
            appSecret,
            accessToken,
            accessSecret,
        });
        const v2Client = client.v2;
        const result = await v2Client.tweet(content);
        return { success: true, tweetId: result.data.id };
    }
    catch (e) {
        functions.logger.error("Failed to post to X:", e);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to X.");
    }
});
__exportStar(require("./googleBusiness"), exports);
__exportStar(require("./revenuecat"), exports);
__exportStar(require("./rfpAgent"), exports);
__exportStar(require("./tiktok"), exports);
__exportStar(require("./marketplaceIntegrations"), exports);
__exportStar(require("./linkedin"), exports);
//# sourceMappingURL=index.js.map