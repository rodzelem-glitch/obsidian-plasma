import React, { useMemo, useState } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import showToast from "lib/toast";
import { getBaseUrl, cleanUndefinedFields, formatAddress, createEmailButtonHtml } from "lib/utils";
import Button from 'components/ui/Button';
import { Bell, Send, MessageSquare, DollarSign, Eye, Download, Printer, Filter, Search, Calendar, RefreshCw, Clock } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import SendSMSModal from 'components/modals/SendSMSModal';
import { LogReceivedPaymentModal } from 'components/modals/LogReceivedPaymentModal';
import { generateInvoicePdfAttachment } from 'lib/pdfHelper';
import DocumentPreview from 'components/ui/DocumentPreview';

interface AgingReportTabProps {
    jobs: any[];
}

export type AgingBasis = 'visit' | 'due' | 'invoice';
export type AgingFilter = 'all' | 'over45' | 'current' | 'days30' | 'days60' | 'older';

const AgingReportTab: React.FC<AgingReportTabProps> = ({ jobs }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

    const [recipientModalConfig, setRecipientModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    const [isLogPaymentModalOpen, setIsLogPaymentModalOpen] = useState(false);
    const [smsModalJob, setSmsModalJob] = useState<any | null>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any | null>(null);

    // Filters and Options
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [agingBasis, setAgingBasis] = useState<AgingBasis>('visit');
    const [selectedFilter, setSelectedFilter] = useState<AgingFilter>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

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

    const getJobDue = (j: any) => {
        if (!j?.invoice) return 0;
        const total = Number(j.invoice.totalAmount) || Number(j.invoice.amount) || Number(j.invoice.grandTotal) || 0;
        const paid = Number(j.invoice.amountPaid) || (j.invoice.payments ? j.invoice.payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) : 0) || Number(j.depositPaid ? j.depositAmount : 0) || 0;
        return Math.max(0, total - paid);
    };

    const getJobEntities = (job: any) => {
        if (!job) return { customerName: 'Unknown Customer', customerId: '', locationName: null, locationAddress: null, poNumber: '' };

        let foundCust = state.customers?.find((c: any) => c.id === job.customerId || c.id === job.billingEntityId);
        
        if (!foundCust && state.customers) {
            const rawName = (job.customerName || job.billToCustomerName || '').trim().toLowerCase();
            foundCust = state.customers.find((c: any) => {
                if (c.name && c.name.trim().toLowerCase() === rawName) return true;
                if (c.serviceLocations && Array.isArray(c.serviceLocations)) {
                    return c.serviceLocations.some((loc: any) => {
                        const locName = (loc.propertyName || loc.name || '').trim().toLowerCase();
                        return locName && rawName && (locName === rawName || rawName.includes(locName) || locName.includes(rawName));
                    });
                }
                return false;
            });
        }

        let customerName = foundCust?.name || job.billToCustomerName || job.billToName || job.customerName || 'Unknown Customer';
        const customerId = foundCust?.id || job.customerId || '';

        // Fallback for known site locations matching parent accounts
        if (job.customerName && (job.customerName.toLowerCase().startsWith('humana') || job.customerName.toLowerCase().includes('toepperwein'))) {
            if (foundCust?.name) {
                customerName = foundCust.name;
            } else {
                customerName = '23rd Group Facility Services';
            }
        }

        let rawLocName = job.locationName || job.serviceLocationName || job.propertyName || '';
        let locationName = typeof rawLocName === 'string' ? rawLocName : formatAddress(rawLocName);
        let locationAddress = formatAddress(job.address || job.serviceAddress || job.locationAddress);

        if (job.customerName && job.customerName !== customerName && !locationName) {
            locationName = typeof job.customerName === 'string' ? job.customerName : formatAddress(job.customerName);
        }

        if (foundCust?.serviceLocations) {
            const locId = job.serviceLocationId || job.locationId || job.propertyId;
            const matchedLoc = foundCust.serviceLocations.find((l: any) => 
                (locId && l.id === locId) || 
                (locationName && (l.propertyName === locationName || l.name === locationName)) ||
                (locationAddress && l.address && locationAddress.toLowerCase().includes(formatAddress(l.address).toLowerCase()))
            );
            if (matchedLoc) {
                locationName = matchedLoc.propertyName || matchedLoc.name || (typeof matchedLoc.address === 'string' ? matchedLoc.address : formatAddress(matchedLoc.address)) || locationName;
                locationAddress = formatAddress(matchedLoc.address) || locationAddress;
            }
        }

        const hasLocation = Boolean(locationName || locationAddress);
        const isDistinct = hasLocation && (locationName !== customerName);
        const poNumber = job.poNumber || job.workOrderNumber || job.invoice?.poNumber || '';

        return {
            customerName,
            customerId,
            locationName: isDistinct ? locationName : null,
            locationAddress: isDistinct ? locationAddress : null,
            poNumber
        };
    };

    // Calculate days elapsed based on the selected aging basis
    const getJobDaysElapsed = (job: any, basis: AgingBasis, nowMs: number) => {
        let dateVal: any = null;
        if (basis === 'visit') {
            dateVal = job.appointmentTime || job.completedDate || job.checkInTime || job.createdAt;
        } else if (basis === 'due') {
            dateVal = job.invoice?.dueDate || job.appointmentTime || job.createdAt;
        } else if (basis === 'invoice') {
            dateVal = job.invoice?.date || job.invoice?.invoiceDate || job.createdAt;
        }

        if (!dateVal) return 0;
        let dateObj = new Date(dateVal);
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            dateObj = new Date(dateVal.replace(/-/g, '/'));
        }
        return Math.floor((nowMs - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Extract unique customers with unpaid invoices
    const customerOptions = useMemo(() => {
        const custMap = new Map<string, { id: string; name: string; unpaidTotal: number; count: number }>();
        
        jobs.forEach(j => {
            if (!j.invoice) return;
            const status = j.invoice.status;
            if (status === 'Paid' || status === 'Cancelled' || status === 'Void') return;
            const due = getJobDue(j);
            if (due <= 0) return;

            const { customerName, customerId } = getJobEntities(j);
            const key = customerId || customerName;
            
            if (!custMap.has(key)) {
                custMap.set(key, { id: key, name: customerName, unpaidTotal: 0, count: 0 });
            }
            const item = custMap.get(key)!;
            item.unpaidTotal += due;
            item.count += 1;
        });

        return Array.from(custMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [jobs]);

    // Process Aging Data and Buckets
    const agingData = useMemo(() => {
        const unpaidJobs = jobs.filter(j => {
            if (!j.invoice) return false;
            const status = j.invoice.status;
            if (status === 'Paid' || status === 'Cancelled' || status === 'Void') return false;
            return getJobDue(j) > 0;
        });

        const nowMs = new Date().getTime();

        const filteredByCustomer = unpaidJobs.filter(job => {
            if (selectedCustomerId === 'all') return true;
            const { customerId, customerName } = getJobEntities(job);
            return (customerId === selectedCustomerId) || (customerName === selectedCustomerId);
        });

        const buckets = {
            current: [] as any[], // 0 - 30 days
            days30: [] as any[],  // 31 - 60 days
            days60: [] as any[],  // 61 - 90 days
            older: [] as any[],   // 90+ days
            over45: [] as any[],  // > 45 days
            all: [] as any[]
        };

        filteredByCustomer.forEach(job => {
            const days = getJobDaysElapsed(job, agingBasis, nowMs);
            job._agingDays = days; // transient cache
            
            buckets.all.push(job);

            if (days > 45) {
                buckets.over45.push(job);
            }

            if (days <= 30) buckets.current.push(job);
            else if (days <= 60) buckets.days30.push(job);
            else if (days <= 90) buckets.days60.push(job);
            else buckets.older.push(job);
        });

        // Sort all buckets by days descending
        Object.keys(buckets).forEach(k => {
            (buckets as any)[k].sort((a: any, b: any) => (b._agingDays || 0) - (a._agingDays || 0));
        });

        const totals = {
            all: buckets.all.reduce((sum, j) => sum + getJobDue(j), 0),
            current: buckets.current.reduce((sum, j) => sum + getJobDue(j), 0),
            days30: buckets.days30.reduce((sum, j) => sum + getJobDue(j), 0),
            days60: buckets.days60.reduce((sum, j) => sum + getJobDue(j), 0),
            older: buckets.older.reduce((sum, j) => sum + getJobDue(j), 0),
            over45: buckets.over45.reduce((sum, j) => sum + getJobDue(j), 0),
        };

        return { buckets, totals };
    }, [jobs, selectedCustomerId, agingBasis]);

    // Active displayed jobs based on selected filter and search query
    const displayedJobs = useMemo(() => {
        let list: any[] = [];
        if (selectedFilter === 'all') list = agingData.buckets.all;
        else if (selectedFilter === 'over45') list = agingData.buckets.over45;
        else if (selectedFilter === 'current') list = agingData.buckets.current;
        else if (selectedFilter === 'days30') list = agingData.buckets.days30;
        else if (selectedFilter === 'days60') list = agingData.buckets.days60;
        else if (selectedFilter === 'older') list = agingData.buckets.older;

        if (!searchQuery.trim()) return list;

        const q = searchQuery.trim().toLowerCase();
        return list.filter(job => {
            const { customerName, locationName, locationAddress, poNumber } = getJobEntities(job);
            const invId = job.invoice?.id || '';
            return customerName.toLowerCase().includes(q) ||
                   (locationName && locationName.toLowerCase().includes(q)) ||
                   (locationAddress && locationAddress.toLowerCase().includes(q)) ||
                   poNumber.toLowerCase().includes(q) ||
                   invId.toLowerCase().includes(q);
        });
    }, [agingData, selectedFilter, searchQuery]);

    // Export to CSV
    const handleExportCSV = () => {
        const rows = [
            ['Customer', 'Service Site / Location', 'PO / Work Order #', 'Invoice #', 'Visit / Service Date', 'Days Elapsed', 'Original Amount', 'Amount Paid', 'Balance Due', 'Status', 'Sent Date', 'Delivery Status', 'Reminders Sent']
        ];

        displayedJobs.forEach(job => {
            const { customerName, locationName, locationAddress, poNumber } = getJobEntities(job);
            const total = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
            const paid = Number(job.invoice.amountPaid) || 0;
            const outstanding = getJobDue(job);
            const days = job._agingDays || 0;
            const visitDate = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : 'N/A';
            const loc = locationName ? `${locationName}${locationAddress ? ` (${locationAddress})` : ''}` : (locationAddress || '');
            const sentTime = job.invoice?.sentAt || job.invoiceSentAt || job.invoice?.emailSentAt;
            const sentDateStr = sentTime ? new Date(sentTime).toLocaleString() : 'Not Sent';
            const deliveryStatus = (job.invoice?.opened || job.invoice?.status === 'Opened') ? 'Opened' : (sentTime ? 'Unopened' : 'Draft');
            const reminders = (job.invoice.remindersSent || []).join('; ');

            rows.push([
                `"${customerName.replace(/"/g, '""')}"`,
                `"${loc.replace(/"/g, '""')}"`,
                `"${poNumber.replace(/"/g, '""')}"`,
                `"${(job.invoice.id || '').replace(/"/g, '""')}"`,
                `"${visitDate}"`,
                days.toString(),
                total.toFixed(2),
                paid.toFixed(2),
                outstanding.toFixed(2),
                `"${job.invoice.status || 'Unpaid'}"`,
                `"${sentDateStr}"`,
                `"${deliveryStatus}"`,
                `"${reminders.replace(/"/g, '""')}"`
            ]);
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        const custSlug = selectedCustomerId === 'all' ? 'All_Customers' : selectedCustomerId.replace(/[^a-zA-Z0-9]/g, '_');
        link.setAttribute('download', `AR_Aging_Report_${custSlug}_${selectedFilter}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("A/R Aging Report CSV exported successfully."));
    };

    // Print / PDF View
    const handlePrintReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast.error("Please allow popups to print the report.");
            return;
        }

        const orgName = state.currentOrganization?.name || 'TekAir Inc.';
        const orgAddress = formatAddress(state.currentOrganization?.address) || '';
        const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const custLabel = selectedCustomerId === 'all' ? 'All Customers' : (customerOptions.find(c => c.id === selectedCustomerId)?.name || selectedCustomerId);
        const basisLabel = agingBasis === 'visit' ? 'Visit / Service Date' : (agingBasis === 'due' ? 'Invoice Due Date' : 'Invoice Date');
        const filterLabel = selectedFilter === 'over45' ? 'Over 45 Days' : (selectedFilter === 'all' ? 'All Aging' : selectedFilter.toUpperCase());

        let rowsHtml = '';
        let totalSum = 0;
        let origSum = 0;
        let paidSum = 0;

        displayedJobs.forEach((job, idx) => {
            const { customerName, locationName, locationAddress, poNumber } = getJobEntities(job);
            const total = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
            const paid = Number(job.invoice.amountPaid) || 0;
            const due = getJobDue(job);
            const days = job._agingDays || 0;
            const visitDate = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : 'N/A';
            const loc = locationName ? `${locationName}${locationAddress ? ` - ${locationAddress}` : ''}` : (locationAddress || '-');

            origSum += total;
            paidSum += paid;
            totalSum += due;

            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 8px 6px;"><strong>${customerName}</strong><br/><span style="color: #64748b; font-size: 10px;">${loc}</span></td>
                    <td style="padding: 8px 6px; font-weight: bold; color: #1e293b;">${poNumber || '-'}</td>
                    <td style="padding: 8px 6px; font-family: monospace;">${job.invoice?.id || '-'}</td>
                    <td style="padding: 8px 6px;">${visitDate}</td>
                    <td style="padding: 8px 6px; text-align: center; font-weight: bold; color: ${days > 45 ? '#dc2626' : '#b45309'};">${days} Days</td>
                    <td style="padding: 8px 6px; text-align: right;">$${total.toFixed(2)}</td>
                    <td style="padding: 8px 6px; text-align: right; color: #16a34a;">$${paid.toFixed(2)}</td>
                    <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #dc2626;">$${due.toFixed(2)}</td>
                </tr>
            `;
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>A/R Aging Report - ${custLabel}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; margin: 0; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
                    .title { font-size: 20px; font-weight: bold; color: #0f172a; }
                    .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
                    .summary-grid { display: flex; gap: 12px; margin-bottom: 16px; }
                    .summary-card { flex: 1; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; background: #f8fafc; text-align: center; }
                    .summary-card .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; }
                    .summary-card .val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 8px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .totals-row td { font-weight: bold; border-top: 2px solid #0f172a; padding: 10px 6px; background: #f1f5f9; }
                    @media print { body { padding: 0; } button { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">A/R Aging & Overdue Receivables Report</div>
                        <div class="meta"><strong>${orgName}</strong> &bull; ${orgAddress}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; font-weight: bold; color: #0284c7;">Filter: ${custLabel} &bull; ${filterLabel}</div>
                        <div class="meta">Aging Basis: <strong>${basisLabel}</strong> &bull; Generated: ${nowStr}</div>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="label">Total Invoices</div>
                        <div class="val">${displayedJobs.length}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">Original Billed</div>
                        <div class="val">$${origSum.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">Total Paid</div>
                        <div class="val" style="color: #16a34a;">$${paidSum.toFixed(2)}</div>
                    </div>
                    <div class="summary-card" style="border-color: #fca5a5; background: #fef2f2;">
                        <div class="label" style="color: #dc2626;">Total Outstanding Balance</div>
                        <div class="val" style="color: #dc2626; font-size: 16px;">$${totalSum.toFixed(2)}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Customer / Site</th>
                            <th>PO / WO #</th>
                            <th>Invoice #</th>
                            <th>Visit Date</th>
                            <th style="text-align: center;">Age</th>
                            <th style="text-align: right;">Original</th>
                            <th style="text-align: right;">Paid</th>
                            <th style="text-align: right;">Balance Due</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="totals-row">
                            <td colspan="5">TOTALS (${displayedJobs.length} Invoices)</td>
                            <td style="text-align: right;">$${origSum.toFixed(2)}</td>
                            <td style="text-align: right; color: #16a34a;">$${paidSum.toFixed(2)}</td>
                            <td style="text-align: right; color: #dc2626;">$${totalSum.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Card className="space-y-6">
            {/* Header Title & Top Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{t("A/R Aging & Overdue Receivables")}</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {displayedJobs.length} {t("Invoices")}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t("Track unpaid customer receivables, analyze overdue balances since service date, and dispatch payment reminders.")}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
                    <Button 
                        variant="secondary"
                        onClick={handleExportCSV}
                        className="text-xs font-bold flex items-center gap-1.5 shadow-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title={t("Export filtered data to CSV")}
                    >
                        <Download size={14} />
                        {t("Export CSV")}
                    </Button>
                    <Button 
                        variant="secondary"
                        onClick={handlePrintReport}
                        className="text-xs font-bold flex items-center gap-1.5 shadow-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title={t("Print or Save PDF report")}
                    >
                        <Printer size={14} />
                        {t("Print / PDF")}
                    </Button>
                    <Button 
                        variant="primary"
                        onClick={() => setIsLogPaymentModalOpen(true)} 
                        className="text-xs !bg-teal-600 hover:!bg-teal-700 !text-white font-bold flex items-center gap-1.5 shadow-sm border-0"
                    >
                        <DollarSign size={14} />
                        {t("Log Received Payment")}
                    </Button>
                </div>
            </div>

            {/* Filter Bar (Customer Filter, Aging Basis, Search) */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    {/* Customer Selector */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Filter size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("Customer")}:</span>
                        <select 
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[200px]"
                        >
                            <option value="all">{t("All Customers")} ({agingData.buckets.all.length})</option>
                            {customerOptions.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} (${c.unpaidTotal.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Aging Basis Selector */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("Aging Basis")}:</span>
                        <select 
                            value={agingBasis}
                            onChange={(e) => setAgingBasis(e.target.value as AgingBasis)}
                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="visit">{t("Visit / Service Date")}</option>
                            <option value="due">{t("Invoice Due Date")}</option>
                            <option value="invoice">{t("Invoice Creation Date")}</option>
                        </select>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("Search PO #, Inv #, Site...")}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 shadow-sm"
                    />
                </div>
            </div>
            
            {/* Aging Summary Metric Cards with Clickable Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Over 45 Days Dedicated Card */}
                <button
                    onClick={() => setSelectedFilter(selectedFilter === 'over45' ? 'all' : 'over45')}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        selectedFilter === 'over45' 
                            ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500 ring-offset-1' 
                            : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 hover:border-rose-400'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${selectedFilter === 'over45' ? 'text-rose-100' : 'text-rose-600 dark:text-rose-400'}`}>
                            &gt; 45 Days (Overdue)
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'over45' ? 'bg-white/20 text-white' : 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200'}`}>
                            {agingData.buckets.over45.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'over45' ? 'text-white' : 'text-rose-700 dark:text-rose-400'}`}>
                        {fmt(agingData.totals.over45)}
                    </div>
                </button>

                {/* Current 0-30 */}
                <button
                    onClick={() => setSelectedFilter(selectedFilter === 'current' ? 'all' : 'current')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedFilter === 'current' 
                            ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-700' 
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFilter === 'current' ? 'text-slate-200' : 'text-slate-500'}`}>
                            0 - 30 Days
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'current' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                            {agingData.buckets.current.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'current' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {fmt(agingData.totals.current)}
                    </div>
                </button>

                {/* 31-60 Days */}
                <button
                    onClick={() => setSelectedFilter(selectedFilter === 'days30' ? 'all' : 'days30')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedFilter === 'days30' 
                            ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500' 
                            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 hover:border-amber-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFilter === 'days30' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                            31 - 60 Days
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'days30' ? 'bg-white/20 text-white' : 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'}`}>
                            {agingData.buckets.days30.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'days30' ? 'text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                        {fmt(agingData.totals.days30)}
                    </div>
                </button>

                {/* 61-90 Days */}
                <button
                    onClick={() => setSelectedFilter(selectedFilter === 'days60' ? 'all' : 'days60')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedFilter === 'days60' 
                            ? 'bg-orange-600 text-white border-orange-700 shadow-md ring-2 ring-orange-500' 
                            : 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 hover:border-orange-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFilter === 'days60' ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'}`}>
                            61 - 90 Days
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'days60' ? 'bg-white/20 text-white' : 'bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200'}`}>
                            {agingData.buckets.days60.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'days60' ? 'text-white' : 'text-orange-700 dark:text-orange-400'}`}>
                        {fmt(agingData.totals.days60)}
                    </div>
                </button>

                {/* 90+ Days */}
                <button
                    onClick={() => setSelectedFilter(selectedFilter === 'older' ? 'all' : 'older')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedFilter === 'older' 
                            ? 'bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-600' 
                            : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 hover:border-red-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFilter === 'older' ? 'text-red-100' : 'text-red-600 dark:text-red-400'}`}>
                            90+ Days
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'older' ? 'bg-white/20 text-white' : 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                            {agingData.buckets.older.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'older' ? 'text-white' : 'text-red-700 dark:text-red-400'}`}>
                        {fmt(agingData.totals.older)}
                    </div>
                </button>

                {/* Total Unpaid */}
                <button
                    onClick={() => setSelectedFilter('all')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedFilter === 'all' 
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600' 
                            : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFilter === 'all' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {t("Total Receivables")}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedFilter === 'all' ? 'bg-white/20 text-white' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'}`}>
                            {agingData.buckets.all.length}
                        </span>
                    </div>
                    <div className={`text-lg font-black mt-1 ${selectedFilter === 'all' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {fmt(agingData.totals.all)}
                    </div>
                </button>
            </div>

            {/* Filter Pill Status & Table */}
            <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("Showing")}:</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {selectedFilter === 'all' ? t("All Aging Invoices") :
                         selectedFilter === 'over45' ? t("Over 45 Days Overdue") :
                         selectedFilter === 'current' ? t("0 - 30 Days (Current)") :
                         selectedFilter === 'days30' ? t("31 - 60 Days") :
                         selectedFilter === 'days60' ? t("61 - 90 Days") : t("90+ Days")}
                    </span>
                    {selectedCustomerId !== 'all' && (
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                            {customerOptions.find(c => c.id === selectedCustomerId)?.name || selectedCustomerId}
                        </span>
                    )}
                </div>
                {selectedFilter !== 'all' && (
                    <button 
                        onClick={() => setSelectedFilter('all')}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                    >
                        <RefreshCw size={11} />
                        {t("Reset Filter")}
                    </button>
                )}
            </div>

            {displayedJobs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{t("No invoices match the selected aging criteria.")}</p>
                    <p className="text-xs text-slate-400 mt-1">{t("Try resetting filters or adjusting search parameters.")}</p>
                </div>
            ) : (
                <Table headers={[t('Customer / Service Site'), t('PO / WO #'), t('Invoice #'), t('Visit / Service Date'), t('Age (Days)'), t('Amount / Balance Due'), t('Sent & Tracking'), t('Actions')]}>
                    {displayedJobs.map((job: any) => {
                        const total = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || Number(job.invoice.grandTotal) || 0;
                        const paid = Number(job.invoice.amountPaid) || (job.invoice.payments ? job.invoice.payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) : 0) || Number(job.depositPaid ? job.depositAmount : 0) || 0;
                        const outstanding = getJobDue(job);
                        const days = job._agingDays || getJobDaysElapsed(job, agingBasis, new Date().getTime());
                        const { customerName, locationName, locationAddress, poNumber } = getJobEntities(job);
                        
                        return (
                            <tr key={job.id} className="bg-white dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{customerName}</div>
                                    {(locationName || locationAddress) && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                                            <span className="text-slate-400 text-[10px]">📍</span>
                                            <span>
                                                {locationName && <strong className="font-semibold text-slate-700 dark:text-slate-300">{locationName}</strong>}
                                                {locationName && locationAddress && <span className="text-slate-400"> — </span>}
                                                {locationAddress && <span className="text-slate-500">{locationAddress}</span>}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    {poNumber ? (
                                        <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                                            {poNumber}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">-</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">{job.invoice.id}</td>
                                <td className="px-3 py-3 text-sm text-slate-500 dark:text-gray-400">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                        {job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : (job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'N/A')}
                                    </div>
                                    {job.invoice.sentAt ? (
                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            {t("Sent")}: {new Date(job.invoice.sentAt).toLocaleDateString()}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">{t("Not Sent")}</div>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-500 dark:text-gray-400">
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-black inline-flex items-center gap-1 ${
                                        days > 45 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                        days > 30 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                    }`}>
                                        {days} {t("Days")}
                                    </span>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <span>{fmt(outstanding)}</span>
                                            {paid > 0 && (
                                                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                                                    {t("Due")}
                                                </span>
                                            )}
                                        </div>
                                        {paid > 0 ? (
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                                <span className="text-slate-500 dark:text-slate-400 font-medium" title={t("Original Amount")}>
                                                    {t("Orig")}: {fmt(total)}
                                                </span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title={t("Payments / Deposits Made")}>
                                                    (-{fmt(paid)} {t("paid")})
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                {t("Total")}: {fmt(total)}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
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
                                            <div className="flex flex-col gap-1 items-start max-w-[150px]">
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
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                                        <button 
                                            onClick={() => setViewingInvoiceJob(job)}
                                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-md transition-all shadow-2xs active:scale-90 cursor-pointer"
                                            title={t("View Invoice")}
                                            aria-label={t("View Invoice")}
                                        >
                                            <Eye size={13} />
                                        </button>
                                        <button 
                                            onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })}
                                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-md transition-all shadow-2xs active:scale-90 cursor-pointer"
                                            title={t("Email Invoice")}
                                            aria-label={t("Email Invoice")}
                                        >
                                            <Send size={13} />
                                        </button>
                                        <button 
                                            onClick={() => setSmsModalJob(job)}
                                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-md transition-all shadow-2xs active:scale-90 cursor-pointer"
                                            title={t("Send via SMS")}
                                            aria-label={t("Send via SMS")}
                                        >
                                            <MessageSquare size={13} />
                                        </button>
                                        <button 
                                            onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })}
                                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-md transition-all shadow-2xs active:scale-90 cursor-pointer"
                                            title={t("Send Payment Reminder")}
                                            aria-label={t("Send Payment Reminder")}
                                        >
                                            <Bell size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            )}

            {/* Invoice Viewer Modal */}
            {viewingInvoiceJob && (
                <DocumentPreview
                    type="Invoice"
                    data={viewingInvoiceJob}
                    organization={state.currentOrganization}
                    onClose={() => setViewingInvoiceJob(null)}
                    isInternal={true}
                />
            )}

            {/* Send Invoice Email Modal */}
            {sendInvoiceModalConfig.isOpen && sendInvoiceModalConfig.job && (
                <SendEmailModal
                    isOpen={sendInvoiceModalConfig.isOpen}
                    onClose={() => setSendInvoiceModalConfig({ isOpen: false, job: null })}
                    job={sendInvoiceModalConfig.job}
                    invoice={sendInvoiceModalConfig.job.invoice}
                    mode="invoice"
                />
            )}

            {/* Recipient Selector Modal */}
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

            {/* Log Received Payment Modal */}
            {isLogPaymentModalOpen && (
                <LogReceivedPaymentModal
                    isOpen={isLogPaymentModalOpen}
                    onClose={() => setIsLogPaymentModalOpen(false)}
                    jobs={jobs || state.jobs}
                />
            )}
        </Card>
    );
};

export default AgingReportTab;

