import React, { useMemo } from 'react';
import { CheckCircle2, ListTodo, DollarSign, AlertTriangle, Zap, TrendingUp, AlertOctagon, Eye } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import type { Project, ProjectTask } from '../../../../types';

interface ProjectAnalyticsProps {
    project: Project;
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({ project }) => {
    if (!project) return null;

    // Collect ALL tasks across the entire project (flat + WBS hierarchy)
    const allTasks = useMemo(() => {
        const tasks: ProjectTask[] = [...(project.projectTasks || []), ...(project.backlog || [])];
        for (const phase of (project.phases || [])) {
            for (const del of (phase.deliverables || [])) {
                for (const wp of (del.workPackages || [])) {
                    tasks.push(...(wp.tasks || []));
                }
            }
        }
        const seen = new Set<string>();
        return tasks.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
    }, [project]);

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'Completed').length;
    const blockedTasks = allTasks.filter(t => t.status === 'Blocked').length;
    const inReviewTasks = allTasks.filter(t => t.status === 'Review').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'In Progress').length;
    const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
    const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Sprint velocity
    const activeSprint = project.sprints?.find(s => s.status === 'Active');
    const totalPoints = allTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = allTasks.filter(t => t.status === 'Completed').reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // Hours tracking
    const totalEstHours = allTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualHours = allTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Task Progress */}
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Progress</p>
                        <p className="text-lg font-black text-blue-900 dark:text-blue-100 leading-tight">{progressPct.toFixed(0)}%</p>
                    </div>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                    <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-700" 
                        ref={el => { if (el) el.style.width = `${progressPct}%`; }} 
                    />
                </div>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">{completedTasks} / {totalTasks} tasks</p>
            </Card>

            {/* Active Work */}
            <Card className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
                        <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active</p>
                        <p className="text-lg font-black text-emerald-900 dark:text-emerald-100 leading-tight">{inProgressTasks}</p>
                    </div>
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                    {inReviewTasks > 0 && <span className="mr-2"><Eye size={10} className="inline" /> {inReviewTasks} in review</span>}
                </p>
            </Card>

            {/* Velocity / Points */}
            <Card className="p-3 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-800/50 flex items-center justify-center">
                        <Zap size={16} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Velocity</p>
                        <p className="text-lg font-black text-violet-900 dark:text-violet-100 leading-tight">
                            {completedPoints}<span className="text-sm font-medium text-violet-500">/{totalPoints} pts</span>
                        </p>
                    </div>
                </div>
                {activeSprint && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-1 truncate">🏃 {activeSprint.name}</p>
                )}
            </Card>

            {/* Hours */}
            <Card className="p-3 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-800/50 flex items-center justify-center">
                        <ListTodo size={16} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Hours</p>
                        <p className="text-lg font-black text-cyan-900 dark:text-cyan-100 leading-tight">
                            {totalActualHours}<span className="text-sm font-medium text-cyan-500">/{totalEstHours}h</span>
                        </p>
                    </div>
                </div>
                {totalEstHours > 0 && (
                    <div className="w-full bg-cyan-200 dark:bg-cyan-800 rounded-full h-1.5 mt-1.5">
                        <div 
                            className="bg-cyan-600 h-1.5 rounded-full transition-all" 
                            ref={el => { if (el) el.style.width = `${Math.min((totalActualHours / totalEstHours) * 100, 100)}%`; }} 
                        />
                    </div>
                )}
            </Card>

            {/* Blocked */}
            <Card className={`p-3 border ${blockedTasks > 0 ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${blockedTasks > 0 ? 'bg-red-100 dark:bg-red-800/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                        <AlertOctagon size={16} className={blockedTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'} />
                    </div>
                    <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${blockedTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Blocked</p>
                        <p className={`text-lg font-black leading-tight ${blockedTasks > 0 ? 'text-red-900 dark:text-red-100' : 'text-slate-400'}`}>{blockedTasks}</p>
                    </div>
                </div>
            </Card>

            {/* Overdue */}
            <Card className={`p-3 border ${overdueTasks > 0 ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overdueTasks > 0 ? 'bg-orange-100 dark:bg-orange-800/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                        <AlertTriangle size={16} className={overdueTasks > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'} />
                    </div>
                    <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${overdueTasks > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>Overdue</p>
                        <p className={`text-lg font-black leading-tight ${overdueTasks > 0 ? 'text-orange-900 dark:text-orange-100' : 'text-slate-400'}`}>{overdueTasks}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ProjectAnalytics;
