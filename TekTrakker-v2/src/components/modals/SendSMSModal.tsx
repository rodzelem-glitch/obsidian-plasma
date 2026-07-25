import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { MessageSquare, Send, Phone, User, X, Check, Sparkles } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';

export interface SendSMSModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string | null;
    recipientPhone?: string;
    recipientName?: string;
    onSuccess?: () => void;
}

const SendSMSModal: React.FC<SendSMSModalProps> = ({
    isOpen,
    onClose,
    customerId,
    recipientPhone,
    recipientName,
    onSuccess
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [selectedPhone, setSelectedPhone] = useState('');
    const [customPhoneInput, setCustomPhoneInput] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Find customer doc if customerId provided
    const customer = useMemo(() => {
        if (!customerId) return null;
        return state.customers?.find((c: any) => c.id === customerId) || null;
    }, [state.customers, customerId]);

    // Available contact phones for quick selection
    const availablePhones = useMemo(() => {
        const list: Array<{ label: string; phone: string; role: string }> = [];
        if (customer) {
            if (customer.phone) {
                list.push({ label: customer.name || 'Primary Phone', phone: customer.phone, role: 'Primary' });
            }
            if (Array.isArray(customer.contacts)) {
                customer.contacts.forEach((c: any) => {
                    if (c.phone && !list.some(item => item.phone === c.phone)) {
                        list.push({ label: c.name || 'Contact', phone: c.phone, role: c.role || 'Contact' });
                    }
                });
            }
        }
        if (recipientPhone && !list.some(item => item.phone === recipientPhone)) {
            list.push({ label: recipientName || 'Direct Phone', phone: recipientPhone, role: 'Direct' });
        }
        return list;
    }, [customer, recipientPhone, recipientName]);

    useEffect(() => {
        if (!isOpen) return;

        const initialPhone = recipientPhone || customer?.phone || (availablePhones[0]?.phone) || '';
        setSelectedPhone(initialPhone);

        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || 'Customer';

        setMessage(`Hello ${clientName}, this is a message from ${orgName}. `);
    }, [isOpen, recipientPhone, recipientName, customer, availablePhones, state.currentOrganization]);

    const handleApplyTemplate = (templateType: 'reminder' | 'update' | 'arriving') => {
        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || 'Customer';

        if (templateType === 'reminder') {
            setMessage(`Hi ${clientName}, this is a friendly reminder from ${orgName} regarding your upcoming service appointment. Please reply YES to confirm.`);
        } else if (templateType === 'arriving') {
            setMessage(`Hi ${clientName}, your technician from ${orgName} is en route and will arrive shortly!`);
        } else if (templateType === 'update') {
            setMessage(`Hi ${clientName}, we have an update regarding your service request from ${orgName}. Please give us a call or reply to this text.`);
        }
    };

    const handleSend = async () => {
        const finalPhone = selectedPhone || customPhoneInput.trim();
        if (!finalPhone) {
            showToast.warn("Please select or enter a recipient phone number.");
            return;
        }
        if (!message.trim()) {
            showToast.warn("Please write an SMS message.");
            return;
        }

        setIsSending(true);
        try {
            const targetCustomerId = customerId || customer?.id || null;
            const nowIso = new Date().toISOString();

            // 1. Write to global messages collection for system-wide messaging & timeline tracking
            const msgObj: any = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: state.currentUser?.id || 'staff',
                senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
                receiverId: finalPhone,
                customerId: targetCustomerId,
                to: finalPhone,
                content: message.trim(),
                timestamp: nowIso,
                createdAt: nowIso,
                organizationId: state.currentOrganization?.id || null,
                type: 'sms',
                direction: 'outbound',
                status: 'sent'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj)).catch((e) => console.error("Error writing SMS message:", e));

            // 2. Write to customer's communications subcollection
            if (targetCustomerId) {
                const commEntry = {
                    id: `comm-${Date.now()}`,
                    type: 'sms_out',
                    title: 'SMS Sent Outbound',
                    subtitle: `To: ${finalPhone}`,
                    content: message.trim(),
                    badgeLabel: 'SMS Sent',
                    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
                    timestamp: nowIso,
                    senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'System'
                };
                await db.collection('customers').doc(targetCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
            }

            showToast.success(t("SMS sent successfully!"));
            if (onSuccess) onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Error sending SMS:", e);
            showToast.warn(t("Failed to send SMS. Please try again."));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("Send SMS Text Message")}
            size="md"
        >
            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                            {t("Outbound Text Message")}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {customer?.name ? `${customer.name} (${customer.phone || 'No main phone'})` : t("Send a direct SMS to customer mobile.")}
                        </p>
                    </div>
                </div>

                {/* Recipient Phone Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        {t("Recipient Phone Number")} <span className="text-rose-500">*</span>
                    </label>

                    {availablePhones.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {availablePhones.map(item => {
                                const isSelected = selectedPhone === item.phone;
                                return (
                                    <button
                                        key={item.phone}
                                        type="button"
                                        onClick={() => { setSelectedPhone(item.phone); setCustomPhoneInput(''); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            isSelected
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Phone size={12} />
                                        <span>{item.label}: {item.phone}</span>
                                        {isSelected && <Check size={12} />}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <Input
                            type="tel"
                            value={customPhoneInput}
                            onChange={(e) => setCustomPhoneInput(e.target.value)}
                            placeholder={t("Enter phone number (e.g. +1 555-123-4567)")}
                            className="text-xs font-medium"
                        />
                    )}
                </div>

                {/* Quick Templates */}
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        {t("Quick Message Templates:")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleApplyTemplate('reminder')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg transition-colors"
                        >
                            {t("Appointment Reminder")}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleApplyTemplate('arriving')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg transition-colors"
                        >
                            {t("Technician En Route")}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleApplyTemplate('update')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg transition-colors"
                        >
                            {t("Service Update")}
                        </button>
                    </div>
                </div>

                {/* SMS Body */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                            {t("SMS Message Text")} <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {message.length} / 160 {t("chars")}
                        </span>
                    </div>
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder={t("Write your SMS text message here...")}
                        className="text-xs leading-relaxed font-sans"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSending}
                        className="text-xs"
                    >
                        {t("Cancel")}
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={isSending}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 flex items-center gap-2 shadow-md"
                    >
                        <Send size={14} />
                        {isSending ? t("Sending...") : t("Send SMS")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SendSMSModal;
