import React, { useMemo } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import showToast from "lib/toast";
import { getBaseUrl , cleanUndefinedFields } from "lib/utils";
import { Bell, Send } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import { generateInvoicePdfAttachment } from 'lib/pdfHelper';

interface AgingReportTabProps {
    jobs: any[];
}

const AgingReportTab: React.FC<AgingReportTabProps> = ({ jobs }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
    const [recipientModalConfig, setRecipientModalConfig] = React.useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = React.useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });

    const handleSendInvoiceReminder = async (job: any, selectedEmails?: string[], attachPdf?: boolean) => {
        let emails = selectedEmails;
        let phone = job.customerPhone;
        
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
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;">${pastDueBanner}<h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${job.customerName},</p><p>This is a friendly reminder that your invoice <strong>#${job.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
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

    const agingData = useMemo(() => {
        const unpaidJobs = jobs.filter(j => j.invoice && j.invoice.status !== 'Paid');
        const now = new Date().getTime();
        const buckets = {
            current: [] as any[],
            days30: [] as any[],
            days60: [] as any[],
            older: [] as any[]
        };

        unpaidJobs.forEach(job => {
            const date = new Date(job.appointmentTime).getTime();
            const daysOverdue = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            
            if (daysOverdue <= 30) buckets.current.push(job);
            else if (daysOverdue <= 60) buckets.days30.push(job);
            else if (daysOverdue <= 90) buckets.days60.push(job);
            else buckets.older.push(job);
        });

        const totals = {
            current: buckets.current.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0) - (Number(j.invoice.amountPaid) || 0), 0),
            days30: buckets.days30.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0) - (Number(j.invoice.amountPaid) || 0), 0),
            days60: buckets.days60.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0) - (Number(j.invoice.amountPaid) || 0), 0),
            older: buckets.older.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0) - (Number(j.invoice.amountPaid) || 0), 0)
        };

        return { buckets, totals };
    }, [jobs]);

    const totalReceivables = agingData.totals.current + agingData.totals.days30 + agingData.totals.days60 + agingData.totals.older;

    return (
        <Card>
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("Accounts Receivable Aging Summary")}</h3>
                <p className="text-sm text-slate-500">{t("Overview of unpaid invoices categorized by time since creation.")}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-bold text-slate-500 uppercase">{t("0-30 Days")}</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{fmt(agingData.totals.current)}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/30">
                    <div className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase">{t("31-60 Days")}</div>
                    <div className="text-lg font-black text-yellow-700 dark:text-yellow-400">{fmt(agingData.totals.days30)}</div>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/30">
                    <div className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase">{t("61-90 Days")}</div>
                    <div className="text-lg font-black text-orange-700 dark:text-orange-400">{fmt(agingData.totals.days60)}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
                    <div className="text-xs font-bold text-red-600 dark:text-red-500 uppercase">{t("90+ Days")}</div>
                    <div className="text-lg font-black text-red-700 dark:text-red-400">{fmt(agingData.totals.older)}</div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase">{t("Total Unpaid")}</div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{fmt(totalReceivables)}</div>
                </div>
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white mb-4 mt-8">{t("Aging Details")}</h4>
            <Table headers={[t('Customer'), t('Invoice #'), t('Date / Sent Date'), t('Age (Days)'), t('Amount'), t('Reminders Sent'), t('Actions')]}>
                {['current', 'days30', 'days60', 'older'].flatMap((bucketKey) => {
                    return agingData.buckets[bucketKey as keyof typeof agingData.buckets].map((job: any) => {
                        const total = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
                        const paid = Number(job.invoice.amountPaid) || 0;
                        const outstanding = Math.max(0, total - paid);
                        const date = new Date(job.appointmentTime).getTime();
                        const days = Math.floor((new Date().getTime() - date) / (1000 * 60 * 60 * 24));
                        return (
                            <tr key={job.id} className="bg-white dark:bg-slate-900/50">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{job.customerName}</td>
                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{job.invoice.id}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400" data-sort-value={new Date(job.appointmentTime).getTime()}>
                                    <div>{new Date(job.appointmentTime).toLocaleDateString()}</div>
                                    {job.invoice.sentAt ? (
                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            {t("Sent")}: {new Date(job.invoice.sentAt).toLocaleDateString()}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">{t("Not Sent")}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${days > 90 ? 'bg-red-100 text-red-800' : days > 60 ? 'bg-orange-100 text-orange-800' : days > 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>
                                        {days} {t("Days")}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                    <div>{fmt(outstanding)}</div>
                                    {paid > 0 && (
                                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                            Paid: {fmt(paid)}
                                        </div>
                                    )}
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
                                <td className="px-6 py-4 text-sm flex items-center gap-2">
                                    <button 
                                        onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })}
                                        className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                                        title={t("Send Invoice")}
                                    >
                                        <Send size={12} className="mr-1.5" />
                                        {t("Send Invoice")}
                                    </button>
                                    <button 
                                        onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })}
                                        className="inline-flex items-center px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 border border-orange-500/20 hover:border-orange-500/40"
                                        title={t("Send Payment Reminder")}
                                    >
                                        <Bell size={12} className="mr-1.5" />
                                        {t("Send Reminder")}
                                    </button>
                                </td>
                            </tr>
                        );
                    });
                })}
            </Table>

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
                    locationId={recipientModalConfig.job.locationId}
                    title={t("Select Reminder Recipients")}
                    onConfirm={(emails, attachPdf) => {
                        handleSendInvoiceReminder(recipientModalConfig.job, emails, attachPdf);
                        setRecipientModalConfig({ isOpen: false, job: null });
                    }}
                />
            )}
        </Card>
    );
};

export default AgingReportTab;
