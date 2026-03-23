
import React, { useMemo } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}

const Select: React.FC<SelectProps> = ({ label, className, children, id, ...props }) => {
    const selectId = useMemo(() => {
        return id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` : undefined);
    }, [id, label]);

    return (
        <div className="mb-2">
            {label && <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <select 
                id={selectId}
                name={props.name || selectId}
                className={`w-full rounded-md border-2 border-slate-300 dark:border-slate-500 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className || ''}`} 
                {...props}
            >
                {children}
            </select>
        </div>
    );
};

export default Select;
