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
exports.onCustomerWriteSyncRingCentral = exports.syncCustomerToRingCentral = exports.fetchRingCentralCallLogs = exports.ringCentralRecording = exports.registerRingCentralWebhook = exports.ringCentralWebhook = void 0;
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
/**
 * Normalizes phone numbers and performs a two-tier lookup to find a customer:
 * 1. Fast-path (O(1)) check against 8 common formatting variations.
 * 2. Safe-path fallback scan clearing non-digits in-memory to guarantee a match.
 */
async function findCustomerByPhone(orgId, rawPhone) {
    if (!rawPhone)
        return null;
    const digits = rawPhone.replace(/\D/g, '');
    const tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.substring(1) : digits;
    const variants = [rawPhone];
    if (tenDigits.length === 10) {
        const area = tenDigits.substring(0, 3);
        const prefix = tenDigits.substring(3, 6);
        const line = tenDigits.substring(6, 10);
        variants.push(tenDigits, `(${area}) ${prefix}-${line}`, `${area}-${prefix}-${line}`, `${area}.${prefix}.${line}`, `+1${tenDigits}`, `+1 (${area}) ${prefix}-${line}`, `+1 ${area}-${prefix}-${line}`, `1${tenDigits}`);
    }
    const uniqueVariants = Array.from(new Set(variants)).filter(Boolean);
    // Fast-path: query index with variations
    const querySnap = await db.collection('customers')
        .where('organizationId', '==', orgId)
        .where('phone', 'in', uniqueVariants)
        .limit(1)
        .get();
    if (!querySnap.empty) {
        return { id: querySnap.docs[0].id, name: querySnap.docs[0].data().name };
    }
    // Safe-path fallback: check all organization customers in-memory
    const allCustomersSnap = await db.collection('customers')
        .where('organizationId', '==', orgId)
        .get();
    for (const doc of allCustomersSnap.docs) {
        const custPhone = doc.data().phone;
        if (custPhone) {
            const custDigits = custPhone.replace(/\D/g, '');
            const custTenDigits = custDigits.length === 11 && custDigits.startsWith('1') ? custDigits.substring(1) : custDigits;
            if (custTenDigits === tenDigits && tenDigits) {
                return { id: doc.id, name: doc.data().name };
            }
        }
    }
    return null;
}
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
                    // Use robust phone matching helper
                    const customerMatch = await findCustomerByPhone(orgId, fromNumber);
                    if (customerMatch) {
                        customerId = customerMatch.id;
                        customerName = customerMatch.name;
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
                    // Notify all Admins and employees of the organization
                    const orgUsersSnap = await db.collection('users')
                        .where('organizationId', '==', orgId)
                        .get().then(snap => snap.docs);
                    const batch = db.batch();
                    orgUsersSnap.forEach((userDoc) => {
                        const notifyRef = db.collection('notifications').doc();
                        batch.set(notifyRef, {
                            userId: userDoc.id,
                            organizationId: orgId,
                            title: 'Incoming Call',
                            body: `Incoming call from ${customerName} (${fromNumber})`,
                            type: 'call_received',
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            senderId: customerId || fromNumber,
                            data: { senderId: customerId || fromNumber }
                        });
                    });
                    await batch.commit();
                }
            }
            else if (party && party.status?.code === 'Disconnected') {
                const isMissed = party.status?.reason === 'Missed' || party.status?.reason === 'Abandoned';
                let fromNumber = party.from?.phoneNumber || (party.direction === 'Outbound' ? party.to?.phoneNumber : '');
                if (!fromNumber)
                    return;
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
                            batch.update(doc.ref, { status: isMissed ? 'missed' : 'completed' });
                        });
                        await batch.commit();
                    }
                    // Find customer to link message to
                    let customerId = fromNumber;
                    let customerName = "Unknown Caller";
                    let normFrom = fromNumber;
                    if (normFrom.startsWith('+1'))
                        normFrom = normFrom.substring(2);
                    const customerMatch = await findCustomerByPhone(orgId, normFrom);
                    if (customerMatch) {
                        customerId = customerMatch.id;
                        customerName = customerMatch.name;
                    }
                    // Fetch secrets early to check routing
                    const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
                    const config = configDoc.exists ? configDoc.data() : null;
                    if (config) {
                        const rcUrl = config.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
                        const clientId = config.rcBackendClientId || config.ringCentralClientId;
                        const clientSecret = config.ringCentralClientSecret || '';
                        const jwtToken = config.ringCentralJwtToken;
                        if (clientId && jwtToken) {
                            try {
                                // Get a fresh access token using the stored JWT
                                const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                                    },
                                    body: new URLSearchParams({
                                        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                        'assertion': jwtToken
                                    }).toString()
                                });
                                if (tokenResponse.ok) {
                                    const { access_token } = await tokenResponse.json();
                                    // Query call log by sessionId
                                    const sessionId = event.body.sessionId || event.uuid;
                                    const callLogResponse = await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/call-log?telephonySessionId=${sessionId}`, {
                                        headers: {
                                            'Authorization': `Bearer ${access_token}`
                                        }
                                    });
                                    if (callLogResponse.ok) {
                                        const callLogData = await callLogResponse.json();
                                        const records = callLogData.records || [];
                                        if (records.length > 0) {
                                            const callRecord = records[0];
                                            const duration = callRecord.duration;
                                            const result = callRecord.result;
                                            const recording = callRecord.recording;
                                            const direction = callRecord.direction;
                                            let recordingId = null;
                                            let recordingUrl = null;
                                            if (recording && recording.id) {
                                                recordingId = recording.id;
                                                recordingUrl = `https://us-central1-tektrakker.cloudfunctions.net/ringCentralRecording?recordingId=${recording.id}&orgId=${orgId}`;
                                            }
                                            // Log call to messages collection for everyone
                                            await db.collection('messages').add({
                                                organizationId: orgId,
                                                senderId: direction === 'Inbound' ? customerId : 'staff',
                                                senderName: direction === 'Inbound' ? customerName : 'Staff',
                                                receiverId: 'all', // Show for everyone
                                                receiverName: direction === 'Inbound' ? 'Staff' : customerName,
                                                content: `${direction} call ${result === 'Connected' ? `completed (${Math.floor(duration / 60)}m ${duration % 60}s)` : `failed (${result})`}.`,
                                                type: 'call',
                                                status: result.toLowerCase() === 'connected' ? 'connected' : (result.toLowerCase().includes('missed') ? 'missed' : 'no-answer'),
                                                direction: direction.toLowerCase(),
                                                duration,
                                                recordingId,
                                                recordingUrl,
                                                timestamp: callRecord.startTime || new Date().toISOString(),
                                                createdAt: new Date().toISOString(),
                                                read: false
                                            });
                                            // Send SMS on missed if configured
                                            if (isMissed && config.rcSmsOnMissed && config.rcSmsTemplate) {
                                                try {
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
                                                catch (e) {
                                                    console.error("Failed to send Missed Call SMS:", e);
                                                }
                                            }
                                        }
                                        else {
                                            // Fallback if records is empty (RingCentral Call Log API latency)
                                            await db.collection('messages').add({
                                                organizationId: orgId,
                                                senderId: party.direction === 'Inbound' ? customerId : 'staff',
                                                senderName: party.direction === 'Inbound' ? customerName : 'Staff',
                                                receiverId: 'all',
                                                receiverName: party.direction === 'Inbound' ? 'Staff' : customerName,
                                                content: `${party.direction} call disconnected. Status: ${party.status?.code || 'Disconnected'} | Reason: ${party.status?.reason || 'Unknown'}`,
                                                type: 'call',
                                                status: isMissed ? 'missed' : 'connected',
                                                direction: party.direction?.toLowerCase() || 'inbound',
                                                duration: 0,
                                                timestamp: new Date().toISOString(),
                                                createdAt: new Date().toISOString(),
                                                read: false
                                            });
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                console.error("Failed to process call log in Disconnected webhook:", e);
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
                const customerMatch = await findCustomerByPhone(orgId, fromNumber);
                if (customerMatch) {
                    customerId = customerMatch.id;
                    customerName = customerMatch.name;
                }
                // Write Inbound SMS to Messages collection for everyone
                await db.collection('messages').add({
                    organizationId: orgId,
                    senderId: customerId,
                    senderName: customerName,
                    receiverId: 'all', // Show for everyone
                    content: text,
                    timestamp: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    read: false,
                    type: 'sms'
                });
                // Notify all Admins and employees of the organization
                const orgUsersSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .get().then(snap => snap.docs);
                const batch = db.batch();
                orgUsersSnap.forEach((userDoc) => {
                    const notifyRef = db.collection('notifications').doc();
                    batch.set(notifyRef, {
                        userId: userDoc.id,
                        organizationId: orgId,
                        title: 'New Text Message',
                        body: `From ${customerName} (${fromNumber}): ${text}`,
                        type: 'sms_received',
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        senderId: customerId,
                        data: { senderId: customerId }
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
        let detectedEnvironment = "production";
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
            console.log("Failed to authenticate with Production, trying Sandbox...");
            activeUrl = "https://platform.devtest.ringcentral.com";
            tokenResponse = await authenticate(activeUrl);
            if (!tokenResponse.ok) {
                const errBody = await tokenResponse.text();
                throw new Error(`Failed to authenticate with RingCentral (both Production and Sandbox failed). Sandbox response: ${errBody}`);
            }
            detectedEnvironment = "sandbox";
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
            ringCentralEnvironment: detectedEnvironment
        }, { merge: true });
        return { success: true, subscriptionId, environment: detectedEnvironment };
    }
    catch (error) {
        console.error("Register RingCentral Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to setup RingCentral integration.');
    }
});
// 3. HTTPS Endpoint to Proxy Recording Streams securely
exports.ringCentralRecording = functions.https.onRequest(async (req, res) => {
    try {
        const recordingId = req.query.recordingId;
        const orgId = req.query.orgId;
        if (!recordingId || !orgId) {
            res.status(400).send('Missing recordingId or orgId');
            return;
        }
        // Fetch secrets for organization
        const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!configDoc.exists) {
            res.status(404).send('Organization config not found');
            return;
        }
        const config = configDoc.data();
        const rcUrl = config.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
        const clientId = config.rcBackendClientId || config.ringCentralClientId;
        const clientSecret = config.ringCentralClientSecret || '';
        const jwtToken = config.ringCentralJwtToken;
        if (!clientId || !jwtToken) {
            res.status(401).send('RingCentral configuration incomplete');
            return;
        }
        // Get access token
        const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': jwtToken
            }).toString()
        });
        if (!tokenResponse.ok) {
            res.status(401).send('Failed to authenticate with RingCentral');
            return;
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        // Fetch recording audio content from RingCentral
        const recordingResponse = await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/recording/${recordingId}/content`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        if (!recordingResponse.ok) {
            res.status(recordingResponse.status).send('Failed to fetch recording content from RingCentral');
            return;
        }
        // Set response headers and send the audio stream back
        res.setHeader('Content-Type', recordingResponse.headers.get('Content-Type') || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const arrayBuffer = await recordingResponse.arrayBuffer();
        const buffer = buffer_1.Buffer.from(arrayBuffer);
        res.status(200).send(buffer);
    }
    catch (e) {
        console.error("Fetch recording error:", e);
        res.status(500).send('Internal server error');
    }
});
// 4. Callable to query RingCentral API for recent Call Logs & Recordings
exports.fetchRingCentralCallLogs = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { orgId, phone } = data;
    if (!orgId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing orgId.');
    try {
        const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!configDoc.exists) {
            return { records: [] };
        }
        const config = configDoc.data();
        const rcUrl = config.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
        const clientId = config.rcBackendClientId || config.ringCentralClientId;
        const clientSecret = config.ringCentralClientSecret || '';
        const jwtToken = config.ringCentralJwtToken;
        if (!clientId || !jwtToken) {
            return { records: [] };
        }
        const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': jwtToken
            }).toString()
        });
        if (!tokenResponse.ok)
            return { records: [] };
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const phoneDigits = (phone || '').replace(/\D/g, '');
        const logEndpoint = `${rcUrl}/restapi/v1.0/account/~/extension/~/call-log?view=Detailed&perPage=100`;
        const logRes = await fetch(logEndpoint, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!logRes.ok)
            return { records: [] };
        const logData = await logRes.json();
        const records = [];
        (logData.records || []).forEach((r) => {
            const fromDigits = (r.from?.phoneNumber || r.from?.extensionNumber || '').replace(/\D/g, '');
            const toDigits = (r.to?.phoneNumber || r.to?.extensionNumber || '').replace(/\D/g, '');
            const isPhoneMatch = !phoneDigits || fromDigits.includes(phoneDigits) || toDigits.includes(phoneDigits) || (phoneDigits.length >= 7 && (fromDigits.endsWith(phoneDigits.slice(-7)) || toDigits.endsWith(phoneDigits.slice(-7))));
            if (isPhoneMatch) {
                let recUrl = null;
                if (r.recording && r.recording.id) {
                    recUrl = `https://us-central1-tektrakker.cloudfunctions.net/ringCentralRecording?recordingId=${r.recording.id}&orgId=${orgId}`;
                }
                records.push({
                    id: r.id || `rc-${r.sessionId}`,
                    title: `RingCentral ${r.direction || 'Call'} (${r.result || 'Completed'})`,
                    direction: r.direction || 'Inbound',
                    duration: r.duration || 0,
                    recordingUrl: recUrl,
                    subject: `Call with ${r.from?.name || r.from?.phoneNumber || r.to?.name || r.to?.phoneNumber || 'Customer'}`,
                    content: `RingCentral call ${r.direction?.toLowerCase() || ''} - ${r.result || 'Ended'}. Duration: ${Math.floor((r.duration || 0) / 60)}m ${(r.duration || 0) % 60}s`,
                    timestamp: r.startTime || new Date().toISOString()
                });
            }
        });
        return { records };
    }
    catch (e) {
        console.error("fetchRingCentralCallLogs error:", e);
        return { records: [] };
    }
});
// 5. Callable & Trigger to Sync Customer Caller ID & Address Book Contact to RingCentral
exports.syncCustomerToRingCentral = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { orgId, customerId, syncAll } = data;
    if (!orgId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing orgId.');
    try {
        const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!configDoc.exists) {
            return { success: false, reason: 'RingCentral secrets config missing' };
        }
        const config = configDoc.data();
        const rcUrl = config.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
        const clientId = config.rcBackendClientId || config.ringCentralClientId;
        const clientSecret = config.ringCentralClientSecret || '';
        const jwtToken = config.ringCentralJwtToken;
        if (!clientId || !jwtToken) {
            return { success: false, reason: 'RingCentral configuration incomplete' };
        }
        // OAuth Token
        const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': jwtToken
            }).toString()
        });
        if (!tokenResponse.ok)
            return { success: false, reason: 'Failed to authenticate with RingCentral' };
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        // Get existing contacts from RingCentral Address Book
        const contactsRes = await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact?perPage=250`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const contactsData = await contactsRes.json();
        const existingContacts = contactsData.records || [];
        // Fetch customer or all customers
        let customersToSync = [];
        if (syncAll) {
            const snap = await db.collection('customers').where('organizationId', '==', orgId).get();
            snap.forEach(d => customersToSync.push({ id: d.id, ...d.data() }));
        }
        else if (customerId) {
            const custDoc = await db.collection('customers').doc(customerId).get();
            if (custDoc.exists) {
                customersToSync.push({ id: custDoc.id, ...custDoc.data() });
            }
        }
        let syncedCount = 0;
        for (const cust of customersToSync) {
            const phoneDigits = (cust.phone || '').replace(/\D/g, '');
            if (!phoneDigits || phoneDigits.length < 7)
                continue;
            const formattedPhone = phoneDigits.length === 10 ? `+1${phoneDigits}` : (phoneDigits.startsWith('1') ? `+${phoneDigits}` : `+${phoneDigits}`);
            const nameParts = (cust.name || 'Customer').trim().split(/\s+/);
            const firstName = nameParts[0] || 'TekTrakker';
            const lastName = nameParts.slice(1).join(' ') || 'Customer';
            const contactPayload = {
                firstName: firstName,
                lastName: lastName,
                company: cust.company || 'TekTrakker Customer',
                homePhone: formattedPhone,
                notes: `Synced from TekTrakker CRM (ID: ${cust.id})`
            };
            // Check if contact with matching phone already exists
            const existing = existingContacts.find(c => {
                const p = (c.homePhone || c.mobilePhone || c.businessPhone || '').replace(/\D/g, '');
                return p.includes(phoneDigits) || phoneDigits.includes(p);
            });
            if (existing && existing.id) {
                await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact/${existing.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(contactPayload)
                });
            }
            else {
                await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(contactPayload)
                });
            }
            syncedCount++;
        }
        return { success: true, syncedCount };
    }
    catch (e) {
        console.error("syncCustomerToRingCentral error:", e);
        return { success: false, reason: e.message || 'Error syncing to RingCentral' };
    }
});
// 6. Firestore Trigger on Customer Creation / Update to Auto-Sync Caller ID to RingCentral
exports.onCustomerWriteSyncRingCentral = functions.firestore
    .document('customers/{customerId}')
    .onWrite(async (change, context) => {
    const afterData = change.after.exists ? change.after.data() : null;
    if (!afterData || !afterData.organizationId || !afterData.phone)
        return;
    const orgId = afterData.organizationId;
    const phoneDigits = afterData.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 7)
        return;
    try {
        const configDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!configDoc.exists)
            return;
        const config = configDoc.data();
        const rcUrl = config.ringCentralEnvironment === 'sandbox' ? "https://platform.devtest.ringcentral.com" : "https://platform.ringcentral.com";
        const clientId = config.rcBackendClientId || config.ringCentralClientId;
        const clientSecret = config.ringCentralClientSecret || '';
        const jwtToken = config.ringCentralJwtToken;
        if (!clientId || !jwtToken)
            return;
        const tokenResponse = await fetch(`${rcUrl}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${buffer_1.Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': jwtToken
            }).toString()
        });
        if (!tokenResponse.ok)
            return;
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const contactsRes = await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact?perPage=250`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const contactsData = await contactsRes.json();
        const existingContacts = contactsData.records || [];
        const formattedPhone = phoneDigits.length === 10 ? `+1${phoneDigits}` : (phoneDigits.startsWith('1') ? `+${phoneDigits}` : `+${phoneDigits}`);
        const nameParts = (afterData.name || 'Customer').trim().split(/\s+/);
        const firstName = nameParts[0] || 'TekTrakker';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';
        const contactPayload = {
            firstName,
            lastName,
            company: afterData.company || 'TekTrakker Customer',
            homePhone: formattedPhone,
            notes: `Synced automatically from TekTrakker CRM`
        };
        const existing = existingContacts.find(c => {
            const p = (c.homePhone || c.mobilePhone || c.businessPhone || '').replace(/\D/g, '');
            return p.includes(phoneDigits) || phoneDigits.includes(p);
        });
        if (existing && existing.id) {
            await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact/${existing.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(contactPayload)
            });
        }
        else {
            await fetch(`${rcUrl}/restapi/v1.0/account/~/extension/~/address-book/contact`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(contactPayload)
            });
        }
    }
    catch (err) {
        console.error("onCustomerWriteSyncRingCentral trigger error:", err);
    }
});
//# sourceMappingURL=ringCentral.js.map