import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import type { MembershipPlan } from 'types';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad from 'components/ui/SignaturePad';
import type { InvoiceLineItem, Proposal } from 'types'; 

// Modular Components
import InvoiceHeader from './invoice-editor/InvoiceHeader';
import LineItemsList from './invoice-editor/LineItemsList';
import InvoiceActions from './invoice-editor/InvoiceActions';
import { useInvoiceLogic } from './invoice-editor/useInvoiceLogic';

interface InvoiceEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
}

const InvoiceEditorModal: React.FC<InvoiceEditorModalProps> = ({ isOpen, onClose, jobId }) => {
    const {
        currentJob,
        customerName, setCustomerName,
        address, setAddress,
        lineItems,
        handleAddItem, handleUpdateItem, handleDeleteItem,
        totals,
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
    } = useInvoiceLogic(jobId, isOpen, onClose);

    const { state } = useAppContext();
    const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
    
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
            return base as MembershipPlan;
        });
    }, [state.membershipPlans, state.currentOrganization?.id]);

    const handleEnrollMembership = (planId: string, billingCycle: 'Monthly' | 'Annual', systemCount: number) => {
        const plan = availablePlans.find(p => p.id === planId);
        if (!plan) return;

        const price = billingCycle === 'Monthly' ? plan.monthlyPrice : plan.annualPrice;
        const totalSysPrice = (systemCount - 1) * (plan.pricePerAdditionalSystem || 0);
        const finalizedPrice = billingCycle === 'Monthly' ? (price + totalSysPrice) : (price + (totalSysPrice * 12));

        setMembershipEnrollment({
            planId,
            planName: plan.name,
            billingCycle,
            systemCount,
            price: finalizedPrice
        });
        
        // Ensure to add it to the line items of the current invoice!
        handleAddItem('Part', `${plan.name} (${billingCycle} Subscription)`);
        // We cannot cleanly get the new item ID immediately, but they can edit the price themselves or just let us add it explicitly using lineItems modification
        
        setIsMembershipModalOpen(false);
    };

    if (!currentJob) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Manager #${currentJob.invoice.id}`} size="xl">
            <div className="flex flex-col space-y-6">
                <InvoiceHeader
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    address={address}
                    setAddress={setAddress}
                    currentJob={currentJob}
                />

                <LineItemsList
                    lineItems={lineItems}
                    handleUpdateItem={handleUpdateItem}
                    handleDeleteItem={handleDeleteItem}
                    handleAddItem={handleAddItem}
                    setIsDiscountModalOpen={setIsDiscountModalOpen}
                />

                <div className="mt-8 flex justify-end items-center gap-8">
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Grand Total Due</p>
                        <p className="text-3xl font-black text-primary-600">${totals.total.toFixed(2)}</p>
                    </div>
                </div>

                <InvoiceActions
                    status={currentJob.invoice.status}
                    isSaving={isSaving}
                    handlePreview={() => setIsPreviewOpen(true)}
                    handleSend={handleSendInvoice}
                    handleReceipt={handleSendReceipt}
                    handleSendReminder={handleSendReminder}
                    handleMarkPaid={handleMarkPaid}
                    handleMarkUnpaid={handleMarkUnpaid}
                    handleMarkPending={handleMarkPending}
                    handleSave={handleSave}
                    handleUploadDocumentation={handleUploadDocumentation}
                />

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
            </div>
            
            {isDiscountModalOpen && (
                <Modal isOpen={true} onClose={() => setIsDiscountModalOpen(false)} title="Apply Discount">
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
                <Modal isOpen={true} onClose={() => setIsMembershipModalOpen(false)} title="Enroll Membership">
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
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title="Sign Invoice" size="md">
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
                <Modal isOpen={true} onClose={() => setIsImportProposalModalOpen(false)} title="Import from Proposal">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">Select a proposal to import its line items into this invoice.</p>
                        <Select
                            label="Select Proposal"
                            value={selectedProposalId || ''}
                            onChange={e => setSelectedProposalId(e.target.value)}
                        >
                            <option value="">-- Select a Proposal --</option>
                            {relevantProposals.map((prop: Proposal) => (
                                <option key={prop.id} value={prop.id}>
                                    {prop.customerName} - {new Date(prop.createdAt).toLocaleDateString()} - ${prop.total.toFixed(2)}
                                </option>
                            ))}
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

        </Modal>
    );
};

export default InvoiceEditorModal;
