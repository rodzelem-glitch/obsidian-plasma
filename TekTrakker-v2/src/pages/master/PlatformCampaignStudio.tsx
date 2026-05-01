import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, storage } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import MailingListManager from './components/MailingListManager';
import type { MailingList, MailingListContact } from './components/MailingListManager';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getBaseUrl } from 'lib/utils';
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-toastify';
import {
    Sparkles, Send, Code, Eye, RefreshCw, Search, Filter,
    Users, Building2, Mail, ListChecks, ChevronDown, Upload, Image as ImageIcon, BookOpen, Save
} from 'lucide-react';

type AudienceSource = 'organizations' | 'org_customers' | 'mailing_lists';

interface OrgRecord { id: string; name: string; email: string; logoUrl?: string; industry?: string; plan?: string; address?: any; }
interface CustomerRecord { id: string; name: string; email: string; organizationId: string; city?: string; state?: string; customerType?: string; }

const PlatformCampaignStudio: React.FC = () => {
    const { state } = useAppContext();

    // Data
    const [orgs, setOrgs] = useState<OrgRecord[]>([]);
    const [customers, setCustomers] = useState<CustomerRecord[]>([]);
    const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // UI state
    const [activeView, setActiveView] = useState<'compose' | 'lists' | 'history'>('compose');
    const [audienceSource, setAudienceSource] = useState<AudienceSource>('organizations');
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterState, setFilterState] = useState('All');
    const [filterIndustry, setFilterIndustry] = useState('All');
    const [selectedMailingListId, setSelectedMailingListId] = useState('');

    // Email composer
    const [subject, setSubject] = useState('');
    const [htmlContent, setHtmlContent] = useState('<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px"><h2>Your message here</h2></div>');
    const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isIterative, setIsIterative] = useState(false);

    // History
    const [campaignHistory, setCampaignHistory] = useState<any[]>([]);

    // Template Library
    const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    // Branding source for AI
    const [brandingOrgId, setBrandingOrgId] = useState('platform');

    // Load all platform data
    useEffect(() => {
        const unsubOrgs = db.collection('organizations').onSnapshot(snap => {
            setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrgRecord)));
        });
        const unsubCustomers = db.collection('customers').onSnapshot(snap => {
            setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerRecord)));
        });
        const unsubLists = db.collection('platform_mailing_lists').onSnapshot(snap => {
            setMailingLists(snap.docs.map(d => ({ id: d.id, ...d.data() } as MailingList)));
        });
        const unsubHistory = db.collection('marketingCampaigns')
            .where('organizationId', '==', 'platform')
            .orderBy('sentAt', 'desc')
            .onSnapshot(snap => {
                setCampaignHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }, () => setCampaignHistory([]));
        const unsubTemplates = db.collection('platform_campaign_templates').orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setSavedTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }, () => setSavedTemplates([]));

        setIsLoadingData(false);
        return () => { unsubOrgs(); unsubCustomers(); unsubLists(); unsubHistory(); unsubTemplates(); };
    }, []);

    // Compute audience rows based on source
    const audienceRows = useMemo(() => {
        if (audienceSource === 'organizations') {
            return orgs.filter(o => {
                const matchSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.email?.toLowerCase().includes(searchTerm.toLowerCase());
                const matchIndustry = filterIndustry === 'All' || o.industry === filterIndustry;
                return matchSearch && matchIndustry && o.email;
            }).map(o => ({ email: o.email, label: o.name, sub: o.industry || o.plan || '', id: o.id }));
        }
        if (audienceSource === 'org_customers') {
            return customers.filter(c => {
                const matchSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase());
                const matchState = filterState === 'All' || c.state === filterState;
                return matchSearch && matchState && c.email;
            }).map(c => ({ email: c.email, label: c.name, sub: [c.city, c.state].filter(Boolean).join(', '), id: c.id }));
        }
        if (audienceSource === 'mailing_lists' && selectedMailingListId) {
            const list = mailingLists.find(l => l.id === selectedMailingListId);
            return (list?.contacts || []).filter(c =>
                c.email.includes(searchTerm.toLowerCase()) || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            ).map(c => ({ email: c.email, label: c.name || c.email, sub: c.company || '', id: c.email }));
        }
        return [];
    }, [audienceSource, orgs, customers, mailingLists, searchTerm, filterState, filterIndustry, selectedMailingListId]);

    const uniqueIndustries = useMemo(() => ['All', ...new Set(orgs.map(o => o.industry).filter(Boolean) as string[])], [orgs]);
    const uniqueStates = useMemo(() => ['All', ...new Set(customers.map(c => c.state).filter(Boolean) as string[])], [customers]);

    const toggleEmail = (email: string) => {
        const s = new Set(selectedEmails);
        s.has(email) ? s.delete(email) : s.add(email);
        setSelectedEmails(s);
    };

    const selectAll = () => {
        const emails = audienceRows.map(r => r.email);
        setSelectedEmails(prev => prev.size === emails.length ? new Set() : new Set(emails));
    };

    // AI generation with branding context
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const brandOrg = brandingOrgId !== 'platform' ? orgs.find(o => o.id === brandingOrgId) : null;
            const logoUrl = brandOrg?.logoUrl || '';
            const orgName = brandOrg?.name || 'TekTrakker Platform';

            const logoInstruction = logoUrl && !logoUrl.startsWith('data:')
                ? `Use this EXACT logo URL in an <img> tag at the top: ${logoUrl}`
                : logoUrl && logoUrl.startsWith('data:')
                    ? `A logo exists but is stored as base64. Do NOT embed base64 data. Use CSS-styled text header instead for: "${orgName}".`
                    : `No logo available. Use clean CSS-styled text header for: "${orgName}".`;

            const iterCtx = isIterative ? `\nMODIFY the existing draft below. Preserve structure unless told otherwise.\nDRAFT:\n${htmlContent}` : '';

            const prompt = `You are an expert email marketer for ${orgName}.
${logoInstruction}
${brandOrg?.address ? `Address: ${brandOrg.address.street}, ${brandOrg.address.city}, ${brandOrg.address.state} ${brandOrg.address.zip}` : ''}
Write a professional, high-converting email. Return ONLY raw HTML (no markdown code blocks). Inline all CSS. Use modern sans-serif fonts. Include a CTA button.
${iterCtx}

USER PROMPT: ${aiPrompt}`;

            const fns = getFunctions();
            const callAI = httpsCallable(fns, 'callGeminiAI', { timeout: 300000 });
            const result: any = await callAI({
                prompt,
                contextOrgId: brandingOrgId !== 'platform' ? brandingOrgId : undefined
            });
            let html = result.data.text.replace(/```html/g, '').replace(/```/g, '').trim();
            setHtmlContent(html);
            setEditorTab('preview');
        } catch (e) {
            toast.error('AI generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    // Dispatch campaign
    const handleSend = async () => {
        if (selectedEmails.size === 0) { toast.error('Select at least one recipient'); return; }
        if (!subject.trim() || !htmlContent.trim()) { toast.error('Subject and content required'); return; }
        setIsSending(true);
        try {
            const campaignRef = await db.collection('marketingCampaigns').add({
                organizationId: 'platform',
                subject: subject.trim(),
                sentAt: new Date().toISOString(),
                recipientCount: selectedEmails.size,
                readCount: 0,
                audienceSource,
                sentBy: state.currentUser?.email || 'master_admin'
            });

            const batch: Promise<any>[] = [];
            selectedEmails.forEach(email => {
                batch.push(db.collection('mail_queue').add({
                    to: [email],
                    message: { subject: subject.trim(), html: htmlContent, replyTo: state.currentUser?.email || 'noreply@tektrakker.com' },
                    organizationId: 'platform',
                    type: 'PlatformCampaign',
                    campaignId: campaignRef.id,
                    createdAt: new Date().toISOString()
                }));
            });
            await Promise.all(batch);
            toast.success(`Campaign dispatched to ${selectedEmails.size} recipients!`);
            setSelectedEmails(new Set());
        } catch (e: any) {
            toast.error(e.message || 'Dispatch failed');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!subject.trim() || !htmlContent.trim()) { toast.warn('Need subject + content to save'); return; }
        await db.collection('platform_campaign_templates').add({
            name: subject.trim(),
            subject: subject.trim(),
            htmlContent,
            aiPrompt,
            brandingOrgId,
            createdAt: new Date().toISOString()
        });
        toast.success('Template saved to library!');
    };

    const handleLoadTemplate = (t: any) => {
        setSubject(t.subject || '');
        setHtmlContent(t.htmlContent || '');
        setAiPrompt(t.aiPrompt || '');
        if (t.brandingOrgId) setBrandingOrgId(t.brandingOrgId);
        setShowTemplatesModal(false);
        toast.info('Template loaded');
    };

    const handleDeleteTemplate = async (id: string) => {
        await db.collection('platform_campaign_templates').doc(id).delete();
        toast.success('Template deleted');
    };

    const viewTabs = [
        { id: 'compose' as const, label: 'Campaign Studio', icon: Mail },
        { id: 'lists' as const, label: 'Mailing Lists', icon: ListChecks },
        { id: 'history' as const, label: 'History', icon: Send },
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* View Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                {viewTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveView(t.id)}
                        className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeView === t.id ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            {activeView === 'lists' && <MailingListManager />}

            {activeView === 'history' && (
                <Card>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Platform Campaign History</h3>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">Date</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">Subject</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 text-center">Sent</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 text-center">Opens</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {campaignHistory.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No campaigns yet.</td></tr>}
                                {campaignHistory.map(c => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-3 text-sm font-bold">{new Date(c.sentAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-xs">{c.subject}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-center">{c.recipientCount}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-center">{c.readCount || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeView === 'compose' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left: Editor */}
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
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Iterate</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <select value={brandingOrgId} onChange={e => setBrandingOrgId(e.target.value)} title="Branding Source"
                                            className="px-2 py-2 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 max-w-[180px]">
                                            <option value="platform">TekTrakker Platform</option>
                                            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                        </select>
                                        <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe your email..."
                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                                        <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                                            {isGenerating ? <RefreshCw className="animate-spin" size={14} /> : 'Generate'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Subject + Editor */}
                        <Card className="p-0 overflow-hidden flex flex-col h-[500px] border-2 border-slate-200 dark:border-slate-700">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Subject</label>
                                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line..."
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 font-bold" />
                                </div>
                                <div className="flex gap-1 pb-1">
                                    <button title="Template Library" onClick={() => setShowTemplatesModal(true)} className={`px-3 py-1.5 text-xs font-bold rounded-lg text-emerald-600 hover:bg-emerald-50`}><BookOpen size={14} /></button>
                                    <button title="Save as Template" onClick={handleSaveTemplate} className={`px-3 py-1.5 text-xs font-bold rounded-lg text-amber-600 hover:bg-amber-50`}><Save size={14} /></button>
                                    <button title="Edit HTML" onClick={() => setEditorTab('edit')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${editorTab === 'edit' ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}><Code size={14} /></button>
                                    <button title="Preview" onClick={() => setEditorTab('preview')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${editorTab === 'preview' ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}><Eye size={14} /></button>
                                </div>
                            </div>
                            <div className="flex-1 relative bg-white dark:bg-slate-900">
                                {editorTab === 'edit' ? (
                                    <ReactQuill theme="snow" value={htmlContent} onChange={setHtmlContent}
                                        className="absolute inset-0 flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto bg-white dark:bg-slate-900 border-none"
                                        placeholder="Write your email HTML..." />
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

                    {/* Right: Audience */}
                    <div className="space-y-4">
                        <Card className="p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-700 h-full max-h-[680px] flex flex-col">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black flex items-center gap-2"><Filter className="text-primary-500" size={16} /> Audience</h3>
                                    <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 px-2 py-0.5 rounded-full text-xs font-black">{selectedEmails.size} selected</span>
                                </div>

                                {/* Source tabs */}
                                <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-700 p-0.5 rounded-lg">
                                    {([
                                        { id: 'organizations' as const, icon: Building2, label: 'Orgs' },
                                        { id: 'org_customers' as const, icon: Users, label: 'Customers' },
                                        { id: 'mailing_lists' as const, icon: ListChecks, label: 'Lists' },
                                    ]).map(s => (
                                        <button key={s.id} onClick={() => { setAudienceSource(s.id); setSelectedEmails(new Set()); setSearchTerm(''); }}
                                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${audienceSource === s.id ? 'bg-white dark:bg-slate-600 text-primary-600 shadow-sm' : 'text-slate-500'}`}>
                                            <s.icon size={12} /> {s.label}
                                        </button>
                                    ))}
                                </div>

                                {audienceSource === 'mailing_lists' && (
                                    <select value={selectedMailingListId} onChange={e => setSelectedMailingListId(e.target.value)} title="Select Mailing List"
                                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800">
                                        <option value="">Select a list...</option>
                                        {mailingLists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.contacts.length})</option>)}
                                    </select>
                                )}

                                {/* Filters */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
                                </div>

                                {audienceSource === 'organizations' && (
                                    <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} title="Filter by Industry"
                                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800">
                                        {uniqueIndustries.map(i => <option key={i} value={i}>{i === 'All' ? 'All Industries' : i}</option>)}
                                    </select>
                                )}
                                {audienceSource === 'org_customers' && (
                                    <select value={filterState} onChange={e => setFilterState(e.target.value)} title="Filter by State"
                                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800">
                                        {uniqueStates.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
                                    </select>
                                )}
                                <p className="text-[10px] font-bold text-slate-400 text-center">{audienceRows.length} recipients available</p>
                            </div>

                            {/* Roster */}
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
                                            <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-500 text-sm">No recipients match filters</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <Button onClick={handleSend} disabled={isSending} className="w-full py-3 font-black bg-primary-600 hover:bg-primary-700 flex items-center justify-center gap-2">
                                    {isSending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                                    {isSending ? 'Sending...' : `Dispatch (${selectedEmails.size})`}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Template Library Modal */}
            {showTemplatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col p-0">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <h3 className="font-black text-lg flex items-center gap-2"><BookOpen className="text-emerald-500"/> Campaign Template Library</h3>
                            <button title="Close" onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {savedTemplates.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 font-medium">No saved templates yet. Create a campaign and click the save icon.</div>
                            ) : (
                                savedTemplates.map(t => (
                                    <div key={t.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 transition-colors flex justify-between items-center">
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white">{t.name}</h4>
                                            <p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs" onClick={() => handleLoadTemplate(t)}>Load</Button>
                                            <button title="Delete template" onClick={() => handleDeleteTemplate(t.id)} className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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

export default PlatformCampaignStudio;
