import React from 'react';
import Card from 'components/ui/Card';
import { Clock, Truck, User as UserIcon, Navigation, ChevronDown, ChevronRight, HardHat } from 'lucide-react';

interface TechListProps {
    internalTechs: any[];
    subcontractorCrews: any[];
    expandedSubcontractorIds: string[];
    onToggleSubcontractor: (subId: string) => void;
    onTechSelect: (tech: any) => void;
}

const TechList: React.FC<TechListProps> = ({ 
    internalTechs, 
    subcontractorCrews, 
    expandedSubcontractorIds, 
    onToggleSubcontractor, 
    onTechSelect 
}) => {
    const renderTechCard = (tech: any) => (
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
                        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            {tech.firstName} {tech.lastName}
                            {tech.isFleet && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black">Fleet</span>}
                            {tech.companyLabel && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black">{tech.companyLabel}</span>}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            <Clock size={10}/> {tech.hasLocation ? `Updated ${Math.floor(tech.diffMins || 0)}m ago` : 'Location Unknown'}
                        </p>
                        {tech.location && (
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                <span className="block font-bold">Coords: {tech.location.lat.toFixed(5)}, {tech.location.lng.toFixed(5)}</span>
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${tech.location.lat},${tech.location.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-primary-600 hover:text-primary-700 underline font-semibold mt-0.5 inline-block"
                                >
                                    View in Google Maps
                                </a>
                            </div>
                        )}
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
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Active Destination</p>
                        {tech.activeJob.checkInTime && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                On Site: {(() => {
                                    const diffMs = Date.now() - new Date(tech.activeJob.checkInTime).getTime();
                                    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
                                    if (diffMins >= 60) {
                                        return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
                                    }
                                    return `${diffMins}m`;
                                })()}
                            </span>
                        )}
                    </div>
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
    );

    return (
        <div className="w-full h-[250px] lg:h-full lg:w-[400px] overflow-y-auto pr-2 space-y-6 custom-scrollbar shrink-0 text-left">
            {/* Internal Personnel Section */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
                    Internal Personnel & Fleet ({internalTechs.length})
                </h4>
                {internalTechs.map(tech => renderTechCard(tech))}
                {internalTechs.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        No active internal personnel
                    </div>
                )}
            </div>

            {/* Subcontractor Crews Section */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
                    Subcontractor Crews ({subcontractorCrews.length})
                </h4>
                {subcontractorCrews.map((crew: any) => {
                    const isExpanded = expandedSubcontractorIds.includes(crew.id);
                    const onlineCount = crew.techs.filter((t: any) => t.isOnline).length;
                    
                    return (
                        <div key={crew.id} className="space-y-2 bg-slate-50/40 dark:bg-slate-900/20 rounded-[2rem] border border-slate-150 dark:border-slate-800/40 p-2">
                            {/* Crew Expandable Toggle Card */}
                            <div 
                                onClick={() => onToggleSubcontractor(crew.id)}
                                className={`flex justify-between items-center p-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow transition-all cursor-pointer ${isExpanded ? 'ring-1 ring-primary-500/20' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                        <HardHat size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{crew.companyName || 'Subcontractor Crew'}</h4>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-405 mt-0.5">
                                            {crew.techs.length} tech{crew.techs.length !== 1 ? 's' : ''} &bull; {onlineCount} active
                                        </p>
                                    </div>
                                </div>
                                <div className="text-slate-400">
                                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </div>
                            </div>

                            {/* Nested crew members, shown only when expanded */}
                            {isExpanded && (
                                <div className="pl-4 pr-1 py-2 space-y-3 border-l-2 border-dashed border-indigo-200 dark:border-indigo-900/50 ml-6 animate-fade-in">
                                    {crew.techs.map((tech: any) => renderTechCard(tech))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {subcontractorCrews.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        No subcontractor crews connected
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechList;
