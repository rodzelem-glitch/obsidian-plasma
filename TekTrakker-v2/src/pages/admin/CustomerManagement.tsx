
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import CustomerMasterModal from 'components/modals/CustomerMasterModal';
import { PlusCircle } from 'lucide-react';
import QuickAddCustomer from './customers/components/QuickAddCustomer';
import CustomerSearch from './customers/components/CustomerSearch';
import CustomerTable from './customers/components/CustomerTable';
import CustomerCard from './customers/components/CustomerCard';

const CustomerManagement: React.FC = () => {
    const { state } = useAppContext();
    const [searchParams] = useSearchParams();
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    useEffect(() => {
        const custId = searchParams.get('custId');
        if (custId) {
            setSelectedCustomerId(custId);
        }
    }, [searchParams]);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date_desc');
    const [page, setPage] = useState(1);
    const itemsPerPage = 20;

    const filteredCustomers = state.customers.filter(c => 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone || '').includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        switch (sortBy) {
            case 'name_asc':
                return (a.name || '').localeCompare(b.name || '');
            case 'name_desc':
                return (b.name || '').localeCompare(a.name || '');
            case 'date_asc':
                return new Date((a as any).createdAt || 0).getTime() - new Date((b as any).createdAt || 0).getTime();
            case 'date_desc':
            default:
                return new Date((b as any).createdAt || 0).getTime() - new Date((a as any).createdAt || 0).getTime();
        }
    });

    const paginatedCustomers = filteredCustomers.slice(0, page * itemsPerPage);
    const hasMore = paginatedCustomers.length < filteredCustomers.length;

    const handleCustomerCreated = (customerId: string) => {
        setIsCreating(false);
        setSelectedCustomerId(customerId);
    };

    const handleSearchTermChange = (term: string) => {
        setSearchTerm(term);
        setPage(1);
    }

    return (
        <div className="space-y-6">
            {selectedCustomerId && (
                <CustomerMasterModal 
                    isOpen={true} 
                    onClose={() => setSelectedCustomerId(null)} 
                    customerId={selectedCustomerId} 
                />
            )}

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Database</h2>
                    <p className="text-gray-600 dark:text-gray-400">View and manage client profiles.</p>
                </div>
                <Button onClick={() => setIsCreating(!isCreating)} className="w-auto flex items-center gap-2">
                    <PlusCircle size={18} /> Quick Add
                </Button>
            </header>

            {isCreating && <QuickAddCustomer onCustomerCreated={handleCustomerCreated} />}

            <CustomerSearch searchTerm={searchTerm} onSearchTermChange={handleSearchTermChange} />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 px-2 gap-2">
                <span className="text-xs text-gray-500">Showing {paginatedCustomers.length} of {filteredCustomers.length} results</span>
                <div className="flex items-center gap-2 text-sm">
                    <label className="font-medium text-slate-600 dark:text-slate-300">Sort by:</label>
                    <select 
                        aria-label="Sort Customers"
                        className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="name_asc">Name (A-Z)</option>
                        <option value="name_desc">Name (Z-A)</option>
                    </select>
                </div>
            </div>

            <CustomerTable customers={paginatedCustomers} onSelectCustomer={setSelectedCustomerId} searchTerm={searchTerm} />

            <div className="md:hidden space-y-3">
                {paginatedCustomers.map(cust => (
                    <CustomerCard key={cust.id} customer={cust} onSelectCustomer={setSelectedCustomerId} />
                ))}
            </div>
            
            {hasMore && (
                <div className="p-4 text-center">
                    <button onClick={() => setPage(p => p + 1)} className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium">
                        Load More Results
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomerManagement;
