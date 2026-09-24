import React from 'react';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import { NumberInput } from '../../ui/Input';
import { UserIcon, Building2, Users, Plus, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { User, Organization } from '../../../types';
import { useAppContext } from '../../../context/AppContext';
import { checkSubcontractorCompliance } from '../../../lib/subcontractorCompliance';

interface AssignmentTypeProps {
    assignMode: 'internal' | 'partner';
    setAssignMode: (mode: 'internal' | 'partner') => void;
    technicianId: string;
    setTechnicianId: (id: string) => void;
    partnerId: string;
    setPartnerId: (id: string) => void;
    orgTechs: User[];
    partners: Organization[];
    showCrewSelect: boolean;
    setShowCrewSelect: (show: boolean) => void;
    assistantIds: string[];
    openAddSubcontractorModal: () => void;
    partnerPayoutAmount?: number;
    setPartnerPayoutAmount?: (amount: number | undefined) => void;
    partnerNteAmount?: number;
    setPartnerNteAmount?: (amount: number | undefined) => void;
    subcontractorPhone?: string;
    setSubcontractorPhone?: (phone: string) => void;
}

const AssignmentType: React.FC<AssignmentTypeProps> = ({ 
    assignMode, 
    setAssignMode, 
    technicianId, 
    setTechnicianId, 
    partnerId, 
    setPartnerId, 
    orgTechs, 
    partners, 
    showCrewSelect, 
    setShowCrewSelect, 
    assistantIds,
    openAddSubcontractorModal,
    partnerPayoutAmount,
    setPartnerPayoutAmount,
    partnerNteAmount,
    setPartnerNteAmount,
    subcontractorPhone,
    setSubcontractorPhone
}) => {
    const { state } = useAppContext();
    const selectedSub = state.subcontractors.find(s => s.linkedOrgId === partnerId || s.id === partnerId);
    const complianceResult = selectedSub ? checkSubcontractorCompliance(selectedSub, state.currentOrganization?.subcontractorComplianceSettings) : null;

    return (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg mb-4">
                <button type="button" onClick={() => setAssignMode('internal')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${assignMode === 'internal' ? 'bg-white dark:bg-slate-800 shadow text-primary-700 dark:text-primary-300 font-extrabold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><UserIcon size={14}/> Internal Tech</button>
                <button type="button" onClick={() => setAssignMode('partner')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${assignMode === 'partner' ? 'bg-white dark:bg-slate-800 shadow text-indigo-700 dark:text-indigo-300 font-extrabold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Building2 size={14}/> Subcontractor</button>
            </div>

            {assignMode === 'internal' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Lead Tech" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
                        <option value="">Unassigned</option>
                        {orgTechs.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                    </Select>
                    <div className="flex items-end">
                        <Button type="button" variant="secondary" onClick={() => setShowCrewSelect(!showCrewSelect)} className="text-xs h-10 w-full"><Users size={14} className="mr-2"/> Crew ({assistantIds.length})</Button>
                    </div>
                    {(() => {
                        const tech = orgTechs.find(u => u.id === technicianId);
                        const isSub = tech?.role === 'Subcontractor';
                        if (isSub && (setPartnerPayoutAmount || setPartnerNteAmount)) {
                            return (
                                <div className="col-span-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="internal-sub-payout" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pass-through Payout (Optional)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                                <NumberInput 
                                                    id="internal-sub-payout"
                                                    step="0.01"
                                                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring focus:ring-indigo-200 text-sm font-medium text-slate-900 dark:text-white"
                                                    placeholder="0.00"
                                                    value={partnerPayoutAmount !== undefined ? partnerPayoutAmount : ''}
                                                    onChange={(e) => setPartnerPayoutAmount && setPartnerPayoutAmount(e.target.value ? Number(e.target.value) : undefined)}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Flat-fee payout for subcontractor 1099 accrual.</p>
                                        </div>

                                        <div>
                                            <label htmlFor="internal-sub-nte" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subcontractor NTE Amount ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                                <NumberInput 
                                                    id="internal-sub-nte"
                                                    step="0.01"
                                                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring focus:ring-indigo-200 text-sm font-medium text-slate-900 dark:text-white"
                                                    placeholder="0.00"
                                                    value={partnerNteAmount !== undefined ? partnerNteAmount : ''}
                                                    onChange={(e) => setPartnerNteAmount && setPartnerNteAmount(e.target.value ? Number(e.target.value) : undefined)}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Not-To-Exceed limit for subcontractor work order.</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Select Subcontractor / Partner" value={partnerId} onChange={e => setPartnerId(e.target.value)}>
                        <option value="">-- Choose Subcontractor --</option>
                        <option value="generic_subcontractor">🏢 Subcontractor (Generic / Send Details Later)</option>
                        {partners.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.name} {p.isInternal ? '(Internal 1099)' : '(Linked Partner)'}
                            </option>
                        ))}
                    </Select>
                    <div className="flex items-end">
                        <Button type="button" variant="secondary" onClick={openAddSubcontractorModal} className="text-xs h-10 w-full"><Plus size={14} className="mr-2"/> Add Subcontractor</Button>
                    </div>
                </div>

                {/* Subcontractor Compliance Validation Banner */}
                {selectedSub && complianceResult && (() => {
                    const compSettings = state.currentOrganization?.subcontractorComplianceSettings;
                    const isBypassed = compSettings?.enforceComplianceBeforeAssignment === false 
                        || compSettings?.allowTemporaryComplianceBypass === true 
                        || (selectedSub as any)?.temporaryComplianceBypass === true;

                    if (complianceResult.isCompliant) {
                        return (
                            <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                Subcontractor Compliance Verified ({complianceResult.fulfilledCount}/{complianceResult.totalRequiredCount} Docs)
                            </div>
                        );
                    }

                    if (isBypassed) {
                        return (
                            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-300 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                                <div className="flex items-center gap-2 font-bold">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>⚡ Emergency Compliance Lock Bypassed (Paperwork Pending Afterwards)</span>
                                </div>
                                <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-extrabold uppercase shrink-0">Bypassed</span>
                            </div>
                        );
                    }

                    return (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2 text-xs text-amber-900 dark:text-amber-200">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-extrabold">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    Subcontractor Missing Required Compliance Documents
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const { db } = await import('../../../lib/firebase');
                                            const showToast = (await import('../../../lib/toast')).default;
                                            await db.collection('subcontractors').doc(selectedSub.id).update({
                                                temporaryComplianceBypass: true,
                                                complianceBypassReason: 'Emergency assignment - paperwork pending'
                                            });
                                            showToast.success("Emergency compliance lock bypassed for urgent job!");
                                        } catch (e: any) {
                                            console.error("Bypass failed", e);
                                        }
                                    }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] rounded shadow-sm transition shrink-0"
                                >
                                    ⚡ Bypass Lock for Urgent Work
                                </button>
                            </div>
                            <p className="text-[11px] opacity-90 pl-6">
                                Missing: <strong>{complianceResult.missingDocLabels.join(', ')}</strong>
                            </p>
                        </div>
                    );
                })()}

                {(setPartnerPayoutAmount || setPartnerNteAmount || setSubcontractorPhone) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="partner-payout" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pass-through Payout (Optional)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <NumberInput 
                                        id="partner-payout"
                                        step="0.01"
                                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring focus:ring-indigo-200 text-sm font-medium text-slate-900 dark:text-white"
                                        placeholder="0.00"
                                        value={partnerPayoutAmount !== undefined ? partnerPayoutAmount : ''}
                                        onChange={(e) => setPartnerPayoutAmount && setPartnerPayoutAmount(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Flat-fee payout for subcontractor 1099 accrual.</p>
                            </div>

                            <div>
                                <label htmlFor="partner-nte" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subcontractor NTE Amount ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <NumberInput 
                                        id="partner-nte"
                                        step="0.01"
                                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring focus:ring-indigo-200 text-sm font-medium text-slate-900 dark:text-white"
                                        placeholder="0.00"
                                        value={partnerNteAmount !== undefined ? partnerNteAmount : ''}
                                        onChange={(e) => setPartnerNteAmount && setPartnerNteAmount(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Not-To-Exceed limit for work order.</p>
                            </div>

                            <div>
                                <label htmlFor="subcontractor-phone" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subcontractor Phone Number</label>
                                <input 
                                    id="subcontractor-phone"
                                    type="tel" 
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring focus:ring-indigo-200 text-sm font-medium text-slate-900 dark:text-white"
                                    placeholder="(210) 316-9581"
                                    value={subcontractorPhone || ''}
                                    onChange={(e) => setSubcontractorPhone && setSubcontractorPhone(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Direct phone contact for dispatched sub.</p>
                            </div>
                        </div>
                    </div>
                )}
            </>
            )}
        </div>
    );
};

export default AssignmentType;
