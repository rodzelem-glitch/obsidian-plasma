
import React from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { ProjectTask, User } from '../../../../../types';

interface TasksTabProps {
    tasks: ProjectTask[];
    employees: User[];
    canSeeAllTasks: boolean;
    onTaskEdit: (task: ProjectTask) => void;
    onTaskAdd: () => void;
}

const TasksTab: React.FC<TasksTabProps> = ({ tasks, employees, canSeeAllTasks, onTaskEdit, onTaskAdd }) => {
    return (
        <Card>
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Tasks & Milestones</h3>
                {canSeeAllTasks && <Button onClick={onTaskAdd} className="text-xs w-auto">+ Add Task</Button>}
            </div>
            <Table headers={['Description', 'Assigned To', 'Due Date', 'Status', 'Action']}>
                {(tasks || []).map((t, idx) => {
                    const assignee = employees.find(u => u.id === t.assignedTo);
                    return (
                        <tr key={idx} className={t.isBenchmark ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 dark:text-white">{t.description}</div>
                                {t.isBenchmark && <span className="text-[10px] bg-blue-200 text-blue-800 px-1 rounded font-bold">MILESTONE</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{assignee ? `${assignee.firstName} ${assignee.lastName}` : '-'}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>{t.status}</span>
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => onTaskEdit(t)} className="text-blue-600 hover:underline text-xs font-bold">Edit</button>
                            </td>
                        </tr>
                    );
                })}
                {tasks.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-500">No tasks assigned.</td></tr>}
            </Table>
        </Card>
    );
};

export default TasksTab;
