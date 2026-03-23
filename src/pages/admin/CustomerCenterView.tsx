import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerManagement from 'pages/admin/CustomerManagement';
import Memberships from 'pages/admin/Memberships';

const CustomerCenterView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'customers' | 'memberships'>('customers');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'memberships') {
            setActiveTab('memberships');
        } else if (tab === 'customers') {
            setActiveTab('customers');
        }
    }, [searchParams]);

    return (
        <div className="space-y-4">
            <header className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Center</h2>
                <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'customers'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Customers
                    </button>
                    <button
                        onClick={() => setActiveTab('memberships')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'memberships'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Memberships
                    </button>
                </div>
            </header>

            <div className="mt-4">
                {activeTab === 'customers' && <CustomerManagement />}
                {activeTab === 'memberships' && <Memberships />}
            </div>
        </div>
    );
};

export default CustomerCenterView;