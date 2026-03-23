
import React from 'react';

interface ToggleProps {
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    ariaLabel?: string;
    description?: string; // Added description
}

const Toggle: React.FC<ToggleProps> = ({ label, enabled, onChange, ariaLabel, description }) => {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
                <button 
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={ariaLabel || label || 'Toggle'}
                    className={`${enabled ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    onClick={() => onChange(!enabled)}
                >
                    <span className={`${enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                </button>
            </div>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
    );
};

export default Toggle;
