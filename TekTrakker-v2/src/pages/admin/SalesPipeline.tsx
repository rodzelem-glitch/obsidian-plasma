/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import showToast from "lib/toast";
import { getBaseUrl , cleanUndefinedFields } from "lib/utils";
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { db, firebase } from 'lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import type { Proposal, Job, Notification } from 'types';
import { 
    DollarSign, Briefcase, CheckCircle, 
    FileText, Eye, Edit, Trash2, ShieldCheck, Ban, Share2, Copy, Bell, UserPlus, Search, Clock, XCircle
} from 'lucide-react';
import DocumentPreview from 'components/ui/DocumentPreview';
import JobDetailModal from 'components/modals/JobDetailModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import Select from 'components/ui/Select';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import MultipleProposalsModal, { getPendingCompetingProposals } from 'components/modals/MultipleProposalsModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';

const SalesPipeline: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);
    const [previewOtherDoc, setPreviewOtherDoc] = useState<any>(null);
    const [activeSignOffJob, setActiveSignOffJob] = useState<any>(null);
    const [activeSubBillJob, setActiveSubBillJob] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [recipientModalConfig, setRecipientModalConfig] = useState<{
        isOpen: boolean;
        proposal: Proposal | null;
    }>({ isOpen: false, proposal: null });

    // Share Proposal State
    const [shareModalProp, setShareModalProp] = useState<Proposal | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const [reassignProposal, setReassignProposal] = useState<Proposal | null>(null);
    const [newCustomerId, setNewCustomerId] = useState('');

    // Multiple Proposals Conflict State
    const [conflictModalConfig, setConflictModalConfig] = useState<{
        isOpen: boolean;
        acceptedProposal: Proposal | null;
        pendingProposals: Proposal[];
    }>({ isOpen: false, acceptedProposal: null, pendingProposals: [] });

    const handleDeclinePendingProposals = async () => {
        if (!conflictModalConfig.acceptedProposal || conflictModalConfig.pendingProposals.length === 0) return;
        const acceptedProp = conflictModalConfig.acceptedProposal;
        const pendingProps = conflictModalConfig.pendingProposals;

        try {
            for (const prop of pendingProps) {
                await db.collection('proposals').doc(prop.id).update(cleanUndefinedFields({
                    status: 'Declined',
                    declineReason: `Declined automatically: Customer accepted alternative proposal #${acceptedProp.id} ("${acceptedProp.title || 'Proposal'}")`,
                    updatedAt: new Date().toISOString()
                }));
                dispatch({
                    type: 'UPDATE_PROPOSAL',
                    payload: {
                        id: prop.id,
                        status: 'Declined',
                        declineReason: `Declined automatically: Customer accepted alternative proposal #${acceptedProp.id}`
                    }
                });
            }
            showToast.success(`Marked ${pendingProps.length} alternative proposal(s) as Declined.`);
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to update pending proposals.");
        } finally {
            setConflictModalConfig({ isOpen: false, acceptedProposal: null, pendingProposals: [] });
        }
    };

    const proposals = state.proposals;

    React.useEffect(() => {
        const propId = searchParams.get('propId');
        if (propId) {
            const prop = state.proposals.find((p: Proposal) => p.id === propId);
            if (prop) {
                setViewProposal(prop);
            }
        }
    }, [searchParams, state.proposals]);

    // --- METRICS ---
    const metrics = useMemo(() => {
        const totalValue = (proposals as Proposal[]).reduce((sum, p) => sum + p.total, 0);
        const acceptedValue = (proposals as Proposal[]).filter(p => p.status === 'Accepted').reduce((sum, p) => sum + p.total, 0);
        const openValue = (proposals as Proposal[]).filter(p => p.status === 'Sent' || p.status === 'Opened' || p.status === 'Draft' || p.status === 'Pending Approval').reduce((sum, p) => sum + p.total, 0);
        
        const count = proposals.length;
        const acceptedCount = (proposals as Proposal[]).filter(p => p.status === 'Accepted').length;
        const closeRate = count > 0 ? (acceptedCount / count) * 100 : 0;

        return { totalValue, acceptedValue, openValue, closeRate, count };
    }, [proposals]);

    // --- FILTERING ---
    const [sortBy, setSortBy] = useState('date_desc');


    const filteredProposals = useMemo(() => {
        return (proposals as Proposal[])
            .filter(p => filterStatus === 'All' || p.status === filterStatus)
            .filter(p => {
                if (!searchTerm) return true;
                const q = searchTerm.toLowerCase();
                return (
                    (p.customerName || '').toLowerCase().includes(q) ||
                    (p.id || '').toLowerCase().includes(q) ||
                    (p.jobId || '').toLowerCase().includes(q) || // Internal WO Number (Job ID)
                    (p.poNumber || '').toLowerCase().includes(q) || // External WO Number (PO #)
                    (p.selectedOption || '').toLowerCase().includes(q) ||
                    (p.total?.toString() || '').includes(q)
                );
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'date_asc':
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    case 'name_asc':
                        return (a.customerName || '').localeCompare(b.customerName || '');
                    case 'name_desc':
                        return (b.customerName || '').localeCompare(a.customerName || '');
                    case 'amount_desc':
                        return (b.total || 0) - (a.total || 0);
                    case 'amount_asc':
                        return (a.total || 0) - (b.total || 0);
                    case 'status_asc':
                        return (a.status || '').localeCompare(b.status || '');
                    case 'status_desc':
                        return (b.status || '').localeCompare(a.status || '');
                    case 'date_desc':
                    default:
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                }
            });
    }, [proposals, filterStatus, sortBy, searchTerm]);

    // --- ACTIONS ---
    const handleStatusChange = async (proposal: Proposal, newStatus: Proposal['status']) => {
        try {
            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({ status: newStatus }));
            dispatch({ type: 'UPDATE_PROPOSAL', payload: { ...proposal, status: newStatus } });
            if (viewProposal?.id === proposal.id) setViewProposal({ ...proposal, status: newStatus });

            // Notify technician of approval/rejection
            if (newStatus === 'Draft' || newStatus === 'Rejected') {
                const notifyId = `notif-${Date.now()}`;
                
                const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
                const basePath = isStaff ? '/admin' : '/briefing';

                const notification: Notification = {
                    id: notifyId,
                    userId: proposal.technicianId,
                    organizationId: state.currentOrganization?.id || '',
                    title: newStatus === 'Draft' ? 'Proposal Approved' : 'Proposal Rejected',
                    message: `Your proposal for ${proposal.customerName} has been ${newStatus === 'Draft' ? 'approved and moved back to Drafts' : 'rejected'}.`,
                    read: false,
                    link: `${basePath}/proposal?proposalId=${proposal.id}`,
                    createdAt: new Date().toISOString()
                };
                await db.collection('notifications').doc(notifyId).set(cleanUndefinedFields(notification));
            }
        } catch (e) {
            console.error(e);
            showToast.warn("Update failed");
        }
    };

    const handleReassign = async () => {
        if (!reassignProposal || !newCustomerId) return;
        const newCustomer = state.customers?.find((c: {id: string; name: string; email?: string}) => c.id === newCustomerId);
        if (!newCustomer) return;
        
        try {
            await db.collection('proposals').doc(reassignProposal.id).update(cleanUndefinedFields({
                customerId: newCustomer.id,
                customerName: newCustomer.name,
                customerEmail: newCustomer.email || null
            }));
            showToast.success(`Reassigned to ${newCustomer.name}`);
            setReassignProposal(null);
            setNewCustomerId('');
        } catch (e) {
            showToast.warn("Failed to reassign proposal.");
        }
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
        if (!await globalConfirm("Permanently delete this proposal?")) return;
        try {
            await db.collection('proposals').doc(id).update(cleanUndefinedFields({
                deleted: true,
                deletedAt: new Date().toISOString(),
                expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
            }));
            dispatch({ type: 'DELETE_PROPOSAL', payload: id });
        } catch (e) {
            showToast.warn("Delete failed.");
        }
    };

    const handleConvertToJob = async (proposal: Proposal) => {
        if (!state.currentOrganization) return;
        if (!await globalConfirm(`Convert proposal for ${proposal.customerName} into a scheduled job?`)) return;

        const nextInvId = await getNextInvoiceNumber(state.currentOrganization.id);
        const customer = state.customers.find(c => c.name === proposal.customerName);
        
        const originalDiagnosticJob = proposal.jobId ? state.jobs.find(j => j.id === proposal.jobId) : null;
        
        let combinedInstructions = `Converted from Proposal ${proposal.id}`;
        if (originalDiagnosticJob) {
            combinedInstructions = `Converted from Proposal ${proposal.id}.\n\n[Diagnostic Notes from Job #${originalDiagnosticJob.id.slice(-6).toUpperCase()}]:\n${originalDiagnosticJob.notes?.diagnosis || 'No diagnosis recorded'}`;
        }

        const newJob: Job = {
            id: `job-${Date.now()}`,
            organizationId: state.currentOrganization.id,
            customerName: proposal.customerName,
            customerId: customer?.id,
            address: customer?.address || 'Address Pending',
            tasks: proposal.items.map(i => i.name),
            jobStatus: 'Scheduled',
            appointmentTime: new Date().toISOString(), 
            poNumber: proposal.poNumber || originalDiagnosticJob?.poNumber || null,
            invoice: {
                id: nextInvId,
                items: proposal.items.map(i => ({
                    id: i.id,
                    description: i.name,
                    quantity: i.quantity || 1,
                    unitPrice: i.price,
                    total: i.total || (i.price * (i.quantity || 1)),
                    type: i.type
                })),
                subtotal: proposal.subtotal,
                taxRate: (state.currentOrganization.taxRate || 8.25) / 100,
                taxAmount: proposal.taxAmount,
                totalAmount: proposal.total,
                amount: proposal.total,
                status: 'Unpaid'
            },
            jobEvents: [],
            specialInstructions: combinedInstructions,
            source: 'SalesPipeline',
            proposalId: proposal.id,
            createdAt: new Date().toISOString()
        };

        if (originalDiagnosticJob) {
            newJob.files = (originalDiagnosticJob.files || []).map(f => ({
                ...f,
                id: f.id.startsWith('copied-') ? f.id : `copied-${f.id}-${Date.now()}`
            }));
            newJob.unitStates = originalDiagnosticJob.unitStates || [];
            newJob.techRecommendations = originalDiagnosticJob.techRecommendations || '';
            (newJob as any).parentJobId = originalDiagnosticJob.id;
        }

        try {
            await db.collection('jobs').doc(newJob.id).set(cleanUndefinedFields(newJob));
            dispatch({ type: 'ADD_JOB', payload: newJob });
            
            const updatedProposal: Proposal = {
                ...proposal,
                jobId: newJob.id,
                invoiceId: nextInvId,
                status: 'Accepted',
                poNumber: newJob.poNumber || null
            };
            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                jobId: newJob.id,
                invoiceId: nextInvId,
                status: 'Accepted',
                poNumber: newJob.poNumber || null,
                updatedAt: new Date().toISOString()
            }));
            dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal });
            
            showToast.success("Job Created! View in Operations -> Job List.");
            setViewProposal(null);

            // Check if there are other pending competing proposals for this job/customer
            const pendingCompeting = getPendingCompetingProposals(updatedProposal, state.proposals);
            if (pendingCompeting.length > 0) {
                setConflictModalConfig({
                    isOpen: true,
                    acceptedProposal: updatedProposal,
                    pendingProposals: pendingCompeting
                });
            }
        } catch (err) {
            console.error(err);
            showToast.warn("Failed to create job.");
        }
    };

    const handleCopyRef = (propId: string) => {
        navigator.clipboard.writeText(`#PROP-${propId}`);
        showToast.warn("Proposal Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareProposal = async () => {
        if (!shareModalProp || !shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this proposal: #PROP-${shareModalProp.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.success("Proposal shared successfully!");
            setShareModalProp(null);
            setShareMessageText('');
        } catch (err) {
            showToast.warn("Failed to share.");
        } finally {
            setIsSharing(false);
        }
    };

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const canApprove = state.currentUser?.role === 'admin' || state.currentUser?.role === 'supervisor' || state.currentUser?.role === 'both' || state.currentUser?.role === 'master_admin';

    const handleSendProposalReminder = async (proposal: Proposal, selectedEmails?: string[]) => {
        let emails = selectedEmails;
        if (!emails) {
            let email = proposal.customerEmail;
            if (!email && proposal.customerId) {
                const cust = state.customers.find((c: any) => c.id === proposal.customerId);
                if (cust) {
                    email = cust.email;
                }
            }
            if (!email) {
                showToast.warn("Customer email missing for this proposal.");
                return;
            }
            emails = [email];
        }

        if (proposal.remindersSent) {
            const alreadySentToday = proposal.remindersSent.some((dateStr: string) => {
                try {
                    return new Date(dateStr).toLocaleDateString() === new Date().toLocaleDateString();
                } catch (e) {
                    return false;
                }
            });
            if (alreadySentToday) {
                if (!confirm("A reminder has already been sent to this customer today. Are you sure you want to send another one?")) {
                    return;
                }
            }
        }

        if (!selectedEmails && !confirm(`Send reminder for proposal #${proposal.id.slice(-6)} to ${emails.join(', ')}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/proposal-view/${proposal.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            const totalVal = proposal.total || 0;

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: emails,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Reminder: Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e0f2fe;border-radius:8px;"><h2 style="color:#0284c7;">Proposal Reminder</h2><p>Hi ${proposal.customerName},</p><p>This is a friendly reminder to review the proposal we prepared for you (total: <strong>$${totalVal.toLocaleString()}</strong>).</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Sign Proposal</a></div><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                    text: `Reminder: Please review and sign your proposal for $${totalVal.toLocaleString()}. Link: ${link}`,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: state.currentOrganization?.id,
                type: 'ProposalReminder',
                createdAt: new Date().toISOString()
            }));

            const reminderDate = new Date().toISOString();
            const currentReminders = proposal.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                remindersSent: newReminders
            }));

            dispatch({ type: 'UPDATE_PROPOSAL', payload: { ...proposal, remindersSent: newReminders } });
            showToast.warn(`Reminder sent successfully!`);
        } catch (e) {
            console.error(e);
            showToast.warn("Error sending reminder.");
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <Modal isOpen={!!reassignProposal} onClose={() => setReassignProposal(null)} title="Reassign Proposal">
                <div className="space-y-4">
                    <label className="block">
                        <span className="text-sm text-slate-500 block mb-1">Select a new customer to map this proposal to.</span>
                        <Select value={newCustomerId} onChange={e => setNewCustomerId(e.target.value)}>
                            <option value="">Select Customer...</option>
                            {state.customers?.map((c: {id: string; name: string}) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </Select>
                    </label>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setReassignProposal(null)}>Cancel</Button>
                        <Button onClick={handleReassign} disabled={!newCustomerId}>Save Assignment</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!shareModalProp} onClose={() => setShareModalProp(null)} title={`Share Proposal: ${shareModalProp?.customerName}`}>
                 <div className="space-y-4">
                     <label className="block">
                         <span className="text-sm text-slate-500 block mb-1">Send this proposal reference to a staff member.</span>
                         <select 
                             aria-label="Select Share Recipient"
                             title="Select Share Recipient"
                            className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                             value={shareTargetId}
                             onChange={e => setShareTargetId(e.target.value)}
                         >
                             <option value="">Select Recipient...</option>
                             {state.users.filter((u: {organizationId: string; id: string; role: string; firstName: string; lastName: string}) => 
                                 u.organizationId === state.currentOrganization?.id && 
                                 u.id !== state.currentUser?.id && 
                                 u.role !== 'customer'
                             ).map((u: {id: string; firstName: string; lastName: string; role: string}) => (
                                 <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                             ))}
                         </select>
                     </label>
                     <Textarea 
                         placeholder="Add an optional message..."
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalProp(null)}>Cancel</Button>
                         <Button onClick={handleShareProposal} disabled={!shareTargetId || isSharing}>
                             {isSharing ? 'Sending...' : 'Send Message'}
                         </Button>
                     </div>
                 </div>
             </Modal>
            

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-full text-blue-700"><Briefcase size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase">Open Pipeline</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-50">{formatCurrency(metrics.openValue)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-200 dark:bg-green-800 rounded-full text-green-700"><DollarSign size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase">Booked Revenue</p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-50">{formatCurrency(metrics.acceptedValue)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-full text-purple-700"><CheckCircle size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">Close Rate</p>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-50">{metrics.closeRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700"><FileText size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Total Proposals</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.count}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* MAIN LIST */}
            <Card className="shadow-lg">
                <div className="flex flex-col gap-4 mb-4">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by customer, proposal ID, WO # (Int/Ext), or option..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg overflow-x-auto custom-scrollbar flex-1 whitespace-nowrap">
                        {['All', 'Pending Approval', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Denied', 'Expired'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                                    filterStatus === status 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                        <label className="font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">Sort by:
                            <select 
                                aria-label="Sort Proposals"
                                className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="date_desc">Newest First</option>
                                <option value="date_asc">Oldest First</option>
                                <option value="name_asc">Customer (A-Z)</option>
                                <option value="name_desc">Customer (Z-A)</option>
                                <option value="amount_desc">Amount (High to Low)</option>
                                <option value="amount_asc">Amount (Low to High)</option>
                                <option value="status_asc">Status (A-Z)</option>
                                <option value="status_desc">Status (Z-A)</option>
                            </select>
                        </label>
                    </div>
                </div>
                </div>

                <Table headers={[
                    'Created Date',
                    'Sent Date',
                    'ID',
                    'Customer',
                    'Service Location',
                    'Value',
                    'Linked Documents',
                    'Status',
                    'Reminders Sent'
                ]}>
                    {filteredProposals.map(p => {
                        const linkedJob = (state.jobs || []).find((j: any) => j.id === p.jobId || j.proposalId === p.id);
                        const invoiceId = p.invoiceId || linkedJob?.invoice?.id;
                        const signOffFile = (linkedJob?.files || []).find((f: any) => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet' || f.id?.startsWith('signoff-doc'));
                        const subBillFile = (linkedJob?.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc'));
                        const poNumber = p.poNumber || linkedJob?.poNumber;

                        return (
                            <tbody key={p.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-bold uppercase">
                                        {new Date(p.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                        {p.sentAt ? (
                                            <span>{new Date(p.sentAt).toLocaleDateString()} {new Date(p.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        ) : (
                                            <span className="italic text-slate-400">Not Sent</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                        #{p.id.slice(-6)}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                        {p.customerName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div>{p.locationName || <span className="italic text-slate-400">--</span>}</div>
                                        {(p.locationAddress || (p as any).address) && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]" title={p.locationAddress || (p as any).address}>
                                                {p.locationAddress || (p as any).address}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(p.total)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                            <span 
                                                onClick={() => setViewProposal(p)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm font-sans"
                                                title="View Proposal"
                                            >
                                                <FileText size={10} />
                                                {`PROP-${p.id.slice(-6).toUpperCase()}`}
                                            </span>

                                            {linkedJob && (
                                                <span 
                                                    onClick={() => setViewingJob(linkedJob)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm font-sans"
                                                    title="View Job Details"
                                                >
                                                    <Briefcase size={10} />
                                                    {`JOB-${linkedJob.id.slice(-6).toUpperCase()}`}
                                                </span>
                                            )}

                                            {invoiceId && (
                                                <span 
                                                    onClick={() => setViewingInvoiceJob(linkedJob || { id: p.jobId || '', invoice: { id: invoiceId } })}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm font-sans"
                                                    title="View Invoice"
                                                >
                                                    <DollarSign size={10} />
                                                    {`INV-${invoiceId}`}
                                                </span>
                                            )}

                                            {poNumber && (
                                                <span 
                                                    onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: p.customerId } })}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                                    title={`View Work Order ${poNumber} Associations`}
                                                >
                                                    <Briefcase size={10} />
                                                    {`WO: ${poNumber}`}
                                                </span>
                                            )}

                                            {/* Sign-off button - ALWAYS shown */}
                                            <span 
                                                onClick={() => {
                                                    if (signOffFile) {
                                                        setPreviewOtherDoc({ ...signOffFile, type: 'Other', title: 'Manager Sign-Off Sheet' });
                                                    } else {
                                                        setActiveSignOffJob(linkedJob || p);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm font-sans ${
                                                    signOffFile 
                                                    ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50 hover:bg-teal-100'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700'
                                                }`}
                                                title={signOffFile ? "View Subcontractor Manager Sign-Off Sheet" : "Open Blank Sign-off Sheet to Sign"}
                                            >
                                                <ShieldCheck size={10} />
                                                {signOffFile ? "Sign-off" : "+ Sign-off"}
                                            </span>

                                            {/* Sub Bill button - ONLY shown if assigned to a subcontractor */}
                                            {(() => {
                                                const lj = linkedJob as any;
                                                const isSubassigned = !!(lj?.assignedSubcontractorId || lj?.subcontractorId || lj?.subcontractorName || lj?.subcontractor || (p as any).assignedSubcontractorId || (p as any).subcontractorId || (p as any).subcontractorName);
                                                if (!isSubassigned) return null;
                                                return (
                                                    <span 
                                                        onClick={() => {
                                                            if (subBillFile) {
                                                                setPreviewOtherDoc({ ...subBillFile, type: 'Other', title: 'Subcontractor Bill' });
                                                            } else {
                                                                setActiveSubBillJob(linkedJob || p);
                                                            }
                                                        }}
                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm font-sans ${
                                                            subBillFile 
                                                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700'
                                                        }`}
                                                        title={subBillFile ? "View Subcontractor Bill" : "View Subcontractor Work Order / Bill"}
                                                    >
                                                        <DollarSign size={10} />
                                                        {subBillFile ? "Sub Bill" : "+ Sub Bill"}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
                                                p.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' :
                                                (p.status === 'Rejected' || p.status === 'Denied') ? 'bg-red-100 text-red-800 border-red-200' :
                                                p.status === 'Sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                                p.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                p.status === 'Expired' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                                                'bg-gray-100 text-gray-800 border-gray-200'
                                            }`}>
                                                {p.status}
                                            </span>
                                            {(() => {
                                                const hasBeenOpened = p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened');
                                                return hasBeenOpened && p.status !== 'Accepted' && (
                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 flex items-center gap-1">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                        Opened
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                        {p.remindersSent && p.remindersSent.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                {p.remindersSent.map((dateStr: string, idx: number) => (
                                                    <span key={idx} className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                        {new Date(dateStr).toLocaleDateString()}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="italic text-slate-400">None</span>
                                        )}
                                    </td>
                                </tr>
                                <tr className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                    <td colSpan={9} className="px-6 py-2 border-t-0">
                                        <div className="flex flex-wrap gap-2 items-center text-xs">
                                            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-2">Actions:</span>
                                            <button 
                                                onClick={() => setViewProposal(p)} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                                title="View"
                                            >
                                                <Eye size={14} />
                                                View
                                            </button>
                                            <button 
                                                onClick={() => handleEditProposal(p.id)} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-colors font-bold shadow-sm"
                                                title="Edit"
                                            >
                                                <Edit size={14} />
                                                Edit
                                            </button>
                                            {(p.status === 'Sent' || p.status === 'Opened') && (
                                                <button 
                                                    onClick={() => setRecipientModalConfig({ isOpen: true, proposal: p })} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm"
                                                    title="Send Reminder"
                                                >
                                                    <Bell size={14} />
                                                    Reminder
                                                </button>
                                            )}
                                            {p.status === 'Pending Approval' && canApprove && (
                                                <>
                                                    <button 
                                                        onClick={() => handleStatusChange(p, 'Draft')} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                                        title="Approve"
                                                    >
                                                        <ShieldCheck size={14} />
                                                        Approve
                                                    </button>
                                                    <button 
                                                        onClick={() => handleStatusChange(p, 'Rejected')} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                                        title="Reject"
                                                    >
                                                        <Ban size={14} />
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {(p.status === 'Sent' || p.status === 'Opened') && (
                                                <>
                                                    <button 
                                                        onClick={() => handleStatusChange(p, 'Denied')} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                                        title="Mark Denied"
                                                    >
                                                        <XCircle size={14} />
                                                        Deny
                                                    </button>
                                                    <button 
                                                        onClick={() => handleStatusChange(p, 'Expired')} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors font-bold shadow-sm"
                                                        title="Mark Expired"
                                                    >
                                                        <Clock size={14} />
                                                        Expire
                                                    </button>
                                                </>
                                            )}
                                            <button 
                                                title="Reassign Customer" 
                                                onClick={(e) => { e.stopPropagation(); setReassignProposal(p); setNewCustomerId(p.customerId || ''); }} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <UserPlus size={14} />
                                                Reassign
                                            </button>
                                            <button 
                                                title="Copy Reference" 
                                                onClick={(e) => { e.stopPropagation(); handleCopyRef(p.id); }} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <Copy size={14} />
                                                Copy Ref
                                            </button>
                                            <button 
                                                title="Share Proposal" 
                                                onClick={(e) => { e.stopPropagation(); setShareModalProp(p); }} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <Share2 size={14} />
                                                Share
                                            </button>
                                            <button 
                                                title="Delete" 
                                                onClick={() => handleDeleteProposal(p.id)} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        );
                    })}
                    {filteredProposals.length === 0 && <tr><td colSpan={9} className="p-6 md:p-12 text-center text-slate-400">No proposals found in this category.</td></tr>}
                </Table>
            </Card>

            {viewProposal && (
                <DocumentPreview 
                    type="Proposal" 
                    data={viewProposal} 
                    onClose={() => setViewProposal(null)} 
                />
            )}

            {viewingInvoiceJob && (
                <DocumentPreview
                    type="Invoice"
                    data={viewingInvoiceJob}
                    onClose={() => setViewingInvoiceJob(null)}
                    isInternal={true}
                />
            )}

            {previewOtherDoc && (
                <DocumentPreview
                    type="Other"
                    data={previewOtherDoc}
                    onClose={() => setPreviewOtherDoc(null)}
                    isInternal={true}
                />
            )}

            {viewingJob && (
                <JobDetailModal
                    isOpen={true}
                    onClose={() => setViewingJob(null)}
                    job={viewingJob}
                    isAdmin={true}
                />
            )}

            <RecipientSelectorModal
                isOpen={recipientModalConfig.isOpen}
                onClose={() => setRecipientModalConfig({ isOpen: false, proposal: null })}
                customerId={recipientModalConfig.proposal?.customerId}
                locationId={recipientModalConfig.proposal?.locationId}
                title="Select Reminder Recipients"
                onConfirm={(emails) => {
                    if (recipientModalConfig.proposal) {
                        handleSendProposalReminder(recipientModalConfig.proposal, emails);
                    }
                    setRecipientModalConfig({ isOpen: false, proposal: null });
                }}
            />

            {conflictModalConfig.isOpen && conflictModalConfig.acceptedProposal && (
                <MultipleProposalsModal
                    isOpen={conflictModalConfig.isOpen}
                    onClose={() => setConflictModalConfig({ isOpen: false, acceptedProposal: null, pendingProposals: [] })}
                    acceptedProposal={conflictModalConfig.acceptedProposal}
                    pendingProposals={conflictModalConfig.pendingProposals}
                    onDeclinePendingProposals={handleDeclinePendingProposals}
                    onKeepAsSeparateJob={() => setConflictModalConfig({ isOpen: false, acceptedProposal: null, pendingProposals: [] })}
                />
            )}

            {activeSignOffJob && (
                <SignOffModal 
                    isOpen={!!activeSignOffJob} 
                    onClose={() => setActiveSignOffJob(null)} 
                    job={activeSignOffJob}
                    onSave={async (file: any) => {
                        try {
                            const existingFiles = activeSignOffJob.files || [];
                            const updatedFiles = [...existingFiles, file];
                            await db.collection('jobs').doc(activeSignOffJob.id).update(cleanUndefinedFields({ files: updatedFiles }));
                            activeSignOffJob.files = updatedFiles;
                            showToast.success("Sign-off sheet saved successfully!");
                        } catch (err) {
                            console.error("Error saving sign-off", err);
                        }
                        setActiveSignOffJob(null);
                    }}
                />
            )}

            {activeSubBillJob && (
                <SubcontractorWorkOrderModal 
                    isOpen={!!activeSubBillJob} 
                    onClose={() => setActiveSubBillJob(null)} 
                    job={activeSubBillJob} 
                />
            )}
        </div>
    );
};

export default SalesPipeline;
