import React from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { 
    Cog, ShieldCheck, Wrench, Calendar, MapPin, 
    Filter, Zap, Flame, Snowflake, Clock, FileText, ChevronRight, Compass, ExternalLink
} from 'lucide-react';
import type { EquipmentAsset, Job, ServiceLocation } from 'types';

interface UnitDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    unit: EquipmentAsset | null;
    location?: ServiceLocation | null;
    jobs?: Job[];
    onBookServiceForUnit?: (unit: EquipmentAsset, location?: ServiceLocation | null) => void;
    onViewJobReport?: (job: Job) => void;
    onViewProtectionPlans?: (unit: EquipmentAsset) => void;
}

const getJobNotesString = (notes: any): string => {
    if (!notes) return '';
    if (typeof notes === 'string') return notes;
    if (typeof notes === 'object') {
        return notes.workNotes || notes.completion || notes.preRepair || notes.feedback || '';
    }
    return '';
};

const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
    isOpen,
    onClose,
    unit,
    location,
    jobs = [],
    onBookServiceForUnit,
    onViewJobReport,
    onViewProtectionPlans
}) => {
    if (!unit) return null;

    // Filter jobs that involved or serviced this specific unit
    const unitJobs = jobs.filter(j => {
        let matchesUnitId = false;
        if (Array.isArray(j.unitStates)) {
            matchesUnitId = j.unitStates.some((s: any) => s.assetId === unit.id || s.id === unit.id || s.equipmentId === unit.id || s.assetTag === unit.assetTag);
        } else if (j.unitStates && typeof j.unitStates === 'object') {
            matchesUnitId = Object.keys(j.unitStates).some(k => k === unit.id || k === unit.name || k === unit.model);
        }
        const matchesBrandModel = j.hvacBrand?.toLowerCase() === unit.brand.toLowerCase();
        const notesStr = getJobNotesString(j.notes).toLowerCase();
        const matchesTaskOrNotes = (j.tasks || []).some(t => t.toLowerCase().includes(unit.type.toLowerCase())) || 
                                   notesStr.includes(unit.model.toLowerCase()) ||
                                   notesStr.includes(unit.serial.toLowerCase());
        return matchesUnitId || matchesBrandModel || matchesTaskOrNotes;
    });

    const openJobs = unitJobs.filter(j => j.jobStatus !== 'Completed');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${unit.brand} ${unit.type || 'Equipment Unit'}`} size="xl">
            <div className="space-y-6">
                {/* Hero Card */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                                <Cog size={32} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black">{unit.brand} {unit.model}</h3>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase">
                                        {unit.type || 'HVAC Unit'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-1 flex-wrap">
                                    <MapPin size={13} className="text-emerald-400 shrink-0" />
                                    <span>{location?.propertyName || location?.name || 'Main Property'}</span>
                                    {unit.physicalLocation ? ` · Placement: ${unit.physicalLocation}` : ''}
                                    {unit.exactPlacement ? ` (${unit.exactPlacement})` : ''}
                                    {(() => {
                                        const lat = typeof unit.gpsPin?.lat === 'number' ? unit.gpsPin.lat : (typeof (unit as any).gpsLat === 'number' ? (unit as any).gpsLat : undefined);
                                        const lng = typeof unit.gpsPin?.lng === 'number' ? unit.gpsPin.lng : (typeof (unit as any).gpsLng === 'number' ? (unit as any).gpsLng : undefined);
                                        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                                            return (
                                                <a
                                                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 hover:text-white underline ml-1"
                                                    title="Open coordinates in Google Maps"
                                                >
                                                    <Compass size={11} /> {lat.toFixed(5)}, {lng.toFixed(5)}
                                                </a>
                                            );
                                        }
                                        return null;
                                    })()}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {onViewProtectionPlans && (
                                <Button 
                                    onClick={() => {
                                        onClose();
                                        onViewProtectionPlans(unit);
                                    }}
                                    className="bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 py-2 px-3.5 shadow-md cursor-pointer border border-emerald-500/40"
                                >
                                    <ShieldCheck size={14} /> Protection Plans
                                </Button>
                            )}
                            {onBookServiceForUnit && (
                                <Button 
                                    onClick={() => {
                                        onClose();
                                        onBookServiceForUnit(unit, location);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 py-2 px-4 shadow-md shadow-emerald-950/50 cursor-pointer"
                                >
                                    <Wrench size={14} /> Request Service on this Unit
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Technical Specifications Grid */}
                <div>
                    <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                        Technical Specifications & Asset Profile
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Serial Number</span>
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">{unit.serial || 'N/A'}</span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Model Number</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{unit.model || 'N/A'}</span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filter Size</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Filter size={12} /> {unit.filterType || 'Standard'}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tonnage / Capacity</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {unit.tonnage ? `${unit.tonnage} Tons` : unit.btuCapacity ? `${unit.btuCapacity} BTU` : 'N/A'}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Refrigerant Type</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <Snowflake size={12} className="text-blue-500" /> {unit.refrigerantType || 'R-410A'}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Electrical Specs</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <Zap size={12} className="text-amber-500" />
                                {(unit.volts || unit.phase || unit.amps) ? `${unit.volts ? unit.volts + 'V ' : ''}${unit.phase ? unit.phase + 'Ph ' : ''}${unit.amps ? unit.amps + 'A' : ''}`.trim() : 'Standard'}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Heat / Energy Type</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <Flame size={12} className="text-rose-500" /> {unit.heatType || 'Electric Heat Pump'}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Year / SEER</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {(unit.year || unit.seerRating) ? `${unit.year ? 'Built ' + unit.year : ''} ${unit.seerRating ? '(' + unit.seerRating + ' SEER)' : ''}`.trim() : 'N/A'}
                            </span>
                        </div>

                        {(() => {
                            const lat = typeof unit.gpsPin?.lat === 'number' ? unit.gpsPin.lat : (typeof (unit as any).gpsLat === 'number' ? (unit as any).gpsLat : undefined);
                            const lng = typeof unit.gpsPin?.lng === 'number' ? unit.gpsPin.lng : (typeof (unit as any).gpsLng === 'number' ? (unit as any).gpsLng : undefined);
                            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                                return (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GPS Pin</span>
                                        <a 
                                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                                            title="Open coordinates in Google Maps"
                                        >
                                            <Compass size={12} className="shrink-0" />
                                            <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                                            <ExternalLink size={10} className="opacity-70 shrink-0" />
                                        </a>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>

                {/* Work Order History on this Specific Unit */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                        <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <FileText size={14} className="text-primary-600" /> Service & Work Order History on this Unit ({unitJobs.length})
                        </h4>
                        {openJobs.length > 0 && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-black px-2 py-0.5 rounded-full uppercase">
                                {openJobs.length} Active / Scheduled
                            </span>
                        )}
                    </div>

                    {unitJobs.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 font-medium">
                            No past work orders recorded specifically for this unit yet.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {unitJobs.map(job => (
                                <div 
                                    key={job.id} 
                                    onClick={() => onViewJobReport?.(job)}
                                    className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 transition-all flex justify-between items-center cursor-pointer group"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                job.jobStatus === 'Completed' 
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                                {job.jobStatus}
                                            </span>
                                            <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                                                {job.tasks?.join(', ') || 'Service Visit'}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-slate-400 flex items-center gap-2">
                                            <Calendar size={11} /> {new Date(job.appointmentTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {job.poNumber && <span>· PO: {job.poNumber}</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-primary-600 font-bold">
                                        <span>View Report</span>
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="secondary" onClick={onClose} className="text-xs">
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default UnitDetailModal;
