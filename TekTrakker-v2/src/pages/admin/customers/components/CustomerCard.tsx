
import React from 'react';
import { Customer } from '../../../../types/types';

interface CustomerCardProps {
    customer: Customer;
    onSelectCustomer: (id: string) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onSelectCustomer }) => {
    return (
        <div onClick={() => onSelectCustomer(customer.id)} className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md cursor-pointer">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {customer.name}
                {(customer as any).isNew && <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold dark:bg-blue-900 dark:text-blue-200">New Lead</span>}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{customer.email}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{customer.address}</div>
        </div>
    );
};

export default CustomerCard;
