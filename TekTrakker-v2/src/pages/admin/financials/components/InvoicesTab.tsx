/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";

import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { Trash2, Share2, Copy, Bell, Calculator, Download, UserPlus, Search, ExternalLink, CreditCard } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import DocumentPreview from 'components/ui/DocumentPreview';
import { useLanguage } from 'context/LanguageContext';

interface InvoicesTabProps {
    jobs: any[];
    setEditingInvoiceId: (id: string) => void;
    handleDeleteInvoice: (id: string) => void;
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({ jobs, setEditingInvoiceId, handleDeleteInvoice }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const [shareModalInvoice, setShareModalInvoice] = useState<any>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);
    const [taxMode, setTaxMode] = useState(false);
    const [reassignInvoiceJob, setReassignInvoiceJob] = useState<any>(null);
    const [newInvoiceCustomerId, setNewInvoiceCustomerId] = useState('');

    const [sortBy, setSortBy] = useState('date_desc');
    const [searchTerm, setSearchTerm] = useState('');

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

    const handleSendInvoiceReminder = async (job: any) => {
        let email = job.customerEmail;
        let phone = job.customerPhone;
        
        // If not in job object natively, attempt to lookup
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

        if (!confirm(`${t("Send payment reminder for invoice #")}${job.invoice.id} ${t("to")} ${email || t("this customer")}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/invoice/${job.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            const invTotal = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
            
            if (email) {
                await db.collection('mail').add({
                    to: [email],
                    message: {
                        subject: `Reminder: Invoice #${job.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;"><h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${job.customerName},</p><p>This is a friendly reminder that your invoice <strong>#${job.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                        text: `Reminder: Invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`
                    },
                    organizationId: state.currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                });
            }

            if (phone) {
                await db.collection('messages').add({
                    to: phone,
                    body: `Reminder from ${orgName}: Your invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
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

            showToast.warn(`${t("Reminder sent via")} ${email ? t("email") : ""} ${email && phone ? t("and") + " " : ""}${phone ? t("SMS text") : ""}!`);
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
            case 'status':
                return (a.invoice.status || '').localeCompare(b.invoice.status || '');
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
                        placeholder={t("Search invoices by #, customer, or amount...")}
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
                            <option value="status">{t("Status")}</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant={taxMode ? "primary" : "secondary"} onClick={() => setTaxMode(!taxMode)} className="w-auto text-xs flex items-center gap-2">
                            <Calculator size={14} /> {taxMode ? t("Exit Tax Prep") : t("Tax Prep Mode")}
                        </Button>
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

            <Table headers={[t('Invoice #'), t('Customer'), t('Date / Sent Date'), t('Amount'), t('Status'), t('Reminders Sent'), t('Actions')]}>
                {sortedInvoices.map((job: any) => (
                    <tr key={job.id}>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{job.invoice.id}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{job.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
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
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                job.invoice.status === 'Paid' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                : job.invoice.status === 'Partially Paid' 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                                {t(job.invoice.status)}
                            </span>
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
                        <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 items-center">
                                {job.invoice.status !== 'Paid' && (
                                    <button aria-label={t("Send Reminder")} title={t("Send Reminder")} onClick={(e) => { e.stopPropagation(); handleSendInvoiceReminder(job); }} className="p-1 text-orange-500 hover:text-orange-700"><Bell size={16}/></button>
                                )}
                                <button title={t("View Invoice")} onClick={() => setViewingInvoiceJob(job)} className="text-primary-600 hover:underline text-sm font-bold">{t("View")}</button>
                                <span className="text-slate-300">|</span>
                                <button title={t("Manage Invoice")} onClick={() => setEditingInvoiceId(job.id)} className="text-primary-600 hover:underline text-sm font-bold">{t("Manage")}</button>
                                {job.invoice.status !== 'Paid' && (
                                    <>
                                        <span className="text-slate-300">|</span>
                                        <a 
                                            href={`/#/invoice/${job.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-emerald-600 hover:underline text-sm font-bold inline-flex items-center gap-0.5"
                                            title={t("Open Public Payment Page")}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <CreditCard size={14} /> {t("Pay")}
                                        </a>
                                    </>
                                )}
                                <button aria-label={t("Reassign Customer")} title={t("Reassign Customer")} onClick={(e) => { e.stopPropagation(); setReassignInvoiceJob(job); setNewInvoiceCustomerId(job.customerId || ''); }} className="p-1 text-slate-400 hover:text-orange-600"><UserPlus size={16}/></button>
                                <button aria-label={t("Copy Reference")} title={t("Copy Reference")} onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} className="p-1 text-slate-400 hover:text-primary-600"><Copy size={16}/></button>
                                <button aria-label={t("Share Invoice")} title={t("Share Invoice")} onClick={(e) => { e.stopPropagation(); setShareModalInvoice(job); }} className="p-1 text-slate-400 hover:text-primary-600"><Share2 size={16}/></button>
                                <button title={t("Delete Invoice")} onClick={() => handleDeleteInvoice(job.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default InvoicesTab;
