import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import { Image, FileText, Download, Eye, FileCheck2, Receipt, Shield, Scroll, Building, Award, ChevronDown, ExternalLink } from 'lucide-react';
import type { Job, Proposal, Customer } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import { isInternalExpenseFile } from 'lib/utils';
import { detectFileType } from 'lib/fileViewerHelper';

interface PhotosDocumentsSectionProps {
    jobs: Job[];
    proposals: Proposal[];
    customer?: Customer | null;
    onViewProposal?: (p: Proposal) => void;
}

type DocCategory = 'all' | 'photos' | 'invoices' | 'proposals' | 'waivers' | 'receipts' | 'certificates';

const categoryConfig: Record<DocCategory, { label: string; icon: React.ReactNode; color: string }> = {
    all:          { label: 'All', icon: <FileText size={14} />, color: 'slate' },
    photos:       { label: 'Photos', icon: <Image size={14} />, color: 'blue' },
    invoices:     { label: 'Invoices', icon: <Receipt size={14} />, color: 'emerald' },
    proposals:    { label: 'Proposals', icon: <Scroll size={14} />, color: 'indigo' },
    waivers:      { label: 'Waivers', icon: <Shield size={14} />, color: 'purple' },
    receipts:     { label: 'Receipts', icon: <FileCheck2 size={14} />, color: 'amber' },
    certificates: { label: 'Tax & Company', icon: <Building size={14} />, color: 'teal' },
};

interface DocItem {
    id: string;
    title: string;
    category: Exclude<DocCategory, 'all'>;
    date: string;
    dataUrl?: string;
    url?: string;
    status?: string;
    jobName?: string;
    job?: Job; // For invoice/receipt preview via DocumentPreview
}

const PhotosDocumentsSection: React.FC<PhotosDocumentsSectionProps> = ({ jobs, proposals, customer, onViewProposal }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeCategory, setActiveCategory] = useState<DocCategory>('all');
    const [previewItem, setPreviewItem] = useState<DocItem | null>(null);

    const allDocs = useMemo<DocItem[]>(() => {
        const items: DocItem[] = [];

        // Customer Company Documents (Tax Exemption Certificates, COI, W-9, etc.)
        if (customer) {
            const custDocs = (customer as any).documents || (customer as any).companyDocuments || (customer as any).files || [];
            custDocs.forEach((doc: any, idx: number) => {
                items.push({
                    id: doc.id || `cust-doc-${idx}`,
                    title: doc.name || doc.title || doc.fileName || 'Company Document',
                    category: 'certificates',
                    date: doc.uploadedAt || doc.createdAt || new Date().toISOString(),
                    dataUrl: doc.url || doc.dataUrl,
                    url: doc.url || doc.dataUrl,
                    status: doc.type || doc.category || 'Uploaded Certificate',
                    jobName: customer.name,
                });
            });
        }

        jobs.forEach(job => {
            const jobLabel = job.customerName || `Service on ${new Date(job.appointmentTime).toLocaleDateString()}`;

            // Photos from job files (strictly excluding internal expense / vendor files)
            (job.files || [])
                .filter(file => !isInternalExpenseFile(file))
                .forEach(file => {
                    const ft = (file as any).fileType || '';
                    const fn = (file as any).fileName || '';
                    if (ft.startsWith('image/') || fn.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        items.push({
                            id: `photo-${file.id}`,
                            title: (file as any).label || fn || 'Job Photo',
                            category: 'photos',
                            date: (file as any).createdAt || job.appointmentTime,
                            dataUrl: (file as any).dataUrl || (file as any).url,
                            jobName: jobLabel,
                        });
                    }
                });

            // Non-photo documents from job files (strictly excluding internal expense / vendor files)
            (job.files || [])
                .filter(file => !isInternalExpenseFile(file))
                .forEach(file => {
                    const ft = (file as any).fileType || '';
                    const fn = (file as any).fileName || '';
                    if (!ft.startsWith('image/') && !fn.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        const isWaiver = fn.toLowerCase().includes('waiver') || fn.toLowerCase().includes('signed');
                        items.push({
                            id: `doc-${file.id}`,
                            title: (file as any).label || fn || 'Document',
                            category: isWaiver ? 'waivers' : 'receipts',
                            date: (file as any).createdAt || job.appointmentTime,
                            dataUrl: (file as any).dataUrl || (file as any).url,
                            status: (file as any).metadata?.status,
                            jobName: jobLabel,
                        });
                    }
                });

            // Invoice
            if (job.invoice && job.invoice.status && (job.invoice.status === 'Paid' || job.invoice.sentAt)) {
                items.push({
                    id: `inv-${job.id}`,
                    title: `Invoice #${job.invoice.id || job.id.slice(-6).toUpperCase()}`,
                    category: 'invoices',
                    date: job.appointmentTime,
                    status: job.invoice.status,
                    jobName: jobLabel,
                    job,
                });

                // Receipt — only for paid invoices
                if (job.invoice.status === 'Paid') {
                    items.push({
                        id: `rcpt-${job.id}`,
                        title: `Receipt — ${job.invoice.id || job.id.slice(-6).toUpperCase()}`,
                        category: 'receipts',
                        date: (job.invoice as any).paidDate || job.appointmentTime,
                        status: 'Paid',
                        jobName: jobLabel,
                        job,
                    });
                }
            }
        });

        // Proposals
        proposals.forEach(p => {
            items.push({
                id: `prop-${p.id}`,
                title: `Proposal — ${(p as any).projectName || p.customerName || 'Service Proposal'}`,
                category: 'proposals',
                date: p.createdAt || new Date().toISOString(),
                dataUrl: (p as any).signatureDataUrl ? undefined : undefined,
                url: `/proposal-view/${p.id}`,
                status: p.status,
            });
        });

        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [jobs, proposals, customer]);

    const filteredDocs = useMemo(() =>
        activeCategory === 'all' ? allDocs : allDocs.filter(d => d.category === activeCategory),
        [allDocs, activeCategory]
    );

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: allDocs.length };
        allDocs.forEach(d => { c[d.category] = (c[d.category] || 0) + 1; });
        return c;
    }, [allDocs]);

    const [invoicePreviewJob, setInvoicePreviewJob] = useState<Job | null>(null);

    const handleOpen = (item: DocItem) => {
        if (item.category === 'invoices' || item.category === 'receipts') {
            if (item.job) {
                setInvoicePreviewJob(item.job);
                return;
            }
        }
        if (item.category === 'proposals') {
            const prop = proposals.find(p => `prop-${p.id}` === item.id);
            if (prop && onViewProposal) {
                onViewProposal(prop);
                return;
            }
        }
        if (item.dataUrl || item.url) {
            setPreviewItem(item);
        }
    };

    const getBadgeColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'paid':
            case 'approved':
            case 'signed':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'sent':
            case 'draft':
            case 'pending':
            case 'pending signature':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default:
                return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    return (
        <section className="space-y-4">
            <div 
                onClick={() => setIsCollapsed(prev => !prev)}
                className="flex items-center justify-between cursor-pointer group select-none bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary-400 transition-all"
            >
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <FileText className="text-primary-600" size={20} />
                    <span>Photos & Documents</span>
                    <span className="bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full font-bold">
                        {allDocs.length}
                    </span>
                </h3>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-primary-600 transition-colors">
                    <span>{isCollapsed ? 'Show Documents' : 'Collapse'}</span>
                    <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                </div>
            </div>

            {!isCollapsed && (
                <>
                    {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {Object.entries(categoryConfig).map(([key, cfg]) => {
                    const count = counts[key] || 0;
                    if (key !== 'all' && count === 0) return null;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveCategory(key as DocCategory)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                                activeCategory === key
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary-300'
                            }`}
                        >
                            {cfg.icon} {cfg.label}
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${activeCategory === key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Photos Grid */}
            {(activeCategory === 'all' || activeCategory === 'photos') && allDocs.filter(d => d.category === 'photos').length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {allDocs.filter(d => d.category === 'photos').map(item => (
                        <button
                            key={item.id}
                            onClick={() => setPreviewItem(item)}
                            className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:shadow-md transition-all group relative"
                        >
                            {item.dataUrl ? (
                                <img src={item.dataUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={item.title} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><Image size={24} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Eye size={20} className="text-white drop-shadow" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Documents List */}
            <div className="space-y-2">
                {filteredDocs.filter(d => d.category !== 'photos').map(item => {
                    const cfg = categoryConfig[item.category];
                    const colorMap: Record<string, string> = {
                        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 border-emerald-100 dark:border-emerald-900',
                        indigo: 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 border-indigo-100 dark:border-indigo-900',
                        purple: 'bg-purple-50 dark:bg-purple-900/10 text-purple-600 border-purple-100 dark:border-purple-900',
                        amber: 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 border-amber-100 dark:border-amber-900',
                        slate: 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700',
                        blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 border-blue-100 dark:border-blue-900',
                        teal: 'bg-teal-50 dark:bg-teal-900/10 text-teal-600 border-teal-100 dark:border-teal-900',
                    };
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleOpen(item)}
                            className="w-full text-left bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 hover:border-primary-300 hover:shadow-sm transition-all group"
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${colorMap[cfg.color] || colorMap.slate}`}>
                                {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{item.title}</p>
                                <p className="text-[10px] text-slate-400">{item.jobName && `${item.jobName} • `}{new Date(item.date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {item.status && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${getBadgeColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                )}
                                <Eye size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                            </div>
                        </button>
                    );
                })}
            </div>

            {filteredDocs.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 font-bold italic">
                    No {activeCategory === 'all' ? '' : activeCategory} yet.
                </div>
            )}
                </>
            )}

            {/* Document / Image Modal Preview */}
            {previewItem && (
                <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 className="font-black text-slate-900 dark:text-white">{previewItem.title}</h4>
                                <p className="text-xs text-slate-400">{new Date(previewItem.date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {(previewItem.dataUrl || previewItem.url) && (
                                    <a
                                        href={previewItem.dataUrl || previewItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={previewItem.title}
                                        className="p-2 text-slate-400 hover:text-primary-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        title="Open / Download"
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                )}
                                <button
                                    onClick={() => setPreviewItem(null)}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-black text-lg px-2"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950 min-h-[400px]">
                            {(() => {
                                const fileSrc = previewItem.dataUrl || previewItem.url || '';
                                const fileInfo = detectFileType(fileSrc, previewItem.title, previewItem.category === 'photos' ? 'image/jpeg' : undefined);

                                if (fileInfo.isImage || previewItem.category === 'photos') {
                                    return <img src={fileSrc} alt={previewItem.title} className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-md" />;
                                }
                                if (fileInfo.isHtml) {
                                    return (
                                        <iframe
                                            srcDoc={fileSrc.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(fileSrc.split('base64,')[1]))) : undefined}
                                            src={!fileSrc.startsWith('data:text/html;base64,') ? fileSrc : undefined}
                                            className="w-full h-[60vh] border-0 rounded-xl bg-white"
                                            title={previewItem.title}
                                        />
                                    );
                                }
                                if (fileInfo.isPdf) {
                                    return (
                                        <iframe
                                            src={fileSrc}
                                            className="w-full h-[60vh] border-0 rounded-xl bg-white"
                                            title={previewItem.title}
                                        />
                                    );
                                }
                                if (fileInfo.googleDocsViewerUrl) {
                                    return (
                                        <iframe
                                            src={fileInfo.googleDocsViewerUrl}
                                            className="w-full h-[60vh] border-0 rounded-xl bg-white"
                                            title={previewItem.title}
                                        />
                                    );
                                }
                                return (
                                    <div className="text-center space-y-4">
                                        <FileText size={48} className="text-primary-500 mx-auto" />
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{previewItem.title}</p>
                                        {fileSrc && (
                                            <a
                                                href={fileSrc}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-2xl text-xs font-black hover:bg-primary-700 transition-colors"
                                            >
                                                <Download size={14} /> Open / Download File
                                            </a>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice & Receipt Preview via DocumentPreview */}
            {invoicePreviewJob && (
                <DocumentPreview
                    type="Invoice"
                    data={invoicePreviewJob}
                    onClose={() => setInvoicePreviewJob(null)}
                    isModal={true}
                />
            )}
        </section>
    );
};

export default PhotosDocumentsSection;
