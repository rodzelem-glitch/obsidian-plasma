import { cleanUndefinedFields } from '../../lib/utils';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { getCurrentLocation } from '../../lib/geolocation';
import { Geolocation } from '@capacitor/geolocation';
import showToast from '../../lib/toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { MapPin } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';

interface BackgroundLocationPermissionPluginType {
    checkBackgroundPermission(): Promise<{ granted: boolean }>;
    requestBackgroundPermission(): Promise<{ granted: boolean }>;
}

const BackgroundLocationPermission = registerPlugin<BackgroundLocationPermissionPluginType>('BackgroundLocationPermission');

const LocationTracker: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser: user } = state;
    const [showDisclosure, setShowDisclosure] = useState(false);
    const triggerWatchRef = useRef<() => void>();

    // Active shift for the current user: at least one shift with no clockOut
    // Handles both array and mapped object representations of shiftLogs safely
    const hasActiveShift = useMemo(() => {
        if (!user) return false;
        const logs = Array.isArray(state.shiftLogs)
            ? state.shiftLogs.filter(log => log.userId === user.id)
            : (state.shiftLogs[user.id] || []);
        return logs.some(log => !log.clockOut);
    }, [state.shiftLogs, user]);

    useEffect(() => {
        if (!user) return;

        const isTechnician = (
            user.role === 'employee' || 
            user.role === 'both' || 
            user.role === 'supervisor' || 
            user.role === 'Technician' || 
            user.role === 'Subcontractor' || 
            user.role === 'admin' // Admins in field should also be tracked
        );

        if (!isTechnician || !hasActiveShift) {
            return;
        }

        console.log(`[LocationTracker] Starting real-time location watch for ${user.firstName}...`);
        
        let watchId: any = null;
        let lastUpdateTime = 0;

        const handleLocationUpdate = async (latitude: number, longitude: number) => {
            const now = Date.now();
            // Ensure we don't spam Firestore: minimum 30 seconds between updates
            if (now - lastUpdateTime < 30000) return;

            // Update throttle timestamp immediately to prevent concurrent updates during the async write
            lastUpdateTime = now;

            const locationData = {
                lat: latitude,
                lng: longitude,
                timestamp: new Date().toISOString()
            };

            try {
                await db.collection('users').doc(user.id).update(cleanUndefinedFields({ 
                    location: locationData,
                    lastLocationUpdate: locationData.timestamp
                }));
                
                // Update local state to keep admin/tracking UI in sync
                dispatch({ 
                    type: 'UPDATE_EMPLOYEE', 
                    payload: { ...user, location: locationData } 
                });
                
                console.log(`[LocationTracker] Real-time location sync successful for ${user.firstName}:`, locationData);
            } catch (e) {
                console.error("[LocationTracker] Failed to auto-update location in Firestore:", e);
            }
        };

        let isCancelled = false;

        // Try getting initial position immediately to establish current location
        const initLocation = async () => {
            const loc = await getCurrentLocation();
            if (isCancelled) return;
            if (loc) {
                await handleLocationUpdate(loc.latitude, loc.longitude);
            }
        };
        initLocation();

        // Setup the push watch subscription
        const startWatching = async () => {
            try {
                const permissions = await Geolocation.checkPermissions();
                if (isCancelled) return;

                if (permissions.location !== 'granted') {
                    triggerWatchRef.current = async () => {
                        try {
                            const result = await Geolocation.requestPermissions();
                            if (result.location === 'granted') {
                                showToast.success('Foreground location permission granted');
                                startWatching();
                            } else {
                                showToast.error('Location permission denied');
                            }
                        } catch (err) {
                            console.error("[LocationTracker] Foreground permission request error:", err);
                        }
                    };
                    setShowDisclosure(true);
                    return;
                }

                // Foreground is granted, check background
                try {
                    const bgStatus = await BackgroundLocationPermission.checkBackgroundPermission();
                    if (!bgStatus.granted) {
                        triggerWatchRef.current = async () => {
                            try {
                                const result = await BackgroundLocationPermission.requestBackgroundPermission();
                                if (result.granted) {
                                    showToast.success('Background location permission granted');
                                    startWatching();
                                } else {
                                    showToast.warn('Please select "Allow all the time" in your device Settings to track shifts in the background.');
                                }
                            } catch (err) {
                                console.error("[LocationTracker] Background permission request error:", err);
                            }
                        };
                        setShowDisclosure(true);
                        return;
                    }
                } catch (e) {
                    console.warn("[LocationTracker] Background permission check failed (might not be running on Android native):", e);
                }

                let consecutiveErrors = 0;

                const setupWatch = async (useHighAccuracy: boolean) => {
                    if (isCancelled) return;
                    try {
                        const id = await Geolocation.watchPosition({
                            enableHighAccuracy: useHighAccuracy,
                            timeout: 15000,
                            maximumAge: 0
                        }, (position, err) => {
                            if (isCancelled) {
                                if (id) Geolocation.clearWatch({ id }).catch(() => {});
                                return;
                            }
                            if (err) {
                                console.warn(`[LocationTracker] watchPosition error (highAccuracy=${useHighAccuracy}):`, err);
                                consecutiveErrors++;
                                if (useHighAccuracy && consecutiveErrors >= 2) {
                                    console.log("[LocationTracker] Switching watch to low accuracy due to consecutive errors.");
                                    if (watchId) {
                                        Geolocation.clearWatch({ id: watchId }).catch(() => {});
                                        watchId = null;
                                    }
                                    consecutiveErrors = 0;
                                    setupWatch(false);
                                }
                                return;
                            }
                            if (position) {
                                consecutiveErrors = 0;
                                handleLocationUpdate(position.coords.latitude, position.coords.longitude);
                            }
                        });

                        if (isCancelled) {
                            Geolocation.clearWatch({ id }).catch(() => {});
                        } else {
                            watchId = id;
                        }
                    } catch (watchErr) {
                        console.warn("[LocationTracker] Capacitor watchPosition setup failed:", watchErr);
                        setupBrowserWatch(useHighAccuracy);
                    }
                };

                const setupBrowserWatch = (useHighAccuracy: boolean) => {
                    if (isCancelled || !navigator.geolocation) return;
                    
                    let bConsecutiveErrors = 0;
                    const id = navigator.geolocation.watchPosition(
                        (pos) => {
                            if (isCancelled) {
                                navigator.geolocation.clearWatch(id);
                                return;
                            }
                            bConsecutiveErrors = 0;
                            handleLocationUpdate(pos.coords.latitude, pos.coords.longitude);
                        },
                        (err) => {
                            console.warn(`[LocationTracker] Browser watchPosition error (highAccuracy=${useHighAccuracy}):`, err);
                            bConsecutiveErrors++;
                            if (useHighAccuracy && bConsecutiveErrors >= 2) {
                                console.log("[LocationTracker] Switching browser watch to low accuracy.");
                                navigator.geolocation.clearWatch(id);
                                if (watchId === id) watchId = null;
                                setupBrowserWatch(false);
                            }
                        },
                        { enableHighAccuracy: useHighAccuracy, timeout: 10000, maximumAge: 0 }
                    );

                    if (isCancelled) {
                        navigator.geolocation.clearWatch(id);
                    } else {
                        watchId = id;
                    }
                };

                await setupWatch(true);

            } catch (e) {
                console.warn("[LocationTracker] Outer watchPosition setup failed, trying browser fallback:", e);
                if (navigator.geolocation && !isCancelled) {
                    const id = navigator.geolocation.watchPosition(
                        (pos) => {
                            if (isCancelled) {
                                navigator.geolocation.clearWatch(id);
                                return;
                            }
                            handleLocationUpdate(pos.coords.latitude, pos.coords.longitude);
                        },
                        (err) => {
                            console.warn("[LocationTracker] Browser Geolocation watchPosition error:", err);
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                    if (isCancelled) {
                        navigator.geolocation.clearWatch(id);
                    } else {
                        watchId = id;
                    }
                }
            }
        };

        startWatching();

        return () => {
            isCancelled = true;
            console.log(`[LocationTracker] Stopping real-time location watch for ${user.firstName}`);
            if (watchId !== null) {
                if (typeof watchId === 'string') {
                    Geolocation.clearWatch({ id: watchId }).catch(err => console.error("[LocationTracker] Error clearing Capacitor watch:", err));
                } else {
                    navigator.geolocation.clearWatch(watchId);
                }
            }
        };
    }, [user?.id, hasActiveShift, dispatch]);

    if (!showDisclosure) return null;

    return (
        <Modal
            isOpen={showDisclosure}
            onClose={() => setShowDisclosure(false)}
            title="Location Services Required"
            size="md"
        >
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <MapPin size={32} />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Enable Background Location Tracking
                </h3>
                
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                    TekTrakker collects location data to track your position during active shifts. This data is used to:
                </p>
                
                <ul className="text-sm text-slate-600 dark:text-slate-300 text-left space-y-2 list-disc list-inside w-full">
                    <li>Calculate real-time ETAs for assigned customer visits</li>
                    <li>Update dispatchers on job progress automatically</li>
                    <li>Provide roadside assistance and verify tech safety</li>
                </ul>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl p-3.5 text-left w-full">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        🔒 Active Background Tracking Only
                    </p>
                    <p className="text-xs text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                        Location is accessed in the background (even when the app is closed or not in use) **only when you are actively clocked in**. Tracking stops automatically when you clock out.
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3.5 text-left w-full text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                        How to enable:
                    </p>
                    <p>1. Tap <strong>Accept & Continue</strong> below.</p>
                    <p>2. Select <strong>Allow while using app</strong> on the system prompt.</p>
                    <p>3. To track when your screen is locked, select <strong>"Allow all the time"</strong> when prompted, or configure it in your device's <em>Settings &gt; Apps &gt; TekTrakker &gt; Permissions &gt; Location</em>.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => setShowDisclosure(false)}
                        className="w-full sm:w-1/2 order-2 sm:order-1"
                    >
                        Decline
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={async () => {
                            setShowDisclosure(false);
                            if (triggerWatchRef.current) {
                                await triggerWatchRef.current();
                            }
                        }}
                        className="w-full sm:w-1/2 order-1 sm:order-2"
                    >
                        Accept & Continue
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LocationTracker;
