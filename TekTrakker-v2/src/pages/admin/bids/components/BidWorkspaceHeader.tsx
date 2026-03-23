
import React from 'react';
import { ChevronLeft, FileText, BarChart2, Edit2, Bot, History } from 'lucide-react';

interface BidWorkspaceHeaderProps {
    bidTitle: string | undefined; // Allow undefined title
    activeTab: string;
    onTabChange: (tab: 'setup' | 'inputs' | 'pricing' | 'generate' | 'history') => void;
    onClose: () => void;
}

const BidWorkspaceHeader: React.FC<BidWorkspaceHeaderProps> = ({ bidTitle = "Loading Bid...", activeTab, onTabChange, onClose }) => {
    const tabs = [
        { id: 'setup', label: 'Setup', icon: Edit2 },
        { id: 'inputs', label: 'Inputs', icon: FileText },
        { id: 'pricing', label: 'Pricing', icon: BarChart2 },
        { id: 'generate', label: 'Generate', icon: Bot },
        { id: 'history', label: 'History', icon: History },
    ];

    return (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline mb-4">
                <ChevronLeft size={18} /> Back to All Bids
            </button>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white truncate">{bidTitle}</h3>
            
            <div className="mt-4 flex items-center border-b border-slate-200 dark:border-slate-700">
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BidWorkspaceHeader;
