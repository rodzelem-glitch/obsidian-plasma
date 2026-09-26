import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
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
    Lightbulb, Hammer, Paintbrush, Brush, Home, Radio, Sun, Lock, Scissors,
    Check, Save, Loader2
} from 'lucide-react';
import { AVAILABLE_VERTICALS, loadPriceBook } from 'pricebooks';
import { globalConfirm } from "lib/globalConfirm";
import * as XLSX from 'xlsx-js-style';

const CATEGORIES = ['Diagnostics', 'Cooling', 'Heating', 'Electrical', 'Plumbing', 'Cleaning', 'Airflow', 'Accessories', 'Maintenance', 'Facilities Maintenance', 'Roofing', 'Painting', 'Contracting', 'Masonry', 'Telecommunications', 'Solar', 'Security', 'Bath Service', 'Grooming', 'Treatment', 'Nails', 'Add-on', 'Cat', 'Fee', 'Surveillance', 'Access Control', 'Intercom', 'Cabling', 'Fiber', 'Networking', 'Infrastructure', 'Voice', 'AV', 'Demo', 'Admin', 'Assembly & Mounting', 'Doors & Windows', 'Carpentry & Repairs', 'Drywall & Patching', 'Irrigation', 'Landscape Lighting', 'Softscaping', 'Drainage', 'Hardscaping', 'Minor Plumbing & Fixtures', 'Minor Electrical & Fixtures', 'Exterior Maintenance', 'Safety & Hardware', 'Other'];

const EstimatorSettings: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPreset, setCurrentPreset] = useState<Partial<ProposalPreset>>({ name: '', description: '', baseCost: 0, avgLabor: 0, category: 'Other' });
    const [searchTerm, setSearchTerm] = useState('');
    
    // Ferguson API State
    const [isFergusonModalOpen, setIsFergusonModalOpen] = useState(false);
    const [fergusonEndpoint, setFergusonEndpoint] = useState('pricing-availability/v1/products');
    const [fergusonQuery, setFergusonQuery] = useState('');
    const [fergusonResults, setFergusonResults] = useState<any>(null);
    const [isFergusonLoading, setIsFergusonLoading] = useState(false);
    
    // Global Config State (Financial Rules)
    const currentOrg = state.currentOrganization;
    const [multiplier, setMultiplier] = useState<number>(() => currentOrg?.marketMultiplier ?? 1.0);
    const [laborRate, setLaborRate] = useState<number>(() => currentOrg?.laborRate ?? currentOrg?.hourlyLaborRate ?? 120);
    const [markupPct, setMarkupPct] = useState<number>(() => currentOrg?.markupPct ?? currentOrg?.defaultMarkupPct ?? 50);
    const [isSavingRules, setIsSavingRules] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    React.useEffect(() => {
        if (currentOrg) {
            setMultiplier(currentOrg.marketMultiplier ?? 1.0);
            setLaborRate(currentOrg.laborRate ?? currentOrg.hourlyLaborRate ?? 120);
            setMarkupPct(currentOrg.markupPct ?? currentOrg.defaultMarkupPct ?? 50);
            setHasUnsavedChanges(false);
        }
    }, [currentOrg?.id, currentOrg?.marketMultiplier, currentOrg?.laborRate, currentOrg?.hourlyLaborRate, currentOrg?.markupPct, currentOrg?.defaultMarkupPct]);

    const handleSaveFinancialRules = async (customMultiplier?: number, customLaborRate?: number, customMarkupPct?: number) => {
        if (!state.currentOrganization?.id) {
            showToast.warn(t("No active organization found."));
            return;
        }
        setIsSavingRules(true);
        const m = Number(customMultiplier !== undefined ? customMultiplier : multiplier) || 1.0;
        const l = Number(customLaborRate !== undefined ? customLaborRate : laborRate) || 120;
        const mk = Number(customMarkupPct !== undefined ? customMarkupPct : markupPct) || 50;

        try {
            const orgId = state.currentOrganization.id;
            const updates = {
                marketMultiplier: m,
                laborRate: l,
                markupPct: mk,
                hourlyLaborRate: l,
                defaultMarkupPct: mk,
            };

            await db.collection('organizations').doc(orgId).update(cleanUndefinedFields(updates));

            dispatch({
                type: 'UPDATE_ORGANIZATION',
                payload: {
                    ...state.currentOrganization,
                    ...updates
                }
            });

            setHasUnsavedChanges(false);
            showToast.success(t("Financial rules saved successfully!"));
        } catch (error) {
            console.error("Failed to save financial rules:", error);
            showToast.warn(t("Failed to save financial rules."));
        } finally {
            setIsSavingRules(false);
        }
    };
    
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
            await db.collection('proposalPresets').doc(itemToSave.id).set(cleanUndefinedFields(itemToSave));
            if (currentPreset.id) dispatch({ type: 'UPDATE_PROPOSAL_PRESET', payload: itemToSave });
            else dispatch({ type: 'ADD_PROPOSAL_PRESET', payload: itemToSave });
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showToast.warn("Save failed.");
        }
    };

    const handleLoadMaster = async (vertical: string) => {
        if (!state.currentOrganization) return;
        setIsPopulating(String(vertical));
        try {
            const book = await loadPriceBook(vertical);
            if (!book || book.length === 0) {
                showToast.info(`No presets found for ${vertical}`);
                return;
            }
            
            if (!await globalConfirm(`CLEAN SLATE: Purge current pricebook and import ${book.length} tasks from the professional ${String(vertical)} master library?`)) return;
            
            const orgId = state.currentOrganization.id;
            
            // 1. PURGE EXISTING (Clean Slate - Preserves Customer-Contract Presets)
            const currentPresets = await db.collection('proposalPresets').where('organizationId', '==', String(orgId)).get();
            const deleteBatch = db.batch();
            currentPresets.forEach(doc => {
                const data = doc.data();
                if (data.customerId) return; // Never purge customer-contract specific presets!
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
            showToast.warn(`${String(vertical)} Library successfully imported!`);
        } catch (e) {
            console.error(e);
            showToast.warn("Import failed. Check console.");
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
                     showToast.warn("The uploaded file is empty or formatted incorrectly.");
                     setIsPopulating(null);
                     return;
                 }
                 
                 // Auto-detect columns based on common CSV structures
                 if (!await globalConfirm(`Found ${json.length} records. Do you want to inject these tasks into your Pricebook?`)) {
                     setIsPopulating(null);
                     return;
                 }

                 const batch = db.batch();
                 
                 // Fuzzy case-insensitive column resolver for multi-vendor CSV exports (Profit Rhino, Callahan Roach, Coolfront, etc.)
                 const getRowVal = (row: Record<string, any>, candidateKeys: string[]): string => {
                     for (const key of candidateKeys) {
                         if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                             return String(row[key]).trim();
                         }
                     }
                     const rowKeys = Object.keys(row);
                     for (const cand of candidateKeys) {
                         const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
                         const matchedKey = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normCand);
                         if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
                             return String(row[matchedKey]).trim();
                         }
                     }
                     return '';
                 };

                 json.forEach(row => {
                     const name = getRowVal(row, ['Task Name', 'Task', 'Task Code', 'Name', 'Service', 'Title', 'Item', 'Item Name', 'Repair Name', 'Service Code', 'Code']) || getRowVal(row, ['Description', 'Task Description']) || 'Imported Task';
                     const description = getRowVal(row, ['Description', 'Task Description', 'Service Description', 'Details', 'Notes', 'Scope', 'Summary']) || '';
                     const category = getRowVal(row, ['Category', 'Category Name', 'Task Category', 'Department', 'Group', 'Trade', 'Type', 'Section']) || 'Other';
                     const rawCostStr = getRowVal(row, ['Base Cost', 'Cost', 'Material Cost', 'Parts Cost', 'Part Cost', 'Vendor Cost', 'Price', 'Unit Price', 'Unit Cost']) || '0';
                     const rawLaborStr = getRowVal(row, ['Labor Hours', 'Labor', 'Hours', 'Standard Hours', 'Std Hours', 'Tech Hours', 'Avg Labor', 'Time']) || '0';

                     const rawCost = String(rawCostStr).replace(/[^0-9.]/g, '');
                     const rawLabor = String(rawLaborStr).replace(/[^0-9.]/g, '');
                     
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
                     
                     batch.set(ref, cleanUndefinedFields(fullItem));
                     dispatch({ type: 'ADD_PROPOSAL_PRESET', payload: fullItem });
                 });
                 
                 await batch.commit();
                 showToast.warn(`Successfully imported ${json.length} tasks into your Catalog!`);
            } catch (err) {
                 console.error(err);
                 showToast.warn("File parsing failed. Please ensure it is a valid CSV or XLSX spreadsheet.");
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

    const handleSearchFerguson = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsFergusonLoading(true);
        setFergusonResults(null);
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            // Since proxy doesn't handle the full URL string replacement perfectly yet, 
            // append '?search=' or similar query if requested. 
            // Note: Users can tweak the precise endpoint in the UI if Ferguson requires '?keyword=' vs '?search='
            const queryParams = fergusonQuery ? `?keyword=${encodeURIComponent(fergusonQuery)}` : '';
            const fullEndpoint = fergusonEndpoint.includes('?') ? `${fergusonEndpoint}&keyword=${encodeURIComponent(fergusonQuery)}` : `${fergusonEndpoint}${queryParams}`;
            
            const callFergusonAPI = httpsCallable(functions, 'callFergusonAPI');
            const res = await callFergusonAPI({ endpoint: fullEndpoint });
            setFergusonResults(res.data);
        } catch (err: any) {
            console.error("Ferguson API Error:", err);
            setFergusonResults({ error: err.message || "Failed to search Ferguson API." });
        } finally {
            setIsFergusonLoading(false);
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
            <header className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
                <div className="flex gap-2 flex-wrap">
                    <label className="flex items-center gap-2 shadow-lg btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold cursor-pointer transition-colors duration-200">
                         {isPopulating === "CSV/Excel Upload" ? <Sparkles size={18} className="animate-spin" /> : <Book size={18} />}
                         <span className="text-sm">{t("Import CSV / Excel")}</span>
                         <input type="file" accept=".csv, .xlsx, .xls" onChange={handleImportTargetFile} className="hidden" />
                    </label>
                    <Button disabled title={t("Ferguson API Price Lookup temporarily suspended by provider (Coming Soon)")} className="flex items-center gap-2 shadow-lg bg-slate-400 text-white border-0 cursor-not-allowed opacity-75"><Search size={18}/> {t("Ferguson Live Catalog")}</Button>
                    <Button onClick={() => { setCurrentPreset({ name: '', description: '', baseCost: 0, avgLabor: 0, category: 'Other' }); setIsModalOpen(true); }} className="flex items-center gap-2 shadow-lg"><Plus size={18}/> {t("Custom Task")}</Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-xl">
                        <div className="mb-6 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                className="pl-12 w-full h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none font-medium" 
                                placeholder={t("Search by task name, category, or part...")} 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>

                        {/* Mobile Presets Cards View */}
                        <div className="md:hidden space-y-3 mb-4">
                            {filteredPresets.map((preset: ProposalPreset) => {
                                const markupFactor = 1 + (markupPct / 100);
                                const retail = ((preset.baseCost * markupFactor) + (preset.avgLabor * laborRate)) * multiplier;
                                return (
                                    <div key={preset.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5 flex-wrap">
                                                    <span>{preset.name}</span>
                                                    {(preset as any).customerId && (
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 tracking-wider uppercase">
                                                            Contract Exclusive
                                                        </span>
                                                    )}
                                                </div>
                                                {preset.description && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{preset.description}</div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black uppercase bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-lg border border-primary-100 dark:border-primary-800 shrink-0">
                                                {preset.category ? t(preset.category) : t('Other')}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                                            <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-lg">
                                                ${retail.toFixed(2)}
                                            </div>
                                            <div className="flex gap-1">
                                                <button aria-label={t("Edit Preset")} title={t("Edit Preset")} onClick={() => {setCurrentPreset(preset); setIsModalOpen(true);}} className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><Plus size={16}/></button>
                                                <button aria-label={t("Delete Preset")} title={t("Delete Preset")} onClick={() => handleDelete(preset.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                        <Table headers={[t('Vertical'), t('Task Details'), t('Retail Estimate'), t('Actions')]}>
                            {filteredPresets.map((preset: ProposalPreset) => {
                                const markupFactor = 1 + (markupPct / 100);
                                const retail = ((preset.baseCost * markupFactor) + (preset.avgLabor * laborRate)) * multiplier;
                                return (
                                    <tr key={preset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black uppercase bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-1 rounded-lg border border-primary-100 dark:border-primary-800">
                                                {preset.category ? t(preset.category) : t('Other')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <span>{preset.name}</span>
                                                {(preset as any).customerId && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 tracking-wider uppercase">
                                                        Contract Exclusive
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{preset.description}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-lg">
                                            ${retail.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button aria-label={t("Edit Preset")} title={t("Edit Preset")} onClick={() => {setCurrentPreset(preset); setIsModalOpen(true);}} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Plus size={16}/></button>
                                            <button aria-label={t("Delete Preset")} title={t("Delete Preset")} onClick={() => handleDelete(preset.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                        </div>
                        {filteredPresets.length === 0 && (
                            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-xl m-4 border-2 border-dashed border-slate-200">
                                <Book className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-500 font-bold">{t("Your Pricebook is empty.")}</p>
                                <p className="text-xs text-slate-400">{t("Use the library tools on the right to populate it instantly.")}</p>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-t-4 border-indigo-600 shadow-xl">
                        <div className="flex items-center gap-2 mb-6">
                            <Sparkles className="text-indigo-600" />
                            <h3 className="font-black uppercase tracking-widest text-sm">{t("Pricebook Library")}</h3>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4">{t("Master Vertical Population")}</p>
                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                            {AVAILABLE_VERTICALS.map(v => (
                                <button 
                                    key={v}
                                    onClick={() => handleLoadMaster(v)} 
                                    disabled={!!isPopulating} 
                                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">{getIcon(v)}</div>
                                        <span className="font-bold text-sm">{t(`${v} Master`)}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase group-hover:translate-x-1 transition-transform">{t("Import")}</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    <Card className="border-t-4 border-primary-600 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-primary-600" />
                                <h3 className="font-black uppercase tracking-widest text-sm">{t("Financial Rules")}</h3>
                            </div>
                            {hasUnsavedChanges && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                                    {t("Unsaved Changes")}
                                </span>
                            )}
                        </div>
                        <div className="space-y-4">
                            <Input 
                                type="number" 
                                step="0.01" 
                                label={t("Market Multiplier")} 
                                value={multiplier} 
                                onChange={(e) => {
                                    setMultiplier(e.target.value === '' ? 0 : parseFloat(e.target.value));
                                    setHasUnsavedChanges(true);
                                }} 
                                onBlur={() => {
                                    if (!multiplier || multiplier <= 0) setMultiplier(1.0);
                                    handleSaveFinancialRules();
                                }}
                                placeholder="1.0" 
                            />
                            <Input 
                                type="number" 
                                label={t("Labor Rate ($/hr)")} 
                                value={laborRate} 
                                onChange={(e) => {
                                    setLaborRate(e.target.value === '' ? 0 : parseInt(e.target.value));
                                    setHasUnsavedChanges(true);
                                }} 
                                onBlur={() => {
                                    if (!laborRate || laborRate <= 0) setLaborRate(120);
                                    handleSaveFinancialRules();
                                }}
                                placeholder="120" 
                            />
                            <Input 
                                type="number" 
                                label={t("Default Markup %")} 
                                value={markupPct} 
                                onChange={(e) => {
                                    setMarkupPct(e.target.value === '' ? 0 : parseInt(e.target.value));
                                    setHasUnsavedChanges(true);
                                }} 
                                onBlur={() => {
                                    if (markupPct === undefined || markupPct === null || markupPct < 0) setMarkupPct(50);
                                    handleSaveFinancialRules();
                                }}
                                placeholder="50" 
                            />

                            <Button
                                onClick={() => handleSaveFinancialRules()}
                                disabled={isSavingRules}
                                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                            >
                                {isSavingRules ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        <span>{t("Saving Rules...")}</span>
                                    </>
                                ) : hasUnsavedChanges ? (
                                    <>
                                        <Save size={16} />
                                        <span>{t("Save Financial Rules")}</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} className="text-emerald-300" />
                                        <span>{t("Save Financial Rules")}</span>
                                    </>
                                )}
                            </Button>

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-[10px] text-blue-700 dark:text-blue-300 font-medium italic">
                                {t("Note: These rules define how \"Retail Price\" is estimated in the table and how the AI Generator calculates proposals.")}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPreset.id ? t("Edit Pricebook Entry") : t("Create New Flat Rate Task")}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Select label={t("Category")} value={currentPreset.category ?? 'Other'} onChange={(e) => setCurrentPreset({...currentPreset, category: e.target.value as any})}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </Select>
                    <Input label={t("Task Name")} value={currentPreset.name || ''} onChange={(e) => setCurrentPreset({...currentPreset, name: e.target.value})} required placeholder={t("e.g. Capacitor Replacement")} />
                    <Textarea label={t("Public Description")} value={currentPreset.description || ''} onChange={(e: any) => setCurrentPreset({...currentPreset, description: e.target.value})} placeholder={t("What the customer sees on the proposal...")} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label={t("Internal Cost (Parts)")} type="number" step="0.01" value={currentPreset.baseCost ?? 0} onChange={(e) => setCurrentPreset({...currentPreset, baseCost: e.target.value === '' ? 0 : Number(e.target.value)})} />
                        <Input label={t("Labor Estimate (Hrs)")} type="number" step="0.1" value={currentPreset.avgLabor ?? 0} onChange={(e) => setCurrentPreset({...currentPreset, avgLabor: e.target.value === '' ? 0 : Number(e.target.value)})} />
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{t("Retail Calculation Preview")}</p>
                        <div className="text-2xl font-black text-emerald-600">
                            ${(((Number(currentPreset.baseCost) * (1 + (markupPct / 100))) + (Number(currentPreset.avgLabor) * laborRate)) * multiplier).toFixed(2)}
                        </div>
                    </div>
                    <Button type="submit" className="w-full h-12 shadow-lg shadow-primary-500/20">{t("Save to Pricebook")}</Button>
                </form>
            </Modal>

            {/* Ferguson API Modal */}
            <Modal isOpen={isFergusonModalOpen} onClose={() => setIsFergusonModalOpen(false)} title={t("Live Ferguson Parts Catalog")}>
                <form onSubmit={handleSearchFerguson} className="space-y-4">
                    <div className="p-3 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300 rounded text-xs font-semibold">
                        {t("Query live corporate pricing & availability. Modify the API endpoint below exactly as it is written in your Ferguson Developer Portal.")}
                    </div>
                    <Input label={t("Ferguson API Endpoint")} value={fergusonEndpoint} onChange={e => setFergusonEndpoint(e.target.value)} placeholder="e.g. pricing-availability/v1/products" />
                    <Input label={t("Search Keyword (Optional)")} value={fergusonQuery} onChange={e => setFergusonQuery(e.target.value)} placeholder="e.g. Water Heater or SKU" />
                    <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-600/30 text-white border-0" disabled={isFergusonLoading}>
                        {isFergusonLoading ? t('Querying Ferguson Master Server...') : t('Live Search')}
                    </Button>
                </form>

                {fergusonResults && (
                    <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 max-h-96 overflow-y-auto custom-scrollbar">
                        <h4 className="font-bold text-sm mb-2 text-slate-500 uppercase tracking-wider">{t("Raw Server Response")}</h4>
                        {fergusonResults.error ? (
                            <div className="text-red-500 font-bold">{fergusonResults.error}</div>
                        ) : (
                            <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(fergusonResults, null, 2)}
                            </pre>
                        )}
                        {!fergusonResults.error && (
                            <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col items-center">
                                <p className="text-xs font-medium text-slate-500 italic mb-4 text-center">{t("Once you can see your live material data returning in the box above, you can map the specific Fields (like \"Price\" and \"Part Name\") to spawn Instantly as Custom Tasks in your Pricebook!")}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default EstimatorSettings;
