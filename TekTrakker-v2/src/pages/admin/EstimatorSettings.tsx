
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import type { ProposalPreset } from 'types';
import { 
    Book, Plus, Trash2, Sparkles, Search, TrendingUp, Zap, Droplets, 
    Lightbulb, Hammer, Paintbrush, Brush, Home, Radio, Sun, Lock, Scissors 
} from 'lucide-react';
import { PRICE_BOOKS } from 'pricebooks';
import { globalConfirm } from "lib/globalConfirm";
import * as XLSX from 'xlsx';

const CATEGORIES = ['Diagnostics', 'Cooling', 'Heating', 'Electrical', 'Plumbing', 'Cleaning', 'Airflow', 'Accessories', 'Maintenance', 'Roofing', 'Painting', 'Contracting', 'Masonry', 'Telecommunications', 'Solar', 'Security', 'Bath Service', 'Grooming', 'Treatment', 'Other'];

const EstimatorSettings: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPreset, setCurrentPreset] = useState<Partial<ProposalPreset>>({ name: '', description: '', baseCost: 0, avgLabor: 0, category: 'Other' });
    const [searchTerm, setSearchTerm] = useState('');
    
    // Global Config State
    const [multiplier, setMultiplier] = useState(state.currentOrganization?.marketMultiplier || 1.0);
    const [laborRate, setLaborRate] = useState(120);
    const [markupPct, setMarkupPct] = useState(50);
    
    const [isPopulating, setIsPopulating] = useState<string | null>(null);

    const filteredPresets = useMemo(() => {
        const presets = (state.proposalPresets || []) as ProposalPreset[];
        return presets.filter((p: ProposalPreset) => 
            (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (p.category || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [state.proposalPresets, searchTerm]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const itemToSave = {
            ...currentPreset,
            id: currentPreset.id || `p-${Date.now()}`,
            organizationId: state.currentOrganization?.id || '',
            baseCost: Number(currentPreset.baseCost),
            avgLabor: Number(currentPreset.avgLabor),
        } as ProposalPreset;
        
        try {
            await db.collection('proposalPresets').doc(itemToSave.id).set(itemToSave);
            if (currentPreset.id) dispatch({ type: 'UPDATE_PROPOSAL_PRESET', payload: itemToSave });
            else dispatch({ type: 'ADD_PROPOSAL_PRESET', payload: itemToSave });
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Save failed.");
        }
    };

    const handleLoadMaster = async (vertical: keyof typeof PRICE_BOOKS) => {
        if (!state.currentOrganization) return;
        const book = PRICE_BOOKS[vertical];
        if (!book || book.length === 0) return;
        
        if (!await globalConfirm(`CLEAN SLATE: Purge current pricebook and import ${book.length} tasks from the professional ${String(vertical)} master library?`)) return;
        
        setIsPopulating(String(vertical));
        try {
            const orgId = state.currentOrganization.id;
            
            // 1. PURGE EXISTING (Clean Slate)
            const currentPresets = await db.collection('proposalPresets').where('organizationId', '==', String(orgId)).get();
            const deleteBatch = db.batch();
            currentPresets.forEach(doc => {
                deleteBatch.delete(doc.ref);
                dispatch({ type: 'DELETE_PROPOSAL_PRESET', payload: doc.id });
            });
            await deleteBatch.commit();

            // 2. IMPORT NEW
            const importBatch = db.batch();
            book.forEach((item) => {
                // Sanitized ID generation
                const safeVertical = String(vertical).toLowerCase().replace(/\s+/g, '-');
                const id = `preset-${safeVertical}-${Math.random().toString(36).substr(2, 9)}`;
                const ref = db.collection('proposalPresets').doc(id);
                const fullItem = { ...item, id, organizationId: orgId };
                importBatch.set(ref, fullItem);
                dispatch({ type: 'ADD_PROPOSAL_PRESET', payload: fullItem as ProposalPreset });
            });
            
            await importBatch.commit();
            alert(`${String(vertical)} Library successfully imported!`);
        } catch (e) {
            console.error(e);
            alert("Import failed. Check console.");
        } finally {
            setIsPopulating(null);
        }
    };

    const handleImportTargetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization) return;
        
        const orgId = state.currentOrganization.id;
        
        setIsPopulating("CSV/Excel Upload");
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                 const data = new Uint8Array(event.target?.result as ArrayBuffer);
                 const workbook = XLSX.read(data, { type: 'array' });
                 const firstSheetName = workbook.SheetNames[0];
                 const worksheet = workbook.Sheets[firstSheetName];
                 const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                 if (json.length === 0) {
                     alert("The uploaded file is empty or formatted incorrectly.");
                     setIsPopulating(null);
                     return;
                 }
                 
                 // Auto-detect columns based on common CSV structures
                 if (!await globalConfirm(`Found ${json.length} records. Do you want to inject these tasks into your Pricebook?`)) {
                     setIsPopulating(null);
                     return;
                 }

                 const batch = db.batch();
                 
                 json.forEach(row => {
                     // Best effort mapping of row columns to TekTrakker fields
                     const name = row['Task'] || row['Name'] || row['Service'] || row['Title'] || row['Item'] || row['Description'] || 'Imported Task';
                     const description = row['Description'] || row['Details'] || row['Notes'] || '';
                     const category = row['Category'] || row['Department'] || row['Type'] || 'Other';
                     const rawCost = String(row['Cost'] || row['Base Cost'] || row['Price'] || row['Unit Price'] || '0').replace(/[^0-9.]/g, '');
                     const rawLabor = String(row['Labor Hours'] || row['Labor'] || row['Hours'] || row['Time'] || '0').replace(/[^0-9.]/g, '');
                     
                     const id = `preset-csv-${Math.random().toString(36).substr(2, 9)}`;
                     const ref = db.collection('proposalPresets').doc(id);
                     const fullItem = {
                         id,
                         organizationId: orgId,
                         name: String(name).trim(),
                         description: String(description).trim(),
                         category: String(category).trim(),
                         baseCost: Number(rawCost) || 0,
                         avgLabor: Number(rawLabor) || 0
                     } as ProposalPreset;
                     
                     batch.set(ref, fullItem);
                     dispatch({ type: 'ADD_PROPOSAL_PRESET', payload: fullItem });
                 });
                 
                 await batch.commit();
                 alert(`Successfully imported ${json.length} tasks into your Catalog!`);
            } catch (err) {
                 console.error(err);
                 alert("File parsing failed. Please ensure it is a valid CSV or XLSX spreadsheet.");
            } finally {
                 setIsPopulating(null);
                 // Reset file input
                 e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDelete = async (id: string) => {
        if (await globalConfirm("Delete this task from your pricebook?")) {
            await db.collection('proposalPresets').doc(id).delete();
            dispatch({ type: 'DELETE_PROPOSAL_PRESET', payload: id });
        }
    };

    const getIcon = (vertical: string) => {
        switch(vertical) {
            case 'HVAC': return <Zap size={18} className="text-blue-600"/>;
            case 'Plumbing': return <Droplets size={18} className="text-emerald-600"/>;
            case 'Electrical': return <Lightbulb size={18} className="text-yellow-600"/>;
            case 'Contracting': return <Hammer size={18} className="text-orange-600"/>;
            case 'Painting': return <Paintbrush size={18} className="text-pink-600"/>;
            case 'Cleaning': return <Brush size={18} className="text-purple-600"/>;
            case 'Landscaping': return <Home size={18} className="text-green-600"/>;
            case 'Telecommunications': return <Radio size={18} className="text-cyan-600"/>;
            case 'Solar': return <Sun size={18} className="text-amber-500"/>;
            case 'Security': return <Lock size={18} className="text-slate-600"/>;
            case 'Pet Grooming': return <Scissors size={18} className="text-rose-500"/>;
            default: return <Book size={18} className="text-slate-600"/>;
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Price Book & Estimator</h2>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Configure high-speed flat rate pricing and AI generation.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <label className="flex items-center gap-2 shadow-lg btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold cursor-pointer transition-colors duration-200">
                         {isPopulating === "CSV/Excel Upload" ? <Sparkles size={18} className="animate-spin" /> : <Book size={18} />}
                         <span className="text-sm">Import CSV / Excel</span>
                         <input type="file" accept=".csv, .xlsx, .xls" onChange={handleImportTargetFile} className="hidden" />
                    </label>
                    <Button onClick={() => { setCurrentPreset({ name: '', description: '', baseCost: 0, avgLabor: 0, category: 'Other' }); setIsModalOpen(true); }} className="flex items-center gap-2 shadow-lg"><Plus size={18}/> Custom Task</Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-xl">
                        <div className="mb-6 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                className="pl-12 w-full h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none font-medium" 
                                placeholder="Search by task name, category, or part..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>

                        <Table headers={['Vertical', 'Task Details', 'Retail Estimate', 'Actions']}>
                            {filteredPresets.map((preset: ProposalPreset) => {
                                const retail = ((preset.baseCost * 2) + (preset.avgLabor * laborRate)) * multiplier;
                                return (
                                    <tr key={preset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black uppercase bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-1 rounded-lg border border-primary-100 dark:border-primary-800">
                                                {preset.category || 'Other'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white">{preset.name}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{preset.description}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-lg">
                                            ${retail.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button onClick={() => {setCurrentPreset(preset); setIsModalOpen(true);}} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Plus size={16}/></button>
                                            <button onClick={() => handleDelete(preset.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                        {filteredPresets.length === 0 && (
                            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-xl m-4 border-2 border-dashed border-slate-200">
                                <Book className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-500 font-bold">Your Pricebook is empty.</p>
                                <p className="text-xs text-slate-400">Use the library tools on the right to populate it instantly.</p>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-t-4 border-indigo-600 shadow-xl">
                        <div className="flex items-center gap-2 mb-6">
                            <Sparkles className="text-indigo-600" />
                            <h3 className="font-black uppercase tracking-widest text-sm">Pricebook Library</h3>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4">Master Vertical Population</p>
                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                            {Object.keys(PRICE_BOOKS).filter(k => k !== 'Other').map(v => (
                                <button 
                                    key={v}
                                    onClick={() => handleLoadMaster(v as any)} 
                                    disabled={!!isPopulating} 
                                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">{getIcon(v)}</div>
                                        <span className="font-bold text-sm">{v} Master</span>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase group-hover:translate-x-1 transition-transform">Import</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    <Card className="border-t-4 border-primary-600 shadow-xl">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="text-primary-600" />
                            <h3 className="font-black uppercase tracking-widest text-sm">Financial Rules</h3>
                        </div>
                        <div className="space-y-4">
                            <Input type="number" step="0.01" label="Market Multiplier" value={multiplier} onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1.0)} placeholder="1.0" />
                            <Input type="number" label="Labor Rate ($/hr)" value={laborRate} onChange={(e) => setLaborRate(parseInt(e.target.value) || 120)} placeholder="120" />
                            <Input type="number" label="Default Markup %" value={markupPct} onChange={(e) => setMarkupPct(parseInt(e.target.value) || 50)} placeholder="50" />
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-[10px] text-blue-700 dark:text-blue-300 font-medium italic">
                                Note: These rules define how "Retail Price" is estimated in the table and how the AI Generator calculates proposals.
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPreset.id ? "Edit Pricebook Entry" : "Create New Flat Rate Task"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Select label="Category" value={currentPreset.category ?? 'Other'} onChange={(e) => setCurrentPreset({...currentPreset, category: e.target.value as any})}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <Input label="Task Name" value={currentPreset.name || ''} onChange={(e) => setCurrentPreset({...currentPreset, name: e.target.value})} required placeholder="e.g. Capacitor Replacement" />
                    <Textarea label="Public Description" value={currentPreset.description || ''} onChange={(e: any) => setCurrentPreset({...currentPreset, description: e.target.value})} placeholder="What the customer sees on the proposal..." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Internal Cost (Parts)" type="number" step="0.01" value={currentPreset.baseCost || 0} onChange={(e) => setCurrentPreset({...currentPreset, baseCost: Number(e.target.value)})} />
                        <Input label="Labor Estimate (Hrs)" type="number" step="0.1" value={currentPreset.avgLabor || 0} onChange={(e) => setCurrentPreset({...currentPreset, avgLabor: Number(e.target.value)})} />
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Retail Calculation Preview</p>
                        <div className="text-2xl font-black text-emerald-600">
                            ${(((Number(currentPreset.baseCost) * 2) + (Number(currentPreset.avgLabor) * laborRate)) * multiplier).toFixed(2)}
                        </div>
                    </div>
                    <Button type="submit" className="w-full h-12 shadow-lg shadow-primary-500/20">Save to Pricebook</Button>
                </form>
            </Modal>
        </div>
    );
};

export default EstimatorSettings;
