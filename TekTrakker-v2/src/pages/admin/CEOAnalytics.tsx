
import React, { useState } from 'react';
import MarketingROI from './MarketingROI';
import AdminDashboard from './AdminDashboard';

const CEOAnalytics: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'marketing' | 'financial_overview'>('marketing');

    return (
        <div className="space-y-4">
            <header className="mb-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">CEO Analytics</h2>
                <p className="text-gray-600 dark:text-gray-400">High-level insights and ROI tracking.</p>
            </header>

            <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                <button
                    onClick={() => setActiveTab('marketing')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'marketing'
                            ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Marketing ROI
                </button>
                <button
                    onClick={() => setActiveTab('financial_overview')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'financial_overview'
                            ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Business Health (Dashboard)
                </button>
            </div>

            <div className="mt-4">
                {activeTab === 'marketing' && <MarketingROI />}
                {activeTab === 'financial_overview' && <AdminDashboard />}
            </div>
        </div>
    );
};

export default CEOAnalytics;
