import showToast from "lib/toast";

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { db } from 'lib/firebase';
import type { Project, Permit, Subcontractor, EquipmentRental, ProjectTask, Job, Expense, Sprint } from 'types';
import { Search, Trash2, Briefcase, ClipboardList, DollarSign, File, HardHat, Truck, Box, LayoutGrid, List } from 'lucide-react';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';

import FinancialsTab from './projects/components/tabs/FinancialsTab';
import TasksTab from './projects/components/tabs/TasksTab';
import OverviewTab from './projects/components/tabs/OverviewTab';
import PermitsTab from './projects/components/tabs/PermitsTab';
import SubsTab from './projects/components/tabs/SubsTab';
import RentalsTab from './projects/components/tabs/RentalsTab';
import EquipmentTab from './projects/components/tabs/EquipmentTab';
import SprintBoard from './projects/components/tabs/SprintBoard';

import ProjectModal from './projects/modals/ProjectModal';
import TaskModal from './projects/modals/TaskModal';
import ExpenseModal from './projects/modals/ExpenseModal';
import PermitModal from './projects/modals/PermitModal';
import AddSubcontractorModal from '../../components/modals/AddSubcontractorModal'; 
import RentalModal from './projects/modals/RentalModal';
import ProjectCloseoutModal from './projects/modals/ProjectCloseoutModal';
import WBSNodeModal, { WBSNodeForm } from './projects/modals/WBSNodeModal';
import SprintModal from './projects/modals/SprintModal';
import { globalConfirm } from "lib/globalConfirm";

const ProjectManagement: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'permits' | 'subs' | 'rentals' | 'financials' | 'equipment'>('overview');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [projectSearch, setProjectSearch] = useState('');

    // --- STATE MANAGEMENT ---
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isCloseoutModalOpen, setIsCloseoutModalOpen] = useState(false);
    const [isWBSNodeModalOpen, setIsWBSNodeModalOpen] = useState(false);
    const [wbsNodeForm, setWBSNodeForm] = useState<WBSNodeForm>({ type: 'Phase', name: '', description: '', status: 'Not Started' });
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

    // Sprint state
    const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
    const [sprintForm, setSprintForm] = useState<Partial<Sprint>>({ status: 'Planning', taskIds: [] });
    const [taskViewMode, setTaskViewMode] = useState<'wbs' | 'board'>('board');

    // --- COMPUTED DATA ---
    const activeOrgId = selectedProject?.organizationId || state.currentOrganization?.id;
    const employees = useMemo(() => state.users.filter(u => u.organizationId === activeOrgId && u.role !== 'customer'), [state.users, activeOrgId]);
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
        if (!form.name || !form.customerId || !state.currentOrganization) { showToast.warn("Project Name and Customer are required."); return; }
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

    const handleSaveWBSNode = async (form: WBSNodeForm) => {
        if (!selectedProject || !form.name) return;
        
        let updatedProject = { ...selectedProject };
        const id = form.id || `${form.type.toLowerCase()}-${Date.now()}`;
        
        if (form.type === 'Phase') {
            const phase = { id, name: form.name, description: form.description, status: form.status as any, startDate: form.startDate, endDate: form.endDate, deliverables: [] };
            updatedProject.phases = form.id ? (updatedProject.phases || []).map(p => p.id === id ? { ...p, ...phase } : p) : [...(updatedProject.phases || []), phase];
        } else if (form.type === 'Deliverable' && form.parentId) {
            const deliverable = { id, name: form.name, description: form.description, status: form.status as any, dueDate: form.dueDate, workPackages: [] };
            updatedProject.phases = updatedProject.phases?.map(p => {
                if (p.id === form.parentId) {
                    return { ...p, deliverables: form.id ? (p.deliverables || []).map(d => d.id === id ? { ...d, ...deliverable } : d) : [...(p.deliverables || []), deliverable] };
                }
                return p;
            });
        } else if (form.type === 'WorkPackage' && form.parentId) {
            const wp = { id, name: form.name, description: form.description, status: form.status, assignedTeam: form.assignedTeam, tasks: [] };
            updatedProject.phases = updatedProject.phases?.map(p => ({
                ...p,
                deliverables: p.deliverables?.map(d => {
                    if (d.id === form.parentId) {
                        return { ...d, workPackages: form.id ? (d.workPackages || []).map(w => w.id === id ? { ...w, ...wp } : w) : [...(d.workPackages || []), wp] };
                    }
                    return d;
                }) || []
            }));
        }

        await db.collection('projects').doc(selectedProject.id).update(updatedProject);
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        setIsWBSNodeModalOpen(false);
    };

    const handleSaveTask = async (form: Partial<ProjectTask>) => {
        if (!selectedProject || !form.description) return;
        const task: ProjectTask = { ...form, id: form.id || `task-${Date.now()}` } as ProjectTask;
        let updatedProject = { ...selectedProject };
        const upsertTask = (tasks: ProjectTask[] = []) => {
            return form.id ? tasks.map(t => t.id === task.id ? task : t) : [...tasks, task];
        };

        if (task.workPackageId) {
            let found = false;
            updatedProject.phases = updatedProject.phases?.map(p => ({
                ...p,
                deliverables: p.deliverables?.map(d => ({
                    ...d,
                    workPackages: d.workPackages?.map(wp => {
                        if (wp.id === task.workPackageId) {
                            found = true;
                            return { ...wp, tasks: upsertTask(wp.tasks) };
                        }
                        return wp;
                    }) || []
                })) || []
            })) || [];
            if (!found) {
                updatedProject.projectTasks = upsertTask(updatedProject.projectTasks);
            }
        } else {
            updatedProject.projectTasks = upsertTask(updatedProject.projectTasks);
        }

        await db.collection('projects').doc(selectedProject.id).update(updatedProject);
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        setIsTaskModalOpen(false);
    };

    const handleSaveSprint = async (form: Partial<Sprint>) => {
        if (!selectedProject || !form.name) return;
        const sprint: Sprint = { ...form, id: form.id || `sprint-${Date.now()}`, taskIds: form.taskIds || [], createdAt: form.createdAt || new Date().toISOString() } as Sprint;
        const updatedSprints = form.id 
            ? (selectedProject.sprints || []).map(s => s.id === sprint.id ? sprint : s) 
            : [...(selectedProject.sprints || []), sprint];
        const updatedProject = { ...selectedProject, sprints: updatedSprints };
        await db.collection('projects').doc(selectedProject.id).update({ sprints: updatedSprints });
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        setIsSprintModalOpen(false);
    };

    const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
        if (!selectedProject) return;
        let updatedProject = { ...selectedProject };
        const updateStatus = (tasks: ProjectTask[] = []) => tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any, completedAt: newStatus === 'Completed' ? new Date().toISOString() : t.completedAt } : t);
        
        updatedProject.projectTasks = updateStatus(updatedProject.projectTasks);
        updatedProject.backlog = updateStatus(updatedProject.backlog);
        updatedProject.phases = updatedProject.phases?.map(p => ({
            ...p,
            deliverables: p.deliverables?.map(d => ({
                ...d,
                workPackages: d.workPackages?.map(wp => ({
                    ...wp,
                    tasks: updateStatus(wp.tasks)
                })) || []
            })) || []
        })) || [];

        await db.collection('projects').doc(selectedProject.id).update(updatedProject);
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
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
                            {/* eslint-disable */}
                            <Card className="bg-blue-50 border-blue-200"><p className="text-xs font-bold text-blue-700 uppercase">Budget Used</p><div className="mt-2"><p className="text-2xl font-black text-blue-900">${projectFinancials.totalExpenses.toLocaleString()}</p><div className="w-full bg-blue-200 rounded-full h-1.5 mt-2"><div className="bg-blue-600 h-1.5 rounded-full" ref={e => e && (e.style.width = `${Math.min((projectFinancials.totalExpenses / (selectedProject.budget || 1)) * 100, 100)}%`)}></div></div><p className="text-[10px] text-blue-600 mt-1">of ${(selectedProject.budget || 0).toLocaleString()}</p></div></Card>
                            <Card className="bg-emerald-50 border-emerald-200"><p className="text-xs font-bold text-emerald-700 uppercase">Billed / Paid</p><p className="text-2xl font-black text-emerald-900">${projectFinancials.totalBilled.toLocaleString()}</p><p className="text-[10px] text-emerald-600 mt-1 font-bold">Collected: ${projectFinancials.totalCollected.toLocaleString()}</p></Card>
                            <Card className="bg-purple-50 border-purple-200"><p className="text-xs font-bold text-purple-700 uppercase">Task Progress</p><div className="mt-2"><p className="text-2xl font-black text-purple-900">{progressStats.percent.toFixed(0)}%</p><div className="w-full bg-purple-200 rounded-full h-1.5 mt-2"><div className="bg-purple-600 h-1.5 rounded-full" ref={e => e && (e.style.width = `${progressStats.percent}%`)}></div></div><p className="text-[10px] text-purple-600 mt-1">{progressStats.completed} / {progressStats.total} Tasks</p></div></Card>
                            {/* eslint-enable */}
                            <Card className="bg-gray-50 border-gray-200"><p className="text-xs font-bold text-gray-500 uppercase">Team Members</p><div className="flex -space-x-2 mt-2">{selectedProject.teamIds?.map(uid => { const u = employees.find(e => e.id === uid); return u ? <div key={uid} className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-700" title={`${u.firstName} ${u.lastName}`}>{u.firstName[0]}</div> : null;})}{(!selectedProject.teamIds || selectedProject.teamIds.length === 0) && <span className="text-sm text-gray-400 italic">None</span>}</div></Card>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap gap-2 w-full mb-4">
                            {[
                                { id: 'overview', label: 'Overview', icon: Briefcase }, { id: 'tasks', label: 'Tasks & Milestones', icon: ClipboardList }, { id: 'financials', label: 'Financials', icon: DollarSign },
                                { id: 'permits', label: 'Permits', icon: File }, { id: 'subs', label: 'Subcontractors', icon: HardHat }, { id: 'rentals', label: 'Rentals', icon: Truck },
                                { id: 'equipment', label: 'Equipment', icon: Box },
                            ].map(tab => (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-xl transition-all shadow-sm ${
                                        activeTab === tab.id 
                                            ? 'bg-primary-600 text-white border-transparent' 
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <tab.icon size={16} /> {tab.label}
                                </button>
                            ))}
                        </div>
                        {canSeeAllTasks && <div className="flex gap-2"><Button onClick={() => setIsCloseoutModalOpen(true)} className="text-xs h-9 bg-slate-800 hover:bg-slate-700">Closeout Report</Button><Button onClick={() => { setProjectForm(selectedProject); setIsProjectModalOpen(true); }} variant="secondary" className="text-xs h-9">Edit Project</Button><button onClick={handleDeleteProject} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded" title="Delete Project" aria-label="Delete Project"><Trash2 size={16} /></button></div>}
                    </div>

                    {activeTab === 'overview' && <OverviewTab project={selectedProject} employees={employees} />}
                    {activeTab === 'tasks' && (
                        <div className="space-y-4">
                            {/* View Toggle */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTaskViewMode('board')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskViewMode === 'board'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <LayoutGrid size={14} /> Sprint Board
                                </button>
                                <button
                                    onClick={() => setTaskViewMode('wbs')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskViewMode === 'wbs'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <List size={14} /> WBS Tree
                                </button>
                            </div>
                            {taskViewMode === 'board' ? (
                                <SprintBoard
                                    project={{...selectedProject, projectTasks: visibleTasks || []} as Project}
                                    employees={employees}
                                    canSeeAllTasks={canSeeAllTasks}
                                    onTaskEdit={(t) => { setTaskForm(t); setIsTaskModalOpen(true); }}
                                    onTaskAdd={() => { setTaskForm({}); setIsTaskModalOpen(true); }}
                                    onStatusChange={handleTaskStatusChange}
                                    onSprintCreate={() => { setSprintForm({ status: 'Planning', taskIds: [], startDate: new Date().toISOString().split('T')[0], endDate: '' }); setIsSprintModalOpen(true); }}
                                    onSprintEdit={(s) => { setSprintForm(s); setIsSprintModalOpen(true); }}
                                />
                            ) : (
                                <TasksTab project={{...selectedProject, projectTasks: visibleTasks || []} as Project} employees={employees} canSeeAllTasks={canSeeAllTasks} onTaskAdd={() => { setTaskForm({}); setIsTaskModalOpen(true); }} onTaskEdit={(t) => { setTaskForm(t); setIsTaskModalOpen(true); }} onAddWBSNode={(type, parentId) => { setWBSNodeForm({ type, parentId, name: '', description: '', status: 'Pending' }); setIsWBSNodeModalOpen(true); }} />
                            )}
                        </div>
                    )}
                    {activeTab === 'financials' && canSeeAllTasks && <FinancialsTab financials={projectFinancials} onCreateInvoice={handleCreateInvoice} onManageInvoice={setEditingInvoiceId} onAddExpense={() => { setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'Materials', amount: 0 }); setIsExpenseModalOpen(true); }} onEditExpense={(e) => { setExpenseForm(e); setIsExpenseModalOpen(true); }} onDeleteExpense={handleDeleteExpense} />}
                    {activeTab === 'permits' && canSeeAllTasks && <PermitsTab permits={selectedProject.permits || []} onPermitAdd={() => { setPermitForm({}); setIsPermitModalOpen(true); }} onPermitEdit={(p) => { setPermitForm(p); setIsPermitModalOpen(true); }} />}
                    {activeTab === 'subs' && canSeeAllTasks && <SubsTab subcontractors={state.subcontractors.filter(s => s.organizationId === activeOrgId)} assignedSubcontractorIds={selectedProject.assignedSubcontractorIds} onSubAdd={() => { setEditingSub(null); setIsSubModalOpen(true); }} onSubEdit={(s) => { setEditingSub(s); setIsSubModalOpen(true); }} />}
                    {activeTab === 'rentals' && canSeeAllTasks && <RentalsTab rentals={state.rentals.filter(r => r.projectId === selectedProject.id)} onRentalAdd={() => { setRentalForm({ projectId: selectedProject.id }); setIsRentalModalOpen(true); }} onRentalEdit={(r) => { setRentalForm(r); setIsRentalModalOpen(true); }} />}
                    {activeTab === 'equipment' && <EquipmentTab project={selectedProject} customer={state.customers.find(c => c.id === selectedProject.customerId)} />}
                </>
            ) : (
                <div className="p-6 md:p-12 text-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl"><Briefcase size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-bold text-lg">No project selected.</p><p className="text-sm">Create a new project or select one from the list to view details.</p></div>
            )}

            {isProjectModalOpen && <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onSave={handleSaveProject} projectForm={projectForm} setProjectForm={setProjectForm} customers={state.customers} employees={employees} />}
            {isWBSNodeModalOpen && <WBSNodeModal isOpen={isWBSNodeModalOpen} onClose={() => setIsWBSNodeModalOpen(false)} onSave={handleSaveWBSNode} nodeForm={wbsNodeForm} setNodeForm={setWBSNodeForm} employees={employees} subcontractors={state.subcontractors.filter(s => s.organizationId === activeOrgId)} teams={state.teams.filter(t => t.organizationId === activeOrgId)} />}
            {isTaskModalOpen && <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} taskForm={taskForm} setTaskForm={setTaskForm} employees={employees} project={selectedProject || undefined} />}
            {isExpenseModalOpen && <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onSave={handleSaveExpense} expenseForm={expenseForm} setExpenseForm={setExpenseForm} />}
            {isPermitModalOpen && <PermitModal isOpen={isPermitModalOpen} onClose={() => setIsPermitModalOpen(false)} onSave={handleSavePermit} permitForm={permitForm} setPermitForm={setPermitForm} />}
            {isSubModalOpen && <AddSubcontractorModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={editingSub} />}
            {isRentalModalOpen && <RentalModal isOpen={isRentalModalOpen} onClose={() => setIsRentalModalOpen(false)} onSave={handleSaveRental} rentalForm={rentalForm} setRentalForm={setRentalForm} />}
            {isSprintModalOpen && <SprintModal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} onSave={handleSaveSprint} sprintForm={sprintForm} setSprintForm={setSprintForm} />}
            {isCloseoutModalOpen && selectedProject && (
                <ProjectCloseoutModal
                    isOpen={isCloseoutModalOpen}
                    onClose={() => setIsCloseoutModalOpen(false)}
                    project={selectedProject}
                    financials={projectFinancials}
                    rentals={state.rentals.filter(r => r.projectId === selectedProject.id)}
                    subs={state.subcontractors.filter(s => s.organizationId === state.currentOrganization?.id || selectedProject.assignedSubcontractorIds?.includes(s.id))}
                    customers={state.customers}
                    employees={employees}
                />
            )}
        </div>
    );
};

export default ProjectManagement;
