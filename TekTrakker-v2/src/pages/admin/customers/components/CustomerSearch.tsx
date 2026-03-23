
import React from 'react';

interface CustomerSearchProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ searchTerm, onSearchTermChange }) => {
    return (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <input
                type="text"
                placeholder="Search by name, phone, email, or address..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="p-2 border rounded-md w-full"
            />
        </div>
    );
};

export default CustomerSearch;
