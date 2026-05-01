
import React, { useMemo } from 'react';

import { triggerHapticSelectionChanged } from '../../lib/haptics';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    isBlock?: boolean;
    icon?: React.ReactNode; 
    error?: string;
}

const Input: React.FC<InputProps> = ({ label, className, id, value, isBlock, icon, error, onFocus, onInput, ...props }) => {
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
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {label}
                    {props.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {icon}
                    </div>
                )}
                <input 
                    id={inputId}
                    name={props.name || inputId}
                    {...(props.type !== 'file' ? { value: safeValue } : {})}
                    onInput={(e) => {
                        triggerHapticSelectionChanged();
                        if (onInput) onInput(e);
                    }}
                    onFocus={(e) => {
                        if (props.type === 'number') {
                            e.target.select();
                        }
                        if (onFocus) onFocus(e);
                    }}
                    className={`rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[40px] ${blockClass} ${icon ? 'pl-10' : ''} ${error ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20 animate-shake' : ''} ${className || ''}`} 
                    {...props} 
                />
            </div>
            {error && (
                <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400">{error}</p>
            )}
        </div>
    );
};

export default Input;
