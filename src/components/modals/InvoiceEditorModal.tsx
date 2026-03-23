
import React from 'react';
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
        handleMarkPaid, handleMarkUnpaid,
        handleSendInvoice, handleSendReceipt,
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
        overrideOrg
    } = useInvoiceLogic(jobId, isOpen, onClose);

    if (!currentJob) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Manager #${currentJob.invoice.id}`} size="xl">
            <div className="flex flex-col h-full max-h-[85vh]">
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
                    handleMarkPaid={handleMarkPaid}
                    handleMarkUnpaid={handleMarkUnpaid}
                    handleSave={handleSave}
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
