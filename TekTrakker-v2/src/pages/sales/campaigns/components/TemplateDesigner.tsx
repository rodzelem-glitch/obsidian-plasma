import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Plus, Search, Trash2, Edit3, Sparkles, Loader2, Code, FileText, ImageIcon } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Table from '../../../../components/ui/Table';
import Modal from '../../../../components/ui/Modal';
import Textarea from '../../../../components/ui/Textarea';
import Select from '../../../../components/ui/Select';
import { db } from '../../../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { TEKTRAKKER_CAPABILITIES } from '../../SalesResources';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';

export interface Template {
    id: string;
    name: string;
    type: 'email' | 'sms';
    subject?: string;
    content: string;
    lastModified: string;
    isHtml?: boolean;
}

const TemplateDesigner: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    // AI State
    const [isWriting, setIsWriting] = useState(false);

    useEffect(() => {
        const unsub = db.collection('sales_templates').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Template));
            setTemplates(data);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSaveTemplate = async () => {
        if (!editingTemplate?.name || !editingTemplate?.content) return;
        
        const id = editingTemplate.id || `temp-${Date.now()}`;
        const template: Template = {
            id,
            name: editingTemplate.name,
            type: (editingTemplate.type || 'email') as 'email' | 'sms',
            subject: editingTemplate.subject || '',
            content: editingTemplate.content,
            isHtml: editingTemplate.isHtml || false,
            lastModified: new Date().toISOString()
        };

        try {
            await db.collection('sales_templates').doc(id).set(template);
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch (e) {
            showToast.warn("Failed to save template.");
        }
    };

    const handleAISmartWrite = async () => {
        if (!editingTemplate?.name) {
            showToast.warn("Please enter a template name for context.");
            return;
        }
        setIsWriting(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const systemContext = `You are a high-performance sales copywriter for TekTrakker.
            Product Capabilities (All Trades):\n${TEKTRAKKER_CAPABILITIES}\n
            Goal: Write a compelling ${editingTemplate.type} template titled "${editingTemplate.name}". 
            Format: ${editingTemplate.isHtml ? 'Well-formatted HTML' : 'Plain Text'}.
            Requirements: Use placeholders like {{firstName}}, {{companyName}}, and {{city}}. Focus on how TekTrakker's multi-trade AI tools increase profit.
            Output ONLY the message content.`;

            const result: any = await callGeminiAI({ 
                prompt: systemContext,
                modelName: 'gemini-3.1-pro-preview'
            });

            setEditingTemplate(prev => ({ ...prev, content: result.data.text }));
        } catch (e) {
            showToast.warn("AI writing failed.");
        } finally {
            setIsWriting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await globalConfirm("Delete template?")) return;
        await db.collection('sales_templates').doc(id).delete();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Message Templates</h3>
                <Button onClick={() => { setEditingTemplate({ type: 'email', isHtml: true }); setIsModalOpen(true); }} className="text-xs font-black uppercase">
                    <Plus size={16} className="mr-2"/> Create Template
                </Button>
            </div>

            <Card>
                {isLoading ? (
                    <div className="p-4 md:p-10 text-center text-gray-400">Loading templates...</div>
                ) : (
                    <Table headers={['Template Name', 'Type', 'Format', 'Last Modified', 'Actions']}>
                        {templates.map(temp => (
                            <tr key={temp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold">{temp.name}</p>
                                    {temp.subject && <p className="text-[10px] text-gray-500 truncate max-w-xs">{temp.subject}</p>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {temp.type === 'email' ? <Mail size={14} className="text-blue-500"/> : <MessageSquare size={14} className="text-green-500"/>}
                                        <span className="text-xs font-bold uppercase">{temp.type}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${temp.isHtml ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 text-slate-500'}`}>
                                        {temp.isHtml ? 'HTML' : 'Plain Text'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">
                                    {new Date(temp.lastModified).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button title="Edit Template" onClick={() => { setEditingTemplate(temp); setIsModalOpen(true); setViewMode('edit'); }} className="p-1.5 hover:bg-slate-100 rounded text-gray-500"><Edit3 size={14}/></button>
                                        <button title="Delete Template" onClick={() => handleDelete(temp.id)} className="p-1.5 hover:bg-slate-100 rounded text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </Table>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTemplate?.id ? "Edit Template" : "Design New Template"} size="xl">
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-xl">
                        <div className="flex gap-2">
                            <button onClick={() => setViewMode('edit')} className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${viewMode === 'edit' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500'}`}>Editor</button>
                            <button onClick={() => setViewMode('preview')} className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500'}`}>Preview</button>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={editingTemplate?.isHtml} onChange={e => setEditingTemplate({...editingTemplate, isHtml: e.target.checked})} className="rounded text-primary-600" />
                                <span className="text-[10px] font-black uppercase text-slate-500">Enable HTML</span>
                            </label>
                        </div>
                    </div>

                    {viewMode === 'edit' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Template Name" value={editingTemplate?.name || ''} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} placeholder="e.g. Initial Outreach" />
                                <Select label="Type" value={editingTemplate?.type || 'email'} onChange={e => setEditingTemplate({...editingTemplate, type: e.target.value as any})}>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                </Select>
                            </div>

                            {editingTemplate?.type === 'email' && (
                                <Input label="Subject Line" value={editingTemplate?.subject || ''} onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} placeholder="Hello {{firstName}}..." />
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black uppercase text-slate-400">Content</label>
                                    <button onClick={handleAISmartWrite} disabled={isWriting} className="text-[10px] font-black text-primary-600 uppercase flex items-center gap-1">
                                        {isWriting ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                                        AI Smart Write
                                    </button>
                                </div>
                                <Textarea 
                                    rows={10} 
                                    value={editingTemplate?.content || ''} 
                                    onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                                    className="font-mono text-sm"
                                />
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {['{{firstName}}', '{{companyName}}', '{{city}}'].map(tag => (
                                        <button key={tag} className="px-2 py-1 bg-slate-100 text-[10px] font-mono rounded border hover:border-primary-500" onClick={() => setEditingTemplate({...editingTemplate, content: (editingTemplate?.content || '') + tag})}>{tag}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="border rounded-2xl p-6 bg-white min-h-[300px]">
                            <div className="prose prose-sm max-w-none">
                                {editingTemplate?.isHtml ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editingTemplate.content || '') }} /> : <p className="whitespace-pre-wrap">{editingTemplate?.content}</p>}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} className="font-bold px-4 md:px-8">Save Template</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TemplateDesigner;
