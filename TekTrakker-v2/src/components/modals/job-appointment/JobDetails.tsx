
import React from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Textarea from '../../ui/Textarea';
import { BusinessDocument, InspectionTemplate, Division } from 'types';

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
        label: displayHours + ':' + mm + ' ' + period
    };
});

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
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Select label="Time" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
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
                    <option value="480">8 hours</option>
                </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    label="PO / External Work Order #" 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    placeholder="e.g. PO-10293 or WO-9981" 
                />
                <div className="flex flex-col gap-3">
                    <Select label="Source" value={leadSource} onChange={e => setLeadSource(e.target.value)}>
                        <option value="Call-In">Direct Call</option>
                        <option value="Referral">Referral</option>
                    </Select>
                    
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 hover:dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 transition-colors w-fit">
                        <input 
                            type="checkbox" 
                            checked={isHighPriority} 
                            onChange={(e) => setIsHighPriority(e.target.checked)}
                            className="rounded border-red-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">High Priority (Emergency)</span>
                    </label>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Job Requirements</h4>
                
                <div>
                    <div className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Required Waivers</div>
                    <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded border">
                        {waiverTemplates.map(t => (
                            <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                <input type="checkbox" checked={selectedWaivers.includes(t.id)} onChange={() => setSelectedWaivers(selectedWaivers.includes(t.id) ? selectedWaivers.filter(id => id !== t.id) : [...selectedWaivers, t.id])} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                <span>{t.title}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <div className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Diagnosis Checklists</div>
                        <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded border">
                            {checklistTemplates.map(t => (
                                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                    <input type="checkbox" checked={selectedDiagChecklists.includes(t.id)} onChange={() => setSelectedDiagChecklists(selectedDiagChecklists.includes(t.id) ? selectedDiagChecklists.filter(id => id !== t.id) : [...selectedDiagChecklists, t.id])} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="truncate">{t.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Quality Checklists</div>
                        <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-white dark:bg-slate-900 rounded border">
                            {checklistTemplates.map(t => (
                                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                    <input type="checkbox" checked={selectedQualChecklists.includes(t.id)} onChange={() => setSelectedQualChecklists(selectedQualChecklists.includes(t.id) ? selectedQualChecklists.filter(id => id !== t.id) : [...selectedQualChecklists, t.id])} className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                                    <span className="truncate">{t.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Textarea label="Notes / Instructions" value={notes} onChange={e => setNotes(e.target.value)} />
        </>
    );
};

export default JobDetails;
