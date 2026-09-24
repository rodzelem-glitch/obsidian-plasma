import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { useAppContext } from './AppContext';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from '../lib/toast';

export type CallState = 'idle' | 'incoming' | 'connecting' | 'connected' | 'on_hold' | 'disconnected';

export interface ActiveCallInfo {
    id?: string;
    phoneNumber: string;
    customerName?: string;
    customerId?: string;
    direction: 'inbound' | 'outbound';
    startTime?: Date;
    callSid?: string;
}

export interface CallLogItem {
    id: string;
    callSid?: string;
    direction: 'inbound' | 'outbound' | 'missed';
    from: string;
    to: string;
    callerName?: string;
    customerId?: string;
    durationSeconds?: number;
    status: string;
    timestamp: any;
    recordingUrl?: string;
    transcription?: string;
    aiSummary?: string;
    technicianId?: string;
    technicianName?: string;
}

export interface VoicemailItem {
    id: string;
    callSid?: string;
    from: string;
    callerName?: string;
    customerId?: string;
    durationSeconds?: number;
    timestamp: any;
    recordingUrl: string;
    transcription?: string;
    aiSummary?: string;
    status: 'new' | 'listened' | 'archived';
}

interface TelephonyContextType {
    device: Device | null;
    deviceStatus: 'unregistered' | 'registering' | 'ready' | 'error';
    deviceError: string | null;
    callState: CallState;
    activeCall: ActiveCallInfo | null;
    callDuration: number;
    isMuted: boolean;
    isOnHold: boolean;
    availableAudioInputs: MediaDeviceInfo[];
    availableAudioOutputs: MediaDeviceInfo[];
    selectedAudioInput: string;
    selectedAudioOutput: string;
    callLogs: CallLogItem[];
    voicemails: VoicemailItem[];
    unreadVoicemailCount: number;
    makeCall: (phoneNumber: string, customerId?: string, customerName?: string) => Promise<void>;
    answerCall: () => void;
    rejectCall: () => void;
    hangUp: () => void;
    toggleMute: () => void;
    toggleHold: () => void;
    sendDigits: (digits: string) => void;
    setSelectedAudioInput: (deviceId: string) => void;
    setSelectedAudioOutput: (deviceId: string) => void;
    markVoicemailStatus: (id: string, status: 'new' | 'listened' | 'archived') => Promise<void>;
}

const TelephonyContext = createContext<TelephonyContextType | undefined>(undefined);

export const useTelephony = () => {
    const context = useContext(TelephonyContext);
    if (!context) {
        throw new Error('useTelephony must be used within a TelephonyProvider');
    }
    return context;
};

export const TelephonyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state } = useAppContext();
    const { currentUser: user, currentOrganization: org, isDemoMode } = state;

    const [device, setDevice] = useState<Device | null>(null);
    const [deviceStatus, setDeviceStatus] = useState<'unregistered' | 'registering' | 'ready' | 'error'>('unregistered');
    const [deviceError, setDeviceError] = useState<string | null>(null);

    const [callState, setCallState] = useState<CallState>('idle');
    const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
    const [callDuration, setCallDuration] = useState<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isOnHold, setIsOnHold] = useState<boolean>(false);

    const [availableAudioInputs, setAvailableAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [availableAudioOutputs, setAvailableAudioOutputs] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioInput, setSelectedAudioInput] = useState<string>('default');
    const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('default');

    const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
    const [voicemails, setVoicemails] = useState<VoicemailItem[]>([]);

    const activeTwilioCallRef = useRef<Call | null>(null);
    const timerRef = useRef<any>(null);
    const deviceRef = useRef<Device | null>(null);

    // Audio Devices Enumeration (with Bluetooth & USB detection)
    const refreshAudioDevices = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
        try {
            let devices = await navigator.mediaDevices.enumerateDevices();
            const hasLabels = devices.some(d => d.label && d.label.trim().length > 0);
            if (!hasLabels && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    devices = await navigator.mediaDevices.enumerateDevices();
                } catch (permErr) {
                    console.debug('Mic permission notice for Bluetooth device labels:', permErr);
                }
            }

            const inputs = devices.filter(d => d.kind === 'audioinput');
            const outputs = devices.filter(d => d.kind === 'audiooutput');
            setAvailableAudioInputs(inputs);
            setAvailableAudioOutputs(outputs);
        } catch (e) {
            console.debug('Failed to enumerate audio devices:', e);
        }
    }, []);

    useEffect(() => {
        refreshAudioDevices();
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', refreshAudioDevices);
            return () => {
                navigator.mediaDevices.removeEventListener('devicechange', refreshAudioDevices);
            };
        }
    }, [refreshAudioDevices]);

    // Bind selected input/output device to Twilio Device
    useEffect(() => {
        if (!device) return;
        try {
            if (selectedAudioInput && selectedAudioInput !== 'default' && (device as any).audio?.setInputDevice) {
                (device as any).audio.setInputDevice(selectedAudioInput).catch((e: any) => console.debug('Set input device notice:', e));
            }
            if (selectedAudioOutput && selectedAudioOutput !== 'default' && (device as any).audio?.speakerDevices?.set) {
                (device as any).audio.speakerDevices.set(selectedAudioOutput).catch((e: any) => console.debug('Set speaker device notice:', e));
            }
        } catch (err) {
            console.debug('Error setting device audio streams:', err);
        }
    }, [device, selectedAudioInput, selectedAudioOutput]);

    // Timer effect for active calls
    useEffect(() => {
        if (callState === 'connected') {
            setCallDuration(0);
            timerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (callState === 'idle') {
                setCallDuration(0);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callState]);

    // Initialize Twilio WebRTC Device
    useEffect(() => {
        if (!user || !org?.id || isDemoMode) {
            if (deviceRef.current) {
                try { deviceRef.current.destroy(); } catch (e) { /* ignore */ }
                deviceRef.current = null;
                setDevice(null);
            }
            setDeviceStatus('unregistered');
            return;
        }

        let isMounted = true;

        const initDevice = async () => {
            try {
                setDeviceStatus('registering');
                setDeviceError(null);

                // Fetch WebRTC Capability Token from backend
                const baseUrl = (import.meta as any).env?.VITE_FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
                const tokenUrl = `${baseUrl}/getTwilioVoiceToken?orgId=${encodeURIComponent(org.id)}&userId=${encodeURIComponent(user.id)}&userName=${encodeURIComponent(user.name || user.email || 'User')}`;
                
                const response = await fetch(tokenUrl).catch(() => null);
                
                if (!response || !response.ok) {
                    if (isMounted) {
                        setDeviceStatus('ready'); // Soft-ready mode: user can place bridged calls or test UI
                        setDeviceError(null);
                    }
                    return;
                }

                const data = await response.json();
                if (!data.token || !isMounted) return;

                const twilioDevice = new Device(data.token, {
                    logLevel: 1,
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
                });

                twilioDevice.on('registered', () => {
                    if (isMounted) {
                        setDeviceStatus('ready');
                        setDeviceError(null);
                    }
                });

                twilioDevice.on('error', (error: any) => {
                    console.debug('Twilio Device Error:', error);
                    if (isMounted) {
                        setDeviceError(error.message || 'Telephony connection issue');
                    }
                });

                twilioDevice.on('incoming', (call: Call) => {
                    activeTwilioCallRef.current = call;
                    const callerPhone = call.parameters.From || 'Unknown Caller';
                    
                    // Match customer from local state or caller parameters
                    const matchedCustomer = state.customers?.find(c => 
                        c.phone && (c.phone === callerPhone || c.phone.replace(/\D/g, '') === callerPhone.replace(/\D/g, ''))
                    );

                    setActiveCall({
                        phoneNumber: callerPhone,
                        customerName: matchedCustomer?.name || call.parameters.CallerName || 'Incoming Caller',
                        customerId: matchedCustomer?.id,
                        direction: 'inbound',
                        callSid: call.parameters.CallSid,
                        startTime: new Date()
                    });
                    setCallState('incoming');

                    call.on('disconnect', () => {
                        setCallState('idle');
                        setActiveCall(null);
                        activeTwilioCallRef.current = null;
                        setIsMuted(false);
                        setIsOnHold(false);
                    });

                    call.on('cancel', () => {
                        setCallState('idle');
                        setActiveCall(null);
                        activeTwilioCallRef.current = null;
                    });
                });

                await twilioDevice.register();
                if (isMounted) {
                    deviceRef.current = twilioDevice;
                    setDevice(twilioDevice);
                }
            } catch (err: any) {
                console.debug('Twilio Device Init Notice:', err?.message || String(err));
                if (isMounted) {
                    setDeviceStatus('ready');
                }
            }
        };

        initDevice();

        return () => {
            isMounted = false;
            if (deviceRef.current) {
                try { deviceRef.current.destroy(); } catch (e) { /* ignore */ }
                deviceRef.current = null;
            }
        };
    }, [user?.id, org?.id, isDemoMode]);

    // Firestore Listeners for Call Logs & Voicemails
    useEffect(() => {
        if (isDemoMode && !user?.id) {
            setCallLogs([]);
            setVoicemails([]);
            return;
        }

        const orgId = org?.id || 'platform';

        let tenantLogs: CallLogItem[] = [];
        let platformLogs: CallLogItem[] = [];
        let voiceSessionLogs: CallLogItem[] = [];

        const updateMergedLogs = () => {
            const map = new Map<string, CallLogItem>();
            [...voiceSessionLogs, ...platformLogs, ...tenantLogs].forEach(item => {
                const key = item.callSid || item.id;
                if (key) {
                    const existing = map.get(key);
                    if (!existing) {
                        map.set(key, item);
                    } else {
                        map.set(key, {
                            ...existing,
                            ...item,
                            transcription: item.transcription || existing.transcription,
                            aiSummary: item.aiSummary || existing.aiSummary,
                            callerName: item.callerName && item.callerName !== '+12103184197' && item.callerName !== 'Inbound AI Caller' ? item.callerName : existing.callerName || item.callerName,
                        });
                    }
                }
            });
            const merged = Array.from(map.values()).sort((a, b) => {
                const parseTime = (val: any): number => {
                    if (!val) return 0;
                    if (typeof val === 'number') return val;
                    if (val.toMillis && typeof val.toMillis === 'function') return val.toMillis();
                    if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val._seconds) return val._seconds * 1000;
                    if (val.seconds) return val.seconds * 1000;
                    const parsed = new Date(val).getTime();
                    return isNaN(parsed) ? 0 : parsed;
                };
                return parseTime(b.timestamp) - parseTime(a.timestamp);
            });
            setCallLogs(merged);
        };

        // 1. Subscribe strictly to Active Org Call Logs
        const callsQuery = query(
            collection(db, 'organizations', orgId, 'call_logs'),
            limit(100)
        );
        const unsubCalls = onSnapshot(callsQuery, (snapshot) => {
            tenantLogs = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...(docSnap.data() as any)
            }));
            updateMergedLogs();
        }, (err) => {
            console.debug('Call logs snapshot notice:', err.message);
        });

        // 2. Subscribe to Voice Sessions strictly belonging to this organization
        const voiceSessionsQuery = query(
            collection(db, 'voiceSessions'),
            where('organizationId', '==', orgId),
            limit(100)
        );
        const unsubVoiceSessions = onSnapshot(voiceSessionsQuery, (snapshot) => {
            voiceSessionLogs = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                const history = data.history || [];
                const userMessages = history.filter((h: any) => h.role === 'user').map((h: any) => h.content);
                const fullTranscript = history.map((h: any) => `${h.role === 'user' ? 'Caller' : 'Ava'}: ${h.content}`).join('\n');
                const lastUserUtterance = userMessages.length > 0 ? userMessages[userMessages.length - 1] : '';

                return {
                    id: docSnap.id,
                    callSid: docSnap.id,
                    from: data.fromPhone || '+1 (210) 318-4197',
                    to: data.toPhone || '+1 (833) 960-2099',
                    direction: 'inbound',
                    status: 'completed',
                    callerName: data.fromPhone || 'Inbound AI Caller',
                    aiSummary: userMessages.length > 0 ? `AI Conversation: ${lastUserUtterance}` : 'Handled by AI Voice Receptionist (Ava)',
                    transcription: fullTranscript,
                    timestamp: data.lastUpdated || new Date(),
                    handledBy: 'AI Voice Receptionist (Ava)',
                    organizationId: data.organizationId || orgId
                } as CallLogItem;
            });
            updateMergedLogs();
        }, (err) => {
            console.debug('Voice sessions snapshot notice:', err.message);
        });

        // 3. Subscribe to Voicemails for active org
        const vmQuery = query(
            collection(db, 'organizations', orgId, 'voicemails'),
            orderBy('timestamp', 'desc'),
            limit(30)
        );

        const unsubVm = onSnapshot(vmQuery, (snapshot) => {
            const vms: VoicemailItem[] = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...(docSnap.data() as any)
            }));
            setVoicemails(vms);
        }, (err) => {
            console.debug('Voicemails snapshot notice:', err.message);
        });

        return () => {
            unsubCalls();
            unsubVoiceSessions();
            unsubVm();
        };
    }, [org?.id, isDemoMode, user?.id]);

    // Telephony Controls
    const makeCall = async (phoneNumber: string, customerId?: string, customerName?: string) => {
        if (!phoneNumber) {
            showToast.error('Please provide a valid phone number to call.');
            return;
        }

        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+1${cleanPhone}`;

        setActiveCall({
            phoneNumber: formattedPhone,
            customerName: customerName || 'Outgoing Call',
            customerId,
            direction: 'outbound',
            startTime: new Date()
        });
        setCallState('connecting');

        try {
            if (deviceRef.current && deviceStatus === 'ready') {
                const twilioCall = await deviceRef.current.connect({
                    params: {
                        To: formattedPhone,
                        customerId: customerId || '',
                        customerName: customerName || '',
                        orgId: org?.id || ''
                    }
                });

                activeTwilioCallRef.current = twilioCall;

                twilioCall.on('accept', () => {
                    setCallState('connected');
                });

                twilioCall.on('disconnect', () => {
                    setCallState('idle');
                    setActiveCall(null);
                    activeTwilioCallRef.current = null;
                    setIsMuted(false);
                    setIsOnHold(false);
                });

                twilioCall.on('error', (err: any) => {
                    showToast.error(`Call error: ${err.message}`);
                    setCallState('idle');
                    setActiveCall(null);
                    activeTwilioCallRef.current = null;
                });
            } else {
                if (isDemoMode) {
                    // Demo mode simulation only
                    setTimeout(() => {
                        setCallState('connected');
                        showToast.success(`Connected to ${customerName || formattedPhone}`);
                    }, 1200);
                } else {
                    setCallState('idle');
                    setActiveCall(null);
                    showToast.error('Organization telephony subscription required. Please agree to terms and activate your dedicated phone line in Communications.');
                }
            }
        } catch (e: any) {
            console.error('Make call error:', e);
            showToast.error(`Could not connect call: ${e?.message || e}`);
            setCallState('idle');
            setActiveCall(null);
        }
    };

    const answerCall = () => {
        if (activeTwilioCallRef.current) {
            activeTwilioCallRef.current.accept();
        }
        setCallState('connected');
    };

    const rejectCall = () => {
        if (activeTwilioCallRef.current) {
            activeTwilioCallRef.current.reject();
        }
        setCallState('idle');
        setActiveCall(null);
        activeTwilioCallRef.current = null;
    };

    const hangUp = () => {
        if (activeTwilioCallRef.current) {
            activeTwilioCallRef.current.disconnect();
        }
        
        // Log finished call locally if in demo mode
        if (isDemoMode && activeCall) {
            const newLog: CallLogItem = {
                id: `log-${Date.now()}`,
                direction: activeCall.direction,
                from: org?.phone || '(555) 019-2834',
                to: activeCall.phoneNumber,
                callerName: activeCall.customerName,
                customerId: activeCall.customerId,
                durationSeconds: callDuration,
                status: 'completed',
                timestamp: new Date(),
                aiSummary: `Call completed with ${activeCall.customerName || activeCall.phoneNumber}. Duration: ${Math.floor(callDuration / 60)}m ${callDuration % 60}s.`,
                technicianName: user?.name || 'Dispatcher'
            };
            setCallLogs(prev => [newLog, ...prev]);
        }

        setCallState('idle');
        setActiveCall(null);
        activeTwilioCallRef.current = null;
        setIsMuted(false);
        setIsOnHold(false);
        showToast.info('Call ended');
    };

    const toggleMute = () => {
        if (activeTwilioCallRef.current) {
            const nextMute = !isMuted;
            activeTwilioCallRef.current.mute(nextMute);
            setIsMuted(nextMute);
        } else {
            setIsMuted(prev => !prev);
        }
    };

    const toggleHold = () => {
        setIsOnHold(prev => !prev);
    };

    const sendDigits = (digits: string) => {
        if (activeTwilioCallRef.current) {
            activeTwilioCallRef.current.sendDigits(digits);
        }
    };

    const markVoicemailStatus = async (id: string, status: 'new' | 'listened' | 'archived') => {
        if (!org?.id || isDemoMode) {
            setVoicemails(prev => prev.map(vm => vm.id === id ? { ...vm, status } : vm));
            return;
        }
        try {
            const vmRef = doc(db, 'organizations', org.id, 'voicemails', id);
            await updateDoc(vmRef, { status });
        } catch (e) {
            console.error('Error updating voicemail status:', e);
        }
    };

    const unreadVoicemailCount = voicemails.filter(vm => vm.status === 'new').length;

    return (
        <TelephonyContext.Provider
            value={{
                device,
                deviceStatus,
                deviceError,
                callState,
                activeCall,
                callDuration,
                isMuted,
                isOnHold,
                availableAudioInputs,
                availableAudioOutputs,
                selectedAudioInput,
                selectedAudioOutput,
                callLogs,
                voicemails,
                unreadVoicemailCount,
                makeCall,
                answerCall,
                rejectCall,
                hangUp,
                toggleMute,
                toggleHold,
                sendDigits,
                setSelectedAudioInput,
                setSelectedAudioOutput,
                markVoicemailStatus
            }}
        >
            {children}
        </TelephonyContext.Provider>
    );
};
