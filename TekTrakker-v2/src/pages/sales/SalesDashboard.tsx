import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { PlatformLead } from 'types';
import { 
    DollarSign, Briefcase, Plus, Phone, Mail, MapPin, 
    ArrowRight, CheckCircle, Clock, Target, Calendar, User, MessageSquare, FileText, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SalesDashboardProps {
    defaultTab?: 'overview' | 'leads' | 'pipeline' | 'commissions';
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ defaultTab = 'overview' }) => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const [leads, setLeads] = useState<PlatformLead[]>([]);
    const [commissionRules, setCommissionRules] = useState<any>(null);
    
    // CRM State
    const [selectedLead, setSelectedLead] = useState<PlatformLead | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    
    // Add/Edit Lead Modal
    const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Partial<PlatformLead>>({});
    
    useEffect(() => {
        if (!currentUser) return;
        
        db.collection('settings').doc('commission_rules').get().then(doc => {
            if (currentUser.customCommissionSettings) {
                setCommissionRules(currentUser.customCommissionSettings);
            } else if (doc.exists) {
                setCommissionRules(doc.data());
            } else {
                setCommissionRules({ baseRate: 0.25 });
            }
        });

        const unsub = db.collection('platformLeads')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformLead));
                setLeads(data);
            });
        return () => unsub();
    }, [currentUser]);

    // Fetch activities when a lead is selected
    useEffect(() => {
        if (selectedLead) {
            const unsub = db.collection('salesActivities')
                .where('leadId', '==', selectedLead.id)
                .orderBy('timestamp', 'desc')
                .onSnapshot(snap => {
                    const acts = snap.docs.map(d => d.data());
                    setActivities(acts);
                });
            return () => unsub();
        } else {
            setActivities([]);
        }
    }, [selectedLead]);

    // Metrics
    const metrics = useMemo(() => {
        const totalPipeline = leads.reduce((sum, l) => sum + (l.status !== 'Closed Lost' ? l.value : 0), 0);
        const closedWon = leads.filter(l => l.status === 'Closed Won').reduce((sum, l) => sum + l.value, 0);
        const openLeads = leads.filter(l => l.status === 'New' || l.status === 'Contacted').length;
        const rate = commissionRules?.baseRate || 0.25;
        const projectedCommission = closedWon * rate; 
        return { totalPipeline, closedWon, openLeads, projectedCommission };
    }, [leads, commissionRules]);

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        const leadData = {
            ...editingLead,
            repId: currentUser?.id,
            updatedAt: new Date().toISOString()
        };
        
        try {
            if (editingLead.id) {
                await db.collection('platformLeads').doc(editingLead.id).update(leadData);
            } else {
                 const newRef = db.collection('platformLeads').doc();
                 const id = newRef.id;
                 await newRef.set({ 
                     ...leadData, 
                     id, 
                     createdAt: new Date().toISOString(), 
                     status: 'New',
                     value: Number(editingLead.value) || 0
                 });
                 // Log creation activity
                 await db.collection('salesActivities').add({
                     leadId: id,
                     type: 'system',
                     content: 'Lead created',
                     timestamp: new Date().toISOString(),
                     repId: currentUser?.id
                 });
            }
            setIsEditLeadOpen(false);
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to save lead.");
        }
    };

    const handleAddNote = async () => {
        if (!selectedLead || !newNote.trim()) return;
        await db.collection('salesActivities').add({
            leadId: selectedLead.id,
            type: 'note',
            content: newNote,
            timestamp: new Date().toISOString(),
            repId: currentUser?.id
        });
        setNewNote('');
    };

    const handleLogActivity = async (type: 'call' | 'email') => {
        if (!selectedLead) return;
        await db.collection('salesActivities').add({
            leadId: selectedLead.id,
            type: type,
            content: type === 'call' ? 'Logged a call' : 'Sent an email',
            timestamp: new Date().toISOString(),
            repId: currentUser?.id
        });
        showToast.warn(`${type === 'call' ? 'Call' : 'Email'} logged.`);
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedLead) return;
        await db.collection('platformLeads').doc(selectedLead.id).update({ status });
        setSelectedLead({ ...selectedLead, status: status as any });
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            <header className="flex justify-between items-center shrink-0">
                
                <Button onClick={() => { setEditingLead({}); setIsEditLeadOpen(true); }} className="flex items-center gap-2 shadow-lg">
                    <Plus size={18}/> Add Prospect
                </Button>
            </header>

            {/* KPI ROW (Only on Overview) */}
            {defaultTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                    <Card className="bg-emerald-50 border-emerald-200 p-4">
                        <p className="text-xs font-bold text-emerald-700 uppercase">Closed Revenue</p>
                        <p className="text-2xl font-black text-emerald-900">${metrics.closedWon.toLocaleString()}</p>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200 p-4">
                        <p className="text-xs font-bold text-blue-700 uppercase">Active Pipeline</p>
                        <p className="text-2xl font-black text-blue-900">${metrics.totalPipeline.toLocaleString()}</p>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200 p-4">
                        <p className="text-xs font-bold text-purple-700 uppercase">Est. Commission</p>
                        <p className="text-2xl font-black text-purple-900">${metrics.projectedCommission.toLocaleString()}</p>
                    </Card>
                    <Card className="bg-slate-50 border-slate-200 p-4">
                        <p className="text-xs font-bold text-slate-700 uppercase">Open Leads</p>
                        <p className="text-2xl font-black text-slate-900">{metrics.openLeads}</p>
                    </Card>
                </div>
            )}

            {/* CRM SPLIT VIEW (Leads & Pipeline) */}
            {(defaultTab === 'leads' || defaultTab === 'overview') && (
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* LEFT LIST */}
                    <Card className="w-1/3 flex flex-col p-0 overflow-hidden border-r border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-bold text-sm uppercase text-slate-500">My Leads</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {leads.map(lead => (
                                <div 
                                    key={lead.id} 
                                    onClick={() => setSelectedLead(lead)}
                                    className={`p-4 border-b cursor-pointer transition-colors ${selectedLead?.id === lead.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-900 dark:text-white">{lead.companyName}</h4>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${lead.status === 'New' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{lead.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{lead.contactName}</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* RIGHT DETAIL / ACTIVITY */}
                    <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900">
                        {selectedLead ? (
                            <>
                                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedLead.companyName}</h2>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="flex items-center gap-1"><User size={14}/> {selectedLead.contactName}</span>
                                            <span className="flex items-center gap-1"><Mail size={14}/> {selectedLead.email}</span>
                                            <span className="flex items-center gap-1"><Phone size={14}/> {selectedLead.phone}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <select 
                                            value={selectedLead.status}
                                            onChange={(e) => handleUpdateStatus(e.target.value)}
                                            className="p-2 rounded border bg-white dark:bg-slate-800 text-sm font-bold"
                                        >
                                            <option>New</option>
                                            <option>Contacted</option>
                                            <option>Demo Scheduled</option>
                                            <option>Proposal Sent</option>
                                            <option>Negotiation</option>
                                            <option>Closed Won</option>
                                            <option>Closed Lost</option>
                                        </select>
                                        <Button onClick={() => { setEditingLead(selectedLead); setIsEditLeadOpen(true); }} variant="secondary" className="text-xs h-8">
                                            Edit Details
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex flex-col gap-4">
                                    {/* Timeline */}
                                    <div className="space-y-4">
                                        {activities.map((act, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${act.type === 'note' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {act.type === 'note' ? <FileText size={14}/> : <Clock size={14}/>}
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm flex-1 border border-slate-200 dark:border-slate-700">
                                                    <p className="text-sm text-slate-800 dark:text-white">{act.content}</p>
                                                    <p className="text-[10px] text-slate-400 mt-2">{new Date(act.timestamp).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {activities.length === 0 && <p className="text-center text-slate-400 italic text-sm py-4">No history yet.</p>}
                                    </div>
                                </div>

                                <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-700">
                                    <div className="flex gap-2 mb-2">
                                        <Button onClick={() => handleLogActivity('call')} variant="secondary" className="text-xs flex items-center gap-1"><Phone size={12}/> Log Call</Button>
                                        <Button onClick={() => handleLogActivity('email')} variant="secondary" className="text-xs flex items-center gap-1"><Mail size={12}/> Log Email</Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                                            placeholder="Add a note..."
                                            value={newNote}
                                            onChange={e => setNewNote(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                        />
                                        <Button onClick={handleAddNote} disabled={!newNote} className="w-12 h-10 flex items-center justify-center"><Send size={16}/></Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Select a lead to view details</div>
                        )}
                    </Card>
                </div>
            )}

            {/* MODAL */}
            <Modal isOpen={isEditLeadOpen} onClose={() => setIsEditLeadOpen(false)} title={editingLead.id ? 'Edit Lead' : 'New Prospect'}>
                <form onSubmit={handleSaveLead} className="space-y-4">
                    <Input label="Company Name" value={editingLead.companyName || ''} onChange={e => setEditingLead({...editingLead, companyName: e.target.value})} required />
                    <Input label="Contact Name" value={editingLead.contactName || ''} onChange={e => setEditingLead({...editingLead, contactName: e.target.value})} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Email" type="email" value={editingLead.email || ''} onChange={e => setEditingLead({...editingLead, email: e.target.value})} />
                        <Input label="Phone" type="tel" value={editingLead.phone || ''} onChange={e => setEditingLead({...editingLead, phone: e.target.value})} />
                    </div>
                    <Input label="Est. Annual Value ($)" type="number" value={editingLead.value || 0} onChange={e => setEditingLead({...editingLead, value: parseFloat(e.target.value)})} />
                    
                    <div className="pt-2">
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                            value={editingLead.status || 'New'}
                            onChange={e => setEditingLead({...editingLead, status: e.target.value as any})}
                        >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Demo Scheduled">Demo Scheduled</option>
                            <option value="Proposal Sent">Proposal Sent</option>
                            <option value="Negotiation">Negotiation</option>
                            <option value="Closed Won">Closed Won</option>
                            <option value="Closed Lost">Closed Lost</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsEditLeadOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Record</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SalesDashboard;
