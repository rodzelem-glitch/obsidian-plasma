import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { CreditCard, DollarSign, Mail, MessageSquare, Copy, Check, Sparkles, User, Link as LinkIcon, Briefcase, MapPin } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import { getBaseUrl, cleanUndefinedFields } from 'lib/utils';
import showToast from 'lib/toast';
import type { Customer, PaymentRequest, Job } from 'types';
import SendEmailModal from './SendEmailModal';
import SendSMSModal from './SendSMSModal';
import { PaymentInstructionsCard } from 'components/payment/PaymentInstructionsCard';

export interface CreatePaymentLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string | null;
    defaultCustomerId?: string | null;
    jobId?: string | null;
    proposalId?: string | null;
    defaultAmount?: number;
    defaultTitle?: string;
    defaultDescription?: string;
    onSuccess?: (paymentRequest: PaymentRequest) => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];
const PURPOSE_PRESETS = [
    { label: 'Equipment Order Deposit', title: 'Equipment Order Deposit', desc: 'Upfront deposit to secure and order required HVAC equipment & materials.' },
    { label: 'Service Call Deposit', title: 'Service Call Deposit', desc: 'Initial deposit to confirm technician dispatch and service appointment.' },
    { label: 'Emergency Dispatch Fee', title: 'Emergency Dispatch Fee', desc: 'Emergency service dispatch retainer for rapid on-site technician response.' },
    { label: 'Project Retainer', title: 'Commercial Project Retainer', desc: 'Initial retainer payment for scheduled commercial mechanical contract.' },
    { label: 'Custom Payment', title: 'Service Payment', desc: 'Payment for services rendered.' },
];

const CreatePaymentLinkModal: React.FC<CreatePaymentLinkModalProps> = ({
    isOpen,
    onClose,
    customerId,
    defaultCustomerId,
    jobId,
    proposalId,
    defaultAmount,
    defaultTitle,
    defaultDescription,
    onSuccess
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const activeCustId = customerId || defaultCustomerId || '';
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(activeCustId);
    const [selectedJobId, setSelectedJobId] = useState<string>(jobId || '');
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [amount, setAmount] = useState<string>(defaultAmount ? String(defaultAmount) : '250');
    const [title, setTitle] = useState(defaultTitle || 'Equipment Order Deposit');
    const [description, setDescription] = useState(defaultDescription || 'Upfront deposit to secure and order required HVAC equipment & materials.');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdPaymentRequest, setCreatedPaymentRequest] = useState<PaymentRequest | null>(null);
    const [copied, setCopied] = useState(false);

    // Child modals for dispatching created link
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

    // Available jobs for selected customer or provided jobId
    const availableJobs = useMemo(() => {
        const jobsList = state.jobs || [];
        if (!selectedCustomerId && !jobId) return jobsList;
        return jobsList.filter((j: Job) => {
            if (selectedCustomerId && j.customerId === selectedCustomerId) return true;
            if (jobId && (j.id === jobId || (j as any).jobNumber === jobId)) return true;
            return false;
        });
    }, [selectedCustomerId, state.jobs, jobId]);

    // Sync if customerId / jobId prop changes
    useEffect(() => {
        const targetCustId = customerId || defaultCustomerId;
        if (targetCustId) {
            setSelectedCustomerId(targetCustId);
            const foundCust = state.customers?.find((c: Customer) => c.id === targetCustId);
            if (foundCust) {
                setCustomerName(foundCust.name || '');
                setCustomerEmail(foundCust.email || '');
                setCustomerPhone(foundCust.phone || '');
                const rawAddr = typeof foundCust.address === 'object' 
                    ? `${(foundCust.address as any).street || ''}, ${(foundCust.address as any).city || ''}, ${(foundCust.address as any).state || ''} ${(foundCust.address as any).zip || ''}`.replace(/^[\s,]+|[\s,]+$/g, '')
                    : (foundCust.address || '');
                setCustomerAddress(rawAddr);
            }
        }
        if (jobId) {
            setSelectedJobId(jobId);
        }
    }, [customerId, defaultCustomerId, jobId, state.customers]);

    // When available jobs or selectedJobId changes, auto-populate deposit details
    useEffect(() => {
        if (availableJobs.length > 0) {
            const targetJob = availableJobs.find((j: Job) => j.id === selectedJobId) || 
                              (availableJobs.length === 1 ? availableJobs[0] : availableJobs.find((j: Job) => (j.depositRequired || (j.invoice as any)?.depositRequired) && !j.depositPaid));
            if (targetJob) {
                if (!selectedJobId) {
                    setSelectedJobId(targetJob.id);
                }
                if (targetJob.customerName && !customerName) setCustomerName(targetJob.customerName);
                if (targetJob.customerEmail && !customerEmail) setCustomerEmail(targetJob.customerEmail);
                if (targetJob.customerPhone && !customerPhone) setCustomerPhone(targetJob.customerPhone);
                if (targetJob.address) setCustomerAddress(targetJob.address);
                
                const depAmt = targetJob.depositRequired || targetJob.depositAmount || (targetJob.invoice as any)?.depositRequired || (targetJob.invoice as any)?.depositAmount;
                if (depAmt && (!defaultAmount || amount === '250')) {
                    setAmount(String(depAmt));
                    setTitle(`Equipment Order Deposit - Job #${targetJob.jobNumber || targetJob.id}`);
                    setDescription(`Upfront required deposit for ${targetJob.tasks?.join(', ') || 'scheduled HVAC equipment & service appointment'}.`);
                }
            }
        }
    }, [availableJobs, selectedJobId]);

    // Handle customer dropdown change
    const handleSelectCustomer = (cId: string) => {
        setSelectedCustomerId(cId);
        setSelectedJobId('');
        if (!cId) {
            setCustomerName('');
            setCustomerEmail('');
            setCustomerPhone('');
            setCustomerAddress('');
            return;
        }
        const found = state.customers?.find((c: Customer) => c.id === cId);
        if (found) {
            setCustomerName(found.name || '');
            setCustomerEmail(found.email || '');
            setCustomerPhone(found.phone || '');
            const rawAddr = typeof found.address === 'object' 
                ? `${(found.address as any).street || ''}, ${(found.address as any).city || ''}, ${(found.address as any).state || ''} ${(found.address as any).zip || ''}`.replace(/^[\s,]+|[\s,]+$/g, '')
                : (found.address || '');
            setCustomerAddress(rawAddr);
        }
    };

    const handleSelectJob = (jId: string) => {
        setSelectedJobId(jId);
        if (!jId) return;
        const targetJob = (state.jobs || []).find((j: Job) => j.id === jId);
        if (targetJob) {
            if (targetJob.customerName) setCustomerName(targetJob.customerName);
            if (targetJob.customerEmail) setCustomerEmail(targetJob.customerEmail);
            if (targetJob.customerPhone) setCustomerPhone(targetJob.customerPhone);
            if (targetJob.address) setCustomerAddress(targetJob.address);

            const depAmt = targetJob.depositRequired || targetJob.depositAmount || (targetJob.invoice as any)?.depositRequired || (targetJob.invoice as any)?.depositAmount;
            if (depAmt) {
                setAmount(String(depAmt));
                setTitle(`Equipment Order Deposit - Job #${targetJob.jobNumber || targetJob.id}`);
                setDescription(`Upfront required deposit for ${targetJob.tasks?.join(', ') || 'scheduled HVAC equipment & service appointment'}.`);
            }
        }
    };

    const handleApplyPurpose = (preset: typeof PURPOSE_PRESETS[0]) => {
        setTitle(preset.title);
        setDescription(preset.desc);
    };

    const numAmount = parseFloat(amount) || 0;

    const handleCreateLink = async (andThen?: 'copy' | 'email' | 'sms') => {
        if (numAmount <= 0) {
            showToast.warn(t("Please enter a valid payment amount (greater than $0.00)."));
            return null;
        }
        if (!customerName.trim()) {
            showToast.warn(t("Please enter or select a customer name."));
            return null;
        }

        setIsSubmitting(true);
        try {
            const org = state.currentOrganization;
            const orgId = org?.id || 'org-1765817997819';
            const reqId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const nowIso = new Date().toISOString();
            const senderName = state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}`.trim() : 'Staff';

            const targetCustomerJob = (availableJobs && availableJobs.length === 1) ? availableJobs[0] : 
                                      (availableJobs.find((j: Job) => (j.depositRequired || (j.invoice as any)?.depositRequired) && !j.depositPaid) || availableJobs[0]);

            const selectedJob = (state.jobs || []).find((j: Job) => j.id === selectedJobId) || 
                               (jobId ? (state.jobs || []).find((j: Job) => j.id === jobId) : null) ||
                               targetCustomerJob || null;

            const resolvedJobId = selectedJobId || jobId || selectedJob?.id || null;

            const orgAddrStr = typeof org?.address === 'object'
                ? `${(org.address as any).street || ''}, ${(org.address as any).city || ''}, ${(org.address as any).state || ''} ${(org.address as any).zip || ''}`.replace(/^[\s,]+|[\s,]+$/g, '')
                : (org?.address || '2618 Middleground, San Antonio, TX 78245');

            const newReq: PaymentRequest = {
                id: reqId,
                organizationId: orgId,
                customerId: selectedCustomerId || selectedJob?.customerId || null,
                customerName: customerName.trim() || selectedJob?.customerName || 'Valued Customer',
                customerEmail: customerEmail.trim() || selectedJob?.customerEmail || null,
                customerPhone: customerPhone.trim() || selectedJob?.customerPhone || null,
                customerAddress: customerAddress.trim() || selectedJob?.address || null,
                jobId: resolvedJobId,
                jobNumber: selectedJob?.jobNumber || selectedJob?.id || null,
                proposalId: selectedJob?.proposalId || proposalId || null,
                invoiceNumber: (selectedJob?.invoice as any)?.invoiceNumber || (selectedJob?.invoice as any)?.id || null,
                serviceProviderName: org?.name || 'TekAir Inc.',
                serviceProviderPhone: org?.phone || '210-318-4197',
                serviceProviderEmail: org?.email || 'Operations@tekairinc.com',
                serviceProviderAddress: orgAddrStr,
                serviceProviderLogo: org?.logoUrl || null,
                amount: numAmount,
                title: title.trim() || 'Service Deposit',
                description: description.trim() || null,
                status: 'pending',
                type: 'deposit',
                createdAt: nowIso,
                createdBy: senderName,
                totalAmount: (selectedJob?.invoice as any)?.totalAmount || selectedJob?.total || numAmount,
                depositRequired: selectedJob?.depositRequired || (selectedJob?.invoice as any)?.depositRequired || numAmount,
                jobTasks: selectedJob?.tasks || [],
                jobItems: (selectedJob?.invoice as any)?.items || [],
                appointmentTime: selectedJob?.appointmentTime || null
            } as any;

            await db.collection('paymentRequests').doc(reqId).set(cleanUndefinedFields(newReq));
            await db.collection('payment_requests').doc(reqId).set(cleanUndefinedFields(newReq)).catch(() => {});

            // Log entry in customer communications timeline if customer is known
            if (selectedCustomerId) {
                const commEntry = {
                    id: `comm-paylink-${Date.now()}`,
                    type: 'payment_link_created',
                    title: `Payment Link Created: $${numAmount.toFixed(2)}`,
                    subtitle: title,
                    content: `Created online deposit/payment link for $${numAmount.toFixed(2)} (${title}). Link: ${getBaseUrl()}/#/pay/${reqId}`,
                    badgeLabel: 'Deposit Link',
                    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
                    timestamp: nowIso,
                    senderName
                };
                await db.collection('customers').doc(selectedCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
            }

            setCreatedPaymentRequest(newReq);
            showToast.success(t(`Payment link for $${numAmount.toFixed(2)} generated successfully!`));

            if (onSuccess) onSuccess(newReq);

            const payUrl = `${getBaseUrl()}/#/pay/${reqId}`;

            if (andThen === 'copy') {
                await navigator.clipboard.writeText(payUrl);
                setCopied(true);
                showToast.success(t("Payment link copied to clipboard!"));
                setTimeout(() => setCopied(false), 3000);
            } else if (andThen === 'email') {
                setIsEmailModalOpen(true);
            } else if (andThen === 'sms') {
                setIsSmsModalOpen(true);
            }

            return newReq;
        } catch (e: any) {
            console.error("Error creating payment link:", e);
            showToast.error(t("Failed to generate payment link. Please try again."));
            return null;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyExisting = async () => {
        if (!createdPaymentRequest) return;
        const payUrl = `${getBaseUrl()}/#/pay/${createdPaymentRequest.id}`;
        await navigator.clipboard.writeText(payUrl);
        setCopied(true);
        showToast.success(t("Payment link copied to clipboard!"));
        setTimeout(() => setCopied(false), 3000);
    };

    const paymentUrl = createdPaymentRequest ? `${getBaseUrl()}/#/pay/${createdPaymentRequest.id}` : '';

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={t("Create Deposit / Payment Link")}
                size="lg"
                zIndex="z-[10060]"
            >
                <div className="p-6 space-y-6">
                    {/* Header Banner */}
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/50">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                            <CreditCard size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {t("Collect Deposit or Upfront Payment")}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                                {t("Generate a secure, branded payment link to collect deposits, retainers, or advance payments before creating formal invoices.")}
                            </p>
                        </div>
                    </div>

                    {!createdPaymentRequest ? (
                        <div className="space-y-5">
                            {/* Customer Selector / Input */}
                            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                                    <User size={14} className="text-blue-600" />
                                    {t("Customer Details")} <span className="text-rose-500">*</span>
                                </label>

                                {state.customers && state.customers.length > 0 && (
                                    <div>
                                        <select
                                            value={selectedCustomerId}
                                            onChange={(e) => handleSelectCustomer(e.target.value)}
                                            className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- {t("Select Existing Customer (or type custom details below)")} --</option>
                                            {state.customers.map((c: Customer) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} {c.email ? `(${c.email})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            {t("Customer Name")} <span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder={t("e.g. John Doe / Best Choice FL")}
                                            className="text-xs font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            {t("Email Address")}
                                        </label>
                                        <Input
                                            type="email"
                                            value={customerEmail}
                                            onChange={(e) => setCustomerEmail(e.target.value)}
                                            placeholder={t("customer@example.com")}
                                            className="text-xs font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                            {t("Mobile Phone (for SMS)")}
                                        </label>
                                        <Input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            placeholder={t("+1 (555) 000-0000")}
                                            className="text-xs font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                        <MapPin size={11} className="text-blue-500" />
                                        {t("Service Address")}
                                    </label>
                                    <Input
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        placeholder={t("e.g. 23027 Sandy Forest Dr, Elmendorf, TX 78112")}
                                        className="text-xs font-medium"
                                    />
                                </div>

                                {/* Link to Job / Work Order Selector */}
                                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Briefcase size={12} className="text-indigo-500" />
                                            {t("Link to Job / Work Order")}
                                        </span>
                                        {selectedJobId && (
                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                                                {t("Linked to Job")} #{selectedJobId}
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        value={selectedJobId}
                                        onChange={(e) => handleSelectJob(e.target.value)}
                                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- {t("No specific job (Standalone Payment Link)")} --</option>
                                        {availableJobs.map((j: Job) => {
                                            const depReq = j.depositRequired || (j.invoice as any)?.depositRequired;
                                            const tot = (j.invoice as any)?.totalAmount || j.total || 0;
                                            return (
                                                <option key={j.id} value={j.id}>
                                                    Job #{j.jobNumber || j.id} — {j.tasks?.[0] || 'HVAC Service'} {tot > 0 ? `($${tot.toFixed(2)})` : ''} {depReq > 0 ? `[Req. Deposit: $${depReq.toFixed(2)}]` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>

                            {/* Amount Configuration */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                                    <DollarSign size={14} className="text-emerald-600" />
                                    {t("Deposit / Payment Amount")} <span className="text-rose-500">*</span>
                                </label>

                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 max-w-[200px]">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="250.00"
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-black focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                        {PRESET_AMOUNTS.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setAmount(String(preset))}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                    numAmount === preset
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                ${preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Title & Purpose Selection */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                                        {t("Payment Title / Reason")} <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Sparkles size={11} className="text-amber-500" />
                                        {t("Quick Presets")}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {PURPOSE_PRESETS.map((p) => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            onClick={() => handleApplyPurpose(p)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                                title === p.title
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-200'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t("e.g. Equipment Order Deposit")}
                                    className="text-xs font-bold"
                                />
                            </div>

                            {/* Customer Notes / Description */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                                    {t("Customer Notes & Instructions")}
                                </label>
                                <Textarea
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t("Explain what this deposit covers for the customer...")}
                                    className="text-xs font-medium"
                                />
                            </div>

                            {/* Primary Action Buttons */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                >
                                    {t("Cancel")}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleCreateLink('copy')}
                                    disabled={isSubmitting || numAmount <= 0}
                                    className="flex items-center gap-1.5"
                                >
                                    <Copy size={14} />
                                    {t("Create & Copy Link")}
                                </Button>
                                {customerPhone && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleCreateLink('sms')}
                                        disabled={isSubmitting || numAmount <= 0}
                                        className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 dark:text-teal-400"
                                    >
                                        <MessageSquare size={14} />
                                        {t("Create & Send SMS")}
                                    </Button>
                                )}
                                <Button
                                    variant="primary"
                                    onClick={() => handleCreateLink('email')}
                                    disabled={isSubmitting || numAmount <= 0}
                                    className="flex items-center gap-1.5"
                                >
                                    <Mail size={14} />
                                    {t("Create & Send Email")}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Created Confirmation View */
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                                    <Check size={26} />
                                </div>
                                <h4 className="text-base font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">
                                    {t("Payment Link Ready")}
                                </h4>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                    ${numAmount.toFixed(2)} {t("deposit request created for")} <strong className="text-emerald-950 dark:text-white">{customerName}</strong>.
                                </p>
                            </div>

                            {/* Public Link Box */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1">
                                    <LinkIcon size={13} className="text-blue-600" />
                                    {t("Public Customer Payment Link:")}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={paymentUrl}
                                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono select-all focus:ring-2 focus:ring-blue-500"
                                    />
                                    <Button
                                        variant={copied ? "primary" : "secondary"}
                                        onClick={handleCopyExisting}
                                        className="flex items-center gap-1.5 shrink-0"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? t("Copied!") : t("Copy")}
                                    </Button>
                                </div>
                            </div>

                            {/* Dispatch Channel Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEmailModalOpen(true)}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/70 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                                        <Mail size={18} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            {t("Send via Email")}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {customerEmail ? `${t("To:")} ${customerEmail}` : t("Send branded email with Pay button")}
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsSmsModalOpen(true)}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/70 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                                        <MessageSquare size={18} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            {t("Send via SMS Text")}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {customerPhone ? `${t("To:")} ${customerPhone}` : t("Send direct payment link to mobile")}
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Direct Remittance Reference */}
                            <PaymentInstructionsCard 
                                organization={state.currentOrganization}
                                variant="compact"
                                title="Organization Direct Remittance Info (Wire / Check / ACH)"
                            />

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                                <Button variant="secondary" onClick={onClose}>
                                    {t("Done")}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Email Dispatch Modal with pre-configured Deposit Details */}
            {isEmailModalOpen && createdPaymentRequest && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    recipientEmail={customerEmail ? [customerEmail] : []}
                    recipientName={customerName}
                    customerId={selectedCustomerId}
                    paymentRequest={createdPaymentRequest}
                    mode="email"
                    zIndex="z-[10080]"
                    defaultSubject={`Payment Request: $${createdPaymentRequest.amount.toFixed(2)} for ${createdPaymentRequest.title} — ${state.currentOrganization?.name || 'Service Provider'}`}
                    defaultMessage={`Hi ${customerName},\n\nPlease find your secure online payment link below for $${createdPaymentRequest.amount.toFixed(2)} (${createdPaymentRequest.title}).\n\n${createdPaymentRequest.description ? `${createdPaymentRequest.description}\n\n` : ''}You can pay securely online with any major credit card here:\n${paymentUrl}\n\nThank you for your business!\n\nBest regards,\n${state.currentOrganization?.name || 'Service Provider'}`}
                    onSuccess={() => {
                        setIsEmailModalOpen(false);
                        showToast.success(t("Payment link sent via email!"));
                    }}
                />
            )}

            {/* SMS Dispatch Modal with pre-configured Deposit Details */}
            {isSmsModalOpen && createdPaymentRequest && (
                <SendSMSModal
                    isOpen={isSmsModalOpen}
                    onClose={() => setIsSmsModalOpen(false)}
                    recipientPhone={customerPhone}
                    recipientName={customerName}
                    customerId={selectedCustomerId}
                    paymentRequest={createdPaymentRequest}
                    zIndex="z-[10080]"
                    defaultMessage={`Hi ${customerName}, here is your secure link from ${state.currentOrganization?.name || 'Service Provider'} to pay your $${createdPaymentRequest.amount.toFixed(2)} ${createdPaymentRequest.title}: ${paymentUrl}`}
                    onSuccess={() => {
                        setIsSmsModalOpen(false);
                        showToast.success(t("Payment link sent via SMS!"));
                    }}
                />
            )}
        </>
    );
};

export default CreatePaymentLinkModal;
