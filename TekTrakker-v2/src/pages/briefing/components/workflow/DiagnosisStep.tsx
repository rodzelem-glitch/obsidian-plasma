import React from 'react';
import { FileSignature, Sparkles, ClipboardList, Import, Camera, ImageIcon, X, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { StoredFile, Proposal } from '../../../../types';

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
    hiddenFromCustomer?: boolean;
}

interface DiagnosisStepProps {
    setIsWaiverOpen: (open: boolean) => void;
    setIsImportModalOpen: (open: boolean) => void;
    buildProposal: () => void;
    onOpenProposalSelector?: () => void;
    checklists: ChecklistItem[];
    toggleChecklistItem: (id: string) => void;
    toggleChecklistVisibility?: (id: string) => void;
    toggleAllChecklistVisibility?: (hideMode: boolean) => void;
    notes: string;
    setNotes: (notes: string) => void;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto: () => void;
    files: StoredFile[];
    onDeletePhoto: (file: StoredFile) => void;
    onViewPhoto: (file: StoredFile) => void;
    onViewEditProposal?: (id: string) => void;
    linkedProposals?: Proposal[];
    setIsToolModalOpen: (open: boolean) => void;
    toolReadings?: {id: string, toolType: string, summary: string, date: string}[];
    onDeleteToolReading?: (id: string) => void;
    onOpenIndustryTools?: () => void;
    hidden?: boolean;
}

const AccordionSection = ({ id, title, icon: Icon, children, badge, isOpen, toggleSection }: any) => {
    return (
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm transition-all duration-200">
            <button 
                onClick={() => toggleSection(id)} 
                type="button"
                className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
                        <Icon size={18} className="text-primary-600" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{title}</h4>
                    {badge !== undefined && Number(badge) > 0 && (
                        <span className="bg-primary-100 text-primary-700 text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>
                    )}
                </div>
                <div className="p-1 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">
                    {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
    setIsWaiverOpen,
    setIsImportModalOpen,
    setIsToolModalOpen,
    buildProposal,
    onOpenProposalSelector,
    checklists,
    toggleChecklistItem,
    toggleChecklistVisibility,
    toggleAllChecklistVisibility,
    notes,
    setNotes,
    handlePhotoUpload,
    takeNativePhoto,
    files,
    onDeletePhoto,
    onViewPhoto,
    onViewEditProposal,
    linkedProposals = [],
    toolReadings = [],
    onDeleteToolReading,
    onOpenIndustryTools,
    hidden
}) => {
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        actions: true,
        proposals: linkedProposals.length > 0,
        readings: toolReadings.length > 0,
        checklist: false,
        findings: true,
        photos: false
    });

    if (hidden) return null;

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="space-y-4">
            <AccordionSection id="actions" title="Quick Actions & Integrations" icon={Sparkles} isOpen={expandedSections['actions']} toggleSection={toggleSection}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Button variant="secondary" onClick={() => setIsWaiverOpen(true)} className="flex items-center justify-center gap-2">
                    <FileSignature size={16}/> Sign Waivers
                </Button>
                <Button onClick={buildProposal} className="bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2">
                    <Sparkles size={16}/> Build Proposal
                </Button>
                <Button variant="outline" onClick={onOpenProposalSelector} className="flex items-center justify-center gap-2 border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100">
                    <Import size={16}/> Load Proposal
                </Button>
                <Button variant="secondary" onClick={() => setIsToolModalOpen(true)} className="flex items-center justify-center gap-2 border-primary-200 text-primary-600">
                    <ClipboardList size={16}/> Ext. Tool
                </Button>
                {onOpenIndustryTools && (
                    <Button variant="secondary" onClick={onOpenIndustryTools} className="flex items-center justify-center gap-2 border-indigo-200 text-indigo-600">
                        <Sparkles size={16} /> App Tools
                    </Button>
                )}
            </div>
            </AccordionSection>

            <AccordionSection id="proposals" title="Linked Proposals" icon={FileSignature} badge={linkedProposals.length} isOpen={expandedSections['proposals']} toggleSection={toggleSection}>
                {linkedProposals.length > 0 ? (
                    <div className="space-y-2">
                        {linkedProposals.map(p => (
                            <div key={p.id} onClick={() => onViewEditProposal && onViewEditProposal(p.id)} className="p-4 bg-purple-50/50 rounded-xl flex justify-between items-center border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-purple-900">{p.id}</p>
                                        {p.status === 'Accepted' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">✓ {p.selectedOption || 'Accepted'}</span>}
                                    </div>
                                    <p className="text-xs text-purple-700 mt-1">{p.items?.length || 0} line items • {p.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg text-purple-700">${(p.total || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
                        <p className="text-sm font-medium">No active proposals linked to this job.</p>
                        <p className="text-xs mt-1">Use the Quick Actions to build or load one.</p>
                    </div>
                )}
            </AccordionSection>
            
            <AccordionSection id="readings" title="Diagnostic Tools" icon={ClipboardList} badge={toolReadings.length} isOpen={expandedSections['readings']} toggleSection={toggleSection}>
                {toolReadings.length > 0 ? (
                    <div className="space-y-2">
                        {toolReadings.map(t => (
                            <div key={t.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-start border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-blue-300">{t.toolType}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{t.summary}</p>
                                </div>
                                {onDeleteToolReading && (
                                    <button onClick={() => onDeleteToolReading(t.id)} className="text-slate-400 hover:text-red-500 bg-white shadow-sm p-1.5 rounded-full" aria-label="Remove reading">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
                        <p className="text-sm font-medium">No tool readings captured.</p>
                    </div>
                )}
            </AccordionSection>
            
            <AccordionSection id="checklist" title="Diagnosis Checklist" icon={ClipboardList} badge={checklists.filter(c => c.completed).length + '/' + checklists.length} isOpen={expandedSections['checklist']} toggleSection={toggleSection}>
                <div className="flex justify-end items-center mb-4 gap-2">
                    {toggleAllChecklistVisibility && checklists.length > 0 && (
                        <div className="flex items-center gap-2 mr-auto">
                            <button onClick={() => toggleAllChecklistVisibility(false)} className="text-[10px] uppercase font-black text-primary-600 hover:underline">Show All</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => toggleAllChecklistVisibility(true)} className="text-[10px] uppercase font-black text-slate-400 hover:underline">Hide All</button>
                        </div>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1 bg-white shadow-sm hover:shadow">
                        <Import size={14}/> Import Templates
                    </Button>
                </div>
                {checklists.length > 0 ? (
                    <div className="space-y-2">
                        {checklists.map(item => (
                            <div key={item.id} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border hover:bg-slate-100 transition-colors">
                                <label className="flex items-start gap-3 cursor-pointer flex-1">
                                    <input 
                                        type="checkbox" 
                                        checked={item.completed} 
                                        onChange={() => toggleChecklistItem(item.id)}
                                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                                    />
                                    <span className={`text-sm leading-relaxed ${item.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
                                        {item.label}
                                    </span>
                                </label>
                                {toggleChecklistVisibility && (
                                    <button 
                                        onClick={() => toggleChecklistVisibility(item.id)}
                                        className={`ml-2 text-[10px] font-bold px-2 py-1 rounded transition-colors shrink-0 ${item.hiddenFromCustomer ? 'bg-slate-200 text-slate-500 line-through dark:bg-slate-700 dark:text-slate-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 border border-primary-200 dark:border-primary-800'}`}
                                        title={item.hiddenFromCustomer ? "Hidden from Customer Portal" : "Visible in Customer Portal"}
                                    >
                                        {item.hiddenFromCustomer ? 'Hidden' : 'Visible'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50">
                        <p className="text-sm font-medium text-slate-500">No checklist items yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Import from your organization's templates.</p>
                    </div>
                )}
            </AccordionSection>

            <AccordionSection id="findings" title="Pre-Work Findings" icon={Edit3} isOpen={expandedSections['findings']} toggleSection={toggleSection}>
                <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-slate-600">Document the diagnosis</p>
                    <VoiceInput onResult={(text) => setNotes(notes ? notes + '\n' + text : text)} />
                </div>
                <Textarea 
                    rows={5} 
                    placeholder="Describe the issue found, diagnostic steps, and recommendations..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="bg-slate-50"
                />
            </AccordionSection>

            <AccordionSection id="photos" title="Job Photos" icon={Camera} badge={files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work').length} isOpen={expandedSections['photos']} toggleSection={toggleSection}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex gap-3 w-full md:w-auto h-24">
                        <button 
                            type="button"
                            onClick={takeNativePhoto}
                            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white w-24 h-24 shadow-sm"
                            title="Camera"
                        >
                            <Camera size={24} className="text-slate-400 mb-2"/>
                            <span className="text-xs font-bold text-slate-500">Camera</span>
                        </button>
                        <label htmlFor="prework-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors w-24 h-24 shadow-sm">
                            <ImageIcon size={24} className="text-slate-400 mb-2"/>
                            <span className="text-xs font-bold text-slate-500">Gallery</span>
                            <input id="prework-gallery" type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'Pre-Work')} className="hidden" />
                        </label>
                    </div>
                    
                    <div className="flex-1 flex overflow-x-auto gap-3 pb-2 custom-scrollbar">
                        {files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work').map(f => (
                            <div key={f.id} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                <img 
                                    src={f.dataUrl || (f as any).url} 
                                    alt={f.fileName} 
                                    className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-300"
                                    onClick={() => onViewPhoto(f)}
                                />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeletePhoto(f); }}
                                    className="absolute top-1 right-1 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm backdrop-blur-sm"
                                    title="Delete Photo"
                                >
                                    <X size={12}/>
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-[9px] text-white truncate px-2 py-1 pointer-events-none">
                                    {f.fileName}
                                </div>
                            </div>
                        ))}
                        {files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work').length === 0 && (
                            <div className="flex-1 border-2 border-dashed rounded-xl border-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium h-24 min-w-[200px]">
                                No pre-work photos uploaded.
                            </div>
                        )}
                    </div>
                </div>
            </AccordionSection>
        </div>
    );
};

export default DiagnosisStep;
