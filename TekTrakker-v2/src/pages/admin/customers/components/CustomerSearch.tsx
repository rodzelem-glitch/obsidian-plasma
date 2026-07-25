
import React from 'react';
import { useLanguage } from '../../../../context/LanguageContext';

interface CustomerSearchProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    customerTypeFilter: 'All' | 'Residential' | 'Commercial';
    onCustomerTypeFilterChange: (type: 'All' | 'Residential' | 'Commercial') => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ 
    searchTerm, 
    onSearchTermChange,
    customerTypeFilter,
    onCustomerTypeFilterChange
}) => {
    const { t } = useLanguage();
    return (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex-1">
                <input
                    type="text"
                    placeholder={t("Search by name, phone, email, or address...")}
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    className="p-2 border rounded-md w-full dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
            
            {/* Customer Type Filter Buttons */}
            <div className="flex gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => onCustomerTypeFilterChange('All')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                        customerTypeFilter === 'All'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    {t("All")}
                </button>
                <button
                    type="button"
                    onClick={() => onCustomerTypeFilterChange('Residential')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                        customerTypeFilter === 'Residential'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    {t("Residential")}
                </button>
                <button
                    type="button"
                    onClick={() => onCustomerTypeFilterChange('Commercial')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                        customerTypeFilter === 'Commercial'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    {t("Commercial")}
                </button>
            </div>
        </div>
    );
};

export default CustomerSearch;
