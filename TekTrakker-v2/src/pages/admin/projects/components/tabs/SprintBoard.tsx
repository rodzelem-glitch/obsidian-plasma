import React, { useState, useMemo } from 'react';
import Card from '../../../../../components/ui/Card';
import Button from '../../../../../components/ui/Button';
import type { Project, ProjectTask, User, Sprint } from '../../../../../types';
import { Clock, CheckCircle, Circle, AlertOctagon, Eye, GripVertical, User as UserIcon, Zap, Target, ChevronDown, ChevronUp } from 'lucide-react';

type BoardColumn = 'Pending' | 'In Progress' | 'Blocked' | 'Review' | 'Completed';

const COLUMNS: { id: BoardColumn; label: string; color: string; icon: React.FC<any>; bgClass: string }[] = [
    { id: 'Pending', label: 'To Do', color: 'text-slate-500', icon: Circle, bgClass: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700' },
    { id: 'In Progress', label: 'In Progress', color: 'text-blue-500', icon: Clock, bgClass: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' },
    { id: 'Blocked', label: 'Blocked', color: 'text-red-500', icon: AlertOctagon, bgClass: 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800' },
    { id: 'Review', label: 'Review', color: 'text-amber-500', icon: Eye, bgClass: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' },
    { id: 'Completed', label: 'Done', color: 'text-emerald-500', icon: CheckCircle, bgClass: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' },
];

const PRIORITY_COLORS: Record<string, string> = {
    Critical: 'bg-red-500 text-white',
    High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    Low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

interface SprintBoardProps {
    project: Project;
    employees: User[];
    canSeeAllTasks: boolean;
    onTaskEdit: (task: ProjectTask) => void;
    onTaskAdd: () => void;
    onStatusChange: (taskId: string, newStatus: BoardColumn) => void;
    onSprintCreate: () => void;
    onSprintEdit: (sprint: Sprint) => void;
}

const SprintBoard: React.FC<SprintBoardProps> = ({
    project, employees, canSeeAllTasks, onTaskEdit, onTaskAdd, onStatusChange, onSprintCreate, onSprintEdit
}) => {
    const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
    const [draggedTask, setDraggedTask] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<BoardColumn | null>(null);
    const [showBacklog, setShowBacklog] = useState(true);

    // Collect ALL tasks from the project (flat + WBS)
    const allTasks = useMemo(() => {
        const tasks: ProjectTask[] = [...(project.projectTasks || []), ...(project.backlog || [])];
        // Also collect tasks from the WBS hierarchy
        for (const phase of (project.phases || [])) {
            for (const del of (phase.deliverables || [])) {
                for (const wp of (del.workPackages || [])) {
                    tasks.push(...(wp.tasks || []));
                }
            }
        }
        // Deduplicate by ID
        const seen = new Set<string>();
        return tasks.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
    }, [project]);

    const activeSprint = project.sprints?.find(s => s.id === selectedSprintId) || project.sprints?.find(s => s.status === 'Active');
    
    // Tasks for the selected sprint
    const sprintTasks = useMemo(() => {
        if (!activeSprint) return allTasks; // Show all tasks if no sprint selected
        return allTasks.filter(t => activeSprint.taskIds.includes(t.id) || t.sprintId === activeSprint.id);
    }, [allTasks, activeSprint]);

    const backlogTasks = useMemo(() => {
        if (!activeSprint) return [];
        const sprintTaskIds = new Set(activeSprint.taskIds);
        return allTasks.filter(t => !sprintTaskIds.has(t.id) && !t.sprintId && t.status !== 'Completed');
    }, [allTasks, activeSprint]);

    const getAssigneeName = (id?: string) => {
        if (!id) return null;
        const user = employees.find(u => u.id === id);
        return user ? `${user.firstName} ${user.lastName}` : null;
    };

    const getAssigneeInitial = (id?: string) => {
        if (!id) return '?';
        const user = employees.find(u => u.id === id);
        return user ? user.firstName[0] : '?';
    };

    // Velocity calculation
    const sprintVelocity = useMemo(() => {
        const completedTasks = sprintTasks.filter(t => t.status === 'Completed');
        return completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    }, [sprintTasks]);

    const totalPoints = useMemo(() => {
        return sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    }, [sprintTasks]);

    // Drag handlers
    const handleDragStart = (taskId: string) => {
        setDraggedTask(taskId);
    };

    const handleDragOver = (e: React.DragEvent, column: BoardColumn) => {
        e.preventDefault();
        setDragOverColumn(column);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = (column: BoardColumn) => {
        if (draggedTask) {
            onStatusChange(draggedTask, column);
        }
        setDraggedTask(null);
        setDragOverColumn(null);
    };

    const tasksByColumn = useMemo(() => {
        const map: Record<BoardColumn, ProjectTask[]> = { Pending: [], 'In Progress': [], Blocked: [], Review: [], Completed: [] };
        for (const task of sprintTasks) {
            const col = task.status as BoardColumn;
            if (map[col]) {
                map[col].push(task);
            } else {
                map['Pending'].push(task); // Default unknown statuses to Pending
            }
        }
        return map;
    }, [sprintTasks]);

    return (
        <Card className="p-0 overflow-hidden">
            {/* Board Header */}
            <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-800 dark:to-blue-900/10 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Zap size={20} className="text-blue-500" />
                            Sprint Board
                        </h2>
                        {activeSprint && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold">
                                {activeSprint.status === 'Active' ? '🟢 Active' : '📋 Planning'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {canSeeAllTasks && (
                            <>
                                <Button variant="secondary" onClick={onSprintCreate} className="text-xs h-8">+ Sprint</Button>
                                <Button onClick={onTaskAdd} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">+ Task</Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Sprint Selector + Metrics */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        {project.sprints && project.sprints.length > 0 ? (
                            <select
                                aria-label="Select Sprint"
                                value={activeSprint?.id || ''}
                                onChange={e => setSelectedSprintId(e.target.value || null)}
                                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium"
                            >
                                <option value="">All Tasks (No Sprint Filter)</option>
                                {project.sprints.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {s.status === 'Active' ? '🟢' : s.status === 'Completed' ? '✅' : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-sm text-slate-500 italic">No sprints created yet</span>
                        )}
                        {activeSprint?.goal && (
                            <span className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                <Target size={12} /> {activeSprint.goal}
                            </span>
                        )}
                    </div>

                    {/* Velocity Metrics */}
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500">Tasks:</span>
                            <span className="font-bold text-slate-800 dark:text-white">{sprintTasks.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500">Points:</span>
                            <span className="font-bold text-blue-600">{sprintVelocity}</span>
                            <span className="text-slate-400">/ {totalPoints}</span>
                        </div>
                        {totalPoints > 0 && (
                            <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                                    // eslint-disable-next-line react/forbid-dom-props
                                    ref={el => { if (el) el.style.width = `${Math.min((sprintVelocity / totalPoints) * 100, 100)}%`; }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-5 gap-0 min-h-[400px]">
                {COLUMNS.map(col => {
                    const tasks = tasksByColumn[col.id];
                    const isDropTarget = dragOverColumn === col.id;
                    return (
                        <div
                            key={col.id}
                            className={`border-r last:border-r-0 border-slate-200 dark:border-slate-700 flex flex-col ${isDropTarget ? 'bg-blue-50/80 dark:bg-blue-900/20' : ''}`}
                            onDragOver={e => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(col.id)}
                        >
                            {/* Column Header */}
                            <div className={`p-3 border-b ${col.bgClass} flex items-center justify-between sticky top-0`}>
                                <div className="flex items-center gap-2">
                                    <col.icon size={14} className={col.color} />
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{col.label}</span>
                                </div>
                                <span className="text-xs bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    {tasks.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                                {tasks.map(task => (
                                    <div
                                        key={task.id}
                                        draggable={canSeeAllTasks}
                                        onDragStart={() => handleDragStart(task.id)}
                                        onClick={() => canSeeAllTasks && onTaskEdit(task)}
                                        className={`p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                                            draggedTask === task.id ? 'opacity-40 scale-95' : ''
                                        }`}
                                    >
                                        {/* Priority & Labels */}
                                        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                                            {task.priority && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${PRIORITY_COLORS[task.priority] || ''}`}>
                                                    {task.priority}
                                                </span>
                                            )}
                                            {task.isBenchmark && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 font-bold">🏁 Milestone</span>
                                            )}
                                            {(task.labels || []).slice(0, 2).map((label, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                                    {label}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Task Description */}
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">{task.description}</p>

                                        {/* Blocked Reason */}
                                        {task.status === 'Blocked' && task.blockedReason && (
                                            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded mb-2">
                                                🚫 {task.blockedReason}
                                            </div>
                                        )}

                                        {/* Footer: Assignee, Points, Due */}
                                        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                {task.assignedTo ? (
                                                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold" title={getAssigneeName(task.assignedTo) || ''}>
                                                        {getAssigneeInitial(task.assignedTo)}
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                                        <UserIcon size={10} className="text-slate-400" />
                                                    </div>
                                                )}
                                                {task.storyPoints && (
                                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
                                                        {task.storyPoints}pt
                                                    </span>
                                                )}
                                            </div>
                                            {task.dueDate && (
                                                <span className={`text-[10px] ${
                                                    new Date(task.dueDate) < new Date() && task.status !== 'Completed'
                                                        ? 'text-red-600 font-bold'
                                                        : 'text-slate-400'
                                                }`}>
                                                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {tasks.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-xs">
                                        <p>Drop tasks here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Backlog Section */}
            {activeSprint && backlogTasks.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setShowBacklog(!showBacklog)}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400"
                    >
                        <span>📋 Backlog ({backlogTasks.length} unassigned tasks)</span>
                        {showBacklog ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showBacklog && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3 bg-slate-50/50 dark:bg-slate-900/20">
                            {backlogTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => canSeeAllTasks && onTaskEdit(task)}
                                    className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all text-sm"
                                >
                                    <p className="font-medium text-slate-700 dark:text-slate-300 text-xs line-clamp-2">{task.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        {task.storyPoints && (
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">{task.storyPoints}pt</span>
                                        )}
                                        {task.priority && (
                                            <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default SprintBoard;
