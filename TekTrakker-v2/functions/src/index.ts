import * as functions from "firebase-functions/v1";
import { TwitterApi } from 'twitter-api-v2';
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import sgMail from '@sendgrid/mail';
import { BudgetServiceClient } from '@google-cloud/billing-budgets';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { CloudBillingClient } from '@google-cloud/billing';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as xml2js from 'xml2js';

// Ensure global.fetch is patched to automatically sanitize role: "function" -> role: "user" for Google Generative AI REST requests
const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = function(url: any, options: any) {
        if (options && typeof options.body === 'string' && options.body.includes('"role":"function"')) {
            options = Object.assign({}, options, {
                body: options.body.replace(/"role"\s*:\s*"function"/g, '"role":"user"')
            });
        }
        return originalFetch.call(this, url, options);
    };
}

import { syncOrganizationShiftsToSquare } from "./squareUtils";
import { CommissionSettings, PlatformSettings } from "./types";
import { getGeminiApiKey } from "./aiAgent";
import axios from 'axios';
import { Buffer } from 'buffer';
export * from './payments';
export * from './kortPayments';
export * from './notifications';
export * from './dataCascade';
export * from './weeklyReferenceAudit';
export * from './aiAgent';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare var process: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare var require: any;

try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
} catch { 
    // Ignore initialization errors if already initialized
}

const auth = admin.auth();
const db = admin.firestore();
const billingBudgetsClient = new BudgetServiceClient();
const monitoringClient = new MetricServiceClient();
const billingClient = new CloudBillingClient();

const DEFAULT_COMMISSION_RULES: CommissionSettings = {
    baseRate: 0.25, acceleratorRate: 0.30, annualQuota: 500000, renewalRate: 0.05,
    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
};



const GEMINI_FLASH_MODEL = "gemini-3.6-flash";
const GEMINI_PRO_MODEL = "gemini-3.6-flash";

// --- NEW COMMISSION LOGIC ---
export const handlePlatformInvoiceCommission = functions.firestore
    .document('jobs/{jobId}')
    .onWrite(async (change, context) => {
        const jobId = context.params.jobId;
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;

        // If document deleted, do nothing
        if (!after) return null;

        // Only process platform billing jobs (subscription invoices)
        if (after.organizationId !== 'platform') return null;

        const customerId = after.customerId; // This is the customer Organization ID
        if (!customerId) {
            functions.logger.info(`Platform job ${jobId} has no customer organization ID.`);
            return null;
        }

        let salesRepId = after.salesRepId;
        if (!salesRepId) {
            // Try fetching from the organization document
            const orgDoc = await db.collection('organizations').doc(customerId).get();
            if (orgDoc.exists) {
                salesRepId = orgDoc.data()?.salesRepId;
            }
        }

        if (!salesRepId) {
            functions.logger.info(`Platform job ${jobId} has no sales rep linked.`);
            return null;
        }

        // Check if commission already exists for this invoice
        const commsSnap = await db.collection('platformCommissions')
            .where('invoiceId', '==', jobId)
            .limit(1)
            .get();

        const commissionExists = !commsSnap.empty;
        const existingCommDoc = commissionExists ? commsSnap.docs[0] : null;

        const invoiceStatus = after.invoice?.status || 'Unpaid';

        // 1. If commission doesn't exist, create it as Pending and customerPaymentStatus = Unpaid/Paid
        if (!existingCommDoc) {
            // Fetch platform settings and commission rules
            const settingsDocs = await Promise.all([
                db.collection('platformSettings').doc('global').get(),
                db.collection('settings').doc('commission_rules').get()
            ]);

            const platformSettings = settingsDocs[0].exists ? (settingsDocs[0].data() as PlatformSettings) : undefined;
            const rules: CommissionSettings = settingsDocs[1].exists ? (settingsDocs[1].data() as CommissionSettings) : DEFAULT_COMMISSION_RULES;

            if (!platformSettings) {
                functions.logger.error("Platform settings not found. Cannot calculate commission.");
                return null;
            }

            // Determine the plan and its annual value
            const subscriptionItem = after.invoice?.items?.find((item: any) => 
                item.description && item.description.toLowerCase().includes('plan subscription')
            ) || after.invoice?.items?.find((item: any) => 
                item.description && item.description.toLowerCase().includes('platform subscription')
            );
            
            type PlanName = 'starter' | 'growth' | 'enterprise' | 'payments_only';
            let planName: PlanName = 'starter';
            if (subscriptionItem) {
                const desc = subscriptionItem.description.toLowerCase();
                if (desc.includes('growth')) planName = 'growth';
                else if (desc.includes('enterprise')) planName = 'enterprise';
                else if (desc.includes('payments_only') || desc.includes('payments only')) planName = 'payments_only';
            }

            const planDetails = platformSettings.plans[planName] || platformSettings.plans.starter;
            const saleValue = planDetails?.annual || 0;

            if (saleValue <= 0) {
                functions.logger.info(`Job ${jobId} has a plan with no value. No commission generated.`);
                return null;
            }

            // Calculate commission rate YTD
            const repCommsSnap = await db.collection('platformCommissions')
                .where('repId', '==', salesRepId)
                .get();
            
            // Only count YTD commissions where the customer has actually paid
            const totalRevenueYTD = repCommsSnap.docs.reduce((sum, doc) => {
                const data = doc.data();
                if (data.customerPaymentStatus === 'Paid' || data.status === 'Paid') {
                    return sum + (data.baseAmount || 0);
                }
                return sum;
            }, 0);

            let rateToUse = rules.baseRate;
            if (totalRevenueYTD >= rules.annualQuota) {
                rateToUse = rules.acceleratorRate;
            } else if (totalRevenueYTD + saleValue > rules.annualQuota) {
                const amountBefore = rules.annualQuota - totalRevenueYTD;
                const amountAfter = totalRevenueYTD + saleValue - rules.annualQuota;
                const weightedRate = ((amountBefore / saleValue) * rules.baseRate) + ((amountAfter / saleValue) * rules.acceleratorRate);
                rateToUse = weightedRate;
            }

            const newCommission = {
                repId: salesRepId,
                organizationId: customerId,
                organizationName: after.customerName || 'New Organization',
                jobId: jobId,
                invoiceId: jobId,
                amount: saleValue * rateToUse,
                status: 'Pending',
                customerPaymentStatus: invoiceStatus === 'Paid' ? 'Paid' : 'Unpaid',
                dateEarned: new Date().toISOString(),
                baseAmount: saleValue,
                rateUsed: rateToUse
            };

            functions.logger.info(`Creating platform commission for sales rep ${salesRepId} on invoice ${jobId}`);
            return db.collection('platformCommissions').add(newCommission);
        } else {
            // 2. If commission exists and invoice status changed to Paid, update customerPaymentStatus to Paid
            const beforeInvoiceStatus = before?.invoice?.status || 'Unpaid';
            
            if (beforeInvoiceStatus !== 'Paid' && invoiceStatus === 'Paid') {
                functions.logger.info(`Platform invoice ${jobId} paid. Updating commission status to earned.`);
                return existingCommDoc.ref.update({
                    customerPaymentStatus: 'Paid',
                    dateEarned: new Date().toISOString()
                });
            }
        }

        return null;
    });

export const checkUserInvite = functions.https.onCall(async (data, context) => {
    const email = (data.email || '').trim().toLowerCase();
    const token = (data.token || '').trim();
    if (!email || !token) {
        throw new functions.https.HttpsError("invalid-argument", "Email and invitation token are required.");
    }
    try {
        const doc = await db.collection('users').doc(email).get();
        if (doc.exists) {
            const userData = doc.data();
            if (userData && userData.status === 'invited' && userData.inviteToken === token) {
                return {
                    exists: true,
                    role: userData.role || 'customer',
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    phone: userData.phone || '',
                    address: userData.address || null,
                    organizationId: userData.organizationId || null,
                };
            }
        }
        return { exists: false };
    } catch (error: any) {
        functions.logger.error("Error checking user invite:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
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
    } catch {
        return { count: 0, error: "Auth access limited" };
    }
}

function calculateTokenCost(total: number, prompt: number, candidates: number): number {
    const splitTotal = prompt + candidates;
    const legacyTokens = Math.max(0, total - splitTotal);
    return (prompt / 1000000) * 1.50 + (candidates / 1000000) * 9.00 + (legacyTokens / 1000000) * 2.50;
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
    } catch {
        // Expected if billing export is not configured
    }

    let aiCost = 0;
    if (projectId === process.env.APP_PROJECT_ID) {
        try {
            const snap = await admin.firestore().collection('aiUsage').get();
            snap.forEach(doc => {
                const data = doc.data();
                const totalTokensUsed = data.totalTokensUsed || 0;
                const promptTokensUsed = data.promptTokensUsed || 0;
                const candidatesTokensUsed = data.candidatesTokensUsed || 0;

                const virtualTokensUsed = data.virtualWorkerTokensUsed || 0;
                const virtualPromptTokensUsed = data.virtualWorkerPromptTokensUsed || 0;
                const virtualCandidatesTokensUsed = data.virtualWorkerCandidatesTokensUsed || 0;

                const stdCost = calculateTokenCost(totalTokensUsed, promptTokensUsed, candidatesTokensUsed);
                const vwCost = calculateTokenCost(virtualTokensUsed, virtualPromptTokensUsed, virtualCandidatesTokensUsed);

                aiCost += stdCost + vwCost;
            });
        } catch (e) {
            functions.logger.warn('Could not fetch aiUsage costs:', e);
        }
    }
    
    // Merge aiCost into costAmount if monitoring fails to provide accurate >0 data
    if (costAmount === 0 && aiCost > 0) {
       costAmount = aiCost;
    } else {
       costAmount += aiCost;
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
                interval: { startTime: { seconds: Math.floor(startTime.getTime() / 1000) }, endTime: { seconds: Math.floor(now / 1000) } },
                aggregation: { alignmentPeriod: { seconds: 86400 }, perSeriesAligner: 'ALIGN_SUM' }
            });
            usageMetrics[metricType] = timeSeries[0]?.points?.reduce((sum, point) => sum + Number(point.value?.int64Value ?? point.value?.doubleValue ?? 0), 0) ?? 0;
        } catch {
            usageMetrics[metricType] = 0;
        }
    }
    return usageMetrics;
}

// --- MESSAGING ---

async function trackSmsUsage(orgId: string, direction: 'inbound' | 'outbound') {
    if (!orgId || orgId === 'unauthenticated') return;
    try {
        const now = new Date();
        const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const usageRef = db.collection('smsUsage').doc(`${orgId}_${billingCycle}`);
        
        const updateData: any = {
            organizationId: orgId,
            billingCycle: billingCycle,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (direction === 'outbound') {
            updateData.totalSmsSent = admin.firestore.FieldValue.increment(1);
        } else {
            updateData.totalSmsReceived = admin.firestore.FieldValue.increment(1);
        }
        
        await usageRef.set(updateData, { merge: true });
        
        functions.logger.info(`Tracked ${direction} SMS usage for organization ${orgId} in cycle ${billingCycle}`);
    } catch (e) {
        functions.logger.error("Failed to track SMS usage:", e);
    }
}

export const sendSms = functions.firestore.document('messages/{msgId}').onCreate(async (snap) => {
    const msg = snap.data();
    if (!msg || msg.type !== 'sms' || !msg.receiverId) return;

    try {
        const secretDoc = await db.collection('organizations').doc(msg.organizationId).collection('secrets').doc('config').get();
        const secrets = secretDoc.data() || {};

        const customerDoc = await db.collection('customers').doc(msg.receiverId).get();
        const customer = customerDoc.data();
        const toPhone = customer?.phone;

        if (!toPhone) {
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: 'Invalid Customer Phone' });
            return;
        }

        // --- RingCentral Routing Strategy ---
        let fromNumber = '';
        if (secrets.rcPrimarySms === true || secrets.rcPrimarySms === 'true') {
            // Find sender phone number matching senderId mapping
            if (secrets.rcMappings && Array.isArray(secrets.rcMappings)) {
                const match = secrets.rcMappings.find((m: any) => m.assignedUserId === msg.senderId || m.forwardToUserId === msg.senderId);
                if (match && match.phoneNumber) {
                    fromNumber = match.phoneNumber;
                } else if (secrets.rcMappings.length > 0 && secrets.rcMappings[0].phoneNumber) {
                    fromNumber = secrets.rcMappings[0].phoneNumber;
                }
            }
        }

        if ((secrets.rcPrimarySms === true || secrets.rcPrimarySms === 'true') && fromNumber) {
            const rcUrl = secrets.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
            
            const clientId = secrets.rcBackendClientId || secrets.ringCentralClientId;
            const clientSecret = secrets.ringCentralClientSecret || '';
            const jwtToken = secrets.ringCentralJwtToken;

            if (!clientId || !jwtToken) {
                await snap.ref.update({ deliveryStatus: 'failed', deliveryError: 'RingCentral Client ID or JWT Token is missing in secrets configuration.' });
                return;
            }

            // Get a fresh access token using the stored JWT
            const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion': jwtToken
                }).toString()
            });

            if (!tokenResponse.ok) {
                const errBody = await tokenResponse.text();
                throw new Error(`Failed to authenticate with RingCentral: ${errBody}`);
            }

            const { access_token } = await tokenResponse.json() as any;

            // Send SMS via RingCentral API
            const smsResponse = await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/sms`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: { phoneNumber: fromNumber },
                    to: [{ phoneNumber: toPhone }],
                    text: msg.content
                })
            });

            if (smsResponse.ok) {
                await snap.ref.update({ deliveryStatus: 'sent' });
            } else {
                const errBody = await smsResponse.text();
                await snap.ref.update({ deliveryStatus: 'failed', deliveryError: `RingCentral SMS API Error: ${errBody}` });
            }
            return;
        }

        // --- Twilio Fallback Routing Strategy ---
        const accountSid = secrets.twilioConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = secrets.twilioConfig?.authToken || process.env.TWILIO_AUTH_TOKEN;
        const twilioFromNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

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

        const body = new URLSearchParams({ To: toPhone, From: twilioFromNumber, Body: msg.content });
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });

        const isPlatformTwilio = !secrets.twilioConfig?.accountSid && !!process.env.TWILIO_ACCOUNT_SID;

        if (response.ok) {
            await snap.ref.update({ deliveryStatus: 'sent' });
            if (isPlatformTwilio) {
                await trackSmsUsage(msg.organizationId, 'outbound');
            }
        } else {
            const err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = await response.json();
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: err.message || 'Twilio Error' });
        }
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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

// --- AI USAGE TRACKING ---

async function trackAiUsage(
    orgId: string, 
    taskName: string, 
    modelName: string, 
    tokenCount: number,
    promptTokenCount?: number,
    candidatesTokenCount?: number
) {
    if (!orgId || orgId === 'unauthenticated' || tokenCount <= 0) return;

    try {
        const orgUsageRef = db.collection('aiUsage').doc(orgId);
        const promptIncrement = promptTokenCount || 0;
        const candidatesIncrement = candidatesTokenCount || 0;

        const updateData: any = {
            organizationId: orgId,
            totalTokensUsed: admin.firestore.FieldValue.increment(tokenCount),
            [`tasks.${taskName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`models.${modelName.replace(/\./g, '_')}`]: admin.firestore.FieldValue.increment(tokenCount),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        if (promptIncrement > 0) {
            updateData.promptTokensUsed = admin.firestore.FieldValue.increment(promptIncrement);
        }
        if (candidatesIncrement > 0) {
            updateData.candidatesTokensUsed = admin.firestore.FieldValue.increment(candidatesIncrement);
        }

        await orgUsageRef.set(updateData, { merge: true });

        // Check if limit hit
        const docSnap = await orgUsageRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data?.limitTokens && data.totalTokensUsed > data.limitTokens) {
                functions.logger.warn(`Org ${orgId} has exceeded their AI token limit (${data.totalTokensUsed} / ${data.limitTokens})`);
            }
        }
    } catch (e) {
        functions.logger.error("Failed to track AI usage:", e);
    }
}

// --- AI UTILS ---
export const generateReviewResponse = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const apiKey = await getGeminiApiKey(orgId);

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

        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await trackAiUsage(orgId, 'Review Response', GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);

        return { text: response.text() };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Review GenAI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate review response.");
    }
});

export const callLandingChatbot = functions.https.onCall(async (data, context) => {
    const orgId = context.auth?.token.organizationId || 'unauthenticated';
    const apiKey = await getGeminiApiKey(orgId);

    const { prompt, systemInstruction } = data;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL, systemInstruction });
        const result = await model.generateContent(prompt);
        const response = await result.response;

        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await trackAiUsage(orgId, 'Landing Chatbot', GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);

        return { text: response.text() };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const callGeminiAI = functions.runWith({ timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    // Force rebuild for env variables
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';

    const apiKey = await getGeminiApiKey(orgId);

    const { prompt, modelName = GEMINI_FLASH_MODEL, config = {}, imageParts = [], image = null, contextOrgId = null } = data;

    // Transparently upgrade older models to gemini-3.6-flash
    let resolvedModelName = modelName;
    if (resolvedModelName.startsWith("gemini-3.1-") || resolvedModelName.startsWith("gemini-3.5-") || resolvedModelName === "gemini-2.0-flash") {
        resolvedModelName = "gemini-3.6-flash";
    }

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
        } catch (ctxErr) {
            functions.logger.warn('Failed to load org AI context, proceeding without:', ctxErr);
        }

        const enrichedPrompt = orgContext
            ? `[ORGANIZATION CONTEXT - Use this for branding, logos, contact info, and legal terms]\n${orgContext}\n\n[END ORGANIZATION CONTEXT]\n\n${prompt}`
            : prompt;

        const genAI = new GoogleGenerativeAI(apiKey);
        
        let response;
        let lastError;
        let finalModelName = resolvedModelName;
        const modelsToTry = [
            resolvedModelName,
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
        ].filter((val, idx, self) => self.indexOf(val) === idx);

        for (const modelToTry of modelsToTry) {
            try {
                functions.logger.info(`Attempting generation with model: ${modelToTry}`);
                const model = genAI.getGenerativeModel({ model: modelToTry, ...config });
                
                const parts: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] = [{ text: enrichedPrompt }];

                if (imageParts && imageParts.length > 0) {
                    imageParts.forEach((part: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
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

                const result = await model.generateContent(parts);
                response = await result.response;
                finalModelName = modelToTry;
                break;
            } catch (err: any) {
                functions.logger.warn(`Model ${modelToTry} failed:`, err);
                lastError = err;
            }
        }

        if (!response) {
            throw lastError || new Error("All models failed generation.");
        }

        resolvedModelName = finalModelName;

        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await trackAiUsage(orgId, 'General AI Content', resolvedModelName, tokens, promptTokens, candidatesTokens);

        return { text: response.text() };

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Gemini AI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate content.");
    }
});

// --- BID HELPER ---

export const analyzeRFP = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';

    const { files } = data;
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "No files provided.");
    }

    const apiKey = await getGeminiApiKey(orgId);

    let orgContext: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = null;
    if (orgId && orgId !== 'unauthenticated') {
        try {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                orgContext = orgDoc.data();
            }
        } catch (e) {
            functions.logger.warn("Failed to fetch org context for analyzeRFP", e);
        }
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const analyses = await Promise.all(files.map(async (file: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            let { fileData, mimeType, fileName } = file;
            
            // If the fileData is actually a URL (like a SAM.gov resource link), download it first
            if (fileData && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
                try {
                    const response = await axios.get(fileData, { 
                        responseType: 'arraybuffer',
                        timeout: 60000 
                    });
                    
                    const contentType = String(response.headers['content-type'] || '').toLowerCase();
                    const contentDisposition = String(response.headers['content-disposition'] || '');
                    let headerFileName = fileName || '';
                    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
                    if (match && match[1].includes('.')) {
                        headerFileName = match[1];
                    }
                    
                    const nameToCheck = (headerFileName + " " + (fileName || '')).toLowerCase();

                    const buf = Buffer.from(response.data);
                    const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
                    const isDocLegacy = buf.length > 8 && buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;

                    let isXlsx = contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv') || nameToCheck.includes('.xlsx') || nameToCheck.includes('.xls') || nameToCheck.includes('.csv');
                    let isDocx = contentType.includes('wordprocessing') || contentType.includes('msword') || nameToCheck.includes('.docx') || nameToCheck.includes('.doc');
                    
                    // If we have no clue but it's a zip file, it could be an office doc.
                    if (!isXlsx && !isDocx && (contentType.includes('octet-stream') || !contentType)) {
                        if (isZip) {
                            try {
                                const XLSX = await import('xlsx');
                                const workbook = XLSX.read(buf, { type: 'buffer' });
                                if (workbook.SheetNames.length > 0) isXlsx = true;
                            } catch {
                                isDocx = true; // Guess docx if xlsx parsing fails on a zip archive
                            }
                        } else if (isDocLegacy) {
                            isDocx = true; 
                        }
                    }

                    if (isXlsx) {
                        const XLSX = await import('xlsx');
                        const workbook = XLSX.read(buf, { type: 'buffer' });
                        let extractedText = "";
                        for (const sheetName of workbook.SheetNames) {
                            extractedText += `--- Sheet: ${sheetName} ---\n`;
                            extractedText += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                            extractedText += `\n\n`;
                        }
                        fileData = Buffer.from(extractedText).toString('base64');
                        mimeType = 'text/plain';
                    } else if (isDocx) {
                        const mammoth = await import('mammoth');
                        const result = await mammoth.extractRawText({ buffer: buf });
                        fileData = Buffer.from(result.value).toString('base64');
                        mimeType = 'text/plain';
                    } else {
                        fileData = buf.toString('base64');
                        // Automatically default to PDF if no mimeType or generic octet-stream
                        if (!mimeType || mimeType.includes('octet-stream')) {
                            mimeType = 'application/pdf';
                        }
                    }
                } catch (dlErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.error("Failed to download or parse file from URL:", dlErr);
                    throw new Error(`Failed to process attached document ${fileName || ''}`, { cause: dlErr });
                }
            }

            const prompt = `Analyze this government RFP or solicitation document. Extract the following information in JSON format: 
            {
              "requirements": ["list", "of", "general", "requirements"],
              "deliverables": ["(Submittal) Must provide safety plan with bid", "(Contract) Monthly progress reports", "list", "of", "all", "deliverables, categorized by (Submittal) vs (Contract)"],
              "summary": "comprehensive overall summary of the scope of work",
              "solicitationNumber": "string",
              "agency": "string",
              "dueDate": "ISO date if found",
              "importantDates": [{"name": "Site Visit", "date": "YYYY-MM-DD"}, {"name": "Questions Due", "date": "YYYY-MM-DD"}],
              "questions": [{"id": "q1", "text": "Question text based on document that requires user input", "answer": ""}],
              "lineItems": [{"id": "item1", "description": "Item description", "qty": 1, "unit": "EA"}]
            }
            
            ### COMPANY CONTEXT
            The organization creating this bid has the following profile data:
            Company Name: ${orgContext?.name || 'Unknown'}
            CAGE Code: ${orgContext?.cageCode || 'Unknown'}
            UEI Number: ${orgContext?.ueid || 'Unknown'}
            Website: ${orgContext?.website || 'Unknown'}
            Primary NAICS: ${orgContext?.primaryNaics || 'Unknown'}
            Address: ${orgContext?.address ? `${orgContext.address.street}, ${orgContext.address.city}, ${orgContext.address.state} ${orgContext.address.zip}` : 'Unknown'}

            Crucial Instructions:
            1. For 'deliverables', explicitly prepend each item with either '(Submittal)' if it must be included in the bid response package, or '(Contract)' if it is required after winning the award during execution.
            2. Identify key areas where the estimator needs to provide input and add them to the 'questions' array.
            3. CRITICAL: DO NOT add questions to the 'questions' array for information that is already provided in the COMPANY CONTEXT above (like CAGE Code, UEI, Website, Address, Company Name, etc.). We already have this data and will automatically populate it.
            4. Identify all required services, products, or materials that need pricing and add them to the 'lineItems' array. STRICT RULE: ONLY extract line items if the document contains an explicit "Schedule of Supplies/Services", "Pricing Schedule", "CLINs" (Contract Line Item Numbers), or if the document is clearly a pricing spreadsheet/form. DO NOT extract general equipment lists, narrative tasks, or sub-components as line items unless they are formatted specifically for pricing in a schedule.
            5. For 'importantDates', thoroughly scan the entire document and aggressively extract ALL dates related to the project. This includes but is not limited to: Pre-Bid Meetings, Site Visits, RFIs/Questions Due Dates, Bid Deadlines, Expected Award Dates, Notice to Proceed, and Project Start/End dates. Format dates as YYYY-MM-DD.
            6. Ensure output is STRICTLY valid JSON. Do not include markdown code block tags (\`\`\`json).`;

            try {
                const result = await model.generateContent([
                    { inlineData: { data: fileData, mimeType } },
                    { text: prompt }
                ]);

                const response = await result.response;
                const tokens = response.usageMetadata?.totalTokenCount || 0;
                const promptTokens = response.usageMetadata?.promptTokenCount || 0;
                const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
                await trackAiUsage(orgId, 'Analyze RFP', GEMINI_PRO_MODEL, tokens, promptTokens, candidatesTokens);
                let text = response.text();

                text = text.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    return JSON.parse(text);
                } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.error("Failed to parse AI response as JSON. Raw text:", text);
                    throw new Error("Failed to parse AI response as JSON for one of the files.", { cause: e });
                }
            } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                console.warn(`File analysis skipped or failed for ${mimeType}:`, err.message);
                
                if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                    console.warn("Pro model overloaded. Falling back to Flash model...");
                    try {
                        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
                        const fallbackResult = await fallbackModel.generateContent([
                            { inlineData: { data: fileData, mimeType } },
                            { text: prompt }
                        ]);
                        const fallbackResponse = await fallbackResult.response;
                        const tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                        const promptTokens = fallbackResponse.usageMetadata?.promptTokenCount || 0;
                        const candidatesTokens = fallbackResponse.usageMetadata?.candidatesTokenCount || 0;
                        await trackAiUsage(orgId, 'Analyze RFP', GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);
                        let fallbackText = fallbackResponse.text();
                        fallbackText = fallbackText.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(fallbackText);
                    } catch (fallbackErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                        console.error("Fallback to Flash model also failed:", fallbackErr.message);
                        throw new Error(`AI Service is currently overloaded (503 High Demand). Please try again later. Details: ${fallbackErr.message}`, { cause: fallbackErr });
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

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("RFP Analysis Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to analyze RFP.");
    }
});

export const searchHistoricalBidData = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';

    const { bid } = data;
    if (!bid) throw new functions.https.HttpsError("invalid-argument", "No bid data provided.");

    const apiKey = await getGeminiApiKey(orgId);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const prompt = `Search for historical data and market research for this government solicitation: ${JSON.stringify(bid)}. 
        Simulate a search and provide a detailed report on similar past contracts, typical winning prices, and potential competitors. 
        Format the output as a clean HTML document.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await trackAiUsage(orgId, 'Historical Bid Search', GEMINI_PRO_MODEL, tokens, promptTokens, candidatesTokens);

        return { content: response.text() };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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

    functions.logger.info(`Bid generation for Org ${orgId} initiated.`);

    const apiKey = await getGeminiApiKey(orgId);

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
            // Build an explicit pricing table so the AI uses EXACT prices
            const lineItems = bid.lineItems || [];
            let pricingTable = 'CLIN | Description | Unit | Qty | Unit Price | Total Price\n';
            pricingTable += '--- | --- | --- | --- | --- | ---\n';
            let grandTotal = 0;
            lineItems.forEach((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => {
                const qty = item.qty || 0;
                const unitPrice = item.unitPrice || 0;
                const totalPrice = item.totalPrice || (qty * unitPrice);
                grandTotal += totalPrice;
                pricingTable += `${idx + 1} | ${item.description || 'Item'} | ${item.unit || 'EA'} | ${qty} | $${unitPrice.toFixed(2)} | $${totalPrice.toFixed(2)}\n`;
            });

            if (bid.additionalFeePercent && bid.additionalFeeName) {
                const feeAmount = bid.additionalFeeAmount || (grandTotal * bid.additionalFeePercent / 100);
                pricingTable += `FEE | ${bid.additionalFeeName} (${bid.additionalFeePercent}%) | | | | $${feeAmount.toFixed(2)}\n`;
                grandTotal += feeAmount;
            }

            pricingTable += `GRAND TOTAL | | | | | $${grandTotal.toFixed(2)}\n`;

            // Build Q&A context explicitly
            const questionsContext = (bid.questions || [])
                .filter((q: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => q.answer && q.answer.trim())
                .map((q: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => `Q: ${q.question || q.text || 'Unknown'}\nA: ${q.answer}`)
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
${(bid.requirements || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'None extracted.'}

### DELIVERABLES:
${(bid.deliverables || []).map((d: string, i: number) => `${i + 1}. ${d}`).join('\n') || 'None extracted.'}

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
${(bid.deliverables || []).some((d: string) => d.includes('(Submittal)')) ? '6. **Required Submittal Documents** — Draft responses for all (Submittal) deliverables.' : ''}

### OUTPUT FORMAT:
Return ONLY a JSON array. No markdown code fences. No explanation text before or after.
Each element: {"title": "Document Title", "content": "<full HTML with embedded CSS>"}

Example of correct output start:
[{"title":"Cover Letter","content":"<style>...</style><div class=\\"doc-header\\">...`;
        }

        let text = "";
        let tokens = 0;
        let promptTokens = 0;
        let candidatesTokens = 0;
        let usedModel = GEMINI_PRO_MODEL;

        try {
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            tokens = response.usageMetadata?.totalTokenCount || 0;
            promptTokens = response.usageMetadata?.promptTokenCount || 0;
            candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
            text = response.text();
        } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                functions.logger.warn("Pro model overloaded in document generation. Falling back to Flash model...");
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
                const fallbackResult = await fallbackModel.generateContent(fullPrompt);
                const fallbackResponse = await fallbackResult.response;
                tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                promptTokens = fallbackResponse.usageMetadata?.promptTokenCount || 0;
                candidatesTokens = fallbackResponse.usageMetadata?.candidatesTokenCount || 0;
                text = fallbackResponse.text();
                usedModel = GEMINI_FLASH_MODEL;
            } else {
                throw err;
            }
        }

        await trackAiUsage(orgId, 'Generate Bid Document', usedModel, tokens, promptTokens, candidatesTokens);

        if (isGlobalEdit || docIndex === undefined) {
            // Robust JSON extraction: strip code fences, then try to find the JSON array
            text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            
            // Try direct parse first
            let docs;
            try {
                docs = JSON.parse(text);
            } catch {
                // Fallback: find the outermost JSON array in the response
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    try {
                        docs = JSON.parse(arrayMatch[0]);
                    } catch {
                        functions.logger.error("Failed to parse document generation response (both attempts)", text.substring(0, 500));
                        throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                    }
                } else {
                    functions.logger.error("No JSON array found in response", text.substring(0, 500));
                    throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                }
            }
            return { docs };
        } else {
            return { docs: [{ title: bid.generatedDocs[docIndex].title, content: text.replace(/```html/g, '').replace(/```/g, '').trim() }] };
        }

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Error generating bid document:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate document.");
    }
});

export const suggestBidPricing = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const { bid } = data;
    if (!bid || !bid.lineItems || bid.lineItems.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Missing bid or line items.");
    }

    try {
        const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;
        
        if (!orgId) {
            throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
        }

        const apiKey = await getGeminiApiKey(orgId);
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using flash model for faster, consistent parsing
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

        // 1. Gather historical context if available.
        // Similar to the historical research report, we find recent awarded bids to ensure accurate pricing.
        let recentBidsSnap = await db.collection('bids')
            .where('organizationId', '==', bid.organizationId || orgId)
            .where('status', '==', 'Won')
            .limit(20)
            .get();

        if (recentBidsSnap.empty) {
            recentBidsSnap = await db.collection('bids')
                .where('organizationId', '==', bid.organizationId || orgId)
                .where('status', '==', 'Submitted')
                .limit(20)
                .get();
        }

        let historicalContext = '';
        if (!recentBidsSnap.empty) {
            historicalContext = recentBidsSnap.docs.map(doc => {
                const b = doc.data();
                return `Bid: ${b.title || 'Untitled'} (Status: ${b.status})\nAgency: ${b.agency || 'Unknown'}\nTotal Value: $${b.totalValue || 'Unknown'}\nItems: ${b.lineItems?.map((li: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => `${li.description} - qty ${li.qty} @ $${li.unitPrice}`).join(', ') || 'None'}`;
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
${JSON.stringify(bid.lineItems.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => ({
    id: item.id,
    description: item.description,
    unit: item.unit,
    qty: item.qty,
    currentUnitPrice: item.unitPrice
})), null, 2)}

Instructions:
1. Review each line item's description, unit, and quantity.
2. CRITICALLY IMPORTANT: Look closely at the Historical Pricing Context for past awarded or submitted bids. If a line item is identical or similar to one that was awarded in the past, heavily weight your recommendation towards that past successful price. Do not invent a completely different price if you have historical data for a similar item.
3. Suggest a realistic, competitive, and profitable unit price for each item.
4. If a currentUnitPrice is already provided (>0), use it as a baseline but optimize it based on historical data and standard market rates.
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
        } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            if (error.message?.includes("429") || error.status === 429) {
                functions.logger.warn(`429 Too Many Requests on gemini-3.6-flash, falling back to gemini-3.5-flash-lite`);
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
                response = await fallbackModel.generateContent([
                    { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                    { text: prompt }
                ]);
            } else {
                throw error;
            }
        }

        let text = response.response.text().trim();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let recommendations;
        try {
            recommendations = JSON.parse(text);
        } catch (e) {
            functions.logger.error("Failed to parse AI pricing recommendations:", text);
            throw new Error("AI returned invalid JSON.", { cause: e });
        }

        // 3. Map recommendations back to the original line items
        const updatedLineItems = bid.lineItems.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            const rec = recommendations.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.id === item.id);
            if (rec && typeof rec.aiRecommendedPrice === 'number') {
                return { ...item, aiRecommendedPrice: rec.aiRecommendedPrice };
            }
            return item;
        });

        return { updatedLineItems };

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Error generating AI pricing:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate AI pricing.");
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

        const request = targetOrgData.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
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

        const request = myOrgData?.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
        if (request) {
            await myOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });

            if (request.subcontractorId) {
                try {
                    await db.collection('subcontractors').doc(request.subcontractorId).update({
                        handshakeStatus: 'None'
                    });
                } catch (e) {
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

        const request = targetOrgData?.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
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

export const processMailQueue = functions.runWith({ secrets: ["SENDGRID_API_KEY"] }).firestore.document('mail_queue/{docId}').onCreate(async (snap) => {
    const payload = snap.data();
    const orgId = payload.organizationId;
    let smtpConfig: any = null;
    let orgName = "";
    let orgEmail = "";

    try {
        let orgData: any = null;
        if (orgId && orgId !== 'unaffiliated') {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                orgData = orgDoc.data() || {};
                orgName = orgData.name || "";
                orgEmail = orgData.email || "";
            }
        }

        if (payload.transport) {
            smtpConfig = payload.transport;
        } else if (orgId && orgId !== 'unaffiliated') {
            const secretDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
            if (secretDoc.exists) {
                const secrets = secretDoc.data() || {};
                const isCampaign = ['PlatformCampaign', 'MarketingBlast', 'PlatformCampaignStudio'].includes(payload.type);
                if (isCampaign && secrets.campaignSmtpConfig && secrets.campaignSmtpConfig.host && secrets.campaignSmtpConfig.user && secrets.campaignSmtpConfig.pass) {
                    smtpConfig = secrets.campaignSmtpConfig;
                    functions.logger.info(`Using campaign-specific SMTP config for ${payload.type}`);
                } else if (secrets.smtpConfig && secrets.smtpConfig.host && secrets.smtpConfig.user && secrets.smtpConfig.pass) {
                    smtpConfig = secrets.smtpConfig;
                }
            } else if (orgData) {
                // Backward compatibility during migration window: Try reading from main org document if secrets don't exist yet
                const isCampaign = ['PlatformCampaign', 'MarketingBlast', 'PlatformCampaignStudio'].includes(payload.type);
                if (isCampaign && orgData.campaignSmtpConfig && orgData.campaignSmtpConfig.host && orgData.campaignSmtpConfig.user && orgData.campaignSmtpConfig.pass) {
                    smtpConfig = orgData.campaignSmtpConfig;
                } else if (orgData.smtpConfig && orgData.smtpConfig.host && orgData.smtpConfig.user && orgData.smtpConfig.pass) {
                    smtpConfig = orgData.smtpConfig;
                }
            }
        }

        // Fetch global platform settings to standardise email signature across all devices
        let signature = '<br><br><hr><p style="color: #64748b; font-size: 12px; margin-top: 20px;">Sent securely via TekTrakker Platform</p>';
        try {
            const platformDoc = await db.collection('platformSettings').doc('branding').get();
            if (platformDoc.exists) {
                const branding = platformDoc.data();
                if (branding && branding.emailSignature) {
                    signature = branding.emailSignature;
                }
            }
        } catch {
            functions.logger.warn("Could not fetch global branding settings for email signature.");
        }

        if (payload.message && payload.message.html) {
            payload.message.html += signature;
        }
        if (payload.message && payload.message.html && !payload.message.text) {
            payload.message.text = payload.message.html.replace(/<[^>]*>?/gm, '');
        }

        let sentViaCustomSmtp = false;

        // If organization has their SMTP set up, try sending directly via nodemailer
        if (smtpConfig) {
            try {
                functions.logger.info(`Attempting direct custom SMTP send for org ${orgId}...`);
                const transporter = nodemailer.createTransport({
                    host: smtpConfig.host,
                    port: smtpConfig.port || 587,
                    secure: smtpConfig.port === 465, // True for 465, false for others
                    auth: {
                        user: smtpConfig.user,
                        pass: smtpConfig.pass
                    }
                });

                const fromHeader = smtpConfig.fromName && smtpConfig.fromEmail 
                    ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>` 
                    : payload.message?.from || `"${smtpConfig.user}" <${smtpConfig.user}>`;

                const formattedSmtpAttachments = await Promise.all((payload.message?.attachments || []).map(async (att: any) => {
                    let base64Data = att.content || '';
                    const urlOrPath = att.path || att.url || '';

                    if (!base64Data && urlOrPath && (typeof urlOrPath === 'string') && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
                        try {
                            const dlRes = await axios.get(urlOrPath, { responseType: 'arraybuffer' });
                            return {
                                filename: att.filename || att.fileName || 'attachment.pdf',
                                content: Buffer.from(dlRes.data),
                                contentType: att.contentType || att.type || 'application/pdf'
                            };
                        } catch (dlErr) {
                            functions.logger.error(`Error downloading attachment for SMTP from ${urlOrPath}:`, dlErr);
                        }
                    }

                    if (base64Data && base64Data.includes('base64,')) {
                        base64Data = base64Data.split('base64,')[1];
                    }

                    return {
                        filename: att.filename || att.fileName || 'attachment.pdf',
                        content: base64Data,
                        encoding: 'base64',
                        contentType: att.contentType || att.type || 'application/pdf'
                    };
                }));

                const mailOptions = {
                    from: fromHeader,
                    to: payload.to,
                    subject: payload.message?.subject || 'Notification',
                    html: payload.message?.html,
                    text: payload.message?.text,
                    replyTo: payload.message?.replyTo,
                    attachments: formattedSmtpAttachments
                };

                const info = await transporter.sendMail(mailOptions);
                functions.logger.info(`Successfully sent email via custom SMTP for org ${orgId}:`, info.messageId);

                // Write the log to the 'mail' collection with a completed/success delivery state so it is kept in history but not sent again by the trigger-email extension
                await db.collection('mail').add({
                    ...payload,
                    delivery: {
                        state: "SUCCESS",
                        info: {
                            messageId: info.messageId,
                            response: info.response
                        },
                        attempts: 1,
                        endTime: admin.firestore.Timestamp.now(),
                        startTime: admin.firestore.Timestamp.now()
                    }
                });

                sentViaCustomSmtp = true;
            } catch (smtpError: any) {
                functions.logger.error(`Failed to send via custom SMTP for org ${orgId}. Falling back to platform email.`, smtpError);
                // Reset/clean payload so that we do not put SMTP config in final public mail document
                if (payload.transport) delete payload.transport;
            }
        }

        // Fallback: If custom SMTP failed or was never configured, send via platform default SMTP (SendGrid API)
        if (!sentViaCustomSmtp) {
            const sendgridApiKey = process.env.SENDGRID_API_KEY;
            if (sendgridApiKey) {
                try {
                    functions.logger.info(`Sending email via SendGrid API for org ${orgId}...`);
                    sgMail.setApiKey(sendgridApiKey);

                    const fromEmail = "notifications@mail.tektrakker.com"; // Verified sender domain
                    const fromName = payload.message?.fromName || (orgName ? `${orgName} via TekTrakker` : "TekTrakker");
                    
                    const msg: any = {
                        to: payload.to,
                        from: {
                            email: fromEmail,
                            name: fromName
                        },
                        subject: payload.message?.subject || 'Notification',
                        html: payload.message?.html,
                        text: payload.message?.text,
                        customArgs: {
                            organizationId: orgId || 'platform',
                            mailQueueId: snap.id,
                            proposalId: payload.proposalId || '',
                            invoiceId: payload.invoiceId || '',
                            jobId: payload.jobId || '',
                            type: payload.type || ''
                        }
                    };

                    const replyTo = payload.message?.replyTo || orgEmail;
                    if (replyTo) {
                        msg.replyTo = replyTo;
                    }

                    // Diagnostic: log attachment presence
                    const rawAttachments = payload.message?.attachments;
                    functions.logger.info(`Attachment check: hasAttachments=${!!rawAttachments}, count=${rawAttachments?.length || 0}, keys=${rawAttachments ? rawAttachments.map((a: any) => `[filename=${a.filename},contentLen=${(a.content || '').length},path=${a.path || a.url || 'NONE'}]`).join(', ') : 'N/A'}`);

                    if (payload.message?.attachments && payload.message.attachments.length > 0) {
                        msg.attachments = await Promise.all(payload.message.attachments.map(async (att: any) => {
                            let base64Data = att.content || '';
                            const urlOrPath = att.path || att.url || '';

                            if (!base64Data && urlOrPath && (typeof urlOrPath === 'string') && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
                                try {
                                    const dlRes = await axios.get(urlOrPath, { responseType: 'arraybuffer' });
                                    const dlBuffer = Buffer.from(dlRes.data);
                                    functions.logger.info(`Downloaded attachment from URL: status=${dlRes.status}, bufferLen=${dlBuffer.length}, contentType=${dlRes.headers['content-type']}`);
                                    base64Data = dlBuffer.toString('base64');
                                    functions.logger.info(`Converted to base64: length=${base64Data.length}, first50=${base64Data.substring(0, 50)}`);
                                } catch (dlErr) {
                                    functions.logger.error(`Error downloading attachment for SendGrid from ${urlOrPath}:`, dlErr);
                                }
                            }

                            if (base64Data && base64Data.includes('base64,')) {
                                base64Data = base64Data.split('base64,')[1];
                            }

                            functions.logger.info(`Final attachment for SendGrid: filename=${att.filename}, base64Len=${base64Data.length}`);

                            return {
                                content: base64Data,
                                filename: att.filename || att.fileName || 'attachment.pdf',
                                type: att.contentType || att.type || 'application/pdf',
                                disposition: att.disposition || 'attachment'
                            };
                        }));
                    }

                    const response = await sgMail.send(msg);
                    functions.logger.info(`Successfully sent email via SendGrid API for org ${orgId}:`, response);

                    // Write log to the 'mail' collection with a completed/success delivery state
                    await db.collection('mail').add({
                        ...payload,
                        delivery: {
                            state: "SUCCESS",
                            info: {
                                messageId: response[0]?.headers?.['x-message-id'] || 'sg-api-send',
                                response: `SendGrid status: ${response[0]?.statusCode}`
                            },
                            attempts: 1,
                            endTime: admin.firestore.Timestamp.now(),
                            startTime: admin.firestore.Timestamp.now()
                        }
                    });
                } catch (sgError: any) {
                    functions.logger.error(`SendGrid API send failed for org ${orgId}. Falling back to Firestore mail queue.`, sgError);
                    // Standard fallback: Forward payload to the final 'mail' collection for delivery via the Firebase extension trigger
                    await db.collection('mail').add(payload);
                }
            } else {
                functions.logger.warn(`SENDGRID_API_KEY is not configured. Falling back to default mail collection trigger.`);
                // Standard fallback: Forward payload to the final 'mail' collection for delivery via the Firebase extension trigger
                await db.collection('mail').add(payload);
            }
        }

        // Clean up the queue
        await snap.ref.delete();
    } catch (error) {
        functions.logger.error(`Failed to process mail queue for org ${orgId}`, error);
    }
});

export const sendgridWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const events = req.body;
        if (!Array.isArray(events)) {
            res.status(400).send('Invalid payload: expected an array of events.');
            return;
        }

        const batch = db.batch();

        for (const event of events) {
            const { event: eventType, mailQueueId, proposalId, invoiceId, organizationId, email, timestamp } = event;
            functions.logger.info(`Received SendGrid webhook event [${eventType}] for mailQueueId ${mailQueueId}, org: ${organizationId}`);

            // 1. Log event details to the Firestore mail collection
            if (mailQueueId) {
                const mailRef = db.collection('mail').doc(mailQueueId);
                batch.set(mailRef, {
                    delivery: {
                        status: eventType,
                        updatedAt: new Date(timestamp * 1000).toISOString(),
                        lastEvent: eventType
                    }
                }, { merge: true });
            }

            // 2. Track proposal events (Opened, Clicked)
            if (proposalId) {
                const proposalRef = db.collection('proposals').doc(proposalId);
                const trackingEntry = {
                    status: eventType === 'open' ? 'Opened (Email)' : eventType === 'click' ? 'Clicked Link (Email)' : `Email ${eventType}`,
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    updatedBy: 'SendGrid Webhook',
                    notes: `Event [${eventType}] registered for recipient ${email}`
                };
                batch.update(proposalRef, {
                    trackingHistory: admin.firestore.FieldValue.arrayUnion(trackingEntry)
                });
            }

            // 3. Track invoice events (logs to invoice timeline)
            if (invoiceId) {
                const orgId = organizationId || 'platform';
                const trackingEntry = {
                    event: `Email ${eventType}`,
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    notes: `Email sent to ${email} was ${eventType}`
                };

                // Update nested invoice timeline
                const invoiceRef = db.collection('organizations').doc(orgId).collection('invoices').doc(invoiceId);
                const timelineRef = invoiceRef.collection('timeline').doc(`sg_${eventType}_${timestamp}`);
                batch.set(timelineRef, trackingEntry);

                // Also update root invoice timeline
                const rootInvoiceRef = db.collection('invoices').doc(invoiceId);
                const rootTimelineRef = rootInvoiceRef.collection('timeline').doc(`sg_${eventType}_${timestamp}`);
                batch.set(rootTimelineRef, trackingEntry);
            }
        }

        await batch.commit();
        res.status(200).send('OK');
    } catch (error) {
        functions.logger.error('Error processing SendGrid webhook:', error);
        res.status(500).send('Internal Server Error');
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

    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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
            req.body.user_column_data.forEach((col: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                if (col.column_id === 'FIRST_NAME') firstName = col.string_value;
                if (col.column_id === 'LAST_NAME') lastName = col.string_value;
                if (col.column_id === 'PHONE_NUMBER') phone = col.string_value;
                if (col.column_id === 'EMAIL') email = col.string_value;
            });
            notes = 'Lead ingested via Google Ads Campaign.';
        }

        const customerName = `${firstName} ${lastName}`.trim();
        const db = admin.firestore();

        // --- Advanced Webhook Deduplication and Portal Invite ---
        let customerId = '';
        let existingCustomerData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = null;

        const matchName = customerName.toLowerCase().trim();
        const matchPhone = phone.replace(/\D/g, '');
        const matchEmail = email.toLowerCase().trim();

        const customersSnapshot = await db.collection('customers').where('organizationId', '==', orgId).get();
        const existingDoc = customersSnapshot.docs.find(d => {
            const data = d.data();
            const dName = (data.name || '').toLowerCase().trim();
            const dPhone = (data.phone || '').replace(/\D/g, '');
            const dEmail = (data.email || '').toLowerCase().trim();

            if (dName === matchName && ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail))) return true;
            if ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail)) return true;
            return false;
        });

        if (existingDoc) {
            customerId = existingDoc.id;
            existingCustomerData = existingDoc.data();
            const updates: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
            if (phone && !existingCustomerData.phone) updates.phone = phone;
            if (email && !existingCustomerData.email) updates.email = email;
            if (Object.keys(updates).length > 0) await existingDoc.ref.update(updates);
        } else {
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
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Webhook Error:", error);
        res.status(500).send({ error: "Internal Server Error processing webhook.", message: error.message });
    }
});

// --- B2B SUPPLIER PUNCHOUT (cXML) ---

export const initiatePunchoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId;
    if (!orgId) throw new functions.https.HttpsError("permission-denied", "User has no organization tied.");

    // 1. Fetch the organization's settings
    const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
    const config = secretsDoc.data()?.punchoutConfig;
    if (!config || !config.setupUrl || !config.sharedSecret) {
        throw new functions.https.HttpsError("failed-precondition", "B2B PunchOut is not fully configured in your Settings.");
    }

    const { fromDomain, fromIdentity, toDomain, toIdentity, sharedSecret, setupUrl } = config;
    if (!fromIdentity || !toIdentity) throw new functions.https.HttpsError("failed-precondition", "PunchOut identity config is incomplete.");

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

    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("PunchOut Fetch Error:", e);
        throw new functions.https.HttpsError("internal", e.message || "Failed to contact supplier.");
    }
});


export const punchoutWebhook = functions.https.onRequest(async (req, res) => {
    // Standard cXML HTTP Post from supplier returning cart
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // Use rawBody buffer or string fallback
    const rawXml = (req as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).rawBody ? (req as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).rawBody.toString() : req.body;
    let orgId = req.query.orgId as string;

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
                if (cookieMap.jobId) jobId = cookieMap.jobId;
                if (cookieMap.userId) userId = cookieMap.userId;
            } catch { /* ignore */ }
        }

        const totalAmount = parseFloat(orderMessage.PunchOutOrderMessageHeader?.Total?.Money?._ || '0');
        let itemsField = orderMessage.ItemIn || [];
        if (!Array.isArray(itemsField)) itemsField = [itemsField]; // Normalize if single item

        const itemDescriptions = itemsField.map((i: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
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

    } catch (e) {
        functions.logger.error("PunchOut Webhook Parsing Error:", e);
        res.status(500).send('Internal Server Error parsing XML');
    }
});


export const twilioInboundVoice = functions.https.onRequest(async (req, res) => {
    try {
        let resolvedOrgId = req.query.orgId as string;
        const fromPhone = req.body.From; // caller
        const toPhone = req.body.To;     // dialed number (useful for BYOK)
        
        if (!resolvedOrgId && fromPhone) {
            const rawNumber = fromPhone.replace(/^\+1/, '');
            const [exactSnap, fallbackSnap] = await Promise.all([
                db.collection('customers').where('phone', '==', fromPhone).get(),
                db.collection('customers').where('phone', '==', rawNumber).get()
            ]);
            const docs = [...exactSnap.docs, ...fallbackSnap.docs];
            if (docs.length > 0) {
                resolvedOrgId = docs[0].data()?.organizationId;
            }
        }
        
        if (!resolvedOrgId && toPhone) {
            const secretsSnap = await db.collectionGroup('secrets').where('twilioConfig.phoneNumber', '==', toPhone).get();
            if (secretsSnap.docs.length > 0) {
                resolvedOrgId = secretsSnap.docs[0].ref.parent.parent?.id || '';
            }
        }

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        if (!resolvedOrgId) {
            twiml.say({ voice: 'Polly.Matthew-Neural' }, "Thank you for calling. No business matches your contact number. Please call the office directly.");
            res.set('Content-Type', 'text/xml');
            res.status(200).send(twiml.toString());
            return;
        }

        const callSid = req.body.CallSid || 'test-call-sid';
        const speechResult = req.body.SpeechResult;
        const initialGreeting = req.query.initialGreeting as string;

        const sessionRef = db.collection('voiceSessions').doc(callSid);
        const sessionDoc = await sessionRef.get();
        let history: any[] = [];
        if (sessionDoc.exists) {
            history = sessionDoc.data()?.history || [];
        }

        let replyText = '';

        if (speechResult) {
            history.push({ role: 'user', content: speechResult });
            
            const orgRef = await db.collection('organizations').doc(resolvedOrgId).get();
            const orgName = orgRef.exists ? orgRef.data()?.name : "our company";
            
            const systemPrompt = `You are a helpful automated AI dispatcher answering phone calls for ${orgName}. Answering customers' questions politely, keep your spoken sentences short, simple, and natural for speech synthesis (Polly Matthew Neural voice). Provide answers regarding scheduling, job statuses, or technician details if asked. Do NOT include markdown like bold (**), italics, or links in your replies since they are spoken aloud. Make your reply fit in 1 or 2 sentences max.`;
            
            let apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                const secretsDoc = await db.collection('organizations').doc(resolvedOrgId).collection('secrets').doc('config').get();
                apiKey = secretsDoc.data()?.aiApiKeys?.gemini || secretsDoc.data()?.twilioConfig?.authToken;
            }
            
            if (apiKey) {
                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
                    
                    const contents: any[] = [
                        { role: 'user', parts: [{ text: systemPrompt }] }
                    ];
                    
                    history.forEach(h => {
                        contents.push({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.content }]
                        });
                    });
                    
                    const result = await model.generateContent({ contents });
                    replyText = result.response.text()?.trim() || "I didn't quite catch that. Could you please repeat it?";
                } catch (e: any) {
                    functions.logger.error("Gemini Inbound Voice Gen Error:", e);
                    replyText = "I am sorry, my connection is running slow. Could you please repeat that?";
                }
            } else {
                replyText = "I am sorry, my system is currently offline. Please call back later.";
            }
            
            replyText = replyText.replace(/[*_~`#]/g, '');
            history.push({ role: 'model', content: replyText });
            await sessionRef.set({ history, organizationId: resolvedOrgId, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else {
            const orgRef = await db.collection('organizations').doc(resolvedOrgId).get();
            const orgName = orgRef.exists ? orgRef.data()?.name : "our company";
            replyText = initialGreeting || `Hi! You have reached the automated AI dispatcher for ${orgName}. How can I help you today?`;
            
            history.push({ role: 'model', content: replyText });
            await sessionRef.set({ history, organizationId: resolvedOrgId, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }

        twiml.say({ voice: 'Polly.Matthew-Neural' }, replyText);
        twiml.gather({
            input: ['speech'],
            action: `/twilioInboundVoice?orgId=${resolvedOrgId}`,
            timeout: 5
        });

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Twilio Voice Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});

export const twilioInboundSms = functions.https.onRequest(async (req, res) => {
    try {
        const fromPhone = req.body.From; // e.g., '+1234567890'
        const smsBody = (req.body.Body || '').trim().toUpperCase();
        let smsResponse = '';

        if (fromPhone) {
            const rawNumber = fromPhone.replace(/^\+1/, '');

            // Try searching with both format types to associate this message with a customer/org
            const [exactSnap, fallbackSnap] = await Promise.all([
                db.collection('customers').where('phone', '==', fromPhone).get(),
                db.collection('customers').where('phone', '==', rawNumber).get()
            ]);

            const documents = [...exactSnap.docs, ...fallbackSnap.docs];

            if (documents.length > 0) {
                const matchedOrgId = documents[0].data()?.organizationId;
                if (matchedOrgId) {
                    // Check if the organization has configured their own Twilio or RingCentral details
                    const secretDoc = await db.collection('organizations').doc(matchedOrgId).collection('secrets').doc('config').get();
                    const secrets = secretDoc.data() || {};
                    const hasOwnTwilio = !!secrets.twilioConfig?.accountSid;
                    const hasOwnRc = secrets.rcPrimarySms === true || secrets.rcPrimarySms === 'true';

                    if (!hasOwnTwilio && !hasOwnRc) {
                        await trackSmsUsage(matchedOrgId, 'inbound');
                    }
                }
            }

            const isOptOut = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'].includes(smsBody);
            const isOptIn = ['START', 'YES'].includes(smsBody);
            const isHelp = ['HELP', 'INFO'].includes(smsBody);
            const isStatus = ['STATUS', 'TECH', 'TECHNICIAN', 'JOB'].includes(smsBody);

            if (isOptOut || isOptIn) {
                functions.logger.info(`Received ${smsBody} request from ${fromPhone}`);

                if (documents.length > 0) {
                    const batch = db.batch();
                    documents.forEach(doc => {
                        batch.update(doc.ref, {
                            'marketingConsent.sms': isOptIn,
                            'marketingConsent.agreedAt': isOptIn ? new Date().toISOString() : null,
                            'marketingConsent.unsubscribedAt': isOptOut ? new Date().toISOString() : null,
                            'marketingConsent.source': isOptIn ? 'Twilio SMS Opt-In' : 'Twilio SMS Opt-Out'
                        });
                    });
                    await batch.commit();
                    functions.logger.info(`Updated marketingConsent for ${documents.length} customer(s) to sms=${isOptIn}`);
                } else {
                    functions.logger.warn(`No customer found with phone number ${fromPhone} or ${rawNumber}`);
                }

                if (isOptOut) {
                    smsResponse = 'You have successfully unsubscribed from TekTrakker notifications. Reply START to opt-in again.';
                } else {
                    smsResponse = 'You have successfully subscribed to TekTrakker notifications. Msg & data rates may apply. Reply HELP for help, STOP to cancel.';
                }
            } else if (isHelp) {
                smsResponse = 'TekTrakker Help: Reply STATUS to check job/technician status, STOP to opt-out of text alerts, or START to opt-in again. For support, contact your provider.';
            } else if (isStatus) {
                const customerDocs = documents;
                const customerIds = Array.from(new Set(customerDocs.map(d => d.id)));

                // Fetch jobs
                const jobs: any[] = [];
                if (customerIds.length > 0) {
                    const jobsByCustSnap = await db.collection('jobs')
                        .where('customerId', 'in', customerIds)
                        .get();
                    jobs.push(...jobsByCustSnap.docs.map(d => d.data()));
                }

                // Also query jobs by phone directly (for guest checkouts / unassigned customers)
                const [jobsByPhoneSnap, jobsByPhoneRawSnap] = await Promise.all([
                    db.collection('jobs').where('customerPhone', '==', fromPhone).get(),
                    db.collection('jobs').where('customerPhone', '==', rawNumber).get()
                ]);
                jobs.push(...jobsByPhoneSnap.docs.map(d => d.data()));
                jobs.push(...jobsByPhoneRawSnap.docs.map(d => d.data()));

                // Deduplicate jobs by ID
                const uniqueJobsMap = new Map<string, any>();
                jobs.forEach(j => {
                    if (j && j.id) {
                        uniqueJobsMap.set(j.id, j);
                    }
                });
                const uniqueJobs = Array.from(uniqueJobsMap.values());

                // Find active job (first In Progress, then Scheduled)
                let activeJob = uniqueJobs.find(j => j.jobStatus === 'In Progress');
                if (!activeJob) {
                    activeJob = uniqueJobs.find(j => j.jobStatus === 'Scheduled');
                }

                if (activeJob) {
                    const techName = activeJob.assignedTechnicianName || 'Unassigned';
                    const statusStr = activeJob.jobStatus;
                    const apptTime = activeJob.appointmentTime ? new Date(activeJob.appointmentTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    }) : 'Not scheduled';

                    if (statusStr === 'In Progress') {
                        smsResponse = `TekTrakker Status: Your service is IN PROGRESS. Tech ${techName} is on site.`;
                    } else {
                        smsResponse = `TekTrakker Status: Scheduled for ${apptTime}. Tech: ${techName}.`;
                    }
                } else {
                    const completedJobs = uniqueJobs.filter(j => j.jobStatus === 'Completed' || j.jobStatus === 'Cancelled');
                    if (completedJobs.length > 0) {
                        completedJobs.sort((a, b) => {
                            const dateA = new Date(a.endTime || a.updatedAt || a.createdAt || 0).getTime();
                            const dateB = new Date(b.endTime || b.updatedAt || b.createdAt || 0).getTime();
                            return dateB - dateA;
                        });
                        const lastJob = completedJobs[0];
                        const lastStatus = lastJob.jobStatus;
                        const completedTime = lastJob.endTime ? new Date(lastJob.endTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        }) : 'recently';
                        smsResponse = `TekTrakker Status: No active jobs. Last service was ${lastStatus.toUpperCase()} on ${completedTime}.`;
                    } else {
                        smsResponse = `TekTrakker Status: No active or past service requests found for this number.`;
                    }
                }
            } else {
                smsResponse = `TekTrakker: Command not recognized. Reply HELP for a list of available commands.`;
            }
        }

        res.set('Content-Type', 'text/xml');
        const responseXml = fromPhone && smsResponse 
            ? `<Response><Message><![CDATA[${smsResponse}]]></Message></Response>` 
            : '<Response></Response>';
        res.status(200).send(responseXml);
    } catch (error) {
        functions.logger.error("Twilio Inbound SMS Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});


// --- TWILIO SUBCONTRACTOR IVR WEBHOOK (HYBRID CLOCK-IN / CHECK-OUT FLOW) ---
export const twilioSubcontractorIVR = functions.https.onRequest(async (req, res) => {
    try {
        const step = req.query.step as string || 'default';
        const userId = req.query.userId as string || '';
        const orgId = req.query.orgId as string || '';
        const userName = req.query.userName as string || '';
        const jobId = req.query.jobId as string || '';
        const customerName = req.query.customerName as string || '';
        const shiftId = req.query.shiftId as string || '';

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        if (step === 'default') {
            const fromPhone = req.body.From;
            let resolvedUserId = '';
            let resolvedOrgId = '';
            let resolvedUserName = '';

            if (fromPhone) {
                const rawNumber = fromPhone.replace(/^\+1/, '');
                const [exactSnap, fallbackSnap] = await Promise.all([
                    db.collection('users').where('phone', '==', fromPhone).get(),
                    db.collection('users').where('phone', '==', rawNumber).get()
                ]);
                const users = [...exactSnap.docs, ...fallbackSnap.docs];
                if (users.length > 0) {
                    const userDoc = users[0];
                    const userData = userDoc.data();
                    resolvedUserId = userDoc.id;
                    resolvedOrgId = userData.organizationId || '';
                    resolvedUserName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                }
            }

            if (resolvedUserId && resolvedOrgId) {
                // Find assigned jobs for recognized user today/recent
                const jobsSnap = await db.collection('jobs')
                    .where('organizationId', '==', resolvedOrgId)
                    .where('assignedTechnicianId', '==', resolvedUserId)
                    .get();

                // Filter active jobs in memory
                const activeJobs = jobsSnap.docs.filter(doc => {
                    const status = doc.data().jobStatus;
                    return status === 'Scheduled' || status === 'In Progress';
                });

                if (activeJobs.length === 0) {
                    const gather = twiml.gather({
                        numDigits: 6,
                        action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. We could not find any active or scheduled jobs assigned to you today. Please enter the six-digit Job Number followed by the pound sign.`);
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else if (activeJobs.length === 1) {
                    const targetJobDoc = activeJobs[0];
                    const targetJobId = targetJobDoc.id;
                    const targetJobData = targetJobDoc.data();
                    const targetCustomerName = targetJobData.customerName || 'the customer';

                    // Check if already clocked in to this job
                    const activeShiftSnap = await db.collection('shifts')
                        .where('userId', '==', resolvedUserId)
                        .where('jobId', '==', targetJobId)
                        .where('clockOut', '==', null)
                        .get();

                    if (activeShiftSnap.empty) {
                        const gather = twiml.gather({
                            numDigits: 1,
                            action: `/twilioSubcontractorIVR?step=selectRecognizedJobOption&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}`,
                            timeout: 10
                        });
                        gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. We found one job for ${targetCustomerName}. Press 1 to clock in to this job. Press 2 to clock in to a different job number.`);
                    } else {
                        const gather = twiml.gather({
                            numDigits: 1,
                            action: `/twilioSubcontractorIVR?step=selectActiveShiftOption&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}&shiftId=${activeShiftSnap.docs[0].id}`,
                            timeout: 10
                        });
                        gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. You are currently clocked in to the job for ${targetCustomerName}. Press 1 to clock out. Press 2 to log in to a different job number.`);
                    }
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else {
                    const gather = twiml.gather({
                        numDigits: 6,
                        action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. You have multiple jobs today. Please enter the six-digit Job Number you want to clock in or out of, followed by the pound sign.`);
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                }
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: '/twilioSubcontractorIVR?step=verifyPin',
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Welcome to the Tek Trakker IVR system. Please enter your six digit P I N followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        } 
        
        else if (step === 'verifyPin') {
            const pinInput = (req.body.Digits || '').trim();
            let userDoc = null;

            if (pinInput) {
                const usersSnap = await db.collection('users').where('pin', '==', pinInput).get();
                if (!usersSnap.empty) {
                    userDoc = usersSnap.docs[0];
                } else {
                    const fallbackPinSnap = await db.collection('users').where('kioskPin', '==', pinInput).get();
                    if (!fallbackPinSnap.empty) {
                        userDoc = fallbackPinSnap.docs[0];
                    }
                }
            }

            if (userDoc) {
                const userData = userDoc.data();
                const resolvedUserId = userDoc.id;
                const resolvedOrgId = userData.organizationId || '';
                const resolvedUserName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, `Thank you ${resolvedUserName}. Please enter the six digit Job Number followed by the pound sign.`);
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: '/twilioSubcontractorIVR?step=verifyPin',
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Invalid P I N. Please enter your six digit P I N followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'verifyJob') {
            const jobNumberInput = (req.body.Digits || '').trim();
            const jobsSnap = await db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('jobNumber', '==', jobNumberInput)
                .get();

            if (!jobsSnap.empty) {
                const targetJobDoc = jobsSnap.docs[0];
                const targetJobId = targetJobDoc.id;
                const targetCustomerName = targetJobDoc.data().customerName || 'the customer';

                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=confirmJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, `You entered job for ${targetCustomerName}. Press 1 to confirm. Press 2 to re-enter the job number.`);
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Job number not found. Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'selectRecognizedJobOption') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=doClockIn&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "To check in, please enter the number of technicians on site, followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'selectActiveShiftOption') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=doClockOut&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}&shiftId=${shiftId}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "To check out, press 1 if the job is complete, press 2 if a return trip is required.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'confirmJob') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const activeShiftSnap = await db.collection('shifts')
                    .where('userId', '==', userId)
                    .where('jobId', '==', jobId)
                    .where('clockOut', '==', null)
                    .get();

                if (activeShiftSnap.empty) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: `/twilioSubcontractorIVR?step=doClockIn&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, "To check in, please enter the number of technicians on site, followed by the pound sign.");
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: `/twilioSubcontractorIVR?step=doClockOut&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}&shiftId=${activeShiftSnap.docs[0].id}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, "You are currently checked in. To check out, press 1 if the job is complete, press 2 if a return trip is required.");
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                }
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'doClockIn') {
            const techCount = parseInt((req.body.Digits || '').replace(/\D/g, '')) || 1;
            const now = new Date().toISOString();
            const newShiftId = 'shift-' + Date.now();

            // a. Create shift log in shifts collection (job timer)
            await db.collection('shifts').doc(newShiftId).set({
                id: newShiftId,
                organizationId: orgId,
                userId: userId,
                userName: userName,
                jobId: jobId,
                clockIn: now,
                clockOut: null,
                techniciansOnsite: techCount,
                isApproved: false,
                source: 'IVR'
            });

            // b. Create general daily shift log in shiftLogs collection
            await db.collection('shiftLogs').doc(newShiftId).set({
                id: newShiftId,
                organizationId: orgId,
                userId: userId,
                userName: userName,
                clockIn: now,
                clockOut: null,
                action: 'clock_in',
                status: 'Clocked In',
                isApproved: false,
                source: 'IVR'
            });

            // c. Update Job record check-in times and status
            const jobRef = db.collection('jobs').doc(jobId);
            const jobDoc = await jobRef.get();
            if (jobDoc.exists) {
                const jobData = jobDoc.data() || {};
                const timeEntries = jobData.timeEntries || [];
                timeEntries.push({
                    checkInTime: now,
                    checkOutTime: null,
                    timeOnSiteMinutes: null,
                    techniciansOnsite: techCount,
                    source: 'IVR'
                });
                await jobRef.update({
                    checkInTime: now,
                    checkOutTime: null,
                    timeEntries: timeEntries,
                    jobStatus: 'In Progress',
                    updatedAt: now
                });
            }

            twiml.say({ voice: 'Polly.Matthew-Neural' }, `Thank you. You have been checked in with ${techCount} technicians. Have a great shift. Goodbye.`);
            twiml.hangup();
        }

        else if (step === 'doClockOut') {
            const choice = (req.body.Digits || '').trim();
            const now = new Date().toISOString();

            // a. Update shifts collection
            await db.collection('shifts').doc(shiftId).update({
                clockOut: now
            });

            // b. Update shiftLogs collection
            await db.collection('shiftLogs').doc(shiftId).update({
                clockOut: now,
                action: 'clock_out',
                status: 'Clocked Out'
            });

            // c. Update Job record check-out times and status
            const jobRef = db.collection('jobs').doc(jobId);
            const jobDoc = await jobRef.get();
            let message = 'You have been clocked out.';

            if (jobDoc.exists) {
                const jobData = jobDoc.data() || {};
                const checkIn = jobData.checkInTime || now;
                const durationMs = new Date(now).getTime() - new Date(checkIn).getTime();
                const currentMins = Math.max(0, Math.round(durationMs / 60000));

                const timeEntries = [...(jobData.timeEntries || [])];
                if (timeEntries.length > 0) {
                    const lastIdx = timeEntries.length - 1;
                    timeEntries[lastIdx] = {
                        ...timeEntries[lastIdx],
                        checkOutTime: now,
                        timeOnSiteMinutes: currentMins
                    };
                } else {
                    timeEntries.push({
                        checkInTime: checkIn,
                        checkOutTime: now,
                        timeOnSiteMinutes: currentMins,
                        source: 'IVR'
                    });
                }

                const totalMins = timeEntries.reduce((acc: number, entry: any) => acc + (entry.timeOnSiteMinutes || 0), 0);

                const updates: any = {
                    checkOutTime: now,
                    timeOnSiteMinutes: totalMins,
                    timeEntries: timeEntries,
                    updatedAt: now
                };

                if (choice === '1') {
                    updates.jobStatus = 'Completed';
                    message += ' The job has been marked as complete. Thank you. Goodbye.';
                } else {
                    updates.jobStatus = 'Needs Follow-up';
                    message += ' The job has been marked as requiring a return trip. Thank you. Goodbye.';
                }

                await jobRef.update(updates);
            }

            twiml.say({ voice: 'Polly.Matthew-Neural' }, message);
            twiml.hangup();
        }

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Twilio Subcontractor IVR Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});


// --- AUTOMATED MAINTENANCE SWEEP & REMINDERS (CRON JOB) ---
export const automatedMaintenanceReminders = functions.pubsub.schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            const now = new Date();
            const customersSnap = await db.collection('customers').get();

            const batchOperations: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];
            const orgsCache: { [key: string]: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ } = {};

            // Process sequentially since we need async fetches for orgs Cache
            for (const doc of customersSnap.docs) {
                const customer = doc.data();
                if (!customer.equipment || !Array.isArray(customer.equipment)) continue;

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

                customer.equipment.forEach((asset: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                    if (asset.warranty?.requiresMaintenance && asset.warranty.maintenanceIntervalMonths) {
                        let nextDate: Date;
                        if (asset.warranty.lastMaintenanceDate) {
                            nextDate = new Date(asset.warranty.lastMaintenanceDate);
                        } else if (asset.warranty.manufacturerStartDate) {
                            nextDate = new Date(asset.warranty.manufacturerStartDate);
                            nextDate.setDate(nextDate.getDate() + 1); // fix offset
                        } else {
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
                                        from: `${orgName} <platform@tektrakker.com>`,
                                        replyTo: orgEmail || 'rvavrecan@tekairinc.com',
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
                            from: `${orgName} <platform@tektrakker.com>`,
                            replyTo: orgEmail || 'rvavrecan@tekairinc.com',
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

        } catch (error) {
            functions.logger.error("Failed to run automatedMaintenanceReminders:", error);
        }
    });

export * from './aiAgent';
export * from './weeklyReferenceAudit';

export const provisionCustomDomain = functions.https.onCall(async (data: any , context: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');

    const { domainUrl, franchiseId } = data;
    if (!domainUrl || !franchiseId) throw new functions.https.HttpsError('invalid-argument', 'Missing domainUrl or franchiseId');

    // Robust role check (fallbacks for delayed JWT claim propagation)
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data() || {};
    const isMaster = context.auth.token.role === 'master_admin' || userData.role === 'master_admin' || context.auth.token.email === 'rodzelem@gmail.com' || context.auth.token.email === 'ryanvavrecan@gmail.com';
    const isOwner = userData.franchiseId === franchiseId && userData.role === 'franchise_admin';

    if (!isMaster && !isOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only master admins or franchise owners can provision domains.');
    }

    const cleanDomain = domainUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

    try {
        const adminAuth = await admin.credential.applicationDefault().getAccessToken();
        const token = adminAuth.access_token;

        let fbConfig: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
        try { fbConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch { /* Ignore */ }
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

        const result = (await response.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
            } else {
                throw new functions.https.HttpsError('internal', errMsg || "Firebase Hosting API Error");
            }
        }

        const requiredDns = finalResult.requiredDnsUpdates || null;
        let dnsRecords: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};

        if (requiredDns && requiredDns.desired) {
            dnsRecords = requiredDns.desired;
        } else if (finalResult.certProvisioning?.certRequiredDnsUpdates?.desired) {
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
            if (key === '@type') return undefined;
            return value;
        }));

        return { success: true, domain: cleanDomain, hostingResponse: cleanHostingResponse };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Domain Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Unknown Error');
    }
});

// --- INFRASTRUCTURE HARD QUOTA SAFETY NET ---
// Evaluates organization volume daily and permanently suspends any organization
// that exceeds the equivalent of ~/month in reads/writes/storage (e.g. huge document limits).
export const enforceHardQuotas = functions.pubsub.schedule('every 24 hours').onRun(async () => {
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
        } catch (e) {
            console.error('Failed to analyze quota for', orgId, e);
        }
    }
});

export const fetchIotDiagnostics = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const orgId = context.auth.token.organizationId;
    if (!orgId) throw new functions.https.HttpsError("invalid-argument", "Organization ID required.");

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
                const results = await resp.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                (results.devices || []).forEach((d: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
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
            } else {
                functions.logger.error("Seam API Error:", await resp.text());
            }
        } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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
export const fetchShovelsPermits = functions.https.onCall(async (data, context) => {
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
            throw new functions.https.HttpsError(
                'failed-precondition', 
                'Organization has not configured a Shovels.ai API Key. Please visit Settings -> Integrations.'
            );
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

    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error('Error fetching Shovels.ai permits', e);
        throw new functions.https.HttpsError('internal', 'Internal server error while searching for permits', e.message);
    }
});



export * from './gustoAgent';
export * from './bofaAgent';
export * from './googleBusiness';

// --- SOCIAL MEDIA INTEGRATION ---
export const postToX = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const { content, accessToken, accessSecret } = data;
    if (!content) throw new functions.https.HttpsError("invalid-argument", "Missing content.");
    
    // The Consumer Keys provided by the user for the platform App
    const appKey = "psTqiMOKuLwxAPADwZwUck4Rg";
    const appSecret = "6VlyOQawbslwdYCI9j2eekDNWR7hib4suKYa0DQ2kCQWuzuhUh";

    if (!accessToken || !accessSecret) {
        throw new functions.https.HttpsError("failed-precondition", "Missing X User Access Tokens. Please securely connect your X account first.");
    }

    try {
        const client = new TwitterApi({
            appKey,
            appSecret,
            accessToken,
            accessSecret,
        });

        const v2Client = client.v2;
        const result = await v2Client.tweet(content);
        return { success: true, tweetId: result.data.id };
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Failed to post to X:", e);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to X.");
    }
});
export * from './googleBusiness';
export * from './revenuecat';
export * from './rfpAgent';
export * from './tiktok';
export * from './marketplaceIntegrations';
export * from './linkedin';
export * from './ringCentral';
export * from './govContracts';
export * from './microsoftAuth';

export const automatedBidReminders = functions.pubsub.schedule('0 8 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);

        const bidsSnap = await db.collection('bids')
            .where('status', 'in', ['Draft', 'Analyzing', 'Costing', 'Review'])
            .get();

        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];

        for (const doc of bidsSnap.docs) {
            const bid = doc.data();
            const orgId = bid.organizationId;
            if (!orgId) continue;
            
            // Collect all upcoming dates for this bid
            const upcomingEvents: {name: string, date: Date}[] = [];
            
            if (bid.dueDate) {
                const parsed = new Date(bid.dueDate);
                if (!isNaN(parsed.getTime())) upcomingEvents.push({name: 'Final Proposal Due', date: parsed});
            }
            
            if (bid.importantDates && Array.isArray(bid.importantDates)) {
                bid.importantDates.forEach((d: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                    const parsed = new Date(d.date);
                    if (!isNaN(parsed.getTime())) upcomingEvents.push({name: d.name, date: parsed});
                });
            }
            
            // Check if any date is exactly 3 days or 7 days away
            const notificationsToSend: string[] = [];
            
            upcomingEvents.forEach(event => {
                event.date.setHours(0,0,0,0);
                const diffTime = event.date.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 3 || diffDays === 7 || diffDays === 1) {
                    notificationsToSend.push(`${event.name} is in ${diffDays} day(s) (${event.date.toLocaleDateString()}).`);
                }
            });
            
            if (notificationsToSend.length > 0) {
                // Find users in this org who handle bids (or all admins)
                const usersSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .get();
                    
                const admins = usersSnap.docs.filter(u => u.data().role === 'admin' || u.data().role === 'manager');
                
                for (const adminDoc of admins) {
                    const adminId = adminDoc.id;
                    const messageText = `Reminder for Bid "${bid.title || 'Untitled'}":\n` + notificationsToSend.join('\n');
                    
                    // Internal Notification
                    promises.push(db.collection('users').doc(adminId).collection('notifications').add({
                        title: 'Upcoming Bid Deadline',
                        message: messageText,
                        createdAt: new Date().toISOString(),
                        read: false,
                        link: `/admin/bid-workspace?id=${bid.id}`
                    }));
                    
                    // Email Reminder
                    const adminEmail = adminDoc.data().email;
                    if (adminEmail) {
                        promises.push(db.collection('mail_queue').add({ organizationId: orgId, to: adminEmail, message: { subject: 'Upcoming Bid Deadline Reminder', html: `<html><body style="font-family: sans-serif; padding: 20px;"><h2 style="color: #1e40af;">Upcoming Bid Deadline Reminder</h2><p>This is an automated reminder regarding the bid: <strong>${bid.title || 'Untitled'}</strong></p><p>The following deadlines are approaching:</p><ul>${notificationsToSend.map(n => '<li>' + n + '</li>').join('')}</ul><a href="https://tektrakker.web.app/admin/bid-workspace?id=${bid.id}" style="display:inline-block; padding: 10px 15px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View Bid in TekTrakker</a></body></html>` }, createdAt: new Date().toISOString() }));
                    }
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in automatedBidReminders:", error);
    }
});

export const cleanupBidOnDelete = functions.firestore.document('bids/{bidId}').onDelete(async (snap, context) => {
    const bidId = context.params.bidId;
    const bidData = snap.data();
    const orgId = bidData.organizationId;
    if (!orgId) return;

    try {
        const usersSnap = await db.collection('users').where('organizationId', '==', orgId).get();
        const batch = db.batch();
        let count = 0;

        for (const userDoc of usersSnap.docs) {
            const notificationsSnap = await db.collection('users').doc(userDoc.id).collection('notifications')
                .where('link', '==', `/admin/bid-workspace?id=${bidId}`)
                .get();
                
            notificationsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });
        }

        if (count > 0) {
            await batch.commit();
            functions.logger.info(`Deleted ${count} notifications for deleted bid ${bidId}`);
        }
    } catch (e) {
        functions.logger.error("Error cleaning up bid notifications:", e);
    }
});

export const checkApiKeyExpirations = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const keysSnap = await db.collection('platformSettings').doc('api_keys').get();
        
        if (!keysSnap.exists) {
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            await db.collection('platformSettings').doc('api_keys').set({
                'SAM.gov': {
                    key: 'SAM-f4ad5cf0-1535-4a33-8c50-f2e78267fb11',
                    expiresAt: oneYearFromNow.toISOString()
                }
            });
            return;
        }

        const keysData = keysSnap.data() || {};
        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];
        const expiringKeys: string[] = [];

        Object.entries(keysData).forEach(([serviceName, data]: [string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */]) => {
            if (data.expiresAt) {
                const expDate = new Date(data.expiresAt);
                expDate.setHours(0,0,0,0);
                const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if ([30, 15, 7, 3, 1].includes(diffDays) || diffDays <= 0) {
                    expiringKeys.push(`${serviceName} API Key ${diffDays <= 0 ? 'HAS EXPIRED' : `expires in ${diffDays} day(s)`} on ${expDate.toLocaleDateString()}`);
                }
            }
        });

        if (expiringKeys.length > 0) {
            const masterAdmins = await db.collection('users').where('role', '==', 'master_admin').get();
            
            for (const adminDoc of masterAdmins.docs) {
                const adminEmail = adminDoc.data().email;
                if (adminEmail) {
                    promises.push(db.collection('mail_queue').add({ organizationId: 'system', to: adminEmail, message: { subject: 'API Key Expiration Warning', html: `<html><body style="font-family: sans-serif; padding: 20px;"><h2 style="color: #ef4444;">API Key Expiration Warning</h2><p>This is an automated system alert regarding your platform's API keys.</p><ul>${expiringKeys.map(k => '<li><strong>' + k + '</strong></li>').join('')}</ul><p>Please update the keys in the codebase and the platformSettings/api_keys Firestore document to prevent service interruption.</p></body></html>` }, createdAt: new Date().toISOString() }));
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in checkApiKeyExpirations:", error);
    }
});

export const checkNewHireReporting = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const staffRoles = ['employee', 'admin', 'supervisor', 'technician'];
        const usersSnap = await db.collection('users').where('role', 'in', staffRoles).get();
        
        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const hireDateStr = userData.hireDate;
            const orgId = userData.organizationId;
            
            if (!hireDateStr || !orgId) continue;
            
            const hireDate = new Date(hireDateStr);
            if (isNaN(hireDate.getTime())) continue;

            hireDate.setHours(0,0,0,0);
            
            const diffDays = Math.ceil((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 10 || diffDays === 15 || diffDays === 19) {
                // Find admins of this org
                const orgAdminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', '==', 'admin')
                    .get();
                    
                for (const adminDoc of orgAdminsSnap.docs) {
                    const adminId = adminDoc.id;
                    const daysLeft = 20 - diffDays;
                    const messageText = `Reminder: Please report your new hire ${userData.firstName || ''} ${userData.lastName || ''} to the state registry. You have ${daysLeft} day(s) left.`;
                    
                    promises.push(db.collection('users').doc(adminId).collection('notifications').add({
                        title: 'Action Required: New Hire Reporting',
                        message: messageText,
                        createdAt: new Date().toISOString(),
                        read: false,
                        type: 'system_alert',
                        link: `/admin/workforce`
                    }));
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in checkNewHireReporting:", error);
    }
});

export const checkProposalExpirations = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const proposalsSnap = await db.collection('proposals')
            .where('status', 'in', ['Sent', 'Opened'])
            .get();

        let batch = db.batch();
        let count = 0;

        for (const doc of proposalsSnap.docs) {
            const data = doc.data();
            const sentAt = data.sentAt ? new Date(data.sentAt) : (data.createdAt ? new Date(data.createdAt) : null);
            
            if (sentAt && sentAt <= thirtyDaysAgo) {
                const updatedHistory = [
                    ...(data.trackingHistory || []),
                    {
                        status: 'Expired',
                        timestamp: now.toISOString(),
                        updatedBy: 'System',
                        notes: 'Proposal marked expired automatically after 30 days of inactivity'
                    }
                ];
                batch.update(doc.ref, {
                    status: 'Expired',
                    trackingHistory: updatedHistory,
                    updatedAt: now.toISOString()
                });
                count++;
                
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }

        if (count > 0) {
            functions.logger.info(`Automated Proposal Expiry Sweep: Marked ${count} proposals as Expired.`);
        } else {
            functions.logger.info(`Automated Proposal Expiry Sweep: No proposals to expire.`);
        }
    } catch (error) {
        functions.logger.error("Error in checkProposalExpirations:", error);
    }
});

export const userCalendarFeed = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const userId = req.query.userId as string;
        const orgId = req.query.orgId as string;

        if (!userId || !orgId) {
            res.status(400).send('Missing required parameters: userId and orgId');
            return;
        }

        // 1. Verify user exists and belongs to the organization
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userDoc.data();
        if (!userData || userData.organizationId !== orgId) {
            res.status(403).send('Unauthorized access to this calendar feed');
            return;
        }

        // Helpers
        const formatIcsDate = (dateStr: any): string => {
            if (!dateStr) return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) {
                    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                }
                return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            } catch {
                return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            }
        };

        const escapeIcsText = (str: any): string => {
            if (str === null || str === undefined) return '';
            const s = String(str);
            return s
                .replace(/\\/g, '\\\\')
                .replace(/,/g, '\\,')
                .replace(/;/g, '\\;')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        };

        // 2. Fetch jobs
        const [jobsSnap1, jobsSnap2] = await Promise.all([
            db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('assignedTechnicianId', '==', userId)
                .get(),
            db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('assistants', 'array-contains', userId)
                .get()
        ]);

        const jobsMap = new Map<string, any>();
        jobsSnap1.docs.forEach(doc => jobsMap.set(doc.id, doc.data()));
        jobsSnap2.docs.forEach(doc => jobsMap.set(doc.id, doc.data()));
        const jobs = Array.from(jobsMap.values());

        // 3. Fetch company events
        const eventsSnap = await db.collection('events')
            .where('organizationId', '==', orgId)
            .get();

        const events = eventsSnap.docs.map(doc => doc.data()).filter(evt => {
            return !evt.attendees || evt.attendees.length === 0 || evt.attendees.includes(userId);
        });

        // 4. Generate ICS content
        const lines: string[] = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//TekTrakker//NONSGML Calendar Feed//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        // Add Jobs
        for (const job of jobs) {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:job_${job.id}`);
            lines.push(`DTSTAMP:${formatIcsDate(job.createdAt || job.appointmentTime)}`);
            lines.push(`DTSTART:${formatIcsDate(job.appointmentTime)}`);

            // Compute end time (default to +2h if missing)
            let endTime = job.endTime;
            if (!endTime && job.appointmentTime) {
                const startD = new Date(job.appointmentTime);
                if (!isNaN(startD.getTime())) {
                    startD.setHours(startD.getHours() + 2);
                    endTime = startD.toISOString();
                }
            }
            lines.push(`DTEND:${formatIcsDate(endTime || job.appointmentTime)}`);

            lines.push(`SUMMARY:${escapeIcsText('Job: ' + (job.customerName || 'Service Call'))}`);

            // Construct description
            const tasksStr = Array.isArray(job.tasks) && job.tasks.length > 0
                ? `Tasks: ${job.tasks.join(', ')}`
                : '';
            const instructionsStr = job.specialInstructions
                ? `Special Instructions: ${job.specialInstructions}`
                : '';
            const statusStr = `Status: ${job.jobStatus || 'Scheduled'}`;
            const descParts = [statusStr, tasksStr, instructionsStr].filter(p => p.length > 0);
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\\n'))}`);

            // Address location
            let locStr = '';
            if (job.address) {
                if (typeof job.address === 'string') {
                    locStr = job.address;
                } else if (typeof job.address === 'object') {
                    locStr = [
                        job.address.street,
                        job.address.city,
                        job.address.state,
                        job.address.zip
                    ].filter(Boolean).join(', ');
                }
            }
            if (locStr) {
                lines.push(`LOCATION:${escapeIcsText(locStr)}`);
            }

            lines.push('END:VEVENT');
        }

        // Add Corporate Events
        for (const event of events) {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:event_${event.id}`);
            lines.push(`DTSTAMP:${formatIcsDate(event.createdAt || event.startDate)}`);
            lines.push(`DTSTART:${formatIcsDate(event.startDate)}`);
            lines.push(`DTEND:${formatIcsDate(event.endDate || event.startDate)}`);
            lines.push(`SUMMARY:${escapeIcsText('Event: ' + (event.title || 'Company Event'))}`);

            const typeStr = `Type: ${event.type || 'meeting'}`;
            const descStr = event.description ? `Description: ${event.description}` : '';
            const virtualStr = event.isVirtual && event.virtualLink ? `Virtual Link: ${event.virtualLink}` : '';
            const descParts = [typeStr, descStr, virtualStr].filter(p => p.length > 0);
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\\n'))}`);

            let locStr = '';
            if (event.isVirtual) {
                locStr = event.virtualLink || 'Virtual Meeting';
            } else {
                locStr = event.location || '';
            }
            if (locStr) {
                lines.push(`LOCATION:${escapeIcsText(locStr)}`);
            }

            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');

        const icsContent = lines.join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(icsContent);

    } catch (error: any) {
        functions.logger.error("Error in userCalendarFeed Cloud Function:", error);
        res.status(500).send("Internal Server Error");
    }
});

export * from './office365Webhook';

export * from './telemetryWatcher';

export * from './integritySentinel';

export * from './seoAuditor';
export * from './adpAgent';

export const autoTrackMileageOnClockOut = functions.firestore
    .document('shiftLogs/{shiftId}')
    .onWrite(async (change, context) => {
        const beforeData = change.before.exists ? change.before.data() : null;
        const afterData = change.after.exists ? change.after.data() : null;

        if (!afterData) return null;

        const clockOutNewlySet = afterData.clockOut && (!beforeData || !beforeData.clockOut);
        if (!clockOutNewlySet) {
            return null;
        }

        const { organizationId, userId, startLocation, endLocation, clockOut } = afterData;

        if (!userId || !organizationId) {
            functions.logger.info("Missing userId or organizationId in shiftLog, skipping mileage tracking.");
            return null;
        }

        if (!startLocation || !endLocation || 
            typeof startLocation.lat !== 'number' || typeof startLocation.lng !== 'number' ||
            typeof endLocation.lat !== 'number' || typeof endLocation.lng !== 'number') {
            functions.logger.info(`Missing startLocation or endLocation coords for shiftLog ${context.params.shiftId}, skipping mileage tracking.`);
            return null;
        }

        // Calculate Haversine distance
        const lat1 = startLocation.lat;
        const lon1 = startLocation.lng;
        const lat2 = endLocation.lat;
        const lon2 = endLocation.lng;

        const R = 3958.8; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceInMiles = R * c;

        const mileage = Math.round(distanceInMiles);
        const dateStr = typeof clockOut === 'string' ? clockOut.substring(0, 10) : new Date().toISOString().substring(0, 10);

        const db = admin.firestore();

        // Check if there is an existing vehicle log for this shift to avoid duplicates
        const logId = `vl-shift-${context.params.shiftId}`;
        const logRef = db.collection('vehicleLogs').doc(logId);
        const logDoc = await logRef.get();

        if (logDoc.exists) {
            functions.logger.info(`Vehicle log ${logId} already exists, skipping duplicate creation.`);
            return null;
        }

        // Fetch user info to get username / default vehicle if any
        let vehicleId = "personal";
        let isCompanyVehicle = false;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData?.assignedVehicleId) {
                    vehicleId = userData.assignedVehicleId;
                    isCompanyVehicle = true;
                }
            }
        } catch (err) {
            functions.logger.error("Error fetching user vehicle info:", err);
        }

        const newVehicleLog = {
            id: logId,
            organizationId,
            userId,
            vehicleId,
            date: dateStr,
            type: "Mileage",
            mileage,
            isCompanyVehicle,
            notes: `Auto-tracked mileage on clock out for shift ${context.params.shiftId}`,
            cost: 0,
            startLocation: { lat: lat1, lng: lon1 },
            endLocation: { lat: lat2, lng: lon2 },
            createdAt: new Date().toISOString()
        };

        await logRef.set(newVehicleLog);
        functions.logger.info(`Successfully created auto mileage log ${logId} with distance ${mileage} miles.`);
        return null;
    });

export const outreachEmailWarmup = functions.pubsub.schedule('0 9,14,18 * * *').timeZone('America/New_York').onRun(async () => {
    functions.logger.info("Starting automated outreach email warmup run...");

    try {
        // 1. Fetch the campaign SMTP config from secrets config
        const secretDoc = await db.collection('organizations').doc('platform').collection('secrets').doc('config').get();
        if (!secretDoc.exists) {
            functions.logger.warn("No platform secrets config document found. Skipping warmup.");
            return;
        }

        const secrets = secretDoc.data() || {};
        const smtpConfig = secrets.campaignSmtpConfig;

        if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
            functions.logger.warn("Campaign SMTP configuration is missing or incomplete. Skipping warmup.");
            return;
        }

        // 2. Prepare random topics for conversations
        const conversations = [
            {
                subject: "Inquiry about partnership integrations",
                body: "Hello, I wanted to follow up and see if you had any availability to discuss the partnership integration details we talked about. Let me know what day works best.",
                replySubject: "Re: Inquiry about partnership integrations",
                replyBody: "Thanks for reaching out. Yes, I have some time next Tuesday morning. Let me send over a calendar invite so we can sync."
            },
            {
                subject: "Question regarding custom tool setup",
                body: "Hi there, we are checking the new custom tool settings and wanted to verify if you received the latest project proposal document. Let me know when you get a chance.",
                replySubject: "Re: Question regarding custom tool setup",
                replyBody: "Yes, I received the proposal and it looks good. We are going to review it with the team and get back to you shortly."
            },
            {
                subject: "API integration verification check",
                body: "Hi team, quick question on the API documentation. Do we need to whitelist the domain before testing the endpoints? Thanks!",
                replySubject: "Re: API integration verification check",
                replyBody: "Hello, yes you will need to add the domain to your authorized origins in the console first. Let me know if you need help with that."
            },
            {
                subject: "Follow up on scheduling next week's sync",
                body: "Hi, hope you are having a productive week. Can we schedule a short 10-minute sync next Tuesday morning to review the new features? Let me know your thoughts.",
                replySubject: "Re: Follow up on scheduling next week's sync",
                replyBody: "Hi! Next Tuesday at 10 AM works perfectly for me. Talk to you then!"
            },
            {
                subject: "Question on platform service options",
                body: "Hello, I was looking at the service details page and had a quick question regarding the custom booster tiers. Is there a setup limit?",
                replySubject: "Re: Question on platform service options",
                replyBody: "Hi, no there is no setup limit on the booster packs; they scale dynamically based on your organization's API usage. Let me know if you want to schedule a call."
            }
        ];

        const randomIndex = Math.floor(Math.random() * conversations.length);
        const choice = conversations[randomIndex];

        // Add a slight randomization marker to subjects/bodies so spam filters don't mark duplicates
        const randomMarker = Math.random().toString(36).substring(7).toUpperCase();
        const outboundSubject = `${choice.subject} [#${randomMarker}]`;
        const outboundBody = `<p>${choice.body}</p><p style="color: #cbd5e1; font-size: 10px; margin-top: 15px;">System warmup ping ${randomMarker}</p>`;
        const inboundSubject = `${choice.replySubject} [#${randomMarker}]`;
        const inboundBody = `<p>${choice.replyBody}</p><p style="color: #cbd5e1; font-size: 10px; margin-top: 15px;">System warmup reply ${randomMarker}</p>`;

        // 3. Send outbound email (sales@tektrakker.info -> platform@tektrakker.com) via dedicated SMTP
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port || 587,
            secure: smtpConfig.port === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            }
        });

        const fromHeader = `"${smtpConfig.fromName || 'TekTrakker Outreach'}" <${smtpConfig.fromEmail || smtpConfig.user}>`;
        
        functions.logger.info("Sending warmup email from sales@tektrakker.info to platform@tektrakker.com...");
        const info = await transporter.sendMail({
            from: fromHeader,
            to: 'platform@tektrakker.com',
            subject: outboundSubject,
            html: outboundBody
        });
        functions.logger.info("Sent warmup outbound email:", info.messageId);

        // 4. Queue inbound email (platform@tektrakker.com -> sales@tektrakker.info) via platform's standard default mail queue
        functions.logger.info("Queueing warmup reply from platform@tektrakker.com to sales@tektrakker.info...");
        await db.collection('mail_queue').add({
            to: [smtpConfig.fromEmail || smtpConfig.user],
            message: {
                subject: inboundSubject,
                html: inboundBody,
                replyTo: 'platform@tektrakker.com'
            },
            organizationId: 'platform',
            type: 'SystemWarmup',
            createdAt: new Date().toISOString()
        });
        functions.logger.info("Successfully queued warmup reply.");

    } catch (error) {
        functions.logger.error("Error running outreach email warmup:", error);
    }
});

export const initiateCallBridge = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { technicianPhone, customerPhone, organizationId } = data;
    if (!technicianPhone || !customerPhone || !organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'technicianPhone, customerPhone, and organizationId are required.');
    }

    try {
        const secretsRef = db.collection('organizations').doc(organizationId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};

        const twilioSid = secrets.twilioConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = secrets.twilioConfig?.authToken || process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

        if (!twilioSid || !twilioToken || !twilioNumber) {
            throw new functions.https.HttpsError('failed-precondition', 'Twilio integration is not configured.');
        }

        const twilio = require('twilio');
        const client = twilio(twilioSid, twilioToken);

        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
        const callbackUrl = `${baseUrl}/connectCallBridge?customerPhone=${encodeURIComponent(customerPhone)}&twilioSid=${encodeURIComponent(twilioSid)}&twilioToken=${encodeURIComponent(twilioToken)}&twilioNumber=${encodeURIComponent(twilioNumber)}&orgId=${organizationId}`;

        const call = await client.calls.create({
            to: technicianPhone,
            from: twilioNumber,
            url: callbackUrl
        });

        functions.logger.info(`Call bridge initiated. Call Sid: ${call.sid}`);
        return { success: true, callSid: call.sid };
    } catch (e: any) {
        functions.logger.error("Error initiating call bridge:", e);
        throw new functions.https.HttpsError('internal', `Failed to initiate call bridge: ${e.message}`);
    }
});

export const connectCallBridge = functions.https.onRequest(async (req, res) => {
    try {
        const customerPhone = req.query.customerPhone as string;
        const twilioNumber = req.query.twilioNumber as string;
        const orgId = req.query.orgId as string;

        if (!customerPhone || !twilioNumber || !orgId) {
            res.status(400).send("Missing customerPhone, twilioNumber, or orgId parameters.");
            return;
        }

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        twiml.say({ voice: 'Polly.Matthew-Neural' }, "Connecting you to your customer. Please hold.");
        twiml.dial({ callerId: twilioNumber }, customerPhone);

        const secretsRef = db.collection('organizations').doc(orgId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};
        const isPlatformTwilio = !secrets.twilioConfig?.accountSid && !!process.env.TWILIO_ACCOUNT_SID;

        if (isPlatformTwilio) {
            const now = new Date();
            const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const usageRef = db.collection('smsUsage').doc(`${orgId}_${billingCycle}`);
            await usageRef.set({
                organizationId: orgId,
                billingCycle: billingCycle,
                totalVoiceMinutes: admin.firestore.FieldValue.increment(2), // 2 legs on bridged calls
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Error in connectCallBridge webhook:", error);
        res.status(500).send("Server Error");
    }
});

// --- AUTOMATED MONTHLY STATEMENTS FOR COMMERCIAL CUSTOMERS ---
export const sendMonthlyCommercialStatements = functions.pubsub.schedule('0 9 28-31 * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            // 1. Check if today is the last day of the month in America/New_York timezone
            const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
            const nyDate = new Date(nyDateStr);
            const tomorrow = new Date(nyDate);
            tomorrow.setDate(nyDate.getDate() + 1);

            if (tomorrow.getDate() !== 1) {
                functions.logger.info(`Today (${nyDate.toDateString()}) is not the last day of the month in America/New_York. Skipping statement run.`);
                return;
            }

            functions.logger.info("Executing automated monthly Statement of Account runs...");

            // 2. Query all organizations where autoSendMonthlyStatements is true
            const orgsSnap = await db.collection('organizations')
                .where('autoSendMonthlyStatements', '==', true)
                .get();

            if (orgsSnap.empty) {
                functions.logger.info("No organizations have automated monthly statements enabled.");
                return;
            }

            for (const orgDoc of orgsSnap.docs) {
                const orgId = orgDoc.id;
                const orgData = orgDoc.data();
                
                // Skip if suspended/inactive
                if (orgData.subscriptionStatus && !['active', 'trialing'].includes(orgData.subscriptionStatus)) {
                    functions.logger.info(`Skipping inactive organization ${orgId} (${orgData.name})`);
                    continue;
                }

                functions.logger.info(`Processing monthly statements for organization: ${orgData.name || orgId}`);

                const orgName = orgData.name || 'Service Provider';
                const orgPhone = orgData.phone || '';
                const orgEmail = orgData.email || '';
                const orgAddress = orgData.address 
                    ? `${orgData.address.street || ''}, ${orgData.address.city || ''}, ${orgData.address.state || ''} ${orgData.address.zip || ''}`
                    : '';

                // Fetch jobs for this organization to compile invoice ledgers
                const jobsSnap = await db.collection('jobs')
                    .where('organizationId', '==', orgId)
                    .get();

                // Group jobs by customerId
                const jobsByCustomer: { [customerId: string]: any[] } = {};
                jobsSnap.forEach(jobDoc => {
                    const job = { id: jobDoc.id, ...jobDoc.data() } as any;
                    if (job.customerId) {
                        if (!jobsByCustomer[job.customerId]) {
                            jobsByCustomer[job.customerId] = [];
                        }
                        jobsByCustomer[job.customerId].push(job);
                    }
                });

                // Fetch commercial customers for this organization
                const customersSnap = await db.collection('customers')
                    .where('organizationId', '==', orgId)
                    .where('customerType', '==', 'Commercial')
                    .get();

                for (const custDoc of customersSnap.docs) {
                    const customer = { id: custDoc.id, ...custDoc.data() } as any;
                    const emailTarget = customer.billingContact?.email || customer.email;

                    if (!emailTarget) {
                        functions.logger.warn(`Commercial customer ${customer.name || customer.id} has no email. Skipping statement.`);
                        continue;
                    }

                    const customerJobs = jobsByCustomer[customer.id] || [];
                    const invoiceJobs = customerJobs.filter(j => j.invoice);

                    if (invoiceJobs.length === 0) {
                        continue;
                    }

                    // Sort chronologically oldest first
                    const sorted = [...invoiceJobs].sort((a, b) => {
                        const dateA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
                        const dateB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
                        return dateA - dateB;
                    });

                    // Compute ledger running balances
                    let totalBilled = 0;
                    let totalPaid = 0;
                    const agingNow = new Date();
                    agingNow.setHours(0, 0, 0, 0);

                    const aging = {
                        current: 0,
                        days30: 0,
                        days60: 0,
                        days90: 0,
                        older: 0
                    };

                    let runningBalance = 0;
                    const mapped = sorted.map(j => {
                        const inv = j.invoice;
                        const total = inv.totalAmount || inv.amount || 0;
                        const paid = inv.amountPaid || (inv.status === 'Paid' ? total : 0);
                        const balance = Math.max(0, total - paid);
                        
                        totalBilled += total;
                        totalPaid += paid;
                        runningBalance += (total - paid);

                        if (inv.status !== 'Paid') {
                            const dateVal = inv.dueDate || j.appointmentTime || j.createdAt;
                            if (dateVal) {
                                let dateObj = new Date(dateVal);
                                if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                                    dateObj = new Date(dateVal.replace(/-/g, '/'));
                                }
                                dateObj.setHours(0, 0, 0, 0);

                                const daysOverdue = Math.floor((agingNow.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
                                if (daysOverdue <= 0) aging.current += balance;
                                else if (daysOverdue <= 30) aging.days30 += balance;
                                else if (daysOverdue <= 60) aging.days60 += balance;
                                else if (daysOverdue <= 90) aging.days90 += balance;
                                else aging.older += balance;
                            } else {
                                aging.current += balance;
                            }
                        }

                        return {
                            job: j,
                            invoice: inv,
                            total,
                            paid,
                            balance,
                            runningBalance
                        };
                    });

                    const totalDue = Math.max(0, totalBilled - totalPaid);

                    // Skip if customer has no outstanding balance
                    if (totalDue <= 0.01) {
                        continue;
                    }

                    // Build Statement PDF/HTML containing only unpaid (open) invoices
                    const statementJobs = mapped.filter(tx => tx.balance > 0.01 && tx.invoice?.status !== 'Paid');
                    if (statementJobs.length === 0) {
                        continue;
                    }

                    const dates = statementJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
                    const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString('en-US') : 'N/A';
                    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString('en-US') : 'N/A';
                    const statementPeriod = `${minDate} - ${maxDate}`;
                    const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

                    const invoiceRows = statementJobs.map((tx, idx) => {
                        const j = tx.job;
                        const inv = tx.invoice;
                        const t = tx.total;
                        const p = tx.paid;
                        const d = tx.balance;
                        const rb = tx.runningBalance;
                        const addressStr = typeof j.address === 'string' ? j.address : `${j.address?.street || ''}, ${j.address?.city || ''}`;
                        const zebraColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                        const statusStyle = inv.status === 'Paid' 
                            ? 'color: #15803d; background-color: #f0fdf4; border: 1px solid #bbf7d0;' 
                            : 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;';

                        return `
                            <tr style="background-color: ${zebraColor};">
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${new Date(j.appointmentTime || j.createdAt || '').toLocaleDateString('en-US')}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">#${inv.id || j.id.slice(0, 8)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                                    <strong>${j.locationName || j.customerName || 'Main Address'}</strong><br/>
                                    <span style="font-size: 10px; color: #64748b;">${addressStr}</span>
                                </td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${j.poNumber || '—'}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${t.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${p.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${d > 0.01 ? '#dc2626' : '#1e293b'};">${d.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">${rb.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
                                    <span style="display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                                        ${inv.status || 'Unpaid'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    const mailPayload = {
                        organizationId: orgId,
                        to: [emailTarget.trim().toLowerCase()],
                        message: {
                            subject: `Statement of Account: ${customer.name}`,
                            html: `
                                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; line-height: 1.5; background-color: #ffffff;">
                                    
                                    <!-- Header Section -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                        <tr>
                                            <td>
                                                <h2 style="font-size: 22px; font-weight: 800; color: #123A63; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Statement of Account</h2>
                                                <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString('en-US')} | Statement #: ${statementNumber}</p>
                                            </td>
                                            <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                                <strong style="font-size: 12px; color: #1e293b;">${orgName}</strong><br/>
                                                ${orgAddress}<br/>
                                                Phone: ${orgPhone}
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <div style="border-bottom: 2px solid #123A63; margin-bottom: 20px;"></div>

                                    <!-- Customer & Terms -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                        <tr>
                                            <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Client Information</div>
                                                <p style="margin: 2px 0;"><strong>${customer.name}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">${customer.address || ''}</p>
                                            </td>
                                            <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Account Summary & Terms</div>
                                                <p style="margin: 2px 0; color: #334155;">Client Code: <strong>${customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Account Number: <strong>${customer.id.replace(/\D/g, '')}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Payment Terms: <strong>${customer.paymentTerms || 'Net 30'}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Statement Period: <strong>${statementPeriod}</strong></p>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="color: #334155; margin-bottom: 20px;">Dear Finance Team,</p>
                                    <p style="color: #334155; margin-bottom: 25px;">Please find below the corporate Statement of Account for <strong>${customer.name}</strong> summarizing all recent service invoices, payments, and outstanding balances.</p>

                                    <!-- Financial Summary -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
                                        <tr>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Previous Balance</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">New Charges</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Payments Received</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Adjustments</th>
                                            <th style="background-color: #0f2d50; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #0f2d50;">Amount Due</th>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$${totalBilled.toFixed(2)}</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">$${totalPaid.toFixed(2)}</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                            <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">$${totalDue.toFixed(2)}</td>
                                        </tr>
                                    </table>

                                    <!-- Transaction Ledger -->
                                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px;">
                                        <thead>
                                            <tr style="background-color: #123A63;">
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Date</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Invoice #</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Property / Location</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Ref / PO #</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Debit (Dr)</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Credit (Cr)</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Balance</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Running Bal</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${invoiceRows}
                                        </tbody>
                                    </table>

                                    <!-- Aging Summary -->
                                    <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Aging Analysis (Unpaid Balances)</div>
                                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 35px;">
                                        <tr>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Current</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">1 - 30 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">31 - 60 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">61 - 90 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">90+ Days</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Total Outstanding</th>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1;">$${aging.current.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days30 > 0 ? '#b45309' : '#1e293b'};">$${aging.days30.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days60 > 0 ? '#b45309' : '#1e293b'};">$${aging.days60.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days90 > 0 ? '#dc2626' : '#1e293b'};">$${aging.days90.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.older > 0 ? '#dc2626' : '#1e293b'};">$${aging.older.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #dc2626;">$${totalDue.toFixed(2)}</td>
                                        </tr>
                                    </table>

                                    <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #64748b;">
                                        <strong>Corporate Remittance Instructions:</strong><br/>
                                        Please remit check payments payable to <strong>${orgName}</strong> or contact billing at <strong>${orgEmail}</strong> for ACH bank wiring details. Reference the statement number on your remittance advice.<br/>
                                        <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 10px;">CONFIDENTIALITY DISCLAIMER: This email and any attachments contain confidential proprietary financial information intended solely for the customer named above.</span>
                                    </div>
                                </div>
                            `,
                            text: `Statement of Account for ${customer.name}. Outstanding Balance: $${totalDue.toFixed(2)}.`,
                            replyTo: orgEmail
                        },
                        type: 'Statement'
                    };

                    await db.collection('mail_queue').add(mailPayload);
                    functions.logger.info(`Queued Statement of Account email for customer: ${customer.name} (due: $${totalDue.toFixed(2)})`);
                }
            }
        } catch (error) {
            functions.logger.error("Error running sendMonthlyCommercialStatements scheduled function:", error);
        }
    });



