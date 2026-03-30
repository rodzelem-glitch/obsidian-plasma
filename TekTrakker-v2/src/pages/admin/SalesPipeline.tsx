import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import type { Proposal, Job, Notification } from 'types';
import { 
    DollarSign, Briefcase, CheckCircle, XCircle, 
    FileText, User, Calendar, ArrowRight, Eye, Edit, Trash2, ShieldCheck, Ban
} from 'lucide-react';
import DocumentPreview from 'components/ui/DocumentPreview';
import { useNavigate } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";

const SalesPipeline: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const proposals = state.proposals;

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
    const filteredProposals = useMemo(() => {
        return (proposals as Proposal[])
            .filter(p => filterStatus === 'All' || p.status === filterStatus)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [proposals, filterStatus]);

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
            alert("Update failed");
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
            alert("Delete failed.");
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
            
            alert("Job Created! View in Operations -> Job List.");
            setViewProposal(null);
        } catch (e) {
            console.error(e);
            alert("Failed to create job.");
        }
    };

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const canApprove = state.currentUser?.role === 'admin' || state.currentUser?.role === 'supervisor' || state.currentUser?.role === 'both' || state.currentUser?.role === 'master_admin';

    return (
        <div className="space-y-6 pb-20">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Pipeline</h2>
                <p className="text-gray-600 dark:text-gray-400">Track estimates, proposals, and conversions.</p>
            </header>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-full text-blue-700"><Briefcase size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-blue-700 uppercase">Open Pipeline</p>
                            <p className="text-2xl font-bold dark:text-white">{formatCurrency(metrics.openValue)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-200 dark:bg-green-800 rounded-full text-green-700"><DollarSign size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-green-700 uppercase">Booked Revenue</p>
                            <p className="text-2xl font-bold dark:text-white">{formatCurrency(metrics.acceptedValue)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-full text-purple-700"><CheckCircle size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-purple-700 uppercase">Close Rate</p>
                            <p className="text-2xl font-bold dark:text-white">{metrics.closeRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700"><FileText size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Total Proposals</p>
                            <p className="text-2xl font-bold dark:text-white">{metrics.count}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* MAIN LIST */}
            <Card className="shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                        {['All', 'Pending Approval', 'Draft', 'Sent', 'Accepted', 'Rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                                    filterStatus === status 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
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
                                        p.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                        p.status === 'Sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                        p.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                        'bg-gray-100 text-gray-800 border-gray-200'
                                    }`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {p.status === 'Pending Approval' && canApprove && (
                                            <>
                                                <button onClick={() => handleStatusChange(p, 'Draft')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="Approve"><ShieldCheck size={16}/></button>
                                                <button onClick={() => handleStatusChange(p, 'Rejected')} className="p-2 text-rose-600 hover:bg-rose-50 rounded" title="Reject"><Ban size={16}/></button>
                                            </>
                                        )}
                                        <button onClick={() => setViewProposal(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={16}/></button>
                                        <button onClick={() => handleEditProposal(p.id)} className="p-2 text-purple-600 hover:bg-purple-50 rounded" title="Edit"><Edit size={16}/></button>
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
