
import React, { useState, useEffect } from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Textarea from '../../ui/Textarea';
import { BusinessDocument, InspectionTemplate, Division } from 'types';
import { Clock, Calendar, Tag, AlertTriangle, Layers, FileText, CheckSquare, Sparkles } from 'lucide-react';

interface JobDetailsProps {
    date: string;
    setDate: (date: string) => void;
    timeSlot: string;
    setTimeSlot: (time: string) => void;
    duration: number;
    setDuration: (duration: number) => void;
    jobType: string;
    setJobType: (type: string) => void;
    availableTypes: string[];
    leadSource: string;
    setLeadSource: (source: string) => void;
    notes: string;
    setNotes: (notes: string) => void;
    isHighPriority: boolean;
    setIsHighPriority: (val: boolean) => void;
    poNumber: string;
    setPoNumber: (val: string) => void;
    
    // Requirements
    waiverTemplates: BusinessDocument[];
    checklistTemplates: InspectionTemplate[];
    selectedWaivers: string[];
    setSelectedWaivers: (ids: string[]) => void;
    selectedDiagChecklists: string[];
    setSelectedDiagChecklists: (ids: string[]) => void;
    selectedQualChecklists: string[];
    setSelectedQualChecklists: (ids: string[]) => void;
    
    // Visit Type
    visitType?: string;
    setVisitType?: (val: string) => void;
    
    // Divisions
    divisions?: Division[];
    divisionId?: string;
    setDivisionId?: (id: string) => void;
}

const timeSlots = Array.from({ length: 33 }, (_, i) => {
    const totalMinutes = 360 + i * 30; // Starts at 06:00 AM
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return {
        value: hh + ':' + mm,
        label: displayHours + ':' + (mm === '0' ? '00' : mm) + ' ' + period,
        minutes: totalMinutes
    };
});

function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 540; // Default 09:00 AM
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function minutesToTimeStr(mins: number): string {
    const hours = Math.floor(mins / 60) % 24;
    const minutes = mins % 60;
    return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}

const standardLeadSources = [
    'Call-In',
    'Website',
    'Google Ads',
    'Facebook Ads',
    'Referral',
    'Repeat Customer',
    'Lawn Sign / Truck Wrap',
    'Radio / TV',
    'Direct Mail',
    'Thumbtack / Angie'
];

const JobDetails: React.FC<JobDetailsProps> = ({ 
    date, 
    setDate, 
    timeSlot, 
    setTimeSlot, 
    duration,
    setDuration,
    jobType, 
    setJobType, 
    availableTypes, 
    leadSource, 
    setLeadSource, 
    notes, 
    setNotes,
    isHighPriority,
    setIsHighPriority,
    poNumber,
    setPoNumber,
    waiverTemplates,
    checklistTemplates,
    selectedWaivers,
    setSelectedWaivers,
    selectedDiagChecklists,
    setSelectedDiagChecklists,
    selectedQualChecklists,
    setSelectedQualChecklists,
    divisions = [],
    divisionId = '',
    setDivisionId,
    visitType = 'Diagnostic & Repair',
    setVisitType
}) => {
    const [scheduleMode, setScheduleMode] = useState<'exact' | 'window' | 'all_day'>('exact');
    const [endTimeSlot, setEndTimeSlot] = useState<string>(() => {
        const startMins = timeToMinutes(timeSlot || '09:00');
        return minutesToTimeStr(startMins + (duration || 120));
    });

    // Update End Time whenever Start Time or Duration changes externally
    useEffect(() => {
        const startMins = timeToMinutes(timeSlot || '09:00');
        setEndTimeSlot(minutesToTimeStr(startMins + (duration || 120)));
    }, [timeSlot, duration]);

    // Handle user changing Start Time
    const handleStartTimeChange = (newStartTime: string) => {
        setTimeSlot(newStartTime);
        const startMins = timeToMinutes(newStartTime);
        const endMins = timeToMinutes(endTimeSlot);
        if (endMins > startMins) {
            setDuration(endMins - startMins);
        } else {
            // Keep duration consistent
            setEndTimeSlot(minutesToTimeStr(startMins + duration));
        }
    };

    // Handle user changing End Time
    const handleEndTimeChange = (newEndTime: string) => {
        setEndTimeSlot(newEndTime);
        const startMins = timeToMinutes(timeSlot);
        const endMins = timeToMinutes(newEndTime);
        if (endMins > startMins) {
            setDuration(endMins - startMins);
        }
    };

    // Preset window handler
    const applyPresetWindow = (mode: 'exact' | 'window' | 'all_day', start: string, end: string) => {
        setScheduleMode(mode);
        setTimeSlot(start);
        setEndTimeSlot(end);
        const startMins = timeToMinutes(start);
        const endMins = timeToMinutes(end);
        setDuration(Math.max(30, endMins - startMins));
    };

    return (
        <div className="space-y-5">
            {/* --- SECTION 1: DATE & TIME SCHEDULING --- */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar size={15} className="text-primary-600 dark:text-primary-400" />
                        Schedule & Time Window
                    </span>

                    {/* Mode Toggle Buttons */}
                    <div className="flex gap-1 bg-slate-200 dark:bg-slate-700/80 p-0.5 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setScheduleMode('exact')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                scheduleMode === 'exact'
                                    ? 'bg-white dark:bg-slate-800 text-primary-700 dark:text-primary-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Exact Time
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMode('window')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                scheduleMode === 'window'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Time Window
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPresetWindow('all_day', '08:00', '17:00')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                scheduleMode === 'all_day'
                                    ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            All Day (8-5)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <Input label="Appointment Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    
                    <Select label={scheduleMode === 'window' ? "Window Start Time" : "Start Time"} value={timeSlot} onChange={e => handleStartTimeChange(e.target.value)}>
                        {timeSlots.map(slot => (
                            <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                    </Select>

                    <Select label={scheduleMode === 'window' ? "Window End Time" : "Estimated End Time"} value={endTimeSlot} onChange={e => handleEndTimeChange(e.target.value)}>
                        {timeSlots.map(slot => (
                            <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                    </Select>

                    <Select label="Duration" value={duration.toString()} onChange={e => setDuration(parseInt(e.target.value) || 120)}>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                        <option value="150">2.5 hours</option>
                        <option value="180">3 hours</option>
                        <option value="240">4 hours</option>
                        <option value="300">5 hours</option>
                        <option value="360">6 hours</option>
                        <option value="480">8 hours (Full Day)</option>
                        <option value="540">9 hours (Extended)</option>
                    </Select>
                </div>

                {/* Preset Time Window Quick Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Windows:</span>
                    <button
                        type="button"
                        onClick={() => applyPresetWindow('window', '08:00', '12:00')}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-colors cursor-pointer"
                    >
                        🌅 Morning (8 AM - 12 PM)
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPresetWindow('window', '12:00', '16:00')}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-colors cursor-pointer"
                    >
                        ☀️ Afternoon (12 PM - 4 PM)
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPresetWindow('window', '16:00', '20:00')}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-colors cursor-pointer"
                    >
                        🌙 Evening (4 PM - 8 PM)
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPresetWindow('all_day', '08:00', '17:00')}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-colors cursor-pointer"
                    >
                        🏢 All Day (8 AM - 5 PM)
                    </button>
                </div>
            </div>

            {/* --- SECTION 2: JOB CLASSIFICATION & CUSTOM SOURCE --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                {divisions.length > 0 && (
                    <Select label="Assign Division" value={divisionId} onChange={e => setDivisionId && setDivisionId(e.target.value)}>
                        <option value="">-- No Division --</option>
                        {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </Select>
                )}

                <Select label="Job Type" value={jobType} onChange={e => setJobType(e.target.value)}>
                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>

                {setVisitType && (
                    <Select label="Visit Type" value={visitType} onChange={e => setVisitType(e.target.value)}>
                        <option value="Diagnostic Only">Diagnostic Only</option>
                        <option value="Diagnostic & Repair">Diagnostic & Repair</option>
                        <option value="Repair">Repair</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Service Call">Service Call</option>
                        <option value="Other">Other</option>
                    </Select>
                )}

                <Input 
                    label="WO / PO Reference #" 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    placeholder="e.g. WO-9981 or PO-10293" 
                />

                {/* Custom Source Input with Datalist & Quick Chips */}
                <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="custom-lead-source" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Job / Lead Source
                    </label>
                    <input
                        id="custom-lead-source"
                        type="text"
                        list="lead-sources"
                        value={leadSource}
                        onChange={e => setLeadSource(e.target.value)}
                        placeholder="Type custom source (e.g. Google Ads, Radio Q1, Call-In...)"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <datalist id="lead-sources">
                        {standardLeadSources.map(s => (
                            <option key={s} value={s} />
                        ))}
                    </datalist>

                    {/* Preset Source Chips */}
                    <div className="flex flex-wrap gap-1 pt-1">
                        {['Call-In', 'Website', 'Google Ads', 'Facebook Ads', 'Referral', 'Repeat Customer'].map(src => (
                            <button
                                key={src}
                                type="button"
                                onClick={() => setLeadSource(src)}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer border ${
                                    leadSource === src
                                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border-indigo-300 font-extrabold'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {src}
                            </button>
                        ))}
                    </div>
                </div>

                {/* High Priority Emergency Switch */}
                <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 hover:dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800/80 transition-colors w-full">
                        <input 
                            type="checkbox" 
                            checked={isHighPriority} 
                            onChange={(e) => setIsHighPriority(e.target.checked)}
                            className="rounded border-red-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-black uppercase text-red-700 dark:text-red-300 flex items-center gap-1">
                            <AlertTriangle size={14} className="text-red-600 shrink-0" />
                            High Priority (Emergency)
                        </span>
                    </label>
                </div>
            </div>

            {/* --- SECTION 3: JOB REQUIREMENTS --- */}
            <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-primary-600 dark:text-primary-400" />
                    Job Requirements & Checklists
                </h4>
                
                {waiverTemplates.length > 0 && (
                    <div>
                        <div className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-1">Required Waivers</div>
                        <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            {waiverTemplates.map(t => (
                                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                    <input type="checkbox" checked={selectedWaivers.includes(t.id)} onChange={() => setSelectedWaivers(selectedWaivers.includes(t.id) ? selectedWaivers.filter(id => id !== t.id) : [...selectedWaivers, t.id])} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">{t.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <div className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-1">Diagnosis Checklists</div>
                        <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            {checklistTemplates.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic p-1">No checklists available</p>
                            ) : (
                                checklistTemplates.map(t => (
                                    <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                        <input type="checkbox" checked={selectedDiagChecklists.includes(t.id)} onChange={() => setSelectedDiagChecklists(selectedDiagChecklists.includes(t.id) ? selectedDiagChecklists.filter(id => id !== t.id) : [...selectedDiagChecklists, t.id])} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{t.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-1">Quality Checklists</div>
                        <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            {checklistTemplates.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic p-1">No checklists available</p>
                            ) : (
                                checklistTemplates.map(t => (
                                    <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                        <input type="checkbox" checked={selectedQualChecklists.includes(t.id)} onChange={() => setSelectedQualChecklists(selectedQualChecklists.includes(t.id) ? selectedQualChecklists.filter(id => id !== t.id) : [...selectedQualChecklists, t.id])} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                        <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{t.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECTION 4: NOTES & INSTRUCTIONS --- */}
            <Textarea 
                label="Notes / Special Dispatch Instructions" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Enter job instructions, access details, gate codes, or work order notes for technician..."
            />
        </div>
    );
};

export default JobDetails;
