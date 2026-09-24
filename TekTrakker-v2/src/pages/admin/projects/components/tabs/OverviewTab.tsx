import React, { useMemo } from 'react';
import Card from '../../../../../components/ui/Card';
import type { Project, User } from '../../../../../types';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useAppContext } from '../../../../../context/AppContext';
import { Wrench, FileText, FolderArchive, ClipboardList } from 'lucide-react';

interface OverviewTabProps {
    project: Project;
    employees: User[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({ project, employees }) => {
    const { t } = useLanguage();
    const { state } = useAppContext();

    const linkedJobs = useMemo(() => {
        return (state.jobs || []).filter(j => j.projectId === project.id);
    }, [state.jobs, project.id]);

    const linkedProposals = useMemo(() => {
        return (state.proposals || []).filter((p: any) => p.projectId === project.id || (p.isProjectLevel && p.projectId === project.id));
    }, [state.proposals, project.id]);

    const linkedDocumentsCount = useMemo(() => {
        const direct = (project.files || []).length;
        const excluded = new Set(project.excludedFileIds || []);
        const fromJobs = linkedJobs.reduce((acc, j) => {
            const activeFiles = (j.files || []).filter(f => !excluded.has(f.id));
            return acc + activeFiles.length;
        }, 0);
        return direct + fromJobs;
    }, [project.files, project.excludedFileIds, linkedJobs]);

    const tasks = project.projectTasks || [];
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;

    return (
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">{project.description || t('No description provided.')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Customer")}</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.customerName}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Status")}</p>
                            <p className={`font-bold ${project.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{t(project.status)}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Start Date")}</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.startDate ? new Date(project.startDate).toLocaleDateString() : t('TBD')}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 border rounded">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Target End")}</p>
                            <p className="font-bold text-slate-900 dark:text-white">{project.endDate ? new Date(project.endDate).toLocaleDateString() : t('TBD')}</p>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t("Project Leadership")}</h3>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border mb-6">
                         <p className="text-xs font-bold text-slate-400 uppercase mb-2">{t("Project Manager")}</p>
                         {project.managerId ? (
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                     {(employees.find(e => e.id === project.managerId)?.firstName || 'U')[0]}
                                 </div>
                                 <div>
                                     <p className="font-bold text-sm text-slate-900 dark:text-white">{employees.find(e => e.id === project.managerId)?.firstName} {employees.find(e => e.id === project.managerId)?.lastName}</p>
                                 </div>
                             </div>
                         ) : <p className="text-sm italic text-slate-500">{t("Unassigned")}</p>}
                    </div>

                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t("Assigned Team")}</h3>
                    <div className="space-y-2">
                        {project.teamIds && project.teamIds.length > 0 ? project.teamIds.map(uid => {
                            const u = employees.find(u => u.id === uid);
                            return u ? (
                                <div key={uid} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded border">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">{(u.firstName || '')[0] || (u.email || '')[0] || '?'}</div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</p>
                                        <p className="text-xs text-slate-500 uppercase">{t(u.role)}</p>
                                    </div>
                                </div>
                            ) : null;
                        }) : <p className="text-slate-500 italic">{t("No team members assigned.")}</p>}
                    </div>
                </div>
            </div>

            {/* Quick Status Cards */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{t("Project Activity & Linked Assets")}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">{t("Jobs & Work Orders")}</span>
                            <Wrench size={16} className="text-blue-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{linkedJobs.length}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {linkedJobs.filter(j => j.jobStatus === 'Completed').length} {t("completed")}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">{t("Commercial Bids")}</span>
                            <FileText size={16} className="text-indigo-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{linkedProposals.length}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {linkedProposals.filter(p => p.status === 'Approved').length} {t("approved")}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">{t("Documents & Quotes")}</span>
                            <FolderArchive size={16} className="text-amber-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{linkedDocumentsCount}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {(project.files || []).length} {t("direct uploads")}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">{t("Tasks & Sprints")}</span>
                            <ClipboardList size={16} className="text-purple-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{tasks.length}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {completedTasks} / {tasks.length} {t("done")}
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default OverviewTab;
