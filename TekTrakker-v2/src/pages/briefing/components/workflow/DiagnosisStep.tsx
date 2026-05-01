import React from 'react';
import { FileSignature, Sparkles, ClipboardList, Import, Camera, ImageIcon, X } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { StoredFile } from '../../../../types';

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
}

interface DiagnosisStepProps {
    setIsWaiverOpen: (open: boolean) => void;
    setIsImportModalOpen: (open: boolean) => void;
    buildProposal: () => void;
    checklists: ChecklistItem[];
    toggleChecklistItem: (id: string) => void;
    notes: string;
    setNotes: (notes: string) => void;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto: () => void;
    files: StoredFile[];
    onDeletePhoto: (file: StoredFile) => void;
    onViewPhoto: (file: StoredFile) => void;
    setIsToolModalOpen: (open: boolean) => void;
    toolReadings?: {id: string, toolType: string, summary: string, date: string}[];
    onDeleteToolReading?: (id: string) => void;
    onOpenIndustryTools?: () => void;
    hidden?: boolean;
}

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
    setIsWaiverOpen,
    setIsImportModalOpen,
    setIsToolModalOpen,
    buildProposal,
    checklists,
    toggleChecklistItem,
    notes,
    setNotes,
    handlePhotoUpload,
    takeNativePhoto,
    files,
    onDeletePhoto,
    onViewPhoto,
    toolReadings = [],
    onDeleteToolReading,
    onOpenIndustryTools,
    hidden
}) => {
    if (hidden) return null;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="secondary" onClick={() => setIsWaiverOpen(true)} className="flex items-center justify-center gap-2">
                    <FileSignature size={16}/> Sign Waivers
                </Button>
                <Button onClick={buildProposal} className="bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2">
                    <Sparkles size={16}/> Build Proposal
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
            
            {toolReadings.length > 0 && (
                <Card>
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary-600"/> Tool Readings & Diagnostics
                    </h4>
                    <div className="space-y-2">
                        {toolReadings.map(t => (
                            <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-start border border-slate-200 dark:border-slate-700">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-blue-300">{t.toolType}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t.summary}</p>
                                </div>
                                {onDeleteToolReading && (
                                    <button onClick={() => onDeleteToolReading(t.id)} className="text-slate-400 hover:text-red-500 mt-1" aria-label="Remove reading">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary-600"/> Diagnosis Checklist
                    </h4>
                    <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1">
                        <Import size={14}/> Import
                    </Button>
                </div>
                {checklists.length > 0 ? (
                    <div className="space-y-2">
                        {checklists.map(item => (
                            <label key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded border hover:bg-slate-100 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={item.completed} 
                                    onChange={() => toggleChecklistItem(item.id)}
                                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className={`text-sm ${item.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {item.label}
                                </span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg bg-slate-50">
                        <p className="text-xs text-slate-400">No checklist items yet. Import from documents.</p>
                    </div>
                )}
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">Pre-Work Findings</h4>
                    <VoiceInput onResult={(text) => setNotes(notes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={4} 
                    placeholder="Describe the issue found..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid grid-cols-2 gap-2">
                    <button 
                        type="button"
                        onClick={takeNativePhoto}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white w-full"
                        title="Camera"
                    >
                        <Camera size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] font-bold text-slate-500">Camera</span>
                    </button>
                    <label htmlFor="prework-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <ImageIcon size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] font-bold text-slate-500">Gallery</span>
                        <input id="prework-gallery" type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'Pre-Work')} className="hidden" />
                    </label>
                </div>
                <div className="flex flex-col gap-2">
                    {files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work').map(f => (
                        <div key={f.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                            <img 
                                src={f.dataUrl || (f as any).url} 
                                alt={f.fileName} 
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => onViewPhoto(f)}
                            />
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeletePhoto(f); }}
                                className="absolute top-1 right-1 p-1 bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm shadow-black/20"
                                title="Delete Photo"
                            >
                                <X size={10}/>
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[8px] text-white truncate px-1 pointer-events-none">
                                {f.fileName}
                            </div>
                        </div>
                    ))}
                    {files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work').length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">No pre-work photos.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiagnosisStep;
