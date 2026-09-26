import showToast from "lib/toast";
import { UserPlus, Archive, ArchiveRestore } from 'lucide-react';

import React, { useState } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { Search, Eye, Send, Trash2, Bell, Calendar, Clock } from 'lucide-react';
import { getBaseUrl , cleanUndefinedFields } from 'lib/utils';
import type { Proposal } from 'types';
import { db, firebase } from 'lib/firebase';
import DocumentPreview from 'components/ui/DocumentPreview';
import { globalConfirm } from "lib/globalConfirm";
import Modal from 'components/ui/Modal';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import { generateProposalPdfAttachment } from 'lib/pdfHelper';

const ProposalManagement: React.FC = () => {
    const { state, dispatch } = useAppContext();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [viewProposalId, setViewProposalId] = useState<string | null>(null);
    const [reassignProposal, setReassignProposal] = useState<Proposal | null>(null);
    const [newCustomerId, setNewCustomerId] = useState('');
    const [recipientModalConfig, setRecipientModalConfig] = useState<{
        isOpen: boolean;
        proposal: Proposal | null;
        type: 'send' | 'reminder';
    }>({ isOpen: false, proposal: null, type: 'send' });

    const viewProposal = state.proposals.find(p => p.id === viewProposalId);

    const filteredProposals = (state.proposals || []).filter(p => {
        const hasSearch = !!searchTerm.trim();
        const q = searchTerm.toLowerCase().trim();

        // 1. Status / Archive filter
        if (statusFilter === 'Archived') {
            if (!p.archived) return false;
        } else if (hasSearch) {
            if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        } else {
            if (p.archived) return false;
            if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        }

        // 2. Search match
        if (hasSearch) {
            const matchesSearch = (p.customerName || '').toLowerCase().includes(q) || 
                                  (p.id || '').toLowerCase().includes(q) ||
                                  (p.title || '').toLowerCase().includes(q) ||
                                  (p.poNumber || '').toLowerCase().includes(q);
            if (!matchesSearch) return false;
        }

        return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeProposals = (state.proposals || []).filter(p => !p.archived);
    const stats = {
        total: activeProposals.length,
        accepted: activeProposals.filter(p => p.status === 'Accepted').length,
        pending: activeProposals.filter(p => p.status === 'Sent' || p.status === 'Opened' || p.status === 'Draft').length,
        value: activeProposals.reduce((sum, p) => sum + (p.total || 0), 0)
    };

    const handleArchiveProposal = async (proposal: Proposal, archive: boolean = true) => {
        try {
            const updates = {
                archived: archive,
                archivedAt: archive ? new Date().toISOString() : null,
                archivedBy: archive ? (state.currentUser?.id || null) : null,
                updatedAt: new Date().toISOString()
            };
            if (!state.isDemoMode) {
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: {
                    id: proposal.id,
                    ...updates
                }
            });
            showToast.success(archive ? "Proposal archived." : "Proposal restored from archive.");
        } catch (e) {
            console.error(e);
            showToast.warn(archive ? "Failed to archive proposal." : "Failed to restore proposal.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!await globalConfirm("Permanently delete this proposal?")) return;
        try {
            await db.collection('proposals').doc(id).update(cleanUndefinedFields({
                deleted: true,
                deletedAt: new Date().toISOString(),
                expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
            }));
        } catch (e) {
            showToast.warn("Delete failed.");
        }
    };

    const handleSend = async (p: Proposal, selectedEmails?: string[], attachPdf?: boolean) => {
        if (!selectedEmails && !await globalConfirm(`Send proposal to ${p.customerName}?`)) return;
        try {
            let emails = selectedEmails;
            if (!emails) {
                let email = p.customerEmail;
                if (!email && p.customerId) {
                    const cust = state.customers.find((c: any) => c.id === p.customerId);
                    if (cust) {
                        email = cust.email;
                    }
                }
                emails = email ? [email] : [];
            }

            if (emails && emails.length > 0) {
                let pdfAttachments: any[] = [];
                if (attachPdf) {
                    showToast.info("Generating proposal PDF attachment...");
                    const pdfAtt = await generateProposalPdfAttachment(p, state.currentOrganization);
                    pdfAttachments.push(pdfAtt);
                }

                const proposalLink = `${getBaseUrl()}/#/proposal-view/${p.id}`;
                await db.collection('mail_queue').add(cleanUndefinedFields({
                    to: emails,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                    message: {
                        subject: `New Proposal from ${state.currentOrganization?.name || 'Service Provider'}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e0f2fe;border-radius:8px;"><h2 style="color:#0284c7;">New Proposal Ready</h2><p>Hi ${p.customerName},</p><p>We have prepared a new proposal for you (total: <strong>$${(p.total || 0).toLocaleString()}</strong>). Please review and sign it online:</p><div style="margin:20px 0;"><a href="${proposalLink}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Sign Proposal</a></div><p style="font-size:12px;color:#666;">Link: ${proposalLink}</p></div>`,
                        text: `New Proposal from ${state.currentOrganization?.name || 'Service Provider'} for $${(p.total || 0).toLocaleString()}. View here: ${proposalLink}`,
                        replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                        ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                    },
                    organizationId: state.currentOrganization?.id,
                    type: 'ProposalLink',
                    createdAt: new Date().toISOString(),
                }));
            }

            const sentAt = new Date().toISOString();
            await db.collection('proposals').doc(p.id).update(cleanUndefinedFields({ 
                status: 'Sent',
                sentAt: sentAt
            }));
            showToast.warn("Proposal sent and status updated to Sent.");
        } catch (e) {
            showToast.warn("Update failed.");
        }
    };

    const handleSendProposalReminder = async (p: Proposal, selectedEmails?: string[]) => {
        let emails = selectedEmails;
        if (!emails) {
            let email = p.customerEmail;
            if (!email && p.customerId) {
                const cust = state.customers.find((c: any) => c.id === p.customerId);
                if (cust) {
                    email = cust.email;
                }
            }
            if (!email) {
                showToast.warn("Customer requires an email address for proposal reminders.");
                return;
            }
            emails = [email];
        }

        if (p.remindersSent) {
            const alreadySentToday = p.remindersSent.some((dateStr: string) => {
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

        if (!selectedEmails && !confirm(`Send reminder for proposal #${p.proposalNumber || p.id} to ${emails.join(', ')}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/proposal-view/${p.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            const totalVal = p.total || 0;

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: emails,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Reminder: Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e0f2fe;border-radius:8px;"><h2 style="color:#0284c7;">Proposal Reminder</h2><p>Hi ${p.customerName},</p><p>This is a friendly reminder to review the proposal we prepared for you (total: <strong>$${totalVal.toLocaleString()}</strong>).</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Sign Proposal</a></div><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                    text: `Reminder: Please review and sign your proposal for $${totalVal.toLocaleString()}. Link: ${link}`,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: state.currentOrganization?.id,
                type: 'ProposalReminder',
                createdAt: new Date().toISOString()
            }));

            const reminderDate = new Date().toISOString();
            const currentReminders = p.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('proposals').doc(p.id).update(cleanUndefinedFields({
                remindersSent: newReminders
            }));

            showToast.warn("Proposal reminder sent successfully!");
        } catch (e) {
            console.error(e);
            showToast.warn("Error sending reminder.");
        }
    };

    const handleReassign = async () => {
        if (!reassignProposal || !newCustomerId) return;
        const newCustomer = state.customers?.find((c: any) => c.id === newCustomerId);
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

    return (
        <div className="space-y-6">
            {viewProposalId && viewProposal && (
                <DocumentPreview 
                    type="Proposal" 
                    data={viewProposal} 
                    onClose={() => setViewProposalId(null)} 
                    isInternal={true}
                />
            )}

            <Modal isOpen={!!reassignProposal} onClose={() => setReassignProposal(null)} title="Reassign Proposal">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Select a new customer to map this proposal to.</p>
                    <Select value={newCustomerId} onChange={e => setNewCustomerId(e.target.value)}>
                        <option value="">Select Customer...</option>
                        {state.customers?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </Select>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setReassignProposal(null)}>Cancel</Button>
                        <Button onClick={handleReassign} disabled={!newCustomerId}>Save Assignment</Button>
                    </div>
                </div>
            </Modal>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-primary-500 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pipeline Value</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${stats.value.toLocaleString()}</p>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-emerald-500 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accepted</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.accepted}</p>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-amber-500 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.pending}</p>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-indigo-500 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Proposals</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        className="pl-10 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="Search proposals or customers..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="All">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Declined">Declined</option>
                        <option value="Denied">Denied</option>
                        <option value="Expired">Expired</option>
                        <option value="Archived">📦 Archived</option>
                    </Select>
                </div>
            </div>

            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3.5 mb-6">
                {filteredProposals.map(p => {
                    const hasBeenOpened = p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened');
                    const propNum = p.proposalNumber || p.id?.slice(-6);

                    return (
                        <div key={`prop-mgmt-card-${p.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3">
                            {/* Card Header: Proposal ID, Created & Status */}
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                <div>
                                    <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                        #{propNum}
                                    </span>
                                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                        <Calendar size={12} className="text-slate-400" />
                                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {p.sentAt && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                            <Clock size={11} className="text-slate-400" />
                                            <span>Sent: {new Date(p.sentAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                            p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                            p.status === 'Sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                            p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                                            (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                            p.status === 'Expired' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300' :
                                            'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {p.status}
                                        </span>
                                        {p.archived && (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                                                <Archive size={10} /> Archived
                                            </span>
                                        )}
                                    </div>
                                    {hasBeenOpened && p.status !== 'Accepted' && (
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                            Opened
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Customer & Value */}
                            <div className="flex items-baseline justify-between gap-2">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1">
                                        {p.customerName || 'No Customer Specified'}
                                    </h4>
                                    {p.title && (
                                        <p className="text-xs text-slate-500 line-clamp-1">
                                            {p.title}
                                        </p>
                                    )}
                                </div>
                                <span className="font-black text-base text-slate-900 dark:text-white shrink-0">
                                    ${p.total?.toLocaleString()}
                                </span>
                            </div>

                            {/* Reminders summary if any */}
                            {p.remindersSent && p.remindersSent.length > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40">
                                    <Bell size={13} className="shrink-0" />
                                    <span>{p.remindersSent.length} reminder(s) sent</span>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-500 font-mono ml-auto">
                                        Last: {new Date(p.remindersSent[p.remindersSent.length - 1]).toLocaleDateString()}
                                    </span>
                                </div>
                            )}

                            {/* Mobile Actions Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                <div className="flex items-center gap-1">
                                    <button 
                                        title="View Proposal" 
                                        aria-label="View Proposal" 
                                        onClick={(e) => { e.stopPropagation(); setViewProposalId(p.id); }} 
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-lg text-blue-700 dark:text-blue-300 font-bold"
                                    >
                                        <Eye size={13} />
                                        View
                                    </button>
                                    <button 
                                        title="Send Proposal" 
                                        aria-label="Send Proposal" 
                                        onClick={(e) => { e.stopPropagation(); setRecipientModalConfig({ isOpen: true, proposal: p, type: 'send' }); }} 
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold"
                                    >
                                        <Send size={13} />
                                        Send
                                    </button>
                                    {(p.status === 'Sent' || p.status === 'Opened') && (
                                        <button 
                                            title="Send Reminder" 
                                            aria-label="Send Reminder" 
                                            onClick={(e) => { e.stopPropagation(); setRecipientModalConfig({ isOpen: true, proposal: p, type: 'reminder' }); }} 
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-lg text-indigo-700 dark:text-indigo-300 font-bold"
                                        >
                                            <Bell size={13} />
                                            Remind
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button 
                                        title="Reassign Customer" 
                                        aria-label="Reassign Customer" 
                                        onClick={(e) => { e.stopPropagation(); setReassignProposal(p); setNewCustomerId(p.customerId || ''); }} 
                                        className="p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg text-amber-700 dark:text-amber-300"
                                    >
                                        <UserPlus size={14} />
                                    </button>
                                    <button 
                                        title={p.archived ? "Restore Proposal" : "Archive Proposal"} 
                                        aria-label={p.archived ? "Restore Proposal" : "Archive Proposal"} 
                                        onClick={(e) => { e.stopPropagation(); handleArchiveProposal(p, !p.archived); }} 
                                        className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                                    >
                                        {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                    </button>
                                    <button 
                                        title="Delete Proposal" 
                                        aria-label="Delete Proposal" 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} 
                                        className="p-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-red-600 dark:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredProposals.length === 0 && (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-medium italic">
                        No proposals found.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-lg rounded-2xl">
                <Table headers={['Created Date', 'Sent Date', 'ID', 'Customer', 'Value', 'Status', 'Reminders Sent']}>
                    {filteredProposals.map(p => (
                        <tbody key={p.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer" onClick={() => setViewProposalId(p.id)}>
                                <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase" data-sort-value={new Date(p.createdAt).getTime()}>
                                    {new Date(p.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400" data-sort-value={p.sentAt ? new Date(p.sentAt).getTime() : 0}>
                                    {p.sentAt ? (
                                        <span>{new Date(p.sentAt).toLocaleDateString()} {new Date(p.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    ) : (
                                        <span className="italic text-slate-400">Not Sent</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                    #{p.proposalNumber || p.id}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-black text-slate-900 dark:text-white text-sm">{p.customerName}</div>
                                </td>
                                <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                    ${p.total?.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1 items-start">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                                p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800' :
                                                (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800' :
                                                p.status === 'Expired' ? 'bg-slate-200 text-slate-800' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {p.status}
                                            </span>
                                            {p.archived && (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                                                    <Archive size={10} /> Archived
                                                </span>
                                            )}
                                        </div>
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
                                <td colSpan={7} className="px-6 py-2 border-t-0">
                                    <div className="flex flex-wrap gap-2 items-center text-xs">
                                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-2">Actions:</span>
                                        <button 
                                            title="View Proposal" 
                                            aria-label="View Proposal" 
                                            onClick={(e) => { e.stopPropagation(); setViewProposalId(p.id); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Eye size={14} />
                                            View
                                        </button>
                                        <button 
                                            title={p.archived ? "Restore Proposal" : "Archive Proposal"}
                                            aria-label={p.archived ? "Restore Proposal" : "Archive Proposal"}
                                            onClick={(e) => { e.stopPropagation(); handleArchiveProposal(p, !p.archived); }}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md transition-colors font-bold shadow-sm ${
                                                p.archived 
                                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40' 
                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                            {p.archived ? "Restore" : "Archive"}
                                        </button>
                                        <button 
                                            title="Reassign Customer" 
                                            aria-label="Reassign Customer" 
                                            onClick={(e) => { e.stopPropagation(); setReassignProposal(p); setNewCustomerId(p.customerId || ''); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <UserPlus size={14} />
                                            Reassign
                                        </button>
                                        <button 
                                            title="Send Proposal" 
                                            aria-label="Send Proposal" 
                                            onClick={(e) => { e.stopPropagation(); setRecipientModalConfig({ isOpen: true, proposal: p, type: 'send' }); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Send size={14} />
                                            Send
                                        </button>
                                        {(p.status === 'Sent' || p.status === 'Opened') && (
                                            <button 
                                                title="Send Reminder" 
                                                aria-label="Send Reminder" 
                                                onClick={(e) => { e.stopPropagation(); setRecipientModalConfig({ isOpen: true, proposal: p, type: 'reminder' }); }} 
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <Bell size={14} />
                                                Reminder
                                            </button>
                                        )}
                                        <button 
                                            title="Delete Proposal" 
                                            aria-label="Delete Proposal" 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    ))}
                    {filteredProposals.length === 0 && (
                        <tr><td colSpan={7} className="p-6 md:p-12 text-center text-slate-400 font-medium italic">No proposals found.</td></tr>
                    )}
                </Table>
            </Card>

            <RecipientSelectorModal
                isOpen={recipientModalConfig.isOpen}
                onClose={() => setRecipientModalConfig({ isOpen: false, proposal: null, type: 'send' })}
                customerId={recipientModalConfig.proposal?.customerId}
                locationId={recipientModalConfig.proposal?.locationId || (recipientModalConfig.proposal as any)?.serviceLocationId}
                locationName={recipientModalConfig.proposal?.locationName || (recipientModalConfig.proposal as any)?.siteLocationName || (recipientModalConfig.proposal as any)?.address}
                documentType="proposal"
                title={recipientModalConfig.type === 'send' ? 'Select Proposal Recipients' : 'Select Reminder Recipients'}
                onConfirm={(emails, attachPdf) => {
                    if (recipientModalConfig.proposal) {
                        if (recipientModalConfig.type === 'send') {
                            handleSend(recipientModalConfig.proposal, emails, attachPdf);
                        } else {
                            handleSendProposalReminder(recipientModalConfig.proposal, emails);
                        }
                    }
                    setRecipientModalConfig({ isOpen: false, proposal: null, type: 'send' });
                }}
            />
        </div>
    );
};

export default ProposalManagement;
