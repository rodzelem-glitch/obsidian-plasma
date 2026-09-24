import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTelephony } from '../../context/TelephonyContext';
import { 
    Phone, PhoneOff, Mic, MicOff, Volume2, Grid, ChevronUp, ChevronDown, 
    ExternalLink, User, Pause, Play, Sparkles
} from 'lucide-react';

export const ActiveCallBar: React.FC = () => {
    const { 
        callState, activeCall, callDuration, isMuted, isOnHold, 
        toggleMute, toggleHold, hangUp, sendDigits 
    } = useTelephony();
    const location = useLocation();
    const navigate = useNavigate();

    const [isKeypadOpen, setIsKeypadOpen] = useState(false);

    // Only show if call is in progress or incoming
    if (callState === 'idle') return null;

    // Check if user is already on the communications page (full dialer view)
    const isCommunicationsPage = location.pathname.includes('/communications') || location.pathname.includes('/messages');
    
    // If on communications page, don't show the floating bar to avoid redundant UI
    if (isCommunicationsPage && callState !== 'incoming') {
        return null;
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleKeypadPress = (digit: string) => {
        sendDigits(digit);
    };

    const handleReturnToConsole = () => {
        navigate('/admin/communications?tab=phone');
    };

    return (
        <aside 
            aria-label="Active Call Floating Bar"
            className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 animate-bounce-short select-none"
        >
            {/* DTMF Keypad Drawer */}
            {isKeypadOpen && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white w-64 mb-2 animate-fade-in">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Touch Tone Keypad</span>
                        <button 
                            onClick={() => setIsKeypadOpen(false)}
                            className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-0.5 rounded bg-slate-800"
                        >
                            Close
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                            <button
                                key={digit}
                                onClick={() => handleKeypadPress(digit)}
                                className="h-10 rounded-xl bg-slate-800 hover:bg-emerald-600 active:scale-95 text-white font-bold text-base transition-all flex items-center justify-center border border-slate-700/50"
                            >
                                {digit}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Persistent Floating Call Bar */}
            <div className={`flex items-center gap-3 p-3 px-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 ${
                callState === 'connected' 
                    ? 'bg-slate-900/95 text-white border-emerald-500/50 shadow-emerald-500/10' 
                    : callState === 'incoming'
                    ? 'bg-slate-900/95 text-white border-amber-500/50 shadow-amber-500/20 animate-pulse'
                    : 'bg-slate-900/95 text-white border-blue-500/50'
            }`}>
                {/* Status Indicator Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
                    callState === 'connected' ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                    <Phone size={18} className={callState === 'incoming' ? 'animate-bounce' : ''} />
                </div>

                {/* Call Info */}
                <div className="flex flex-col pr-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100 max-w-[140px] truncate">
                            {activeCall?.customerName || 'Customer Call'}
                        </span>
                        {callState === 'connected' && (
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                                {formatDuration(callDuration)}
                            </span>
                        )}
                        {callState === 'connecting' && (
                            <span className="text-xs text-amber-400 font-medium animate-pulse">
                                Calling...
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                        {activeCall?.phoneNumber}
                    </span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                    {/* Mute Button */}
                    <button
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                        className={`p-2 rounded-xl transition-all ${
                            isMuted 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    {/* Keypad Toggle */}
                    <button
                        onClick={() => setIsKeypadOpen(prev => !prev)}
                        title="Keypad"
                        className={`p-2 rounded-xl transition-all ${
                            isKeypadOpen 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        <Grid size={16} />
                    </button>

                    {/* Return to Communications Console */}
                    <button
                        onClick={handleReturnToConsole}
                        title="Open Communications Hub"
                        className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 text-xs font-bold"
                    >
                        <ExternalLink size={16} />
                    </button>

                    {/* End Call Button */}
                    <button
                        onClick={hangUp}
                        title="End Call"
                        className="p-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-1 text-xs"
                    >
                        <PhoneOff size={16} />
                        <span>End</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};
