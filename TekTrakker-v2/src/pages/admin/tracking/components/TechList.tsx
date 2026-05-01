
import React from 'react';
import Card from 'components/ui/Card';
import { Clock, Truck, User as UserIcon, Navigation } from 'lucide-react';

interface TechListProps {
    techs: any[];
    onTechSelect: (tech: any) => void;
}

const TechList: React.FC<TechListProps> = ({ techs, onTechSelect }) => {
    return (
        <div className="w-full lg:w-[400px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {techs.map((tech: any) => (
                <div 
                    key={tech.id} 
                    onClick={() => onTechSelect(tech)}
                    className={`group relative overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${tech.isOnline ? 'ring-1 ring-emerald-500/10' : ''}`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-current/20 transition-transform group-hover:scale-105 ${tech.isFleet ? 'bg-indigo-600' : (tech.isOnline ? 'bg-emerald-600' : 'bg-slate-400')}`}>
                                {tech.isFleet ? <Truck size={20} /> : <UserIcon size={20} />}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    {tech.firstName} {tech.lastName}
                                    {tech.isFleet && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black">Fleet</span>}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                    <Clock size={10}/> {tech.hasLocation ? `Updated ${Math.floor(tech.diffMins || 0)}m ago` : 'Location Unknown'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            {tech.isFleet ? (
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${(tech.speed || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {(tech.speed || 0) > 0 ? 'Moving' : 'Parked'}
                                    </span>
                                    {tech.speed > 0 && <span className="text-[10px] font-black text-emerald-600">{Math.round(tech.speed)} MPH</span>}
                                </div>
                            ) : (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${tech.activeJob ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {tech.activeJob ? 'On Job' : 'Available'}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {tech.activeJob ? (
                        <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50 p-3 rounded-2xl">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Active Destination</p>
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{tech.activeJob.customerName}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{tech.activeJob.address}</p>
                        </div>
                    ) : (
                        !tech.isFleet && (
                            <div className="mt-4 flex gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-1/3 rounded-full"></div>
                                </div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Ready for Dispatch</span>
                            </div>
                        )
                    )}
                </div>
            ))}
            {techs.length === 0 && (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <Navigation size={48} className="mx-auto text-slate-200 mb-4 animate-pulse" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No active personnel or vehicles</p>
                </div>
            )}
        </div>
    );
};

export default TechList;
