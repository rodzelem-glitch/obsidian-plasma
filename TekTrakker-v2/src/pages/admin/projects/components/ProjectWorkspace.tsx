
import React, { useState } from 'react';
import ProjectAnalytics from './ProjectAnalytics';
import ProjectTabs from './ProjectTabs';
import OverviewTab from './tabs/OverviewTab';
import TasksTab from './tabs/TasksTab';
import FinancialsTab from './tabs/FinancialsTab';
import PermitsTab from './tabs/PermitsTab';
import SubsTab from './tabs/SubsTab';
import RentalsTab from './tabs/RentalsTab';
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
    const canSeeAllTasks = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin';

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab project={props.project} employees={state.users} />;
            case 'tasks':
                return <TasksTab tasks={props.project.projectTasks || []} employees={state.users} canSeeAllTasks={canSeeAllTasks} onTaskEdit={props.onEditTask} onTaskAdd={props.onNewTask} />;
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
        </div>
    );
};

export default ProjectWorkspace;
