
import React from 'react';
import { Customer } from '../../../../types/types';
import { useLanguage } from '../../../../context/LanguageContext';
import { formatAddress } from 'lib/utils';

interface CustomerCardProps {
    customer: Customer;
    onSelectCustomer: (id: string) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onSelectCustomer }) => {
    const { t } = useLanguage();
    return (
        <div onClick={() => onSelectCustomer(customer.id)} className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md cursor-pointer">
            <div className="text-lg font-semibold text-gray-900 dark:text-white flex items-center flex-wrap gap-2">
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
            <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{customer.email}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{formatAddress(customer.address)}</div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onSelectCustomer(customer.id)}
                    className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                    {t("View Master File")}
                </button>
                <div className="flex items-center gap-2">
                    {customer.phone && (
                        <a
                            href={`tel:${customer.phone}`}
                            className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                            {t("Call")}
                        </a>
                    )}
                    {customer.email && (
                        <a
                            href={`mailto:${customer.email}`}
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            {t("Email")}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerCard;
