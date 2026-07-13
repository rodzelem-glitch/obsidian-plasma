/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { Trash2, Share2, Copy, Bell, Calculator, Download, UserPlus, Search, ExternalLink, CreditCard, RefreshCw, Eye, Settings, FileText, Briefcase, ShieldCheck, DollarSign } from 'lucide-react';
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
    const [taxMode, setTaxMode] = useState(false);
    const [reassignInvoiceJob, setReassignInvoiceJob] = useState<any>(null);
    const [newInvoiceCustomerId, setNewInvoiceCustomerId] = useState('');

    const [sortBy, setSortBy] = useState('date_desc');
    

    const [searchTerm, setSearchTerm] = useState('');
    const [isReconciling, setIsReconciling] = useState(false);
    const [recipientModalConfig, setRecipientModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });

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
            await db.collection('messages').doc(msgObj.id).set(msgObj);
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
            await db.collection('jobs').doc(reassignInvoiceJob.id).update({
                customerId: newCustomer.id,
                customerName: newCustomer.name,
                customerEmail: newCustomer.email || null,
                customerPhone: newCustomer.phone || null,
                address: newCustomer.address || reassignInvoiceJob.address,
                'invoice.billToName': newCustomer.name,
                'invoice.billToAddress': newCustomer.address || ''
            });
            showToast.success(t("Invoice reassigned successfully."));
            setReassignInvoiceJob(null);
            setNewInvoiceCustomerId('');
        } catch (e) {
            showToast.warn(t("Failed to reassign invoice."));
        }
    };

    const handleSendInvoiceReminder = async (job: any, selectedEmails?: string[]) => {
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
                const dueDateObj = new Date(dueDateVal);
                dueDateObj.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return today.getTime() > dueDateObj.getTime();
            })();

            const pastDueBanner = isLate ? `<div style="color:#dc2626;font-size:32px;font-weight:bold;margin-bottom:10px;text-align:left;border-bottom:2px solid #dc2626;padding-bottom:10px;">PAST DUE</div>` : '';

            if (emails.length > 0) {
                await db.collection('mail_queue').add({
                    to: emails,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                    message: {
                        subject: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${job.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;">${pastDueBanner}<h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${job.customerName},</p><p>This is a friendly reminder that your invoice <strong>#${job.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                        text: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`,
                        replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                    },
                    organizationId: state.currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                });
            }

            if (phone && !selectedEmails) {
                await db.collection('messages').add({
                    to: phone,
                    body: `${isLate ? 'PAST DUE - ' : ''}Reminder from ${orgName}: Your invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: state.currentOrganization?.id,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                });
            }

            // Save reminder sent date
            const reminderDate = new Date().toISOString();
            const currentReminders = job.invoice.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('jobs').doc(job.id).update({
                'invoice.remindersSent': newReminders
            });

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

    const sortedInvoices = [...jobs.filter((j: any) => j.invoice)]
        .filter((j: any) => {
            if (!searchTerm) return true;
            const q = searchTerm.toLowerCase();
            const amt = (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0).toFixed(2);
            return (
                (j.invoice.id || '').toLowerCase().includes(q) ||
                (j.id || '').toLowerCase().includes(q) || // Internal WO Number (Job ID)
                (j.poNumber || '').toLowerCase().includes(q) || // External WO Number
                ((j.invoice as any).poNumber || '').toLowerCase().includes(q) || // External WO Number (invoice-level)
                (j.customerName || '').toLowerCase().includes(q) ||
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
                return (a.customerName || '').localeCompare(b.customerName || '');
            case 'name_desc':
                return (b.customerName || '').localeCompare(a.customerName || '');
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

        jobs.filter(j => j?.invoice?.status === 'Paid').forEach(j => {
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
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button 
                                variant="secondary"
                                onClick={handleReconcilePayments} 
                                disabled={isReconciling}
                                className="w-auto text-xs flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shrink-0"
                            >
                                <RefreshCw size={14} className={isReconciling ? "animate-spin" : ""} />
                                {isReconciling ? t("Syncing...") : t("Sync Kort Payments")}
                            </Button>
                            <Button variant={taxMode ? "primary" : "secondary"} onClick={() => setTaxMode(!taxMode)} className="w-auto text-xs flex items-center gap-2">
                                <Calculator size={14} /> {taxMode ? t("Exit Tax Prep") : t("Tax Prep Mode")}
                            </Button>
                        </div>
                    )}
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

            <Table headers={[
                t('Invoice #'),
                t('Customer'),
                t('Service Location'),
                t('Date / Sent Date'),
                t('Amount'),
                t('Linked Documents'),
                t('Status'),
                t('Reminders Sent')
            ]}>
                {sortedInvoices.map((job: any) => {
                    const linkedProposal = (state.proposals || []).find((p: any) => p.id === job.proposalId || p.jobId === job.id || (job.invoice?.id && p.invoiceId === job.invoice.id));
                    const hasInvoice = job.invoice?.id;
                    const signOffFile = (job.files || []).find((f: any) => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet' || f.id?.startsWith('signoff-doc'));
                    const subBillFile = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc'));
                    const poNumber = job.poNumber || job.invoice?.poNumber || linkedProposal?.poNumber;

                    return (
                        <tbody key={job.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                            <tr>
                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{job.invoice.id}</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{job.customerName}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    <div>{job.locationName || <span className="italic text-slate-400">--</span>}</div>
                                    {job.address && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]" title={job.address}>
                                            {job.address}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400" data-sort-value={new Date(job.appointmentTime).getTime()}>
                                    <div>{new Date(job.appointmentTime).toLocaleDateString()}</div>
                                    {job.invoice.sentAt ? (
                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            {t("Sent")}: {new Date(job.invoice.sentAt).toLocaleDateString()}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">{t("Not Sent")}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                    <div>${(Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0).toFixed(2)}</div>
                                    {job.invoice.amountPaid !== undefined && job.invoice.amountPaid > 0 && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {t("Paid")}: ${job.invoice.amountPaid.toFixed(2)} | {t("Bal")}: {Math.max(0, ((Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0) - job.invoice.amountPaid)).toFixed(2)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                        {hasInvoice && (
                                            <span 
                                                onClick={() => setViewingInvoiceJob(job)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm font-sans"
                                                title={t("View Invoice")}
                                            >
                                                <DollarSign size={10} />
                                                {`INV-${job.invoice.id}`}
                                            </span>
                                        )}

                                        <span 
                                            onClick={() => setViewingJob(job)}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm font-sans"
                                            title={t("View Job Details")}
                                        >
                                            <Briefcase size={10} />
                                            {`JOB-${job.id.slice(-6).toUpperCase()}`}
                                        </span>

                                        {linkedProposal && (
                                            <span 
                                                onClick={() => setViewingProposal(linkedProposal)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm font-sans"
                                                title={t("View Proposal")}
                                            >
                                                <FileText size={10} />
                                                {`PROP-${linkedProposal.id.slice(-6).toUpperCase()}`}
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

                                        {signOffFile && (
                                            <span 
                                                onClick={() => setPreviewOtherDoc({ ...signOffFile, type: 'Other', title: t('Manager Sign-Off Sheet') })}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors shadow-sm font-sans"
                                                title={t("View Subcontractor Manager Sign-Off Sheet")}
                                            >
                                                <ShieldCheck size={10} />
                                                {t("Sign-off")}
                                            </span>
                                        )}

                                        {subBillFile && (
                                            <span 
                                                onClick={() => setPreviewOtherDoc({ ...subBillFile, type: 'Other', title: t('Subcontractor Bill') })}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shadow-sm font-sans"
                                                title={t("View Subcontractor Bill")}
                                            >
                                                <DollarSign size={10} />
                                                {t("Sub Bill")}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            job.invoice.status === 'Paid' 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                            : job.invoice.status === 'Partially Paid' 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                            {t(job.invoice.status)}
                                        </span>
                                        {(job.invoice.opened || job.invoice.status === 'Opened') && job.invoice.status !== 'Paid' && (
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
                                    {job.invoice.remindersSent && job.invoice.remindersSent.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                                            {job.invoice.remindersSent.map((dateStr: string, idx: number) => (
                                                <span key={idx} className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                    {new Date(dateStr).toLocaleDateString()}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="italic text-slate-400">{t("None")}</span>
                                    )}
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
                                        onClick={() => navigate(`/admin/history?histId=${job.id}`)} 
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                    >
                                        <FileText size={14} />
                                        {t("Job")}
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
                                            onClick={(e) => { e.stopPropagation(); setRecipientModalConfig({ isOpen: true, job }); }} 
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

            {recipientModalConfig.isOpen && recipientModalConfig.job && (
                <RecipientSelectorModal
                    isOpen={recipientModalConfig.isOpen}
                    onClose={() => setRecipientModalConfig({ isOpen: false, job: null })}
                    customerId={recipientModalConfig.job.customerId}
                    locationId={recipientModalConfig.job.locationId}
                    title={t("Select Reminder Recipients")}
                    onConfirm={(emails) => {
                        handleSendInvoiceReminder(recipientModalConfig.job, emails);
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
        </Card>
    );
};

export default InvoicesTab;
