import React from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { Proposal } from 'types';
import { AlertTriangle, CheckCircle, XCircle, Split, FileText } from 'lucide-react';

interface MultipleProposalsModalProps {
    isOpen: boolean;
    onClose: () => void;
    acceptedProposal: Proposal;
    pendingProposals: Proposal[];
    onDeclinePendingProposals: () => void;
    onKeepAsSeparateJob: () => void;
}

export const getPendingCompetingProposals = (acceptedProposal: Proposal, allProposals: Proposal[]): Proposal[] => {
    if (!acceptedProposal || !allProposals) return [];
    
    // Find all other proposals matching the same jobId or customerId & PO number
    const otherProposals = allProposals.filter(p => {
        if (p.id === acceptedProposal.id) return false;
        
        // Match by exact jobId
        if (acceptedProposal.jobId && p.jobId && p.jobId === acceptedProposal.jobId) {
            return true;
        }
        // Match by customerId AND PO / Work Order number
        if (acceptedProposal.customerId && p.customerId && p.customerId === acceptedProposal.customerId) {
            if (acceptedProposal.poNumber && p.poNumber && acceptedProposal.poNumber.trim().toLowerCase() === p.poNumber.trim().toLowerCase()) {
                return true;
            }
        }
        return false;
    });

    // Check if any other proposal was ALREADY approved prior to this acceptance
    const alreadyApproved = otherProposals.filter(p => p.status === 'Accepted' || p.status === 'Approved');

    // If a proposal was already approved previously, this new approval is a separate approved job scope, so do not prompt.
    if (alreadyApproved.length > 0) {
        return [];
    }

    // Return pending proposals (Draft, Sent, Opened, Pending Approval)
    return otherProposals.filter(p => 
        p.status === 'Draft' || 
        p.status === 'Sent' || 
        p.status === 'Opened' || 
        p.status === 'Pending Approval'
    );
};

const MultipleProposalsModal: React.FC<MultipleProposalsModalProps> = ({
    isOpen,
    onClose,
    acceptedProposal,
    pendingProposals,
    onDeclinePendingProposals,
    onKeepAsSeparateJob
}) => {
    if (!isOpen || !acceptedProposal || pendingProposals.length === 0) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Multiple Proposals Detected for Job"
            size="lg"
        >
            <div className="space-y-5 p-2">
                {/* Warning Alert Banner */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={22} />
                    <div className="space-y-1 text-xs">
                        <p className="font-extrabold text-sm">Action Needed: Pending Proposals Found</p>
                        <p className="leading-relaxed">
                            Proposal <strong className="font-mono text-amber-950 dark:text-amber-100">"{acceptedProposal.title || acceptedProposal.id}"</strong> (${(acceptedProposal.total || 0).toFixed(2)}) has just been accepted. 
                            There are <strong>{pendingProposals.length}</strong> other pending proposal(s) tied to this job/customer scope.
                        </p>
                    </div>
                </div>

                {/* Accepted Proposal Summary */}
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                            <span className="font-extrabold text-emerald-950 dark:text-emerald-100">Accepted Proposal:</span>{' '}
                            <span className="font-medium text-slate-800 dark:text-slate-200">{acceptedProposal.title || acceptedProposal.id}</span>
                        </div>
                    </div>
                    <span className="font-black font-mono text-emerald-700 dark:text-emerald-300 text-sm">
                        ${(acceptedProposal.total || 0).toFixed(2)}
                    </span>
                </div>

                {/* List of Pending Proposals */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Other Pending Proposal(s) Linked to this Job:
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {pendingProposals.map(prop => (
                            <div key={prop.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-slate-400" />
                                    <div>
                                        <span className="font-bold text-slate-900 dark:text-white">{prop.title || prop.id}</span>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                            <span>Status: <strong className="uppercase text-amber-600 dark:text-amber-400">{prop.status}</strong></span>
                                            {prop.poNumber && <span>PO/WO: #{prop.poNumber}</span>}
                                        </div>
                                    </div>
                                </div>
                                <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                                    ${(prop.total || 0).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Question & Action Options */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        How would you like to handle the other pending proposal(s)?
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={onDeclinePendingProposals}
                            className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/40 text-left transition-all group outline-none"
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                                <span className="font-extrabold text-xs text-red-950 dark:text-red-100">
                                    Decline Pending Proposal(s)
                                </span>
                            </div>
                            <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
                                Mark the other pending estimate(s) as <strong>Declined</strong>. Select this if they were alternative choices for the same job.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={onKeepAsSeparateJob}
                            className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 text-left transition-all group outline-none"
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <Split size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-extrabold text-xs text-blue-950 dark:text-blue-100">
                                    Keep Active as Separate Job
                                </span>
                            </div>
                            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                                Keep the other proposal(s) active in <strong>{pendingProposals[0]?.status || 'Draft'}</strong> status as a separate job or additional scope.
                            </p>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose} className="text-xs">
                        Dismiss
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MultipleProposalsModal;
