import { cleanUndefinedFields, getBaseUrl } from '../../lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { MessageSquare, Send, Phone, User, X, Check, Sparkles, FileText, CreditCard, Link as LinkIcon, Wrench } from 'lucide-react';
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
    job?: any;
    invoice?: any;
    proposal?: any;
    paymentRequest?: any;
    defaultMessage?: string;
    zIndex?: string;
    onSuccess?: () => void;
}

const SendSMSModal: React.FC<SendSMSModalProps> = ({
    isOpen,
    onClose,
    customerId,
    recipientPhone,
    recipientName,
    job,
    invoice,
    proposal,
    paymentRequest,
    defaultMessage,
    zIndex = 'z-[10080]',
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
        const cId = customerId || job?.customerId || invoice?.job?.customerId;
        if (!cId) return null;
        return state.customers?.find((c: any) => c.id === cId) || null;
    }, [state.customers, customerId, job, invoice]);

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

    // Compute resolved link URLs
    const resolvedInvoiceLink = useMemo(() => {
        const targetJobId = job?.id || invoice?.jobId || invoice?.id;
        return targetJobId ? `${getBaseUrl()}/#/invoice/${targetJobId}` : null;
    }, [job, invoice]);

    const resolvedProposalLink = useMemo(() => {
        const propId = proposal?.id || job?.proposalId;
        return propId ? `${getBaseUrl()}/#/proposal-view/${propId}` : null;
    }, [proposal, job]);

    const resolvedReportLink = useMemo(() => {
        return job?.id ? `${getBaseUrl()}/#/service-report/${job.id}` : null;
    }, [job]);

    const resolvedPaymentRequestLink = useMemo(() => {
        return paymentRequest?.id ? `${getBaseUrl()}/#/pay/${paymentRequest.id}` : null;
    }, [paymentRequest]);

    useEffect(() => {
        if (!isOpen) return;

        const initialPhone = recipientPhone || customer?.phone || (availablePhones[0]?.phone) || '';
        setSelectedPhone(initialPhone);

        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || job?.customerName || 'Customer';

        if (defaultMessage) {
            setMessage(defaultMessage);
        } else if (resolvedInvoiceLink) {
            const invId = invoice?.id || job?.invoice?.id || job?.id?.slice(0, 8) || 'N/A';
            const totalAmt = Number(invoice?.totalAmount || invoice?.amount || job?.invoice?.totalAmount || 0);
            setMessage(`Hi ${clientName}, your invoice #${invId}${totalAmt > 0 ? ` ($${totalAmt.toFixed(2)})` : ''} from ${orgName} is ready for online review and payment: ${resolvedInvoiceLink}`);
        } else if (resolvedProposalLink) {
            const propId = proposal?.id || job?.proposalId || 'N/A';
            setMessage(`Hi ${clientName}, your proposal from ${orgName} is ready for review and authorization online: ${resolvedProposalLink}`);
        } else if (resolvedPaymentRequestLink) {
            const payAmt = Number(paymentRequest?.amount || 0);
            setMessage(`Hi ${clientName}, here is your secure online payment link from ${orgName} for $${payAmt.toFixed(2)} (${paymentRequest.title || 'Deposit'}): ${resolvedPaymentRequestLink}`);
        } else {
            setMessage(`Hello ${clientName}, this is a message from ${orgName}. `);
        }
    }, [isOpen, recipientPhone, recipientName, customer, availablePhones, defaultMessage, resolvedInvoiceLink, resolvedProposalLink, resolvedPaymentRequestLink, job, invoice, proposal, paymentRequest, state.currentOrganization]);

    const handleApplyTemplate = (templateType: 'invoice' | 'proposal' | 'deposit' | 'reminder' | 'update' | 'arriving') => {
        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || job?.customerName || 'Customer';

        if (templateType === 'invoice') {
            const invId = invoice?.id || job?.invoice?.id || job?.id?.slice(0, 8) || 'N/A';
            const totalAmt = Number(invoice?.totalAmount || invoice?.amount || job?.invoice?.totalAmount || 0);
            const link = resolvedInvoiceLink || `${getBaseUrl()}/#/invoice/${job?.id || 'id'}`;
            setMessage(`Hi ${clientName}, your invoice #${invId}${totalAmt > 0 ? ` for $${totalAmt.toFixed(2)}` : ''} from ${orgName} is ready. View & pay online here: ${link}`);
        } else if (templateType === 'proposal') {
            const link = resolvedProposalLink || `${getBaseUrl()}/#/proposal-view/${proposal?.id || job?.proposalId || 'id'}`;
            setMessage(`Hi ${clientName}, your proposal from ${orgName} is ready for review. You can review options and authorize online here: ${link}`);
        } else if (templateType === 'deposit') {
            const payAmt = Number(paymentRequest?.amount || 250);
            const link = resolvedPaymentRequestLink || `${getBaseUrl()}/#/pay/${paymentRequest?.id || 'request'}`;
            setMessage(`Hi ${clientName}, please use this link from ${orgName} to submit your $${payAmt.toFixed(2)} deposit securely: ${link}`);
        } else if (templateType === 'reminder') {
            setMessage(`Hi ${clientName}, this is a friendly reminder from ${orgName} regarding your upcoming service appointment. Please reply YES to confirm.`);
        } else if (templateType === 'arriving') {
            setMessage(`Hi ${clientName}, your technician from ${orgName} is en route and will arrive shortly!`);
        } else if (templateType === 'update') {
            setMessage(`Hi ${clientName}, we have an update regarding your service request from ${orgName}. Please give us a call or reply to this text.`);
        }
    };

    const handleInsertLink = (linkUrl: string, label: string) => {
        if (!linkUrl) return;
        setMessage(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${linkUrl}` : `${label}: ${linkUrl}`;
        });
        showToast.info(t(`${label} inserted into message.`));
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

            // 1. Write to global messages collection for system-wide messaging & twilio/backend dispatch
            const msgObj: any = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: state.currentUser?.id || 'staff',
                senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
                receiverId: finalPhone,
                customerId: targetCustomerId,
                to: finalPhone,
                content: message.trim(),
                body: message.trim(),
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
            zIndex={zIndex}
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

                {/* Quick Document Links */}
                {(resolvedInvoiceLink || resolvedProposalLink || resolvedReportLink || resolvedPaymentRequestLink) && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                            <LinkIcon size={12} className="text-teal-600" />
                            {t("Insert Document Links:")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {resolvedInvoiceLink && (
                                <button
                                    type="button"
                                    onClick={() => handleInsertLink(resolvedInvoiceLink, t("Invoice Link"))}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                                >
                                    <CreditCard size={12} className="text-blue-600" />
                                    {t("Insert Invoice Link")}
                                </button>
                            )}
                            {resolvedProposalLink && (
                                <button
                                    type="button"
                                    onClick={() => handleInsertLink(resolvedProposalLink, t("Proposal Link"))}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                                >
                                    <FileText size={12} className="text-indigo-600" />
                                    {t("Insert Proposal Link")}
                                </button>
                            )}
                            {resolvedPaymentRequestLink && (
                                <button
                                    type="button"
                                    onClick={() => handleInsertLink(resolvedPaymentRequestLink, t("Deposit Link"))}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                                >
                                    <CreditCard size={12} className="text-emerald-600" />
                                    {t("Insert Deposit Link")}
                                </button>
                            )}
                            {resolvedReportLink && (
                                <button
                                    type="button"
                                    onClick={() => handleInsertLink(resolvedReportLink, t("Report Link"))}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                                >
                                    <Wrench size={12} className="text-teal-600" />
                                    {t("Insert Report Link")}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Templates */}
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        {t("Quick Message Templates:")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {resolvedInvoiceLink && (
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate('invoice')}
                                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-lg transition-colors border border-blue-200/60 dark:border-blue-800/60"
                            >
                                {t("Invoice Link SMS")}
                            </button>
                        )}
                        {resolvedProposalLink && (
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate('proposal')}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold rounded-lg transition-colors border border-indigo-200/60 dark:border-indigo-800/60"
                            >
                                {t("Proposal Link SMS")}
                            </button>
                        )}
                        {resolvedPaymentRequestLink && (
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate('deposit')}
                                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-lg transition-colors border border-emerald-200/60 dark:border-emerald-800/60"
                            >
                                {t("Deposit Request SMS")}
                            </button>
                        )}
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
