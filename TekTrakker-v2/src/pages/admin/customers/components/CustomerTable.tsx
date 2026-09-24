
import React from 'react';
import { Customer } from '../../../../types/types';
import { useLanguage } from '../../../../context/LanguageContext';
import { formatAddress } from 'lib/utils';

interface CustomerTableProps {
    customers: Customer[];
    onSelectCustomer: (id: string) => void;
    searchTerm: string;
}

const CustomerTable: React.FC<CustomerTableProps> = ({ customers, onSelectCustomer, searchTerm }) => {
    const { t } = useLanguage();
    return (
        <div className="hidden md:block overflow-y-auto max-h-[calc(100vh-220px)] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <table className="min-w-full border-separate border-spacing-0 divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-xs border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th scope="col" className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("Name")}
                        </th>
                        <th scope="col" className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("Contact")}
                        </th>
                        <th scope="col" className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("Address")}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                    {customers.map((customer) => (
                        <tr key={customer.id} onClick={() => onSelectCustomer(customer.id)} className="hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                    <span>{customer.name}</span>
                                    {customer.customerType && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                            customer.customerType === 'Residential'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50'
                                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                                        }`}>
                                            {t(customer.customerType)}
                                        </span>
                                    )}
                                    {(customer as any).isNew && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold dark:bg-blue-900 dark:text-blue-200">{t("New Lead")}</span>}
                                    {customer.isBlacklisted && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold dark:bg-red-900 dark:text-red-200">{t("Blacklisted")}</span>}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {customer.phone || customer.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {formatAddress(customer.address)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CustomerTable;
