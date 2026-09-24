import React, { useState, useMemo } from 'react';
import { DollarSign, Sparkles } from 'lucide-react';
import { showToast } from 'lib/toast';
import { formatDisplayId, checkJobHasVerifiedEquipmentSerial } from 'lib/utils';
import { useAppContext } from 'context/AppContext';
import type { MembershipPlan } from 'types';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad from 'components/ui/SignaturePad';
import AutoResizeTextarea from 'components/ui/AutoResizeTextarea';
import { resolveJobInvoiceNumber } from 'lib/numbering';
import type { InvoiceLineItem, Proposal } from 'types'; 

// Modular Components
import InvoiceHeader from './invoice-editor/InvoiceHeader';
import LineItemsList from './invoice-editor/LineItemsList';
import InvoiceActions from './invoice-editor/InvoiceActions';
import { useInvoiceLogic } from './invoice-editor/useInvoiceLogic';
import AddWarrantyToInvoiceModal from './invoice-editor/AddWarrantyToInvoiceModal';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';

interface InvoiceEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
}

const InvoiceEditorModal: React.FC<InvoiceEditorModalProps> = ({ isOpen, onClose, jobId }) => {
    const {
        currentJob,
        customer,
        customerName, setCustomerName,
        address, setAddress,
        billToName, setBillToName,
        billToAddress, setBillToAddress,
        lineItems, setLineItems,
        handleAddItem, handleUpdateItem, handleDeleteItem, handleMoveItem,
        handleAddSubItem, handleUpdateSubItem, handleDeleteSubItem,
        totals,
        taxRate, setTaxRate,
        isSaving,
        handleSave,
        handleMarkPaid, handleMarkUnpaid, handleMarkPending,
        handleSendInvoice, handleSendReceipt, handleSendReminder,
        handleUploadDocumentation,
        getPreviewJob,
        handleSaveSignature,
        sigPadRef,
        // UI states for modals
        isPreviewOpen, setIsPreviewOpen,
        isSigningOpen, setIsSigningOpen,
        isDiscountModalOpen, setIsDiscountModalOpen,
        discountConfig, setDiscountConfig,
        handleManualDiscount,
        // Proposal import
        isImportProposalModalOpen, setIsImportProposalModalOpen,
        selectedProposalId, setSelectedProposalId,
        handleImportFromProposal,
        relevantProposals,
        overrideOrg,
        // Warranty
        workmanshipWarrantyMonths, setWorkmanshipWarrantyMonths,
        partsWarrantyMonths, setPartsWarrantyMonths,
        warrantyNotes, setWarrantyNotes,
        warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed,
        membershipEnrollment, setMembershipEnrollment,
        recommendations, setRecommendations,
        handleImportJobRecommendations,
        additionalFeeName, setAdditionalFeeName,
        additionalFeePercent, setAdditionalFeePercent,
        retainagePercent, setRetainagePercent,
        invoiceDate, setInvoiceDate,
        dueDate, setDueDate,
        paymentTerms, setPaymentTerms,
        displayFormat, setDisplayFormat,
        linkedJobs,
        syncInvoiceWithLinked, setSyncInvoiceWithLinked,
        handleImportFromLinkedJobs,
        requireDeposit, setRequireDeposit,
        depositType, setDepositType,
        depositValue, setDepositValue,
        depositNotes, setDepositNotes,
        depositPaid, setDepositPaid,
        depositAmount,
    } = useInvoiceLogic(jobId, isOpen, onClose);

    const { state } = useAppContext();
    const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
    const [recipientModalConfig, setRecipientModalConfig] = useState<{
        isOpen: boolean;
        type: 'send' | 'receipt' | 'reminder';
    }>({ isOpen: false, type: 'send' });
    const [isAddWarrantyModalOpen, setIsAddWarrantyModalOpen] = useState(false);

    const handleAddWarrantyItem = (item: {
        name: string;
        description: string;
        unitPrice: number;
        type: 'Service' | 'Part/Labor';
        taxable: boolean;
        extendedWarrantyData: any;
    }) => {
        const randomIdSuffix = Math.floor(Math.random() * 1000000);
        const newItem: InvoiceLineItem = {
            id: `item-${Date.now()}-${randomIdSuffix}`,
            name: item.name,
            description: item.description,
            quantity: 1,
            unitPrice: item.unitPrice,
            total: item.unitPrice,
            type: item.type,
            taxable: item.taxable,
            isExtendedWarranty: true,
            extendedWarrantyData: item.extendedWarrantyData
        };
        setLineItems(prev => [...prev, newItem]);
        setIsAddWarrantyModalOpen(false);
        showToast.success(`Added ${item.name} to invoice`);
    };
    
    // Default system plans merged with organization
    const DEFAULT_PLANS: Omit<MembershipPlan, 'organizationId'>[] = [
        { id: 'plan-gold', name: 'Gold Plan', monthlyPrice: 29.00, annualPrice: 300.00, discountPercentage: 20, discountScope: 'Both', visitsPerYear: 2, color: 'yellow', benefits: ['Priority Scheduling', 'No Dispatch Fees', '20% Parts Discount'], pricePerAdditionalSystem: 15.00 },
        { id: 'plan-silver', name: 'Silver Plan', monthlyPrice: 19.00, annualPrice: 200.00, discountPercentage: 15, discountScope: 'Part', visitsPerYear: 1, color: 'gray', benefits: ['Priority Scheduling', '15% Parts Discount'], pricePerAdditionalSystem: 10.00 },
        { id: 'plan-bronze', name: 'Bronze Plan', monthlyPrice: 9.00, annualPrice: 100.00, discountPercentage: 10, discountScope: 'Part', visitsPerYear: 1, color: 'orange', benefits: ['10% Parts Discount'], pricePerAdditionalSystem: 5.00 }
    ];

    const availablePlans = useMemo(() => {
        const orgId = state.currentOrganization?.id || '';
        const dbPlansMap = new Map(state.membershipPlans.map(p => [p.id, p]));
        return DEFAULT_PLANS.map(def => {
            const existing = dbPlansMap.get(def.id);
            const base: any = existing || { ...def, organizationId: orgId };
            if (base.addonFeeName === undefined) base.addonFeeName = '';
            if (base.addonFeeAmount === undefined) base.addonFeeAmount = 0;
            if (base.addonFeePercent === undefined) base.addonFeePercent = 0;
            return base as MembershipPlan;
        });
    }, [state.membershipPlans, state.currentOrganization?.id]);

    const handleEnrollMembership = (planId: string, billingCycle: 'Monthly' | 'Annual', systemCount: number) => {
        const plan = availablePlans.find(p => p.id === planId);
        if (!plan) return;

        const price = billingCycle === 'Monthly' ? plan.monthlyPrice : plan.annualPrice;
        const totalSysPrice = (systemCount - 1) * (plan.pricePerAdditionalSystem || 0);
        const finalizedPrice = billingCycle === 'Monthly' ? (price + totalSysPrice) : (price + (totalSysPrice * 12));

        const planFee = (plan.addonFeeAmount || 0) + (finalizedPrice * (plan.addonFeePercent || 0) / 100);

        setMembershipEnrollment({
            planId,
            planName: plan.name,
            billingCycle,
            systemCount,
            price: finalizedPrice + planFee
        });
        
        // Ensure to add it to the line items of the current invoice!
        handleAddItem('Service', `${plan.name} (${billingCycle} Subscription)`, finalizedPrice, false);
        if (planFee > 0) {
            handleAddItem('Fee', `${plan.addonFeeName || 'Plan Fee'} - ${plan.name}`, planFee, false);
        }
        
        setIsMembershipModalOpen(false);
    };
    const isCommercial = useMemo(() => {
        if (!currentJob) return false;
        return !!(
            (currentJob as any).isProjectLevel || 
            customer?.customerType === 'Commercial' ||
            customer?.customerType === 'Property Management'
        );
    }, [currentJob, customer]);

    const preFlightAudit = useMemo(() => {
        if (!customer || !customer.submissionRules) return null;
        const rules = customer.submissionRules;
        const actualPo = (currentJob as any)?.poNumber || (currentJob as any)?.po || '';
        const poOk = !rules.requirePoNumber || (typeof actualPo === 'string' && actualPo.trim().length > 0);
        
        const sigOk = !rules.requireSignedWorkOrder || 
            !!(currentJob as any)?.customerSignature || 
            !!(currentJob as any)?.signature ||
            !!(currentJob as any)?.signOffSheetUrl ||
            !!(currentJob as any)?.signoffSheetUrl ||
            !!(currentJob as any)?.customWorkOrderFormUrl ||
            !!(currentJob as any)?.signOff?.sheetUrl ||
            (currentJob as any)?.signOff?.status === 'COMPLETED' ||
            !!(currentJob as any)?.invoiceSignature ||
            !!(currentJob as any)?.invoice?.signatureUrl ||
            !!(currentJob as any)?.workflowState?.customerSignature ||
            !!(currentJob as any)?.workflowState?.siteManagerSignature ||
            !!(currentJob as any)?.signatures?.length ||
            ((currentJob as any)?.files || []).some((f: any) => 
                f.fileName?.includes('SignOff') || 
                f.fileName?.includes('Signature') || 
                f.label?.includes('Sign-Off') || 
                f.metadata?.category === 'signoff' || 
                f.metadata?.category === 'signature'
            );
        const photoOk = !rules.requireBeforeAfterPhotos || !!((currentJob as any)?.photos && (currentJob as any).photos.length > 0);
        const serialOk = !rules.requireEquipmentSerial || checkJobHasVerifiedEquipmentSerial(currentJob, customer, state.equipment);

        const singleWoOk = !rules.requireSingleWoPerInvoice || !((currentJob as any)?.linkedInvoiceIds?.length > 0 || (currentJob as any)?.jobIds?.length > 1);

        const totalRulesCount = [rules.requirePoNumber, rules.requireSignedWorkOrder, rules.requireBeforeAfterPhotos, rules.requireEquipmentSerial, rules.requireSingleWoPerInvoice].filter(Boolean).length;
        const passedRulesCount = [rules.requirePoNumber && poOk, rules.requireSignedWorkOrder && sigOk, rules.requireBeforeAfterPhotos && photoOk, rules.requireEquipmentSerial && serialOk, rules.requireSingleWoPerInvoice && singleWoOk].filter(Boolean).length;

        const isCompliant = poOk && sigOk && photoOk && serialOk && singleWoOk;
        const apContacts = customer.contacts?.filter((c: any) => c.contactRoles?.includes('invoicing') || c.contactRoles?.includes('ap')) || [];

        return {
            rules,
            poOk,
            sigOk,
            photoOk,
            serialOk,
            singleWoOk,
            totalRulesCount,
            passedRulesCount,
            isCompliant,
            apContacts,
            portal: rules.thirdPartyPortal
        };
    }, [customer, currentJob, state.equipment]);

    if (!currentJob) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Manager #${currentJob.invoice?.id || resolveJobInvoiceNumber(currentJob)}`} size="xl" zIndex="z-[10060]">
            <div className="flex flex-col space-y-6">
                <InvoiceHeader
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    address={address}
                    setAddress={setAddress}
                    billToName={billToName}
                    setBillToName={setBillToName}
                    billToAddress={billToAddress}
                    setBillToAddress={setBillToAddress}
                    invoiceDate={invoiceDate}
                    setInvoiceDate={setInvoiceDate}
                    dueDate={dueDate}
                    setDueDate={setDueDate}
                    paymentTerms={paymentTerms}
                    setPaymentTerms={setPaymentTerms}
                    displayFormat={displayFormat}
                    setDisplayFormat={setDisplayFormat}
                    currentJob={currentJob}
                    customer={customer}
                />

                {/* COMMERCIAL PRE-FLIGHT QUALITY GATE BANNER */}
                {preFlightAudit && (preFlightAudit.totalRulesCount > 0 || preFlightAudit.portal?.required || preFlightAudit.apContacts.length > 0) && (
                    <div className={`p-4 rounded-xl border transition-all ${
                        preFlightAudit.isCompliant 
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    }`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className={`px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-wider ${
                                    preFlightAudit.isCompliant
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-600 text-white'
                                }`}>
                                    {preFlightAudit.isCompliant ? '✅ Pre-Flight Audit Passed' : `⚠️ Pre-Flight Warning (${preFlightAudit.totalRulesCount - preFlightAudit.passedRulesCount} Action Items)`}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Commercial Submission Checklist for {customer.name}
                                </h4>
                            </div>

                            {preFlightAudit.portal?.required && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-extrabold px-2.5 py-1 rounded bg-indigo-600 text-white uppercase shadow-sm">
                                        🌐 Portal Upload Required: {preFlightAudit.portal.portalName || '3rd Party Portal'}
                                    </span>
                                    {preFlightAudit.portal.portalUrl && (
                                        <a 
                                            href={preFlightAudit.portal.portalUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-bold px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded transition-colors"
                                        >
                                            Open Portal ↗
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Audit Badges */}
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                            {preFlightAudit.rules.requirePoNumber && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    preFlightAudit.poOk 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300'
                                }`}>
                                    {preFlightAudit.poOk ? '✓ PO Attached' : '❌ PO Number Required'}
                                </span>
                            )}

                            {preFlightAudit.rules.requireSignedWorkOrder && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    preFlightAudit.sigOk 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300'
                                }`}>
                                    {preFlightAudit.sigOk ? '✓ Work Order Signed' : '❌ Customer Signature Missing'}
                                </span>
                            )}

                            {preFlightAudit.rules.requireBeforeAfterPhotos && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    preFlightAudit.photoOk 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300'
                                }`}>
                                    {preFlightAudit.photoOk ? '✓ Job Photos Attached' : '❌ Job Photos (Before/After) Missing'}
                                </span>
                            )}

                            {preFlightAudit.rules.requireEquipmentSerial && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    preFlightAudit.serialOk 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300'
                                }`}>
                                    {preFlightAudit.serialOk ? '✓ Asset Serial Verified' : '❌ Equipment Specs/Serial Missing'}
                                </span>
                            )}

                            {preFlightAudit.rules.requireSingleWoPerInvoice && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    preFlightAudit.singleWoOk 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300'
                                }`}>
                                    {preFlightAudit.singleWoOk ? '✓ Single WO on Invoice' : '❌ NEST Rule: Only 1 WO Allowed Per Invoice'}
                                </span>
                            )}
                            {preFlightAudit.rules.submissionDeadlineDays && (() => {
                                const workDateStr = currentJob?.checkOutTime || currentJob?.appointmentTime || (currentJob as any)?.completedDate || invoiceDate || currentJob?.createdAt;
                                const workDate = workDateStr ? new Date(workDateStr) : new Date();
                                const elapsed = Math.max(0, Math.floor((Date.now() - workDate.getTime()) / (1000 * 60 * 60 * 24)));
                                const left = (preFlightAudit.rules.submissionDeadlineDays || 20) - elapsed;
                                return (
                                    <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                        left < 0 
                                            ? 'bg-rose-900 text-white border-rose-600 animate-pulse' 
                                            : left <= 5 
                                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                                            : left <= 10 
                                            ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    }`}>
                                        {left < 0 ? `🛑 Cutoff Passed (${Math.abs(left)}d overdue)` : `⏱️ ${left}d Remaining (20-Day Invoicing Cutoff)`}
                                    </span>
                                );
                            })()}
                        </div>

                        {/* AP Routing Contact Info */}
                        {preFlightAudit.apContacts.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 text-xs">
                                <span className="font-extrabold text-slate-500 uppercase text-[10px]">Routed AP Contacts:</span>
                                {preFlightAudit.apContacts.map((c: any) => (
                                    <span key={c.id} className="font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                        {c.name} ({c.email})
                                    </span>
                                ))}
                            </div>
                        )}

                        {preFlightAudit.rules.customSubmissionNotes && (
                            <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200 italic">
                                📌 Note: {preFlightAudit.rules.customSubmissionNotes}
                            </p>
                        )}
                    </div>
                )}

                {/* Impact Service Group $45 Initial Equipment Survey Fee Prompt */}
                {(customer?.id === 'cust-1787187506048' || customer?.name?.toLowerCase().includes('impact')) && (() => {
                    const hasAuditFee = lineItems.some(item => 
                        (item.name || '').toLowerCase().includes('audit') || 
                        (item.name || '').toLowerCase().includes('survey') || 
                        (item.description || '').toLowerCase().includes('survey') || 
                        (item.description || '').toLowerCase().includes('data verification')
                    );
                    if (hasAuditFee) return null;

                    return (
                        <div className="mb-4 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 flex items-center justify-between flex-wrap gap-3 shadow-xs">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <DollarSign size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-200 tracking-wider">
                                        Impact Contract #2282: $45 Initial Equipment Audit Fee Eligible
                                    </h4>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                        Page 10 compensation: $45 paid for first-visit physical equipment inspection, data plate recording, and filter verification across all 49 stores.
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => {
                                    handleAddItem(
                                        'Fee',
                                        'Initial Equipment Audit & Data Verification Fee - First-trip physical equipment inspection, data plate recording, and filter verification per Impact Contract #2282.',
                                        45.00,
                                        false
                                    );
                                    showToast.success("Added $45.00 Equipment Audit Fee to invoice!");
                                }}
                                className="h-8 text-xs font-black px-3.5 !bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-md border-0 shrink-0 cursor-pointer"
                            >
                                ➕ Add $45 Audit Fee
                            </Button>
                        </div>
                    );
                })()}

                <LineItemsList
                    lineItems={lineItems}
                    handleUpdateItem={handleUpdateItem}
                    handleDeleteItem={handleDeleteItem}
                    handleAddItem={handleAddItem}
                    setIsDiscountModalOpen={setIsDiscountModalOpen}
                    onOpenWarrantyModal={() => setIsAddWarrantyModalOpen(true)}
                    contractedRate={customer?.pricingRules?.contractedRate ?? customer?.pricingRules?.standardRate}
                    overtimeRate={customer?.pricingRules?.overtimeRate ?? customer?.pricingRules?.overtimeLaborRate ?? customer?.pricingRules?.overtimeContractedRate}
                    emergencyContractedRate={customer?.pricingRules?.emergencyContractedRate ?? customer?.pricingRules?.emergencyRate}
                    tripCharge={customer?.pricingRules?.tripFee ?? customer?.pricingRules?.tripCharge}
                    emergencyTripCharge={customer?.pricingRules?.emergencyTripFee ?? customer?.pricingRules?.emergencyTripCharge}
                    partsMarkupPercentage={customer?.pricingRules?.partsMarkupPercentage ?? customer?.pricingRules?.markupPercentage}
                    partsMarkupRules={customer?.pricingRules?.partsMarkupRules}
                    partsMarkupTier1={customer?.pricingRules?.partsMarkupTier1}
                    partsMarkupTier2={customer?.pricingRules?.partsMarkupTier2}
                    handleMoveItem={handleMoveItem}
                    handleAddSubItem={handleAddSubItem}
                    handleUpdateSubItem={handleUpdateSubItem}
                    handleDeleteSubItem={handleDeleteSubItem}
                />

                {/* Additional Fees and Retainage */}
                <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
                    {isCommercial && (
                        <div>
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                📋 Retainage Holdback (B2B Progressive Billing)
                            </h4>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <Input 
                                        label="Retainage Percentage (%)" 
                                        type="number" 
                                        value={retainagePercent} 
                                        onChange={e => setRetainagePercent(parseFloat(e.target.value) || 0)} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            💳 Additional Fees (e.g., Credit Card/ACH Processing)
                        </h4>
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <Input 
                                    label="Fee Name" 
                                    value={additionalFeeName} 
                                    onChange={e => setAdditionalFeeName(e.target.value)} 
                                    placeholder="e.g. Processing Fee" 
                                />
                            </div>
                            <div className="flex-1">
                                <Input 
                                    label="Fee Percentage (%)" 
                                    type="number" 
                                    value={additionalFeePercent} 
                                    onChange={e => setAdditionalFeePercent(parseFloat(e.target.value) || 0)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Down Payment / Deposit Section */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            💵 Down Payment / Deposit Requirement
                        </h4>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={requireDeposit}
                                onChange={e => {
                                    const enabled = e.target.checked;
                                    setRequireDeposit(enabled);
                                    if (!enabled) {
                                        setDepositValue(0);
                                        setDepositPaid(false);
                                    }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Require Deposit ({requireDeposit ? 'ENABLED' : 'OFF'})
                            </span>
                        </label>
                    </div>

                    {requireDeposit && (
                        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-3 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Deposit Calculation</label>
                                    <select
                                        value={depositType}
                                        onChange={e => setDepositType(e.target.value as 'flat' | 'percentage')}
                                        className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                                    >
                                        <option value="flat">Flat Dollar ($)</option>
                                        <option value="percentage">Percentage (%)</option>
                                    </select>
                                </div>
                                <div>
                                    <Input
                                        label={depositType === 'percentage' ? "Deposit Percentage (%)" : "Deposit Amount ($)"}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={depositValue}
                                        onChange={e => setDepositValue(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Input
                                        label="Calculated Deposit Due"
                                        type="text"
                                        disabled
                                        value={`$${(depositAmount || 0).toFixed(2)}`}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <Input
                                        label="Deposit Instructions / Terms"
                                        value={depositNotes}
                                        onChange={e => setDepositNotes(e.target.value)}
                                        placeholder="e.g. Deposit required prior to scheduling / start of work"
                                    />
                                </div>
                                {(depositValue > 0 || depositAmount > 0 || depositPaid) && (
                                    <label className="flex items-center gap-2 cursor-pointer pt-4 select-none">
                                        <input
                                            type="checkbox"
                                            checked={depositPaid}
                                            onChange={e => setDepositPaid(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Deposit Marked Paid ({depositPaid ? 'YES' : 'NO'})
                                        </span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-col items-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-6">
                    {(() => {
                        const invTerms = paymentTerms || currentJob.invoice.paymentTerms || 'net_30';
                        const isNet = invTerms.toLowerCase().includes('net');
                        const invTermsDisplay = isNet ? invTerms.replace('_', ' ').toUpperCase() : 'Due';

                        const rawPaid = Number(
                            (depositPaid ? (totals.depositAmount || currentJob.invoice.depositAmount || 0) : 0) ||
                            currentJob.invoice.amountPaid ||
                            currentJob.invoice.depositPaidAmount ||
                            0
                        );
                        const effectivePaid = Math.min(totals.total, Math.max(0, rawPaid));
                        const balanceRemaining = Math.max(0, totals.total - effectivePaid);

                        const dueToday = totals.depositAmount > 0 ? ((depositPaid || effectivePaid >= totals.depositAmount) ? 0 : totals.depositAmount) : (isNet ? 0 : balanceRemaining);
                        const dueNet = isNet ? balanceRemaining : 0;

                        return (
                            <div className="w-full max-w-sm space-y-2 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                {currentJob.invoice.status === 'Failed' && (
                                    <div className="mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-400 text-right">
                                        <span className="block font-black uppercase tracking-wider">⚠️ Payment Method Failed</span>
                                        {currentJob.invoice.lastFailureReason && (
                                            <span className="block text-[11px] font-normal text-rose-700 dark:text-rose-300 mt-0.5">Reason: {currentJob.invoice.lastFailureReason}</span>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400 px-2">
                                    <span className="uppercase tracking-wider">Subtotal:</span>
                                    <span className="font-black text-slate-900 dark:text-white">${totals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400 px-2 pb-1 border-b border-slate-200/50 dark:border-slate-800">
                                    <span className="uppercase tracking-wider flex items-center gap-1.5">
                                        <span>Sales Tax ({taxRate}%):</span>
                                        {customer?.taxExempt && (
                                            customer.taxExemptCertUrl ? (
                                                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 font-extrabold">
                                                    🏛️ Exempt (Cert Verified)
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 font-extrabold">
                                                    ⚠️ Cert Missing (Taxed)
                                                </span>
                                            )
                                        )}
                                    </span>
                                    <span className="font-black text-slate-900 dark:text-white">${totals.tax.toFixed(2)}</span>
                                </div>
                                {totals.depositAmount > 0 && !depositPaid && dueToday > 0 && (
                                    <div className="flex justify-between items-center text-sm font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                                        <span className="uppercase tracking-wider">Deposit Due Today:</span>
                                        <span className="font-black text-amber-900 dark:text-amber-300">
                                            ${dueToday.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                {totals.depositAmount > 0 && !depositPaid && dueToday > 0 && isNet && (
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 px-2">
                                        <span className="uppercase tracking-wider">Final Balance Due ({invTermsDisplay}):</span>
                                        <span className="font-black">${dueNet.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 px-2">
                                    <span className="uppercase tracking-wider">Grand Total:</span>
                                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">${totals.total.toFixed(2)}</span>
                                </div>
                                {(effectivePaid > 0 || depositPaid) && (
                                    <div className="flex justify-between items-center text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                        <span className="uppercase tracking-wider">{depositPaid ? 'Deposit Paid:' : 'Previously Paid:'}</span>
                                        <span className="font-black">-${effectivePaid.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-base font-black bg-[#FFF8DB] dark:bg-[#2A2415] p-3.5 rounded-xl border-2 border-[#D4AF37] shadow-sm mt-2">
                                    <span className="uppercase tracking-wider text-[#8B6508] dark:text-[#F3C649] text-xs sm:text-sm font-black">{isNet ? `Balance Due (${invTermsDisplay}):` : 'Total Due:'}</span>
                                    <span className="text-2xl font-black text-[#8B6508] dark:text-[#FFF8DB] font-mono">${balanceRemaining.toFixed(2)}</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Editor Mode Only: Internal Cost & Profit Summary */}
                {(() => {
                    let totalInternalCost = 0;
                    let totalCustomerRev = 0;
                    lineItems.forEach(item => {
                        if (item.type !== 'Discount' && item.type !== 'Fee') {
                            const cost = Number(item.cost ?? item.vendorCost ?? 0);
                            const price = Number(item.unitPrice || 0);
                            const qty = Number(item.quantity || 1);
                            if (cost > 0) {
                                totalInternalCost += cost * qty;
                            }
                            if (price > 0) {
                                totalCustomerRev += price * qty;
                            }
                        }
                    });

                    if (totalInternalCost > 0) {
                        const grossProfit = totalCustomerRev - totalInternalCost;
                        const marginPct = totalCustomerRev > 0 ? (grossProfit / totalCustomerRev) * 100 : 0;
                        return (
                            <div className="p-3.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold uppercase text-[10px] tracking-wider bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                        Editor Only
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                        Internal Cost & Profit Breakdown:
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Total Cost: <strong className="text-slate-800 dark:text-slate-200">${totalInternalCost.toFixed(2)}</strong>
                                    </span>
                                    <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        Estimated Profit: <strong>{grossProfit >= 0 ? '+' : ''}${grossProfit.toFixed(2)}</strong> ({marginPct.toFixed(1)}% margin)
                                    </span>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                {linkedJobs.length > 0 && (
                    <div className="my-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200/50 dark:border-slate-800">
                            <div className="text-left">
                                <span className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest block">
                                    Linked Jobs Invoicing ({linkedJobs.length})
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-medium block">
                                    Consolidate or share billing details across linked service records.
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleImportFromLinkedJobs}
                                className="text-[10px] uppercase font-black tracking-widest px-3 py-1.5 h-auto cursor-pointer"
                            >
                                Import Items from Linked Jobs
                            </Button>
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={syncInvoiceWithLinked}
                                onChange={e => setSyncInvoiceWithLinked(e.target.checked)}
                                className="mt-0.5 rounded border-slate-350 dark:border-slate-700 text-indigo-650 focus:ring-indigo-650 w-4 h-4 cursor-pointer"
                            />
                            <div className="space-y-0.5 text-left">
                                <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                                    Sync/Share Invoice with all Linked Jobs
                                </p>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                                    Saving or marking this invoice paid will sync the items, totals, status, and signatures to all linked jobs.
                                </p>
                            </div>
                        </label>
                    </div>
                )}

                <div className="mt-4 flex justify-end">
                    <Button 
                        variant="outline" 
                        onClick={() => setIsImportProposalModalOpen(true)}
                        disabled={!relevantProposals.length}
                        className="text-xs"
                    >
                        Import from Proposal ({relevantProposals.length})
                    </Button>
                </div>

                {/* Warranty Section */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        🛡️ Warranty Coverage
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <Input
                            label="Workmanship Warranty (months)"
                            type="number"
                            min={0}
                            value={workmanshipWarrantyMonths}
                            onChange={e => setWorkmanshipWarrantyMonths(parseInt(e.target.value) || 0)}
                        />
                        <Input
                            label="Parts Warranty (months)"
                            type="number"
                            min={0}
                            value={partsWarrantyMonths}
                            onChange={e => setPartsWarrantyMonths(parseInt(e.target.value) || 0)}
                        />
                    </div>
                    <Input
                        label="Warranty Notes / Coverage Details"
                        value={warrantyNotes}
                        onChange={e => setWarrantyNotes(e.target.value)}
                        placeholder="e.g. Covers compressor replacement, excludes refrigerant refills..."
                    />
                    {(workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0) && (
                        <label className="flex items-start gap-3 mt-3 cursor-pointer p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                            <input
                                type="checkbox"
                                checked={warrantyDisclaimerAgreed}
                                onChange={e => setWarrantyDisclaimerAgreed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded"
                            />
                            <span className="text-xs text-amber-800 dark:text-amber-400 font-bold">
                                Customer has agreed to the warranty terms and disclaimers on file. Warranty will be <span className={warrantyDisclaimerAgreed ? 'text-emerald-600' : 'text-red-500'}>{warrantyDisclaimerAgreed ? 'ACTIVE' : 'INACTIVE until agreed'}</span>.
                            </span>
                        </label>
                    )}
                </div>

                {/* Membership Section */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            💎 Membership & Automations
                        </h4>
                        {!membershipEnrollment && (
                            <Button variant="outline" onClick={() => setIsMembershipModalOpen(true)} className="text-[10px] py-1 h-auto">
                                + Enroll Customer
                            </Button>
                        )}
                    </div>
                    {membershipEnrollment ? (
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="font-bold text-blue-900 dark:text-blue-100">{membershipEnrollment.planName}</p>
                                <p className="text-xs text-blue-700 dark:text-blue-300">{membershipEnrollment.billingCycle} Billing • {membershipEnrollment.systemCount} System(s)</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-lg text-blue-900 dark:text-blue-100">${membershipEnrollment.price.toFixed(2)}</p>
                                <button onClick={() => setMembershipEnrollment(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 italic">No recurring memberships attached to this invoice.</p>
                    )}
                </div>

                {/* Notes & Recommendations Section */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            📝 Notes & Recommendations
                        </h4>
                        <button
                            type="button"
                            onClick={handleImportJobRecommendations}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs cursor-pointer"
                        >
                            <Sparkles size={12} className="text-indigo-600 dark:text-indigo-400" />
                            Import from Job
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3 uppercase font-bold tracking-widest">Job notes, technician recommendations, or customer advice for this invoice</p>
                    <AutoResizeTextarea
                        className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200"
                        value={recommendations}
                        onChange={e => setRecommendations(e.target.value)}
                        placeholder="e.g. System tested and fully operational. Recommend replacing air filter every 90 days."
                        minHeight={100}
                    />
                </div>

                <InvoiceActions
                    status={currentJob.invoice.status}
                    isSaving={isSaving}
                    remainingBalance={Math.max(0, totals.total - (currentJob?.invoice?.amountPaid || 0))}
                    handlePreview={() => setIsPreviewOpen(true)}
                    handleSend={() => setRecipientModalConfig({ isOpen: true, type: 'send' })}
                    handleReceipt={() => setRecipientModalConfig({ isOpen: true, type: 'receipt' })}
                    handleSendReminder={() => setRecipientModalConfig({ isOpen: true, type: 'reminder' })}
                    handleMarkPaid={handleMarkPaid}
                    handleMarkUnpaid={handleMarkUnpaid}
                    handleMarkPending={handleMarkPending}
                    handleSave={handleSave}
                    handleUploadDocumentation={handleUploadDocumentation}
                />
            </div>
            
            {isDiscountModalOpen && (
                <Modal isOpen={true} onClose={() => setIsDiscountModalOpen(false)} title="Apply Discount" zIndex="z-[10070]">
                    <div className="space-y-4">
                        <Select 
                            label="Scope"
                            value={discountConfig.scope}
                            onChange={e => setDiscountConfig({...discountConfig, scope: e.target.value as any})}
                        >
                            <option value="All">All Items</option>
                            <option value="Labor">Only Labor</option>
                            <option value="Part">Only Parts</option>
                        </Select>
                        <Select 
                            label="Type"
                            value={discountConfig.type} 
                            onChange={e => setDiscountConfig({...discountConfig, type: e.target.value as any})}
                        >
                            <option value="Percentage">Percentage (%)</option>
                            <option value="Fixed">Fixed Amount ($)</option>
                        </Select>
                        <Input 
                            label="Value" 
                            type="number" 
                            value={discountConfig.value} 
                            onChange={e => setDiscountConfig({...discountConfig, value: parseFloat(e.target.value) || 0})} 
                        />
                        <Button onClick={handleManualDiscount} className="w-full">Apply Discount</Button>
                    </div>
                </Modal>
            )}

            {isMembershipModalOpen && (
                <Modal isOpen={true} onClose={() => setIsMembershipModalOpen(false)} title="Enroll Membership" zIndex="z-[10070]">
                    <form 
                        onSubmit={e => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            handleEnrollMembership(
                                formData.get('planId') as string, 
                                formData.get('billingCycle') as any, 
                                parseInt(formData.get('systemCount') as string) || 1
                            );
                        }}
                        className="space-y-4"
                    >
                        <Select label="Select Plan" name="planId" required>
                            <option value="">-- Choose a Plan --</option>
                            {availablePlans.map(plan => (
                                <option key={plan.id} value={plan.id}>{plan.name} (${plan.monthlyPrice}/mo or ${plan.annualPrice}/yr)</option>
                            ))}
                        </Select>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Billing Cycle" name="billingCycle" required>
                                <option value="Monthly">Monthly Recurring</option>
                                <option value="Annual">Annual Recurring</option>
                            </Select>
                            <Input label="Number of Systems" name="systemCount" type="number" min={1} defaultValue={1} required />
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs text-slate-600 dark:text-slate-400">
                            <strong>Note:</strong> Enrolling the customer here will automatically add the first cycle's cost to this invoice and attach the service agreement for future billing.
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setIsMembershipModalOpen(false)} type="button">Cancel</Button>
                            <Button type="submit">Add to Invoice</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {isPreviewOpen && (
                <DocumentPreview
                    type="Invoice"
                    data={getPreviewJob()!}
                    onClose={() => setIsPreviewOpen(false)}
                    organization={overrideOrg}
                />
            )}

            {isSigningOpen && (
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title="Sign Invoice" size="md" zIndex="z-[10070]">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">I authorize the work performed and agree to the total amount due.</p>
                        <SignaturePad ref={sigPadRef} className="w-full h-40 border rounded" /> 
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsSigningOpen(false)}>Cancel</Button>
                            <Button onClick={() => handleSaveSignature(sigPadRef.current?.toDataURL() || '')}>Save Signature</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {isImportProposalModalOpen && (
                <Modal isOpen={true} onClose={() => setIsImportProposalModalOpen(false)} title="Import from Proposal" zIndex="z-[10070]">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">Select a proposal to import its line items into this invoice.</p>
                        <Select
                            label="Select Proposal"
                            value={selectedProposalId || ''}
                            onChange={e => setSelectedProposalId(e.target.value)}
                        >
                            <option value="">-- Select a Proposal --</option>
                            {relevantProposals.map((prop: Proposal) => {
                                const isLinkedToOtherJob = prop.jobId && prop.jobId !== currentJob.id;
                                const title = prop.title || prop.items?.[0]?.name || 'Service Proposal';
                                const statusStr = prop.status ? ` [${prop.status}]` : '';
                                const dateStr = prop.createdAt ? new Date(prop.createdAt).toLocaleDateString() : '';
                                return (
                                    <option key={prop.id} value={prop.id}>
                                        #{formatDisplayId(prop.id)} - {title} - ${prop.total?.toFixed(2)}{statusStr} ({prop.customerName} - {dateStr}){isLinkedToOtherJob ? ` (Linked to Job #${prop.jobId})` : ''}
                                    </option>
                                );
                            })}
                        </Select>
                        <Button 
                            onClick={() => selectedProposalId && handleImportFromProposal(selectedProposalId)}
                            disabled={!selectedProposalId}
                            className="w-full"
                        >
                            Import Selected Proposal
                        </Button>
                    </div>
                </Modal>
            )}
            {recipientModalConfig.isOpen && (
                <RecipientSelectorModal
                    isOpen={recipientModalConfig.isOpen}
                    onClose={() => setRecipientModalConfig(prev => ({ ...prev, isOpen: false }))}
                    customerId={currentJob.customerId}
                    locationId={currentJob.locationId || (currentJob as any).serviceLocationId}
                    locationName={currentJob.locationName || (currentJob as any).siteLocationName || (currentJob as any).address}
                    documentType={recipientModalConfig.type === 'send' ? 'invoice' : recipientModalConfig.type === 'receipt' ? 'receipt' : 'reminder'}
                    title={
                        recipientModalConfig.type === 'send'
                            ? 'Select Invoice Recipients'
                            : recipientModalConfig.type === 'receipt'
                            ? 'Select Receipt Recipients'
                            : 'Select Reminder Recipients'
                    }
                    onConfirm={(emails, attachPdf) => {
                        setRecipientModalConfig(prev => ({ ...prev, isOpen: false }));
                        if (recipientModalConfig.type === 'send') {
                            handleSendInvoice(emails, attachPdf);
                        } else if (recipientModalConfig.type === 'receipt') {
                            handleSendReceipt(emails);
                        } else if (recipientModalConfig.type === 'reminder') {
                            handleSendReminder(emails);
                        }
                    }}
                />
            )}
            {isAddWarrantyModalOpen && (
                <AddWarrantyToInvoiceModal
                    isOpen={isAddWarrantyModalOpen}
                    onClose={() => setIsAddWarrantyModalOpen(false)}
                    customer={customer}
                    job={currentJob}
                    organization={state.currentOrganization}
                    onAddWarrantyItem={handleAddWarrantyItem}
                />
            )}

        </Modal>
    );
};

export default InvoiceEditorModal;
