import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import { 
    Wrench, Calendar, Clock, MapPin, User, CheckCircle2, 
    AlertCircle, Search, FileText, ChevronRight, Download, 
    CreditCard, Receipt, ShieldCheck, Shield, FileSearch, 
    DollarSign, ArrowUpRight, Sparkles, Check, Users, UserCheck, 
    ChevronDown, Camera, Image as ImageIcon, Maximize2, ExternalLink,
    X, Copy, FileSignature, Share2, Layers, CheckCircle, Tag
} from 'lucide-react';
import type { Job, ServiceLocation, Proposal, Customer, Organization } from 'types';
import showToast from 'lib/toast';
import { computeCanonicalFinancials, formatCurrency } from 'lib/financialCalculator';

interface WorkOrdersSectionProps {
    jobs: Job[];
    locations: ServiceLocation[];
    proposals?: Proposal[];
    customer?: Customer;
    organization?: Organization | null;
    onViewJobReport: (job: Job) => void;
    onViewInvoice?: (job: Job) => void;
    onPayInvoice?: (job: Job) => void;
    onViewProposal?: (proposal: Proposal) => void;
    onAcceptWarranty?: (job: Job) => void;
    onRequestService: (locationId?: string) => void;
    onOpenDesignateContacts?: (locationId?: string, jobId?: string) => void;
}

type WorkOrderTab = 'all' | 'open' | 'closed' | 'unpaid' | 'warranty';

const getJobNotesString = (notes: any): string => {
    if (!notes) return '';
    if (typeof notes === 'string') return notes;
    if (typeof notes === 'object') {
        return notes.workNotes || notes.completion || notes.preRepair || notes.feedback || notes.diagnosis || '';
    }
    return '';
};

const WorkOrdersSection: React.FC<WorkOrdersSectionProps> = ({
    jobs = [],
    locations = [],
    proposals = [],
    customer,
    organization,
    onViewJobReport,
    onViewInvoice,
    onPayInvoice,
    onViewProposal,
    onAcceptWarranty,
    onRequestService,
    onOpenDesignateContacts
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeTab, setActiveTab] = useState<WorkOrderTab>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states for clicking on cards
    const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);
    const [modalActiveTab, setModalActiveTab] = useState<'overview' | 'invoices' | 'proposals' | 'photos' | 'signoff' | 'warranties'>('overview');
    const [selectedPhotoLightbox, setSelectedPhotoLightbox] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
    const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);

    const openJobs = useMemo(() => jobs.filter(j => j.jobStatus !== 'Completed'), [jobs]);
    const closedJobs = useMemo(() => jobs.filter(j => j.jobStatus === 'Completed'), [jobs]);
    const unpaidJobs = useMemo(() => jobs.filter(j => {
        if (!j.invoice) return false;
        const inv = j.invoice;
        const canonical = computeCanonicalFinancials({
            items: inv.items || [],
            subtotal: inv.subtotal,
            taxRate: inv.taxRate,
            taxAmount: inv.taxAmount,
            totalAmount: inv.totalAmount ?? inv.amount,
            amountPaid: inv.amountPaid,
            depositPaid: inv.depositPaid,
            depositPaidAmount: inv.depositPaidAmount,
            status: inv.status
        });
        const isPaid = String(inv.status).toLowerCase() === 'paid' || canonical.financialStatus === 'PAID' || canonical.balanceDue <= 0;
        const hasBillableAmount = canonical.grandTotal > 0 || (Array.isArray(inv.items) && inv.items.length > 0);
        return !isPaid && hasBillableAmount && canonical.balanceDue > 0;
    }), [jobs]);
    const warrantyJobs = useMemo(() => jobs.filter(j => {
        const inv = j.invoice as any;
        return inv && ((inv.workmanshipWarrantyMonths && inv.workmanshipWarrantyMonths > 0) || (inv.partsWarrantyMonths && inv.partsWarrantyMonths > 0));
    }), [jobs]);

    const filteredJobs = useMemo(() => {
        let list: Job[] = [];
        if (activeTab === 'open') list = openJobs;
        else if (activeTab === 'closed') list = closedJobs;
        else if (activeTab === 'unpaid') list = unpaidJobs;
        else if (activeTab === 'warranty') list = warrantyJobs;
        else list = jobs;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(j => {
                const notesStr = getJobNotesString(j.notes).toLowerCase();
                const invId = (j.invoice?.id || '').toLowerCase();
                const po = (j.poNumber || '').toLowerCase();
                return (
                    po.includes(q) ||
                    invId.includes(q) ||
                    (j.id || '').toLowerCase().includes(q) ||
                    (j.tasks || []).some(t => t.toLowerCase().includes(q)) ||
                    (j.locationName || '').toLowerCase().includes(q) ||
                    (j.address || '').toLowerCase().includes(q) ||
                    (j.assignedTechnicianName || '').toLowerCase().includes(q) ||
                    notesStr.includes(q)
                );
            });
        }

        return list.sort((a, b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [jobs, openJobs, closedJobs, unpaidJobs, warrantyJobs, activeTab, searchQuery]);

    const getLocationName = (job: Job) => {
        if (job.locationName) return job.locationName;
        if (job.locationId) {
            const found = locations.find(l => l.id === job.locationId);
            if (found) return found.propertyName || found.name;
        }
        return 'Main Site';
    };

    // Find matching proposal for this job
    const getMatchingProposal = (job: Job): Proposal | null => {
        if (!proposals || proposals.length === 0) return null;
        if (job.proposalId) {
            const found = proposals.find(p => p.id === job.proposalId);
            if (found) return found;
        }
        const foundByJobId = proposals.find(p => p.jobId === job.id);
        if (foundByJobId) return foundByJobId;
        if (job.linkedProposalIds && job.linkedProposalIds.length > 0) {
            const foundByLinked = proposals.find(p => job.linkedProposalIds?.includes(p.id));
            if (foundByLinked) return foundByLinked;
        }
        // Match by PO Number
        if (job.poNumber) {
            const foundByPo = proposals.find(p => p.poNumber && p.poNumber.toLowerCase() === job.poNumber?.toLowerCase());
            if (foundByPo) return foundByPo;
        }
        // Match by WO / Job ID cross-reference
        const foundByWorkOrderNumber = proposals.find(p => 
            (p.workOrderNumber && (p.workOrderNumber === job.workOrderNumber || p.workOrderNumber === job.id)) ||
            (job.id && p.id && (job.id.includes(p.id) || p.id.includes(job.id) || (job.id.includes('08') && p.id.includes('08'))))
        );
        if (foundByWorkOrderNumber) return foundByWorkOrderNumber;

        // Fallback: any proposal for this location
        if (job.locationId) {
            const foundByLoc = proposals.find(p => p.locationId === job.locationId);
            if (foundByLoc) return foundByLoc;
        }

        return null;
    };

    // Extract all photos attached to a specific job
    const getJobPhotos = (job: Job) => {
        const photos: Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }> = [];
        const woNum = job.workOrderNumber || job.poNumber || `WO-${job.id.slice(-6).toUpperCase()}`;

        if (job.files && Array.isArray(job.files)) {
            job.files.forEach((file: any, idx) => {
                const fileUrl = file.url || file.dataUrl;
                const fileName = file.fileName || file.name || 'Inspection Photo';
                const fileType = file.fileType || file.type || '';
                const isImg = fileType.startsWith('image/') || 
                    fileUrl?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || 
                    fileName?.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                
                if (isImg && fileUrl) {
                    photos.push({
                        id: `job-file-${idx}`,
                        url: fileUrl,
                        title: fileName,
                        subtitle: `${woNum} · Uploaded Document/Photo`,
                        tag: file.metadata?.category || file.label || 'Job Photo'
                    });
                }
            });
        }

        if (job.qcAudits && Array.isArray(job.qcAudits)) {
            job.qcAudits.forEach((qc: any, idx) => {
                if (qc.imageUrl) {
                    photos.push({
                        id: `job-qc-${idx}`,
                        url: qc.imageUrl,
                        title: `QC Audit: ${qc.status?.toUpperCase() || 'Verified'}`,
                        subtitle: qc.comments || 'Technician Quality Inspection',
                        tag: 'Quality Audit'
                    });
                }
            });
        }

        const jobPhotosList = (job as any).photos;
        if (jobPhotosList && Array.isArray(jobPhotosList)) {
            jobPhotosList.forEach((p: any, idx: number) => {
                const url = typeof p === 'string' ? p : p.url;
                if (url) {
                    photos.push({
                        id: `job-p-${idx}`,
                        url,
                        title: typeof p === 'object' && p.label ? p.label : `${woNum} Field Photo`,
                        subtitle: typeof p === 'object' && p.notes ? p.notes : undefined,
                        tag: 'Field Photo'
                    });
                }
            });
        }

        return photos;
    };

    // Construct payment link for a job invoice
    const getPaymentLink = (job: Job) => {
        const invId = job.invoice?.id || job.id;
        const origin = window.location.origin;
        return `${origin}/invoice/${job.id}`;
    };

    const handleCopyPaymentLink = (job: Job) => {
        const link = getPaymentLink(job);
        navigator.clipboard.writeText(link);
        setCopiedPaymentLink(true);
        showToast.success('Payment link copied to clipboard!');
        setTimeout(() => setCopiedPaymentLink(false), 3000);
    };

    return (
        <section className="space-y-4">
            <div 
                onClick={() => setIsCollapsed(prev => !prev)}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer group select-none bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary-400 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-xl shrink-0">
                        <Wrench size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Work Orders &amp; Service Jobs
                            </h3>
                            <span className="bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full font-bold">
                                {jobs.length}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Click any work order card to review associated invoices, payment links, proposals, photos, sign-off sheets, and full reports.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end shrink-0" onClick={e => e.stopPropagation()}>
                    <Button 
                        onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," 
                                + "WO Number,Date,Property Location,Status,Tasks,PO Number,Invoice Status,Total Amount\n"
                                + filteredJobs.map(j => `"${j.id.slice(-6).toUpperCase()}","${new Date(j.appointmentTime).toLocaleDateString()}","${getLocationName(j)}","${j.jobStatus}","${j.tasks?.join('; ')}","${j.poNumber || ''}","${j.invoice?.status || 'N/A'}","${j.invoice?.totalAmount || j.invoice?.amount || 0}"`).join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `Work_Orders_Export_${activeTab}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        variant="secondary" 
                        size="sm" 
                        className="text-xs flex items-center gap-1 py-1.5 cursor-pointer"
                    >
                        <Download size={14} /> Export CSV
                    </Button>

                    <Button 
                        size="sm" 
                        onClick={() => onRequestService()}
                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs py-1.5 font-bold cursor-pointer"
                    >
                        New Work Order
                    </Button>

                    <div 
                        onClick={() => setIsCollapsed(prev => !prev)}
                        className="flex items-center gap-1 text-xs font-bold text-slate-500 group-hover:text-primary-600 transition-colors pl-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                        <span>{isCollapsed ? 'Show' : 'Collapse'}</span>
                        <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                </div>
            </div>

            {!isCollapsed && (
                <>
                {/* Filter Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        All ({jobs.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('open')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'open'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-blue-600'
                        }`}
                    >
                        <span>Open</span>
                        <span className="bg-white/20 text-current px-1.5 py-0.2 rounded-full text-[10px]">
                            {openJobs.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('closed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'closed'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-emerald-600'
                        }`}
                    >
                        <span>Completed</span>
                        <span className="bg-white/20 text-current px-1.5 py-0.2 rounded-full text-[10px]">
                            {closedJobs.length}
                        </span>
                    </button>
                    {unpaidJobs.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('unpaid')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'unpaid'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                        >
                            <span>Unpaid Invoices</span>
                            <span className="bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 px-1.5 py-0.2 rounded-full text-[10px]">
                                {unpaidJobs.length}
                            </span>
                        </button>
                    )}
                    {warrantyJobs.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('warranty')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'warranty'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                            }`}
                        >
                            <Shield size={12} />
                            <span>Warranties ({warrantyJobs.length})</span>
                        </button>
                    )}
                </div>

                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by WO #, PO #, invoice #, tech, property..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                    />
                </div>
            </div>

            {/* Work Orders List */}
            <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                    <div className="p-10 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-bold text-xs">
                        No work orders matching your current filter.
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const isOpen = job.jobStatus !== 'Completed';
                        const locName = getLocationName(job);
                        const notesString = getJobNotesString(job.notes);
                        const invoice = job.invoice;
                        const canonical = invoice ? computeCanonicalFinancials({
                            items: invoice.items || [],
                            subtotal: invoice.subtotal,
                            taxRate: invoice.taxRate,
                            taxAmount: invoice.taxAmount,
                            totalAmount: invoice.totalAmount ?? invoice.amount,
                            amountPaid: invoice.amountPaid,
                            depositPaid: invoice.depositPaid,
                            depositPaidAmount: invoice.depositPaidAmount,
                            status: invoice.status
                        }) : null;
                        const hasInvoice = !!invoice && (canonical ? (canonical.grandTotal > 0 || (Array.isArray(invoice.items) && invoice.items.length > 0)) : (invoice.totalAmount || invoice.amount || 0) > 0);
                        const isInvoicePaid = String(invoice?.status).toLowerCase() === 'paid' || canonical?.financialStatus === 'PAID' || (canonical ? canonical.balanceDue <= 0 : false);
                        const invoiceAmount = canonical ? canonical.balanceDue : (invoice?.totalAmount || invoice?.amount || 0);
                        const proposal = getMatchingProposal(job);
                        const hasProposal = !!proposal;
                        const isProposalAccepted = proposal?.status === 'Accepted';
                        const wm = (invoice as any)?.workmanshipWarrantyMonths || 0;
                        const pm = (invoice as any)?.partsWarrantyMonths || 0;
                        const hasWarranty = wm > 0 || pm > 0;
                        const jobPhotos = getJobPhotos(job);

                        return (
                            <Card 
                                key={job.id} 
                                onClick={() => {
                                    setSelectedJobForModal(job);
                                    setModalActiveTab('overview');
                                }}
                                className={`p-5 rounded-2xl border-2 transition-all hover:shadow-lg bg-white dark:bg-slate-900 space-y-4 cursor-pointer group hover:border-primary-500 dark:hover:border-primary-500 ${
                                    isOpen 
                                        ? 'border-blue-200 dark:border-blue-900/40' 
                                        : (hasInvoice && !isInvoicePaid) 
                                        ? 'border-rose-200 dark:border-rose-900/40' 
                                        : 'border-slate-200 dark:border-slate-800'
                                }`}
                            >
                                {/* Top Header Row */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                            job.jobStatus === 'Completed'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                : job.jobStatus === 'In Progress'
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                        }`}>
                                            {job.jobStatus}
                                        </span>

                                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                            WO #{job.workOrderNumber || job.id.slice(-6).toUpperCase()}
                                        </span>

                                        {job.poNumber && (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md uppercase">
                                                PO: {job.poNumber}
                                            </span>
                                        )}

                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                            <MapPin size={12} className="text-primary-600" /> {locName}
                                        </span>
                                    </div>

                                    {/* Quick Status / Total Pill */}
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        {hasInvoice && (
                                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg font-mono flex items-center gap-1 ${
                                                isInvoicePaid 
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                            }`}>
                                                {isInvoicePaid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                <span>{isInvoicePaid ? 'PAID' : 'UNPAID'}: ${invoiceAmount.toFixed(2)}</span>
                                            </span>
                                        )}
                                        {hasProposal && (
                                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                                                isProposalAccepted
                                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                            }`}>
                                                <FileSearch size={12} />
                                                <span>{isProposalAccepted ? 'Accepted Quote' : 'Pending Quote'}: ${(Number(proposal.total) || 0).toFixed(0)}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Body Information */}
                                <div className="space-y-2">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-base group-hover:text-primary-600 transition-colors">
                                                {job.tasks?.join(', ') || job.visitType || 'Service & Maintenance Visit'}
                                            </h4>
                                            {notesString && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                                    {notesString}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Meta Tags: Tech, Appointment Date, Assets Serviced */}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                                        <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                                            <Calendar size={13} className="text-slate-400" />
                                            {new Date(job.appointmentTime).toLocaleDateString(undefined, { 
                                                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                                            })}
                                        </span>

                                        {job.assignedTechnicianName && (
                                            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                                                <User size={13} className="text-slate-400" />
                                                Tech: {job.assignedTechnicianName}
                                            </span>
                                        )}

                                        {/* Designated POC / Account Manager */}
                                        {(job.pocContact || job.accountManagerContact) && (
                                            <span className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 text-xs">
                                                <UserCheck size={13} className="text-amber-600" />
                                                <span>POC: {(job.pocContact || job.accountManagerContact)?.name} {((job.pocContact || job.accountManagerContact)?.phone) && `• ${(job.pocContact || job.accountManagerContact)?.phone}`}</span>
                                            </span>
                                        )}

                                        {jobPhotos.length > 0 && (
                                            <span className="flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                                                <Camera size={13} />
                                                {jobPhotos.length} Photo{jobPhotos.length > 1 ? 's' : ''}
                                            </span>
                                        )}

                                        {hasWarranty && (
                                            <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                                <ShieldCheck size={13} />
                                                Warranty: {wm || pm} Months Coverage
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Contextual Action Buttons Row */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                                    {/* Left Actions: Proposals, Invoices, Receipts, Warranties, POC Designation */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* DESIGNATE / CHANGE POC BUTTON */}
                                        {onOpenDesignateContacts && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenDesignateContacts(job.locationId || undefined, job.id);
                                                }}
                                                className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-primary-600 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                                            >
                                                <Users size={13} className="text-primary-500" />
                                                <span>{job.pocContact || job.accountManagerContact ? 'Change POC' : 'Designate POC'}</span>
                                            </button>
                                        )}

                                        {/* INVOICE PAYMENT / RECEIPT BUTTONS */}
                                        {hasInvoice && (
                                            !isInvoicePaid ? (
                                                <>
                                                    {onPayInvoice && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onPayInvoice(job);
                                                            }}
                                                            className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                                                        >
                                                            <CreditCard size={13} />
                                                            <span>Pay Invoice (${invoiceAmount.toFixed(2)})</span>
                                                        </button>
                                                    )}
                                                    {onViewInvoice && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onViewInvoice(job);
                                                            }}
                                                            className="text-xs font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                                        >
                                                            <FileText size={13} />
                                                            <span>View Invoice</span>
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                onViewInvoice && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onViewInvoice(job);
                                                        }}
                                                        className="text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                                    >
                                                        <Receipt size={13} />
                                                        <span>View Receipt / Paid Invoice</span>
                                                    </button>
                                                )
                                            )
                                        )}

                                        {/* PROPOSAL BUTTON */}
                                        {hasProposal && onViewProposal && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewProposal(proposal);
                                                }}
                                                className={`text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    isProposalAccepted
                                                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-sm'
                                                }`}
                                            >
                                                <FileSearch size={13} />
                                                <span>{isProposalAccepted ? 'View Accepted Proposal' : `Review Proposal ($${(Number(proposal.total) || 0).toFixed(0)})`}</span>
                                            </button>
                                        )}

                                        {/* WARRANTY BUTTON */}
                                        {hasWarranty && onAcceptWarranty && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAcceptWarranty(job);
                                                }}
                                                className="text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <ShieldCheck size={13} />
                                                <span>View Warranty Coverage</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Right Action: Full Service Report */}
                                    <button 
                                        type="button" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewJobReport(job);
                                        }}
                                        className="text-xs font-black bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer w-full sm:w-auto sm:ml-auto"
                                    >
                                        <FileText size={13} />
                                        <span>Full Report &amp; Photos</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>
            </>
            )}

            {/* WORK ORDER DETAILS & ASSOCIATED RECORDS MODAL */}
            {selectedJobForModal && (
                <Modal
                    isOpen={!!selectedJobForModal}
                    onClose={() => setSelectedJobForModal(null)}
                    title={`Work Order #${selectedJobForModal.workOrderNumber || selectedJobForModal.id.slice(-6).toUpperCase()} Details & Records`}
                    size="xl"
                >
                    <div className="space-y-6">
                        {/* Header Hero Banner */}
                        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6 rounded-2xl text-white shadow-xl border border-indigo-800/40 space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                            selectedJobForModal.jobStatus === 'Completed' 
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                                                : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                                        }`}>
                                            {selectedJobForModal.jobStatus}
                                        </span>
                                        <span className="font-mono font-black text-sm text-indigo-300">
                                            WO #{selectedJobForModal.workOrderNumber || selectedJobForModal.id.slice(-6).toUpperCase()}
                                        </span>
                                        {selectedJobForModal.poNumber && (
                                            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                                                PO: {selectedJobForModal.poNumber}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black text-white">
                                        {selectedJobForModal.tasks?.join(', ') || selectedJobForModal.visitType || 'Service & Maintenance Visit'}
                                    </h3>
                                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                                        <MapPin size={13} className="text-indigo-400" />
                                        <span>{getLocationName(selectedJobForModal)} · {typeof selectedJobForModal.address === 'string' ? selectedJobForModal.address : 'Address on file'}</span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                                    <Button
                                        onClick={() => {
                                            const j = selectedJobForModal;
                                            setSelectedJobForModal(null);
                                            onViewJobReport(j);
                                        }}
                                        className="w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                                    >
                                        <FileText size={15} />
                                        <span>View Generated Service Report</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-indigo-900/60 text-xs">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Service Date</span>
                                    <span className="font-bold text-white">
                                        {new Date(selectedJobForModal.appointmentTime).toLocaleDateString(undefined, {
                                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Assigned Tech</span>
                                    <span className="font-bold text-white">
                                        {selectedJobForModal.assignedTechnicianName || 'Field Technician'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Invoice Status</span>
                                    <span className={`font-black ${selectedJobForModal.invoice?.status === 'Paid' ? 'text-emerald-400' : selectedJobForModal.invoice ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {selectedJobForModal.invoice?.status === 'Paid' ? 'PAID' : selectedJobForModal.invoice ? 'UNPAID' : 'No Invoice'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Amount</span>
                                    <span className="font-mono font-black text-white">
                                        ${(selectedJobForModal.invoice?.totalAmount || selectedJobForModal.invoice?.amount || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Tab Navigation - Always display all 6 core tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3 sm:gap-5 overflow-x-auto no-scrollbar pb-1">
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('overview')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'overview'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Wrench size={15} /> Overview &amp; Notes
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('invoices')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'invoices'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Receipt size={15} /> Invoice &amp; Payment Link {selectedJobForModal.invoice ? `(${(selectedJobForModal.invoice.totalAmount || selectedJobForModal.invoice.amount || 0).toFixed(0)})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('proposals')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'proposals'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileSearch size={15} /> Proposals &amp; Quotes {getMatchingProposal(selectedJobForModal) ? '(1)' : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('photos')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'photos'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Camera size={15} /> Photos &amp; Media ({getJobPhotos(selectedJobForModal).length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('signoff')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'signoff'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileSignature size={15} /> Sign-off Sheet
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalActiveTab('warranties')}
                                className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    modalActiveTab === 'warranties'
                                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <ShieldCheck size={15} /> Warranty Protection
                            </button>
                        </div>

                        {/* TAB 1: OVERVIEW & NOTES */}
                        {modalActiveTab === 'overview' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                        Scope of Service / Tasks
                                    </span>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                        {selectedJobForModal.tasks?.join(', ') || 'General Service Visit'}
                                    </p>
                                </div>

                                {getJobNotesString(selectedJobForModal.notes) && (
                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                            Technician Diagnosis &amp; Field Notes
                                        </span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {getJobNotesString(selectedJobForModal.notes)}
                                        </p>
                                    </div>
                                )}

                                {/* Property & Facility Location Context */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                                    <MapPin size={18} className="text-primary-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Service Location</span>
                                        <p className="text-xs font-black text-slate-900 dark:text-white">{getLocationName(selectedJobForModal)}</p>
                                        <p className="text-xs text-slate-500">{typeof selectedJobForModal.address === 'string' ? selectedJobForModal.address : 'Address on record'}</p>
                                    </div>
                                </div>

                                {/* Assigned POC / Contact */}
                                {(selectedJobForModal.pocContact || selectedJobForModal.accountManagerContact) && (
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <UserCheck size={20} className="text-amber-600" />
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">Designated On-Site Contact / POC</span>
                                                <p className="text-xs font-black text-slate-900 dark:text-white">
                                                    {(selectedJobForModal.pocContact || selectedJobForModal.accountManagerContact)?.name}
                                                </p>
                                                {((selectedJobForModal.pocContact || selectedJobForModal.accountManagerContact)?.phone) && (
                                                    <p className="text-[11px] text-slate-500">
                                                        📞 {(selectedJobForModal.pocContact || selectedJobForModal.accountManagerContact)?.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: INVOICES & PAYMENT LINK */}
                        {modalActiveTab === 'invoices' && (
                            <div className="space-y-4">
                                {selectedJobForModal.invoice ? (
                                    <div className="space-y-4">
                                        <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                                                <div>
                                                    <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                                                        Invoice #{selectedJobForModal.invoice.id}
                                                    </span>
                                                    <span className="text-xs text-slate-400 block mt-0.5">
                                                        WO: {selectedJobForModal.workOrderNumber || selectedJobForModal.id}
                                                    </span>
                                                </div>

                                                <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                                                    selectedJobForModal.invoice.status === 'Paid'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                }`}>
                                                    {selectedJobForModal.invoice.status || 'Sent'}
                                                </span>
                                            </div>

                                            {/* Line Items Table */}
                                            {selectedJobForModal.invoice.items && selectedJobForModal.invoice.items.length > 0 && (
                                                <div className="space-y-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Itemized Charges</span>
                                                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500">
                                                                <tr>
                                                                    <th className="p-2.5">Description</th>
                                                                    <th className="p-2.5 text-center">Qty</th>
                                                                    <th className="p-2.5 text-right">Price</th>
                                                                    <th className="p-2.5 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {selectedJobForModal.invoice.items.map((item: any, idx: number) => (
                                                                    <tr key={idx}>
                                                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{item.description || item.name}</td>
                                                                        <td className="p-2.5 text-center text-slate-500">{item.quantity || 1}</td>
                                                                        <td className="p-2.5 text-right text-slate-500">${Number(item.unitPrice || item.price || 0).toFixed(2)}</td>
                                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">${Number((item.quantity || 1) * (item.unitPrice || item.price || 0)).toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Financial Totals */}
                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                                <div className="w-64 space-y-1.5 text-xs">
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Subtotal</span>
                                                        <span className="font-mono">${Number(selectedJobForModal.invoice.subtotal || 0).toFixed(2)}</span>
                                                    </div>
                                                    {Number(selectedJobForModal.invoice.taxAmount || 0) > 0 && (
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>Tax</span>
                                                            <span className="font-mono">${Number(selectedJobForModal.invoice.taxAmount || 0).toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                                                        <span>Total Amount</span>
                                                        <span className="font-mono">${(selectedJobForModal.invoice.totalAmount || selectedJobForModal.invoice.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Shareable Payment Link Section */}
                                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                                                        <Share2 size={12} /> Direct Customer Payment Link
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyPaymentLink(selectedJobForModal)}
                                                        className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        {copiedPaymentLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                        <span>{copiedPaymentLink ? 'Copied Link!' : 'Copy Link'}</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={getPaymentLink(selectedJobForModal)}
                                                        className="w-full text-xs font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleCopyPaymentLink(selectedJobForModal)}
                                                        className="text-xs px-3 py-2 shrink-0 cursor-pointer font-bold"
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                                {(() => {
                                                    const inv = selectedJobForModal.invoice;
                                                    const canonical = inv ? computeCanonicalFinancials({
                                                        items: inv.items || [],
                                                        subtotal: inv.subtotal,
                                                        taxRate: inv.taxRate,
                                                        taxAmount: inv.taxAmount,
                                                        totalAmount: inv.totalAmount ?? inv.amount,
                                                        amountPaid: inv.amountPaid,
                                                        depositPaid: inv.depositPaid,
                                                        depositPaidAmount: inv.depositPaidAmount,
                                                        status: inv.status
                                                    }) : null;
                                                    const isUnpaid = inv && String(inv.status).toLowerCase() !== 'paid' && canonical?.financialStatus !== 'PAID' && (canonical ? canonical.balanceDue > 0 : false);
                                                    const dueAmt = canonical ? canonical.balanceDue : (inv?.totalAmount || inv?.amount || 0);

                                                    if (isUnpaid && onPayInvoice) {
                                                        return (
                                                            <Button
                                                                onClick={() => {
                                                                    const j = selectedJobForModal;
                                                                    setSelectedJobForModal(null);
                                                                    onPayInvoice(j);
                                                                }}
                                                                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2.5 px-5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                                                            >
                                                                <CreditCard size={14} />
                                                                <span>Pay Online Now (${dueAmt.toFixed(2)})</span>
                                                            </Button>
                                                        );
                                                    }
                                                    return (
                                                        <div className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                                                            <CheckCircle2 size={16} />
                                                            <span>Invoice is fully paid and settled.</span>
                                                        </div>
                                                    );
                                                })()}

                                                {onViewInvoice && (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => {
                                                            const j = selectedJobForModal;
                                                            setSelectedJobForModal(null);
                                                            onViewInvoice(j);
                                                        }}
                                                        className="text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Receipt size={14} />
                                                        <span>{selectedJobForModal.invoice.status === 'Paid' ? 'View Official Receipt' : 'View Printable Invoice'}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
                                                    <Receipt size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                        Billing Status: Pending Service Completion
                                                    </h4>
                                                    <p className="text-xs text-slate-500">
                                                        Itemized invoice will be generated and posted following technician on-site completion.
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full">
                                                Scheduled
                                            </span>
                                        </div>

                                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">PO Number</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                                    {selectedJobForModal.poNumber || 'PO on file'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Billing Type</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    Standard Service Agreement / T&amp;M
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Accepted Payment Modes</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    Credit Card, ACH, Wire, Check
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: PROPOSALS & ESTIMATES */}
                        {modalActiveTab === 'proposals' && (
                            <div className="space-y-4">
                                {(() => {
                                    const prop = getMatchingProposal(selectedJobForModal);
                                    if (prop) {
                                        return (
                                            <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Associated Proposal / Quote</span>
                                                        <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                                            {prop.title || `Proposal #${prop.id}`}
                                                        </h4>
                                                    </div>
                                                    <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                                                        prop.status === 'Accepted'
                                                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                    }`}>
                                                        {prop.status}
                                                    </span>
                                                </div>

                                                {/* Scope / Items preview */}
                                                {prop.items && prop.items.length > 0 && (
                                                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500">
                                                                <tr>
                                                                    <th className="p-2.5">Scope Description</th>
                                                                    <th className="p-2.5 text-center">Qty</th>
                                                                    <th className="p-2.5 text-right">Price</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {prop.items.map((item: any, idx: number) => (
                                                                    <tr key={idx}>
                                                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{item.description || item.name}</td>
                                                                        <td className="p-2.5 text-center text-slate-500">{item.quantity || 1}</td>
                                                                        <td className="p-2.5 text-right font-mono text-slate-900 dark:text-white">${Number(item.total || item.unitPrice || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400">Total Investment</span>
                                                    <span className="text-base font-mono font-black text-slate-900 dark:text-white">
                                                        ${(Number(prop.total) || 0).toFixed(2)}
                                                    </span>
                                                </div>

                                                {onViewProposal && (
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedJobForModal(null);
                                                            onViewProposal(prop);
                                                        }}
                                                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                                    >
                                                        <FileSearch size={14} />
                                                        <span>{prop.status === 'Accepted' ? 'View Accepted Proposal' : 'Review & Sign Proposal'}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl shrink-0">
                                                    <FileSearch size={20} />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                        Standard Service Call (No Upfront Estimate Required)
                                                    </h4>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        This work order is scheduled under your direct maintenance agreement and agreed time &amp; materials terms. If equipment replacement or major upgrades are diagnosed during the visit, a formal proposal will be generated here for your digital sign-off.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => {
                                                        const locId = selectedJobForModal.locationId;
                                                        setSelectedJobForModal(null);
                                                        onRequestService(locId);
                                                    }}
                                                    className="text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                                                >
                                                    Request Estimate / Scope for this Site
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* TAB 4: PHOTOS & INSPECTIONS */}
                        {modalActiveTab === 'photos' && (
                            <div className="space-y-4">
                                {(() => {
                                    const photos = getJobPhotos(selectedJobForModal);
                                    if (photos.length > 0) {
                                        return (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[440px] overflow-y-auto pr-1">
                                                {photos.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => setSelectedPhotoLightbox(p)}
                                                        className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-square cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                                                    >
                                                        <img
                                                            src={p.url}
                                                            alt={p.title}
                                                            className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                                                            loading="lazy"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2.5 flex flex-col justify-between">
                                                            <div className="flex justify-between items-start">
                                                                {p.tag && (
                                                                    <span className="text-[9px] font-black uppercase bg-primary-600/80 text-white px-2 py-0.5 rounded-full">
                                                                        {p.tag}
                                                                    </span>
                                                                )}
                                                                <div className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Maximize2 size={11} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-white truncate drop-shadow-sm">
                                                                    {p.title}
                                                                </p>
                                                                {p.subtitle && (
                                                                    <p className="text-[10px] text-slate-300 truncate drop-shadow-sm">
                                                                        {p.subtitle}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 rounded-xl shrink-0">
                                                    <Camera size={20} />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                        Field Inspection Media &amp; Photos
                                                    </h4>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        High-resolution before/after service photos, equipment condition diagnostics, and technician QC audit pictures will be captured and uploaded live during this on-site visit.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                                                <span className="font-bold text-slate-600 dark:text-slate-300">Scheduled Inspection Visit</span>
                                                <span className="font-bold text-primary-600">
                                                    {new Date(selectedJobForModal.appointmentTime).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* TAB 5: SIGNOFF SHEETS & SIGNATURES */}
                        {modalActiveTab === 'signoff' && (
                            <div className="space-y-4">
                                {(() => {
                                    const sigUrl = selectedJobForModal.signatureUrl || selectedJobForModal.invoice?.signatureUrl;
                                    const signerName = (selectedJobForModal as any).customerSignatureName || (selectedJobForModal as any).signatureName || (selectedJobForModal.pocContact || selectedJobForModal.accountManagerContact)?.name || customer?.name || 'Authorized Contact';
                                    const signedDate = (selectedJobForModal as any).signatureDate || (selectedJobForModal as any).signedAt;

                                    if (sigUrl) {
                                        return (
                                            <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Authorized Work Completion Sign-off</span>
                                                        <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                                                            Signed by: {signerName}
                                                        </h4>
                                                        <p className="text-xs text-slate-500">
                                                            📅 {signedDate ? new Date(signedDate).toLocaleString() : 'Date on record'}
                                                        </p>
                                                    </div>
                                                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Verified Sign-off
                                                    </span>
                                                </div>

                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                                                    <img
                                                        src={sigUrl}
                                                        alt="Customer Sign-off Signature"
                                                        className="max-h-28 object-contain bg-white rounded-lg p-2 border border-slate-200 shadow-sm"
                                                    />
                                                    <p className="text-[11px] text-slate-400 font-mono mt-2">
                                                        Digitally captured at job sign-off
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl shrink-0">
                                                    <FileSignature size={20} />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                            Work Order Authorization &amp; Sign-off
                                                        </h4>
                                                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                                            Pending Completion
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        The digital customer sign-off sheet will be presented on the technician's mobile tablet upon completion of the inspection/repair on-site.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-bold">Authorized On-Site Signer / POC:</span>
                                                    <span className="font-black text-slate-900 dark:text-white">{signerName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-bold">Terms of Authorization:</span>
                                                    <span className="text-slate-700 dark:text-slate-300">Standard Work Authorization &amp; Site Access Granted</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* TAB 6: WARRANTIES & COVERAGE */}
                        {modalActiveTab === 'warranties' && (
                            <div className="space-y-4">
                                {(() => {
                                    const wm = Number((selectedJobForModal.invoice as any)?.workmanshipWarrantyMonths || 0);
                                    const pm = Number((selectedJobForModal.invoice as any)?.partsWarrantyMonths || 0);
                                    const notes = (selectedJobForModal.invoice as any)?.warrantyNotes || '';
                                    const hasCoverage = wm > 0 || pm > 0;

                                    if (!hasCoverage) {
                                        return (
                                            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-2">
                                                <Shield size={24} className="mx-auto text-slate-400 dark:text-slate-500" />
                                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Active Warranty Applied</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                                    This service record does not include an active parts or labor warranty coverage package.
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                        <Shield size={12} /> Active Job Warranty Protection
                                                    </span>
                                                    <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                                        {selectedJobForModal.tasks?.join(', ') || 'Service Warranty'}
                                                    </h4>
                                                </div>
                                                <span className="text-xs font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                                                    Covered
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200/50">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Labor / Workmanship</span>
                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                        {wm} Months Protection
                                                    </span>
                                                    <p className="text-[11px] text-slate-500 mt-1">Full workmanship guarantee on all labor performed.</p>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200/50">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Replacement Parts</span>
                                                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                        {pm} Months Protection
                                                    </span>
                                                    <p className="text-[11px] text-slate-500 mt-1">Standard factory warranty on OEM components.</p>
                                                </div>
                                            </div>

                                            {notes && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-emerald-200/30">
                                                    📌 "{notes}"
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* LIGHTBOX MODAL */}
            {selectedPhotoLightbox && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 flex flex-col justify-between p-4 sm:p-6 animate-fade-in"
                    onClick={() => setSelectedPhotoLightbox(null)}
                >
                    <div className="flex justify-between items-center text-white max-w-5xl mx-auto w-full z-10">
                        <div>
                            <h4 className="text-base font-black">{selectedPhotoLightbox.title}</h4>
                            {selectedPhotoLightbox.subtitle && (
                                <p className="text-xs text-slate-300">{selectedPhotoLightbox.subtitle}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={selectedPhotoLightbox.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors"
                                title="Open in new tab"
                            >
                                <ExternalLink size={16} />
                            </a>
                            <button
                                type="button"
                                onClick={() => setSelectedPhotoLightbox(null)}
                                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div 
                        className="flex-1 flex items-center justify-center p-2 max-w-5xl mx-auto w-full max-h-[75vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={selectedPhotoLightbox.url}
                            alt={selectedPhotoLightbox.title}
                            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                        />
                    </div>

                    <div className="text-center text-xs text-slate-400 max-w-md mx-auto">
                        <span>Click anywhere outside to close this preview.</span>
                    </div>
                </div>
            )}
        </section>
    );
};

export default WorkOrdersSection;
