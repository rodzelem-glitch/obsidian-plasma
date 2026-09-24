import React, { useState, useMemo } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { 
    ShieldCheck, 
    CheckCircle2, 
    DollarSign, 
    Tag, 
    Wrench, 
    Calendar, 
    Plus, 
    Sparkles,
    Check,
    Cpu,
    Flame,
    Snowflake,
    AlertCircle
} from 'lucide-react';
import { Customer, Job, Organization, EquipmentAsset } from '../../../types';
import { 
    getCorrelatedWarrantyPlans, 
    JB_WARRANTY_CATALOG, 
    calculateJBWarrantyPricing, 
    JbLaborRateTier 
} from '../../../lib/pricebooks/jbWarranties';
import showToast from '../../../lib/toast';

interface AddWarrantyToInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    job?: Job | null;
    organization?: Organization | null;
    onAddWarrantyItem: (item: {
        name: string;
        description: string;
        unitPrice: number;
        type: 'Service' | 'Part/Labor';
        taxable: boolean;
        extendedWarrantyData: any;
    }) => void;
}

export const AddWarrantyToInvoiceModal: React.FC<AddWarrantyToInvoiceModalProps> = ({
    isOpen,
    onClose,
    customer,
    job,
    organization,
    onAddWarrantyItem
}) => {
    // Org settings
    const jbSettings = organization?.jbWarrantySettings || {
        enabled: true,
        contractorLaborRate: 175,
        markupPercentage: 40,
        minimumMarkupDollars: 150
    };

    const contractorLaborRate: JbLaborRateTier = (jbSettings.contractorLaborRate as JbLaborRateTier) || 175;
    const [markupPctOverride, setMarkupPctOverride] = useState<number>(jbSettings.markupPercentage ?? 40);

    // List of customer equipment
    const customerEquipmentList: Partial<EquipmentAsset>[] = useMemo(() => {
        const list: Partial<EquipmentAsset>[] = [];
        if (Array.isArray(customer?.equipment) && customer.equipment.length > 0) {
            customer.equipment.forEach(eq => list.push(eq));
        }

        // Check if job has a serviced equipment not in customer list
        if (job) {
            const diag: any = (job as any).diagnosticNotes || {};
            if (diag.modelNumber || (job as any).hvacBrand) {
                const alreadyExists = list.some(e => 
                    (e.serial && e.serial === diag.serialNumber) || 
                    (e.model && e.model === diag.modelNumber)
                );
                if (!alreadyExists) {
                    list.unshift({
                        id: 'job-serviced-unit',
                        brand: (job as any).hvacBrand || 'Serviced System',
                        model: diag.modelNumber || 'Residential System',
                        serial: diag.serialNumber || 'SN-VERIFIED',
                        type: job.tasks?.[0]?.includes('Heat Pump') ? 'Heat Pump' : 'AC Split System',
                        tonnage: diag.tonnage || 3,
                        ageYears: diag.ageYears || 2
                    });
                }
            }
        }

        // If still empty, provide a clean default residential unit
        if (list.length === 0) {
            list.push({
                id: 'new-unit-1',
                brand: 'Carrier',
                model: 'Residential Complete Split System',
                serial: 'SN-VERIFIED',
                type: 'AC Split System',
                tonnage: 3,
                ageYears: 2
            });
        }

        return list;
    }, [customer, job]);

    const [selectedEquipmentIndex, setSelectedEquipmentIndex] = useState<number>(0);
    const selectedEquipment = customerEquipmentList[selectedEquipmentIndex] || customerEquipmentList[0];

    // Correlated recommendations for selected equipment
    const correlation = useMemo(() => {
        return getCorrelatedWarrantyPlans(selectedEquipment, {
            ...jbSettings,
            markupPercentage: markupPctOverride
        });
    }, [selectedEquipment, jbSettings, markupPctOverride]);

    const handleSelectAndAddPlan = (plan: typeof correlation.plans[0]) => {
        const equipName = `${selectedEquipment.brand} ${selectedEquipment.model || selectedEquipment.type || 'System'}`;
        const serialStr = selectedEquipment.serial ? ` (S/N: ${selectedEquipment.serial})` : '';

        const orgName = organization?.name || 'TekAir';
        const lineItemName = `${plan.planName} - ${orgName} Protection`;
        const lineItemDesc = `${orgName} Extended ${plan.termYears}-Year ${plan.coverageBadge} for ${equipName}${serialStr}. Includes 100% parts & labor coverage, $0 deductible trip charge, and refrigerant allowance. 100% transferable to new homeowner.`;

        onAddWarrantyItem({
            name: lineItemName,
            description: lineItemDesc,
            unitPrice: plan.retailPrice,
            type: 'Service',
            taxable: false,
            extendedWarrantyData: {
                planSku: plan.sku,
                planName: lineItemName,
                coverageTier: plan.coverageTier,
                termYears: plan.termYears,
                equipmentId: selectedEquipment.id || 'unassigned',
                equipmentName: equipName,
                equipmentSerial: selectedEquipment.serial || '',
                wholesaleCost: plan.wholesaleCost,
                markupPercentage: markupPctOverride,
                contractorLaborRate
            }
        });

        showToast.success(`Added ${lineItemName} to invoice ($${plan.retailPrice.toFixed(2)})`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Add ${organization?.name || 'TekAir'} Extended Protection to Invoice`} 
            size="2xl"
        >
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 rounded-2xl text-white shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-white/20 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded tracking-wider backdrop-blur-xs">
                                    TekAir Protection Program
                                </span>
                                <span className="bg-emerald-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded tracking-wider">
                                    System Correlated
                                </span>
                            </div>
                            <h3 className="text-xl font-black mt-1">Select Correlated Protection Plan</h3>
                            <p className="text-xs text-white/80 mt-0.5">
                                Recommends tailored extended warranty plans matching customer equipment with automated markup.
                            </p>
                        </div>
                        <div className="text-right sm:border-l sm:border-white/20 sm:pl-4">
                            <span className="text-[10px] uppercase font-bold text-white/70 block">Contractor Labor Tier</span>
                            <span className="text-lg font-black">${contractorLaborRate}/hr</span>
                        </div>
                    </div>
                </div>

                {/* Equipment Selector */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        1. Select Correlated Customer Equipment:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {customerEquipmentList.map((eq, idx) => {
                            const isSelected = idx === selectedEquipmentIndex;
                            return (
                                <button
                                    key={eq.id || idx}
                                    type="button"
                                    onClick={() => setSelectedEquipmentIndex(idx)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                        isSelected 
                                            ? 'border-red-600 bg-red-50 dark:bg-red-950/30 shadow-sm' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                            {eq.brand} {eq.model}
                                        </span>
                                        {isSelected && <CheckCircle2 size={16} className="text-red-600 shrink-0" />}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                                        <span>{eq.type || 'HVAC'}</span>
                                        <span>•</span>
                                        <span>{eq.tonnage ? `${eq.tonnage} Ton` : 'Standard'}</span>
                                        {eq.serial && (
                                            <>
                                                <span>•</span>
                                                <span className="font-mono">{eq.serial}</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Markup Adjustment Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            TekAir Customer Markup Percentage
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Default from company settings ({jbSettings.markupPercentage}%). Can be adjusted for this invoice.
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min="0"
                            max="300"
                            step="5"
                            value={markupPctOverride}
                            onChange={e => setMarkupPctOverride(parseFloat(e.target.value) || 0)}
                            className="w-24 text-right font-black text-sm"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">% markup</span>
                    </div>
                </div>

                {/* Correlated Plan Cards */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                        2. Available Warranty Options for {correlation.equipmentSummary.name}:
                    </label>

                    <div className="space-y-4">
                        {correlation.plans.map(plan => {
                            const marginPct = ((plan.profit / plan.retailPrice) * 100).toFixed(1);

                            return (
                                <div 
                                    key={plan.sku}
                                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                                        plan.isRecommended 
                                            ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm' 
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                                >
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {plan.isRecommended && (
                                                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Sparkles size={10} /> Recommended
                                                </span>
                                            )}
                                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                                                SKU: {plan.sku}
                                            </span>
                                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                {plan.planName}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            {plan.description}
                                        </p>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                                            {plan.whatIsCovered.slice(0, 3).map((item, i) => (
                                                <span key={i} className="flex items-center gap-1">
                                                    <Check size={12} className="text-emerald-600 shrink-0" /> {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Financial Breakdown & Add Button */}
                                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-700">
                                        <div className="text-right">
                                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                                ${plan.retailPrice.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                Wholesale Cost: <span className="font-semibold">${plan.wholesaleCost.toFixed(2)}</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                Profit: +${plan.profit.toFixed(2)} ({marginPct}%)
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleSelectAndAddPlan(plan)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                                        >
                                            <Plus size={14} />
                                            <span>Add to Invoice</span>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="text-[11px] text-slate-500 flex items-start gap-2 bg-slate-100/60 dark:bg-slate-800/40 p-3 rounded-xl">
                    <AlertCircle size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>
                        When the customer pays this invoice, TekAir's system will automatically activate the extended warranty contract and link it to their equipment profile.
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default AddWarrantyToInvoiceModal;
