
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { PlatformLead, Job, Organization, User as AppUser, PlatformSettings, InvoiceLineItem } from 'types';
import { 
    Plus, Phone, Mail, User, Users, Clock, 
    MessageSquare, FileText, Send, CheckCircle2, ArrowRight,
    Trash2, GitMerge, PlusCircle, X, ShieldCheck, StickyNote,
    Rocket, CreditCard, Percent
} from 'lucide-react';
import Textarea from 'components/ui/Textarea';
import { useSearchParams } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    id: 'platform_billing',
    plans: {
        starter: { monthly: 49, annual: 490, maxUsers: 5 },
        growth: { monthly: 149, annual: 1490, maxUsers: 15 },
        enterprise: { monthly: 299, annual: 2990, maxUsers: 15 }
    },
    excessUserFee: 10,
    updatedAt: new Date().toISOString()
};

const SalesLeads: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const [searchParams] = useSearchParams();
    
    // --- STATE ---
    const [leads, setLeads] = useState<PlatformLead[]>([]);
    const [selectedLead, setSelectedLead] = useState<PlatformLead | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'communication'>('details');
    
    // Edit / Create State
    const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Partial<PlatformLead>>({ additionalContacts: [] });
    
    // Communication State
    const [commInput, setCommInput] = useState('');
    const [commType, setCommType] = useState<'sms' | 'email' | 'note'>('note');
    const [isSending, setIsSending] = useState(false);
    
    // Activity State
    const [activities, setActivities] = useState<any[]>([]);

    // Conversion State
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [convertPlan, setConvertPlan] = useState<'starter'|'growth'|'enterprise'>('starter');
    const [additionalUsers, setAdditionalUsers] = useState(0);
    const [customDiscount, setCustomDiscount] = useState(0);
    const [isConverting, setIsConverting] = useState(false);
    const [convertedInvoiceLink, setConvertedInvoiceLink] = useState('');
    
    const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

    useEffect(() => {
        if (!currentUser) return;

        // REAL DATA
        const unsub = db.collection('platformLeads')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformLead));
                setLeads(data);
                
                const leadIdParam = searchParams.get('leadId');
                if (leadIdParam && !selectedLead) {
                    const match = data.find(l => l.id === leadIdParam);
                    if (match) setSelectedLead(match);
                }
            });
            
        // Fetch Settings
        const fetchSettings = async () => {
             if (state.platformSettings) {
                 setSettings(state.platformSettings);
             } else {
                 const doc = await db.collection('settings').doc('platform_billing').get();
                 if (doc.exists) {
                     setSettings(doc.data() as PlatformSettings);
                 }
             }
        };
        fetchSettings();

        return () => unsub();
    }, [currentUser, searchParams, state.platformSettings]);

    // Load activities when lead selected
    useEffect(() => {
        if (selectedLead) {
            // REAL ACTIVITIES - REMOVED ORDERBY TO FIX INDEX CRASH
            const unsub = db.collection('salesActivities')
                .where('leadId', '==', selectedLead.id)
                .onSnapshot(snap => {
                    const acts = snap.docs.map(d => d.data());
                    // Client-side sort
                    acts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    setActivities(acts);
                });
            return () => unsub();
        } else {
            setActivities([]);
        }
    }, [selectedLead]);
    
    // Calculated Pricing
    const pricing = useMemo(() => {
        const planConfig = settings.plans[convertPlan] || settings.plans.starter;
        const basePrice = planConfig.monthly;
        const userFee = settings.excessUserFee || 10;
        
        // Ensure user count isn't negative
        const extraUsers = Math.max(0, additionalUsers);
        const extraUserCost = extraUsers * userFee;
        
        const subtotal = basePrice + extraUserCost;
        const discountAmount = subtotal * (Math.min(100, Math.max(0, customDiscount)) / 100);
        const total = subtotal - discountAmount;
        
        return { basePrice, extraUserCost, subtotal, discountAmount, total };
    }, [convertPlan, additionalUsers, customDiscount, settings]);

    // --- HANDLERS ---

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
                setSelectedLead({ ...selectedLead, ...leadData } as PlatformLead);
            } else {
                 const newRef = db.collection('platformLeads').doc();
                 await newRef.set({ 
                     ...leadData, 
                     id: newRef.id, 
                     createdAt: new Date().toISOString(), 
                     status: 'New',
                     value: Number(editingLead.value) || 0
                 });
            }
            setIsEditLeadOpen(false);
        } catch (e) {
            alert("Save failed.");
        }
    };

    const handleDeleteLead = async () => {
        if (!selectedLead) return;
        if (!await globalConfirm("Delete this lead?")) return;

        try {
            await db.collection('platformLeads').doc(selectedLead.id).delete();
            setSelectedLead(null);
        } catch (e) {
            alert("Delete failed.");
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedLead) return;
        
        await db.collection('platformLeads').doc(selectedLead.id).update({ status });
        setSelectedLead({ ...selectedLead, status: status as any });
        
        await db.collection('salesActivities').add({
            leadId: selectedLead.id,
            type: 'status',
            content: `Status changed to ${status}`,
            timestamp: new Date().toISOString(),
            repId: currentUser?.id
        });
    };
    
    const handleSubmitCommunication = async () => {
        if (!commInput.trim() || !selectedLead) return;
        setIsSending(true);
        
        try {
            if (commType === 'email') {
                if (!selectedLead.email) {
                    alert("Lead has no email.");
                    setIsSending(false); return;
                }
                // Send via Mail Collection (Trigger)
                await db.collection('mail').add({
                    to: [selectedLead.email],
                    message: {
                        subject: `Message from ${currentUser?.firstName}`,
                        text: commInput
                    },
                    organizationId: 'platform', // Sent from platform
                    type: 'SalesOutreach',
                    createdAt: new Date().toISOString()
                });
            } else if (commType === 'sms') {
                if (!selectedLead.phone) {
                     alert("Lead has no phone.");
                     setIsSending(false); return;
                }
                // Simulate SMS or use Twilio if configured
                await new Promise(r => setTimeout(r, 800)); 
            }
            
            // Log activity
            await db.collection('salesActivities').add({
                leadId: selectedLead.id,
                type: commType,
                content: commInput,
                timestamp: new Date().toISOString(),
                repId: currentUser?.id
            });
            
            if (commType === 'note') {
                 const newNotes = selectedLead.notes ? `${selectedLead.notes}\n\n[${new Date().toLocaleDateString()}] ${commInput}` : commInput;
                 await db.collection('platformLeads').doc(selectedLead.id).update({ notes: newNotes });
                 setSelectedLead({ ...selectedLead, notes: newNotes });
            }
            
            setCommInput('');
            setActiveTab('activity');
        } catch (e) {
            console.error(e);
            alert("Failed to send/save.");
        } finally {
            setIsSending(false);
        }
    };

    const handleConvertLead = async () => {
        if (!selectedLead || !currentUser) return;
        
        if (!selectedLead.email) {
            alert("Lead must have an email address to create an organization/user.");
            return;
        }

        setIsConverting(true);
        try {
            const orgId = `org-${Date.now()}`;
            const userId = selectedLead.email.toLowerCase().trim();
            
            // 1. Create Organization
            const newOrg: Organization = {
                id: orgId,
                name: selectedLead.companyName,
                email: selectedLead.email,
                phone: selectedLead.phone || '',
                plan: convertPlan,
                subscriptionStatus: 'active', // Will be active immediately to allow setup, invoicing handled separately
                subscriptionExpiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                salesRepId: currentUser.id, // Tag commission owner
                enabledPanels: { inventory: true, marketing: true, memberships: true, documents: true, time_tracking: true },
                additionalUserSlots: additionalUsers,
                customDiscountPct: customDiscount
            };
            
            // 2. Create User (Admin)
            const newUser: AppUser = {
                id: userId,
                uid: userId, // Placeholder until they auth
                organizationId: orgId,
                firstName: selectedLead.contactName.split(' ')[0],
                lastName: selectedLead.contactName.split(' ').slice(1).join(' ') || 'Admin',
                email: selectedLead.email,
                role: 'both',
                status: 'active',
                username: selectedLead.email.split('@')[0],
                payRate: 0,
                ptoAccrued: 0,
                notes: 'Created via Sales Conversion'
            };
            
            // 3. Create First Invoice (Job)
            const invoiceId = `job-inv-${Date.now()}`;
            
            const invoiceItems: InvoiceLineItem[] = [
                {
                    id: 'item-1',
                    description: `${convertPlan.toUpperCase()} Plan Subscription`,
                    quantity: 1,
                    unitPrice: pricing.basePrice,
                    total: pricing.basePrice,
                    type: 'Fee'
                }
            ];
            
            if (pricing.extraUserCost > 0) {
                 invoiceItems.push({
                    id: 'item-2',
                    description: `Additional Users (${additionalUsers})`,
                    quantity: additionalUsers,
                    unitPrice: settings.excessUserFee,
                    total: pricing.extraUserCost,
                    type: 'Fee'
                });
            }

            if (pricing.discountAmount > 0) {
                invoiceItems.push({
                    id: 'item-3',
                    description: `Sales Discount (${customDiscount}%)`,
                    quantity: 1,
                    unitPrice: -pricing.discountAmount,
                    total: -pricing.discountAmount,
                    type: 'Discount'
                });
            }
            
            const newJob: Job = {
                id: invoiceId,
                organizationId: 'platform', // Bill from platform
                customerName: selectedLead.companyName,
                customerId: orgId, // Customer is the new Org
                address: 'Billing Address',
                tasks: [`Platform Subscription: ${convertPlan.toUpperCase()}`],
                jobStatus: 'Completed',
                appointmentTime: new Date().toISOString(),
                source: 'PlatformAdmin',
                salesRepId: currentUser.id, // Tag commission owner on the invoice
                specialInstructions: 'Initial subscription invoice generated from sales conversion.',
                invoice: {
                    id: `INV-SUB-${Date.now()}`,
                    status: 'Unpaid',
                    amount: pricing.total,
                    totalAmount: pricing.total,
                    subtotal: pricing.subtotal,
                    taxRate: 0,
                    taxAmount: 0,
                    items: invoiceItems
                },
                jobEvents: [],
                createdAt: new Date().toISOString()
            };
            
            // Execute Batch
            const batch = db.batch();
            batch.set(db.collection('organizations').doc(orgId), newOrg);
            batch.set(db.collection('users').doc(userId), newUser);
            batch.set(db.collection('jobs').doc(invoiceId), newJob);
            batch.update(db.collection('platformLeads').doc(selectedLead.id), { status: 'Closed Won' });
            
            await batch.commit();
            
            // Generate Invoice Link
            const link = `${window.location.origin}/#/invoice/${invoiceId}`;
            setConvertedInvoiceLink(link);
            
            // Update UI
            setSelectedLead({ ...selectedLead, status: 'Closed Won' });
            alert("Lead converted successfully! Organization and Invoice created.");
        } catch (e: any) {
            console.error(e);
            alert("Conversion failed: " + e.message);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6 overflow-hidden">
            {/* LEFT PANEL */}
            <Card className="w-1/3 flex flex-col p-0 overflow-hidden border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-default shadow-md">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase text-slate-500">My Leads</h3>
                    <div className="flex gap-2">
                        <button onClick={() => { setEditingLead({ additionalContacts: [] }); setIsEditLeadOpen(true); }} className="text-primary-600 hover:bg-white p-1 rounded transition-colors" title="Add Lead"><Plus size={18}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {leads.map(lead => (
                        <div 
                            key={lead.id} 
                            onClick={() => setSelectedLead(lead)}
                            className={`p-4 border-b cursor-pointer transition-colors ${selectedLead?.id === lead.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{lead.companyName}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${lead.status === 'New' ? 'bg-green-100 text-green-700' : lead.status === 'Closed Won' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{lead.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{lead.contactName}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* RIGHT PANEL */}
            <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-default shadow-md">
                {selectedLead ? (
                    <>
                        {/* HEADER */}
                        <div className="p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedLead.companyName}</h2>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="flex items-center gap-1"><User size={14}/> {selectedLead.contactName}</span>
                                    {selectedLead.email && <span className="flex items-center gap-1"><Mail size={14}/> {selectedLead.email}</span>}
                                    {selectedLead.phone && <span className="flex items-center gap-1"><Phone size={14}/> {selectedLead.phone}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex gap-2">
                                    {selectedLead.status !== 'Closed Won' && (
                                        <Button onClick={() => { setAdditionalUsers(0); setCustomDiscount(0); setIsConvertModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-3 flex items-center gap-1">
                                            <Rocket size={14}/> Convert to Deal
                                        </Button>
                                    )}
                                    <button onClick={handleDeleteLead} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Lead">
                                        <Trash2 size={18}/>
                                    </button>
                                    <select 
                                        value={selectedLead.status}
                                        onChange={(e) => handleUpdateStatus(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 text-sm font-bold border-slate-200 dark:border-slate-700 cursor-pointer"
                                    >
                                        <option>New</option>
                                        <option>Contacted</option>
                                        <option>Demo Scheduled</option>
                                        <option>Proposal Sent</option>
                                        <option>Negotiation</option>
                                        <option>Closed Won</option>
                                        <option>Closed Lost</option>
                                    </select>
                                </div>
                                <Button onClick={() => { setEditingLead(selectedLead); setIsEditLeadOpen(true); }} variant="secondary" className="text-xs h-8 px-4">
                                    Edit Details
                                </Button>
                            </div>
                        </div>

                        {/* TABS */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6">
                            <button onClick={() => setActiveTab('details')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'details' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}>
                                <FileText size={16}/> Details
                            </button>
                            <button onClick={() => setActiveTab('activity')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'activity' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}>
                                <Clock size={16}/> Activity Log
                            </button>
                            <button onClick={() => setActiveTab('communication')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'communication' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}>
                                <MessageSquare size={16}/> Communication
                            </button>
                        </div>

                        {/* CONTENT */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950">
                            {activeTab === 'details' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Value</p>
                                            <p className="text-xl font-black">${selectedLead.value?.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Source</p>
                                            <p className="text-sm font-medium">Outbound</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <h4 className="font-bold mb-4 text-sm uppercase text-slate-500 flex items-center gap-2"><StickyNote size={16}/> Notes</h4>
                                        <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{selectedLead.notes || 'No notes added.'}</p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'activity' && (
                                <div className="space-y-4 animate-fade-in">
                                    {activities.map((act, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                act.type === 'sms' ? 'bg-blue-100 text-blue-600' : 
                                                act.type === 'email' ? 'bg-purple-100 text-purple-600' :
                                                act.type === 'status' ? 'bg-green-100 text-green-600' :
                                                act.type === 'note' ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-slate-200 text-slate-600'
                                            }`}>
                                                {act.type === 'sms' ? <MessageSquare size={14}/> : 
                                                 act.type === 'email' ? <Mail size={14}/> :
                                                 act.type === 'status' ? <CheckCircle2 size={14}/> :
                                                 act.type === 'note' ? <StickyNote size={14}/> :
                                                 <Clock size={14}/>}
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm flex-1 border border-slate-200 dark:border-slate-800">
                                                <p className="text-sm text-slate-800 dark:text-white whitespace-pre-wrap">{act.content}</p>
                                                <p className="text-[10px] text-slate-400 mt-2 flex justify-between">
                                                    <span>{new Date(act.timestamp).toLocaleString()}</span>
                                                    <span className="uppercase font-bold">{act.type}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {activities.length === 0 && <p className="text-center text-slate-400 italic py-4 md:py-8">No activity recorded.</p>}
                                </div>
                            )}

                            {activeTab === 'communication' && (
                                <div className="flex flex-col h-full animate-fade-in">
                                    <div className="bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm mt-4">
                                        <div className="flex gap-2 mb-2">
                                            <button onClick={() => setCommType('note')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'note' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>Internal Note</button>
                                            <button onClick={() => setCommType('sms')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'sms' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>SMS Text</button>
                                            <button onClick={() => setCommType('email')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'email' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>Email</button>
                                        </div>
                                        <Textarea 
                                            placeholder={commType === 'note' ? "Add an internal note..." : commType === 'sms' ? "Type SMS message..." : "Type email body..."}
                                            value={commInput}
                                            onChange={e => setCommInput(e.target.value)}
                                            rows={3}
                                            className="mb-2"
                                        />
                                        <div className="flex justify-end">
                                            <Button onClick={handleSubmitCommunication} disabled={isSending || !commInput.trim()} className="h-9 px-4 text-xs">
                                                {isSending ? 'Sending...' : 'Send / Save'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <Users size={64} className="mb-4 text-slate-200 dark:text-slate-800"/>
                        <p className="font-bold text-lg">Select a lead to view details</p>
                    </div>
                )}
            </Card>

            {/* EDIT MODAL */}
            <Modal isOpen={isEditLeadOpen} onClose={() => setIsEditLeadOpen(false)} title={editingLead.id ? 'Edit Lead' : 'New Prospect'}>
                <form onSubmit={handleSaveLead} className="space-y-4">
                    <Input label="Company Name" value={editingLead.companyName || ''} onChange={e => setEditingLead({...editingLead, companyName: e.target.value})} required />
                    <Input label="Contact Name" value={editingLead.contactName || ''} onChange={e => setEditingLead({...editingLead, contactName: e.target.value})} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Email" type="email" value={editingLead.email || ''} onChange={e => setEditingLead({...editingLead, email: e.target.value})} />
                        <Input label="Phone" type="tel" value={editingLead.phone || ''} onChange={e => setEditingLead({...editingLead, phone: e.target.value})} />
                    </div>
                    <Input label="Est. Annual Value ($)" type="number" value={editingLead.value || 0} onChange={e => setEditingLead({...editingLead, value: parseFloat(e.target.value)})} />
                    <Textarea label="Initial Notes" value={editingLead.notes || ''} onChange={e => setEditingLead({...editingLead, notes: e.target.value})} />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsEditLeadOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Record</Button>
                    </div>
                </form>
            </Modal>

            {/* CONVERSION MODAL */}
            <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="Convert Lead to Customer">
                <div className="space-y-4">
                    {!convertedInvoiceLink ? (
                        <>
                            <p className="text-sm text-gray-500">
                                This will create a new Organization, Admin User, and Subscription Invoice.
                            </p>
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <p className="font-bold text-slate-900">{selectedLead?.companyName}</p>
                                <p className="text-sm text-slate-500">{selectedLead?.contactName} • {selectedLead?.email}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
                                <select 
                                    className="w-full p-2 border rounded"
                                    value={convertPlan}
                                    onChange={e => setConvertPlan(e.target.value as any)}
                                >
                                    {Object.keys(settings.plans).map(planKey => (
                                        <option key={planKey} value={planKey}>
                                            {planKey.toUpperCase()} (${settings.plans[planKey as keyof typeof settings.plans].monthly}/mo)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {convertPlan === 'enterprise' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Users (+${settings.excessUserFee}/user)</label>
                                    <input 
                                        type="number"
                                        min="0"
                                        className="w-full p-2 border rounded"
                                        value={additionalUsers}
                                        onChange={e => setAdditionalUsers(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Discount (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full p-2 border rounded pr-8"
                                        value={customDiscount}
                                        onChange={e => setCustomDiscount(parseFloat(e.target.value) || 0)}
                                    />
                                    <Percent className="absolute right-2 top-2.5 text-gray-400" size={16}/>
                                </div>
                            </div>
                            
                            <div className="bg-slate-100 p-3 rounded text-sm flex justify-between items-center">
                                <span className="font-bold text-slate-700">Invoice Total:</span>
                                <span className="font-black text-slate-900 text-lg">
                                    ${pricing.total.toFixed(2)}
                                    {customDiscount > 0 && <span className="text-xs text-green-600 ml-2 font-normal">(-{customDiscount}%)</span>}
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="secondary" onClick={() => setIsConvertModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleConvertLead} disabled={isConverting} className="bg-emerald-600 hover:bg-emerald-700">
                                    {isConverting ? 'Processing...' : 'Create Org & Invoice'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center space-y-4 py-4">
                             <div className="flex justify-center mb-2"><CheckCircle2 size={48} className="text-emerald-500"/></div>
                             <h3 className="text-xl font-bold text-slate-900">Conversion Successful!</h3>
                             <p className="text-sm text-gray-500">The Organization has been created. Send this invoice link to the client to activate billing.</p>
                             
                             <div className="bg-slate-100 p-3 rounded text-sm break-all font-mono border border-slate-300">
                                 {convertedInvoiceLink}
                             </div>
                             
                             <div className="flex justify-center gap-2 pt-2">
                                 <Button onClick={() => { navigator.clipboard.writeText(convertedInvoiceLink); alert("Copied!"); }} variant="secondary">Copy Link</Button>
                                 <Button onClick={() => { setIsConvertModalOpen(false); setConvertedInvoiceLink(''); }}>Done</Button>
                             </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SalesLeads;
