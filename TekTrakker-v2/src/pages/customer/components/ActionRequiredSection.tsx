import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { ShieldCheck, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import type { Job, Proposal, StoredFile, BusinessDocument } from 'types';

interface ActionRequiredSectionProps {
    jobs: Job[];
    proposals: Proposal[];
    documents: BusinessDocument[];
    onSignWaiver: (job: Job, file: StoredFile) => void;
    onSignProposal: (proposal: Proposal) => void;
    onSignDocument: (doc: BusinessDocument) => void;
}

const ActionRequiredSection: React.FC<ActionRequiredSectionProps> = ({ jobs, proposals, documents, onSignWaiver, onSignProposal, onSignDocument }) => {
    // 1. Found pending waivers in jobs (Directly attached files)
    const pendingJobFiles = jobs.flatMap(job => 
        (job.files || [])
            .filter(f => {
                const isWaiver = f.metadata?.label?.toLowerCase().includes('waiver') || f.metadata?.isActionRequired;
                const isUnsigned = f.metadata?.status !== 'Signed' && !f.metadata?.signature && !f.metadata?.signedAt;
                return isWaiver && isUnsigned;
            })
            .map(f => ({ job, file: f }))
    );

    // 2. Found pending waivers in documents collection
    const rawPendingDocs = documents.filter(doc => 
        (doc.type === 'Waiver Template' || doc.title.toLowerCase().includes('waiver')) && 
        ((doc as any).status === 'Pending Signature' || !(doc as any).signature)
    );

    // Deduplicate: If a document has the exact same URL as a job file, hide the document version.
    const jobFileUrls = new Set(pendingJobFiles.map(pf => pf.file.dataUrl));
    const pendingDocs = rawPendingDocs.filter(doc => !jobFileUrls.has(doc.url));

    const pendingProposals = proposals.filter(p => p.status === 'Sent' || p.status === 'sent');

    const totalActions = pendingJobFiles.length + pendingDocs.length + pendingProposals.length;


    if (totalActions === 0) return null;

    return (
        <section className="animate-in fade-in slide-in-from-top duration-500">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle className="text-orange-500" size={20} /> Action Required
                <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{totalActions}</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Waivers from Jobs */}
                {pendingJobFiles.map(({ job, file }) => (
                    <Card key={file.id} className="p-5 border-2 border-orange-200 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-950/10">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">Service Waiver Required</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Job: {job.tasks.join(', ')}</p>
                                    <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Legal Authorization Needed</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignWaiver(job, file)} className="bg-orange-600 hover:bg-orange-700 text-xs">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}

                {/* Waivers from Documents Collection */}
                {pendingDocs.map((doc) => (
                    <Card key={doc.id} className="p-5 border-2 border-orange-200 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-950/10">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{doc.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Authorization Document</p>
                                    <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Pending Signature</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignDocument(doc)} className="bg-orange-600 hover:bg-orange-700 text-xs">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}

                {pendingProposals.map((proposal) => (
                    <Card key={proposal.id} className="p-5 border-2 border-primary-200 dark:border-primary-900/30 bg-primary-50/30 dark:bg-primary-950/10">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">New Proposal Ready</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Amount: ${proposal.total?.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-primary-600 uppercase mt-1">Review & Approve Work</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onSignProposal(proposal)} className="text-xs">
                                Review & Sign
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
};

export default ActionRequiredSection;
