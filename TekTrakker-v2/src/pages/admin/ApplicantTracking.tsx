import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Applicant } from 'types';

import ApplicantHeader from './ats/ApplicantHeader';
import BoardView from './ats/BoardView';
import ListView from './ats/ListView';
import ApplicantDetailModal from './ats/ApplicantDetailModal';
import OfferModal, { OfferDetails } from './ats/OfferModal';
import { globalConfirm } from "lib/globalConfirm";

const STATUS_COLS = ['New', 'Screening', 'Interview', 'Offer Sent', 'Hired', 'Declined'];
const STATUS_COLORS: Record<string, string> = {
    'New': 'bg-blue-100 text-blue-800 border-blue-200',
    'Screening': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Interview': 'bg-purple-100 text-purple-800 border-purple-200',
    'Offer Sent': 'bg-orange-100 text-orange-800 border-orange-200',
    'Hired': 'bg-green-100 text-green-800 border-green-200',
    'Declined': 'bg-gray-100 text-gray-800 border-gray-200'
};
const INDUSTRY_ROLES: Record<string, string[]> = {
    'HVAC': ['HVAC Technician', 'Installer', 'Sales'],
    'Plumbing': ['Plumber', 'Apprentice', 'Sales'],
    'Electrical': ['Electrician', 'Apprentice', 'Sales'],
    'Landscaping': ['Landscaper', 'Crew Leader', 'Designer', 'Sales'],
    'Cleaning': ['Cleaner', 'Janitor', 'Supervisor', 'Sales'],
    'Painting': ['Painter', 'Prep Cook', 'Crew Leader', 'Sales'],
    'Roofing': ['Roofer', 'Foreman', 'Estimator', 'Sales'],
    'Contracting': ['Carpenter', 'Project Manager', 'Estimator', 'Laborer'],
    'Masonry': ['Mason', 'Tender', 'Foreman', 'Estimator'],
    'Telecommunications': ['Cable Technician', 'Network Installer', 'Support Specialist'],
    'Solar': ['Solar Installer', 'Electrician', 'Site Surveyor', 'Sales'],
    'Security': ['Security Technician', 'Installer', 'Sales'],
    'Pet Grooming': ['Groomer', 'Bather', 'Receptionist'],
    'General': ['Laborer', 'Project Manager', 'Sales'],
};

const ApplicantTracking: React.FC = () => {
    const { state } = useAppContext();
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const [search, setSearch] = useState('');
    const [positionFilter, setPositionFilter] = useState('All');
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

    useEffect(() => {
        if (state.isDemoMode) {
            setApplicants(state.applicants || []);
            return;
        }
        if (!state.currentOrganization) return;
        const unsub = db.collection('applicants')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Applicant));
                setApplicants(list);
            });
        return () => unsub();
    }, [state.currentOrganization, state.isDemoMode, state.applicants]);

    const filteredApplicants = useMemo(() => {
        return applicants.filter(a => {
            const name = a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim();
            const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
            const matchesPos = positionFilter === 'All' || a.position === positionFilter;
            return matchesSearch && matchesPos;
        });
    }, [applicants, search, positionFilter]);

    const availablePositions = useMemo(() => {
        const org = state.currentOrganization;
        const industry = org?.industry || 'General';
        const defaults = INDUSTRY_ROLES[industry] || INDUSTRY_ROLES['General'];
        const custom = org?.customPositions || [];
        return Array.from(new Set([...defaults, ...custom]));
    }, [state.currentOrganization]);

    const updateApplicant = (id: string, updates: Partial<Applicant>) => {
        setApplicants(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const handleSelectApplicant = (applicant: Applicant) => {
        setSelectedApplicant(applicant);
        setIsDetailModalOpen(true);
    };

    const handleUpdateStatus = async (status: Applicant['status']) => {
        if (!selectedApplicant) return;
        updateApplicant(selectedApplicant.id, { status });
        if (state.isDemoMode) return showToast.warn('Demo: Status updated!');
        await db.collection('applicants').doc(selectedApplicant.id).update({ status });
    };

    const handleDelete = async () => {
        if (!selectedApplicant) return;
        if (!await globalConfirm(`Delete ${selectedApplicant.name}?`)) return;
        setApplicants(prev => prev.filter(a => a.id !== selectedApplicant.id));
        setIsDetailModalOpen(false);
        if (state.isDemoMode) return showToast.warn('Demo: Applicant deleted!');
        await db.collection('applicants').doc(selectedApplicant.id).delete();
    };

    const handleSaveNotes = async (notes: string) => {
        if (!selectedApplicant) return;
        updateApplicant(selectedApplicant.id, { notes });
        if (state.isDemoMode) return; // No alert needed for note saving
        await db.collection('applicants').doc(selectedApplicant.id).update({ notes });
    };

    const handleSendOffer = async (details: OfferDetails) => {
        if (!selectedApplicant) return;
        console.log('Offer Details:', details);
        handleUpdateStatus('Offer Sent');
        if (state.isDemoMode) return showToast.warn('Demo: Offer sent!');
        // In live mode, you would also generate and send an email
        // await db.collection('mail').add({ ... });
    };

    const handleHire = async () => {
        if (!selectedApplicant) return;
        handleUpdateStatus('Hired');
        setIsDetailModalOpen(false);
        if (state.isDemoMode) return showToast.warn('Demo: Applicant hired!');
        // In live mode, create a new user/employee record
        // await db.collection('users').add({ ... });
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <ApplicantHeader 
                viewMode={viewMode} setViewMode={setViewMode}
                search={search} setSearch={setSearch}
                positionFilter={positionFilter} setPositionFilter={setPositionFilter}
                availablePositions={availablePositions}
                orgId={state.currentOrganization?.id}
                isDemoMode={state.isDemoMode}
            />

            {viewMode === 'board' ? (
                <BoardView 
                    applicants={filteredApplicants} 
                    onSelectApplicant={handleSelectApplicant} 
                    statusCols={STATUS_COLS}
                    statusColors={STATUS_COLORS}
                />
            ) : (
                <ListView 
                    applicants={filteredApplicants} 
                    onSelectApplicant={handleSelectApplicant} 
                    statusColors={STATUS_COLORS}
                />
            )}

            <ApplicantDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                applicant={selectedApplicant}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDelete}
                onSaveNotes={handleSaveNotes}
                onOffer={() => {
                    setIsDetailModalOpen(false);
                    setIsOfferModalOpen(true);
                }}
                onHire={handleHire}
                statusCols={STATUS_COLS}
            />

            <OfferModal
                isOpen={isOfferModalOpen}
                onClose={() => setIsOfferModalOpen(false)}
                applicant={selectedApplicant}
                organization={state.currentOrganization}
                onSendOffer={handleSendOffer}
            />
        </div>
    );
};

export default ApplicantTracking;

