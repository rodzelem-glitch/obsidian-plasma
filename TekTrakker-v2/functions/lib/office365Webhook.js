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
exports.office365Webhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin if not already done in index.ts
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Microsoft Graph Webhook Endpoint
 * Receives POST requests from Microsoft when a new email arrives in a subscribed user's inbox.
 */
exports.office365Webhook = functions.https.onRequest(async (req, res) => {
    // 1. Validation Token Challenge
    // When creating a subscription, Microsoft sends a validationToken in the URL query.
    // We MUST respond with this exact plain text token within 10 seconds.
    if (req.query && req.query.validationToken) {
        res.set('Content-Type', 'text/plain');
        res.status(200).send(req.query.validationToken);
        return;
    }
    // 2. Process Incoming Notifications
    // The body will contain an array of 'value' objects representing the notifications.
    const notifications = req.body.value;
    if (!notifications || !Array.isArray(notifications)) {
        res.status(202).send(); // Always return 202 Accepted to acknowledge receipt
        return;
    }
    res.status(202).send(); // Acknowledge early to prevent timeout retries from Microsoft
    for (const notification of notifications) {
        try {
            const { resource, subscriptionId, clientState } = notification;
            // Optional: Validate clientState to ensure the request is actually from our subscription
            if (clientState !== 'tektrakker-secure-webhook-secret') {
                console.warn('Invalid clientState from Microsoft Graph Webhook.');
                continue;
            }
            // At this point, we only have the resource (message ID).
            // To get the actual email Subject and Sender, we need to query Microsoft Graph
            // using an App-Only token or a user's stored Refresh Token.
            // For now, we will just send a generic push notification to the user who owns the subscription.
            // We look up the TekTrakker user based on the subscriptionId stored in Firestore.
            const subscriptionsSnapshot = await admin.firestore()
                .collection('office365_subscriptions')
                .where('subscriptionId', '==', subscriptionId)
                .limit(1)
                .get();
            if (subscriptionsSnapshot.empty) {
                console.warn(`No user found for subscription: ${subscriptionId}`);
                continue;
            }
            const subDoc = subscriptionsSnapshot.docs[0];
            const userId = subDoc.data().userId;
            // Fetch the user's FCM tokens
            const fcmSnapshot = await admin.firestore().collection('fcmTokens').doc(userId).get();
            if (fcmSnapshot.exists) {
                const tokenData = fcmSnapshot.data();
                if (tokenData && tokenData.fcmToken) {
                    await admin.messaging().send({
                        token: tokenData.fcmToken,
                        notification: {
                            title: 'New Office 365 Email',
                            body: 'You received a new email in your Master Inbox.',
                        },
                        data: {
                            type: 'new_email',
                            resource: resource
                        }
                    }).catch(err => console.error('Error sending push notification:', err));
                    console.log(`Push notification sent to user: ${userId}`);
                }
            }
            // Create in-app notification
            await admin.firestore().collection('notifications').add({
                userId,
                title: 'New Office 365 Email',
                message: 'You received a new email in your Master Inbox.',
                type: 'new_email',
                read: false,
                status: 'pending',
                createdAt: new Date().toISOString(),
                link: '/admin/emails'
            });
        }
        catch (error) {
            console.error('Error processing Microsoft Graph notification:', error);
        }
    }
});
//# sourceMappingURL=office365Webhook.js.map