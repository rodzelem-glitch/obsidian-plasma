import showToast from "lib/toast";
import { getBaseUrl, cleanUndefinedFields, createEmailButtonHtml } from "lib/utils";
import React, { useState, useMemo, useEffect } from 'react';
import Card from 'components/ui/Card';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import Spinner from 'components/ui/Spinner';
import { useAppContext } from 'context/AppContext';
import { db, firebase, functions } from 'lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import type { PartOrder, InvoiceLineItem, Job, Proposal, ShopOrder, Customer } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import CreatePaymentLinkModal from 'components/modals/CreatePaymentLinkModal';
import { useNavigate } from 'react-router-dom';
import { FileText, Briefcase, Wrench, Edit, Trash2, Plus, CreditCard, Send, CheckCircle, RefreshCw, Search, User, Eye, Bell, DollarSign, Archive, ArchiveRestore } from 'lucide-react';
import DocumentPreview from 'components/ui/DocumentPreview';
import { globalConfirm } from "lib/globalConfirm";
import { uploadFileToStorage } from 'lib/storageService';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import SelectExistingJobModal from 'components/modals/SelectExistingJobModal';


const PaymentsAndOrders: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'proposals' | 'invoices' | 'parts'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');

    // --- STATE: INVOICES ---
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [showPaidInvoices, setShowPaidInvoices] = useState(false);
    const [showArchivedProposals, setShowArchivedProposals] = useState(false);
    const [isCreatePaymentLinkOpen, setIsCreatePaymentLinkOpen] = useState(false);
    
    // Customer Selection State
    const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
    const [invoiceModalMode, setInvoiceModalMode] = useState<'job' | 'standalone'>('job');
    const [custSearch, setCustSearch] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    
    // Existing Job Interception States
    const [selectedCustomerForExisting, setSelectedCustomerForExisting] = useState<Customer | null>(null);
    const [existingJobsForCustomer, setExistingJobsForCustomer] = useState<Job[]>([]);
    const [isExistingJobModalOpen, setIsExistingJobModalOpen] = useState(false);
    
    // --- STATE: PARTS ---
    const [selectedJobId, setSelectedJobId] = useState<string>(state.jobs[0]?.id || '');
    const [partsList, setPartsList] = useState('');
    const [partCost, setPartCost] = useState('');
    const [fulfillmentMethod, setFulfillmentMethod] = useState<'Truck Stock' | 'Purchase' | 'PunchOut' | 'Special Order'>('Truck Stock');
    const [priceChecked, setPriceChecked] = useState(false);
    const [orderStatus, setOrderStatus] = useState('');
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [isPunchingOut, setIsPunchingOut] = useState(false);
    
    // Purchase specific state
    const [paymentMethod, setPaymentMethod] = useState<'Company Credit' | 'Personal Funds' | 'Other'>('Company Credit');
    const [paymentExplanation, setPaymentExplanation] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);

    // --- STATE: PREVIEWER ---
    const [viewingDocument, setViewingDocument] = useState<{type: 'Invoice' | 'Proposal', data: Job | Proposal} | null>(null);
    const [proposalReminderModal, setProposalReminderModal] = useState<{
        isOpen: boolean;
        proposal: Proposal | null;
    }>({ isOpen: false, proposal: null });

    useEffect(() => {
        if (viewingDocument?.data?.id) {
            if (viewingDocument.type === 'Invoice') {
                const latestJob = (state.jobs || []).find((j: any) => j.id === viewingDocument.data.id);
                if (latestJob && latestJob !== viewingDocument.data) {
                    setViewingDocument(prev => prev ? { ...prev, data: latestJob } : null);
                }
            } else if (viewingDocument.type === 'Proposal') {
                const latestProp = (state.proposals || []).find((p: any) => p.id === viewingDocument.data.id);
                if (latestProp && latestProp !== viewingDocument.data) {
                    setViewingDocument(prev => prev ? { ...prev, data: latestProp } : null);
                }
            }
        }
    }, [state.jobs, state.proposals, viewingDocument?.data?.id, viewingDocument?.type]);

    // --- FILTERED LISTS ---
    const isRealInvoice = (inv: any) => {
        if (!inv || !inv.id) return false;
        const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
        const hasTotal = (Number(inv.totalAmount) || Number(inv.amount) || Number(inv.subtotal) || 0) > 0;
        const isPaidOrSent = inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Partially Paid';
        return hasItems || hasTotal || isPaidOrSent;
    };

    const filteredInvoices = useMemo(() => {
        const seenInvoiceIds = new Set<string>();
        const result: Job[] = [];

        const validJobs = state.jobs.filter(j => j.invoice && isRealInvoice(j.invoice) && (showPaidInvoices || j.invoice.status !== 'Paid'));
        for (const j of validJobs) {
            const invId = j.invoice!.id;
            if (!seenInvoiceIds.has(invId)) {
                seenInvoiceIds.add(invId);
                result.push(j);
            }
        }

        return result
            .filter(j => 
                (j.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                (j.invoice?.id || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, showPaidInvoices, searchTerm]);

    const filteredProposals = useMemo(() => {
        return state.proposals
            .filter(p => {
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = !searchLower || 
                    (p.customerName || '').toLowerCase().includes(searchLower) ||
                    (p.title || '').toLowerCase().includes(searchLower);

                // When searching, search across all proposals (including archived)
                if (searchTerm.trim()) {
                    return matchesSearch;
                }

                if (showArchivedProposals) {
                    return p.archived && matchesSearch;
                }

                return !p.archived && matchesSearch;
            })
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [state.proposals, searchTerm, showArchivedProposals]);

    const filteredCustomers = useMemo(() => {
        if (!custSearch) return [];
        const searchLower = custSearch.toLowerCase();
        return state.customers.filter(c => 
            c.name.toLowerCase().includes(searchLower) || 
            (c.phone && c.phone.includes(custSearch)) ||
            c.serviceLocations?.some(loc => 
                (loc.propertyName || '').toLowerCase().includes(searchLower) ||
                (loc.address || '').toLowerCase().includes(searchLower)
            )
        ).slice(0, 5);
    }, [state.customers, custSearch]);

    const latestProposal = filteredProposals.length > 0 ? filteredProposals[0] : null;
    const latestInvoice = filteredInvoices.length > 0 ? filteredInvoices[0] : null;
    const latestPartOrder = state.partOrders.length > 0 ? state.partOrders[0] : null;

    // --- ACTIONS: INVOICES ---
    const handleInitCreateInvoice = () => {
        setCustSearch('');
        setInvoiceModalMode('job');
        setIsCustomerSelectOpen(true);
    };

    const proceedCreateInvoice = async (customer?: Customer, parentJob?: Job) => {
        if (isCreatingInvoice) return;
        setIsCreatingInvoice(true);
        setIsCustomerSelectOpen(false);
        setIsExistingJobModalOpen(false);

        const nextInvId = await getNextInvoiceNumber(state.currentOrganization?.id || '');
        const id = `job-inv-${Date.now()}`;
        const newJob: Job = {
            id,
            organizationId: state.currentOrganization?.id || '',
            customerName: parentJob?.customerName || (customer ? customer.name : 'New Customer'), 
            customerId: parentJob?.customerId || (customer ? customer.id : null),
            customerEmail: parentJob?.customerEmail || (customer ? customer.email : ''),
            customerPhone: parentJob?.customerPhone || (customer ? customer.phone : ''),
            address: parentJob?.address || (customer ? customer.address : ''),
            poNumber: parentJob?.poNumber || '',
            parentJobId: parentJob?.id || undefined,
            locationId: parentJob?.locationId || null,
            locationName: parentJob?.locationName || '',
            tasks: parentJob?.tasks || ['Service Call'],
            jobStatus: 'Completed', 
            appointmentTime: parentJob?.appointmentTime || new Date().toISOString(),
            specialInstructions: parentJob?.specialInstructions || '',
            divisionId: parentJob?.divisionId || state.currentOrganization?.divisions?.[0]?.id || null,
            invoice: {
                id: nextInvId,
                status: 'Unpaid',
                items: [],
                subtotal: 0,
                taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
                taxAmount: 0,
                totalAmount: 0,
                amount: 0
            },
            jobEvents: []
        };
        
        try {
            await db.collection('jobs').doc(id).set(cleanUndefinedFields(newJob));
            if (parentJob?.id) {
                const updatedLinked = Array.from(new Set([...(parentJob.linkedInvoiceIds || []), nextInvId]));
                await db.collection('jobs').doc(parentJob.id).update(cleanUndefinedFields({ linkedInvoiceIds: updatedLinked }));
                dispatch({ type: 'UPDATE_JOB', payload: { id: parentJob.id, linkedInvoiceIds: updatedLinked } });
            }
            dispatch({ type: 'ADD_JOB', payload: newJob });
            setEditingInvoiceId(id);
            showToast.success(`Created new Invoice #${nextInvId} for ${newJob.customerName}!`);
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to create invoice.");
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    const handleCreateInvoice = async (customer?: Customer) => {
        if (!customer) {
            await proceedCreateInvoice(undefined);
            return;
        }

        const customerJobs = state.jobs.filter(j => 
            j.customerId === customer.id && 
            !j.archived && 
            !j.deleted && 
            (!j.invoice || j.invoice.status !== 'Paid')
        );

        if (customerJobs.length > 0) {
            setIsCustomerSelectOpen(false);
            setSelectedCustomerForExisting(customer);
            setExistingJobsForCustomer(customerJobs);
            setIsExistingJobModalOpen(true);
        } else {
            await proceedCreateInvoice(customer);
        }
    };

    const handleSelectExistingJob = (job: Job) => {
        setIsExistingJobModalOpen(false);
        setEditingInvoiceId(job.id);
    };

    const handleDeleteInvoice = async (jobId: string) => {
        if (await globalConfirm("Delete this invoice? (The job, work order, site photos, notes, and records will remain active)")) {
            try {
                const targetJob = state.jobs.find(j => j.id === jobId);
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(jobId).update({
                        invoice: firebase.firestore.FieldValue.delete(),
                        invoiceId: firebase.firestore.FieldValue.delete(),
                        invoiceDate: firebase.firestore.FieldValue.delete(),
                        invoiceSignature: firebase.firestore.FieldValue.delete(),
                        updatedAt: new Date().toISOString()
                    });
                    if (targetJob?.invoice?.id) {
                        db.collection('invoices').doc(targetJob.invoice.id).delete().catch(() => {});
                    }
                }
                if (targetJob) {
                    const updatedJob = { ...targetJob };
                    delete (updatedJob as any).invoice;
                    delete (updatedJob as any).invoiceId;
                    delete (updatedJob as any).invoiceDate;
                    delete (updatedJob as any).invoiceSignature;
                    updatedJob.updatedAt = new Date().toISOString();
                    dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                }
                showToast.success("Invoice deleted successfully. Job remains active.");
            } catch (err: any) {
                console.error("Failed to delete invoice:", err);
                showToast.error("Failed to delete invoice.");
            }
        }
    };

    // --- ACTIONS: PROPOSALS ---
    const handleCreateProposal = () => {
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        const basePath = isStaff ? '/admin' : '/briefing';
        navigate(`${basePath}/proposal`);
    };

    const handleEditProposal = (id: string) => {
        const p = state.proposals.find(item => item.id === id);
        if (p?.isProjectLevel) {
            navigate(`/admin/project-proposals?editId=${id}`);
            return;
        }
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        const basePath = isStaff ? '/admin' : '/briefing';
        navigate(`${basePath}/proposal?proposalId=${id}`);
    };

    const handleDeleteProposal = async (id: string) => {
        if (await globalConfirm("Delete this proposal? (The job and other documents will remain active)")) {
            try {
                if (!state.isDemoMode) {
                    await db.collection('proposals').doc(id).update(cleanUndefinedFields({
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
                    }));
                    const linkedJobs = state.jobs.filter(j => j.proposalId === id || (j.linkedProposalIds || []).includes(id));
                    for (const j of linkedJobs) {
                        const newLinked = (j.linkedProposalIds || []).filter(pid => pid !== id);
                        const updates: any = { linkedProposalIds: newLinked };
                        if (j.proposalId === id) updates.proposalId = firebase.firestore.FieldValue.delete();
                        await db.collection('jobs').doc(j.id).update(updates).catch(() => {});
                        const updatedJob = { ...j, linkedProposalIds: newLinked };
                        if (j.proposalId === id) delete (updatedJob as any).proposalId;
                        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                    }
                }
                dispatch({ type: 'DELETE_PROPOSAL', payload: id });
                showToast.success("Proposal deleted successfully.");
            } catch (err: any) {
                console.error("Failed to delete proposal:", err);
                showToast.error("Failed to delete proposal.");
            }
        }
    };

    const handleArchiveProposal = async (proposal: Proposal, archive: boolean) => {
        try {
            const updatedProposal: Proposal = {
                ...proposal,
                archived: archive,
                archivedAt: archive ? new Date().toISOString() : null,
                archivedBy: archive ? (state.currentUser?.name || state.currentUser?.email || 'User') : null,
                updatedAt: new Date().toISOString(),
            };

            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                archived: archive,
                archivedAt: archive ? new Date().toISOString() : null,
                archivedBy: archive ? (state.currentUser?.name || state.currentUser?.email || 'User') : null,
                updatedAt: new Date().toISOString(),
            }));

            dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal });
            showToast.success(archive ? "Proposal archived successfully" : "Proposal restored successfully");
        } catch (error) {
            console.error("Error archiving proposal:", error);
            showToast.error("Failed to update proposal archive status");
        }
    };

    const handleSendProposalReminder = async (proposal: Proposal, selectedEmails?: string[]) => {
        let emails = selectedEmails;
        if (!emails) {
            const email = proposal.customerEmail;
            if (!email) {
                showToast.warn("Customer email missing for this proposal.");
                return;
            }
            emails = [email];
        }

        if (!selectedEmails && !await globalConfirm(`Send proposal reminder to ${emails.join(', ')}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/proposal-view/${proposal.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            
            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: emails,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Following up: Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #e0e7ff;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;"><h2 style="color:#4f46e5;margin-top:0;">Proposal Reminder</h2><p style="font-size:15px;color:#334155;">Hi ${proposal.customerName},</p><p style="font-size:15px;color:#334155;">We are following up on the proposal we sent you for <strong>$${(proposal.total ?? 0).toFixed(2)}</strong>. You can review the details and quickly accept it online so we can get started.</p>${createEmailButtonHtml('Review &amp; Accept Proposal Online', link, '#4f46e5')}<p style="font-size:13px;color:#64748b;margin-top:20px;">If you have any questions, please let us know.</p></div>`,
                    text: `Reminder: Your proposal for $${(proposal.total ?? 0).toFixed(2)} is awaiting review. Review here: ${link}`,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: state.currentOrganization?.id,
                type: 'ProposalReminder',
                createdAt: new Date().toISOString()
            }));

            showToast.warn(`Reminder sent via email to ${emails.join(', ')}!`);
        } catch (e) {
            console.error(e);
            showToast.warn("Error sending reminder.");
        }
    };

    // --- ACTIONS: PARTS ---
    const handleOrderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingOrder) return;
        
        const cost = parseFloat(partCost);
        if (isNaN(cost) || cost < 0) return;
        
        setIsSubmittingOrder(true);
        setOrderStatus('Submitting...');
        
        try {
            const jobToUpdate = state.jobs.find(job => job.id === selectedJobId);
            if (jobToUpdate) {
                const itemDescription = fulfillmentMethod === 'Special Order' 
                    ? `${partsList} (On Order)` 
                    : partsList;

                const newInvoiceItem: InvoiceLineItem = {
                    id: `item-${Date.now()}`,
                    name: `Parts: ${fulfillmentMethod}`,
                    description: itemDescription,
                    quantity: 1,
                    unitPrice: cost,
                    total: cost,
                    type: 'Part',
                    taxable: true
                };

                const currentItems = jobToUpdate.invoice?.items || [];
                const updatedItems = [...currentItems, newInvoiceItem];
                
                const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const taxRate = jobToUpdate.invoice?.taxRate || 0;
                const taxAmount = subtotal * taxRate;
                const totalAmount = subtotal + taxAmount;

                const updatedJob = {
                    ...jobToUpdate,
                    invoice: { 
                        ...jobToUpdate.invoice, 
                        items: updatedItems,
                        subtotal,
                        taxAmount,
                        totalAmount,
                        amount: totalAmount // keep legacy amount in sync
                    }
                };
                await db.collection('jobs').doc(jobToUpdate.id).update(cleanUndefinedFields(updatedJob));
            }
            
            const status = fulfillmentMethod === 'Special Order' ? 'Pending Approval' : 'Fulfilled';

            const newPartOrder: any = {
                id: `order-${Date.now()}`,
                organizationId: state.currentOrganization?.id || '',
                jobId: selectedJobId,
                parts: partsList,
                cost: cost,
                status: status,
                fulfillmentMethod: fulfillmentMethod,
                orderedBy: state.currentUser?.id,
                createdAt: new Date().toISOString()
            };

            if (fulfillmentMethod === 'Purchase') {
                let receiptUrl = null;
                if (receiptFile) {
                    const safeName = receiptFile.name ? receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg';
                    const path = `organizations/${state.currentOrganization?.id || 'unknown'}/expenses/${Date.now()}_${safeName}`;
                    receiptUrl = await uploadFileToStorage(path, receiptFile);
                }
                
                const newExpense = {
                    id: `exp-${Date.now()}`,
                    organizationId: state.currentOrganization?.id || '',
                    date: new Date().toISOString().split('T')[0],
                    category: paymentMethod === 'Personal Funds' ? 'Reimbursable' : (paymentMethod === 'Company Credit' ? 'Materials' : 'Needs Review'),
                    description: `Parts House Purchase: ${partsList}${paymentExplanation ? ` - ${paymentExplanation}` : ''}`,
                    amount: cost,
                    vendor: 'Parts House',
                    paidBy: paymentMethod === 'Company Credit' ? 'Company' : state.currentUser?.id,
                    projectId: null,
                    receiptData: null,
                    receiptUrl: receiptUrl,
                    createdAt: new Date().toISOString(),
                    createdById: state.currentUser?.id,
                    createdByName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                    status: 'Pending Review'
                };
                await db.collection('expenses').doc(newExpense.id).set(cleanUndefinedFields(newExpense));
                newPartOrder.expenseId = newExpense.id;
            }

            await db.collection('partOrders').doc(newPartOrder.id).set(cleanUndefinedFields(newPartOrder));
            
            setOrderStatus(`Order submitted successfully.`);
            setPartsList('');
            setPartCost('');
            setPriceChecked(false);
            setFulfillmentMethod('Truck Stock');
            setPaymentMethod('Company Credit');
            setPaymentExplanation('');
            setReceiptFile(null);
            setTimeout(() => setOrderStatus(''), 5000);
        } catch (error) {
            console.error("Error submitting part order:", error);
            setOrderStatus('Failed to submit order.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const handleInitiatePunchOut = async () => {
        if (isPunchingOut) return;
        setIsPunchingOut(true);
        setOrderStatus('');
        
        try {
            const initPunchout = functions.httpsCallable('initiatePunchoutSession');
            const result = await initPunchout({ jobId: selectedJobId });
            
            if (result.data.success && result.data.url) {
                // Redirect user out of the app and into the supplier's B2B site
                window.location.href = result.data.url;
            } else {
                setOrderStatus('Could not retrieve supplier URL.');
            }
        } catch (e: any) {
            console.error("Punchout error:", e);
            if (e.message?.includes('not fully configured') || e.message?.includes('identity config is incomplete')) {
                showToast.warn("Supplier Not Linked:\n\nYour administrator hasn't linked a supplier catalog yet. Please ask your admin to configure the B2B PunchOut Integration in the Settings > Integrations tab before you can order parts.");
                setOrderStatus('Supplier not configured.');
            } else {
                showToast.warn(`PunchOut Connection Failed: ${e.message}`);
                setOrderStatus('PunchOut failed to connect.');
            }
        } finally {
            setIsPunchingOut(false);
        }
    };

    const handleDeletePartOrder = async (orderId: string) => {
        if (await globalConfirm("Are you sure you want to delete this part order?")) {
            try {
                await db.collection('partOrders').doc(orderId).delete();
            } catch (error) {
                console.error("Error deleting part order:", error);
                showToast.warn("Failed to delete order.");
            }
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-32">
            {/* Customer Select Modal */}
            <Modal isOpen={isCustomerSelectOpen} onClose={() => setIsCustomerSelectOpen(false)} title="Create / Select Invoice">
                <div className="space-y-4">
                    {/* Mode Selector */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => { setInvoiceModalMode('job'); setCustSearch(''); }}
                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                                invoiceModalMode === 'job'
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-300 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            📋 Select Open Job (Recommended)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setInvoiceModalMode('standalone'); setCustSearch(''); }}
                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                                invoiceModalMode === 'standalone'
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-300 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            📄 Create Standalone Invoice
                        </button>
                    </div>

                    {invoiceModalMode === 'job' ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                <Input 
                                    placeholder="Search open jobs by WO #, customer, address..." 
                                    value={custSearch} 
                                    onChange={e => setCustSearch(e.target.value)} 
                                    className="pl-10"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                                {(() => {
                                    const searchLower = custSearch.toLowerCase();
                                    const openJobs = (state.jobs || []).filter((j: any) => {
                                        if (j.archived || j.deleted || j.jobStatus === 'Archived') return false;
                                        if (j.invoice && j.invoice.status === 'Paid') return false;
                                        if (!searchLower) return true;
                                        return (
                                            (j.customerName && j.customerName.toLowerCase().includes(searchLower)) ||
                                            (j.poNumber && j.poNumber.toLowerCase().includes(searchLower)) ||
                                            (j.id && j.id.toLowerCase().includes(searchLower)) ||
                                            (j.locationName && j.locationName.toLowerCase().includes(searchLower)) ||
                                            (j.address && j.address.toLowerCase().includes(searchLower)) ||
                                            (j.tasks && j.tasks.some((t: string) => t.toLowerCase().includes(searchLower)))
                                        );
                                    }).sort((a: any, b: any) => new Date(b.createdAt || b.appointmentTime || 0).getTime() - new Date(a.createdAt || a.appointmentTime || 0).getTime());

                                    if (openJobs.length === 0) {
                                        return (
                                            <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                No matching open jobs found. You can switch to "Create Standalone Invoice" above.
                                            </div>
                                        );
                                    }

                                    return openJobs.map((j: any) => {
                                        const hasInvoice = Boolean(j.invoice && (j.invoice.id || (j.invoice.items && j.invoice.items.length > 0) || Number(j.invoice.totalAmount || j.invoice.amount || 0) > 0));

                                        return (
                                            <div
                                                key={j.id}
                                                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-sm text-[#123A63] dark:text-sky-300">
                                                            {j.customerName || 'Customer'}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                            WO #{j.poNumber || j.id.slice(-6)}
                                                        </span>
                                                        {hasInvoice && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                INV #{j.invoice.id || 'Current'} &bull; ${(Number(j.invoice.totalAmount || j.invoice.amount || 0)).toFixed(2)} ({j.invoice.status || 'Draft'})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {j.locationName ? `${j.locationName} • ` : ''}{j.address || 'No address specified'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    {hasInvoice ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsCustomerSelectOpen(false);
                                                                    setEditingInvoiceId(j.id);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1"
                                                                title="Modify current invoice on this job"
                                                            >
                                                                ✏️ Modify Current INV #{j.invoice.id || ''}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => proceedCreateInvoice(undefined, j)}
                                                                className="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm transition-all flex items-center gap-1"
                                                                title="Create a new additional invoice for this job"
                                                            >
                                                                + New Invoice
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsCustomerSelectOpen(false);
                                                                setEditingInvoiceId(j.id);
                                                            }}
                                                            className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1"
                                                        >
                                                            + Create Invoice &rarr;
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                <Input 
                                    placeholder="Search customers by name or phone..." 
                                    value={custSearch} 
                                    onChange={e => setCustSearch(e.target.value)} 
                                    className="pl-10"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-2 space-y-2">
                                <div 
                                    onClick={() => proceedCreateInvoice(undefined)}
                                    className="p-3 bg-white dark:bg-gray-700 rounded border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3"
                                >
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><Plus size={16}/></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Create Blank Invoice</p>
                                        <p className="text-xs text-gray-500">I will enter details manually</p>
                                    </div>
                                </div>

                                {filteredCustomers.map(c => {
                                    const searchLower = custSearch.toLowerCase();
                                    const matchingLoc = custSearch ? c.serviceLocations?.find(loc => 
                                        (loc.propertyName || '').toLowerCase().includes(searchLower) ||
                                        (loc.address || '').toLowerCase().includes(searchLower)
                                    ) : null;
                                    const locName = matchingLoc ? (matchingLoc.propertyName || matchingLoc.address) : null;

                                    return (
                                        <div 
                                            key={c.id} 
                                            onClick={() => proceedCreateInvoice(c)}
                                            className="p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-500 transition-colors flex items-center gap-3"
                                        >
                                            <div className="bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 p-2 rounded-full"><User size={16}/></div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{c.name}</p>
                                                <p className="text-xs text-gray-500">{c.address} • {c.phone}</p>
                                                {locName && (
                                                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                                                        Matches location: {locName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-end">
                        <Button variant="secondary" onClick={() => setIsCustomerSelectOpen(false)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    {activeTab === 'dashboard' ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales & Payments</h2>
                            <p className="text-gray-600 dark:text-gray-400">Manage invoices, estimates, and orders.</p>
                        </>
                    ) : (
                        <Button 
                            variant="secondary" 
                            onClick={() => setActiveTab('dashboard')} 
                            className="w-auto flex items-center gap-2 text-xs bg-white dark:bg-gray-800"
                        >
                            &larr; Back to Dashboard
                        </Button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button 
                        onClick={() => setIsCreatePaymentLinkOpen(true)} 
                        className="w-auto flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                    >
                        <DollarSign size={16}/> Request Deposit / Payment Link
                    </Button>
                    {activeTab === 'invoices' && (
                        <Button onClick={handleInitCreateInvoice} disabled={isCreatingInvoice} className="w-auto flex items-center gap-2 text-xs">
                            {isCreatingInvoice ? <RefreshCw className="animate-spin" size={16}/> : <Plus size={16}/>} New Invoice
                        </Button>
                    )}
                    {activeTab === 'proposals' && (
                        <Button onClick={handleCreateProposal} className="w-auto flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-700">
                            <Plus size={16}/> New Proposal
                        </Button>
                    )}
                </div>
            </header>

            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-2 mt-4">
                    <div 
                        onClick={() => setActiveTab('proposals')}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer hover:border-primary-400 hover:shadow-xl flex flex-col gap-4 group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 transition-colors">
                                <Briefcase size={28}/>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">Proposals</span>
                        </div>
                        {latestProposal ? (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Most Recent</p>
                                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{latestProposal.customerName}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-gray-500">{new Date(latestProposal.createdAt).toLocaleDateString()}</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">${(latestProposal.total ?? 0).toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 opacity-50">
                                <p className="text-sm italic text-gray-500">No proposals yet.</p>
                            </div>
                        )}
                    </div>
                    
                    <div 
                        onClick={() => setActiveTab('invoices')}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer hover:border-primary-400 hover:shadow-xl flex flex-col gap-4 group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 transition-colors">
                                <FileText size={28}/>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">Invoices</span>
                        </div>
                        {latestInvoice ? (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Most Recent</p>
                                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{latestInvoice.customerName}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-gray-500">#{latestInvoice.invoice.id}</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">${(latestInvoice.invoice.totalAmount ?? latestInvoice.invoice.amount ?? 0).toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 opacity-50">
                                <p className="text-sm italic text-gray-500">No invoices yet.</p>
                            </div>
                        )}
                    </div>

                    <div 
                        onClick={() => setActiveTab('parts')}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer hover:border-primary-400 hover:shadow-xl flex flex-col gap-4 group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 transition-colors">
                                <Wrench size={28}/>
                            </div>
                            <span className="font-black text-lg text-gray-900 dark:text-white">Parts & Orders</span>
                        </div>
                        {latestPartOrder ? (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Most Recent Log</p>
                                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{latestPartOrder.parts}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-amber-600 dark:text-amber-400">{latestPartOrder.status}</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">${(latestPartOrder.cost ?? 0).toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 opacity-50">
                                <p className="text-sm italic text-gray-500">No recent orders.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTENT */}
            {activeTab === 'invoices' && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <Input 
                            label="" 
                            placeholder="Search invoices..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="flex-1 dark:text-white"
                        />
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 rounded border border-gray-200 dark:border-gray-700">
                            <input type="checkbox" checked={showPaidInvoices} onChange={e => setShowPaidInvoices(e.target.checked)} id="showPaid" />
                            <label htmlFor="showPaid" className="text-sm text-gray-600 dark:text-gray-300">Show Paid</label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredInvoices.map(job => (
                            <div key={job.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{job.customerName}</span>
                                        <span className="text-xs text-gray-500 font-mono">#{job.invoice.id}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Date: {new Date(job.appointmentTime).toLocaleDateString()}</p>
                                    {(() => {
                                        const sentTime = job.invoice?.sentAt || (job as any).invoiceSentAt || (job.invoice as any)?.emailSentAt;
                                        return (
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1">
                                                {sentTime ? (
                                                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                                                        📤 Sent: {new Date(sentTime).toLocaleDateString()} {new Date(sentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">
                                                        📝 Not Sent (Draft)
                                                    </span>
                                                )}
                                            </p>
                                        );
                                    })()}
                                    <div className="mt-1 flex flex-col gap-1 items-start">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${job.invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {job.invoice.status}
                                        </span>
                                        {job.invoice.opened && job.invoice.status !== 'Paid' && (
                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                Opened
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 w-full sm:w-auto">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">${(job.invoice.totalAmount ?? job.invoice.amount ?? 0).toFixed(2)}</span>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button variant="secondary" onClick={() => setViewingDocument({ type: 'Invoice', data: job })} className="px-3 py-1 text-xs border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                            <Eye size={14}/> View
                                        </Button>
                                        <Button variant="secondary" onClick={() => handleDeleteInvoice(job.id)} className="text-red-700 dark:text-red-400 font-bold px-3 py-1 text-xs border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/40">
                                            <Trash2 size={14}/>
                                        </Button>
                                        <Button onClick={() => setEditingInvoiceId(job.id)} className="px-4 py-1 text-xs flex items-center justify-center gap-2 flex-1">
                                            <Edit size={14}/> Manage
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredInvoices.length === 0 && <p className="text-center text-gray-500 py-4 md:py-8">No invoices found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'proposals' && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <Input 
                            label="" 
                            placeholder="Search proposals..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="flex-1 dark:text-white"
                        />
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 rounded border border-gray-200 dark:border-gray-700">
                            <input type="checkbox" checked={showArchivedProposals} onChange={e => setShowArchivedProposals(e.target.checked)} id="showArchived" />
                            <label htmlFor="showArchived" className="text-sm text-gray-600 dark:text-gray-300">Show Archived</label>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {filteredProposals.map(p => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{p.customerName}</span>
                                        <div className="flex flex-col gap-0.5 items-start">
                                            {p.archived ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase border bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 flex items-center gap-1">
                                                    <Archive size={12} />
                                                    Archived
                                                </span>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                                                    p.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' : 
                                                    p.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' : 
                                                    p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 
                                                    'bg-blue-100 text-blue-800 border-blue-200'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            )}
                                            {p.archived && (
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    ({p.status === 'Accepted' ? 'Job Completed' : p.status})
                                                </span>
                                            )}
                                            {(p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened')) && p.status !== 'Accepted' && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                    Opened
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Created: {new Date(p.createdAt).toLocaleDateString()}</p>
                                    {(() => {
                                        const propSentTime = p.sentAt || p.sentDate || (p.status === 'Sent' || p.status === 'Opened' || p.status === 'Accepted' ? p.updatedAt : null);
                                        return (
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1">
                                                {propSentTime ? (
                                                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                                                        📤 Sent: {new Date(propSentTime).toLocaleDateString()} {new Date(propSentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">
                                                        📝 Not Sent (Draft)
                                                    </span>
                                                )}
                                            </p>
                                        );
                                    })()}
                                    <p className="text-xs text-gray-400 mt-1">Option: {p.selectedOption || 'Standard'}</p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 w-full sm:w-auto">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">${(p.total ?? 0).toFixed(2)}</span>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        {p.status !== 'Accepted' && (
                                            <Button variant="secondary" onClick={() => setProposalReminderModal({ isOpen: true, proposal: p })} className="px-3 py-1 text-xs border bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-800/40">
                                                <Bell size={14} /> Remind
                                            </Button>
                                        )}
                                        <Button variant="secondary" onClick={() => setViewingDocument({ type: 'Proposal', data: p })} className="px-3 py-1 text-xs border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                            <Eye size={14}/> View
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => handleArchiveProposal(p, !p.archived)} 
                                            title={p.archived ? "Restore Proposal" : "Archive Proposal"}
                                            className={`px-3 py-1 text-xs border ${
                                                p.archived 
                                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-800/40' 
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                        </Button>
                                        <Button variant="secondary" onClick={() => handleDeleteProposal(p.id)} className="text-red-700 dark:text-red-400 font-bold px-3 py-1 text-xs border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/40">
                                            <Trash2 size={14}/>
                                        </Button>
                                        <Button onClick={() => handleEditProposal(p.id)} className="px-4 py-1 text-xs flex items-center justify-center gap-2 flex-1 bg-purple-600 hover:bg-purple-700">
                                            <Edit size={14}/> Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredProposals.length === 0 && <p className="text-center text-gray-500 py-4 md:py-8">No proposals found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'parts' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-4">Parts Action / Request</h3>
                        <form onSubmit={handleOrderSubmit} className="space-y-4">
                            <Select label="Select Job" id="job-select" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="dark:text-white">
                                {state.jobs.map(job => (
                                <option key={job.id} value={job.id}>{job.customerName}</option>
                                ))}
                            </Select>

                            <Select label="Fulfillment Method" id="fulfillment-select" value={fulfillmentMethod} onChange={e => setFulfillmentMethod(e.target.value as any)} className="dark:text-white">
                                <option value="Truck Stock">Use Parts on Hand (Truck Stock)</option>
                                <option value="Purchase">Purchase at Supply House (Manual Receipt)</option>
                                <option value="PunchOut">Order from B2B Supplier Catalog (cXML)</option>
                                <option value="Special Order">Request Special Order (From Office)</option>
                            </Select>

                            {fulfillmentMethod === 'PunchOut' ? (
                                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-4 text-center">
                                    <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2">
                                        <RefreshCw className={isPunchingOut ? "animate-spin" : ""} size={24} />
                                    </div>
                                    <h4 className="font-black text-lg text-amber-900 dark:text-amber-400 uppercase tracking-wide">Automated Restock</h4>
                                    <p className="text-sm text-amber-800/70 dark:text-amber-200/60 mb-4 max-w-sm mx-auto">
                                        This will launch the live dynamic parts catalog for your integrated supplier. Once you complete your cart, it will automatically bridge as a Purchase Order.
                                    </p>
                                    <Button type="button" onClick={handleInitiatePunchOut} disabled={!selectedJobId || isPunchingOut} className="w-full sm:w-auto mx-auto !bg-amber-600 hover:!bg-amber-700 text-white font-bold py-3">
                                        {isPunchingOut ? "Connecting to Supplier..." : "Launch Supplier Catalog"}
                                    </Button>
                                    {orderStatus && <p className="text-sm text-amber-700 mt-2 font-bold">{orderStatus}</p>}
                                </div>
                            ) : (
                                <>
                                    {fulfillmentMethod === 'Purchase' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 border rounded-lg space-y-4">
                                    <h4 className="font-bold text-sm">Payment Details</h4>
                                    <Select label="Method of Payment" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                                        <option value="Company Credit">Company Credit/Card</option>
                                        <option value="Personal Funds">Paid out of pocket (Reimbursable)</option>
                                        <option value="Other">Other</option>
                                    </Select>
                                    
                                    {paymentMethod === 'Other' && (
                                        <Input label="Explanation" value={paymentExplanation} onChange={e => setPaymentExplanation(e.target.value)} required placeholder="Explain payment structure..." />
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Receipt Image (Required)</label>
                                        <input 
                                            type="file" 
                                            title="Upload Receipt Image"
                                            accept="image/*" 
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file && file.size > 5 * 1024 * 1024) {
                                                    showToast.warn("File Too Large: The receipt photo must be under 5MB. Please compress the image.");
                                                    e.target.value = '';
                                                    setReceiptFile(null);
                                                } else {
                                                    setReceiptFile(file || null);
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">This will automatically log an expense for admin review.</p>
                                </div>
                            )}

                            <Textarea id="parts-list" label="Parts Description" value={partsList} onChange={e => setPartsList(e.target.value)} required placeholder="e.g. 1/2 inch copper pipe, 10ft" />
                            <Input id="part-cost" label="Charge to Customer ($)" type="number" step="0.01" value={partCost} onChange={e => setPartCost(e.target.value)} required className="dark:text-white" />
                            
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" checked={priceChecked} onChange={e => setPriceChecked(e.target.checked)} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Customer pricing checked?</span>
                            </label>

                            <Button type="submit" disabled={!partsList || !selectedJobId || !partCost || !priceChecked || isSubmittingOrder}>
                                {isSubmittingOrder ? <Spinner size="sm" /> : 'Log Part / Submit Request'}
                            </Button>
                            {orderStatus && <p className="text-sm text-center text-green-600 dark:text-green-400 mt-2">{orderStatus}</p>}
                            </>
                            )}
                        </form>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Logs & Orders</h3>
                        <div className="space-y-4">
                            {state.partOrders.map(order => (
                                <div key={order.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center group">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">{order.parts}</p>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                (order as any).fulfillmentMethod === 'Special Order' ? 'bg-purple-100 text-purple-700' :
                                                (order as any).fulfillmentMethod === 'Purchase' ? 'bg-amber-100 text-amber-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {(order as any).fulfillmentMethod || 'Order'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-2">
                                            Status: <span className={order.status === 'Pending Approval' ? 'text-amber-500 font-medium' : 'text-emerald-500 font-medium'}>{order.status}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-gray-900 dark:text-white">${(order.cost ?? 0).toFixed(2)}</span>
                                        <button 
                                            onClick={() => handleDeletePartOrder(order.id)} 
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Log"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {state.partOrders.length === 0 && <p className="text-sm text-gray-500 text-center italic py-4">No recent parts logged.</p>}
                        </div>
                    </Card>
                </div>
            )}

            {editingInvoiceId && (
                <InvoiceEditorModal 
                    isOpen={true} 
                    onClose={() => setEditingInvoiceId(null)} 
                    jobId={editingInvoiceId} 
                />
            )}
            {viewingDocument && (
                <DocumentPreview
                    type={viewingDocument.type}
                    data={viewingDocument.data}
                    onClose={() => setViewingDocument(null)}
                    isInternal={true}
                />
            )}

            {proposalReminderModal.isOpen && proposalReminderModal.proposal && (
                <RecipientSelectorModal
                    isOpen={proposalReminderModal.isOpen}
                    onClose={() => setProposalReminderModal({ isOpen: false, proposal: null })}
                    customerId={proposalReminderModal.proposal.customerId}
                    locationId={proposalReminderModal.proposal.locationId || (proposalReminderModal.proposal as any)?.serviceLocationId}
                    locationName={proposalReminderModal.proposal.locationName || (proposalReminderModal.proposal as any)?.siteLocationName || (proposalReminderModal.proposal as any)?.address}
                    documentType="proposal"
                    title="Select Proposal Reminder Recipients"
                    onConfirm={(emails) => {
                        if (proposalReminderModal.proposal) {
                            handleSendProposalReminder(proposalReminderModal.proposal, emails);
                        }
                        setProposalReminderModal({ isOpen: false, proposal: null });
                    }}
                />
            )}

            {isExistingJobModalOpen && selectedCustomerForExisting && (
                <SelectExistingJobModal
                    isOpen={isExistingJobModalOpen}
                    onClose={() => {
                        setIsExistingJobModalOpen(false);
                        setSelectedCustomerForExisting(null);
                        setExistingJobsForCustomer([]);
                    }}
                    customer={selectedCustomerForExisting}
                    jobs={existingJobsForCustomer}
                    onSelectJob={handleSelectExistingJob}
                    onCreateNew={() => proceedCreateInvoice(selectedCustomerForExisting)}
                />
            )}

            {/* Standalone Payment / Deposit Link Modal */}
            {isCreatePaymentLinkOpen && (
                <CreatePaymentLinkModal
                    isOpen={isCreatePaymentLinkOpen}
                    onClose={() => setIsCreatePaymentLinkOpen(false)}
                />
            )}
        </div>
    );
};

export default PaymentsAndOrders;
