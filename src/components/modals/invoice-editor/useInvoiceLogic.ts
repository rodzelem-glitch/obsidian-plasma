
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Job, InvoiceLineItem, Organization, CommissionSettings, PlatformCommission, Proposal } from 'types';
import { SignaturePadHandle } from 'components/ui/SignaturePad';
import { formatAddress } from 'lib/utils';
import { globalConfirm } from "lib/globalConfirm";

export const useInvoiceLogic = (jobId: string, isOpen: boolean, onClose: () => void) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, currentOrganization } = state;

    // Core State
    const [currentJob, setCurrentJob] = useState<Job | null>(null);
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
    const [taxRate, setTaxRate] = useState(8.25);
    const [isSaving, setIsSaving] = useState(false);
    
    // UI State
    const [customerName, setCustomerName] = useState('');
    const [address, setAddress] = useState('');
    const [overrideOrg, setOverrideOrg] = useState<Organization | null>(null);
    
    // Modal States
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [discountConfig, setDiscountConfig] = useState({ scope: 'All' as 'All' | 'Labor' | 'Part', type: 'Percentage', value: 0 });
    const [isImportProposalModalOpen, setIsImportProposalModalOpen] = useState(false); 
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null); 

    const sigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        const loadJob = async () => {
            if (!jobId) return;
            console.log('Hook useEffect: Loading job with ID:', jobId);
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (jobDoc.exists) {
                const job = { ...jobDoc.data(), id: jobDoc.id } as Job;
                console.log('Hook useEffect: Job data loaded:', job);
                setCurrentJob(job);
                setLineItems(job.invoice?.items || []);
                setTaxRate(job.invoice?.taxRate ? job.invoice.taxRate * 100 : (currentOrganization?.taxRate || 8.25));
                setCustomerName(job.customerName);
                setAddress(formatAddress(job.address));

                if (job.source === 'PlatformAdmin') {
                    db.collection('organizations').doc('platform').get().then(doc => {
                         if(doc.exists) setOverrideOrg({ ...doc.data(), id: doc.id } as Organization);
                    });
                }
            } else {
                console.error('Hook useEffect: Job not found with ID:', jobId);
            }
        };
        if (isOpen) {
            loadJob();
        }
    }, [jobId, isOpen, currentOrganization?.taxRate]);

    const totals = useMemo(() => {
        const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxableAmount = lineItems.filter(i => i.taxable !== false).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = taxableAmount * (taxRate / 100);
        const total = subtotal + tax;
        return { subtotal: parseFloat(subtotal.toFixed(2)), tax: parseFloat(tax.toFixed(2)), total: parseFloat(total.toFixed(2)) };
    }, [lineItems, taxRate]);

    const handleAddItem = (type: InvoiceLineItem['type'] = 'Labor', description: string = '') => {
        const newItem: InvoiceLineItem = { id: `item-${Date.now()}`, name: 'New Item', description, quantity: 1, unitPrice: 0, total: 0, type, taxable: true };
        setLineItems(prev => [...prev, newItem]);
    };

    const handleUpdateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
        setLineItems(items => items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                updated.total = updated.quantity * updated.unitPrice; 
                return updated;
            }
            return item;
        }));
    };

    const handleDeleteItem = (id: string) => {
        setLineItems(items => items.filter(i => i.id !== id));
    };

    const applyPercentageDiscountToItems = (discountPct: number, scope: 'All' | 'Labor' | 'Part') => {
        setLineItems(prevItems => prevItems.map(item => {
            let shouldApply = false;
            if (scope === 'All') shouldApply = true;
            else if (scope === 'Labor' && item.type === 'Labor') shouldApply = true;
            else if (scope === 'Part' && item.type === 'Part') shouldApply = true;

            if (shouldApply) {
                const discountedPrice = item.unitPrice * (1 - (discountPct / 100));
                return { 
                    ...item, 
                    unitPrice: parseFloat(discountedPrice.toFixed(2)), 
                    total: parseFloat((item.quantity * discountedPrice).toFixed(2)) 
                };
            }
            return item;
        }));
    };

    const handleManualDiscount = () => {
        if (discountConfig.value <= 0) return;

        if (discountConfig.type === 'Percentage') {
            applyPercentageDiscountToItems(discountConfig.value, discountConfig.scope);
        } else { 
            const discountItem: InvoiceLineItem = {
                id: `disc-${Date.now()}`,
                name: 'Discount Applied',
                description: `Manual Discount (${discountConfig.scope}) - $${discountConfig.value.toFixed(2)}`,
                quantity: 1,
                unitPrice: -parseFloat(discountConfig.value.toFixed(2)),
                total: -parseFloat(discountConfig.value.toFixed(2)),
                type: 'Discount',
                taxable: false
            };
            setLineItems(prev => [...prev, discountItem]);
        }
        setIsDiscountModalOpen(false);
        setDiscountConfig({ scope: 'All', type: 'Percentage', value: 0 });
    };

    const handleImportFromProposal = async (proposalId: string) => {
        const proposal = state.proposals.find(p => p.id === proposalId);
        if (!proposal) { alert("Proposal not found."); return; }
        if (currentJob?.customerId && proposal.customerId && proposal.customerId !== currentJob.customerId) { 
            if(!await globalConfirm("Warning: This proposal appears to be for a different customer. Import anyway?")) return; 
        }

        // Map name to name, description to description
        const newItems: InvoiceLineItem[] = proposal.items.map(pItem => {
            return {
                id: `prop-${pItem.id}-${Date.now()}`,
                name: pItem.name || 'Proposal Item',
                description: pItem.description || '',
                quantity: pItem.quantity,
                unitPrice: pItem.price,
                total: pItem.total,
                type: pItem.type as any, // Mapped correctly
                taxable: true 
            };
        });
        setLineItems(prev => [...prev, ...newItems]);
        setIsImportProposalModalOpen(false);
        setSelectedProposalId(null);
    };

    const getPreviewJob = () => {
        if (!currentJob) return null;
        return {
            ...currentJob,
            customerName,
            address,
            invoice: {
                ...currentJob.invoice,
                items: lineItems,
                subtotal: totals.subtotal,
                taxRate: taxRate / 100,
                taxAmount: totals.tax,
                totalAmount: totals.total,
                amount: totals.total,
            },
            updatedAt: new Date().toISOString(),
            updatedById: currentUser?.id,
            updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
        };
    };

    const handleSave = async () => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for saving.");
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            onClose();
        } catch (error) { console.error(error); alert("Failed to save."); } 
        finally { setIsSaving(false); }
    };

    const handleMarkPaid = async () => {
        if (!currentJob || !await globalConfirm("Mark as PAID?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking paid.");
            updatedJob.invoice.status = 'Paid';
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            onClose();
        } catch (error) { console.error(error); } 
        finally { setIsSaving(false); }
    };

    const handleMarkUnpaid = async () => {
        if (!currentJob || !await globalConfirm("Revert to UNPAID?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking unpaid.");
            updatedJob.invoice.status = 'Unpaid';
            updatedJob.invoice.paidDate = null; 
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleSaveSignature = async (signature: string) => {
        if (!currentJob) return;
        try {
            await db.collection('jobs').doc(currentJob.id).update({
                invoiceSignature: signature,
                invoiceSignedDate: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedById: currentUser?.id,
                updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
            });
            setCurrentJob(prev => prev ? { ...prev, invoiceSignature: signature, invoiceSignedDate: new Date().toISOString() } : null);
            setIsSigningOpen(false);
        } catch (e) { alert("Error saving signature."); }
    };

    const handleSendInvoice = async () => {
        if (!currentJob || !await globalConfirm(`Send invoice #${currentJob.invoice.id} to ${currentJob.customerEmail}?`)) return;
        const email = currentJob.customerEmail;
        if (!email) { alert("Customer email missing."); return; }

        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");

            const link = `${window.location.origin}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';
            
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `Invoice #${updatedJob.invoice.id} from ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #0284c7;">Invoice Ready</h2>
                            <p>Hi ${customerName},</p>
                            <p>Your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> is ready for review.</p>
                            <div style="margin: 20px 0;">
                                <a href="${link}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View, Sign & Pay</a>
                            </div>
                            <p style="font-size: 12px; color: #666;">Link: ${link}</p>
                        </div>
                    `,
                    text: `Invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is ready. Pay here: ${link}`
                },
                organizationId: currentOrganization?.id,
                type: 'Invoice',
                createdAt: new Date().toISOString()
            });
            alert(`Invoice sent to ${email}!`);
            onClose();
        } catch (e) { console.error(e); alert("Error sending invoice."); }
        finally { setIsSaving(false); }
    };

    const handleSendReceipt = async () => {
        if (!currentJob || !await globalConfirm(`Send receipt for invoice #${currentJob.invoice.id} to ${currentJob.customerEmail}?`)) return;
        const email = currentJob.customerEmail;
        if (!email) { alert("Customer email missing."); return; }

        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare receipt for sending.");

            const orgName = currentOrganization?.name || 'Service Provider';
            
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `Payment Receipt: Invoice #${updatedJob.invoice.id}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #059669;">Payment Receipt</h2>
                            <p>Hi ${customerName},</p>
                            <p>Thank you for your payment of <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> to <strong>${orgName}</strong>.</p>
                            <div style="margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Invoice:</strong> #${updatedJob.invoice.id}</p>
                                <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${updatedJob.invoice.totalAmount?.toFixed(2)}</p>
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                                <p style="margin: 5px 0;"><strong>Status:</strong> PAID</p>
                            </div>
                            <p style="font-size: 12px; color: #666;">This email serves as your official receipt. Please retain it for your records.</p>
                        </div>
                    `,
                    text: `Payment Receipt for Invoice #${updatedJob.invoice.id}. Amount: $${updatedJob.invoice.totalAmount?.toFixed(2)}. Status: PAID.`
                },
                organizationId: currentOrganization?.id,
                type: 'Receipt',
                createdAt: new Date().toISOString()
            });
            alert(`Receipt sent to ${email}!`);
        } catch (e) { console.error(e); alert("Failed to send receipt."); }
        finally { setIsSaving(false); }
    };

    const relevantProposals = useMemo(() => {
        if (!currentJob || !currentJob.customerId) {
            return [];
        }
        
        // Find ALL proposals for this specific customer, regardless of the job ID they were created under
        const filteredProposals = state.proposals.filter(p => p.customerId === currentJob.customerId);

        return filteredProposals;
    }, [state.proposals, currentJob]);


    return {
        currentJob,
        customerName, setCustomerName,
        address, setAddress,
        lineItems, setLineItems,
        handleAddItem, handleUpdateItem, handleDeleteItem,
        totals,
        isSaving, setIsSaving,
        handleSave,
        handleMarkPaid,
        handleMarkUnpaid,
        handleSendInvoice,
        handleSendReceipt,
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
    };
};
