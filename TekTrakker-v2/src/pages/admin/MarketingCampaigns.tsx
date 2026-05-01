import { getBaseUrl } from "lib/utils";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from 'context/AppContext';
import { db, storage } from 'lib/firebase';
import type { Customer } from 'types';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Sparkles, Send, Megaphone, Code, Eye, RefreshCw, Layers, Upload, Image as ImageIcon, Search, Filter, Save, BookOpen, BarChart3, Activity, Share2, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-toastify';

const MarketingCampaigns: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
    const [subject, setSubject] = useState('');
    const [htmlContent, setHtmlContent] = useState('<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">\n  <h2>Spring Special!</h2>\n  <p>Write your message here...</p>\n</div>');
    const [isAiSuggesting, setIsAiSuggesting] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('Write an email announcing our new Spring AC Tune-up special for $99.');
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState('');
    const [error, setError] = useState('');

    // Phase 11 States
    const [isIterative, setIsIterative] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadedAssets, setUploadedAssets] = useState<string[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState('All');
    const [filterType, setFilterType] = useState('All');
    
    // Phase 12 States
    const [searchParams] = useSearchParams();
    const viewMode: 'editor' | 'analytics' = searchParams.get('tab') === 'analytics' ? 'analytics' : 'editor';
    const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
    const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadCustomers = async () => {
             if (!state.currentOrganization?.id) return;
             try {
                 const snap = await db.collection('customers')
                     .where('organizationId', '==', state.currentOrganization.id)
                     .get();
                     
                 const custs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
                 setCustomers(custs);
             } catch (err) {
                 console.error("Failed to load customers:", err);
             }
        };
        loadCustomers();
    }, [state.currentOrganization?.id]);

    useEffect(() => {
        if (!state.currentOrganization?.id) return;

        const unsubCampaigns = db.collection('marketingCampaigns')
            .where('organizationId', '==', state.currentOrganization.id)
            .orderBy('sentAt', 'desc')
            .onSnapshot(snap => {
                setCampaignHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        const unsubTemplates = db.collection('organizations')
            .doc(state.currentOrganization.id)
            .collection('marketingTemplates')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setSavedTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        return () => {
            unsubCampaigns();
            unsubTemplates();
        };
    }, [state.currentOrganization?.id]);

    // Data Filtering Memory
    const uniqueCities = useMemo(() => {
        const cities = new Set(customers.map(c => c.city).filter(c => c && c.trim() !== ''));
        return ['All', ...Array.from(cities).sort()];
    }, [customers]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.email?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCity = filterCity === 'All' || c.city === filterCity;
            const matchesType = filterType === 'All' || c.customerType === filterType;
            return matchesSearch && matchesCity && matchesType;
        });
    }, [customers, searchTerm, filterCity, filterType]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
             const allIds = new Set(filteredCustomers.map(c => c.id));
             setSelectedCustomerIds(allIds);
        } else {
             setSelectedCustomerIds(new Set());
        }
    };

    const handleSelectSingle = (id: string) => {
        const newSet = new Set(selectedCustomerIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCustomerIds(newSet);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization?.id) return;

        setUploadingImage(true);
        setError('');
        try {
            const storageRef = storage.ref(`marketing_assets/${state.currentOrganization.id}/${Date.now()}_${file.name}`);
            const snapshot = await storageRef.put(file);
            const downloadUrl = await snapshot.ref.getDownloadURL();
            setUploadedAssets(prev => [...prev, downloadUrl]);
        } catch (err: any) {
            console.error("Image Upload Failed:", err);
            setError("Failed to upload image. Please check your connection.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiSuggesting(true);
        setError('');
        
        try {
            const org = state.currentOrganization;
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });

            let absoluteLogoUrl = org?.logoUrl;
            if (absoluteLogoUrl && absoluteLogoUrl.startsWith('/')) {
                absoluteLogoUrl = `${getBaseUrl()}${absoluteLogoUrl}`;
            }

            const logoInstruction = absoluteLogoUrl 
                ? `CRITICAL LOGO INSTRUCTION:\nYou MUST insert the following exact HTML tag at the top of your email: <img src="{{COMPANY_LOGO_URL}}" alt="Company Logo" />\nUNDER NO CIRCUMSTANCES should you ever generate a real image string, or alter this exact string.`
                : `CRITICAL INSTRUCTION: Do NOT generate or use any fake image placeholders (like via.placeholder.com). If no logo is provided, rely entirely on CSS styling and typography.`;

            const iterationContext = isIterative 
                ? `\n\nCRITICAL DIRECTIVE - ITERATION MODE ACTIVE:
The user wants to explicitly MODIFY the following existing HTML draft. Do NOT write from scratch. Preserve the existing structural design, layout, and previous text unless the user directly asks to change them.
EXISTING HTML DRAFT:\n\`\`\`html\n${htmlContent}\n\`\`\``
                : '';

            const assetContext = uploadedAssets.length > 0 
                ? `\n\nUSER ASSET DIRECTIVE: The user has uploaded the following image URLs for use in this promotional email:\n${uploadedAssets.join('\n')}\nYou MUST embed these urls as <img src="..." /> tags into logical, prominent structural places within the HTML layout.`
                : '';

            const systemContext = `
                You are an expert Marketing Copywriter for ${org?.name || 'a home service company'}.
                Industry Context: ${org?.name || ''} provides professional home services.
                Contact: ${org?.phone || ''} | ${org?.email || ''}.
                Website: ${org?.website || ''}
                
                Write a highly-converting, professional marketing email based on the user's prompt.
                RETURN ONLY RAW HTML. Do NOT return markdown blocks (no \`\`\`html) around your final answer. 
                Make the HTML beautiful, inline-styled, responsive, and ready to be emailed. 
                Use modern, clean sans-serif fonts. Add a clear Call To Action HTML button.
                ${logoInstruction}
                ${assetContext}
                ${iterationContext}
            `;

            const fullPrompt = `${systemContext}\n\nUSER PROMPT: ${aiPrompt}`;

            const result = await callGeminiAI({ 
                prompt: fullPrompt
            });
            
            const data = result.data as { text: string };
            let cleanHtml = data.text;
            
            if (cleanHtml.includes('```html')) {
                cleanHtml = cleanHtml.replace(/```html/g, '').replace(/```/g, '').trim();
            }

            if (absoluteLogoUrl) {
                cleanHtml = cleanHtml.replace(/{{COMPANY_LOGO_URL}}/g, absoluteLogoUrl);
            }

            setHtmlContent(cleanHtml);
            setActiveTab('preview');
        } catch (err) {
            console.error(err);
            setError("AI Generation failed. Please try again.");
        } finally {
            setIsAiSuggesting(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!state.currentOrganization?.id || !subject.trim() || !htmlContent.trim()) return;
        try {
            await db.collection('organizations').doc(state.currentOrganization.id).collection('marketingTemplates').add({
                name: subject,
                subject,
                htmlContent,
                aiPrompt,
                createdAt: new Date().toISOString()
            });
            toast.success("Template successfully saved to Library!");
        } catch (err: any) {
            toast.error("Failed to save template.");
        }
    };

    const handleLoadTemplate = (t: any) => {
        setSubject(t.subject);
        setHtmlContent(t.htmlContent);
        setAiPrompt(t.aiPrompt || '');
        setShowTemplatesModal(false);
    };

    const handleDispatchCampaign = async () => {
        if (selectedCustomerIds.size === 0) {
            setError("You must select at least one customer to send the campaign to.");
            return;
        }
        if (!subject.trim() || !htmlContent.trim()) {
            setError("Subject and HTML content are required to dispatch a campaign.");
            return;
        }

        setIsSending(true);
        setError('');
        setSendSuccess('');

        try {
            const targetCustomers = customers.filter(c => selectedCustomerIds.has(c.id) && c.email);
            
            if (targetCustomers.length === 0) throw new Error("None of the selected customers have valid email addresses.");

            let deliveryHtml = htmlContent;

            // Enterprise Email Client Security Compliance (Gmail/Outlook strip data:image URIs)
            if (state.currentOrganization?.logoUrl) {
                if (state.currentOrganization.logoUrl.startsWith('data:image/')) {
                    try {
                        const base64Response = await fetch(state.currentOrganization.logoUrl);
                        const blob = await base64Response.blob();
                        const storageRef = storage.ref(`public_assets/${state.currentOrganization.id}/logo_stable_${Date.now()}.png`);
                        await storageRef.put(blob);
                        const publicLogoUrl = await storageRef.getDownloadURL();
                        
                        // Destroy the base64 string inside the payload
                        deliveryHtml = deliveryHtml.split(state.currentOrganization.logoUrl).join(publicLogoUrl);
                        
                        // Silently promote the public URL globally so future campaigns never hit this bottleneck
                        await db.collection('organizations').doc(state.currentOrganization.id).update({
                            logoUrl: publicLogoUrl
                        });
                    } catch(err) {
                        console.error("Base64 to URL migration failed:", err);
                    }
                } else if (state.currentOrganization.logoUrl.startsWith('/')) {
                    // Map local origins into absolute production URIs relative to the deployed server
                    const absoluteOriginUrl = `${getBaseUrl()}${state.currentOrganization.logoUrl}`;
                    deliveryHtml = deliveryHtml.split(state.currentOrganization.logoUrl).join(absoluteOriginUrl);
                }
            }

            const trackingPayload = {
                organizationId: state.currentOrganization?.id || 'unaffiliated',
                subject: subject.trim(),
                sentAt: new Date().toISOString(),
                recipientCount: targetCustomers.length,
                readCount: 0,
                openedBy: []
            };

            const campaignRef = await db.collection('marketingCampaigns').add(trackingPayload);
            const campaignId = campaignRef.id;

            const promises = targetCustomers.map(c => {
                 const trackingPixel = `\n<img src="https://us-central1-tektrakker.cloudfunctions.net/trackEmailOpen?campaignId=${campaignId}&customerId=${c.id}" width="1" height="1" style="display:none; visibility:hidden; width:1px; height:1px;" alt="" />`;
                 const personalizedHtml = deliveryHtml + trackingPixel;

                 return db.collection('mail_queue').add({
                    to: [c.email!.trim().toLowerCase()], 
                    message: {
                        subject: subject.trim(),
                        html: personalizedHtml,
                        replyTo: state.currentUser?.email || state.currentOrganization?.email || 'noreply@tektrakker.com'
                    },
                    organizationId: state.currentOrganization?.id || 'unaffiliated',
                    type: 'MarketingBlast',
                    campaignId: campaignId,
                    createdAt: new Date().toISOString()
                 });
            });

            await Promise.all(promises);
            
            toast.success(`Campaign successfully dispatched to ${targetCustomers.length} recipient(s)! Analytics telemetry is live.`);
            setSelectedCustomerIds(new Set());
            setSubject('');
        } catch (err: any) {
            console.error("Campaign Dispatch Error:", err);
            toast.error(err.message || "Failed to dispatch campaign to the mail queue.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6 relative">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/admin/marketing-hub')} title="Back to Marketing Hub" aria-label="Back to Marketing Hub" className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Megaphone className="text-primary-500" />
                        {viewMode === 'analytics' ? 'Campaign Analytics' : 'Campaign Studio'}
                    </h2>
                </div>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => navigate('/admin/campaigns')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'editor' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Code size={16}/> Studio
                    </button>
                    <button 
                        onClick={() => navigate('/admin/campaigns?tab=analytics')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'analytics' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChart3 size={16}/> Analytics
                    </button>
                </div>
            </header>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-200">{error}</div>}
            {sendSuccess && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-200">{sendSuccess}</div>}

            {viewMode === 'analytics' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6">
                            <h3 className="text-sm font-bold text-slate-500 mb-1">Total Campaigns Sent</h3>
                            <p className="text-4xl font-black text-slate-900 dark:text-white">{campaignHistory.length}</p>
                        </Card>
                        <Card className="p-6">
                            <h3 className="text-sm font-bold text-slate-500 mb-1">Total Messages Delivered</h3>
                            <p className="text-4xl font-black text-primary-600">{campaignHistory.reduce((acc, curr) => acc + (curr.recipientCount || 0), 0)}</p>
                        </Card>
                        <Card className="p-6">
                            <h3 className="text-sm font-bold text-slate-500 mb-1">Platform Open Rate</h3>
                            <p className="text-4xl font-black text-emerald-500 flex items-center gap-2">
                                {campaignHistory.length === 0 ? "0%" : `${Math.round((campaignHistory.reduce((acc, curr) => acc + (curr.readCount || 0), 0) / Math.max(1, campaignHistory.reduce((acc, curr) => acc + (curr.recipientCount || 0), 0))) * 100)}%`}
                                <Activity size={24}/>
                            </p>
                        </Card>
                    </div>

                    <Card className="p-0 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar w-full">
                            <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-slate-500">Date Dispatched</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-slate-500">Campaign Subject</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 text-center">Delivered</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 text-center">Unique Opens</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 text-right">Open Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {campaignHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">No campaigns have been dispatched yet.</td>
                                    </tr>
                                )}
                                {campaignHistory.map(c => {
                                    const openRate = c.recipientCount > 0 ? Math.round((c.readCount / c.recipientCount) * 100) : 0;
                                    return (
                                        <tr key={c.id}>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                                {new Date(c.sentAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium max-w-xs truncate">
                                                {c.subject}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white text-center">
                                                {c.recipientCount}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">
                                                {c.readCount}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white text-right">
                                                {openRate}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Editor & AI */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* AI Prompt Box */}
                        <Card className="p-6 border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-900 dark:to-indigo-900/20">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-xl hidden sm:block">
                                    <Sparkles size={24} />
                                </div>
                                <div className="flex-1 w-full space-y-4">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">GenAI Campaign Strategist</h3>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isIterative}
                                                    onChange={(e) => setIsIterative(e.target.checked)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                />
                                                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors uppercase tracking-wider">Iterative Editing Mode</span>
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Describe your promotion or command changes to the active draft.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input 
                                            type="text" 
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            placeholder={isIterative ? "e.g. Change the CTA button color to orange..." : "e.g. Write an email for a 15% off Winter Maintenance Special..."}
                                            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                                        />
                                        <Button 
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] py-3 text-sm"
                                            onClick={handleGenerateAI}
                                            disabled={isAiSuggesting}
                                        >
                                            {isAiSuggesting ? <RefreshCw className="animate-spin shrink-0" size={16}/> : 'Generate Draft'}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        {/* Asset Injection Bar */}
                                        <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 w-fit">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                ref={fileInputRef}
                                                onChange={handleImageUpload}
                                                title="Upload Image Asset"
                                            />
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingImage}
                                                title="Upload Image Asset"
                                                aria-label="Upload Image Asset"
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-50"
                                            >
                                                {uploadingImage ? <RefreshCw className="animate-spin" size={14}/> : <Upload size={14}/>}
                                                Upload Asset
                                            </button>
                                            
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                {uploadedAssets.map((url, i) => (
                                                    <div key={i} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-800 whitespace-nowrap">
                                                        <ImageIcon size={10} /> Asset_{i+1}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => setShowTemplatesModal(true)}
                                            title="Open Template Library"
                                            aria-label="Open Template Library"
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <BookOpen size={16} /> Template Library
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Email Subject & Editor */}
                        <Card className="p-0 overflow-hidden flex flex-col h-[600px] border-2 border-slate-200 dark:border-slate-700">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="flex items-center justify-between text-xs font-black uppercase text-slate-500 mb-1">
                                            <span>Email Subject Line</span>
                                            <button onClick={handleSaveTemplate} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Save size={12}/> Save as Template</button>
                                        </label>
                                        <input 
                                            type="text" 
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="e.g. Exclusive Offer Inside! 🎁"
                                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2 pb-1">
                                        <button 
                                            onClick={() => setActiveTab('edit')}
                                            title="Source Editor"
                                            aria-label="Source Editor"
                                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'edit' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            <Code size={16}/> Source Editor
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('preview')}
                                            title="Live Preview"
                                            aria-label="Live Preview"
                                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'preview' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            <Eye size={16}/> Live Preview
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 relative bg-white dark:bg-slate-900">
                                {activeTab === 'edit' ? (
                                    <ReactQuill 
                                        theme="snow"
                                        value={htmlContent}
                                        onChange={setHtmlContent}
                                        className="absolute inset-0 flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-editor]:p-6 [&>.ql-editor]:text-base bg-white dark:bg-slate-900 border-none"
                                        placeholder="Write your custom HTML here or use the GenAI Strategist above to scaffold a template..."
                                    />
                                ) : (
                                    <div 
                                        className="absolute inset-0 w-full h-full p-6 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-800 flex justify-center"
                                    >
                                        <div className="bg-white shadow-xl max-w-2xl w-full h-fit min-h-full rounded-lg text-slate-900 shrink-0">
                                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Audience Selection */}
                    <div className="space-y-6">
                        <Card className="p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-700 h-full max-h-[792px] flex flex-col">
                            
                            {/* Dynamic Targeting Filter Bar */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black text-lg flex items-center gap-2"><Filter className="text-primary-500"/> Audience Tools</h3>
                                    <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 px-3 py-1 rounded-full text-xs font-black">
                                        {selectedCustomerIds.size} Target(s)
                                    </span>
                                </div>
                                
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                    <input 
                                        type="text" 
                                        placeholder="Search names or emails..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <select 
                                        value={filterCity}
                                        onChange={(e) => setFilterCity(e.target.value)}
                                        className="px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                        title="Filter by City"
                                    >
                                        {uniqueCities.map(city => <option key={city} value={city}>{city === 'All' ? 'All Cities' : city}</option>)}
                                    </select>
                                    <select 
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="px-2 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                        title="Filter by Customer Type"
                                    >
                                        <option value="All">All Types</option>
                                        <option value="Residential">Residential</option>
                                        <option value="Commercial">Commercial</option>
                                    </select>
                                </div>
                                <div className="pt-2 text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">
                                    Filtering {filteredCustomers.length} of {customers.length} Customers
                                </div>
                            </div>

                            {/* Roster Table */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-12 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                                                    checked={filteredCustomers.length > 0 && selectedCustomerIds.size === filteredCustomers.length}
                                                    onChange={handleSelectAll}
                                                    title="Select All Customers"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">Customer Name</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredCustomers.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} className="p-8 text-center text-slate-500 border-b border-transparent">
                                                    <Layers size={32} className="mx-auto mb-2 opacity-30"/>
                                                    <span className="text-sm font-bold">No customers match filters.</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCustomers.map(customer => (
                                                <tr 
                                                    key={customer.id} 
                                                    className={`transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedCustomerIds.has(customer.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
                                                    onClick={() => handleSelectSingle(customer.id)}
                                                >
                                                    <td className="px-4 py-3 text-center border-b border-transparent">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                                                            checked={selectedCustomerIds.has(customer.id)}
                                                            onChange={(e) => { e.stopPropagation(); handleSelectSingle(customer.id); }}
                                                            title={`Select ${customer.name || 'Customer'}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 border-b border-transparent">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {customer.name}
                                                            {customer.customerType === 'Commercial' && <span className="px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-700 text-[9px] uppercase tracking-wider">COM</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                                                            {customer.city ? `${customer.city} • ` : ''}{customer.email || 'No Email'}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Dispatch Button Anchor */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <Button 
                                    className="w-full text-base py-4 font-black bg-primary-600 hover:bg-primary-700 text-white flex justify-center items-center gap-2"
                                    disabled={isSending}
                                    onClick={handleDispatchCampaign}
                                >
                                    {isSending ? <RefreshCw className="animate-spin" size={20}/> : <Send size={20}/>}
                                    {isSending ? 'Transmitting...' : `Dispatch Campaign (${selectedCustomerIds.size})`}
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
                            <button onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {savedTemplates.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 font-medium">No saved templates found. Generate a draft and click "Save as Template".</div>
                            ) : (
                                savedTemplates.map(t => (
                                    <div key={t.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 transition-colors flex justify-between items-center">
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-base">{t.name}</h4>
                                            <p className="text-sm text-slate-500 font-medium">Saved on: {new Date(t.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <Button className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold" onClick={() => handleLoadTemplate(t)}>
                                            Load Template
                                        </Button>
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

export default MarketingCampaigns;
