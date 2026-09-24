
import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    Package, Cog, ShieldCheck, Search, Filter, 
    MapPin, Snowflake, Flame, Zap, Wrench, ChevronRight, ChevronDown
} from 'lucide-react';
import type { EquipmentAsset, ServiceLocation } from 'types';

interface AssetsSectionProps {
    assets: EquipmentAsset[];
    locations?: ServiceLocation[];
    onSelectUnit?: (unit: EquipmentAsset) => void;
    onRequestServiceForUnit?: (unit: EquipmentAsset, location?: ServiceLocation | null) => void;
}

const AssetsSection: React.FC<AssetsSectionProps> = ({ 
    assets, 
    locations = [], 
    onSelectUnit,
    onRequestServiceForUnit 
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAssets = useMemo(() => {
        if (!assets) return [];
        if (!searchQuery.trim()) return assets;
        const q = searchQuery.toLowerCase().trim();
        return assets.filter(a => 
            (a.brand || '').toLowerCase().includes(q) ||
            (a.model || '').toLowerCase().includes(q) ||
            (a.serial || '').toLowerCase().includes(q) ||
            (a.type || '').toLowerCase().includes(q) ||
            (a.physicalLocation || '').toLowerCase().includes(q) ||
            (a.exactPlacement || '').toLowerCase().includes(q) ||
            (a.name || '').toLowerCase().includes(q)
        );
    }, [assets, searchQuery]);

    const getLocationForAsset = (asset: EquipmentAsset) => {
        if (!asset.locationId && !(asset as any).propertyId) return null;
        const targetId = asset.locationId || (asset as any).propertyId;
        return locations.find(l => l.id === targetId) || null;
    };

    if (!assets || assets.length === 0) return null;

    return (
        <section className="space-y-4">
            <div 
                onClick={() => setIsCollapsed(prev => !prev)}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer group select-none bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-400 transition-all"
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <Package className="text-emerald-600" size={20} />
                        <span>Registered Equipment & Units</span>
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                            {assets.length}
                        </span>
                    </h3>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {!isCollapsed && assets.length > 2 && (
                        <div 
                            className="relative w-full sm:w-64"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search units, serials, filters..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 group-hover:text-emerald-600 transition-colors shrink-0">
                        <span>{isCollapsed ? 'Show Units' : 'Collapse'}</span>
                        <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                </div>
            </div>

            {!isCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAssets.map((asset) => {
                    const loc = getLocationForAsset(asset);

                    return (
                        <Card 
                            key={asset.id} 
                            onClick={() => onSelectUnit?.(asset)}
                            className="p-5 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group cursor-pointer bg-white dark:bg-slate-900 flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start gap-3.5 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                        <Cog size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-1">
                                            <h4 className="font-black text-slate-900 dark:text-white text-sm truncate group-hover:text-emerald-600 transition-colors">
                                                {asset.brand}
                                            </h4>
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold uppercase text-slate-500 shrink-0">
                                                {asset.type || 'HVAC Unit'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium truncate">{asset.model}</p>
                                        
                                        {loc && (
                                            <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold flex items-center gap-1 mt-1 truncate">
                                                <MapPin size={11} /> {loc.propertyName || loc.name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {asset.physicalLocation && (
                                    <div className="mb-3 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-slate-400 uppercase text-[9px] mr-1">Zone / Room:</span>
                                        {asset.physicalLocation} {asset.exactPlacement ? `(${asset.exactPlacement})` : ''}
                                    </div>
                                )}

                                {/* Specs Chips */}
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {asset.filterType && (
                                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold border border-emerald-200 dark:border-emerald-900">
                                            <Filter size={10} /> Filter: {asset.filterType}
                                        </span>
                                    )}
                                    {asset.tonnage && (
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                                            {asset.tonnage} Tons
                                        </span>
                                    )}
                                    {asset.refrigerantType && (
                                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-bold">
                                            <Snowflake size={10} /> {asset.refrigerantType}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                                <div className="text-slate-400">
                                    <span className="font-bold uppercase tracking-widest mr-1">S/N:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{asset.serial || 'N/A'}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-600 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                        View Specs <ChevronRight size={13} />
                                    </span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                </div>
            )}
        </section>
    );
};

export default AssetsSection;
