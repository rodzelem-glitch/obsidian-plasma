
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import { 
    PlusCircle, Trash2, GripVertical, Save, FileText, Wand2, CheckSquare, 
    AlignLeft, Image, Type, ChevronDown, ChevronUp, Copy, Eye, Settings
} from 'lucide-react';
import { db } from '../../lib/firebase';
import type { InspectionTemplate, InspectionTemplateItem } from '../../types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { globalConfirm } from "lib/globalConfirm";

// Define available field types for the form builder
const FIELD_TYPES: { type: InspectionTemplateItem['type'], icon: React.ElementType, label: string }[] = [
    { type: 'PassFail', icon: CheckSquare, label: 'Pass/Fail' },
    { type: 'Text', icon: Type, label: 'Text' },
    { type: 'Textarea', icon: AlignLeft, label: 'Paragraph' },
    { type: 'Photo', icon: Image, label: 'Photo Upload' },
];

const FormBuilder: React.FC = () => {
    const { state, dispatch } = useAppContext();
    
    // Component State
    const [editingTemplate, setEditingTemplate] = useState<Partial<InspectionTemplate> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiImportMode, setAiImportMode] = useState<'text' | 'image' | 'generate'>('generate');
    const [aiPromptText, setAiPromptText] = useState('');
    const [aiImage, setAiImage] = useState<File | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Memoized list of filtered templates
    const filteredTemplates = useMemo(() => {
        return state.inspectionTemplates
        .filter(t => t && t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [state.inspectionTemplates, searchTerm]);

    // Effect to select the first template or a new one
    useEffect(() => {
        if (filteredTemplates.length > 0 && !editingTemplate) {
            setEditingTemplate(filteredTemplates[0]);
        } else if (filteredTemplates.length === 0) {
            setEditingTemplate(null);
        }
    }, [filteredTemplates, editingTemplate]);

    const handleNewTemplate = () => {
        setEditingTemplate({ name: 'Untitled Checklist', items: [] });
    };
    
    // Functions to manipulate form fields
    const addField = (type: InspectionTemplateItem['type']) => {
        const newItem: InspectionTemplateItem = {
            id: `item-${Date.now()}`,
            label: `New ${type} Item`,
            type,
            required: false,
        };
        if (editingTemplate) {
            setEditingTemplate(prev => ({ ...prev, items: [...(prev?.items || []), newItem] }));
        }
    };

    const updateField = (id: string, updates: Partial<InspectionTemplateItem>) => {
        if (editingTemplate) {
            setEditingTemplate(prev => ({ 
                ...prev, 
                items: prev?.items?.map(i => i.id === id ? { ...i, ...updates } : i) 
            }));
        }
    };

    const removeField = (id: string) => {
        if (editingTemplate) {
            setEditingTemplate(prev => ({ ...prev, items: prev?.items?.filter(i => i.id !== id) }));
        }
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (!editingTemplate || !editingTemplate.items) return;
        const newItems = [...editingTemplate.items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newItems.length) return;
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setEditingTemplate(prev => ({ ...prev, items: newItems }));
    };

    // AI-powered form generation
    const handleAiImport = async () => {
        if ((aiImportMode === 'text' || aiImportMode === 'generate') && !aiPromptText) return;
        if (aiImportMode === 'image' && !aiImage) return;

        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            // Dynamically select model based on input type
            let modelName = "gemini-3-pro-preview"; // Default for text/reasoning
            if (aiImportMode === 'image') {
                modelName = "gemini-3-pro-image-preview"; // For vision tasks
            }

            let promptPayload: any = {
                modelName: modelName,
            };

            const baseSystemPrompt = `
                You are an expert form builder. Create a structured inspection checklist based on the user's request.
                Return ONLY a valid JSON object with a single key "items" which is an array of objects.
                Do not include markdown formatting like \`\`\`json.
                
                Each object in the "items" array must have these properties:
                - "label" (string): The clear and concise question or check to perform.
                - "type" (string): Infer the best type. Must be one of: 'PassFail', 'Text', 'Textarea', 'Photo'.
                - "required" (boolean): Infer if the item seems mandatory, default to false.

                Example: { "items": [{ "label": "Check tire pressure", "type": "PassFail", "required": true }] }
            `;

            let userPrompt = "";

            if (aiImportMode === 'generate') {
                userPrompt = `Create a comprehensive checklist for: "${aiPromptText}"`;
            } else if (aiImportMode === 'text') {
                userPrompt = `Convert this text into a structured checklist:\n${aiPromptText}`;
            } else if (aiImage) {
                userPrompt = "Convert this image of a checklist into a structured JSON format.";
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(aiImage);
                });
                // Using the 'image' property structure supported by the updated cloud function
                promptPayload.image = { 
                    data: base64Image, 
                    mimeType: aiImage.type 
                };
            }

            promptPayload.prompt = `${baseSystemPrompt}\n\nUser Request: ${userPrompt}`;

            const result = await callGeminiAI(promptPayload);
            const data = result.data as { text: string };
            
            // Robust parsing logic
            let jsonString = data.text;
            // Remove markdown code blocks if present
            jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsedData;
            try {
                parsedData = JSON.parse(jsonString);
            } catch (e) {
                console.error("Failed to parse AI response as JSON:", data.text);
                throw new Error("AI response was not valid JSON.");
            }

            if (!parsedData.items || !Array.isArray(parsedData.items)) {
                 throw new Error("AI response missing 'items' array.");
            }
            
            const aiItems: InspectionTemplateItem[] = parsedData.items.map((item: any, index: number) => ({
                id: `ai-item-${Date.now()}-${index}`,
                label: item.label || "Untitled Item",
                type: ['PassFail', 'Text', 'Textarea', 'Photo'].includes(item.type) ? item.type : 'PassFail',
                required: !!item.required,
            }));

            if (editingTemplate) {
                setEditingTemplate(prev => ({ ...prev, items: [...(prev?.items || []), ...aiItems] }));
            } else {
                setEditingTemplate({ name: aiImportMode === 'generate' ? aiPromptText : 'Imported Checklist', items: aiItems });
            }

            setIsAiModalOpen(false);
            setAiPromptText('');
            setAiImage(null);

        } catch (error) {
            console.error("AI Import Error:", error);
            alert("Failed to create checklist. Please try again or simplify the request.");
        } finally {
            setIsThinking(false);
        }
    };

    // Save and Delete operations
    const handleSaveTemplate = async () => {
        if (!editingTemplate || !editingTemplate.name) {
            alert("Please provide a name for the template.");
            return;
        }
        setIsSaving(true);
        try {
            const templateToSave: InspectionTemplate = {
                id: editingTemplate.id || `insp-${Date.now()}`,
                name: editingTemplate.name,
                organizationId: state.currentOrganization?.id || '',
                items: editingTemplate.items || [],
                createdAt: editingTemplate.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await db.collection('inspectionTemplates').doc(templateToSave.id).set(templateToSave, { merge: true });
            
            if (state.inspectionTemplates.some(t => t.id === templateToSave.id)) {
                dispatch({ type: 'UPDATE_INSPECTION_TEMPLATE', payload: templateToSave });
            } else {
                dispatch({ type: 'ADD_INSPECTION_TEMPLATE', payload: templateToSave });
            }
            
            alert("Template saved successfully!");
            setEditingTemplate(templateToSave);
        } catch (error) {
            console.error(error);
            alert("Error saving template.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (await globalConfirm('Are you sure you want to permanently delete this template?')) {
            try {
                await db.collection('inspectionTemplates').doc(id).delete();
                dispatch({ type: 'DELETE_INSPECTION_TEMPLATE', payload: id });
                if (editingTemplate?.id === id) {
                    setEditingTemplate(filteredTemplates.length > 1 ? filteredTemplates[0] : null);
                }
            } catch (error) {
                console.error(error);
                alert("Failed to delete template.");
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Forms & Checklists</h2>
                    <p className="text-gray-600 dark:text-gray-400">Create and manage inspection templates for field use.</p>
                </div>
                <div className="flex gap-2">
                     <Button onClick={handleNewTemplate} variant="outline">
                        <PlusCircle size={16} className="mr-2" /> New Template
                    </Button>
                     <Button onClick={() => setIsAiModalOpen(true)}>
                        <Wand2 size={16} className="mr-2" /> AI Assistant
                    </Button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                {/* Template List Sidebar */}
                <aside className="md:col-span-1 space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                    <Input 
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="mb-2"
                    />
                    <div className="max-h-[70vh] overflow-y-auto">
                        {filteredTemplates.map(template => (
                            <Card 
                                key={template.id} 
                                className={`cursor-pointer mb-2 border-l-4 ${
                                    editingTemplate?.id === template.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent'
                                }`}
                                onClick={() => setEditingTemplate(template)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{template.name}</h4>
                                        <p className="text-xs text-gray-500">{template.items.length} items</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }} className="text-gray-400 hover:text-red-500 p-1 rounded-full">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </Card>
                        ))}
                         {filteredTemplates.length === 0 && (
                            <div className="text-center py-10">
                                <FileText size={40} className="mx-auto text-slate-400" />
                                <p className="mt-2 text-sm text-slate-500">No templates found.</p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Builder Area */}
                <main className="md:col-span-3">
                    {editingTemplate ? (
                        <Card className="h-full flex flex-col">
                            <div className="flex justify-between items-center mb-4 p-4 border-b border-slate-200 dark:border-slate-700">
                                <Input 
                                    label="Template Name"
                                    value={editingTemplate.name || ''} 
                                    onChange={e => setEditingTemplate(prev => ({...prev, name: e.target.value}))}
                                    placeholder="e.g. Pre-Trip Vehicle Inspection" 
                                    className="text-lg font-bold !p-0 !border-0 focus:!ring-0"
                                />
                                <Button onClick={handleSaveTemplate} disabled={isSaving}>
                                    <Save size={16} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Template'}
                                </Button>
                            </div>
                            
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 overflow-hidden">
                                <div className="col-span-2 overflow-y-auto pr-4 space-y-3">
                                    {editingTemplate.items?.map((item, idx) => (
                                        <div key={item.id} className="group relative bg-slate-50 dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-3">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <button onClick={() => moveField(idx, 'up')} className="hover:text-primary-500 disabled:opacity-30" disabled={idx === 0}><ChevronUp size={16}/></button>
                                                <GripVertical size={16} className="cursor-move text-slate-300" />
                                                <button onClick={() => moveField(idx, 'down')} className="hover:text-primary-500 disabled:opacity-30" disabled={idx === editingTemplate.items!.length - 1}><ChevronDown size={16}/></button>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <Input value={item.label} onChange={e => updateField(item.id, { label: e.target.value })} placeholder="Field Label" className="font-semibold"/>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-xs flex items-center gap-2 text-slate-500">
                                                        <Settings size={14} /> {FIELD_TYPES.find(f=>f.type === item.type)?.label}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input type="checkbox" checked={item.required} onChange={e => updateField(item.id, { required: e.target.checked })} id={`req-${item.id}`} className="rounded w-4 h-4" />
                                                        <label htmlFor={`req-${item.id}`} className="text-xs text-slate-600 dark:text-slate-300">Required</label>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => removeField(item.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                        </div>
                                    ))}\
                                    {(!editingTemplate.items || editingTemplate.items.length === 0) && (
                                        <div className="text-center py-20 border-2 border-dashed rounded-lg">
                                            <p className="text-slate-500">This template is empty.</p>
                                            <p className="text-slate-400 text-sm mt-1">Use the "Add Field" panel to build your checklist.</p>
                                        </div>
                                    )}\
                                </div>

                                {/* Add Fields Sidebar */}
                                <div className="col-span-1 space-y-4">
                                    <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300">Add Field</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {FIELD_TYPES.map(ft => (
                                            <button key={ft.type} onClick={() => addField(ft.type)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">
                                                <ft.icon size={18} className="text-primary-500" />
                                                <span className="text-sm font-semibold">{ft.label}</span>
                                            </button>
                                        ))}\
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="text-center">
                                <FileText size={48} className="mx-auto text-slate-400" />
                                <h3 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">No Template Selected</h3>
                                <p className="mt-1 text-sm text-slate-500">Select a template from the list or create a new one.</p>
                                <Button onClick={handleNewTemplate} className="mt-6\">Create New Template</Button>
                            </div>
                        </div>
                    )}\
                </main>
            </div>

            {/* AI Import Modal */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Checklist Assistant">
                <div className="space-y-4">
                    <div className="flex border-b">
                        <button onClick={() => setAiImportMode('generate')} className={`px-4 py-2 text-sm ${aiImportMode === 'generate' ? 'border-b-2 border-primary-500 font-bold' : ''}`}>Create from Prompt</button>
                        <button onClick={() => setAiImportMode('text')} className={`px-4 py-2 text-sm ${aiImportMode === 'text' ? 'border-b-2 border-primary-500 font-bold' : ''}`}>Convert Text</button>
                        <button onClick={() => setAiImportMode('image')} className={`px-4 py-2 text-sm ${aiImportMode === 'image' ? 'border-b-2 border-primary-500 font-bold' : ''}`}>From Image</button>
                    </div>

                    {aiImportMode === 'generate' && (
                        <Textarea 
                            label="What kind of checklist do you need?"
                            value={aiPromptText} 
                            onChange={e => setAiPromptText(e.target.value)} 
                            placeholder="e.g., 'A 20-point annual maintenance inspection for a commercial rooftop HVAC unit including belt checks, coil cleaning, and electrical connections.'"
                            rows={6}
                        />
                    )}

                    {aiImportMode === 'text' && (
                        <Textarea 
                            label="Paste your checklist text"
                            value={aiPromptText} 
                            onChange={e => setAiPromptText(e.target.value)} 
                            placeholder="- Check tire pressure&#x0a;- Verify fluid levels&#x0a;- Test all lights" 
                            rows={10}
                        />
                    )}

                    {aiImportMode === 'image' && (
                        <Input 
                            label="Upload an image of a checklist"
                            type="file" 
                            accept="image/*"
                            onChange={e => setAiImage(e.target.files?.[0] || null)} 
                        />
                    )}

                    <Button onClick={handleAiImport} disabled={isThinking} className="w-full">
                        {isThinking ? 'Processing...' : 'Generate Checklist'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default FormBuilder;
