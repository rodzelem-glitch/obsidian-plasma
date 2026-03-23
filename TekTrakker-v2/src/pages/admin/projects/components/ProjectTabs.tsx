
import React from 'react';
import { Eye, CheckSquare, DollarSign, Building, Truck, Wrench } from 'lucide-react';

interface ProjectTabsProps {
    activeTab: string;
    onTabClick: (tab: string) => void;
}

const tabs = [
    { id: 'overview', name: 'Overview', icon: Eye },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare },
    { id: 'financials', name: 'Financials', icon: DollarSign },
    { id: 'permits', name: 'Permits', icon: Building },
    { id: 'subcontractors', name: 'Subcontractors', icon: Wrench },
    { id: 'rentals', name: 'Rentals', icon: Truck }
];

const ProjectTabs: React.FC<ProjectTabsProps> = ({ activeTab, onTabClick }) => {
    return (
        <nav className="flex items-center justify-center space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabClick(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                        activeTab === tab.id
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                    <tab.icon size={16} />
                    <span>{tab.name}</span>
                </button>
            ))}
        </nav>
    );
};

export default ProjectTabs;
