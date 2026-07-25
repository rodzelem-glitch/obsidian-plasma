import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Mail, MessageSquare, Play, Pause, Trash2, Plus, Search, Target, Clock, 
    BarChart3, TrendingUp, Sparkles, AlertCircle, Loader2, ArrowLeft, 
    GripVertical, ListChecks, BookOpen, BarChart2, Send, Eye, Code, Filter, Users, RefreshCw, Save
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import TemplateDesigner from './campaigns/components/TemplateDesigner';
import OutreachROI from './campaigns/components/OutreachROI';
import MailingListManager from '../master/components/MailingListManager';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { globalConfirm } from "lib/globalConfirm";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

interface CampaignPhase {
    id: string;
    name: string;
    subject: string;
    content: string;
    delayDays: number;
}

interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'multi';
    status: 'draft' | 'active' | 'paused' | 'completed';
    audience: 'all_leads' | 'new_leads' | 'closed_lost' | 'custom';
    templateId?: string;
    subject?: string;
    content?: string;
    phases?: CampaignPhase[];
    stats: {
        sent: number;
        opened: number;
        clicked: number;
        responded: number;
    };
    createdAt: string;
    scheduledFor?: string;
    repId?: string;
}

const CampaignManager: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useAppContext();
    const currentUser = state.currentUser;
    const isSalesRep = currentUser?.role === 'platform_sales';

    // Tabs
    const [activeTab, setActiveTab] = useState<'compose' | 'drip' | 'lists' | 'templates' | 'analytics'>('compose');

    // Data lists
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [mailingLists, setMailingLists] = useState<any[]>([]);
    const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create Drip Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isWriting, setIsWriting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
        name: '',
        type: 'email',
        audience: 'new_leads',
        phases: [{ id: `phase-1`, name: 'Initial Contact', subject: '', content: '', delayDays: 0 }],
        status: 'draft'
    });

    // Broadcast Studio States
    const [subject, setSubject] = useState('');
    const [htmlContent, setHtmlContent] = useState('<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px"><h2>Your outreach message here</h2><p>Start writing or use AI generation...</p></div>');
    const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isIterative, setIsIterative] = useState(false);
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [audienceSource, setAudienceSource] = useState<'leads' | 'mailing_lists'>('leads');
    const [selectedMailingListId, setSelectedMailingListId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    // Load data with repId isolation
    useEffect(() => {
        if (!currentUser) return;

        // 1. Fetch sales campaigns
        let queryCampaigns = db.collection('sales_campaigns');
        if (isSalesRep) {
            queryCampaigns = queryCampaigns.where('repId', '==', currentUser.id) as any;
        }
        const unsubCampaigns = queryCampaigns.onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
            setCampaigns(data);
            setIsLoading(false);
        }, () => {
            setCampaigns([]);
            setIsLoading(false);
        });

        // 2. Fetch platform leads assigned to sales rep
        let queryLeads = db.collection('platformLeads');
        if (isSalesRep) {
            queryLeads = queryLeads.where('repId', '==', currentUser.id) as any;
        }
        const unsubLeads = queryLeads.onSnapshot(snap => {
            setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, () => setLeads([]));

        // 3. Fetch mailing lists
        let queryLists = db.collection('platform_mailing_lists');
        if (isSalesRep) {
            queryLists = queryLists.where('repId', '==', currentUser.id) as any;
        }
        const unsubLists = queryLists.onSnapshot(snap => {
            setMailingLists(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, () => setMailingLists([]));

        // 4. Fetch sales templates
        let queryTemplates = db.collection('sales_templates');
        if (isSalesRep) {
            queryTemplates = queryTemplates.where('repId', '==', currentUser.id) as any;
        }
        const unsubTemplates = queryTemplates.onSnapshot(snap => {
            setSavedTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, () => setSavedTemplates([]));

        return () => {
            unsubCampaigns();
            unsubLeads();
            unsubLists();
            unsubTemplates();
        };
    }, [currentUser, isSalesRep]);

    // Broadcast Audience Filtering
    const audienceRows = useMemo(() => {
        if (audienceSource === 'leads') {
            const s = searchTerm.toLowerCase();
            return leads.filter(l => {
                const name = l.contactName || '';
                const email = l.email || '';
                const comp = l.companyName || '';
                const matchSearch = name.toLowerCase().includes(s) || email.toLowerCase().includes(s) || comp.toLowerCase().includes(s);
                const matchStatus = filterStatus === 'All' || l.status === filterStatus;
                return matchSearch && matchStatus && email;
            }).map(l => ({
                email: l.email,
                label: l.contactName || 'Unnamed Contact',
                sub: l.companyName ? `${l.companyName} • ${l.status}` : l.status,
                id: l.id
            }));
        }
        if (audienceSource === 'mailing_lists' && selectedMailingListId) {
            const s = searchTerm.toLowerCase();
            const list = mailingLists.find(l => l.id === selectedMailingListId);
            return (list?.contacts || []).filter((c: any) =>
                c.email.toLowerCase().includes(s) || (c.name || '').toLowerCase().includes(s)
            ).map((c: any) => ({
                email: c.email,
                label: c.name || c.email,
                sub: c.company || '',
                id: c.email
            }));
        }
        return [];
    }, [audienceSource, leads, mailingLists, searchTerm, filterStatus, selectedMailingListId]);

    const uniqueStatuses = useMemo(() => {
        return ['All', ...new Set(leads.map(l => l.status).filter(Boolean))];
    }, [leads]);

    const toggleEmail = (email: string) => {
        const s = new Set(selectedEmails);
        s.has(email) ? s.delete(email) : s.add(email);
        setSelectedEmails(s);
    };

    const selectAll = () => {
        const emails = audienceRows.map(r => r.email);
        setSelectedEmails(prev => prev.size === emails.length ? new Set() : new Set(emails));
    };

    // AI Generation
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const iterCtx = isIterative ? `\nMODIFY the existing draft below. Preserve structure unless told otherwise.\nDRAFT:\n${htmlContent}` : '';
            const prompt = `You are an expert sales representative writing to prospects.
            Write a professional, high-converting outbound sales email template. Return ONLY raw HTML (no markdown code blocks). Inline all CSS. Use modern sans-serif fonts. Include a CTA button.
            ${iterCtx}
            
            USER PROMPT: ${aiPrompt}`;

            const fns = getFunctions();
            const callAI = httpsCallable(fns, 'callGeminiAI', { timeout: 300000 });
            const result: any = await callAI({
                prompt
            });
            let html = result.data.text.replace(/```html/g, '').replace(/```/g, '').trim();
            setHtmlContent(html);
            setEditorTab('preview');
        } catch (e) {
            showToast.warn('AI generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    // Dispatch One-off Broadcast Campaign
    const handleSendBroadcast = async () => {
        if (!currentUser) return;
        if (selectedEmails.size === 0) { showToast.warn('Select at least one recipient'); return; }
        if (!subject.trim() || !htmlContent.trim()) { showToast.warn('Subject and content required'); return; }
        setIsSending(true);
        try {
            const campaignId = `broadcast-${Date.now()}`;
            await db.collection('sales_campaigns').doc(campaignId).set(cleanUndefinedFields({
                id: campaignId,
                name: `Broadcast: ${subject.trim()}`,
                type: 'email',
                status: 'completed',
                audience: 'custom',
                subject: subject.trim(),
                content: htmlContent,
                stats: {
                    sent: selectedEmails.size,
                    opened: 0,
                    clicked: 0,
                    responded: 0
                },
                createdAt: new Date().toISOString(),
                repId: currentUser.id
            }));

            const batches = [];
            let currentBatch = db.batch();
            let count = 0;
            selectedEmails.forEach(email => {
                currentBatch.set(cleanUndefinedFields(db.collection('mail_queue')).doc(), {
                    to: [email],
                    message: { subject: subject.trim(), html: htmlContent, replyTo: currentUser.email || 'noreply@tektrakker.com' },
                    organizationId: 'platform',
                    type: 'PlatformSalesBroadcast',
                    campaignId: campaignId,
                    createdAt: new Date().toISOString()
                });
                count++;
                if (count === 400) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    count = 0;
                }
            });
            if (count > 0) batches.push(currentBatch);
            for (const b of batches) {
                await b.commit();
            }
            showToast.success(`Broadcast dispatched to ${selectedEmails.size} recipients!`);
            setSelectedEmails(new Set());
            setSubject('');
        } catch (e: any) {
            showToast.warn(e.message || 'Dispatch failed');
        } finally {
            setIsSending(false);
        }
    };

    // Drip Handlers
    const handleCreateCampaign = async () => {
        if (!currentUser) return;
        if (!newCampaign.name || !newCampaign.phases || newCampaign.phases.length === 0) {
            showToast.warn("Campaign name and at least one phase are required.");
            return;
        }
        setIsSubmitting(true);
        
        const campaign: Campaign = {
            id: `camp-${Date.now()}`,
            name: newCampaign.name,
            type: newCampaign.type as any,
            status: 'draft',
            audience: newCampaign.audience as any,
            phases: newCampaign.phases,
            templateId: newCampaign.templateId,
            stats: { sent: 0, opened: 0, clicked: 0, responded: 0 },
            createdAt: new Date().toISOString(),
            repId: currentUser.id
        };

        try {
            await db.collection('sales_campaigns').doc(campaign.id).set(cleanUndefinedFields(campaign));
            setIsCreateModalOpen(false);
            setNewCampaign({ 
                name: '', type: 'email', audience: 'new_leads', 
                phases: [{ id: `phase-1`, name: 'Initial Contact', subject: '', content: '', delayDays: 0 }] 
            });
            showToast.success("Campaign sequence created successfully!");
        } catch (e) {
            showToast.warn("Failed to save campaign.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAISmartWrite = async () => {
        if (!newCampaign.name) {
            showToast.warn("Please enter a campaign name first to give the AI context.");
            return;
        }
        setIsWriting(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const prompt = `Write a high-converting ${newCampaign.type} drip campaign sequence for a SaaS sales campaign titled "${newCampaign.name}". 
            Audience: ${newCampaign.audience}. Product: TekTrakker (Field Service Operations & AI). Tone: Professional, urgent, value-driven. 
            Create a comprehensive 3 to 4 step sequence.
            Return ONLY a valid JSON array of objects with this exact structure (no markdown tags):
            [
              { "name": "Phase 1 - Initial Contact", "subject": "Email Subject", "content": "Body content here. Use {{firstName}}.", "delayDays": 0 },
              { "name": "Phase 2 - Pain Point", "subject": "Email Subject", "content": "Body content here.", "delayDays": 3 }
            ]`;

            const result: any = await callGeminiAI({ prompt, modelName: 'gemini-3.6-flash' });

            let text = result.data.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const generatedPhases = JSON.parse(text);
            
            const formattedPhases = generatedPhases.map((p: any, i: number) => ({
                id: `phase-${Date.now()}-${i}`,
                name: p.name || `Phase ${i + 1}`,
                subject: p.subject || '',
                content: p.content || '',
                delayDays: p.delayDays || (i === 0 ? 0 : 3)
            }));

            setNewCampaign(prev => ({ ...prev, phases: formattedPhases }));
            showToast.success("AI generated a complete multi-step campaign sequence!");
        } catch (e) {
            console.error("AI Generation Error:", e);
            showToast.warn("AI sequence generation failed. The model might not have returned valid JSON.");
        } finally {
            setIsWriting(false);
        }
    };

    const toggleCampaignStatus = async (camp: Campaign) => {
        const nextStatus = camp.status === 'active' ? 'paused' : 'active';
        try {
            await db.collection('sales_campaigns').doc(camp.id).update(cleanUndefinedFields({ status: nextStatus }));
            showToast.success(`Sequence ${nextStatus === 'active' ? 'activated' : 'paused'}!`);
        } catch (e) {
            showToast.warn("Update failed.");
        }
    };

    const formatPercent = (val: number, total: number) => total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';

    const dripStats = useMemo(() => {
        return campaigns.reduce((acc, c) => ({
            sent: acc.sent + (c.stats?.sent || 0),
            clicked: acc.clicked + (c.stats?.clicked || 0),
            responded: acc.responded + (c.stats?.responded || 0)
        }), { sent: 0, clicked: 0, responded: 0 });
    }, [campaigns]);

    const updatePhase = (index: number, field: keyof CampaignPhase, value: any) => {
        const phases = [...(newCampaign.phases || [])];
        phases[index] = { ...phases[index], [field]: value };
        setNewCampaign(prev => ({ ...prev, phases }));
    };

    const addPhase = () => {
        const phases = [...(newCampaign.phases || [])];
        phases.push({ id: `phase-${Date.now()}`, name: `Phase ${phases.length + 1}`, subject: '', content: '', delayDays: 3 });
        setNewCampaign(prev => ({ ...prev, phases }));
    };

    const removePhase = (index: number) => {
        const phases = [...(newCampaign.phases || [])];
        phases.splice(index, 1);
        setNewCampaign(prev => ({ ...prev, phases }));
    };

    // Template Inline Library Load/Save
    const handleLoadTemplate = (t: any) => {
        setSubject(t.subject || t.name || '');
        setHtmlContent(t.content || '');
        setShowTemplatesModal(false);
        showToast.info('Template loaded');
    };

    const handleDeleteTemplate = async (id: string) => {
        if (await globalConfirm('Delete this template?')) {
            await db.collection('sales_templates').doc(id).delete();
            showToast.success('Template deleted');
        }
    };

    const handleSaveTemplateInline = async () => {
        if (!currentUser) return;
        if (!subject.trim() || !htmlContent.trim()) { showToast.warn('Need subject + content to save'); return; }
        const templateId = `temp-${Date.now()}`;
        await db.collection('sales_templates').doc(templateId).set(cleanUndefinedFields({
            id: templateId,
            name: subject.trim(),
            subject: subject.trim(),
            content: htmlContent,
            type: 'email',
            isHtml: true,
            lastModified: new Date().toISOString(),
            repId: currentUser.id
        }));
        showToast.success('Template saved to library!');
    };

    const viewTabs = [
        { id: 'compose' as const, label: 'Broadcast Studio', icon: Mail },
        { id: 'drip' as const, label: 'Drip Sequences', icon: Target },
        { id: 'lists' as const, label: 'Mailing Lists', icon: ListChecks },
        { id: 'templates' as const, label: 'Message Templates', icon: BookOpen },
        { id: 'analytics' as const, label: 'Outreach ROI', icon: BarChart2 },
    ];

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Campaign & Outreach Studio</h1>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                {viewTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === t.id ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Broadcast Studio Tab */}
            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left: Email/SMS Composer */}
                    <div className="xl:col-span-2 space-y-4">
                        {/* AI Box */}
                        <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-900 dark:to-indigo-900/20">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 rounded-xl hidden sm:block"><Sparkles size={20} /></div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-black text-slate-900 dark:text-white">AI Campaign Writer</h3>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={isIterative} onChange={e => setIsIterative(e.target.checked)} className="rounded border-slate-300 text-indigo-600 w-4 h-4" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Iterate Draft</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe what you'd like to write or change..."
                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                                        <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                                            {isGenerating ? <RefreshCw className="animate-spin" size={14} /> : 'Generate'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Subject line + WYSIWYG Editor */}
                        <Card className="p-0 overflow-hidden flex flex-col h-[500px] border-2 border-slate-200 dark:border-slate-700">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3 items-end">
                                <div className="flex-1">
                                    <div className="text-[10px] font-black uppercase text-slate-400">Outreach Subject</div>
                                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..."
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold" />
                                </div>
                                <div className="flex gap-1 pb-1">
                                    <button title="Template Library" onClick={() => setShowTemplatesModal(true)} className="px-3 py-1.5 text-xs font-bold rounded-lg text-emerald-600 hover:bg-emerald-50"><BookOpen size={14} /></button>
                                    <button title="Save as Template" onClick={handleSaveTemplateInline} className="px-3 py-1.5 text-xs font-bold rounded-lg text-amber-600 hover:bg-amber-50"><Save size={14} /></button>
                                    <button title="Edit HTML" onClick={() => setEditorTab('edit')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${editorTab === 'edit' ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}><Code size={14} /></button>
                                    <button title="Preview" onClick={() => setEditorTab('preview')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${editorTab === 'preview' ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}><Eye size={14} /></button>
                                </div>
                            </div>
                            <div className="flex-1 relative bg-white dark:bg-slate-900">
                                {editorTab === 'edit' ? (
                                    <ReactQuill theme="snow" value={htmlContent} onChange={setHtmlContent}
                                        className="absolute inset-0 flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto bg-white dark:bg-slate-900 border-none"
                                        placeholder="Write email contents..." />
                                ) : (
                                    <div className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-800 flex justify-center">
                                        <div className="bg-white shadow-xl max-w-2xl w-full h-fit rounded-lg text-slate-900">
                                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Right: Target Audience Panel */}
                    <div className="space-y-4">
                        <Card className="p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-700 h-full max-h-[620px] flex flex-col">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black flex items-center gap-2"><Filter className="text-primary-500" size={16} /> Audience</h3>
                                    <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 px-2 py-0.5 rounded-full text-xs font-black">{selectedEmails.size} selected</span>
                                </div>

                                <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-700 p-0.5 rounded-lg">
                                    <button onClick={() => { setAudienceSource('leads'); setSelectedEmails(new Set()); setSearchTerm(''); }}
                                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${audienceSource === 'leads' ? 'bg-white dark:bg-slate-600 text-primary-600 shadow-sm' : 'text-slate-500'}`}>
                                        <Users size={12} /> My Leads
                                    </button>
                                    <button onClick={() => { setAudienceSource('mailing_lists'); setSelectedEmails(new Set()); setSearchTerm(''); }}
                                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${audienceSource === 'mailing_lists' ? 'bg-white dark:bg-slate-600 text-primary-600 shadow-sm' : 'text-slate-500'}`}>
                                        <ListChecks size={12} /> My Lists
                                    </button>
                                </div>

                                {audienceSource === 'mailing_lists' && (
                                    <select value={selectedMailingListId} onChange={e => setSelectedMailingListId(e.target.value)} title="Select List"
                                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                        <option value="">Select a list...</option>
                                        {mailingLists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.contacts?.length || 0})</option>)}
                                    </select>
                                )}

                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                                </div>

                                {audienceSource === 'leads' && (
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="Filter Status"
                                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                        {uniqueStatuses.map(status => <option key={status} value={status}>{status === 'All' ? 'All Statuses' : status}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Audience List Roster */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                                        <tr>
                                            <th className="px-3 py-2 w-10 text-center">
                                                <input type="checkbox" checked={audienceRows.length > 0 && selectedEmails.size === audienceRows.length}
                                                    onChange={selectAll} className="rounded border-slate-300 text-primary-600 h-3.5 w-3.5 cursor-pointer" title="Select All" />
                                            </th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-400">Recipient</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {audienceRows.map(r => (
                                            <tr key={r.id} onClick={() => toggleEmail(r.email)}
                                                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedEmails.has(r.email) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
                                                <td className="px-3 py-2 text-center">
                                                    <input type="checkbox" checked={selectedEmails.has(r.email)} onChange={() => toggleEmail(r.email)}
                                                        className="rounded border-slate-300 text-primary-600 h-3.5 w-3.5 cursor-pointer" title={`Select ${r.label}`} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.label}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">{r.sub ? `${r.sub} • ` : ''}{r.email}</p>
                                                </td>
                                            </tr>
                                        ))}
                                        {audienceRows.length === 0 && (
                                            <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-500 text-sm">No recipients found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <Button onClick={handleSendBroadcast} disabled={isSending} className="w-full py-3 font-black bg-primary-600 hover:bg-primary-700 flex items-center justify-center gap-2">
                                    {isSending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                                    {isSending ? 'Sending...' : `Dispatch Broadcast (${selectedEmails.size})`}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Drip Sequences Tab */}
            {activeTab === 'drip' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Target size={18} className="text-red-500"/> Sequence Workflows</h3>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                                    <input className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg text-xs w-48" placeholder="Filter..." />
                                </div>
                            </div>
                            <Table headers={['Workflow Name', 'Audience', 'Status', 'CTR', 'Actions']}>
                                {campaigns.filter(c => c.phases && c.phases.length > 0).map(camp => (
                                    <tr key={camp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${camp.type === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                                    {camp.type === 'email' ? <Mail size={16}/> : <MessageSquare size={16}/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 dark:text-white">{camp.name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">{camp.phases?.length || 1} Phases • {camp.type} Sequence</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 capitalize text-xs font-bold text-slate-600">{camp.audience?.replace('_', ' ')}</td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${camp.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                {camp.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-black text-xs text-slate-500">{formatPercent(camp.stats?.clicked || 0, camp.stats?.sent || 0)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => toggleCampaignStatus(camp)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                                                    {camp.status === 'active' ? <Pause size={14}/> : <Play size={14}/>}
                                                </button>
                                                <button title="Delete Campaign" className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:text-red-600" onClick={async () => { if(await globalConfirm("Delete sequence?")) await db.collection('sales_campaigns').doc(camp.id).delete(); }}><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {campaigns.filter(c => c.phases && c.phases.length > 0).length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No drip sequences designed yet.</td></tr>
                                )}
                            </Table>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card className="bg-slate-900 text-white border-0 shadow-2xl">
                             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Outreach Stats</h3>
                             <div className="space-y-6">
                                 <div><p className="text-xs text-slate-400 uppercase">Total Sent</p><p className="text-4xl font-black">{dripStats.sent.toLocaleString()}</p></div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                     <div><p className="text-[10px] text-slate-500 uppercase">Avg CTR</p><p className="text-xl font-black text-emerald-400">{formatPercent(dripStats.clicked, dripStats.sent)}</p></div>
                                     <div><p className="text-[10px] text-slate-500 uppercase">Replied</p><p className="text-xl font-black text-blue-400">{dripStats.responded.toLocaleString()}</p></div>
                                 </div>
                             </div>
                        </Card>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="w-full shadow-xl bg-primary-600 hover:bg-primary-700 py-4 font-black uppercase text-xs">
                            <Plus size={16} className="mr-2"/> New Campaign Sequence
                        </Button>
                    </div>
                </div>
            )}

            {/* Mailing Lists Tab */}
            {activeTab === 'lists' && <MailingListManager />}

            {/* Message Templates Tab */}
            {activeTab === 'templates' && <TemplateDesigner />}

            {/* Outreach ROI Tab */}
            {activeTab === 'analytics' && <OutreachROI />}

            {/* Create Campaign Sequence Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Sales Workflow & Sequence" size="xl">
                <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Campaign Name" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} placeholder="e.g. Q1 Lead Growth Sequence" />
                        <Select label="Channel" value={newCampaign.type} onChange={e => setNewCampaign({...newCampaign, type: e.target.value as any})}>
                            <option value="email">Email Sequence</option>
                            <option value="sms">SMS Sequence</option>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Target Leads" value={newCampaign.audience} onChange={e => setNewCampaign({...newCampaign, audience: e.target.value as any})}>
                            <option value="new_leads">New Leads</option>
                            <option value="closed_lost">Closed Lost</option>
                        </Select>
                        <Input label="Schedule Start" type="datetime-local" />
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Drip Sequence Phases</h3>
                                <p className="text-xs text-slate-500">Define automated follow-up intervals and messages.</p>
                            </div>
                            <button onClick={handleAISmartWrite} disabled={isWriting} className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all">
                                {isWriting ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} 
                                {isWriting ? 'Generating Sequence...' : 'AI Generate Sequence'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {(newCampaign.phases || []).map((phase, index) => (
                                <div key={phase.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 relative group">
                                    <div className="absolute left-4 top-4 text-slate-400 cursor-grab">
                                        <GripVertical size={16} />
                                    </div>
                                    <div className="pl-8 space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <Input label="Phase Name" value={phase.name} onChange={e => updatePhase(index, 'name', e.target.value)} placeholder="e.g. Initial Contact" />
                                                <Input label="Delay (Days)" type="number" min={0} value={phase.delayDays} onChange={e => updatePhase(index, 'delayDays', parseInt(e.target.value) || 0)} placeholder="Days since last phase" />
                                            </div>
                                            <button onClick={() => removePhase(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove Phase">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <Input label="Subject Line" value={phase.subject} onChange={e => updatePhase(index, 'subject', e.target.value)} placeholder="Subject line..." />
                                            <div>
                                                <div className="text-xs font-black uppercase text-slate-400 mb-1 block">Message Content</div>
                                                <Textarea rows={4} value={phase.content} onChange={e => updatePhase(index, 'content', e.target.value)} placeholder="Hi {{firstName}}, ..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <Button variant="secondary" onClick={addPhase} className="w-full border-dashed border-2 py-4 text-slate-500 hover:text-primary-600 hover:border-primary-600 hover:bg-primary-50">
                            <Plus size={16} className="mr-2" /> Add Another Phase
                        </Button>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white dark:bg-slate-900 pb-2">
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCampaign} disabled={isSubmitting} className="bg-primary-600 font-black">Save & Launch Sequence</Button>
                    </div>
                </div>
            </Modal>

            {/* Template Library Modal */}
            {showTemplatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col p-0">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <h3 className="font-black text-lg flex items-center gap-2"><BookOpen className="text-emerald-500"/> Campaign Template Library</h3>
                            <button onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {savedTemplates.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 font-medium">No saved templates found. Design templates under the "Message Templates" tab.</div>
                            ) : (
                                savedTemplates.map(t => (
                                    <div key={t.id} className="p-4 border dark:border-slate-700 rounded-xl flex justify-between items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                                            {t.subject && <p className="text-xs text-slate-500">{t.subject}</p>}
                                            <p className="text-[10px] text-slate-400 capitalize">{t.type} • {t.isHtml ? 'HTML' : 'Plain Text'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleLoadTemplate(t)} className="px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-bold rounded-lg transition-colors">Load</button>
                                            <button onClick={() => handleDeleteTemplate(t.id)} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg transition-colors">Delete</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default CampaignManager;
