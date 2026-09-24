import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { 
    ShieldCheck, 
    Wrench, 
    FileText, 
    DollarSign, 
    Calendar, 
    Check, 
    Download, 
    Send, 
    CheckCircle2, 
    AlertTriangle,
    Eye,
    Building2,
    MapPin,
    Tag
} from 'lucide-react';
import { Customer, Job, Organization, WarrantyContract, WarrantyPlanTemplate, IndustryVertical } from 'types';
import { getDefaultWarrantyPlan, calculateWarrantyPricing, generateWarrantyContractHtml } from 'lib/warrantyHelper';
import { generateWarrantyContractPdfAttachment } from 'lib/pdfHelper';
import { formatFullAddress } from 'lib/utils';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';

interface IssueWarrantyModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    job?: Job | null;
    initialEquipment?: any | null;
    organization?: Organization | null;
    onSuccess?: (contract: WarrantyContract) => void;
}

export const IssueWarrantyModal: React.FC<IssueWarrantyModalProps> = ({
    isOpen,
    onClose,
    customer,
    job,
    initialEquipment,
    organization,
    onSuccess
}) => {
    const customerSigPadRef = useRef<SignaturePadHandle>(null);
    const repSigPadRef = useRef<SignaturePadHandle>(null);

    const [step, setStep] = useState<'details' | 'review_sign' | 'complete'>('details');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Selected Trade & Plan Template
    const trade: IndustryVertical = (organization?.industry as IndustryVertical) || 'HVAC';
    const plan: WarrantyPlanTemplate = useMemo(() => {
        const orgAny = organization as any;
        if (orgAny?.warrantyPlans && orgAny.warrantyPlans[trade]) {
            return orgAny.warrantyPlans[trade];
        }
        if (orgAny?.defaultWarrantyPlan) {
            return orgAny.defaultWarrantyPlan;
        }
        return getDefaultWarrantyPlan(trade, organization);
    }, [organization, trade]);

    // Form State
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
    const [systemType, setSystemType] = useState<string>('Split');
    const [refrigerant, setRefrigerant] = useState<string>('R-410A');
    const [nominalTons, setNominalTons] = useState<number>(3);
    const [approxAgeYears, setApproxAgeYears] = useState<number>(5);
    const [outdoorModel, setOutdoorModel] = useState<string>('');
    const [outdoorSerial, setOutdoorSerial] = useState<string>('');
    const [indoorModel, setIndoorModel] = useState<string>('');
    const [indoorSerial, setIndoorSerial] = useState<string>('');
    const [qualifyingInvoiceNumber, setQualifyingInvoiceNumber] = useState<string>('');
    const [qualifyingServiceDate, setQualifyingServiceDate] = useState<string>('');
    const [isAdditionalSystem, setIsAdditionalSystem] = useState<boolean>(false);
    const [waiveQualificationFee, setWaiveQualificationFee] = useState<boolean>(true);
    const [documentedExcludedConditions, setDocumentedExcludedConditions] = useState<string>('None documented at time of initial enrollment inspection. System verified in operable condition.');

    // Acknowledgments State (5 checkboxes)
    const [ack1, setAck1] = useState(false);
    const [ack2, setAck2] = useState(false);
    const [ack3, setAck3] = useState(false);
    const [ack4, setAck4] = useState(false);
    const [ack5, setAck5] = useState(false);

    // Signatures State
    const [customerSignedName, setCustomerSignedName] = useState<string>('');
    const [companyRepName, setCompanyRepName] = useState<string>('');
    const [companyRepTitle, setCompanyRepTitle] = useState<string>('Service Manager');
    const [createdContract, setCreatedContract] = useState<WarrantyContract | null>(null);

    // Initialize fields when modal opens or customer/job changes
    useEffect(() => {
        if (!isOpen) return;

        setStep('details');
        setCustomerSignedName(customer?.name || '');
        setCompanyRepName(organization?.name ? `${organization.name} Representative` : 'Authorized Representative');

        // Check if there was a qualifying paid invoice on the current job
        const jobInvNumber = (job?.invoice as any)?.invoiceNumber || job?.invoice?.id || (job as any)?.workOrderNumber || '';
        setQualifyingInvoiceNumber(jobInvNumber || 'INV-QUALIFIED');
        
        const jobDate = (job as any)?.completedAt || job?.appointmentTime || new Date().toISOString().split('T')[0];
        setQualifyingServiceDate(jobDate);

        // Pre-populate equipment if provided or from customer equipment list
        const equipList = (customer?.equipment || []) as any[];
        const targetEq = initialEquipment || equipList[0];
        if (targetEq) {
            setSelectedEquipmentId(targetEq.id || '');
            if (targetEq.type) setSystemType(targetEq.type);
            if (targetEq.modelNumber || targetEq.model) setOutdoorModel(targetEq.modelNumber || targetEq.model);
            if (targetEq.serialNumber || targetEq.serial) setOutdoorSerial(targetEq.serialNumber || targetEq.serial);
            if (targetEq.indoorModel) setIndoorModel(targetEq.indoorModel);
            if (targetEq.indoorSerial) setIndoorSerial(targetEq.indoorSerial);
            if (targetEq.tonnage) {
                setNominalTons(typeof targetEq.tonnage === 'number' ? targetEq.tonnage : parseFloat(String(targetEq.tonnage)) || 3);
            }
            if (targetEq.refrigerantType) setRefrigerant(targetEq.refrigerantType);
            if (targetEq.ageYears) setApproxAgeYears(parseInt(String(targetEq.ageYears)) || 5);
        } else if (job) {
            // Check job description/tasks/equipment
            const diag = (job as any)?.diagnosticNotes || {};
            if (diag.modelNumber) setOutdoorModel(diag.modelNumber);
            if (diag.serialNumber) setOutdoorSerial(diag.serialNumber);
            if (diag.tonnage) setNominalTons(typeof diag.tonnage === 'number' ? diag.tonnage : parseFloat(String(diag.tonnage)) || 3);
            if (diag.refrigerant) setRefrigerant(diag.refrigerant);
            if (diag.ageYears) setApproxAgeYears(parseInt(String(diag.ageYears)) || 5);
        }
    }, [isOpen, customer, job, initialEquipment, organization]);

    // Handle equipment dropdown selection
    const handleSelectEquipment = (eId: string) => {
        setSelectedEquipmentId(eId);
        const equip = (customer?.equipment || []).find(e => e.id === eId) as any;
        if (equip) {
            if (equip.type) setSystemType(equip.type);
            if (equip.modelNumber || equip.model) setOutdoorModel(equip.modelNumber || equip.model);
            if (equip.serialNumber || equip.serial) setOutdoorSerial(equip.serialNumber || equip.serial);
            if (equip.indoorModel) setIndoorModel(equip.indoorModel);
            if (equip.indoorSerial) setIndoorSerial(equip.indoorSerial);
            if (equip.tonnage) {
                setNominalTons(typeof equip.tonnage === 'number' ? equip.tonnage : parseFloat(String(equip.tonnage)) || 3);
            }
            if (equip.refrigerantType) setRefrigerant(equip.refrigerantType);
            if (equip.ageYears) setApproxAgeYears(parseInt(String(equip.ageYears)) || 5);
        }
    };

    // Calculate Pricing dynamically
    const pricingCalc = useMemo(() => {
        return calculateWarrantyPricing(plan, approxAgeYears, isAdditionalSystem, waiveQualificationFee);
    }, [plan, approxAgeYears, isAdditionalSystem, waiveQualificationFee]);

    const allAcksChecked = ack1 && ack2 && ack3 && ack4 && ack5;

    // Handle Contract Execution & Firestore Save
    const handleExecuteContract = async () => {
        if (!customer) {
            showToast.error("Missing customer record.");
            return;
        }

        const custSig = customerSigPadRef.current?.toDataURL() || '';
        const repSig = repSigPadRef.current?.toDataURL() || '';

        if (!custSig) {
            showToast.error("Customer digital signature is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            const contractId = `war_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const contractNum = `WAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const customerFullAddr = formatFullAddress(
                customer.address,
                customer.city,
                customer.state,
                customer.zip
            );

            const newContract: WarrantyContract = {
                id: contractId,
                contractNumber: contractNum,
                organizationId: organization?.id || '',
                customerId: customer.id,
                customerName: customer.name || 'Customer',
                serviceAddress: customerFullAddr,
                customerPhone: customer.phone || '',
                customerEmail: customer.email || '',
                trade,
                planTitle: plan.planTitle || 'HVAC LIMITED REPAIR WARRANTY',
                agreementDate: pricingCalc.agreementDate,
                effectiveDate: pricingCalc.effectiveDate,
                expirationDate: pricingCalc.expirationDate,
                status: 'Active',
                
                equipmentId: selectedEquipmentId || undefined,
                systemType,
                refrigerant,
                nominalTons,
                approxAgeYears,
                outdoorModel: outdoorModel || undefined,
                outdoorSerial: outdoorSerial || undefined,
                indoorModel: indoorModel || undefined,
                indoorSerial: indoorSerial || undefined,
                qualifyingInvoiceNumber: qualifyingInvoiceNumber || undefined,
                qualifyingJobId: job?.id || undefined,
                qualifyingServiceDate: qualifyingServiceDate || undefined,

                basePrice: pricingCalc.basePrice,
                qualificationFee: pricingCalc.qualificationFee,
                qualificationFeeWaived: pricingCalc.qualificationFeeWaived,
                totalAmount: pricingCalc.totalAmount,
                paymentStatus: 'Paid',
                annualAggregateLimit: plan.annualAggregateLimit || 2500,
                remainingBenefitLimit: plan.annualAggregateLimit || 2500,
                serviceFee: plan.serviceFee || 125,
                replacementCreditLimit: plan.replacementCreditLimit || 1500,

                ageTierLabel: pricingCalc.matchedTier?.label || 'Standard',
                sublimits: plan.sublimits || [],
                documentedExcludedConditions,

                customerSignature: custSig,
                customerSignedName: customerSignedName || customer.name,
                customerSignedDate: pricingCalc.agreementDate,
                companyRepSignature: repSig,
                companyRepName: companyRepName || organization?.name || 'Representative',
                companyRepTitle: companyRepTitle || 'Service Manager',
                companyRepSignedDate: pricingCalc.agreementDate,
                acknowledgmentsChecked: { ack1, ack2, ack3, ack4, ack5 },

                claimsCount: 0,
                totalClaimsPaid: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Save to Firestore under organizations/{orgId}/warrantyContracts/{contractId} and customer document
            await setDoc(doc(db, 'organizations', organization?.id || 'default', 'warrantyContracts', contractId), newContract);
            
            // Also append to customer document
            await updateDoc(doc(db, 'customers', customer.id), {
                warrantyContracts: arrayUnion(newContract)
            });

            setCreatedContract(newContract);
            setStep('complete');
            showToast.success(`Warranty Agreement #${contractNum} issued successfully!`);
            onSuccess?.(newContract);
        } catch (err: any) {
            console.error("Error issuing warranty contract:", err);
            showToast.error(`Failed to issue warranty: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Download PDF handler
    const handleDownloadPdf = async () => {
        if (!createdContract) return;
        setIsDownloading(true);
        try {
            const attachment = await generateWarrantyContractPdfAttachment(createdContract, organization);
            if (attachment.path) {
                window.open(attachment.path, '_blank');
            } else if (attachment.content) {
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${attachment.content}`;
                link.download = attachment.filename;
                link.click();
            }
            showToast.success("Warranty Contract PDF downloaded.");
        } catch (e) {
            console.error("Error downloading PDF:", e);
            showToast.error("Failed to generate PDF download.");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Issue ${trade} Limited Repair Warranty`}
            size="2xl"
        >
            <div className="space-y-6">

                {/* Progress Breadcrumbs */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            step === 'details' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}>1</span>
                        <span className={step === 'details' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                            System &amp; Pricing
                        </span>
                    </div>

                    <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700"></div>

                    <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            step === 'review_sign' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>2</span>
                        <span className={step === 'review_sign' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                            Terms &amp; Signatures
                        </span>
                    </div>

                    <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700"></div>

                    <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            step === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>3</span>
                        <span className={step === 'complete' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                            Executed &amp; PDF
                        </span>
                    </div>
                </div>

                {/* STEP 1: Details & System Configuration */}
                {step === 'details' && (
                    <div className="space-y-5">
                        {/* Customer Information Preview */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Enrolling Customer</span>
                                <strong className="text-slate-800 dark:text-white">{customer?.name}</strong>
                                <div className="text-slate-500">{customer?.address || 'Address on file'}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Term Duration</span>
                                <strong className="text-slate-800 dark:text-white">12 Months</strong>
                                <div className="text-slate-400">Starts Day 31</div>
                            </div>
                        </div>

                        {/* Equipment Selector */}
                        {customer?.equipment && customer.equipment.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select from Customer's Registered Equipment:
                                </label>
                                <select 
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs dark:bg-slate-800 dark:text-white"
                                    value={selectedEquipmentId}
                                    onChange={e => handleSelectEquipment(e.target.value)}
                                >
                                    <option value="">-- Choose Equipment (or enter specs manually) --</option>
                                    {customer.equipment.map((eq: any) => (
                                        <option key={eq.id} value={eq.id}>
                                            {eq.systemNickname || eq.type || 'HVAC Unit'} - {eq.modelNumber || eq.model || 'Model'} ({eq.tonnage || '3'} Ton, ~{eq.ageYears || '5'} yrs)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Enrolled System Specifications */}
                        <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                <Tag size={14} /> Enrolled System Specifications
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">System Type</label>
                                    <select 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={systemType}
                                        onChange={e => setSystemType(e.target.value)}
                                    >
                                        <option value="Split">Split System</option>
                                        <option value="Package">Package Unit</option>
                                        <option value="Heat Pump">Heat Pump</option>
                                        <option value="Gas-Elec">Gas-Electric</option>
                                        <option value="Mini-Split">Ductless Mini-Split</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Refrigerant</label>
                                    <select 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={refrigerant}
                                        onChange={e => setRefrigerant(e.target.value)}
                                    >
                                        <option value="R-410A">R-410A</option>
                                        <option value="R-454B">R-454B</option>
                                        <option value="R-32">R-32</option>
                                        <option value="R-22">R-22 (Special Endorsement)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Nominal Tons</label>
                                    <input 
                                        type="number" 
                                        step="0.5"
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={nominalTons}
                                        onChange={e => setNominalTons(parseFloat(e.target.value) || 3)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Approx. Age (Years)</label>
                                    <input 
                                        type="number" 
                                        className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={approxAgeYears}
                                        onChange={e => setApproxAgeYears(parseInt(e.target.value) || 0)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Outdoor Model #</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={outdoorModel}
                                        onChange={e => setOutdoorModel(e.target.value)}
                                        placeholder="e.g. 4TTR4036L"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Outdoor Serial #</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={outdoorSerial}
                                        onChange={e => setOutdoorSerial(e.target.value)}
                                        placeholder="e.g. 2314M5890"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Indoor Model #</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={indoorModel}
                                        onChange={e => setIndoorModel(e.target.value)}
                                        placeholder="e.g. TEM4A0B36"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Indoor Serial #</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={indoorSerial}
                                        onChange={e => setIndoorSerial(e.target.value)}
                                        placeholder="e.g. 2315N4820"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Qualifying Invoice #</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:text-white"
                                        value={qualifyingInvoiceNumber}
                                        onChange={e => setQualifyingInvoiceNumber(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing & Fee Summary */}
                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <DollarSign size={14} /> Annual Pricing &amp; Fees
                                </h4>
                                <span className="text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                    Tier: {pricingCalc.matchedTier?.label || '0–10 Years'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="addlSystem"
                                            checked={isAdditionalSystem}
                                            onChange={e => setIsAdditionalSystem(e.target.checked)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <label htmlFor="addlSystem" className="text-slate-700 dark:text-slate-300 font-medium">
                                            Additional system at same address (Discounted)
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="waiveFee"
                                            checked={waiveQualificationFee}
                                            onChange={e => setWaiveQualificationFee(e.target.checked)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <label htmlFor="waiveFee" className="text-slate-700 dark:text-slate-300 font-medium">
                                            Waive $129 Qualification Fee (Paid service in last 30 days)
                                        </label>
                                    </div>
                                </div>

                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60 space-y-1">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Annual Warranty Fee:</span>
                                        <strong className="text-slate-900 dark:text-white">${pricingCalc.basePrice}</strong>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Qualification Fee:</span>
                                        <span>{pricingCalc.qualificationFeeWaived ? <strong className="text-emerald-600">WAIVED ($0)</strong> : `$${pricingCalc.qualificationFee}`}</span>
                                    </div>
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1 flex justify-between font-black text-sm text-emerald-700 dark:text-emerald-400">
                                        <span>Total Due at Enrollment:</span>
                                        <span>${pricingCalc.totalAmount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Known / Excluded Conditions */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Known / Excluded Conditions Documented at Enrollment:
                            </label>
                            <textarea 
                                rows={2}
                                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 dark:bg-slate-800 dark:text-white"
                                value={documentedExcludedConditions}
                                onChange={e => setDocumentedExcludedConditions(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={() => setStep('review_sign')} className="bg-emerald-600 hover:bg-emerald-700">
                                Proceed to Signatures &amp; Review &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Review & Dual E-Signatures */}
                {step === 'review_sign' && (
                    <div className="space-y-5">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <CheckCircle2 size={14} /> Mandatory Customer Acknowledgments
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Please ensure the customer reviews each item and check all 5 acknowledgments prior to signing:
                            </p>

                            <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ack1} 
                                        onChange={e => setAck1(e.target.checked)} 
                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I received and reviewed the complete agreement, including component sublimits, exclusions, and total aggregate caps.</span>
                                </label>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ack2} 
                                        onChange={e => setAck2(e.target.checked)} 
                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I understand this is a limited repair warranty, not homeowners insurance and not a guarantee of full system replacement.</span>
                                </label>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ack3} 
                                        onChange={e => setAck3(e.target.checked)} 
                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I acknowledge the <strong>$125 service fee</strong> per claim, the <strong>30-day waiting period</strong>, and the <strong>$2,500 annual limit</strong>.</span>
                                </label>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ack4} 
                                        onChange={e => setAck4(e.target.checked)} 
                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I understand that {organization?.name || 'the service provider'} must directly authorize all repairs and that pre-existing conditions are strictly excluded.</span>
                                </label>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ack5} 
                                        onChange={e => setAck5(e.target.checked)} 
                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I acknowledge there is <strong>no automatic renewal</strong> upon expiration of the 12-month term.</span>
                                </label>
                            </div>
                        </div>

                        {/* Dual Signature Pads */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer Signature */}
                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                                <label className="block text-xs font-bold text-slate-800 dark:text-white">
                                    Customer Digital Signature <span className="text-rose-500">*</span>
                                </label>
                                <Input 
                                    label="Customer Printed Name" 
                                    value={customerSignedName} 
                                    onChange={e => setCustomerSignedName(e.target.value)} 
                                />
                                <div className="pt-1">
                                    <SignaturePad ref={customerSigPadRef} className="w-full h-32" />
                                </div>
                            </div>

                            {/* Company Representative Signature */}
                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                                <label className="block text-xs font-bold text-slate-800 dark:text-white">
                                    {organization?.name || 'Company'} Representative Signature
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input 
                                        label="Rep Name" 
                                        value={companyRepName} 
                                        onChange={e => setCompanyRepName(e.target.value)} 
                                    />
                                    <Input 
                                        label="Title" 
                                        value={companyRepTitle} 
                                        onChange={e => setCompanyRepTitle(e.target.value)} 
                                    />
                                </div>
                                <div className="pt-1">
                                    <SignaturePad ref={repSigPadRef} className="w-full h-32" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <Button variant="secondary" onClick={() => setStep('details')}>
                                &larr; Back to Details
                            </Button>
                            <Button 
                                onClick={handleExecuteContract}
                                disabled={isSubmitting || !allAcksChecked}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {isSubmitting ? 'Issuing & Finalizing...' : 'Execute & Issue Warranty'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Complete / Executed PDF */}
                {step === 'complete' && createdContract && (
                    <div className="space-y-6 text-center py-6">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <ShieldCheck size={36} />
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                Warranty Agreement Executed!
                            </h3>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                Agreement #{createdContract.contractNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                                Active for 12 months &bull; Day 31 Waiting Period &bull; $2,500 Aggregate Cap
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Enrolled Equipment:</span>
                                <strong>{createdContract.systemType} ({createdContract.nominalTons} Ton)</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Service Address:</span>
                                <strong>{createdContract.serviceAddress}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Coverage Window:</span>
                                <strong>{createdContract.effectiveDate} to {createdContract.expirationDate}</strong>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                                <span className="text-slate-500">Annual Price Paid:</span>
                                <strong className="text-emerald-600">${createdContract.totalAmount}</strong>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 pt-2">
                            <Button 
                                onClick={handleDownloadPdf} 
                                disabled={isDownloading}
                                className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 text-xs"
                            >
                                <Download size={16} />
                                {isDownloading ? 'Generating PDF...' : 'Download Signed 3-Page PDF'}
                            </Button>
                            <Button variant="secondary" onClick={onClose} className="text-xs">
                                Close
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </Modal>
    );
};

export default IssueWarrantyModal;
