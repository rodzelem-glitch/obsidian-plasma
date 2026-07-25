import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import * as admin from "firebase-admin";

// Utility: Grab ADP secrets from the marketplace integrations settings
const getADPSettings = async (db: admin.firestore.Firestore, orgId: string) => {
    const snap = await db.doc(`organizations/${orgId}/settings/marketplace_integrations`).get();
    if (!snap.exists) {
        throw new HttpsError('failed-precondition', 'Marketplace integrations document is missing.');
    }
    const integrations = snap.data()?.integrations || {};
    const adpConfig = integrations.adp;
    if (!adpConfig || !adpConfig.enabled || !adpConfig.adpClientId || !adpConfig.adpClientSecret) {
        throw new HttpsError('failed-precondition', 'ADP Workforce integration is not fully configured or enabled.');
    }
    return adpConfig;
};

// Helper: Exchange Client ID and Client Secret for an ADP OAuth 2.0 access token
const getADPAccessToken = async (clientId: string, clientSecret: string): Promise<string> => {
    try {
        const response = await fetch('https://accounts.adp.com/auth/oauth/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials'
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Failed to obtain ADP access token (status ${response.status}): ${errBody}`);
        }

        const data: any = await response.json();
        if (!data.access_token) {
            throw new Error('ADP token response did not contain an access_token.');
        }
        return data.access_token;
    } catch (e: any) {
        throw new Error('ADP OAuth token exchange failed: ' + e.message);
    }
};

// Callable: Manually sync a single employee or subcontractor to ADP
export const manualSyncADPEmployee = onCall({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in.');

    const { userId, orgId } = request.data;
    if (!userId || !orgId) throw new HttpsError('invalid-argument', 'Missing userId or orgId.');

    const db = admin.firestore();
    const adpConfig = await getADPSettings(db, orgId);

    const userDoc = await db.collection('users').doc(userId).get();
    let userData = userDoc.data();
    let collectionName = 'users';
    
    // Fallback to subcontractors
    if (!userData) {
         const subDoc = await db.collection('subcontractors').doc(userId).get();
         userData = subDoc.data();
         collectionName = 'subcontractors';
    }
    
    if (!userData) throw new HttpsError('not-found', 'User not found in system.');
    if (userData.adpEmployeeId) throw new HttpsError('already-exists', 'User is already linked to ADP.');

    try {
        const accessToken = await getADPAccessToken(adpConfig.adpClientId, adpConfig.adpClientSecret);
        let adpEmployeeId = '';
        // Production ADP API: POST https://api.adp.com/hr/v3/workers
        const response = await fetch('https://api.adp.com/hr/v3/workers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                worker: {
                    person: {
                        legalName: {
                            givenName: userData.firstName || userData.name?.split(' ')[0] || 'Unknown',
                            familyName1: userData.lastName || userData.name?.split(' ')[1] || 'Worker'
                        },
                        communicationChannels: [
                            {
                                emailUri: userData.email
                            }
                        ]
                    }
                }
            })
        });

        if (response.ok) {
            const resData: any = await response.json();
            adpEmployeeId = resData.workerId || resData.id || resData.worker?.associateOID || '';
            if (!adpEmployeeId) {
                throw new Error('ADP response did not contain a valid worker/associate ID.');
            }
        } else {
            const errBody = await response.text();
            throw new Error(`ADP API error (status ${response.status}): ${errBody}`);
        }

        await db.collection(collectionName).doc(userId).update({
            adpEmployeeId: adpEmployeeId,
            adpOnboardingStatus: 'synced',
            adpSyncedAt: new Date().toISOString()
        });
        
        return { success: true, adpEmployeeId };
    } catch (e: any) {
         console.error('ADP employee sync error: ', e);
         throw new HttpsError('internal', 'Internal error syncing to ADP: ' + e.message);
    }
});

// Callable: Bulk sync missing employees/subcontractors to ADP
export const bulkSyncADPEmployees = onCall({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in.');

    const { orgId, userIds } = request.data;
    if (!orgId || !userIds || !Array.isArray(userIds)) {
        throw new HttpsError('invalid-argument', 'Missing orgId or userIds array.');
    }

    const db = admin.firestore();
    const adpConfig = await getADPSettings(db, orgId);
    const accessToken = await getADPAccessToken(adpConfig.adpClientId, adpConfig.adpClientSecret);

    let syncedCount = 0;
    for (const uId of userIds) {
        const userRef = db.collection('users').doc(uId);
        let userSnap = await userRef.get();
        let collectionName = 'users';
        
        if (!userSnap.exists) {
            const subRef = db.collection('subcontractors').doc(uId);
            const subSnap = await subRef.get();
            if (subSnap.exists) {
                userSnap = subSnap;
                collectionName = 'subcontractors';
            } else {
                continue;
            }
        }
        
        const userData = userSnap.data();
        if (userData?.adpEmployeeId) continue; 
        
        try {
            let adpEmployeeId = '';
            // Production ADP API: POST https://api.adp.com/hr/v3/workers
            const response = await fetch('https://api.adp.com/hr/v3/workers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    worker: {
                        person: {
                            legalName: {
                                givenName: userData?.firstName || userData?.name?.split(' ')[0] || 'Unknown',
                                familyName1: userData?.lastName || userData?.name?.split(' ')[1] || 'Worker'
                            },
                            communicationChannels: [{ emailUri: userData?.email }]
                        }
                    }
                })
            });

            if (response.ok) {
                const resData: any = await response.json();
                adpEmployeeId = resData.workerId || resData.id || resData.worker?.associateOID || '';
                if (!adpEmployeeId) {
                    throw new Error('ADP response did not contain a valid worker/associate ID.');
                }
            } else {
                const errBody = await response.text();
                throw new Error(`ADP API error (status ${response.status}): ${errBody}`);
            }

            await db.collection(collectionName).doc(uId).update({
                adpEmployeeId: adpEmployeeId,
                adpOnboardingStatus: 'synced',
                adpSyncedAt: new Date().toISOString()
            });
            syncedCount++;
        } catch (err: any) {
            console.error(`Failed to bulk sync user ${uId} to ADP:`, err.message);
        }
    }

    return { success: true, syncedCount };
});

// Callable: Stage compensation shift logs and closed jobs commission into ADP
export const stageADPPayroll = onCall({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in.');

    const { orgId, startDate, endDate } = request.data;
    if (!orgId || !startDate || !endDate) throw new HttpsError('invalid-argument', 'Missing orgId, startDate, or endDate.');

    const db = admin.firestore();
    const adpConfig = await getADPSettings(db, orgId);

    // 1. Gather all shift logs
    const timesheetsRef = db.collection('shiftLogs');
    const logsSnapshot = await timesheetsRef.where('organizationId', '==', orgId).get();

    // 2. Gather closed jobs
    const jobsRef = db.collection('organizations').doc(orgId).collection('jobs');
    const jobsSnapshot = await jobsRef.where('status', '==', 'closed').get();

    // 3. Gather linked users and subcontractors
    const usersSnapshot = await db.collection('users').where('organizationId', '==', orgId).get();
    const subsSnapshot = await db.collection('subcontractors').where('organizationId', '==', orgId).get();
    const allUserDocs = [...usersSnapshot.docs, ...subsSnapshot.docs];
    const usersDict: Record<string, string> = {};
    allUserDocs.forEach(d => { if (d.data().adpEmployeeId) usersDict[d.id] = d.data().adpEmployeeId; });

    // Deduplicate and accumulate hours/commissions
    const compensationMap: Record<string, { adpEmpId: string, name: string, regularHours: number, overtime: number, commission: number }> = {};

    logsSnapshot.docs.forEach(doc => {
        const log = doc.data();
        if (log.isApproved && log.clockIn && log.clockOut) {
            const clockInDate = log.clockIn.split('T')[0];
            if (clockInDate >= startDate && clockInDate <= endDate) {
                const adpEmpId = usersDict[log.userId];
                if (!adpEmpId) return; // Only process linked employees

                if (!compensationMap[log.userId]) {
                    const user = allUserDocs.find(u => u.id === log.userId)?.data();
                    compensationMap[log.userId] = {
                        adpEmpId,
                        name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() : 'Worker',
                        regularHours: 0,
                        overtime: 0,
                        commission: 0
                    };
                }
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
                const adpEmpId = usersDict[techId];
                if (!adpEmpId) return;

                if (!compensationMap[techId]) {
                    const user = allUserDocs.find(u => u.id === techId)?.data();
                    compensationMap[techId] = {
                        adpEmpId,
                        name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() : 'Worker',
                        regularHours: 0,
                        overtime: 0,
                        commission: 0
                    };
                }
                compensationMap[techId].commission += Number(d.commissionAwarded);
            }
        }
    });

    const entries = Object.values(compensationMap);
    if (entries.length === 0) {
        throw new HttpsError('not-found', 'No valid timesheets or linked ADP employees found for the period.');
    }

    try {
        const accessToken = await getADPAccessToken(adpConfig.adpClientId, adpConfig.adpClientSecret);
        const batchId = `BATCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        let finalBatchId = batchId;

        // Send batch request to production ADP payroll-inputs API: POST https://api.adp.com/payroll/v1/payroll-inputs
        const response = await fetch('https://api.adp.com/payroll/v1/payroll-inputs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                payrollBatch: {
                    batchId,
                    startDate,
                    endDate,
                    timecardEntries: entries.map(e => ({
                        workerId: e.adpEmpId,
                        regularHours: e.regularHours.toFixed(2),
                        overtimeHours: e.overtime.toFixed(2),
                        commissionAmount: e.commission > 0 ? e.commission.toFixed(2) : undefined
                    }))
                }
            })
        });

        if (response.ok) {
            const resData: any = await response.json();
            finalBatchId = resData.payrollBatch?.batchId || batchId;
        } else {
            const errBody = await response.text();
            throw new Error(`ADP API error (status ${response.status}): ${errBody}`);
        }

        // Log the staging event in audit logs
        await db.collection('auditLogs').add({
            action: 'ADP Payroll Staged',
            batchId: finalBatchId,
            orgId,
            startDate,
            endDate,
            employeesProcessed: entries.length,
            stagedBy: auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            message: 'Payroll successfully staged in ADP Workforce Now.',
            employeesProcessed: entries.length,
            batchId: finalBatchId,
            adpReviewUrl: `https://runpayroll.adp.com`
        };
    } catch (e: any) {
        console.error('ADP Payroll staging error: ', e);
        throw new HttpsError('internal', 'Internal error staging payroll in ADP: ' + e.message);
    }
});

// HTTP Request trigger: Receive webhooks from ADP
export const adpWebhook = onRequest({ cors: true }, async (req, res) => {
    const db = admin.firestore();
    const body = req.body;

    // Verify webhook signature (Basic security logging)
    const signature = req.get('X-ADP-Signature');
    
    console.log("Received ADP Webhook:", body, "Signature:", signature);

    try {
        const eventType = body?.eventType || 'unknown';
        const workerId = body?.eventData?.workerId || 'unknown';

        await db.collection('auditLogs').add({
            action: 'ADP Webhook Received',
            eventType,
            workerId,
            payload: body,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).send("Webhook recorded successfully");
    } catch (e) {
        console.error("Error processing ADP Webhook: ", e);
        res.status(500).send("Internal Server Error");
    }
});
