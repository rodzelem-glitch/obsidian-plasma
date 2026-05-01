
import React from 'react';
import { ChevronLeft, FileText, BarChart2, Edit2, Bot, History, Briefcase } from 'lucide-react';
import Button from 'components/ui/Button';
import { Bid } from 'types';
import { Link } from 'react-router-dom';

interface BidWorkspaceHeaderProps {
    bidTitle: string | undefined; // Allow undefined title
    bid: Bid;
    isConverting?: boolean;
    onConvertToProject?: () => void;
    activeTab: string;
    onTabChange: (tab: 'setup' | 'inputs' | 'pricing' | 'generate' | 'history') => void;
    onClose: () => void;
}

const BidWorkspaceHeader: React.FC<BidWorkspaceHeaderProps> = ({ bidTitle = "Loading Bid...", bid, isConverting, onConvertToProject, activeTab, onTabChange, onClose }) => {
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white truncate">{bidTitle}</h3>
                
                {bid.status === 'Won' && (
                    bid.projectId ? (
                        <Link to={`/admin/projects/${bid.projectId}`}>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                                <Briefcase size={16} />
                                View Project
                            </Button>
                        </Link>
                    ) : onConvertToProject ? (
                        <Button 
                            onClick={onConvertToProject} 
                            disabled={isConverting}
                            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                        >
                            <Briefcase size={16} />
                            {isConverting ? 'Converting...' : 'Convert to Project'}
                        </Button>
                    ) : null
                )}
            </div>
            
            <div className="mt-4 flex items-center border-b border-slate-200 dark:border-slate-700 overflow-x-auto whitespace-nowrap hide-scrollbar pb-1">
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
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
