import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input, { NumberInput } from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { 
    ShieldCheck, 
    Plus, 
    Trash2, 
    RotateCcw, 
    DollarSign, 
    Calendar, 
    CheckCircle2, 
    Wrench, 
    Layers, 
    Scale, 
    FileText, 
    Eye 
} from 'lucide-react';
import { IndustryVertical, Organization, WarrantyPlanTemplate, WarrantyAgeTier, WarrantySublimit, JbWarrantySettings } from 'types';
import { getDefaultWarrantyPlan, generateWarrantyContractHtml } from 'lib/warrantyHelper';
import { JB_LABOR_RATE_TIERS, JbLaborRateTier, calculateJBWarrantyPricing, JB_WARRANTY_CATALOG } from 'lib/pricebooks/jbWarranties';
import showToast from 'lib/toast';

interface WarrantiesTabProps {
    organization: Organization | null;
    warrantyPlans: Record<string, WarrantyPlanTemplate>;
    setWarrantyPlans: React.Dispatch<React.SetStateAction<Record<string, WarrantyPlanTemplate>>>;
    jbWarrantySettings?: JbWarrantySettings;
    setJbWarrantySettings?: React.Dispatch<React.SetStateAction<JbWarrantySettings>>;
}

const SUPPORTED_TRADES: IndustryVertical[] = [
    'HVAC',
    'Plumbing',
    'Electrical',
    'Roofing',
    'Appliance Repair',
    'General',
    'Contracting',
    'Solar'
];

export const WarrantiesTab: React.FC<WarrantiesTabProps> = ({
    organization,
    warrantyPlans,
    setWarrantyPlans,
    jbWarrantySettings,
    setJbWarrantySettings
}) => {
    const [selectedTrade, setSelectedTrade] = useState<IndustryVertical>(organization?.industry || 'HVAC');
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Current active plan for selected trade
    const activePlan: WarrantyPlanTemplate = warrantyPlans[selectedTrade] || getDefaultWarrantyPlan(selectedTrade, organization);

    // Update the active plan in the parent state
    const updateActivePlan = (updater: (prev: WarrantyPlanTemplate) => WarrantyPlanTemplate) => {
        setWarrantyPlans(prev => {
            const current = prev[selectedTrade] || getDefaultWarrantyPlan(selectedTrade, organization);
            return {
                ...prev,
                [selectedTrade]: updater(current)
            };
        });
    };

    const handleResetToDefaults = () => {
        const defaultTemplate = getDefaultWarrantyPlan(selectedTrade, organization);
        setWarrantyPlans(prev => ({
            ...prev,
            [selectedTrade]: defaultTemplate
        }));
        showToast.success(`Reset ${selectedTrade} warranty plan to industry defaults.`);
    };

    // Handlers for Age Tiers
    const handleAddAgeTier = () => {
        const newTier: WarrantyAgeTier = {
            id: `tier_${Date.now()}`,
            minYears: 0,
            maxYears: 10,
            label: 'New Age Band',
            annualPrice: 649,
            additionalSystemPrice: 549,
            enrollmentNotes: 'Standard inspection approval'
        };
        updateActivePlan(p => ({
            ...p,
            ageTiers: [...p.ageTiers, newTier]
        }));
    };

    const handleUpdateAgeTier = (index: number, field: keyof WarrantyAgeTier, value: any) => {
        updateActivePlan(p => {
            const tiers = [...p.ageTiers];
            tiers[index] = { ...tiers[index], [field]: value };
            return { ...p, ageTiers: tiers };
        });
    };

    const handleDeleteAgeTier = (index: number) => {
        updateActivePlan(p => ({
            ...p,
            ageTiers: p.ageTiers.filter((_, i) => i !== index)
        }));
    };

    // Handlers for Sublimits
    const handleAddSublimit = () => {
        const newSub: WarrantySublimit = {
            id: `sub_${Date.now()}`,
            category: 'New Coverage Category',
            examples: 'Components covered under this limit',
            maxLimit: 500,
            limitType: 'per_failure'
        };
        updateActivePlan(p => ({
            ...p,
            sublimits: [...p.sublimits, newSub]
        }));
    };

    const handleUpdateSublimit = (index: number, field: keyof WarrantySublimit, value: any) => {
        updateActivePlan(p => {
            const subs = [...p.sublimits];
            subs[index] = { ...subs[index], [field]: value };
            return { ...p, sublimits: subs };
        });
    };

    const handleDeleteSublimit = (index: number) => {
        updateActivePlan(p => ({
            ...p,
            sublimits: p.sublimits.filter((_, i) => i !== index)
        }));
    };

    const currentJbSettings: JbWarrantySettings = jbWarrantySettings || organization?.jbWarrantySettings || {
        enabled: true,
        contractorLaborRate: 175,
        markupPercentage: 40,
        minimumMarkupDollars: 150,
        defaultTermYears: 10,
        allowCustomerPortalPurchases: true,
        allowInvoiceAddition: true
    };

    const updateJbSettings = (updater: (prev: JbWarrantySettings) => JbWarrantySettings) => {
        if (setJbWarrantySettings) {
            setJbWarrantySettings(prev => updater(prev || currentJbSettings));
        }
    };

    // Sample plans for the live pricing preview
    const samplePreviewSkus = ['JBALTW', 'JBALTY', 'JBAMTF', 'JBARJY'];
    const activeRate = (currentJbSettings.contractorLaborRate as JbLaborRateTier) || 175;
    const activeMarkup = currentJbSettings.markupPercentage ?? 40;
    const activeMinMarkup = currentJbSettings.minimumMarkupDollars ?? 150;

    return (
        <div className="space-y-6">
            {/* JB Warranties 2025 Extended Protection & Markup Settings */}
            <Card className="border-2 border-primary-500/30 dark:border-primary-600/30 overflow-hidden shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                                JB Warranties
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                                2025 Price Book Active
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                            <ShieldCheck className="text-red-600" size={22} />
                            <span>JB Warranties Extended Warranty &amp; Markup Configuration</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Configure your contractor reimbursement labor rate and retail markup percentage. Customer equipment is automatically matched to the 2025 Price Book with wholesale dealer costs kept strictly confidential.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={currentJbSettings.enabled !== false}
                                onChange={e => updateJbSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {currentJbSettings.enabled !== false ? 'Catalog Enabled' : 'Catalog Disabled'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                            Your Labor Reimbursement Rate:
                        </label>
                        <select
                            value={activeRate}
                            onChange={e => updateJbSettings(prev => ({ ...prev, contractorLaborRate: Number(e.target.value) }))}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        >
                            {JB_LABOR_RATE_TIERS.map(rate => (
                                <option key={rate} value={rate}>
                                    ${rate} / Hour Reimbursement {rate === 175 ? '(Default/Standard)' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Hourly rate JB Warranties pays TekAir for warranty repair claims.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                            Customer Markup (%):
                        </label>
                        <Input
                            type="number"
                            min="0"
                            max="300"
                            step="5"
                            value={activeMarkup}
                            onChange={e => updateJbSettings(prev => ({ ...prev, markupPercentage: parseFloat(e.target.value) || 0 }))}
                            placeholder="e.g. 40"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Retail markup applied to wholesale price. e.g. 40% markup on $1,000 cost = $1,400 retail.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                            Minimum Markup ($):
                        </label>
                        <Input
                            type="number"
                            min="0"
                            step="10"
                            value={activeMinMarkup}
                            onChange={e => updateJbSettings(prev => ({ ...prev, minimumMarkupDollars: parseFloat(e.target.value) || 0 }))}
                            placeholder="e.g. 150"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Floor dollar markup to guarantee profit margin on smaller plans.
                        </p>
                    </div>

                    <div className="flex flex-col justify-center space-y-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={currentJbSettings.allowCustomerPortalPurchases !== false}
                                onChange={e => updateJbSettings(prev => ({ ...prev, allowCustomerPortalPurchases: e.target.checked }))}
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span>Allow Customer Portal Self-Checkout</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={currentJbSettings.allowInvoiceAddition !== false}
                                onChange={e => updateJbSettings(prev => ({ ...prev, allowInvoiceAddition: e.target.checked }))}
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span>Allow Quick-Add to Invoices</span>
                        </label>
                    </div>
                </div>

                {/* Live Profit Preview Table */}
                <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Live Pricing &amp; Profit Calculator Preview (At ${activeRate}/hr &amp; +{activeMarkup}% Markup)
                        </span>
                        <span className="text-[10px] text-slate-400">
                            Wholesale pricing pulled directly from 2025 Price Book
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-3">Sample Equipment / Plan</th>
                                    <th className="p-3">Coverage Type</th>
                                    <th className="p-3">Wholesale Cost (TekAir)</th>
                                    <th className="p-3">Markup</th>
                                    <th className="p-3">Customer Retail Price</th>
                                    <th className="p-3 text-emerald-600 dark:text-emerald-400">Your Gross Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {samplePreviewSkus.map(sku => {
                                    const entry = JB_WARRANTY_CATALOG.find(p => p.sku === sku);
                                    if (!entry) return null;
                                    const pricing = calculateJBWarrantyPricing(entry, activeRate, activeMarkup, activeMinMarkup);
                                    if (!pricing) return null;
                                    const marginPct = ((pricing.profit / pricing.retailPrice) * 100).toFixed(1);

                                    return (
                                        <tr key={sku} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                                                <div>{entry.categoryLabel}</div>
                                                <div className="text-[10px] text-slate-400 font-normal">SKU: {sku} • {entry.termYears} Years</div>
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                                                    {entry.coverageLabel}
                                                </span>
                                            </td>
                                            <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">
                                                ${pricing.wholesaleCost}
                                            </td>
                                            <td className="p-3 text-slate-500">
                                                +{activeMarkup}% (${pricing.markupAmount})
                                            </td>
                                            <td className="p-3 font-black text-slate-900 dark:text-white text-sm">
                                                ${pricing.retailPrice}
                                                <span className="text-[10px] font-normal text-slate-400 ml-1 block">(${pricing.monthlyPriceEstimate}/mo)</span>
                                            </td>
                                            <td className="p-3 font-black text-emerald-600 dark:text-emerald-400">
                                                +${pricing.profit} <span className="text-[10px] font-medium text-emerald-500">({marginPct}% margin)</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>

            {/* Header & Trade Selector */}
            <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={22} />
                            <span>In-House Limited Repair Warranty Templates</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Configure company-backed 12-month equipment repair warranties, age-tiered pricing, component benefit sublimits, and legal terms per trade.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleResetToDefaults} 
                            className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-rose-600"
                        >
                            <RotateCcw size={14} />
                            <span>Reset Defaults</span>
                        </Button>
                    </div>
                </div>

                {/* Trade Pills */}
                <div className="pt-4">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Select Trade / Industry Vertical to Configure:
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {SUPPORTED_TRADES.map(trade => (
                            <button
                                key={trade}
                                type="button"
                                onClick={() => setSelectedTrade(trade)}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                                    selectedTrade === trade
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                            >
                                {trade}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* General Plan Identity */}
            <Card>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <FileText size={16} className="text-indigo-600" />
                    <span>Plan Title &amp; Core Parameters ({selectedTrade})</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label="Plan Document Title" 
                        value={activePlan.planTitle} 
                        onChange={e => updateActivePlan(p => ({ ...p, planTitle: e.target.value }))} 
                        placeholder="e.g. HVAC LIMITED REPAIR WARRANTY"
                    />
                    <Input 
                        label="Plan Subtitle / Motto" 
                        value={activePlan.planSubtitle || ''} 
                        onChange={e => updateActivePlan(p => ({ ...p, planSubtitle: e.target.value }))} 
                        placeholder="e.g. LOCAL SERVICE. REAL PROTECTION."
                    />
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contract Term (Months)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            value={activePlan.termMonths ?? 12}
                            onChange={e => updateActivePlan(p => ({ ...p, termMonths: parseInt(e.target.value) || 0 }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Auto-Renewal Allowed?</label>
                        <select
                            value={activePlan.allowAutoRenew ? 'yes' : 'no'}
                            onChange={e => updateActivePlan(p => ({ ...p, allowAutoRenew: e.target.value === 'yes' }))}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                        >
                            <option value="no">No (Strict 12-Month Expiration — New Contract Required)</option>
                            <option value="yes">Yes (Auto-Renews Annually)</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Core Financial Terms */}
            <Card>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <DollarSign size={16} className="text-emerald-600" />
                    <span>Core Financial Terms &amp; Caps</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Service Fee / Deductible per Claim ($)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 dark:bg-slate-800"
                            value={activePlan.serviceFee ?? 125}
                            step="0.01"
                            onChange={e => updateActivePlan(p => ({ ...p, serviceFee: parseFloat(e.target.value) || 0 }))}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Due from customer at time of dispatch.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Annual Aggregate Cap per System ($)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 dark:bg-slate-800"
                            value={activePlan.annualAggregateLimit ?? 2500}
                            step="0.01"
                            onChange={e => updateActivePlan(p => ({ ...p, annualAggregateLimit: parseFloat(e.target.value) || 0 }))}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Total repair/parts benefits available per year.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">System Replacement Credit Limit ($)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 dark:bg-slate-800"
                            value={activePlan.replacementCreditLimit ?? 1500}
                            step="0.01"
                            onChange={e => updateActivePlan(p => ({ ...p, replacementCreditLimit: parseFloat(e.target.value) || 0 }))}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Credit toward new system if unrepairable.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Qualification Inspection Fee ($)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            value={activePlan.qualificationFee ?? 129}
                            step="0.01"
                            onChange={e => updateActivePlan(p => ({ ...p, qualificationFee: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Qualification Waiver Window (Days)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            value={activePlan.qualificationFeeWaiverDays ?? 30}
                            onChange={e => updateActivePlan(p => ({ ...p, qualificationFeeWaiverDays: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Waives \$129 fee if paid service occurred in this window.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Waiting Period (Days)</label>
                        <NumberInput 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            value={activePlan.waitingPeriodDays ?? 30}
                            onChange={e => updateActivePlan(p => ({ ...p, waitingPeriodDays: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Coverage starts on Day { (activePlan.waitingPeriodDays || 30) + 1 }.</p>
                    </div>
                </div>
            </Card>

            {/* Annual Pricing Structure (Age Bands) */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={16} className="text-amber-600" />
                            <span>Annual Pricing Structure by System Age</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">Customize age intervals, primary system prices, and multi-system discounts.</p>
                    </div>
                    <Button size="sm" onClick={handleAddAgeTier} className="text-xs flex items-center gap-1 bg-amber-600 hover:bg-amber-700">
                        <Plus size={14} /> Add Age Tier
                    </Button>
                </div>

                <div className="space-y-3">
                    {activePlan.ageTiers.map((tier, idx) => (
                        <div key={tier.id || idx} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Tier Label</label>
                                <input 
                                    type="text" 
                                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                    value={tier.label}
                                    onChange={e => handleUpdateAgeTier(idx, 'label', e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Age Range (Yrs)</label>
                                <div className="flex items-center gap-1">
                                    <NumberInput 
                                        className="w-1/2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 dark:bg-slate-800 dark:text-white text-center"
                                        value={tier.minYears}
                                        onChange={e => handleUpdateAgeTier(idx, 'minYears', parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-slate-400 font-bold">-</span>
                                    <NumberInput 
                                        className="w-1/2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 dark:bg-slate-800 dark:text-white text-center"
                                        value={tier.maxYears}
                                        onChange={e => handleUpdateAgeTier(idx, 'maxYears', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Primary Price ($)</label>
                                <NumberInput 
                                    className="w-full text-xs font-bold text-emerald-600 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800"
                                    value={tier.annualPrice}
                                    step="0.01"
                                    onChange={e => handleUpdateAgeTier(idx, 'annualPrice', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Additional Unit ($)</label>
                                <NumberInput 
                                    className="w-full text-xs font-bold text-blue-600 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800"
                                    value={tier.additionalSystemPrice}
                                    step="0.01"
                                    onChange={e => handleUpdateAgeTier(idx, 'additionalSystemPrice', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Notes / Approval</label>
                                <input 
                                    type="text" 
                                    className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                    value={tier.enrollmentNotes || ''}
                                    onChange={e => handleUpdateAgeTier(idx, 'enrollmentNotes', e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-1 flex justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handleDeleteAgeTier(idx)}
                                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    title="Delete Tier"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Covered Failures & Benefit Sublimits */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Wrench size={16} className="text-sky-600" />
                            <span>Covered Failures &amp; Benefit Sublimits</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">Define max payouts per failure category or per contract year.</p>
                    </div>
                    <Button size="sm" onClick={handleAddSublimit} className="text-xs flex items-center gap-1 bg-sky-600 hover:bg-sky-700">
                        <Plus size={14} /> Add Sublimit
                    </Button>
                </div>

                <div className="space-y-3">
                    {activePlan.sublimits.map((sub, idx) => (
                        <div key={sub.id || idx} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Coverage Category</label>
                                <input 
                                    type="text" 
                                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                    value={sub.category}
                                    onChange={e => handleUpdateSublimit(idx, 'category', e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Covered Components / Examples</label>
                                <input 
                                    type="text" 
                                    className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                    value={sub.examples}
                                    onChange={e => handleUpdateSublimit(idx, 'examples', e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Max Limit ($)</label>
                                <NumberInput 
                                    className="w-full text-xs font-bold text-emerald-600 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800"
                                    value={sub.maxLimit}
                                    step="0.01"
                                    onChange={e => handleUpdateSublimit(idx, 'maxLimit', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Basis</label>
                                <select
                                    value={sub.limitType}
                                    onChange={e => handleUpdateSublimit(idx, 'limitType', e.target.value)}
                                    className="w-full text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="per_failure">Per Failure</option>
                                    <option value="per_contract_year">Per Year</option>
                                </select>
                            </div>

                            <div className="md:col-span-1 flex justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handleDeleteSublimit(idx)}
                                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    title="Delete Sublimit"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Legal Venue & Jurisdiction */}
            <Card>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Scale size={16} className="text-amber-600" />
                    <span>Legal Jurisdiction &amp; Venue</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label="Governing State" 
                        value={activePlan.governingState || ''} 
                        onChange={e => updateActivePlan(p => ({ ...p, governingState: e.target.value }))} 
                        placeholder="e.g. Texas"
                    />
                    <Input 
                        label="Restricted County Venue" 
                        value={activePlan.governingCounty || ''} 
                        onChange={e => updateActivePlan(p => ({ ...p, governingCounty: e.target.value }))} 
                        placeholder="e.g. Bexar County"
                    />
                    <div className="md:col-span-2">
                        <Input 
                            label="Service Territory Description" 
                            value={activePlan.serviceAreaDescription || ''} 
                            onChange={e => updateActivePlan(p => ({ ...p, serviceAreaDescription: e.target.value }))} 
                            placeholder="e.g. Residential properties within our authorized San Antonio service area"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Textarea 
                            label="Cancellation &amp; Refund Policy" 
                            value={activePlan.cancellationTerms || ''} 
                            onChange={e => updateActivePlan(p => ({ ...p, cancellationTerms: e.target.value }))} 
                            rows={3}
                        />
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default WarrantiesTab;
