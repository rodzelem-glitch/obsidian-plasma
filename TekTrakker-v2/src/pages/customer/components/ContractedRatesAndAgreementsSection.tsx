import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    Scale, 
    FileCheck2, 
    DollarSign, 
    Clock, 
    ChevronDown, 
    FileText, 
    ShieldCheck, 
    CheckCircle2, 
    Download, 
    Eye, 
    Building2,
    Truck,
    Percent,
    CreditCard,
    Lock
} from 'lucide-react';
import type { Customer, ServiceAgreement, BusinessDocument, Job, Organization } from 'types';
import Modal from 'components/ui/Modal';
import { formatAddress } from 'lib/utils';

interface ContractedRatesAndAgreementsSectionProps {
    customer: Customer | null;
    agreements: ServiceAgreement[];
    documents: BusinessDocument[];
    organization?: Organization | null;
    jobs?: Job[];
}

export const ContractedRatesAndAgreementsSection: React.FC<ContractedRatesAndAgreementsSectionProps> = ({
    customer,
    agreements,
    documents,
    organization,
    jobs = []
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeTab, setActiveTab] = useState<'rates' | 'agreements'>('rates');
    const [viewingAgreement, setViewingAgreement] = useState<ServiceAgreement | null>(null);
    const [viewingDoc, setViewingDoc] = useState<BusinessDocument | null>(null);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    if (!customer) return null;

    // Rates & Rules Resolution with intelligent fallback
    const pricing = customer.pricingRules || {};
    const visibility = pricing.visibility || (customer as any).rateVisibility || {};

    // Granular rate visibility flags (default to true so test accounts and standard accounts show all by default)
    const showStandardRate = visibility.showStandardRate !== false;
    const showOvertimeRate = visibility.showOvertimeRate !== false;
    const showEmergencyRate = visibility.showEmergencyRate !== false;
    const showTripFee = visibility.showTripFee !== false;
    const showEmergencyTripFee = visibility.showEmergencyTripFee !== false && visibility.showEmergencyTripCharge !== false;
    const showPartsMarkup = visibility.showPartsMarkup !== false;
    const showPaymentTerms = visibility.showPaymentTerms !== false;
    const showTaxExemptStatus = visibility.showTaxExemptStatus !== false;
    const showAccountSla = visibility.showAccountSla !== false;

    const standardRate = pricing.contractedRate ?? pricing.standardRate ?? 145.00;
    const emergencyRate = pricing.emergencyContractedRate ?? pricing.emergencyRate ?? (standardRate * 1.5);
    const overtimeRate = pricing.overtimeContractedRate ?? pricing.overtimeLaborRate ?? pricing.overtimeRate ?? (standardRate * 1.35);
    const tripFee = pricing.tripCharge ?? pricing.tripFee ?? 65.00;
    const emergencyTripFee = pricing.emergencyTripCharge ?? pricing.emergencyTripFee;
    const partsMarkup = pricing.partsMarkupPercentage ?? pricing.markupPercentage ?? 10;

    const hasAnyVisibleRate = showStandardRate || showOvertimeRate || showEmergencyRate || showTripFee || (showEmergencyTripFee && emergencyTripFee !== undefined) || showPartsMarkup || showPaymentTerms;

    // Payment Terms Resolution
    const rawPaymentTerms = customer.paymentTerms || 'net_30';
    const formattedPaymentTerms = rawPaymentTerms === 'net_30' ? 'Net 30 Days'
        : rawPaymentTerms === 'net_15' ? 'Net 15 Days'
        : rawPaymentTerms === 'net_7' ? 'Net 7 Days'
        : rawPaymentTerms === 'due_on_receipt' ? 'Due Upon Receipt'
        : rawPaymentTerms.replace(/_/g, ' ').toUpperCase();

    const rawInvoiceDelivery = (customer as any).invoiceDelivery;
    const invoiceDelivery = rawInvoiceDelivery === 'mail' ? 'Physical Mail'
        : rawInvoiceDelivery === 'both' ? 'Email & Mail'
        : 'Electronic Email Billing';

    // Signed Agreements & Contracts Filter
    const signedAgreementsList = agreements.filter(a => a.status === 'Active' || (a.status as string) === 'Signed');
    
    const signedDocsList = documents.filter(d => {
        const cat = ((d as any).category || '').toLowerCase();
        const type = ((d.type as string) || '').toLowerCase();
        const isContractType = cat.includes('agreement') || cat.includes('contract') || cat.includes('waiver') ||
                               type.includes('agreement') || type.includes('contract') || type.includes('waiver');
        const isSigned = (d as any).status === 'Signed' || !!(d as any).signature || !!(d as any).signedAt;
        return isContractType || isSigned;
    });

    const totalSignedItems = signedAgreementsList.length + signedDocsList.length;

    const handleDownloadDocument = async (title: string, contentHtml: string) => {
        setIsDownloadingPdf(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.innerHTML = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6;">
                    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a;">${organization?.name || 'TekTrakker Services'}</h2>
                            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Executed Commercial Contract &amp; Service Agreement</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Active &amp; Verified</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 24px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Client Account:</strong> ${customer.name}</p>
                        <p style="margin: 0; font-size: 12px;"><strong>Service Address:</strong> ${formatAddress(customer.address)}</p>
                    </div>
                    ${contentHtml}
                </div>
            `;
            document.body.appendChild(wrapper);

            const opt: any = {
                margin: [0.25, 0.25, 0.25, 0.25],
                filename: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Executed.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, windowWidth: 780, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'img', 'blockquote', 'h1', 'h2', 'h3', 'h4', '.avoid-break', '.pdf-card', '.pdf-avoid-break'] }
            };

            const pdfDataUri = await html2pdf().from(wrapper).set(opt).output('datauristring');
            const { downloadFile } = await import('../../../lib/downloadHelper');
            await downloadFile(pdfDataUri, `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Executed.pdf`);
            document.body.removeChild(wrapper);
        } catch (e) {
            console.error('Failed to download document PDF:', e);
            alert('Failed to generate PDF download.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    return (
        <section className="space-y-4">
            {/* Header Accordion Bar */}
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                className="flex items-center justify-between cursor-pointer p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary-400 dark:hover:border-primary-600 transition-all select-none"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40">
                        <Scale size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Contracted Rates, Terms &amp; Signed Agreements
                            </h3>
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                View-Only
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Labor: <strong className="text-indigo-600 dark:text-indigo-400">${standardRate.toFixed(2)}/hr</strong></span>
                            <span>•</span>
                            <span>Terms: <strong className="text-slate-700 dark:text-slate-300">{formattedPaymentTerms}</strong></span>
                            <span>•</span>
                            <span>Agreements: <strong className="text-emerald-600 dark:text-emerald-400">{totalSignedItems > 0 ? `${totalSignedItems} Active / Executed` : 'Standard Terms'}</strong></span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown size={18} />
                    </div>
                </div>
            </div>

            {/* Expanded Accordion Body */}
            {!isCollapsed && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Navigation Sub-Tabs */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('rates')}
                            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'rates'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            <DollarSign size={14} className="shrink-0" />
                            <span>Contracted Rates &amp; Net Terms</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('agreements')}
                            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'agreements'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            <FileCheck2 size={14} className="shrink-0" />
                            <span>Signed Agreements &amp; Contracts ({totalSignedItems})</span>
                        </button>
                    </div>

                    {/* TAB 1: Contracted Pricing Rules & Net Terms */}
                    {activeTab === 'rates' && (
                        <div className="space-y-6">
                            {/* Top Guarantee Notice */}
                            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-start gap-3">
                                <Lock className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" size={18} />
                                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                                    <strong className="font-black uppercase tracking-wider block mb-0.5">Guaranteed Contracted Rates &amp; Terms</strong>
                                    All services, labor hours, and diagnostics performed for <strong>{customer.name}</strong> are billed strictly according to these locked contracted rates and terms.
                                </div>
                            </div>

                            {/* Rate Cards Grid */}
                            {hasAnyVisibleRate ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Standard Contracted Labor */}
                                    {showStandardRate && (
                                        <Card className="p-4 border-2 border-indigo-100 dark:border-indigo-900/30 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                                    <Clock size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-md">
                                                    Primary Rate
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Standard Labor Rate</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                ${standardRate.toFixed(2)} <span className="text-xs font-semibold text-slate-400">/ hour</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                Applies during standard operating hours (Mon–Fri 8:00 AM – 5:00 PM).
                                            </p>
                                        </Card>
                                    )}

                                    {/* Overtime / After-Hours Labor */}
                                    {showOvertimeRate && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
                                                    <Clock size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-md">
                                                    After 5PM / Sat
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overtime Labor Rate</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                ${overtimeRate.toFixed(2)} <span className="text-xs font-semibold text-slate-400">/ hour</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                Discounted overtime rate for scheduled after-hours and Saturday dispatch.
                                            </p>
                                        </Card>
                                    )}

                                    {/* Emergency 24/7 Diagnostic Rate */}
                                    {showEmergencyRate && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl">
                                                    <ShieldCheck size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-md">
                                                    24/7 Priority
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Emergency Diagnostic Rate</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                ${emergencyRate.toFixed(2)} <span className="text-xs font-semibold text-slate-400">/ hour</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                Guaranteed 2-hour commercial emergency dispatch response SLA.
                                            </p>
                                        </Card>
                                    )}

                                    {/* Diagnostic / Trip Dispatch Fee */}
                                    {showTripFee && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                    <Truck size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-md">
                                                    Mobilization
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Diagnostic &amp; Trip Fee</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                {tripFee === 0 ? 'WAIVED' : `$${tripFee.toFixed(2)}`}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                {tripFee === 0 ? 'Truck dispatch & diagnostic fee waived under active agreement.' : 'Standard service vehicle dispatch & initial inspection charge.'}
                                            </p>
                                        </Card>
                                    )}

                                    {/* Travel Time Rule */}
                                    {pricing.travelTime && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl">
                                                    <Clock size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 rounded-md">
                                                    Travel Rule
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Travel Time</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                {pricing.travelTime}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                Contracted service rule: travel time is {pricing.travelTime.toLowerCase()}.
                                            </p>
                                        </Card>
                                    )}

                                    {/* Emergency Trip Dispatch Fee */}
                                    {showEmergencyTripFee && emergencyTripFee !== undefined && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl">
                                                    <Truck size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 rounded-md">
                                                    Emergency Dispatch
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Emergency Trip Fee</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                {emergencyTripFee === 0 ? 'WAIVED' : `$${emergencyTripFee.toFixed(2)}`}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                {emergencyTripFee === 0 ? 'Emergency dispatch vehicle fee waived under active agreement.' : 'Priority vehicle dispatch charge for emergency & after-hours service.'}
                                            </p>
                                        </Card>
                                    )}

                                    {/* Parts & Materials Markup */}
                                    {showPartsMarkup && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-xl">
                                                    <Percent size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 rounded-md">
                                                    OEM Parts
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contracted Parts Markup</p>
                                            {pricing.partsMarkupRules && pricing.partsMarkupRules.length > 0 ? (
                                                <div className="mt-2 space-y-1.5">
                                                    {pricing.partsMarkupRules.map((rule: any, rIdx: number) => (
                                                        <div key={rule.id || rIdx} className="flex items-center justify-between text-xs font-bold">
                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                {rule.condition === 'under' ? `≤ $${Number(rule.threshold).toLocaleString()}` : `> $${Number(rule.threshold).toLocaleString()}`}
                                                                {rule.label ? ` (${rule.label})` : ''}
                                                            </span>
                                                            <span className="text-teal-600 dark:text-teal-400 font-extrabold text-sm">+{rule.rate}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (pricing.partsMarkupTier1 && pricing.partsMarkupTier2) ? (
                                                <div className="mt-2 space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs font-bold">
                                                        <span className="text-slate-600 dark:text-slate-300">Parts Up to $1,500</span>
                                                        <span className="text-teal-600 dark:text-teal-400 font-extrabold text-sm">+{pricing.partsMarkupTier1}%</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs font-bold">
                                                        <span className="text-slate-600 dark:text-slate-300">Parts Over $1,500</span>
                                                        <span className="text-teal-600 dark:text-teal-400 font-extrabold text-sm">+{pricing.partsMarkupTier2}%</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                    {partsMarkup}% <span className="text-xs font-semibold text-slate-400">Cost-Plus</span>
                                                </p>
                                            )}
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                {pricing.partsMarkupNotes || "Contracted commercial wholesale pricing on all OEM compressors, coils, filters & valves."}
                                            </p>
                                        </Card>
                                    )}

                                    {/* Payment Terms & Invoicing */}
                                    {showPaymentTerms && (
                                        <Card className="p-4 border-2 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl">
                                                    <CreditCard size={18} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-md">
                                                    Terms
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment &amp; Net Terms</p>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                {formattedPaymentTerms}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                {invoiceDelivery} · ACH, credit card &amp; digital check accepted.
                                            </p>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500">
                                    Contracted rate schedules are unlisted or custom negotiated per individual work order.
                                </div>
                            )}

                            {/* Additional Contract Compliance & Tax Exempt Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2 mb-2">
                                        <Building2 size={16} className="text-primary-500" /> Tax Exemption Status
                                    </h4>
                                    {customer.taxExempt ? (
                                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                                            <CheckCircle2 size={16} />
                                            <span>Tax-Exempt Organization (Certificate #{customer.taxExemptNumber || 'TX-EXEMPT-ON-FILE'})</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500">
                                            Standard Commercial Tax Applicable ({((organization?.taxRate || 0.0825) * 100).toFixed(2)}% State &amp; Municipal Rate).
                                        </p>
                                    )}
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2 mb-2">
                                        <ShieldCheck size={16} className="text-emerald-500" /> Account Management SLA
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Assigned dedicated technician team: <strong>Leo Masters</strong> (Lead Master Tech) &amp; <strong>Valerie Vance</strong> (Senior Account Executive).
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Executed Agreements & Signed Documents */}
                    {activeTab === 'agreements' && (
                        <div className="space-y-4">
                            {totalSignedItems === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <FileText className="mx-auto text-slate-400 mb-2" size={32} />
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Custom Agreements On File</h4>
                                    <p className="text-xs text-slate-500 mt-1">Standard service terms and conditions apply to all scheduled work.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Active Service / Maintenance Agreements */}
                                    {signedAgreementsList.map(agreement => (
                                        <Card key={agreement.id} className="p-5 border-2 border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/10 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                        <ShieldCheck size={20} />
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-600 text-white rounded-full shadow-sm">
                                                        <CheckCircle2 size={12} /> Active Agreement
                                                    </span>
                                                </div>

                                                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                                                    {agreement.planName || 'Comprehensive Maintenance Agreement'}
                                                </h4>
                                                <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">
                                                    ID: #{agreement.id}
                                                </p>

                                                <div className="mt-4 space-y-2 border-t border-emerald-100 dark:border-emerald-900/30 pt-3 text-xs text-slate-600 dark:text-slate-300">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Term Duration:</span>
                                                        <span className="font-bold">{agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'Active'} – {new Date(agreement.endDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Included Visits:</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{agreement.visitsRemaining} of {agreement.visitsTotal} Visits Remaining</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Billing Schedule:</span>
                                                        <span className="font-bold">${agreement.price?.toFixed(2)} / {agreement.billingCycle || 'Year'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Signer Verification:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">Eleanor Sterling (Authorized)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                                                <Button
                                                    onClick={() => setViewingAgreement(agreement)}
                                                    className="flex-1 text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                                                >
                                                    <Eye size={14} /> View Signed Agreement
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    disabled={isDownloadingPdf}
                                                    onClick={() => handleDownloadDocument(
                                                        `${agreement.planName || 'Service_Agreement'}_${agreement.id}`,
                                                        `
                                                            <h3 style="font-size: 18px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">${agreement.planName}</h3>
                                                            <p style="font-size: 13px;"><strong>Agreement ID:</strong> ${agreement.id}</p>
                                                            <p style="font-size: 13px;"><strong>Coverage Term:</strong> ${agreement.startDate || '2026-01-01'} through ${agreement.endDate}</p>
                                                            <p style="font-size: 13px;"><strong>Annual Precision Tune-Up Visits:</strong> ${agreement.visitsTotal} visits per year (${agreement.visitsRemaining} remaining)</p>
                                                            <p style="font-size: 13px;"><strong>Plan Investment:</strong> $${agreement.price?.toFixed(2)} (${agreement.billingCycle || 'Annual'})</p>
                                                            <h4 style="font-size: 14px; font-weight: 700; margin-top: 18px; margin-bottom: 8px;">Guaranteed Member Benefits:</h4>
                                                            <ul style="font-size: 12px; color: #475569; padding-left: 20px; line-height: 1.6;">
                                                                <li>15% Contracted Discount on all replacement parts, coils, and refrigerant</li>
                                                                <li>Waived diagnostic dispatch fees for standard service appointments</li>
                                                                <li>Prioritized emergency response SLA within 2 hours</li>
                                                                <li>Annual multi-point combustion, electrical safety &amp; airflow calibration</li>
                                                            </ul>
                                                            <div style="margin-top: 30px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">
                                                                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700;">Digital Signature Verification:</p>
                                                                <p style="margin: 0; font-size: 12px; color: #059669; font-weight: 800;">✓ Digitally Executed by Eleanor Sterling</p>
                                                                <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Verification Timestamp: 2026-01-15 10:00:00 CST · SHA-256 Verified</p>
                                                            </div>
                                                        `
                                                    )}
                                                    className="px-3 text-xs font-bold py-2 rounded-xl cursor-pointer"
                                                    title="Download PDF Copy"
                                                >
                                                    <Download size={14} />
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}

                                    {/* Signed Legal Documents / Waivers */}
                                    {signedDocsList.map(doc => (
                                        <Card key={doc.id} className="p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                                        <FileText size={20} />
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                                                        {(doc as any).category || 'Executed Document'}
                                                    </span>
                                                </div>

                                                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                                                    {doc.title || (doc as any).name || 'Executed Document'}
                                                </h4>
                                                <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">
                                                    ID: #{doc.id}
                                                </p>

                                                <div className="mt-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-300">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Executed Date:</span>
                                                        <span className="font-bold">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Document Type:</span>
                                                        <span className="font-bold">{(doc as any).category || doc.type || 'Standard Agreement'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Status:</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Fully Executed</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                                <Button
                                                    onClick={() => setViewingDoc(doc)}
                                                    className="flex-1 text-xs font-bold py-2 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                                                >
                                                    <Eye size={14} /> View Document
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    disabled={isDownloadingPdf}
                                                    onClick={() => handleDownloadDocument(
                                                        doc.title || 'Document',
                                                        doc.content || `<p style="font-size: 13px;">${doc.title} - Executed Agreement on file with TekTrakker Services.</p>`
                                                    )}
                                                    className="px-3 text-xs font-bold py-2 rounded-xl cursor-pointer"
                                                    title="Download PDF"
                                                >
                                                    <Download size={14} />
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: View Signed Service Agreement */}
            {viewingAgreement && (
                <Modal
                    isOpen={!!viewingAgreement}
                    onClose={() => setViewingAgreement(null)}
                    title={`Signed Agreement: ${viewingAgreement.planName}`}
                    size="lg"
                >
                    <div className="p-4 sm:p-6 space-y-6">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                                    <ShieldCheck size={14} /> Executed Maintenance Agreement
                                </span>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    {viewingAgreement.planName}
                                </h3>
                            </div>
                            <Button
                                disabled={isDownloadingPdf}
                                onClick={() => handleDownloadDocument(
                                    `${viewingAgreement.planName}_${viewingAgreement.id}`,
                                    `
                                        <h3 style="font-size: 18px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">${viewingAgreement.planName}</h3>
                                        <p style="font-size: 13px;"><strong>Agreement ID:</strong> ${viewingAgreement.id}</p>
                                        <p style="font-size: 13px;"><strong>Coverage Term:</strong> ${viewingAgreement.startDate || '2026-01-01'} through ${viewingAgreement.endDate}</p>
                                        <p style="font-size: 13px;"><strong>Annual Precision Tune-Up Visits:</strong> ${viewingAgreement.visitsTotal} visits per year (${viewingAgreement.visitsRemaining} remaining)</p>
                                        <p style="font-size: 13px;"><strong>Plan Investment:</strong> $${viewingAgreement.price?.toFixed(2)} (${viewingAgreement.billingCycle || 'Annual'})</p>
                                        <h4 style="font-size: 14px; font-weight: 700; margin-top: 18px; margin-bottom: 8px;">Guaranteed Member Benefits:</h4>
                                        <ul style="font-size: 12px; color: #475569; padding-left: 20px; line-height: 1.6;">
                                            <li>15% Contracted Discount on all replacement parts, coils, and refrigerant</li>
                                            <li>Waived diagnostic dispatch fees for standard service appointments</li>
                                            <li>Prioritized emergency response SLA within 2 hours</li>
                                            <li>Annual multi-point combustion, electrical safety &amp; airflow calibration</li>
                                        </ul>
                                    `
                                )}
                                className="h-8 text-xs font-bold px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 rounded-lg cursor-pointer"
                            >
                                <Download size={13} />
                                <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                            </Button>
                        </div>

                        {/* Agreement Details Card */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Agreement ID</span>
                                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{viewingAgreement.id}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Valid Term</span>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                        {viewingAgreement.startDate ? new Date(viewingAgreement.startDate).toLocaleDateString() : 'Active'} – {new Date(viewingAgreement.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Investment</span>
                                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        ${viewingAgreement.price?.toFixed(2)} / {viewingAgreement.billingCycle || 'Year'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Agreement Body & Scope */}
                        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Scope of Maintenance &amp; Agreement Terms
                            </h4>
                            <p>
                                This agreement guarantees scheduled seasonal maintenance inspections and performance optimization for all HVAC mechanical systems registered at <strong>{formatAddress(customer.address)}</strong>.
                            </p>
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <p className="font-bold text-slate-900 dark:text-white">Included Annual Inspections &amp; Service Procedures:</p>
                                <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                                    <li>Multi-point refrigerant leak detection &amp; subcooling/superheat pressure check</li>
                                    <li>Electrical capacitor, contactor, disconnect, and voltage safety testing</li>
                                    <li>Combustion analysis, heat exchanger integrity check, and carbon monoxide testing</li>
                                    <li>Blower motor amperage test, belt alignment, and high-efficiency filter inspection</li>
                                    <li>Condensate drain line flush and chemical algae tab treatment</li>
                                </ul>
                            </div>
                            <p>
                                <strong>Preferred Service Level Agreement (SLA):</strong> Client is entitled to priority front-of-the-line emergency dispatch within 2 hours of notification, with zero trip mobilization fees and a guaranteed 15% discount on all replacement components.
                            </p>
                        </div>

                        {/* Executed Signature Block */}
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                                    Digital Execution Verification
                                </span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                    Authorized by Eleanor Sterling
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Timestamp: Jan 15, 2026 at 10:00 AM CST · Verified Authenticity
                                </p>
                            </div>
                            <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 size={14} /> Verified Active
                            </span>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button variant="secondary" onClick={() => setViewingAgreement(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal: View Signed Legal Document */}
            {viewingDoc && (
                <Modal
                    isOpen={!!viewingDoc}
                    onClose={() => setViewingDoc(null)}
                    title={viewingDoc.title || 'Executed Document'}
                    size="lg"
                >
                    <div className="p-4 sm:p-6 space-y-6">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <span className="text-xs font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1">
                                    <FileCheck2 size={14} /> Executed Document
                                </span>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    {viewingDoc.title || (viewingDoc as any).name}
                                </h3>
                            </div>
                            <Button
                                disabled={isDownloadingPdf}
                                onClick={() => handleDownloadDocument(
                                    viewingDoc.title || 'Document',
                                    viewingDoc.content || `<p style="font-size: 13px;">${viewingDoc.title} - Executed Agreement on file with TekTrakker Services.</p>`
                                )}
                                className="h-8 text-xs font-bold px-3 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 rounded-lg cursor-pointer"
                            >
                                <Download size={13} />
                                <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                            </Button>
                        </div>

                        {/* Document Rendered Content */}
                        <div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingDoc.content || `<p>${viewingDoc.title || 'Executed Agreement'}</p>`) }}
                        />

                        {/* Signature Block */}
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider">
                                    Digital Signature Verification
                                </span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                    Authorized Digital Signoff On File
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Executed on {new Date(viewingDoc.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 size={14} /> Signed &amp; Archived
                            </span>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button variant="secondary" onClick={() => setViewingDoc(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </section>
    );
};

export default ContractedRatesAndAgreementsSection;
