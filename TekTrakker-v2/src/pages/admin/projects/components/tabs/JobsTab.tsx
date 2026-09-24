import React, { useState, useMemo } from 'react';
import { 
    Wrench, Plus, Download, Eye, Edit, Unlink, DollarSign, Calendar, MapPin, 
    User, Search, Filter, CheckCircle2, Clock, AlertCircle, X, Check, Link2, 
    Layers, ExternalLink, ArrowRight, ShieldCheck, FileText
} from 'lucide-react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import { globalConfirm } from 'lib/globalConfirm';
import showToast from 'lib/toast';
import { cleanUndefinedFields } from 'lib/utils';
import type { Project, Job } from 'types';

export interface JobsTabProps {
    project: Project;
    onCreateJob: () => void;
    onViewJobDetails: (job: Job) => void;
    onEditJob: (job: Job) => void;
    onManageInvoice: (jobId: string) => void;
}

const JobsTab: React.FC<JobsTabProps> = ({
    project,
    onCreateJob,
    onViewJobDetails,
    onEditJob,
    onManageInvoice
}) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();

    // Table Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Import Jobs Modal States
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFilterMode, setImportFilterMode] = useState<'customer' | 'unassigned' | 'all'>('customer');
    const [importSearchTerm, setImportSearchTerm] = useState('');
    const [selectedJobIdsToImport, setSelectedJobIdsToImport] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // Current Project Jobs
    const projectJobs = useMemo(() => {
        return (state.jobs || []).filter(j => j.projectId === project.id && !j.deleted);
    }, [state.jobs, project.id]);

    // KPI Metrics
    const stats = useMemo(() => {
        const total = projectJobs.length;
        const active = projectJobs.filter(j => ['Scheduled', 'In Progress', 'En Route', 'On Hold'].includes(j.jobStatus || '')).length;
        const completed = projectJobs.filter(j => j.jobStatus === 'Completed').length;
        const totalInvoiced = projectJobs.reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
        const totalCollected = projectJobs.filter(j => j.invoice?.status === 'Paid').reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
        return { total, active, completed, totalInvoiced, totalCollected };
    }, [projectJobs]);

    // Filtered Project Jobs
    const filteredJobs = useMemo(() => {
        return projectJobs.filter(job => {
            if (statusFilter !== 'ALL' && job.jobStatus !== statusFilter) {
                return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const jobNum = (job.jobNumber || job.id || '').toLowerCase();
                const address = (job.address || job.serviceLocationAddress || '').toLowerCase();
                const tech = (job.assignedTechnicianName || '').toLowerCase();
                const tasks = (job.tasks || []).join(' ').toLowerCase();
                const po = (job.poNumber || '').toLowerCase();

                if (!jobNum.includes(term) && !address.includes(term) && !tech.includes(term) && !tasks.includes(term) && !po.includes(term)) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
    }, [projectJobs, statusFilter, searchTerm]);

    // Available jobs to import
    const availableJobsToImport = useMemo(() => {
        return (state.jobs || []).filter(j => {
            if (j.deleted) return false;
            if (j.projectId === project.id) return false; // already in project

            if (importFilterMode === 'customer') {
                return j.customerId === project.customerId || (j.customerName && j.customerName.toLowerCase() === project.customerName.toLowerCase());
            }

            if (importFilterMode === 'unassigned') {
                return !j.projectId;
            }

            return true; // all
        }).filter(j => {
            if (!importSearchTerm.trim()) return true;
            const term = importSearchTerm.toLowerCase();
            const jobNum = (j.jobNumber || j.id || '').toLowerCase();
            const customer = (j.customerName || '').toLowerCase();
            const address = (j.address || '').toLowerCase();
            const tasks = (j.tasks || []).join(' ').toLowerCase();
            const po = (j.poNumber || '').toLowerCase();
            return jobNum.includes(term) || customer.includes(term) || address.includes(term) || tasks.includes(term) || po.includes(term);
        }).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
    }, [state.jobs, project.id, project.customerId, project.customerName, importFilterMode, importSearchTerm]);

    // --- IMPORT ACTION ---
    const handleExecuteImportJobs = async () => {
        if (selectedJobIdsToImport.length === 0) return;
        setIsImporting(true);

        try {
            const batch = db.batch();
            const updatedJobs: Job[] = [];

            for (const jobId of selectedJobIdsToImport) {
                const targetJob = state.jobs.find(j => j.id === jobId);
                if (targetJob) {
                    const updatePayload = {
                        projectId: project.id,
                        updatedAt: new Date().toISOString()
                    };

                    batch.update(db.collection('jobs').doc(targetJob.id), cleanUndefinedFields(updatePayload));
                    updatedJobs.push({ ...targetJob, projectId: project.id });
                }
            }

            await batch.commit();

            updatedJobs.forEach(job => {
                dispatch({ type: 'UPDATE_JOB', payload: job });
            });

            showToast.success(t(`Successfully imported ${updatedJobs.length} job(s) into ${project.name}.`));
            setSelectedJobIdsToImport([]);
            setIsImportModalOpen(false);
        } catch (err: any) {
            console.error("Import Jobs Error:", err);
            showToast.error(t("Failed to import jobs: ") + (err.message || 'Unknown error'));
        } finally {
            setIsImporting(false);
        }
    };

    // --- UNLINK ACTION ---
    const handleUnlinkJob = async (job: Job) => {
        const jobDisplay = job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`;
        if (!await globalConfirm(
            t(`Unlink job ${jobDisplay} from "${project.name}"? The job and all its diagnostic data, photos, and invoice will NOT be deleted.`),
            t("Unlink Job from Project"),
            t("Unlink Job"),
            t("Cancel")
        )) {
            return;
        }

        try {
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                projectId: null,
                updatedAt: new Date().toISOString()
            }));

            const updatedJob = { ...job, projectId: null };
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            showToast.success(t(`Unlinked job ${jobDisplay} from project.`));
        } catch (err: any) {
            console.error("Unlink Job Error:", err);
            showToast.error(t("Failed to unlink job: ") + (err.message || 'Error'));
        }
    };

    // --- EXPORT TO CSV ---
    const handleExportJobsCsv = () => {
        const headers = [
            'Job Number', 'Date Scheduled', 'Status', 'Customer', 'Service Address', 
            'Assigned Technician', 'Tasks / Scope', 'PO / SCID', 'Invoice #', 
            'Invoice Amount ($)', 'Invoice Status'
        ];

        const rows = filteredJobs.map(j => [
            `"${j.jobNumber || j.id}"`,
            j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : '',
            `"${j.jobStatus || 'Scheduled'}"`,
            `"${(j.customerName || '').replace(/"/g, '""')}"`,
            `"${(j.address || j.serviceLocationAddress || '').replace(/"/g, '""')}"`,
            `"${(j.assignedTechnicianName || 'Unassigned').replace(/"/g, '""')}"`,
            `"${(j.tasks || []).join('; ').replace(/"/g, '""')}"`,
            `"${(j.poNumber || '').replace(/"/g, '""')}"`,
            `"${j.invoice?.id || j.invoice?.invoiceNumber || ''}"`,
            j.invoice?.totalAmount !== undefined ? j.invoice.totalAmount.toFixed(2) : (j.invoice?.amount !== undefined ? j.invoice.amount.toFixed(2) : '0.00'),
            `"${j.invoice?.status || 'Unpaid'}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Job_Records.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("Job records exported to CSV."));
    };

    // Helper for status colors
    const getStatusBadgeClass = (status?: string) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
            case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
            case 'En Route': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
            case 'On Hold': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
            case 'Cancelled': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-blue-500 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Total Project Jobs")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-amber-500 shadow-sm">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t("Active / Scheduled")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.active}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-emerald-500 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t("Completed Jobs")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.completed}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-purple-500 shadow-sm">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{t("Total Billed")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">${stats.totalInvoiced.toLocaleString()}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-teal-500 shadow-sm">
                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">{t("Total Collected")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">${stats.totalCollected.toLocaleString()}</p>
                </Card>
            </div>

            {/* Actions & Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={t("Search by job #, address, technician, PO...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs py-2 w-auto mb-0 min-w-[140px]"
                    >
                        <option value="ALL">{t("All Statuses")} ({projectJobs.length})</option>
                        <option value="Scheduled">{t("Scheduled")}</option>
                        <option value="En Route">{t("En Route")}</option>
                        <option value="In Progress">{t("In Progress")}</option>
                        <option value="Completed">{t("Completed")}</option>
                        <option value="On Hold">{t("On Hold")}</option>
                        <option value="Cancelled">{t("Cancelled")}</option>
                    </Select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        onClick={() => {
                            setSelectedJobIdsToImport([]);
                            setIsImportModalOpen(true);
                        }}
                        variant="secondary"
                        className="text-xs h-9 font-bold flex items-center gap-1.5"
                    >
                        <Link2 size={14} /> {t("Import Existing Job")}
                    </Button>
                    <Button
                        onClick={handleExportJobsCsv}
                        variant="secondary"
                        className="text-xs h-9"
                    >
                        <Download size={14} className="mr-1.5" /> {t("Export (CSV)")}
                    </Button>
                    <Button
                        onClick={onCreateJob}
                        className="text-xs h-9 bg-blue-600 hover:bg-blue-700 font-bold shadow-md flex items-center gap-1.5"
                    >
                        <Plus size={14} /> {t("New Job / Work Order")}
                    </Button>
                </div>
            </div>

            {/* Jobs Table */}
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                <Table headers={[t('Job # / Date'), t('Scope / Tasks'), t('Status'), t('Assigned Tech'), t('PO / SCID'), t('Invoice'), t('Actions')]}>
                    {filteredJobs.map(job => {
                        const jobDisplayId = job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`;
                        const invAmount = job.invoice?.totalAmount || job.invoice?.amount || 0;
                        const invStatus = job.invoice?.status || 'Unpaid';

                        return (
                            <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                            {jobDisplayId}
                                        </span>
                                        <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                            <Calendar size={11} className="text-slate-400" />
                                            {job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : t('Not Scheduled')}
                                        </span>
                                        {job.address && (
                                            <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate max-w-[200px]">
                                                <MapPin size={10} />
                                                {job.address}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                                        {job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : t('General Service')}
                                    </p>
                                    {job.specialInstructions && (
                                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 italic">
                                            {job.specialInstructions}
                                        </p>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(job.jobStatus)}`}>
                                        {t(job.jobStatus || 'Scheduled')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                                    <span className="flex items-center gap-1.5">
                                        <User size={13} className="text-slate-400" />
                                        {job.assignedTechnicianName || <span className="italic text-slate-400">{t("Unassigned")}</span>}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                    {job.poNumber ? (
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                            PO: {job.poNumber}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">--</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        {job.invoice?.id ? (
                                            <>
                                                <button
                                                    onClick={() => onManageInvoice(job.id)}
                                                    className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline text-left"
                                                >
                                                    #{job.invoice.id}
                                                </button>
                                                <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                                                    ${invAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                <span className={`text-[9px] font-bold uppercase ${invStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {t(invStatus)}
                                                </span>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => onManageInvoice(job.id)}
                                                className="text-[11px] text-blue-600 hover:underline font-bold text-left"
                                            >
                                                + {t("Create Invoice")}
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onViewJobDetails(job)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                            title={t("View Full Details & Diagnostics")}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => onEditJob(job)}
                                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                            title={t("Edit / Reschedule Appointment")}
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => onManageInvoice(job.id)}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                            title={t("Manage Invoice")}
                                        >
                                            <DollarSign size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleUnlinkJob(job)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                                            title={t("Unlink from Project")}
                                        >
                                            <Unlink size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {filteredJobs.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Wrench size={36} className="text-slate-300 dark:text-slate-600" />
                                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                                        {searchTerm || statusFilter !== 'ALL' ? t("No jobs match your filter.") : t("No jobs linked to this project yet.")}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <Button onClick={onCreateJob} className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
                                            + {t("Create New Job")}
                                        </Button>
                                        <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" className="text-xs h-8">
                                            {t("Import Existing Job")}
                                        </Button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>

            {/* Import Existing Jobs Modal */}
            {isImportModalOpen && (
                <Modal
                    isOpen={isImportModalOpen}
                    onClose={() => !isImporting && setIsImportModalOpen(false)}
                    title={t("Import Existing Jobs into Project")}
                    size="lg"
                >
                    <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setImportFilterMode('customer')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'customer'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("Customer Jobs")} ({project.customerName})
                                </button>
                                <button
                                    onClick={() => setImportFilterMode('unassigned')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'unassigned'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("Unassigned Jobs")}
                                </button>
                                <button
                                    onClick={() => setImportFilterMode('all')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'all'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("All Jobs")}
                                </button>
                            </div>

                            <div className="relative w-full sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder={t("Filter jobs...")}
                                    value={importSearchTerm}
                                    onChange={(e) => setImportSearchTerm(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white w-full"
                                />
                            </div>
                        </div>

                        {/* List of selectable jobs */}
                        <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 max-h-[400px] overflow-y-auto">
                            {availableJobsToImport.map(job => {
                                const isChecked = selectedJobIdsToImport.includes(job.id);
                                const isOtherProject = job.projectId && job.projectId !== project.id;
                                const otherProjName = isOtherProject ? (state.projects.find(p => p.id === job.projectId)?.name || t('Another Project')) : null;

                                return (
                                    <div
                                        key={job.id}
                                        onClick={() => {
                                            setSelectedJobIdsToImport(prev => 
                                                isChecked ? prev.filter(id => id !== job.id) : [...prev, job.id]
                                            );
                                        }}
                                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                            isChecked 
                                                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40' 
                                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // handled by parent onClick
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                                        {job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`}
                                                    </span>
                                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${getStatusBadgeClass(job.jobStatus)}`}>
                                                        {job.jobStatus || 'Scheduled'}
                                                    </span>
                                                    {otherProjName && (
                                                        <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                                                            {t("Currently in:")} {otherProjName}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                                                    {job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : t('General Service')}
                                                </p>
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                                    <span>{job.customerName}</span>
                                                    {job.address && <span>&bull; {job.address}</span>}
                                                    {job.appointmentTime && <span>&bull; {new Date(job.appointmentTime).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            {job.invoice?.totalAmount ? (
                                                <p className="font-bold text-xs text-slate-900 dark:text-white">
                                                    ${job.invoice.totalAmount.toLocaleString()}
                                                </p>
                                            ) : null}
                                            {job.poNumber && (
                                                <p className="text-[10px] font-mono text-slate-400">
                                                    PO: {job.poNumber}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {availableJobsToImport.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs">
                                    {t("No available jobs found to import matching this filter.")}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                            <div className="text-xs text-slate-500">
                                <span className="font-bold">{selectedJobIdsToImport.length}</span> {t("jobs selected")}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsImportModalOpen(false)}
                                    disabled={isImporting}
                                    className="text-xs"
                                >
                                    {t("Cancel")}
                                </Button>
                                <Button
                                    onClick={handleExecuteImportJobs}
                                    disabled={isImporting || selectedJobIdsToImport.length === 0}
                                    className="text-xs bg-blue-600 hover:bg-blue-700 font-bold"
                                >
                                    {isImporting ? t("Importing...") : t(`Import ${selectedJobIdsToImport.length} Job(s)`)}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default JobsTab;
