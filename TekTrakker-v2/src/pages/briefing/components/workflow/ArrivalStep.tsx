import React from 'react';
import { Navigation, CheckCircle, User, MapPin, Sparkles, Camera, ImageIcon, X, Tag, Compass, Layers, FileText, Play, Clock, Trash2, Plus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { Job, EquipmentAsset, Customer, ServiceLocation } from '../../../../types';
import { StoredFile } from '../../../../types/file';
import { formatAddress } from '../../../../lib/utils';
import { useLanguage } from 'context/LanguageContext';
import showToast from '../../../../lib/toast';
import { getCurrentLocation } from '../../../../lib/geolocation';
import { useAppContext } from 'context/AppContext';
import { EQUIPMENT_OPTIONS } from '@/constants/industryNaming';

const PHYSICAL_LOCATION_OPTIONS = [
    'Roof', 'Mechanical Room', 'Walk-in Cooler', 'Walk-in Freezer', 
    'Kitchen', 'Exterior Wall', 'Behind Building', 'Ceiling Space', 
    'Attic', 'Tenant Space', 'Other'
];

interface ArrivalStepProps {
    job: Job;
    custDetails: { email: string; phone: string; address: string };
    setCustDetails: (details: { email: string; phone: string; address: string }) => void;
    arrivalNotes: string;
    setArrivalNotes: (notes: string) => void;
    assets: EquipmentAsset[];
    isAddAssetOpen: boolean;
    setIsAddAssetOpen: (open: boolean) => void;
    newAsset: Partial<EquipmentAsset>;
    setNewAsset: (asset: Partial<EquipmentAsset>) => void;
    handleAddAsset: () => void;
    handleDeleteAsset?: (id: string) => void;
    isOcrScanning: boolean;
    handleAssetPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => void;
    saveCustomerInfo: () => void;
    customer?: Customer;
    files?: StoredFile[];
    handlePhotoUpload?: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto?: () => void;
    takeNativeAssetPhoto?: (photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => void;
    onDeletePhoto?: (file: StoredFile) => void;
    onViewPhoto?: (file: StoredFile) => void;
    onAssignPhotoToAsset?: (fileId: string, assetId: string) => void;
    onUpdatePhotoLabel?: (fileId: string, label: string) => void;
    hidden?: boolean;
    checkInTime?: string;
    onCheckIn?: () => void;
    onStartRoute?: () => void;
    onJobUpdate?: (updates: Partial<Job>) => Promise<void>;
}

const ArrivalStep: React.FC<ArrivalStepProps> = ({
    job,
    custDetails,
    setCustDetails,
    arrivalNotes,
    setArrivalNotes,
    assets,
    isAddAssetOpen,
    setIsAddAssetOpen,
    newAsset,
    setNewAsset,
    handleAddAsset,
    handleDeleteAsset,
    isOcrScanning,
    handleAssetPhotoUpload,
    saveCustomerInfo,
    customer,
    files = [],
    handlePhotoUpload,
    takeNativePhoto,
    takeNativeAssetPhoto,
    onDeletePhoto,
    onViewPhoto,
    onAssignPhotoToAsset,
    onUpdatePhotoLabel,
    hidden,
    checkInTime,
    onCheckIn,
    onStartRoute,
    onJobUpdate
}) => {
    const { t } = useLanguage();
    const { state } = useAppContext();
    const industry = state.currentOrganization?.industry || 'HVAC';
    const equipmentOptions = EQUIPMENT_OPTIONS[industry] || EQUIPMENT_OPTIONS['default'];

    // New states for Refrigeration System Linking
    const [isLinkedToSystem, setIsLinkedToSystem] = React.useState(false);
    const [selectedSystemGroupId, setSelectedSystemGroupId] = React.useState('');
    const [newSystemGroupName, setNewSystemGroupName] = React.useState('');
    const [gpsLoading, setGpsLoading] = React.useState(false);
    const [elapsedTime, setElapsedTime] = React.useState('00:00:00');
    const [selectedDiagId, setSelectedDiagId] = React.useState('');

    const completedDiagnostics = React.useMemo(() => {
        if (!state.jobs || !job.customerId) return [];
        return state.jobs.filter(j => 
            j.customerId === job.customerId &&
            j.id !== job.id &&
            j.jobStatus === 'Completed' &&
            (j.visitType === 'Diagnostic Only' || j.visitType === 'Diagnostic & Repair')
        );
    }, [state.jobs, job.customerId, job.id]);

    // Manual Time Entry states
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false);

    // Format helper to local ISO-ish string without timezone suffix for <input type="datetime-local">
    const formatDateTimeForInput = (isoString?: string | null) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    };

    const [localEntries, setLocalEntries] = React.useState<Array<{
        checkInTime: string;
        checkOutTime: string | null;
        timeOnSiteMinutes: number | null;
    }>>([]);

    // Synchronize inputs when job changes or manual panel opens
    React.useEffect(() => {
        console.log("[ManualTimeLog] useEffect sync triggered. isManualTimeOpen:", isManualTimeOpen, "job.timeEntries length:", job.timeEntries?.length);
        if (isManualTimeOpen) {
            console.log("[ManualTimeLog] Syncing localEntries with job.timeEntries:", job.timeEntries);
            setLocalEntries(job.timeEntries || []);
        }
    }, [isManualTimeOpen]);

    const updateEntry = (idx: number, field: 'checkInTime' | 'checkOutTime' | 'timeOnSiteMinutes', val: string) => {
        console.log("[ManualTimeLog] updateEntry called for index:", idx, "field:", field, "value:", val);
        const next = [...localEntries];
        const entry = { ...next[idx] };
        
        if (field === 'checkInTime') {
            entry.checkInTime = val ? new Date(val).toISOString() : '';
            if (entry.checkInTime && entry.checkOutTime) {
                const diffMs = new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime();
                entry.timeOnSiteMinutes = Math.max(0, Math.round(diffMs / 60000));
            }
        } else if (field === 'checkOutTime') {
            entry.checkOutTime = val ? new Date(val).toISOString() : null;
            if (entry.checkInTime && entry.checkOutTime) {
                const diffMs = new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime();
                entry.timeOnSiteMinutes = Math.max(0, Math.round(diffMs / 60000));
            }
        } else if (field === 'timeOnSiteMinutes') {
            entry.timeOnSiteMinutes = val === '' ? null : parseInt(val, 10);
        }
        
        next[idx] = entry;
        console.log("[ManualTimeLog] entry updated:", entry);
        setLocalEntries(next);
    };

    const deleteEntry = (idx: number) => {
        console.log("[ManualTimeLog] deleteEntry called for index:", idx);
        const next = localEntries.filter((_, i) => i !== idx);
        console.log("[ManualTimeLog] entries remaining after delete:", next);
        setLocalEntries(next);
    };

    const addEntry = () => {
        console.log("[ManualTimeLog] addEntry called");
        const nowIso = new Date().toISOString();
        setLocalEntries([
            ...localEntries,
            { checkInTime: nowIso, checkOutTime: null, timeOnSiteMinutes: null }
        ]);
    };

    const handleSaveManualTime = async () => {
        console.log("[ManualTimeLog] handleSaveManualTime started. localEntries:", localEntries);
        for (let i = 0; i < localEntries.length; i++) {
            const entry = localEntries[i];
            if (!entry.checkInTime) {
                showToast.warn(`Arrival Time is required for Visit #${i + 1}.`);
                return;
            }
            if (entry.checkInTime && entry.checkOutTime && new Date(entry.checkOutTime).getTime() < new Date(entry.checkInTime).getTime()) {
                showToast.warn(`Departure time cannot be before arrival time for Visit #${i + 1}.`);
                return;
            }
        }

        const totalMins = localEntries.reduce((acc, entry) => acc + (entry.timeOnSiteMinutes || 0), 0);
        const lastEntry = localEntries[localEntries.length - 1];
        
        const updates: Partial<Job> = {
            timeEntries: localEntries,
            timeOnSiteMinutes: totalMins
        };

        if (lastEntry) {
            updates.checkInTime = lastEntry.checkInTime;
            updates.checkOutTime = lastEntry.checkOutTime || null as any;
        } else {
            updates.checkInTime = null as any;
            updates.checkOutTime = null as any;
        }

        console.log("[ManualTimeLog] Saving updates to job:", updates);

        try {
            if (onJobUpdate) {
                await onJobUpdate(updates);
                console.log("[ManualTimeLog] Save successful!");
                showToast.success("All visit clock logs updated successfully!");
                setIsManualTimeOpen(false);
            }
        } catch (err) {
            console.error("[ManualTimeLog] Save failed:", err);
            showToast.error("Failed to update visitation logs.");
        }
    };

    React.useEffect(() => {
        if (!checkInTime) {
            setElapsedTime('00:00:00');
            return;
        }

        const updateTimer = () => {
            const diff = new Date().getTime() - new Date(checkInTime).getTime();
            if (diff < 0) {
                setElapsedTime('00:00:00');
                return;
            }
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setElapsedTime(`${h}:${m}:${s}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [checkInTime]);

    // Group items unique system IDs on this customer
    const uniqueSystemGroups = React.useMemo(() => {
        const groups: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        (customer?.equipment || []).forEach(e => {
            if (e.systemGroupId && e.systemGroupName && !seen.has(e.systemGroupId)) {
                seen.add(e.systemGroupId);
                groups.push({ id: e.systemGroupId, name: e.systemGroupName });
            }
        });
        return groups;
    }, [customer?.equipment]);

    React.useEffect(() => {
        if (isAddAssetOpen) {
            setIsLinkedToSystem(!!newAsset.systemGroupId);
            setSelectedSystemGroupId(newAsset.systemGroupId || '');
            setNewSystemGroupName('');
        }
    }, [isAddAssetOpen, newAsset.systemGroupId]);

    const handleSaveIntercept = () => {
        let sysId = newAsset.systemGroupId;
        let sysName = newAsset.systemGroupName;
        let sysRole = newAsset.systemGroupRole;

        if (isLinkedToSystem) {
            if (selectedSystemGroupId === 'NEW') {
                if (!newSystemGroupName.trim()) {
                    showToast.warn("System group name is required");
                    return;
                }
                sysId = `sys-${Date.now()}`;
                sysName = newSystemGroupName.trim();
            } else {
                const matchedGroup = uniqueSystemGroups.find(g => g.id === selectedSystemGroupId);
                if (matchedGroup) {
                    sysId = matchedGroup.id;
                    sysName = matchedGroup.name;
                } else {
                    if (uniqueSystemGroups.length > 0) {
                        sysId = uniqueSystemGroups[0].id;
                        sysName = uniqueSystemGroups[0].name;
                    } else {
                        showToast.warn("Please select or create a system group");
                        return;
                    }
                }
            }
            sysRole = newAsset.systemGroupRole || 'Standalone';
        } else {
            sysId = undefined;
            sysName = undefined;
            sysRole = undefined;
        }

        setNewAsset({
            ...newAsset,
            systemGroupId: sysId,
            systemGroupName: sysName,
            systemGroupRole: sysRole
        });
        
        setTimeout(() => {
            handleAddAsset();
        }, 100);
    };

    if (hidden) return null;
    const arrivalFiles = files.filter(f => {
        const lbl = f.metadata?.label || f.label;
        return lbl === 'Pre-Work' || lbl === 'Before';
    });
    const handleNavigate = () => {
        const encodedAddress = encodeURIComponent(formatAddress(job.address));
        const platform = Capacitor.getPlatform();
        if (platform === 'ios') {
            window.open(`maps://?daddr=${encodedAddress}`, '_system');
        } else if (platform === 'android') {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_system');
        } else {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={handleNavigate} className="h-12 bg-blue-600">
                    <Navigation size={18} className="mr-2"/> {t("Navigate")}
                </Button>
                <Button variant="secondary" className="h-12" onClick={saveCustomerInfo}>
                    <CheckCircle size={18} className="mr-2"/> {t("Confirm Info")}
                </Button>
            </div>

            {/* Prior Diagnostic Linkage (For Repair Visits) */}
            {job.visitType === 'Repair' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🔗</span>
                        <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs">
                            {t("Prior Diagnostic Linkage")}
                        </h4>
                    </div>

                    {job.parentJobId ? (
                        <div className="flex items-center justify-between p-3.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-2xl">
                            <div>
                                <p className="text-xs font-bold text-green-800 dark:text-green-300">
                                    {t("Linked to Diagnostic Job")} #{job.parentJobId.slice(-6).toUpperCase()}
                                </p>
                                <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                                    {t("Prior diagnostic notes and photos are displayed at the top of your dashboard.")}
                                </p>
                            </div>
                            <Button
                                onClick={async () => {
                                    if (onJobUpdate) {
                                        await onJobUpdate({ parentJobId: null });
                                        showToast.success(t("Prior diagnostic job unlinked."));
                                    }
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-900 text-[10px] font-black uppercase tracking-wider py-1.5 px-3 h-8 rounded-lg"
                            >
                                {t("Unlink")}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                {t("Is this repair visit linked to a completed diagnostic call? Link it to pull through the previous notes, photos, and estimates.")}
                            </p>
                            {completedDiagnostics.length > 0 ? (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select
                                        value={selectedDiagId}
                                        onChange={e => setSelectedDiagId(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-805 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                                    >
                                        <option value="">-- {t("Select Diagnostic Job")} --</option>
                                        {completedDiagnostics.map(diag => {
                                            const diagTime = diag.appointmentTime ? new Date(diag.appointmentTime).toLocaleDateString() : '';
                                            return (
                                                <option key={diag.id} value={diag.id}>
                                                    #{diag.id.slice(-6).toUpperCase()} - {diagTime} ({diag.notes?.diagnosis?.slice(0, 35) || t("No diagnosis notes")}...)
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <Button
                                        disabled={!selectedDiagId}
                                        onClick={async () => {
                                            if (onJobUpdate && selectedDiagId) {
                                                await onJobUpdate({ parentJobId: selectedDiagId });
                                                showToast.success(t("Diagnostic job linked successfully!"));
                                            }
                                        }}
                                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider py-2 px-4 h-10 rounded-xl shrink-0"
                                    >
                                        {t("Link Job")}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                                    {t("No completed diagnostic jobs found on file for this customer.")}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Time on Site Tracking Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col gap-6 overflow-hidden relative">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
                    {!checkInTime ? (
                        <>
                            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs">
                                        {t("Time on Site Tracking")}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                                        {job.transitStartTime 
                                            ? t("En route to customer since {time}.", { time: new Date(job.transitStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })
                                            : t("Start transit or check in to begin timing.")}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                                {!job.transitStartTime ? (
                                    <button
                                        type="button"
                                        onClick={onStartRoute}
                                        className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Navigation size={16} fill="currentColor" />
                                        {t("In Route")}
                                    </button>
                                ) : (
                                    <span className="flex items-center justify-center px-4 py-3.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-black rounded-2xl uppercase tracking-wider border border-blue-200 dark:border-blue-800 shrink-0">
                                        <Navigation size={14} className="mr-1.5 animate-pulse" />
                                        {t("En Route")}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={onCheckIn}
                                    className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                                >
                                    <Play size={16} fill="currentColor" />
                                    {t("Arrive on Site")}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 relative">
                                    <Clock size={24} />
                                    <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-ping" />
                                    <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs flex items-center gap-2">
                                        {t("Time on Site Tracking")}
                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                            {t("Checked In")}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                                        {t("Arrived at {time}. Timing is active.", { time: new Date(checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                                <div className="w-full sm:w-auto px-6 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center min-w-[150px] shrink-0">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-0.5">{t("Elapsed Time")}</span>
                                    <span className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">{elapsedTime}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={onCheckIn}
                                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer shrink-0"
                                    title="Reset Arrival Time"
                                >
                                    {t("Reset")}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Manual Override Button */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center w-full">
                    <button
                        type="button"
                        onClick={() => setIsManualTimeOpen(!isManualTimeOpen)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-bold flex items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                        <Clock size={12} />
                        {isManualTimeOpen ? t("Hide Manual Adjustments") : t("Adjust or Log Job Time Manually")}
                    </button>
                    {(job.timeOnSiteMinutes !== undefined || job.checkOutTime) && (
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {t("Manual Logs Active")}
                        </span>
                    )}
                </div>

                {/* Manual Time Entry Fields */}
                {isManualTimeOpen && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-fade-in w-full">
                        <div className="flex justify-between items-center">
                            <div>
                                <h5 className="font-bold text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                                    {t("Log On-Site Time Manually")}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    {t("Adjust, delete or add visits for multi-day operations.")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addEntry}
                                className="px-3.5 py-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/20 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-sm border border-primary-200/50 dark:border-primary-850"
                            >
                                <Plus size={14} />
                                {t("Add Visit")}
                            </button>
                        </div>
                        
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {localEntries.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">{t("No visits logged yet. Click Add Visit to log time.")}</p>
                            ) : (
                                localEntries.map((entry, idx) => (
                                    <div key={idx} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-sm relative group">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                                {t("Visit #{num}", { num: (idx + 1).toString() })}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    deleteEntry(idx);
                                                }}
                                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all relative z-10"
                                                title="Delete this visit log"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                                    {t("Arrival (Check-In)")}
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={formatDateTimeForInput(entry.checkInTime)}
                                                    onChange={(e) => updateEntry(idx, 'checkInTime', e.target.value)}
                                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                                    {t("Departure (Check-Out)")}
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={formatDateTimeForInput(entry.checkOutTime)}
                                                    onChange={(e) => updateEntry(idx, 'checkOutTime', e.target.value)}
                                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                                    {t("Duration (Minutes)")}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={entry.timeOnSiteMinutes ?? ''}
                                                    onChange={(e) => updateEntry(idx, 'timeOnSiteMinutes', e.target.value)}
                                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    placeholder="e.g. 60"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/50 dark:border-slate-800">
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={() => {
                                    setLocalEntries(job.timeEntries || []);
                                    setIsManualTimeOpen(false);
                                }}
                            >
                                {t("Cancel")}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveManualTime}
                            >
                                {t("Save Time Log")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            
            {job.specialInstructions && (
                <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/40 p-5 rounded-[2rem] shadow-sm animate-fade-in">
                    <h4 className="font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        {t("Booking / Arrival Instructions")}
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-350 font-medium whitespace-pre-wrap leading-relaxed">
                        {job.specialInstructions}
                    </p>
                </div>
            )}

            {job.notes?.internalNotes && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/40 p-5 rounded-[2rem] shadow-sm animate-fade-in">
                    <h4 className="font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-450" />
                        {t("Dispatch / Office Notes")}
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-350 font-medium whitespace-pre-wrap leading-relaxed">
                        {job.notes.internalNotes}
                    </p>
                </div>
            )}

            <Card>
                <h4 className="font-bold mb-4">{t("Verify Customer Details")}</h4>
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-3">
                        <User size={18} className="text-slate-500"/>
                        <p className="font-bold text-md text-slate-800 dark:text-slate-100">{job.customerName}</p>
                    </div>
                     <div className="flex items-start gap-3 w-full">
                        <MapPin size={18} className="text-slate-500 mt-2 shrink-0"/>
                        <div className="flex-1 space-y-3">
                            {customer?.serviceLocations && customer.serviceLocations.length > 1 && (
                                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-3 flex items-start gap-2">
                                    <MapPin size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t("Multiple Properties Detected")}</p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                                            {t("This customer has {count} locations on file. Please explicitly verify the current job appointment address matches your physical arrival location.", { count: String(customer.serviceLocations.length) })}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {customer?.serviceLocations && customer.serviceLocations.length > 0 && (
                                <Select 
                                    label={t("Select Service Location (Optional)")} 
                                    value={customer.serviceLocations.some(l => l.address === custDetails.address) ? custDetails.address : ''} 
                                    onChange={e => {
                                        if (e.target.value) setCustDetails({...custDetails, address: e.target.value});
                                    }}
                                >
                                    <option value="">-- {t("Manual Entry")} --</option>
                                    {customer.serviceLocations.map(loc => (
                                        <option key={loc.id} value={loc.address}>{loc.name} - {loc.address}</option>
                                    ))}
                                </Select>
                            )}
                            <Input 
                                id="cust-address" 
                                label={t("Service Address")} 
                                value={custDetails.address || job.address} 
                                onChange={e => setCustDetails({...custDetails, address: e.target.value})} 
                            />
                            <p className="text-xs text-slate-400 mt-1 italic">{t("Updating this adds/edits a property on the customer profile.")}</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Input 
                        id="cust-phone" 
                        label={t("Phone")} 
                        value={custDetails.phone} 
                        onChange={e => setCustDetails({...custDetails, phone: e.target.value})} 
                    />
                    <Input 
                        id="cust-email" 
                        label={t("Email")} 
                        value={custDetails.email} 
                        onChange={e => setCustDetails({...custDetails, email: e.target.value})} 
                    />
                </div>
            </Card>
            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">{t("Arrival Notes")}</h4>
                    <VoiceInput onResult={(text) => setArrivalNotes(arrivalNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={3} 
                    placeholder={t("Site conditions, gate codes, etc...")} 
                    value={arrivalNotes} 
                    onChange={e => setArrivalNotes(e.target.value)}
                />
                
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h5 className="font-bold text-sm mb-3">{t("Arrival Photos (Pre-Work)")}</h5>
                    <div className="flex items-start gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {takeNativePhoto && (
                            <button onClick={takeNativePhoto} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-primary-300 rounded-xl bg-primary-50 dark:bg-primary-900/10 cursor-pointer hover:bg-primary-100 transition-colors shrink-0 w-24 h-24 shadow-sm">
                                <Camera size={24} className="text-primary-600 mb-2"/>
                                <span className="text-xs font-bold text-primary-700">{t("Camera")}</span>
                            </button>
                        )}
                        {handlePhotoUpload && (
                            <label htmlFor="arrival-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors w-24 h-24 shadow-sm shrink-0">
                                <ImageIcon size={24} className="text-slate-400 mb-2"/>
                                <span className="text-xs font-bold text-slate-500">{t("Gallery")}</span>
                                <input id="arrival-gallery" type="file" multiple accept="image/*" onChange={(e) => handlePhotoUpload && handlePhotoUpload(e, 'Before')} className="hidden" />
                            </label>
                        )}
                        {arrivalFiles.map(file => (
                            <div key={file.id} className="relative w-32 rounded-xl flex flex-col border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md shrink-0 overflow-hidden group">
                                <div className="relative w-full h-24 overflow-hidden bg-slate-900">
                                    <button 
                                        type="button"
                                        onClick={() => onViewPhoto?.(file)}
                                        className="w-full h-full p-0 border-none outline-none block"
                                    >
                                        <img src={file.dataUrl || file.url} alt="Arrival" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeletePhoto?.(file); }}
                                        aria-label="Delete photo"
                                        title="Delete photo"
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 shadow-md"
                                    >
                                        <X size={10}/>
                                    </button>
                                </div>
                                <div className="p-1.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-1">
                                    <select
                                        value={file.metadata?.assetId || ''}
                                        onChange={(e) => onAssignPhotoToAsset?.(file.id, e.target.value)}
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
                                        value={file.metadata?.label || file.label || ''}
                                        onChange={(e) => onUpdatePhotoLabel?.(file.id, e.target.value)}
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
            </Card>
            <Card>
                <h4 className="font-bold flex justify-between items-center mb-4">
                    <span>{t("Equipment On Site")}</span>
                    {!isAddAssetOpen && (
                        <button 
                            onClick={() => {
                                let defaultPropertyId = job.locationId || '';
                                if (!defaultPropertyId && job.address && customer?.serviceLocations) {
                                    const jobAddressStr = typeof job.address === 'string' ? job.address : '';
                                    const matchingLoc = customer.serviceLocations.find(loc => loc.address === jobAddressStr);
                                    if (matchingLoc) defaultPropertyId = matchingLoc.id;
                                }
                                setNewAsset({ brand: '', model: '', serial: '', type: 'System', location: '', condition: '', propertyId: defaultPropertyId });
                                setIsAddAssetOpen(true);
                            }} 
                            className="text-sm text-primary-600 font-bold bg-primary-50 px-3 py-1.5 rounded-md border border-primary-200 hover:bg-primary-100 transition-colors"
                        >
                            {t("+ Add Asset")}
                        </button>
                    )}
                </h4>
                
                {assets.length > 0 ? assets.map(a => (
                    <div key={a.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3 border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                        <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                    {a.name ? `${a.name} (${a.brand} ${t(a.type)})` : `${a.brand} ${t(a.type)}`}
                                </p>
                                {a.condition && (
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${a.condition === 'Excellent' || a.condition === 'Good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : a.condition === 'Fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                        {t(a.condition)}
                                    </span>
                                )}
                                {a.assetTag && (
                                    <span className="text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full font-mono flex items-center gap-0.5">
                                        <Tag size={9} /> {a.assetTag}
                                    </span>
                                )}
                                {a.systemGroupId && (
                                    <span className="text-[9px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full font-medium flex items-center gap-0.5">
                                        <Layers size={9} /> {a.systemGroupName} ({a.systemGroupRole || 'Member'})
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t("Serial Number")}: <span className="font-mono text-slate-900 dark:text-slate-200">{a.serial || 'N/A'}</span></p>
                            
                            {(a.year || a.tonnage || a.refrigerantType || a.heatType || a.electricityType) && (
                                <div className="text-[10px] text-slate-650 dark:text-slate-450 font-semibold flex items-center gap-1.5 flex-wrap pt-0.5 pb-0.5 animate-fade-in">
                                    {a.year && <span className="bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{t("Year")}: {a.year}</span>}
                                    {a.tonnage && <span className="bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{a.tonnage} {t("Tons")}</span>}
                                    {a.refrigerantType && <span className="bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{t("Ref")}: {a.refrigerantType}</span>}
                                    {a.heatType && <span className="bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{t("Heat")}: {a.heatType}</span>}
                                    {a.electricityType && <span className="bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{t("Elec")}: {a.electricityType}</span>}
                                </div>
                            )}
                            
                            {(a.physicalLocation || a.exactPlacement || a.servesArea) ? (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1 flex-wrap">
                                    <MapPin size={10} className="text-slate-400 shrink-0" />
                                    {a.physicalLocation && <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{a.physicalLocation}</span>}
                                    {a.exactPlacement && <span className="text-slate-400">&gt; <span className="text-slate-500 italic">{a.exactPlacement}</span></span>}
                                    {a.servesArea && <span className="text-indigo-500 dark:text-indigo-400 ml-1">({t("Serves")}: {a.servesArea})</span>}
                                </div>
                            ) : a.location ? (
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                                    <MapPin size={10}/> {t("Location")}: {a.location}
                                </p>
                            ) : null}

                            {a.gpsPin && (
                                <p className="text-[9px] text-slate-400 font-mono flex items-center gap-0.5">
                                    <Compass size={9} /> GPS: {a.gpsPin.lat.toFixed(6)}, {a.gpsPin.lng.toFixed(6)}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3 items-center ml-2 shrink-0">
                            <button onClick={() => {
                                setNewAsset(a);
                                setIsAddAssetOpen(true);
                            }} className="text-primary-600 font-bold text-xs hover:underline">
                                {t("Edit")}
                            </button>
                            {handleDeleteAsset && (
                                <button onClick={() => handleDeleteAsset(a.id)} className="text-red-500 font-bold text-xs hover:underline">
                                    {t("Delete")}
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    !isAddAssetOpen && <p className="text-sm text-slate-400 italic mb-4">{t("No assets listed.")}</p>
                )}

            </Card>
        </div>
    );
};

export default ArrivalStep;

