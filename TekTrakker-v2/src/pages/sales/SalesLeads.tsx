import showToast from "lib/toast";
import { getBaseUrl, cleanUndefinedFields } from "lib/utils";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input, { NumberInput } from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { PlatformLead, Job, Organization, User as AppUser, PlatformSettings, InvoiceLineItem, CommissionSettings } from 'types';
import { 
    Plus, Phone, Mail, User, Users, Clock, 
    MessageSquare, FileText, Send, CheckCircle2, ArrowRight,
    Trash2, GitMerge, PlusCircle, X, ShieldCheck, StickyNote,
    Rocket, CreditCard, Percent
} from 'lucide-react';
import Textarea from 'components/ui/Textarea';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    id: 'global',
    plans: {
        starter: { monthly: 49, annual: 550, maxUsers: 1 },
        growth: { monthly: 149, annual: 1500, maxUsers: 5 },
        business: { monthly: 349, annual: 3490, maxUsers: 15 },
        enterprise: { monthly: 350, annual: 3500, maxUsers: 0, unlimitedUsers: true },
        payments_only: { monthly: 10, annual: 100, maxUsers: 999999, unlimitedUsers: true, features: ['proposals', 'paymentProcessing'] }
    },
    excessUserFee: 30,
    updatedAt: new Date().toISOString()
};

const SalesLeads: React.FC = () => {
    const navigate = useNavigate();
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
    
    // Interactive Calculator States
    const [calcPlan, setCalcPlan] = useState<'starter'|'growth'|'enterprise'|'payments_only'>('starter');
    const [calcBillingCycle, setCalcBillingCycle] = useState<'monthly'|'annual'>('monthly');
    const [calcAdditionalUsers, setCalcAdditionalUsers] = useState(0);
    const [calcDiscount, setCalcDiscount] = useState(0);
    const [calcCommissionRules, setCalcCommissionRules] = useState<CommissionSettings | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    
    // Communication State
    const [commInput, setCommInput] = useState('');
    const [commType, setCommType] = useState<'sms' | 'email' | 'note'>('note');
    const [isSending, setIsSending] = useState(false);
    
    // Activity State
    const [activities, setActivities] = useState<any[]>([]);

    // Conversion State
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [convertPlan, setConvertPlan] = useState<'starter' | 'growth' | 'business' | 'enterprise' | 'payments_only'>('starter');
    const [convertBillingCycle, setConvertBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [convertVirtualWorker, setConvertVirtualWorker] = useState(false);
    const [convertAiVoiceAssistant, setConvertAiVoiceAssistant] = useState(false);
    const [convertDivisionSlots, setConvertDivisionSlots] = useState(0);
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
                 const doc = await db.collection('platformSettings').doc('global').get();
                 if (doc.exists) {
                     setSettings({ id: doc.id, ...doc.data() } as PlatformSettings);
                 }
             }
        };
        fetchSettings();

        db.collection('settings').doc('commission_rules').get().then(doc => {
            if (currentUser?.customCommissionSettings) {
                setCalcCommissionRules(currentUser.customCommissionSettings);
            } else if (doc.exists) {
                setCalcCommissionRules(doc.data() as CommissionSettings);
            } else {
                setCalcCommissionRules({
                    baseRate: 0.25,
                    acceleratorRate: 0.30,
                    annualQuota: 500000,
                    renewalRate: 0.05,
                    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
                });
            }
        });

        const unsubTemplates = db.collection('sales_templates')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        return () => { unsub(); unsubTemplates(); };
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
    
    // Calculated Pricing for Lead Conversion
    const pricing = useMemo(() => {
        const planConfig = settings.plans[convertPlan] || settings.plans.starter;
        const isAnnual = convertBillingCycle === 'annual';
        const basePrice = isAnnual 
            ? (planConfig.annual || planConfig.monthly * 12 * 0.8) 
            : planConfig.monthly;
        
        const vwPrice = convertVirtualWorker ? (isAnnual ? 49.99 * 12 : 49.99) : 0;
        const voicePrice = convertAiVoiceAssistant ? (isAnnual ? 5.00 * 12 : 5.00) : 0;
        const divUnitFee = settings.divisionFee || 19.99;
        const divPrice = Math.max(0, convertDivisionSlots) * divUnitFee * (isAnnual ? 12 : 1);
        
        const extraUsers = Math.max(0, additionalUsers);
        const userFee = settings.excessUserFee || 25;
        const extraUserCost = extraUsers * userFee * (isAnnual ? 12 : 1);
        
        const subtotal = basePrice + vwPrice + voicePrice + divPrice + extraUserCost;
        const discountAmount = subtotal * (Math.min(100, Math.max(0, customDiscount)) / 100);
        const total = Math.max(0, subtotal - discountAmount);
        
        return { basePrice, vwPrice, voicePrice, divPrice, extraUserCost, subtotal, discountAmount, total, isAnnual };
    }, [convertPlan, convertBillingCycle, convertVirtualWorker, convertAiVoiceAssistant, convertDivisionSlots, additionalUsers, customDiscount, settings]);

    // Interactive Calculator Pricing
    const calcPricing = useMemo(() => {
        const planConfig = settings.plans[calcPlan] || settings.plans.starter;
        const basePrice = calcBillingCycle === 'monthly' ? planConfig.monthly : planConfig.annual / 12;
        const basePriceTotal = calcBillingCycle === 'monthly' ? planConfig.monthly : planConfig.annual;
        const userFee = settings.excessUserFee || 30;
        
        const extraUsers = Math.max(0, calcAdditionalUsers);
        const extraUserCost = extraUsers * userFee;
        const extraUserCostTotal = extraUserCost * (calcBillingCycle === 'monthly' ? 1 : 12);
        
        const subtotal = basePriceTotal + extraUserCostTotal;
        const discountAmount = subtotal * (Math.min(100, Math.max(0, calcDiscount)) / 100);
        const total = subtotal - discountAmount;

        // savings compared to monthly plan (annual plan has built-in discount)
        const monthlyBaseEquivalent = planConfig.monthly * 12 + (extraUsers * userFee * 12);
        const savings = Math.max(0, monthlyBaseEquivalent - total);

        const baseRate = calcCommissionRules?.baseRate ?? 0.25;
        const annualKicker = calcBillingCycle === 'annual' ? (calcCommissionRules?.annualPrepaidKickerRate ?? 0.05) : 0;
        const effectiveRate = baseRate + annualKicker;
        const projectedCommission = total * effectiveRate;
        
        return { basePrice, basePriceTotal, extraUserCostTotal, subtotal, discountAmount, total, savings, projectedCommission, baseRate, annualKicker, effectiveRate };
    }, [calcPlan, calcBillingCycle, calcAdditionalUsers, calcDiscount, settings, calcCommissionRules]);

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
                await db.collection('platformLeads').doc(editingLead.id).update(cleanUndefinedFields(leadData));
                setSelectedLead({ ...selectedLead, ...leadData } as PlatformLead);
            } else {
                 const newRef = db.collection('platformLeads').doc();
                 await newRef.set(cleanUndefinedFields({ 
                     ...leadData, 
                     id: newRef.id, 
                     createdAt: new Date().toISOString(), 
                     status: 'New',
                     value: Number(editingLead.value) || 0
                 }));
            }
            setIsEditLeadOpen(false);
        } catch (e) {
            showToast.warn("Save failed.");
        }
    };

    const handleDeleteLead = async () => {
        if (!selectedLead) return;
        if (!await globalConfirm("Delete this lead?")) return;

        try {
            await db.collection('platformLeads').doc(selectedLead.id).delete();
            setSelectedLead(null);
        } catch (e) {
            showToast.warn("Delete failed.");
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedLead) return;
        
        await db.collection('platformLeads').doc(selectedLead.id).update(cleanUndefinedFields({ status }));
        setSelectedLead({ ...selectedLead, status: status as any });
        
        await db.collection('salesActivities').add(cleanUndefinedFields({
            leadId: selectedLead.id,
            type: 'status',
            content: `Status changed to ${status}`,
            timestamp: new Date().toISOString(),
            repId: currentUser?.id
        }));
    };
    
    const handleSubmitCommunication = async () => {
        if (!commInput.trim() || !selectedLead) return;
        setIsSending(true);
        
        try {
            if (commType === 'email') {
                if (!selectedLead.email) {
                    showToast.warn("Lead has no email.");
                    setIsSending(false); return;
                }
                const { sendEmail } = await import('../../lib/mailService');
                
                await sendEmail({
                    to: selectedLead.email,
                    subject: `Message from ${currentUser?.firstName}`,
                    text: commInput,
                    organizationId: 'platform',
                    type: 'SalesOutreach',
                    bypassOptOut: false
                });
            } else if (commType === 'sms') {
                if (!selectedLead.phone) {
                     showToast.warn("Lead has no phone.");
                     setIsSending(false); return;
                }
                // Simulate SMS or use Twilio if configured
                await new Promise(r => setTimeout(r, 800)); 
            }
            
            // Log activity
            await db.collection('salesActivities').add(cleanUndefinedFields({
                leadId: selectedLead.id,
                type: commType,
                content: commInput,
                timestamp: new Date().toISOString(),
                repId: currentUser?.id
            }));
            
            if (commType === 'note') {
                 const newNotes = selectedLead.notes ? `${selectedLead.notes}\n\n[${new Date().toLocaleDateString()}] ${commInput}` : commInput;
                 await db.collection('platformLeads').doc(selectedLead.id).update(cleanUndefinedFields({ notes: newNotes }));
                 setSelectedLead({ ...selectedLead, notes: newNotes });
            }
            
            setCommInput('');
            setActiveTab('activity');
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to send/save.");
        } finally {
            setIsSending(false);
        }
    };

    const handleConvertLead = async () => {
        if (!selectedLead || !currentUser) return;
        
        if (!selectedLead.email) {
            showToast.warn("Lead must have an email address to create an organization/user.");
            return;
        }

        setIsConverting(true);
        try {
            const orgId = `org-${Date.now()}`;
            const userId = selectedLead.email.toLowerCase().trim();
            
            // 1. Create Organization
            const cycleDays = convertBillingCycle === 'annual' ? 365 : 30;
            const nextCycleDate = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000);

            const newOrg: Organization = {
                id: orgId,
                name: selectedLead.companyName,
                email: selectedLead.email,
                phone: selectedLead.phone || '',
                plan: convertPlan,
                billingCycle: convertBillingCycle,
                subscriptionStatus: 'active', // Active immediately to allow onboarding, invoice link sent for payment
                subscriptionExpiryDate: nextCycleDate.toISOString().split('T')[0],
                nextBillingDate: nextCycleDate.toISOString(),
                createdAt: new Date().toISOString(),
                salesRepId: currentUser.id, // Tag commission owner
                virtualWorkerEnabled: convertVirtualWorker,
                aiVoiceAssistantEnabled: convertAiVoiceAssistant,
                additionalDivisionsSlots: convertDivisionSlots,
                additionalUserSlots: additionalUsers,
                customDiscountPct: customDiscount,
                enabledPanels: { inventory: true, marketing: true, memberships: true, documents: true, time_tracking: true },
                ...(currentUser.franchiseId ? { franchiseId: currentUser.franchiseId } : {})
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
                notes: 'Created via Sales Conversion',
                ...(currentUser.franchiseId ? { franchiseId: currentUser.franchiseId } : {})
            };
            
            // 3. Create First Invoice (Job)
            const invoiceId = `job-inv-${Date.now()}`;
            
            const invoiceItems: InvoiceLineItem[] = [
                {
                    id: 'item-1',
                    description: `${convertPlan.toUpperCase()} Plan Subscription (${convertBillingCycle.toUpperCase()})`,
                    quantity: 1,
                    unitPrice: pricing.basePrice,
                    total: pricing.basePrice,
                    type: 'Fee'
                }
            ];

            if (pricing.vwPrice > 0) {
                invoiceItems.push({
                    id: 'item-vw',
                    description: `Virtual AI Worker Automation Suite (${convertBillingCycle.toUpperCase()})`,
                    quantity: 1,
                    unitPrice: pricing.vwPrice,
                    total: pricing.vwPrice,
                    type: 'Fee'
                });
            }

            if (pricing.voicePrice > 0) {
                invoiceItems.push({
                    id: 'item-voice',
                    description: `24/7 AI Voice Receptionist Add-On (${convertBillingCycle.toUpperCase()})`,
                    quantity: 1,
                    unitPrice: pricing.voicePrice,
                    total: pricing.voicePrice,
                    type: 'Fee'
                });
            }

            if (pricing.divPrice > 0) {
                invoiceItems.push({
                    id: 'item-div',
                    description: `Additional Division Slots (${convertDivisionSlots}) (${convertBillingCycle.toUpperCase()})`,
                    quantity: convertDivisionSlots,
                    unitPrice: (settings.divisionFee || 19.99) * (convertBillingCycle === 'annual' ? 12 : 1),
                    total: pricing.divPrice,
                    type: 'Fee'
                });
            }
            
            if (pricing.extraUserCost > 0) {
                 invoiceItems.push({
                    id: 'item-users',
                    description: `Additional Users (${additionalUsers}) (${convertBillingCycle.toUpperCase()})`,
                    quantity: additionalUsers,
                    unitPrice: (settings.excessUserFee || 25) * (convertBillingCycle === 'annual' ? 12 : 1),
                    total: pricing.extraUserCost,
                    type: 'Fee'
                });
            }

            if (pricing.discountAmount > 0) {
                invoiceItems.push({
                    id: 'item-discount',
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
                tasks: [`Platform Subscription: ${convertPlan.toUpperCase()} (${convertBillingCycle.toUpperCase()})`],
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
            batch.set(db.collection('organizations').doc(orgId), cleanUndefinedFields(newOrg));
            batch.set(db.collection('users').doc(userId), cleanUndefinedFields(newUser));
            batch.set(db.collection('jobs').doc(invoiceId), cleanUndefinedFields(newJob));
            batch.update(db.collection('platformLeads').doc(selectedLead.id), cleanUndefinedFields({ 
                status: 'Closed Won',
                convertedOrgId: orgId
            }));
            
            await batch.commit();
            
            // Generate Invoice Link
            const link = `${getBaseUrl()}/#/invoice/${invoiceId}`;
            setConvertedInvoiceLink(link);
            
            // Update UI
            setSelectedLead({ ...selectedLead, status: 'Closed Won', convertedOrgId: orgId });
            showToast.warn("Lead converted successfully! Organization and Invoice created.");
        } catch (e: any) {
            console.error(e);
            showToast.warn("Conversion failed: " + e.message);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-6 overflow-hidden">
            {/* LEFT PANEL */}
            <Card className="w-full md:w-1/3 h-1/3 md:h-full flex flex-col p-0 overflow-hidden border-b md:border-b-0 border-r-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-default shadow-md shrink-0">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase text-slate-500">My Leads</h3>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
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
                        <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-start gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedLead.companyName}</h2>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="flex items-center gap-1"><User size={14}/> {selectedLead.contactName}</span>
                                    {selectedLead.email && <span className="flex items-center gap-1"><Mail size={14}/> {selectedLead.email}</span>}
                                    {selectedLead.phone && <span className="flex items-center gap-1"><Phone size={14}/> {selectedLead.phone}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                                <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                                    {!selectedLead.convertedOrgId && (
                                        <Button onClick={() => { setAdditionalUsers(0); setCustomDiscount(0); setIsConvertModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-3 flex items-center gap-1">
                                            <Rocket size={14}/> Convert to Deal
                                        </Button>
                                    )}
                                    <button onClick={handleDeleteLead} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Lead">
                                        <Trash2 size={18}/>
                                    </button>
                                    <select title="Status" aria-label="Lead Status"
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
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Value</p>
                                            <p className="text-xl font-black">${selectedLead.value?.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Source</p>
                                            <p className="text-sm font-medium">Outbound</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Status</p>
                                            <p className="text-sm font-medium">{selectedLead.status} {selectedLead.convertedOrgId && "✓ Converted"}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <h4 className="font-bold mb-4 text-sm uppercase text-slate-500 flex items-center gap-2"><StickyNote size={16}/> Notes</h4>
                                        <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{selectedLead.notes || 'No notes added.'}</p>
                                    </div>

                                    {/* Interactive Quote & Commission Calculator */}
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b dark:border-slate-800 pb-2">
                                            <Rocket size={18} className="text-blue-500"/> Interactive Quote & Commission Calculator
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Plan</label>
                                                <select 
                                                    title="Calc Plan" aria-label="Plan"
                                                    value={calcPlan}
                                                    onChange={e => setCalcPlan(e.target.value as any)}
                                                    className="w-full p-2 border rounded text-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-950 dark:text-slate-50"
                                                >
                                                    {Object.keys(settings.plans).map(planKey => (
                                                        <option key={planKey} value={planKey}>
                                                            {planKey.toUpperCase()} (${settings.plans[planKey].monthly}/mo)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Interval</label>
                                                <div className="flex border rounded-lg overflow-hidden text-sm border-slate-200 dark:border-slate-700">
                                                    <button 
                                                        onClick={() => setCalcBillingCycle('monthly')}
                                                        className={`flex-1 py-1.5 font-bold ${calcBillingCycle === 'monthly' ? 'bg-primary-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                                    >
                                                        Monthly
                                                    </button>
                                                    <button 
                                                        onClick={() => setCalcBillingCycle('annual')}
                                                        className={`flex-1 py-1.5 font-bold ${calcBillingCycle === 'annual' ? 'bg-primary-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                                    >
                                                        Annual (Save)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {!(settings.plans[calcPlan] || settings.plans.starter).unlimitedUsers ? (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Additional Users</label>
                                                    <div className="w-full p-2 border rounded text-xs bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                                                        Seat add-ons disabled. Upgrade tier to add users.
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Additional Users</label>
                                                    <div className="w-full p-2 border rounded text-sm bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 italic">
                                                        Unlimited User Slots included
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Discount (%)</label>
                                                <NumberInput 
                                                    min="0"
                                                    max="100"
                                                    value={calcDiscount}
                                                    onChange={e => setCalcDiscount(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border rounded text-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-950 dark:text-slate-50"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 text-sm border border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400 font-medium">Base Contract Price:</span>
                                                <span className="font-bold">${calcPricing.basePriceTotal.toFixed(2)} / yr equivalent</span>
                                            </div>
                                            {calcPricing.extraUserCostTotal > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 dark:text-slate-400 font-medium">Excess User Costs:</span>
                                                    <span className="font-bold">${calcPricing.extraUserCostTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {calcPricing.discountAmount > 0 && (
                                                <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                                                    <span>Discount:</span>
                                                    <span>-${calcPricing.discountAmount.toFixed(2)} (-{calcDiscount}%)</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t border-dashed dark:border-slate-700 pt-2">
                                                <span className="font-black text-slate-800 dark:text-white">Contract Total:</span>
                                                <span className="font-black text-slate-900 dark:text-white text-lg">${calcPricing.total.toFixed(2)}</span>
                                            </div>
                                            {calcPricing.savings > 0 && (
                                                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded">
                                                    <span>Total Savings vs Standard Monthly:</span>
                                                    <span>${calcPricing.savings.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900 text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                                                    <Percent size={14}/> Projected Rep Commission:
                                                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                        ({(calcPricing.effectiveRate * 100).toFixed(1)}%
                                                        {calcPricing.annualKicker > 0 ? ` incl. +${(calcPricing.annualKicker * 100).toFixed(0)}% Annual Kicker` : ''})
                                                    </span>
                                                </div>
                                                {calcPricing.annualKicker > 0 && (
                                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                        ✨ Upfront annual payment bonus unlocks +5% kicker!
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-black text-blue-900 dark:text-blue-100 text-base">${calcPricing.projectedCommission.toFixed(2)}</span>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <Button 
                                                variant="secondary" 
                                                onClick={async () => {
                                                    const kickerNote = calcPricing.annualKicker > 0 ? ` (+${(calcPricing.annualKicker * 100).toFixed(0)}% Annual Prepayment Kicker)` : '';
                                                    const quoteText = `\n\n[Quote Generated - ${new Date().toLocaleDateString()}]\nPlan: ${calcPlan.toUpperCase()}\nBilling Interval: ${calcBillingCycle.toUpperCase()}\nUsers: ${calcAdditionalUsers}\nDiscount: ${calcDiscount}%\nTotal Contract Price: $${calcPricing.total.toFixed(2)}\nCommission Rate: ${(calcPricing.effectiveRate * 100).toFixed(1)}%${kickerNote}\nProjected Commission: $${calcPricing.projectedCommission.toFixed(2)}`;
                                                    const newNotes = selectedLead.notes ? `${selectedLead.notes}${quoteText}` : quoteText.trim();
                                                    await db.collection('platformLeads').doc(selectedLead.id).update(cleanUndefinedFields({ notes: newNotes }));
                                                    setSelectedLead({ ...selectedLead, notes: newNotes });
                                                    showToast.warn("Quote saved to Lead notes.");
                                                }}
                                                className="text-xs flex items-center gap-1"
                                            >
                                                Save Quote to Notes
                                            </Button>
                                            <Button 
                                                onClick={async () => {
                                                    if (!selectedLead.email) {
                                                        showToast.warn("Lead has no email.");
                                                        return;
                                                    }
                                                    const { sendEmail } = await import('../../lib/mailService');
                                                    const emailText = `Hello ${selectedLead.contactName},\n\nWe have prepared a custom pricing quote for ${selectedLead.companyName} on the TekTrakker Platform:\n\n- Plan: ${calcPlan.toUpperCase()}\n- Billing Interval: ${calcBillingCycle.toUpperCase()}\n- User Slots: ${calcAdditionalUsers}\n- Total Price: $${calcPricing.total.toFixed(2)} / period\n\nIf you have any questions or are ready to get started, please let me know!\n\nBest regards,\n${currentUser?.firstName} ${currentUser?.lastName}\nTekTrakker Sales Team`;
                                                    await sendEmail({
                                                        to: selectedLead.email,
                                                        subject: `Custom Quote: TekTrakker Platform for ${selectedLead.companyName}`,
                                                        text: emailText,
                                                        organizationId: 'platform',
                                                        type: 'SalesOutreach',
                                                        bypassOptOut: false
                                                    });
                                                    // Log as email activity
                                                    await db.collection('salesActivities').add(cleanUndefinedFields({
                                                        leadId: selectedLead.id,
                                                        type: 'email',
                                                        content: `Sent Quote Email:\nPeriod: ${calcBillingCycle}\nPlan: ${calcPlan}\nTotal: $${calcPricing.total.toFixed(2)}`,
                                                        timestamp: new Date().toISOString(),
                                                        repId: currentUser?.id
                                                    }));
                                                    showToast.warn("Quote email sent to client.");
                                                }}
                                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 border-0"
                                            >
                                                Send Quote Email
                                            </Button>
                                        </div>
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
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
                                            <div className="flex gap-2">
                                                <button onClick={() => setCommType('note')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'note' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>Internal Note</button>
                                                <button onClick={() => setCommType('sms')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'sms' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>SMS Text</button>
                                                <button onClick={() => setCommType('email')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${commType === 'email' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>Email</button>
                                            </div>
                                            {templates.filter(t => t.type === commType).length > 0 && (
                                                <select 
                                                    title="Template" aria-label="Template"
                                                    onChange={(e) => {
                                                        const temp = templates.find(t => t.id === e.target.value);
                                                        if (temp) {
                                                            let text = temp.content || '';
                                                            text = text.replace(/\{\{firstName\}\}/g, selectedLead.contactName.split(' ')[0]);
                                                            text = text.replace(/\{\{companyName\}\}/g, selectedLead.companyName);
                                                            text = text.replace(/\{\{city\}\}/g, selectedLead.city || '');
                                                            setCommInput(text);
                                                        }
                                                    }}
                                                    className="p-1 rounded border text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-950 dark:text-slate-50"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Insert Template...</option>
                                                    {templates.filter(t => t.type === commType).map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            )}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Subscription Plan</label>
                                    <select title="Plan" aria-label="Conversion Plan"
                                        className="w-full p-2.5 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-medium"
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Billing Interval</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConvertBillingCycle('monthly')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                                                convertBillingCycle === 'monthly'
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                            }`}
                                        >
                                            Monthly
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConvertBillingCycle('annual')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition flex items-center justify-center gap-1 ${
                                                convertBillingCycle === 'annual'
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                            }`}
                                        >
                                            Annual <span className="bg-emerald-500 text-white text-[9px] px-1 rounded-full uppercase font-black">Save 20%</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Add-Ons Options */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <span className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Optional Add-Ons</span>
                                
                                <label className="flex items-center justify-between text-xs font-medium cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={convertVirtualWorker}
                                            onChange={e => setConvertVirtualWorker(e.target.checked)}
                                            className="rounded text-blue-600 w-4 h-4"
                                        />
                                        <span>Virtual AI Worker Suite</span>
                                    </div>
                                    <span className="font-bold text-slate-600 dark:text-slate-400">
                                        {convertBillingCycle === 'annual' ? '$599.88/yr' : '$49.99/mo'}
                                    </span>
                                </label>

                                <label className="flex items-center justify-between text-xs font-medium cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={convertAiVoiceAssistant}
                                            onChange={e => setConvertAiVoiceAssistant(e.target.checked)}
                                            className="rounded text-blue-600 w-4 h-4"
                                        />
                                        <span>24/7 AI Voice Receptionist</span>
                                    </div>
                                    <span className="font-bold text-slate-600 dark:text-slate-400">
                                        {convertBillingCycle === 'annual' ? '$60.00/yr' : '$5.00/mo'} (+ $0.07/min usage)
                                    </span>
                                </label>

                                <div className="flex items-center justify-between text-xs font-medium p-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <span>Additional Division Slots (${settings.divisionFee || 19.99}/mo):</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConvertDivisionSlots(Math.max(0, convertDivisionSlots - 1))}
                                            disabled={convertDivisionSlots <= 0}
                                            className="w-6 h-6 rounded bg-white dark:bg-slate-700 border text-slate-700 dark:text-white disabled:opacity-40"
                                        >-</button>
                                        <span className="font-bold w-4 text-center">{convertDivisionSlots}</span>
                                        <button
                                            type="button"
                                            onClick={() => setConvertDivisionSlots(convertDivisionSlots + 1)}
                                            className="w-6 h-6 rounded bg-white dark:bg-slate-700 border text-slate-700 dark:text-white"
                                        >+</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Custom Sales Discount (%)</label>
                                <div className="relative">
                                    <NumberInput 
                                        min="0"
                                        max="100"
                                        className="w-full p-2.5 border rounded-lg pr-8 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-medium"
                                        value={customDiscount} title="Discount" aria-label="Discount" placeholder="0"
                                        onChange={e => setCustomDiscount(parseFloat(e.target.value) || 0)}
                                    />
                                    <Percent className="absolute right-2.5 top-3 text-gray-400" size={16}/>
                                </div>
                            </div>
                            
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-sm flex justify-between items-center border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-wider block">Deal Total ({convertBillingCycle.toUpperCase()}):</span>
                                    <span className="text-[11px] text-slate-500">Base Plan + Add-ons</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-xl">
                                        ${pricing.total.toFixed(2)}
                                    </span>
                                    {customDiscount > 0 && <span className="text-xs text-rose-500 ml-2 font-bold block">(-{customDiscount}% applied)</span>}
                                </div>
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
                                 <Button onClick={() => { navigator.clipboard.writeText(convertedInvoiceLink); showToast.warn("Copied!"); }} variant="secondary">Copy Link</Button>
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

