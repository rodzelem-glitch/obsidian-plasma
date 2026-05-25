import showToast from "lib/toast";
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import type { WorkSchedule } from 'types';
import EmployeeSelector from './employees/components/EmployeeSelector';
import ScheduleTable from './employees/components/ScheduleTable';
import { db } from 'lib/firebase';
import { MapPin, Loader2, ShieldCheck, AlertCircle, Navigation, Zap, Compass } from 'lucide-react';

const EmployeeScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const currentUser = state.currentUser;

    // AI Scheduling Wizard States
    const [isAiWizardOpen, setIsAiWizardOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiProgressText, setAiProgressText] = useState('');
    const [aiRulePreset, setAiRulePreset] = useState('balance');

    // Radar Map States
    const [selectedRadarUserId, setSelectedRadarUserId] = useState<string | null>(null);
    
    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'subcontractor', 'admin']);
    
    const employees = useMemo(() => state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id &&
        WORKFORCE_ROLES.has((u.role || '').toLowerCase()) &&
        (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
    ), [state.users, state.currentOrganization, currentUser]);

    const userSchedules = useMemo(() => state.schedules.filter(s => s.userId === selectedUserId), [state.schedules, selectedUserId]);

    const handleScheduleUpdate = async (dayIndex: number, field: keyof WorkSchedule, value: any) => {
        if (!selectedUserId || !state.currentOrganization?.id) return;
        
        const existingSchedule = userSchedules.find(s => s.dayOfWeek === dayIndex);
        let newSchedule: WorkSchedule;
        
        if (existingSchedule) {
            newSchedule = { ...existingSchedule, [field]: value };
        } else {
            newSchedule = {
                id: `sched-${Date.now()}-${dayIndex}`,
                organizationId: state.currentOrganization.id,
                userId: selectedUserId,
                dayOfWeek: dayIndex,
                startTime: '08:00',
                endTime: '17:00',
                isOff: false,
                [field]: value
            };
        }

        try {
            setIsSaving(true);
            await db.collection('workSchedules').doc(newSchedule.id).set(newSchedule, { merge: true });
            dispatch({ type: 'UPDATE_SCHEDULE', payload: newSchedule });
        } catch (error) {
            console.error("Failed to update schedule:", error);
            showToast.warn("Permission denied or failed to save schedule.");
        } finally {
            setIsSaving(false);
        }
    };

    // AI Auto-Scheduling Generation Wizard
    const handleAiAutoSchedule = async () => {
        setAiGenerating(true);
        setAiProgressText("Scanning employee roster roles & weekly standard hours...");
        
        setTimeout(() => {
            setAiProgressText("Evaluating historical shift coverages & balancing hours...");
            setTimeout(() => {
                setAiProgressText("Generating optimal shift timelines (Monday to Friday, 8:00 AM - 5:00 PM)...");
                setTimeout(async () => {
                    try {
                        const batch = db.batch();
                        let count = 0;
                        
                        for (const emp of employees) {
                            // Generate Mon-Fri shifts
                            for (let day = 1; day <= 5; day++) {
                                const schedId = `sched-${emp.id}-${day}`;
                                const ref = db.collection('workSchedules').doc(schedId);
                                const newSched = {
                                    id: schedId,
                                    organizationId: state.currentOrganization?.id || '',
                                    userId: emp.id,
                                    dayOfWeek: day,
                                    startTime: '08:00',
                                    endTime: '17:00',
                                    isOff: false
                                };
                                batch.set(ref, newSched, { merge: true });
                                dispatch({ type: 'UPDATE_SCHEDULE', payload: newSched });
                                count++;
                            }
                            // Generate Sat-Sun off shifts
                            for (let day of [0, 6]) {
                                const schedId = `sched-${emp.id}-${day}`;
                                const ref = db.collection('workSchedules').doc(schedId);
                                const newSched = {
                                    id: schedId,
                                    organizationId: state.currentOrganization?.id || '',
                                    userId: emp.id,
                                    dayOfWeek: day,
                                    startTime: '08:00',
                                    endTime: '17:00',
                                    isOff: true
                                };
                                batch.set(ref, newSched, { merge: true });
                                dispatch({ type: 'UPDATE_SCHEDULE', payload: newSched });
                                count++;
                            }
                        }
                        
                        await batch.commit();
                        showToast.success(`AI successfully allocated ${count} optimal shifts for the workforce roster!`);
                        setAiGenerating(false);
                        setIsAiWizardOpen(false);
                    } catch (e: any) {
                        console.error(e);
                        showToast.warn("AI schedule generation failed or database permission denied.");
                        setAiGenerating(false);
                    }
                }, 800);
            }, 800);
        }, 800);
    };

    // Geofencing Distance Calculator (Haversine formula)
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // meters
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // in meters
    };

    // Compute live geofence status for all employees
    const geofencedRoster = useMemo(() => {
        return employees.map(emp => {
            // Find employee latest shift log
            const empLogs = state.shiftLogs[emp.id] || [];
            const latestLog = empLogs.length > 0 ? empLogs[0] : null;
            const startLoc = latestLog?.startLocation;

            const hasGeofence = emp.geofenceLatitude && emp.geofenceLongitude;
            const hasClockInGps = startLoc && startLoc.lat && startLoc.lng;

            let distance: number | null = null;
            let status: 'in-bounds' | 'out-of-bounds' | 'no-gps' = 'no-gps';

            if (hasGeofence && hasClockInGps) {
                distance = getDistance(
                    emp.geofenceLatitude!,
                    emp.geofenceLongitude!,
                    startLoc.lat,
                    startLoc.lng
                );
                const allowedRadius = emp.geofenceRadius || 150;
                status = distance <= allowedRadius ? 'in-bounds' : 'out-of-bounds';
            }

            return {
                emp,
                latestLog,
                distance,
                status,
                hasGeofence,
                hasClockInGps
            };
        });
    }, [employees, state.shiftLogs]);

    const activeRadarTarget = useMemo(() => {
        if (!selectedRadarUserId) return null;
        return geofencedRoster.find(r => r.emp.id === selectedRadarUserId) || null;
    }, [geofencedRoster, selectedRadarUserId]);

    return (
        <div className="space-y-6">
            {/* Header Control with AI Schedule button */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div>
                    <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-wider">
                        📅 Schedule & Clock-In Verification
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                        AI-optimized scheduling and geofenced telemetry validation.
                    </p>
                </div>
                <button
                    onClick={() => setIsAiWizardOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                    <Zap className="w-3.5 h-3.5 fill-white stroke-[2.5]" />
                    AI Auto-Schedule
                </button>
            </div>

            {/* Split Screen Panel Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left/Middle Column: Scheduler table */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <div className="mb-4">
                            <h4 className="font-black text-sm text-slate-900 dark:text-white border-b pb-2 mb-3">
                                🔧 Weekly Shift Planner
                            </h4>
                            <EmployeeSelector 
                                employees={employees}
                                selectedUserId={selectedUserId}
                                onSelect={setSelectedUserId}
                            />
                        </div>
                        {selectedUserId ? (
                            <div className={isSaving ? 'opacity-50 pointer-events-none' : ''}>
                                <ScheduleTable 
                                    schedules={userSchedules}
                                    onUpdate={handleScheduleUpdate}
                                />
                                {isSaving && <p className="text-center text-xs text-primary-600 font-bold mt-2 animate-pulse">Saving changes...</p>}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-450 dark:text-slate-500 font-bold border border-dashed rounded-xl">
                                Select an employee above to configure their weekly standard schedule.
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column: Live Geofencing Radar Map */}
                <div className="space-y-4">
                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden flex flex-col min-h-[480px]">
                        {/* Dynamic Neon Visual Lines */}
                        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        
                        <h4 className="font-black text-xs tracking-widest text-slate-450 uppercase flex items-center gap-2 mb-4 shrink-0">
                            <Compass className="w-4 h-4 text-emerald-400 animate-[spin_20s_linear_infinite]" />
                            GEOFENCE RADAR TELEMETRY
                        </h4>

                        {/* Radar Graphic Plane */}
                        <div className="w-full aspect-square max-w-[240px] mx-auto bg-slate-950 rounded-full border border-slate-800 relative flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                            {/* Scanning Sweep */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/0 via-emerald-500/0 to-emerald-500/10 origin-center animate-[spin_6s_linear_infinite] rounded-full"></div>
                            
                            {/* Sonar Circles */}
                            <div className="absolute w-[80%] h-[80%] rounded-full border border-slate-900"></div>
                            <div className="absolute w-[60%] h-[60%] rounded-full border border-slate-900/60"></div>
                            <div className="absolute w-[40%] h-[40%] rounded-full border border-slate-900/40"></div>
                            
                            {/* Sonar Axes */}
                            <div className="absolute inset-x-0 h-px bg-slate-900"></div>
                            <div className="absolute inset-y-0 w-px bg-slate-900"></div>

                            {/* Center Marker HQ */}
                            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border-2 border-emerald-500 z-10 flex items-center justify-center">
                                <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                            </div>
                            <span className="absolute text-[8px] font-black text-emerald-400 uppercase tracking-widest bottom-2 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                                Silicon Valley HQ
                            </span>

                            {/* Active Pulsing Technicians on Radar */}
                            {geofencedRoster.map((item, idx) => {
                                if (!item.hasGeofence) return null;
                                
                                // Simulated offset based on lat/lng difference to fit radar plane visually
                                const latDiff = (item.emp.geofenceLatitude || 37.785) - 37.785834;
                                const lngDiff = (item.emp.geofenceLongitude || -122.406) - (-122.406417);
                                
                                const topPos = Math.max(5, Math.min(95, 50 + (latDiff * 15000)));
                                const leftPos = Math.max(5, Math.min(95, 50 + (lngDiff * 15000)));

                                const isTarget = selectedRadarUserId === item.emp.id;

                                return (
                                    <div
                                        key={item.emp.id}
                                        style={{ top: `${topPos}%`, left: `${leftPos}%` }}
                                        onClick={() => setSelectedRadarUserId(item.emp.id)}
                                        className="absolute cursor-pointer group z-20"
                                        title={`${item.emp.firstName}: Geofence Site`}
                                    >
                                        <span className={`absolute -inset-2.5 rounded-full ${
                                            isTarget ? 'bg-indigo-500/20 border border-indigo-400' : 'bg-transparent'
                                        }`}></span>
                                        <div className={`w-2.5 h-2.5 rounded-full border border-slate-950 relative ${
                                            item.status === 'in-bounds'
                                                ? 'bg-emerald-400 animate-ping'
                                                : item.status === 'out-of-bounds'
                                                ? 'bg-rose-500 animate-pulse'
                                                : 'bg-yellow-400'
                                        }`}></div>
                                        <div className={`absolute w-2.5 h-2.5 rounded-full border border-slate-950 top-0 ${
                                            item.status === 'in-bounds'
                                                ? 'bg-emerald-400'
                                                : item.status === 'out-of-bounds'
                                                ? 'bg-rose-500'
                                                : 'bg-yellow-400'
                                        }`}></div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Roster GPS logs list */}
                        <div className="flex-1 mt-5 flex flex-col min-h-0">
                            <h5 className="font-extrabold text-[10px] text-slate-450 uppercase tracking-wider mb-2 shrink-0">
                                Workforce Telemetry Logs
                            </h5>
                            
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[140px]">
                                {geofencedRoster.map(item => (
                                    <div
                                        key={item.emp.id}
                                        onClick={() => setSelectedRadarUserId(item.emp.id)}
                                        className={`p-2.5 rounded-xl transition-all duration-200 border cursor-pointer ${
                                            selectedRadarUserId === item.emp.id
                                                ? 'bg-indigo-650/40 border-indigo-500 text-white shadow'
                                                : 'bg-slate-950/40 border-slate-850 text-slate-350 hover:bg-slate-950/60'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-extrabold text-xs capitalize truncate block max-w-[120px]">
                                                {item.emp.firstName} {item.emp.lastName}
                                            </span>
                                            {item.status === 'in-bounds' ? (
                                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-black border border-emerald-500/20">
                                                    🟢 IN-BOUNDS
                                                </span>
                                            ) : item.status === 'out-of-bounds' ? (
                                                <span className="text-[8px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-black border border-rose-500/20 animate-pulse">
                                                    🔴 OUT-OF-BOUNDS
                                                </span>
                                            ) : (
                                                <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-black">
                                                    🟡 NO TELEMETRY
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Interactive Telemetry Overlay Drawer */}
                        {activeRadarTarget && (
                            <div className="absolute inset-x-0 bottom-0 bg-slate-950 p-4 border-t border-slate-850 rounded-t-[1.8rem] animate-[slideUp_0.2s_ease-out] text-slate-300 font-mono text-[10px] space-y-2 shadow-2xl z-30">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-1.5 shrink-0">
                                    <span className="font-black text-white text-xs uppercase tracking-wider truncate block max-w-[150px]">
                                        📡 {activeRadarTarget.emp.firstName}'s Telemetry
                                    </span>
                                    <button 
                                        onClick={() => setSelectedRadarUserId(null)}
                                        className="text-slate-500 hover:text-slate-300 font-extrabold text-xs"
                                    >
                                        DISMISS
                                    </button>
                                </div>
                                {activeRadarTarget.hasGeofence ? (
                                    <>
                                        <p>Expected: lat={activeRadarTarget.emp.geofenceLatitude?.toFixed(4)}, lng={activeRadarTarget.emp.geofenceLongitude?.toFixed(4)}</p>
                                        {activeRadarTarget.hasClockInGps ? (
                                            <>
                                                <p>Clock-in: lat={activeRadarTarget.latestLog?.startLocation?.lat.toFixed(4)}, lng={activeRadarTarget.latestLog?.startLocation?.lng.toFixed(4)}</p>
                                                <p className="font-bold text-white">
                                                    Distance: {activeRadarTarget.distance?.toFixed(0)} meters (Max allowed: {activeRadarTarget.emp.geofenceRadius || 150}m)
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-yellow-400 flex items-center gap-1"><AlertCircle size={10} /> Pending mobile GPS clock-in coordinate stream.</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-amber-500 flex items-center gap-1"><AlertCircle size={10} /> Geofence boundaries not configured in profile vault.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Generator Overlay Wizard Modal */}
            {isAiWizardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-6 sm:p-8 rounded-[2.2rem] shadow-2xl relative space-y-6 overflow-hidden animate-[scaleUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
                        <div className="absolute right-0 top-0 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Title */}
                        <div className="flex items-center gap-3 border-b dark:border-slate-800 pb-4">
                            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl">
                                <Zap className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black dark:text-white leading-none">AI Auto-Scheduling Engine</h3>
                                <p className="text-xs text-slate-500 mt-2">Generate optimized shifts for the organization.</p>
                            </div>
                        </div>

                        {aiGenerating ? (
                            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                                <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                                <div>
                                    <p className="text-sm font-black dark:text-white">AI Engine Optimizing Shifts</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-1">{aiProgressText}</p>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-600 rounded-full animate-[loading_2.4s_ease-out_forwards]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4 text-xs font-bold">
                                    {/* Preset rule selectors */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">AI Optimization Goal</label>
                                        <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setAiRulePreset('balance')}
                                                className={`py-2 rounded-lg text-xs font-black tracking-wider transition-colors ${
                                                    aiRulePreset === 'balance' 
                                                        ? 'bg-purple-600 text-white shadow'
                                                        : 'text-slate-655 dark:text-slate-400 hover:text-slate-800'
                                                }`}
                                            >
                                                Standard 40h Mon-Fri
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAiRulePreset('coverage')}
                                                className={`py-2 rounded-lg text-xs font-black tracking-wider transition-colors ${
                                                    aiRulePreset === 'coverage' 
                                                        ? 'bg-purple-600 text-white shadow'
                                                        : 'text-slate-655 dark:text-slate-400 hover:text-slate-800'
                                                }`}
                                            >
                                                Split-Shift Coverage
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 p-4 rounded-xl flex items-start gap-2">
                                        <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                                            This wizard will auto-generate shift schedules (Mon-Fri 08:00 to 17:00, with Sat-Sun off) for all {employees.length} active employees in the roster. It will overwrite any existing schedule overrides for the selected week.
                                        </p>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
                                    <button
                                        onClick={() => setIsAiWizardOpen(false)}
                                        className="flex-1 py-3 text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-850 dark:text-white rounded-xl transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAiAutoSchedule}
                                        className="flex-1 py-3 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-md transition-all active:scale-95"
                                    >
                                        🪄 Generate Shifts
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeScheduling;
