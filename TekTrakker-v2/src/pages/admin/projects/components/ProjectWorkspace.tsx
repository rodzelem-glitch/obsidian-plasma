
import React, { useState } from 'react';
import ProjectAnalytics from './ProjectAnalytics';
import ProjectTabs from './ProjectTabs';
import OverviewTab from './tabs/OverviewTab';
import TasksTab from './tabs/TasksTab';
import FinancialsTab from './tabs/FinancialsTab';
import PermitsTab from './tabs/PermitsTab';
import SubsTab from './tabs/SubsTab';
import RentalsTab from './tabs/RentalsTab';
import ProposalsTab from './tabs/ProposalsTab';
import ProjectDocumentsTab from './tabs/ProjectDocumentsTab';
import JobsTab from './tabs/JobsTab';
import JobDetailModal from '../../../../components/modals/JobDetailModal';
import JobAppointmentModal from '../../../../components/modals/JobAppointmentModal';
import { useAppContext } from '../../../../context/AppContext';
import type { Project, ProjectTask, Expense, Permit, Subcontractor, EquipmentRental, Job } from '../../../../types';

interface ProjectWorkspaceProps {
    project: Project;
    onEditProject: () => void;
    onDeleteProject: () => void;
    onNewTask: () => void;
    onEditTask: (task: ProjectTask) => void;
    onNewExpense: () => void;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
    onCreateInvoice: () => void;
    onManageInvoice: (jobId: string) => void;
    onNewPermit: () => void;
    onEditPermit: (permit: Permit) => void;
    onNewSub: () => void;
    onEditSub: (sub: Subcontractor) => void;
    onInviteSub: (sub: Subcontractor) => void;
    onLinkSub: (sub: Subcontractor) => void;
    onNewRental: () => void;
    onEditRental: (rental: EquipmentRental) => void;
}

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = (props) => {
    const { state } = useAppContext();
    const [activeTab, setActiveTab] = useState('overview');
    const [viewingJobDetails, setViewingJobDetails] = useState<Job | null>(null);
    const [schedulingJob, setSchedulingJob] = useState<{ isOpen: boolean; jobToEdit?: Job | null }>({ isOpen: false });
    const canSeeAllTasks = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin';

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab project={props.project} employees={state.users} />;
            case 'tasks':
                return <TasksTab project={props.project} employees={state.users} canSeeAllTasks={canSeeAllTasks} onTaskEdit={props.onEditTask} onTaskAdd={props.onNewTask} />;
            case 'jobs':
                return (
                    <JobsTab
                        project={props.project}
                        onCreateJob={() => setSchedulingJob({ isOpen: true, jobToEdit: null })}
                        onViewJobDetails={(job) => setViewingJobDetails(job)}
                        onEditJob={(job) => setSchedulingJob({ isOpen: true, jobToEdit: job })}
                        onManageInvoice={props.onManageInvoice}
                    />
                );
            case 'financials':
                const projectInvoices = state.jobs.filter(job => job.projectId === props.project.id);
                const projectExpenses = state.expenses ? state.expenses.filter(e => e.projectId === props.project.id) : [];
                
                const financials = {
                    invoices: projectInvoices,
                    expenses: projectExpenses,
                    totalExpenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
                    totalBilled: projectInvoices.reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0),
                    totalCollected: projectInvoices.filter(j => j.invoice?.status === 'Paid').reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0)
                };

                return <FinancialsTab financials={financials} onCreateInvoice={props.onCreateInvoice} onManageInvoice={props.onManageInvoice} onAddExpense={props.onNewExpense} onEditExpense={props.onEditExpense} onDeleteExpense={props.onDeleteExpense} />;
            case 'proposals':
                return <ProposalsTab project={props.project} />;
            case 'documents':
                return <ProjectDocumentsTab project={props.project} />;
            case 'permits':
                return <PermitsTab permits={props.project.permits || []} onPermitAdd={props.onNewPermit} onPermitEdit={props.onEditPermit} />;
            case 'subcontractors':
                return <SubsTab subcontractors={[]} onSubAdd={props.onNewSub} onSubEdit={props.onEditSub} />;
            case 'rentals':
                return <RentalsTab rentals={[]} onRentalAdd={props.onNewRental} onRentalEdit={props.onEditRental} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <ProjectAnalytics project={props.project} />
            <ProjectTabs activeTab={activeTab} onTabClick={setActiveTab} />
            <div>{renderTabContent()}</div>

            {viewingJobDetails && (
                <JobDetailModal
                    job={viewingJobDetails}
                    isOpen={Boolean(viewingJobDetails)}
                    onClose={() => setViewingJobDetails(null)}
                    onEditRecord={() => {
                        const job = viewingJobDetails;
                        setViewingJobDetails(null);
                        setSchedulingJob({ isOpen: true, jobToEdit: job });
                    }}
                />
            )}

            {schedulingJob.isOpen && (
                <JobAppointmentModal
                    isOpen={schedulingJob.isOpen}
                    onClose={() => setSchedulingJob({ isOpen: false, jobToEdit: null })}
                    customerId={props.project.customerId || ''}
                    projectId={props.project.id}
                    jobToEdit={schedulingJob.jobToEdit || null}
                />
            )}
        </div>
    );
};

export default ProjectWorkspace;
