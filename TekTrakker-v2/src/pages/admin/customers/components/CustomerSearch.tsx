
import React from 'react';
import { useLanguage } from '../../../../context/LanguageContext';

interface CustomerSearchProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ searchTerm, onSearchTermChange }) => {
    const { t } = useLanguage();
    return (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <input
                type="text"
                placeholder={t("Search by name, phone, email, or address...")}
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="p-2 border rounded-md w-full"
            />
        </div>
    );
};

export default CustomerSearch;
