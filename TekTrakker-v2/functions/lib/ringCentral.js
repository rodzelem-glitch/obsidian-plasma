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
exports.registerRingCentralWebhook = exports.ringCentralWebhook = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const buffer_1 = require("buffer");
// Make sure admin is initialized
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
catch { /* ignore */ }
const db = admin.firestore();
// 1. Webhook Receiver Endpoint
exports.ringCentralWebhook = functions.https.onRequest(async (req, res) => {
    try {
        // RingCentral uses a Validation-Token header to verify webhooks on creation.
        const validationToken = req.headers['validation-token'];
        if (validationToken) {
            res.set('Validation-Token', validationToken);
            res.status(200).send();
            return;
        }
        const event = req.body;
        if (event && event.body && event.body.parties) {
            const party = event.body.parties.find((p) => p.direction === 'Inbound' && p.status?.code === 'Setup');
            if (party && party.from && party.from.phoneNumber) {
                let fromNumber = party.from.phoneNumber;
                if (fromNumber.startsWith('+1'))
                    fromNumber = fromNumber.substring(2); // Normalize slightly
                // We need to find which organization this subscription belongs to.
                // We stored the subscriptionId in the organization's settings.
                const orgsSnapshot = await db.collection('organizations').where('settings.ringCentralSubscriptionId', '==', event.subscriptionId).get();
                if (!orgsSnapshot.empty) {
                    const orgDoc = orgsSnapshot.docs[0];
                    const orgId = orgDoc.id;
                    const ownerId = orgDoc.data().ownerId;
                    // Fetch secrets early to check routing
                    const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
                    const config = configDoc.exists ? configDoc.data() : null;
                    let targetUserId = ownerId;
                    const toNumber = party.to?.phoneNumber;
                    if (toNumber && config?.rcMappings) {
                        let normTo = toNumber;
                        if (normTo.startsWith('+1'))
                            normTo = normTo.substring(2);
                        const match = config.rcMappings.find((m) => {
                            let mNum = m.phoneNumber || '';
                            if (mNum.startsWith('+1'))
                                mNum = mNum.substring(2);
                            return mNum === normTo;
                        });
                        if (match) {
                            targetUserId = match.forwardToUserId || match.assignedUserId;
                        }
                    }
                    // Search for customer by phone number
                    let customerId = null;
                    let customerName = party.from.name || "Unknown Caller";
                    // Simple search query (assuming phone field exists)
                    const customersSnap = await db.collection('customers')
                        .where('organizationId', '==', orgId)
                        .where('phone', '==', fromNumber)
                        .limit(1)
                        .get();
                    if (!customersSnap.empty) {
                        const cust = customersSnap.docs[0].data();
                        customerId = customersSnap.docs[0].id;
                        customerName = cust.name;
                    }
                    // Write to active_calls for the Screen Pop
                    await db.collection('organizations').doc(orgId).collection('active_calls').add({
                        phoneNumber: party.from.phoneNumber,
                        customerName,
                        customerId,
                        status: 'ringing',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        sessionId: event.body.sessionId || event.uuid,
                        routedTo: targetUserId
                    });
                    // Notify Admins or the specifically mapped user
                    const adminsSnap = targetUserId ?
                        await db.collection('users').doc(targetUserId).get().then(doc => doc.exists ? [doc] : []) :
                        await db.collection('users')
                            .where('organizationId', '==', orgId)
                            .where('role', 'in', ['admin', 'master_admin', 'both'])
                            .get().then(snap => snap.docs);
                    const batch = db.batch();
                    adminsSnap.forEach((adminDoc) => {
                        const notifyRef = db.collection('notifications').doc();
                        batch.set(notifyRef, {
                            userId: adminDoc.id,
                            organizationId: orgId,
                            title: 'Incoming Call',
                            body: `Incoming call from ${customerName} (${fromNumber})`,
                            type: 'call_received',
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        });
                    });
                    await batch.commit();
                }
            }
            else if (party && party.status?.code === 'Disconnected' && party.status?.reason === 'Missed') {
                // Handle Missed Call
                let fromNumber = party.from?.phoneNumber;
                if (!fromNumber)
                    return; // Can't SMS without a number
                const orgsSnapshot = await db.collection('organizations').where('settings.ringCentralSubscriptionId', '==', event.subscriptionId).get();
                if (!orgsSnapshot.empty) {
                    const orgId = orgsSnapshot.docs[0].id;
                    // Clear the active call so the UI popup goes away
                    if (event.body.sessionId || event.uuid) {
                        const activeCallsSnap = await db.collection('organizations').doc(orgId).collection('active_calls')
                            .where('sessionId', '==', event.body.sessionId || event.uuid)
                            .get();
                        const batch = db.batch();
                        activeCallsSnap.docs.forEach(doc => {
                            batch.update(doc.ref, { status: 'missed' });
                        });
                        await batch.commit();
                    }
                    // Find customer to link message to
                    let customerId = fromNumber;
                    let customerName = "Unknown Caller";
                    const customersSnap = await db.collection('customers')
                        .where('organizationId', '==', orgId)
                        .where('phone', '==', fromNumber)
                        .limit(1)
                        .get();
                    if (!customersSnap.empty) {
                        const cust = customersSnap.docs[0].data();
                        customerId = customersSnap.docs[0].id;
                        customerName = cust.name;
                    }
                    const orgDoc = orgsSnapshot.docs[0];
                    const ownerId = orgDoc.data().ownerId;
                    // Fetch secrets early to check routing
                    const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
                    const config = configDoc.exists ? configDoc.data() : null;
                    let targetUserId = ownerId;
                    const toNumber = party.to?.phoneNumber;
                    if (toNumber && config?.rcMappings) {
                        let normTo = toNumber;
                        if (normTo.startsWith('+1'))
                            normTo = normTo.substring(2);
                        const match = config.rcMappings.find((m) => {
                            let mNum = m.phoneNumber || '';
                            if (mNum.startsWith('+1'))
                                mNum = mNum.substring(2);
                            return mNum === normTo;
                        });
                        if (match) {
                            targetUserId = match.forwardToUserId || match.assignedUserId;
                        }
                    }
                    // Write Missed Call to Messages collection
                    await db.collection('messages').add({
                        organizationId: orgId,
                        senderId: customerId,
                        senderName: customerName,
                        receiverId: targetUserId || 'all', // Send directly to mapped user
                        content: `Missed call from ${fromNumber}`,
                        timestamp: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        read: false,
                        type: 'alert'
                    });
                    if (config) {
                        if (config?.rcSmsOnMissed && config?.rcSmsTemplate) {
                            // Get a fresh access token using the stored JWT
                            try {
                                const rcUrl = "https://platform.ringcentral.com";
                                const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'Authorization': `Basic ${buffer_1.Buffer.from(`${config.rcBackendClientId || config.ringCentralClientId}:${config.ringCentralClientSecret || ''}`).toString('base64')}`
                                    },
                                    body: new URLSearchParams({
                                        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                        'assertion': config.ringCentralJwtToken
                                    }).toString()
                                });
                                if (tokenResponse.ok) {
                                    const { access_token } = await tokenResponse.json();
                                    // Send the SMS
                                    await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/sms`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${access_token}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            from: { phoneNumber: party.to?.phoneNumber },
                                            to: [{ phoneNumber: fromNumber }],
                                            text: config.rcSmsTemplate
                                        })
                                    });
                                    console.log(`Sent missed call SMS to ${fromNumber}`);
                                }
                            }
                            catch (e) {
                                console.error("Failed to send Missed Call SMS:", e);
                            }
                        }
                    }
                }
            }
        }
        // Handle SMS
        if (event && event.body && event.body.type === 'SMS' && event.body.direction === 'Inbound') {
            let fromNumber = event.body.from?.phoneNumber;
            if (fromNumber && fromNumber.startsWith('+1'))
                fromNumber = fromNumber.substring(2);
            const text = event.body.subject || ''; // RingCentral usually puts the message body in subject
            const orgsSnapshot = await db.collection('organizations').where('settings.ringCentralSubscriptionId', '==', event.subscriptionId).get();
            if (!orgsSnapshot.empty) {
                const orgId = orgsSnapshot.docs[0].id;
                // Find customer to link message to
                let customerId = fromNumber;
                let customerName = "Unknown Sender";
                const customersSnap = await db.collection('customers')
                    .where('organizationId', '==', orgId)
                    .where('phone', '==', fromNumber)
                    .limit(1)
                    .get();
                if (!customersSnap.empty) {
                    const cust = customersSnap.docs[0].data();
                    customerId = customersSnap.docs[0].id;
                    customerName = cust.name;
                }
                const orgDoc = orgsSnapshot.docs[0];
                const ownerId = orgDoc.data().ownerId;
                // Fetch secrets early to check routing
                const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
                const config = configDoc.exists ? configDoc.data() : null;
                let targetUserId = ownerId;
                const toNumber = event.body.to?.[0]?.phoneNumber;
                if (toNumber && config?.rcMappings) {
                    let normTo = toNumber;
                    if (normTo.startsWith('+1'))
                        normTo = normTo.substring(2);
                    const match = config.rcMappings.find((m) => {
                        let mNum = m.phoneNumber || '';
                        if (mNum.startsWith('+1'))
                            mNum = mNum.substring(2);
                        return mNum === normTo;
                    });
                    if (match) {
                        targetUserId = match.forwardToUserId || match.assignedUserId;
                    }
                }
                // Write Inbound SMS to Messages collection
                await db.collection('messages').add({
                    organizationId: orgId,
                    senderId: customerId,
                    senderName: customerName,
                    receiverId: targetUserId || 'all', // Send directly to mapped user
                    content: text,
                    timestamp: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    read: false,
                    type: 'sms'
                });
                const adminsSnap = targetUserId ?
                    await db.collection('users').doc(targetUserId).get().then(doc => doc.exists ? [doc] : []) :
                    await db.collection('users')
                        .where('organizationId', '==', orgId)
                        .where('role', 'in', ['admin', 'master_admin', 'both'])
                        .get().then(snap => snap.docs);
                const batch = db.batch();
                adminsSnap.forEach((adminDoc) => {
                    const notifyRef = db.collection('notifications').doc();
                    batch.set(notifyRef, {
                        userId: adminDoc.id,
                        organizationId: orgId,
                        title: 'New Text Message',
                        body: `From ${customerName} (${fromNumber}): ${text}`,
                        type: 'sms_received',
                        status: 'pending',
                        createdAt: new Date().toISOString() // Using ISO string to match frontend types
                    });
                });
                await batch.commit();
            }
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error("RingCentral Webhook Error:", error);
        res.status(500).send('Internal Server Error');
    }
});
// 2. Callable to Register Webhook
exports.registerRingCentralWebhook = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { orgId, clientId, clientSecret, jwtToken, webhookUrl } = data;
    if (!orgId || !clientId || !webhookUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }
    try {
        // Step 1: Get Access Token
        let tokenResponse;
        let activeUrl = "https://platform.ringcentral.com";
        const authenticate = async (baseUrl) => {
            if (jwtToken) {
                return await fetch(`${baseUrl}/restapi/oauth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret || ''}`).toString('base64')}`
                    },
                    body: new URLSearchParams({
                        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        'assertion': jwtToken
                    }).toString()
                });
            }
            else {
                return await fetch(`${baseUrl}/restapi/oauth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                    },
                    body: new URLSearchParams({
                        'grant_type': 'client_credentials'
                    }).toString()
                });
            }
        };
        tokenResponse = await authenticate(activeUrl);
        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            throw new Error(`Failed to authenticate with RingCentral: ${errBody}`);
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        // Step 2: Register Webhook
        const subResponse = await fetch(`${activeUrl}/restapi/v1.0/subscription`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventFilters: [
                    "/restapi/v1.0/account/~/extension/~/telephony/sessions",
                    "/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS"
                ],
                deliveryMode: {
                    transportType: "WebHook",
                    address: webhookUrl
                }
            })
        });
        if (!subResponse.ok) {
            const errBody = await subResponse.text();
            throw new Error(`Failed to register webhook: ${errBody}`);
        }
        const subData = await subResponse.json();
        const subscriptionId = subData.id;
        // Save subscriptionId and environment to org settings
        await db.collection('organizations').doc(orgId).update({
            'settings.ringCentralSubscriptionId': subscriptionId
        });
        await db.collection('organizations').doc(orgId).collection('secrets').doc('config').set({
            ringCentralEnvironment: "production"
        }, { merge: true });
        return { success: true, subscriptionId, environment: "production" };
    }
    catch (error) {
        console.error("Register RingCentral Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to setup RingCentral integration.');
    }
});
//# sourceMappingURL=ringCentral.js.map