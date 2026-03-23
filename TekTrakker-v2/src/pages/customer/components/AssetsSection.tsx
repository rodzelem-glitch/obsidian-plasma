
import React from 'react';
import Card from 'components/ui/Card';
import { Package, Cog, ShieldCheck, Search } from 'lucide-react';
import type { EquipmentAsset } from 'types';

interface AssetsSectionProps {
    assets: EquipmentAsset[];
}

const AssetsSection: React.FC<AssetsSectionProps> = ({ assets }) => {
    if (!assets || assets.length === 0) return null;

    return (
        <section>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Package className="text-emerald-600" size={20} /> Registered Equipment
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset) => (
                    <Card key={asset.id} className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Cog size={24} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-slate-900 dark:text-white">{asset.brand}</h4>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold uppercase text-slate-500">
                                        {asset.type}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">{asset.model}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div className="text-[10px] text-slate-400">
                                <span className="font-bold uppercase tracking-widest mr-1">S/N:</span>
                                <span className="font-mono">{asset.serial || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <ShieldCheck size={12} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-500 uppercase">Tracked</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
};

export default AssetsSection;
