import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db, functions } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from '../../lib/toast';
import { 
    Bot, PhoneForwarded, Users, MessageSquare, Clock, ShieldCheck, 
    Sparkles, Save, X, Plus, Trash2, Check, AlertCircle, PhoneCall, 
    Volume2, Settings2, Sliders, Zap, HelpCircle, ArrowRight,
    RefreshCw, Copy, ExternalLink, Layers, FileText, Upload, CheckCircle2, FileCheck, Calendar
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { cleanUndefinedFields } from '../../lib/utils';

export interface IVROption {
    digit: string;
    label: string;
    action: 'ring_group' | 'external_number' | 'voicemail' | 'ai_assistant';
    target: string; // group name, phone number, etc.
}

export interface EmployeeSchedule {
    userId: string;
    name: string;
    email?: string;
    role?: string;
    enabled: boolean;
    ringGroups?: string[]; // e.g. ['dispatch', 'service', 'sales']
    daysActive?: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    priority?: number; // 1 = high, 5 = low
    days?: string[];   // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    startHour: string; // '08:00'
    endHour: string;   // '17:00'
}

export interface TelephonySettings {
    // 1. AI Voice Assistant Settings
    aiAssistant: {
        enabled: boolean;
        mode: 'primary' | 'after_hours' | 'backup_after_ring' | 'live_team';
        aiAfterHoursEnabled?: boolean;
        aiNoAnswerBackupEnabled?: boolean;
        voiceName: string; // 'Polly.Joanna-Neural' | 'Polly.Matthew-Neural' | 'Polly.Kendra-Neural'
        greetingText: string;
        emergencyKeywords: string[];
        emergencyTransferNumber: string;
        autoBookWorkOrders: boolean;
        companyKnowledgeContext: string;
    };

    // 2. IVR & Auto-Attendant
    ivr: {
        enabled: boolean;
        greetingText: string;
        options: IVROption[];
        timeoutSeconds: number;
        fallbackAction: 'voicemail' | 'ai_assistant' | 'ring_all';
    };

    // 3. Employee Call Routing & Ring Groups
    routing: {
        enforceClockIn: boolean; // only ring if clocked into timecard
        strategy: 'simultaneous' | 'round_robin';
        ringDurationSeconds: number;
        employees: EmployeeSchedule[];
        groups: string[]; // ['Service & Dispatch', 'Sales & Estimates', 'Emergency On-Call']
    };

    // 4. Missed Call Auto-SMS & Failover
    leadRecovery: {
        missedCallAutoSmsEnabled: boolean;
        missedCallSmsTemplate: string;
        failoverNumber: string;
        customVoicemailGreeting: string;
    };
}

const DEFAULT_SETTINGS: TelephonySettings = {
    aiAssistant: {
        enabled: true,
        mode: 'primary',
        aiAfterHoursEnabled: true,
        aiNoAnswerBackupEnabled: true,
        voiceName: 'Polly.Ruth-Neural',
        greetingText: 'Thanks for calling {{company_name}}! My name is Ava, your AI service assistant. How can I help you today?',
        emergencyKeywords: ['gas leak', 'no heat', 'freezer down', 'water leak', 'sparking', 'emergency'],
        emergencyTransferNumber: '',
        autoBookWorkOrders: true,
        companyKnowledgeContext: 'We are a premier service contractor providing professional residential and commercial repairs, maintenance, and installations. Diagnostic fee is $89 waived with approved repair.'
    },
    ivr: {
        enabled: false,
        greetingText: 'Thank you for calling {{company_name}}. For Service and Dispatch, press 1. For Billing and Invoices, press 2. For Sales and Estimates, press 3. To leave a message, press 9.',
        options: [
            { digit: '1', label: 'Service & Dispatch', action: 'ring_group', target: 'Service & Dispatch' },
            { digit: '2', label: 'Billing & Invoices', action: 'ring_group', target: 'Billing' },
            { digit: '3', label: 'Sales & Estimates', action: 'ring_group', target: 'Sales & Estimates' },
            { digit: '9', label: 'Leave Voicemail', action: 'voicemail', target: 'voicemail' },
        ],
        timeoutSeconds: 8,
        fallbackAction: 'ai_assistant'
    },
    routing: {
        enforceClockIn: true,
        strategy: 'simultaneous',
        ringDurationSeconds: 25,
        employees: [],
        groups: ['Service & Dispatch', 'Billing & Invoices', 'Sales & Estimates', 'Emergency On-Call']
    },
    leadRecovery: {
        missedCallAutoSmsEnabled: true,
        missedCallSmsTemplate: 'Hi! Sorry we missed your call at {{company_name}}. How can our service team help you today? Feel free to reply directly to this text!',
        failoverNumber: '',
        customVoicemailGreeting: 'You have reached {{company_name}}. We are currently assisting other customers or out on service calls. Please leave your name, address, and a brief description of your issue and we will return your call promptly.'
    }
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const TelephonySettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { state } = useAppContext();
    const { currentOrganization: org, users } = state;

    const [activeTab, setActiveTab] = useState<'ai' | 'ivr' | 'routing' | 'lead_recovery' | 'twilio_subaccount'>('ai');
    const [settings, setSettings] = useState<TelephonySettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [isAiVoiceUnlocked, setIsAiVoiceUnlocked] = useState<boolean>(false);
    const [isUnlockingAiVoice, setIsUnlockingAiVoice] = useState<boolean>(false);

    // Twilio Subaccount & Dedicated Line State
    const [twilioSid, setTwilioSid] = useState<string>('');
    const [twilioToken, setTwilioToken] = useState<string>('');
    const [twilioNumber, setTwilioNumber] = useState<string>('');
    const [isSubaccount, setIsSubaccount] = useState<boolean>(false);
    const [isProvisioningTwilio, setIsProvisioningTwilio] = useState<boolean>(false);
    const [isAssigningNumber, setIsAssigningNumber] = useState<boolean>(false);

    // Number Porting State
    const [portingNumber, setPortingNumber] = useState<string>('');
    const [portingCarrier, setPortingCarrier] = useState<string>('');
    const [portingAccountNumber, setPortingAccountNumber] = useState<string>('');
    const [portingPin, setPortingPin] = useState<string>('');
    const [portingAuthName, setPortingAuthName] = useState<string>('');
    const [portingAddress, setPortingAddress] = useState<string>('');
    const [portingBillName, setPortingBillName] = useState<string>('');
    const [isSubmittingPort, setIsSubmittingPort] = useState<boolean>(false);
    const [existingPortRequest, setExistingPortRequest] = useState<any>(null);
    const [showPortWizard, setShowPortWizard] = useState<boolean>(false);

    // Days of week
    const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // PBX Ring Groups Management State
    const [newRouteInput, setNewRouteInput] = useState<string>('');

    const availableGroups = useMemo(() => {
        const defaultGroups = ['Service & Dispatch', 'Billing & Invoices', 'Sales & Estimates', 'Emergency On-Call'];
        const savedGroups = settings.routing?.groups || [];
        const ivrGroups = (settings.ivr?.options || [])
            .filter(o => o.action === 'ring_group' && o.target)
            .map(o => o.target.trim());
        return Array.from(new Set([...defaultGroups, ...savedGroups, ...ivrGroups])).filter(Boolean);
    }, [settings.routing?.groups, settings.ivr?.options]);

    const handleAddRoute = () => {
        const trimmed = newRouteInput.trim();
        if (!trimmed) return;
        if (!availableGroups.includes(trimmed)) {
            const updated = [...(settings.routing?.groups || availableGroups), trimmed];
            setSettings(prev => ({
                ...prev,
                routing: { ...prev.routing, groups: updated }
            }));
            showToast.success(`Route "${trimmed}" added!`);
        }
        setNewRouteInput('');
    };

    const handleRemoveRoute = (groupToRemove: string) => {
        if (availableGroups.length <= 1) {
            showToast.error("You must have at least one department route.");
            return;
        }
        const updatedGroups = availableGroups.filter(g => g !== groupToRemove);
        const updatedEmployees = settings.routing.employees.map(emp => ({
            ...emp,
            ringGroups: (emp.ringGroups || []).filter(g => g !== groupToRemove)
        }));
        setSettings(prev => ({
            ...prev,
            routing: {
                ...prev.routing,
                groups: updatedGroups,
                employees: updatedEmployees
            }
        }));
        showToast.info(`Route "${groupToRemove}" removed.`);
    };

    const toggleEmployeeRoute = (empIdx: number, group: string) => {
        const updated = [...settings.routing.employees];
        const currentGroups = Array.isArray(updated[empIdx].ringGroups) ? [...updated[empIdx].ringGroups] : [];
        const exists = currentGroups.includes(group);
        updated[empIdx].ringGroups = exists
            ? currentGroups.filter(g => g !== group)
            : [...currentGroups, group];
        setSettings(prev => ({
            ...prev,
            routing: { ...prev.routing, employees: updated }
        }));
    };

    const handleUnlockAiVoice = async () => {
        if (!org?.id) return;
        setIsUnlockingAiVoice(true);
        try {
            await setDoc(doc(db, 'organizations', org.id), {
                aiVoiceAssistantEnabled: true,
                aiVoiceAssistantBillingType: 'monthly'
            }, { merge: true });
            setIsAiVoiceUnlocked(true);
            showToast.success("24/7 AI Voice Receptionist activated successfully ($5/mo company add-on)!");
        } catch (err: any) {
            console.error("Failed to unlock AI Voice:", err);
            showToast.error("Failed to activate AI Voice Receptionist.");
        } finally {
            setIsUnlockingAiVoice(false);
        }
    };

    // Load existing settings from Firestore
    useEffect(() => {
        if (!isOpen || !org?.id) return;

        const loadSettings = async () => {
            setLoading(true);
            try {
                const initialUnlocked = org.id === 'platform' || org.id === 'master' || !!org.aiVoiceAssistantEnabled || !!org.isComplimentary || !!org.isFreeAccess || !!org.unlockAllFeatures;
                setIsAiVoiceUnlocked(initialUnlocked);

                let loaded: TelephonySettings = DEFAULT_SETTINGS;
                try {
                    const snap = await getDoc(doc(db, 'organizations', org.id, 'settings', 'telephony'));
                    if (snap.exists()) {
                        loaded = { ...DEFAULT_SETTINGS, ...snap.data() as TelephonySettings };
                    }
                } catch (e) {
                    console.warn('Could not load telephony settings doc:', e);
                }

                try {
                    const secretsSnap = await getDoc(doc(db, 'organizations', org.id, 'secrets', 'config'));
                    if (secretsSnap.exists()) {
                        const sec = secretsSnap.data();
                        if (sec?.twilioConfig) {
                            setTwilioSid(sec.twilioConfig.subaccountSid || sec.twilioConfig.accountSid || '');
                            setTwilioToken(sec.twilioConfig.authToken || '');
                            setTwilioNumber(sec.twilioConfig.phoneNumber || '');
                            setIsSubaccount(sec.twilioConfig.isSubaccount ?? Boolean(sec.twilioConfig.subaccountSid));
                        }
                    }
                } catch (e) {
                    console.warn('Could not load secrets config:', e);
                }

                try {
                    const orgSnap = await getDoc(doc(db, 'organizations', org.id));
                    if (orgSnap.exists()) {
                        const oData = orgSnap.data();
                        if (oData?.twilioPhoneNumber) {
                            setTwilioNumber(oData.twilioPhoneNumber);
                        }
                        const isUnlocked = org.id === 'platform' || org.id === 'master' || !!oData?.aiVoiceAssistantEnabled || !!oData?.isComplimentary || !!oData?.isFreeAccess || !!oData?.unlockAllFeatures;
                        setIsAiVoiceUnlocked(isUnlocked);
                    }
                } catch (e) {
                    console.warn('Could not load org metadata:', e);
                }

                try {
                    const portSnap = await getDoc(doc(db, 'organizations', org.id, 'porting_requests', 'active'));
                    if (portSnap.exists()) {
                        setExistingPortRequest(portSnap.data());
                    }
                } catch (e) {
                    console.warn('Could not load porting request:', e);
                }

                // Filter users to strictly current organization and non-customer employee roles
                const currentOrgEmployees = (users || []).filter(u => {
                    const r = (u.role || '').toLowerCase();
                    if (r === 'customer' || r.includes('customer') || r.includes('client')) return false;
                    if (u.organizationId && org.id && u.organizationId !== org.id && org.id !== 'master') return false;
                    return true;
                });

                // Merge with saved settings, discarding any customers from previously saved lists
                const mergedEmployees: EmployeeSchedule[] = currentOrgEmployees.map(u => {
                    const existing = loaded.routing.employees?.find(e => e.userId === u.id);
                    if (existing) {
                        return {
                            ...existing,
                            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email || 'Team Member',
                            email: u.email,
                            role: u.role,
                            ringGroups: Array.isArray(existing.ringGroups) 
                                ? existing.ringGroups 
                                : (typeof (existing as any).ringGroups === 'string' && (existing as any).ringGroups ? [(existing as any).ringGroups] : ['Service & Dispatch'])
                        };
                    }
                    return {
                        userId: u.id,
                        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email || 'Team Member',
                        email: u.email,
                        role: u.role,
                        enabled: true,
                        ringGroups: ['Service & Dispatch'],
                        daysActive: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                        startHour: '08:00',
                        endHour: '17:00'
                    };
                });

                loaded.routing.employees = mergedEmployees;
                setSettings(loaded);
            } catch (err) {
                console.error('Error loading telephony settings:', err);
                showToast.error('Could not load telephony settings');
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [isOpen, org?.id, users]);

    // 1-Click Subaccount Auto-Provisioning
    const handleAutoProvisionSubaccount = async () => {
        if (!org?.id) return;
        setIsProvisioningTwilio(true);
        try {
            const provisionFn = functions.httpsCallable('provisionOrgTwilioSubaccount');
            const res: any = await provisionFn({
                organizationId: org.id,
                friendlyName: org.name || 'TekTrakker Organization'
            });

            const subSid = res?.data?.subaccountSid;
            const phoneNum = res?.data?.phoneNumber;
            if (subSid) setTwilioSid(subSid);
            if (phoneNum) setTwilioNumber(phoneNum);
            setIsSubaccount(true);

            showToast.success(`Dedicated Twilio Subaccount created & linked! ${phoneNum ? `Line: ${phoneNum}` : ''}`);
        } catch (err: any) {
            console.error('Provision subaccount error:', err);
            showToast.error(`Failed to provision Twilio subaccount: ${err.message}`);
        } finally {
            setIsProvisioningTwilio(false);
        }
    };

    // 1-Click Local Number Purchase
    const handleAssignNumber = async () => {
        if (!org?.id) return;
        setIsAssigningNumber(true);
        try {
            const assignFn = functions.httpsCallable('assignOrgTwilioNumber');
            const res: any = await assignFn({ organizationId: org.id });
            const phoneNum = res?.data?.phoneNumber;
            if (phoneNum) {
                setTwilioNumber(phoneNum);
                showToast.success(`Dedicated local phone line ${phoneNum} successfully assigned!`);
            }
        } catch (err: any) {
            console.error('Assign number error:', err);
            showToast.error(`Failed to assign number: ${err.message}`);
        } finally {
            setIsAssigningNumber(false);
        }
    };

    // Submit Number Porting Request
    const handleSubmitPortRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!org?.id) return;
        if (!portingNumber) {
            showToast.error('Please enter the phone number to port.');
            return;
        }

        setIsSubmittingPort(true);
        try {
            const portData = {
                organizationId: org.id,
                organizationName: org.name || 'TekAir Inc.',
                subaccountSid: twilioSid || '',
                phoneNumber: portingNumber,
                carrier: portingCarrier || 'Unspecified',
                accountNumber: portingAccountNumber || '',
                pin: portingPin || '',
                authorizedName: portingAuthName || '',
                address: portingAddress || '',
                billFileName: portingBillName || 'Uploaded via Portal',
                status: 'submitted',
                submittedAt: new Date().toISOString(),
                estimatedCompletion: '3-7 business days'
            };

            await setDoc(doc(db, 'organizations', org.id, 'porting_requests', 'active'), portData);
            await setDoc(doc(db, 'organizations', org.id), {
                portingStatus: 'submitted',
                portingTargetNumber: portingNumber
            }, { merge: true });

            setExistingPortRequest(portData);
            setShowPortWizard(false);
            showToast.success(`Port request submitted for ${portingNumber}! Carrier transfer in progress.`);
        } catch (err: any) {
            console.error('Submit port request error:', err);
            showToast.error(err.message || 'Failed to submit port request.');
        } finally {
            setIsSubmittingPort(false);
        }
    };

    // Save Settings
    const handleSave = async () => {
        if (!org?.id) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'organizations', org.id, 'settings', 'telephony');
            const cleanPayload = cleanUndefinedFields({
                ...settings,
                lastUpdated: serverTimestamp(),
                updatedBy: state.currentUser?.email || state.currentUser?.id || 'admin'
            });
            await setDoc(docRef, cleanPayload, { merge: true });

            // Save Twilio Subaccount Config (preserving existing backend keys)
            const secretsRef = doc(db, 'organizations', org.id, 'secrets', 'config');
            const twilioUpdates: Record<string, any> = {
                phoneNumber: twilioNumber || '',
                isSubaccount: isSubaccount,
                updatedAt: new Date().toISOString()
            };
            if (twilioSid) {
                twilioUpdates.subaccountSid = twilioSid;
                twilioUpdates.accountSid = twilioSid;
            }
            if (twilioToken) {
                twilioUpdates.authToken = twilioToken;
            }

            await setDoc(secretsRef, {
                twilioConfig: twilioUpdates
            }, { merge: true });

            // Update organization top-level phone metadata
            if (twilioNumber) {
                await setDoc(doc(db, 'organizations', org.id), {
                    twilioPhoneNumber: twilioNumber,
                    phoneSystemEnabled: true,
                    telephonyActive: true
                }, { merge: true });
            }

            showToast.success('Cloud PBX, Twilio Subaccount & AI Receptionist settings saved successfully!');
            onClose();
        } catch (err: any) {
            console.error('Save error:', err);
            showToast.error(`Failed to save settings: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                            <Settings2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                Cloud PBX, Call Routing & AI Receptionist Studio
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Configure 24/7 AI voice receptionist, employee ring groups, IVR auto-attendants, and missed-call recovery.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation Sub-Tabs */}
                <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0 sticky top-0 z-20">
                    <button
                        type="button"
                        onClick={() => setActiveTab('ai')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                            activeTab === 'ai'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <Bot size={15} />
                        <span>AI Voice Receptionist</span>
                        {settings.aiAssistant.enabled && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ivr')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                            activeTab === 'ivr'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <Sliders size={15} />
                        <span>IVR Auto-Attendant</span>
                        {settings.ivr.enabled && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('routing')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                            activeTab === 'routing'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <Users size={15} />
                        <span>Employee Shift Routing</span>
                        <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                            {settings.routing.employees.filter(e => e.enabled).length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('lead_recovery')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                            activeTab === 'lead_recovery'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <Zap size={15} />
                        <span>Missed Call Auto-SMS</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('twilio_subaccount')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                            activeTab === 'twilio_subaccount'
                                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <MessageSquare size={15} className="text-red-400" />
                        <span>Twilio Subaccount & Line</span>
                        {!!twilioSid && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                    </button>
                </div>

                {/* Modal Body / Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* TAB 1: AI VOICE RECEPTIONIST */}
                    {activeTab === 'ai' && (
                        <div className="space-y-6 animate-fade-in">
                            {!isAiVoiceUnlocked ? (
                                <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-700 text-white shadow-xl space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                                                <Sparkles size={14} className="text-amber-300" /> Premium Add-on
                                            </div>
                                            <h3 className="text-xl font-black">24/7 AI Voice Receptionist</h3>
                                            <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                                                Never miss another customer phone call. Ava speaks naturally with your callers, qualifies job requirements, captures emergency leads, and drafts work orders directly onto your dispatch board.
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20">
                                            <div className="text-2xl font-black">$5<span className="text-xs font-normal opacity-80">/mo</span></div>
                                            <div className="text-[10px] text-blue-200">+$0.07/min usage</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm text-xs space-y-1">
                                            <div className="font-black flex items-center gap-1.5"><Bot size={14}/> Natural Speech</div>
                                            <div className="text-[11px] text-blue-100">Powered by Amazon Polly Neural TTS & Gemini 3.8 Flash.</div>
                                        </div>
                                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm text-xs space-y-1">
                                            <div className="font-black flex items-center gap-1.5"><PhoneForwarded size={14}/> Live Escalations</div>
                                            <div className="text-[11px] text-blue-100">Detects emergency keywords and transfers callers directly to on-call techs.</div>
                                        </div>
                                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm text-xs space-y-1">
                                            <div className="font-black flex items-center gap-1.5"><Calendar size={14}/> Auto-Booking</div>
                                            <div className="text-[11px] text-blue-100">Captures customer information and schedules appointments in real time.</div>
                                        </div>
                                    </div>
                                    <div className="pt-2 flex justify-end">
                                        <button
                                            type="button"
                                            disabled={isUnlockingAiVoice}
                                            onClick={handleUnlockAiVoice}
                                            className="px-6 py-3 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-black text-xs shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                                        >
                                            {isUnlockingAiVoice ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-500" />}
                                            Unlock AI Voice Receptionist ($5/mo)
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                                        <CheckCircle2 size={16} className="text-emerald-600" />
                                        24/7 AI Voice Receptionist Add-on Active ($5/mo · Metered at $0.07/min)
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">Organization Company Add-on</span>
                                </div>
                            )}

                            {/* Enable Toggle Card */}
                            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                        <Sparkles size={16} className="text-amber-500" />
                                        Enable 24/7 AI Voice Receptionist
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        AI answers phone calls naturally, gathers issue descriptions, books work orders, and escalates emergencies.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={settings.aiAssistant.enabled}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            aiAssistant: { ...prev.aiAssistant, enabled: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Mode Selection */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        AI Receptionist Operating Strategy
                                    </label>
                                    <span className="text-[10px] text-slate-500 font-medium">Select primary gatekeeper or team-first with AI backup</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {/* Strategy 1: Primary 24/7 Gatekeeper */}
                                    <div 
                                        onClick={() => setSettings(prev => ({
                                            ...prev,
                                            aiAssistant: { ...prev.aiAssistant, mode: 'primary' }
                                        }))}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                            settings.aiAssistant.mode === 'primary'
                                                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-600/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <Sparkles size={14} className="text-blue-600" />
                                                Primary 24/7 Gatekeeper
                                            </h5>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${settings.aiAssistant.mode === 'primary' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                                {settings.aiAssistant.mode === 'primary' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                            AI greets every caller instantly 24/7, qualifies the emergency or service request, books appointments, and live-transfers to on-call techs.
                                        </p>
                                    </div>

                                    {/* Strategy 2: Live Team First with AI Backup */}
                                    <div 
                                        onClick={() => setSettings(prev => ({
                                            ...prev,
                                            aiAssistant: { 
                                                ...prev.aiAssistant, 
                                                mode: 'live_team',
                                                aiAfterHoursEnabled: prev.aiAssistant.aiAfterHoursEnabled ?? true,
                                                aiNoAnswerBackupEnabled: prev.aiAssistant.aiNoAnswerBackupEnabled ?? true
                                            }
                                        }))}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                            settings.aiAssistant.mode !== 'primary'
                                                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-600/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <Users size={14} className="text-emerald-600" />
                                                Live Team First + Smart AI Backup
                                            </h5>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${settings.aiAssistant.mode !== 'primary' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                                {settings.aiAssistant.mode !== 'primary' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                            Incoming calls ring your office and dispatchers first during business hours, with AI covering after-hours and missed calls.
                                        </p>
                                    </div>
                                </div>

                                {/* Granular Checkboxes when Live Team First is selected */}
                                {settings.aiAssistant.mode !== 'primary' && (
                                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                            Select AI Takeover Triggers (You can enable both):
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.aiAssistant.aiAfterHoursEnabled !== false}
                                                    onChange={e => setSettings(prev => ({
                                                        ...prev,
                                                        aiAssistant: { ...prev.aiAssistant, mode: 'live_team', aiAfterHoursEnabled: e.target.checked }
                                                    }))}
                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white block">After-Hours & Weekends</span>
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                                                        AI automatically takes over nights and weekends when office is closed.
                                                    </span>
                                                </div>
                                            </label>

                                            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.aiAssistant.aiNoAnswerBackupEnabled !== false}
                                                    onChange={e => setSettings(prev => ({
                                                        ...prev,
                                                        aiAssistant: { ...prev.aiAssistant, mode: 'live_team', aiNoAnswerBackupEnabled: e.target.checked }
                                                    }))}
                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white block">No-Answer / Busy Backup (20s)</span>
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                                                        If dispatchers are busy or don't answer within 20s, AI steps in to capture the lead.
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Voice Persona & Greeting */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        AI Voice Persona
                                    </label>
                                    <select
                                        value={settings.aiAssistant.voiceName}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            aiAssistant: { ...prev.aiAssistant, voiceName: e.target.value }
                                        }))}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                                    >
                                        <option value="Polly.Ruth-Neural">Ruth (Ultra-Natural & Expressive Female - Recommended)</option>
                                        <option value="Polly.Danielle-Neural">Danielle (Warm & Conversational Female)</option>
                                        <option value="Polly.Stephen-Neural">Stephen (Friendly & Natural Male - Recommended)</option>
                                        <option value="Polly.Matthew-Neural">Matthew (Executive & Crisp Male)</option>
                                        <option value="Polly.Joanna-Neural">Ava / Joanna (Standard Professional Female)</option>
                                        <option value="Polly.Amy-Neural">Amy (Natural British Female)</option>
                                        <option value="Polly.Kendra-Neural">Kendra (Energetic Female)</option>
                                        <option value="Polly.Joey-Neural">Joey (Casual Male)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Emergency Escalation Forwarding Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={settings.aiAssistant.emergencyTransferNumber}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            aiAssistant: { ...prev.aiAssistant, emergencyTransferNumber: e.target.value }
                                        }))}
                                        placeholder="e.g. +1 (555) 987-6543 (On-Call Cell)"
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* AI Greeting Text */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Initial AI Greeting Prompt
                                </label>
                                <textarea
                                    rows={2}
                                    value={settings.aiAssistant.greetingText}
                                    onChange={e => setSettings(prev => ({
                                        ...prev,
                                        aiAssistant: { ...prev.aiAssistant, greetingText: e.target.value }
                                    }))}
                                    placeholder="Thanks for calling {{company_name}}! How can I help you today?"
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Company Knowledge Context for AI */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                    <span>Company Services & Knowledge Context</span>
                                    <span className="text-[10px] text-slate-400 font-normal">AI uses this to answer customer questions accurately</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={settings.aiAssistant.companyKnowledgeContext}
                                    onChange={e => setSettings(prev => ({
                                        ...prev,
                                        aiAssistant: { ...prev.aiAssistant, companyKnowledgeContext: e.target.value }
                                    }))}
                                    placeholder="We provide HVAC repair, plumbing, and electrical. Our diagnostic fee is $89. We service Dallas-Fort Worth metro..."
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB 2: IVR AUTO-ATTENDANT STUDIO */}
                    {activeTab === 'ivr' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                        <Sliders size={16} className="text-blue-500" />
                                        Enable Keypad IVR Auto-Attendant
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Plays a touch-tone phone menu (e.g. "Press 1 for Service, Press 2 for Billing").
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={settings.ivr.enabled}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            ivr: { ...prev.ivr, enabled: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* IVR Greeting */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Main IVR Audio Greeting Text
                                </label>
                                <textarea
                                    rows={2}
                                    value={settings.ivr.greetingText}
                                    onChange={e => setSettings(prev => ({
                                        ...prev,
                                        ivr: { ...prev.ivr, greetingText: e.target.value }
                                    }))}
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            {/* Keypad Menu Options */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Keypad Menu Actions
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextDigit = String(settings.ivr.options.length + 1);
                                            setSettings(prev => ({
                                                ...prev,
                                                ivr: {
                                                    ...prev.ivr,
                                                    options: [
                                                        ...prev.ivr.options,
                                                        { digit: nextDigit, label: `Option ${nextDigit}`, action: 'ring_group', target: 'Service & Dispatch' }
                                                    ]
                                                }
                                            }));
                                        }}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Menu Option
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {settings.ivr.options.map((opt, idx) => (
                                        <div key={idx} className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex flex-wrap md:flex-nowrap items-center gap-3">
                                            {/* Keypad Key */}
                                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                                                {opt.digit}
                                            </div>

                                            {/* Menu Label */}
                                            <input
                                                type="text"
                                                value={opt.label}
                                                onChange={e => {
                                                    const updated = [...settings.ivr.options];
                                                    updated[idx].label = e.target.value;
                                                    setSettings(prev => ({ ...prev, ivr: { ...prev.ivr, options: updated } }));
                                                }}
                                                placeholder="Department Name"
                                                className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white min-w-[140px]"
                                            />

                                            {/* Action Type */}
                                            <select
                                                value={opt.action}
                                                onChange={e => {
                                                    const updated = [...settings.ivr.options];
                                                    updated[idx].action = e.target.value as any;
                                                    setSettings(prev => ({ ...prev, ivr: { ...prev.ivr, options: updated } }));
                                                }}
                                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                                            >
                                                <option value="ring_group">Route to Ring Group</option>
                                                <option value="ai_assistant">Transfer to AI Assistant</option>
                                                <option value="external_number">Forward to External Phone</option>
                                                <option value="voicemail">Send to Voicemail</option>
                                            </select>

                                            {/* Action Target */}
                                            {opt.action === 'ring_group' ? (
                                                <select
                                                    value={opt.target || availableGroups[0] || 'Service & Dispatch'}
                                                    onChange={e => {
                                                        const updated = [...settings.ivr.options];
                                                        updated[idx].target = e.target.value;
                                                        setSettings(prev => ({ ...prev, ivr: { ...prev.ivr, options: updated } }));
                                                    }}
                                                    className="w-44 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold"
                                                >
                                                    {availableGroups.map(g => (
                                                        <option key={g} value={g}>{g}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={opt.target}
                                                    onChange={e => {
                                                        const updated = [...settings.ivr.options];
                                                        updated[idx].target = e.target.value;
                                                        setSettings(prev => ({ ...prev, ivr: { ...prev.ivr, options: updated } }));
                                                    }}
                                                    placeholder={opt.action === 'external_number' ? '+1 (555) 000-0000' : 'Target'}
                                                    className="w-44 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono"
                                                />
                                            )}

                                            {/* Delete Option */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSettings(prev => ({
                                                        ...prev,
                                                        ivr: {
                                                            ...prev.ivr,
                                                            options: prev.ivr.options.filter((_, i) => i !== idx)
                                                        }
                                                    }));
                                                }}
                                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: EMPLOYEE ROUTING & SHIFT SCHEDULES */}
                    {activeTab === 'routing' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Clock-In Enforcement Card */}
                            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                        <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
                                        Clock-In Availability Enforcement
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Only ring technicians and dispatchers who are actively clocked in on TekTrakker's timecard.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={settings.routing.enforceClockIn}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            routing: { ...prev.routing, enforceClockIn: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {/* Ring Strategy */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Ring Strategy
                                    </label>
                                    <select
                                        value={settings.routing.strategy}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            routing: { ...prev.routing, strategy: e.target.value as any }
                                        }))}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                                    >
                                        <option value="simultaneous">Simultaneous Ring (All on-duty members ring at once)</option>
                                        <option value="round_robin">Round-Robin (Sequential cascading ring)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Ring Duration (Seconds Before Fallback)
                                    </label>
                                    <input
                                        type="number"
                                        min={10}
                                        max={60}
                                        value={settings.routing.ringDurationSeconds}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            routing: { ...prev.routing, ringDurationSeconds: parseInt(e.target.value, 10) || 25 }
                                        }))}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* PBX Department Routes Management */}
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                            <Layers size={14} className="text-blue-600 dark:text-blue-400" />
                                            PBX Department Routes ({availableGroups.length})
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Incoming calls and IVR options route to these groups. You can attach multiple routes to each team member below.
                                        </p>
                                    </div>
                                </div>

                                {/* Existing Route Badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {availableGroups.map(group => (
                                        <span
                                            key={group}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-xs"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span>{group}</span>
                                            {availableGroups.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRoute(group)}
                                                    className="text-slate-400 hover:text-rose-600 ml-1 font-bold text-sm transition-colors cursor-pointer"
                                                    title={`Delete ${group} route`}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                {/* Add New Route Input */}
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="text"
                                        placeholder="Add custom route (e.g. Commercial Dispatch, Spanish Support, Lead Techs)..."
                                        value={newRouteInput}
                                        onChange={e => setNewRouteInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
                                        className="flex-1 p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddRoute}
                                        disabled={!newRouteInput.trim()}
                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all disabled:opacity-40 shadow-xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={14} />
                                        <span>Add Route</span>
                                    </button>
                                </div>
                            </div>

                            {/* Employee List & Shifts */}
                            <div className="space-y-3">
                                <h4 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Team Call Receiving Members & Shift Schedules
                                </h4>

                                <div className="space-y-2.5">
                                    {settings.routing.employees.map((emp, idx) => (
                                        <div 
                                            key={emp.userId}
                                            className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                                                emp.enabled 
                                                    ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-xs' 
                                                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={emp.enabled}
                                                        onChange={e => {
                                                            const updated = [...settings.routing.employees];
                                                            updated[idx].enabled = e.target.checked;
                                                            setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                        }}
                                                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                    />
                                                    <div>
                                                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                                                            {emp.name}
                                                        </h5>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                                                            {emp.role || 'Member'} • {emp.email}
                                                        </p>
                                                    </div>
                                                </label>

                                                {/* Route Count Badge */}
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                                                    !emp.enabled
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                                        : (emp.ringGroups || []).length > 0
                                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                                }`}>
                                                    {(emp.ringGroups || []).length} / {availableGroups.length} Routes Assigned
                                                </span>
                                            </div>

                                            {/* Assigned Department Routes (Multi-Select Chips) */}
                                            {emp.enabled && (
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                            Receives Calls For:
                                                        </span>
                                                        <div className="flex items-center gap-2 text-[10px]">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...settings.routing.employees];
                                                                    updated[idx].ringGroups = [...availableGroups];
                                                                    setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                                }}
                                                                className="text-blue-600 dark:text-blue-400 hover:underline font-extrabold cursor-pointer"
                                                            >
                                                                Select All
                                                            </button>
                                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...settings.routing.employees];
                                                                    updated[idx].ringGroups = [];
                                                                    setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                                }}
                                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {availableGroups.map(group => {
                                                            const isAssigned = (emp.ringGroups || []).includes(group);
                                                            return (
                                                                <button
                                                                    key={group}
                                                                    type="button"
                                                                    onClick={() => toggleEmployeeRoute(idx, group)}
                                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                                                                        isAssigned
                                                                            ? 'bg-blue-600 text-white shadow-xs border border-blue-600 ring-2 ring-blue-500/20'
                                                                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                                                                    }`}
                                                                >
                                                                    <span className="text-[11px] font-black">{isAssigned ? '✓' : '+'}</span>
                                                                    <span>{group}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {(emp.ringGroups || []).length === 0 && (
                                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 pt-0.5">
                                                            <AlertCircle size={12} />
                                                            No department routes selected. This member will only receive general unrouted calls.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Days of week & Shift Hours */}
                                            {emp.enabled && (
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                                                    {/* Active Days */}
                                                    <div className="flex items-center gap-1">
                                                        {ALL_DAYS.map(day => {
                                                            const isActive = emp.daysActive.includes(day);
                                                            return (
                                                                <button
                                                                    key={day}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updated = [...settings.routing.employees];
                                                                        const currentDays = updated[idx].daysActive;
                                                                        updated[idx].daysActive = isActive
                                                                            ? currentDays.filter(d => d !== day)
                                                                            : [...currentDays, day];
                                                                        setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                                    }}
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                                        isActive
                                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700'
                                                                    }`}
                                                                >
                                                                    {day}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Hours */}
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                                                        <input
                                                            type="time"
                                                            value={emp.startHour || '08:00'}
                                                            onChange={e => {
                                                                const updated = [...settings.routing.employees];
                                                                updated[idx].startHour = e.target.value;
                                                                setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                            }}
                                                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                                                        />
                                                        <span>to</span>
                                                        <input
                                                            type="time"
                                                            value={emp.endHour || '17:00'}
                                                            onChange={e => {
                                                                const updated = [...settings.routing.employees];
                                                                updated[idx].endHour = e.target.value;
                                                                setSettings(prev => ({ ...prev, routing: { ...prev.routing, employees: updated } }));
                                                            }}
                                                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: MISSED CALL AUTO-SMS & FAILOVER */}
                    {activeTab === 'lead_recovery' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Missed Call Auto-SMS */}
                            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                            <MessageSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            Missed Call Instant Auto-SMS (Lead Recovery)
                                        </h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            Instantly shoots an automated SMS when an inbound caller is missed or leaves a voicemail.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.leadRecovery.missedCallAutoSmsEnabled}
                                            onChange={e => setSettings(prev => ({
                                                ...prev,
                                                leadRecovery: { ...prev.leadRecovery, missedCallAutoSmsEnabled: e.target.checked }
                                            }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                {settings.leadRecovery.missedCallAutoSmsEnabled && (
                                    <div className="space-y-1.5 pt-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Auto-SMS Message Template
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={settings.leadRecovery.missedCallSmsTemplate}
                                            onChange={e => setSettings(prev => ({
                                                ...prev,
                                                leadRecovery: { ...prev.leadRecovery, missedCallSmsTemplate: e.target.value }
                                            }))}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        />
                                        <p className="text-[10px] text-slate-400">
                                            Available tags: <span className="font-mono font-bold text-indigo-500">{'{{company_name}}'}</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Failover Number */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Emergency Backup Failover Number
                                </label>
                                <input
                                    type="tel"
                                    value={settings.leadRecovery.failoverNumber}
                                    onChange={e => setSettings(prev => ({
                                        ...prev,
                                        leadRecovery: { ...prev.leadRecovery, failoverNumber: e.target.value }
                                    }))}
                                    placeholder="e.g. +1 (555) 345-6789 (Owner Cell Phone)"
                                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                                <p className="text-[10px] text-slate-400">
                                    If internet drops or no softphone browser answers within the ring duration, calls will forward to this number.
                                </p>
                            </div>

                            {/* Custom Voicemail Greeting */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Company Voicemail Greeting
                                </label>
                                <textarea
                                    rows={3}
                                    value={settings.leadRecovery.customVoicemailGreeting}
                                    onChange={e => setSettings(prev => ({
                                        ...prev,
                                        leadRecovery: { ...prev.leadRecovery, customVoicemailGreeting: e.target.value }
                                    }))}
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB 5: TWILIO SUBACCOUNT & DEDICATED PHONE LINE */}
                    {activeTab === 'twilio_subaccount' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Status Header Card */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/30 border border-red-200 dark:border-red-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30">
                                            <MessageSquare size={18} />
                                        </span>
                                        <div>
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white">
                                                {org?.name || 'Organization'} Dedicated Twilio Subaccount
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Complete cross-tenant data isolation for telephony, voice recording, and two-way SMS.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!!twilioSid ? (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Subaccount Active
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                            Not Provisioned
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 1-Click Provisioning & Line Purchasing Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-red-500" />
                                        <h5 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                                            1-Click Subaccount Auto-Provisioning
                                        </h5>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Automatically generates an isolated Twilio Subaccount, WebRTC voice keys, TwiML apps, and purchases a local phone line.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={isProvisioningTwilio}
                                        onClick={handleAutoProvisionSubaccount}
                                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-98 transition-all disabled:opacity-50"
                                    >
                                        {isProvisioningTwilio ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                <span>Provisioning Dedicated Subaccount...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={14} />
                                                <span>{!!twilioSid ? 'Re-Provision / Refresh Subaccount' : '⚡ Auto-Provision Subaccount'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <PhoneCall size={16} className="text-blue-500" />
                                        <h5 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                                            Dedicated Local Phone Number
                                        </h5>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Current Line: <strong className="text-slate-900 dark:text-white">{twilioNumber || 'None Assigned (Using Platform Line)'}</strong>
                                    </p>
                                    <button
                                        type="button"
                                        disabled={isAssigningNumber}
                                        onClick={handleAssignNumber}
                                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all disabled:opacity-50"
                                    >
                                        {isAssigningNumber ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                <span>Assigning Local Number...</span>
                                            </>
                                        ) : (
                                            <>
                                                <PhoneCall size={14} />
                                                <span>{twilioNumber ? 'Purchase / Replace Local Number' : '⚡ Assign Dedicated Local Number'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Port Existing Number Wizard Card */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/60 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                                            <FileText size={18} />
                                        </span>
                                        <div>
                                            <h5 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                                                Port Existing Business Number
                                            </h5>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                Transfer your existing company phone number from your previous carrier into your TekTrakker subaccount automatically.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowPortWizard(!showPortWizard)}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm hover:bg-indigo-50 transition-all"
                                    >
                                        {showPortWizard ? 'Hide Wizard' : (existingPortRequest ? 'View / Update Port Order' : '🚀 Start Port Request')}
                                    </button>
                                </div>

                                {/* Active Porting Status Tracker */}
                                {existingPortRequest && (
                                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                    Port Request Active for <span className="font-mono text-indigo-600">{existingPortRequest.phoneNumber}</span>
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                                                {existingPortRequest.status || 'Submitted'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 space-y-0.5">
                                            <div>Carrier: <strong className="text-slate-700 dark:text-slate-300">{existingPortRequest.carrier}</strong> | Account #: <strong className="text-slate-700 dark:text-slate-300">{existingPortRequest.accountNumber || 'On file'}</strong></div>
                                            <div>Authorized Rep: <strong className="text-slate-700 dark:text-slate-300">{existingPortRequest.authorizedName || 'Authorized Signer'}</strong></div>
                                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Estimated Carrier Transfer Window: 3–7 Business Days</div>
                                        </div>
                                    </div>
                                )}

                                {/* Porting Form Wizard */}
                                {showPortWizard && (
                                    <form onSubmit={handleSubmitPortRequest} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Phone Number to Port *
                                                </label>
                                                <input
                                                    type="tel"
                                                    required
                                                    value={portingNumber}
                                                    onChange={e => setPortingNumber(e.target.value)}
                                                    placeholder="(210) 318-4197"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Current Carrier *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={portingCarrier}
                                                    onChange={e => setPortingCarrier(e.target.value)}
                                                    placeholder="e.g. AT&T, Spectrum, Verizon, RingCentral"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Account Number with Carrier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={portingAccountNumber}
                                                    onChange={e => setPortingAccountNumber(e.target.value)}
                                                    placeholder="Account Number"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Transfer PIN / Security Passcode
                                                </label>
                                                <input
                                                    type="password"
                                                    value={portingPin}
                                                    onChange={e => setPortingPin(e.target.value)}
                                                    placeholder="PIN / Passcode"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Authorized Account Holder Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={portingAuthName}
                                                    onChange={e => setPortingAuthName(e.target.value)}
                                                    placeholder="e.g. Ryan Vavrecan"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    Billing Address on File
                                                </label>
                                                <input
                                                    type="text"
                                                    value={portingAddress}
                                                    onChange={e => setPortingAddress(e.target.value)}
                                                    placeholder="Street, City, State, ZIP"
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Attach Recent Carrier Bill (PDF / Photo)
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors">
                                                    <Upload size={14} />
                                                    <span>{portingBillName || 'Choose Bill Document / Photo'}</span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.png,.jpg,.jpeg"
                                                        className="hidden"
                                                        onChange={e => {
                                                            if (e.target.files && e.target.files[0]) {
                                                                setPortingBillName(e.target.files[0].name);
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {portingBillName && (
                                                    <span className="text-[11px] text-emerald-600 font-medium">✓ Attached</span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmittingPort}
                                            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50"
                                        >
                                            {isSubmittingPort ? (
                                                <>
                                                    <RefreshCw size={14} className="animate-spin" />
                                                    <span>Submitting Port Order...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FileCheck size={14} />
                                                    <span>Submit Number Porting Order</span>
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Direct Credential Editing (BYOC) */}
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                                <h5 className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-emerald-500" />
                                    Direct Credentials & Settings
                                </h5>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Subaccount SID / Account SID
                                        </label>
                                        <input
                                            type="text"
                                            value={twilioSid}
                                            onChange={e => setTwilioSid(e.target.value)}
                                            placeholder="AC..."
                                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Auth Token
                                        </label>
                                        <input
                                            type="password"
                                            value={twilioToken}
                                            onChange={e => setTwilioToken(e.target.value)}
                                            placeholder="••••••••••••••••"
                                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Assigned Outbound / Inbound Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={twilioNumber}
                                            onChange={e => setTwilioNumber(e.target.value)}
                                            placeholder="+1 (555) 123-4567"
                                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                {/* Webhook Endpoints */}
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 mt-4">
                                    <h6 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                        Twilio Console Webhook URLs (For Dedicated Numbers):
                                    </h6>
                                    <div className="space-y-1.5 text-[10px] font-mono">
                                        <div>
                                            <span className="text-slate-400 font-sans block">Inbound Voice URL (POST):</span>
                                            <code className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 block select-all border border-slate-200 dark:border-slate-700">
                                                https://us-central1-tektrakker.cloudfunctions.net/twilioInboundVoice?orgId={org?.id}
                                            </code>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-sans block">Inbound SMS URL (POST):</span>
                                            <code className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 block select-all border border-slate-200 dark:border-slate-700">
                                                https://us-central1-tektrakker.cloudfunctions.net/twilioInboundSms?orgId={org?.id}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <Save size={15} />
                        <span>{saving ? 'Saving Settings...' : 'Save PBX & AI Settings'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
