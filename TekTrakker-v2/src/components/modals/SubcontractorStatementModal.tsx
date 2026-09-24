import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import showToast from '../../lib/toast';
import { globalConfirm } from '../../lib/globalConfirm';
import { sendEmail } from '../../lib/notificationService';
import {
    generateSubcontractorStatementHtml,
    generateSubcontractorStatementNumber,
    formatChargebackCategory,
    StatementItemJob
} from '../../lib/chargebackHelper';
import { generateSubcontractorStatementPdfAttachment, EmailAttachment } from '../../lib/pdfHelper';
import SubcontractorChargebackModal from './SubcontractorChargebackModal';
import {
    AlertTriangle,
    Building2,
    Calendar,
    Camera,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Download,
    ExternalLink,
    FileText,
    Mail,
    Plus,
    Printer,
    Receipt,
    RefreshCw,
    Send,
    ShieldAlert,
    Trash2,
    User,
    Wrench,
    X,
    Loader2
} from 'lucide-react';
import type { Subcontractor, SubcontractorChargeback, Job } from '../../types';
import type { PayableRecord } from '../../lib/payablesHelper';

interface SubcontractorStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: Subcontractor;
}

export const SubcontractorStatementModal: React.FC<SubcontractorStatementModalProps> = ({
    isOpen,
    onClose,
    subcontractor
}) => {
    const { state, dispatch } = useAppContext();
    const activeOrg = state.currentOrganization;

    // Real-time Data
    const [chargebacks, setChargebacks] = useState<SubcontractorChargeback[]>([]);
    const [dbPayables, setDbPayables] = useState<PayableRecord[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Filters & Selections
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'this_month' | 'last_month' | 'last_90_days' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [unpaidOnly, setUnpaidOnly] = useState(false);

    // Selected items for statement inclusion (defaults to all)
    const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
    const [selectedChargebackIds, setSelectedChargebackIds] = useState<Set<string>>(new Set());

    // Statement Metadata & Remittance
    const [statementNumber, setStatementNumber] = useState('');
    const [statementDate, setStatementDate] = useState(new Date().toLocaleDateString());
    const [notes, setNotes] = useState('');
    const [paymentInstructions, setPaymentInstructions] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Direct Deposit / ACH');

    // Actions & Dispatch states
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailCustomMessage, setEmailCustomMessage] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSettling, setIsSettling] = useState(false);

    // Chargeback Modal State
    const [isAddChargebackOpen, setIsAddChargebackOpen] = useState(false);
    const [chargebackToEdit, setChargebackToEdit] = useState<SubcontractorChargeback | null>(null);

    // Lightbox for photos
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    // Subscribe to Chargebacks & Payables for this subcontractor
    useEffect(() => {
        if (!isOpen || !subcontractor?.id || !activeOrg?.id) return;

        setLoadingData(true);
        setStatementNumber(generateSubcontractorStatementNumber(subcontractor.id));
        setEmailRecipient(subcontractor.email || '');

        // Prefill payment method from subcontractor direct deposit / banking if available
        const dd = (subcontractor as any)?.directDeposit;
        if (dd?.bankName && dd?.accountNumber) {
            const last4 = String(dd.accountNumber).slice(-4);
            setPaymentMethod(`Direct Deposit / ACH - ${dd.bankName} (Ending in ...${last4})`);
        } else {
            setPaymentMethod('Direct Deposit / ACH');
        }

        // 1. Fetch Chargebacks
        const unsubChargebacks = db.collection('subcontractor_chargebacks')
            .where('organizationId', '==', activeOrg.id)
            .where('subcontractorId', '==', subcontractor.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubcontractorChargeback));
                list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
                setChargebacks(list);
            }, err => {
                console.error("Error loading subcontractor chargebacks:", err);
            });

        // 2. Fetch Payables
        const unsubPayables = db.collection('payables')
            .where('organizationId', '==', activeOrg.id)
            .where('subcontractorId', '==', subcontractor.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PayableRecord));
                setDbPayables(list);
                setLoadingData(false);
            }, err => {
                console.error("Error loading payables for statement:", err);
                setLoadingData(false);
            });

        return () => {
            unsubChargebacks();
            unsubPayables();
        };
    }, [isOpen, subcontractor?.id, activeOrg?.id]);

    // Assigned / Completed Jobs for this Subcontractor
    const assignedJobs = useMemo(() => {
        if (!subcontractor || !activeOrg?.id) return [];
        const subId = subcontractor.id;
        const subEmail = (subcontractor.email || '').toLowerCase().trim();
        const subCompany = (subcontractor.companyName || (subcontractor as any).name || '').toLowerCase().trim();
        const subContact = (subcontractor.contactName || '').toLowerCase().trim();
        const linkedOrgId = subcontractor.linkedOrgId;
        const linkedUserId = (subcontractor as any).userId || (subcontractor as any).linkedUserId || (subcontractor as any).employeeId;

        const nameTokens = Array.from(new Set([
            ...subCompany.split(/\s+/),
            ...subContact.split(/\s+/)
        ])).filter(w => w.length > 1 && !['llc', 'inc', 'corp', 'co', 'services', 'hvac'].includes(w));

        const matchesNameTokens = (text?: string | null) => {
            if (!text || nameTokens.length === 0) return false;
            const normalizedText = text.toLowerCase().trim();
            return nameTokens.every(token => normalizedText.includes(token));
        };

        return (state.jobs || []).filter(job => {
            if (job.organizationId !== activeOrg.id) return false;
            const isJobCancelled = (job.jobStatus || (job as any).status || '').toLowerCase().includes('cancel') || (job as any).isCancelled === true;
            if (isJobCancelled) return false;
            const isDirectSub = job.subcontractorId === subId;
            const isAssignedPartner = job.assignedPartnerId === subId || (linkedOrgId && job.assignedPartnerId === linkedOrgId);
            const isAssignedTech = job.assignedTechnicianId === subId || (linkedUserId && job.assignedTechnicianId === linkedUserId);
            const isAssignedTechs = ((job as any).assignedTechnicians || []).includes(subId) || (linkedUserId && ((job as any).assignedTechnicians || []).includes(linkedUserId));
            const isWOSubId = job.subcontractorWorkOrder?.subcontractorId === subId;
            const isWOSubName = matchesNameTokens((job.subcontractorWorkOrder as any)?.subcontractorName);
            const isTechNameMatch = matchesNameTokens(job.assignedTechnicianName) || matchesNameTokens((job as any).subcontractorName);

            const techUser = state.users.find(u => u.id === job.assignedTechnicianId || (linkedUserId && u.id === linkedUserId));
            const isEmailMatch = subEmail && (
                (techUser?.email && techUser.email.toLowerCase().trim() === subEmail) ||
                ((job as any).subcontractorEmail && (job as any).subcontractorEmail.toLowerCase().trim() === subEmail) ||
                ((job as any).assignedTechnicianEmail && (job as any).assignedTechnicianEmail.toLowerCase().trim() === subEmail)
            );

            return isDirectSub || isAssignedPartner || isAssignedTech || isAssignedTechs || isWOSubId || isWOSubName || isTechNameMatch || isEmailMatch;
        }).sort((a, b) => new Date(b.createdAt || b.appointmentTime || 0).getTime() - new Date(a.createdAt || a.appointmentTime || 0).getTime());
    }, [state.jobs, subcontractor, activeOrg?.id, state.users]);

    // Build linked job chains across all jobs in organization
    const jobChainMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        const orgJobs = (state.jobs || []).filter(j => j.organizationId === activeOrg?.id);
        orgJobs.forEach(j => {
            const chain = new Set<string>([j.id]);
            if (j.parentJobId) chain.add(j.parentJobId);
            if (Array.isArray(j.linkedJobIds)) j.linkedJobIds.forEach(id => chain.add(id));

            const po = j.poNumber || j.workOrderNumber || j.invoice?.poNumber;
            if (po && po.trim().length > 1) {
                const cleanPo = po.replace(/^[#\s]+/, '').trim().toLowerCase();
                if (cleanPo.length > 1) {
                    orgJobs.forEach(otherJob => {
                        if (otherJob.id !== j.id) {
                            const otherPo = otherJob.poNumber || otherJob.workOrderNumber || otherJob.invoice?.poNumber;
                            if (otherPo) {
                                const cleanOtherPo = otherPo.replace(/^[#\s]+/, '').trim().toLowerCase();
                                if (cleanOtherPo === cleanPo) {
                                    chain.add(otherJob.id);
                                }
                            }
                        }
                    });
                }
            }
            chain.forEach(id => map.set(id, chain));
        });

        orgJobs.forEach(j => {
            const chain = map.get(j.id);
            if (chain) {
                chain.forEach(id => {
                    const subChain = map.get(id);
                    if (subChain && subChain !== chain) {
                        subChain.forEach(x => chain.add(x));
                        map.set(id, chain);
                    }
                });
            }
        });

        return map;
    }, [state.jobs, activeOrg?.id]);

    // Build Statement Items (Jobs) with linked-job / follow-up deduplication
    const statementJobs: StatementItemJob[] = useMemo(() => {
        const processedChains = new Set<string>();
        const items: StatementItemJob[] = [];

        assignedJobs.forEach(job => {
            const chain = jobChainMap.get(job.id) || new Set([job.id]);
            const chainKey = Array.from(chain).sort().join('|');

            if (processedChains.has(chainKey)) return;
            processedChains.add(chainKey);

            // Find all assigned jobs in this chain
            const chainAssignedJobs = assignedJobs.filter(j => chain.has(j.id));

            // Find existing payable for ANY job in this chain (favoring 'Paid' if present)
            const chainPayables = dbPayables.filter(p => chainAssignedJobs.some(cj => cj.id === p.jobId));
            const existingPayable: PayableRecord | undefined = chainPayables.find(p => p.status === 'Paid') || chainPayables[0];

            // Select primary job (favoring invoice, bill, payable match, payout amount, or most recent)
            const primaryJob = chainAssignedJobs.find(x => 
                (x.invoice && ((x.invoice.totalAmount && x.invoice.totalAmount > 0) || (x.invoice.amount && x.invoice.amount > 0) || x.invoice.invoiceNumber)) ||
                (x as any).subcontractorBill ||
                dbPayables.some(p => p.jobId === x.id && p.amount > 0) ||
                ((x as any).partnerPayoutAmount && (x as any).partnerPayoutAmount > 0) ||
                ((x as any).subcontractorPayRate && (x as any).subcontractorPayRate > 0)
            ) || chainAssignedJobs.find(x => dbPayables.some(p => p.jobId === x.id))
              || chainAssignedJobs[0] || job;

            let payoutAmount = 0;
            let status: 'Paid' | 'Unpaid' = 'Unpaid';
            let paidAt: string | undefined = undefined;

            if (existingPayable) {
                payoutAmount = existingPayable.amount;
                status = existingPayable.status;
                paidAt = existingPayable.paidAt;
            } else {
                const subBill = (primaryJob as any).subcontractorBill;
                const subWO = primaryJob.subcontractorWorkOrder as any;
                if (typeof (primaryJob as any).partnerPayoutAmount === 'number' && (primaryJob as any).partnerPayoutAmount > 0) {
                    payoutAmount = (primaryJob as any).partnerPayoutAmount;
                } else if (typeof (primaryJob as any).subcontractorPayRate === 'number' && (primaryJob as any).subcontractorPayRate > 0) {
                    payoutAmount = (primaryJob as any).subcontractorPayRate;
                } else if (subBill?.subtotal && subBill.subtotal > 0) {
                    payoutAmount = subBill.subtotal;
                } else if (subWO?.agreedAmount && subWO.agreedAmount > 0) {
                    payoutAmount = subWO.agreedAmount;
                } else if (subWO?.nte && subWO.nte > 0) {
                    payoutAmount = subWO.nte;
                } else {
                    const invTotal = primaryJob.invoice?.totalAmount || primaryJob.invoice?.amount || 0;
                    const pct = subcontractor.paymentPercentage ?? subWO?.paymentPercentage;
                    payoutAmount = pct ? (invTotal * pct) / 100 : invTotal;
                }
            }

            const hasInvoiceOrBill = !!(
                (primaryJob.invoice && ((primaryJob.invoice.totalAmount && primaryJob.invoice.totalAmount > 0) || (primaryJob.invoice.amount && primaryJob.invoice.amount > 0) || primaryJob.invoice.invoiceNumber)) ||
                (primaryJob as any).subcontractorBill ||
                existingPayable
            );

            // Omit unbilled / $0 companion visits from statement if there is no invoice, bill, or payable attached
            if (payoutAmount <= 0 && !hasInvoiceOrBill) {
                return;
            }

            // If payout is $0 or existing payable is paid or any chain payable is paid, mark Settled/Paid
            const isChainPaid = existingPayable?.status === 'Paid' || chainPayables.some(p => p.status === 'Paid');
            if (isChainPaid || payoutAmount === 0) {
                status = 'Paid';
            }

            const woNum = primaryJob.workOrderNumber || (primaryJob.subcontractorWorkOrder as any)?.workOrderNumber || primaryJob.poNumber || primaryJob.id.slice(0, 8).toUpperCase();
            const serviceLoc = typeof primaryJob.address === 'string' ? primaryJob.address : (primaryJob.address ? `${(primaryJob.address as any).street || ''}, ${(primaryJob.address as any).city || ''}` : '');

            // Trade & Scope of work extraction (respects Electrical / Electrician division)
            const subTrade = subcontractor.trade || (primaryJob as any).division || (primaryJob as any).trade || 'Electrical';
            let jobScopeDesc = '';
            if (primaryJob.notes?.work && typeof primaryJob.notes.work === 'string' && primaryJob.notes.work.trim()) {
                jobScopeDesc = primaryJob.notes.work.trim();
            } else if (primaryJob.notes?.preRepair && typeof primaryJob.notes.preRepair === 'string' && primaryJob.notes.preRepair.trim()) {
                jobScopeDesc = primaryJob.notes.preRepair.trim();
            } else if (primaryJob.notes?.diagnosis && typeof primaryJob.notes.diagnosis === 'string' && primaryJob.notes.diagnosis.trim()) {
                jobScopeDesc = primaryJob.notes.diagnosis.trim();
            } else {
                const rawIssue = (primaryJob.subcontractorWorkOrder as any)?.reportedIssue || (primaryJob as any).reportedIssue;
                if (rawIssue && typeof rawIssue === 'string') {
                    const lines = rawIssue
                        .replace(/^QUOTE APPROVAL:\s*/i, '')
                        .split('\n')
                        .map(s => s.replace(/^[-•*]\s*/, '').trim())
                        .filter(s => s.length > 5 && !s.toLowerCase().startsWith('technicians on site') && !s.toLowerCase().startsWith('check in'));
                    if (lines.length > 0) {
                        jobScopeDesc = lines[0].length > 100 ? lines[0].slice(0, 97) + '...' : lines[0];
                    }
                }
            }

            if (!jobScopeDesc) {
                const rawServiceType = (primaryJob as any).serviceType || (primaryJob as any).title;
                const isElectrician = subTrade.toLowerCase().includes('electr');
                if (rawServiceType && (!isElectrician || !rawServiceType.toLowerCase().includes('hvac'))) {
                    jobScopeDesc = rawServiceType;
                } else {
                    jobScopeDesc = `${subTrade} Service & Field Labor`;
                }
            }

            items.push({
                job: primaryJob,
                workOrderNumber: woNum,
                customerName: primaryJob.customerName || 'Customer Job',
                serviceLocation: serviceLoc,
                date: (primaryJob as any).endTime || primaryJob.appointmentTime || primaryJob.createdAt || '',
                description: jobScopeDesc,
                orgNTE: Number((primaryJob as any).clientNTE || (primaryJob as any).orgNTE || primaryJob.invoice?.totalAmount || 0),
                subNTE: Number(primaryJob.subcontractorWorkOrder?.nte || (primaryJob.subcontractorWorkOrder as any)?.agreedAmount || 0),
                payoutAmount: Math.round(payoutAmount * 100) / 100,
                status,
                paidAt
            });
        });

        return items;
    }, [assignedJobs, dbPayables, subcontractor, jobChainMap]);

    // Filter jobs and chargebacks by date range and unpaidOnly
    const filteredJobs = useMemo(() => {
        let list = statementJobs;

        if (unpaidOnly) {
            list = list.filter(j => j.status === 'Unpaid' && j.payoutAmount > 0);
        }

        if (dateRangeFilter === 'this_month') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            list = list.filter(j => new Date(j.date || 0).getTime() >= start);
        } else if (dateRangeFilter === 'last_month') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
            list = list.filter(j => {
                const t = new Date(j.date || 0).getTime();
                return t >= start && t <= end;
            });
        } else if (dateRangeFilter === 'last_90_days') {
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
            list = list.filter(j => new Date(j.date || 0).getTime() >= cutoff);
        } else if (dateRangeFilter === 'custom' && (customStartDate || customEndDate)) {
            const start = customStartDate ? new Date(customStartDate).getTime() : 0;
            const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
            list = list.filter(j => {
                const t = new Date(j.date || 0).getTime();
                return t >= start && t <= end;
            });
        }

        return list;
    }, [statementJobs, unpaidOnly, dateRangeFilter, customStartDate, customEndDate]);

    const filteredChargebacks = useMemo(() => {
        let list = chargebacks;

        if (unpaidOnly) {
            list = list.filter(cb => cb.status === 'Pending' || cb.status === 'Applied');
        }

        if (dateRangeFilter === 'this_month') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            list = list.filter(cb => new Date(cb.date || cb.createdAt || 0).getTime() >= start);
        } else if (dateRangeFilter === 'last_month') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
            list = list.filter(cb => {
                const t = new Date(cb.date || cb.createdAt || 0).getTime();
                return t >= start && t <= end;
            });
        } else if (dateRangeFilter === 'last_90_days') {
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
            list = list.filter(cb => new Date(cb.date || cb.createdAt || 0).getTime() >= cutoff);
        } else if (dateRangeFilter === 'custom' && (customStartDate || customEndDate)) {
            const start = customStartDate ? new Date(customStartDate).getTime() : 0;
            const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
            list = list.filter(cb => {
                const t = new Date(cb.date || cb.createdAt || 0).getTime();
                return t >= start && t <= end;
            });
        }

        return list;
    }, [chargebacks, unpaidOnly, dateRangeFilter, customStartDate, customEndDate]);

    // Auto-select all filtered items on filter change
    useEffect(() => {
        setSelectedJobIds(new Set(filteredJobs.map(j => j.job.id)));
    }, [filteredJobs]);

    useEffect(() => {
        setSelectedChargebackIds(new Set(filteredChargebacks.map(cb => cb.id)));
    }, [filteredChargebacks]);

    const statementPeriodStr = useMemo(() => {
        if (dateRangeFilter === 'this_month') return 'This Month';
        if (dateRangeFilter === 'last_month') return 'Last Month';
        if (dateRangeFilter === 'last_90_days') return 'Last 90 Days';
        if (dateRangeFilter === 'custom' && (customStartDate || customEndDate)) {
            return `${customStartDate || 'Start'} to ${customEndDate || 'Present'}`;
        }
        return 'All Time (Current Balance)';
    }, [dateRangeFilter, customStartDate, customEndDate]);

    // Calculate Active Included Totals
    const includedJobs = useMemo(() => {
        return filteredJobs.filter(j => selectedJobIds.has(j.job.id));
    }, [filteredJobs, selectedJobIds]);

    const includedChargebacks = useMemo(() => {
        return filteredChargebacks.filter(cb => selectedChargebackIds.has(cb.id));
    }, [filteredChargebacks, selectedChargebackIds]);

    const totalGross = useMemo(() => {
        return includedJobs.reduce((sum, j) => sum + j.payoutAmount, 0);
    }, [includedJobs]);

    const totalPaid = useMemo(() => {
        return includedJobs
            .filter(j => j.status === 'Paid' || (j.status as string) === 'Settled')
            .reduce((sum, j) => sum + j.payoutAmount, 0);
    }, [includedJobs]);

    const totalUnpaid = Math.max(0, totalGross - totalPaid);

    const totalDeductions = useMemo(() => {
        return includedChargebacks
            .filter(cb => cb.status === 'Applied' || cb.status === 'Pending')
            .reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
    }, [includedChargebacks]);

    const netPayout = Math.max(0, totalUnpaid - totalDeductions);

    // Toggle Selection Helpers
    const toggleJobSelect = (id: string) => {
        setSelectedJobIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleChargebackSelect = (id: string) => {
        setSelectedChargebackIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Print / PDF Generation
    const handlePrintOrDownloadPdf = async (action: 'print' | 'download') => {
        setIsGeneratingPdf(true);
        try {
            const html = generateSubcontractorStatementHtml({
                organization: activeOrg,
                subcontractor,
                statementNumber,
                statementDate,
                statementPeriod: statementPeriodStr,
                jobs: includedJobs,
                chargebacks: includedChargebacks,
                notes,
                paymentInstructions,
                paymentMethod
            });

            if (action === 'print') {
                const printWin = window.open('', '_blank');
                if (printWin) {
                    printWin.document.write(html);
                    printWin.document.close();
                    printWin.focus();
                    setTimeout(() => {
                        printWin.print();
                    }, 500);
                }
            } else {
                const attachment = await generateSubcontractorStatementPdfAttachment({
                    organization: activeOrg,
                    subcontractor,
                    statementNumber,
                    statementDate,
                    statementPeriod: statementPeriodStr,
                    jobs: includedJobs,
                    chargebacks: includedChargebacks,
                    notes,
                    paymentInstructions,
                    paymentMethod
                });

                if (attachment.content) {
                    const link = document.createElement('a');
                    link.href = `data:application/pdf;base64,${attachment.content}`;
                    link.download = attachment.filename;
                    link.click();
                    showToast.success("Subcontractor Statement PDF downloaded successfully!");
                } else if (attachment.path) {
                    window.open(attachment.path, '_blank');
                    showToast.success("Subcontractor Statement PDF opened!");
                } else {
                    showToast.warn("PDF generation completed.");
                }
            }
        } catch (e: any) {
            console.error("Error generating PDF:", e);
            showToast.error("Failed to generate PDF statement.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Send Statement via Email
    const handleSendEmailStatement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailRecipient.trim()) {
            showToast.warn("Please enter a valid recipient email.");
            return;
        }
        if (!activeOrg) {
            showToast.error("No active organization found.");
            return;
        }

        setIsSendingEmail(true);
        try {
            const subjectText = emailSubject.trim() || `Payment Statement #${statementNumber} - ${activeOrg.name || 'TekAir'}`;
            const subCleanName = subcontractor.companyName || subcontractor.contactName || 'Subcontractor Partner';

            // Generate HTML statement content
            const statementHtml = generateSubcontractorStatementHtml({
                organization: activeOrg,
                subcontractor,
                statementNumber,
                statementDate,
                statementPeriod: statementPeriodStr,
                jobs: includedJobs,
                chargebacks: includedChargebacks,
                notes: emailCustomMessage ? `${emailCustomMessage}\n\n${notes}` : notes,
                paymentInstructions,
                paymentMethod
            });

            // Generate PDF attachment
            let pdfAttachment: EmailAttachment | null = null;
            try {
                pdfAttachment = await generateSubcontractorStatementPdfAttachment({
                    organization: activeOrg,
                    subcontractor,
                    statementNumber,
                    statementDate,
                    statementPeriod: statementPeriodStr,
                    jobs: includedJobs,
                    chargebacks: includedChargebacks,
                    notes: emailCustomMessage ? `${emailCustomMessage}\n\n${notes}` : notes,
                    paymentInstructions,
                    paymentMethod
                });
            } catch (pdfErr) {
                console.warn("Could not generate PDF attachment for email statement, proceeding with HTML body:", pdfErr);
            }

            const mailPayload = {
                to: emailRecipient.trim(),
                senderUser: state.currentUser,
                message: {
                    subject: subjectText,
                    html: statementHtml,
                    text: `Subcontractor Payment Statement #${statementNumber} for ${subCleanName}. Gross: $${totalGross.toFixed(2)}, Deductions: -$${totalDeductions.toFixed(2)}, Net Payout: $${netPayout.toFixed(2)}.`,
                    attachments: pdfAttachment?.content ? [pdfAttachment] : undefined
                },
                type: 'SubcontractorStatement'
            };

            await sendEmail(activeOrg, mailPayload);
            showToast.success(`Payment statement successfully emailed to ${emailRecipient}!`);
            setIsEmailModalOpen(false);
        } catch (err: any) {
            console.error("Error sending statement email:", err);
            showToast.error("Failed to send email statement: " + (err.message || 'Mail service error'));
        } finally {
            setIsSendingEmail(false);
        }
    };

    // One-Click Settle Statement (Marks included payables as Paid, sets chargebacks as Applied, syncs expense)
    const handleSettleStatement = async () => {
        if (!activeOrg) return;
        const unpaidCount = includedJobs.filter(j => j.status === 'Unpaid').length;
        if (unpaidCount === 0 && totalDeductions === 0) {
            showToast.info("All included jobs are already marked as Paid.");
            return;
        }

        const confirmMsg = `Settle this statement for ${subcontractor.companyName || subcontractor.contactName}?\n\n` +
            `• Net Payout Amount: $${netPayout.toFixed(2)}\n` +
            `• Payment Method: ${paymentMethod || 'Company Account'}\n` +
            `• Jobs to Mark Settled: ${unpaidCount}\n` +
            `• Chargebacks to Apply: ${includedChargebacks.length}\n\n` +
            `This will sync a Net Expense record to your P&L and update job payment statuses.`;

        if (!await globalConfirm(confirmMsg)) return;

        setIsSettling(true);
        try {
            const nowStr = new Date().toISOString();
            const subName = subcontractor.companyName || subcontractor.contactName || 'Subcontractor';

            // 1. Settle Payables
            for (const jItem of includedJobs) {
                if (jItem.status === 'Unpaid' && jItem.payoutAmount > 0) {
                    const chain = jobChainMap.get(jItem.job.id) || new Set([jItem.job.id]);
                    const existingPayable = dbPayables.find(p => chain.has(p.jobId));
                    const payableDocId = existingPayable?.id || `payable-${jItem.job.id}`;
                    const payableDoc: PayableRecord = {
                        ...(existingPayable || {}),
                        id: payableDocId,
                        organizationId: activeOrg.id,
                        subcontractorId: subcontractor.id,
                        jobId: existingPayable?.jobId || jItem.job.id,
                        amount: existingPayable?.amount || jItem.payoutAmount,
                        status: 'Paid',
                        createdAt: existingPayable?.createdAt || jItem.date || nowStr,
                        companyName: subName,
                        customerName: jItem.customerName,
                        paidAt: nowStr,
                        paymentMethod: paymentMethod || 'Direct Deposit / ACH',
                        isAutoCalculated: false
                    };
                    await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields(payableDoc), { merge: true });

                    // Auto-complete job if not completed
                    if ((jItem.job.jobStatus || (jItem.job as any).status) !== 'Completed') {
                        const jobUpdates = { jobStatus: 'Completed', status: 'Completed', updatedAt: nowStr };
                        await db.collection('jobs').doc(jItem.job.id).update(cleanUndefinedFields(jobUpdates));
                        dispatch({ type: 'UPDATE_JOB', payload: { ...jItem.job, ...jobUpdates } });
                    }
                }
            }

            // 2. Update Chargebacks to Applied (only pending chargebacks being settled; never change Waived/Forgiven)
            for (const cb of includedChargebacks) {
                if (cb.status === 'Pending') {
                    await db.collection('subcontractor_chargebacks').doc(cb.id).update(cleanUndefinedFields({
                        status: 'Applied',
                        appliedAt: nowStr,
                        updatedAt: nowStr
                    }));
                }
            }

            // 3. Sync Net Expense to P&L
            const expenseDocId = `exp-statement-${statementNumber}`;
            const expenseDoc = {
                id: expenseDocId,
                organizationId: activeOrg.id,
                date: nowStr.split('T')[0],
                category: 'Subcontractor Labor',
                vendor: subName,
                description: `Subcontractor Statement Remittance #${statementNumber} - ${subName} via ${paymentMethod || 'Company Account'} (Net Payout after $${totalDeductions.toFixed(2)} chargebacks)`,
                amount: netPayout,
                paidBy: paymentMethod || 'Company Account',
                paymentMethod: paymentMethod || 'Direct Deposit / ACH',
                status: 'Paid',
                statementNumber,
                subcontractorId: subcontractor.id,
                updatedAt: nowStr
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(expenseDoc), { merge: true });

            showToast.success(`Statement #${statementNumber} settled successfully! Net Payout of $${netPayout.toFixed(2)} recorded via ${paymentMethod || 'Company Account'}.`);
        } catch (err: any) {
            console.error("Error settling statement:", err);
            showToast.error("Failed to settle statement: " + (err.message || 'Database error'));
        } finally {
            setIsSettling(false);
        }
    };

    if (!isOpen) return null;

    const subDisplayName = subcontractor.companyName || subcontractor.contactName || 'Subcontractor';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Subcontractor Payment Statement & Remittance - ${subDisplayName}`}
            size="full"
        >
            <div className="space-y-6 max-h-[85vh] overflow-y-auto p-1 text-slate-900 dark:text-white">

                {/* Top Controls Banner */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Building2 className="text-amber-400" size={24} />
                            <h3 className="text-xl font-black">{subDisplayName}</h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 uppercase">
                                {subcontractor.trade || 'Subcontractor'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span>Statement #: <strong className="text-slate-200 font-mono">{statementNumber}</strong></span>
                            <span>Period: <strong className="text-slate-200">{statementPeriodStr}</strong></span>
                            {subcontractor.email && <span>Email: <strong className="text-slate-200">{subcontractor.email}</strong></span>}
                            {subcontractor.phone && <span>Phone: <strong className="text-slate-200">{subcontractor.phone}</strong></span>}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <Button
                            size="sm"
                            onClick={() => {
                                setChargebackToEdit(null);
                                setIsAddChargebackOpen(true);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-9 px-3"
                        >
                            <Plus size={14} className="mr-1" /> Add Chargeback
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handlePrintOrDownloadPdf('print')}
                            disabled={isGeneratingPdf}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-9 px-3 border-slate-700"
                        >
                            <Printer size={14} className="mr-1" /> Print
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handlePrintOrDownloadPdf('download')}
                            disabled={isGeneratingPdf}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-9 px-3 border-slate-700"
                        >
                            {isGeneratingPdf ? <Loader2 size={14} className="animate-spin mr-1" /> : <Download size={14} className="mr-1" />}
                            Download PDF
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setEmailSubject(`Payment Statement #${statementNumber} - ${activeOrg?.name || 'TekAir'}`);
                                setIsEmailModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-4 shadow-sm"
                        >
                            <Mail size={14} className="mr-1" /> Send via Email
                        </Button>
                    </div>
                </div>

                {/* Financial KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                            1. Gross Labor Earnings ({includedJobs.length} Jobs)
                        </span>
                        <span className="text-2xl font-black text-indigo-950 dark:text-indigo-200 mt-1 block">
                            ${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                            ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Settled • ${totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Pending
                        </span>
                    </div>

                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                            2. Damage & Faulty Work Deductions ({includedChargebacks.length})
                        </span>
                        <span className="text-2xl font-black text-rose-950 dark:text-rose-200 mt-1 block">
                            -${totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 block">
                            {includedChargebacks.some(cb => cb.status === 'Waived')
                                ? `${includedChargebacks.filter(cb => cb.status === 'Waived').length} chargeback forgiven (-$0.00 charged)`
                                : 'Site property damage, materials & rework costs'}
                        </span>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                            3. Net Remittance Balance Due
                        </span>
                        <span className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-1 block">
                            ${netPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                {netPayout === 0 && totalGross > 0 ? "All included jobs settled in full" : "Final amount payable after chargebacks"}
                            </span>
                            <button
                                onClick={handleSettleStatement}
                                disabled={isSettling || netPayout === 0}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm ${
                                    netPayout === 0
                                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                            >
                                {isSettling ? "Settling..." : netPayout === 0 ? "Settled ✓" : "Settle Net"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter & Customization Controls */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase text-slate-500 mr-1 flex items-center gap-1">
                            <Calendar size={13} /> Period:
                        </span>
                        {(['all', 'this_month', 'last_month', 'last_90_days', 'custom'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setDateRangeFilter(p)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                    dateRangeFilter === p
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {p === 'all' ? 'All Time' :
                                 p === 'this_month' ? 'This Month' :
                                 p === 'last_month' ? 'Last Month' :
                                 p === 'last_90_days' ? 'Last 90 Days' : 'Custom Dates'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={unpaidOnly}
                                onChange={e => setUnpaidOnly(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            Unpaid / Pending Only
                        </label>
                    </div>
                </div>

                {dateRangeFilter === 'custom' && (
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Input
                            label="Start Date"
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                        />
                        <Input
                            label="End Date"
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                        />
                    </div>
                )}

                {/* Section 1: Completed Work Orders (Gross) */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-800">
                    <div className="bg-slate-100 dark:bg-slate-900/60 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Wrench size={16} className="text-indigo-600" /> 1. Completed Work Orders & Labor Earnings (Gross)
                        </h4>
                        <span className="text-xs font-bold text-slate-500">
                            Selected: {includedJobs.length} of {filteredJobs.length} Jobs
                        </span>
                    </div>

                    {filteredJobs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs italic">
                            No completed jobs found for this subcontractor in the selected period.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase">
                                        <th className="p-3 w-8 text-center">Include</th>
                                        <th className="p-3">Work Order #</th>
                                        <th className="p-3">Site / Location</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Scope of Work</th>
                                        <th className="p-3 text-center">Payment Status</th>
                                        <th className="p-3 text-right">Gross Payout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                    {filteredJobs.map(item => {
                                        const isSelected = selectedJobIds.has(item.job.id);
                                        return (
                                            <tr key={item.job.id} className={isSelected ? 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30' : 'opacity-40 bg-slate-50/30'}>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleJobSelect(item.job.id)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                                    #{item.workOrderNumber}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900 dark:text-white">{item.serviceLocation || 'Site Location'}</div>
                                                </td>
                                                <td className="p-3 text-slate-500">
                                                    {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                                    {item.description}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        item.status === 'Paid' || (item.status as string) === 'Settled' || item.payoutAmount === 0
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                    }`}>
                                                        {item.payoutAmount === 0 ? 'Settled' : item.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                    ${item.payoutAmount.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-slate-700">
                                        <td colSpan={6} className="p-3 text-right uppercase text-[11px] text-slate-600 dark:text-slate-300">
                                            Total Included Gross Labor:
                                        </td>
                                        <td className="p-3 text-right font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                                            ${totalGross.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Section 2: Property Damage & Rework Deductions (Chargebacks) */}
                <div className="border border-rose-200 dark:border-rose-800/80 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-800">
                    <div className="bg-rose-50 dark:bg-rose-950/50 p-4 border-b border-rose-200 dark:border-rose-800/60 flex justify-between items-center">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 dark:text-rose-200 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-rose-600" /> 2. Property Damage & Faulty Workmanship Chargebacks
                            </h4>
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                                Deductions itemizing damaged property, materials, or rework required to correct substandard subcontractor work.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                setChargebackToEdit(null);
                                setIsAddChargebackOpen(true);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1"
                        >
                            <Plus size={13} className="mr-1" /> Log Chargeback
                        </Button>
                    </div>

                    {filteredChargebacks.length === 0 ? (
                        <div className="p-8 text-center text-emerald-600 font-bold text-xs bg-emerald-50/50 dark:bg-emerald-950/20">
                            ✓ No property damage or rework chargebacks logged for this subcontractor in this period.
                        </div>
                    ) : (
                        <div className="divide-y divide-rose-100 dark:divide-rose-900/30">
                            {filteredChargebacks.map(cb => {
                                const isSelected = selectedChargebackIds.has(cb.id);
                                const photoCount = cb.evidencePhotos?.length || 0;
                                const receiptCount = cb.receiptsAndInvoices?.length || 0;

                                return (
                                    <div key={cb.id} className={`p-4 transition-colors ${isSelected ? 'bg-white dark:bg-slate-800' : 'opacity-40 bg-slate-50/40'}`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleChargebackSelect(cb.id)}
                                                    className="mt-1 rounded border-rose-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-black uppercase">
                                                            {formatChargebackCategory(cb.category)}
                                                        </span>
                                                        <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                            {cb.title}
                                                        </h5>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                            cb.status === 'Applied' ? 'bg-emerald-100 text-emerald-800' :
                                                            cb.status === 'Waived' ? 'bg-emerald-100 text-emerald-800' :
                                                            cb.status === 'Disputed' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {cb.status === 'Waived' ? 'Waived / Forgiven' : cb.status}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                                        {cb.description || 'Property damage or rework deduction.'}
                                                    </p>

                                                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 mt-1.5">
                                                        <span>📅 {new Date(cb.date).toLocaleDateString()}</span>
                                                        {cb.workOrderNumber && <span>Work Order: <strong className="font-mono">#{cb.workOrderNumber}</strong></span>}
                                                        {photoCount > 0 && (
                                                            <span className="text-rose-600 font-bold flex items-center gap-1">
                                                                <Camera size={12} /> {photoCount} Damage Photo{photoCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {receiptCount > 0 && (
                                                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                                <Receipt size={12} /> {receiptCount} Receipt/Invoice{receiptCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Evidence Photos Row */}
                                                    {photoCount > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-2.5">
                                                            {cb.evidencePhotos.map((photo, pIdx) => (
                                                                <div
                                                                    key={pIdx}
                                                                    onClick={() => setPreviewPhotoUrl(photo.url)}
                                                                    className="relative group w-16 h-16 rounded-lg overflow-hidden border border-rose-200 dark:border-rose-800 cursor-pointer shadow-sm"
                                                                >
                                                                    <img src={photo.url} alt="Damage" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                                    {photo.caption && (
                                                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] truncate px-1 py-0.5">
                                                                            {photo.caption}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Receipts Breakdown Row */}
                                                    {receiptCount > 0 && (
                                                        <div className="mt-2.5 space-y-1">
                                                            {cb.receiptsAndInvoices.map((r, rIdx) => (
                                                                <div key={rIdx} className="inline-flex items-center gap-2 mr-3 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]">
                                                                    <Receipt size={12} className="text-emerald-600" />
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{r.name}</span>
                                                                    {r.amount && <span className="font-mono font-black text-emerald-600">${r.amount.toFixed(2)}</span>}
                                                                    {r.url && (
                                                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                                            <ExternalLink size={10} />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                {cb.status === 'Waived' ? (
                                                    <div>
                                                        <span className="text-xs line-through text-slate-400 font-mono block">
                                                            -${(Number(cb.amount) || 0).toFixed(2)}
                                                        </span>
                                                        <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                                                            -$0.00
                                                        </span>
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">
                                                            (Forgiven)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400 block">
                                                        -${(Number(cb.amount) || 0).toFixed(2)}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setChargebackToEdit(cb);
                                                        setIsAddChargebackOpen(true);
                                                    }}
                                                    className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 mt-1 inline-block"
                                                >
                                                    Edit / Manage
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Remittance Instructions, Payment Method & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                            <CreditCard size={14} className="text-indigo-600" /> Payment Method / How Sent
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Direct ACH / Jefferson Bank ...397, Check #1042, Zelle"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    const dd = (subcontractor as any)?.directDeposit;
                                    setPaymentMethod(dd?.bankName ? `Direct Deposit / ACH - ${dd.bankName} (...${String(dd.accountNumber).slice(-4) || '397'})` : 'Direct Deposit / ACH');
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 font-bold"
                            >
                                Direct ACH
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('Company Check #')}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 font-bold"
                            >
                                Check #
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('Zelle Transfer')}
                                className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-200 font-bold"
                            >
                                Zelle
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('Wire Transfer')}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 font-bold"
                            >
                                Wire
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Remittance Terms / Policy Note
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Net 15 via Direct ACH per Master Agreement."
                            value={paymentInstructions}
                            onChange={e => setPaymentInstructions(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Additional Statement Memo / Notes
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Please review attached damage photos and receipts."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                    </div>
                </div>

            </div>

            {/* Email Dispatch Modal */}
            {isEmailModalOpen && (
                <Modal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    title={`Email Payment Statement #${statementNumber} to ${subDisplayName}`}
                    size="lg"
                >
                    <form onSubmit={handleSendEmailStatement} className="space-y-4 p-1">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                                Subcontractor Email Address <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={emailRecipient}
                                onChange={e => setEmailRecipient(e.target.value)}
                                required
                                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                                Subject Line
                            </label>
                            <input
                                type="text"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                                required
                                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                                Custom Note / Message for Subcontractor (Optional)
                            </label>
                            <textarea
                                rows={3}
                                value={emailCustomMessage}
                                onChange={e => setEmailCustomMessage(e.target.value)}
                                placeholder="Hello, please find your payment statement for recent work orders, along with itemized deductions and attached proof..."
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                        </div>

                        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <FileText size={14} className="text-indigo-600" /> What will be sent:
                            </p>
                            <p>• Beautiful HTML payment statement with embedded damage photos & receipts breakdown.</p>
                            <p>• Official printable/vector PDF statement attachment generated automatically.</p>
                            <p>• Net Remittance summary: <strong>${netPayout.toFixed(2)}</strong> (Gross ${totalGross.toFixed(2)} - Deductions -$${totalDeductions.toFixed(2)}).</p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsEmailModalOpen(false)}
                                disabled={isSendingEmail}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSendingEmail}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4"
                            >
                                {isSendingEmail ? (
                                    <><Loader2 size={13} className="animate-spin mr-1" /> Sending Statement...</>
                                ) : (
                                    <><Send size={13} className="mr-1" /> Send Statement Email</>
                                )}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Subcontractor Chargeback Add/Edit Modal */}
            <SubcontractorChargebackModal
                isOpen={isAddChargebackOpen}
                onClose={() => {
                    setIsAddChargebackOpen(false);
                    setChargebackToEdit(null);
                }}
                subcontractor={subcontractor}
                chargebackToEdit={chargebackToEdit}
                onSaveSuccess={() => {
                    // Refreshed via Firestore onSnapshot
                }}
            />

            {/* Photo Lightbox */}
            {previewPhotoUrl && (
                <div 
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
                >
                    <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-slate-900 p-2">
                        <img src={previewPhotoUrl} alt="Evidence Preview" className="max-w-full max-h-[85vh] object-contain rounded" />
                        <button
                            onClick={() => setPreviewPhotoUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-black/70 text-white rounded-full hover:bg-rose-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default SubcontractorStatementModal;
