import React, { useMemo, useState, useEffect, useRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    debounceMs?: number;
}

const Textarea: React.FC<TextareaProps> = ({ 
    label, 
    className, 
    id, 
    onInput, 
    value, 
    onChange, 
    debounceMs = 300, 
    ...props 
}) => {
    const areaId = useMemo(() => {
        return id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` : undefined);
    }, [id, label]);

    // Local state to keep the input extremely snappy
    const [localValue, setLocalValue] = useState((value !== null && value !== undefined) ? value : '');
    
    // Timer ref for debouncing
    const debounceTimeoutRef = useRef(null);
    // Ref to store the latest value to avoid stale closure in debouncing
    const latestValueRef = useRef(localValue);

    // Sync local state when external value changes (e.g. from Voice Input or DB fetch)
    useEffect(() => {
        if (value !== undefined && value !== latestValueRef.current) {
            setLocalValue(value !== null ? value : '');
            latestValueRef.current = value !== null ? value : '';
        }
    }, [value]);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    const handleTextareaChange = (e) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        latestValueRef.current = newValue;

        if (onChange) {
            // Persist the event to allow async access in debounce
            if (typeof e.persist === 'function') {
                e.persist();
            }

            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            debounceTimeoutRef.current = setTimeout(() => {
                onChange(e);
            }, debounceMs);
        }
    };

    const handleBlur = (e) => {
        // Ensure parent gets the final value immediately on blur
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        if (onChange) {
            onChange(e);
        }
        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    return (
        <div className="mb-2">
            {label && <label htmlFor={areaId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <textarea 
                id={areaId}
                name={props.name || areaId}
                className={`w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${className || ''}`} 
                value={localValue}
                onChange={handleTextareaChange}
                onBlur={handleBlur}
                onInput={(e) => {
                    // Removed heavy triggerHapticSelectionChanged() call which caused typing lag on mobile
                    if (onInput) onInput(e);
                }}
                {...props} 
            />
        </div>
    );
};

export default Textarea;
