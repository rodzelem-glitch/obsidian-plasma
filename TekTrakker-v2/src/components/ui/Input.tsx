
import React, { useMemo, useState, useEffect } from 'react';

import { triggerHapticSelectionChanged } from '../../lib/haptics';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    isBlock?: boolean;
    icon?: React.ReactNode; 
    error?: string;
    bare?: boolean;
}

export const Input: React.FC<InputProps> = ({ 
    label, 
    className, 
    id, 
    value, 
    isBlock = true, 
    icon, 
    error, 
    bare = false,
    onFocus, 
    onBlur,
    onChange,
    onInput, 
    ...props 
}) => {
    const inputId = useMemo(() => {
        return id || (label 
            ? `input-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` 
            : `input-${Math.random().toString(36).substr(2, 9)}`);
    }, [id, label]);

    const isNumberType = props.type === 'number';
    const [isFocused, setIsFocused] = useState(false);
    const [localDisplayValue, setLocalDisplayValue] = useState<string>(() => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && isNaN(value)) return '';
        return String(value);
    });

    const safeValue = useMemo(() => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && isNaN(value)) return '';
        return value;
    }, [value]);

    useEffect(() => {
        if (!isFocused) {
            if (value === null || value === undefined) {
                setLocalDisplayValue('');
            } else if (typeof value === 'number' && isNaN(value)) {
                setLocalDisplayValue('');
            } else {
                setLocalDisplayValue(String(value));
            }
        } else if (isNumberType) {
            const isLocalEmpty = localDisplayValue === '' || localDisplayValue === '-' || localDisplayValue.endsWith('.');
            const localNum = localDisplayValue === '' || localDisplayValue === '-' ? 0 : parseFloat(localDisplayValue);
            const incomingNum = (value === null || value === undefined || value === '') ? 0 : Number(value);

            if (isLocalEmpty && incomingNum === 0) {
                return;
            }

            if (!isNaN(localNum) && !isNaN(incomingNum) && localNum === incomingNum) {
                return;
            }

            setLocalDisplayValue(value === null || value === undefined ? '' : String(value));
        }
    }, [value, isFocused, isNumberType]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        if (isNumberType) {
            e.target.select();
        }
        if (onFocus) onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        if (isNumberType) {
            if (value === null || value === undefined) {
                setLocalDisplayValue('');
            } else if (typeof value === 'number' && isNaN(value)) {
                setLocalDisplayValue('');
            } else {
                setLocalDisplayValue(String(value));
            }
        }
        if (onBlur) onBlur(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isNumberType) {
            let val = e.target.value;
            if (/^-?0[0-9]+/.test(val)) {
                val = val.replace(/^(-?)0+([0-9])/, '$1$2');
                e.target.value = val;
            }
            setLocalDisplayValue(val);
        }
        if (onChange) {
            onChange(e);
        }
    };

    const displayValue = useMemo(() => {
        if (props.type === 'file') return undefined;
        if (isNumberType && isFocused) {
            return localDisplayValue;
        }
        return safeValue;
    }, [props.type, isNumberType, isFocused, localDisplayValue, safeValue]);

    if (bare) {
        return (
            <input 
                id={inputId}
                name={props.name || inputId}
                {...(props.type !== 'file' ? { value: displayValue } : {})}
                onChange={handleChange}
                onInput={(e) => {
                    if (onInput) onInput(e);
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={className || ''} 
                {...props} 
            />
        );
    }

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
                    {...(props.type !== 'file' ? { value: displayValue } : {})}
                    onChange={handleChange}
                    onInput={(e) => {
                        if (onInput) onInput(e);
                    }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
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

export const NumberInput: React.FC<InputProps> = (props) => (
    <Input bare type="number" {...props} />
);

export default Input;

