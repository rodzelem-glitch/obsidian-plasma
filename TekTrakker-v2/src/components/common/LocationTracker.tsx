import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { getCurrentLocation } from '../../lib/geolocation';

const LocationTracker: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser: user } = state;
    const lastUpdateRef = useRef<number>(0);

    // Active shift for the current user: at least one shift with no clockOut
    const hasActiveShift = React.useMemo(() => {
        if (!user) return false;
        const userLogs = state.shiftLogs[user.id] || [];
        return userLogs.some(log => !log.clockOut);
    }, [state.shiftLogs, user]);

    useEffect(() => {
        // Only track technicians/employees when they have an active shift
        const isTechnician = user && (
            user.role === 'employee' || 
            user.role === 'both' || 
            user.role === 'supervisor' || 
            user.role === 'Technician' || 
            user.role === 'admin' // Admins in field should also be tracked
        );

        if (!user || !isTechnician || !hasActiveShift) {
            return;
        }

        const updateLocation = async () => {
            const now = Date.now();
            // Ensure we don't spam Firestore: minimum 2 minutes between updates
            if (now - lastUpdateRef.current < 120000) return;

            console.log(`[LocationTracker] Updating location for ${user.firstName}...`);
            const loc = await getCurrentLocation();
            
            if (loc) {
                const locationData = {
                    lat: loc.latitude,
                    lng: loc.longitude,
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
                    
                    lastUpdateRef.current = now;
                    console.log(`[LocationTracker] Location sync successful for ${user.firstName}`);
                } catch (e) {
                    console.error("Failed to auto-update location:", e);
                }
            }
        };

        // Initial update and subsequent heartbeat
        updateLocation();
        const interval = setInterval(updateLocation, 180000); // 3 minutes

        return () => clearInterval(interval);
    }, [user, hasActiveShift, dispatch]);

    return null;
};

export default LocationTracker;
