import React from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import type { Job, Customer } from 'types';
import { Calendar, Clock, User, Briefcase, FileText, Plus, Sparkles, AlertCircle } from 'lucide-react';

interface SelectExistingJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    jobs: Job[];
    onSelectJob: (job: Job) => void;
    onCreateNew: () => void;
}

const SelectExistingJobModal: React.FC<SelectExistingJobModalProps> = ({
    isOpen,
    onClose,
    customer,
    jobs,
    onSelectJob,
    onCreateNew,
}) => {
    // Sort jobs: Recommended (Completed, no paid invoice) first, then by date descending
    const sortedJobs = [...jobs].sort((a, b) => {
        const aIsRecommended = a.jobStatus === 'Completed' && (!a.invoice || a.invoice.status !== 'Paid');
        const bIsRecommended = b.jobStatus === 'Completed' && (!b.invoice || b.invoice.status !== 'Paid');
        
        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        
        // Secondary sort: Appointment time descending
        return new Date(a.appointmentTime || 0).getTime() - new Date(b.appointmentTime || 0).getTime();
    });

    const isJobRecommended = (job: Job) => {
        return job.jobStatus === 'Completed' && (!job.invoice || job.invoice.status !== 'Paid');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'In Progress':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Needs Follow-up':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Scheduled':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            default:
                return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Invoice Linker: ${customer.name}`}
            size="lg"
        >
            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-start gap-3">
                    <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        We found <strong>{jobs.length}</strong> existing jobs for <strong>{customer.name}</strong>. 
                        To avoid creating duplicate entries, we recommend selecting an existing completed job to invoice.
                    </div>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    {/* Option to create a new standalone invoice */}
                    <div 
                        onClick={onCreateNew}
                        className="group relative p-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500/80 cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 p-2.5 rounded-xl group-hover:scale-105 transition-transform duration-200">
                                <Plus size={20} />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Create New Standalone Invoice</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Generate a fresh blank invoice unrelated to any existing jobs</p>
                            </div>
                        </div>
                        <Plus className="text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                    </div>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Or Link to Existing Job</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    {/* Existing Jobs List */}
                    {sortedJobs.map((job) => {
                        const recommended = isJobRecommended(job);
                        const appointmentDate = job.appointmentTime 
                            ? new Date(job.appointmentTime).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Unscheduled';

                        return (
                            <div
                                key={job.id}
                                onClick={() => onSelectJob(job)}
                                className={`group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md border flex flex-col gap-3 ${
                                    recommended 
                                        ? 'border-emerald-500/60 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500' 
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                                }`}
                            >
                                {recommended && (
                                    <div className="absolute top-3.5 right-4 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black tracking-widest uppercase py-1 px-2.5 rounded-full flex items-center gap-1">
                                        <Sparkles size={10} />
                                        Recommended: Ready to Invoice
                                    </div>
                                )}

                                <div className="flex items-start gap-3">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${
                                        recommended 
                                            ? 'bg-emerald-100/55 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }`}>
                                        <Briefcase size={20} />
                                    </div>
                                    <div className="space-y-1 pr-32">
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                                            {job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : 'Service Job'}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {appointmentDate}</span>
                                            {job.assignedTechnicianName && (
                                                <span className="flex items-center gap-1"><User size={12} /> {job.assignedTechnicianName}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-2.5 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${getStatusColor(job.jobStatus)}`}>
                                            Job: {job.jobStatus}
                                        </span>
                                        {job.invoice && (
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                                job.invoice.status === 'Paid' 
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                                Inv: {job.invoice.status} {job.invoice.id ? `#${job.invoice.id}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {job.invoice?.totalAmount !== undefined && job.invoice.totalAmount > 0 && (
                                        <span className="font-extrabold text-slate-900 dark:text-white">
                                            ${job.invoice.totalAmount.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
};

export default SelectExistingJobModal;
