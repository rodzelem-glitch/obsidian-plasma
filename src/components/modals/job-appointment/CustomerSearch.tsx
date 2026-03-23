
import React, { useState } from 'react';
import type { Customer } from '../../../types';

interface CustomerSearchProps {
    customers: Customer[];
    onSelectCustomer: (customer: Customer) => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ customers, onSelectCustomer }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredCustomers = customers.filter(c => 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.phone || '').includes(searchQuery)
    ).slice(0, 5);

    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer);
        setSearchQuery(customer.name);
        setShowSuggestions(false);
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
            <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }} placeholder="Search..." className="w-full rounded-md border p-2 dark:bg-gray-700 dark:text-white" autoComplete="off" required />
            {showSuggestions && searchQuery.length > 1 && (
                <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                        <div key={c.id} onClick={() => handleSelectCustomer(c)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0">
                            <div className="font-bold text-sm">{c.name}</div>
                            <div className="text-[10px] text-gray-500">{c.address}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomerSearch;
