import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

export const onNotificationCreated = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        if (!notification) return;

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
            let tokens: string[] = [];
            if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                tokens = userData.fcmTokens;
            } else if (userData.fcmToken) {
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

        } catch (error) {
            console.error(`Error sending push notification to user ${userId}:`, error);
            await snap.ref.update({
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                deliveredAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });
