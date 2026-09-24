import React, { useState } from 'react';
import ContractorNetwork from './ContractorNetwork';
import GovContracts from '../marketplace/GovContracts';
import { Building2, Users, Briefcase } from 'lucide-react';
import { CommercialReferenceModal } from '../../components/modals/CommercialReferenceModal';

const ContractingHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'internal' | 'government'>('internal');
    const [isCommercialRefModalOpen, setIsCommercialRefModalOpen] = useState(false);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <CommercialReferenceModal
                isOpen={isCommercialRefModalOpen}
                onClose={() => setIsCommercialRefModalOpen(false)}
            />

            {/* Tabs Navigation & References Button */}
            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700/80 pb-2 sm:pb-0 mb-6 gap-3">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('internal')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'internal'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'}
                        `}
                    >
                        <Users size={18} />
                        B2B Contractor Network
                    </button>
                    <button
                        onClick={() => setActiveTab('government')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'government'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'}
                        `}
                    >
                        <Building2 size={18} />
                        Federal Contracts (SAM.gov)
                    </button>
                </nav>

                <button
                    type="button"
                    onClick={() => setIsCommercialRefModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600/50 shadow-sm transition-all cursor-pointer"
                    title="View & Export Commercial References"
                >
                    <Briefcase size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Commercial References</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {activeTab === 'internal' ? <ContractorNetwork /> : <GovContracts />}
            </div>
        </div>
    );
};

export default ContractingHub;
