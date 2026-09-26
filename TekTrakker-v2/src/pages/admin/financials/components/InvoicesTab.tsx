/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import showToast from "lib/toast";
import { getBaseUrl, cleanUndefinedFields, formatAddress, createEmailButtonHtml } from "lib/utils";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { Trash2, Share2, Copy, Bell, Calculator, Download, UserPlus, Search, ExternalLink, CreditCard, RefreshCw, Eye, Settings, FileText, Briefcase, ShieldCheck, DollarSign, Send, MessageSquare, Clock } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { db, functions } from 'lib/firebase';
import DocumentPreview from 'components/ui/DocumentPreview';
import JobDetailModal from 'components/modals/JobDetailModal';
import { useLanguage } from 'context/LanguageContext';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import SendSMSModal from 'components/modals/SendSMSModal';
import CreatePaymentLinkModal from 'components/modals/CreatePaymentLinkModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';
import { LogReceivedPaymentModal } from 'components/modals/LogReceivedPaymentModal';
import CustomerMasterModal from 'components/modals/CustomerMasterModal';
import { generateInvoicePdfAttachment } from 'lib/pdfHelper';

interface InvoicesTabProps {
    jobs: any[];
    setEditingInvoiceId: (id: string) => void;
    handleDeleteInvoice: (id: string) => void;
    isAdmin?: boolean;
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({ jobs, setEditingInvoiceId, handleDeleteInvoice, isAdmin = false }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [shareModalInvoice, setShareModalInvoice] = useState<any>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);
    const [viewingJob, setViewingJob] = useState<any>(null);
    const [viewingProposal, setViewingProposal] = useState<any>(null);
    const [previewOtherDoc, setPreviewOtherDoc] = useState<any>(null);
    const [activeSignOffJob, setActiveSignOffJob] = useState<any>(null);
    const [activeSubBillJob, setActiveSubBillJob] = useState<any>(null);
    const [taxMode, setTaxMode] = useState(false);
    const [reassignInvoiceJob, setReassignInvoiceJob] = useState<any>(null);
    const [newInvoiceCustomerId, setNewInvoiceCustomerId] = useState('');

    const [sortBy, setSortBy] = useState('date_desc');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    

    const [searchTerm, setSearchTerm] = useState('');
    const [isReconciling, setIsReconciling] = useState(false);
    const [recipientModalConfig, setRecipientModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    const [createPaymentLinkOpen, setCreatePaymentLinkOpen] = useState(false);
    const [isLogPaymentModalOpen, setIsLogPaymentModalOpen] = useState(false);
    const [smsModalJob, setSmsModalJob] = useState<any | null>(null);

    useEffect(() => {
        if (viewingJob?.id) {
            const latestJob = (state.jobs || []).find((j: any) => j.id === viewingJob.id);
            if (latestJob && latestJob !== viewingJob) {
                setViewingJob(latestJob);
            }
        }
    }, [state.jobs, viewingJob?.id]);

    useEffect(() => {
        if (viewingInvoiceJob?.id) {
            const latestJob = (state.jobs || []).find((j: any) => j.id === viewingInvoiceJob.id);
            if (latestJob && latestJob !== viewingInvoiceJob) {
                setViewingInvoiceJob(latestJob);
            }
        }
    }, [state.jobs, viewingInvoiceJob?.id]);

    useEffect(() => {
        if (viewingProposal?.id) {
            const latestProp = (state.proposals || []).find((p: any) => p.id === viewingProposal.id);
            if (latestProp && latestProp !== viewingProposal) {
                setViewingProposal(latestProp);
            }
        }
    }, [state.proposals, viewingProposal?.id]);

    const handleReconcilePayments = async () => {
        if (!state.currentOrganization?.id) return;
        setIsReconciling(true);
        try {
            const reconcileCallable = functions.httpsCallable('reconcileKortPayments');
            const result = await reconcileCallable({ organizationId: state.currentOrganization.id });
            const data = result.data as any;
            
            if (data.success) {
                if (data.reconciledCount > 0) {
                    showToast.success(t(`Successfully reconciled ${data.reconciledCount} payment record(s)!`));
                } else {
                    showToast.warn(t(data.message || "No new payment records required syncing."));
                }
            } else {
                showToast.warn(t("Failed to reconcile payments."));
            }
        } catch (e: any) {
            console.error(e);
            showToast.warn(t(e.message || "Reconciliation failed. Please try again."));
        } finally {
            setIsReconciling(false);
        }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#INV-${jobId}`);
        showToast.warn(t("Invoice Reference Copied! Paste it anywhere to create a smart link."));
    };

    const handleShareInvoice = async () => {
        if (!shareModalInvoice || !shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}${t("Check out this invoice:")} #INV-${shareModalInvoice.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.warn(t("Invoice shared successfully!"));
            setShareModalInvoice(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn(t("Failed to share."));
        } finally {
            setIsSharing(false);
        }
    };

    const handleReassignInvoice = async () => {
        if (!reassignInvoiceJob || !newInvoiceCustomerId) return;
        const newCustomer = state.customers?.find((c: any) => c.id === newInvoiceCustomerId);
        if (!newCustomer) return;
        
        try {
            await db.collection('jobs').doc(reassignInvoiceJob.id).update(cleanUndefinedFields({
                customerId: newCustomer.id,
                customerName: newCustomer.name,
                customerEmail: newCustomer.email || null,
                customerPhone: newCustomer.phone || null,
                address: newCustomer.address || reassignInvoiceJob.address,
                'invoice.billToName': newCustomer.name,
                'invoice.billToAddress': newCustomer.address || ''
            }));
            showToast.success(t("Invoice reassigned successfully."));
            setReassignInvoiceJob(null);
            setNewInvoiceCustomerId('');
        } catch (e) {
            showToast.warn(t("Failed to reassign invoice."));
        }
    };

    const handleSendInvoiceReminder = async (job: any, selectedEmails?: string[], attachPdf?: boolean) => {
        let emails = selectedEmails;
        let phone = job.customerPhone;
        
        // If not in job object natively, attempt to lookup
        if (!emails) {
            let email = job.customerEmail;
            if (!email && job.customerId) {
                const cust = state.customers.find((c: any) => c.id === job.customerId);
                if (cust) {
                    email = cust.email;
                    phone = cust.phone || phone;
                }
            }
            if (!email && !phone) {
                showToast.warn(t("Customer requires an email or phone number for reminders."));
                return;
            }
            emails = email ? [email] : [];
        }

        if (job.invoice?.remindersSent) {
            const alreadySentToday = job.invoice.remindersSent.some((dateStr: string) => {
                try {
                    return new Date(dateStr).toLocaleDateString() === new Date().toLocaleDateString();
                } catch (e) {
                    return false;
                }
            });
            if (alreadySentToday) {
                if (!confirm(t("A reminder has already been sent to this customer today. Are you sure you want to send another one?"))) {
                    return;
                }
            }
        }

        const msgText = emails.length > 0 ? emails.join(', ') : t("this customer");
        if (!selectedEmails && !confirm(`${t("Send payment reminder for invoice #")}${job.invoice.id} ${t("to")} ${msgText}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/invoice/${job.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            const invTotal = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
            
            const dueDateVal = job.invoice?.dueDate;
            const isLate = (() => {
                if (!dueDateVal) return false;
                let dueDateObj = new Date(dueDateVal);
                if (typeof dueDateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDateVal)) {
                    dueDateObj = new Date(dueDateVal.replace(/-/g, '/'));
                }
                dueDateObj.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return today.getTime() > dueDateObj.getTime();
            })();

            const pastDueBanner = isLate ? `<div style="color:#dc2626;font-size:32px;font-weight:bold;margin-bottom:10px;text-align:left;border-bottom:2px solid #dc2626;padding-bottom:10px;">PAST DUE</div>` : '';

            if (emails.length > 0) {
                let pdfAttachments: any[] = [];
                if (attachPdf) {
                    showToast.info(t("Generating invoice PDF attachment..."));
                    const invPdf = await generateInvoicePdfAttachment(job, state.currentOrganization);
                    pdfAttachments.push(invPdf);
                }

                await db.collection('mail_queue').add(cleanUndefinedFields({
                    to: emails,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                    message: {
                        subject: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${job.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #fee2e2;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;">${pastDueBanner}<h2 style="color:#dc2626;margin-top:0;">Payment Reminder</h2><p style="font-size:15px;color:#334155;">Hi ${job.customerName},</p><p style="font-size:15px;color:#334155;">This is a friendly reminder that your invoice <strong>#${job.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> from <strong>${orgName}</strong> is currently outstanding.</p>${createEmailButtonHtml('View &amp; Pay Invoice', link, '#dc2626')}<p style="font-size:13px;color:#64748b;margin-top:20px;">If you have already submitted payment, please disregard this notice.</p></div>`,
                        text: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`,
                        replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                        ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                    },
                    organizationId: state.currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                }));
            }

            if (phone && !selectedEmails) {
                await db.collection('messages').add(cleanUndefinedFields({
                    to: phone,
                    body: `${isLate ? 'PAST DUE - ' : ''}Reminder from ${orgName}: Your invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: state.currentOrganization?.id,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                }));
            }

            // Save reminder sent date
            const reminderDate = new Date().toISOString();
            const currentReminders = job.invoice.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                'invoice.remindersSent': newReminders
            }));

            // Update local job state
            job.invoice.remindersSent = newReminders;

            const sendModeText = emails.length > 0 ? t("email") : "";
            const smsText = (phone && !selectedEmails) ? t("SMS text") : "";
            showToast.warn(`${t("Reminder sent via")} ${sendModeText} ${sendModeText && smsText ? t("and") + " " : ""}${smsText}!`);
        } catch (e) {
            console.error(e);
            showToast.warn(t("Error sending reminder."));
        }
    };

    const getCustomerDisplayName = (job: any) => {
        const cust = state.customers?.find((c: any) => c.id === job.customerId);
        return cust ? cust.name : (job.customerName || '');
    };

    const isRealInvoice = (inv: any) => {
        if (!inv || !inv.id) return false;
        const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
        const hasTotal = (Number(inv.totalAmount) || Number(inv.amount) || Number(inv.subtotal) || 0) > 0;
        const isPaidOrSent = inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Partially Paid';
        return hasItems || hasTotal || isPaidOrSent;
    };

    const validInvoiceJobs = React.useMemo(() => {
        const result: any[] = [];
        const seenInvoiceIds = new Set<string>();
        
        for (const j of jobs) {
            if (j && j.invoice && isRealInvoice(j.invoice)) {
                const invId = j.invoice.id;
                if (!seenInvoiceIds.has(invId)) {
                    seenInvoiceIds.add(invId);
                    result.push(j);
                }
            }
        }
        return result;
    }, [jobs]);

    const sortedInvoices = [...validInvoiceJobs]
        .filter((j: any) => {
            if (!searchTerm) return true;
            const q = searchTerm.toLowerCase();
            const amt = (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0).toFixed(2);
            return (
                (j.invoice.id || '').toLowerCase().includes(q) ||
                (j.id || '').toLowerCase().includes(q) || // Internal WO Number (Job ID)
                (j.poNumber || '').toLowerCase().includes(q) || // External WO Number
                ((j.invoice as any).poNumber || '').toLowerCase().includes(q) || // External WO Number (invoice-level)
                (getCustomerDisplayName(j)).toLowerCase().includes(q) ||
                amt.includes(q) ||
                (j.invoice.status || '').toLowerCase().includes(q)
            );
        })
        .sort((a: any, b: any) => {
        const amtA = Number(a.invoice.totalAmount) || Number(a.invoice.amount) || 0;
        const amtB = Number(b.invoice.totalAmount) || Number(b.invoice.amount) || 0;
        
        switch (sortBy) {
            case 'date_asc':
                return new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime();
            case 'amount_desc':
                return amtB - amtA;
            case 'amount_asc':
                return amtA - amtB;
            case 'name_asc':
                return (getCustomerDisplayName(a)).localeCompare(getCustomerDisplayName(b));
            case 'name_desc':
                return (getCustomerDisplayName(b)).localeCompare(getCustomerDisplayName(a));
            case 'status_asc':
            case 'status':
                return (a.invoice.status || '').localeCompare(b.invoice.status || '');
            case 'status_desc':
                return (b.invoice.status || '').localeCompare(a.invoice.status || '');
            case 'date_desc':
            default:
                return new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime();
        }
    });

    const taxSummary = React.useMemo(() => {
        const summary: Record<string, number> = {
            'Gross Receipts or Sales': 0,
            'Returns & Allowances': 0,
        };

        validInvoiceJobs.filter(j => j?.invoice?.status === 'Paid').forEach(j => {
            const amt = Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0;
            if (amt > 0) {
                summary['Gross Receipts or Sales'] += amt;
            } else if (amt < 0) {
                summary['Returns & Allowances'] += Math.abs(amt);
            }
        });

        return Object.entries(summary)
            .map(([category, amount]) => ({ category, amount }))
            .filter(r => r.amount !== 0);
    }, [jobs]);

    const handleExportTaxCSV = () => {
        const taxYear = new Date().getFullYear();
        let csv = `TekTrakker Income Ledger - Tax Year ${taxYear}\n\n`;
        csv += `"Tax Classification","Reportable Amount"\n`;
        
        taxSummary.forEach(row => {
            csv += `"${row.category}",${row.amount.toFixed(2)}\n`;
        });
        
        const totalIncome = taxSummary.find(r => r.category === 'Gross Receipts or Sales')?.amount || 0;
        const totalReturns = taxSummary.find(r => r.category === 'Returns & Allowances')?.amount || 0;
        const netReceipts = totalIncome - totalReturns;
        
        csv += `\n"NET RECEIPTS",${netReceipts.toFixed(2)}\n`;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Income_Tax_Summary_${taxYear}.csv`;
        a.click();
    };

    return (
        <Card>
            {viewingInvoiceJob && (
                <DocumentPreview
                    type="Invoice"
                    data={viewingInvoiceJob}
                    organization={state.currentOrganization}
                    onClose={() => setViewingInvoiceJob(null)}
                    isInternal={true}
                />
            )}
            
            <Modal isOpen={!!reassignInvoiceJob} onClose={() => setReassignInvoiceJob(null)} title={t("Reassign Invoice")}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">{t("Select a new customer to map this invoice to. This will also update the associated job record.")}</p>
                    <Select value={newInvoiceCustomerId} onChange={e => setNewInvoiceCustomerId(e.target.value)}>
                        <option value="">{t("Select Customer...")}</option>
                        {state.customers?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </Select>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setReassignInvoiceJob(null)}>{t("Cancel")}</Button>
                        <Button onClick={handleReassignInvoice} disabled={!newInvoiceCustomerId}>{t("Save Assignment")}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!shareModalInvoice} onClose={() => setShareModalInvoice(null)} title={`${t("Share Invoice:")} ${shareModalInvoice?.customerName}`}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">{t("Send this invoice reference to a staff member.")}</p>
                    <select 
                        aria-label={t("Select Share Recipient")}
                        title={t("Select Share Recipient")}
                        className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                        value={shareTargetId}
                        onChange={e => setShareTargetId(e.target.value)}
                    >
                        <option value="">{t("Select Recipient...")}</option>
                        {state.users.filter((u: any) => 
                            u.organizationId === state.currentOrganization?.id && 
                            u.id !== state.currentUser?.id && 
                            u.role !== 'customer'
                        ).map((u: any) => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                        ))}
                    </select>
                    <Textarea 
                        placeholder={t("Add an optional message...")}
                        value={shareMessageText}
                        onChange={e => setShareMessageText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShareModalInvoice(null)}>{t("Cancel")}</Button>
                        <Button onClick={handleShareInvoice} disabled={!shareTargetId || isSharing}>
                            {isSharing ? t("Sending...") : t("Send Message")}
                        </Button>
                    </div>
                </div>
            </Modal>
            
            <div className="flex flex-col gap-4 mb-4">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={t("Search by #, WO # (Int/Ext), customer, or amount...")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-gray-800 dark:text-white">{t("Accounts Receivable")}</h3>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <label htmlFor="sort-invoices" className="font-medium text-slate-600 dark:text-slate-300">{t("Sort by:")}</label>
                        <select 
                            id="sort-invoices"
                            aria-label={t("Sort Invoices")}
                            className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date_desc">{t("Newest First")}</option>
                            <option value="date_asc">{t("Oldest First")}</option>
                            <option value="name_asc">{t("Customer (A-Z)")}</option>
                            <option value="name_desc">{t("Customer (Z-A)")}</option>
                            <option value="amount_desc">{t("Amount (High to Low)")}</option>
                            <option value="amount_asc">{t("Amount (Low to High)")}</option>
                            <option value="status_asc">{t("Status (A-Z)")}</option>
                            <option value="status_desc">{t("Status (Z-A)")}</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="primary"
                            onClick={() => setCreatePaymentLinkOpen(true)}
                            className="w-auto text-xs flex items-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold transition-all shrink-0 shadow-sm border-0"
                        >
                            <DollarSign size={14} />
                            {t("Request Deposit / Payment Link")}
                        </Button>
                        {isAdmin && (
                            <>
                                <Button 
                                    variant="primary"
                                    onClick={() => setIsLogPaymentModalOpen(true)}
                                    className="w-auto text-xs flex items-center gap-1.5 !bg-teal-600 hover:!bg-teal-700 !text-white font-bold transition-all shrink-0 shadow-sm border-0"
                                >
                                    <DollarSign size={14} />
                                    {t("Log Received Payment")}
                                </Button>
                                <Button 
                                    variant="primary"
                                    onClick={handleReconcilePayments} 
                                    disabled={isReconciling}
                                    className="w-auto text-xs flex items-center gap-2 !bg-indigo-600 hover:!bg-indigo-700 !text-white font-bold transition-all shrink-0 shadow-sm border-0"
                                >
                                    <RefreshCw size={14} className={isReconciling ? "animate-spin" : ""} />
                                    {isReconciling ? t("Syncing...") : t("Sync Kort Payments")}
                                </Button>
                                <Button variant={taxMode ? "primary" : "secondary"} onClick={() => setTaxMode(!taxMode)} className="w-auto text-xs flex items-center gap-2 font-bold">
                                    <Calculator size={14} /> {taxMode ? t("Exit Tax Prep") : t("Tax Prep Mode")}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                </div>
            </div>

            {taxMode && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-black text-emerald-900 dark:text-emerald-300 text-lg flex items-center gap-2"><Calculator size={20}/> {t("IRS Income Ledger (Cash Basis)")}</h4>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("Aggregated collected revenue (Paid Invoices) by tax classification.")}</p>
                        </div>
                        <Button onClick={handleExportTaxCSV} className="text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Download size={14} /> {t("Export CSV for CPA")}
                        </Button>
                    </div>
                    
                    <Table headers={[t('Tax Classification'), t('Reportable Amount')]}>
                        {taxSummary.map((row, i) => (
                            <tr key={i} className="bg-white dark:bg-slate-900/50">
                                <td className="px-6 py-3 font-bold text-slate-800 dark:text-slate-200">{t(row.category)}</td>
                                <td className="px-6 py-3 font-black text-emerald-600 dark:text-emerald-400">${row.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3.5 mb-6">
                {sortedInvoices.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
                        {t("No invoices found.")}
                    </div>
                ) : (
                    sortedInvoices.map((job: any) => {
                        const linkedProposal = (state.proposals || []).find((p: any) => p.id === job.proposalId || p.jobId === job.id || (job.invoice?.id && p.invoiceId === job.invoice.id));
                        const linkedFollowUpJob = (jobs || []).find((other: any) => 
                            other.id !== job.id && (other.parentJobId === job.id || (job.linkedJobIds || []).includes(other.id) || (other.linkedJobIds || []).includes(job.id)) && other.invoice
                        );
                        const signOffFile = (job.files || []).find((f: any) => 
                            f.fileName === 'SignOff_Sheet.html' || 
                            f.fileName?.toLowerCase().includes('signoff') ||
                            f.fileName?.toLowerCase().includes('sign-off') ||
                            f.fileName?.toLowerCase().includes('sign_off') ||
                            f.metadata?.label === 'Sign-Off Sheet' || 
                            f.metadata?.label?.toLowerCase().includes('sign-off') ||
                            f.metadata?.label?.toLowerCase().includes('signoff') ||
                            f.label?.toLowerCase().includes('sign-off') ||
                            f.label?.toLowerCase().includes('signoff') ||
                            f.category === 'signoff' ||
                            f.metadata?.category === 'signoff' ||
                            f.id?.startsWith('signoff-doc')
                        );
                        const subBillFile = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                        const isSubassigned = !!(job.assignedSubcontractorId || job.subcontractorId || job.subcontractorName || job.subcontractor || job.subcontractorCompany || job.subcontractorEmail);
                        const poNumber = job.poNumber || job.invoice?.poNumber || linkedProposal?.poNumber;

                        const checkIn = job.checkInTime || (job.timeEntries && job.timeEntries[0]?.checkInTime);
                        const checkOut = job.checkOutTime || (job.timeEntries && job.timeEntries[0]?.checkOutTime);
                        const formattedIn = checkIn ? new Date(checkIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;
                        const formattedOut = checkOut ? new Date(checkOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

                        const totalAmount = Number(job.invoice?.totalAmount) || Number(job.invoice?.amount) || 0;
                        const rawAmountPaid = Number(job.invoice?.amountPaid || job.invoice?.depositPaidAmount || (job.invoice?.depositPaid ? (job.invoice?.depositAmount || 0) : 0) || 0);
                        const amountPaid = Math.min(totalAmount, Math.max(0, job.invoice?.status === 'Paid' ? (rawAmountPaid > 0 ? rawAmountPaid : totalAmount) : rawAmountPaid));
                        const balanceRemaining = Math.max(0, totalAmount - amountPaid);
                        const isPartiallyPaid = (job.invoice?.status === 'Partially Paid') || (amountPaid > 0 && balanceRemaining > 0);
                        const effectiveStatus = job.invoice?.status === 'Paid' 
                            ? 'Paid' 
                            : isPartiallyPaid 
                            ? 'Partially Paid' 
                            : (job.invoice?.status || 'Unpaid');

                        const invIdRaw = job.invoice?.id != null ? String(job.invoice.id) : '';
                        const displayInvoiceId = invIdRaw 
                            ? (invIdRaw.startsWith('INV-') ? invIdRaw : `INV-${invIdRaw}`) 
                            : `INV-${job.id}`;

                        const linkedCust = (state.customers || []).find((c: any) => c.id === job.customerId || c.name?.trim().toLowerCase() === job.customerName?.trim().toLowerCase());

                        let rawLocName = job.locationName || job.serviceLocationName || '';
                        let rawLocAddr = job.address || job.serviceAddress || job.locationAddress || '';

                        let locName = typeof rawLocName === 'string' ? rawLocName : formatAddress(rawLocName);
                        let locAddr = formatAddress(rawLocAddr);

                        if (linkedCust?.serviceLocations?.length) {
                            const matchedLoc = linkedCust.serviceLocations.find((l: any) =>
                                (job.locationId && l.id === job.locationId) ||
                                (locName && (l.name?.trim().toLowerCase() === locName.trim().toLowerCase() || l.propertyName?.trim().toLowerCase() === locName.trim().toLowerCase())) ||
                                (locAddr && l.address && locAddr.toLowerCase().includes(formatAddress(l.address).toLowerCase()))
                            ) || (linkedCust.serviceLocations.length === 1 ? linkedCust.serviceLocations[0] : null);

                            if (matchedLoc) {
                                if (!locName || locName === getCustomerDisplayName(job)) {
                                    locName = matchedLoc.propertyName || matchedLoc.name || formatAddress(matchedLoc.address) || locName;
                                }
                                if (!locAddr) locAddr = formatAddress(matchedLoc.address);
                            }
                        }

                        const deadlineDays = linkedCust?.submissionRules?.submissionDeadlineDays || (job.customerId === 'cust-1787187506048' ? 20 : null);
                        let deadlineElement = null;
                        if (deadlineDays) {
                            const isSettled = effectiveStatus === 'Paid' || job.invoice?.status === 'Paid';
                            if (!isSettled) {
                                const workDateStr = job.checkOutTime || job.appointmentTime || (job as any).completedDate || job.invoice?.invoiceDate || job.createdAt;
                                const workDate = workDateStr ? new Date(workDateStr) : new Date();
                                const elapsed = Math.max(0, Math.floor((Date.now() - workDate.getTime()) / (1000 * 60 * 60 * 24)));
                                const left = deadlineDays - elapsed;
                                deadlineElement = (
                                    <span 
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-xs font-sans ${
                                            left < 0 
                                                ? 'bg-rose-950 text-rose-200 border-rose-600 animate-pulse font-black' 
                                                : left <= 5 
                                                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse font-black' 
                                                : left <= 10 
                                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700' 
                                                : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        }`}
                                        title={`Impact 20-Day Cutoff: ${left < 0 ? `${Math.abs(left)} days past deadline!` : `${left} days left to submit raw PDF invoice`}`}
                                    >
                                        <Clock size={10} />
                                        {left < 0 ? `🛑 Past 20d Cutoff (${Math.abs(left)}d)` : `⏱️ ${left}d Cutoff`}
                                    </span>
                                );
                            }
                        }

                        const sentTime = job.invoice?.sentAt || (job as any).invoiceSentAt || (job.invoice as any)?.emailSentAt;
                        const isOpened = Boolean(job.invoice?.opened || job.invoice?.status === 'Opened');
                        const reminders: string[] = job.invoice?.remindersSent || [];

                        return (
                            <div key={`mobile-card-${job.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                                {/* Header: Invoice # & Amount & Status */}
                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                                                {displayInvoiceId}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                effectiveStatus === 'Paid' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                                : effectiveStatus === 'Partially Paid' 
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                                {t(effectiveStatus)}
                                            </span>
                                            {isOpened && effectiveStatus !== 'Paid' && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                                    {t("Opened")}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const targetCustId = job.customerId || linkedCust?.id;
                                                if (targetCustId) {
                                                    setSelectedCustomerId(targetCustId);
                                                } else {
                                                    showToast.info("No customer profile found for this record.");
                                                }
                                            }}
                                            className="cursor-pointer group/cust hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1 transition-colors mt-1"
                                            title="Click to open customer profile"
                                        >
                                            <span className="font-bold text-slate-800 dark:text-slate-200 group-hover/cust:underline text-sm">
                                                {getCustomerDisplayName(job)}
                                            </span>
                                            <span className="text-xs text-slate-400 group-hover/cust:text-primary-600">↗</span>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="font-black text-base text-slate-900 dark:text-white font-mono">
                                            ${totalAmount.toFixed(2)}
                                        </div>
                                        {amountPaid > 0 && balanceRemaining > 0 && (
                                            <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                                ${balanceRemaining.toFixed(2)} {t("Remaining")}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Location & Appointment Details */}
                                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                                    {(locName || locAddr) && (
                                        <div className="flex items-start gap-1.5">
                                            <span className="text-slate-400 shrink-0">📍</span>
                                            <span className="line-clamp-2">
                                                {locName && <strong className="font-semibold text-slate-700 dark:text-slate-300">{locName} — </strong>}
                                                {locAddr}
                                            </span>
                                        </div>
                                    )}
                                    {job.appointmentTime && (
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                            <span className="text-slate-400 shrink-0">📅</span>
                                            <span>{new Date(job.appointmentTime).toLocaleDateString()}</span>
                                            {(formattedIn || formattedOut) && (
                                                <span className="font-mono text-slate-400">
                                                    ({formattedIn ? `In: ${formattedIn}` : ''}{formattedOut ? ` | Out: ${formattedOut}` : ''})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {(job.invoice.paymentMethod || job.invoice.paidDate) && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2 pt-0.5">
                                            {job.invoice.paymentMethod && <span>{t("Method")}: <strong className="text-slate-700 dark:text-slate-300">{t(job.invoice.paymentMethod)}</strong></span>}
                                            {job.invoice.paidDate && <span>{t("Processed")}: <strong className="text-slate-700 dark:text-slate-300">{new Date(job.invoice.paidDate).toLocaleDateString()}</strong></span>}
                                        </div>
                                    )}
                                </div>

                                {/* Linked Documents Chips */}
                                <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span 
                                        onClick={() => setEditingInvoiceId(job.id)} 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors shadow-xs"
                                        title={t("Edit / View Invoice")}
                                    >
                                        <FileText size={10} />
                                        {displayInvoiceId}
                                    </span>

                                    {deadlineElement}

                                    <span 
                                        onClick={() => setViewingJob(job)} 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 cursor-pointer hover:bg-indigo-100 transition-colors shadow-xs"
                                        title={t("View Job Details")}
                                    >
                                        <Briefcase size={10} />
                                        {job.jobNumber || (job.id.startsWith('Job-') || job.id.startsWith('JOB-') ? job.id : `Job-${job.id.replace(/^job-/, '')}`)}
                                    </span>

                                    {linkedProposal && (
                                        <span 
                                            onClick={() => setViewingProposal(linkedProposal)}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50 shadow-xs"
                                            title={t("View Proposal")}
                                        >
                                            <FileText size={10} />
                                            {linkedProposal.proposalNumber || `PROP-${linkedProposal.id.replace(/^prop-/, '')}`}
                                        </span>
                                    )}

                                    {poNumber && (
                                        <span 
                                            onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer shadow-xs"
                                        >
                                            <Briefcase size={10} />
                                            WO: {poNumber}
                                        </span>
                                    )}

                                    <span 
                                        onClick={() => {
                                            if (signOffFile) {
                                                setPreviewOtherDoc({ ...signOffFile, type: 'Other', title: t('Manager Sign-Off Sheet') });
                                            } else {
                                                setActiveSignOffJob(job);
                                            }
                                        }}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer shadow-xs ${
                                            signOffFile 
                                            ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200' 
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                                        }`}
                                    >
                                        <ShieldCheck size={10} />
                                        {signOffFile ? t("Sign-off") : t("+ Sign-off")}
                                    </span>

                                    {isSubassigned && (
                                        <span 
                                            onClick={() => {
                                                if (subBillFile) {
                                                    setPreviewOtherDoc({ ...subBillFile, type: 'Other', title: t('Subcontractor Bill') });
                                                } else {
                                                    setActiveSubBillJob(job);
                                                }
                                            }}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer shadow-xs ${
                                                subBillFile 
                                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200' 
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                                            }`}
                                        >
                                            <DollarSign size={10} />
                                            {subBillFile ? t("Sub Bill") : t("+ Sub Bill")}
                                        </span>
                                    )}
                                </div>

                                {/* Delivery & Tracking Details if Sent */}
                                {sentTime && (
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <span className="inline-flex items-center gap-1 font-bold">
                                            <Send size={11} className="text-blue-500" />
                                            {t("Sent")}: {new Date(sentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                                        </span>
                                        {isOpened ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                                                {t("Opened")}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{t("Unopened")}</span>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons Toolbar */}
                                <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                    <button 
                                        title={t("View Invoice")} 
                                        onClick={() => setViewingInvoiceJob(job)} 
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-lg text-blue-700 dark:text-blue-300 font-bold shadow-xs"
                                    >
                                        <Eye size={13} />
                                        {t("View")}
                                    </button>

                                    <button 
                                        title={t("Manage Invoice")} 
                                        onClick={() => setEditingInvoiceId(job.id)} 
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-lg text-purple-700 dark:text-purple-300 font-bold shadow-xs"
                                    >
                                        <Settings size={13} />
                                        {t("Manage")}
                                    </button>

                                    <button 
                                        aria-label={t("Send Invoice")} 
                                        title={t("Send Invoice")} 
                                        onClick={(e) => { e.stopPropagation(); setSendInvoiceModalConfig({ isOpen: true, job }); }} 
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                                    >
                                        <Send size={13} />
                                        {t("Send")}
                                    </button>

                                    <button 
                                        aria-label={t("Send via SMS")} 
                                        title={t("Send Invoice Link via SMS Text")} 
                                        onClick={(e) => { e.stopPropagation(); setSmsModalJob(job); }} 
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 rounded-lg text-teal-700 dark:text-teal-300 font-bold shadow-xs"
                                    >
                                        <MessageSquare size={13} />
                                        {t("SMS")}
                                    </button>

                                    {job.invoice.status !== 'Paid' && (
                                        <a 
                                            href={`/#/invoice/${job.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                                            title={t("Open Public Payment Page")}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <CreditCard size={13} />
                                            {t("Pay")}
                                        </a>
                                    )}

                                    <button 
                                        aria-label={t("Share Invoice")} 
                                        title={t("Share Invoice")} 
                                        onClick={(e) => { e.stopPropagation(); setShareModalInvoice(job); }} 
                                        className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-bold shadow-xs"
                                    >
                                        <Share2 size={13} />
                                    </button>

                                    <button 
                                        aria-label={t("Copy Reference")} 
                                        title={t("Copy Reference")} 
                                        onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} 
                                        className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-bold shadow-xs"
                                    >
                                        <Copy size={13} />
                                    </button>

                                    {isAdmin && (
                                        <button 
                                            title={t("Delete Invoice")} 
                                            onClick={() => handleDeleteInvoice(job.id)} 
                                            className="flex items-center gap-1 px-2 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-red-700 dark:text-red-300 font-bold shadow-xs"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
            <Table headers={[
                t('Invoice #'),
                t('Customer'),
                t('Service Location'),
                t('Appointment & Site Visit'),
                t('Amount'),
                t('Linked Documents'),
                t('Status'),
                t('Sent & Tracking')
            ]}>
                {sortedInvoices.map((job: any) => {
                    const linkedProposal = (state.proposals || []).find((p: any) => p.id === job.proposalId || p.jobId === job.id || (job.invoice?.id && p.invoiceId === job.invoice.id));
                    const linkedFollowUpJob = (jobs || []).find((other: any) => 
                        other.id !== job.id && (other.parentJobId === job.id || (job.linkedJobIds || []).includes(other.id) || (other.linkedJobIds || []).includes(job.id)) && other.invoice
                    );
                    const hasInvoice = job.invoice?.id;
                    const signOffFile = (job.files || []).find((f: any) => 
                        f.fileName === 'SignOff_Sheet.html' || 
                        f.fileName?.toLowerCase().includes('signoff') ||
                        f.fileName?.toLowerCase().includes('sign-off') ||
                        f.fileName?.toLowerCase().includes('sign_off') ||
                        f.metadata?.label === 'Sign-Off Sheet' || 
                        f.metadata?.label?.toLowerCase().includes('sign-off') ||
                        f.metadata?.label?.toLowerCase().includes('signoff') ||
                        f.label?.toLowerCase().includes('sign-off') ||
                        f.label?.toLowerCase().includes('signoff') ||
                        f.category === 'signoff' ||
                        f.metadata?.category === 'signoff' ||
                        f.id?.startsWith('signoff-doc')
                    );
                    const subBillFile = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                    const isSubassigned = !!(job.assignedSubcontractorId || job.subcontractorId || job.subcontractorName || job.subcontractor || job.subcontractorCompany || job.subcontractorEmail);
                    const poNumber = job.poNumber || job.invoice?.poNumber || linkedProposal?.poNumber;

                    const checkIn = job.checkInTime || (job.timeEntries && job.timeEntries[0]?.checkInTime);
                    const checkOut = job.checkOutTime || (job.timeEntries && job.timeEntries[0]?.checkOutTime);
                    const formattedIn = checkIn ? new Date(checkIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;
                    const formattedOut = checkOut ? new Date(checkOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

                    const totalAmount = Number(job.invoice?.totalAmount) || Number(job.invoice?.amount) || 0;
                    const rawAmountPaid = Number(job.invoice?.amountPaid || job.invoice?.depositPaidAmount || (job.invoice?.depositPaid ? (job.invoice?.depositAmount || 0) : 0) || 0);
                    const amountPaid = Math.min(totalAmount, Math.max(0, job.invoice?.status === 'Paid' ? (rawAmountPaid > 0 ? rawAmountPaid : totalAmount) : rawAmountPaid));
                    const balanceRemaining = Math.max(0, totalAmount - amountPaid);
                    const isPartiallyPaid = (job.invoice?.status === 'Partially Paid') || (amountPaid > 0 && balanceRemaining > 0);
                    const effectiveStatus = job.invoice?.status === 'Paid' 
                        ? 'Paid' 
                        : isPartiallyPaid 
                        ? 'Partially Paid' 
                        : (job.invoice?.status || 'Unpaid');

                    const invIdRaw = job.invoice?.id != null ? String(job.invoice.id) : '';
                    const displayInvoiceId = invIdRaw 
                        ? (invIdRaw.startsWith('INV-') ? invIdRaw : `INV-${invIdRaw}`) 
                        : `INV-${job.id}`;

                    const linkedCust = (state.customers || []).find((c: any) => c.id === job.customerId || c.name?.trim().toLowerCase() === job.customerName?.trim().toLowerCase());

                    return (
                        <tbody key={job.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                            <tr>
                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{displayInvoiceId}</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const targetCustId = job.customerId || linkedCust?.id;
                                            if (targetCustId) {
                                                setSelectedCustomerId(targetCustId);
                                            } else {
                                                showToast.info("No customer profile found for this record.");
                                            }
                                        }}
                                        className="cursor-pointer group/cust hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1 transition-colors"
                                        title="Click to open customer profile"
                                    >
                                        <span className="font-semibold group-hover/cust:underline">{getCustomerDisplayName(job)}</span>
                                        <span className="text-xs text-slate-400 group-hover/cust:text-primary-600 dark:group-hover/cust:text-primary-400">↗</span>
                                    </div>
                                </td>
                                {(() => {
                                    let rawLocName = job.locationName || job.serviceLocationName || '';
                                    let rawLocAddr = job.address || job.serviceAddress || job.locationAddress || '';

                                    let locName = typeof rawLocName === 'string' ? rawLocName : formatAddress(rawLocName);
                                    let locAddr = formatAddress(rawLocAddr);

                                    if (linkedCust?.serviceLocations?.length) {
                                        const matchedLoc = linkedCust.serviceLocations.find((l: any) =>
                                            (job.locationId && l.id === job.locationId) ||
                                            (locName && (l.name?.trim().toLowerCase() === locName.trim().toLowerCase() || l.propertyName?.trim().toLowerCase() === locName.trim().toLowerCase())) ||
                                            (locAddr && l.address && locAddr.toLowerCase().includes(formatAddress(l.address).toLowerCase()))
                                        ) || (linkedCust.serviceLocations.length === 1 ? linkedCust.serviceLocations[0] : null);

                                        if (matchedLoc) {
                                            if (!locName || locName === getCustomerDisplayName(job)) {
                                                locName = matchedLoc.propertyName || matchedLoc.name || formatAddress(matchedLoc.address) || locName;
                                            }
                                            if (!locAddr) locAddr = formatAddress(matchedLoc.address);
                                        }
                                    }

                                    return (
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">{locName || <span className="italic text-slate-400">--</span>}</div>
                                            {locAddr && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate max-w-[200px]" title={locAddr}>
                                                    {locAddr}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })()}
                                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                                    {job.appointmentTime ? (
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{new Date(job.appointmentTime).toLocaleDateString()}</div>
                                            {(formattedIn || formattedOut) ? (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                    {formattedIn && <span>In: {formattedIn}</span>}
                                                    {formattedOut && <span> | Out: {formattedOut}</span>}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-0.5">Time on site logged</div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="italic text-slate-400">Not scheduled</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-sans">
                                    <div className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                                        ${totalAmount.toFixed(2)}
                                    </div>
                                    {amountPaid > 0 && balanceRemaining > 0 && (
                                        <div className="text-[11px] font-semibold mt-1 space-y-0.5">
                                            <div className="text-emerald-600 dark:text-emerald-400">
                                                {t("Paid")}: ${amountPaid.toFixed(2)}
                                            </div>
                                            <div className="text-blue-700 dark:text-blue-400 font-bold">
                                                {t("Remaining")}: ${balanceRemaining.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        <span 
                                            onClick={() => setEditingInvoiceId(job.id)} 
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm font-sans"
                                            title={t("Edit / View Invoice")}
                                        >
                                            <FileText size={10} />
                                            {displayInvoiceId}
                                        </span>

                                        {(() => {
                                            const deadlineDays = linkedCust?.submissionRules?.submissionDeadlineDays || (job.customerId === 'cust-1787187506048' ? 20 : null);
                                            if (!deadlineDays) return null;
                                            
                                            const isSettled = effectiveStatus === 'Paid' || job.invoice?.status === 'Paid';
                                            if (isSettled) return null;

                                            const workDateStr = job.checkOutTime || job.appointmentTime || (job as any).completedDate || job.invoice?.invoiceDate || job.createdAt;
                                            const workDate = workDateStr ? new Date(workDateStr) : new Date();
                                            const elapsed = Math.max(0, Math.floor((Date.now() - workDate.getTime()) / (1000 * 60 * 60 * 24)));
                                            const left = deadlineDays - elapsed;

                                            return (
                                                <span 
                                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-xs font-sans ${
                                                        left < 0 
                                                            ? 'bg-rose-950 text-rose-200 border-rose-600 animate-pulse font-black' 
                                                            : left <= 5 
                                                            ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse font-black' 
                                                            : left <= 10 
                                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700' 
                                                            : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                    }`}
                                                    title={`Impact 20-Day Cutoff: ${left < 0 ? `${Math.abs(left)} days past deadline!` : `${left} days left to submit raw PDF invoice`}`}
                                                >
                                                    <Clock size={10} />
                                                    {left < 0 ? `🛑 Past 20d Cutoff (${Math.abs(left)}d)` : `⏱️ ${left}d Cutoff`}
                                                </span>
                                            );
                                        })()}

                                        <span 
                                            onClick={() => setViewingJob(job)} 
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shadow-sm font-sans"
                                            title={t("View Job Details")}
                                        >
                                            <Briefcase size={10} />
                                            {job.jobNumber || (job.id.startsWith('Job-') || job.id.startsWith('JOB-') ? job.id : `Job-${job.id.replace(/^job-/, '')}`)}
                                        </span>

                                        {linkedProposal && (
                                            <span 
                                                onClick={() => setViewingProposal(linkedProposal)}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm font-sans ${
                                                    linkedProposal.status === 'Accepted'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                                                    : linkedProposal.status === 'Opened'
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                                    : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                                                }`}
                                                title={`${t("View Proposal")}${linkedProposal.status ? ` (${t(linkedProposal.status)})` : ''}`}
                                            >
                                                <FileText size={10} />
                                                {linkedProposal.proposalNumber || (linkedProposal.id.startsWith('PROP-') ? linkedProposal.id : `PROP-${linkedProposal.id.replace(/^prop-/, '')}`)}
                                                {linkedProposal.status && (
                                                    <span className="text-[9px] font-medium opacity-85">
                                                        • {t(linkedProposal.status)}
                                                    </span>
                                                )}
                                            </span>
                                        )}

                                        {linkedFollowUpJob && (
                                            <span 
                                                onClick={() => setEditingInvoiceId(linkedFollowUpJob.id)} 
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors shadow-sm font-sans"
                                                title={t("Rolled into linked repair job - click to view")}
                                            >
                                                <FileText size={10} />
                                                {`Rolled Into ${linkedFollowUpJob.invoice?.id || 'Job #' + linkedFollowUpJob.id.slice(-6)}`}
                                            </span>
                                        )}

                                        {poNumber && (
                                            <span 
                                                onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                                title={t("View Work Order Associations")}
                                            >
                                                <Briefcase size={10} />
                                                {`WO: ${poNumber}`}
                                            </span>
                                        )}

                                        {/* Sign-Off Button - ALWAYS shown */}
                                        <span 
                                            onClick={() => {
                                                if (signOffFile) {
                                                    setPreviewOtherDoc({ ...signOffFile, type: 'Other', title: t('Manager Sign-Off Sheet') });
                                                } else {
                                                    setActiveSignOffJob(job);
                                                }
                                            }}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm font-sans ${
                                                signOffFile 
                                                ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 dark:hover:bg-teal-900/40' 
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300'
                                            }`}
                                            title={signOffFile ? t("View Subcontractor Manager Sign-Off Sheet") : t("Open Blank Sign-off Sheet to Sign")}
                                        >
                                            <ShieldCheck size={10} />
                                            {signOffFile ? t("Sign-off") : t("+ Sign-off")}
                                        </span>

                                        {/* Subcontractor Bill Button - ONLY shown if assigned to a subcontractor */}
                                        {isSubassigned && (
                                            <span 
                                                onClick={() => {
                                                    if (subBillFile) {
                                                        setPreviewOtherDoc({ ...subBillFile, type: 'Other', title: t('Subcontractor Bill') });
                                                    } else {
                                                        setActiveSubBillJob(job);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm font-sans ${
                                                    subBillFile 
                                                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40' 
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                                                }`}
                                                title={subBillFile ? t("View Subcontractor Bill") : t("View Subcontractor Work Order / Bill")}
                                            >
                                                <DollarSign size={10} />
                                                {subBillFile ? t("Sub Bill") : t("+ Sub Bill")}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            effectiveStatus === 'Paid' 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                            : effectiveStatus === 'Partially Paid' 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                            {t(effectiveStatus)}
                                        </span>
                                        {isPartiallyPaid && balanceRemaining > 0 && (
                                            <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                                                ${balanceRemaining.toFixed(2)} {t("Remaining")}
                                            </span>
                                        )}
                                        {(job.invoice.opened || job.invoice.status === 'Opened') && effectiveStatus !== 'Paid' && (
                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1 flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                {t("Opened")}
                                            </span>
                                        )}
                                        {(job.invoice.paymentMethod || job.invoice.paidDate) && (
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold space-y-0.5 leading-tight">
                                                {job.invoice.paymentMethod && (
                                                    <div>
                                                        <span className="text-slate-400 dark:text-slate-500 font-medium">{t("Method")}: </span>
                                                        <span className="text-slate-700 dark:text-slate-300">{t(job.invoice.paymentMethod)}</span>
                                                    </div>
                                                )}
                                                {job.invoice.paidDate && (
                                                    <div>
                                                        <span className="text-slate-400 dark:text-slate-500 font-medium">{t("Processed")}: </span>
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            {(() => {
                                                                try {
                                                                    const d = new Date(job.invoice.paidDate);
                                                                    return isNaN(d.getTime()) ? job.invoice.paidDate : d.toLocaleDateString();
                                                                } catch (e) {
                                                                    return job.invoice.paidDate;
                                                                }
                                                            })()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                                    {(() => {
                                        const sentTime = job.invoice?.sentAt || (job as any).invoiceSentAt || (job.invoice as any)?.emailSentAt;
                                        const isOpened = Boolean(job.invoice?.opened || job.invoice?.status === 'Opened');
                                        const openedAt = job.invoice?.openedAt;
                                        const reminders: string[] = job.invoice?.remindersSent || [];

                                        if (!sentTime && reminders.length === 0) {
                                            return (
                                                <span className="italic text-slate-400 flex items-center gap-1">
                                                    <Clock size={11} className="shrink-0 text-slate-400" />
                                                    {t("Draft (Not Sent)")}
                                                </span>
                                            );
                                        }

                                        return (
                                            <div className="flex flex-col gap-1 items-start max-w-[170px]">
                                                {sentTime ? (
                                                    <div className="flex flex-col" title={`Sent: ${new Date(sentTime).toLocaleString()}`}>
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                                            <Send size={11} className="text-blue-500 shrink-0" />
                                                            <span>{t("Sent")}: {new Date(sentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-3.5">
                                                            {new Date(sentTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="italic text-slate-400 text-[10px]">{t("Initial send date n/a")}</span>
                                                )}

                                                {/* Delivery Tracking / Opened State */}
                                                {isOpened ? (
                                                    <span 
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                                                        title={openedAt ? `Opened on ${new Date(openedAt).toLocaleString()}` : t("Opened by recipient")}
                                                    >
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                        <span>{t("Opened")}</span>
                                                        {openedAt && (
                                                            <span className="text-[9px] font-normal opacity-80">
                                                                {new Date(openedAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : sentTime ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        <span>{t("Unopened")}</span>
                                                    </span>
                                                ) : null}

                                                {/* Reminders Sent */}
                                                {reminders.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800 w-full">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                            <Bell size={9} />
                                                            {t("Reminders")} ({reminders.length}):
                                                        </span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {reminders.map((dateStr: string, idx: number) => (
                                                                <span 
                                                                    key={idx} 
                                                                    className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-1.5 py-0.2 rounded text-[9px] font-bold"
                                                                    title={`Reminder sent ${new Date(dateStr).toLocaleString()}`}
                                                                >
                                                                    {new Date(dateStr).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
                            </tr>
                            <tr className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                <td colSpan={8} className="px-6 py-2 border-t-0">
                                <div className="flex flex-wrap gap-2 items-center text-xs">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-2">{t("Actions")}:</span>
                                    
                                    <button 
                                        title={t("View Invoice")} 
                                        onClick={() => setViewingInvoiceJob(job)} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <Eye size={14} />
                                        {t("View")}
                                    </button>

                                    <button 
                                        title={t("Manage Invoice")} 
                                        onClick={() => setEditingInvoiceId(job.id)} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <Settings size={14} />
                                        {t("Manage")}
                                    </button>

                                    <button 
                                        title={t("View Job")} 
                                        onClick={() => navigate(`/admin/records?tab=history&histId=${job.id}`)} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <FileText size={14} />
                                        {t("Job")}
                                    </button>

                                    <button 
                                        aria-label={t("Send Invoice")} 
                                        title={t("Send Invoice")} 
                                        onClick={(e) => { e.stopPropagation(); setSendInvoiceModalConfig({ isOpen: true, job }); }} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors font-bold rounded-md shadow-sm"
                                    >
                                        <Send size={14} />
                                        {t("Send")}
                                    </button>

                                    <button 
                                        aria-label={t("Send via SMS")} 
                                        title={t("Send Invoice Link via SMS Text")} 
                                        onClick={(e) => { e.stopPropagation(); setSmsModalJob(job); }} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <MessageSquare size={14} />
                                        {t("SMS")}
                                    </button>

                                    {job.invoice.status !== 'Paid' && (
                                        <a 
                                            href={`/#/invoice/${job.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                            title={t("Open Public Payment Page")}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <CreditCard size={14} />
                                            {t("Pay")}
                                        </a>
                                    )}

                                    {job.invoice.status !== 'Paid' && (
                                        <button 
                                            aria-label={t("Send Reminder")} 
                                            title={t("Send Reminder")} 
                                            onClick={(e) => { e.stopPropagation(); setSendInvoiceModalConfig({ isOpen: true, job }); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Bell size={14} />
                                            {t("Reminder")}
                                        </button>
                                    )}

                                    {isAdmin && (
                                        <button 
                                            aria-label={t("Reassign Customer")} 
                                            title={t("Reassign Customer")} 
                                            onClick={(e) => { e.stopPropagation(); setReassignInvoiceJob(job); setNewInvoiceCustomerId(job.customerId || ''); }} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <UserPlus size={14} />
                                            {t("Reassign")}
                                        </button>
                                    )}

                                    <button 
                                        aria-label={t("Copy Reference")} 
                                        title={t("Copy Reference")} 
                                        onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <Copy size={14} />
                                        {t("Copy Ref")}
                                    </button>

                                    <button 
                                        aria-label={t("Share Invoice")} 
                                        title={t("Share Invoice")} 
                                        onClick={(e) => { e.stopPropagation(); setShareModalInvoice(job); }} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <Share2 size={14} />
                                        {t("Share")}
                                    </button>

                                    {isAdmin && (
                                        <button 
                                            title={t("Delete Invoice")} 
                                            onClick={() => handleDeleteInvoice(job.id)} 
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Trash2 size={14} />
                                            {t("Delete")}
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                )})}
            </Table>
            </div>

            {sendInvoiceModalConfig.isOpen && sendInvoiceModalConfig.job && (
                <SendEmailModal
                    isOpen={sendInvoiceModalConfig.isOpen}
                    onClose={() => setSendInvoiceModalConfig({ isOpen: false, job: null })}
                    job={sendInvoiceModalConfig.job}
                    invoice={sendInvoiceModalConfig.job.invoice}
                    mode="invoice"
                />
            )}

            {recipientModalConfig.isOpen && recipientModalConfig.job && (
                <RecipientSelectorModal
                    isOpen={recipientModalConfig.isOpen}
                    onClose={() => setRecipientModalConfig({ isOpen: false, job: null })}
                    customerId={recipientModalConfig.job.customerId}
                    locationId={recipientModalConfig.job.locationId || (recipientModalConfig.job as any).serviceLocationId}
                    locationName={recipientModalConfig.job.locationName || (recipientModalConfig.job as any).siteLocationName || (recipientModalConfig.job as any).address}
                    documentType="invoice"
                    title={t("Select Reminder Recipients")}
                    onConfirm={(emails, attachPdf) => {
                        handleSendInvoiceReminder(recipientModalConfig.job, emails, attachPdf);
                        setRecipientModalConfig({ isOpen: false, job: null });
                    }}
                />
            )}

            {viewingProposal && (
                <DocumentPreview
                    type="Proposal"
                    data={viewingProposal}
                    onClose={() => setViewingProposal(null)}
                />
            )}

            {previewOtherDoc && (
                <DocumentPreview
                    type="Other"
                    data={previewOtherDoc}
                    onClose={() => setPreviewOtherDoc(null)}
                    isInternal={true}
                />
            )}

            {viewingJob && (
                <JobDetailModal
                    isOpen={true}
                    onClose={() => setViewingJob(null)}
                    job={viewingJob}
                    isAdmin={true}
                />
            )}

            {activeSignOffJob && (
                <SignOffModal 
                    isOpen={!!activeSignOffJob} 
                    onClose={() => setActiveSignOffJob(null)} 
                    job={activeSignOffJob}
                    onSave={async (file: any, updatedFields?: any) => {
                        try {
                            const updatedFiles = updatedFields?.files || [...(activeSignOffJob.files || []), file];
                            const sheetUrl = file.url || file.dataUrl;
                            const signOffData = updatedFields?.signOff || {
                                managerName: file.metadata?.managerName || null,
                                technicianName: file.metadata?.technicianName || activeSignOffJob.assignedTechnicianName || null,
                                dateOfService: file.metadata?.dateOfService || new Date().toISOString().split('T')[0],
                                sheetUrl: sheetUrl,
                                timestamp: new Date().toISOString(),
                                status: 'COMPLETED'
                            };
                            const updates = {
                                files: updatedFiles,
                                signOffSheetUrl: sheetUrl,
                                signoffSheetUrl: sheetUrl,
                                customWorkOrderFormUrl: sheetUrl,
                                signOff: signOffData,
                                signOffSignature: sheetUrl || 'SIGNED_ON_FILE',
                                ...(updatedFields || {})
                            };
                            await db.collection('jobs').doc(activeSignOffJob.id).update(cleanUndefinedFields(updates));
                            dispatch({ type: 'UPDATE_JOB', payload: { ...activeSignOffJob, ...updates } });
                            activeSignOffJob.files = updatedFiles;
                            showToast.success(t("Sign-off sheet saved successfully!"));
                        } catch (err) {
                            console.error("Error saving sign-off", err);
                        }
                        setActiveSignOffJob(null);
                    }}
                />
            )}

            {activeSubBillJob && (
                <SubcontractorWorkOrderModal 
                    isOpen={!!activeSubBillJob} 
                    onClose={() => setActiveSubBillJob(null)} 
                    job={activeSubBillJob} 
                />
            )}

            {/* Standalone Payment / Deposit Link Modal */}
            {createPaymentLinkOpen && (
                <CreatePaymentLinkModal
                    isOpen={createPaymentLinkOpen}
                    onClose={() => setCreatePaymentLinkOpen(false)}
                />
            )}

            {/* Outbound SMS Modal */}
            {smsModalJob && (
                <SendSMSModal
                    isOpen={!!smsModalJob}
                    onClose={() => setSmsModalJob(null)}
                    job={smsModalJob}
                    invoice={smsModalJob?.invoice}
                    customerId={smsModalJob?.customerId}
                    recipientName={smsModalJob?.customerName}
                    recipientPhone={smsModalJob?.customerPhone}
                />
            )}

            {isLogPaymentModalOpen && (
                <LogReceivedPaymentModal
                    isOpen={isLogPaymentModalOpen}
                    onClose={() => setIsLogPaymentModalOpen(false)}
                    jobs={jobs || state.jobs}
                />
            )}

            {selectedCustomerId && (
                <CustomerMasterModal
                    isOpen={true}
                    onClose={() => setSelectedCustomerId(null)}
                    customerId={selectedCustomerId}
                />
            )}
        </Card>
    );
};

export default InvoicesTab;
