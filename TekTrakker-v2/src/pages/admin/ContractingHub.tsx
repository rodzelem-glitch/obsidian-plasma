import React, { useState } from 'react';
import ContractorNetwork from './ContractorNetwork';
import GovContracts from '../marketplace/GovContracts';
import { Building2, Users } from 'lucide-react';

const ContractingHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'internal' | 'government'>('internal');

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Tabs Navigation */}
            <div className="flex justify-center border-b border-slate-200 dark:border-slate-700/80 mb-6">
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
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {activeTab === 'internal' ? <ContractorNetwork /> : <GovContracts />}
            </div>
        </div>
    );
};

export default ContractingHub;
