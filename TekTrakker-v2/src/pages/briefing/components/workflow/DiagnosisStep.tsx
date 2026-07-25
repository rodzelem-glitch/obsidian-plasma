import React from 'react';
import { FileSignature, Sparkles, ClipboardList, Import, Camera, ImageIcon, X, ChevronDown, ChevronUp, Edit3, Wrench, CheckCircle, Trash2, MapPin, Layers } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { StoredFile, Proposal } from '../../../../types';
import { useLanguage } from 'context/LanguageContext';

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
    onCheckAll?: () => void;
    notes: string;
    setNotes: (notes: string) => void;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto: () => void;
    files: StoredFile[];
    onDeletePhoto: (file: StoredFile) => void;
    onViewPhoto: (file: StoredFile) => void;
    onViewEditProposal?: (id: string) => void;
    onUnlinkProposal?: (id: string) => void;
    linkedProposals?: Proposal[];
    setIsToolModalOpen: (open: boolean) => void;
    toolReadings?: {id: string, toolType: string, summary: string, date: string, phase?: 'before' | 'after', assetId?: string, reportUrl?: string}[];
    onDeleteToolReading?: (id: string) => void;
    onOpenIndustryTools?: () => void;
    assets?: any[];
    unitStates?: Array<{
        assetId: string;
        health?: 'Good' | 'Fair' | 'Poor' | 'Critical';
        healthBefore?: 'Good' | 'Fair' | 'Poor' | 'Critical';
        healthAfter?: 'Good' | 'Fair' | 'Poor' | 'Critical';
        diagnosis?: string;
        repair?: string;
        recommendations?: string;
    }>;
    setUnitStates?: (states: any[]) => void;
    onAssignPhotoToAsset?: (fileId: string, assetId: string) => void;
    onUpdatePhotoLabel?: (fileId: string, label: string) => void;
    onEditAsset?: (asset: any) => void;
    hidden?: boolean;
    serviceLocations?: any[];
}


interface AccordionSectionProps {
    id: string;
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    badge?: number | string;
    isOpen: boolean;
    toggleSection: (id: string) => void;
}

const AccordionSection = ({ id, title, icon: Icon, children, badge, isOpen, toggleSection }: AccordionSectionProps) => {
    return (
        <div id={id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm transition-all duration-200">
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

const mapConditionToHealth = (condition?: string): 'Good' | 'Fair' | 'Poor' | 'Critical' => {
    if (!condition) return 'Good';
    const c = condition.toLowerCase();
    if (c === 'excellent' || c === 'good') return 'Good';
    if (c === 'fair') return 'Fair';
    if (c === 'poor') return 'Poor';
    if (c === 'critical') return 'Critical';
    return 'Good';
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
    onCheckAll,
    notes,
    setNotes,
    handlePhotoUpload,
    takeNativePhoto,
    files,
    onDeletePhoto,
    onViewPhoto,
    onViewEditProposal,
    onUnlinkProposal,
    linkedProposals = [],
    toolReadings = [],
    onDeleteToolReading,
    onOpenIndustryTools,
    assets = [],
    unitStates = [],
    setUnitStates,
    onAssignPhotoToAsset,
    onUpdatePhotoLabel,
    onEditAsset,
    hidden,
    serviceLocations = []
}) => {
    const { t } = useLanguage();
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        actions: true,
        proposals: linkedProposals.length > 0,
        readings: toolReadings.length > 0,
        unitStatesSection: true,
        checklist: false,
        findings: true,
        photos: false
    });
    const [expandedUnits, setExpandedUnits] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (linkedProposals.length > 0) {
            setExpandedSections(prev => ({ ...prev, proposals: true }));
        }
    }, [linkedProposals.length]);

    if (hidden) return null;

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleUpdateUnitState = (assetId: string, field: string, value: any) => {
        if (!setUnitStates) return;
        const existingStates = [...(unitStates || [])];
        const idx = existingStates.findIndex(s => s.assetId === assetId);
        if (idx > -1) {
            existingStates[idx] = { ...existingStates[idx], [field]: value };
        } else {
            const asset = assets.find(a => a.id === assetId);
            const defaultHealth = mapConditionToHealth(asset?.condition);
            existingStates.push({ assetId, health: defaultHealth, [field]: value });
        }
        setUnitStates(existingStates);
    };

    const renderAssetCard = (asset: any) => {
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
        const isExpanded = expandedUnits[asset.id];
        
        return (
            <div key={asset.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-primary-300">
                <div 
                    onClick={() => setExpandedUnits(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))}
                    className="w-full flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                {asset.name || asset.type} {asset.brand ? `• ${asset.brand}` : ''} {asset.model ? `(${asset.model})` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                {asset.assetTag ? `Tag: ${asset.assetTag}` : `Serial: ${asset.serial || 'N/A'}`}
                                {asset.physicalLocation && ` | Loc: ${asset.physicalLocation}`}
                            </span>
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                         {onEditAsset && (
                             <button
                                 type="button"
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     onEditAsset(asset);
                                 }}
                                 className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                                 title={t("Edit Equipment Details")}
                             >
                                 <Edit3 size={14} />
                             </button>
                         )}
                         <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            healthAfter === 'Good' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            healthAfter === 'Fair' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            healthAfter === 'Poor' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                             {healthBefore} {healthBefore !== healthAfter && ` ➔ ${healthAfter}`}
                         </span>
                         <div className="p-1 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">
                             {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                         </div>
                     </div>
                </div>
                
                {isExpanded && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-top-1 duration-155">
                        {/* Health selector group */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t("Unit Health Status (Before Repair)")}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: 'Good', label: t('Good'), color: 'emerald', bgClass: 'bg-emerald-500 border-emerald-400 text-white', textClass: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                                    { value: 'Fair', label: t('Fair'), color: 'amber', bgClass: 'bg-amber-500 border-amber-400 text-white', textClass: 'text-amber-700 border-amber-200 hover:bg-emerald-50' },
                                    { value: 'Poor', label: t('Poor'), color: 'orange', bgClass: 'bg-orange-500 border-orange-400 text-white', textClass: 'text-orange-700 border-orange-200 hover:bg-emerald-50' },
                                    { value: 'Critical', label: t('Critical'), color: 'rose', bgClass: 'bg-rose-500 border-rose-400 text-white', textClass: 'text-rose-700 border-rose-200 hover:bg-emerald-50' }
                                ].map((item) => {
                                    const isSelected = healthBefore === item.value;
                                    return (
                                        <button
                                            type="button"
                                            key={item.value}
                                            onClick={() => {
                                                handleUpdateUnitState(asset.id, 'healthBefore', item.value);
                                                handleUpdateUnitState(asset.id, 'health', item.value);
                                            }}
                                            className={`py-2 px-1 text-[11px] font-bold border rounded-xl transition-all duration-200 flex items-center justify-center gap-1 shadow-sm cursor-pointer ${
                                                isSelected ? item.bgClass : item.textClass + ' bg-white dark:bg-slate-800'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="mt-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t("Unit Health Status (After Repair)")}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: 'Good', label: t('Good'), color: 'emerald', bgClass: 'bg-emerald-500 border-emerald-400 text-white', textClass: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                                    { value: 'Fair', label: t('Fair'), color: 'amber', bgClass: 'bg-amber-500 border-amber-400 text-white', textClass: 'text-amber-700 border-amber-200 hover:bg-emerald-50' },
                                    { value: 'Poor', label: t('Poor'), color: 'orange', bgClass: 'bg-orange-500 border-orange-400 text-white', textClass: 'text-orange-700 border-orange-200 hover:bg-emerald-50' },
                                    { value: 'Critical', label: t('Critical'), color: 'rose', bgClass: 'bg-rose-500 border-rose-400 text-white', textClass: 'text-rose-700 border-rose-200 hover:bg-emerald-50' }
                                ].map((item) => {
                                    const isSelected = healthAfter === item.value;
                                    return (
                                        <button
                                            type="button"
                                            key={item.value}
                                            onClick={() => handleUpdateUnitState(asset.id, 'healthAfter', item.value)}
                                            className={`py-2 px-1 text-[11px] font-bold border rounded-xl transition-all duration-200 flex items-center justify-center gap-1 shadow-sm cursor-pointer ${
                                                isSelected ? item.bgClass : item.textClass + ' bg-white dark:bg-slate-800'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Unit diagnosis text input */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Diagnosis / Problems Found")}</label>
                                <VoiceInput onResult={(text) => handleUpdateUnitState(asset.id, 'diagnosis', (stateObj.diagnosis || '') + ' ' + text)} />
                            </div>
                            <Textarea
                                rows={2}
                                placeholder={t("What did you diagnose on this specific unit?")}
                                value={stateObj.diagnosis || ''}
                                onChange={e => handleUpdateUnitState(asset.id, 'diagnosis', e.target.value)}
                                className="bg-slate-50/50 text-xs py-2 px-3"
                            />
                        </div>

                        {/* Unit repair text input */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Repairs / Work Done")}</label>
                                <VoiceInput onResult={(text) => handleUpdateUnitState(asset.id, 'repair', (stateObj.repair || '') + ' ' + text)} />
                            </div>
                            <Textarea
                                rows={2}
                                placeholder={t("What adjustments or repairs did you perform on this unit?")}
                                value={stateObj.repair || ''}
                                onChange={e => handleUpdateUnitState(asset.id, 'repair', e.target.value)}
                                className="bg-slate-50/50 text-xs py-2 px-3"
                            />
                        </div>

                        {/* Unit specific recommendations */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Unit Recommendations")}</label>
                                <VoiceInput onResult={(text) => handleUpdateUnitState(asset.id, 'recommendations', (stateObj.recommendations || '') + ' ' + text)} />
                            </div>
                            <Textarea
                                rows={2}
                                placeholder={t("Any specific recommendations for this system?")}
                                value={stateObj.recommendations || ''}
                                onChange={e => handleUpdateUnitState(asset.id, 'recommendations', e.target.value)}
                                className="bg-slate-50/50 text-xs py-2 px-3"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">

            <AccordionSection id="actions" title={t("Quick Actions & Integrations")} icon={Sparkles} isOpen={expandedSections['actions']} toggleSection={toggleSection}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Button variant="secondary" onClick={() => setIsWaiverOpen(true)} className="flex items-center justify-center gap-2">
                    <FileSignature size={16}/> {t("Sign Waivers")}
                </Button>
                <Button onClick={buildProposal} className="bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2">
                    <Sparkles size={16}/> {t("Build Proposal")}
                </Button>
                <Button variant="outline" onClick={onOpenProposalSelector} className="flex items-center justify-center gap-2 border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100">
                    <Import size={16}/> {t("Load Proposal")}
                </Button>
                <Button variant="secondary" onClick={() => setIsToolModalOpen(true)} className="flex items-center justify-center gap-2 border-primary-200 text-primary-600">
                    <ClipboardList size={16}/> {t("Ext. Tool")}
                </Button>
                {onOpenIndustryTools && (
                    <Button variant="secondary" onClick={onOpenIndustryTools} className="flex items-center justify-center gap-2 border-indigo-200 text-indigo-600">
                        <Sparkles size={16} /> {t("App Tools")}
                    </Button>
                )}
            </div>
            </AccordionSection>

            <AccordionSection id="proposals" title={t("Linked Proposals")} icon={FileSignature} badge={linkedProposals.length} isOpen={expandedSections['proposals']} toggleSection={toggleSection}>
                {linkedProposals.length > 0 ? (
                    <div className="space-y-2">
                        {linkedProposals.map(p => (
                            <div key={p.id} className="flex items-center gap-2 w-full">
                                <button type="button" onClick={() => onViewEditProposal && onViewEditProposal(p.id)} className="flex-1 text-left p-4 bg-purple-50/50 rounded-xl flex justify-between items-center border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-purple-900">{p.isProjectLevel && p.title ? p.title : p.id}</p>
                                            {p.status === 'Accepted' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">✓ {p.selectedOption || 'Accepted'}</span>}
                                        </div>
                                        <p className="text-xs text-purple-700 mt-1">
                                            {p.isProjectLevel ? t('Project Proposal') : t('Field Proposal')} • {
                                                p.isProjectLevel 
                                                    ? (p.laborItems?.length || 0) + (p.partItems?.length || 0) + (p.allowanceItems?.length || 0)
                                                    : (p.items?.length || 0)
                                            } {t('line items')} • {p.status}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-lg text-purple-700">${(p.total || 0).toFixed(2)}</p>
                                    </div>
                                </button>
                                {onUnlinkProposal && (
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); onUnlinkProposal(p.id); }} 
                                        className="p-3 text-red-500 hover:text-red-750 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 shrink-0 transition-colors cursor-pointer"
                                        title={t("Unlink Proposal")}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
                        <p className="text-sm font-medium">{t("No active proposals linked to this job.")}</p>
                        <p className="text-xs mt-1">{t("Use the Quick Actions to build or load one.")}</p>
                    </div>
                )}
            </AccordionSection>
            
            <AccordionSection id="readings" title={t("Diagnostic Tools")} icon={ClipboardList} badge={toolReadings.length} isOpen={expandedSections['readings']} toggleSection={toggleSection}>
                {toolReadings.length > 0 ? (
                    <div className="space-y-2">
                        {toolReadings.map(reading => (
                            <div key={reading.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-start border border-slate-200 dark:border-slate-700 shadow-sm text-left">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-blue-300 flex items-center gap-2 flex-wrap">
                                        {reading.toolType}
                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider ${
                                            reading.phase === 'after'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400'
                                        }`}>
                                            {reading.phase === 'after' ? t("After Repair") : t("Before Repair")}
                                        </span>
                                        {reading.assetId && assets && (() => {
                                            const assocAsset = assets.find(a => a.id === reading.assetId);
                                            return assocAsset ? (
                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                                                    {assocAsset.name || assocAsset.type}
                                                </span>
                                            ) : null;
                                        })()}
                                    </p>
                                    <p className="text-xs text-slate-650 dark:text-slate-450 mt-1.5 leading-relaxed">{reading.summary}</p>
                                    {reading.reportUrl && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 font-bold">
                                            <a href={reading.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                                <ImageIcon size={12} />
                                                <span>{t("View Attached File")}</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                                {onDeleteToolReading && (
                                    <button onClick={() => onDeleteToolReading(reading.id)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-750 shadow-sm p-1.5 rounded-full" aria-label="Remove reading">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
                        <p className="text-sm font-medium">{t("No tool readings captured.")}</p>
                    </div>
                )}
            </AccordionSection>
            
            <AccordionSection id="checklist" title={t("Diagnosis Checklist")} icon={ClipboardList} badge={checklists.filter(c => c.completed).length + '/' + checklists.length} isOpen={expandedSections['checklist']} toggleSection={toggleSection}>
                <div className="flex justify-end items-center mb-4 gap-2">
                    {checklists.length > 0 && (
                        <div className="flex items-center gap-2 mr-auto">
                            {toggleAllChecklistVisibility && (
                                <>
                                    <button onClick={() => toggleAllChecklistVisibility(false)} className="text-[10px] uppercase font-black text-primary-600 hover:underline">{t("Show All")}</button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => toggleAllChecklistVisibility(true)} className="text-[10px] uppercase font-black text-slate-400 hover:underline">{t("Hide All")}</button>
                                    <span className="text-slate-300">|</span>
                                </>
                            )}
                            {onCheckAll && (
                                <button 
                                    onClick={() => {
                                        if (window.confirm(t("Are you sure you want to mark all checklist items as completed? Please confirm you have physically performed these checks."))) {
                                            onCheckAll();
                                        }
                                    }} 
                                    className="text-[10px] uppercase font-black text-emerald-600 hover:underline"
                                >
                                    {t("Check All")}
                                </button>
                            )}
                        </div>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1 bg-white shadow-sm hover:shadow">
                        <Import size={14}/> {t("Import Templates")}
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
                                        title={item.hiddenFromCustomer ? t("Hidden from Customer Portal") : t("Visible in Customer Portal")}
                                    >
                                        {item.hiddenFromCustomer ? t("Hidden") : t("Visible")}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50">
                        <p className="text-sm font-medium text-slate-500">{t("No checklist items yet.")}</p>
                        <p className="text-xs text-slate-400 mt-1">{t("Import from your organization's templates.")}</p>
                    </div>
                )}
            </AccordionSection>

            <AccordionSection id="unitStatesSection" title={t("Systems & Equipment Health")} icon={Wrench} badge={assets.length} isOpen={expandedSections['unitStatesSection']} toggleSection={toggleSection}>
                 {assets.length > 0 ? (
                     <div className="space-y-4 text-left">
                         <p className="text-xs text-slate-500 mb-2 font-medium">
                             {t("Record individual health and specific service details for each equipment unit below.")}
                         </p>
                         {(() => {
                             const equipmentByLocation: Record<string, any[]> = {};
                             const unassigned: any[] = [];
                             
                             assets.forEach((eq: any) => {
                                 if (eq.propertyId) {
                                     const loc = (serviceLocations || []).find((l: any) => l.id === eq.propertyId);
                                     if (loc) {
                                         if (!equipmentByLocation[loc.id]) {
                                             equipmentByLocation[loc.id] = [];
                                         }
                                         equipmentByLocation[loc.id].push(eq);
                                         return;
                                     }
                                 }
                                 unassigned.push(eq);
                             });

                             return (
                                 <div className="space-y-4">
                                     {(serviceLocations || []).map((loc: any) => {
                                         const groupAssets = equipmentByLocation[loc.id] || [];
                                         if (groupAssets.length === 0) return null;
                                         return (
                                             <details key={loc.id} className="group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/30">
                                                 <summary className="flex items-center justify-between p-4 cursor-pointer select-none text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                                                     <span className="flex items-center gap-2">
                                                         <MapPin size={16} className="text-primary-500" />
                                                         {loc.name} ({groupAssets.length})
                                                     </span>
                                                     <ChevronDown size={16} className="transition-transform group-open:rotate-180 text-slate-500" />
                                                 </summary>
                                                 <div className="p-4 border-t border-slate-250 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-950">
                                                     {groupAssets.map(renderAssetCard)}
                                                 </div>
                                             </details>
                                         );
                                     })}
                                     {unassigned.length > 0 && (
                                         <details className="group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/30">
                                             <summary className="flex items-center justify-between p-4 cursor-pointer select-none text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                                                 <span className="flex items-center gap-2">
                                                     <Layers size={16} className="text-slate-400" />
                                                     Unassigned Location ({unassigned.length})
                                                 </span>
                                                 <ChevronDown size={16} className="transition-transform group-open:rotate-180 text-slate-500" />
                                             </summary>
                                             <div className="p-4 border-t border-slate-250 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-950">
                                                 {unassigned.map(renderAssetCard)}
                                             </div>
                                         </details>
                                     )}
                                 </div>
                             );
                         })()}
                     </div>
                 ) : (
                     <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
                         <p className="text-sm font-medium">{t("No equipment assets registered for this store/location.")}</p>
                         <p className="text-xs mt-1">{t("Register assets in Step 1 (Arrival) first.")}</p>
                     </div>
                 )}
            </AccordionSection>

            <AccordionSection id="findings" title={t("Pre-Work Findings")} icon={Edit3} isOpen={expandedSections['findings']} toggleSection={toggleSection}>

                <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-slate-600">{t("Document the diagnosis")}</p>
                    <VoiceInput onResult={(text) => setNotes(notes ? notes + '\n' + text : text)} />
                </div>
                <Textarea 
                    rows={5} 
                    placeholder={t("Describe the issue found, diagnostic steps, and recommendations...")} 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="bg-slate-50"
                />
            </AccordionSection>

            <AccordionSection id="photos" title={t("Job Photos")} icon={Camera} badge={files.filter(f => { const lbl = f.metadata?.label || f.label; return lbl === 'Pre-Work' || lbl === 'Before'; }).length} isOpen={expandedSections['photos']} toggleSection={toggleSection}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex gap-3 w-full md:w-auto h-24">
                        <button 
                            type="button"
                            onClick={takeNativePhoto}
                            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white w-24 h-24 shadow-sm"
                            title={t("Camera")}
                        >
                            <Camera size={24} className="text-slate-400 mb-2"/>
                            <span className="text-xs font-bold text-slate-500">{t("Camera")}</span>
                        </button>
                        <label htmlFor="prework-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors w-24 h-24 shadow-sm">
                            <ImageIcon size={24} className="text-slate-400 mb-2"/>
                            <span className="text-xs font-bold text-slate-500">{t("Gallery")}</span>
                            <input id="prework-gallery" type="file" multiple accept="image/*" onChange={(e) => handlePhotoUpload(e, 'Before')} className="hidden" />
                        </label>
                    </div>
                    
                    <div className="flex-1 flex items-start overflow-x-auto gap-3 pb-2 custom-scrollbar">
                        {files.filter(f => { const lbl = f.metadata?.label || f.label; return lbl === 'Pre-Work' || lbl === 'Before'; }).map(f => (
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
                                        onClick={(e) => { e.stopPropagation(); onDeletePhoto(f); }}
                                        className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm backdrop-blur-sm z-10"
                                        title="Delete Photo"
                                        aria-label="Delete Photo"
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
                        {files.filter(f => { const lbl = f.metadata?.label || f.label; return lbl === 'Pre-Work' || lbl === 'Before'; }).length === 0 && (
                            <div className="flex-1 border-2 border-dashed rounded-xl border-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium h-24 min-w-[200px] shrink-0">
                                {t("No pre-work photos uploaded.")}
                            </div>
                        )}
                    </div>
                </div>
            </AccordionSection>
        </div>
    );
};

export default DiagnosisStep;
