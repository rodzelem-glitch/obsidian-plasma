import React, { useState } from 'react';
import Card from '../../../../../components/ui/Card';
import Button from '../../../../../components/ui/Button';
import type { Project, ProjectTask, User, ProjectPhase, Deliverable, WorkPackage, ProjectSubtask } from '../../../../../types';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Clock, AlertOctagon, Eye } from 'lucide-react';

interface TasksTabProps {
    project: Project;
    employees: User[];
    canSeeAllTasks: boolean;
    onTaskEdit: (task: ProjectTask) => void;
    onTaskAdd: () => void;
    onAddWBSNode?: (type: 'Phase' | 'Deliverable' | 'WorkPackage', parentId?: string) => void;
}

const TasksTab: React.FC<TasksTabProps> = ({ project, employees, canSeeAllTasks, onTaskEdit, onTaskAdd, onAddWBSNode }) => {
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
    const [expandedDeliverables, setExpandedDeliverables] = useState<Record<string, boolean>>({});
    const [expandedWorkPackages, setExpandedWorkPackages] = useState<Record<string, boolean>>({});
    const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

    const togglePhase = (id: string) => setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleDeliverable = (id: string) => setExpandedDeliverables(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleWorkPackage = (id: string) => setExpandedWorkPackages(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleTask = (id: string) => setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));

    const getAssigneeName = (id?: string) => {
        if (!id) return 'Unassigned';
        const user = employees.find(u => u.id === id);
        return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
    };

    const StatusIcon = ({ status }: { status?: string }) => {
        if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (status === 'In Progress') return <Clock className="w-4 h-4 text-blue-500" />;
        if (status === 'Blocked') return <AlertOctagon className="w-4 h-4 text-red-500" />;
        if (status === 'Review') return <Eye className="w-4 h-4 text-amber-500" />;
        return <Circle className="w-4 h-4 text-slate-400" />;
    };

    const renderSubtasks = (subtasks?: ProjectSubtask[]) => {
        if (!subtasks || subtasks.length === 0) return null;
        return (
            <div className="ml-8 mt-2 space-y-2 border-l-2 border-slate-100 dark:border-slate-700 pl-4">
                {subtasks.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded text-sm">
                        <div className="flex items-center space-x-2">
                            <StatusIcon status={st.status} />
                            <span className="text-slate-700 dark:text-slate-300">{st.title}</span>
                        </div>
                        <span className="text-xs text-slate-500">{getAssigneeName(st.assignedTo)}</span>
                    </div>
                ))}
            </div>
        );
    };

    const renderTasks = (tasks?: ProjectTask[]) => {
        if (!tasks || tasks.length === 0) return <div className="text-sm text-slate-500 p-2 ml-6">No tasks assigned.</div>;
        return (
            <div className="ml-6 mt-2 space-y-2">
                {tasks.map(task => {
                    const isExpanded = expandedTasks[task.id];
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    return (
                        <div key={task.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                            <div className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center space-x-3 cursor-pointer flex-1" onClick={() => hasSubtasks && toggleTask(task.id)}>
                                    {hasSubtasks ? (isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />) : <div className="w-4" />}
                                    <StatusIcon status={task.status} />
                                    <span className="font-medium text-sm text-slate-900 dark:text-white">{task.description}</span>
                                    {task.storyPoints && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">{task.storyPoints}pt</span>}
                                    {task.isBenchmark && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">Milestone</span>}
                                    {task.priority && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            task.priority === 'High' ? 'bg-red-100 text-red-800' :
                                            task.priority === 'Medium' ? 'bg-orange-100 text-orange-800' :
                                            'bg-slate-100 text-slate-800'
                                        }`}>{task.priority}</span>
                                    )}
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="text-xs text-slate-500 hidden sm:block">
                                        <div className="font-medium">{getAssigneeName(task.assignedTo)}</div>
                                        <div>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</div>
                                    </div>
                                    {canSeeAllTasks && (
                                        <button onClick={() => onTaskEdit(task)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                                    )}
                                </div>
                            </div>
                            {isExpanded && hasSubtasks && (
                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-700">
                                    {renderSubtasks(task.subtasks)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderWorkPackages = (workPackages?: WorkPackage[]) => {
        if (!workPackages || workPackages.length === 0) return <div className="text-sm text-slate-500 p-2 ml-6">No work packages.</div>;
        return (
            <div className="ml-6 mt-2 space-y-3">
                {workPackages.map(wp => {
                    const isExpanded = expandedWorkPackages[wp.id];
                    return (
                        <div key={wp.id} className="border border-indigo-100 dark:border-indigo-900/30 rounded-lg overflow-hidden">
                            <div 
                                className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-900/10 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                onClick={() => toggleWorkPackage(wp.id)}
                            >
                                <div className="flex items-center space-x-2">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-indigo-500" />}
                                    <span className="font-semibold text-sm text-indigo-900 dark:text-indigo-300">WP: {wp.name}</span>
                                </div>
                                {wp.assignedTeam && <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded">Team: {wp.assignedTeam}</span>}
                            </div>
                            {isExpanded && (
                                <div className="p-3 bg-white dark:bg-slate-800 border-t border-indigo-100 dark:border-indigo-900/30">
                                    {wp.description && <div className="text-xs text-slate-500 mb-3 ml-6">{wp.description}</div>}
                                    {renderTasks(wp.tasks)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDeliverables = (deliverables?: Deliverable[]) => {
        if (!deliverables || deliverables.length === 0) return <div className="text-sm text-slate-500 p-2 ml-6">No deliverables.</div>;
        return (
            <div className="ml-6 mt-2 space-y-3">
                {deliverables.map(del => {
                    const isExpanded = expandedDeliverables[del.id];
                    return (
                        <div key={del.id} className="border border-purple-100 dark:border-purple-900/30 rounded-lg overflow-hidden">
                            <div 
                                className="flex items-center justify-between p-3 bg-purple-50/50 dark:bg-purple-900/10 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                onClick={() => toggleDeliverable(del.id)}
                            >
                                <div className="flex items-center space-x-2">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-purple-500" /> : <ChevronRight className="w-4 h-4 text-purple-500" />}
                                    <StatusIcon status={del.status} />
                                    <span className="font-semibold text-sm text-purple-900 dark:text-purple-300">Deliverable: {del.name}</span>
                                </div>
                                {del.dueDate && <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded">Due: {new Date(del.dueDate).toLocaleDateString()}</span>}
                            </div>
                            {isExpanded && (
                                <div className="p-3 bg-white dark:bg-slate-800 border-t border-purple-100 dark:border-purple-900/30">
                                    {del.description && <div className="text-xs text-slate-500 mb-3 ml-6">{del.description}</div>}
                                    {canSeeAllTasks && onAddWBSNode && (
                                        <div className="px-3 pb-3 ml-3">
                                            <Button variant="secondary" className="text-xs py-1 h-7" onClick={() => onAddWBSNode('WorkPackage', del.id)}>+ Add Work Package</Button>
                                        </div>
                                    )}
                                    {renderWorkPackages(del.workPackages)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderPhases = () => {
        const phases = project.phases;
        if (!phases || phases.length === 0) return null;
        
        return (
            <div className="space-y-4 mb-8">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs mb-3">Project Phases</h4>
                {phases.map(phase => {
                    const isExpanded = expandedPhases[phase.id] !== false; // Default expanded
                    return (
                        <div key={phase.id} className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                            <div 
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                onClick={() => togglePhase(phase.id)}
                            >
                                <div className="flex items-center space-x-3">
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                                    <StatusIcon status={phase.status} />
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{phase.name}</h3>
                                </div>
                                <div className="flex space-x-2 text-xs">
                                    {phase.startDate && <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">Start: {new Date(phase.startDate).toLocaleDateString()}</span>}
                                    {phase.endDate && <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">End: {new Date(phase.endDate).toLocaleDateString()}</span>}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="p-4 bg-white dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700">
                                    {phase.description && <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 ml-8">{phase.description}</div>}
                                    {canSeeAllTasks && onAddWBSNode && (
                                        <div className="px-4 pb-4 ml-4">
                                            <Button variant="secondary" className="text-sm py-1 h-8" onClick={() => onAddWBSNode('Deliverable', phase.id)}>+ Add Deliverable</Button>
                                        </div>
                                    )}
                                    {renderDeliverables(phase.deliverables)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const hasPhases = project.phases && project.phases.length > 0;
    const hasBacklog = project.backlog && project.backlog.length > 0;
    const hasLegacyTasks = project.projectTasks && project.projectTasks.length > 0;

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Project Work Breakdown Structure</h2>
                    <p className="text-sm text-slate-500 mt-1">Hierarchical view of phases, deliverables, work packages, and tasks.</p>
                </div>
                <div className="flex gap-2">
                    {canSeeAllTasks && onAddWBSNode && (
                        <Button variant="secondary" onClick={() => onAddWBSNode('Phase')} className="shadow-sm">+ Add Phase</Button>
                    )}
                    {canSeeAllTasks && (
                        <Button onClick={onTaskAdd} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">+ Create Task</Button>
                    )}
                </div>
            </div>

            {hasPhases && renderPhases()}

            {(hasBacklog || hasLegacyTasks) && (
                <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs mb-3">
                        {hasBacklog ? 'Backlog / Unassigned Tasks' : 'Legacy Tasks'}
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        {renderTasks(project.backlog || project.projectTasks)}
                    </div>
                </div>
            )}

            {!hasPhases && !hasBacklog && !hasLegacyTasks && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No tasks or phases defined</h3>
                    <p className="text-slate-500 mt-1 mb-4">Start building your project structure by adding phases and tasks.</p>
                    {canSeeAllTasks && <Button onClick={onTaskAdd}>Add First Task</Button>}
                </div>
            )}
        </Card>
    );
};

export default TasksTab;
