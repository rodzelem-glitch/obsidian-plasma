import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import type { Proposal, Job, Notification } from 'types';
import { 
    DollarSign, Briefcase, CheckCircle, 
    FileText, Eye, Edit, Trash2, ShieldCheck, Ban, Share2, Copy, Bell, UserPlus, Search, Clock, XCircle
} from 'lucide-react';
import DocumentPreview from 'components/ui/DocumentPreview';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import Select from 'components/ui/Select';

const SalesPipeline: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Share Proposal State
    const [shareModalProp, setShareModalProp] = useState<Proposal | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const [reassignProposal, setReassignProposal] = useState<Proposal | null>(null);
    const [newCustomerId, setNewCustomerId] = useState('');

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
        const openValue = (proposals as Proposal[]).filter(p => p.status === 'Sent' || p.status === 'Draft' || p.status === 'Pending Approval').reduce((sum, p) => sum + p.total, 0);
        
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
                    case 'date_desc':
                    default:
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                }
            });
    }, [proposals, filterStatus, sortBy, searchTerm]);

    // --- ACTIONS ---
    const handleStatusChange = async (proposal: Proposal, newStatus: Proposal['status']) => {
        try {
            await db.collection('proposals').doc(proposal.id).update({ status: newStatus });
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
                await db.collection('notifications').doc(notifyId).set(notification);
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
            await db.collection('proposals').doc(reassignProposal.id).update({
                customerId: newCustomer.id,
                customerName: newCustomer.name,
                customerEmail: newCustomer.email || null
            });
            showToast.success(`Reassigned to ${newCustomer.name}`);
            setReassignProposal(null);
            setNewCustomerId('');
        } catch (e) {
            showToast.warn("Failed to reassign proposal.");
        }
    };

    const handleEditProposal = (id: string) => {
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        const basePath = isStaff ? '/admin' : '/briefing';
        navigate(`${basePath}/proposal?proposalId=${id}`);
    };

    const handleDeleteProposal = async (id: string) => {
        if (!await globalConfirm("Permanently delete this proposal?")) return;
        try {
            await db.collection('proposals').doc(id).delete();
            dispatch({ type: 'DELETE_PROPOSAL', payload: id });
        } catch (e) {
            showToast.warn("Delete failed.");
        }
    };

    const handleConvertToJob = async (proposal: Proposal) => {
        if (!state.currentOrganization) return;
        if (!await globalConfirm(`Convert proposal for ${proposal.customerName} into a scheduled job?`)) return;

        const customer = state.customers.find(c => c.name === proposal.customerName);
        
        const newJob: Job = {
            id: `job-${Date.now()}`,
            organizationId: state.currentOrganization.id,
            customerName: proposal.customerName,
            customerId: customer?.id,
            address: customer?.address || 'Address Pending',
            tasks: proposal.items.map(i => i.name),
            jobStatus: 'Scheduled',
            appointmentTime: new Date().toISOString(), 
            invoice: {
                id: `INV-${Date.now()}`,
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
            specialInstructions: `Converted from Proposal ${proposal.id}`,
            source: 'SalesPipeline',
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(newJob.id).set(newJob);
            dispatch({ type: 'ADD_JOB', payload: newJob });
            
            if (proposal.status !== 'Accepted') {
                handleStatusChange(proposal, 'Accepted');
            }
            
            showToast.success("Job Created! View in Operations -> Job List.");
            setViewProposal(null);
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
            await db.collection('messages').doc(msgObj.id).set(msgObj);
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

    const handleSendProposalReminder = async (proposal: Proposal) => {
        const email = proposal.customerEmail;
        if (!email) {
            showToast.warn("Customer email missing for this proposal.");
            return;
        }

        if (!await globalConfirm(`Send proposal reminder to ${email}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/proposal-view/${proposal.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `Following up: Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e0e7ff;border-radius:8px;"><h2 style="color:#4f46e5;">Proposal Reminder</h2><p>Hi ${proposal.customerName},</p><p>We are following up on the proposal we sent you for <strong>$${(proposal.total ?? 0).toFixed(2)}</strong>. You can review the details and quickly accept it online so we can get started.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#4f46e5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Review & Accept Proposal</a></div><p>If you have any questions, please let us know.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                    text: `Reminder: Your proposal for $${(proposal.total ?? 0).toFixed(2)} is awaiting review. Review here: ${link}`
                },
                organizationId: state.currentOrganization?.id,
                type: 'ProposalReminder',
                createdAt: new Date().toISOString()
            });

            showToast.warn(`Reminder sent via email to ${email}!`);
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
                            placeholder="Search proposals by customer, ID, or option..."
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
                            </select>
                        </label>
                    </div>
                </div>
                </div>

                <Table headers={['Date', 'Customer', 'Option Selected', 'Value', 'Status', 'Actions']}>
                    {filteredProposals.map(p => {
                        return (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                    {new Date(p.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                    {p.customerName}
                                    <div className="text-[10px] text-gray-500 font-normal uppercase">ID: {p.id.slice(-6)}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold">
                                        {p.selectedOption || 'Standard'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(p.total)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
                                        p.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' :
                                        (p.status === 'Rejected' || p.status === 'Denied') ? 'bg-red-100 text-red-800 border-red-200' :
                                        p.status === 'Sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                        p.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                        p.status === 'Expired' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                                        'bg-gray-100 text-gray-800 border-gray-200'
                                    }`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2 items-center flex-wrap">
                                        {p.status !== 'Accepted' && (
                                            <button onClick={() => handleSendProposalReminder(p)} className="p-2 text-orange-600 hover:bg-orange-50 rounded" title="Send Reminder"><Bell size={16}/></button>
                                        )}
                                        {p.status === 'Pending Approval' && canApprove && (
                                            <>
                                                <button onClick={() => handleStatusChange(p, 'Draft')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="Approve"><ShieldCheck size={16}/></button>
                                                <button onClick={() => handleStatusChange(p, 'Rejected')} className="p-2 text-rose-600 hover:bg-rose-50 rounded" title="Reject"><Ban size={16}/></button>
                                            </>
                                        )}
                                        {p.status === 'Sent' && (
                                            <>
                                                <button onClick={() => handleStatusChange(p, 'Denied')} className="p-2 text-rose-600 hover:bg-rose-50 rounded" title="Mark Denied"><XCircle size={16}/></button>
                                                <button onClick={() => handleStatusChange(p, 'Expired')} className="p-2 text-slate-600 hover:bg-slate-50 rounded" title="Mark Expired"><Clock size={16}/></button>
                                            </>
                                        )}
                                        <button onClick={() => setViewProposal(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={16}/></button>
                                        <button onClick={() => handleEditProposal(p.id)} className="p-2 text-purple-600 hover:bg-purple-50 rounded" title="Edit"><Edit size={16}/></button>
                                        <button aria-label="Reassign Customer" title="Reassign Customer" onClick={(e) => { e.stopPropagation(); setReassignProposal(p); setNewCustomerId(p.customerId || ''); }} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-orange-600 rounded"><UserPlus size={16}/></button>
                                        <button aria-label="Copy Reference" title="Copy Reference" onClick={(e) => { e.stopPropagation(); handleCopyRef(p.id); }} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-primary-600 rounded"><Copy size={16}/></button>
                                        <button aria-label="Share Proposal" title="Share Proposal" onClick={(e) => { e.stopPropagation(); setShareModalProp(p); }} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-primary-600 rounded"><Share2 size={16}/></button>
                                        <button onClick={() => handleDeleteProposal(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredProposals.length === 0 && <tr><td colSpan={6} className="p-6 md:p-12 text-center text-slate-400">No proposals found in this category.</td></tr>}
                </Table>
            </Card>

            {viewProposal && (
                <DocumentPreview 
                    type="Proposal" 
                    data={viewProposal} 
                    onClose={() => setViewProposal(null)} 
                />
            )}
        </div>
    );
};

export default SalesPipeline;
