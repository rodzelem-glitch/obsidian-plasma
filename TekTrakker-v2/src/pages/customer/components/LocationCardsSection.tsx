import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    MapPin, Building, Home, Cog, Wrench, 
    Calendar, CheckCircle, ChevronRight, PlusCircle, ArrowRight, ShieldCheck, UserCheck
} from 'lucide-react';
import type { ServiceLocation, EquipmentAsset, Job, Customer } from 'types';
import { formatFullAddress } from 'lib/utils';

interface LocationCardsSectionProps {
    customer: Customer;
    locations: ServiceLocation[];
    assets: EquipmentAsset[];
    jobs: Job[];
    onOpenLocationModal: (location: ServiceLocation) => void;
    onRequestService: (location?: ServiceLocation) => void;
}

const LocationCardsSection: React.FC<LocationCardsSectionProps> = ({
    customer,
    locations,
    assets,
    jobs,
    onOpenLocationModal,
    onRequestService
}) => {
    // Collect all unique location entities (Main Primary Address + any serviceLocations)
    const primaryLocation: ServiceLocation = {
        id: 'default',
        name: customer.customerType === 'Commercial' ? 'Main Headquarters / Site' : 'Primary Residence',
        propertyName: customer.customerType === 'Commercial' ? 'Main Headquarters / Site' : 'Primary Residence',
        address: typeof customer.address === 'string' ? customer.address : (formatFullAddress(customer.address) || 'Primary Address on file'),
        locationType: customer.customerType === 'Commercial' ? 'Commercial' : 'Residential',
    };

    const allLocations: ServiceLocation[] = [
        primaryLocation,
        ...(locations || [])
    ];

    if (allLocations.length <= 1) return null;

    return (
        <section className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <Building className="text-primary-600" size={20} /> Properties & Facilities ({allLocations.length})
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                        Click on any facility below to view its installed equipment units, active work orders, and warranty coverage in a dedicated property hub.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allLocations.map(loc => {
                    // Match units belonging to this location
                    const locAssets = assets.filter(a => 
                        loc.id === 'default' 
                            ? (!a.locationId || a.locationId === 'default') 
                            : (a.locationId === loc.id || (a as any).propertyId === loc.id)
                    );

                    // Match jobs belonging to this location
                    const locJobs = jobs.filter(j => 
                        loc.id === 'default' 
                            ? (!j.locationId || j.locationId === 'default') 
                            : (j.locationId === loc.id || j.address === loc.address)
                    );

                    const openJobs = locJobs.filter(j => j.jobStatus !== 'Completed');

                    // Find designated POC / Account manager for this location
                    const locContacts = ((customer.contacts || []) as any[]).filter(c => {
                        const locIds = c.assignedLocationIds || c.allowedLocationIds || [];
                        return loc.id === 'default' ? (locIds.length === 0 || locIds.includes('default')) : locIds.includes(loc.id);
                    });
                    const primaryAm = locContacts.find(c => c.isAccountManager) || locContacts[0];

                    return (
                        <Card 
                            key={loc.id} 
                            className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 group"
                            onClick={() => onOpenLocationModal(loc)}
                        >
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                            {loc.locationType === 'Commercial' ? <Building size={20} /> : <Home size={20} />}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-sm group-hover:text-primary-600 transition-colors">
                                                {loc.propertyName || loc.name || 'Property'}
                                            </h4>
                                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                {(loc.storeNumber || loc.locationNumber) && (
                                                    <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                        Store #{loc.storeNumber || loc.locationNumber}
                                                    </span>
                                                )}
                                                {(loc.building || loc.subLocationName) ? (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {loc.building ? `Bldg: ${loc.building} ` : ''}
                                                        {loc.subLocationName ? `Sub: ${loc.subLocationName}` : ''}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {loc.locationType || 'Property'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5 mb-2">
                                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                    <span>{loc.address} {loc.city ? `· ${loc.city}, ${loc.state || ''}` : ''}</span>
                                </p>

                                {primaryAm && (
                                    <div className="mb-3 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-center gap-1.5 truncate">
                                        <UserCheck size={12} className="text-amber-600 shrink-0" />
                                        <span className="truncate">POC: {primaryAm.name} ({primaryAm.title || (primaryAm.isAccountManager ? 'Account Mgr' : 'Lead')})</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center gap-2">
                                        <Cog size={14} className="text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="font-black text-slate-900 dark:text-white block">{locAssets.length}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-medium">Registered Units</span>
                                        </div>
                                    </div>

                                    <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center gap-2">
                                        <Wrench size={14} className="text-blue-600 shrink-0" />
                                        <div>
                                            <span className="font-black text-slate-900 dark:text-white block">{openJobs.length}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-medium">Open Work Orders</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 flex justify-between items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    type="button" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenLocationModal(loc);
                                    }}
                                    className="text-xs font-black text-primary-600 hover:text-primary-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                                >
                                    Explore Facility Hub <ChevronRight size={14} />
                                </button>

                                <button 
                                    type="button" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestService(loc.id === 'default' ? undefined : loc);
                                    }}
                                    className="text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <PlusCircle size={12} /> Book Service
                                </button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
};

export default LocationCardsSection;
