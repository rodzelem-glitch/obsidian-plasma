import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';
import { cleanUndefinedFields } from 'lib/utils';
import DOMPurify from 'dompurify';
import type { User, CommissionSettings } from 'types';
import { DEFAULT_COMMISSION_RULES, generateSalesRepContractHtml, formatContractWithSignature } from '../../../../utils/salesContractGenerator';
import { SalesScenarioCalculator } from '../../../../components/sales/SalesScenarioCalculator';
import { 
    Zap, Award, DollarSign, Calendar, Clock, RotateCcw, 
    CheckCircle, Shield, Sliders, Calculator, Plus, Trash2, Layers, FileText 
} from 'lucide-react';

interface CustomRepCommissionModalProps {
    rep: User;
    globalRules: CommissionSettings;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const CustomRepCommissionModal: React.FC<CustomRepCommissionModalProps> = ({
    rep,
    globalRules,
    isOpen,
    onClose,
    onSaved
}) => {
    const [useCustom, setUseCustom] = useState<boolean>(!!rep.customCommissionSettings);
    const [activeTab, setActiveTab] = useState<'rates' | 'accelerators' | 'bonuses' | 'simulator' | 'contract'>('rates');
    const [requireResign, setRequireResign] = useState<boolean>(true);

    const [rules, setRules] = useState<CommissionSettings>(() => {
        return rep.customCommissionSettings 
            ? JSON.parse(JSON.stringify(rep.customCommissionSettings))
            : JSON.parse(JSON.stringify(globalRules || DEFAULT_COMMISSION_RULES));
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleResetToDefaults = () => {
        setRules(JSON.parse(JSON.stringify(globalRules || DEFAULT_COMMISSION_RULES)));
        showToast.success("Loaded platform default rules.");
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatePayload: any = {
                updatedAt: new Date().toISOString()
            };

            const updatedRep: User = {
                ...rep,
                customCommissionSettings: useCustom ? rules : undefined
            };

            // Regenerate the contract HTML with the rep's updated custom amounts!
            const effectiveRules = useCustom ? rules : (globalRules || DEFAULT_COMMISSION_RULES);
            const newContractHtml = generateSalesRepContractHtml(updatedRep, effectiveRules);

            if (useCustom) {
                updatePayload.customCommissionSettings = rules;
            } else {
                updatePayload.customCommissionSettings = null;
            }

            // Always update salesContractContent so any viewer or PDF print immediately reflects the custom amounts!
            updatePayload.salesContractContent = newContractHtml;

            // If rep had previously signed and requireResign is enabled, require re-signature for amended terms
            if (rep.salesContractSigned && requireResign) {
                updatePayload.salesContractSigned = false;
                updatePayload.salesContractDate = null;
                updatePayload.salesContractSignature = null;
                updatePayload.contractAmendedAt = new Date().toISOString();
            }

            await db.collection('users').doc(rep.id).update(cleanUndefinedFields(updatePayload));
            showToast.success(`Compensation plan and contract updated for ${rep.firstName} ${rep.lastName}`);
            onSaved();
            onClose();
        } catch (e: any) {
            showToast.warn(e.message || "Failed to update compensation plan.");
        } finally {
            setIsSaving(false);
        }
    };

    // Tier Helpers
    const handleAddAccelerator = () => {
        const current = rules.monthlyMrrAccelerators || [];
        const nextMin = current.length > 0 ? (current[current.length - 1].minMrr + 2500) : 2500;
        setRules({
            ...rules,
            monthlyMrrAccelerators: [
                ...current,
                { minMrr: nextMin, rate: 0.30 }
            ]
        });
    };

    const handleRemoveAccelerator = (index: number) => {
        const current = [...(rules.monthlyMrrAccelerators || [])];
        current.splice(index, 1);
        setRules({ ...rules, monthlyMrrAccelerators: current });
    };

    const handleAddMonthlyBonus = () => {
        const current = rules.monthlyMrrBonuses || [];
        const nextMrr = current.length > 0 ? (current[current.length - 1].mrr + 5000) : 2500;
        setRules({
            ...rules,
            monthlyMrrBonuses: [
                ...current,
                { mrr: nextMrr, bonus: 1000 }
            ]
        });
    };

    const handleRemoveMonthlyBonus = (index: number) => {
        const current = [...(rules.monthlyMrrBonuses || [])];
        current.splice(index, 1);
        setRules({ ...rules, monthlyMrrBonuses: current });
    };

    const handleAddAnnualBonus = () => {
        const current = rules.annualArrBonuses || [];
        const nextArr = current.length > 0 ? (current[current.length - 1].arr + 50000) : 50000;
        setRules({
            ...rules,
            annualArrBonuses: [
                ...current,
                { arr: nextArr, bonus: 10000 }
            ]
        });
    };

    const handleRemoveAnnualBonus = (index: number) => {
        const current = [...(rules.annualArrBonuses || [])];
        current.splice(index, 1);
        setRules({ ...rules, annualArrBonuses: current });
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Compensation Plan: ${rep.firstName} ${rep.lastName}`}
            size="lg"
        >
            <div className="space-y-5 max-h-[78vh] overflow-y-auto p-1">
                {/* Plan Toggle Banner */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Active Commission Structure</span>
                        <div className="flex items-center gap-3 mt-1.5">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-800 dark:text-slate-200">
                                <input 
                                    type="radio" 
                                    name="planMode" 
                                    checked={!useCustom} 
                                    onChange={() => setUseCustom(false)} 
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                Global Fallback Defaults
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-purple-700 dark:text-purple-300">
                                <input 
                                    type="radio" 
                                    name="planMode" 
                                    checked={useCustom} 
                                    onChange={() => setUseCustom(true)} 
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                Custom Individual Override
                            </label>
                        </div>
                    </div>

                    {useCustom && (
                        <Button 
                            variant="secondary" 
                            onClick={handleResetToDefaults} 
                            className="text-xs h-8 flex items-center gap-1.5 self-start sm:self-auto text-slate-600"
                        >
                            <RotateCcw size={13} /> Reset to Defaults
                        </Button>
                    )}
                </div>

                {!useCustom ? (
                    <div className="p-6 text-center bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 mx-auto flex items-center justify-center">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Using Global Default Compensation Rules</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                This representative automatically inherits all platform standard commission rates ({((globalRules.baseRate ?? 0.25) * 100).toFixed(1)}% Base, +{(((globalRules.annualPrepaidKickerRate ?? 0.05)) * 100).toFixed(0)}% Annual Kicker, Accelerators, Bonuses, and Residuals).
                            </p>
                        </div>
                        <Button 
                            onClick={() => setUseCustom(true)} 
                            className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Sliders size={14} className="mr-1.5" /> Customize Plan For {rep.firstName}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Sub-tabs */}
                        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <button 
                                onClick={() => setActiveTab('rates')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    activeTab === 'rates' 
                                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Core Rates & Quotas
                            </button>
                            <button 
                                onClick={() => setActiveTab('accelerators')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    activeTab === 'accelerators' 
                                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Accelerators
                            </button>
                            <button 
                                onClick={() => setActiveTab('bonuses')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    activeTab === 'bonuses' 
                                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Cash Bonuses
                            </button>
                            <button 
                                onClick={() => setActiveTab('simulator')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                    activeTab === 'simulator' 
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Calculator size={13} /> Test In Simulator
                            </button>
                            <button 
                                onClick={() => setActiveTab('contract')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                    activeTab === 'contract' 
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <FileText size={13} /> Contract Preview
                            </button>
                        </div>

                        {/* Tab 1: Core Rates & Quotas */}
                        {activeTab === 'rates' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input 
                                        label="Year 1 Base Commission (%)" 
                                        type="number" 
                                        value={(rules.baseRate * 100).toFixed(1)} 
                                        onChange={e => setRules({...rules, baseRate: parseFloat(e.target.value) / 100})} 
                                    />
                                    <Input 
                                        label="Annual Prepaid Kicker (%)" 
                                        type="number" 
                                        value={(((rules.annualPrepaidKickerRate ?? 0.05)) * 100).toFixed(1)} 
                                        onChange={e => setRules({...rules, annualPrepaidKickerRate: parseFloat(e.target.value) / 100})} 
                                    />
                                    <Input 
                                        label="Year 2 Residual (%)" 
                                        type="number" 
                                        value={(((rules.year2Rate !== undefined ? rules.year2Rate : rules.renewalRate) ?? 0.05) * 100).toFixed(1)} 
                                        onChange={e => {
                                            const r = parseFloat(e.target.value) / 100;
                                            setRules({...rules, year2Rate: r, renewalRate: r});
                                        }} 
                                    />
                                    <Input 
                                        label="Year 3+ Lifetime Residual (%)" 
                                        type="number" 
                                        value={(((rules.lifetimeRate ?? 0.03)) * 100).toFixed(1)} 
                                        onChange={e => setRules({...rules, lifetimeRate: parseFloat(e.target.value) / 100})} 
                                    />
                                    <Input 
                                        label="Quarterly Min Production (Deals)" 
                                        type="number" 
                                        value={rules.quarterlyMinDeals ?? 3} 
                                        onChange={e => setRules({...rules, quarterlyMinDeals: parseInt(e.target.value)})} 
                                    />
                                    <Input 
                                        label="Quarterly Min Volume ($ ACV)" 
                                        type="number" 
                                        value={rules.quarterlyMinVolume ?? 10000} 
                                        onChange={e => setRules({...rules, quarterlyMinVolume: parseFloat(e.target.value)})} 
                                    />
                                    <Input 
                                        label="Inactivity Sunset Cliff (Days)" 
                                        type="number" 
                                        value={rules.inactivityCliffDays ?? 180} 
                                        onChange={e => setRules({...rules, inactivityCliffDays: parseInt(e.target.value)})} 
                                    />
                                    <Input 
                                        label="Platform Abandonment (Days)" 
                                        type="number" 
                                        value={rules.abandonmentDays ?? 60} 
                                        onChange={e => setRules({...rules, abandonmentDays: parseInt(e.target.value)})} 
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Monthly Accelerators */}
                        {activeTab === 'accelerators' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Monthly New-MRR Accelerator Tiers</span>
                                    <Button onClick={handleAddAccelerator} variant="secondary" className="text-xs h-7 flex items-center gap-1">
                                        <Plus size={13} /> Add Tier
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {(rules.monthlyMrrAccelerators || []).map((acc, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <Input 
                                                    label="Min MRR ($)" 
                                                    type="number" 
                                                    value={acc.minMrr} 
                                                    onChange={e => {
                                                        const updated = [...(rules.monthlyMrrAccelerators || [])];
                                                        updated[idx].minMrr = parseFloat(e.target.value);
                                                        setRules({ ...rules, monthlyMrrAccelerators: updated });
                                                    }} 
                                                />
                                                <Input 
                                                    label="Max MRR ($)" 
                                                    type="number" 
                                                    value={acc.maxMrr || ''} 
                                                    placeholder="No cap" 
                                                    onChange={e => {
                                                        const updated = [...(rules.monthlyMrrAccelerators || [])];
                                                        updated[idx].maxMrr = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setRules({ ...rules, monthlyMrrAccelerators: updated });
                                                    }} 
                                                />
                                                <Input 
                                                    label="Rate (%)" 
                                                    type="number" 
                                                    value={(acc.rate * 100).toFixed(1)} 
                                                    onChange={e => {
                                                        const updated = [...(rules.monthlyMrrAccelerators || [])];
                                                        updated[idx].rate = parseFloat(e.target.value) / 100;
                                                        setRules({ ...rules, monthlyMrrAccelerators: updated });
                                                    }} 
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveAccelerator(idx)} 
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-5"
                                                title="Remove Tier"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Bonuses */}
                        {activeTab === 'bonuses' && (
                            <div className="space-y-5">
                                {/* Monthly Cash Bonuses */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Monthly Performance Cash Bonuses (Highest Achieved Paid)</span>
                                        <Button onClick={handleAddMonthlyBonus} variant="secondary" className="text-xs h-7 flex items-center gap-1">
                                            <Plus size={13} /> Add Monthly Bonus
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(rules.monthlyMrrBonuses || []).map((b, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <Input 
                                                        label="MRR Target ($)" 
                                                        type="number" 
                                                        value={b.mrr} 
                                                        onChange={e => {
                                                            const updated = [...(rules.monthlyMrrBonuses || [])];
                                                            updated[idx].mrr = parseFloat(e.target.value);
                                                            setRules({ ...rules, monthlyMrrBonuses: updated });
                                                        }} 
                                                    />
                                                    <Input 
                                                        label="Cash Bonus ($)" 
                                                        type="number" 
                                                        value={b.bonus} 
                                                        onChange={e => {
                                                            const updated = [...(rules.monthlyMrrBonuses || [])];
                                                            updated[idx].bonus = parseFloat(e.target.value);
                                                            setRules({ ...rules, monthlyMrrBonuses: updated });
                                                        }} 
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveMonthlyBonus(idx)} 
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded mt-4"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Annual ARR Bonuses */}
                                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Annual ARR Production Bonuses</span>
                                        <Button onClick={handleAddAnnualBonus} variant="secondary" className="text-xs h-7 flex items-center gap-1">
                                            <Plus size={13} /> Add Annual Bonus
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(rules.annualArrBonuses || []).map((ab, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <Input 
                                                        label="ARR Target ($)" 
                                                        type="number" 
                                                        value={ab.arr} 
                                                        onChange={e => {
                                                            const updated = [...(rules.annualArrBonuses || [])];
                                                            updated[idx].arr = parseFloat(e.target.value);
                                                            setRules({ ...rules, annualArrBonuses: updated });
                                                        }} 
                                                    />
                                                    <Input 
                                                        label="Annual Bonus ($)" 
                                                        type="number" 
                                                        value={ab.bonus} 
                                                        onChange={e => {
                                                            const updated = [...(rules.annualArrBonuses || [])];
                                                            updated[idx].bonus = parseFloat(e.target.value);
                                                            setRules({ ...rules, annualArrBonuses: updated });
                                                        }} 
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveAnnualBonus(idx)} 
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded mt-4"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 4: Simulator Preview */}
                        {activeTab === 'simulator' && (
                            <div className="p-2 border rounded-xl bg-white dark:bg-slate-900">
                                <SalesScenarioCalculator rules={rules} repName={`${rep.firstName} ${rep.lastName}`} isModal={true} />
                            </div>
                        )}

                        {/* Tab 5: Contract Preview */}
                        {activeTab === 'contract' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
                                        <CheckCircle size={15} className="text-emerald-600" />
                                        <span>Live Agreement Preview &mdash; reflecting customized amounts for <strong>{rep.firstName} {rep.lastName}</strong></span>
                                    </div>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                        Exhibit A Active
                                    </span>
                                </div>
                                <div 
                                    className="p-6 bg-white dark:bg-slate-900 border rounded-xl h-[420px] overflow-y-auto wysiwyg-content prose dark:prose-invert max-w-none shadow-inner text-xs"
                                    dangerouslySetInnerHTML={{ 
                                        __html: DOMPurify.sanitize(
                                            generateSalesRepContractHtml({ 
                                                ...rep, 
                                                customCommissionSettings: rules 
                                            }, rules)
                                        ) 
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Re-Sign Banner for Existing Signed Contracts */}
                {rep.salesContractSigned && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3">
                        <input 
                            type="checkbox" 
                            id="requireResign" 
                            checked={requireResign} 
                            onChange={(e) => setRequireResign(e.target.checked)} 
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <label htmlFor="requireResign" className="text-xs cursor-pointer">
                            <span className="font-bold text-amber-900 dark:text-amber-200 block">Require Representative to Re-Sign Updated Agreement</span>
                            <span className="text-amber-700 dark:text-amber-400 block mt-0.5">
                                Since this representative has an existing signature on file, saving will issue an amended contract reflecting these customized rates and request an updated digital signature upon login.
                            </span>
                        </label>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500">
                        {useCustom ? '✨ Custom overrides will take immediate effect on contracts & payouts.' : 'Global standard rules will govern this rep.'}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Plan Settings'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CustomRepCommissionModal;
