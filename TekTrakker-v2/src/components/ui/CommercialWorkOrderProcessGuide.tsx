import React, { useState, useMemo } from 'react';
import { ShieldAlert, Phone, Mail, FileText, Camera, AlertTriangle, Clock, DollarSign, Send, ChevronDown, ChevronUp, Box } from 'lucide-react';
import { Job, Customer } from '../../types/types';
import SendEmailModal from '../modals/SendEmailModal';
import MallFilterRequisitionModal from '../modals/MallFilterRequisitionModal';
import { useAppContext } from '../../context/AppContext';
import { sendEmail } from '../../lib/notificationService';
import showToast from '../../lib/toast';
import { generateMultiDocumentPdfAttachments } from '../../lib/pdfHelper';
import { 
    isImpactCustomer, 
    IMPACT_GENERAL_INFO, 
    IMPACT_MARICO_BETONIO, 
    resolveImpactContactsForLocation 
} from '../../lib/impactDirectory';

interface CommercialWorkOrderProcessGuideProps {
    job: Job;
    customer?: Customer | null;
    className?: string;
    defaultExpanded?: boolean;
}

export const CommercialWorkOrderProcessGuide: React.FC<CommercialWorkOrderProcessGuideProps> = ({
    job,
    customer,
    className = '',
    defaultExpanded = false
}) => {
    const { state } = useAppContext();
    const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
    const [isSendingSendGrid, setIsSendingSendGrid] = useState(false);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isMallFilterModalOpen, setIsMallFilterModalOpen] = useState(false);

    const is23rdGroup = customer?.name?.toLowerCase().includes('23rd') || (job as any)?.customerName?.toLowerCase().includes('23rd') || false;
    const isImpact = isImpactCustomer(customer, (job as any)?.customerName);
    const targetCustomerName = customer?.name || (job as any)?.customerName || 'Customer';

    // Extract rules with fallbacks based on customer type
    const nteLimit = job.nteLimit || customer?.submissionRules?.defaultNteLimit || (isImpact ? 500 : (is23rdGroup ? 300 : undefined));
    
    // Dynamic Account Manager contact
    const amContact = job.accountManagerContact || customer?.submissionRules?.accountManagerContact || (is23rdGroup ? {
        name: 'Account Manager',
        phone: '(704) 909-4423',
        extension: '7990',
        email: 'TaylorC@23rdgroup.com'
    } : (isImpact ? (() => {
        const resolved = resolveImpactContactsForLocation(job.locationName || (job as any).address || '', (job as any).storeNumber);
        return {
            name: resolved.accountManager?.name || 'Impact Operations',
            phone: resolved.accountManager?.directPhone || '203-431-8008',
            extension: resolved.accountManager?.extension || '',
            email: resolved.accountManager?.email || IMPACT_GENERAL_INFO.dispatchEmail
        };
    })() : {
        name: (customer as any)?.accountManagerName || 'Account Manager',
        phone: customer?.phone || '',
        extension: '',
        email: customer?.email || ''
    }));

    const invoiceEmail = customer?.submissionRules?.invoiceSubmissionEmail || (isImpact ? IMPACT_GENERAL_INFO.invoicingEmail : (is23rdGroup ? 'vendorinvoices@23rdgroup.com' : (customer?.email || '')));
    const apEmail = customer?.submissionRules?.apInquiryEmail || (isImpact ? IMPACT_GENERAL_INFO.vendorAdminEmail : (is23rdGroup ? 'apinquiries@23rdgroup.com' : (customer?.email || '')));
    
    const amName = amContact.name || 'Account Manager';
    const amEmail = amContact.email || '';

    // 20-Day Submission Countdown Calculation
    const submissionDeadlineDays = customer?.submissionRules?.submissionDeadlineDays || (isImpact ? 20 : undefined);
    
    const countdownInfo = useMemo(() => {
        if (!submissionDeadlineDays) return null;

        const workDateStr = job.checkOutTime || job.appointmentTime || (job as any).completedDate || job.invoice?.invoiceDate || job.createdAt;
        const workDate = workDateStr ? new Date(workDateStr) : new Date();
        const now = new Date();
        const elapsedDays = Math.max(0, Math.floor((now.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24)));
        const daysLeft = submissionDeadlineDays - elapsedDays;
        const isInvoiceSettled = job.invoice?.status === 'Paid' || !!job.invoice?.paidDate;
        const isInvoiceSent = !!job.invoice?.sentAt || job.invoice?.status === 'Pending';

        return {
            deadlineDays: submissionDeadlineDays,
            daysLeft,
            elapsedDays,
            isOverdue: daysLeft < 0,
            isUrgent: daysLeft <= 5 && daysLeft >= 0,
            isWarning: daysLeft <= 10 && daysLeft > 5,
            isInvoiceSettled,
            isInvoiceSent,
            workDateFormatted: workDate.toLocaleDateString()
        };
    }, [submissionDeadlineDays, job]);

    const photosUploaded = ((job as any).photos || []).length;
    const woNum = job.workOrderNumber || job.poNumber || job.id;

    // Combined recipients list including primary target address + Account Manager CC + Marico for Impact
    const submissionRecipients = invoiceEmail ? [invoiceEmail] : [];
    if (amEmail && !submissionRecipients.includes(amEmail)) {
        submissionRecipients.push(amEmail);
    }
    if (isImpact && !submissionRecipients.includes(IMPACT_MARICO_BETONIO.email)) {
        submissionRecipients.push(IMPACT_MARICO_BETONIO.email);
    }

    // Direct SendGrid 1-Click System Dispatch
    const handleDirectSendGridSubmit = async () => {
        if (!invoiceEmail) {
            showToast.error("No submission email address configured for this customer.");
            return;
        }
        setIsSendingSendGrid(true);
        try {
            showToast.info("Preparing PDF attachments (Invoice, Service Report, Sign-Off Sheet)...");
            const attachments = await generateMultiDocumentPdfAttachments(
                {
                    job,
                    invoice: job.invoice,
                    includeInvoice: true,
                    includeReport: true,
                    includeSignOff: true
                },
                state.currentOrganization
            );

            const ccEmails: string[] = [];
            if (amEmail) ccEmails.push(amEmail);
            if (isImpact && !ccEmails.includes(IMPACT_MARICO_BETONIO.email)) {
                ccEmails.push(IMPACT_MARICO_BETONIO.email);
            }

            const mailPayload = {
                to: invoiceEmail,
                cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
                customerId: customer?.id || job.customerId,
                jobId: job.id,
                strictPdfOnly: is23rdGroup || isImpact,
                message: {
                    subject: isImpact 
                        ? `Invoice, Signed Work Order & Photo Report — Impact Service Group WO #${woNum} (Vendor #2282)`
                        : `Invoice, Sign-Off & Photos — WO #${woNum}`,
                    html: isImpact ? `<p>Impact Service Group Invoicing Dept,</p>
<p>Please find the completed invoice, signed work order sign-off sheet, and unit photos attached directly to this email as raw PDF files for Work Order #${woNum} (Contractor No. 2282).</p>
<p><strong>Work Order:</strong> #${woNum}</p>
<p><strong>Store Location:</strong> ${job.locationName || (job as any).address || 'Store'}</p>
<p><em>(All documents attached strictly as raw PDF files per Impact Contract #2282 20-day submission requirements).</em></p>
<p>Thank you for your business!</p>` : (is23rdGroup ? `<p>23rd Group Facility Services,</p>
<p>Please find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email as raw PDF files for Work Order #${woNum}.</p>
<p><strong>Account Manager CC:</strong> ${amName} (${amEmail || 'N/A'})</p>
<p><em>(All documents are attached strictly as raw PDF files per 23rd Group submission requirements).</em></p>
<p>Thank you for your business!</p>` : `<p>${targetCustomerName},</p>
<p>Please find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email for Work Order #${woNum}.</p>
${amEmail ? `<p><strong>Account Manager CC:</strong> ${amName} (${amEmail})</p>` : ''}
<p>Thank you for your business!</p>`),
                    text: isImpact 
                        ? `Impact Service Group Invoicing Dept,\n\nPlease find the completed invoice, signed work order sign-off sheet, and unit photos attached directly to this email as raw PDF files for Work Order #${woNum} (Contractor No. 2282).\n\nWork Order: #${woNum}\nStore Location: ${job.locationName || (job as any).address || 'Store'}\n\n(All documents attached strictly as raw PDF files per Impact Contract #2282 20-day submission requirements).\n\nThank you for your business!`
                        : (is23rdGroup ? `23rd Group Facility Services,\n\nPlease find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email as raw PDF files for Work Order #${woNum}.\n\nAccount Manager CC: ${amName} (${amEmail || 'N/A'})\n\n(All documents are attached strictly as raw PDF files per 23rd Group submission requirements).\n\nThank you for your business!` : `${targetCustomerName},\n\nPlease find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email for Work Order #${woNum}.\n\nThank you for your business!`),
                    attachments: attachments.length > 0 ? attachments : undefined
                }
            };

            if (!state.isDemoMode) {
                await sendEmail(state.currentOrganization, mailPayload as any);
            } else {
                await new Promise(res => setTimeout(res, 800));
            }

            showToast.success(`🚀 Submitted via SendGrid to ${invoiceEmail} ${amEmail ? `(CC: ${amName} - ${amEmail})` : ''}!`);
        } catch (err: any) {
            console.error("SendGrid dispatch error:", err);
            showToast.error(`SendGrid dispatch failed: ${err?.message || 'Error sending mail'}`);
        } finally {
            setIsSendingSendGrid(false);
        }
    };

    const rules = customer?.submissionRules;
    const hasCheckIn = is23rdGroup || isImpact || rules?.checkInProcedure?.required || rules?.thirdPartyPortal?.required;
    const hasNte = nteLimit !== undefined || rules?.requireNteApprovalCall;
    const hasDirectives = is23rdGroup || isImpact || rules?.noPaperworkForStoreAssociate || rules?.doNotDiscussPricingWithStoreAssociate || rules?.customSubmissionNotes;
    const hasProposalRule = is23rdGroup || rules?.requireProposalWithin24Hours;
    const hasSignOff = is23rdGroup || isImpact || rules?.requireSignedWorkOrder;
    const hasPhotos = is23rdGroup || isImpact || rules?.requireBeforeAfterPhotos;
    const hasEmailRouting = is23rdGroup || isImpact || invoiceEmail || apEmail || amEmail;

    return (
        <div className={`p-4 sm:p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 text-white shadow-xl transition-all ${className}`}>
            {/* Header / Clickable Bar */}
            <div className={`flex items-center justify-between flex-wrap gap-2 transition-all ${isExpanded ? 'mb-4 border-b border-rose-800/40 pb-3' : ''}`}>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2.5 text-left focus:outline-none group cursor-pointer flex-1 min-w-0"
                >
                    <span className="p-2 sm:p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 group-hover:bg-rose-500/30 transition-colors">
                        <ShieldAlert size={18} className="animate-pulse" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-200 flex items-center gap-2 truncate">
                            🏢 {isImpact ? 'Impact Service Group Work Order Protocol (Contract #2282)' : (is23rdGroup ? '23rd Group Work Order Protocol' : `${targetCustomerName} Specific Rules`)}
                        </h3>
                        <p className="text-[11px] text-slate-300 font-medium truncate">
                            Mandatory {isImpact ? 'IVR (203-431-8008) • 20-Day Cutoff • ' : ''}Site & Invoicing Rules • WO <span className="font-mono font-bold text-white">#{woNum}</span>
                        </p>
                    </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                    {nteLimit !== undefined && (
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-widest border border-rose-500/30">
                            NTE: ${nteLimit.toFixed(0)}
                        </span>
                    )}
                    
                    {amContact.phone && (
                        <a
                            href={`tel:${(amContact.phone || '').replace(/[^0-9+]/g, '')}`}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] shadow flex items-center gap-1 transition-all cursor-pointer"
                            title={`Call Account Manager ${amName}`}
                        >
                            <Phone size={12} />
                            <span className="hidden xs:inline">Call AM</span>
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-extrabold"
                    >
                        <span>{isExpanded ? 'Hide Rules' : (isImpact ? 'Show Protocol (Contract #2282)' : (is23rdGroup ? 'Show Protocol (8 Rules)' : 'Show Customer Rules'))}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* 20-Day Invoicing Countdown Alert */}
            {countdownInfo && (
                <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs ${
                    countdownInfo.isInvoiceSettled
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                        : countdownInfo.isInvoiceSent
                        ? 'bg-blue-950/50 border-blue-500/50 text-blue-200'
                        : countdownInfo.isOverdue
                        ? 'bg-rose-950/90 border-rose-500 text-rose-100 animate-pulse shadow-lg'
                        : countdownInfo.isUrgent
                        ? 'bg-amber-950/80 border-amber-500 text-amber-100 animate-pulse shadow-lg'
                        : 'bg-slate-800/90 border-slate-700 text-slate-200'
                }`}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg shrink-0 ${
                            countdownInfo.isInvoiceSettled ? 'bg-emerald-500/20 text-emerald-400' :
                            countdownInfo.isOverdue ? 'bg-rose-500/30 text-rose-300 animate-bounce' :
                            countdownInfo.isUrgent ? 'bg-amber-500/30 text-amber-300 animate-pulse' :
                            'bg-indigo-500/20 text-indigo-300'
                        }`}>
                            <Clock size={16} />
                        </div>
                        <div className="min-w-0">
                            <span className="font-extrabold uppercase tracking-wider block text-[10px] text-slate-300">
                                {isImpact ? 'Impact Contract #2282 — 20-Day Invoicing Cutoff Guard' : `${countdownInfo.deadlineDays}-Day Submission Deadline`}
                            </span>
                            <span className="font-bold text-xs">
                                {countdownInfo.isInvoiceSettled ? (
                                    '✓ Invoice settled & paid in full.'
                                ) : countdownInfo.isInvoiceSent ? (
                                    '✓ Invoice submitted to client. Awaiting Net 45 remittance.'
                                ) : countdownInfo.isOverdue ? (
                                    `🛑 OVERDUE: ${Math.abs(countdownInfo.daysLeft)} days past 20-day cutoff! Impact payment is subject to forfeiture.`
                                ) : countdownInfo.isUrgent ? (
                                    `🚨 URGENT: Only ${countdownInfo.daysLeft} day${countdownInfo.daysLeft === 1 ? '' : 's'} remaining to submit raw PDF invoice before forfeiture!`
                                ) : (
                                    `⏱️ ${countdownInfo.daysLeft} days remaining before 20-day cutoff (Work Date: ${countdownInfo.workDateFormatted}).`
                                )}
                            </span>
                        </div>
                    </div>

                    {!countdownInfo.isInvoiceSettled && invoiceEmail && (
                        <button
                            type="button"
                            disabled={isSendingSendGrid}
                            onClick={handleDirectSendGridSubmit}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                            title="Direct 1-Click Send via SendGrid to Impact Invoicing"
                        >
                            <Send size={12} />
                            <span>{isSendingSendGrid ? 'Sending...' : '1-Click Submit PDF'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Collapsible Rules Content */}
            {isExpanded && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
                        {/* 1. WO Acceptance */}
                        {hasCheckIn && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-blue-500/30">1</span>
                                <div>
                                    <p className="font-bold text-slate-200 uppercase text-[11px]">WO / Portal Acceptance</p>
                                    <p className="text-[11px] text-slate-400">
                                        {rules?.thirdPartyPortal?.required
                                            ? `Accept work order in ${rules.thirdPartyPortal.portalName || '3rd party portal'} prior to dispatch.`
                                            : 'Accept work order through emailed web link prior to dispatch.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 2. Check In & Out */}
                        {hasCheckIn && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-indigo-500/30">2</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                        <p className="font-bold text-slate-200 uppercase text-[11px]">
                                            {isImpact ? 'Impact IVR Check-In / Check-Out' : `${rules?.checkInProcedure?.method || 'IVR / Phone'} Check-In/Out`}
                                        </p>
                                        {isImpact && (
                                            <a
                                                href="tel:2034318008"
                                                className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] shadow flex items-center gap-1 cursor-pointer"
                                                title="Call Impact IVR System (203-431-8008)"
                                            >
                                                <Phone size={10} />
                                                <span>Call IVR (203-431-8008)</span>
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {isImpact 
                                            ? 'Mandatory IVR: Call 203-431-8008 upon arrival and departure. (Store check-in failure results in non-payment).'
                                            : (rules?.checkInProcedure?.instructions || 'Must clock in and out on every site visit.')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 3. NTE Increase Call */}
                        {hasNte && (
                            <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 col-span-1 md:col-span-2 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-amber-500/30">3</span>
                                        <span className="font-bold text-amber-300 uppercase text-[11px] flex items-center gap-1.5">
                                            <DollarSign size={14} /> Call for NTE (Not-To-Exceed) Increase
                                        </span>
                                    </div>
                                    {nteLimit !== undefined && (
                                        <span className="text-xs font-mono font-bold text-amber-200 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/30">
                                            NTE Limit: ${nteLimit.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                
                                {nteLimit !== undefined && (
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        If repair costs will exceed <strong className="text-amber-200">${nteLimit.toFixed(2)}</strong>, tech MUST call the Account Manager (AM) from site before completing work.
                                    </p>
                                )}

                                {amContact.phone && (
                                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Assigned Account Manager Contact:</span>
                                            <span className="font-bold text-white">{amName}</span>
                                            <span className="text-amber-300 font-mono font-bold ml-2">{amContact.phone} {amContact.extension ? `ext ${amContact.extension}` : ''}</span>
                                            {amEmail && <span className="text-slate-400 block text-[10px] font-mono mt-0.5">Email: {amEmail}</span>}
                                        </div>
                                        <a
                                            href={`tel:${(amContact.phone || '').replace(/[^0-9+]/g, '')}`}
                                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <Phone size={13} />
                                            <span>Call AM ({amName})</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. Special Directives / Notes */}
                        {hasDirectives && (
                            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 flex flex-col gap-2.5 col-span-1 md:col-span-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="font-black text-rose-300 uppercase text-[11px] flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-rose-400" />
                                        🚫 SPECIAL CUSTOMER DIRECTIVES & SITE RULES
                                    </p>
                                </div>
                                <div className="text-[11px] text-rose-100/90 font-medium leading-relaxed space-y-1">
                                    {(rules?.noPaperworkForStoreAssociate || is23rdGroup || isImpact) && (
                                        <p>• Do NOT discuss pricing or leave ANY paperwork with store personnel.</p>
                                    )}
                                    {isImpact && (
                                        <>
                                            <p>• <strong>20-Day Invoicing Rule:</strong> Raw PDF invoice must be submitted within 20 days of service date or payment is forfeited.</p>
                                            <p>• <strong>$45 Initial Survey Fee:</strong> Inspect rooftop unit, record serial/model & verify filter sizes to claim $45 fee on invoice.</p>
                                            <p>• <strong>7% Broker Remittance:</strong> Net 93% paid on Net 45 terms (Contract #2282).</p>
                                        </>
                                    )}
                                    {is23rdGroup && (
                                        <>
                                            <p>• Patient-facing clinic: Technician MUST wear a mask inside the building & dress professionally.</p>
                                            <p>• Absolutely NO vaping or smoking on clinic property.</p>
                                        </>
                                    )}
                                    {rules?.customSubmissionNotes && (
                                        <p>• Special Notes: {rules.customSubmissionNotes}</p>
                                    )}
                                    {amContact.phone && (
                                        <p>• Call AM ({amName}) <strong className="text-amber-200 uppercase">prior to leaving site</strong> to provide ballpark quote & next steps if a 2nd visit is needed.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 5. 24-Hour Proposal Rule */}
                        {hasProposalRule && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-purple-500/30">5</span>
                                <div>
                                    <p className="font-bold text-purple-300 uppercase text-[11px] flex items-center gap-1">
                                        <Clock size={13} /> 24-Hour Follow-Up Proposal Rule
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Formal proposals for work not completed on 1st trip MUST be submitted within 24 hours with itemized labor & material breakdown.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 6. Sign-off Sheet */}
                        {hasSignOff && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-emerald-500/30">6</span>
                                <div>
                                    <p className="font-bold text-emerald-300 uppercase text-[11px] flex items-center gap-1">
                                        <FileText size={13} /> Sign-Off Sheet Required
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Completed sign-off sheet required for each visit. {rules?.allowEmergencyPaperSignOff !== false && <span className="text-emerald-200 font-bold"> Emergency Exception: Blank paper with Scope of Work (SOW), Manager on Duty (MOD) signature, date & time.</span>}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 7. Photos */}
                        {hasPhotos && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0 border border-blue-500/30">7</span>
                                <div>
                                    <p className="font-bold text-blue-300 uppercase text-[11px] flex items-center gap-1">
                                        <Camera size={13} /> Before & After Photos Required
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Must upload before and after site photos ({photosUploaded} photo{photosUploaded === 1 ? '' : 's'} currently attached).
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 8. Submission Routing */}
                        {hasEmailRouting && (
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-slate-500/20 text-slate-300 text-[11px] font-black flex items-center justify-center shrink-0 border border-slate-500/30">8</span>
                                <div className="w-full">
                                    <p className="font-bold text-slate-200 uppercase text-[11px] flex items-center gap-1">
                                        <Mail size={13} /> Official Submission Email Routing
                                    </p>
                                    {invoiceEmail && <p className="text-[10px] text-slate-400">Primary Invoices & Photos: <strong className="text-blue-300">{invoiceEmail}</strong></p>}
                                    {amEmail && <p className="text-[10px] text-slate-400">Assigned AM CC: <strong className="text-amber-300">{amName} {amEmail ? `(${amEmail})` : ''}</strong></p>}
                                    {apEmail && <p className="text-[10px] text-slate-400">Statements & AP Inquiries: <strong className="text-indigo-300">{apEmail}</strong></p>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Email Action Buttons via SendGrid */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                            {amName ? `Assigned AM: ${amName} ${amEmail ? `(${amEmail})` : ''}` : `Client: ${targetCustomerName}`}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            {isImpact && (
                                <button
                                    type="button"
                                    onClick={() => setIsMallFilterModalOpen(true)}
                                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
                                    title="View Mall Filter Pull Sheet for Impact Service Group"
                                >
                                    <Box size={13} />
                                    <span>📦 Mall Filter Pull Sheet</span>
                                </button>
                            )}
                            {invoiceEmail && (
                                <button
                                    type="button"
                                    disabled={isSendingSendGrid}
                                    onClick={handleDirectSendGridSubmit}
                                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                    title="Send via TekTrakker SendGrid System Mailer"
                                >
                                    <Send size={13} />
                                    <span>{isSendingSendGrid ? 'Sending SendGrid...' : `⚡ 1-Click Send via SendGrid (${invoiceEmail}${amEmail ? ` + CC ${amName}` : ''})`}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsSendEmailModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                                <Mail size={13} />
                                <span>Email Modal Preview</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* In-App Send Email Modal */}
            {isSendEmailModalOpen && (
                <SendEmailModal
                    isOpen={isSendEmailModalOpen}
                    onClose={() => setIsSendEmailModalOpen(false)}
                    recipientEmail={submissionRecipients}
                    recipientName={targetCustomerName}
                    job={job}
                    mode="invoice"
                    defaultSubject={`Invoice, Sign-Off & Photos — WO #${woNum}`}
                    defaultMessage={isImpact ? `Impact Service Group Invoicing Dept,

Please find the completed invoice, signed work order sign-off sheet, and unit photos attached directly to this email as raw PDF files for Work Order #${woNum} (Contractor No. 2282).

Work Order: #${woNum}
Store Location: ${job.locationName || (job as any).address || 'Store'}

(All documents attached strictly as raw PDF files per Impact Contract #2282 20-day submission requirements).

Thank you for your business!` : (is23rdGroup ? `23rd Group Facility Services,

Please find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email as raw PDF files for Work Order #${woNum}.

Account Manager CC: ${amName} ${amEmail ? `(${amEmail})` : ''}

(All documents are attached strictly as raw PDF files per 23rd Group submission requirements).

Thank you for your business!` : `${targetCustomerName},

Please find the completed invoice, signed work order sign-off sheet, and site photo report attached directly to this email for Work Order #${woNum}.

${amEmail ? `Account Manager CC: ${amName} (${amEmail})\n\n` : ''}Thank you for your business!`)}
                />
            )}

            {/* Mall Filter Requisition Modal */}
            {isMallFilterModalOpen && (
                <MallFilterRequisitionModal
                    isOpen={isMallFilterModalOpen}
                    onClose={() => setIsMallFilterModalOpen(false)}
                    customer={customer}
                    customerId={customer?.id || job.customerId || undefined}
                />
            )}
        </div>
    );
};

export default CommercialWorkOrderProcessGuide;

