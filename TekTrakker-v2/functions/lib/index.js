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
exports.createUserAuth = exports.generateMarketingEmail = exports.callGeminiAI = exports.callLandingChatbot = exports.generateReviewResponse = exports.linkCustomerOnUserCreate = exports.deleteAuthUser = exports.sendSms = exports.getPlatformMetrics = exports.setUserRole = exports.checkUserInvite = exports.handlePlatformInvoiceCommission = exports.GEMINI_PRO_MODEL = exports.GEMINI_FLASH_MODEL = exports.trackEmailUsage = exports.trackSmsUsage = exports.trackTelephonyUsage = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const billing_budgets_1 = require("@google-cloud/billing-budgets");
const monitoring_1 = require("@google-cloud/monitoring");
const billing_1 = require("@google-cloud/billing");
const generative_ai_1 = require("@google/generative-ai");
// Ensure global.fetch is patched to automatically sanitize role: "function" -> role: "user" for Google Generative AI REST requests
const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = function (url, options) {
        if (options && typeof options.body === 'string' && options.body.includes('"role":"function"')) {
            options = Object.assign({}, options, {
                body: options.body.replace(/"role"\s*:\s*"function"/g, '"role":"user"')
            });
        }
        return originalFetch.call(this, url, options);
    };
}
const aiAgent_1 = require("./aiAgent");
const usageTracking_1 = require("./usageTracking");
if (admin.apps.length === 0) {
    try {
        admin.initializeApp();
    }
    catch { /* ignore */ }
}
// ==========================================
// CORE PLATFORM EXPORTS & RE-EXPORTS
// ==========================================
__exportStar(require("./payments"), exports);
__exportStar(require("./kortPayments"), exports);
__exportStar(require("./notifications"), exports);
__exportStar(require("./dataCascade"), exports);
__exportStar(require("./weeklyReferenceAudit"), exports);
__exportStar(require("./aiAgent"), exports);
var usageTracking_2 = require("./usageTracking");
Object.defineProperty(exports, "trackTelephonyUsage", { enumerable: true, get: function () { return usageTracking_2.trackTelephonyUsage; } });
Object.defineProperty(exports, "trackSmsUsage", { enumerable: true, get: function () { return usageTracking_2.trackSmsUsage; } });
Object.defineProperty(exports, "trackEmailUsage", { enumerable: true, get: function () { return usageTracking_2.trackEmailUsage; } });
__exportStar(require("./bidding"), exports);
__exportStar(require("./telephony"), exports);
__exportStar(require("./webhooks"), exports);
__exportStar(require("./integrations"), exports);
__exportStar(require("./crons"), exports);
__exportStar(require("./widgets"), exports);
__exportStar(require("./promotions"), exports);
__exportStar(require("./quickbooks"), exports);
__exportStar(require("./gustoAgent"), exports);
__exportStar(require("./bofaAgent"), exports);
__exportStar(require("./googleBusiness"), exports);
__exportStar(require("./revenuecat"), exports);
__exportStar(require("./rfpAgent"), exports);
__exportStar(require("./tiktok"), exports);
__exportStar(require("./marketplaceIntegrations"), exports);
__exportStar(require("./linkedin"), exports);
__exportStar(require("./ringCentral"), exports);
__exportStar(require("./govContracts"), exports);
__exportStar(require("./microsoftAuth"), exports);
__exportStar(require("./office365Webhook"), exports);
__exportStar(require("./telemetryWatcher"), exports);
__exportStar(require("./integritySentinel"), exports);
__exportStar(require("./seoAuditor"), exports);
__exportStar(require("./adpAgent"), exports);
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
catch {
    // Ignore initialization errors if already initialized
}
const auth = admin.auth();
const db = admin.firestore();
let _billingBudgetsClient = null;
const getBillingBudgetsClient = () => {
    if (!_billingBudgetsClient)
        _billingBudgetsClient = new billing_budgets_1.BudgetServiceClient();
    return _billingBudgetsClient;
};
let _monitoringClient = null;
const getMonitoringClient = () => {
    if (!_monitoringClient)
        _monitoringClient = new monitoring_1.MetricServiceClient();
    return _monitoringClient;
};
let _billingClient = null;
const getBillingClient = () => {
    if (!_billingClient)
        _billingClient = new billing_1.CloudBillingClient();
    return _billingClient;
};
const DEFAULT_COMMISSION_RULES = {
    baseRate: 0.25,
    acceleratorRate: 0.30,
    annualQuota: 500000,
    renewalRate: 0.05,
    year2Rate: 0.05,
    lifetimeRate: 0.03,
    quarterlyMinDeals: 3,
    quarterlyMinVolume: 10000,
    inactivityCliffDays: 180,
    abandonmentDays: 60,
    annualPrepaidKickerRate: 0.05,
    monthlyMrrAccelerators: [
        { minMrr: 0, maxMrr: 2499.99, rate: 0.25 },
        { minMrr: 2500, maxMrr: 4999.99, rate: 0.275 },
        { minMrr: 5000, rate: 0.30 }
    ],
    monthlyMrrBonuses: [
        { mrr: 2500, bonus: 250 },
        { mrr: 5000, bonus: 750 },
        { mrr: 7500, bonus: 1500 },
        { mrr: 10000, bonus: 2500 },
        { mrr: 15000, bonus: 4500 },
        { mrr: 20000, bonus: 7500 }
    ],
    annualArrBonuses: [
        { arr: 30000, bonus: 5000 },
        { arr: 60000, bonus: 12000 },
        { arr: 100000, bonus: 25000 },
        { arr: 150000, bonus: 40000 }
    ],
    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
};
exports.GEMINI_FLASH_MODEL = "gemini-3.8-flash";
exports.GEMINI_PRO_MODEL = "gemini-3.8-flash";
// --- NEW COMMISSION LOGIC ---
exports.handlePlatformInvoiceCommission = functions.firestore
    .document('jobs/{jobId}')
    .onWrite(async (change, context) => {
    const jobId = context.params.jobId;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    // If document deleted, do nothing
    if (!after)
        return null;
    // Only process platform billing jobs (subscription invoices)
    if (after.organizationId !== 'platform')
        return null;
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
        const platformSettings = settingsDocs[0].exists ? settingsDocs[0].data() : undefined;
        const rules = settingsDocs[1].exists ? settingsDocs[1].data() : DEFAULT_COMMISSION_RULES;
        if (!platformSettings) {
            functions.logger.error("Platform settings not found. Cannot calculate commission.");
            return null;
        }
        // Fetch rep's custom rules if configured
        const repDoc = await db.collection('users').doc(salesRepId).get();
        const repData = repDoc.exists ? repDoc.data() : null;
        if (repData?.salesRepStatus === 'Forfeited' || repData?.salesRepStatus === 'Inactive') {
            functions.logger.info(`Sales rep ${salesRepId} is Forfeited/Inactive. Initial invoice commission bypassed.`);
            return null;
        }
        // Track latest sales activity to keep status fresh
        if (repDoc.exists) {
            repDoc.ref.update({ lastSalesActivityAt: new Date().toISOString() }).catch(() => { });
        }
        const effectiveRules = repData?.customCommissionSettings || rules;
        // Calculate commissionable value based STRICTLY on subscriptions and add-ons (metered usage excluded)
        let commissionableSaleValue = 0;
        const items = after.invoice?.items || [];
        if (items.length > 0) {
            for (const item of items) {
                const desc = (item.description || item.name || '').toLowerCase();
                // Metered usage is strictly non-commissionable
                const isMetered = desc.includes('storage overage') || desc.includes('token overage') || desc.includes('sms usage') || desc.includes('voice usage') || desc.includes('metered');
                if (!isMetered) {
                    const amt = Number(item.total !== undefined ? item.total : (item.amount || ((item.unitPrice || 0) * (item.quantity || 1))));
                    commissionableSaleValue += isNaN(amt) ? 0 : amt;
                }
            }
        }
        else if (after.invoice?.amount || after.invoice?.totalAmount) {
            commissionableSaleValue = Number(after.invoice.amount || after.invoice.totalAmount || 0);
        }
        if (commissionableSaleValue <= 0) {
            functions.logger.info(`Job ${jobId} has no commissionable subscription/add-on value. No commission generated.`);
            return null;
        }
        const saleValue = Number(commissionableSaleValue.toFixed(2));
        // Determine if sale is an upfront annual subscription
        const isAnnual = items.some((item) => {
            const desc = (item.description || item.name || '').toLowerCase();
            return desc.includes('annual') || desc.includes('yearly') || desc.includes('/yr');
        }) || after.invoice?.billingCycle === 'annual';
        const saleMrr = isAnnual ? (saleValue / 12) : saleValue;
        // Calculate rep's performance and accelerators
        const repCommsSnap = await db.collection('platformCommissions')
            .where('repId', '==', salesRepId)
            .get();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        // Calculate current month's collected new MRR
        const existingMonthMrr = repCommsSnap.docs.reduce((sum, doc) => {
            const data = doc.data();
            if (data.customerPaymentStatus !== 'Paid' && data.status !== 'Paid')
                return sum;
            const earnedDate = new Date(data.dateEarned || data.createdAt || 0);
            if (earnedDate.getFullYear() === currentYear && earnedDate.getMonth() === currentMonth) {
                const mrr = data.mrrValue !== undefined ? data.mrrValue : (data.isAnnual ? (data.baseAmount / 12) : data.baseAmount);
                return sum + (mrr || 0);
            }
            return sum;
        }, 0);
        const totalMonthMrr = existingMonthMrr + saleMrr;
        // Only count YTD commissions where the customer has actually paid
        const totalRevenueYTD = repCommsSnap.docs.reduce((sum, doc) => {
            const data = doc.data();
            if (data.customerPaymentStatus === 'Paid' || data.status === 'Paid') {
                return sum + (data.baseAmount || 0);
            }
            return sum;
        }, 0);
        // Determine base/accelerated rate
        let monthlyRate = effectiveRules.baseRate ?? 0.25;
        if (effectiveRules.monthlyMrrAccelerators && effectiveRules.monthlyMrrAccelerators.length > 0) {
            const sortedTiers = [...effectiveRules.monthlyMrrAccelerators].sort((a, b) => b.minMrr - a.minMrr);
            const matchedTier = sortedTiers.find(t => totalMonthMrr >= t.minMrr);
            if (matchedTier) {
                monthlyRate = matchedTier.rate;
            }
        }
        else if (totalRevenueYTD >= (effectiveRules.annualQuota || 500000)) {
            monthlyRate = effectiveRules.acceleratorRate ?? 0.30;
        }
        // Apply +5% Annual Subscription Prepayment Kicker if applicable
        const annualKicker = isAnnual ? (effectiveRules.annualPrepaidKickerRate ?? 0.05) : 0;
        const finalRate = monthlyRate + annualKicker;
        const newCommission = {
            repId: salesRepId,
            organizationId: customerId,
            organizationName: after.customerName || 'New Organization',
            jobId: jobId,
            invoiceId: jobId,
            amount: Number((saleValue * finalRate).toFixed(2)),
            status: 'Pending',
            customerPaymentStatus: invoiceStatus === 'Paid' ? 'Paid' : 'Unpaid',
            dateEarned: new Date().toISOString(),
            baseAmount: saleValue,
            mrrValue: Number(saleMrr.toFixed(2)),
            rateUsed: finalRate,
            baseRateUsed: monthlyRate,
            isAnnual: isAnnual,
            kickerRateUsed: annualKicker,
            notes: `Subscription commission: ${(finalRate * 100).toFixed(1)}% (${(monthlyRate * 100).toFixed(1)}% ${totalMonthMrr >= 2000 ? 'accelerator' : 'base'}${isAnnual ? ' + 5% annual prepayment kicker' : ''}, metered usage strictly excluded)`
        };
        functions.logger.info(`Creating platform commission for sales rep ${salesRepId} on invoice ${jobId}: $${newCommission.amount} on base $${saleValue} (rate: ${(finalRate * 100).toFixed(1)}%)`);
        return db.collection('platformCommissions').add(newCommission);
    }
    else {
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
exports.checkUserInvite = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        functions.logger.error("Error checking user invite:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
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
    catch {
        return { count: 0, error: "Auth access limited" };
    }
}
function calculateTokenCost(total, prompt, candidates) {
    const splitTotal = prompt + candidates;
    const legacyTokens = Math.max(0, total - splitTotal);
    return (prompt / 1000000) * 0.075 + (candidates / 1000000) * 0.30 + (legacyTokens / 1000000) * 0.15;
}
async function getBillingData(projectId, billingAccountId) {
    const billingAccountName = `billingAccounts/${billingAccountId}`;
    try {
        const [projectBillingInfo] = await getBillingClient().getProjectBillingInfo({ name: `projects/${projectId}` });
        if (!projectBillingInfo.billingEnabled) {
            return { costAmount: 0, budgetAmount: "0 (Billing Disabled)" };
        }
    }
    catch (e) {
        functions.logger.warn(`Could not check billing info for ${projectId}:`, e);
    }
    let budgetAmount = 0;
    try {
        const [budgets] = await getBillingBudgetsClient().listBudgets({ parent: billingAccountName });
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
        const [timeSeries] = await getMonitoringClient().listTimeSeries({
            name: `projects/${projectId}`,
            filter: 'metric.type = "billing.googleapis.com/cost"',
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(now.getTime() / 1000) }
            },
            aggregation: {
                alignmentPeriod: { seconds: 86400 },
                perSeriesAligner: 'ALIGN_SUM'
            }
        });
        if (timeSeries && timeSeries.length > 0) {
            const points = timeSeries[0].points || [];
            costAmount = points.reduce((sum, point) => sum + (point.value?.doubleValue || 0), 0);
        }
    }
    catch (e) {
        functions.logger.warn(`Could not fetch cost metric for ${projectId}:`, e);
    }
    let aiCost = 0;
    if (projectId === process.env.APP_PROJECT_ID) {
        try {
            const snap = await admin.firestore().collection('aiUsage')
                .select('totalTokensUsed', 'promptTokensUsed', 'candidatesTokensUsed', 'virtualWorkerTokensUsed', 'virtualWorkerPromptTokensUsed', 'virtualWorkerCandidatesTokensUsed')
                .get();
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
            const [timeSeries] = await getMonitoringClient().listTimeSeries({
                name: `projects/${projectId}`,
                filter: `metric.type = "${metricType}"`,
                interval: { startTime: { seconds: Math.floor(startTime.getTime() / 1000) }, endTime: { seconds: Math.floor(now / 1000) } },
                aggregation: { alignmentPeriod: { seconds: 86400 }, perSeriesAligner: 'ALIGN_SUM' }
            });
            usageMetrics[metricType] = (timeSeries[0]?.points || []).reduce((sum, point) => sum + Number(point.value?.int64Value ?? point.value?.doubleValue ?? 0), 0);
        }
        catch {
            usageMetrics[metricType] = 0;
        }
    }
    return usageMetrics;
}
// --- MESSAGING ---
exports.sendSms = functions.firestore.document('messages/{msgId}').onCreate(async (snap) => {
    const msg = snap.data();
    // Guard against inbound SMS (which already arrived) or missing targets
    if (!msg || msg.type !== 'sms' || (!msg.receiverId && !msg.to) || msg.direction === 'inbound' || msg.senderPhone)
        return;
    try {
        const orgId = msg.organizationId;
        const secretDoc = orgId ? await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get() : null;
        const secrets = secretDoc?.data() || {};
        let customer = null;
        if (msg.receiverId) {
            const customerDoc = await db.collection('customers').doc(msg.receiverId).get();
            if (customerDoc.exists) {
                customer = customerDoc.data();
            }
        }
        const toPhone = msg.to || customer?.phone || (typeof msg.receiverId === 'string' && msg.receiverId.replace(/[^\d+]/g, '').length >= 10 ? msg.receiverId : null);
        const textContent = msg.content || msg.body || '';
        if (!toPhone) {
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: 'Invalid Customer Phone' });
            return;
        }
        // --- RingCentral Routing Strategy ---
        let fromNumber = '';
        if (secrets.rcPrimarySms === true || secrets.rcPrimarySms === 'true') {
            // Find sender phone number matching senderId mapping
            if (secrets.rcMappings && Array.isArray(secrets.rcMappings)) {
                const match = secrets.rcMappings.find((m) => m.assignedUserId === msg.senderId || m.forwardToUserId === msg.senderId);
                if (match && match.phoneNumber) {
                    fromNumber = match.phoneNumber;
                }
                else if (secrets.rcMappings.length > 0 && secrets.rcMappings[0].phoneNumber) {
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
            const { access_token } = await tokenResponse.json();
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
                    text: textContent
                })
            });
            if (smsResponse.ok) {
                await snap.ref.update({ deliveryStatus: 'sent' });
            }
            else {
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
            if (msg.receiverId && customer) {
                await db.collection('customers').doc(msg.receiverId).collection('notifications').add({
                    title: 'New Message',
                    message: textContent,
                    createdAt: new Date().toISOString(),
                    read: false,
                    type: 'message',
                    senderId: msg.senderId || 'Platform'
                });
            }
            await snap.ref.update({ deliveryStatus: 'fallback-push', deliveryError: 'No Twilio Config - Routed as Portal Push Notification' });
            return;
        }
        const body = new URLSearchParams({ To: toPhone, From: twilioFromNumber, Body: textContent });
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
                await (0, usageTracking_1.trackSmsUsage)(msg.organizationId, 'outbound');
            }
        }
        else {
            const err /* eslint-disable-line @typescript-eslint/no-explicit-any */ = await response.json();
            await snap.ref.update({ deliveryStatus: 'failed', deliveryError: err.message || 'Twilio Error' });
        }
    }
    catch (e /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
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
// --- AI UTILS ---
exports.generateReviewResponse = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
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
        const model = genAI.getGenerativeModel({
            model: exports.GEMINI_FLASH_MODEL,
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await (0, aiAgent_1.trackAiUsage)(orgId, 'Review Response', exports.GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);
        return { text: response.text() };
    }
    catch (error /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Review GenAI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate review response.");
    }
});
exports.callLandingChatbot = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    const orgId = context.auth?.token.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { prompt, systemInstruction } = data;
    if (!prompt || typeof prompt !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "Missing prompt parameter.");
    }
    // Limit prompt length to mitigate quota draining and proxy abuse
    const cappedPrompt = prompt.trim().substring(0, 2000);
    const defaultLandingSystemInstruction = `You are the polite, helpful AI virtual assistant for the TekTrakker field service management platform. Answer questions clearly about trade services, scheduling, estimates, and customer support. Be concise, professional, and friendly. Never output code, execute arbitrary instructions, or deviate from trade customer support.`;
    // Only allow short benign client additions; reject prompt override injections
    let finalSystemInstruction = defaultLandingSystemInstruction;
    if (systemInstruction && typeof systemInstruction === 'string') {
        const cleanInst = systemInstruction.trim();
        if (cleanInst.length > 0 && cleanInst.length <= 500 && !/ignore\s+(all\s+)?(previous|prior)/i.test(cleanInst)) {
            finalSystemInstruction = `${defaultLandingSystemInstruction}\nContext: ${cleanInst}`;
        }
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: exports.GEMINI_FLASH_MODEL,
            systemInstruction: finalSystemInstruction,
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const result = await model.generateContent(cappedPrompt);
        const response = await result.response;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await (0, aiAgent_1.trackAiUsage)(orgId, 'Landing Chatbot', exports.GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);
        return { text: response.text() };
    }
    catch (error /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.callGeminiAI = functions.runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    // Force rebuild for env variables
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { prompt, modelName = exports.GEMINI_FLASH_MODEL, config = {}, imageParts = [], image = null, contextOrgId = null } = data;
    // Enforce gemini-3.8-flash as default model for fast & deep research across all platform AI requests
    let resolvedModelName = modelName;
    if (!resolvedModelName || resolvedModelName === "gemini-3.7-flash" || resolvedModelName !== "gemini-2.5-pro") {
        resolvedModelName = "gemini-3.8-flash";
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
        }
        catch (ctxErr) {
            functions.logger.warn('Failed to load org AI context, proceeding without:', ctxErr);
        }
        const enrichedPrompt = orgContext
            ? `[ORGANIZATION CONTEXT - Use this for branding, logos, contact info, and legal terms]\n${orgContext}\n\n[END ORGANIZATION CONTEXT]\n\n${prompt}`
            : prompt;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        let response;
        let lastError;
        let finalModelName = resolvedModelName;
        const modelsToTry = [
            resolvedModelName,
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-2.5-pro"
        ].filter((val, idx, self) => self.indexOf(val) === idx);
        for (const modelToTry of modelsToTry) {
            try {
                functions.logger.info(`Attempting generation with model: ${modelToTry}`);
                const mergedConfig = {
                    ...config,
                    generationConfig: {
                        thinkingConfig: { thinkingBudget: 0 },
                        ...(config?.generationConfig || {})
                    }
                };
                const model = genAI.getGenerativeModel({ model: modelToTry, ...mergedConfig });
                const parts = [{ text: enrichedPrompt }];
                if (imageParts && imageParts.length > 0) {
                    imageParts.forEach((part /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                        let b64 = part?.base64Data || part?.data || (typeof part === 'string' ? part : '');
                        let mime = part?.mimeType || 'image/jpeg';
                        if (typeof part === 'string' && part.startsWith('data:')) {
                            const m = part.match(/^data:(image\/[a-zA-Z0-9.+VP8-]+);base64,(.+)$/);
                            if (m) {
                                mime = m[1];
                                b64 = m[2];
                            }
                        }
                        b64 = typeof b64 === 'string' ? b64.replace(/^data:[^;]+;base64,/, '') : '';
                        if (b64) {
                            parts.push({
                                inlineData: {
                                    data: b64,
                                    mimeType: mime
                                }
                            });
                        }
                    });
                }
                else if (image) {
                    let b64 = typeof image === 'string' ? image : (image.base64Data || image.data || '');
                    let mime = typeof image === 'object' ? (image.mimeType || 'image/jpeg') : 'image/jpeg';
                    if (typeof image === 'string' && image.startsWith('data:')) {
                        const m = image.match(/^data:(image\/[a-zA-Z0-9.+VP8-]+);base64,(.+)$/);
                        if (m) {
                            mime = m[1];
                            b64 = m[2];
                        }
                    }
                    b64 = typeof b64 === 'string' ? b64.replace(/^data:[^;]+;base64,/, '') : '';
                    if (b64) {
                        parts.push({
                            inlineData: {
                                data: b64,
                                mimeType: mime
                            }
                        });
                    }
                }
                const result = await model.generateContent(parts);
                response = await result.response;
                finalModelName = modelToTry;
                break;
            }
            catch (err) {
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
        await (0, aiAgent_1.trackAiUsage)(orgId, 'General AI Content', resolvedModelName, tokens, promptTokens, candidatesTokens);
        return { text: response.text() };
    }
    catch (error /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Gemini AI Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate content.");
    }
});
exports.generateMarketingEmail = functions.runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 300 }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';
    const apiKey = await (0, aiAgent_1.getGeminiApiKey)(orgId);
    const { prompt } = data;
    if (!prompt)
        throw new functions.https.HttpsError("invalid-argument", "Prompt is required.");
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: exports.GEMINI_FLASH_MODEL,
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const systemPrompt = "You are an expert digital marketing and SEO copywriter for field service trade contractors. Write clean, semantic HTML format (using <h2>, <p>, <ul>, <li>, <strong>) without markdown code fences.";
        const result = await model.generateContent([
            { text: `${systemPrompt}\n\nTask: ${prompt}` }
        ]);
        const response = await result.response;
        let html = response.text() || '';
        html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await (0, aiAgent_1.trackAiUsage)(orgId, 'Marketing Content Generator', exports.GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);
        return { html };
    }
    catch (error) {
        functions.logger.error("generateMarketingEmail Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate marketing content.");
    }
});
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
    catch (error /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Admin Auth provisioning failed:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});
__exportStar(require("./widgets"), exports);
__exportStar(require("./promotions"), exports);
__exportStar(require("./quickbooks"), exports);
// --- EXPANDED ANALYTICS MODULE ---
// Webhooks (trackEmailOpen, incomingLeadWebhook, punchout) exported via ./webhooks
// --- TELEPHONY & TWILIO CALL CENTER ---
__exportStar(require("./telephony"), exports);
//# sourceMappingURL=index.js.map