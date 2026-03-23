
import React from 'react';
import { Filter } from 'lucide-react';
import Toggle from 'components/ui/Toggle';

interface DashboardHeaderProps {
    excludeTest: boolean;
    setExcludeTest: (value: boolean) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ excludeTest, setExcludeTest }) => {
    return (
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Overview</h2>
                <p className="text-gray-600 dark:text-gray-400">SaaS Health & Global Metrics</p>
            </div>
            <div className="flex gap-4 items-center">
                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <Filter size={14} className="text-gray-400"/>
                    <Toggle label="Exclude Test Data" enabled={excludeTest} onChange={setExcludeTest} />
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
