
import React, { useRef, useState } from 'react';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, ExternalLink, CreditCard, FileText, X } from 'lucide-react';
import type { Proposal, Job, Organization, Address } from 'types';
import Button from './Button';
import { db } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other';
    data: Proposal | Job | any;
    onClose: () => void;
    isInternal?: boolean; // If true, hides customer-facing tools like financing
    organization?: Organization | null; // Optional override for platform invoices
}

const formatAddress = (addr: Address | string | undefined): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization }) => {
    const { state, dispatch } = useAppContext();
    
    // Use passed org or fallback to context
    const org = organization || state.currentOrganization;
    
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);

    const isProposal = type === 'Proposal';
    const isOther = type === 'Other';
    const prop = isProposal ? data as Proposal : null;
    const job = (!isProposal && !isOther) ? data as Job : null;
    
    const rawItems = isProposal ? prop?.items || [] : job?.invoice?.items || [];
    // If no option is selected on the proposal, default to the tier of the first item.
    const activeTier = prop?.selectedOption || (rawItems.length > 0 ? (rawItems[0] as any).tier : undefined);
    
    // Items Mapping
    const items = rawItems.filter((i: any) => !isProposal || i.tier === activeTier).map((item: any) => ({
        id: item.id,
        name: item.name || item.title || (isProposal ? '' : item.description),
        description: item.name ? item.description : undefined,
        quantity: item.quantity || 1,
        unitPrice: isProposal ? item.price : item.unitPrice,
        total: item.total || ((isProposal ? item.price : item.unitPrice) * (item.quantity || 1))
    }));

    const total = (isProposal ? prop?.total : (job?.invoice?.totalAmount || job?.invoice?.amount)) || 0;
    const subtotal = (isProposal ? prop?.subtotal : job?.invoice?.subtotal) || 0;
    const tax = (isProposal ? prop?.taxAmount : job?.invoice?.taxAmount) || 0;
    const customerName = isProposal ? prop?.customerName : (isOther ? (data.customerName || '') : job?.customerName);
    
    const addressObj = isProposal ? (state.customers.find(c => c.name === prop?.customerName)?.address) : (isOther ? (data.address || '') : job?.address);
    const address = formatAddress(addressObj);

    const date = isProposal ? (prop?.createdAt || new Date().toISOString()) : (isOther ? (data.createdAt || data.timestamp || new Date().toISOString()) : job?.appointmentTime);
    const id = isProposal ? (prop?.id || 'DRAFT') : (isOther ? (data.id || 'DOC-PREVIEW') : job?.invoice?.id);
    const status = isProposal ? prop?.status : (isOther ? 'Signed' : job?.invoice?.status);
    const signature = isProposal 
        ? (prop?.signatureDataUrl || prop?.signature) 
        : (isOther 
            ? (data?.signatureImage || data?.signatureDataUrl || data?.signature || null) 
            : (job?.invoiceSignature || null));

    const handleConvertToJob = async () => {
        if (!isProposal || !prop || !state.currentOrganization) return;
        if (!await globalConfirm(`Convert this proposal for ${prop.customerName} into an active Job/Invoice?`)) return;

        setIsConverting(true);
        const customer = state.customers.find(c => c.name === prop.customerName);
        const jobId = `job-${Date.now()}`;
        
        const newJob: Job = {
            id: jobId,
            organizationId: state.currentOrganization.id,
            customerName: prop.customerName,
            customerId: customer?.id || null,
            address: addressObj || '', // Pass the object or string directly
            tasks: items.map(i => i.name),
            jobStatus: 'Scheduled',
            appointmentTime: new Date().toISOString(),
            invoice: {
                id: `INV-${Date.now()}`,
                items: items.map(i => ({
                    id: i.id,
                    description: i.name,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    total: i.total,
                    type: 'Part'
                })),
                subtotal,
                taxRate: (state.currentOrganization.taxRate || 8.25) / 100,
                taxAmount: tax,
                totalAmount: total,
                amount: total,
                status: 'Unpaid'
            },
            jobEvents: [],
            specialInstructions: `Auto-converted from Proposal #${prop.id}`,
            source: 'ProposalConversion',
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(jobId).set(newJob);
            dispatch({ type: 'ADD_JOB', payload: newJob });
            alert("Job/Invoice created successfully! View in Operations.");
            onClose();
        } catch (e) {
            console.error(e);
            alert("Conversion failed.");
        } finally {
            setIsConverting(false);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const win = window.open('', '', 'width=1000,height=1300');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>${type} - ${id}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 0; margin: 0; color: #1e293b; background: #f1f5f9; line-height: 1.5; }
                            .page { width: 8.5in; min-height: 11in; padding: 0.75in; margin: 1in auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
                            .prose { max-width: none; font-size: 14px; color: #334155; }
                            .prose h3 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                            .prose p { margin-bottom: 1em; text-align: justify; }
                            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8; }
                            @media print {
                                body { background: white; padding: 0; margin: 0; }
                                .page { margin: 0; box-shadow: none; border: none; width: 100%; height: auto; min-height: 0; page-break-after: always; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="page">
                            ${printRef.current.innerHTML}
                        </div>
                        <script>
                            window.onload = function() { setTimeout(() => { window.print(); }, 500); };
                        </script>
                    </body>
                </html>
            `);
            win.document.close();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 shadow-xl p-3 md:p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 min-h-[5rem] md:h-20">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-primary-600 p-1.5 md:p-2 rounded-xl text-white shadow-lg shadow-primary-500/20">
                        <FileText size={20} className="md:w-6 md:h-6"/>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">Reviewing {type}</h2>
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest truncate">ID: #{id}</p>
                    </div>
                </div>
                <div className="flex gap-2 md:gap-4">
                    <button onClick={onClose} className="text-[10px] md:text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-2 md:px-6">Close</button>
                    {isProposal && status === 'Accepted' && isInternal && (
                        <Button onClick={handleConvertToJob} disabled={isConverting} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black shadow-xl shadow-emerald-500/20">
                            <ArrowRight size={14} className="md:w-4 md:h-4"/> {isConverting ? '...' : 'Convert'}
                        </Button>
                    )}
                    <Button onClick={handlePrint} className="flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black shadow-xl shadow-primary-500/20">
                        <Printer size={14} className="md:w-4 md:h-4"/> Print
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-12 flex justify-center custom-scrollbar bg-slate-100 dark:bg-slate-900">
                <div 
                    ref={printRef}
                    className="bg-white text-slate-900 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[8.5in] p-4 md:p-16 box-border relative overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] h-fit mb-12"
                >
                    <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                    
                    <div className="relative z-10 pb-20">
                        {/* Header */}
                        <div className="header flex flex-col md:flex-row justify-between mb-8 md:mb-[60px] gap-6 md:gap-0">
                            <div className="logo-area text-center md:text-left">
                                {org?.logoUrl ? (
                                    <img src={org.logoUrl} alt="Company Logo" className="logo-img inline-block md:block" />
                                ) : org?.letterheadDataUrl ? (
                                    <img src={org.letterheadDataUrl} alt="Company Logo" className="logo-img inline-block md:block" />
                                ) : (
                                    <h1 className="branding-h1 text-2xl font-extrabold m-0 text-primary-600 dark:text-primary-400">{org?.name}</h1>
                                )}
                                {org?.licenseNumber && (
                                    <div className="license-badge">Licence # {org.licenseNumber}</div>
                                )}
                            </div>
                            <div className="doc-meta text-center md:text-right">
                                <div className="doc-type-badge">{type.toUpperCase()}</div>
                                <div className="meta-grid">
                                    <span className="meta-label">ID</span>
                                    <span className="meta-value">#{id}</span>
                                    <span className="meta-label">Date</span>
                                    <span className="meta-value">{new Date(date).toLocaleDateString()}</span>
                                    <span className="meta-label">Status</span>
                                    <span className="meta-value-status">{status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Billing Blocks */}
                        <div className="billing-info flex flex-col md:flex-row justify-between mb-8 md:mb-[50px] gap-4 md:gap-10">
                            <div className="info-block">
                                <div className="info-title">Bill To</div>
                                <div className="info-name">{customerName}</div>
                                <div className="info-text">{address}</div>
                            </div>
                            <div className="info-block">
                                <div className="info-title">From</div>
                                <div className="info-name">{org?.name}</div>
                                <div className="info-text">{org?.address?.street}</div>
                                <div className="info-text">{org?.address?.city}, {org?.address?.state} {org?.address?.zip}</div>
                                {org?.phone && <div className="info-text-mt">{org.phone}</div>}
                            </div>
                        </div>

                        {/* Table or Content */}
                        {isOther ? (
                            <div className="extra-section bg-[#f8fafc] p-5 md:p-8 rounded-[20px] md:rounded-[32px] mb-10 border border-slate-100 min-h-[4in]">
                                <div className="terms-title">{data.title || 'Document Content'}</div>
                                {data.htmlContent ? (
                                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.htmlContent) }} />
                                ) : (data.url || data.dataUrl) && (
                                    (data.url?.toLowerCase().includes('.html')) || 
                                    (data.dataUrl?.includes('text/html')) ||
                                    (data.fileName?.toLowerCase().endsWith('.html'))
                                ) ? (
                                    <iframe 
                                        srcDoc={data.dataUrl?.includes('base64,') ? decodeURIComponent(escape(atob(data.dataUrl.split('base64,')[1]))) : data.dataUrl}
                                        src={!data.dataUrl ? data.url : undefined} 
                                        className="w-full h-[700px] border-none rounded-2xl bg-white" 
                                        title="Document Preview"
                                    />
                                ) : (
                                    <div className="terms-content">{data.content || data.body || 'No content available for this document.'}</div>
                                )}
                            </div>
                        ) : (
                            <div className="table-area overflow-x-auto">
                                <table className="doc-table">
                                    <thead className="doc-thead">
                                        <tr>
                                            <th className="doc-th-item">Item & Services</th>
                                            <th className="doc-th-qty">Qty</th>
                                            <th className="doc-th-price">Price</th>
                                            <th className="doc-th-price text-right w-[110px]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="doc-tbody">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="doc-tr">
                                                <td className="doc-td-item">
                                                    <div className="item-name">{item.name}</div>
                                                    {item.description && <div className="item-desc">{item.description}</div>}
                                                </td>
                                                <td className="doc-td-qty">{item.quantity}</td>
                                                <td className="doc-td-price">${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="doc-td-total">${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Summary (Only for Proposal/Invoice) */}
                        {!isOther && (
                            <div className="summary-grid flex justify-end mb-10 md:mb-[60px]">
                                <div className="summary-box w-full md:w-[320px]">
                                    <div className="summary-row flex justify-between py-2 border-b border-dashed border-slate-200 text-[13px]">
                                        <span className="summary-label text-slate-500 font-bold">Subtotal</span>
                                        <span className="font-extrabold">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="summary-row flex justify-between py-2 border-b border-dashed border-slate-200 text-[13px]">
                                        <span className="summary-label text-slate-500 font-bold">Estimated Tax</span>
                                        <span className="font-extrabold">${tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="summary-row grand-total flex justify-between pt-4 mt-2 text-[22px] font-extrabold text-slate-900">
                                        <span className="text-primary-600 dark:text-primary-400">Total</span>
                                        <span className="tracking-tighter">${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                    
                                    {org?.financingLink && (
                                        <div className="mt-[25px] text-center">
                                            <a href={org.financingLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-sky-600 text-white p-3 rounded-xl no-underline font-extrabold text-xs uppercase tracking-widest shadow-[0_10px_15px_-3px_rgba(2,132,199,0.2)]">
                                                <CreditCard size={16}/> Financing Available
                                            </a>
                                            <p className="text-[9px] text-slate-400 mt-2 font-semibold">Click to view financing options.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {org?.termsAndConditions && !isOther && (
                            <div className="extra-section bg-[#f8fafc] p-5 md:p-8 rounded-[20px] md:rounded-[32px] mb-10">
                                <div className="terms-title text-[10px] font-extrabold tracking-widest uppercase text-slate-900 mb-2.5">Terms & Conditions</div>
                                <div className="terms-content text-[11px] text-slate-500 text-justify leading-relaxed">{org.termsAndConditions}</div>
                            </div>
                        )}

                        <div className="signature-area flex flex-col md:flex-row justify-between items-center md:items-end mt-12 md:mt-[80px]">
                            <div className="text-center md:text-left">
                                {signature ? (
                                    <div>
                                        <img src={signature} alt="Client Signature" className="sig-img mx-auto md:ml-0 max-h-[80px] -mb-[15px]" />
                                        <div className="sig-placeholder w-[260px] border-t-2 border-slate-900 pt-2.5">
                                            <div className="sig-label text-[9px] font-extrabold uppercase text-slate-400">Authorized Client Signature</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="sig-placeholder w-[260px] border-t-2 border-slate-900 pt-2.5 h-[35px]">
                                        <div className="sig-label text-[9px] font-extrabold uppercase text-slate-400">Authorized Client Signature</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {org?.complianceFooter && (
                             <div className="legal-footer text-[8px] text-slate-400 mt-10 text-center">
                                 {org.complianceFooter}
                             </div>
                        )}

                        {org?.footerImage && (
                            <div className="footer-image-container flex justify-center mt-12 pt-8 border-t border-[#f1f5f9]">
                                <img src={org.footerImage} alt="Company Footer" className="max-w-full h-auto rounded-xl" />
                            </div>
                        )}

                        <div className="footer mt-10 pt-8 border-t border-[#f1f5f9] text-center text-[#94a3b8] text-[10px]">
                            <div className="footer-branding font-extrabold text-[#64748b] mb-1">{org?.name.toUpperCase()} PLATFORM</div>
                            <p className="m-0">Generated by TekTrakker on {new Date().toLocaleString()}</p>
                            <div className="flex justify-center items-center gap-1.5 mt-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                <img src={`${window.location.origin}/tektrakker-icon.png`} alt="TekTrakker Logo" width="14" /> 
                                <span>Powered by TekTrakker</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentPreview;
