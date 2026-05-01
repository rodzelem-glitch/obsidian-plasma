
import React from 'react';

import { triggerHapticFeedback } from '../../lib/haptics';

interface ToggleProps {
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    ariaLabel?: string;
    description?: string; // Added description
    disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ label, enabled, onChange, ariaLabel, description, disabled }) => {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
                {enabled ? (
                    <button 
                        type="button"
                        role="switch"
                        aria-checked="true"
                        aria-label={ariaLabel || label || 'Toggle'}
                        disabled={disabled}
                        className={`${disabled ? 'opacity-50 cursor-not-allowed' : ''} bg-blue-600 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        onClick={() => {
                            triggerHapticFeedback('HEAVY' as any);
                            onChange(false);
                        }}
                    >
                        <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                    </button>
                ) : (
                    <button 
                        type="button"
                        role="switch"
                        aria-checked="false"
                        aria-label={ariaLabel || label || 'Toggle'}
                        disabled={disabled}
                        className={`${disabled ? 'opacity-50 cursor-not-allowed' : ''} bg-gray-200 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        onClick={() => {
                            triggerHapticFeedback('HEAVY' as any);
                            onChange(true);
                        }}
                    >
                        <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                    </button>
                )}
            </div>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
    );
};

export default Toggle;
