import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import type { Job, Customer } from 'types';
import { Calendar, Clock, User, Briefcase, FileText, Plus, Sparkles, AlertCircle, MapPin, Search } from 'lucide-react';

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
    const [searchQuery, setSearchQuery] = useState('');

    // Helper to get timestamp for newest-first sorting
    const getJobDate = (job: Job): number => {
        const dateStr = job.appointmentTime || job.createdAt || job.updatedAt;
        return dateStr ? new Date(dateStr).getTime() : 0;
    };

    // Sort jobs: newest first by appointment / creation date
    const sortedJobs = useMemo(() => {
        return [...jobs].sort((a, b) => getJobDate(b) - getJobDate(a));
    }, [jobs]);

    // Helper to resolve service location details for a job
    const getJobLocationDetails = (job: Job, cust: Customer) => {
        // 1. Try matching customer.serviceLocations by locationId or property/location name or address
        const matchedLoc = cust?.serviceLocations?.find(loc => 
            (job.locationId && loc.id === job.locationId) ||
            (job.locationName && (loc.propertyName === job.locationName || loc.locationNumber === job.locationName)) ||
            (typeof job.address === 'string' && loc.address && loc.address.toLowerCase().includes(job.address.toLowerCase()))
        );

        const locationName = job.locationName || matchedLoc?.propertyName || matchedLoc?.locationNumber || '';

        let addressStr = '';
        if (typeof job.address === 'string' && job.address.trim()) {
            addressStr = job.address;
        } else if (job.address && typeof job.address === 'object') {
            const addrObj = job.address as any;
            addressStr = [addrObj.street, addrObj.city, addrObj.state, addrObj.zip].filter(Boolean).join(', ');
        } else if (matchedLoc?.address) {
            addressStr = [matchedLoc.address, matchedLoc.city, matchedLoc.state, matchedLoc.zip].filter(Boolean).join(', ');
        } else if (typeof cust?.address === 'string' && cust.address.trim()) {
            addressStr = cust.address;
        }

        const finalLocName = locationName || (addressStr ? (cust?.customerType === 'Property Management' ? 'Property Site' : 'Main Location') : '');

        return {
            locationName: finalLocName,
            addressStr,
            fullText: [finalLocName, addressStr].filter(Boolean).join(' • ')
        };
    };

    // Filter jobs by search query
    const filteredJobs = useMemo(() => {
        if (!searchQuery.trim()) return sortedJobs;
        const query = searchQuery.toLowerCase().trim();
        return sortedJobs.filter(job => {
            const loc = getJobLocationDetails(job, customer);
            const tasks = (job.tasks || []).join(' ').toLowerCase();
            const tech = (job.assignedTechnicianName || '').toLowerCase();
            const wo = (job.workOrderNumber || '').toLowerCase();
            const po = (job.poNumber || '').toLowerCase();
            const locName = loc.locationName.toLowerCase();
            const addr = loc.addressStr.toLowerCase();
            const status = (job.jobStatus || '').toLowerCase();
            const invStatus = (job.invoice?.status || '').toLowerCase();

            return tasks.includes(query) ||
                   tech.includes(query) ||
                   wo.includes(query) ||
                   po.includes(query) ||
                   locName.includes(query) ||
                   addr.includes(query) ||
                   status.includes(query) ||
                   invStatus.includes(query);
        });
    }, [sortedJobs, searchQuery, customer]);

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

    const serviceLocCount = customer.serviceLocations?.length || 0;

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
                        We found <strong>{jobs.length}</strong> existing jobs {serviceLocCount > 0 ? `across ${serviceLocCount} service locations` : ''} for <strong>{customer.name}</strong> (sorted <strong>newest first</strong>). 
                        Select an existing job below to link your invoice, or create a new standalone invoice.
                    </div>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
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

                    <div className="relative flex items-center py-1">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Or Link to Existing Job</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    {/* Search bar for quick filtering */}
                    {jobs.length > 2 && (
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search jobs by service location, address, WO#, PO#, tech, or task..."
                                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Existing Jobs List */}
                    {filteredJobs.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                            <p className="text-xs text-slate-500 dark:text-slate-400">No jobs match your search filter.</p>
                        </div>
                    ) : (
                        filteredJobs.map((job) => {
                            const recommended = isJobRecommended(job);
                            const locDetails = getJobLocationDetails(job, customer);
                            const appointmentDate = job.appointmentTime 
                                ? new Date(job.appointmentTime).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : (job.createdAt ? new Date(job.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 'Unscheduled');

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
                                        <div className="space-y-1.5 flex-1 pr-32">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                                                {job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : 'Service Job'}
                                            </h4>
                                            
                                            {/* Service Location Display */}
                                            {(locDetails.locationName || locDetails.addressStr) && (
                                                <div className="flex items-center gap-1.5 text-xs bg-slate-100/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 w-fit max-w-full">
                                                    <MapPin size={13} className="text-rose-500 shrink-0" />
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-[11px]">
                                                        {locDetails.locationName && (
                                                            <span className="font-extrabold text-slate-900 dark:text-white">
                                                                {locDetails.locationName}
                                                            </span>
                                                        )}
                                                        {locDetails.locationName && locDetails.addressStr && (
                                                            <span className="text-slate-400 font-bold">•</span>
                                                        )}
                                                        {locDetails.addressStr && (
                                                            <span className="text-slate-600 dark:text-slate-300 truncate">
                                                                {locDetails.addressStr}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {appointmentDate}</span>
                                                {job.assignedTechnicianName && (
                                                    <span className="flex items-center gap-1"><User size={12} /> {job.assignedTechnicianName}</span>
                                                )}
                                                {job.workOrderNumber && (
                                                    <span className="flex items-center gap-1 font-mono font-bold text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                                                        WO #{job.workOrderNumber}
                                                    </span>
                                                )}
                                                {job.poNumber && (
                                                    <span className="flex items-center gap-1 font-mono font-bold text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/60">
                                                        PO #{job.poNumber}
                                                    </span>
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
                        })
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
};

export default SelectExistingJobModal;

