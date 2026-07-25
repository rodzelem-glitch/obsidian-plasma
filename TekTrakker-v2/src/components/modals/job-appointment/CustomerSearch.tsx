
import React, { useState } from 'react';
import type { Customer } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface CustomerSearchProps {
    customers: Customer[];
    onSelectCustomer: (customer: Customer) => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ customers, onSelectCustomer }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [customerTypeFilter, setCustomerTypeFilter] = useState<'All' | 'Residential' | 'Commercial'>('All');

    const filteredCustomers = customers.filter(c => {
        // Match search query
        const matchesQuery = searchQuery.trim() === '' ||
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.phone || '').includes(searchQuery);
            
        if (!matchesQuery) return false;

        // Match type filter
        if (customerTypeFilter === 'Residential') {
            return c.customerType === 'Residential';
        }
        if (customerTypeFilter === 'Commercial') {
            return c.customerType === 'Commercial' || c.customerType === 'Property Management';
        }
        return true;
    }).slice(0, 5);

    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer);
        setSearchQuery(customer.name);
        setShowSuggestions(false);
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="customer-search-input" className="block text-sm font-medium text-gray-750 dark:text-gray-300">{t("Customer")}</label>
                
                {/* Customer Type Filter Buttons */}
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setCustomerTypeFilter('All')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                            customerTypeFilter === 'All'
                                ? 'bg-indigo-650 text-white border-indigo-650 shadow-sm'
                                : 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        {t("All")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setCustomerTypeFilter('Residential')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                            customerTypeFilter === 'Residential'
                                ? 'bg-indigo-650 text-white border-indigo-650 shadow-sm'
                                : 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        {t("Residential")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setCustomerTypeFilter('Commercial')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                            customerTypeFilter === 'Commercial'
                                ? 'bg-indigo-650 text-white border-indigo-650 shadow-sm'
                                : 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        {t("Commercial")}
                    </button>
                </div>
            </div>
            
            <input 
                id="customer-search-input" 
                type="text" 
                value={searchQuery} 
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }} 
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={t("Search by name or phone...")} 
                className="w-full rounded-md border p-2 dark:bg-gray-700 dark:text-white" 
                autoComplete="off" 
                required 
            />
            
            {showSuggestions && (
                <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                            <button 
                                type="button" 
                                key={c.id} 
                                onMouseDown={() => handleSelectCustomer(c)} 
                                className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0"
                            >
                                <div className="font-bold text-sm flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        {c.name}
                                        {c.isBlacklisted && (
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-900/45 dark:text-red-200">
                                                🚫 {t("Blacklisted")}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                        c.customerType === 'Residential'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50'
                                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                                    }`}>
                                        {t(c.customerType || 'Residential')}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-500">{c.address}</div>
                            </button>
                        ))
                    ) : (
                        <div className="p-3 text-center text-xs text-gray-500">
                            {t("No matching customers found")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomerSearch;
