import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { getCurrentLocation } from '../../lib/geolocation';

const LocationTracker: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const userRef = useRef(state.currentUser);
    const lastUpdateRef = useRef<number>(0);

    // Keep userRef synced without triggering effect rerun
    useEffect(() => {
        userRef.current = state.currentUser;
    }, [state.currentUser]);

    useEffect(() => {
        const updateLocation = async () => {
            const user = userRef.current;
            if (!user) return;

            // Only track technicians/employees when they have an active shift
            const isTechnician = (
                user.role === 'employee' || 
                user.role === 'both' || 
                user.role === 'supervisor' || 
                user.role === 'Technician' || 
                user.role === 'admin' // Admins in field should also be tracked
            );

            if (!isTechnician) return;

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

        // Try right away
        updateLocation();
        
        // Setup an interval that does NOT get cleared on user updates
        const interval = setInterval(updateLocation, 180000); // 3 minutes

        return () => clearInterval(interval);
    }, [dispatch]); // Removed 'user' dependency so it doesn't constantly reset

    return null;
};

export default LocationTracker;
