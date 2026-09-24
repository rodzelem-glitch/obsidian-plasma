import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapPin, Search, Building2, Check, ChevronDown, Plus, Tag, X } from 'lucide-react';
import type { ServiceLocation } from '../../types/customer';

interface LocationSearchSelectorProps {
    locations: (ServiceLocation | any)[];
    selectedLocationId?: string;
    onSelectLocation: (location: ServiceLocation | any) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    allowAddNew?: boolean;
    onAddNew?: () => void;
    customerDefaultAddress?: {
        name?: string;
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
}

export const LocationSearchSelector: React.FC<LocationSearchSelectorProps> = ({
    locations = [],
    selectedLocationId,
    onSelectLocation,
    label = "Service Location",
    placeholder = "Search location by name, store #, address, city, or zip...",
    className = "",
    allowAddNew = false,
    onAddNew,
    customerDefaultAddress
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Format all available location options (including customer default HQ option if applicable)
    const normalizedLocations = useMemo(() => {
        const list: any[] = locations.map(loc => ({
            id: loc.id || loc._id,
            propertyName: loc.propertyName || loc.name || loc.label || 'Unnamed Location',
            locationNumber: loc.locationNumber || loc.storeNumber || loc.locNumber || '',
            building: loc.building || loc.subLocationName || loc.suite || '',
            address: loc.address || loc.streetAddress || '',
            unitNumber: loc.unitNumber || loc.unit || loc.apt || '',
            city: loc.city || '',
            state: loc.state || '',
            zip: loc.zip || loc.zipCode || '',
            propertyType: loc.propertyType || loc.locationType || loc.type || '',
            accessInstructions: loc.accessInstructions || '',
            raw: loc
        }));

        if (customerDefaultAddress && customerDefaultAddress.address) {
            const hasDefaultInList = list.some(l => l.id === 'default' || l.id === 'main');
            if (!hasDefaultInList) {
                list.unshift({
                    id: 'default',
                    propertyName: customerDefaultAddress.name || 'Main Corporate / HQ Site',
                    locationNumber: 'HQ',
                    building: '',
                    address: customerDefaultAddress.address,
                    unitNumber: '',
                    city: customerDefaultAddress.city || '',
                    state: customerDefaultAddress.state || '',
                    zip: customerDefaultAddress.zip || '',
                    propertyType: 'HQ / Main',
                    accessInstructions: '',
                    raw: { id: 'default', ...customerDefaultAddress }
                });
            }
        }
        return list;
    }, [locations, customerDefaultAddress]);

    // Find currently selected location object
    const selectedLocation = useMemo(() => {
        if (!selectedLocationId) return null;
        return normalizedLocations.find(l => l.id === selectedLocationId) || null;
    }, [selectedLocationId, normalizedLocations]);

    // Filtered options based on search query
    const filteredLocations = useMemo(() => {
        if (!searchQuery.trim()) return normalizedLocations;
        const q = searchQuery.toLowerCase().trim();
        return normalizedLocations.filter(loc => {
            const name = (loc.propertyName || '').toLowerCase();
            const locNum = (loc.locationNumber || '').toLowerCase();
            const addr = (loc.address || '').toLowerCase();
            const city = (loc.city || '').toLowerCase();
            const zip = (loc.zip || '').toLowerCase();
            const bldg = (loc.building || '').toLowerCase();
            const type = (loc.propertyType || '').toLowerCase();
            const unit = (loc.unitNumber || '').toLowerCase();

            return name.includes(q) || 
                   locNum.includes(q) || 
                   addr.includes(q) || 
                   city.includes(q) || 
                   zip.includes(q) || 
                   bldg.includes(q) || 
                   type.includes(q) || 
                   unit.includes(q);
        });
    }, [searchQuery, normalizedLocations]);

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {label && (
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    {label}
                </label>
            )}

            {/* Selected Location Card / Trigger Button */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full cursor-pointer rounded-2xl border transition-all duration-200 p-3.5 bg-white dark:bg-slate-900 ${
                    isOpen 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 shadow-sm'
                }`}
            >
                {selectedLocation ? (
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-100 dark:border-indigo-900/50">
                                <Building2 size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className="font-bold text-slate-900 dark:text-white text-base truncate">
                                        {selectedLocation.propertyName}
                                    </span>
                                    {selectedLocation.locationNumber && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                                            #{selectedLocation.locationNumber}
                                        </span>
                                    )}
                                    {selectedLocation.propertyType && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold uppercase tracking-wider">
                                            {selectedLocation.propertyType}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
                                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="truncate">
                                        {[
                                            selectedLocation.address,
                                            selectedLocation.unitNumber ? `Ste/Unit ${selectedLocation.unitNumber}` : '',
                                            selectedLocation.city,
                                            selectedLocation.state ? `${selectedLocation.state} ${selectedLocation.zip}` : selectedLocation.zip
                                        ].filter(Boolean).join(', ')}
                                    </span>
                                </div>

                                {selectedLocation.building && (
                                    <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                        <Tag size={12} />
                                        <span>Building / Sub-location: {selectedLocation.building}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 flex-shrink-0 mt-2 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                    </div>
                ) : (
                    <div className="flex items-center justify-between py-1 px-1">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
                            <MapPin size={18} />
                            <span>Select a location or search address/store #...</span>
                        </div>
                        <ChevronDown size={18} className="text-slate-400" />
                    </div>
                )}
            </div>

            {/* Dropdown Popup */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[420px] animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search Bar inside Popup */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Search size={18} className="text-slate-400 ml-1 flex-shrink-0" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={placeholder}
                            autoFocus
                            className="w-full bg-transparent border-0 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Add New Location Action */}
                    {allowAddNew && onAddNew && (
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onAddNew();
                            }}
                            className="w-full text-left p-3.5 px-4 bg-indigo-50/60 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border-b border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-between transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Plus size={16} />
                                Add New Location / Sub-Location
                            </span>
                            <span className="text-[10px] uppercase tracking-wider bg-indigo-200/50 dark:bg-indigo-800/50 px-2 py-0.5 rounded font-extrabold">New</span>
                        </button>
                    )}

                    {/* Locations List */}
                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredLocations.length > 0 ? (
                            filteredLocations.map((loc) => {
                                const isSelected = selectedLocationId === loc.id;
                                return (
                                    <div
                                        key={loc.id}
                                        onClick={() => {
                                            onSelectLocation(loc.raw);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        className={`p-3.5 px-4 cursor-pointer transition-colors duration-150 flex items-start justify-between gap-3 ${
                                            isSelected 
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 font-medium' 
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`font-bold text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                                                    {loc.propertyName}
                                                </span>
                                                {loc.locationNumber && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                                                        #{loc.locationNumber}
                                                    </span>
                                                )}
                                                {loc.propertyType && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                                                        {loc.propertyType}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                                                <span className="truncate">
                                                    {[
                                                        loc.address,
                                                        loc.unitNumber ? `Ste/Unit ${loc.unitNumber}` : '',
                                                        loc.city,
                                                        loc.state ? `${loc.state} ${loc.zip}` : loc.zip
                                                    ].filter(Boolean).join(', ')}
                                                </span>
                                            </div>

                                            {loc.building && (
                                                <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                                    <Building2 size={12} />
                                                    <span>Building: {loc.building}</span>
                                                </div>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                                                <Check size={14} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                                No matching locations found for "{searchQuery}".
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
