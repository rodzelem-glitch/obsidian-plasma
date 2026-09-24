import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { 
    ShieldCheck, 
    FileText, 
    Download, 
    Printer, 
    DollarSign, 
    Clock, 
    Truck, 
    Percent, 
    Building2, 
    CheckCircle2, 
    AlertCircle,
    Calendar,
    FileCheck2
} from 'lucide-react';
import type { ServiceAgreement, Organization } from '../../types';
import { isRecurringMembership, formatAgreementDate, getAgreementClassification } from '../../lib/membershipHelper';
import showToast from '../../lib/toast';

interface AgreementViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    agreement: ServiceAgreement | null;
    organization?: Organization | null;
}

export const AgreementViewerModal: React.FC<AgreementViewerModalProps> = ({
    isOpen,
    onClose,
    agreement,
    organization
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'document'>('summary');
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen || !agreement) return null;

    const isMembership = isRecurringMembership(agreement);
    const classification = getAgreementClassification(agreement);

    // Resolve contract document HTML
    const resolveContractHtml = (): string => {
        if (agreement.documentHtml) {
            return agreement.documentHtml;
        }

        // Special handling for Impact Service Group Contract #2282
        if (
            agreement.id === 'SA-IMPACT-2282' || 
            agreement.contractNumber === '2282' ||
            (agreement.customerName || '').toLowerCase().includes('impact service group')
        ) {
            return `
                <div class="contract-rendered-view" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.5; font-size: 11px;">
                    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2 style="font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase;">TekAir, Inc. &bull; Contract Rate Schedule Addendum</h2>
                            <p style="font-size: 11px; color: #475569; margin: 2px 0 0 0; font-weight: 600;">Master Commercial Agreement &bull; Impact Service Group, LLC (Contract #2282 &bull; Vendor #2282)</p>
                        </div>
                        <div>
                            <span style="display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase;">&check; Approved &amp; Executed</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
                        <div>
                            <p style="margin: 0 0 4px 0;"><strong>Service Provider:</strong> TekAir, Inc. (San Antonio &amp; Central Texas Territory)</p>
                            <p style="margin: 0 0 4px 0;"><strong>Customer Entity:</strong> Impact Service Group, LLC (63 Copps Hill Rd, Ridgefield, CT 06877)</p>
                            <p style="margin: 0 0 4px 0;"><strong>Account Reps:</strong> Eric Berkley (x177) &bull; Kyle Morrison (Operations) &bull; Philip Chiaia (x136)</p>
                            <p style="margin: 0;"><strong>Payment Terms:</strong> Net 45 Days (via Bill.com ACH Transfer)</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 4px 0;"><strong>Contract Reference:</strong> Impact Master Services Agreement (Contract #2282)</p>
                            <p style="margin: 0 0 4px 0;"><strong>Portfolio Scope:</strong> 49 Commercial Retail Locations (San Antonio, Selma, New Braunfels)</p>
                            <p style="margin: 0 0 4px 0;"><strong>Invoice Submission:</strong> invoices@impactservicegroup.com (Raw PDF &bull; Strict 20-Day Cutoff)</p>
                            <p style="margin: 0;"><strong>IVR Dispatch:</strong> (203) 431-8008 (Mandatory Arrival &amp; Departure Check-In/Out)</p>
                        </div>
                    </div>

                    <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0284c7; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 16px 0 10px 0;">Attachment A: Approved Labor, Dispatch &amp; Markup Rate Schedule</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px;">
                        <thead>
                            <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 9.5px; color: #334155;">
                                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Service / Item Category</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Approved Contract Rate</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Net to TekAir (93%)</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Contract Terms &amp; Scope Specification</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Mechanic Labor Rate</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$115.00 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$106.95 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Standard regular-time daytime commercial mechanical rate (Mon–Fri 8:00 AM – 5:00 PM).</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Overtime Labor Rate</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$172.50 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$160.43 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Time-and-a-half (1.5x) of standard mechanic rate. Applies after 5:00 PM weekdays and Saturdays.</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Emergency / Holiday Labor Rate</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$177.50 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$165.08 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">24/7 Priority Emergency &amp; Recognized Holiday callouts. Guaranteed 2-hour minimum callout.</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Second Technician (Safety / Access)</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$115.00 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$106.95 / hr</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Mandatory for OSHA safety protocols, exterior roof ladder access, compressor changeouts, and 20+ ton RTUs.</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Trip / Mobilization Fee</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$50.00 flat</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$46.50 flat</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Standard vehicle mobilization truck charge per scheduled demand service call.</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Travel Time (Windshield)</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">0.5 hr ($57.50)</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$53.48</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Paid 1/2 hour portal travel time at standard rate. Combined with $50 truck charge = <strong>$107.50 initial callout</strong>.</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Parts Markup (Up to $1,500)</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">43% Cost-Plus</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">~33% Net Margin</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Commercial wholesale cost-plus markup on motors, contactors, capacitors, circuit boards, and standard parts.</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Parts Markup (Over $1,500)</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">23% Cost-Plus</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">~14.4% Net Margin</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Major commercial equipment, hermetic/scroll compressors, heat exchangers, and commercial coils.</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>Subcontractors &amp; Equipment</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">20% Cost-Plus</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">~11.6% Net Margin</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Mobile hydraulic cranes, rigging crews, traffic control permits, scissor/boom lifts, core drilling, licensed electrical.</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"><strong>EPA Recovery &amp; Evacuation</strong></td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">$95.00 flat</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">$88.35 flat</td>
                                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">EPA Section 608 recovery machine utilization, deep vacuum micron evacuation, and certified cylinder reclamation.</td>
                            </tr>
                        </tbody>
                    </table>

                    <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0284c7; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 16px 0 10px 0;">Attachment B: Preventive Maintenance Scope &amp; Retail Network Value</h3>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 14px;">
                        <p style="margin: 0 0 6px 0;"><strong>Turnkey Flat-Rate PM:</strong> $150.00 flat rate for any site with 1–2 units; +$50.00 per system for each additional unit. Pleated MERV 8/11 air filters and routine materials included.</p>
                        <p style="margin: 0 0 6px 0;"><strong>Portfolio Contract Value:</strong> 49 Stores (158 annual visits) = <strong>$23,700.00 Annual Value ($5,925.00 billed quarterly upon inspection)</strong>.</p>
                        <p style="margin: 0;"><strong>Initial Equipment Survey &amp; Audit Fee:</strong> $45.00 flat per store on initial onboarding visit ($2,205.00 across portfolio).</p>
                    </div>

                    <div style="background: #eff6ff; border-left: 3.5px solid #3b82f6; padding: 10px 14px; border-radius: 4px; margin: 14px 0;">
                        <strong style="color: #1e3a8a;">Administrative &amp; Invoicing Safeguards:</strong>
                        <ul style="margin: 6px 0 0 0; padding-left: 18px; color: #1e40af;">
                            <li><strong>7% Broker Fee Deduction:</strong> Impact Service Group deducts a 7% sales/marketing fee on all invoices processed. Invoices settle Net 45.</li>
                            <li><strong>20-Day Submission Deadline:</strong> Invoices, signed sign-off sheets, and photos must be submitted via raw PDF to <code>invoices@impactservicegroup.com</code> within 20 days of job completion.</li>
                            <li><strong>Mandatory IVR Check-In/Out:</strong> Technicians must call <strong>(203) 431-8008</strong> upon arrival and departure.</li>
                        </ul>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; padding-top: 14px; border-top: 1.5px solid #cbd5e1;">
                        <div>
                            <p style="margin: 0; font-weight: 700;">Service Provider: TekAir, Inc.</p>
                            <p style="margin: 8px 0 2px 0; font-family: 'Brush Script MT', cursive, serif; font-size: 18px; color: #1e40af;">Roderick Macdonell</p>
                            <p style="margin: 0; font-size: 9.5px; color: #64748b;">Roderick Macdonell, President &bull; September 14, 2026</p>
                        </div>
                        <div>
                            <p style="margin: 0; font-weight: 700;">Client Entity: Impact Service Group, LLC</p>
                            <p style="margin: 8px 0 2px 0; font-family: 'Brush Script MT', cursive, serif; font-size: 18px; color: #1e40af;">Kyle Morrison</p>
                            <p style="margin: 0; font-size: 9.5px; color: #64748b;">Kyle Morrison / Eric Berkley &bull; Vendor Operations</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Generic fallback contract content
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #0f172a; line-height: 1.6;">
                <h2 style="font-size: 18px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">${agreement.planName}</h2>
                <p><strong>Customer:</strong> ${agreement.customerName}</p>
                <p><strong>Agreement ID:</strong> ${agreement.id}</p>
                <p><strong>Effective Term:</strong> ${formatAgreementDate(agreement)}</p>
                <p><strong>Status:</strong> ${agreement.status}</p>
                ${agreement.price ? `<p><strong>Billing Schedule:</strong> $${agreement.price.toFixed(2)} (${agreement.billingCycle || 'Annual'})</p>` : ''}
                ${agreement.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;"><p style="margin: 0;"><strong>Agreement Notes:</strong> ${agreement.notes}</p></div>` : ''}
            </div>
        `;
    };

    const handlePrint = () => {
        const content = resolveContractHtml();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast.warn('Popup blocked. Please allow popups to print agreement.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${agreement.planName} - ${agreement.customerName}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownloadPdf = async () => {
        setIsExporting(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const content = resolveContractHtml();
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.innerHTML = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6;">
                    ${content}
                </div>
            `;
            document.body.appendChild(wrapper);

            const opt = {
                margin: [0.3, 0.3, 0.3, 0.3] as [number, number, number, number],
                filename: `${agreement.customerName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${agreement.id}_Agreement.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
            };

            const pdfDataUri = await html2pdf().from(wrapper).set(opt).output('datauristring');
            const { downloadFile } = await import('../../lib/downloadHelper');
            await downloadFile(pdfDataUri, opt.filename);
            document.body.removeChild(wrapper);
            showToast.success('Agreement PDF downloaded.');
        } catch (e) {
            console.error('Failed to export agreement PDF:', e);
            showToast.error('Failed to generate PDF download.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={agreement.planName}
            size="xl"
        >
            <div className="space-y-6">
                {/* Header Sub-Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${classification.badgeColor}`}>
                                {classification.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                agreement.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800'
                            }`}>
                                {agreement.status}
                            </span>
                            {agreement.contractNumber && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Contract #{agreement.contractNumber}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                            Customer: <strong className="text-slate-900 dark:text-white">{agreement.customerName}</strong>
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                            title="Print Agreement"
                        >
                            <Printer size={14} /> Print
                        </Button>
                        <Button
                            onClick={handleDownloadPdf}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                            title="Download PDF Copy"
                        >
                            <Download size={14} /> {isExporting ? 'Generating...' : 'Download PDF'}
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('summary')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === 'summary'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <ShieldCheck size={14} />
                        <span>Executive Summary &amp; Rates</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('document')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === 'document'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <FileText size={14} />
                        <span>Executed Contract Document</span>
                    </button>
                </div>

                {/* TAB 1: Executive Summary & Rates */}
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        {/* Non-MRR Explanation Banner if Commercial Contractor Agreement */}
                        {!isMembership && (
                            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
                                <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                                    <strong className="font-bold block mb-0.5">Commercial Service Contract &bull; Non-MRR Agreement</strong>
                                    This agreement establishes pre-negotiated commercial labor rates, wholesale parts markups, dispatch fees, and payment terms per work order. Services are billed on completion under contractual terms (Net 45) and are <strong>strictly excluded from Monthly Recurring Revenue (MRR)</strong>.
                                </div>
                            </div>
                        )}

                        {/* Rate Metrics Grid for Contractor Agreements */}
                        {!isMembership && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Clock size={16} className="text-indigo-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Mechanic Labor</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        ${agreement.laborRate?.toFixed(2) || '115.00'}<span className="text-xs font-normal text-slate-400">/hr</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">Nets $106.95 (93%)</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Clock size={16} className="text-amber-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Overtime Rate</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        ${agreement.overtimeRate?.toFixed(2) || '172.50'}<span className="text-xs font-normal text-slate-400">/hr</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">1.5x Base After 5PM/Sat</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Truck size={16} className="text-emerald-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">1st Hr Dispatch</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        ${agreement.tripCharge?.toFixed(2) || '107.50'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">$50 truck + 0.5hr travel</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Percent size={16} className="text-teal-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">OEM Parts Markup</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        {agreement.partsMarkupTier1 || 43}% / {agreement.partsMarkupTier2 || 23}%
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">&le;$1,500 / &gt;$1,500</p>
                                </Card>
                            </div>
                        )}

                        {/* Recurring Membership Metrics Grid */}
                        {isMembership && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <DollarSign size={16} className="text-emerald-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Plan Investment</p>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        ${agreement.price?.toFixed(2) || '0.00'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">{agreement.billingCycle || 'Annual'} Recurring</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Calendar size={16} className="text-blue-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Visits Included</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        {agreement.visitsRemaining ?? 0} of {agreement.visitsTotal ?? 0}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">Visits Remaining</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <Building2 size={16} className="text-purple-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Systems</p>
                                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                        {agreement.systemCount || 1} System(s)
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">Covered Units</p>
                                </Card>

                                <Card className="p-3 border border-slate-200 dark:border-slate-800 text-center">
                                    <ShieldCheck size={16} className="text-indigo-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">MRR Contribution</p>
                                    <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                                        ${(agreement.billingCycle === 'Monthly' ? (agreement.price || 0) : ((agreement.price || 0) / 12)).toFixed(2)}/mo
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">Monthly Recurring</p>
                                </Card>
                            </div>
                        )}

                        {/* Key Terms & Administrative Specifications */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3 text-xs">
                            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                <FileCheck2 size={14} className="text-indigo-600" /> Contract Specifications &amp; Administration
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                                <div>
                                    <p><strong>Agreement ID:</strong> <span className="font-mono">{agreement.id}</span></p>
                                    <p className="mt-1"><strong>Effective Term:</strong> {formatAgreementDate(agreement)}</p>
                                    <p className="mt-1"><strong>Payment Terms:</strong> {(agreement.paymentTerms || 'net_45').toUpperCase().replace('_', ' ')}</p>
                                </div>
                                <div>
                                    <p><strong>Covered Scope:</strong> {agreement.siteCount ? `${agreement.siteCount} Commercial Retail Facilities` : (agreement.systemCount ? `${agreement.systemCount} Systems` : 'Turnkey Scope')}</p>
                                    <p className="mt-1"><strong>Marketing / Broker Deduction:</strong> {agreement.salesMarketingFeePct ? `${agreement.salesMarketingFeePct}% on all processed invoices` : 'None'}</p>
                                    <p className="mt-1"><strong>Status:</strong> {agreement.status}</p>
                                </div>
                            </div>
                            {agreement.notes && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                    <strong>Operational Notes:</strong> {agreement.notes}
                                </div>
                            )}
                        </div>

                        {/* Signers Block */}
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                                    Execution Verification
                                </span>
                                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                                    {agreement.signers || 'Authorized Signature: Roderick MacDonell | Countersigned: Authorized Representative'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Effective Date: {formatAgreementDate(agreement)} &bull; Verified Authenticity
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <CheckCircle2 size={14} /> Executed
                            </span>
                        </div>
                    </div>
                )}

                {/* TAB 2: Executed Contract Document */}
                {activeTab === 'document' && (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[60vh] overflow-y-auto">
                            <div 
                                dangerouslySetInnerHTML={{ 
                                    __html: DOMPurify.sanitize(resolveContractHtml()) 
                                }} 
                            />
                        </div>
                    </div>
                )}

                {/* Modal Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default AgreementViewerModal;
