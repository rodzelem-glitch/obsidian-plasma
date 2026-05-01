
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Mail, MessageSquare, Phone, Lightbulb, Plus, Edit, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { MOCK_DEMO_RESOURCES } from '../../lib/mockDemoData';
import { globalConfirm } from "lib/globalConfirm";

// --- BROAD TEKTRAKKER CAPABILITIES FOR ALL TRADES ---
export const TEKTRAKKER_CAPABILITIES = `
TekTrakker Platform Capabilities (All Trades: HVAC, Plumbing, Electrical, Landscaping, General Contracting, Painting):
- Multi-Trade AI Diagnostics: Instant technical guidance for repairs in any trade, from refrigerant charging to surface prep.
- Smart Tech Assistant: Hands-free, voice-activated AI supervisor that assists technicians in the field with technical data and safety protocols.
- Automated Field Proposal Engine: Generates tiered (Good/Better/Best) repair options with real-time industry pricebooks for any service line.
- Modular Workflow System: Admin-defined multi-stage checklists (Site Setup, Diagnosis, Repair, Quality Control) that ensure compliance and consistency across every job.
- Full Operations Suite: Dynamic dispatch boards, workforce tracking, project management, and automated subcontractor 1099 tax forms.
- Financial Automation: Digital invoicing, integrated payment processing, and comprehensive ROI tracking for marketing and sales.
- Customer Experience: Branded booking widgets, automated SMS/Email updates, and a private customer portal for job history and signatures.
- Sales Command Center: High-velocity lead sequences, automated outreach campaigns, and real-time commission tracking for growth teams.
`;

export interface SalesResource {
    id: string;
    repId: string;
    type: 'email' | 'sms' | 'script' | 'idea';
    title: string;
    content: string;
    createdAt: string;
}

const SalesResources: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser, isDemoMode } = state;
    const [activeTab, setActiveTab] = useState<'email' | 'sms' | 'script' | 'idea'>('email');
    const [resources, setResources] = useState<SalesResource[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Partial<SalesResource>>({});

    // AI State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        
        if (isDemoMode) {
            setResources(MOCK_DEMO_RESOURCES as SalesResource[]);
            return;
        }

        const unsub = db.collection('salesResources')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as SalesResource));
                setResources(data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }, (error) => {
                console.error("Firestore error:", error);
            });
            
        return () => unsub();
    }, [currentUser, isDemoMode]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        if (isDemoMode) {
            alert("Changes cannot be saved in Demo Mode.");
            setIsModalOpen(false);
            return;
        }
        
        const resourceId = editingResource.id || `res-${Date.now()}`;
        const newResource: SalesResource = {
            id: resourceId,
            repId: currentUser.id,
            type: activeTab,
            title: editingResource.title || 'Untitled',
            content: editingResource.content || '',
            createdAt: editingResource.createdAt || new Date().toISOString()
        };

        try {
            if (editingResource.id) {
                await db.collection('salesResources').doc(resourceId).update(newResource);
            } else {
                await db.collection('salesResources').doc(resourceId).set(newResource);
            }
            setIsModalOpen(false);
            setEditingResource({});
        } catch (e) {
            console.error(e);
            alert("Failed to save resource.");
        }
    };

    const handleDelete = async (id: string) => {
        if (isDemoMode) {
            alert("Actions disabled in Demo Mode.");
            return;
        }
        if (!await globalConfirm("Delete this template?")) return;
        await db.collection('salesResources').doc(id).delete();
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const systemContext = `You are an elite SaaS sales strategist for TekTrakker.
            Knowledge Base of Platform Features:\n${TEKTRAKKER_CAPABILITIES}\n
            Goal: Write a compelling and high-converting ${activeTab} titled "${aiPrompt}". 
            Tailor the message using the multi-trade features listed above. Solve pain points for business owners in HVAC, Plumbing, Electrical, Painting, or General Trades.
            Focus on increasing technical efficiency and revenue.
Format response as plain text without markdown blocks.`;

            const result: any = await callGeminiAI({ 
                prompt: systemContext,
                modelName: 'gemini-2.5-pro'
            });

            const content = result.data.text;
            setEditingResource({
                title: aiPrompt,
                content: content
            });
            setIsAiModalOpen(false);
            setIsModalOpen(true);
            setAiPrompt('');
        } catch (e) {
            alert("AI generation failed.");
        } finally {
            setIsThinking(false);
        }
    };

    const filteredResources = resources.filter(r => r.type === activeTab);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sales Resources</h2>
                    <p className="text-slate-500">Industry-leading templates and AI-powered scripts for all trades.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAiModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 shadow-lg">
                        <Sparkles size={18}/> AI Script Assist
                    </Button>
                    <Button onClick={() => { setEditingResource({}); setIsModalOpen(true); }} variant="secondary" className="flex items-center gap-2">
                        <Plus size={18}/> Add New
                    </Button>
                </div>
            </header>

            <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full md:w-fit overflow-x-auto">
                {[
                    { id: 'email', label: 'Email Templates', icon: Mail },
                    { id: 'sms', label: 'SMS Pitches', icon: MessageSquare },
                    { id: 'script', label: 'Phone Scripts', icon: Phone },
                    { id: 'idea', label: 'Campaign Ideas', icon: Lightbulb }
                ].map((t) => (
                    <button 
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-md transition-all ${activeTab === t.id ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResources.map(res => (
                    <Card key={res.id} className="flex flex-col h-full hover:shadow-xl transition-all border-t-4 border-t-primary-500 group">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-black text-slate-800 dark:text-white">{res.title}</h3>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingResource(res); setIsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-primary-600"><Edit size={14}/></button>
                                <button onClick={() => handleDelete(res.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono overflow-auto max-h-60 border border-slate-100 dark:border-slate-800">
                            {res.content}
                        </div>
                        <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-end">
                             <Button variant="secondary" className="text-[10px] font-black uppercase tracking-widest h-8" onClick={() => { navigator.clipboard.writeText(res.content); alert("Copied!"); }}>Copy Script</Button>
                        </div>
                    </Card>
                ))}
                {filteredResources.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-slate-50 dark:bg-slate-900/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <Lightbulb size={40} className="mx-auto text-slate-300 mb-2"/>
                        <p className="text-slate-500 font-bold">No scripts in this category.</p>
                        <button onClick={() => setIsAiModalOpen(true)} className="text-primary-600 text-xs font-black uppercase mt-2 hover:underline">Generate one with AI</button>
                    </div>
                )}
            </div>

            {/* AI ASSIST MODAL */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Sales Script Generator">
                <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                         <p className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-2 mb-1"><Sparkles size={12}/> Platform Expert Enabled</p>
                         <p className="text-[10px] text-slate-500 leading-tight">The AI is now trained on the full TekTrakker multi-trade capability set to write high-converting scripts.</p>
                    </div>
                    <Input 
                        label="Campaign Theme / Goal" 
                        placeholder="e.g., Painting contractors about automated quoting"
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                    />
                    <Button onClick={handleAiGenerate} disabled={isThinking || !aiPrompt} className="w-full h-12 bg-indigo-600 shadow-indigo-500/30 font-black uppercase tracking-widest">
                        {isThinking ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                        Generate ${activeTab} content
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Edit ${activeTab.toUpperCase()} Template`}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Title / Subject" value={editingResource.title || ''} onChange={e => setEditingResource({...editingResource, title: e.target.value})} required />
                    <Textarea 
                        label="Content / Script" 
                        value={editingResource.content || ''} 
                        onChange={e => setEditingResource({...editingResource, content: e.target.value})} 
                        rows={10} 
                        required 
                        className="font-mono text-sm"
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">Cancel</Button>
                        <Button type="submit" className="font-black px-4 md:px-8">Save Template</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SalesResources;
