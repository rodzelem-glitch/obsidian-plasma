
import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Play, Pause, Trash2, Plus, Search, Target, Clock, BarChart3, TrendingUp, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { globalConfirm } from "lib/globalConfirm";

interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'multi';
    status: 'draft' | 'active' | 'paused' | 'completed';
    audience: 'all_leads' | 'new_leads' | 'closed_lost' | 'custom';
    templateId?: string;
    subject?: string;
    content: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
        responded: number;
    };
    createdAt: string;
    scheduledFor?: string;
}

const CampaignManager: React.FC = () => {
    const { state } = useAppContext();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'templates' | 'analytics'>('campaigns');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // AI Write State
    const [isWriting, setIsWriting] = useState(false);

    // Form State
    const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
        name: '',
        type: 'email',
        audience: 'new_leads',
        content: '',
        status: 'draft'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const unsub = db.collection('sales_campaigns').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
            setCampaigns(data);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const handleCreateCampaign = async () => {
        if (!newCampaign.name || !newCampaign.content) return;
        setIsSubmitting(true);
        
        const campaign: Campaign = {
            id: `camp-${Date.now()}`,
            name: newCampaign.name,
            type: newCampaign.type as any,
            status: 'draft',
            audience: newCampaign.audience as any,
            content: newCampaign.content,
            templateId: newCampaign.templateId,
            subject: newCampaign.subject,
            stats: { sent: 0, opened: 0, clicked: 0, responded: 0 },
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('sales_campaigns').doc(campaign.id).set(campaign);
            setIsCreateModalOpen(false);
            setNewCampaign({ name: '', type: 'email', audience: 'new_leads', content: '' });
        } catch (e) {
            alert("Failed to save campaign.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAISmartWrite = async () => {
        if (!newCampaign.name) {
            alert("Please enter a campaign name first to give the AI context.");
            return;
        }
        setIsWriting(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const prompt = `Write a high-converting ${newCampaign.type} for a SaaS sales campaign titled "${newCampaign.name}". 
            Audience: ${newCampaign.audience}. 
            Product: TekTrakker (Field Service Operations & AI).
            Tone: Professional, urgent, value-driven. 
            Include placeholders like {{firstName}} and {{companyName}}.`;

            const result: any = await callGeminiAI({ 
                prompt,
                modelName: 'gemini-3-pro-preview'
            });

            setNewCampaign(prev => ({ ...prev, content: result.data.text }));
        } catch (e) {
            alert("AI writing failed.");
        } finally {
            setIsWriting(false);
        }
    };

    const toggleCampaignStatus = async (camp: Campaign) => {
        const nextStatus = camp.status === 'active' ? 'paused' : 'active';
        try {
            await db.collection('sales_campaigns').doc(camp.id).update({ status: nextStatus });
        } catch (e) {
            alert("Update failed.");
        }
    };

    const formatPercent = (val: number, total: number) => total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';

    const totalStats = campaigns.reduce((acc, c) => ({
        sent: acc.sent + (c.stats.sent || 0),
        clicked: acc.clicked + (c.stats.clicked || 0),
        responded: acc.responded + (c.stats.responded || 0)
    }), { sent: 0, clicked: 0, responded: 0 });

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Campaign Command Center</h2>
                    <p className="text-slate-600 dark:text-slate-400 font-medium text-sm flex items-center gap-2">
                        <Sparkles size={14} className="text-primary-600"/> High-velocity sales automation for platform growth.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsCreateModalOpen(true)} className="w-auto shadow-xl bg-primary-600 hover:bg-primary-700 px-6 font-black uppercase text-xs">
                        <Plus size={16} className="mr-2"/> New Campaign
                    </Button>
                </div>
            </header>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button onClick={() => setActiveTab('campaigns')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'campaigns' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Campaigns</button>
                <button onClick={() => setActiveTab('templates')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Templates</button>
                <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Outreach ROI</button>
            </div>

            {activeTab === 'campaigns' && (
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
                                {campaigns.map(camp => (
                                    <tr key={camp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${camp.type === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                                    {camp.type === 'email' ? <Mail size={16}/> : <MessageSquare size={16}/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 dark:text-white">{camp.name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">{camp.type} Sequence</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 capitalize text-xs font-bold text-slate-600">{camp.audience.replace('_', ' ')}</td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${camp.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                {camp.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-black text-xs text-slate-500">{formatPercent(camp.stats.clicked, camp.stats.sent)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => toggleCampaignStatus(camp)} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200">
                                                    {camp.status === 'active' ? <Pause size={14}/> : <Play size={14}/>}
                                                </button>
                                                <button className="p-1.5 bg-slate-100 rounded hover:text-red-600" onClick={async () => { if(await globalConfirm("Delete?")) await db.collection('sales_campaigns').doc(camp.id).delete(); }}><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card className="bg-slate-900 text-white border-0 shadow-2xl">
                             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Outreach Stats</h3>
                             <div className="space-y-6">
                                 <div><p className="text-xs text-slate-400 uppercase">Total Sent</p><p className="text-4xl font-black">{totalStats.sent.toLocaleString()}</p></div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                     <div><p className="text-[10px] text-slate-500 uppercase">Avg CTR</p><p className="text-xl font-black text-emerald-400">{formatPercent(totalStats.clicked, totalStats.sent)}</p></div>
                                     <div><p className="text-[10px] text-slate-500 uppercase">Replied</p><p className="text-xl font-black text-blue-400">{totalStats.responded.toLocaleString()}</p></div>
                                 </div>
                             </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'templates' && <TemplateDesigner />}
            {activeTab === 'analytics' && <OutreachROI />}

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Sales Workflow" size="lg">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Campaign Name" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} placeholder="Q1 Growth" />
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
                        <Input label="Schedule" type="datetime-local" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black uppercase text-slate-400">Message Content</label>
                            <button onClick={handleAISmartWrite} disabled={isWriting} className="text-[10px] font-black text-primary-600 uppercase flex items-center gap-1">
                                {isWriting ? <Loader2 className="animate-spin" size={10}/> : <Sparkles size={10}/>} 
                                AI Smart Write
                            </button>
                        </div>
                        <Textarea rows={8} value={newCampaign.content} onChange={e => setNewCampaign({...newCampaign, content: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCampaign} disabled={isSubmitting} className="bg-primary-600 font-black">Launch Campaign</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CampaignManager;
