
import React from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Textarea from '../../ui/Textarea';
import { BusinessDocument, InspectionTemplate } from 'types';

interface JobDetailsProps {
    date: string;
    setDate: (date: string) => void;
    timeSlot: string;
    setTimeSlot: (time: string) => void;
    jobType: string;
    setJobType: (type: string) => void;
    availableTypes: string[];
    leadSource: string;
    setLeadSource: (source: string) => void;
    notes: string;
    setNotes: (notes: string) => void;
    isHighPriority: boolean;
    setIsHighPriority: (val: boolean) => void;
    
    // Requirements
    waiverTemplates: BusinessDocument[];
    checklistTemplates: InspectionTemplate[];
    selectedWaivers: string[];
    setSelectedWaivers: (ids: string[]) => void;
    selectedDiagChecklists: string[];
    setSelectedDiagChecklists: (ids: string[]) => void;
    selectedQualChecklists: string[];
    setSelectedQualChecklists: (ids: string[]) => void;
}

const JobDetails: React.FC<JobDetailsProps> = ({ 
    date, 
    setDate, 
    timeSlot, 
    setTimeSlot, 
    jobType, 
    setJobType, 
    availableTypes, 
    leadSource, 
    setLeadSource, 
    notes, 
    setNotes,
    isHighPriority,
    setIsHighPriority,
    waiverTemplates,
    checklistTemplates,
    selectedWaivers,
    setSelectedWaivers,
    selectedDiagChecklists,
    setSelectedDiagChecklists,
    selectedQualChecklists,
    setSelectedQualChecklists
}) => {
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Select label="Time Slot" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                    <option value="09:00">Morning</option>
                    <option value="13:00">Afternoon</option>
                    <option value="17:00">Evening</option>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Job Type" value={jobType} onChange={e => setJobType(e.target.value)}>
                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
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
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Required Waivers</label>
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
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Diagnosis Checklists</label>
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
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Quality Checklists</label>
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
