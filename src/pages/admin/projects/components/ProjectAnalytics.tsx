
import React from 'react';
import { CheckCircle2, ListTodo, DollarSign, AlertTriangle } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import type { Project } from '../../../../types';

interface ProjectAnalyticsProps {
    project: Project;
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({ project }) => {
    if (!project) return null;

    const completedTasks = project.projectTasks?.filter(t => t.status === 'Completed').length || 0;
    const totalTasks = project.projectTasks?.length || 0;
    const budgetUsed = 0; 

    return (
        <Card className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Budget Usage */}
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                    <DollarSign className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Budget Spent</p>
                    <p className="font-bold text-xl text-gray-800 dark:text-gray-100">
                        ${budgetUsed.toLocaleString()} / <span className="text-base text-gray-600 dark:text-gray-300">${(project.budget || 0).toLocaleString()}</span>
                    </p>
                </div>
            </div>

            {/* Task Completion */}
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                    <CheckCircle2 className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tasks Completed</p>
                    <p className="font-bold text-xl text-gray-800 dark:text-gray-100">
                        {completedTasks} / <span className="text-base text-gray-600 dark:text-gray-300">{totalTasks}</span>
                    </p>
                </div>
            </div>

            {/* Pending Tasks */}
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                    <ListTodo className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending Tasks</p>
                    <p className="font-bold text-xl text-gray-800 dark:text-gray-100">{totalTasks - completedTasks}</p>
                </div>
            </div>

            {/* Overdue Tasks */}
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                    <AlertTriangle className="text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
                    <p className="font-bold text-xl text-gray-800 dark:text-gray-100">{project.projectTasks?.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length || 0}</p>
                </div>
            </div>
        </Card>
    );
};

export default ProjectAnalytics;
