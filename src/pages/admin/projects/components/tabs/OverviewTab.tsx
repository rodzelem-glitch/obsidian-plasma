
import React from 'react';
import Card from '../../../../../components/ui/Card';
import type { Project, User } from '../../../../../types';

interface OverviewTabProps {
    project: Project;
    employees: User[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({ project, employees }) => {
    return (
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">{project.description || 'No description provided.'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.customerName}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                            <p className={`font-bold ${project.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{project.status}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Start Date</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Target End</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}</p>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Project Leadership</h3>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border mb-6">
                         <p className="text-xs font-bold text-slate-400 uppercase mb-2">Project Manager</p>
                         {project.managerId ? (
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                     {(employees.find(e => e.id === project.managerId)?.firstName || 'U')[0]}
                                 </div>
                                 <div>
                                     <p className="font-bold text-sm text-slate-900 dark:text-white">{employees.find(e => e.id === project.managerId)?.firstName} {employees.find(e => e.id === project.managerId)?.lastName}</p>
                                 </div>
                             </div>
                         ) : <p className="text-sm italic text-slate-500">Unassigned</p>}
                    </div>

                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Assigned Team</h3>
                    <div className="space-y-2">
                        {project.teamIds && project.teamIds.length > 0 ? project.teamIds.map(uid => {
                            const u = employees.find(u => u.id === uid);
                            return u ? (
                                <div key={uid} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded border">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">{u.firstName[0]}</div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</p>
                                        <p className="text-xs text-slate-500 uppercase">{u.role}</p>
                                    </div>
                                </div>
                            ) : null;
                        }) : <p className="text-slate-500 italic">No team members assigned.</p>}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default OverviewTab;
