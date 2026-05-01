import { messaging, db } from './firebase';
import { firebase } from './firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const VAPID_KEY = "BAyIBglImyH-kWG0p4VhTcsK59cqTelDxdV5Ji2ajDCChbYih5jrv7cnwe8BSot_poxOxCB1ifqkSwGafzhnc6c";

export const setupFCMToken = async (userId: string) => {
    console.log('[FCM] Starting setupFCMToken for user', userId);

    if (Capacitor.isNativePlatform()) {
        console.log('[FCM-Capacitor] Initializing Native Push Notifications...');
        try {
            // Request permission to use push notifications
            // iOS will prompt user and return if they granted permission or not
            // Android will just grant without prompting
            const authStatus = await PushNotifications.requestPermissions();
            if (authStatus.receive !== 'granted') {
                console.warn('[FCM-Capacitor] Push permission denied by user');
                return;
            }

            // IMPORTANT: Listeners MUST be attached BEFORE calling register()!
            // Otherwise the native layer emits the event before JavaScript is listening.
            await PushNotifications.addListener('registration', async (token) => {
                const fcmToken = token.value;
                console.log('[FCM-Capacitor] Push registration success, token: ' + fcmToken);
                
                try {
                    await db.collection('users').doc(userId).set({
                        fcmTokens: firebase.firestore.FieldValue.arrayUnion(fcmToken)
                    }, { merge: true });
                    console.log('[FCM-Capacitor] Native token synced to Firestore');
                } catch (dbErr: any) {
                    console.warn('[FCM-Capacitor] Could not sync token (likely Demo Mode):', dbErr.message);
                }
            });

            await PushNotifications.addListener('registrationError', (error: any) => {
                console.error('[FCM-Capacitor] Error on registration: ' + JSON.stringify(error));
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[FCM-Capacitor] Target Notification received in foreground: ', notification);
            });

            // Register with Apple / Google to receive push via APNS/FCM
            await PushNotifications.register();

        } catch (err) {
            console.error('[FCM-Capacitor] Critical initialization error:', err);
        }

        return; // EXIT EARLY so we don't attempt Web Push
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
            
            // Explicitly register the service worker to prevent 'no active Service Worker' race conditions
            let registration;
            try {
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('[FCM] Service worker explicitly registered for messaging:', registration);
                
                // Wait for the service worker to be active
                if (registration.installing || registration.waiting) {
                   console.log('[FCM] Service worker installing/waiting... waiting for ready state.');
                   await navigator.serviceWorker.ready;
                   console.log('[FCM] Service worker is now active and ready!');
                } else if (registration.active) {
                   console.log('[FCM] Service worker active.');
                }
            } catch (swErr) {
                console.error('[FCM] Failed to register service worker:', swErr);
                return;
            }

            const token = await messaging.getToken({ 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration 
            });
            
            if (token) {
                console.log('[FCM] Successfully obtained token:', token.substring(0, 15) + '...');
                // Save the token to the user document
                try {
                    await db.collection('users').doc(userId).set({
                        fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
                    }, { merge: true });
                    console.log('[FCM] Successfully synced token to Firestore!');
                } catch (dbErr: any) {
                    console.warn('[FCM] Could not sync token (likely Demo Mode):', dbErr.message);
                }
                
                // AUTOMATIC DEBUG FIRE: (DISABLED) Write a test notification so we can prove the backend works
                /*
                console.log('[FCM] Dispatching test dummy notification to backend router...');
                try {
                    await db.collection('notifications').add({
                        userId: userId,
                        title: "Test FCM Notification",
                        body: "If you see this, the entire pipeline is 100% working!",
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });
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
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message?.includes('Service Worker') || error?.message?.includes('Failed to execute \'subscribe\' on \'PushManager\'')) {
            console.log('[FCM] Skipped Web Push Notification setup (No valid Service Worker, typical for local development environments).');
        } else {
            console.error('[FCM] Critical error occurred while retrieving token:', error);
        }
    }

};
