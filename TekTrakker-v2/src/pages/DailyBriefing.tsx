
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import { 
    ClipboardList, CheckSquare, Play, MapPinIcon
} from 'lucide-react';
import type { Job, Project, ProjectTask } from 'types';
import { formatAddress } from 'lib/utils';

import WeatherWidget from './briefing/components/WeatherWidget';
import ProjectTaskWorkflowModal from './briefing/components/ProjectTaskWorkflowModal';
import JobWorkflowModal from './briefing/components/JobWorkflowModal';

const JobCard: React.FC<{ job: Job; onOpen: () => void }> = ({ job, onOpen }) => {
    const timeStr = job.appointmentTime ? new Date(job.appointmentTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    return (
    <div className="mb-3 overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-sm cursor-pointer hover:border-primary-400 active:scale-[0.99] transition-all group rounded-xl bg-white dark:bg-slate-800" onClick={onOpen}>
        <div className="p-4 flex gap-3 items-center">
            {timeStr && (
                <div className="shrink-0 w-16 text-center">
                    <div className="text-lg font-black text-primary-600 dark:text-primary-400 leading-tight">{timeStr}</div>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {job.customerName}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                        job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {job.jobStatus}
                    </span>
                    {job.assignedPartnerId && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 rounded border border-indigo-100">Partner</span>
                    )}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 truncate">
                    <MapPinIcon size={12} className="shrink-0"/> {formatAddress(job.address)}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                     {job.tasks.map((t, i) => <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 font-semibold">{t}</span>)}
                </div>
            </div>
            <div className="h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-all shrink-0">
                <Play size={18} className={job.jobStatus === 'In Progress' ? 'animate-pulse' : ''} />
            </div>
        </div>
    </div>
);
};

const DailyBriefing: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, jobs, externalJobs, projects, activeJobIdForWorkflow } = state;
    const navigate = useNavigate();
    const [selectedTaskData, setSelectedTaskData] = useState<{task: ProjectTask, project: Project} | null>(null);
    const [activeJob, setActiveJob] = useState<Job | null>(null);

    const todaysJobs = useMemo(() => {
        if (!currentUser) return [];
        
        const combinedJobs = [...(jobs || []), ...(externalJobs || [])];

        return combinedJobs.filter(j => 
            j.assignedTechnicianId === currentUser.id && j.jobStatus !== 'Completed'
        ).sort((a,b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime());
    }, [jobs, externalJobs, currentUser]);

    // This effect handles re-opening the workflow modal after returning from proposal creation
    useEffect(() => {
        if (activeJobIdForWorkflow) {
            const jobToOpen = todaysJobs.find(j => j.id === activeJobIdForWorkflow);
            if (jobToOpen) {
                setActiveJob(jobToOpen);
                // Clear the trigger so it doesn't re-open on every render
                dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: null });
            }
        }
    }, [activeJobIdForWorkflow, todaysJobs, dispatch]);

    const myTasks = useMemo(() => {
        if (!currentUser || !projects) return [];
        const list: {task: ProjectTask, project: Project}[] = [];
        (projects || []).forEach(p => {
            if (p.projectTasks) {
                p.projectTasks.forEach(t => {
                    if (t.assignedTo === currentUser.id && t.status !== 'Completed') {
                        list.push({ task: t, project: p });
                    }
                });
            }
        });
        return list;
    }, [projects, currentUser]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div className="p-4 pb-24 max-w-3xl mx-auto space-y-5 animate-fade-in">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{greeting}, {currentUser?.firstName}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {todaysJobs.length > 0 ? `${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} on your schedule` : 'No jobs scheduled — you\'re clear'}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
            </header>

            <WeatherWidget />

            {myTasks.length > 0 && (
                <Card className="mb-6 border-l-4 border-purple-500">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ClipboardList size={20} className="text-purple-600"/> Assigned Project Tasks
                    </h3>
                    <div className="space-y-3">
                        {myTasks.map(({task, project}) => (
                            <div key={task.id} onClick={() => setSelectedTaskData({task, project})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-purple-400 transition-colors flex justify-between items-center group">
                                <div><p className="font-bold text-slate-800 dark:text-white">{task.description}</p><p className="text-xs text-slate-500">{project.name}</p></div>
                                <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">Update</div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                  onClick={() => navigate('/briefing/hr?tab=safety')}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors text-red-700 dark:text-red-400 font-bold shadow-sm"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    Report Incident
                </button>
                <button 
                  onClick={() => navigate('/briefing/hr')}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors text-blue-700 dark:text-blue-400 font-bold shadow-sm"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    HR & Handbooks
                </button>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2"><CheckSquare size={20}/> Today's Schedule</h2>
                {todaysJobs.length > 0 ? (
                    todaysJobs.map(job => (
                        <JobCard key={job.id} job={job} onOpen={() => setActiveJob(job)} />
                    ))
                ) : (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <CheckSquare size={28} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-semibold">All clear!</p>
                        <p className="text-sm text-slate-400 mt-1">No active jobs assigned to you right now.</p>
                    </div>
                )}
            </div>
            
            {activeJob && (
                <JobWorkflowModal 
                    job={activeJob} 
                    isOpen={!!activeJob} 
                    onClose={() => setActiveJob(null)} 
                    onUpdate={(updatedJob) => dispatch({ type: 'UPDATE_JOB', payload: updatedJob })} 
                />
            )}
            
            {selectedTaskData && <ProjectTaskWorkflowModal isOpen={!!selectedTaskData} onClose={() => setSelectedTaskData(null)} task={selectedTaskData.task} project={selectedTaskData.project} /> }
        </div>
    );
};

export default DailyBriefing;
