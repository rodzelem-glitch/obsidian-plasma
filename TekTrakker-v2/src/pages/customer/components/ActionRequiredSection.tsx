import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { ShieldCheck, FileText, ArrowRight, AlertCircle, RotateCcw } from 'lucide-react';
import type { Job, Proposal, StoredFile, BusinessDocument } from 'types';
import { isInternalExpenseFile } from 'lib/utils';

interface ActionRequiredSectionProps {
    jobs: Job[];
    proposals: Proposal[];
    documents: BusinessDocument[];
    onSignWaiver: (job: Job, file: StoredFile) => void;
    onSignProposal: (proposal: Proposal) => void;
    onSignDocument: (doc: BusinessDocument) => void;
    onAcceptWarranty: (job: Job) => void;
    onResetActionItems?: () => void;
}

const ActionRequiredSection: React.FC<ActionRequiredSectionProps> = ({ 
    jobs, proposals, documents, 
    onSignWaiver, onSignProposal, onSignDocument, onAcceptWarranty,
    onResetActionItems
}) => {
    // 1. Found pending waivers in jobs (Directly attached files, excluding internal expense docs)
    const pendingJobFiles = jobs.flatMap(job => 
        (job.files || [])
            .filter(f => {
                if (!f) return false;
                if (isInternalExpenseFile(f)) return false;
                const label = ((f.metadata as any)?.label || f.fileName || '') as string;
                const isWaiver = label.toLowerCase().includes('waiver') || f.metadata?.isActionRequired;
                const isUnsigned = f.metadata?.status !== 'Signed' && !f.metadata?.signature && !f.metadata?.signedAt;
                return isWaiver && isUnsigned;
            })
            .map(f => ({ job, file: f }))
    );

    // 2. Found pending waivers in documents collection
    const rawPendingDocs = (documents || []).filter(doc => {
        if (!doc) return false;
        const titleOrName = (doc.title || (doc as any).name || (doc as any).fileName || '').toLowerCase();
        const docType = (doc.type || '').toLowerCase();
        const isWaiver = docType === 'waiver template' || docType === 'waiver' || titleOrName.includes('waiver');
        const isUnsigned = (doc as any).status === 'Pending Signature' || !(doc as any).signature;
        return isWaiver && isUnsigned;
    });

    // Deduplicate: If a document has the exact same URL as a job file, hide the document version.
    const jobFileUrls = new Set(pendingJobFiles.map(pf => pf.file.dataUrl));
    const pendingDocs = rawPendingDocs.filter(doc => !jobFileUrls.has(doc.url));

    const pendingProposals = (proposals || []).filter(p => p.status === 'Sent' || p.status === 'sent' || p.status === 'Opened');

    // 4. Found jobs with pending warranty acceptance
    const pendingWarranties = (jobs || []).filter(job => {
        const inv = job.invoice as any;
        if (!inv) return false;
        const hasWarranty = (inv.workmanshipWarrantyMonths > 0 || inv.partsWarrantyMonths > 0);
        const isNotAgreed = !inv.warrantyDisclaimerAgreed;
        return hasWarranty && isNotAgreed;
    });

    const totalActions = pendingJobFiles.length + pendingDocs.length + pendingProposals.length + pendingWarranties.length;

    if (totalActions === 0) {
        if (onResetActionItems) {
            return (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                        <span>All 4 action items completed &amp; authorized!</span>
                    </div>
                    <button
                        type="button"
                        onClick={onResetActionItems}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-black shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                    >
                        <RotateCcw size={12} /> Reset 4 Action Items (Demo)
                    </button>
                </div>
            );
        }
        return null;
    }

    return (
        <section className="animate-in fade-in slide-in-from-top duration-500">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <AlertCircle className="text-orange-500" size={20} /> Action Required
                    <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">{totalActions}</span>
                </h3>
                {onResetActionItems && (
                    <button
                        type="button"
                        onClick={onResetActionItems}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Reset 4 action items for demonstration"
                    >
                        <RotateCcw size={12} /> Reset Items
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Waivers from Jobs */}
                {pendingJobFiles.map(({ job, file }) => (
                    <Card key={file.id} className="p-4 sm:p-5 border-2 border-orange-200 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-950/10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">Service Waiver Required</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Job: {(job.tasks || []).join(', ') || 'Service Visit'}</p>
                                    <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Legal Authorization Needed</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignWaiver(job, file)} className="bg-orange-600 hover:bg-orange-700 text-xs w-full sm:w-auto shrink-0 cursor-pointer">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}

                {/* Waivers from Documents Collection */}
                {pendingDocs.map((doc) => (
                    <Card key={doc.id} className="p-4 sm:p-5 border-2 border-orange-200 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-950/10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{doc.title || (doc as any).name || (doc as any).fileName || 'Authorization Document'}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Authorization Document</p>
                                    <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Pending Signature</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignDocument(doc)} className="bg-orange-600 hover:bg-orange-700 text-xs w-full sm:w-auto shrink-0 cursor-pointer">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}

                {pendingProposals.map((proposal) => (
                    <Card key={proposal.id} className="p-4 sm:p-5 border-2 border-primary-200 dark:border-primary-900/30 bg-primary-50/30 dark:bg-primary-950/10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex gap-3">
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">New Proposal Ready</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Amount: ${(proposal.total || 0).toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-primary-600 uppercase mt-1">Review & Approve Work</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignProposal(proposal)} className="text-xs w-full sm:w-auto shrink-0 cursor-pointer">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}

                {pendingWarranties.map((job) => (
                    <Card key={`warranty-${job.id}`} className="p-4 sm:p-5 border-2 border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">Warranty Activation Required</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Job: {(job.tasks || []).join(', ') || 'Service Visit'}</p>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Review & Agree to Terms</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onAcceptWarranty(job)} className="bg-blue-600 hover:bg-blue-700 text-xs w-full sm:w-auto shrink-0 cursor-pointer">
                                Review & Accept
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
};

export default ActionRequiredSection;
