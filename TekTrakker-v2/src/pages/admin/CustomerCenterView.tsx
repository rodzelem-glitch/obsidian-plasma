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
            <header className="flex flex-wrap items-center gap-3 mb-2">
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors border ${
                        activeTab === 'customers'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    Customers
                </button>
                <button
                    onClick={() => setActiveTab('memberships')}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors border ${
                        activeTab === 'memberships'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    Memberships
                </button>
            </header>

            <div className="mt-4">
                {activeTab === 'customers' && <CustomerManagement />}
                {activeTab === 'memberships' && <Memberships />}
            </div>
        </div>
    );
};

export default CustomerCenterView;
