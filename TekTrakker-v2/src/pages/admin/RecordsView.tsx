
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JobHistory from 'pages/admin/JobHistory';
import Inventory from 'pages/admin/Inventory';
import DocumentCreator from 'pages/admin/DocumentCreator';
import FormBuilder from 'pages/admin/FormBuilder';
import FleetManager from 'pages/admin/FleetManager';

const RecordsView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'inventory' | 'history' | 'documents' | 'forms' | 'fleet'>('inventory');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'fleet') setActiveTab('fleet');
        else if (tab === 'inventory') setActiveTab('inventory');
    }, [searchParams]);

    return (
        <div className="space-y-4">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Records & Assets</h2>
                <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab === 'inventory'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('fleet')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab === 'fleet'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Fleet
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab === 'documents'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab === 'forms'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Forms & Checklists
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab === 'history'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Job History
                    </button>
                </div>
            </header>

            <div className="mt-4">
                {activeTab === 'inventory' && <Inventory />}
                {activeTab === 'fleet' && <FleetManager />}
                {activeTab === 'documents' && <DocumentCreator />}
                {activeTab === 'forms' && <FormBuilder />}
                {activeTab === 'history' && <JobHistory />}
            </div>
        </div>
    );
};

export default RecordsView;
