import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import Select from 'components/ui/Select';
import { PhoneCall, PhoneOutgoing, PhoneOff, Voicemail, Upload, Link as LinkIcon, RefreshCw, Check, Play, Music, Mic, FileText, AlertCircle, Sparkles, Bot } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db, functions } from 'lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { uploadFileToStorage } from 'lib/storageService';
import showToast from 'lib/toast';

export interface LogCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string | null;
    recipientPhone?: string;
    onSuccess?: () => void;
}

const LogCallModal: React.FC<LogCallModalProps> = ({
    isOpen,
    onClose,
    customerId,
    recipientPhone,
    onSuccess
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'manual' | 'ringcentral'>('manual');
    
    // Call Log State
    const [callTitle, setCallTitle] = useState('Voice Call Log');
    const [callType, setCallType] = useState<'call_out' | 'call_in' | 'call_missed' | 'call_voicemail'>('call_out');
    const [phone, setPhone] = useState('');
    const [durationMinutes, setDurationMinutes] = useState<number | ''>(1);
    const [durationSeconds, setDurationSeconds] = useState<number | ''>(30);
    const [notes, setNotes] = useState('');
    const [recordingUrl, setRecordingUrl] = useState('');

    // Audio upload state
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // RingCentral Recent Calls state
    const [rcCalls, setRcCalls] = useState<any[]>([]);
    const [isLoadingRc, setIsLoadingRc] = useState(false);

    const customer = useMemo(() => {
        if (!customerId) return null;
        return state.customers?.find((c: any) => c.id === customerId) || null;
    }, [state.customers, customerId]);

    useEffect(() => {
        if (!isOpen) return;
        setPhone(recipientPhone || customer?.phone || '');
        setCallTitle(`Call with ${customer?.name || 'Customer'}`);
    }, [isOpen, recipientPhone, customer]);

    React.useEffect(() => {
        if (isOpen && activeTab === 'ringcentral') {
            handleFetchRcCalls();
        }
    }, [isOpen, activeTab]);

    // Handle audio file selection and upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(file.name)) {
            showToast.warn("Please select a valid audio recording file (.mp3, .wav, .m4a, .ogg, .webm).");
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            showToast.warn("File too large — audio recording must be under 25MB.");
            return;
        }

        setAudioFile(file);
        setIsUploading(true);
        try {
            const orgId = state.currentOrganization?.id || 'general';
            const cId = customerId || 'guest';
            const path = `call-recordings/${orgId}/${cId}/${Date.now()}_${file.name}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            setRecordingUrl(downloadUrl);
            showToast.success("Audio recording file uploaded successfully!");
        } catch (err) {
            console.error("Audio upload error:", err);
            showToast.warn("Failed to upload audio file. You can paste an audio URL instead.");
        } finally {
            setIsUploading(false);
        }
    };

    // Fetch RingCentral call logs for customer
    const handleFetchRcCalls = async () => {
        setIsLoadingRc(true);
        try {
            const custPhoneDigits = (phone || customer?.phone || '').replace(/\D/g, '');
            const callsList: any[] = [];

            // 1. Live Query RingCentral API via Cloud Function if org configured
            const orgId = state.currentOrganization?.id;
            if (orgId) {
                try {
                    const fetchRcFn = functions.httpsCallable('fetchRingCentralCallLogs');
                    const res = await fetchRcFn({ orgId, phone: custPhoneDigits });
                    const records = (res.data as any)?.records || [];
                    records.forEach((rec: any) => {
                        callsList.push(rec);
                    });
                } catch (fnErr) {
                    console.warn("Notice: Live RingCentral API fetch unavailable, checking stored logs.", fnErr);
                }
            }

            // 2. Scan state.messages for stored call logs
            if (state.messages) {
                state.messages.forEach((m: any) => {
                    if (m.type === 'call' || m.type === 'ringcentral' || m.type === 'voice' || m.recordingUrl || m.recordingId) {
                        const sendDig = (m.senderId || '').replace(/\D/g, '');
                        const recvDig = (m.receiverId || m.to || '').replace(/\D/g, '');
                        const isPhoneMatch = !custPhoneDigits || (sendDig.includes(custPhoneDigits) || recvDig.includes(custPhoneDigits) || (custPhoneDigits.length >= 7 && (sendDig.endsWith(custPhoneDigits.slice(-7)) || recvDig.endsWith(custPhoneDigits.slice(-7)))));
                        if ((m.customerId && (m.customerId === customerId || m.customerId === customer?.id)) || isPhoneMatch) {
                            if (!callsList.some(c => c.id === m.id)) {
                                callsList.push(m);
                            }
                        }
                    }
                });
            }

            // 3. Query customer communications subcollection for call logs
            if (customerId || customer?.id) {
                const targetId = customerId || customer?.id;
                const subSnap = await db.collection('customers').doc(targetId).collection('communications').get().catch(() => null);
                if (subSnap && !subSnap.empty) {
                    subSnap.forEach(doc => {
                        const data = doc.data();
                        if (data.type === 'call_out' || data.type === 'call_in' || data.type === 'call' || data.recordingUrl) {
                            if (!callsList.some(c => c.id === doc.id)) {
                                callsList.push({ id: doc.id, ...data });
                            }
                        }
                    });
                }
            }

            setRcCalls(callsList);
            if (callsList.length === 0) {
                showToast.info("No RingCentral call recordings found for this phone number.");
            }
        } catch (e) {
            console.error("Error fetching RingCentral calls:", e);
        } finally {
            setIsLoadingRc(false);
        }
    };

    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    // AI Call Summary Generator using Gemini 3.6 Flash
    const handleGenerateAiSummary = async (baseContent?: string, rcData?: any) => {
        setIsGeneratingAi(true);
        try {
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            const custName = customer?.name || 'Customer';
            const dur = rcData?.duration || ((Number(durationMinutes) || 0) * 60 + (Number(durationSeconds) || 0));
            const durStr = dur ? `${Math.floor(dur / 60)}m ${dur % 60}s` : 'Call completed';

            const prompt = `You are a master HVAC & field service AI assistant. Generate a professional, structured call summary and action items for this customer call.
Customer: ${custName}
Phone: ${phone || customer?.phone || 'Unknown'}
Call Context / Subject: ${rcData?.subject || callTitle || 'Customer Service Phone Call'}
Direction: ${rcData?.direction || (callType === 'call_out' ? 'Outbound' : 'Inbound')}
Duration: ${durStr}
Raw Notes / Details: ${baseContent || notes || 'Call completed with customer.'}

Format response with clean markdown headings and bullet points:
### Call Executive Summary
- Brief summary of the call conversation

### Key Customer Discussion Points
- Specific questions, concerns, or requests raised by the customer

### Recommended Action Items & Follow-up
- Clear next steps for staff/technician`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: "gemini-3.6-flash"
            });

            const aiText = result.data?.text || result.data?.result || result.data;
            if (aiText && typeof aiText === 'string') {
                const cleanedText = aiText.trim();
                setNotes(cleanedText);
                showToast.success("Generated AI Call Summary!");
                return cleanedText;
            }
        } catch (err) {
            console.warn("AI Call Summary generation notice:", err);
            showToast.info("Using standard call log details.");
        } finally {
            setIsGeneratingAi(false);
        }
        return null;
    };

    // One-Click Import & Save for RingCentral Call Logs
    const handleSelectRcCall = async (rcCall: any) => {
        setIsSaving(true);
        try {
            const targetCustomerId = customerId || customer?.id || null;
            const nowIso = rcCall.timestamp || new Date().toISOString();
            const durSecs = rcCall.duration || 0;
            const recUrl = rcCall.recordingUrl || '';
            const isOutbound = rcCall.direction?.toLowerCase() === 'outbound';
            const titleStr = rcCall.subject || rcCall.title || `RingCentral Call (${isOutbound ? 'Outbound' : 'Inbound'})`;
            let initialNotes = rcCall.content || `RingCentral call ${isOutbound ? 'outbound' : 'inbound'} - ${rcCall.result || 'Accepted'}. Duration: ${Math.floor(durSecs / 60)}m ${durSecs % 60}s.`;

            // Auto-generate AI Call Summary
            showToast.info("Importing call log & generating AI Summary...");
            const aiSummary = await handleGenerateAiSummary(initialNotes, rcCall);
            const finalContent = aiSummary || initialNotes;

            // 1. Write to global messages collection
            const msgObj: any = {
                id: `msg-rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: isOutbound ? (state.currentUser?.id || 'staff') : (targetCustomerId || 'customer'),
                senderName: isOutbound ? (state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff') : (customer?.name || 'Customer'),
                receiverId: isOutbound ? (phone || customer?.phone || '') : (state.currentUser?.id || 'staff'),
                customerId: targetCustomerId || null,
                to: phone || customer?.phone || '',
                content: finalContent,
                subject: titleStr,
                recordingUrl: recUrl || null,
                duration: durSecs,
                status: 'completed',
                direction: isOutbound ? 'outbound' : 'inbound',
                timestamp: nowIso,
                createdAt: nowIso,
                organizationId: state.currentOrganization?.id || null,
                type: 'call'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));

            // 2. Write to customer communications subcollection
            if (targetCustomerId) {
                const commEntry: any = {
                    id: `comm-call-${Date.now()}`,
                    type: isOutbound ? 'call_out' : 'call_in',
                    title: titleStr,
                    subtitle: `Duration: ${Math.floor(durSecs / 60)}m ${durSecs % 60}s ${recUrl ? '• Recording attached' : ''}`,
                    content: finalContent,
                    badgeLabel: isOutbound ? 'Outbound Call' : 'Inbound Call',
                    badgeColor: isOutbound ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
                    timestamp: nowIso,
                    senderName: isOutbound ? (state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff') : (customer?.name || 'Customer'),
                    recordingUrl: recUrl || null,
                    duration: durSecs
                };
                await db.collection('customers').doc(targetCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry));
            }

            if (onSuccess) onSuccess();
            showToast.success("RingCentral call log & AI Summary imported successfully!");
            onClose();
        } catch (err) {
            console.error("Error importing RingCentral call:", err);
            showToast.error("Failed to import RingCentral call.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!callTitle.trim()) {
            showToast.warn("Please enter a title for the call log.");
            return;
        }

        const totalSecs = (Number(durationMinutes) || 0) * 60 + (Number(durationSeconds) || 0);

        setIsSaving(true);
        try {
            const targetCustomerId = customerId || customer?.id || null;
            const nowIso = new Date().toISOString();

            let isOutbound = callType === 'call_out';
            let status = 'completed';
            if (callType === 'call_missed') status = 'missed';
            if (callType === 'call_voicemail') status = 'voicemail';

            let badgeLabel = 'Outbound Call';
            let badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            if (callType === 'call_in') { badgeLabel = 'Inbound Call'; badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'; }
            if (callType === 'call_missed') { badgeLabel = 'Missed Call'; badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'; }
            if (callType === 'call_voicemail') { badgeLabel = 'Voicemail'; badgeColor = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'; }

            // 1. Write to global messages collection
            const msgObj: any = {
                id: `msg-call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: state.currentUser?.id || 'staff',
                senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
                receiverId: phone || customer?.phone || '',
                customerId: targetCustomerId || null,
                to: phone || customer?.phone || '',
                content: notes.trim(),
                subject: callTitle.trim(),
                recordingUrl: recordingUrl.trim() || null,
                duration: totalSecs,
                status: status,
                direction: isOutbound ? 'outbound' : 'inbound',
                timestamp: nowIso,
                createdAt: nowIso,
                organizationId: state.currentOrganization?.id || null,
                type: 'call'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj)).catch((e) => console.error("Error saving call message:", e));

            // 2. Write to customer's communications subcollection
            if (targetCustomerId) {
                const commEntry = {
                    id: `comm-${Date.now()}`,
                    type: callType,
                    title: callTitle.trim(),
                    subtitle: `Phone: ${phone || customer?.phone || 'N/A'}`,
                    content: notes.trim(),
                    recordingUrl: recordingUrl.trim() || null,
                    duration: totalSecs,
                    badgeLabel: badgeLabel,
                    badgeColor: badgeColor,
                    timestamp: nowIso,
                    senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'System'
                };
                await db.collection('customers').doc(targetCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
            }

            showToast.success(t("Call recording logged successfully!"));
            if (onSuccess) onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Error saving call log:", e);
            showToast.warn(t("Failed to save call log. Please try again."));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("Log Voice Call & Recording")}
            size="lg"
        >
            <div className="p-6 space-y-5">
                {/* Header & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <PhoneCall size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                                {t("Call Recording & Log")}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                {customer?.name || t("Record details, transcript notes, and voice recordings.")}
                            </p>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'manual' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t("Manual Upload / Link")}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('ringcentral'); handleFetchRcCalls(); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ringcentral' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t("RingCentral Import")}
                        </button>
                    </div>
                </div>

                {activeTab === 'manual' ? (
                    <div className="space-y-4">
                        {/* Call Title & Call Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                                    {t("Call Subject / Title")} <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    value={callTitle}
                                    onChange={(e) => setCallTitle(e.target.value)}
                                    placeholder={t("e.g. Inbound Support Call")}
                                    className="text-xs font-medium"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                                    {t("Call Direction & Type")}
                                </label>
                                <Select
                                    value={callType}
                                    onChange={(e) => setCallType(e.target.value as any)}
                                    className="text-xs font-medium"
                                >
                                    <option value="call_out">{t("Outbound Call")}</option>
                                    <option value="call_in">{t("Inbound Call")}</option>
                                    <option value="call_missed">{t("Missed Call")}</option>
                                    <option value="call_voicemail">{t("Voicemail")}</option>
                                </Select>
                            </div>
                        </div>

                        {/* Phone & Duration */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                                    {t("Phone Number")}
                                </label>
                                <Input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={t("e.g. +1 555-019-2831")}
                                    className="text-xs font-medium"
                                />
                            </div>

                            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                                        {t("Duration (Mins)")}
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={durationMinutes.toString()}
                                        onChange={(e) => setDurationMinutes(e.target.value ? parseInt(e.target.value) : '')}
                                        className="text-xs font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                                        {t("Duration (Secs)")}
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={durationSeconds.toString()}
                                        onChange={(e) => setDurationSeconds(e.target.value ? parseInt(e.target.value) : '')}
                                        className="text-xs font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Call Notes / Transcript */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                                    {t("Call Notes / Transcript")}
                                </label>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    type="button"
                                    onClick={() => handleGenerateAiSummary()}
                                    disabled={isGeneratingAi}
                                    className="text-[11px] h-6 px-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1 font-bold"
                                >
                                    <Sparkles size={12} className={isGeneratingAi ? 'animate-spin' : ''} />
                                    {isGeneratingAi ? t("Generating AI Summary...") : t("Generate AI Summary")}
                                </Button>
                            </div>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                                placeholder={t("Enter key takeaways, transcript notes, or action items from the conversation...")}
                                className="text-xs leading-relaxed"
                            />
                        </div>

                        {/* Voice Recording Upload & URL Link Section */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <Mic size={14} className="text-blue-600 dark:text-blue-400" />
                                    {t("Voice Recording Audio")}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {t("Upload audio file or paste recording URL")}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Upload Button */}
                                <div>
                                    <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer transition-colors text-center bg-white dark:bg-slate-950">
                                        <Upload size={18} className="text-blue-600 mb-1" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {isUploading ? t("Uploading Audio...") : (audioFile ? audioFile.name : t("Upload Recording File"))}
                                        </span>
                                        <span className="text-[9px] text-slate-400">.mp3, .wav, .m4a, .ogg (Max 25MB)</span>
                                        <input
                                            type="file"
                                            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                                            onChange={handleFileChange}
                                            disabled={isUploading}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {/* Paste URL */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        {t("Or Paste Audio URL")}
                                    </label>
                                    <Input
                                        type="url"
                                        value={recordingUrl}
                                        onChange={(e) => setRecordingUrl(e.target.value)}
                                        placeholder="https://example.com/recording.mp3"
                                        className="text-xs"
                                    />
                                </div>
                            </div>

                            {/* Audio Preview */}
                            {recordingUrl && (
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                                        {t("Audio Recording Preview:")}
                                    </span>
                                    <audio controls src={recordingUrl} className="w-full h-8 outline-none" />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* RingCentral Tab */
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    {t("RingCentral Call Recordings")}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {t("Select a call recording to auto-fill call log fields.")}
                                </span>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleFetchRcCalls}
                                disabled={isLoadingRc}
                                className="text-xs flex items-center gap-1.5"
                            >
                                <RefreshCw size={12} className={isLoadingRc ? 'animate-spin' : ''} />
                                {t("Refresh")}
                            </Button>
                        </div>

                        {isLoadingRc ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-medium">
                                {t("Searching RingCentral call logs...")}
                            </div>
                        ) : rcCalls.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800">
                                <PhoneOff size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {t("No RingCentral recordings found")}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {t("Calls made via RingCentral widget or integration will be listed here automatically.")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                {rcCalls.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => handleSelectRcCall(c)}
                                        className="p-3 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/20 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between shadow-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                                <PhoneCall size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                    {c.subject || c.title || `Call ${c.direction || ''}`}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {c.timestamp ? new Date(c.timestamp).toLocaleString() : 'Recent'} {c.duration ? `• ${Math.floor(c.duration/60)}m ${c.duration%60}s` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <Button size="sm" className="text-xs bg-blue-600 text-white font-bold px-3">
                                            {t("Import")}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSaving || isUploading}
                        className="text-xs"
                    >
                        {t("Cancel")}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isUploading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 flex items-center gap-2 shadow-md"
                    >
                        <Check size={14} />
                        {isSaving ? t("Saving...") : t("Save Call Log")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LogCallModal;
