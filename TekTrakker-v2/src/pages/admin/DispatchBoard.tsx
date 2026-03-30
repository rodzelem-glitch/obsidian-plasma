import React, { useMemo, useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import type { Job, User } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../../constants/constants';
import { Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import JobDetailModal from '../../components/modals/JobDetailModal';

const DispatchBoard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
    const [viewMode, setViewMode] = useState<'1day'|'3day'>('1day');
    const numDays = viewMode === '3day' ? 3 : 1;
    const containerRef = useRef<HTMLDivElement>(null);
    
    const timelineStartHour = 6;
    const timelineEndHour = 22;
    const totalHours = timelineEndHour - timelineStartHour;

    const technicians = useMemo(() => {
        const currentOrgId = state.currentOrganization?.id;
        const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'subcontractor', 'admin']);
        const allTechs = (state.users as User[]).filter((u: User) => 
            u.organizationId === currentOrgId && 
            WORKFORCE_ROLES.has((u.role || '').toLowerCase())
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
            
            const [sy, sm, sd] = selectedDate.split('-').map(Number);
            const viewStart = new Date(sy, sm - 1, sd);
            const viewEnd = new Date(sy, sm - 1, sd + numDays);
            
            const jobDate = new Date(j.appointmentTime);
            return jobDate >= viewStart && jobDate < viewEnd;
        });
    }, [state.jobs, state.externalJobs, selectedDate, numDays]);

    const getJobStyle = (job: Job) => {
        const start = new Date(job.appointmentTime);
        const [sy, sm, sd] = selectedDate.split('-').map(Number);
        const viewStart = new Date(sy, sm - 1, sd);
        
        const dayOffset = Math.floor((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
        if (dayOffset < 0 || dayOffset >= numDays) return { display: 'none' };
        
        const startOfDay = new Date(start);
        startOfDay.setHours(timelineStartHour, 0, 0, 0);
        
        const durationMinutes = 120; // Default duration 2 hours
        const totalViewMinutes = totalHours * 60 * numDays;
        
        let startOffsetMinutes = (start.getTime() - startOfDay.getTime()) / 60000;
        if (startOffsetMinutes < 0) startOffsetMinutes = 0;
        if (startOffsetMinutes > totalHours * 60) startOffsetMinutes = totalHours * 60;
        
        const globalOffsetMinutes = (dayOffset * totalHours * 60) + startOffsetMinutes;
        
        const widthPercent = (durationMinutes / totalViewMinutes) * 100;
        const leftPercent = (globalOffsetMinutes / totalViewMinutes) * 100;
        
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
        
        const totalDroppedMinutes = percent * (totalHours * 60 * numDays);
        const dayOffset = Math.floor(totalDroppedMinutes / (totalHours * 60));
        const minutesIntoDay = totalDroppedMinutes % (totalHours * 60);

        const [year, month, day] = selectedDate.split('-').map(Number);
        const newDate = new Date(year, month - 1, day + dayOffset); 
        newDate.setHours(timelineStartHour, 0, 0, 0);
        newDate.setMinutes(minutesIntoDay);
        
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
    
    const [activeTechId, setActiveTechId] = useState<string | null>(null);
    const [viewingJob, setViewingJob] = useState<Job | null>(null);

    // Initialize activeTechId if not set
    if (!activeTechId && technicians.length > 0) {
        setActiveTechId(technicians[0].id);
    }

    const activeTech = useMemo(() => technicians.find(t => t.id === activeTechId), [technicians, activeTechId]);
    const activeTechJobs = useMemo(() => jobs.filter(j => j.assignedTechnicianId === activeTechId), [jobs, activeTechId]);

    return (
        <div className="h-full flex flex-col space-y-4">
            <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
                        <Users size={20}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dispatch Board</h2>
                        <div className="flex gap-2 mt-1 text-[10px] uppercase font-bold text-gray-500 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Install</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Repair</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Maint</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Partner</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="hidden md:flex bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5 mr-2">
                        <button onClick={() => setViewMode('1day')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === '1day' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>1 Day</button>
                        <button onClick={() => setViewMode('3day')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === '3day' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>3 Days</button>
                    </div>
                    <button onClick={() => changeDay(-1)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all shadow-sm">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="bg-transparent text-gray-900 dark:text-white border-none rounded px-3 py-1.5 text-sm font-bold focus:ring-0 text-center" 
                    />
                    <button onClick={() => changeDay(1)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all shadow-sm">
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Mobile View: Technician Selector + Job List */}
            <div className="md:hidden flex flex-col flex-1 min-h-0 space-y-4">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                    {technicians.map(tech => (
                        <button
                            key={tech.id}
                            onClick={() => setActiveTechId(tech.id)}
                            className={`flex-none flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                                activeTechId === tech.id
                                    ? 'bg-primary-600 border-primary-500 text-white shadow-lg scale-105'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                                activeTechId === tech.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
                            }`}>
                                {tech.firstName[0]}{tech.lastName[0]}
                            </div>
                            <span className="text-[10px] font-bold max-w-[80px] truncate">{tech.firstName}</span>
                        </button>
                    ))}
                </div>

                <Card className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/30 border-none shadow-none p-0">
                    <div className="space-y-3 p-1">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-3 mb-2">
                            {activeTech ? `${activeTech.firstName}'s Schedule` : 'Select a Technician'} 
                            <span className="ml-2 bg-gray-200 dark:bg-gray-700 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] lowercase">{activeTechJobs.length} jobs</span>
                        </h3>
                        
                        {activeTechJobs.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl text-center border border-dashed border-gray-300 dark:border-gray-700 mx-3">
                                <p className="text-sm text-gray-500">No jobs scheduled for this technician today.</p>
                            </div>
                        ) : (
                            activeTechJobs.sort((a,b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime()).map(job => (
                                <div key={job.id} className={`mx-3 p-4 rounded-2xl border bg-white dark:bg-gray-800 shadow-sm border-l-8 ${getJobColor(job)}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">{new Date(job.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p className="font-bold text-gray-900 dark:text-white">{job.customerName}</p>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-lg text-[10px] font-bold text-primary-600">
                                            {job.jobStatus}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{job.tasks[0]}</p>
                                    <div className="flex justify-between items-center text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-700/50 -mx-4 -mb-4 p-3 rounded-b-2xl border-t border-gray-100 dark:border-gray-800">
                                        <span className="truncate max-w-[200px]">{job.address}</span>
                                        <button onClick={() => setViewingJob(job)} className="text-primary-600 font-bold">Details &rsaquo;</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Desktop View: Timeline */}
            <Card className="hidden md:flex flex-1 overflow-hidden flex-col bg-white dark:bg-gray-800 p-0 relative border border-gray-200 dark:border-gray-700">
                <div className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar touch-pan-x" ref={containerRef}>
                    <div className="relative pb-8" style={{ minWidth: viewMode === '3day' ? '2400px' : '1000px' }}> 
                        <div className="flex border-b border-gray-200 dark:border-gray-700 ml-40 sticky top-0 bg-gray-50 dark:bg-gray-900 z-20 shadow-sm">
                            {Array.from({ length: numDays }).map((_, dayIndex) => {
                                const [y, m, d] = selectedDate.split('-').map(Number);
                                const dateHeader = new Date(y, m - 1, d + dayIndex);
                                const isFirstDay = dayIndex === 0;
                                return (
                                    <div key={dayIndex} className={`flex-1 flex flex-col ${!isFirstDay ? 'border-l-2 border-indigo-500/30' : ''}`}>
                                        <div className="bg-gray-100 dark:bg-gray-800/80 py-1 text-center text-xs font-black text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                            {dateHeader.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                        <div className="flex">
                                            {Array.from({ length: totalHours }).map((_, i) => (
                                                <div key={i} className="flex-1 py-1 text-center text-[9px] font-bold text-gray-400 border-l border-gray-200 dark:border-gray-800 first:border-l-0">
                                                    {timelineStartHour + i}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {technicians.map((tech: User) => (
                                <div key={tech.id} className="flex min-h-[90px] relative hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <div className="w-40 p-3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 flex flex-col justify-center sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{tech.firstName} {tech.lastName}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-black">{tech.role.replace('_', ' ')}</p>
                                    </div>
                                    
                                    <div className="flex-1 relative bg-grid-pattern" style={{ backgroundSize: `calc(100% / ${numDays * totalHours * 2}) 100%` }} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tech.id)}>
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {Array.from({ length: numDays }).map((_, dayIndex) => (
                                                <div key={dayIndex} className={`flex-1 flex ${dayIndex > 0 ? 'border-l-2 border-indigo-500/30' : ''}`}>
                                                    {Array.from({ length: totalHours }).map((_, i) => (
                                                        <div key={i} className="flex-1 border-r border-gray-100 dark:border-gray-700/50"></div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>

                                        {jobs.filter((j: Job) => j.assignedTechnicianId === tech.id).map((job: Job) => (
                                            <div
                                                key={job.id}
                                                draggable
                                                onClick={() => setViewingJob(job)}
                                                onDragStart={(e) => handleDragStart(e, job.id)}
                                                className={`absolute top-2 bottom-2 rounded-lg p-2 text-[10px] font-medium text-white overflow-hidden cursor-pointer hover:scale-[1.02] shadow-md border-l-4 z-10 transition-all ${getJobColor(job)}`}
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

            <JobDetailModal 
                isOpen={!!viewingJob} 
                onClose={() => setViewingJob(null)} 
                job={viewingJob as Job} 
                isAdmin={true} 
                onPrint={() => window.print()} 
            />
        </div>
    );
};

export default DispatchBoard;
