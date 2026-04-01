import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { User, ShiftLog, WorkSchedule } from 'types';
import { Lock, LogOut, CheckCircle, Clock, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentLocation } from 'lib/geolocation';

const KioskMode: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const org = state.currentOrganization;

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [pinInput, setPinInput] = useState('');
    const [mode, setMode] = useState<'SELECT_USER' | 'ENTER_PIN' | 'SUCCESS_IN' | 'SUCCESS_OUT'>('SELECT_USER');
    const [authError, setAuthError] = useState<string | null>(null);

    // Only Users who explicitly have a PIN assigned exist in the Kiosk
    const kioskUsers = useMemo(() => {
        if (!org) return [];
        return state.users.filter(u => u.organizationId === org.id && u.kioskPin && u.status !== 'archived');
    }, [state.users, org]);

    // Track active shifts globally across all kiosk users
    const allActiveShifts = useMemo(() => {
        const active: Record<string, ShiftLog> = {};
        Object.values(state.shiftLogs).forEach((logs: unknown) => {
            const shift = (logs as ShiftLog[]).find(l => !l.clockOut);
            if (shift) active[shift.userId] = shift;
        });
        return active;
    }, [state.shiftLogs]);

    const userSchedules = useMemo(() => {
        if (!selectedUser) return [];
        return (state.schedules as WorkSchedule[]).filter(s => s.userId === selectedUser.id).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    }, [selectedUser, state.schedules]);

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handleNumpad = (digit: string) => {
        if (pinInput.length < 4) {
            setAuthError(null);
            setPinInput(prev => prev + digit);
        }
    };

    const handleClear = () => setPinInput('');

    useEffect(() => {
        if (pinInput.length === 4 && selectedUser) {
            if (pinInput === selectedUser.kioskPin) {
                // Pin Validated! Perform Clock action.
                handleClockAction(selectedUser);
            } else {
                setAuthError('Invalid PIN');
                setPinInput('');
            }
        }
    }, [pinInput]);

    const handleClockAction = async (user: User) => {
        const activeShift = allActiveShifts[user.id];
        const activeOrgId = org?.id || user.organizationId;
        
        try {
            const loc = await getCurrentLocation();
            
            if (activeShift) {
                // Clock OUT
                const updatedLog = { 
                    ...activeShift, 
                    clockOut: new Date().toISOString(),
                    endLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
                };
                await db.collection('shiftLogs').doc(activeShift.id).update(updatedLog);
                dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: user.id, log: updatedLog } });
                setMode('SUCCESS_OUT');
            } else {
                // Clock IN
                const logId = `shift-${Date.now()}`;
                const newLog: ShiftLog = { 
                    id: logId, 
                    organizationId: activeOrgId,
                    clockIn: new Date().toISOString(), 
                    userId: user.id,
                    startLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
                };
                await db.collection('shiftLogs').doc(logId).set(newLog);
                dispatch({ type: 'ADD_SHIFT_LOG', payload: { userId: user.id, log: newLog } });
                setMode('SUCCESS_IN');
            }
            
            // Auto-reset Kiosk after 12 seconds so they can read schedule
            setTimeout(() => {
                setMode('SELECT_USER');
                setSelectedUser(null);
                setPinInput('');
            }, 12000);

        } catch (e) {
            console.error(e);
            setAuthError('Connection failed.');
            setPinInput('');
        }
    };

    const confirmExit = () => {
        const adminPw = prompt("Enter Kiosk override password (or your admin PIN) to escape:");
        // Basic security to prevent random employee exiting kiosk
        if (adminPw === "0000" || adminPw === state.currentUser?.kioskPin) {
            navigate('/admin/dashboard');
        } else {
            alert('Invalid escape sequence.');
        }
    };

    useEffect(() => {
        // Enforce full screen visual lock if needed (browser level)
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; }
    }, []);

    if (!org) return <div className="p-8 text-center bg-gray-900 min-h-screen">Loading org...</div>;

    return (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center text-white overflow-hidden p-4">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center bg-slate-800/50 backdrop-blur border-b border-slate-700">
                <div className="flex items-center gap-4">
                    {org.logoUrl && <img src={org.logoUrl} alt="Logo" className="h-10 w-auto rounded-md" />}
                    <h1 className="text-2xl font-black text-slate-100 uppercase tracking-widest">{org.name} KIOSK</h1>
                </div>
                <div className="flex items-center gap-6">
                    <p className="text-xl font-mono font-medium text-slate-300">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button onClick={confirmExit} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-800 rounded-full">
                        <LogOut size={24} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="mt-20 w-full max-w-5xl h-full flex flex-col items-center justify-center">
                
                {mode === 'SELECT_USER' && (
                    <div className="w-full animation-fade-in">
                        <h2 className="text-3xl font-light text-center mb-10 text-slate-300">Select your profile to continue</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-h-[70vh] overflow-y-auto p-4 custom-scrollbar">
                            {kioskUsers.map(u => {
                                const isClockedIn = !!allActiveShifts[u.id];
                                return (
                                    <button 
                                        key={u.id}
                                        onClick={() => { setSelectedUser(u); setMode('ENTER_PIN'); setPinInput(''); }}
                                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all transform hover:scale-105 ${isClockedIn ? 'bg-primary-900/40 border-primary-500/50 hover:bg-primary-800/60' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                    >
                                        <div className="w-20 h-20 bg-slate-600 rounded-full mb-4 flex items-center justify-center overflow-hidden border-2 border-slate-500">
                                            {u.profilePicUrl ? <img src={u.profilePicUrl} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold">{u.firstName[0]}</span>}
                                        </div>
                                        <p className="text-lg font-bold text-white mb-1">{u.firstName} {u.lastName}</p>
                                        
                                        {isClockedIn ? (
                                            <span className="flex items-center gap-1 text-xs font-bold text-primary-400 uppercase tracking-wider bg-primary-900/50 px-2 py-1 rounded w-full justify-center">
                                                <Clock size={12}/> Clocked In
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Clocked Out</span>
                                        )}
                                    </button>
                                );
                            })}
                            {kioskUsers.length === 0 && (
                                <p className="col-span-full text-center text-slate-500 py-10">No users have been assigned a Kiosk PIN yet.</p>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'ENTER_PIN' && selectedUser && (
                    <div className="animation-slide-up flex flex-col items-center">
                        <button onClick={() => setMode('SELECT_USER')} className="mb-6 text-slate-400 hover:text-white transition-colors">← Back to Roster</button>
                        
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome, {selectedUser.firstName}</h2>
                            <p className="text-slate-400">Enter your 4-digit PIN</p>
                        </div>

                        {/* PIN Dots */}
                        <div className="flex gap-4 mb-8">
                            {[0,1,2,3].map(i => (
                                <div key={i} className={`w-6 h-6 rounded-full border-2 transition-colors ${pinInput.length > i ? 'bg-white border-white' : 'bg-transparent border-slate-600'}`}></div>
                            ))}
                        </div>
                        
                        {authError && <p className="text-red-400 font-bold mb-4 animate-pulse">{authError}</p>}

                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-4 max-w-xs">
                            {[1,2,3,4,5,6,7,8,9].map(num => (
                                <button key={num} onClick={() => handleNumpad(num.toString())} className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 text-3xl font-light hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95 shadow-lg">
                                    {num}
                                </button>
                            ))}
                            <div className="w-20 h-20"></div>
                            <button onClick={() => handleNumpad('0')} className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 text-3xl font-light hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95 shadow-lg">0</button>
                            <button onClick={handleClear} className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 text-slate-500 text-lg font-bold hover:bg-slate-800 hover:text-slate-300 transition-all active:scale-95">DEL</button>
                        </div>
                    </div>
                )}

                {mode === 'SUCCESS_IN' && (
                    <div className="flex flex-col items-center justify-center animation-zoom-in text-emerald-400 w-full max-w-2xl">
                        <CheckCircle size={80} className="mb-4"/>
                        <h2 className="text-4xl font-black mb-2 uppercase tracking-widest text-white">Clocked In!</h2>
                        <p className="text-xl text-emerald-300 mb-8">Have a great shift, {selectedUser?.firstName}.</p>
                        
                        {userSchedules.length > 0 ? (
                            <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><CalendarDays size={20}/> Your Weekly Schedule</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {userSchedules.map(s => (
                                        <div key={s.id} className={`p-3 rounded-xl border ${s.dayOfWeek === new Date().getDay() ? 'bg-primary-900/50 border-primary-500' : 'bg-slate-900 border-slate-800'}`}>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{DAYS[s.dayOfWeek]}</p>
                                            {s.isOff ? <span className="text-sm font-medium text-slate-500">Day Off</span> : <span className="text-sm font-black text-white">{s.startTime} - {s.endTime}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
                                <p className="text-slate-400 flex items-center justify-center gap-2"><CalendarDays size={20}/> No schedule posted for this week.</p>
                            </div>
                        )}
                        <button onClick={() => { setMode('SELECT_USER'); setSelectedUser(null); setPinInput(''); }} className="mt-8 px-6 py-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all">Done</button>
                    </div>
                )}

                {mode === 'SUCCESS_OUT' && (
                    <div className="flex flex-col items-center justify-center animation-zoom-in text-blue-400 w-full max-w-2xl">
                        <CheckCircle size={80} className="mb-4"/>
                        <h2 className="text-4xl font-black mb-2 uppercase tracking-widest text-white">Clocked Out</h2>
                        <p className="text-xl text-blue-300 mb-8">Great work today, {selectedUser?.firstName}.</p>
                        
                        {userSchedules.length > 0 ? (
                            <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><CalendarDays size={20}/> Your Weekly Schedule</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {userSchedules.map(s => (
                                        <div key={s.id} className={`p-3 rounded-xl border ${s.dayOfWeek === new Date().getDay() ? 'bg-primary-900/50 border-primary-500' : 'bg-slate-900 border-slate-800'}`}>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{DAYS[s.dayOfWeek]}</p>
                                            {s.isOff ? <span className="text-sm font-medium text-slate-500">Day Off</span> : <span className="text-sm font-black text-white">{s.startTime} - {s.endTime}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
                                <p className="text-slate-400 flex items-center justify-center gap-2"><CalendarDays size={20}/> No schedule posted for this week.</p>
                            </div>
                        )}
                        <button onClick={() => { setMode('SELECT_USER'); setSelectedUser(null); setPinInput(''); }} className="mt-8 px-6 py-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all">Done</button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default KioskMode;
