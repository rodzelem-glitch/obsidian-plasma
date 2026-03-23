
import React, { useMemo, useState } from 'react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import type { User, Job } from 'types';
import TechList from './tracking/components/TechList';
import TrackingMap from './tracking/components/TrackingMap';
import { Navigation } from 'lucide-react';
import { getCurrentLocation } from 'lib/geolocation';

const TechTracking: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;
    
    const allTechs = useMemo(() => {
        return (state.users as User[])
            .filter((u: User) => 
                u.organizationId === state.currentOrganization?.id && 
                (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor') &&
                (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
            )
            .map((u: User) => {
                const hasLocation = !!u.location;
                let isOnline = false;
                let diffMins = 0;
                if (hasLocation && u.location) { // Add null check for u.location
                    diffMins = (new Date().getTime() - new Date(u.location.timestamp).getTime()) / 60000;
                    isOnline = diffMins < 60; 
                }
                const activeJob = (state.jobs as Job[]).find(j => j.assignedTechnicianId === u.id && j.jobStatus === 'In Progress');
                return { ...u, isOnline, diffMins, activeJob, hasLocation };
            });
    }, [state.users, state.jobs, state.currentOrganization, currentUser]);

    const mappedTechs = useMemo(() => allTechs.filter(t => t.hasLocation), [allTechs]);

    const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
        if (mappedTechs.length > 0 && mappedTechs[0].location) { // Add null check for mappedTechs[0].location
            return [mappedTechs[0].location.lat, mappedTechs[0].location.lng];
        }
        return [39.8283, -98.5795];
    });

    const jumpToTech = (tech: any) => {
        if (tech.location) {
            setMapCenter([tech.location.lat, tech.location.lng]);
        }
    };

    const handleForceUpdate = async () => {
        if (!currentUser) return;
        const loc = await getCurrentLocation();
        if (loc) {
            const locationData = { lat: loc.latitude, lng: loc.longitude, timestamp: new Date().toISOString() };
            await db.collection('users').doc(currentUser.id).update({ location: locationData });
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, location: locationData } });
            setMapCenter([locationData.lat, locationData.lng]);
            alert('Location updated!');
        } else {
            alert('Failed to update location. Please ensure location services are enabled and permissions granted.');
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-4 px-4 sm:px-0 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Technician Tracking</h2>
                    <p className="text-gray-600">Real-time location monitoring.</p>
                </div>
                <Button onClick={handleForceUpdate} variant="secondary" className="w-auto flex items-center gap-2 text-xs">
                    <Navigation size={14} /> Force My Location Update
                </Button>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                <TechList techs={allTechs} onTechSelect={jumpToTech} />
                <TrackingMap techs={mappedTechs} center={mapCenter} />
            </div>
        </div>
    );
};

export default TechTracking;
