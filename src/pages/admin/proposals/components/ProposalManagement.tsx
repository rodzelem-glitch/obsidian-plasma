
import React, { useState } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { Search, Eye, Send, Trash2 } from 'lucide-react';
import type { Proposal } from 'types';
import { db } from 'lib/firebase';
import DocumentPreview from 'components/ui/DocumentPreview';
import { globalConfirm } from "lib/globalConfirm";

const ProposalManagement: React.FC = () => {
    const { state } = useAppContext();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [viewProposal, setViewProposal] = useState<Proposal | null>(null);

    const filteredProposals = (state.proposals || []).filter(p => {
        const matchesSearch = p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const stats = {
        total: filteredProposals.length,
        accepted: filteredProposals.filter(p => p.status === 'Accepted').length,
        pending: filteredProposals.filter(p => p.status === 'Sent' || p.status === 'Draft').length,
        value: filteredProposals.reduce((sum, p) => sum + (p.total || 0), 0)
    };

    const handleDelete = async (id: string) => {
        if (!await globalConfirm("Permanently delete this proposal?")) return;
        try {
            await db.collection('proposals').doc(id).delete();
        } catch (e) {
            alert("Delete failed.");
        }
    };

    const handleSend = async (p: Proposal) => {
        if (!await globalConfirm(`Send proposal to ${p.customerName}?`)) return;
        try {
            await db.collection('proposals').doc(p.id).update({ status: 'Sent' });
            alert("Status updated to Sent.");
        } catch (e) {
            alert("Update failed.");
        }
    };

    return (
        <div className="space-y-6">
            {viewProposal && (
                <DocumentPreview 
                    type="Proposal" 
                    data={viewProposal} 
                    onClose={() => setViewProposal(null)} 
                    isInternal={true}
                />
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Proposal Pipeline</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Manage and track sent quotes and estimates.</p>
                </div>
            </header>

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
                    </Select>
                </div>
            </div>

            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-lg rounded-2xl">
                <Table headers={['Date', 'ID', 'Customer', 'Value', 'Status', 'Actions']}>
                    {filteredProposals.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer" onClick={() => setViewProposal(p)}>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                #{p.id.slice(-6)}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-black text-slate-900 dark:text-white text-sm">{p.customerName}</div>
                            </td>
                            <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                ${p.total?.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                    p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                    p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                    p.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {p.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setViewProposal(p); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary-600 transition-colors"><Eye size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleSend(p); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Send size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredProposals.length === 0 && (
                        <tr><td colSpan={6} className="p-6 md:p-12 text-center text-slate-400 font-medium italic">No proposals found.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export default ProposalManagement;
