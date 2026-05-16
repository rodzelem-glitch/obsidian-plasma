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
exports.onNotificationCreated = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
exports.onNotificationCreated = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
    const notification = snap.data();
    if (!notification)
        return;
    const userId = notification.userId;
    if (!userId) {
        console.log(`No userId found in notification ${context.params.notificationId}`);
        return;
    }
    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userData) {
            console.log(`No user data found for userId ${userId}`);
            return;
        }
        // Retrieve fcmToken (string) or fcmTokens (array)
        let tokens = [];
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
            tokens = userData.fcmTokens;
        }
        else if (userData.fcmToken) {
            tokens = [userData.fcmToken];
        }
        if (tokens.length === 0) {
            console.log(`No FCM tokens found for user ${userId}`);
            return;
        }
        const message = {
            notification: {
                title: notification.title || 'New Notification',
                body: notification.message || notification.body || '',
            },
            android: {
                notification: {
                    channelId: 'default',
                }
            },
            data: {
                url: notification.link || notification.url || '/',
                type: notification.type || 'general'
            },
            tokens: tokens
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent push notifications to user ${userId}:`, response);
        // Mark the notification as processed/sent if needed, though mostly used for mobile push delivery logs.
        await snap.ref.update({
            status: 'delivered',
            deliveredAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (error) {
        console.error(`Error sending push notification to user ${userId}:`, error);
        await snap.ref.update({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            deliveredAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});
//# sourceMappingURL=notifications.js.map