import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';

export interface SearchableSelectOption {
    value: string;
    label: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    label?: string;
    placeholder?: string;
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
    className?: string;
    id?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    label,
    placeholder = '-- Select --',
    options,
    value,
    onChange,
    required = false,
    error,
    className = '',
    id,
}) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Generate a stable ID for the input and label association
    const selectId = useRef(
        id || (label 
            ? `search-select-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}` 
            : `search-select-${Math.random().toString(36).substr(2, 9)}`)
    ).current;

    // Find the currently selected option to show its label
    const selectedOption = options.find(opt => opt.value === value);

    // Sync input text with selected option label when dropdown is closed
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery(selectedOption ? selectedOption.label : '');
        }
    }, [selectedOption, isOpen]);

    // Handle outside clicks to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter options based on search query
    const filteredOptions = (() => {
        if (!isOpen) return [];
        // If query matches the selected option's label exactly, and user hasn't edited it, show all options
        if (selectedOption && searchQuery === selectedOption.label) {
            return options;
        }
        const query = searchQuery.toLowerCase().trim();
        if (!query) return options;
        return options.filter(opt => 
            opt.label.toLowerCase().includes(query) || 
            (opt.subLabel && opt.subLabel.toLowerCase().includes(query))
        );
    })();

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsOpen(true);
        // Highlight/select all text so typing immediately overrides
        e.target.select();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    const handleSelectOption = (opt: SearchableSelectOption) => {
        onChange(opt.value);
        setSearchQuery(opt.label);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchQuery('');
        setIsOpen(false);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            if (inputRef.current) {
                inputRef.current.blur();
            }
        }
    };

    return (
        <div ref={containerRef} className={`relative mb-4 w-full ${className}`}>
            {label && (
                <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    id={selectId}
                    type="text"
                    value={searchQuery}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={t(placeholder)}
                    autoComplete="off"
                    className={`w-full rounded-lg border border-slate-300 dark:border-slate-600 pl-3 pr-16 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[40px] ${
                        error ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20 animate-shake' : ''
                    }`}
                />
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title={t("Clear selection")}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <ChevronDown 
                        className={`w-4 h-4 cursor-pointer transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                        onClick={() => {
                            if (isOpen) {
                                setIsOpen(false);
                            } else {
                                if (inputRef.current) {
                                    inputRef.current.focus();
                                }
                            }
                        }}
                    />
                </div>
            </div>

            {error && (
                <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400">{error}</p>
            )}

            {/* Dropdown Suggestions */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => {
                            const isSelected = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelectOption(opt)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col gap-0.5 ${
                                        isSelected ? 'bg-primary-50/50 dark:bg-primary-950/20 font-medium text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.subLabel && (
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            {opt.subLabel}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic text-center">
                            {t("No results found")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
