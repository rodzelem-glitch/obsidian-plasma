import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Job, InvoiceLineItem, Organization } from 'types';
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

    // Warranty State
    const [workmanshipWarrantyMonths, setWorkmanshipWarrantyMonths] = useState<number>(0);
    const [partsWarrantyMonths, setPartsWarrantyMonths] = useState<number>(0);
    const [warrantyNotes, setWarrantyNotes] = useState<string>('');
    const [warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed] = useState<boolean>(false);
    const [membershipEnrollment, setMembershipEnrollment] = useState<any>(null);

    const sigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        const loadJob = async () => {
            if (!jobId) return;
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (jobDoc.exists) {
                const job = { ...jobDoc.data(), id: jobDoc.id } as Job;
                setCurrentJob(job);
                setLineItems(job.invoice?.items || []);
                setTaxRate(job.invoice?.taxRate ? job.invoice.taxRate * 100 : (currentOrganization?.taxRate || 8.25));
                setCustomerName(job.customerName);
                setAddress(formatAddress(job.address));
                // Load warranty fields
                setWorkmanshipWarrantyMonths((job.invoice as any)?.workmanshipWarrantyMonths || 0);
                setPartsWarrantyMonths((job.invoice as any)?.partsWarrantyMonths || 0);
                setWarrantyNotes((job.invoice as any)?.warrantyNotes || '');
                setWarrantyDisclaimerAgreed((job.invoice as any)?.warrantyDisclaimerAgreed || false);
                setMembershipEnrollment((job.invoice as any)?.membershipEnrollment || null);

                if (job.source === 'PlatformAdmin') {
                    db.collection('organizations').doc('platform').get().then(doc => {
                         if(doc.exists) setOverrideOrg({ ...doc.data(), id: doc.id } as Organization);
                    });
                }
            }
        };
        if (isOpen) loadJob();
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
            else if (scope === 'Labor' && (item.type === 'Labor' || item.type === 'Part/Labor')) shouldApply = true;
            else if (scope === 'Part' && (item.type === 'Part' || item.type === 'Part/Labor')) shouldApply = true;
            if (shouldApply) {
                const discountedPrice = item.unitPrice * (1 - (discountPct / 100));
                return { ...item, unitPrice: parseFloat(discountedPrice.toFixed(2)), total: parseFloat((item.quantity * discountedPrice).toFixed(2)) };
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
        if (!proposal) { showToast.warn("Proposal not found."); return; }
        if (currentJob?.customerId && proposal.customerId && proposal.customerId !== currentJob.customerId) { 
            if(!await globalConfirm("Warning: This proposal appears to be for a different customer. Import anyway?")) return; 
        }

        let itemsToImport = proposal.items;
        if (proposal.selectedOption && proposal.selectedOption !== 'None') {
            itemsToImport = proposal.items.filter(item => !item.tier || item.tier === proposal.selectedOption);
        }

        const newItems: InvoiceLineItem[] = itemsToImport.map(pItem => ({
            id: `prop-${pItem.id}-${Date.now()}`,
            name: pItem.name || 'Proposal Item',
            description: pItem.description || '',
            quantity: pItem.quantity,
            unitPrice: pItem.price,
            total: pItem.total,
            type: pItem.type as any,
            taxable: true 
        }));
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
                workmanshipWarrantyMonths,
                partsWarrantyMonths,
                warrantyNotes,
                warrantyDisclaimerAgreed,
                warrantyIssuedDate: (currentJob.invoice as any)?.warrantyIssuedDate || (workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0 ? new Date().toISOString() : null),
                membershipEnrollment: membershipEnrollment || null,
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
        } catch (error) { console.error(error); showToast.warn("Failed to save."); } 
        finally { setIsSaving(false); }
    };

    const handleMarkPaid = async (paymentMethod?: string, proofUrl?: string) => {
        if (!currentJob || !await globalConfirm("Mark as PAID?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking paid.");
            updatedJob.invoice.status = 'Paid';
            updatedJob.invoice.paidDate = new Date().toISOString();
            if (paymentMethod) {
                updatedJob.invoice.paymentMethod = paymentMethod;
            }
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }

            if (paymentMethod === 'Cash') {
                const amountToAdd = updatedJob.invoice.totalAmount || 0;
                if (amountToAdd > 0) {
                    const assignedUserId = updatedJob.assignedTechnicianId || currentUser?.id;
                    if (assignedUserId) {
                        try {
                             const { firebase } = await import('lib/firebase');
                             await db.collection('users').doc(assignedUserId).update({
                                 cashBalance: firebase.firestore.FieldValue.increment(amountToAdd)
                             });
                        } catch (e) {
                             console.warn("Cash logger error", e);
                        }
                    }
                }
            }

            if (updatedJob.invoice.membershipEnrollment && currentJob.customerId) {
                const enrollment = updatedJob.invoice.membershipEnrollment;
                const newId = 'm-' + Date.now();
                const agreement = {
                    id: newId,
                    organizationId: currentOrganization?.id || '',
                    customerId: currentJob.customerId,
                    customerName: currentJob.customerName,
                    planName: enrollment.planName,
                    price: enrollment.price,
                    billingCycle: enrollment.billingCycle,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + (enrollment.billingCycle === 'Annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'Active',
                    systemCount: enrollment.systemCount,
                    createdAt: new Date().toISOString()
                };
                try {
                    await db.collection('serviceAgreements').doc(newId).set(agreement);
                } catch(e) { console.error("Error creating service agreement", e); }
            }

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
            updatedJob.invoice.paymentProofUrl = null;
            updatedJob.invoice.paymentProofDate = null;
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleMarkPending = async (proofUrl?: string, paymentMethod?: string) => {
        if (!currentJob || !await globalConfirm("Mark as PENDING (Payment verifying/clearing)?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking pending.");
            updatedJob.invoice.status = 'Pending';
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }
            if (paymentMethod) {
                updatedJob.invoice.paymentMethod = paymentMethod;
            }
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleAttachProof = async (proofUrl: string) => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for attaching proof.");
            updatedJob.invoice.paymentProofUrl = proofUrl;
            updatedJob.invoice.paymentProofDate = new Date().toISOString();
            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
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
        } catch (e) { showToast.warn("Error saving signature."); }
    };

    const handleSendInvoice = async () => {
        let email = currentJob?.customerEmail;
        if (!email && currentJob?.customerId) {
            const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
            if (custDoc.exists) email = custDoc.data()?.email;
        }

        if (!currentJob || !await globalConfirm(`Send invoice #${currentJob.invoice.id} to ${email || 'this customer'}?`)) return;
        if (!email) { showToast.warn("Customer email missing. Please update the customer profile with a valid email address."); return; }
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");
            const link = `${getBaseUrl()}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `Invoice #${updatedJob.invoice.id} from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#0284c7;">Invoice Ready</h2><p>Hi ${customerName},</p><p>Your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> is ready for review.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View, Sign &amp; Pay</a></div><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                    text: `Invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is ready. Pay here: ${link}`
                },
                organizationId: currentOrganization?.id,
                type: 'Invoice',
                createdAt: new Date().toISOString()
            });
            showToast.warn(`Invoice sent to ${email}!`);
            onClose();
        } catch (e) { console.error(e); showToast.warn("Error sending invoice."); }
        finally { setIsSaving(false); }
    };

    const handleSendReceipt = async () => {
        let email = currentJob?.customerEmail;
        if (!email && currentJob?.customerId) {
            const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
            if (custDoc.exists) email = custDoc.data()?.email;
        }

        if (!currentJob || !await globalConfirm(`Send receipt for invoice #${currentJob.invoice.id} to ${email || 'this customer'}?`)) return;
        if (!email) { showToast.warn("Customer email missing. Please update the customer profile with a valid email address."); return; }
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare receipt for sending.");
            const orgName = currentOrganization?.name || 'Service Provider';
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `Payment Receipt: Invoice #${updatedJob.invoice.id}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#059669;">Payment Receipt</h2><p>Hi ${customerName},</p><p>Thank you for your payment of <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> to <strong>${orgName}</strong>.</p><div style="margin:20px 0;"><p style="margin:5px 0;"><strong>Invoice:</strong> #${updatedJob.invoice.id}</p><p style="margin:5px 0;"><strong>Amount Paid:</strong> $${updatedJob.invoice.totalAmount?.toFixed(2)}</p><p style="margin:5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p style="margin:5px 0;"><strong>Status:</strong> PAID</p></div><p style="font-size:12px;color:#666;">This email serves as your official receipt. Please retain it for your records.</p></div>`,
                    text: `Payment Receipt for Invoice #${updatedJob.invoice.id}. Amount: $${updatedJob.invoice.totalAmount?.toFixed(2)}. Status: PAID.`
                },
                organizationId: currentOrganization?.id,
                type: 'Receipt',
                createdAt: new Date().toISOString()
            });
            showToast.warn(`Receipt sent to ${email}!`);
        } catch (e) { console.error(e); showToast.warn("Failed to send receipt."); }
        finally { setIsSaving(false); }
    };

    const handleSendReminder = async () => {
        let email = currentJob?.customerEmail;
        let phone = currentJob?.customerPhone;
        if (!email && currentJob?.customerId) {
            const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
            if (custDoc.exists) {
                email = custDoc.data()?.email;
                phone = custDoc.data()?.phone || phone;
            }
        }

        if (!currentJob || !await globalConfirm(`Send payment reminder for invoice #${currentJob.invoice.id} to ${email || 'this customer'}?`)) return;
        if (!email && !phone) { showToast.warn("Customer requires an email or phone number for reminders."); return; }
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");
            const link = `${getBaseUrl()}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';
            
            if (email) {
                await db.collection('mail').add({
                    to: [email],
                    message: {
                        subject: `Reminder: Invoice #${updatedJob.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;"><h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${customerName},</p><p>This is a friendly reminder that your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                        text: `Reminder: Invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is outstanding. Pay here: ${link}`
                    },
                    organizationId: currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                });
            }

            if (phone) {
                await db.collection('messages').add({
                    to: phone,
                    body: `Reminder from ${orgName}: Your invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: currentOrganization?.id,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                });
            }

            showToast.warn(`Reminder sent via ${email ? 'email' : ''} ${email && phone ? 'and ' : ''}${phone ? 'SMS text' : ''}!`);
            onClose();
        } catch (e) { console.error(e); showToast.warn("Error sending reminder."); }
        finally { setIsSaving(false); }
    };

    const handleUploadDocumentation = async (urls: string[]) => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const existingUrls = (currentJob as any).documentationUrls || [];
            const updatedUrls = [...existingUrls, ...urls];
            await db.collection('jobs').doc(currentJob.id).update({
                documentationUrls: updatedUrls,
                updatedAt: new Date().toISOString(),
                updatedById: currentUser?.id,
                updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
            });
            setCurrentJob(prev => prev ? { ...prev, documentationUrls: updatedUrls } : null);
            showToast.warn("Documentation updated!");
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to update documentation.");
        } finally {
            setIsSaving(false);
        }
    };

    const relevantProposals = useMemo(() => {
        if (!currentJob) return [];
        return state.proposals.filter(p => 
            p.jobId === currentJob.id || 
            (currentJob.customerId && p.customerId === currentJob.customerId) || 
            (p.customerName && currentJob.customerName && p.customerName.toLowerCase() === currentJob.customerName.toLowerCase())
        );
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
        handleMarkPending,
        handleAttachProof,
        handleSendInvoice,
        handleSendReceipt,
        handleSendReminder,
        handleUploadDocumentation,
        getPreviewJob,
        handleSaveSignature,
        sigPadRef,
        isPreviewOpen, setIsPreviewOpen,
        isSigningOpen, setIsSigningOpen,
        isDiscountModalOpen, setIsDiscountModalOpen,
        discountConfig, setDiscountConfig,
        handleManualDiscount,
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
    };
};
