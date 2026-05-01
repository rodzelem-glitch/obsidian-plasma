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
Object.defineProperty(exports, "__esModule", { value: true });
exports.gustoWebhook = exports.bulkSyncMissingEmployees = exports.stageGustoPayroll = exports.manualSyncGustoEmployee = exports.syncGustoEmployee = exports.provisionGustoCompany = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
// Utility: Grab Platform Secrets
const getPlatformSecrets = async (db) => {
    const platformDoc = await db.collection('platformSettings').doc('global').get();
    const config = platformDoc.data();
    if (!config?.gustoClientId || !config?.gustoClientSecret) {
        throw new https_1.HttpsError('failed-precondition', 'Master Gusto API keys are missing in Platform settings.');
    }
    return config;
};
// Utility: Obtain a temporary System Access Token
const getSystemAccessToken = async (clientId, clientSecret) => {
    const response = await fetch('https://api.gusto-demo.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'system_access'
        })
    });
    if (!response.ok) {
        throw new https_1.HttpsError('aborted', 'Failed to generate Gusto System Token: ' + await response.text());
    }
    const data = await response.json();
    return data.access_token;
};
// Utility: Obtain or Refresh a Company Access Token
const getCompanyAccessToken = async (db, orgId, orgData, config) => {
    let token = orgData.gustoAccessToken;
    // For robust server-to-server operations, update to newest
    const refreshResponse = await fetch('https://api.gusto-demo.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: config.gustoClientId,
            client_secret: config.gustoClientSecret,
            refresh_token: orgData.gustoRefreshToken,
            grant_type: 'refresh_token'
        })
    });
    if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        token = refreshData.access_token;
        await db.collection('organizations').doc(orgId).update({
            gustoAccessToken: refreshData.access_token,
            gustoRefreshToken: refreshData.refresh_token
        });
    }
    return token;
};
exports.provisionGustoCompany = (0, https_1.onCall)({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    const orgId = request.data.orgId;
    if (!orgId)
        throw new https_1.HttpsError('invalid-argument', 'Missing organization ID.');
    const db = admin.firestore();
    const config = await getPlatformSecrets(db);
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    if (!orgData)
        throw new https_1.HttpsError('not-found', 'Organization not found.');
    // 1. Get System Token
    const systemToken = await getSystemAccessToken(config.gustoClientId, config.gustoClientSecret);
    // 2. Provision Company
    const response = await fetch('https://api.gusto-demo.com/v1/partner_managed_companies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + systemToken
        },
        body: JSON.stringify({
            user: {
                first_name: auth.token.name?.split(' ')[0] || 'Admin',
                last_name: auth.token.name?.split(' ')[1] || 'User',
                email: auth.token.email || orgData.email || 'admin@tektrakker.com',
                phone: orgData.phone || '555-555-5555'
            },
            company: {
                name: orgData.name,
                trade_name: orgData.name,
            }
        })
    });
    if (!response.ok) {
        throw new https_1.HttpsError('aborted', 'Gusto Provisioning Error: ' + await response.text());
    }
    const responseData = await response.json();
    const gustoCompanyUuid = responseData.company_uuid || responseData.uuid || responseData.company?.uuid; // Fallbacks
    const accessToken = responseData.access_token;
    const refreshToken = responseData.refresh_token;
    // 3. Request Onboarding URL (using System Token!)
    let onboardingUrl = '';
    if (gustoCompanyUuid) {
        const flowResponse = await fetch(`https://api.gusto-demo.com/v1/companies/${gustoCompanyUuid}/flows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'X-Gusto-API-Version': '2026-02-01'
            },
            body: JSON.stringify({ flow_type: 'company_onboarding' })
        });
        if (flowResponse.ok) {
            const flowData = await flowResponse.json();
            onboardingUrl = flowData.url;
        }
    }
    // 4. Save everything back
    await orgDoc.ref.update({
        gustoCompanyId: gustoCompanyUuid,
        gustoAccessToken: accessToken,
        gustoRefreshToken: refreshToken,
        gustoOnboardingUrl: onboardingUrl,
        hasPayrollEnabled: true
    });
    return { success: true, companyId: gustoCompanyUuid, onboardingUrl };
});
exports.syncGustoEmployee = (0, firestore_1.onDocumentCreated)("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const userData = snap.data();
    const orgId = userData.organizationId;
    if (!orgId)
        return;
    const db = admin.firestore();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    if (!orgData?.gustoCompanyId || !orgData?.hasPayrollEnabled || !orgData?.gustoRefreshToken)
        return;
    const config = await getPlatformSecrets(db);
    try {
        const companyToken = await getCompanyAccessToken(db, orgId, orgData, config);
        const response = await fetch(`https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + companyToken
            },
            body: JSON.stringify({
                first_name: userData.firstName || userData.name?.split(' ')[0] || 'Unknown',
                last_name: userData.lastName || userData.name?.split(' ')[1] || 'Worker',
                email: userData.email
            })
        });
        if (response.ok) {
            const gustoEmployeeData = await response.json();
            await snap.ref.update({
                gustoEmployeeId: gustoEmployeeData.uuid,
                gustoOnboardingStatus: 'invited'
            });
        }
    }
    catch (e) {
        console.error('Network Error syncing to Gusto: ', e);
    }
});
exports.manualSyncGustoEmployee = (0, https_1.onCall)({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    const { userId, orgId } = request.data;
    if (!userId || !orgId)
        throw new https_1.HttpsError('invalid-argument', 'Missing userId or orgId.');
    const db = admin.firestore();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    if (!orgData?.gustoCompanyId || !orgData?.hasPayrollEnabled || !orgData?.gustoRefreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Organization is not fully configured for Gusto Payroll.');
    }
    const userDoc = await db.collection('users').doc(userId).get();
    let userData = userDoc.data();
    // If not in users map, check subcontractors map
    if (!userData) {
        const subDoc = await db.collection('subcontractors').doc(userId).get();
        userData = subDoc.data();
    }
    if (!userData)
        throw new https_1.HttpsError('not-found', 'User not found in system.');
    if (userData.gustoEmployeeId)
        throw new https_1.HttpsError('already-exists', 'User is already linked to Gusto.');
    const config = await getPlatformSecrets(db);
    try {
        const companyToken = await getCompanyAccessToken(db, orgId, orgData, config);
        const response = await fetch(`https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + companyToken,
                'X-Gusto-API-Version': '2026-02-01'
            },
            body: JSON.stringify({
                first_name: userData.firstName || userData.name?.split(' ')[0] || 'Unknown',
                last_name: userData.lastName || userData.name?.split(' ')[1] || 'Worker',
                email: userData.email || null
            })
        });
        if (!response.ok) {
            throw new https_1.HttpsError('aborted', 'Failed to create Gusto Employee: ' + await response.text());
        }
        const gustoEmployeeData = await response.json();
        const collectionName = userDoc.exists ? 'users' : 'subcontractors';
        await db.collection(collectionName).doc(userId).update({
            gustoEmployeeId: gustoEmployeeData.uuid,
            gustoOnboardingStatus: 'invited'
        });
        return { success: true, gustoEmployeeId: gustoEmployeeData.uuid };
    }
    catch (e) {
        console.error('Network Error syncing to Gusto: ', e);
        throw new https_1.HttpsError('internal', 'Internal error: ' + e.message);
    }
});
exports.stageGustoPayroll = (0, https_1.onCall)({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    const { orgId, startDate, endDate } = request.data;
    if (!orgId || !startDate || !endDate)
        throw new https_1.HttpsError('invalid-argument', 'Missing orgId, startDate, or endDate.');
    const db = admin.firestore();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    if (!orgData?.gustoCompanyId || !orgData?.hasPayrollEnabled || !orgData.gustoRefreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Organization is not fully configured for Gusto Payroll.');
    }
    const config = await getPlatformSecrets(db);
    const companyToken = await getCompanyAccessToken(db, orgId, orgData, config);
    const timesheetsRef = db.collection('shiftLogs');
    const logsSnapshot = await timesheetsRef.where('organizationId', '==', orgId).get();
    const compensationMap = {};
    const jobsRef = db.collection('organizations').doc(orgId).collection('jobs');
    const jobsSnapshot = await jobsRef.where('status', '==', 'closed').get();
    logsSnapshot.docs.forEach(doc => {
        const log = doc.data();
        if (log.isApproved && log.clockIn && log.clockOut) {
            const clockInDate = log.clockIn.split('T')[0];
            if (clockInDate >= startDate && clockInDate <= endDate) {
                if (!compensationMap[log.userId])
                    compensationMap[log.userId] = { userId: log.userId, regularHours: 0, overtime: 0, commission: 0 };
                const diffHours = (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / 3600000;
                let regular = diffHours;
                let overtime = 0;
                if (diffHours > 8) {
                    regular = 8;
                    overtime = diffHours - 8;
                }
                compensationMap[log.userId].regularHours += regular;
                compensationMap[log.userId].overtime += overtime;
            }
        }
    });
    jobsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        if (d.completedDate && d.completedDate >= startDate && d.completedDate <= endDate) {
            const techId = d.technicianId || d.assignedTechnicianId;
            if (techId && d.commissionAwarded) {
                if (!compensationMap[techId])
                    compensationMap[techId] = { userId: techId, regularHours: 0, overtime: 0, commission: 0 };
                compensationMap[techId].commission += Number(d.commissionAwarded);
            }
        }
    });
    const usersSnapshot = await db.collection('users').where('organizationId', '==', orgId).get();
    const usersDict = {};
    usersSnapshot.docs.forEach(d => { if (d.data().gustoEmployeeId)
        usersDict[d.id] = d.data().gustoEmployeeId; });
    const employeeCompensations = [];
    for (const userId of Object.keys(compensationMap)) {
        const record = compensationMap[userId];
        const gustoEmpId = usersDict[userId];
        if (gustoEmpId) {
            employeeCompensations.push({
                employee_uuid: gustoEmpId,
                payment_method: 'Direct Deposit',
                fixed_compensations: [{ name: 'Commission', amount: record.commission.toString(), job_uuid: "default" }],
                hourly_compensations: [
                    { name: 'Regular Hours', hours: record.regularHours.toString() },
                    { name: 'Overtime', hours: record.overtime.toString() }
                ]
            });
        }
    }
    if (employeeCompensations.length === 0)
        throw new https_1.HttpsError('not-found', 'No valid timesheets or linked Gusto employees found.');
    try {
        let currentPayrollUuid = '';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + companyToken,
            'X-Gusto-API-Version': '2026-02-01'
        };
        const payrollUrl = `https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/payrolls?processing_statuses=unprocessed`;
        const payrollFetch = await fetch(payrollUrl, { method: 'GET', headers });
        if (payrollFetch.ok) {
            const payrolls = await payrollFetch.json();
            if (payrolls.length > 0)
                currentPayrollUuid = payrolls[0].uuid;
            else
                throw new https_1.HttpsError('failed-precondition', 'No upcoming unprocessed payroll draft found in Gusto.');
        }
        else {
            throw new https_1.HttpsError('internal', `Could not fetch payrolls from ${payrollUrl}: ` + await payrollFetch.text());
        }
        const prepareUrl = `https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/payrolls/${currentPayrollUuid}/prepare`;
        const prepareResponse = await fetch(prepareUrl, { method: 'PUT', headers });
        let payrollVersion = '';
        if (prepareResponse.ok) {
            const preparedPayroll = await prepareResponse.json();
            payrollVersion = preparedPayroll.version || '';
        }
        else {
            console.error("Prepare Payroll failed on", prepareUrl, await prepareResponse.text());
        }
        const updateUrl = `https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/payrolls/${currentPayrollUuid}`;
        const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                version: payrollVersion,
                employee_compensations: employeeCompensations
            })
        });
        if (!updateResponse.ok) {
            throw new https_1.HttpsError('internal', `Failed to stage payroll in Gusto at ${updateUrl}: ` + await updateResponse.text());
        }
        return {
            success: true,
            message: 'Payroll successfully staged in Gusto.',
            employeesProcessed: employeeCompensations.length,
            gustoReviewUrl: `https://app.gusto.com/payrolls/${currentPayrollUuid}/review`
        };
    }
    catch (err) {
        throw new https_1.HttpsError('internal', err.message);
    }
});
exports.bulkSyncMissingEmployees = (0, https_1.onCall)({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    const { orgId, userIds } = request.data;
    if (!orgId || !userIds || !Array.isArray(userIds)) {
        throw new https_1.HttpsError('invalid-argument', 'Missing orgId or userIds array.');
    }
    const db = admin.firestore();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    if (!orgData?.gustoCompanyId || !orgData?.hasPayrollEnabled || !orgData.gustoRefreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Organization is not fully configured for Gusto Payroll.');
    }
    const config = await getPlatformSecrets(db);
    const companyToken = await getCompanyAccessToken(db, orgId, orgData, config);
    let syncedCount = 0;
    for (const uId of userIds) {
        const userRef = db.collection('users').doc(uId);
        const userSnap = await userRef.get();
        if (!userSnap.exists)
            continue;
        const userData = userSnap.data();
        if (userData?.gustoEmployeeId)
            continue;
        const response = await fetch(`https://api.gusto-demo.com/v1/companies/${orgData.gustoCompanyId}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + companyToken,
                'X-Gusto-API-Version': '2026-02-01'
            },
            body: JSON.stringify({
                first_name: userData?.firstName || userData?.name?.split(' ')[0] || 'Unknown',
                last_name: userData?.lastName || userData?.name?.split(' ')[1] || 'Worker',
                email: userData?.email || `${uId}@tektrakker.com`
            })
        });
        if (response.ok) {
            const gustoEmployeeData = await response.json();
            await userRef.update({
                gustoEmployeeId: gustoEmployeeData.uuid,
                gustoOnboardingStatus: 'invited'
            });
            syncedCount++;
        }
    }
    return { success: true, syncedCount };
});
// --- WEBHOOK RECEIVER ---
exports.gustoWebhook = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    const db = admin.firestore();
    const body = req.body;
    // 1. Verification Step (when creating the subscription)
    if (body && body.verification_token) {
        // We log the verification token into platform settings to use as the HMAC secret
        await db.collection("platformSettings").doc("global").set({
            gustoWebhookVerificationToken: body.verification_token
        }, { merge: true });
        res.status(200).send("Verification token securely received");
        return;
    }
    // 2. Validate HMAC Signature
    const signatureHeader = req.get('X-Gusto-Signature');
    if (signatureHeader) {
        const configDoc = await db.collection("platformSettings").doc("global").get();
        const verificationToken = configDoc.data()?.gustoWebhookVerificationToken;
        if (verificationToken) {
            const hmac = crypto.createHmac("sha256", verificationToken);
            hmac.update(req.rawBody || JSON.stringify(body));
            const expectedSignature = hmac.digest('hex');
            if (signatureHeader !== expectedSignature) {
                console.error("Gusto webhook signature mismatch. Rejected request.");
                res.status(401).send("Invalid signature");
                return;
            }
        }
    }
    // 3. Process Verified Webhook Events
    const eventType = body.event_type;
    console.log("Received Verified Gusto Webhook Event:", eventType, body);
    try {
        if (eventType === 'company.provisioned') {
            // Gusto tells us the partner connection is finalized
            console.log(`Company ${body.resource_uuid} fully provisioned!`);
        }
        else if (eventType === 'payroll.paid') {
            // A specific payroll just paid out successfully
            console.log(`Payroll paid out for company ${body.resource_uuid}`);
        }
        else if (eventType === 'employee.created') {
            // Example sync back employee status
            console.log(`Gusto employee created: ${body.entity_uuid}`);
        }
        // Log webhook to audit trail
        await db.collection('auditLogs').add({
            action: 'Gusto Webhook Received',
            event_type: eventType,
            resource_uuid: body.resource_uuid || 'unknown',
            entity_uuid: body.entity_uuid || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (e) {
        console.error("Error processing webhook:", e);
        // Still return 200 so Gusto doesn't assume delivery failure if there was an internal problem
        res.status(200).send('Event caught but internally errored');
        return;
    }
    res.status(200).send('Event processed successfully');
});
//# sourceMappingURL=gustoAgent.js.map