import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useMemo, useState, useEffect } from 'react';
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
    
    console.log("[TechTracking-Debug] State Subcontractors:", state.subcontractors, "State Users:", state.users?.length, state.users);
    
    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'subcontractor', 'admin']);

    const allTechs = useMemo(() => {
        const linkedSubOrgIds = (state.subcontractors || [])
            .filter(sub => sub.handshakeStatus === 'Linked' && sub.linkedOrgId)
            .map(sub => sub.linkedOrgId as string);
        const allowedOrgIds = new Set([state.currentOrganization?.id, ...linkedSubOrgIds].filter(Boolean));

        return (state.users as User[])
            .filter((u: User) => 
                allowedOrgIds.has(u.organizationId) && 
                u.status !== 'archived' &&
                WORKFORCE_ROLES.has((u.role || '').toLowerCase()) &&
                (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
            )
            .map((u: User) => {
                const hasLocation = !!u.location;
                let isOnline = false;
                let diffMins = 0;
                if (hasLocation && u.location) {
                    diffMins = (new Date().getTime() - new Date(u.location.timestamp).getTime()) / 60000;
                    isOnline = diffMins < 60; 
                }
                const activeJob = (state.jobs as Job[]).find(j => j.assignedTechnicianId === u.id && j.jobStatus === 'In Progress');

                let companyLabel = '';
                let subcontractorId = '';
                let isSubcontractorTech = false;
                
                if (u.organizationId !== state.currentOrganization?.id) {
                    const subOrg = state.subcontractors?.find((s: any) => 
                        (s.organizationId === u.organizationId && s.linkedOrgId === state.currentOrganization?.id) ||
                        (s.linkedOrgId === u.organizationId && s.organizationId === state.currentOrganization?.id)
                    );
                    if (subOrg) {
                        companyLabel = subOrg.companyName || 'External Sub';
                        subcontractorId = subOrg.id || '';
                        isSubcontractorTech = true;
                    }
                } else if (u.role?.toLowerCase() === 'subcontractor') {
                    const subOrg = state.subcontractors?.find((s: any) => 
                        s.id === u.id || 
                        s.email?.toLowerCase() === u.email?.toLowerCase()
                    );
                    if (subOrg) {
                        companyLabel = subOrg.companyName || 'Subcontractor';
                        subcontractorId = subOrg.id || '';
                        isSubcontractorTech = true;
                    }
                } else if (u.subcontractorId) {
                    const subOrg = state.subcontractors?.find((s: any) => s.id === u.subcontractorId);
                    if (subOrg) {
                        companyLabel = subOrg.companyName || 'Subcontractor';
                        subcontractorId = subOrg.id || '';
                        isSubcontractorTech = true;
                    } else {
                        const parentUser = (state.users as User[])?.find(usr => usr.id === u.subcontractorId);
                        if (parentUser) {
                            const subOrgByEmail = state.subcontractors?.find((s: any) => 
                                s.id === parentUser.id ||
                                s.email?.toLowerCase() === parentUser.email?.toLowerCase()
                            );
                            if (subOrgByEmail) {
                                companyLabel = subOrgByEmail.companyName || 'Subcontractor';
                                subcontractorId = subOrgByEmail.id || '';
                                isSubcontractorTech = true;
                            }
                        }
                    }
                }

                console.log(`[TechTracking-Debug] tech: ${u.firstName} ${u.lastName} | role: ${u.role} | org: ${u.organizationId} | isSubTech: ${isSubcontractorTech} | companyLabel: ${companyLabel} | subOrgId: ${subcontractorId}`);

                return { ...u, isOnline, diffMins, activeJob, hasLocation, companyLabel, subcontractorId, isSubcontractorTech };
            });
    }, [state.users, state.jobs, state.currentOrganization, currentUser, state.subcontractors]);

    const [fleetPositions, setFleetPositions] = useState<any[]>([]);

    useEffect(() => {
        if (!state.currentOrganization?.id) return;
        
        const unsubscribe = db.collection(`organizations/${state.currentOrganization.id}/fleet_positions`)
            .onSnapshot(snapshot => {
                const positions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setFleetPositions(positions);
            }, error => {
                console.error("Fleet positions error:", error);
            });
            
        return () => unsubscribe();
    }, [state.currentOrganization?.id]);

    const [expandedSubcontractorIds, setExpandedSubcontractorIds] = useState<string[]>([]);

    const handleToggleSubcontractor = (subId: string) => {
        setExpandedSubcontractorIds(prev => 
            prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
        );
    };

    const internalTechs = useMemo(() => {
        return allTechs.filter(t => !t.isSubcontractorTech);
    }, [allTechs]);

    const subcontractorCrews = useMemo(() => {
        return (state.subcontractors || []).map(sub => {
            const subTechs = allTechs.filter(t => t.isSubcontractorTech && t.subcontractorId === sub.id);
            return {
                ...sub,
                techs: subTechs
            };
        }).filter(crew => crew.techs.length > 0);
    }, [state.subcontractors, allTechs]);

    const mappedTechs = useMemo(() => {
        const techsWithLoc = allTechs.filter(t => {
            if (!t.hasLocation) return false;
            if (t.isSubcontractorTech) {
                if (t.subcontractorId) {
                    return expandedSubcontractorIds.includes(t.subcontractorId);
                }
                return false;
            }
            return true;
        });
        const fleetTechs = fleetPositions.map(pos => ({
            id: `fleet-${pos.id}`,
            firstName: pos.name || 'Vehicle',
            lastName: `(${pos.id.substring(0,4)})`,
            location: { lat: pos.lat, lng: pos.lng, timestamp: pos.updatedAt?.toDate()?.toISOString() || new Date().toISOString() },
            isOnline: true,
            isFleet: true,
            speed: pos.speed
        }));
        return [...techsWithLoc, ...fleetTechs];
    }, [allTechs, fleetPositions, expandedSubcontractorIds]);

    const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
        if (mappedTechs.length > 0 && mappedTechs[0].location) {
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
            await db.collection('users').doc(currentUser.id).update(cleanUndefinedFields({ location: locationData }));
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, location: locationData } });
            setMapCenter([locationData.lat, locationData.lng]);
            showToast.warn('Location updated!');
        } else {
            showToast.warn('Failed to update location. Please ensure location services are enabled and permissions granted.');
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-4 px-4 sm:px-0 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Live Operations Tracking</h3>
                    {fleetPositions.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {fleetPositions.length} Vehicles Online
                        </span>
                    )}
                </div>
                <Button onClick={handleForceUpdate} variant="secondary" className="w-auto flex items-center gap-2 text-xs">
                    <Navigation size={14} /> Force My Location Update
                </Button>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                <TechList 
                    internalTechs={[...internalTechs, ...fleetPositions.map(p => ({ ...p, isFleet: true, firstName: p.name || 'Vehicle', lastName: p.id }))] as any}
                    subcontractorCrews={subcontractorCrews}
                    expandedSubcontractorIds={expandedSubcontractorIds}
                    onToggleSubcontractor={handleToggleSubcontractor}
                    onTechSelect={jumpToTech}
                />
                <TrackingMap techs={mappedTechs} center={mapCenter} />
            </div>
        </div>
    );
};

export default TechTracking;
