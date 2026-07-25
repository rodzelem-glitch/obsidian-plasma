import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { Mail, Send, User, X, Plus, Check, Paperclip, FileText, AlertCircle, Layers } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { sendEmail } from 'lib/notificationService';
import { db } from 'lib/firebase';
import { getBaseUrl , cleanUndefinedFields } from 'lib/utils';
import showToast from 'lib/toast';
import { generateMultiDocumentPdfAttachments, EmailAttachment } from 'lib/pdfHelper';

export interface SendEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientEmail?: string | string[];
    recipientName?: string;
    customerId?: string | null;
    job?: any;
    invoice?: any;
    proposal?: any;
    mode?: 'email' | 'invoice' | 'report' | 'proposal';
    defaultSubject?: string;
    defaultMessage?: string;
    onSuccess?: () => void;
}

const SendEmailModal: React.FC<SendEmailModalProps> = ({
    isOpen,
    onClose,
    recipientEmail,
    recipientName,
    customerId,
    job,
    invoice,
    proposal,
    mode = 'email',
    defaultSubject,
    defaultMessage,
    onSuccess
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [recipients, setRecipients] = useState<string[]>([]);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Multi-document inclusion states
    const [includeInvoice, setIncludeInvoice] = useState(false);
    const [includeReport, setIncludeReport] = useState(false);
    const [includeProposal, setIncludeProposal] = useState(false);

    // Delivery options (Default: Interactive links ON, PDF attachments OFF)
    const [attachInteractiveLinks, setAttachInteractiveLinks] = useState(true);
    const [attachPdfFiles, setAttachPdfFiles] = useState(false);
    const [generatedPdfAttachments, setGeneratedPdfAttachments] = useState<EmailAttachment[]>([]);
    const [isGeneratingPdfs, setIsGeneratingPdfs] = useState(false);

    // Find customer doc if customerId provided or from job
    const customer = useMemo(() => {
        const cId = customerId || job?.customerId || invoice?.job?.customerId;
        if (!cId) return null;
        return state.customers?.find((c: any) => c.id === cId) || null;
    }, [state.customers, customerId, job, invoice]);

    // Customer jobs & proposals fallback resolution
    const customerJobs = useMemo(() => {
        const cId = customer?.id || customerId;
        const cName = (customer?.name || recipientName || '').toLowerCase();
        if (!cId && !cName) return [];
        const rawJobs = (state.jobs || []).filter((j: any) => 
            (cId && j.customerId === cId) || 
            (cName && j.customerName?.toLowerCase().includes(cName))
        );

        // Sort newest jobs first (by timestamp, createdAt, appointmentTime, date, or numeric ID)
        return [...rawJobs].sort((a: any, b: any) => {
            const timeA = Math.max(
                new Date(a.createdAt || a.appointmentTime || a.date || a.updatedAt || 0).getTime(),
                typeof a.id === 'string' && a.id.includes('-') ? parseInt(a.id.split('-').pop() || '0') || 0 : 0
            );
            const timeB = Math.max(
                new Date(b.createdAt || b.appointmentTime || b.date || b.updatedAt || 0).getTime(),
                typeof b.id === 'string' && b.id.includes('-') ? parseInt(b.id.split('-').pop() || '0') || 0 : 0
            );
            return timeB - timeA;
        });
    }, [state.jobs, customer, customerId, recipientName]);

    const customerProposals = useMemo(() => {
        const cId = customer?.id || customerId;
        const cName = (customer?.name || recipientName || '').toLowerCase();
        if (!cId && !cName) return [];
        return (state.proposals || []).filter((p: any) => 
            (cId && p.customerId === cId) || 
            (cName && p.customerName?.toLowerCase().includes(cName))
        );
    }, [state.proposals, customer, customerId, recipientName]);

    const [selectedJobId, setSelectedJobId] = useState<string>('');

    useEffect(() => {
        if (!isOpen) return;
        if (job?.id) {
            setSelectedJobId(job.id);
        } else if (invoice?.jobId) {
            setSelectedJobId(invoice.jobId);
        } else if (customerJobs.length > 0) {
            setSelectedJobId(customerJobs[0].id);
        }
    }, [isOpen, job, invoice, customerJobs]);

    const targetJob = useMemo(() => {
        if (job) return job;
        if (invoice?.job) return invoice.job;
        if (selectedJobId) return customerJobs.find((j: any) => j.id === selectedJobId) || customerJobs[0] || null;
        return customerJobs[0] || null;
    }, [job, invoice, selectedJobId, customerJobs]);

    const targetInvoice = useMemo(() => {
        if (invoice) return invoice;
        if (targetJob?.invoice) return targetJob.invoice;
        const jobWithInv = customerJobs.find((j: any) => j.invoice);
        return jobWithInv?.invoice || null;
    }, [invoice, targetJob, customerJobs]);

    const targetProposal = useMemo(() => {
        if (proposal) return proposal;
        if (targetJob?.proposalId) {
            const found = state.proposals?.find((p: any) => p.id === targetJob.proposalId);
            if (found) return found;
        }
        return customerProposals[0] || null;
    }, [proposal, targetJob, customerProposals, state.proposals]);

    const hasInvoiceData = !!targetInvoice || !!targetJob?.invoice || customerJobs.some((j: any) => j.invoice);
    const hasReportData = !!targetJob || customerJobs.length > 0;
    const hasProposalData = !!targetProposal || customerProposals.length > 0;

    // Available contact emails for quick selection
    const availableContacts = useMemo(() => {
        const list: Array<{ label: string; email: string; role: string }> = [];
        if (customer) {
            if (customer.email) {
                list.push({ label: customer.name || 'Primary Customer', email: customer.email, role: 'Primary' });
            }
            if (customer.billingContact?.email && customer.billingContact.email !== customer.email) {
                list.push({ label: customer.billingContact.name || 'Billing Contact', email: customer.billingContact.email, role: 'Billing' });
            }
            if (Array.isArray(customer.contacts)) {
                customer.contacts.forEach((c: any) => {
                    if (c.email && !list.some(item => item.email.toLowerCase() === c.email.toLowerCase())) {
                        list.push({ label: c.name || 'Contact', email: c.email, role: c.role || 'Contact' });
                    }
                });
            }
        }
        if (targetJob?.customerEmail && !list.some(item => item.email.toLowerCase() === targetJob.customerEmail.toLowerCase())) {
            list.push({ label: targetJob.customerName || 'Job Customer', email: targetJob.customerEmail, role: 'Job Email' });
        }
        return list;
    }, [customer, targetJob]);

    useEffect(() => {
        if (!isOpen) return;

        // Populate recipients
        const initialRecipients: string[] = [];
        if (Array.isArray(recipientEmail)) {
            recipientEmail.forEach(e => { if (e && !initialRecipients.includes(e)) initialRecipients.push(e); });
        } else if (recipientEmail) {
            initialRecipients.push(recipientEmail);
        } else if (customer?.email) {
            initialRecipients.push(customer.email);
        } else if (targetJob?.customerEmail) {
            initialRecipients.push(targetJob.customerEmail);
        }
        setRecipients(initialRecipients);

        // Auto-select document defaults
        const hasInv = mode === 'invoice' || !!targetInvoice || !!targetJob?.invoice;
        const hasRep = mode === 'report' || !!targetJob;
        const hasProp = mode === 'proposal' || !!proposal || !!targetJob?.proposalId || (Array.isArray(targetJob?.linkedProposalIds) && targetJob.linkedProposalIds.length > 0);

        setIncludeInvoice(hasInv);
        setIncludeReport(mode === 'report' || (!hasInv && hasRep));
        setIncludeProposal(mode === 'proposal' || !!proposal);

        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || targetJob?.customerName || 'Valued Customer';

        if (mode === 'invoice' || targetInvoice) {
            const invId = targetInvoice?.id || targetJob?.id?.slice(0, 8) || 'N/A';
            const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);
            const invLink = targetJob?.id ? `${getBaseUrl()}/#/invoice/${targetJob.id}` : getBaseUrl();

            setSubject(defaultSubject || `Invoice #${invId} from ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Please find your invoice #${invId} for $${totalAmt.toFixed(2)} attached below.

You can view, download, and pay your invoice securely online here:
${invLink}

Thank you for your business!

Best regards,
${orgName}`);
        } else if (mode === 'report' || (targetJob && !targetInvoice)) {
            setSubject(defaultSubject || `Service Report — Job #${targetJob?.id?.slice(-8).toUpperCase() || 'N/A'} — ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Thank you for choosing ${orgName}. Please review your completed service report details below.

Best regards,
${orgName}`);
        } else {
            setSubject(defaultSubject || `Message from ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Thank you for choosing ${orgName}. If you have any questions or require assistance, please reply directly to this email.

Best regards,
${orgName}`);
        }
    }, [isOpen, recipientEmail, recipientName, customer, targetJob, targetInvoice, proposal, mode, defaultSubject, defaultMessage, state.currentOrganization]);

    const handleAddEmail = () => {
        const trimmed = newEmailInput.trim().toLowerCase();
        if (!trimmed) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            showToast.warn("Please enter a valid email address.");
            return;
        }
        if (recipients.includes(trimmed)) {
            showToast.warn("Email already added.");
            return;
        }
        setRecipients(prev => [...prev, trimmed]);
        setNewEmailInput('');
    };

    const handleRemoveEmail = (emailToRemove: string) => {
        setRecipients(prev => prev.filter(e => e !== emailToRemove));
    };

    const toggleContactSelect = (email: string) => {
        const lower = email.toLowerCase();
        if (recipients.includes(lower)) {
            setRecipients(prev => prev.filter(e => e !== lower));
        } else {
            setRecipients(prev => [...prev, lower]);
        }
    };

    const handleGeneratePdfAttachments = async (overrideFlags?: { incInv?: boolean; incRep?: boolean; incProp?: boolean }) => {
        setIsGeneratingPdfs(true);
        try {
            let incInv = overrideFlags?.incInv ?? includeInvoice;
            let incRep = overrideFlags?.incRep ?? includeReport;
            let incProp = overrideFlags?.incProp ?? includeProposal;

            // Auto-enable primary document if none are explicitly selected
            if (!incInv && !incRep && !incProp) {
                if (mode === 'invoice' || targetInvoice || targetJob?.invoice) {
                    incInv = true;
                    setIncludeInvoice(true);
                } else if (mode === 'report' || targetJob) {
                    incRep = true;
                    setIncludeReport(true);
                } else if (mode === 'proposal' || proposal || targetJob?.proposalId) {
                    incProp = true;
                    setIncludeProposal(true);
                }
            }

            showToast.info(t("Generating selected PDF attachments..."));
            const targetProposal = proposal || state.proposals?.find((p: any) => p.id === targetJob?.proposalId || (Array.isArray(targetJob?.linkedProposalIds) && targetJob.linkedProposalIds.includes(p.id)));

            const generated = await generateMultiDocumentPdfAttachments(
                {
                    job: targetJob,
                    invoice: targetInvoice,
                    proposal: targetProposal,
                    includeInvoice: incInv,
                    includeReport: incRep,
                    includeProposal: incProp,
                    customMessage: message.trim()
                },
                state.currentOrganization
            );

            if (generated.length > 0) {
                setGeneratedPdfAttachments(generated);
                setAttachPdfFiles(true);
                showToast.success(t(`Generated ${generated.length} PDF file attachment(s)!`));
            } else {
                showToast.warn(t("Please select at least one document type (Invoice, Report, or Proposal) to generate."));
            }
        } catch (e: any) {
            console.error("PDF generation error:", e);
            showToast.warn(t("Could not generate PDF documents. Please try again."));
        } finally {
            setIsGeneratingPdfs(false);
        }
    };

    const handleSend = async () => {
        if (recipients.length === 0) {
            showToast.warn("Please add at least one recipient email.");
            return;
        }
        if (!subject.trim()) {
            showToast.warn("Please enter a subject line.");
            return;
        }
        if (!message.trim()) {
            showToast.warn("Please enter a message body.");
            return;
        }

        setIsSending(true);
        try {
            const orgName = state.currentOrganization?.name || 'Service Provider';
            let htmlContent = message.replace(/\n/g, '<br/>');

            // 1. Standard Interactive Links (Default option - keeps signatures & tracking in system)
            if (attachInteractiveLinks) {
                let linksBlock = '';

                if (includeInvoice && targetJob?.id) {
                    const invId = targetInvoice?.id || targetJob.id.slice(0, 8);
                    const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);
                    const invLink = `${getBaseUrl()}/#/invoice/${targetJob.id}`;
                    linksBlock += `
                        <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
                            <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 15px;">Invoice #${invId} — $${totalAmt.toFixed(2)}</h4>
                            <p style="margin: 0 0 12px 0; color: #475569; font-size: 13px;">View, sign, and pay your invoice securely online.</p>
                            <a href="${invLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">View &amp; Pay Invoice Online</a>
                        </div>
                    `;
                }

                if (includeReport && targetJob?.id) {
                    const reportLink = `${getBaseUrl()}/#/job-history`;
                    linksBlock += `
                        <div style="margin-top: 16px; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
                            <h4 style="margin: 0 0 6px 0; color: #166534; font-size: 15px;">Service History Report #${targetJob.id.slice(-8).toUpperCase()}</h4>
                            <p style="margin: 0 0 12px 0; color: #15803d; font-size: 13px;">Access complete technician notes, completion status, and work details online.</p>
                            <a href="${reportLink}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">View Service Report Online</a>
                        </div>
                    `;
                }

                if (includeProposal && (proposal || targetJob?.proposalId)) {
                    const propId = proposal?.id || targetJob?.proposalId;
                    const propLink = `${getBaseUrl()}/#/proposal-view/${propId}`;
                    linksBlock += `
                        <div style="margin-top: 16px; padding: 16px; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px;">
                            <h4 style="margin: 0 0 6px 0; color: #0369a1; font-size: 15px;">Commercial Contract Proposal #${propId}</h4>
                            <p style="margin: 0 0 6px 0; color: #0284c7; font-size: 13px;">Review option tiers and approve your proposal online.</p>
                            <a href="${propLink}" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">View &amp; Sign Proposal Online</a>
                        </div>
                    `;
                }

                if (linksBlock) {
                    htmlContent += `<div style="margin-top: 24px;">${linksBlock}</div>`;
                }
            }

            // 2. Prepare PDF Attachments
            let pdfAttachments: EmailAttachment[] = [...generatedPdfAttachments];
            if (attachPdfFiles && pdfAttachments.length === 0) {
                showToast.info(t("Generating requested PDF documents..."));
                const targetProposal = proposal || state.proposals?.find((p: any) => p.id === targetJob?.proposalId || (Array.isArray(targetJob?.linkedProposalIds) && targetJob.linkedProposalIds.includes(p.id)));
                pdfAttachments = await generateMultiDocumentPdfAttachments(
                    {
                        job: targetJob,
                        invoice: targetInvoice,
                        proposal: targetProposal,
                        includeInvoice: includeInvoice,
                        includeReport: includeReport,
                        includeProposal: includeProposal,
                        customMessage: message.trim()
                    },
                    state.currentOrganization
                );
            }

            const isInvoice = includeInvoice || mode === 'invoice' || !!targetInvoice;

            const mailPayload = {
                to: recipients,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: subject.trim(),
                    html: `<div style="font-family: Arial, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">${htmlContent}</div>`,
                    text: message.trim(),
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                    ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                },
                type: isInvoice ? 'Invoice' : 'CustomerEmail',
                skipAutoLog: true,
                createdAt: new Date().toISOString()
            };

            await sendEmail(state.currentOrganization, mailPayload);

            // Record sent date on invoice if applicable
            if (isInvoice && targetJob?.id) {
                const sentAtDate = new Date().toISOString();
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                    'invoice.sentAt': sentAtDate
                })).catch(() => {});
            }

            const targetCustomerId = customerId || customer?.id || targetJob?.customerId;

            // 1. Record in global messages collection for system-wide messaging & timeline tracking
            const msgObj: any = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: state.currentUser?.id || 'staff',
                senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
                receiverId: recipients[0] || customer?.email || '',
                customerId: targetCustomerId || null,
                to: recipients.join(', '),
                content: message.trim(),
                subject: subject.trim(),
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || customer?.organizationId || 'unaffiliated',
                type: 'email'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj)).catch((err) => console.error("Error saving message:", err));

            // 2. Record communication log entry for customer subcollection
            if (targetCustomerId) {
                const commEntry = {
                    id: `comm-${Date.now()}`,
                    type: isInvoice ? 'invoice' : 'email',
                    title: subject.trim(),
                    subtitle: `To: ${recipients.join(', ')}`,
                    content: message.trim(),
                    badgeLabel: pdfAttachments.length > 0 ? `${pdfAttachments.length} PDF(s) Attached` : isInvoice ? 'Invoice Sent' : 'Email Sent',
                    badgeColor: pdfAttachments.length > 0 ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : isInvoice ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
                    timestamp: new Date().toISOString(),
                    senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'System'
                };
                
                await db.collection('customers').doc(targetCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
            }

            showToast.success(t(pdfAttachments.length > 0 ? "Email sent with PDF attachment(s)!" : isInvoice ? "Invoice sent successfully!" : "Email sent successfully!"));
            if (onSuccess) onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Error sending email:", e);
            showToast.warn(t("Failed to send email. Please try again."));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'invoice' || targetInvoice ? t("Send Invoice Email") : t("Compose & Send Email")}
            size="lg"
        >
            <div className="p-6 space-y-5">
                {/* Header Subtitle */}
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                            {mode === 'invoice' || targetInvoice ? t("Email Invoice to Customer") : t("Direct Customer Email")}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {targetJob ? `${t("Job")} #${targetJob.id.slice(-6).toUpperCase()} ${targetJob.customerName ? `• ${targetJob.customerName}` : ''}` : (customer?.name || t("Customize subject & message before sending."))}
                        </p>
                    </div>
                </div>

                {/* Recipient Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        {t("Recipients (To)")} <span className="text-rose-500">*</span>
                    </label>

                    {/* Chips for selected recipients */}
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[44px]">
                        {recipients.map(email => (
                            <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-xs font-semibold shadow-sm">
                                <Mail size={12} />
                                {email}
                                <button type="button" onClick={() => handleRemoveEmail(email)} className="hover:text-rose-600 transition-colors p-0.5 rounded-full">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}

                        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                            <input
                                type="email"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                placeholder={recipients.length === 0 ? t("Enter recipient email address...") : t("Add another email...")}
                                className="w-full text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 py-1"
                            />
                            <button
                                type="button"
                                onClick={handleAddEmail}
                                className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap"
                            >
                                + {t("Add")}
                            </button>
                        </div>
                    </div>

                    {/* Available Contacts Shortcuts */}
                    {availableContacts.length > 0 && (
                        <div className="pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                {t("Quick Add Contacts:")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {availableContacts.map(c => {
                                    const isSelected = recipients.includes(c.email.toLowerCase());
                                    return (
                                        <button
                                            key={c.email}
                                            type="button"
                                            onClick={() => toggleContactSelect(c.email)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            {isSelected ? <Check size={12} /> : <User size={12} />}
                                            <span>{c.label} ({c.email})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Subject */}
                <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        {t("Subject Line")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={t("Enter email subject...")}
                        className="text-xs font-medium"
                    />
                </div>

                {/* Message Body */}
                <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        {t("Message Body")} <span className="text-rose-500">*</span>
                    </label>
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        placeholder={t("Write your email message here...")}
                        className="text-xs leading-relaxed font-sans"
                    />
                </div>

                {/* Multi-Document Selection Section */}
                {(hasInvoiceData || hasReportData || hasProposalData) && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                <Layers size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <span>{t("Select Documents to Include in this Email")}</span>
                            </div>
                        </div>

                        {customerJobs.length > 1 && (
                            <div className="pt-1 pb-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    {t("Target Job / Service Call:")}
                                </label>
                                <select
                                    value={selectedJobId}
                                    onChange={async (e) => {
                                        const newId = e.target.value;
                                        setSelectedJobId(newId);
                                        if (attachPdfFiles) {
                                            await handleGeneratePdfAttachments();
                                        }
                                    }}
                                    className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:ring-indigo-500"
                                >
                                    {customerJobs.map((j: any) => {
                                        const rawDate = j.appointmentTime || j.createdAt || j.date;
                                        const dateStr = rawDate ? ` — ${new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '';
                                        const invAmt = j.invoice?.totalAmount ? ` — Invoice: $${Number(j.invoice.totalAmount).toFixed(2)}` : '';
                                        const isSelected = j.id === selectedJobId;
                                        return (
                                            <option key={j.id} value={j.id}>
                                                {isSelected ? '★ ' : ''}Job #{j.id.slice(-8).toUpperCase()} ({j.serviceType || 'Service Call'}){dateStr}{invAmt}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            {hasInvoiceData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeInvoice ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 text-indigo-900 dark:text-indigo-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeInvoice}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeInvoice(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incInv: checked });
                                            }
                                        }}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>📄 {t("Job Invoice")}</span>
                                </label>
                            )}

                            {hasReportData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeReport ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeReport}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeReport(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incRep: checked });
                                            }
                                        }}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>📋 {t("Job Report")}</span>
                                </label>
                            )}

                            {hasProposalData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeProposal ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 text-sky-900 dark:text-sky-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeProposal}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeProposal(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incProp: checked });
                                            }
                                        }}
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    <span>📝 {t("Proposal")}</span>
                                </label>
                            )}
                        </div>
                    </div>
                )}

                {/* Delivery Method Options */}
                <div className="space-y-2.5 pt-1">
                    {/* Option 1: Standard Interactive Links (Default ON) */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <FileText size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    {t("Include Standard Interactive Web Links (Default)")}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    {t("Keeps online approvals, payments, and signature tracking active inside TekTrakker")}
                                </span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={attachInteractiveLinks}
                            onChange={(e) => setAttachInteractiveLinks(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>

                    {/* Option 2: Attach as PDF Files (Opt-In OFF by default) */}
                    <div className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Paperclip size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                <div>
                                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                                        {t("Attach Selected Documents as PDF Files (Customer Request)")}
                                    </span>
                                    <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 block">
                                        {t("Checking this box generates and attaches printable PDF file(s) immediately")}
                                    </span>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={attachPdfFiles}
                                onChange={async (e) => {
                                    const checked = e.target.checked;
                                    setAttachPdfFiles(checked);
                                    if (checked) {
                                        await handleGeneratePdfAttachments();
                                    } else {
                                        setGeneratedPdfAttachments([]);
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                        </div>

                        {/* PDF Generation Status / Attachment Preview Chips */}
                        {attachPdfFiles && (
                            <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40 space-y-2">
                                {isGeneratingPdfs ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 animate-pulse">
                                        <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>{t("Generating and rendering PDF attachment(s)... Please wait...")}</span>
                                    </div>
                                ) : generatedPdfAttachments.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                                <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                                                {t("Attached PDF Files Ready to Send:")} ({generatedPdfAttachments.length})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleGeneratePdfAttachments()}
                                                className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                                            >
                                                <span>⚡ {t("Re-Generate PDFs")}</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {generatedPdfAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700/60 rounded-md text-[11px] font-medium text-slate-800 dark:text-slate-200 shadow-sm">
                                                    <span>📄 {att.filename}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGeneratedPdfAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-slate-400 hover:text-rose-600 transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-amber-700 dark:text-amber-400">
                                            {t("No PDF files generated yet.")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleGeneratePdfAttachments()}
                                            className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                                        >
                                            <span>⚡ {t("Generate PDFs Now")}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 flex items-center gap-2 shadow-md"
                    >
                        <Send size={14} />
                        {isSending ? t("Sending...") : (mode === 'invoice' || targetInvoice ? t("Send Invoice") : t("Send Email"))}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SendEmailModal;
