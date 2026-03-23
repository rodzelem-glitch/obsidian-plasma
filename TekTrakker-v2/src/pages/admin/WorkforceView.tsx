
import React, { useState } from 'react';
import EmployeeManagement from 'pages/admin/EmployeeManagement';
import EmployeeScheduling from 'pages/admin/EmployeeScheduling';
import TimeSheetReview from 'pages/admin/TimeSheetReview';
import TechTracking from 'pages/admin/TechTracking';
import TechPerformance from 'pages/admin/TechPerformance';
import SubcontractorsTab from './workforce/components/SubcontractorsTab'; // Updated import path

const WorkforceView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'roster' | 'tracking' | 'performance' | 'timesheets' | 'schedule' | 'subcontractors'>('roster');

    return (
        <div className="space-y-4">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Workforce</h2>
                <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                    {[
                        { id: 'roster', label: 'Employees' },
                        { id: 'subcontractors', label: 'Subcontractors' }, // Added Subcontractors tab
                        { id: 'tracking', label: 'GPS Tracking' },
                        { id: 'performance', label: 'Performance' },
                        { id: 'timesheets', label: 'Time Sheets' },
                        { id: 'schedule', label: 'Scheduling' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="mt-4">
                {activeTab === 'roster' && <EmployeeManagement />}
                {activeTab === 'subcontractors' && <SubcontractorsTab />}{/* Render SubcontractorsTab */}
                {activeTab === 'tracking' && <TechTracking />}
                {activeTab === 'performance' && <TechPerformance />}
                {activeTab === 'timesheets' && <TimeSheetReview />}
                {activeTab === 'schedule' && <EmployeeScheduling />}
            </div>
        </div>
    );
};

export default WorkforceView;
