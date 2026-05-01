
import React from 'react';
import Select from 'components/ui/Select';
import Input from 'components/ui/Input';
import { LayoutGrid, LayoutList, Search } from 'lucide-react';

interface ApplicantHeaderProps {
    viewMode: 'board' | 'list';
    setViewMode: (mode: 'board' | 'list') => void;
    search: string;
    setSearch: (search: string) => void;
    positionFilter: string;
    setPositionFilter: (filter: string) => void;
    availablePositions: string[];
    orgId: string | undefined;
    isDemoMode: boolean;
}

const ApplicantHeader: React.FC<ApplicantHeaderProps> = ({ 
    viewMode, setViewMode, search, setSearch, positionFilter, setPositionFilter, availablePositions, orgId, isDemoMode 
}) => {
    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                
                <div className="flex items-center gap-2">
                    <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button title="Board View" aria-label="Board View" onClick={() => setViewMode('board')} className={`p-2 rounded ${viewMode === 'board' ? 'bg-white dark:bg-gray-600 shadow' : 'text-gray-500'}`}><LayoutGrid size={18}/></button>
                        <button title="List View" aria-label="List View" onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : 'text-gray-500'}`}><LayoutList size={18}/></button>
                    </div>
                </div>
            </header>

            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <Input 
                        placeholder="Search candidates by name..."
                        className="pl-10"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Select value={positionFilter} onChange={e => setPositionFilter(e.target.value)} className="w-56 mb-0">
                    <option value="All">All Positions</option>
                    {availablePositions.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                    ))}
                </Select>
            </div>
        </>
    );
};

export default ApplicantHeader;
