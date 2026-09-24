import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { db } from 'lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import type { Project, Permit, Subcontractor, EquipmentRental, ProjectTask, Job, Expense, Sprint } from 'types';
import { 
    Search, Trash2, Briefcase, ClipboardList, DollarSign, File, HardHat, 
    Truck, Box, LayoutGrid, List, FileText, Wrench, FolderArchive, Download, 
    ChevronDown, Printer, Link2, FileSpreadsheet 
} from 'lucide-react';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobAppointmentModal from 'components/modals/JobAppointmentModal';

import FinancialsTab from './projects/components/tabs/FinancialsTab';
import TasksTab from './projects/components/tabs/TasksTab';
import OverviewTab from './projects/components/tabs/OverviewTab';
import PermitsTab from './projects/components/tabs/PermitsTab';
import SubsTab from './projects/components/tabs/SubsTab';
import RentalsTab from './projects/components/tabs/RentalsTab';
import EquipmentTab from './projects/components/tabs/EquipmentTab';
import SprintBoard from './projects/components/tabs/SprintBoard';
import ProposalsTab from './projects/components/tabs/ProposalsTab';
import ProjectDocumentsTab from './projects/components/tabs/ProjectDocumentsTab';
import JobsTab from './projects/components/tabs/JobsTab';

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
import { useLanguage } from 'context/LanguageContext';

const ProjectManagement: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'jobs' | 'documents' | 'permits' | 'subs' | 'rentals' | 'financials' | 'equipment' | 'proposals'>('overview');
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
    const [viewingJobDetails, setViewingJobDetails] = useState<Job | null>(null);
    const [schedulingJob, setSchedulingJob] = useState<{ isOpen: boolean; jobToEdit?: Job | null }>({ isOpen: false });
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

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

    const linkedJobs = useMemo(() => {
        if (!selectedProject) return [];
        return (state.jobs || []).filter(j => j.projectId === selectedProject.id);
    }, [state.jobs, selectedProject]);

    const linkedProposals = useMemo(() => {
        if (!selectedProject) return [];
        return (state.proposals || []).filter((p: any) => p.projectId === selectedProject.id || (p.isProjectLevel && p.projectId === selectedProject.id));
    }, [state.proposals, selectedProject]);

    const linkedDocsCount = useMemo(() => {
        if (!selectedProject) return 0;
        const directCount = (selectedProject.files || []).length;
        const excluded = new Set(selectedProject.excludedFileIds || []);
        const jobFilesCount = linkedJobs.reduce((acc, j) => {
            const activeFiles = (j.files || []).filter(f => !excluded.has(f.id));
            return acc + activeFiles.length;
        }, 0);
        return directCount + jobFilesCount;
    }, [selectedProject, linkedJobs]);

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
        if (!form.name || !form.customerId || !state.currentOrganization) { showToast.warn(t("Project Name and Customer are required.")); return; }
        const customer = state.customers.find(c => c.id === form.customerId);
        const project: Project = { ...form, organizationId: state.currentOrganization.id, customerName: customer?.name || 'Unknown', id: form.id || `proj-${Date.now()}`, createdAt: form.createdAt || new Date().toISOString() } as Project;
        await db.collection('projects').doc(project.id).set(cleanUndefinedFields(JSON.parse(JSON.stringify(project))), { merge: true });
        dispatch({ type: form.id ? 'UPDATE_PROJECT' : 'ADD_PROJECT', payload: project });
        setSelectedProject(project);
        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async () => {
        if (!selectedProject || !await globalConfirm(t("Delete this project and all associated data?"))) return;
        await db.collection('projects').doc(selectedProject.id).delete();
        dispatch({ type: 'DELETE_PROJECT', payload: selectedProject.id });
        setSelectedProject(null);
    };

    const handleSavePermit = async (form: Partial<Permit>) => {
        if (!selectedProject || !form.number) return;
        const permit: Permit = { ...form, id: form.id || `perm-${Date.now()}` } as Permit;
        const updatedPermits = form.id ? (selectedProject.permits || []).map(p => p.id === permit.id ? permit : p) : [...(selectedProject.permits || []), permit];
        await db.collection('projects').doc(selectedProject.id).update(cleanUndefinedFields({ permits: JSON.parse(JSON.stringify(updatedPermits)) }));
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...selectedProject, permits: updatedPermits } });
        setIsPermitModalOpen(false);
    };

    const handleSaveSubcontractor = async (subData: Partial<Subcontractor>) => {
        if (!state.currentOrganization || !subData.companyName) return;
        const subId = subData.id || `sub-${Date.now()}`;
        const sub: Subcontractor = { ...subData, organizationId: state.currentOrganization.id, id: subId } as Subcontractor;
        await db.collection('subcontractors').doc(sub.id).set(cleanUndefinedFields(JSON.parse(JSON.stringify(sub))), { merge: true });
        dispatch({ type: subData.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: sub });
        setIsSubModalOpen(false);
    };

    const handleSaveRental = async (form: Partial<EquipmentRental>) => {
        if (!state.currentOrganization || !form.equipmentName) return;
        const rental: EquipmentRental = { ...form, organizationId: state.currentOrganization.id, projectId: selectedProject?.id, id: form.id || `rent-${Date.now()}` } as EquipmentRental;
        await db.collection('rentals').doc(rental.id).set(cleanUndefinedFields(JSON.parse(JSON.stringify(rental))), { merge: true });
        dispatch({ type: form.id ? 'UPDATE_RENTAL' : 'ADD_RENTAL', payload: rental });
        setIsRentalModalOpen(false);
    };

    const handleSaveWBSNode = async (form: WBSNodeForm) => {
        if (!selectedProject || !form.name) return;
        
        let updatedProject = { ...selectedProject };
        const id = form.id || `${form.type.toLowerCase()}-${Date.now()}`;
        
        if (form.type === 'Phase') {
            const phase = { id, name: form.name, description: form.description, status: form.status as 'Pending' | 'In Progress' | 'Completed', startDate: form.startDate, endDate: form.endDate, deliverables: [] };
            updatedProject.phases = form.id ? (updatedProject.phases || []).map(p => p.id === id ? { ...p, ...phase } : p) : [...(updatedProject.phases || []), phase];
        } else if (form.type === 'Deliverable' && form.parentId) {
            const deliverable = { id, name: form.name, description: form.description, status: form.status as 'Pending' | 'In Progress' | 'Completed', dueDate: form.dueDate, workPackages: [] };
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

        await db.collection('projects').doc(selectedProject.id).update(cleanUndefinedFields(JSON.parse(JSON.stringify(updatedProject))));
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

        await db.collection('projects').doc(selectedProject.id).update(cleanUndefinedFields(JSON.parse(JSON.stringify(updatedProject))));
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
        await db.collection('projects').doc(selectedProject.id).update(cleanUndefinedFields({ sprints: JSON.parse(JSON.stringify(updatedSprints)) }));
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        setIsSprintModalOpen(false);
    };

    const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
        if (!selectedProject) return;
        let updatedProject = { ...selectedProject };
        const updateStatus = (tasks: ProjectTask[] = []) => tasks.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'], completedAt: newStatus === 'Completed' ? new Date().toISOString() : t.completedAt } : t);
        
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

        await db.collection('projects').doc(selectedProject.id).update(cleanUndefinedFields(JSON.parse(JSON.stringify(updatedProject))));
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    };

    const handleSaveExpense = async (form: Partial<Expense>) => {
        if (!selectedProject || !state.currentOrganization || !form.amount) return;
        const expense: Expense = { ...form, organizationId: state.currentOrganization.id, projectId: selectedProject.id, id: form.id || `exp-${Date.now()}` } as Expense;
        await db.collection('expenses').doc(expense.id).set(cleanUndefinedFields(JSON.parse(JSON.stringify(expense))), { merge: true });
        dispatch({ type: form.id ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE', payload: expense });
        setIsExpenseModalOpen(false);
    };

    const handleDeleteExpense = async (id: string) => {
        if (!await globalConfirm(t("Delete expense?"))) return;
        await db.collection('expenses').doc(id).delete();
        dispatch({ type: 'DELETE_EXPENSE', payload: id });
    };

    const handleCreateInvoice = async () => {
        if (!selectedProject || !state.currentOrganization) return;
        const nextInvId = await getNextInvoiceNumber(state.currentOrganization.id);
        const jobId = `job-inv-${Date.now()}`;
        const newInvoice: Job = { id: jobId, organizationId: state.currentOrganization.id, projectId: selectedProject.id, customerName: selectedProject.customerName, customerId: selectedProject.customerId, address: selectedProject.address || '', tasks: [`Project Invoice: ${selectedProject.name}`], jobStatus: 'Completed', appointmentTime: new Date().toISOString(), source: 'ProjectManager', specialInstructions: '', invoice: { id: nextInvId, status: 'Unpaid', items: [], subtotal: 0, taxRate: (state.currentOrganization.taxRate || 8.25) / 100, taxAmount: 0, totalAmount: 0, amount: 0 }, jobEvents: [], createdAt: new Date().toISOString() };
        await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(newInvoice));
        dispatch({ type: 'ADD_JOB', payload: newInvoice });
        setEditingInvoiceId(jobId);
    };

    // --- EXPORT HANDLERS ---
    const handleExportProjectDossier = () => {
        if (!selectedProject) return;
        const projectJobs = state.jobs.filter(j => j.projectId === selectedProject.id);
        const projectProps = (state.proposals || []).filter((p: any) => p.projectId === selectedProject.id);
        const projectFiles = selectedProject.files || [];
        const manager = employees.find(e => e.id === selectedProject.managerId);

        const html = `<!DOCTYPE html>
<html>
<head>
    <title>${selectedProject.name} - Project Dossier</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
        h1 { margin: 0 0 4px; font-size: 26px; color: #0f172a; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
        .section { margin-top: 32px; }
        .section-title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        th { background: #f8fafc; font-weight: bold; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px; }
        .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
        .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
        @media print { body { margin: 20px; } button { display: none; } }
    </style>
</head>
<body>
    <button onclick="window.print()" style="margin-bottom: 20px; padding: 8px 16px; font-weight: bold; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px;">Print / Save as PDF</button>
    <h1>${selectedProject.name}</h1>
    <div class="meta">
        <strong>Customer:</strong> ${selectedProject.customerName} | 
        <strong>Status:</strong> ${selectedProject.status} | 
        <strong>Target Dates:</strong> ${selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'TBD'} to ${selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString() : 'TBD'} | 
        <strong>Project Manager:</strong> ${manager ? `${manager.firstName} ${manager.lastName}` : 'Unassigned'}
    </div>
    <p>${selectedProject.description || 'No description provided.'}</p>

    <div class="section">
        <div class="section-title">Financial Summary</div>
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Project Budget</div><div class="kpi-val">$${(selectedProject.budget || 0).toLocaleString()}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total Expenses</div><div class="kpi-val">$${projectFinancials.totalExpenses.toLocaleString()}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total Billed</div><div class="kpi-val">$${projectFinancials.totalBilled.toLocaleString()}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total Collected</div><div class="kpi-val">$${projectFinancials.totalCollected.toLocaleString()}</div></div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Job Records & Work Orders (${projectJobs.length})</div>
        <table>
            <thead><tr><th>Job #</th><th>Scheduled Date</th><th>Status</th><th>Technician</th><th>Scope / Description</th><th>PO #</th><th>Invoice</th></tr></thead>
            <tbody>
                ${projectJobs.map(j => `<tr>
                    <td><strong>${j.jobNumber || j.id}</strong></td>
                    <td>${j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : 'Unscheduled'}</td>
                    <td>${j.jobStatus || 'Scheduled'}</td>
                    <td>${j.assignedTechnicianName || 'Unassigned'}</td>
                    <td>${(j.tasks || []).join(', ')}</td>
                    <td>${j.poNumber || '--'}</td>
                    <td>${j.invoice?.id ? `$${(j.invoice.totalAmount || j.invoice.amount || 0).toLocaleString()} (${j.invoice.status || 'Unpaid'})` : 'None'}</td>
                </tr>`).join('')}
                ${projectJobs.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">No jobs associated.</td></tr>' : ''}
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Commercial Proposals & Bids (${projectProps.length})</div>
        <table>
            <thead><tr><th>Proposal #</th><th>Date</th><th>Title</th><th>Total Value</th><th>Status</th><th>PO / SCID</th></tr></thead>
            <tbody>
                ${projectProps.map((p: any) => `<tr>
                    <td><strong>#${p.proposalNumber || p.id}</strong></td>
                    <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '--'}</td>
                    <td>${p.title || 'Project Proposal'}</td>
                    <td>$${(p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0).toLocaleString()}</td>
                    <td>${p.status || 'Draft'}</td>
                    <td>${p.poNumber || p.scid || '--'}</td>
                </tr>`).join('')}
                ${projectProps.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No proposals associated.</td></tr>' : ''}
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Permits & Municipal Forms (${(selectedProject.permits || []).length})</div>
        <table>
            <thead><tr><th>Permit #</th><th>Type</th><th>Status</th><th>Issue / Expiry Date</th></tr></thead>
            <tbody>
                ${(selectedProject.permits || []).map(p => `<tr>
                    <td><strong>${p.number || '--'}</strong></td>
                    <td>${p.type || '--'}</td>
                    <td>${p.status || 'Pending'}</td>
                    <td>${p.issueDate || '--'} to ${p.expirationDate || '--'}</td>
                </tr>`).join('')}
                ${(!selectedProject.permits || selectedProject.permits.length === 0) ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No permits recorded.</td></tr>' : ''}
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Project Documents Manifest (${projectFiles.length})</div>
        <table>
            <thead><tr><th>File Name</th><th>Category</th><th>Added Date</th><th>Uploaded By</th></tr></thead>
            <tbody>
                ${projectFiles.map(f => `<tr>
                    <td><strong>${f.label || f.fileName}</strong></td>
                    <td>${f.metadata?.category || 'General'}</td>
                    <td>${f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '--'}</td>
                    <td>${f.uploadedBy || 'Admin'}</td>
                </tr>`).join('')}
                ${projectFiles.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No direct project files uploaded yet.</td></tr>' : ''}
            </tbody>
        </table>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    const handleExportProjectJson = () => {
        if (!selectedProject) return;
        const projectData = {
            project: selectedProject,
            jobs: state.jobs.filter(j => j.projectId === selectedProject.id),
            proposals: (state.proposals || []).filter((p: any) => p.projectId === selectedProject.id),
            expenses: state.expenses.filter(e => e.projectId === selectedProject.id),
            rentals: state.rentals.filter(r => r.projectId === selectedProject.id),
            financials: projectFinancials,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Backup.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast.success(t("Project data backup exported."));
    };

    const handleExportFinancialsCsv = () => {
        if (!selectedProject) return;
        const headers = ['Type', 'Date', 'Entity / Vendor', 'Description', 'Amount ($)', 'Status'];
        const invoiceRows = projectFinancials.invoices.map(inv => [
            'Invoice (AR)',
            inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '',
            `"${inv.customerName || selectedProject.customerName}"`,
            `"${(inv.tasks || []).join('; ')}"`,
            (inv.invoice?.totalAmount || inv.invoice?.amount || 0).toFixed(2),
            inv.invoice?.status || 'Unpaid'
        ]);

        const expenseRows = projectFinancials.expenses.map(exp => [
            'Expense (AP)',
            exp.date ? new Date(exp.date).toLocaleDateString() : '',
            `"${exp.vendor || 'Vendor'}"`,
            `"${(exp.description || exp.category || '').replace(/"/g, '""')}"`,
            (-exp.amount).toFixed(2),
            'Recorded'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...invoiceRows.map(r => r.join(',')), ...expenseRows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${selectedProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_Financials.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("Financials exported to CSV."));
    };

    const handleExportJobsTasksCsv = () => {
        if (!selectedProject) return;
        const projectJobs = state.jobs.filter(j => j.projectId === selectedProject.id);
        const headers = ['Record Type', 'ID / Task', 'Status', 'Assignee', 'Scheduled / Due Date', 'Details'];
        
        const jobRows = projectJobs.map(j => [
            'Job Record',
            `"${j.jobNumber || j.id}"`,
            `"${j.jobStatus || 'Scheduled'}"`,
            `"${j.assignedTechnicianName || 'Unassigned'}"`,
            j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : '',
            `"${(j.tasks || []).join('; ')} - ${j.address || ''}"`
        ]);

        const taskRows = (selectedProject.projectTasks || []).map(t => [
            'Project Task',
            `"${t.description || t.id}"`,
            `"${t.status || 'Pending'}"`,
            `"${employees.find(e => e.id === t.assignedTo)?.firstName || 'Unassigned'}"`,
            t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
            `"${(t as any).notes || t.description || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...jobRows.map(r => r.join(',')), ...taskRows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${selectedProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_Jobs_and_Tasks.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("Jobs and tasks exported to CSV."));
    };

    // --- PERMISSIONS ---
    const canSeeAllTasks = ['admin', 'master_admin', 'both'].includes(state.currentUser?.role || '') || (state.currentUser?.id === selectedProject?.managerId);
    const visibleTasks = selectedProject ? (canSeeAllTasks ? selectedProject.projectTasks : selectedProject.projectTasks?.filter(t => t.assignedTo === state.currentUser?.id)) : [];

    return (
        <div className="space-y-6 pb-20">
            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t("Project Management")}</h1>
                    {selectedProject && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProject.name}</span>
                            <span>•</span>
                            <span>{selectedProject.customerName || t("No Customer Assigned")}</span>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                selectedProject.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                selectedProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                                {selectedProject.status}
                            </span>
                        </p>
                    )}
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center w-full md:w-auto">
                    <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input placeholder={t("Search Projects...")} className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-sm" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} /></div>
                    <Select value={selectedProject?.id || ''} onChange={e => setSelectedProject(state.projects.find(p => p.id === e.target.value) || null)} className="w-full md:w-64 mb-0">
                        <option value="">-- {t("Select Project")} --</option>
                        {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>

                    {selectedProject && (
                        <div className="relative">
                            <Button 
                                variant="secondary" 
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                className="flex items-center gap-1.5 whitespace-nowrap text-xs h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                            >
                                <Download size={15} />
                                {t("Export Project")}
                                <ChevronDown size={14} className={isExportMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                            </Button>

                            {isExportMenuOpen && (
                                <div 
                                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                                    onMouseLeave={() => setIsExportMenuOpen(false)}
                                >
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        {t("Project Export Options")}
                                    </div>
                                    <button 
                                        onClick={() => { setIsExportMenuOpen(false); handleExportProjectDossier(); }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                                    >
                                        <Printer size={15} className="text-blue-500" />
                                        <div>
                                            <p>{t("Export Dossier (Print / PDF)")}</p>
                                            <p className="text-[10px] text-slate-400 font-normal">{t("Full summary with tasks, financials & docs")}</p>
                                        </div>
                                    </button>
                                    <button 
                                        onClick={() => { setIsExportMenuOpen(false); handleExportFinancialsCsv(); }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                                    >
                                        <FileSpreadsheet size={15} className="text-emerald-500" />
                                        <div>
                                            <p>{t("Export Financials (CSV)")}</p>
                                            <p className="text-[10px] text-slate-400 font-normal">{t("All invoices, billed amounts & expenses")}</p>
                                        </div>
                                    </button>
                                    <button 
                                        onClick={() => { setIsExportMenuOpen(false); handleExportJobsTasksCsv(); }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                                    >
                                        <Wrench size={15} className="text-purple-500" />
                                        <div>
                                            <p>{t("Export Jobs & Tasks (CSV)")}</p>
                                            <p className="text-[10px] text-slate-400 font-normal">{t("All field jobs, schedules and tasks")}</p>
                                        </div>
                                    </button>
                                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                                    <button 
                                        onClick={() => { setIsExportMenuOpen(false); handleExportProjectJson(); }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                                    >
                                        <FileText size={15} className="text-amber-500" />
                                        <div>
                                            <p>{t("Export Full JSON Data")}</p>
                                            <p className="text-[10px] text-slate-400 font-normal">{t("Complete project database backup")}</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <Button onClick={() => { setProjectForm({}); setIsProjectModalOpen(true); }} className="w-auto whitespace-nowrap">+ {t("New Project")}</Button>
                </div>
            </header>

            {selectedProject ? (
                <>
                    {canSeeAllTasks && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
                            <Card className="bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3.5">
                                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">{t("Budget Used")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-blue-900 dark:text-blue-200">${projectFinancials.totalExpenses.toLocaleString()}</p>
                                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mt-2">
                                        <div className="bg-blue-600 h-1.5 rounded-full" ref={e => e && (e.style.width = `${Math.min((projectFinancials.totalExpenses / (selectedProject.budget || 1)) * 100, 100)}%`)}></div>
                                    </div>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">{t("of")} ${(selectedProject.budget || 0).toLocaleString()}</p>
                                </div>
                            </Card>

                            <Card className="bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 p-3.5 cursor-pointer hover:shadow-md transition-all text-left" onClick={() => setActiveTab('financials')}>
                                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{t("Billed / Paid")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-emerald-900 dark:text-emerald-200">${projectFinancials.totalBilled.toLocaleString()}</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">{t("Collected:")} ${projectFinancials.totalCollected.toLocaleString()}</p>
                                </div>
                            </Card>

                            <Card className="bg-purple-50/80 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 p-3.5 cursor-pointer hover:shadow-md transition-all text-left" onClick={() => setActiveTab('tasks')}>
                                <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">{t("Task Progress")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-purple-900 dark:text-purple-200">{progressStats.percent.toFixed(0)}%</p>
                                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-1.5 mt-2">
                                        <div className="bg-purple-600 h-1.5 rounded-full" ref={e => e && (e.style.width = `${progressStats.percent}%`)}></div>
                                    </div>
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">{progressStats.completed} / {progressStats.total} {t("Tasks")}</p>
                                </div>
                            </Card>

                            <Card className="bg-teal-50/80 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900 p-3.5 cursor-pointer hover:shadow-md transition-all text-left" onClick={() => setActiveTab('jobs')}>
                                <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">{t("Jobs & Work Orders")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-teal-900 dark:text-teal-200">
                                        {linkedJobs.length}
                                    </p>
                                    <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1 font-semibold">
                                        {linkedJobs.filter(j => j.jobStatus !== 'Completed' && j.jobStatus !== 'Cancelled').length} {t("Active")} • {t("Manage")}
                                    </p>
                                </div>
                            </Card>

                            <Card className="bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900 p-3.5 cursor-pointer hover:shadow-md transition-all text-left" onClick={() => setActiveTab('proposals')}>
                                <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">{t("Commercial Bids")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-indigo-900 dark:text-indigo-200">
                                        {linkedProposals.length}
                                    </p>
                                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
                                        {linkedProposals.filter(p => p.status === 'Approved').length} {t("Approved")} • {t("View Bids")}
                                    </p>
                                </div>
                            </Card>

                            <Card className="bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-3.5 cursor-pointer hover:shadow-md transition-all text-left" onClick={() => setActiveTab('documents')}>
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t("Documents & Quotes")}</p>
                                <div className="mt-1.5">
                                    <p className="text-xl font-black text-amber-900 dark:text-amber-200">
                                        {linkedDocsCount}
                                    </p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">{t("Upload & Manage")}</p>
                                </div>
                            </Card>

                            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 p-3.5">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("Team Members")}</p>
                                <div className="flex -space-x-2 mt-2">
                                    {selectedProject.teamIds?.map(uid => {
                                        const u = employees.find(e => e.id === uid);
                                        return u ? (
                                            <div key={uid} className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-sm" title={`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}>
                                                {(u.firstName || '')[0] || (u.email || '')[0] || '?'}
                                            </div>
                                        ) : null;
                                    })}
                                    {(!selectedProject.teamIds || selectedProject.teamIds.length === 0) && (
                                        <span className="text-xs text-gray-400 italic">{t("None assigned")}</span>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'overview', label: t('Overview'), icon: Briefcase }, 
                                { id: 'tasks', label: t('Tasks & Milestones'), icon: ClipboardList }, 
                                { id: 'jobs', label: t('Jobs & Work Orders'), icon: Wrench },
                                { id: 'financials', label: t('Financials'), icon: DollarSign },
                                { id: 'proposals', label: t('Proposals & Bids'), icon: FileText },
                                { id: 'documents', label: t('Documents & Drive'), icon: FolderArchive },
                                { id: 'permits', label: t('Permits'), icon: File }, 
                                { id: 'subs', label: t('Subcontractors'), icon: HardHat }, 
                                { id: 'rentals', label: t('Rentals'), icon: Truck },
                                { id: 'equipment', label: t('Equipment'), icon: Box },
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
                        {canSeeAllTasks && <div className="flex gap-2"><Button onClick={() => setIsCloseoutModalOpen(true)} className="text-xs h-9 bg-slate-800 hover:bg-slate-700">{t("Closeout Report")}</Button><Button onClick={() => { setProjectForm(selectedProject); setIsProjectModalOpen(true); }} variant="secondary" className="text-xs h-9">{t("Edit Project")}</Button><button onClick={handleDeleteProject} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded" title={t("Delete Project")} aria-label={t("Delete Project")}><Trash2 size={16} /></button></div>}
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
                                    <LayoutGrid size={14} /> {t("Sprint Board")}
                                </button>
                                <button
                                    onClick={() => setTaskViewMode('wbs')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskViewMode === 'wbs'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <List size={14} /> {t("WBS Tree")}
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
                    {activeTab === 'jobs' && (
                        <JobsTab
                            project={selectedProject}
                            onCreateJob={() => setSchedulingJob({ isOpen: true, jobToEdit: null })}
                            onViewJobDetails={(job) => setViewingJobDetails(job)}
                            onEditJob={(job) => setSchedulingJob({ isOpen: true, jobToEdit: job })}
                            onManageInvoice={(jobId) => setEditingInvoiceId(jobId)}
                        />
                    )}
                    {activeTab === 'financials' && canSeeAllTasks && <FinancialsTab financials={projectFinancials} onCreateInvoice={handleCreateInvoice} onManageInvoice={setEditingInvoiceId} onAddExpense={() => { setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'Materials', amount: 0 }); setIsExpenseModalOpen(true); }} onEditExpense={(e) => { setExpenseForm(e); setIsExpenseModalOpen(true); }} onDeleteExpense={handleDeleteExpense} />}
                    {activeTab === 'proposals' && <ProposalsTab project={selectedProject} />}
                    {activeTab === 'documents' && <ProjectDocumentsTab project={selectedProject} onUpdateProject={setSelectedProject} />}
                    {activeTab === 'permits' && canSeeAllTasks && <PermitsTab permits={selectedProject.permits || []} onPermitAdd={() => { setPermitForm({}); setIsPermitModalOpen(true); }} onPermitEdit={(p) => { setPermitForm(p); setIsPermitModalOpen(true); }} />}
                    {activeTab === 'subs' && canSeeAllTasks && <SubsTab subcontractors={state.subcontractors.filter(s => s.organizationId === activeOrgId)} assignedSubcontractorIds={selectedProject.assignedSubcontractorIds} onSubAdd={() => { setEditingSub(null); setIsSubModalOpen(true); }} onSubEdit={(s) => { setEditingSub(s); setIsSubModalOpen(true); }} />}
                    {activeTab === 'rentals' && canSeeAllTasks && <RentalsTab rentals={state.rentals.filter(r => r.projectId === selectedProject.id)} onRentalAdd={() => { setRentalForm({ projectId: selectedProject.id }); setIsRentalModalOpen(true); }} onRentalEdit={(r) => { setRentalForm(r); setIsRentalModalOpen(true); }} />}
                    {activeTab === 'equipment' && <EquipmentTab project={selectedProject} customer={state.customers.find(c => c.id === selectedProject.customerId)} />}
                </>
            ) : (
                <div className="p-6 md:p-12 text-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl"><Briefcase size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-bold text-lg">{t("No project selected.")}</p><p className="text-sm">{t("Create a new project or select one from the list to view details.")}</p></div>
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
                    customerId={selectedProject?.customerId || ''}
                    projectId={selectedProject?.id || ''}
                    jobToEdit={schedulingJob.jobToEdit || null}
                />
            )}
        </div>
    );
};

export default ProjectManagement;
