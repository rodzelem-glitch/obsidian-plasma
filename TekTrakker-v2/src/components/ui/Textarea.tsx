
import React, { useMemo } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, className, id, ...props }) => {
    const areaId = useMemo(() => {
        return id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` : undefined);
    }, [id, label]);

    return (
        <div className="mb-2">
            {label && <label htmlFor={areaId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <textarea 
                id={areaId}
                name={props.name || areaId}
                className={`w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${className || ''}`} 
                {...props} 
            />
        </div>
    );
};

export default Textarea;
