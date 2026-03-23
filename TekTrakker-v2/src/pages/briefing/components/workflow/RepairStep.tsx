
import React from 'react';
import { Scan, PhoneCall, Camera, CheckCircle, X, Package, Plus } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { StoredFile } from '../../../../types';

interface RepairStepProps {
    setIsScannerOpen: (open: boolean) => void;
    setIsLiveAssistOpen: (open: boolean) => void;
    workNotes: string;
    setWorkNotes: (notes: string) => void;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto: () => void;
    files: StoredFile[];
    onDeletePhoto: (file: StoredFile) => void;
    onViewPhoto: (file: StoredFile) => void;
    setIsRefrigerantModalOpen: (open: boolean) => void;
    setIsPartModalOpen: (open: boolean) => void;
    partsUsed: any[];
    onRemovePart: (index: number) => void;
    hidden?: boolean;
}

const RepairStep: React.FC<RepairStepProps> = ({
    setIsScannerOpen,
    setIsLiveAssistOpen,
    setIsRefrigerantModalOpen,
    setIsPartModalOpen,
    workNotes,
    setWorkNotes,
    handlePhotoUpload,
    takeNativePhoto,
    files,
    onDeletePhoto,
    onViewPhoto,
    partsUsed,
    onRemovePart,
    hidden
}) => {
    if (hidden) return null;
    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h4 className="font-bold text-blue-700 dark:text-blue-300">Job In Progress</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Track all parts and refrigerant used.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsScannerOpen(true)} className="w-auto h-10 text-xs bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2">
                        <Scan size={14}/> Scan Part
                    </Button>
                    <Button variant="secondary" onClick={() => setIsPartModalOpen(true)} className="w-auto h-10 text-xs flex items-center gap-2 bg-white dark:bg-slate-800 border-slate-200">
                        <Package size={14}/> Add Part
                    </Button>
                    <Button variant="secondary" onClick={() => setIsRefrigerantModalOpen(true)} className="w-auto h-10 text-xs flex items-center gap-2 border-blue-200 text-blue-600 bg-white dark:bg-slate-800">
                        <CheckCircle size={14}/> Log Refrigerant
                    </Button>
                    <Button onClick={() => setIsLiveAssistOpen(true)} className="w-auto h-10 text-xs bg-red-600 hover:bg-red-700 flex items-center gap-2">
                        <PhoneCall size={14}/> Live Supervisor
                    </Button>
                </div>
            </div>

            {/* Parts Used List */}
            {partsUsed && partsUsed.length > 0 && (
                <Card className="border-amber-100 bg-amber-50/30 dark:border-amber-900/20 dark:bg-amber-900/5">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Package size={14}/> Parts & Materials Added
                    </h4>
                    <div className="space-y-2">
                        {partsUsed.map((part, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{part.name}</p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black">QTY: {part.quantity} • {part.location || 'Truck'}</p>
                                </div>
                                <button onClick={() => onRemovePart(i)} className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                                    <X size={14}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">Repair Notes</h4>
                    <VoiceInput onResult={(text) => setWorkNotes(workNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={4} 
                    placeholder="Describe work performed in detail..." 
                    value={workNotes} 
                    onChange={e => setWorkNotes(e.target.value)}
                />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        type="button"
                        onClick={takeNativePhoto}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white w-full dark:bg-slate-900 dark:border-slate-700"
                    >
                        <Camera size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] font-bold text-slate-500">Camera</span>
                    </button>
                    <label htmlFor="repair-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900 dark:border-slate-700">
                        <Plus size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] font-bold text-slate-500">Gallery</span>
                        <input id="repair-gallery" type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'Completed Work')} className="hidden" />
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    {files.filter(f => (f.metadata?.label || (f as any).label) === 'Completed Work').map(f => (
                        <div key={f.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-green-200/50 shadow-sm">
                            <img 
                                src={f.dataUrl || (f as any).url} 
                                alt={f.fileName} 
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => onViewPhoto(f)}
                            />
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeletePhoto(f); }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                                <X size={10}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RepairStep;
