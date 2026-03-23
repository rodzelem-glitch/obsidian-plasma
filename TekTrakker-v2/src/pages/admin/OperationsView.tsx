
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DispatchBoard from 'pages/admin/DispatchBoard';
import JobScheduling from 'pages/admin/JobScheduling';
import Button from 'components/ui/Button';
import JobAppointmentModal from 'components/modals/JobAppointmentModal';
import { Calendar, List } from 'lucide-react';

const OperationsView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'dispatch' | 'jobs'>('dispatch');
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'jobs') {
            setActiveTab('jobs');
        } else if (tab === 'dispatch') {
            setActiveTab('dispatch');
        }
    }, [searchParams]);

    return (
        <div className="space-y-4">
            <JobAppointmentModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
            
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Operations</h2>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <Button onClick={() => setIsBookingOpen(true)} className="flex-1 md:flex-none shadow-md justify-center">
                        + Book
                    </Button>
                    <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex-1 md:flex-none overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('dispatch')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                activeTab === 'dispatch'
                                    ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Calendar size={16}/> <span className="hidden sm:inline">Dispatch Board</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                activeTab === 'jobs'
                                    ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <List size={16}/> <span className="hidden sm:inline">Job List</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="mt-4">
                {activeTab === 'dispatch' && <DispatchBoard />}
                {activeTab === 'jobs' && <JobScheduling />}
            </div>
        </div>
    );
};

export default OperationsView;
