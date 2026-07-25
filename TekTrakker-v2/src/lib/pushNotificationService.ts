import { cleanUndefinedFields } from './utils';
import { messaging, db } from './firebase';
import { firebase } from './firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const VAPID_KEY = "BAyIBglImyH-kWG0p4VhTcsK59cqTelDxdV5Ji2ajDCChbYih5jrv7cnwe8BSot_poxOxCB1ifqkSwGafzhnc6c";

// Track initialized users in-memory to prevent repeated FCM registration loops within the same window session
const initializedFcmUsers = new Set<string>();

export const setupFCMToken = async (userId: string) => {
    if (!userId || initializedFcmUsers.has(userId)) {
        return;
    }
    initializedFcmUsers.add(userId);

    console.log('[FCM] Starting setupFCMToken for user', userId);

    if (Capacitor.isNativePlatform()) {
        console.log('[FCM-Capacitor] Initializing Native Push Notifications...');
        try {
            const authStatus = await PushNotifications.requestPermissions();
            if (authStatus.receive !== 'granted') {
                console.warn('[FCM-Capacitor] Push permission denied by user');
                return;
            }

            if (Capacitor.getPlatform() === 'android') {
                try {
                    await PushNotifications.createChannel({
                        id: 'default',
                        name: 'Default Notifications',
                        description: 'General app notifications',
                        importance: 5,
                        visibility: 1,
                    });
                } catch (channelErr) {
                    console.warn('[FCM-Capacitor] Could not create notification channel', channelErr);
                }
            }

            await PushNotifications.addListener('registration', async (token) => {
                const fcmToken = token.value;
                console.log('[FCM-Capacitor] Push registration success, token: ' + fcmToken);
                
                try {
                    await db.collection('users').doc(userId).set(cleanUndefinedFields({
                        fcmTokens: firebase.firestore.FieldValue.arrayUnion(fcmToken)
                    }), { merge: true });
                    console.log('[FCM-Capacitor] Native token synced to Firestore');
                } catch (dbErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.warn('[FCM-Capacitor] Could not sync token (likely Demo Mode):', dbErr.message);
                }
            });

            await PushNotifications.addListener('registrationError', (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                console.error('[FCM-Capacitor] Error on registration: ' + JSON.stringify(error));
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[FCM-Capacitor] Target Notification received in foreground: ', notification);
            });

            await PushNotifications.register();

        } catch (err) {
            console.error('[FCM-Capacitor] Critical initialization error:', err);
        }

        return;
    }

    // --- FALLBACK TO PURE WEB PUSH FOR BROWSER / PWA ---
    if (!messaging) {
        console.warn('[FCM] Messaging is null. The device may not support Web Push, or Firebase config is missing.');
        return;
    }

    try {
        console.log('[FCM] Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('[FCM] Permission status:', permission);
        
        if (permission === 'granted') {
            console.log('[FCM] Obtaining token via VAPID key...');
            
            // Reuse active service worker if registered to prevent SW update loops
            let registration: ServiceWorkerRegistration | undefined;
            try {
                if ('serviceWorker' in navigator) {
                    const existingRegs = await navigator.serviceWorker.getRegistrations();
                    registration = existingRegs.find(r => r.active);
                    if (!registration) {
                        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    }
                }
                if (registration && (registration.installing || registration.waiting)) {
                    await navigator.serviceWorker.ready;
                }
            } catch (swErr) {
                console.warn('[FCM] Failed to query/register service worker:', swErr);
            }

            const token = await messaging.getToken({ 
                vapidKey: VAPID_KEY,
                ...(registration ? { serviceWorkerRegistration: registration } : {})
            });
            
            if (token) {
                console.log('[FCM] Successfully obtained token:', token.substring(0, 15) + '...');
                // Save the token to the user document
                try {
                    await db.collection('users').doc(userId).set(cleanUndefinedFields({
                        fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
                    }), { merge: true });
                    console.log('[FCM] Successfully synced token to Firestore!');
                } catch (dbErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.warn('[FCM] Could not sync token (likely Demo Mode):', dbErr.message);
                }
                
                // AUTOMATIC DEBUG FIRE: (DISABLED) Write a test notification so we can prove the backend works
                /*
                console.log('[FCM] Dispatching test dummy notification to backend router...');
                try {
                    await db.collection('notifications').add(cleanUndefinedFields({
                        userId: userId,
                        title: "Test FCM Notification",
                        body: "If you see this, the entire pipeline is 100% working!",
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }));
                    console.log('[FCM] Test notification safely injected into database.');
                } catch(dbErr) {
                    console.error('[FCM] Failed to inject test notification!', dbErr);
                }
                */

                // Set up foreground listener
                messaging.onMessage((payload) => {
                    console.log('[FCM] Foreground push message received:', payload);
                });
            } else {
                console.warn('[FCM] Token generation failed or returned null.');
            }
        } else {
            console.warn('[FCM] Push notification permission denied by user.');
        }
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        if (error?.name === 'AbortError' || error?.message?.includes('Service Worker') || error?.message?.includes('Failed to execute \'subscribe\' on \'PushManager\'')) {
            console.log('[FCM] Skipped Web Push Notification setup (No valid Service Worker, typical for local development environments).');
        } else {
            console.error('[FCM] Critical error occurred while retrieving token:', error);
        }
    }

};
