
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { db } from 'lib/firebase';
import type { Project, Permit, Subcontractor, EquipmentRental, ProjectTask, Job, Expense } from 'types';
import { Search, Trash2, Briefcase, ClipboardList, DollarSign, File, HardHat, Truck } from 'lucide-react';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';

import FinancialsTab from './projects/components/tabs/FinancialsTab';
import TasksTab from './projects/components/tabs/TasksTab';
import OverviewTab from './projects/components/tabs/OverviewTab';
import PermitsTab from './projects/components/tabs/PermitsTab';
import SubsTab from './projects/components/tabs/SubsTab';
import RentalsTab from './projects/components/tabs/RentalsTab';

import ProjectModal from './projects/modals/ProjectModal';
import TaskModal from './projects/modals/TaskModal';
import ExpenseModal from './projects/modals/ExpenseModal';
import PermitModal from './projects/modals/PermitModal';
import AddSubcontractorModal from '../../components/modals/AddSubcontractorModal'; 
import RentalModal from './projects/modals/RentalModal';
import { globalConfirm } from "lib/globalConfirm";

const ProjectManagement: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'permits' | 'subs' | 'rentals' | 'financials'>('overview');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [projectSearch, setProjectSearch] = useState('');

    // --- STATE MANAGEMENT ---
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectForm, setProjectForm] = useState<Partial<Project>>({ status: 'Planning', budget: 0, teamIds: [], assignedSubcontractorIds: [], managerId: '' });

    const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
    const [permitForm, setPermitForm] = useState<Partial<Permit>>({ status: 'Pending', type: '' });

    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Partial<Subcontractor> | null>(null);

    const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
    const [rentalForm, setRentalForm] = useState<Partial<EquipmentRental>>({ status: 'Active', cost: 0 });

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskForm, setTaskForm] = useState<Partial<ProjectTask>>({ status: 'Pending', isBenchmark: false });

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({ date: new Date().toISOString().split('T')[0], category: 'Materials', amount: 0 });
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

    // --- COMPUTED DATA ---
    const employees = useMemo(() => state.users.filter(u => u.organizationId === state.currentOrganization?.id && u.role !== 'customer'), [state.users, state.currentOrganization]);
    const filteredProjects = useMemo(() => state.projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())), [state.projects, projectSearch]);

    const projectFinancials = useMemo(() => {
        if (!selectedProject) return { expenses: [], invoices: [], totalExpenses: 0, totalBilled: 0, totalCollected: 0 };
        const expenses = state.expenses.filter(e => e.projectId === selectedProject.id);
        const invoices = state.jobs.filter(j => j.projectId === selectedProject.id);
        const rentals = state.rentals.filter(r => r.projectId === selectedProject.id);
        const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0) + rentals.reduce((sum, r) => sum + r.cost, 0);
        const billedTotal = invoices.reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
        const collectedTotal = invoices.filter(j => j.invoice?.status === 'Paid').reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
        return { expenses, invoices, totalExpenses: expenseTotal, totalBilled: billedTotal, totalCollected: collectedTotal };
    }, [selectedProject, state.expenses, state.jobs, state.rentals]);

    const progressStats = useMemo(() => {
        if (!selectedProject?.projectTasks) return { percent: 0, completed: 0, total: 0 };
        const total = selectedProject.projectTasks.length;
        const completed = selectedProject.projectTasks.filter(t => t.status === 'Completed').length;
        return { percent: total > 0 ? (completed / total) * 100 : 0, completed, total };
    }, [selectedProject]);

    // --- EFFECTS ---
    useEffect(() => {
        if (!selectedProject && state.projects.length > 0) {
            setSelectedProject(state.projects[0]);
        } else if (selectedProject) {
            const updated = state.projects.find(p => p.id === selectedProject.id);
            if (updated) setSelectedProject(updated);
        }
    }, [state.projects]);

    // --- HANDLERS ---
    const handleSaveProject = async (form: Partial<Project>) => {
        if (!form.name || !form.customerId || !state.currentOrganization) { alert("Project Name and Customer are required."); return; }
        const customer = state.customers.find(c => c.id === form.customerId);
        const project: Project = { ...form, organizationId: state.currentOrganization.id, customerName: customer?.name || 'Unknown', id: form.id || `proj-${Date.now()}`, createdAt: form.createdAt || new Date().toISOString() } as Project;
        await db.collection('projects').doc(project.id).set(project, { merge: true });
        dispatch({ type: form.id ? 'UPDATE_PROJECT' : 'ADD_PROJECT', payload: project });
        setSelectedProject(project);
        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async () => {
        if (!selectedProject || !await globalConfirm("Delete this project and all associated data?")) return;
        await db.collection('projects').doc(selectedProject.id).delete();
        dispatch({ type: 'DELETE_PROJECT', payload: selectedProject.id });
        setSelectedProject(null);
    };

    const handleSavePermit = async (form: Partial<Permit>) => {
        if (!selectedProject || !form.number) return;
        const permit: Permit = { ...form, id: form.id || `perm-${Date.now()}` } as Permit;
        const updatedPermits = form.id ? (selectedProject.permits || []).map(p => p.id === permit.id ? permit : p) : [...(selectedProject.permits || []), permit];
        await db.collection('projects').doc(selectedProject.id).update({ permits: updatedPermits });
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...selectedProject, permits: updatedPermits } });
        setIsPermitModalOpen(false);
    };

    const handleSaveSubcontractor = async (subData: Partial<Subcontractor>) => {
        if (!state.currentOrganization || !subData.companyName) return;
        const subId = subData.id || `sub-${Date.now()}`;
        const sub: Subcontractor = { ...subData, organizationId: state.currentOrganization.id, id: subId } as Subcontractor;
        await db.collection('subcontractors').doc(sub.id).set(sub, { merge: true });
        dispatch({ type: subData.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: sub });
        setIsSubModalOpen(false);
    };

    const handleSaveRental = async (form: Partial<EquipmentRental>) => {
        if (!state.currentOrganization || !form.equipmentName) return;
        const rental: EquipmentRental = { ...form, organizationId: state.currentOrganization.id, projectId: selectedProject?.id, id: form.id || `rent-${Date.now()}` } as EquipmentRental;
        await db.collection('rentals').doc(rental.id).set(rental, { merge: true });
        dispatch({ type: form.id ? 'UPDATE_RENTAL' : 'ADD_RENTAL', payload: rental });
        setIsRentalModalOpen(false);
    };

    const handleSaveTask = async (form: Partial<ProjectTask>) => {
        if (!selectedProject || !form.description) return;
        const task: ProjectTask = { ...form, id: form.id || `task-${Date.now()}` } as ProjectTask;
        const updatedTasks = form.id ? (selectedProject.projectTasks || []).map(t => t.id === task.id ? task : t) : [...(selectedProject.projectTasks || []), task];
        await db.collection('projects').doc(selectedProject.id).update({ projectTasks: updatedTasks });
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...selectedProject, projectTasks: updatedTasks } });
        setIsTaskModalOpen(false);
    };

    const handleSaveExpense = async (form: Partial<Expense>) => {
        if (!selectedProject || !state.currentOrganization || !form.amount) return;
        const expense: Expense = { ...form, organizationId: state.currentOrganization.id, projectId: selectedProject.id, id: form.id || `exp-${Date.now()}` } as Expense;
        await db.collection('expenses').doc(expense.id).set(expense, { merge: true });
        dispatch({ type: form.id ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE', payload: expense });
        setIsExpenseModalOpen(false);
    };

    const handleDeleteExpense = async (id: string) => {
        if (!await globalConfirm("Delete expense?")) return;
        await db.collection('expenses').doc(id).delete();
        dispatch({ type: 'DELETE_EXPENSE', payload: id });
    };

    const handleCreateInvoice = async () => {
        if (!selectedProject || !state.currentOrganization) return;
        const jobId = `job-inv-${Date.now()}`;
        const newInvoice: Job = { id: jobId, organizationId: state.currentOrganization.id, projectId: selectedProject.id, customerName: selectedProject.customerName, customerId: selectedProject.customerId, address: selectedProject.address || '', tasks: [`Project Invoice: ${selectedProject.name}`], jobStatus: 'Completed', appointmentTime: new Date().toISOString(), source: 'ProjectManager', specialInstructions: '', invoice: { id: `INV-${Date.now()}`, status: 'Unpaid', items: [], subtotal: 0, taxRate: (state.currentOrganization.taxRate || 8.25) / 100, taxAmount: 0, totalAmount: 0, amount: 0 }, jobEvents: [], createdAt: new Date().toISOString() };
        await db.collection('jobs').doc(jobId).set(newInvoice);
        dispatch({ type: 'ADD_JOB', payload: newInvoice });
        setEditingInvoiceId(jobId);
    };

    // --- PERMISSIONS ---
    const canSeeAllTasks = ['admin', 'master_admin', 'both'].includes(state.currentUser?.role || '') || (state.currentUser?.id === selectedProject?.managerId);
    const visibleTasks = selectedProject ? (canSeeAllTasks ? selectedProject.projectTasks : selectedProject.projectTasks?.filter(t => t.assignedTo === state.currentUser?.id)) : [];

    return (
        <div className="space-y-6 pb-20">
            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Project Management</h2><p className="text-gray-600 dark:text-gray-400">Track milestones, budget, and resources.</p></div>
                <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center w-full md:w-auto">
                    <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input placeholder="Search Projects..." className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-sm" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} /></div>
                    <Select value={selectedProject?.id || ''} onChange={e => setSelectedProject(state.projects.find(p => p.id === e.target.value) || null)} className="w-full md:w-64 mb-0">
                        <option value="">-- Select Project --</option>
                        {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <Button onClick={() => { setProjectForm({}); setIsProjectModalOpen(true); }} className="w-auto whitespace-nowrap">+ New Project</Button>
                </div>
            </header>

            {selectedProject ? (
                <>
                    {canSeeAllTasks && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <Card className="bg-blue-50 border-blue-200"><p className="text-xs font-bold text-blue-700 uppercase">Budget Used</p><div className="mt-2"><p className="text-2xl font-black text-blue-900">${projectFinancials.totalExpenses.toLocaleString()}</p><div className="w-full bg-blue-200 rounded-full h-1.5 mt-2"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min((projectFinancials.totalExpenses / (selectedProject.budget || 1)) * 100, 100)}%` }}></div></div><p className="text-[10px] text-blue-600 mt-1">of ${(selectedProject.budget || 0).toLocaleString()}</p></div></Card>
                            <Card className="bg-emerald-50 border-emerald-200"><p className="text-xs font-bold text-emerald-700 uppercase">Billed / Paid</p><p className="text-2xl font-black text-emerald-900">${projectFinancials.totalBilled.toLocaleString()}</p><p className="text-[10px] text-emerald-600 mt-1 font-bold">Collected: ${projectFinancials.totalCollected.toLocaleString()}</p></Card>
                            <Card className="bg-purple-50 border-purple-200"><p className="text-xs font-bold text-purple-700 uppercase">Task Progress</p><div className="mt-2"><p className="text-2xl font-black text-purple-900">{progressStats.percent.toFixed(0)}%</p><div className="w-full bg-purple-200 rounded-full h-1.5 mt-2"><div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${progressStats.percent}%` }}></div></div><p className="text-[10px] text-purple-600 mt-1">{progressStats.completed} / {progressStats.total} Tasks</p></div></Card>
                            <Card className="bg-gray-50 border-gray-200"><p className="text-xs font-bold text-gray-500 uppercase">Team Members</p><div className="flex -space-x-2 mt-2">{selectedProject.teamIds?.map(uid => { const u = employees.find(e => e.id === uid); return u ? <div key={uid} className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-700" title={`${u.firstName} ${u.lastName}`}>{u.firstName[0]}</div> : null;})}{(!selectedProject.teamIds || selectedProject.teamIds.length === 0) && <span className="text-sm text-gray-400 italic">None</span>}</div></Card>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full md:w-fit overflow-x-auto custom-scrollbar">
                            {[
                                { id: 'overview', label: 'Overview', icon: Briefcase }, { id: 'tasks', label: 'Tasks & Milestones', icon: ClipboardList }, { id: 'financials', label: 'Financials', icon: DollarSign },
                                { id: 'permits', label: 'Permits', icon: File }, { id: 'subs', label: 'Subcontractors', icon: HardHat }, { id: 'rentals', label: 'Rentals', icon: Truck },
                            ].map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow' : 'text-slate-600 dark:text-slate-400'}`}><tab.icon size={16} /> {tab.label}</button>)}
                        </div>
                        {canSeeAllTasks && <div className="flex gap-2"><Button onClick={() => { setProjectForm(selectedProject); setIsProjectModalOpen(true); }} variant="secondary" className="text-xs h-9">Edit Project</Button><button onClick={handleDeleteProject} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded"><Trash2 size={16} /></button></div>}
                    </div>

                    {activeTab === 'overview' && <OverviewTab project={selectedProject} employees={employees} />}
                    {activeTab === 'tasks' && <TasksTab tasks={visibleTasks || []} employees={employees} canSeeAllTasks={canSeeAllTasks} onTaskAdd={() => { setTaskForm({}); setIsTaskModalOpen(true); }} onTaskEdit={(t) => { setTaskForm(t); setIsTaskModalOpen(true); }} />}
                    {activeTab === 'financials' && canSeeAllTasks && <FinancialsTab financials={projectFinancials} onCreateInvoice={handleCreateInvoice} onManageInvoice={setEditingInvoiceId} onAddExpense={() => { setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'Materials', amount: 0 }); setIsExpenseModalOpen(true); }} onEditExpense={(e) => { setExpenseForm(e); setIsExpenseModalOpen(true); }} onDeleteExpense={handleDeleteExpense} />}
                    {activeTab === 'permits' && canSeeAllTasks && <PermitsTab permits={selectedProject.permits || []} onPermitAdd={() => { setPermitForm({}); setIsPermitModalOpen(true); }} onPermitEdit={(p) => { setPermitForm(p); setIsPermitModalOpen(true); }} />}
                    {activeTab === 'subs' && canSeeAllTasks && <SubsTab subcontractors={state.subcontractors.filter(s => s.organizationId === state.currentOrganization?.id)} onSubAdd={() => { setEditingSub(null); setIsSubModalOpen(true); }} onSubEdit={(s) => { setEditingSub(s); setIsSubModalOpen(true); }} />}
                    {activeTab === 'rentals' && canSeeAllTasks && <RentalsTab rentals={state.rentals.filter(r => r.projectId === selectedProject.id)} onRentalAdd={() => { setRentalForm({ projectId: selectedProject.id }); setIsRentalModalOpen(true); }} onRentalEdit={(r) => { setRentalForm(r); setIsRentalModalOpen(true); }} />}
                </>
            ) : (
                <div className="p-6 md:p-12 text-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl"><Briefcase size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-bold text-lg">No project selected.</p><p className="text-sm">Create a new project or select one from the list to view details.</p></div>
            )}

            {isProjectModalOpen && <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onSave={handleSaveProject} projectForm={projectForm} setProjectForm={setProjectForm} customers={state.customers} employees={employees} />}
            {isTaskModalOpen && <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} taskForm={taskForm} setTaskForm={setTaskForm} employees={employees} />}
            {isExpenseModalOpen && <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onSave={handleSaveExpense} expenseForm={expenseForm} setExpenseForm={setExpenseForm} />}
            {isPermitModalOpen && <PermitModal isOpen={isPermitModalOpen} onClose={() => setIsPermitModalOpen(false)} onSave={handleSavePermit} permitForm={permitForm} setPermitForm={setPermitForm} />}
            {isSubModalOpen && <AddSubcontractorModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={editingSub} />}
            {isRentalModalOpen && <RentalModal isOpen={isRentalModalOpen} onClose={() => setIsRentalModalOpen(false)} onSave={handleSaveRental} rentalForm={rentalForm} setRentalForm={setRentalForm} />}
        </div>
    );
};

export default ProjectManagement;
