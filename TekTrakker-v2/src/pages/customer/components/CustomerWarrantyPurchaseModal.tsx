import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { 
    ShieldCheck, 
    CheckCircle2, 
    Wrench, 
    Calendar, 
    Check, 
    Sparkles, 
    AlertCircle, 
    ArrowRight, 
    FileText, 
    Lock, 
    Flame, 
    Snowflake, 
    Zap, 
    Clock, 
    Tag,
    Award,
    CreditCard
} from 'lucide-react';
import type { Customer, Organization, EquipmentAsset, WarrantyContract } from 'types';
import { 
    getCorrelatedWarrantyPlans, 
    calculateJBWarrantyPricing, 
    detectEquipmentCategory,
    CorrelatedWarrantyPlan 
} from 'lib/pricebooks/jbWarranties';
import { db } from 'lib/firebase';
import firebase from 'firebase/compat/app';
import showToast from 'lib/toast';

interface CustomerWarrantyPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    organization?: Organization | null;
    initialEquipment?: EquipmentAsset | null;
    onProceedToCheckout?: (jobId: string) => void;
    onContractCreated?: (contract: WarrantyContract) => void;
}

export const CustomerWarrantyPurchaseModal: React.FC<CustomerWarrantyPurchaseModalProps> = ({
    isOpen,
    onClose,
    customer,
    organization,
    initialEquipment,
    onProceedToCheckout,
    onContractCreated
}) => {
    const equipmentList: EquipmentAsset[] = useMemo(() => {
        return (customer?.equipment || []) as EquipmentAsset[];
    }, [customer?.equipment]);

    const [selectedEquipId, setSelectedEquipId] = useState<string>(() => {
        if (initialEquipment?.id) return initialEquipment.id;
        if (equipmentList.length > 0) return equipmentList[0].id;
        return 'primary';
    });

    const selectedEquipment = useMemo(() => {
        if (initialEquipment && initialEquipment.id === selectedEquipId) return initialEquipment;
        const found = equipmentList.find(e => e.id === selectedEquipId);
        if (found) return found;
        if (equipmentList.length > 0) return equipmentList[0];
        return null;
    }, [selectedEquipId, equipmentList, initialEquipment]);

    const jbSettings = organization?.jbWarrantySettings;
    const markupSettings = useMemo(() => ({
        contractorLaborRateTier: jbSettings?.contractorLaborRateTier || 175,
        defaultMarkupPercentage: jbSettings?.defaultMarkupPercentage ?? 40,
        minimumMarkupDollars: jbSettings?.minimumMarkupDollars ?? 150
    }), [jbSettings]);

    // Correlate plans to selected equipment
    const correlatedPlans: CorrelatedWarrantyPlan[] = useMemo(() => {
        return getCorrelatedWarrantyPlans(selectedEquipment, markupSettings).plans || [];
    }, [selectedEquipment, markupSettings]);

    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    // Pre-select the recommended plan (e.g. Parts & Labor Plus or first plan)
    const activePlanId = useMemo(() => {
        if (selectedPlanId && correlatedPlans.some(p => p.planId === selectedPlanId)) {
            return selectedPlanId;
        }
        const recommended = correlatedPlans.find(p => p.recommended);
        return recommended ? recommended.planId : (correlatedPlans[0]?.planId || '');
    }, [selectedPlanId, correlatedPlans]);

    const activePlan = useMemo(() => {
        return correlatedPlans.find(p => p.planId === activePlanId) || correlatedPlans[0] || null;
    }, [activePlanId, correlatedPlans]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseMethod, setPurchaseMethod] = useState<'pay_now' | 'request_invoice'>('pay_now');

    if (!isOpen) return null;

    const handleConfirmPurchase = async () => {
        if (!customer) {
            showToast.error("Customer profile not loaded.");
            return;
        }
        if (!activePlan) {
            showToast.error("Please select a warranty coverage plan.");
            return;
        }

        setIsSubmitting(true);
        try {
            const now = new Date();
            const effectiveDate = new Date(now);
            effectiveDate.setDate(effectiveDate.getDate() + 30); // 30-day waiting period
            const expirationDate = new Date(now);
            expirationDate.setFullYear(expirationDate.getFullYear() + activePlan.termYears);

            const contractId = `warr-tek-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const contractNumber = `TAP-${Math.floor(100000 + Math.random() * 900000)}`;
            const equipName = selectedEquipment ? `${selectedEquipment.brand} ${selectedEquipment.model}` : 'HVAC System';
            const equipSerial = selectedEquipment?.serial || 'N/A';
            const orgName = organization?.name || 'TekAir';

            const newContract: WarrantyContract = {
                id: contractId,
                contractNumber,
                organizationId: organization?.id || '',
                customerId: customer.id,
                customerName: customer.name || '',
                serviceAddress: customer.address || '',
                customerPhone: customer.phone || '',
                customerEmail: customer.email || '',
                trade: 'HVAC',
                planTitle: `${orgName} ${activePlan.planName}`,
                agreementDate: now.toISOString().split('T')[0],
                effectiveDate: effectiveDate.toISOString().split('T')[0],
                expirationDate: expirationDate.toISOString().split('T')[0],
                status: 'Pending_Payment',
                equipmentId: selectedEquipment?.id || '',
                systemType: equipName,
                refrigerant: selectedEquipment?.refrigerantType || 'R-410A',
                nominalTons: selectedEquipment?.tonnage || 3,
                approxAgeYears: Number(selectedEquipment?.ageYears || 1),
                outdoorModel: selectedEquipment?.model || '',
                outdoorSerial: selectedEquipment?.serial || '',
                indoorModel: selectedEquipment?.indoorModel || '',
                indoorSerial: selectedEquipment?.indoorSerial || '',
                basePrice: activePlan.retailPrice,
                qualificationFee: 0,
                qualificationFeeWaived: true,
                totalAmount: activePlan.retailPrice,
                paymentStatus: 'Pending',
                annualAggregateLimit: activePlan.coverageTier.includes('Parts') ? 5000 : 2500,
                remainingBenefitLimit: activePlan.coverageTier.includes('Parts') ? 5000 : 2500,
                serviceFee: 0,
                replacementCreditLimit: 1500,
                ageTierLabel: '0-5 Years',
                sublimits: [],
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            };

            // Save contract to organization warrantyContracts collection
            if (organization?.id) {
                await db.collection('organizations').doc(organization.id).collection('warrantyContracts').doc(contractId).set(newContract).catch(err => {
                    console.warn("Could not save to org subcollection directly:", err);
                });
            }

            // Append contract to customer record
            await db.collection('customers').doc(customer.id).update({
                warrantyContracts: firebase.firestore.FieldValue.arrayUnion(newContract)
            }).catch(err => {
                console.warn("Could not append to customer record directly:", err);
            });

            // Create a formal Job/Invoice for this warranty so the customer can pay immediately or receive an invoice
            const generatedJobId = `job-warr-${Date.now()}`;
            const generatedInvId = `INV-WARR-${Math.floor(100000 + Math.random() * 900000)}`;

            const lineItem = {
                id: `item-${Date.now()}`,
                name: `${orgName} ${activePlan.planName}`,
                description: `${orgName} ${activePlan.termYears}-Year Extended Warranty Coverage for ${equipName} (S/N: ${equipSerial}). Includes $0 service deductible and 100% technician labor reimbursement.`,
                quantity: 1,
                unitPrice: activePlan.retailPrice,
                total: activePlan.retailPrice,
                type: 'Service' as const,
                taxable: false,
                isExtendedWarranty: true,
                extendedWarrantyData: {
                    contractId,
                    contractNumber,
                    planId: activePlan.planId,
                    planName: `${orgName} ${activePlan.planName}`,
                    coverageTier: activePlan.coverageTier,
                    termYears: activePlan.termYears,
                    equipmentId: selectedEquipment?.id || 'unassigned',
                    equipmentName: equipName,
                    equipmentSerial: equipSerial,
                    wholesaleCost: activePlan.wholesaleCost,
                    markupPercentage: activePlan.markupPercentage,
                    contractorLaborRate: activePlan.contractorLaborRate
                }
            };

            const warrantyJobDoc: any = {
                id: generatedJobId,
                organizationId: organization?.id || 'default',
                customerId: customer.id,
                customerName: customer.name || '',
                customerEmail: customer.email || '',
                customerPhone: customer.phone || '',
                address: customer.address || '',
                jobStatus: 'Scheduled',
                tasks: [`Extended Warranty Protection - ${activePlan.planName}`],
                appointmentTime: now.toISOString(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                total: activePlan.retailPrice,
                paidAmount: 0,
                invoice: {
                    id: generatedInvId,
                    invoiceNumber: generatedInvId,
                    status: 'Unpaid',
                    financialStatus: 'UNPAID',
                    items: [lineItem],
                    subtotal: activePlan.retailPrice,
                    taxAmount: 0,
                    taxRate: 0,
                    totalAmount: activePlan.retailPrice,
                    amount: activePlan.retailPrice,
                    amountPaid: 0,
                    balanceDue: activePlan.retailPrice,
                    balanceRemaining: activePlan.retailPrice,
                    createdDate: now.toISOString(),
                    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                    extendedWarrantyPlan: lineItem.extendedWarrantyData
                }
            };

            await db.collection('jobs').doc(generatedJobId).set(warrantyJobDoc).catch(err => {
                console.warn("Could not save warranty job doc:", err);
            });

            onContractCreated?.(newContract);

            if (purchaseMethod === 'pay_now') {
                showToast.success(`Protection plan selected! Redirecting to secure checkout...`);
                onClose();
                if (onProceedToCheckout) {
                    onProceedToCheckout(generatedJobId);
                } else {
                    window.location.href = `#/invoice/${generatedJobId}`;
                }
            } else {
                showToast.success(`Extended Warranty Invoice #${generatedInvId} generated and added to your account!`);
                onClose();
            }
        } catch (err: any) {
            console.error("Error creating warranty contract:", err);
            showToast.error("Failed to process warranty enrollment. Please try again or contact support.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Extended Equipment Protection Plans"
            size="2xl"
        >
            <div className="space-y-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-lg border border-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                                <ShieldCheck size={28} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                        TekAir Protection Program
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        TekAir Certified Equipment Coverage
                                    </span>
                                </div>
                                <h3 className="text-xl font-black mt-1 text-white">
                                    Protect Your System Against Expensive Breakdowns
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Factory-backed extended parts &amp; labor protection with $0 out-of-pocket deductibles.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. Equipment Selection */}
                {equipmentList.length > 0 ? (
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Wrench size={14} className="text-primary-600" />
                            <span>1. Select Which System to Protect:</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {equipmentList.map(eq => {
                                const isSelected = (selectedEquipment?.id === eq.id);
                                return (
                                    <button
                                        key={eq.id}
                                        type="button"
                                        onClick={() => setSelectedEquipId(eq.id)}
                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/30 shadow-sm'
                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                {eq.brand} {eq.model}
                                            </span>
                                            {isSelected && (
                                                <CheckCircle2 size={15} className="text-primary-600 shrink-0" />
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 space-y-0.5">
                                            <div>Type: <strong>{eq.type || 'HVAC Unit'}</strong> &bull; S/N: {eq.serial || 'N/A'}</div>
                                            {eq.physicalLocation && <div>Location: {eq.physicalLocation}</div>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-500 shrink-0" />
                        <span>
                            Correlated to your registered home heating &amp; cooling equipment. Full coverage will be assigned to your primary residential HVAC system.
                        </span>
                    </div>
                )}

                {/* 2. Correlated Plans Presentation */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            <span>2. Choose Your Tailored Coverage Level:</span>
                        </label>
                        <span className="text-[11px] text-slate-400 font-medium">
                            Tailored for your {selectedEquipment?.brand || 'HVAC'} System
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {correlatedPlans.map(plan => {
                            const isSelected = activePlan?.planId === plan.planId;
                            const isPartsAndLabor = plan.coverageTier === 'parts_and_labor_plus';
                            const isLaborPlus = plan.coverageTier === 'labor_plus';

                            return (
                                <div
                                    key={plan.planId}
                                    onClick={() => setSelectedPlanId(plan.planId)}
                                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                        isSelected 
                                            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/80'
                                    }`}
                                >
                                    {plan.recommended && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[9px] uppercase tracking-widest px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                            <Sparkles size={10} /> Recommended
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                isPartsAndLabor
                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                    : isLaborPlus
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                                {plan.termYears}-Year Protection
                                            </span>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>

                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                            {plan.planName}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                            {plan.description}
                                        </p>

                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-black text-slate-900 dark:text-white">
                                                    ${plan.retailPrice.toFixed(0)}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-400">one-time</span>
                                            </div>
                                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                                Only ${(plan.retailPrice / (plan.termYears * 12)).toFixed(2)}/month equivalent
                                            </div>
                                        </div>

                                        {/* Coverage Bullets */}
                                        <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                            {plan.coverageHighlights.map((hl, i) => (
                                                <li key={i} className="flex items-start gap-1.5">
                                                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                                                    <span>{hl}</span>
                                                </li>
                                            ))}
                                            <li className="flex items-start gap-1.5">
                                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                                                <span>$0 Deductible per repair visit</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="mt-4 pt-2">
                                        <div className={`w-full py-2 text-center rounded-xl text-xs font-black transition-all ${
                                            isSelected 
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {isSelected ? 'Selected Plan' : 'Select Plan'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Why Choose TekAir Protection Guarantee */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5 flex items-center gap-1.5">
                        <Award size={14} className="text-amber-500" />
                        <span>Included With Every Protection Plan:</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-sm">&bull;</span>
                            <div><strong>Zero Deductible:</strong> You never pay a copay for covered repairs.</div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-sm">&bull;</span>
                            <div><strong>100% Transferable:</strong> Increases resale value if you sell your property.</div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-sm">&bull;</span>
                            <div><strong>Direct Billing:</strong> TekAir handles all claims directly — zero reimbursement paperwork for you.</div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-sm">&bull;</span>
                            <div><strong>A-Rated Underwriters:</strong> Certified protection backed by nationally recognized warranty underwriters.</div>
                        </div>
                    </div>
                </div>

                {/* 4. Payment Preference Selector */}
                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        3. Select Payment Preference:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setPurchaseMethod('pay_now')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                purchaseMethod === 'pay_now'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <CreditCard size={16} className={purchaseMethod === 'pay_now' ? 'text-emerald-600' : 'text-slate-400'} />
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    Pay Now &amp; Activate Immediately
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Pay via credit or debit card. Your protection plan agreement is issued and activated immediately.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPurchaseMethod('request_invoice')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                purchaseMethod === 'request_invoice'
                                    ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/20 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <FileText size={16} className={purchaseMethod === 'request_invoice' ? 'text-primary-600' : 'text-slate-400'} />
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    Add to Invoice / Pay Later
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Adds this plan as an invoice line item on your account to review and pay via bank transfer or card.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Total Protection Cost: <strong className="text-slate-900 dark:text-white text-base font-black">${activePlan?.retailPrice.toFixed(2) || '0.00'}</strong>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="text-xs flex-1 sm:flex-none"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmPurchase}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 shadow-md flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
                            disabled={isSubmitting || !activePlan}
                        >
                            {isSubmitting ? (
                                <span>Processing...</span>
                            ) : purchaseMethod === 'pay_now' ? (
                                <>
                                    <span>Proceed to Secure Checkout</span>
                                    <ArrowRight size={14} />
                                </>
                            ) : (
                                <>
                                    <span>Generate Invoice &amp; Enroll</span>
                                    <FileText size={14} />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CustomerWarrantyPurchaseModal;
