
import React from 'react';
import { FileSearch } from '@constants';
import Button from 'components/ui/Button';
import type { Proposal } from 'types';

interface ProposalsSectionProps {
    proposals: Proposal[];
    onViewProposal: (proposal: Proposal) => void;
}

const ProposalsSection: React.FC<ProposalsSectionProps> = ({ proposals, onViewProposal }) => {
    return (
        <section>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <FileSearch className="text-purple-600" size={20} /> Proposals & Estimates
            </h3>
            <div className="space-y-3">
                {proposals.map(prop => (
                    <div key={prop.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="font-black text-slate-900 dark:text-white">{prop.selectedOption || 'Standard'} Proposal</p>
                            <p className="text-xs text-slate-500">{new Date(prop.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-black text-lg text-primary-600">${prop.total.toFixed(0)}</span>
                            {prop.status === 'Sent' ? (
                                <Button onClick={() => onViewProposal(prop)} className="px-4 py-1 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700">Review & Accept</Button>
                            ) : (
                                <span onClick={() => onViewProposal(prop)} className={`px-2 py-1 rounded-full text-[10px] font-black uppercase cursor-pointer ${prop.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {prop.status}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
                {proposals.length === 0 && <p className="text-slate-400 text-sm italic py-4">No active proposals found.</p>}
            </div>
        </section>
    );
};

export default ProposalsSection;
