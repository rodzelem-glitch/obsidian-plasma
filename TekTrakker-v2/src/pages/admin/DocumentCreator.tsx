
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select'; 
import { db } from '../../lib/firebase';
import type { BusinessDocument } from '../../types'; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { compressFile } from '../../lib/utils';
import {
    FileText, Wand2, Download, Trash2, Save, Upload, Printer, Edit3, Copy, 
    Clipboard, File as FileIcon, User as UserIcon, DollarSign, Mail, BookOpen, Layers, Archive
} from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';

const DocumentCreator: React.FC = () => {
    const { state, dispatch } = useAppContext();

    // --- MAIN STATE ---
    const [activeTab, setActiveTab] = useState<'Policies' | 'Repository' | 'Master Files' | 'Templates' | 'Tax Forms'>('Policies');
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- MODAL & EDITOR STATE ---
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Partial<BusinessDocument> | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // Added isSaving state

    // --- FILE UPLOAD STATE ---
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // --- 1099 TAX FORM STATE ---
    const [is1099ModalOpen, setIs1099ModalOpen] = useState(false);
    const [selected1099User, setSelected1099User] = useState<string>('');
    const [amount1099, setAmount1099] = useState('');

    const contentEditableRef = useRef<HTMLDivElement>(null);

    // --- DATA FILTERING ---
    const filteredDocuments = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return state.documents
            .filter(doc => doc.title.toLowerCase().includes(lowerSearch))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [state.documents, searchTerm]);

    const getDocsForTab = (tab: typeof activeTab) => {
        switch (tab) {
            case 'Policies':
                return filteredDocuments.filter(d => d.type === 'Policy' || d.type === 'Handbook');
            case 'Repository':
                return filteredDocuments.filter(d => !['Policy', 'Handbook', 'Master Upload', 'Master Template', '1099-NEC'].includes(d.type));
            case 'Master Files':
                return filteredDocuments.filter(d => d.type === 'Master Upload');
            case 'Templates':
                return filteredDocuments.filter(d => d.type === 'Master Template' || d.type === 'Waiver Template');
            case 'Tax Forms':
                return filteredDocuments.filter(d => d.type === '1099-NEC');
            default:
                return [];
        }
    };

    // --- CORE HANDLERS ---
    const handleWriteNew = (type: BusinessDocument['type']) => {
        setEditingDoc({ title: '', content: '', type });
        setIsEditorOpen(true);
    };

    const handleEdit = (doc: BusinessDocument) => {
        setEditingDoc(doc);
        setIsEditorOpen(true);
    };

    const handleSaveDoc = async () => {
        if (!editingDoc || !editingDoc.title || !state.currentOrganization) {
            alert("Please enter a title for the document.");
            return;
        }
        
        setIsSaving(true); // Disable button immediately

        const content = contentEditableRef.current?.innerHTML || editingDoc.content || '';
        const isUpdating = !!editingDoc.id;

        const docToSave: BusinessDocument = {
            id: editingDoc.id || `doc_${Date.now()}`,
            organizationId: state.currentOrganization.id,
            title: editingDoc.title,
            type: editingDoc.type || 'Other',
            content,
            createdAt: editingDoc.createdAt || new Date().toISOString(),
            createdBy: editingDoc.createdBy || state.currentUser?.id || 'system',
        };

        try {
            await db.collection('documents').doc(docToSave.id).set(docToSave, { merge: true });
            
            setIsEditorOpen(false);
            setEditingDoc(null);
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save the document.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (await globalConfirm("Are you sure you want to permanently delete this document?")) {
            try {
                await db.collection('documents').doc(id).delete();
                dispatch({ type: 'DELETE_DOCUMENT', payload: id });
            } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete the document.");
            }
        }
    };

    // --- AI GENERATOR ---
    const handleOpenAiModal = () => {
        if (!editingDoc) return;
        setAiPrompt(`Write a ${editingDoc.type} titled "${editingDoc.title}" for a service business.`);
        setIsAiModalOpen(true);
    };

    const handleAIGenerate = async () => {
        if (!aiPrompt) return;
        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            const systemInstruction = "You are a business operations assistant. Format your response as clean, well-structured HTML using elements like <h2>, <p>, <ul>, and <li> for easy readability. Do not include ```html blocks.";
            const fullPrompt = `${systemInstruction}\n\n${aiPrompt}`;
            
            const result = await callGeminiAI({ prompt: fullPrompt, modelName: "gemini-3-pro-preview" }); 
            const data = result.data as { text: string };
            
            setEditingDoc(prev => prev ? { ...prev, content: data.text } : null);
            
            if (contentEditableRef.current) {
                contentEditableRef.current.innerHTML = data.text;
            }

            setIsAiModalOpen(false);
            setAiPrompt('');
        } catch (error) {
            console.error("AI Generation Error:", error);
            alert("Error generating content. Please try again.");
        } finally {
            setIsThinking(false);
        }
    };

    // --- FILE UPLOADS ---
    const handleFileUpload = async () => {
        if (!fileToUpload || !uploadTitle || !state.currentOrganization) return;
        setIsUploading(true);
        try {
            const compressedB64 = await compressFile(fileToUpload);
            const newDoc: BusinessDocument = {
                id: `upload_${Date.now()}`,
                organizationId: state.currentOrganization.id,
                title: uploadTitle,
                type: 'Master Upload',
                content: fileToUpload.type, 
                context: compressedB64, 
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser?.id || 'system',
            };
            await db.collection('documents').doc(newDoc.id).set(newDoc);
            dispatch({ type: 'ADD_DOCUMENT', payload: newDoc });
            setIsUploadModalOpen(false);
            setFileToUpload(null);
            setUploadTitle('');
        } catch (error) {
            console.error("Upload failed:", error);
            alert("File upload failed.");
        } finally {
            setIsUploading(false);
        }
    };
    
    // --- 1099-NEC GENERATOR ---
    const handleGenerate1099 = async () => {
        const user = state.users.find(u => u.id === selected1099User);
        if (!user || !amount1099 || !state.currentOrganization) return;

        const org = state.currentOrganization;
        const htmlContent = `
            <div style="border: 1px solid #ccc; padding: 20px; max-width: 800px; margin: auto; font-family: sans-serif;">
                <h1 style="text-align: center; color: #333;">Form 1099-NEC</h1>
                <h2 style="text-align: center; color: #555;">Nonemployee Compensation</h2>
                <hr>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <strong>PAYER'S NAME, STREET ADDRESS, CITY, STATE, ZIP CODE, AND TELEPHONE NO</strong><br>
                            ${org.name}<br>${org.address?.street || ''}<br>${org.address?.city || ''}, ${org.address?.state || ''} ${org.address?.zip || ''}<br>${org.phone || ''}
                        </td>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <strong>1. Nonemployee compensation</strong><br>
                            <span style="font-size: 1.2em; font-weight: bold;">$${parseFloat(amount1099).toFixed(2)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <strong>PAYER'S TIN</strong><br>${org.taxId || 'XX-XXXXXXX'}
                        </td>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <strong>RECIPIENT'S TIN</strong><br>${user.taxId || 'XXX-XX-XXXX'}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">
                            <strong>RECIPIENT'S NAME, STREET ADDRESS, CITY, STATE, AND ZIP CODE</strong><br>
                            ${user.firstName} ${user.lastName}<br>${user.address?.street || ''}<br>${user.address?.city || ''}, ${user.address?.state || ''} ${user.address?.zip || ''}
                        </td>
                    </tr>
                </table>
                <p style="font-size: 0.8em; color: #777; margin-top: 20px;">This is an important tax document and is being furnished to the Internal Revenue Service.</p>
            </div>
        `;

        const doc: Partial<BusinessDocument> = {
            title: `1099-NEC for ${user.firstName} ${user.lastName} - ${new Date().getFullYear()}`,
            content: htmlContent,
            type: '1099-NEC'
        };

        setEditingDoc(doc);
        setIs1099ModalOpen(false);
        setIsEditorOpen(true);
    };

    const handlePrint = () => {
        const content = contentEditableRef.current?.innerHTML || editingDoc?.content || '';
        const win = window.open('', '', 'width=800,height=600');
        win?.document.write(`<html><head><title>${editingDoc?.title || 'Document'}</title></head><body>${content}</body></html>`);
        win?.document.close();
        win?.print();
    };

    const TABS = [
        { id: 'Policies', label: 'Policies & Handbooks', icon: BookOpen },
        { id: 'Repository', label: 'General Repository', icon: Archive },
        { id: 'Master Files', label: 'Uploaded Files', icon: Layers },
        { id: 'Templates', label: 'Templates', icon: Clipboard },
        { id: 'Tax Forms', label: '1099 Tax Forms', icon: DollarSign },
    ];

    const DOCUMENT_TYPES = [
        { value: 'Policy', label: 'Policy' },
        { value: 'Handbook', label: 'Handbook' },
        { value: 'Master Template', label: 'Proposal Template' },
        { value: 'Waiver Template', label: 'Waiver Template' },
        { value: 'Standard Operating Procedure', label: 'SOP' },
        { value: 'Contract', label: 'Contract' },
        { value: 'Other', label: 'Other' }
    ];

    // --- RENDER ---
    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Document Center</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage operational data, legal documents, and templates.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => handleWriteNew(activeTab === 'Policies' ? 'Policy' : (activeTab === 'Templates' ? 'Master Template' : 'Other'))} variant="primary">
                        <Edit3 size={16} className="mr-2" /> Write New
                    </Button>
                    <Button onClick={() => setIsUploadModalOpen(true)} variant="outline">
                        <Upload size={16} className="mr-2" /> Upload File
                    </Button>
                    {activeTab === 'Tax Forms' && (
                        <Button onClick={() => setIs1099ModalOpen(true)} variant="outline">
                            <DollarSign size={16} className="mr-2" /> Generate 1099
                        </Button>
                    )}
                </div>
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-primary-600 text-primary-600 dark:text-primary-400' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={16} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <Input 
                placeholder={`Search in ${activeTab}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-md"
            />

            {/* Document Table/Grid */}
            <div className="min-h-[400px]">
                <Table headers={['Title', 'Type', 'Created', 'Actions']}>
                    {getDocsForTab(activeTab).map(doc => (
                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-bold"><FileText size={16} className="inline-block mr-2 text-gray-400" />{doc.title}</td>
                            <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">{doc.type}</span></td>
                            <td className="px-6 py-4 text-sm">{new Date(doc.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(doc)}>View/Edit</Button>
                                {doc.context && doc.type === 'Master Upload' && <a href={doc.context} download={doc.title}><Button size="sm" variant="ghost"><Download size={14}/></Button></a>}
                                <Button size="sm" variant="danger" onClick={() => handleDelete(doc.id)}><Trash2 size={14}/></Button>
                            </td>
                        </tr>
                    ))}
                </Table>
                {getDocsForTab(activeTab).length === 0 && <p className="text-center py-12 text-gray-500">No documents found in this category.</p>}
            </div>
            
            {/* Editor Modal */}
            {isEditorOpen && editingDoc && (
                 <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col">
                        <header className="p-4 border-b flex justify-between items-center flex-shrink-0 gap-4">
                            <div className="flex-1 flex gap-4 items-center">
                                <Input 
                                    className="text-lg font-bold flex-1"
                                    placeholder="Document Title"
                                    value={editingDoc.title || ''}
                                    onChange={e => setEditingDoc({...editingDoc, title: e.target.value})}
                                />
                                <Select
                                    className="w-48"
                                    value={editingDoc.type}
                                    onChange={e => setEditingDoc({...editingDoc, type: e.target.value as any})}
                                >
                                    {DOCUMENT_TYPES.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleOpenAiModal}><Wand2 size={16} className="mr-2" /> AI Generator</Button>
                                <Button variant="outline" onClick={handlePrint}><Printer size={16}/></Button>
                                <Button onClick={handleSaveDoc} disabled={isSaving}>
                                    <Save size={16} className="mr-2" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <button onClick={() => setIsEditorOpen(false)} className="text-gray-500 ml-2 hover:text-red-500 p-2 text-xl">&times;</button>
                            </div>
                        </header>
                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-950">
                             <div 
                                className="w-full min-h-[500px] bg-white dark:bg-gray-800 text-black dark:text-white p-6 md:p-12 shadow-md rounded-lg outline-none max-w-4xl mx-auto prose dark:prose-invert"
                                contentEditable
                                ref={contentEditableRef}
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editingDoc.content || '') }}
                            />
                        </div>
                    </div>
                 </div>
            )}

            {/* AI Generator Modal */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Content Generator">
                <Textarea 
                    label="Prompt"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    rows={6}
                    placeholder="e.g. Write a comprehensive safety waiver for residential HVAC installations..."
                />
                <Button onClick={handleAIGenerate} disabled={isThinking} className="mt-4 w-full">
                    {isThinking ? 'Generating...' : 'Generate Content'}
                </Button>
            </Modal>

            {/* Upload Modal */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Master File">
                <Input label="File Title" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
                <Input type="file" onChange={e => setFileToUpload(e.target.files?.[0] || null)} className="mt-4"/>
                <Button onClick={handleFileUpload} disabled={isUploading || !fileToUpload || !uploadTitle} className="mt-4 w-full">
                    {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
            </Modal>

            {/* 1099-NEC Modal */}
            <Modal isOpen={is1099ModalOpen} onClose={() => setIs1099ModalOpen(false)} title="Generate 1099-NEC Form">
                <div className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-medium">Select Employee/Contractor</span>
                        <select 
                            value={selected1099User}
                            onChange={e => setSelected1099User(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        >
                            <option value="">-- Select a User --</option>
                            {state.users.filter(u => ['employee', 'both', 'supervisor', 'admin', 'master_admin', 'Technician', 'Subcontractor'].includes(u.role)).map(user => (
                                <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                            ))}
                        </select>
                    </label>
                    <Input 
                        label="Nonemployee Compensation Amount"
                        type="number"
                        value={amount1099}
                        onChange={e => setAmount1099(e.target.value)}
                        placeholder="e.g., 600.00"
                    />
                    <Button onClick={handleGenerate1099} disabled={!selected1099User || !amount1099} className="w-full">
                        Generate 1099 Document
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default DocumentCreator;
