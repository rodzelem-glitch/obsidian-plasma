
import React, { useMemo } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    isBlock?: boolean;
    icon?: React.ReactNode; // Added icon prop
}

const Input: React.FC<InputProps> = ({ label, className, id, value, isBlock, icon, ...props }) => {
    const inputId = useMemo(() => {
        return id || (label 
            ? `input-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` 
            : `input-${Math.random().toString(36).substr(2, 9)}`);
    }, [id, label]);

    const safeValue = useMemo(() => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && isNaN(value)) return '';
        return value;
    }, [value]);

    const blockClass = isBlock ? 'w-full' : '';

    return (
        <div className={`mb-4 ${blockClass}`}>
            {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {icon}
                    </div>
                )}
                <input 
                    id={inputId}
                    name={props.name || inputId}
                    value={safeValue}
                    className={`rounded-md border-2 border-slate-300 dark:border-slate-500 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-500 dark:placeholder:text-slate-400 ${blockClass} ${icon ? 'pl-10' : ''} ${className || ''}`} 
                    {...props} 
                />
            </div>
        </div>
    );
};

export default Input;
