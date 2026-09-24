import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTelephony, CallLogItem, VoicemailItem } from '../../context/TelephonyContext';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CustomerMasterModal from '../../components/modals/CustomerMasterModal';
import { TelephonySettingsModal } from './TelephonySettingsModal';
import { 
    Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, 
    Mic, MicOff, Volume2, Headphones, Play, Pause, RotateCcw, 
    Sparkles, Search, User, Calendar, FileText, CheckCircle2, 
    Archive, AlertCircle, Clock, Grid, ArrowUpRight, MessageSquare, 
    Wrench, Plus, Check, Settings, ShieldCheck, Zap, DollarSign, Loader2,
    Sliders, Bot, Delete, ChevronDown, MoreVertical, X, Bluetooth, RefreshCw, UserPlus, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../lib/toast';
import { db, functions } from '../../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const PhoneCenterView: React.FC = () => {
    const { 
        deviceStatus, deviceError, callState, activeCall, callDuration, 
        isMuted, isOnHold, availableAudioInputs, availableAudioOutputs, 
        selectedAudioInput, selectedAudioOutput, setSelectedAudioInput, 
        setSelectedAudioOutput, callLogs, voicemails, makeCall, 
        answerCall, rejectCall, hangUp, toggleMute, toggleHold, 
        sendDigits, markVoicemailStatus 
    } = useTelephony();

    const { state } = useAppContext();
    const { currentOrganization: org, currentUser: user, isDemoMode } = state;
    const navigate = useNavigate();

    // Mobile Top Navigation Tabs: 'keypad' | 'calls' | 'voicemail' | 'ai_notes'
    const [mobileTab, setMobileTab] = useState<'keypad' | 'calls' | 'voicemail' | 'ai_notes'>('keypad');

    // Desktop Left Panel Filter: 'all' | 'missed' | 'voicemails'
    const [desktopActivityFilter, setDesktopActivityFilter] = useState<'all' | 'missed' | 'voicemails'>('all');

    // In-Call DTMF Keypad Drawer State
    const [inCallShowKeypad, setInCallShowKeypad] = useState(false);

    // Call Transcript & Lead Modal State
    const [selectedCallLogForDetails, setSelectedCallLogForDetails] = useState<CallLogItem | null>(null);
    const [isConvertingLeadId, setIsConvertingLeadId] = useState<string | null>(null);

    // Master Admin / Owner check (Bypasses paywall entirely across all orgs and routes)
    const isMasterAdminUser = Boolean(
        user?.role === 'master_admin' || 
        (org as any)?.role === 'master_admin' ||
        org?.id === 'master' ||
        user?.email === 'rodzelem@gmail.com' || 
        user?.email === 'tektrakkerapp@gmail.com'
    );

    // Telephony Subscription / Activation Gate State
    const [isActivatingPhone, setIsActivatingPhone] = useState(false);
    const [agreedToBilling, setAgreedToBilling] = useState(false);
    const [hasCheckedActivation, setHasCheckedActivation] = useState(false);
    const [isPhoneSystemEnabled, setIsPhoneSystemEnabled] = useState<boolean>(() => {
        if (isDemoMode || isMasterAdminUser || org?.id === 'master') return true;
        return !!(org as any)?.phoneSystemEnabled || !!(org as any)?.telephonyActive;
    });

    // Customer Modal State
    const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);

    // Dialpad & Active Selected Call State
    const [dialedNumber, setDialedNumber] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedCustomerForContext, setSelectedCustomerForContext] = useState<any | null>(null);
    const [activeSelectedCall, setActiveSelectedCall] = useState<CallLogItem | null>(null);
    const [aiNotesEnabled, setAiNotesEnabled] = useState(true);

    // Auto-select latest call log if none selected
    useEffect(() => {
        if (!activeSelectedCall && callLogs && callLogs.length > 0) {
            setActiveSelectedCall(callLogs[0]);
        }
    }, [callLogs, activeSelectedCall]);

    // Audio Playback State for Voicemails & Recordings
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Audio Settings Modal & PBX Settings Modal
    const [showAudioSettings, setShowAudioSettings] = useState(false);
    const [showPbxSettings, setShowPbxSettings] = useState(false);

    // Live Microphone Volume Meter State for Bluetooth Testing
    const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
    const [isTestingMic, setIsTestingMic] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Dynamic Organization Data (No Hardcoding)
    const orgName = org?.name || 'TekTrakker Organization';
    const userInitials = (user?.firstName ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}` : user?.name?.slice(0, 2) || user?.email?.slice(0, 2) || 'TT').toUpperCase();
    
    // Dynamic Outbound Caller ID Line from Organization Settings or Twilio Profile
    const [provisionedTwilioNumber, setProvisionedTwilioNumber] = useState<string | null>(null);

    useEffect(() => {
        if (!org?.id) return;
        const fetchOrgNumber = async () => {
            try {
                const secretsDoc = await getDoc(doc(db, 'organizations', org.id, 'secrets', 'config'));
                if (secretsDoc.exists()) {
                    const data = secretsDoc.data();
                    if (data?.twilioConfig?.phoneNumber) {
                        setProvisionedTwilioNumber(data.twilioConfig.phoneNumber);
                    }
                }
            } catch (e) {}
        };
        fetchOrgNumber();
    }, [org?.id]);

    const callerIdInfo = useMemo(() => {
        const dedicatedTwilioNumber = provisionedTwilioNumber || (org as any)?.twilioPhoneNumber || (org as any)?.twilioConfig?.phoneNumber;
        
        if (dedicatedTwilioNumber) {
            const clean = dedicatedTwilioNumber.replace(/\D/g, '');
            const formatted = clean.length === 10 
                ? `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`
                : clean.length === 11 && clean.startsWith('1')
                    ? `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`
                    : dedicatedTwilioNumber;
            return {
                number: formatted,
                isDedicated: true,
                badge: 'Dedicated Line'
            };
        }

        // If no dedicated Twilio number has been provisioned yet, outbound calls route via the verified Platform Line
        return {
            number: '+1 (833) 960-2099',
            isDedicated: false,
            badge: 'Platform Outbound Line'
        };
    }, [org, provisionedTwilioNumber]);

    // Stop audio on component unmount or when navigating away
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch (e) {}
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Stop audio if a call begins or is active
    useEffect(() => {
        if (callState !== 'idle' && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            setPlayingAudioId(null);
        }
        if (callState === 'idle') {
            setInCallShowKeypad(false);
        }
    }, [callState]);

    // Check organization telephony activation status on mount
    useEffect(() => {
        if (!org?.id || isDemoMode || isMasterAdminUser || org?.id === 'master') {
            setIsPhoneSystemEnabled(true);
            setHasCheckedActivation(true);
            return;
        }

        const checkActivation = async () => {
            try {
                if ((org as any)?.phoneSystemEnabled || (org as any)?.telephonyActive) {
                    setIsPhoneSystemEnabled(true);
                    return;
                }

                const secretsDoc = await getDoc(doc(db, 'organizations', org.id, 'secrets', 'config'));
                if (secretsDoc.exists()) {
                    const data = secretsDoc.data();
                    if (data?.twilioConfig?.subaccountSid || data?.phoneSystemEnabled || data?.telephonyActive) {
                        setIsPhoneSystemEnabled(true);
                        return;
                    }
                }
                setIsPhoneSystemEnabled(false);
            } catch (e) {
                console.debug('Phone activation check notice:', e);
                setIsPhoneSystemEnabled(false);
            } finally {
                setHasCheckedActivation(true);
            }
        };

        checkActivation();
    }, [org?.id, (org as any)?.phoneSystemEnabled, isDemoMode, isMasterAdminUser]);

    // Handle Phone System Opt-In & Subaccount Creation
    const handleActivatePhoneSystem = async () => {
        if (!agreedToBilling) {
            showToast.error('Please agree to the telephony usage terms and monthly billing.');
            return;
        }

        if (!org?.id) {
            showToast.error('Organization details missing.');
            return;
        }

        setIsActivatingPhone(true);
        try {
            const provisionFn = functions.httpsCallable('provisionOrgTwilioSubaccount');
            await provisionFn({
                organizationId: org.id,
                friendlyName: org.name || 'TekTrakker Organization'
            });

            // Mark organization as enabled in Firestore
            await updateDoc(doc(db, 'organizations', org.id), {
                phoneSystemEnabled: true,
                telephonyActive: true,
                telephonyAgreementAcceptedAt: new Date().toISOString(),
                telephonyAgreementAcceptedBy: user?.email || user?.id
            }).catch(() => {});

            setIsPhoneSystemEnabled(true);
            showToast.success('TekTrakker Phone System & Dedicated Subaccount successfully activated!');
            
            // Auto-refresh provisioned phone number
            const secretsDoc = await getDoc(doc(db, 'organizations', org.id, 'secrets', 'config'));
            if (secretsDoc.exists() && secretsDoc.data()?.twilioConfig?.phoneNumber) {
                setProvisionedTwilioNumber(secretsDoc.data().twilioConfig.phoneNumber);
            }
        } catch (e: any) {
            console.error('Activation error:', e);
            showToast.error(`Could not activate telephony: ${e.message}`);
        } finally {
            setIsActivatingPhone(false);
        }
    };

    // 1-Click Dedicated Local Number Provisioning
    const [isAssigningNumber, setIsAssigningNumber] = useState(false);
    const handleAssignDedicatedNumber = async () => {
        if (!org?.id) return;
        setIsAssigningNumber(true);
        try {
            const assignFn = functions.httpsCallable('assignOrgTwilioNumber');
            const result: any = await assignFn({ organizationId: org.id });
            if (result?.data?.phoneNumber) {
                setProvisionedTwilioNumber(result.data.phoneNumber);
                showToast.success(`Dedicated local phone number ${result.data.phoneNumber} successfully provisioned!`);
            }
        } catch (e: any) {
            console.error('Assign number error:', e);
            showToast.error(`Could not provision number: ${e.message}`);
        } finally {
            setIsAssigningNumber(false);
        }
    };

    // Bluetooth Microphone Live Testing
    const toggleMicTest = async () => {
        if (isTestingMic) {
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
                micStreamRef.current = null;
            }
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch (e) {}
                audioContextRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setIsTestingMic(false);
            setMicVolumeLevel(0);
            return;
        }

        try {
            const constraints: MediaStreamConstraints = {
                audio: selectedAudioInput && selectedAudioInput !== 'default' 
                    ? { deviceId: { exact: selectedAudioInput } }
                    : true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            micStreamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            setIsTestingMic(true);

            const updateMeter = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const normalized = Math.min(100, Math.round((avg / 128) * 100));
                setMicVolumeLevel(normalized);
                animationFrameRef.current = requestAnimationFrame(updateMeter);
            };
            updateMeter();
        } catch (err) {
            console.error('Mic test error:', err);
            showToast.error('Could not access microphone or Bluetooth audio input.');
            setIsTestingMic(false);
        }
    };

    // Bluetooth / Speaker Audio Test Chime
    const playSpeakerTestChime = () => {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        if (selectedAudioOutput && selectedAudioOutput !== 'default' && (audio as any).setSinkId) {
            (audio as any).setSinkId(selectedAudioOutput).catch((e: any) => console.debug('Set sink ID notice:', e));
        }
        audio.play().then(() => {
            showToast.success('Test sound played through selected speaker/headset');
        }).catch(() => {
            showToast.info('Testing audio output...');
        });
    };

    // Keypad circular buttons map
    const keypadButtons = [
        { digit: '1', letters: '' },
        { digit: '2', letters: 'ABC' },
        { digit: '3', letters: 'DEF' },
        { digit: '4', letters: 'GHI' },
        { digit: '5', letters: 'JKL' },
        { digit: '6', letters: 'MNO' },
        { digit: '7', letters: 'PQRS' },
        { digit: '8', letters: 'TUV' },
        { digit: '9', letters: 'WXYZ' },
        { digit: '*', letters: '' },
        { digit: '0', letters: '+' },
        { digit: '#', letters: '' },
    ];

    // Keypad Click Handler
    const handleDigitClick = (digit: string) => {
        if (callState === 'connected' || callState === 'connecting') {
            sendDigits(digit);
        } else {
            setDialedNumber(prev => prev + digit);
        }
    };

    const handleBackspace = () => {
        setDialedNumber(prev => prev.slice(0, -1));
    };

    // Place Call Handler
    const handleStartCall = async (phoneToCall?: string, customer?: any) => {
        const target = phoneToCall || dialedNumber;
        if (!target.trim()) {
            showToast.error('Please enter a phone number to call');
            return;
        }
        await makeCall(target, customer?.id, customer?.name);
    };

    // Match customer when dialed number changes
    useEffect(() => {
        if (!dialedNumber.trim()) {
            setSelectedCustomerForContext(null);
            return;
        }
        const clean = dialedNumber.replace(/\D/g, '');
        if (clean.length >= 7 && state.customers) {
            const found = state.customers.find(c => 
                c.phone && c.phone.replace(/\D/g, '').includes(clean)
            );
            if (found) setSelectedCustomerForContext(found);
        }
    }, [dialedNumber, state.customers]);

    // Customer match when active call changes
    useEffect(() => {
        if (activeCall?.customerId && state.customers) {
            const found = state.customers.find(c => c.id === activeCall.customerId);
            if (found) setSelectedCustomerForContext(found);
        } else if (activeCall?.phoneNumber && state.customers) {
            const clean = activeCall.phoneNumber.replace(/\D/g, '');
            const found = state.customers.find(c => 
                c.phone && c.phone.replace(/\D/g, '') === clean
            );
            if (found) setSelectedCustomerForContext(found);
        }
    }, [activeCall, state.customers]);

    // Customer match when activeSelectedCall changes
    useEffect(() => {
        if (!activeSelectedCall) return;
        const phone = activeSelectedCall.direction === 'inbound' ? activeSelectedCall.from : activeSelectedCall.to;
        if (phone && state.customers) {
            const clean = phone.replace(/\D/g, '');
            if (clean.length >= 7) {
                const found = state.customers.find(c => 
                    c.phone && c.phone.replace(/\D/g, '').includes(clean)
                );
                if (found) {
                    setSelectedCustomerForContext(found);
                    return;
                }
            }
        }
    }, [activeSelectedCall, state.customers]);

    // Format Duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Play/Pause Voicemail or Call Recording
    const handleToggleAudio = (id: string, url?: string) => {
        if (playingAudioId === id) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            setPlayingAudioId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }

            if (!url) {
                showToast.info('Recording audio preview ready.');
                return;
            }

            const audio = new Audio(url);
            audio.playbackRate = playbackRate;
            audio.onended = () => {
                setPlayingAudioId(null);
                audioRef.current = null;
            };
            audio.onerror = () => {
                setPlayingAudioId(null);
                audioRef.current = null;
                showToast.info('Audio playback completed.');
            };

            audio.play().catch(e => {
                console.debug('Audio play note:', e);
                setPlayingAudioId(null);
            });

            audioRef.current = audio;
            setPlayingAudioId(id);
        }
    };

    const handleSpeedChange = () => {
        const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
        setPlaybackRate(nextRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    // Format dialed number visually
    const formatDisplayNumber = (num: string) => {
        const clean = num.replace(/\D/g, '');
        if (clean.length === 10) {
            return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
        } else if (clean.length === 11 && clean.startsWith('1')) {
            return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
        }
        return num;
    };

    // Filtered Call History
    const filteredCallLogs = useMemo(() => {
        return callLogs.filter(log => {
            if (desktopActivityFilter === 'missed' && log.direction !== 'missed' && log.status !== 'no-answer') return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (log.callerName || '').toLowerCase().includes(q) ||
                   (log.from || '').toLowerCase().includes(q) ||
                   (log.to || '').toLowerCase().includes(q) ||
                   (log.aiSummary || '').toLowerCase().includes(q);
        });
    }, [callLogs, desktopActivityFilter, searchQuery]);

    // Filtered Voicemails
    const filteredVoicemails = useMemo(() => {
        return voicemails.filter(vm => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (vm.callerName || '').toLowerCase().includes(q) ||
                   (vm.from || '').toLowerCase().includes(q) ||
                   (vm.transcription || '').toLowerCase().includes(q) ||
                   (vm.aiSummary || '').toLowerCase().includes(q);
        });
    }, [voicemails, searchQuery]);

    const unreadVmCount = voicemails.filter(v => v.status === 'new').length;
    const missedCount = useMemo(() => callLogs.filter(log => log.direction === 'missed' || log.status === 'no-answer' || log.status === 'missed').length, [callLogs]);

    // Convert Call Log / AI Transcript to CRM Lead
    const handleConvertToLead = async (log: CallLogItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsConvertingLeadId(log.id);
        try {
            const callerNumber = log.from || '';
            const callerName = log.callerName && log.callerName !== callerNumber ? log.callerName : 'Inbound AI Lead';
            const notes = `Source: AI Voice Call (${log.direction})\nSummary: ${log.aiSummary || 'No summary'}\n\nTranscript:\n${log.transcription || 'No transcript'}`;

            // 1. If Master Admin / Platform, save to platformLeads
            if (isMasterAdminUser || org?.id === 'platform' || org?.id === 'master') {
                await db.collection('platformLeads').add({
                    name: callerName,
                    phone: callerNumber,
                    company: 'Inbound AI Call Lead',
                    source: '24/7 AI Voice Receptionist (Ava)',
                    status: 'New',
                    value: 1200,
                    notes,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            }

            // 2. Also save to current organization leads
            const orgId = org?.id || 'platform';
            await db.collection('organizations').doc(orgId).collection('leads').add({
                name: callerName,
                phone: callerNumber,
                source: 'AI Voice Receptionist (Ava)',
                status: 'new',
                notes,
                createdAt: new Date().toISOString()
            });

            // 3. Update call log with isLeadCreated
            await db.collection('organizations').doc(orgId).collection('call_logs').doc(log.id).set({
                isLeadCreated: true
            }, { merge: true });

            if (selectedCallLogForDetails?.id === log.id) {
                setSelectedCallLogForDetails({ ...selectedCallLogForDetails, isLeadCreated: true } as any);
            }

            showToast.success(`Lead successfully created for ${callerName}!`);
        } catch (err: any) {
            showToast.error(`Failed to create lead: ${err.message}`);
        } finally {
            setIsConvertingLeadId(null);
        }
    };

    // Helper: is device bluetooth
    const isBluetoothDevice = (label?: string) => {
        if (!label) return false;
        const l = label.toLowerCase();
        return l.includes('bluetooth') || l.includes('airpod') || l.includes('buds') || l.includes('jabra') || l.includes('hands-free') || l.includes('headset') || l.includes('wh-') || l.includes('wf-');
    };

    // Active In-Call Console Component (Shared for Mobile and Desktop)
    const renderActiveInCallConsole = () => (
        <div className="flex-1 flex flex-col justify-between p-4 space-y-4 animate-fade-in text-white min-h-0">
            {/* Top In-Call Status Header */}
            <div className="text-center space-y-1 pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400">
                        {callState === 'connecting' ? 'Calling...' : callState === 'incoming' ? 'Incoming Call' : 'HD Voice Live'}
                    </span>
                    {callState === 'connected' && (
                        <span className="font-mono text-white font-black pl-1 border-l border-slate-700">
                            {formatDuration(callDuration)}
                        </span>
                    )}
                </div>

                <h3 className="text-xl font-black text-white truncate pt-1">
                    {activeCall?.customerName || (activeCall?.phoneNumber ? formatDisplayNumber(activeCall.phoneNumber) : 'Unknown Caller')}
                </h3>
                <p className="text-xs font-mono text-slate-400 font-bold">
                    {activeCall?.phoneNumber ? formatDisplayNumber(activeCall.phoneNumber) : dialedNumber}
                </p>
                {isOnHold && (
                    <span className="inline-block bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        Call On Hold
                    </span>
                )}
            </div>

            {/* In-Call Keypad (if toggled open) */}
            {inCallShowKeypad ? (
                <div className="grid grid-cols-3 gap-x-4 gap-y-3 max-w-[260px] mx-auto py-1">
                    {keypadButtons.map(({ digit, letters }) => (
                        <button
                            key={digit}
                            type="button"
                            onClick={() => handleDigitClick(digit)}
                            className="w-14 h-14 rounded-full bg-[#2d323c] hover:bg-[#3b424f] active:scale-95 text-white font-semibold text-xl transition-all flex flex-col items-center justify-center shadow-md select-none group"
                        >
                            <span className="leading-none">{digit}</span>
                            {letters && (
                                <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase -mt-0.5">
                                    {letters}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            ) : (
                /* In-Call 6-Button Control Pad */
                <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto py-2">
                    {/* Mute Toggle */}
                    <button
                        type="button"
                        onClick={toggleMute}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                            isMuted ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'bg-[#2d323c] hover:bg-[#3b424f] text-slate-200'
                        }`}
                    >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        <span className="text-[10px] font-bold mt-1">{isMuted ? 'Muted' : 'Mute'}</span>
                    </button>

                    {/* DTMF Keypad Toggle */}
                    <button
                        type="button"
                        onClick={() => setInCallShowKeypad(prev => !prev)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                            inCallShowKeypad ? 'bg-blue-600 text-white' : 'bg-[#2d323c] hover:bg-[#3b424f] text-slate-200'
                        }`}
                    >
                        <Grid size={22} />
                        <span className="text-[10px] font-bold mt-1">Keypad</span>
                    </button>

                    {/* Hold Toggle */}
                    <button
                        type="button"
                        onClick={toggleHold}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                            isOnHold ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40' : 'bg-[#2d323c] hover:bg-[#3b424f] text-slate-200'
                        }`}
                    >
                        {isOnHold ? <Play size={22} /> : <Pause size={22} />}
                        <span className="text-[10px] font-bold mt-1">{isOnHold ? 'Unhold' : 'Hold'}</span>
                    </button>

                    {/* Bluetooth & Audio Devices */}
                    <button
                        type="button"
                        onClick={() => setShowAudioSettings(true)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#2d323c] hover:bg-[#3b424f] text-slate-200 transition-all"
                    >
                        <Bluetooth size={22} className="text-blue-400" />
                        <span className="text-[10px] font-bold mt-1">Audio</span>
                    </button>

                    {/* AI Notes */}
                    <button
                        type="button"
                        onClick={() => setAiNotesEnabled(prev => !prev)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                            aiNotesEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#2d323c] text-slate-400'
                        }`}
                    >
                        <Sparkles size={22} />
                        <span className="text-[10px] font-bold mt-1">AI Notes</span>
                    </button>

                    {/* Transfer Call */}
                    <button
                        type="button"
                        onClick={() => setShowPbxSettings(true)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#2d323c] hover:bg-[#3b424f] text-slate-200 transition-all"
                    >
                        <Bot size={22} className="text-amber-400" />
                        <span className="text-[10px] font-bold mt-1">PBX / AI</span>
                    </button>
                </div>
            )}

            {/* Primary Action Row (Hang Up / Answer) */}
            <div className="flex items-center justify-center gap-6 pt-2">
                {callState === 'incoming' ? (
                    <>
                        <button
                            type="button"
                            onClick={answerCall}
                            className="w-18 h-18 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-emerald-900/50 transition-all"
                            title="Answer Call"
                        >
                            <Phone size={28} className="fill-current" />
                        </button>
                        <button
                            type="button"
                            onClick={rejectCall}
                            className="w-18 h-18 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-900/50 transition-all"
                            title="Decline Call"
                        >
                            <PhoneOff size={28} />
                        </button>
                    </>
                ) : (
                    /* BIG RED HANG UP BUTTON */
                    <button
                        type="button"
                        onClick={hangUp}
                        className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-rose-900/60 transition-all"
                        title="Hang Up Call"
                    >
                        <PhoneOff size={32} />
                    </button>
                )}
            </div>
        </div>
    );

    // ONBOARDING / OPT-IN ACTIVATION SCREEN (Client tenant orgs only, never master admin or system owners)
    if (!isPhoneSystemEnabled && hasCheckedActivation && !isMasterAdminUser && org?.id !== 'master') {
        return (
            <div className="flex-1 flex items-center justify-center p-4 animate-fade-in">
                <Card className="max-w-xl w-full p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 rounded-3xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-md">
                            <PhoneCall size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Activate {orgName} Dedicated Telephony
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                            Empower your team with a dedicated business phone system, Bluetooth headset calling, and 24/7 AI voice receptionist.
                        </p>
                    </div>

                    <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-800/60 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={agreedToBilling}
                                onChange={e => setAgreedToBilling(e.target.checked)}
                                className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 dark:border-slate-700"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                I agree to activate the dedicated TekTrakker Phone & Cloud PBX service for <strong>{orgName}</strong>. I authorize monthly line provisioning ($15/mo) and standard usage billing ($0.035/voice min, $0.02/SMS) charged to our organization payment method.
                            </span>
                        </label>
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            disabled={!agreedToBilling || isActivatingPhone}
                            onClick={handleActivatePhoneSystem}
                            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
                                agreedToBilling && !isActivatingPhone
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 active:scale-98'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isActivatingPhone ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Provisioning Dedicated Twilio Subaccount & Phone Line...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={18} />
                                    <span>Subscribe & Activate Phone System</span>
                                </>
                            )}
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative animate-fade-in p-2 sm:p-4">
            
            {/* Customer Master Modal Integration */}
            {viewingCustomerId && (
                <CustomerMasterModal
                    isOpen={!!viewingCustomerId}
                    onClose={() => setViewingCustomerId(null)}
                    customerId={viewingCustomerId}
                />
            )}

            {/* PBX & AI Receptionist Studio Modal */}
            <TelephonySettingsModal
                isOpen={showPbxSettings}
                onClose={() => setShowPbxSettings(false)}
            />

            {/* =========================================================================
                1. MOBILE VIEW (< 1024px) - RINGCENTRAL / WHATSAPP COMPACT NATIVE DESIGN
            ========================================================================== */}
            <div className="lg:hidden flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden">
                <div className="w-full max-w-[420px] h-full max-h-[860px] flex flex-col bg-[#1e222b] text-white rounded-[32px] shadow-2xl border border-slate-800 overflow-hidden relative">
                    
                    {/* Mobile Header */}
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                                    {userInitials}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#1e222b] flex items-center justify-center">
                                    <Check size={8} className="text-white stroke-[3]" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white leading-tight">Phone</h2>
                                <p className="text-[11px] text-slate-400 font-medium">{orgName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowPbxSettings(true)}
                                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                                title="PBX & AI Studio"
                            >
                                <Bot size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAudioSettings(true)}
                                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                                title="Bluetooth & Audio Settings"
                            >
                                <Headphones size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Tabs */}
                    <div className="flex items-center border-b border-slate-800 px-3">
                        {(['keypad', 'calls', 'voicemail', 'ai_notes'] as const).map(tabKey => (
                            <button
                                key={tabKey}
                                type="button"
                                onClick={() => setMobileTab(tabKey)}
                                className={`flex-1 py-3 text-xs font-bold transition-all relative text-center capitalize ${
                                    mobileTab === tabKey ? 'text-blue-400 font-black' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {tabKey === 'ai_notes' ? 'Notes' : tabKey}
                                {tabKey === 'voicemail' && unreadVmCount > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1"></span>
                                )}
                                {mobileTab === tabKey && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-500 rounded-t-full shadow-sm shadow-blue-500/50"></span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Mobile Tab Content */}
                    {mobileTab === 'keypad' && (
                        callState !== 'idle' ? (
                            renderActiveInCallConsole()
                        ) : (
                            <div className="flex-1 flex flex-col justify-between px-6 py-3 min-h-0 overflow-hidden select-none no-scrollbar">
                                {/* Caller ID Line */}
                                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1 flex-wrap">
                                    <span>Caller ID:</span>
                                    <span className="font-mono text-slate-200 font-bold">{callerIdInfo.number}</span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${callerIdInfo.isDedicated ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {callerIdInfo.badge}
                                    </span>
                                    {!callerIdInfo.isDedicated && (
                                        <button
                                            type="button"
                                            onClick={handleAssignDedicatedNumber}
                                            disabled={isAssigningNumber}
                                            className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                            title="Provision a dedicated local number for your area code"
                                        >
                                            {isAssigningNumber ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                            <span>Get Local Number</span>
                                        </button>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="relative py-2 flex flex-col items-center justify-center min-h-[54px]">
                                    <input
                                        type="text"
                                        value={formatDisplayNumber(dialedNumber)}
                                        onChange={e => setDialedNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter a name or number"
                                        className="w-full bg-transparent text-center font-mono text-2xl font-bold text-white placeholder:text-slate-500 placeholder:font-sans placeholder:text-base placeholder:font-normal focus:outline-none tracking-wider"
                                    />
                                    {selectedCustomerForContext && (
                                        <div 
                                            onClick={() => setViewingCustomerId(selectedCustomerForContext.id)}
                                            className="mt-1 px-3 py-1 bg-blue-900/40 border border-blue-700/50 rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-blue-800/40 transition-colors"
                                        >
                                            <User size={12} className="text-blue-400" />
                                            <span className="text-xs font-bold text-blue-200">{selectedCustomerForContext.name}</span>
                                            <ArrowUpRight size={11} className="text-blue-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Circular Keypad */}
                                <div className="grid grid-cols-3 gap-x-5 gap-y-3.5 max-w-[280px] mx-auto my-auto py-2">
                                    {keypadButtons.map(({ digit, letters }) => (
                                        <button
                                            key={digit}
                                            type="button"
                                            onClick={() => handleDigitClick(digit)}
                                            className="w-16 h-16 rounded-full bg-[#2d323c] hover:bg-[#3b424f] active:scale-95 text-white font-semibold text-2xl transition-all flex flex-col items-center justify-center shadow-md select-none group"
                                        >
                                            <span className="leading-none">{digit}</span>
                                            {letters && (
                                                <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase -mt-0.5">
                                                    {letters}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Call Button & Action Row */}
                                <div className="flex items-center justify-around pt-3 px-2">
                                    <button
                                        type="button"
                                        onClick={() => setAiNotesEnabled(prev => !prev)}
                                        className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors w-16"
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            aiNotesEnabled ? 'bg-slate-800 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-slate-800/60 text-slate-500'
                                        }`}>
                                            <Sparkles size={16} />
                                        </div>
                                        <span className="text-[9px] font-bold">Notes on</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleStartCall()}
                                        className="w-16 h-16 rounded-full bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-white flex items-center justify-center shadow-xl shadow-emerald-900/40 transition-all"
                                    >
                                        <Phone size={26} className="fill-current" />
                                    </button>

                                    <div className="w-16 flex flex-col items-center">
                                        {dialedNumber ? (
                                            <button
                                                type="button"
                                                onClick={handleBackspace}
                                                className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        ) : (
                                            <div className="w-10 h-10"></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {mobileTab === 'calls' && (
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {filteredCallLogs.map(log => (
                                <div
                                    key={log.id}
                                    onClick={() => setSelectedCallLogForDetails(log)}
                                    className="p-3 rounded-2xl bg-[#252a35] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                                log.direction === 'inbound' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'
                                            }`}>
                                                {log.direction === 'inbound' ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />}
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-xs text-white">{log.callerName || log.from}</h4>
                                                <p className="text-[10px] font-mono text-slate-400">{log.direction === 'inbound' ? log.from : log.to}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                            {log.timestamp ? new Date(log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    {log.aiSummary && <p className="text-[10px] text-slate-300 italic pt-1 border-t border-slate-800">"{log.aiSummary}"</p>}
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDialedNumber(log.direction === 'inbound' ? log.from : log.to);
                                                setMobileTab('keypad');
                                            }}
                                            className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            <Phone size={10} /> Call Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleConvertToLead(log, e)}
                                            disabled={isConvertingLeadId === log.id || (log as any).isLeadCreated}
                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                                                (log as any).isLeadCreated 
                                                    ? 'bg-emerald-900/60 text-emerald-300' 
                                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                                            }`}
                                        >
                                            <UserPlus size={10} />
                                            {(log as any).isLeadCreated ? 'Lead Created' : 'Move to Lead'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {mobileTab === 'voicemail' && (
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                            {filteredVoicemails.map(vm => (
                                <div key={vm.id} className="p-3 rounded-2xl bg-[#252a35] border border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-extrabold text-xs text-white">{vm.callerName || vm.from}</h4>
                                            <p className="text-[10px] font-mono text-slate-400">{vm.from}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                            {vm.timestamp ? new Date(vm.timestamp.toDate ? vm.timestamp.toDate() : vm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    {vm.transcription && <div className="bg-[#181a20] p-2 rounded-xl text-xs text-slate-300 italic">"{vm.transcription}"</div>}
                                    <div className="flex items-center justify-between pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleAudio(vm.id, vm.recordingUrl)}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                                        >
                                            {playingAudioId === vm.id ? <Pause size={13} /> : <Play size={13} />}
                                            <span>{playingAudioId === vm.id ? 'Stop' : 'Play'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleStartCall(vm.from, { name: vm.callerName, id: vm.customerId });
                                                setMobileTab('keypad');
                                            }}
                                            className="p-1.5 bg-emerald-900 text-emerald-300 rounded-xl"
                                        >
                                            <Phone size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {mobileTab === 'ai_notes' && (
                        <div className="flex-1 p-4 overflow-y-auto space-y-3">
                            <div className="bg-[#252a35] p-3.5 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center gap-2 text-amber-400">
                                    <Sparkles size={16} />
                                    <h3 className="text-xs font-black uppercase">24/7 AI Voice Receptionist</h3>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Your incoming company calls are answered in natural voice, transcribed, and logged to CRM profiles.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowPbxSettings(true)}
                                    className="w-full py-2 bg-blue-600 rounded-xl text-xs font-bold text-white shadow-md"
                                >
                                    Open PBX & AI Studio
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================================
                2. DESKTOP VIEW (>= 1024px) - PRO UNIFIED COMMUNICATIONS COMMAND CENTER
            ========================================================================== */}
            <div className="hidden lg:flex flex-1 flex-col gap-6 overflow-y-auto w-full max-w-[1680px] mx-auto custom-scrollbar pr-1 pb-10">

                {/* TOP SECTION: TWO MAIN BOXES (ACTIVITY HUB & PRO SOFTPHONE DIALER) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[580px]">

                    {/* LEFT PANEL: ACTIVITY HUB & INBOX (7 Cols) */}
                    <Card className="lg:col-span-7 flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl bg-white dark:bg-slate-900 min-h-[580px] max-h-[640px]">
                        
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 space-y-3 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                        {userInitials}
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                            {orgName}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium flex items-center gap-1.5">
                                            <span>{callerIdInfo.number}</span>
                                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${callerIdInfo.isDedicated ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                                {callerIdInfo.badge}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <span className="flex h-2 w-2 relative">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${deviceStatus === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${deviceStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize">
                                        {deviceStatus === 'ready' ? 'HD Voice Live' : deviceStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setDesktopActivityFilter('all')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${desktopActivityFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    All Calls ({callLogs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDesktopActivityFilter('missed')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all relative ${desktopActivityFilter === 'missed' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    Missed
                                    {missedCount > 0 && (
                                        <span className="ml-1 bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                                            {missedCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDesktopActivityFilter('voicemails')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all relative ${desktopActivityFilter === 'voicemails' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    Voicemail
                                    {unreadVmCount > 0 && (
                                        <span className="ml-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                                            {unreadVmCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    placeholder="Search customer, number, or transcript..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Activity List Container */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                            {desktopActivityFilter === 'voicemails' ? (
                                filteredVoicemails.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 space-y-2">
                                        <Headphones size={32} className="mx-auto opacity-30 text-indigo-500" />
                                        <p className="text-xs font-semibold">No voicemails in inbox.</p>
                                    </div>
                                ) : (
                                    filteredVoicemails.map(vm => (
                                        <div 
                                            key={vm.id}
                                            className={`p-3.5 rounded-2xl border transition-all ${
                                                vm.status === 'new' 
                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 shadow-xs' 
                                                    : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                                                        {vm.callerName || vm.from}
                                                    </h4>
                                                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                        {vm.from}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] text-slate-400">
                                                    {vm.timestamp ? new Date(vm.timestamp.toDate ? vm.timestamp.toDate() : vm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>

                                            {vm.transcription && (
                                                <div className="bg-white/90 dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 mb-2 italic">
                                                    "{vm.transcription}"
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleAudio(vm.id, vm.recordingUrl)}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                                                            playingAudioId === vm.id
                                                                ? 'bg-rose-600 text-white'
                                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                        }`}
                                                    >
                                                        {playingAudioId === vm.id ? <Pause size={13} /> : <Play size={13} />}
                                                        <span>{playingAudioId === vm.id ? 'Stop Audio' : 'Play Voicemail'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleSpeedChange}
                                                        className="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black border border-slate-200 dark:border-slate-700"
                                                    >
                                                        {playbackRate}x
                                                    </button>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleStartCall(vm.from, { name: vm.callerName, id: vm.customerId })}
                                                    className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 transition-colors"
                                                    title="Call Back"
                                                >
                                                    <Phone size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                filteredCallLogs.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 space-y-2">
                                        <PhoneCall size={32} className="mx-auto opacity-30 text-blue-500" />
                                        <p className="text-xs font-semibold">No call records found.</p>
                                    </div>
                                ) : (
                                    filteredCallLogs.map(log => {
                                        const isSelected = activeSelectedCall?.id === log.id;
                                        return (
                                            <div
                                                key={log.id}
                                                onClick={() => {
                                                    setActiveSelectedCall(log);
                                                    setSelectedCallLogForDetails(log);
                                                    setDialedNumber(log.direction === 'inbound' ? log.from : log.to);
                                                }}
                                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 group shadow-xs ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/50'
                                                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                                                            log.direction === 'inbound' 
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                                                                : log.direction === 'missed' 
                                                                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' 
                                                                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            {log.direction === 'inbound' ? <PhoneIncoming size={15} /> : log.direction === 'missed' ? <PhoneMissed size={15} /> : <PhoneOutgoing size={15} />}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {log.callerName || (log.direction === 'inbound' ? log.from : log.to)}
                                                            </h4>
                                                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                                {log.direction === 'inbound' ? log.from : log.to}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="text-[10px] text-slate-400 block">
                                                            {log.timestamp ? new Date(log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                        {log.durationSeconds !== undefined && log.durationSeconds > 0 && (
                                                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                                {formatDuration(log.durationSeconds)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {log.aiSummary && (
                                                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5 border border-slate-200/50 dark:border-slate-700/50">
                                                        <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-2">{log.aiSummary}</span>
                                                    </div>
                                                )}

                                                {/* Action Bar */}
                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDialedNumber(log.direction === 'inbound' ? log.from : log.to);
                                                        }}
                                                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                    >
                                                        <Phone size={11} /> Call Back
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleConvertToLead(log, e)}
                                                        disabled={isConvertingLeadId === log.id || (log as any).isLeadCreated}
                                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all ${
                                                            (log as any).isLeadCreated 
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                                                                : 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-xs'
                                                        }`}
                                                    >
                                                        <UserPlus size={12} />
                                                        {(log as any).isLeadCreated ? 'Lead Created' : '⚡ Move to Leads'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>
                    </Card>

                    {/* RIGHT PANEL: PRO SOFTPHONE DIALER (5 Cols) */}
                    <div className="lg:col-span-5 flex flex-col bg-[#1e222b] text-white rounded-[36px] shadow-2xl border border-slate-800 p-6 justify-between overflow-hidden select-none min-h-[580px] max-h-[640px]">
                        
                        {/* Header Bar */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                                    TekTrakker Pro Softphone
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPbxSettings(true)}
                                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all"
                                    title="24/7 AI Receptionist & Routing"
                                >
                                    <Bot size={14} />
                                    <span>PBX Studio</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAudioSettings(true)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="Bluetooth & Audio Devices"
                                >
                                    <Bluetooth size={16} className="text-blue-400" />
                                </button>
                            </div>
                        </div>

                        {/* Softphone Dynamic View: In-Call vs Active Keypad */}
                        {callState !== 'idle' ? (
                            <div className="flex-1 flex flex-col justify-between py-4 animate-fade-in">
                                <div className="text-center space-y-2">
                                    <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10 animate-pulse">
                                        <User size={36} />
                                    </div>
                                    <h3 className="font-extrabold text-xl text-white">
                                        {activeCall?.customerName || activeCall?.phoneNumber || 'Active Call'}
                                    </h3>
                                    <p className="font-mono text-sm text-slate-400">
                                        {activeCall?.phoneNumber}
                                    </p>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-mono font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                        <span>{formatDuration(callDuration)}</span>
                                    </div>
                                </div>

                                {/* In-Call Audio Controls */}
                                <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                                    <button
                                        type="button"
                                        onClick={toggleMute}
                                        className={`p-3.5 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                                            isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                        <span className="text-[10px] font-bold">{isMuted ? 'Muted' : 'Mute'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleHold}
                                        className={`p-3.5 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                                            isOnHold ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        <Pause size={20} />
                                        <span className="text-[10px] font-bold">{isOnHold ? 'On Hold' : 'Hold'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setInCallShowKeypad(prev => !prev)}
                                        className={`p-3.5 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                                            inCallShowKeypad ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        <Grid size={20} />
                                        <span className="text-[10px] font-bold">Keypad</span>
                                    </button>
                                </div>

                                {/* In-Call DTMF Pad */}
                                {inCallShowKeypad && (
                                    <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto py-2">
                                        {['1','2','3','4','5','6','7','8','9','*','0','#'].map(digit => (
                                            <button
                                                key={digit}
                                                type="button"
                                                onClick={() => sendDigits(digit)}
                                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white active:scale-95"
                                            >
                                                {digit}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Hang Up Button */}
                                <div className="flex justify-center pt-2">
                                    <button
                                        type="button"
                                        onClick={hangUp}
                                        className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-900/40 transition-all"
                                        title="End Call"
                                    >
                                        <PhoneOff size={26} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-between pt-1">

                                {/* Caller ID Line & Dedicated Subaccount Status */}
                                <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400 py-1 px-3 bg-slate-900/60 rounded-xl mx-auto border border-slate-800/80 mb-1 flex-wrap">
                                    <span className="text-slate-500">Caller ID:</span>
                                    <span className="font-mono text-slate-200 font-bold">{callerIdInfo.number}</span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${callerIdInfo.isDedicated ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {callerIdInfo.badge}
                                    </span>
                                    {!callerIdInfo.isDedicated ? (
                                        <button
                                            type="button"
                                            onClick={handleAssignDedicatedNumber}
                                            disabled={isAssigningNumber}
                                            className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1 transition-all disabled:opacity-50 shadow-sm"
                                            title="Provision a dedicated local number for your area code"
                                        >
                                            {isAssigningNumber ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                            <span>Get Local Number</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowPbxSettings(true)}
                                            className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1 transition-all"
                                            title="Manage Twilio Subaccount & Routing"
                                        >
                                            <Settings size={10} />
                                            <span>Manage Line</span>
                                        </button>
                                    )}
                                </div>

                                {/* Number Display Input */}
                                <div className="relative py-2 flex flex-col items-center justify-center min-h-[50px]">
                                    <input
                                        type="text"
                                        value={formatDisplayNumber(dialedNumber)}
                                        onChange={e => setDialedNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter a name or number"
                                        className="w-full bg-transparent text-center font-mono text-2xl xl:text-3xl font-bold text-white placeholder:text-slate-500 placeholder:font-sans placeholder:text-base placeholder:font-normal focus:outline-none tracking-wider"
                                    />
                                    {selectedCustomerForContext && (
                                        <div 
                                            onClick={() => setViewingCustomerId(selectedCustomerForContext.id)}
                                            className="mt-1 px-3 py-1 bg-blue-900/40 border border-blue-700/50 rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-blue-800/40 transition-colors"
                                        >
                                            <User size={12} className="text-blue-400" />
                                            <span className="text-xs font-bold text-blue-200">{selectedCustomerForContext.name}</span>
                                            <ArrowUpRight size={11} className="text-blue-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Circular 3x4 Tactile Keypad */}
                                <div className="grid grid-cols-3 gap-x-6 gap-y-4 max-w-[300px] mx-auto py-2">
                                    {keypadButtons.map(({ digit, letters }) => (
                                        <button
                                            key={digit}
                                            type="button"
                                            onClick={() => handleDigitClick(digit)}
                                            className="w-18 h-18 rounded-full bg-[#2d323c] hover:bg-[#3b424f] active:scale-95 text-white font-semibold text-2xl transition-all flex flex-col items-center justify-center shadow-md select-none group"
                                        >
                                            <span className="leading-none">{digit}</span>
                                            {letters ? (
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-300 tracking-wider uppercase -mt-0.5">
                                                    {letters}
                                                </span>
                                            ) : (
                                                <span className="h-[6px]"></span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Bottom Action Row (Notes toggle | Big Green Call Button | Backspace) */}
                                <div className="flex items-center justify-around pt-3 px-2">
                                    {/* AI Notes Button */}
                                    <button
                                        type="button"
                                        onClick={() => setAiNotesEnabled(prev => !prev)}
                                        className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors w-16"
                                    >
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                                            aiNotesEnabled ? 'bg-slate-800 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-slate-800/60 text-slate-500'
                                        }`}>
                                            <Sparkles size={18} />
                                        </div>
                                        <span className="text-[10px] font-bold">Notes on</span>
                                    </button>

                                    {/* Big Green Call Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleStartCall()}
                                        className="w-18 h-18 rounded-full bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-white flex items-center justify-center shadow-xl shadow-emerald-900/40 transition-all"
                                        title="Place Call"
                                    >
                                        <Phone size={28} className="fill-current" />
                                    </button>

                                    {/* Backspace Button */}
                                    <div className="w-16 flex flex-col items-center">
                                        {dialedNumber ? (
                                            <button
                                                type="button"
                                                onClick={handleBackspace}
                                                className="w-11 h-11 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
                                                title="Delete Digit"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        ) : (
                                            <div className="w-11 h-11"></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* BOTTOM SECTION: LIVE 360° CALLER CRM INTELLIGENCE & AI TRANSCRIPTS DECK (Underneath Both Boxes) */}
                {(() => {
                    const displayedPhone = selectedCustomerForContext?.phone || (activeSelectedCall?.direction === 'inbound' ? activeSelectedCall?.from : activeSelectedCall?.to) || dialedNumber;
                    const displayedName = selectedCustomerForContext?.name || activeSelectedCall?.callerName || (activeSelectedCall ? 'Inbound AI Caller' : 'Customer / Caller');
                    const displayedTranscript = activeSelectedCall?.transcription || '';
                    const displayedSummary = activeSelectedCall?.aiSummary || '';
                    const displayedDuration = activeSelectedCall?.durationSeconds ? formatDuration(activeSelectedCall.durationSeconds) : '';
                    const displayedTime = activeSelectedCall?.timestamp ? (activeSelectedCall.timestamp.toDate ? activeSelectedCall.timestamp.toDate().toLocaleString() : new Date(activeSelectedCall.timestamp).toLocaleString()) : '';

                    return (
                        <Card className="w-full flex flex-col p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden shrink-0">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                                            Caller CRM Intelligence & AI Insights
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Live caller 360°, customer equipment, transcripts, and 1-click CRM conversion
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {selectedCustomerForContext ? (
                                        <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                                            <CheckCircle2 size={13} /> Matched CRM Customer
                                        </span>
                                    ) : activeSelectedCall ? (
                                        <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                                            <Sparkles size={13} /> Inbound AI Caller
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {activeSelectedCall || selectedCustomerForContext ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                                    {/* LEFT COLUMN: CALLER INFO & 1-CLICK ACTIONS (5 Cols) */}
                                    <div className="lg:col-span-5 space-y-4">
                                        {/* Caller Profile Card */}
                                        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-black text-lg text-slate-900 dark:text-white">
                                                        {displayedName}
                                                    </h4>
                                                    <p className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                                        <Phone size={12} /> {displayedPhone || 'No Phone Number'}
                                                    </p>
                                                </div>
                                                {activeSelectedCall && (
                                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        {displayedDuration || 'Completed'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                {selectedCustomerForContext?.email && (
                                                    <p className="truncate">✉️ {selectedCustomerForContext.email}</p>
                                                )}
                                                {selectedCustomerForContext?.address && (
                                                    <p className="truncate">📍 {selectedCustomerForContext.address}</p>
                                                )}
                                                {displayedTime && (
                                                    <p className="text-[11px] text-slate-400">🕒 {displayedTime}</p>
                                                )}
                                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">🤖 Handled by Ava</p>
                                            </div>
                                        </div>

                                        {/* 1-Click Action Buttons */}
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {activeSelectedCall && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleConvertToLead(activeSelectedCall, e)}
                                                    disabled={isConvertingLeadId === activeSelectedCall.id || (activeSelectedCall as any).isLeadCreated}
                                                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all col-span-2 ${
                                                        (activeSelectedCall as any).isLeadCreated
                                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md active:scale-95'
                                                    }`}
                                                >
                                                    <UserPlus size={14} />
                                                    {(activeSelectedCall as any).isLeadCreated ? '✓ Lead Saved to CRM' : '⚡ Move to CRM Leads'}
                                                </button>
                                            )}

                                            {selectedCustomerForContext && (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingCustomerId(selectedCustomerForContext.id)}
                                                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                                >
                                                    <ArrowUpRight size={13} /> Open CRM
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/operations?new=true&phone=${encodeURIComponent(displayedPhone || '')}`)}
                                                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                            >
                                                <Wrench size={13} /> Work Order
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/financials?tab=invoices&new=true&phone=${encodeURIComponent(displayedPhone || '')}`)}
                                                className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                            >
                                                <FileText size={13} /> New Invoice
                                            </button>

                                            {displayedPhone && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDialedNumber(displayedPhone);
                                                        handleStartCall(displayedPhone);
                                                    }}
                                                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                                >
                                                    <Phone size={13} /> Dial Caller
                                                </button>
                                            )}
                                        </div>

                                        {/* Equipment on File */}
                                        {selectedCustomerForContext?.equipment && selectedCustomerForContext.equipment.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                <h5 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Wrench size={13} className="text-amber-500" /> Equipment on File ({selectedCustomerForContext.equipment.length})
                                                </h5>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {selectedCustomerForContext.equipment.map((eq: any, idx: number) => (
                                                        <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                                            <p className="font-bold text-slate-800 dark:text-slate-200">{eq.name || eq.type || 'HVAC Unit'}</p>
                                                            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{eq.model || 'Model N/A'} • SN: {eq.serial || 'N/A'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Past Dispatch Calls / Invoices */}
                                        {selectedCustomerForContext?.invoices && selectedCustomerForContext.invoices.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                <h5 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <FileText size={13} className="text-emerald-500" /> Recent Billing ({selectedCustomerForContext.invoices.length})
                                                </h5>
                                                <div className="space-y-1.5">
                                                    {selectedCustomerForContext.invoices.slice(0, 3).map((inv: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">Invoice #{inv.number || idx + 1}</span>
                                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${Number(inv.total || 0).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* RIGHT COLUMN: AI SUMMARY & FULL SPOKEN TRANSCRIPT (7 Cols) */}
                                    <div className="lg:col-span-7 space-y-4">
                                        {/* AI Summary Banner */}
                                        {displayedSummary ? (
                                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black text-xs uppercase tracking-wider">
                                                    <Sparkles size={14} className="text-amber-600" />
                                                    AI Conversation Summary
                                                </div>
                                                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {displayedSummary}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 italic">
                                                Inbound call session logged with Ava (24/7 AI Voice Assistant).
                                            </div>
                                        )}

                                        {/* Spoken Transcript Box */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h5 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <MessageSquare size={13} className="text-blue-500" /> Complete Spoken Transcript
                                                </h5>
                                                {displayedTranscript && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(displayedTranscript);
                                                            showToast.success('Transcript copied to clipboard!');
                                                        }}
                                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                                                    >
                                                        <Copy size={11} /> Copy
                                                    </button>
                                                )}
                                            </div>

                                            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 max-h-72 overflow-y-auto custom-scrollbar font-mono text-xs text-slate-200 space-y-2 leading-relaxed whitespace-pre-wrap">
                                                {displayedTranscript || 'No speech transcript recorded for this session yet.'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400 space-y-3 my-auto">
                                    <User size={44} className="mx-auto opacity-20 text-blue-500" />
                                    <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300">Live Customer Intelligence Ready</h4>
                                    <p className="text-xs max-w-sm mx-auto text-slate-400">
                                        Click any call record in the list above or dial a number to view live customer equipment, conversation transcripts, and 1-click CRM conversion.
                                    </p>
                                </div>
                            )}
                        </Card>
                    );
                })()}
            </div>

            {/* BLUETOOTH & AUDIO SETTINGS MODAL */}
            {showAudioSettings && (
                <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e222b] text-white border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Bluetooth size={22} className="text-blue-400" />
                                <h3 className="font-black text-lg text-white">
                                    Bluetooth & Audio Devices
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAudioSettings(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-full"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Microphone / Bluetooth Headset Mic */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span>Microphone (Bluetooth / Built-In)</span>
                                {isBluetoothDevice(availableAudioInputs.find(d => d.deviceId === selectedAudioInput)?.label) && (
                                    <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                                        <Bluetooth size={11} /> Bluetooth Connected
                                    </span>
                                )}
                            </label>
                            <select
                                value={selectedAudioInput}
                                onChange={e => setSelectedAudioInput(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="default">System Default Microphone</option>
                                {availableAudioInputs.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {isBluetoothDevice(d.label) ? `🎧 [Bluetooth] ${d.label}` : d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                                    </option>
                                ))}
                            </select>

                            {/* Live Microphone Sound Level Meter */}
                            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-slate-400">Mic Level Tester:</span>
                                    <button
                                        type="button"
                                        onClick={toggleMicTest}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                            isTestingMic ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                    >
                                        {isTestingMic ? 'Stop Test' : 'Test Mic Level'}
                                    </button>
                                </div>
                                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-all duration-75"
                                        style={{ width: `${micVolumeLevel}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Speaker / Bluetooth Output Device */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span>Speaker / Headset Output</span>
                                <button
                                    type="button"
                                    onClick={playSpeakerTestChime}
                                    className="text-[10px] text-emerald-400 hover:underline font-bold"
                                >
                                    Play Test Sound 🔊
                                </button>
                            </label>
                            <select
                                value={selectedAudioOutput}
                                onChange={e => setSelectedAudioOutput(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="default">System Default Speakers</option>
                                {availableAudioOutputs.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {isBluetoothDevice(d.label) ? `🎧 [Bluetooth] ${d.label}` : d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAudioSettings(false);
                                    showToast.success('Bluetooth and audio settings saved');
                                }}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg transition-all"
                            >
                                Apply Audio Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Call Transcript & Lead Details Modal */}
            {selectedCallLogForDetails && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedCallLogForDetails(null)}
                    title={
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-500" />
                            <span>Call Record & AI Transcript</span>
                        </div>
                    }
                >
                    <div className="space-y-4 text-slate-800 dark:text-slate-200">
                        {/* Call Meta Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                            <div>
                                <p className="text-slate-500 font-bold uppercase text-[10px]">Contact</p>
                                <p className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 truncate">
                                    {selectedCallLogForDetails.callerName || 'Inbound Caller'}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold uppercase text-[10px]">Phone Number</p>
                                <p className="font-mono font-bold text-sm text-blue-600 mt-0.5">
                                    {selectedCallLogForDetails.direction === 'inbound' ? selectedCallLogForDetails.from : selectedCallLogForDetails.to}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold uppercase text-[10px]">Direction</p>
                                <p className="font-bold text-sm capitalize mt-0.5 flex items-center gap-1">
                                    {selectedCallLogForDetails.direction === 'inbound' ? <PhoneIncoming size={12} className="text-emerald-500" /> : <PhoneOutgoing size={12} className="text-blue-500" />}
                                    {selectedCallLogForDetails.direction}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold uppercase text-[10px]">Handled By</p>
                                <p className="font-bold text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                    {(selectedCallLogForDetails as any).handledBy || 'AI Receptionist'}
                                </p>
                            </div>
                        </div>

                        {/* AI Summary Highlight */}
                        {selectedCallLogForDetails.aiSummary && (
                            <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent dark:from-amber-500/20 dark:via-orange-500/20 rounded-2xl border border-amber-300 dark:border-amber-700/60 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                                    <Sparkles size={14} className="text-amber-500" />
                                    AI Conversation Summary
                                </div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                    {selectedCallLogForDetails.aiSummary}
                                </p>
                            </div>
                        )}

                        {/* Full Spoken Transcript */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase text-slate-500">
                                    Full Word-For-Word Spoken Transcript
                                </label>
                                {selectedCallLogForDetails.transcription && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedCallLogForDetails.transcription || '');
                                            showToast.success('Transcript copied to clipboard');
                                        }}
                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                                    >
                                        <Copy size={12} /> Copy Transcript
                                    </button>
                                )}
                            </div>
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-xs font-mono whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 space-y-2">
                                {selectedCallLogForDetails.transcription || 'No audio transcript recorded for this call.'}
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setSelectedCallLogForDetails(null)}>
                                Close
                            </Button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleConvertToLead(selectedCallLogForDetails)}
                                    disabled={isConvertingLeadId === selectedCallLogForDetails.id || (selectedCallLogForDetails as any).isLeadCreated}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                        (selectedCallLogForDetails as any).isLeadCreated 
                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md font-black'
                                    }`}
                                >
                                    <UserPlus size={14} />
                                    {(selectedCallLogForDetails as any).isLeadCreated ? 'Lead Already Created' : '⚡ Move to CRM Leads'}
                                </button>

                                <Button
                                    onClick={() => {
                                        const phoneToCall = selectedCallLogForDetails.direction === 'inbound' ? selectedCallLogForDetails.from : selectedCallLogForDetails.to;
                                        setDialedNumber(phoneToCall);
                                        setSelectedCallLogForDetails(null);
                                        makeCall(phoneToCall, selectedCallLogForDetails.customerId, selectedCallLogForDetails.callerName);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                                >
                                    <Phone size={14} /> Dial Number
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
