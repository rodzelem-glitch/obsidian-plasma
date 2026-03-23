
import React, { useState, useMemo, useEffect } from 'react';
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

const JobCard: React.FC<{ job: Job; onOpen: () => void }> = ({ job, onOpen }) => (
    <div className="mb-4 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-primary-500 transition-colors group rounded-lg bg-white dark:bg-slate-900" onClick={onOpen}>
        <div className="p-4 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {job.customerName}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                        job.jobStatus === 'Completed' ? 'bg-green-100 text-green-800' : 
                        job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                        {job.jobStatus}
                    </span>
                    {job.assignedPartnerId && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded border border-indigo-100">External Partner Job</span>
                    )}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 mt-1">
                    <MapPinIcon size={12}/> {formatAddress(job.address)}
                </p>
                <div className="flex gap-2 mt-2">
                     {job.tasks.map((t, i) => <span key={i} className={`text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 font-bold`}>{t}</span>)}
                </div>
            </div>
            <div className="h-10 w-10 bg-primary-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                <Play size={20} className={job.jobStatus === 'In Progress' ? 'animate-pulse' : ''} />
            </div>
        </div>
    </div>
);

const DailyBriefing: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, jobs, externalJobs, projects, activeJobIdForWorkflow } = state;
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

    return (
        <div className="p-4 pb-24 max-w-3xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Briefing</h1>
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{new Date().toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">Hello, {currentUser?.firstName}</p>
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

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2"><CheckSquare size={20}/> Today's Schedule</h2>
                {todaysJobs.length > 0 ? (
                    todaysJobs.map(job => (
                        <JobCard key={job.id} job={job} onOpen={() => setActiveJob(job)} />
                    ))
                ) : (
                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed">
                        <p className="text-gray-500 font-medium">No active jobs assigned.</p>
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
