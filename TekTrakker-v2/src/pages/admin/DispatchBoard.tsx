import React, { useMemo, useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import type { Job, User } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../../constants/constants';
import { Users } from 'lucide-react';
import { db } from '../../lib/firebase';

const DispatchBoard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
    const containerRef = useRef<HTMLDivElement>(null);
    
    const timelineStartHour = 6;
    const timelineEndHour = 22;
    const totalHours = timelineEndHour - timelineStartHour;

    const technicians = useMemo(() => {
        const currentOrgId = state.currentOrganization?.id;
        const allTechs = (state.users as User[]).filter((u: User) => 
            u.organizationId === currentOrgId && 
            (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor')
        );
        
        if (state.currentUser?.role === 'supervisor') {
            return allTechs.filter((u: User) => u.reportsTo === state.currentUser?.id || u.id === state.currentUser?.id);
        }
        return allTechs;
    }, [state.users, state.currentUser, state.currentOrganization]);

    // Linked Partners for lookup
    const linkedPartners = useMemo(() => state.subcontractors.filter(s => s.handshakeStatus === 'Linked' && s.linkedOrgId), [state.subcontractors]);
    
    const jobs = useMemo(() => {
        const combinedJobs = [...(state.jobs || []), ...(state.externalJobs || [])];
        return combinedJobs.filter((j: Job) => {
            if (!j.appointmentTime) return false;
            const jobDate = new Date(j.appointmentTime);
            
            // Robust date comparison
            const y = jobDate.getFullYear();
            const m = String(jobDate.getMonth() + 1).padStart(2, '0');
            const d = String(jobDate.getDate()).padStart(2, '0');
            const manualDateStr = `${y}-${m}-${d}`;
            
            return manualDateStr === selectedDate;
        });
    }, [state.jobs, state.externalJobs, selectedDate]);

    const getJobStyle = (job: Job) => {
        const start = new Date(job.appointmentTime);
        const startOfDay = new Date(start);
        startOfDay.setHours(timelineStartHour, 0, 0, 0);
        const durationMinutes = 120; // Default duration 2 hours
        const totalMinutes = totalHours * 60;
        let startOffsetMinutes = (start.getTime() - startOfDay.getTime()) / 60000;
        if (startOffsetMinutes < 0) startOffsetMinutes = 0;
        const widthPercent = (durationMinutes / totalMinutes) * 100;
        const leftPercent = (startOffsetMinutes / totalMinutes) * 100;
        return { left: `${leftPercent}%`, width: `${widthPercent}%` };
    };

    const getJobColor = (job: Job) => {
        if (job.assignedPartnerId === state.currentOrganization?.id) return 'bg-indigo-600 border-indigo-400'; // Special color for partner jobs
        if (job.jobStatus === 'Completed') return 'bg-emerald-600 border-emerald-400';
        if (job.jobStatus === 'In Progress') return 'bg-blue-600 border-blue-400';
        const tasks = (job.tasks || []).join(' ').toLowerCase();
        if (tasks.includes('install')) return 'bg-purple-600 border-purple-400';
        if (tasks.includes('maintenance') || tasks.includes('tune')) return 'bg-cyan-600 border-cyan-400';
        if (tasks.includes('repair')) return 'bg-orange-600 border-orange-400';
        return 'bg-gray-600 border-gray-400';
    };

    const handleDragStart = (e: React.DragEvent, jobId: string) => {
        setDraggedJobId(jobId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", jobId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, techId: string) => {
        e.preventDefault();
        const jobId = draggedJobId;
        if (!jobId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percent = offsetX / rect.width;
        const minutesToAdd = percent * (totalHours * 60);
        const [year, month, day] = selectedDate.split('-').map(Number);
        const newDate = new Date(year, month - 1, day); 
        newDate.setHours(timelineStartHour, 0, 0, 0);
        newDate.setMinutes(minutesToAdd);
        
        const combinedJobs = [...(state.jobs || []), ...(state.externalJobs || [])];
        const job = combinedJobs.find(j => j.id === jobId);
        
        if (job) {
            const tech = technicians.find(t => t.id === techId);
            const updates: any = {
                assignedTechnicianId: techId,
                assignedTechnicianName: tech ? `${tech.firstName} ${tech.lastName}` : 'Assigned',
                appointmentTime: newDate.toISOString()
            };

            // Only clear partner assignment if WE are the owner organization
            if (state.currentOrganization?.id === job.organizationId) {
                updates.assignedPartnerId = null;
                updates.partnerAllowDirectPayment = false;
            }
            
            const updatedJob: Job = { ...job, ...updates };
            
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            await db.collection('jobs').doc(jobId).update(updates);
        }
        setDraggedJobId(null);
    };

    const changeDay = (days: number) => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const current = new Date(y, m - 1, d);
        current.setDate(current.getDate() + days);
        const newY = current.getFullYear();
        const newM = String(current.getMonth() + 1).padStart(2, '0');
        const newD = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${newY}-${newM}-${newD}`);
    };
    
    return (
        <div className="h-full flex flex-col space-y-4">
            <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dispatch Board</h2>
                    <div className="flex gap-2 mt-1 text-[10px] uppercase font-bold text-gray-500">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Install</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Repair</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Maint</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Partner Job</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-center">
                    <button onClick={() => changeDay(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm font-bold" 
                    />
                    <button onClick={() => changeDay(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <Card className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-gray-800 p-0 relative border border-gray-200 dark:border-gray-700">
                <div className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar touch-pan-x" ref={containerRef}>
                    <div className="min-w-[1000px] relative pb-8"> 
                        <div className="flex border-b border-gray-200 dark:border-gray-700 ml-40 sticky top-0 bg-gray-50 dark:bg-gray-900 z-20 shadow-sm">
                            {Array.from({ length: totalHours + 1 }).map((_, i) => (
                                <div key={i} className="flex-1 py-2 text-center text-[10px] font-bold text-gray-400 border-l border-gray-200 dark:border-gray-800 first:border-l-0">
                                    {timelineStartHour + i}:00
                                </div>
                            ))}
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {technicians.map((tech: User) => (
                                <div key={tech.id} className="flex min-h-[90px] relative hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <div className="w-40 p-3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 flex flex-col justify-center sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{tech.firstName} {tech.lastName}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-black">{tech.role.replace('_', ' ')}</p>
                                    </div>
                                    
                                    <div className="flex-1 relative bg-grid-pattern" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tech.id)}>
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {Array.from({ length: totalHours }).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-gray-100 dark:border-gray-700/50"></div>
                                            ))}
                                        </div>

                                        {jobs.filter((j: Job) => j.assignedTechnicianId === tech.id).map((job: Job) => (
                                            <div
                                                key={job.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, job.id)}
                                                className={`absolute top-2 bottom-2 rounded-lg p-2 text-[10px] font-medium text-white overflow-hidden cursor-move hover:opacity-90 shadow-md border-l-4 z-10 transition-all ${getJobColor(job)}`}
                                                style={getJobStyle(job)}
                                            >
                                                <div className="font-bold truncate drop-shadow-md">{job.customerName}</div>
                                                <div className="truncate opacity-90">{job.tasks[0]}</div>
                                                {job.assignedPartnerId === state.currentOrganization?.id && (
                                                    <div className="text-[8px] uppercase font-black bg-white/20 px-1 rounded mt-1 inline-block">Partner Job</div>
                                                )}
                                                {job.assistants && job.assistants.length > 0 && (
                                                    <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                        <Users size={10}/> +{job.assistants.length}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DispatchBoard;
