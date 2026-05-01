
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Modal from 'components/ui/Modal';
import { Users, HardHat, MapPin, TrendingUp, Clock, Calendar } from 'lucide-react';
import EmployeeManagement from 'pages/admin/EmployeeManagement';
import EmployeeScheduling from 'pages/admin/EmployeeScheduling';
import TimeSheetReview from 'pages/admin/TimeSheetReview';
import TechTracking from 'pages/admin/TechTracking';
import TechPerformance from 'pages/admin/TechPerformance';
import SubcontractorsTab from './workforce/components/SubcontractorsTab';

const WorkforceView: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;

    const [isRosterOpen, setIsRosterOpen] = useState(false);
    const [isSubcontractorsOpen, setIsSubcontractorsOpen] = useState(false);
    const [isTrackingOpen, setIsTrackingOpen] = useState(false);
    const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
    const [isTimesheetsOpen, setIsTimesheetsOpen] = useState(false);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

    // Derived summaries
    const orgUsers = useMemo(() => {
        return state.users.filter(u => u.organizationId === state.currentOrganization?.id && u.role !== 'customer');
    }, [state.users, state.currentOrganization]);

    const activeTechs = orgUsers.filter(u => u.role === 'employee' || u.role === 'both' || u.role === 'Technician');
    const subcontractorsCount = state.subcontractors?.length || 0;
    
    // `state.shiftLogs` is actually stored as a dictionary `{ [userId]: ShiftLog[] }` at runtime.
    const allShiftLogs = Object.values(state.shiftLogs || {}).flat();
    
    // Check if there are any active shift logs clocking in right now
    const activeShifts = allShiftLogs.filter((log: any) => !log.clockOut).length || 0;
    
    // Check if there are any pending timesheets needing approval
    const pendingTimesheets = allShiftLogs.filter((log: any) => log.clockOut && !log.isApproved).length || 0;

    const topPerformingTech = useMemo(() => {
        if (!activeTechs.length) return null;
        return activeTechs.map(tech => {
            const myJobs = state.jobs.filter(j => j.assignedTechnicianId === tech.id);
            const revenue = myJobs.reduce((sum, j) => sum + (j.invoice?.status === 'Paid' ? (j.invoice.amount || 0) : 0), 0);
            return { ...tech, revenue };
        }).sort((a, b) => b.revenue - a.revenue)[0];
    }, [activeTechs, state.jobs]);

    return (
        <div className="space-y-6 animate-fade-in relative">
            

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Team Roster */}
                <div 
                    onClick={() => setIsRosterOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Team Roster</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-blue-500 flex justify-between items-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Total Employees</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-xs">{orgUsers.length}</span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Field Techs</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded text-xs">{activeTechs.length}</span>
                        </div>
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                        Manage Employees
                    </button>
                </div>

                {/* Tracking & Map */}
                <div 
                    onClick={() => setIsTrackingOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden relative"
                >
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                            <MapPin size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white drop-shadow-sm">GPS Tracking</h3>
                    </div>
                    <div className="flex-1 rounded-lg overflow-hidden relative min-h-[120px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] transition-shadow">
                        {/* Minimal Map Preview Simulation using abstract CSS grid and dots for real locations if accessible */}
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-400 via-gray-100 to-transparent dark:from-emerald-900 dark:via-gray-800 dark:to-transparent"></div>
                        <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-0.5 opacity-10">
                            {Array.from({ length: 24 }).map((_, i) => <div key={i} className="bg-emerald-500 rounded-full scale-[0.2]"></div>)}
                        </div>
                        {activeTechs.filter(t => t.location).map((tech, i) => (
                             <div key={tech.id} className="absolute w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] border border-white dark:border-gray-800 animate-pulse" ref={e => {
                                 if (e) {
                                     e.style.top = `${20 + (i * 15 % 60)}%`; // Simplified pseudo-random mapping
                                     e.style.left = `${30 + (i * 25 % 50)}%`;
                                 }
                             }}></div>
                        ))}
                        {activeTechs.filter(t => t.location).length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Loading Radar...
                            </div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur pb-0 p-2 rounded-md shadow flex items-center justify-between z-10 border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Live Active Techs</span>
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded-full uppercase tracking-wider">{activeTechs.filter(t => t.location).length} Tracked</span>
                        </div>
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Open Full Map
                    </button>
                </div>

                {/* Subcontractors Card */}
                <div 
                    onClick={() => setIsSubcontractorsOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                            <HardHat size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Subcontractors</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/10 transition-colors">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <HardHat size={120} />
                         </div>
                         <span className="text-5xl font-black text-amber-600 dark:text-amber-400 mb-2 relative z-10 drop-shadow-sm">{subcontractorsCount}</span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">Active Subs</span>
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Manage Subcontractors
                    </button>
                </div>

                {/* Scheduling */}
                <div 
                    onClick={() => setIsScheduleOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Calendar size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scheduling</h3>
                    </div>
                    <div className="flex-1 flex flex-col gap-2 relative">
                         {/* Mini Schedule Strip */}
                         <div className="flex items-center justify-between p-3 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-100 dark:border-fuchsia-900/30 group-hover:border-fuchsia-200 dark:group-hover:border-fuchsia-800 transition-colors">
                             <div className="flex flex-col">
                                 <span className="text-xs font-bold text-gray-900 dark:text-white">Morning Shift</span>
                                 <span className="text-[10px] text-gray-500 font-medium">8:00 AM - 4:00 PM</span>
                             </div>
                             <div className="flex -space-x-2">
                                  {activeTechs.slice(0,3).map((t, i) => (
                                      <div key={i} className="w-7 h-7 rounded-full bg-fuchsia-200 dark:bg-fuchsia-800 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-fuchsia-800 dark:text-white uppercase shadow-sm">{t.firstName?.[0]}</div>
                                  ))}
                             </div>
                         </div>
                         <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-800/80 transition-colors">
                             <div className="flex flex-col">
                                 <span className="text-xs font-bold text-gray-900 dark:text-white">Evening On-Call</span>
                                 <span className="text-[10px] text-gray-500 font-medium">4:00 PM - 12:00 AM</span>
                             </div>
                             <div className="flex -space-x-2">
                                  {activeTechs.slice(3,4).map((t, i) => (
                                      <div key={i} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-white uppercase shadow-sm">{t.firstName?.[0]}</div>
                                  ))}
                             </div>
                         </div>
                         {(state.schedules?.length || 0) === 0 && (
                             <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-lg">
                                 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-white dark:bg-gray-900 px-3 py-1 rounded shadow-sm">Agenda Empty</span>
                             </div>
                         )}
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                        View Schedule
                    </button>
                </div>

                {/* Time Sheets */}
                <div 
                    onClick={() => setIsTimesheetsOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Clock size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Time Sheets</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-orange-500 flex justify-between items-center group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Currently On Clock</span>
                            <span className="font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-xs tracking-wide">{activeShifts} Techs</span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-red-500 flex justify-between items-center group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Pending Approval</span>
                            <span className="font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs tracking-wide">{pendingTimesheets} Sheets</span>
                        </div>
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                        Review Timesheets
                    </button>
                </div>

                {/* Performance Analytics */}
                <div 
                    onClick={() => setIsPerformanceOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Performance</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-2 px-2">
                        {topPerformingTech ? (
                            <div className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-gray-800 border border-pink-100 dark:border-pink-800/50 p-4 rounded-xl text-center flex flex-col items-center group-hover:shadow-[0_4px_20px_rgba(236,72,153,0.15)] transition-shadow relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-400/20 rounded-full blur-xl"></div>
                                <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-pink-600/10 rounded-full blur-xl"></div>
                                
                                <div className="text-[10px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest mb-2 relative z-10 flex items-center gap-1">
                                    <TrendingUp size={12} /> Top Performer
                                </div>
                                <div className="w-12 h-12 rounded-full bg-pink-200 dark:bg-pink-800/80 text-pink-700 dark:text-white flex items-center justify-center font-black text-xl mb-2 shadow-inner border-2 border-white dark:border-gray-800 relative z-10">
                                    {topPerformingTech.firstName?.[0] || '?'}
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-white relative z-10 leading-tight block truncate w-full px-2">{topPerformingTech.firstName} {topPerformingTech.lastName}</span>
                                <span className="text-xs font-black text-pink-600 dark:text-pink-400 mt-1 relative z-10 bg-white/50 dark:bg-gray-900/50 px-2 py-0.5 rounded backdrop-blur-sm">${topPerformingTech.revenue.toLocaleString()} YTD</span>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 dark:bg-gray-900/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                No Performance Data
                            </div>
                        )}
                    </div>
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        View Analytics
                    </button>
                </div>

            </div>

            {/* Modals */}
            <Modal isOpen={isRosterOpen} onClose={() => setIsRosterOpen(false)} title="Team Roster" size="full">
                <EmployeeManagement />
            </Modal>
            
            <Modal isOpen={isTrackingOpen} onClose={() => setIsTrackingOpen(false)} title="Live Tracking Map" size="full">
                <TechTracking />
            </Modal>

            <Modal isOpen={isSubcontractorsOpen} onClose={() => setIsSubcontractorsOpen(false)} title="Subcontractors Directory" size="full">
                <SubcontractorsTab />
            </Modal>

            <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Employee Scheduling" size="full">
                <EmployeeScheduling />
            </Modal>

            <Modal isOpen={isTimesheetsOpen} onClose={() => setIsTimesheetsOpen(false)} title="Time Sheet Review" size="full">
                <TimeSheetReview />
            </Modal>

            <Modal isOpen={isPerformanceOpen} onClose={() => setIsPerformanceOpen(false)} title="Tech Performance" size="full">
                <TechPerformance />
            </Modal>
        </div>
    );
};

export default WorkforceView;
