import React, { useState } from 'react';
import { Phone, MessageSquare, Clock, Zap, CheckCircle2, Settings, ShieldAlert, History, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Job, Customer, User, CheckInLogEntry } from '../../types/types';
import { useAppContext } from '../../context/AppContext';
import { showToast } from '../../lib/toast';
import { db, firebase } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import Button from './Button';
import Input from './Input';

import { notifyAdminsJobPendingReview } from '../../lib/notificationService';

interface OneClickCheckInWidgetProps {
    job: Job;
    customer?: Customer | null;
    currentUser?: User | null;
    onCheckInSuccess?: () => void;
    onCheckOutSuccess?: () => void;
    className?: string;
    defaultExpanded?: boolean;
}

export const OneClickCheckInWidget: React.FC<OneClickCheckInWidgetProps> = ({
    job,
    customer,
    currentUser,
    onCheckInSuccess,
    onCheckOutSuccess,
    className = '',
    defaultExpanded = false
}) => {
    const { state, dispatch } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const isImpact = customer?.id === 'cust-1787187506048' || 
        customer?.name?.toLowerCase().includes('impact') || 
        (job as any)?.customerName?.toLowerCase().includes('impact') || 
        false;

    // Resolve Check-In Credentials with Job-specific overrides
    const defaultPhone = (job as any).checkInPhoneNumber || 
        customer?.submissionRules?.checkInProcedure?.phoneNumber || 
        customer?.submissionRules?.thirdPartyPortal?.phoneNumber || 
        (isImpact ? '203-431-8008' : '1-856-452-7719');

    const defaultWoNumber = (job as any).checkInWorkOrderNumber || job.workOrderNumber || job.poNumber || job.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    const defaultPin = (job as any).checkInPinCode || (currentUser as any)?.pinCode || (currentUser?.phone ? currentUser.phone.replace(/[^0-9]/g, '').slice(-4) : '1234');
    const defaultTechCount = job.assignedCrew?.length || 1;
    const defaultMethod = (job as any).checkInMethod || customer?.submissionRules?.checkInProcedure?.method || (isImpact ? 'IVR' : 'SMS');

    const [phoneNumber, setPhoneNumber] = useState(defaultPhone);
    const [woNumber, setWoNumber] = useState(defaultWoNumber);
    const [pinCode, setPinCode] = useState(defaultPin);
    const [techCount, setTechCount] = useState(defaultTechCount);
    const [method, setMethod] = useState<'SMS' | 'IVR' | 'App' | 'WebPortal'>(defaultMethod as any);

    const [isEditingCodes, setIsEditingCodes] = useState(false);
    const [showLogsDrawer, setShowLogsDrawer] = useState(false);
    const [isExecutingFunction, setIsExecutingFunction] = useState(false);
    const [lastExecutionResult, setLastExecutionResult] = useState<{ status: 'success' | 'failed'; message: string; timestamp: string } | null>(null);

    const isCheckedIn = !!job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime());

    // Clean Phone number
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

    // Formulate SMS payload
    const smsPayload = isCheckedIn 
        ? `WO ${woNumber} CHECKOUT`
        : `WO ${woNumber} CHECKIN PIN ${pinCode} TECHS ${techCount}`;
    const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(smsPayload)}`;

    // Extract pure numeric digits for Phone Keypad IVR DTMF Tones (phone keypads cannot dial letters)
    const numericWoNumber = (woNumber || '').replace(/[^0-9]/g, '') 
        || ((job as any).jobNumber ? String((job as any).jobNumber).replace(/[^0-9]/g, '') : '') 
        || (job.workOrderNumber ? job.workOrderNumber.replace(/[^0-9]/g, '') : '')
        || (job.poNumber ? job.poNumber.replace(/[^0-9]/g, '') : '')
        || job.id.replace(/[^0-9]/g, '').slice(-6) 
        || '101';

    const numericPinCode = (pinCode || '').replace(/[^0-9]/g, '') 
        || (currentUser?.phone ? currentUser.phone.replace(/[^0-9]/g, '').slice(-4) : '1234');

    // Formulate IVR DTMF Tone sequence
    const dtmfToneSequence = isCheckedIn
        ? `${cleanPhone},,${numericPinCode}#,,${numericWoNumber}#,,2#`
        : `${cleanPhone},,${numericPinCode}#,,${numericWoNumber}#,,${techCount}#,,1#`;
    const ivrLink = `tel:${dtmfToneSequence.replace(/\s+/g, '')}`;

    // Record persistent log entry & update job state
    const handleRecordCheckIn = async (
        action: 'check_in' | 'check_out', 
        dispatchMethod: 'Twilio SMS' | 'Twilio IVR' | 'Native SMS' | 'Native Call' | 'Manual',
        status: 'success' | 'failed',
        responseMsg: string
    ) => {
        const nowIso = new Date().toISOString();
        const updatedEntries = [...(job.timeEntries || [])];
        
        let newCheckInTime = job.checkInTime;
        let newCheckOutTime = job.checkOutTime;

        if (status === 'success') {
            if (action === 'check_in') {
                newCheckInTime = nowIso;
                updatedEntries.push({ checkInTime: nowIso, checkOutTime: null, timeOnSiteMinutes: null });
            } else {
                newCheckOutTime = nowIso;
                if (updatedEntries.length > 0 && !updatedEntries[updatedEntries.length - 1].checkOutTime) {
                    const last = updatedEntries[updatedEntries.length - 1];
                    const diffMin = Math.round((new Date(nowIso).getTime() - new Date(last.checkInTime).getTime()) / 60000);
                    updatedEntries[updatedEntries.length - 1] = {
                        ...last,
                        checkOutTime: nowIso,
                        timeOnSiteMinutes: diffMin
                    };
                }
            }
        }

        const newLogEntry: CheckInLogEntry = {
            id: `log-${Date.now()}`,
            action: action,
            method: dispatchMethod,
            status: status,
            timestamp: nowIso,
            woNumber: woNumber,
            phoneNumber: phoneNumber,
            techId: currentUser?.id || state.currentUser?.id,
            techName: (currentUser as any)?.name || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : undefined) || (state.currentUser as any)?.name || 'Technician',
            responseMessage: responseMsg,
            dtmfPayload: dtmfToneSequence
        };

        const existingLogs = job.checkInLogs || [];
        const updatedLogs = [newLogEntry, ...existingLogs];

        const jobUpdates = {
            ...(status === 'success' ? {
                checkInTime: newCheckInTime,
                checkOutTime: newCheckOutTime,
                timeEntries: updatedEntries,
                jobStatus: action === 'check_in' ? 'In Progress' : 'Needs Review',
                needsAdminVerification: action === 'check_out' ? true : undefined
            } : {}),
            checkInLogs: updatedLogs,
            checkInPhoneNumber: phoneNumber,
            checkInWorkOrderNumber: woNumber,
            checkInPinCode: pinCode,
            checkInMethod: method
        };

        try {
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(jobUpdates);
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } as any });
            setLastExecutionResult({
                status: status,
                message: responseMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            });

            if (status === 'success') {
                showToast.success(action === 'check_in' ? `✅ Checked In for Job #${woNumber}` : `🏁 Checked Out - Job Pending Admin Review #${woNumber}`);
                if (action === 'check_out') {
                    const techName = (currentUser as any)?.name || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : undefined) || (state.currentUser as any)?.name || 'Technician';
                    notifyAdminsJobPendingReview(job, techName, job.organizationId || state.currentOrganization?.id || '');
                }
                if (action === 'check_in' && onCheckInSuccess) onCheckInSuccess();
                if (action === 'check_out' && onCheckOutSuccess) onCheckOutSuccess();
            } else {
                showToast.error(`❌ ${responseMsg}`);
            }
        } catch (err) {
            console.error("Failed to update job check-in state:", err);
            showToast.error("Failed to record check-in audit log.");
        }
    };

    // Deploy Twilio Check-In Action (API Dispatch)
    const handleTwilioCheckIn = async (mode: 'sms' | 'ivr') => {
        setIsExecutingFunction(true);
        const action = isCheckedIn ? 'check_out' : 'check_in';
        const methodTitle = mode === 'sms' ? 'Twilio SMS' : 'Twilio IVR';
        try {
            showToast.info(mode === 'sms' 
                ? `Dispatching Twilio SMS for Job #${woNumber}...` 
                : `Deploying Twilio Automated IVR Call for Job #${woNumber}...`
            );
            
            let resultMessage = `${methodTitle} Check-${action === 'check_in' ? 'In' : 'Out'} Dispatched via Twilio API`;
            let isOk = true;

            if (!state.isDemoMode && firebase.functions) {
                try {
                    const checkInFn = firebase.functions().httpsCallable('twilioSubcontractorIVRCheckIn');
                    const res = await checkInFn({
                        jobId: job.id,
                        workOrderNumber: woNumber,
                        pin: pinCode,
                        phoneNumber: cleanPhone,
                        action: action,
                        techCount: techCount,
                        dispatchMode: mode
                    });
                    if (res.data?.success === false) {
                        isOk = false;
                        resultMessage = res.data?.message || 'Twilio API Dispatch Failed';
                    }
                } catch (fnErr: any) {
                    console.warn("Callable function twilioSubcontractorIVRCheckIn failed/missing, engaging fallback route:", fnErr);
                    
                    if (mode === 'sms') {
                        // Fall back to queued SMS document trigger in Firestore 'messages' collection
                        const nowIso = new Date().toISOString();
                        const msgObj = {
                            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            senderId: currentUser?.id || state.currentUser?.id || 'staff',
                            senderName: (currentUser as any)?.name || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Technician'),
                            receiverId: cleanPhone,
                            to: cleanPhone,
                            content: smsPayload,
                            timestamp: nowIso,
                            createdAt: nowIso,
                            organizationId: job.organizationId || state.currentOrganization?.id || null,
                            type: 'sms',
                            direction: 'outbound',
                            status: 'sent'
                        };
                        await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
                        resultMessage = `Twilio SMS queued for Job #${woNumber}`;
                    } else {
                        // For IVR call, try calling deployed HTTP endpoint twilioSubcontractorIVR
                        try {
                            const response = await fetch('https://us-central1-tektrakker.cloudfunctions.net/twilioSubcontractorIVR', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    jobId: job.id,
                                    workOrderNumber: woNumber,
                                    pin: pinCode,
                                    phoneNumber: cleanPhone,
                                    action: action,
                                    techCount: techCount
                                })
                            });
                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            }
                            resultMessage = `Twilio IVR Call initiated via HTTP endpoint`;
                        } catch (httpErr: any) {
                            console.warn("Twilio IVR HTTP fallback error:", httpErr);
                            isOk = false;
                            resultMessage = `Twilio Service Offline (${fnErr?.message || 'Cloud function unavailable'})`;
                        }
                    }
                }
            } else {
                await new Promise(res => setTimeout(res, 800));
            }

            await handleRecordCheckIn(action, methodTitle, isOk ? 'success' : 'failed', resultMessage);
        } catch (err: any) {
            console.error("Twilio Dispatch Error:", err);
            await handleRecordCheckIn(action, methodTitle, 'failed', err?.message || 'Twilio Connection Error');
        } finally {
            setIsExecutingFunction(false);
        }
    };

    return (
        <div className={`p-4 rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl transition-all ${className}`}>
            {/* Header & Status */}
            <div className={`flex items-center justify-between flex-wrap gap-2 ${isExpanded ? 'mb-3 pb-2 border-b border-slate-800' : ''}`}>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-left focus:outline-none cursor-pointer flex-1 min-w-0 group"
                >
                    <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 group-hover:bg-blue-500/30 transition-colors">
                        <Zap size={18} className="animate-pulse" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2 truncate">
                            ⚡ Twilio 1-Click Engine
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                isCheckedIn ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-950'
                            }`}>
                                {isCheckedIn ? 'Status: Checked In' : 'Status: Off Site'}
                            </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium truncate">
                            Target WO: <span className="font-mono font-bold text-white">#{woNumber}</span> • Phone: <span className="font-bold text-indigo-300">{phoneNumber}</span>
                        </p>
                    </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowLogsDrawer(!showLogsDrawer)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer relative"
                        title="View Check-In Audit Logs"
                    >
                        <History size={14} />
                        <span className="hidden sm:inline">Logs</span> ({(job.checkInLogs || []).length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsEditingCodes(!isEditingCodes)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edit Job Codes & PIN"
                    >
                        <Settings size={14} />
                        <span className="hidden sm:inline">{isEditingCodes ? 'Close' : 'Codes'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <span>{isExpanded ? 'Hide Engine' : 'Show Engine'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <>
                    {/* REAL-TIME SUCCESS / FAILED NOTIFICATION BANNER */}
                    {lastExecutionResult && (
                        <div className={`mb-3 p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold animate-fade-in ${
                            lastExecutionResult.status === 'success'
                                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                        }`}>
                            <div className="flex items-center gap-2 truncate">
                                {lastExecutionResult.status === 'success' ? (
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                ) : (
                                    <AlertCircle size={16} className="text-rose-400 shrink-0" />
                                )}
                                <span className="truncate">{lastExecutionResult.message}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">{lastExecutionResult.timestamp}</span>
                        </div>
                    )}

            {/* Editable Codes Drawer */}
            {isEditingCodes && (
                <div className="mb-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-3 animate-fade-in text-xs">
                    <p className="font-extrabold uppercase text-[10px] text-indigo-400 tracking-wider">
                        ⚙️ Per-Job Check-In Codes & Target Phone Override
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">Check-In / IVR Phone #</label>
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold"
                                placeholder="1-856-452-7719"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">Work Order / Job Code #</label>
                            <input
                                type="text"
                                value={woNumber}
                                onChange={e => setWoNumber(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold"
                                placeholder="WO-12345"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">Technician PIN Code</label>
                            <input
                                type="text"
                                value={pinCode}
                                onChange={e => setPinCode(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold"
                                placeholder="1234"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">Technicians on Site</label>
                            <input
                                type="number"
                                min={1}
                                value={techCount}
                                onChange={e => setTechCount(parseInt(e.target.value, 10) || 1)}
                                className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* AUDIT LOGS DRAWER FOR TECHS & ADMINS */}
            {showLogsDrawer && (
                <div className="mb-4 p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2.5 animate-fade-in text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-extrabold uppercase text-[10px] text-indigo-300 tracking-wider flex items-center gap-1.5">
                            <History size={12} /> Twilio & IVR Check-In Audit Logs
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {(job.checkInLogs || []).length} Log Entries Recorded
                        </span>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {(job.checkInLogs || []).length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic py-3 text-center">No check-in audit logs recorded yet.</p>
                        ) : (
                            (job.checkInLogs || []).map((entry) => (
                                <div key={entry.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded uppercase ${
                                            entry.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {entry.status}
                                        </span>
                                        <span className="font-bold text-slate-200 text-[11px] truncate">
                                            {entry.method} ({entry.action.toUpperCase()})
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">WO: {entry.woNumber}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 shrink-0 text-right">
                                        <p className="font-medium text-slate-300">{entry.techName || 'Tech'}</p>
                                        <p className="text-[9px] text-slate-500">{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 1-Click Twilio Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1ST PRIORITY: 💬 TWILIO SMS DISPATCH (API) */}
                <button
                    type="button"
                    disabled={isExecutingFunction}
                    onClick={() => handleTwilioCheckIn('sms')}
                    className="px-3.5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-center disabled:opacity-50"
                    title="Send SMS via Twilio API (No native phone app needed)"
                >
                    <MessageSquare size={16} />
                    <span>💬 {isCheckedIn ? '1-Click Twilio SMS Check-Out' : '1-Click Twilio SMS Check-In'}</span>
                </button>

                {/* 2ND PRIORITY: 📞 TWILIO OUTBOUND IVR CALL (API) */}
                <button
                    type="button"
                    disabled={isExecutingFunction}
                    onClick={() => handleTwilioCheckIn('ivr')}
                    className="px-3.5 py-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-center disabled:opacity-50"
                    title="Place Automated Call via Twilio API with DTMF Tones"
                >
                    <Phone size={16} className="text-emerald-300" />
                    <span>📞 {isCheckedIn ? '1-Click Twilio IVR Check-Out' : '1-Click Twilio IVR Call'}</span>
                </button>
            </div>

            {/* Native Phone App Fallbacks */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2">
                <span className="font-mono">
                    DTMF Payload: <span className="text-emerald-300 font-bold">{dtmfToneSequence}</span>
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-slate-500">Native Fallbacks:</span>
                    <a 
                        href={smsLink} 
                        onClick={() => handleRecordCheckIn(isCheckedIn ? 'check_out' : 'check_in', 'Native SMS', 'success', 'Launched Native SMS App')}
                        className="text-blue-400 hover:underline font-bold" 
                        title="Open Native Messaging App"
                    >
                        📱 Native SMS
                    </a>
                    <a 
                        href={ivrLink} 
                        onClick={() => handleRecordCheckIn(isCheckedIn ? 'check_out' : 'check_in', 'Native Call', 'success', 'Launched Native Dialer')}
                        className="text-emerald-400 hover:underline font-bold" 
                        title="Open Native Dialer"
                    >
                        📞 Native Call
                    </a>
                </div>
            </div>
            </>
            )}
        </div>
    );
};

export default OneClickCheckInWidget;
