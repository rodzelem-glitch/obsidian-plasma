
import React from 'react';
import { Scan, PhoneCall, Camera, CheckCircle, X, Package, Plus, AlertCircle, Wrench, Thermometer, Edit3 } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import Select from '../../../../components/ui/Select';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { StoredFile, Job } from '../../../../types';
import { useLanguage } from 'context/LanguageContext';

const mapConditionToHealth = (condition?: string): 'Good' | 'Fair' | 'Poor' | 'Critical' => {
    if (!condition) return 'Good';
    const c = condition.toLowerCase();
    if (c === 'excellent' || c === 'good') return 'Good';
    if (c === 'fair') return 'Fair';
    if (c === 'poor') return 'Poor';
    if (c === 'critical') return 'Critical';
    return 'Good';
};

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
    partsUsed: NonNullable<Job['partsUsed']>;
    onRemovePart: (index: number) => void;
    assets?: any[];
    onAssignPhotoToAsset?: (fileId: string, assetId: string) => void;
    onUpdatePhotoLabel?: (fileId: string, label: string) => void;
    hidden?: boolean;
    repairPostponed: boolean;
    setRepairPostponed: (val: boolean) => void;
    repairPostponedReason: string;
    setRepairPostponedReason: (val: string) => void;
    
    // Tool readings
    setIsToolModalOpen?: (open: boolean) => void;
    toolReadings?: any[];
    onDeleteToolReading?: (id: string) => void;

    // Unit States
    unitStates?: any[];
    setUnitStates?: (states: any[]) => void;
    onEditAsset?: (asset: any) => void;
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
    assets = [],
    onAssignPhotoToAsset,
    onUpdatePhotoLabel,
    hidden,
    repairPostponed,
    setRepairPostponed,
    repairPostponedReason,
    setRepairPostponedReason,
    setIsToolModalOpen,
    toolReadings = [],
    onDeleteToolReading,
    unitStates = [],
    setUnitStates,
    onEditAsset
}) => {
    const { t } = useLanguage();

    if (hidden) return null;
    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h4 className="font-bold text-blue-700 dark:text-blue-300">{t("Job In Progress")}</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{t("Track all parts and refrigerant used.")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsScannerOpen(true)} className="w-auto h-10 text-xs bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2">
                        <Scan size={14}/> {t("Scan Part")}
                    </Button>
                    <Button variant="secondary" onClick={() => setIsPartModalOpen(true)} className="w-auto h-10 text-xs flex items-center gap-2 bg-white dark:bg-slate-800 border-slate-200">
                        <Package size={14}/> {t("Add Part")}
                    </Button>
                    <Button variant="secondary" onClick={() => setIsRefrigerantModalOpen(true)} className="w-auto h-10 text-xs flex items-center gap-2 border-blue-200 text-blue-600 bg-white dark:bg-slate-800">
                        <CheckCircle size={14}/> {t("Log Refrigerant")}
                    </Button>
                    <Button onClick={() => setIsLiveAssistOpen(true)} className="w-auto h-10 text-xs bg-red-600 hover:bg-red-700 flex items-center gap-2">
                        <PhoneCall size={14}/> {t("AI Assist")}
                    </Button>
                </div>
            </div>

            {/* Parts Used List */}
            {partsUsed && partsUsed.length > 0 && (
                <Card className="border-amber-100 bg-amber-50/30 dark:border-amber-900/20 dark:bg-amber-900/5">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Package size={14}/> {t("Parts & Materials Added")}
                    </h4>
                    <div className="space-y-2">
                        {partsUsed.map((part, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{part.name}</p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black">{t("QTY")}: {part.quantity} • {part.location || 'Truck'}</p>
                                </div>
                                <button title={t("Remove Part")} aria-label={t("Remove Part")} onClick={() => onRemovePart(i)} className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                                    <X size={14}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card className="border-amber-200 bg-amber-50/10 dark:border-amber-900/30 dark:bg-amber-950/5">
                <div className="flex items-center gap-3">
                    <input 
                        id="postpone-repair-chk"
                        type="checkbox"
                        checked={repairPostponed}
                        onChange={e => setRepairPostponed(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="postpone-repair-chk" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        {t("Repair Postponed / Return Visit Required")}
                    </label>
                </div>
                {repairPostponed && (
                    <div className="mt-4 animate-fade-in">
                        <Select 
                            label={t("Reason for Postponement")} 
                            value={repairPostponedReason} 
                            onChange={e => setRepairPostponedReason(e.target.value)}
                        >
                            <option value="">-- {t("Select a Reason")} --</option>
                            <option value="Waiting for Parts">{t("Waiting for Parts")}</option>
                            <option value="Waiting for Approval">{t("Waiting for Customer/Insurance Approval")}</option>
                            <option value="Tech Returning Another Day">{t("Technician returning another day")}</option>
                            <option value="Other">{t("Other (specify in notes below)")}</option>
                        </Select>
                    </div>
                )}
            </Card>

            {/* Post-Repair / Verification Tool Readings */}
            <Card>
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold flex items-center gap-2">
                        <Wrench size={16} className="text-indigo-500" />
                        {t("Post-Repair / Verification Tool Readings")}
                    </h4>
                    {setIsToolModalOpen && (
                        <Button 
                            type="button"
                            variant="secondary" 
                            onClick={() => setIsToolModalOpen(true)} 
                            className="w-auto h-8 text-xs flex items-center gap-1 border-indigo-200 text-indigo-600 bg-white dark:bg-slate-800"
                        >
                            <Plus size={12}/> {t("Add Reading")}
                        </Button>
                    )}
                </div>
                
                {toolReadings.filter(r => r.phase === 'after').length > 0 ? (
                    <div className="space-y-2 text-left">
                        {toolReadings.filter(r => r.phase === 'after').map(reading => (
                            <div key={reading.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-start border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div>
                                    <p className="font-bold text-xs text-slate-800 dark:text-blue-300 flex items-center gap-2 flex-wrap">
                                        {reading.toolType}
                                        {reading.assetId && assets && (() => {
                                            const assocAsset = assets.find(a => a.id === reading.assetId);
                                            return assocAsset ? (
                                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase rounded-full tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                                                    {assocAsset.name || assocAsset.type}
                                                </span>
                                            ) : null;
                                        })()}
                                    </p>
                                    <p className="text-[11px] text-slate-650 dark:text-slate-400 mt-1 leading-relaxed">{reading.summary}</p>
                                </div>
                                {onDeleteToolReading && (
                                    <button onClick={() => onDeleteToolReading(reading.id)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-750 shadow-sm p-1 rounded-full" aria-label="Remove reading">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/40 text-slate-400 text-xs">
                        {t("No post-repair tool readings captured.")}
                    </div>
                )}
            </Card>

            {/* Systems Health / Status Transitions */}
            {assets.length > 0 && (
                <Card>
                    <h4 className="font-bold flex items-center gap-2 mb-3">
                        <Thermometer size={16} className="text-indigo-500" />
                        {t("Systems Health / Status Transitions")}
                    </h4>
                    <p className="text-xs text-slate-550 dark:text-slate-400 mb-4 leading-relaxed text-left">
                        {t("Record unit condition before and after performing repairs.")}
                    </p>
                    <div className="space-y-4">
                        {assets.map((asset) => {
                            const stateObj = unitStates.find(s => s.assetId === asset.id) || { 
                                health: mapConditionToHealth(asset.condition), 
                                healthBefore: mapConditionToHealth(asset.condition),
                                healthAfter: 'Good',
                                diagnosis: '', 
                                repair: '', 
                                recommendations: '' 
                            };
                            const healthBefore = stateObj.healthBefore || stateObj.health || mapConditionToHealth(asset.condition);
                            const healthAfter = stateObj.healthAfter || 'Good';
                            
                            const handleUpdateUnitState = (assetId: string, field: string, val: string) => {
                                if (setUnitStates) {
                                    const updated = unitStates.map(s => {
                                        if (s.assetId === assetId) {
                                            return { ...s, [field]: val };
                                        }
                                        return s;
                                    });
                                    // if not in list, add it
                                    if (!unitStates.some(s => s.assetId === assetId)) {
                                        updated.push({
                                            assetId,
                                            health: field === 'health' || field === 'healthBefore' ? val : mapConditionToHealth(asset.condition),
                                            healthBefore: field === 'healthBefore' ? val : mapConditionToHealth(asset.condition),
                                            healthAfter: field === 'healthAfter' ? val : 'Good',
                                            [field]: val
                                        });
                                    }
                                    setUnitStates(updated);
                                }
                            };

                            return (
                                <div key={asset.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm text-left space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="font-bold text-sm text-slate-850 dark:text-white flex items-center gap-2">
                                            <span>{asset.name || asset.type}</span>
                                            <span className="text-xs text-slate-400 font-medium">({asset.serial || asset.serialNumber || 'No S/N'})</span>
                                            {onEditAsset && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditAsset(asset)}
                                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                                                    title={t("Edit Equipment Details")}
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                            healthAfter === 'Good' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                            healthAfter === 'Fair' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                            healthAfter === 'Poor' ? 'bg-orange-100 text-orange-850 border border-orange-200' :
                                            'bg-red-100 text-red-800 border border-red-200'
                                        }`}>
                                            {healthBefore} {healthBefore !== healthAfter && ` ➔ ${healthAfter}`}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1.5">{t("Before Repair")}</label>
                                            <div className="grid grid-cols-4 gap-1">
                                                {['Good', 'Fair', 'Poor', 'Critical'].map((val) => {
                                                    const isSelected = healthBefore === val;
                                                    const colorClasses = 
                                                        val === 'Good' ? 'bg-emerald-500 text-white border-emerald-400' :
                                                        val === 'Fair' ? 'bg-amber-500 text-white border-amber-400' :
                                                        val === 'Poor' ? 'bg-orange-500 text-white border-orange-400' :
                                                        'bg-rose-500 text-white border-rose-455';
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={val}
                                                            onClick={() => {
                                                                handleUpdateUnitState(asset.id, 'healthBefore', val);
                                                                handleUpdateUnitState(asset.id, 'health', val);
                                                            }}
                                                            className={`py-1 text-[9px] font-bold border rounded-lg transition-all text-center cursor-pointer ${
                                                                isSelected ? colorClasses : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                                                            }`}
                                                        >
                                                            {t(val)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-black text-slate-455 uppercase tracking-widest mb-1.5">{t("After Repair")}</label>
                                            <div className="grid grid-cols-4 gap-1">
                                                {['Good', 'Fair', 'Poor', 'Critical'].map((val) => {
                                                    const isSelected = healthAfter === val;
                                                    const colorClasses = 
                                                        val === 'Good' ? 'bg-emerald-500 text-white border-emerald-400' :
                                                        val === 'Fair' ? 'bg-amber-500 text-white border-amber-400' :
                                                        val === 'Poor' ? 'bg-orange-500 text-white border-orange-400' :
                                                        'bg-rose-500 text-white border-rose-455';
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={val}
                                                            onClick={() => handleUpdateUnitState(asset.id, 'healthAfter', val)}
                                                            className={`py-1 text-[9px] font-bold border rounded-lg transition-all text-center cursor-pointer ${
                                                                isSelected ? colorClasses : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                                                            }`}
                                                        >
                                                            {t(val)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">{repairPostponed ? t("Postponement Explanation / Notes") : t("Repair Notes")}</h4>
                    <VoiceInput onResult={(text) => setWorkNotes(workNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={4} 
                    placeholder={repairPostponed ? t("Describe why the repair is postponed and next steps...") : t("Describe work performed in detail...")} 
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
                        <span className="text-[10px] font-bold text-slate-500">{t("Camera")}</span>
                    </button>
                    <label htmlFor="repair-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900 dark:border-slate-700">
                        <Plus size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] font-bold text-slate-500">{t("Gallery")}</span>
                        <input id="repair-gallery" type="file" multiple accept="image/*" onChange={(e) => handlePhotoUpload(e, 'After')} className="hidden" />
                    </label>
                </div>
                <div className="flex items-start overflow-x-auto gap-3 pb-2 custom-scrollbar w-full">
                    {files.filter(f => { const lbl = f.metadata?.label || f.label; return lbl === 'Completed Work' || lbl === 'After'; }).map(f => (
                        <div key={f.id} className="relative w-32 rounded-xl flex flex-col border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md shrink-0 overflow-hidden group">
                            <div className="relative w-full h-24 overflow-hidden bg-slate-900">
                                <button 
                                    type="button"
                                    onClick={() => onViewPhoto(f)}
                                    className="w-full h-full p-0 border-none outline-none block"
                                >
                                    <img 
                                        src={f.dataUrl || f.url} 
                                        alt={f.fileName} 
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                    />
                                </button>
                                <button 
                                    title="Delete Photo"
                                    aria-label="Delete Photo"
                                    onClick={(e) => { e.stopPropagation(); onDeletePhoto(f); }}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg z-10"
                                >
                                    <X size={10}/>
                                </button>
                            </div>
                            <div className="p-1.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-1">
                                <select
                                    value={f.metadata?.assetId || ''}
                                    onChange={(e) => onAssignPhotoToAsset?.(f.id, e.target.value)}
                                    className="w-full text-[10px] py-1 px-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium cursor-pointer"
                                >
                                    <option value="">{t("General Photo")}</option>
                                    {assets && assets.map(asset => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.name || `${asset.brand} ${t(asset.type)}`} {asset.serial ? `(${asset.serial.slice(-4)})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={f.metadata?.label || f.label || ''}
                                    onChange={(e) => onUpdatePhotoLabel?.(f.id, e.target.value)}
                                    className="w-full text-[10px] py-1 px-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium cursor-pointer"
                                >
                                    <option value="Before">{t("Before")}</option>
                                    <option value="After">{t("After")}</option>
                                    <option value="Pre-Work">{t("Pre-Work")}</option>
                                    <option value="Completed Work">{t("Completed Work")}</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RepairStep;
