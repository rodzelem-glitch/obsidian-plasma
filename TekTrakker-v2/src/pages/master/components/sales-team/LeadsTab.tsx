import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { cleanUndefinedFields } from 'lib/utils';
import { globalConfirm } from 'lib/globalConfirm';
import type { PlatformLead, User } from 'types';
import { 
    Sparkles, Phone, Mail, Building, 
    CheckCircle, Search, Trash2, Eye, UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LeadsTabProps {
    leads: PlatformLead[];
    salesReps: User[];
}

const LeadsTab: React.FC<LeadsTabProps> = ({ leads, salesReps }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [sourceFilter, setSourceFilter] = useState<string>('All');
    const [selectedLead, setSelectedLead] = useState<PlatformLead | null>(null);

    const getLeadName = (lead: PlatformLead) => lead.name || lead.contactName || 'Unnamed Lead';
    const getLeadCompany = (lead: PlatformLead) => lead.company || lead.companyName || '';
    const getLeadSource = (lead: PlatformLead) => lead.source || 'Direct';

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const q = searchQuery.toLowerCase();
            const name = getLeadName(lead).toLowerCase();
            const company = getLeadCompany(lead).toLowerCase();
            const phone = (lead.phone || '').toLowerCase();
            const email = (lead.email || '').toLowerCase();
            const notes = (lead.notes || '').toLowerCase();

            const matchesSearch = !searchQuery || 
                name.includes(q) || phone.includes(q) || email.includes(q) || company.includes(q) || notes.includes(q);

            const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
            const matchesSource = sourceFilter === 'All' || 
                (sourceFilter === 'ai' ? getLeadSource(lead).toLowerCase().includes('ai') : !getLeadSource(lead).toLowerCase().includes('ai'));

            return matchesSearch && matchesStatus && matchesSource;
        });
    }, [leads, searchQuery, statusFilter, sourceFilter]);

    const handleUpdateStatus = async (leadId: string, newStatus: string) => {
        try {
            await db.collection('platformLeads').doc(leadId).update(cleanUndefinedFields({
                status: newStatus,
                lastUpdated: new Date().toISOString()
            }));
            showToast.success(`Lead status updated to ${newStatus}`);
        } catch (e: any) {
            showToast.error(`Failed to update status: ${e.message}`);
        }
    };

    const handleAssignRep = async (leadId: string, repId: string) => {
        try {
            const rep = salesReps.find(r => r.id === repId);
            await db.collection('platformLeads').doc(leadId).update(cleanUndefinedFields({
                repId: repId || null,
                repName: rep ? `${rep.firstName} ${rep.lastName}` : null,
                lastUpdated: new Date().toISOString()
            }));
            showToast.success(rep ? `Lead assigned to ${rep.firstName}` : 'Lead unassigned');
        } catch (e: any) {
            showToast.error(`Failed to assign rep: ${e.message}`);
        }
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!(await globalConfirm('Are you sure you want to delete this lead?', 'Delete Lead', 'Delete Lead', 'Cancel'))) return;
        try {
            await db.collection('platformLeads').doc(leadId).delete();
            showToast.success('Lead deleted');
            if (selectedLead?.id === leadId) setSelectedLead(null);
        } catch (e: any) {
            showToast.error(`Failed to delete: ${e.message}`);
        }
    };

    const newAiLeadsCount = leads.filter(l => getLeadSource(l).toLowerCase().includes('ai') && (l.status === 'New' || !l.status)).length;
    const totalPipelineValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);

    return (
        <div className="space-y-4">
            {/* Stat Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Platform Leads</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{leads.length}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                        <Building size={20} />
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-2xl border border-amber-300 dark:border-amber-700/60 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">New AI Voice Leads</p>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{newAiLeadsCount}</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                        Hot Leads
                    </span>
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Pipeline Value</p>
                        <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${totalPipelineValue.toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                        <CheckCircle size={20} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text"
                        placeholder="Search leads by name, phone, notes, or transcript..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold"
                    >
                        <option value="All">All Statuses</option>
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Demo Scheduled">Demo Scheduled</option>
                        <option value="Closed Won">Closed Won</option>
                        <option value="Lost">Lost</option>
                    </select>

                    <select 
                        value={sourceFilter}
                        onChange={e => setSourceFilter(e.target.value)}
                        className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white font-bold"
                    >
                        <option value="All">All Sources</option>
                        <option value="ai">AI Voice Receptionist</option>
                        <option value="manual">Manual / Web Form</option>
                    </select>
                </div>
            </div>

            {/* Leads Table */}
            <Card>
                <Table headers={['Lead / Contact', 'Phone & Email', 'Source', 'Status', 'Assigned Rep', 'Actions']}>
                    {filteredLeads.map(lead => {
                        const isAi = getLeadSource(lead).toLowerCase().includes('ai');
                        const leadName = getLeadName(lead);
                        const leadCompany = getLeadCompany(lead);

                        return (
                            <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-2">
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                {leadName}
                                            </h4>
                                            {leadCompany && (
                                                <p className="text-xs text-slate-500 font-medium">
                                                    {leadCompany}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="space-y-0.5">
                                        {lead.phone && (
                                            <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <Phone size={12} className="text-blue-500" />
                                                {lead.phone}
                                            </p>
                                        )}
                                        {lead.email && (
                                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <Mail size={12} className="text-slate-400" />
                                                {lead.email}
                                            </p>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    {isAi ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-black border border-amber-200 dark:border-amber-800">
                                            <Sparkles size={11} className="text-amber-600" />
                                            24/7 AI Voice
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                                            {getLeadSource(lead)}
                                        </span>
                                    )}
                                </td>

                                <td className="px-6 py-4">
                                    <select 
                                        value={lead.status || 'New'}
                                        onChange={e => handleUpdateStatus(lead.id, e.target.value)}
                                        className="text-xs font-bold py-1 px-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xs dark:text-white"
                                    >
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Qualified">Qualified</option>
                                        <option value="Demo Scheduled">Demo Scheduled</option>
                                        <option value="Closed Won">Closed Won</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </td>

                                <td className="px-6 py-4">
                                    <select 
                                        value={lead.repId || ''}
                                        onChange={e => handleAssignRep(lead.id, e.target.value)}
                                        className="text-xs font-medium py-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                                    >
                                        <option value="">-- Unassigned --</option>
                                        {salesReps.map(rep => (
                                            <option key={rep.id} value={rep.id}>
                                                {rep.firstName} {rep.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setSelectedLead(lead)}
                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 transition-colors"
                                            title="View Full Details & Transcript"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {lead.phone && (
                                            <button 
                                                type="button"
                                                onClick={() => navigate(`/master/communications?tab=phone&dial=${encodeURIComponent(lead.phone || '')}`)}
                                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 transition-colors"
                                                title="Call Lead with Softphone"
                                            >
                                                <Phone size={14} />
                                            </button>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => handleDeleteLead(lead.id)}
                                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 transition-colors"
                                            title="Delete Lead"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {filteredLeads.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 space-y-2">
                                <Sparkles size={32} className="mx-auto opacity-30 text-amber-500" />
                                <p className="text-xs font-semibold">No platform leads found.</p>
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>

            {/* Lead Details & Transcript Modal */}
            {selectedLead && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setSelectedLead(null)}
                    title={`Lead Details: ${getLeadName(selectedLead)}`}
                >
                    <div className="space-y-4 text-slate-800 dark:text-slate-200">
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Contact Name</p>
                                <p className="font-extrabold text-sm mt-0.5">{getLeadName(selectedLead)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Phone Number</p>
                                <p className="font-mono font-bold text-sm mt-0.5 text-blue-600">{selectedLead.phone || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Company / Request</p>
                                <p className="font-bold text-sm mt-0.5">{getLeadCompany(selectedLead) || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Lead Source</p>
                                <p className="font-bold text-sm mt-0.5">{getLeadSource(selectedLead)}</p>
                            </div>
                        </div>

                        {selectedLead.notes && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">AI Conversation & Notes</label>
                                <div className="p-3.5 bg-slate-100 dark:bg-slate-900 rounded-2xl text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700">
                                    {selectedLead.notes}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                                Close
                            </Button>
                            {selectedLead.phone && (
                                <Button 
                                    onClick={() => {
                                        const ph = selectedLead.phone;
                                        setSelectedLead(null);
                                        navigate(`/master/communications?tab=phone&dial=${encodeURIComponent(ph || '')}`);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                                >
                                    <Phone size={14} /> Call Back Now
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default LeadsTab;
