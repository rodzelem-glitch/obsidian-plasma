import React, { useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { getCurrentLocation } from '../../lib/geolocation';
import { Geolocation } from '@capacitor/geolocation';

const LocationTracker: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser: user } = state;

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

        // Only track technicians/employees when they have an active shift
        const isTechnician = (
            user.role === 'employee' || 
            user.role === 'both' || 
            user.role === 'supervisor' || 
            user.role === 'Technician' || 
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

            const locationData = {
                lat: latitude,
                lng: longitude,
                timestamp: new Date().toISOString()
            };

            try {
                await db.collection('users').doc(user.id).update({ 
                    location: locationData,
                    lastLocationUpdate: locationData.timestamp
                });
                
                // Update local state to keep admin/tracking UI in sync
                dispatch({ 
                    type: 'UPDATE_EMPLOYEE', 
                    payload: { ...user, location: locationData } 
                });
                
                lastUpdateTime = now;
                console.log(`[LocationTracker] Real-time location sync successful for ${user.firstName}:`, locationData);
            } catch (e) {
                console.error("[LocationTracker] Failed to auto-update location in Firestore:", e);
            }
        };

        // Try getting initial position immediately to establish current location
        const initLocation = async () => {
            const loc = await getCurrentLocation();
            if (loc) {
                await handleLocationUpdate(loc.latitude, loc.longitude);
            }
        };
        initLocation();

        // Setup the push watch subscription
        const startWatching = async () => {
            try {
                const permissions = await Geolocation.checkPermissions();
                if (permissions.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        console.warn("[LocationTracker] Geolocation permissions not granted.");
                        return;
                    }
                }

                watchId = await Geolocation.watchPosition({
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }, (position, err) => {
                    if (err) {
                        console.warn("[LocationTracker] watchPosition error:", err);
                        return;
                    }
                    if (position) {
                        handleLocationUpdate(position.coords.latitude, position.coords.longitude);
                    }
                });
            } catch (e) {
                console.warn("[LocationTracker] Capacitor watchPosition failed, attempting browser fallback:", e);
                if (navigator.geolocation) {
                    watchId = navigator.geolocation.watchPosition(
                        (pos) => {
                            handleLocationUpdate(pos.coords.latitude, pos.coords.longitude);
                        },
                        (err) => {
                            console.warn("[LocationTracker] Browser Geolocation watchPosition error:", err);
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                }
            }
        };

        startWatching();

        return () => {
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

    return null;
};

export default LocationTracker;
