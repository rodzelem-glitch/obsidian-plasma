import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../../context/AppContext';
import { db } from '../../../../lib/firebase';
import showToast from '../../../../lib/toast';
import Button from '../../../../components/ui/Button';
import Toggle from '../../../../components/ui/Toggle';
import Card from '../../../../components/ui/Card';
import { ShieldCheck, FileCheck, AlertTriangle, Info, Bell, CheckCircle2, Lock, FileText, BadgeCheck } from 'lucide-react';
import { ALL_COMPLIANCE_DOCUMENTS, getDefaultComplianceSettings } from '../../../../lib/subcontractorCompliance';
import type { SubcontractorComplianceSettings } from '../../../../types';

const SubcontractorComplianceTab: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [settings, setSettings] = useState<SubcontractorComplianceSettings>(() => {
        return state.currentOrganization?.subcontractorComplianceSettings || getDefaultComplianceSettings();
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (state.currentOrganization?.subcontractorComplianceSettings) {
            setSettings(state.currentOrganization.subcontractorComplianceSettings);
        }
    }, [state.currentOrganization?.subcontractorComplianceSettings]);

    const handleToggleDoc = (key: string, isRequired: boolean) => {
        setSettings(prev => ({
            ...prev,
            requiredDocuments: {
                ...(prev.requiredDocuments || {}),
                [key]: isRequired
            }
        }));
    };

    const handleSave = async () => {
        if (!state.currentOrganization?.id) return;
        setIsSaving(true);
        try {
            const updatedOrg = {
                ...state.currentOrganization,
                subcontractorComplianceSettings: settings
            };

            await db.collection('organizations').doc(state.currentOrganization.id).update({
                subcontractorComplianceSettings: settings
            });

            dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: updatedOrg });
            showToast.success("Subcontractor compliance settings updated!");
        } catch (err: any) {
            console.error("Error saving compliance settings:", err);
            showToast.error("Failed to save compliance settings: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const categories = [
        { id: 'tax', title: 'Tax & Identity Documents', icon: FileText },
        { id: 'identity', title: 'Licenses & State Photo IDs', icon: BadgeCheck },
        { id: 'insurance', title: 'Insurance & Additional Insured', icon: ShieldCheck },
        { id: 'bond', title: 'Surety & Performance Bonds', icon: Lock },
        { id: 'credentials', title: 'Credentials & Safety Certifications', icon: CheckCircle2 },
        { id: 'agreement', title: 'Contracts & Payout Agreements', icon: FileCheck },
    ];

    return (
        <div className="space-y-6">
            {/* Header banner */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-800/40 shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                            Subcontractor Compliance Governance
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight">Required Subcontractor Documents & Contracts</h2>
                        <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                            Configure compliance policies for linked partner subcontractors and internal sub-technicians. Require tax forms, licenses, COIs naming your company as Additional Insured, and master contracts before work orders can be dispatched.
                        </p>
                    </div>
                    <Button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all shrink-0"
                    >
                        {isSaving ? "Saving Settings..." : "Save Policy Changes"}
                    </Button>
                </div>
            </div>

            {/* Embed Subcontractor Onboarding Widget Card */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                            <ShieldCheck className="w-4 h-4" /> Embeddable Website Widget
                        </div>
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Subcontractor Setup &amp; Vendor Registration Widget</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Embed this setup widget on your company website so new subcontractors can register, upload compliance documents, and sign agreements directly.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const orgId = state.currentOrganization?.id || state.currentUser?.organizationId;
                            if (!orgId) {
                                showToast.error("Organization ID is loading. Please try again in a moment.");
                                return;
                            }
                            const previewUrl = `${window.location.origin}/#/widgets/subcontractor-setup/${orgId}`;
                            window.open(previewUrl, '_blank');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors shrink-0 cursor-pointer"
                    >
                        Preview Public Widget <FileText className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Website HTML Embed Code (Copy &amp; Paste to your Website):</label>
                    <div className="relative">
                        <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto select-all">
                            {`<iframe src="${window.location.origin}/#/widgets/subcontractor-setup/${state.currentOrganization?.id || state.currentUser?.organizationId || 'YOUR_ORG_ID'}" width="100%" height="800px" frameborder="0"></iframe>`}
                        </pre>
                        <button
                            type="button"
                            onClick={() => {
                                const orgId = state.currentOrganization?.id || state.currentUser?.organizationId || 'YOUR_ORG_ID';
                                const embedCode = `<iframe src="${window.location.origin}/#/widgets/subcontractor-setup/${orgId}" width="100%" height="800px" frameborder="0"></iframe>`;
                                navigator.clipboard.writeText(embedCode);
                                showToast.success("Copied website embed code to clipboard!");
                            }}
                            className="absolute top-2 right-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-colors shadow cursor-pointer"
                        >
                            Copy Embed Code
                        </button>
                    </div>
                </div>
            </div>

            {/* General Policy Enforcement Controls */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" /> Enforcement & Dispatch Rules
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                        <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block mb-1">
                                Enforce Compliance Before Assignment
                            </span>
                            <p className="text-[11px] text-slate-500 leading-normal">
                                Prevents dispatching jobs or creating work orders for subcontractors with missing, unverified, or expired compliance documents.
                            </p>
                        </div>
                        <Toggle 
                            label=""
                            enabled={settings.enforceComplianceBeforeAssignment ?? true}
                            onChange={(val) => setSettings(prev => ({ ...prev, enforceComplianceBeforeAssignment: val }))}
                        />
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                        <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block mb-1">
                                Automatic Link Notification
                            </span>
                            <p className="text-[11px] text-slate-500 leading-normal">
                                Automatically send an email and in-app alert listing all required compliance documents to subcontractors upon linking accounts.
                            </p>
                        </div>
                        <Toggle 
                            label=""
                            enabled={settings.notifyOnLink ?? true}
                            onChange={(val) => setSettings(prev => ({ ...prev, notifyOnLink: val }))}
                        />
                    </div>
                </div>
            </Card>

            {/* Document Selection Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-indigo-500" /> Configure Required Document Types
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                        {ALL_COMPLIANCE_DOCUMENTS.filter(d => settings.requiredDocuments?.[d.key]).length} of {ALL_COMPLIANCE_DOCUMENTS.length} Documents Required
                    </span>
                </div>

                {categories.map(cat => {
                    const catDocs = ALL_COMPLIANCE_DOCUMENTS.filter(d => d.category === cat.id);
                    const CatIcon = cat.icon;
                    return (
                        <div key={cat.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                            <h4 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                <CatIcon className="w-4 h-4" />
                                {cat.title}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {catDocs.map(doc => {
                                    const isReq = settings.requiredDocuments?.[doc.key] ?? doc.defaultRequired;
                                    return (
                                        <div 
                                            key={doc.key}
                                            className={`p-4 rounded-xl border transition-all ${
                                                isReq 
                                                    ? 'bg-indigo-500/5 border-indigo-300 dark:border-indigo-800' 
                                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                                                            {doc.label}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${doc.badgeColor}`}>
                                                            {doc.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                                        {doc.description}
                                                    </p>
                                                </div>
                                                <Toggle 
                                                    label=""
                                                    enabled={isReq}
                                                    onChange={(val) => handleToggleDoc(doc.key, val)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end pt-4">
                <Button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-8 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                >
                    {isSaving ? "Saving Settings..." : "Save Policy Changes"}
                </Button>
            </div>
        </div>
    );
};

export default SubcontractorComplianceTab;
