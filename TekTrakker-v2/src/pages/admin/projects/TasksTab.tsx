import React from 'react';
import type { ProjectTask, User } from 'types';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';

interface TasksTabProps {
    tasks: ProjectTask[];
    employees: User[];
    canSeeAllTasks: boolean;
    onAddTask: () => void;
    onEditTask: (task: ProjectTask) => void;
}

const TasksTab: React.FC<TasksTabProps> = ({ tasks, employees, canSeeAllTasks, onAddTask, onEditTask }) => {
    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Tasks & Milestones</h3>
                {canSeeAllTasks && <Button onClick={onAddTask} className="text-xs w-auto">+ Add Task</Button>}
            </div>
            <Table headers={['Description', 'Assigned To', 'Due Date', 'Status', 'Action']}>
                {(tasks || []).map((t, idx) => {
                    const assignee = employees.find(u => u.id === t.assignedTo);
                    return (
                        <tr key={idx} className={`${t.isBenchmark ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/80`}>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 dark:text-white">{t.description}</div>
                                {t.isBenchmark && <span className="text-[10px] bg-blue-200 text-blue-800 px-1 rounded font-bold">MILESTONE</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'TBD'}</td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-slate-100 dark:bg-slate-700 dark:text-slate-200'}`}>{t.status}</span>
                            </td>
                            <td className="px-6 py-4">
                                {canSeeAllTasks && <button onClick={() => onEditTask(t)} className="text-blue-600 hover:underline text-xs font-bold">Edit</button>}
                            </td>
                        </tr>
                    );
                })}
                {tasks.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-500">No tasks found.</td></tr>}
            </Table>
        </div>
    );
};

export default TasksTab;
