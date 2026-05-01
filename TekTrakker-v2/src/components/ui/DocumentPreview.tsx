import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";
import React, { useRef, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, CreditCard, FileText } from 'lucide-react';
import type { Proposal, Job, Organization, Address } from 'types';
import Button from './Button';
import { db } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';
import { Printer as CapacitorPrinter } from '@capgo/capacitor-printer';
import { Capacitor } from '@capacitor/core';

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other';
    data: Proposal | Job | any;
    onClose: () => void;
    isInternal?: boolean;
    organization?: Organization | null;
    onSelectTier?: (tier: string) => void;
}

const formatAddress = (addr: Address | string | undefined): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    
    const parts = [
        addr.street,
        addr.city ? `${addr.city}${addr.state ? ',' : ''}` : '',
        addr.state,
        addr.zip
    ].filter(Boolean);
    
    return parts.join(' ');
}

/**
 * Master-level Print Service Utility
 */
const generatePrintHtml = (type: string, id: string, content: string) => {
    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 0; margin: 0; color: #1e293b; background: white; line-height: 1.5; }
        .page { width: 100%; padding: 0.5in; margin: 0; background: white; box-sizing: border-box; position: relative; }
        .prose { max-width: none; font-size: 14px; color: #334155; }
        .prose h3 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
        .logo-img { max-height: 60px; width: auto; object-fit: contain; }
        .doc-meta { text-align: right; }
        .doc-type-badge { background: #f1f5f9; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; color: #64748b; display: inline-block; margin-bottom: 8px; }
        .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; text-align: left; }
        .meta-label { font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .meta-value { font-weight: 800; color: #1e293b; }
        .billing-info { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 40px; }
        .info-block { flex: 1; }
        .info-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px; }
        .info-name { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .info-text { font-size: 12px; color: #64748b; }
        .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .doc-th-item { text-align: left; padding: 12px; background: #f8fafc; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        .doc-th-qty, .doc-th-price { text-align: center; padding: 12px; background: #f8fafc; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        .doc-td-item { padding: 15px 12px; border-bottom: 1px solid #f1f5f9; }
        .item-name { font-weight: 700; color: #1e293b; font-size: 14px; }
        .item-desc { font-size: 12px; color: #64748b; margin-top: 4px; }
        .doc-td-qty, .doc-td-price, .doc-td-total { padding: 15px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; text-align: center; }
        .doc-td-total { font-weight: 800; color: #0f172a; text-align: right; }
        .summary-grid { display: flex; justify-content: flex-end; margin-top: 20px; }
        .summary-box { width: 300px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
        .grand-total { border-bottom: none; font-size: 20px; font-weight: 800; color: #0f172a; padding-top: 15px; }
        .sig-img { max-height: 60px; }
        .sig-placeholder { border-top: 2px solid #0f172a; width: 250px; margin-top: 40px; padding-top: 10px; }
        .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #94a3b8; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8; }
        @media print {
            body { background: white; }
            .page { padding: 0; box-shadow: none; border: none; }
            .no-print { display: none; }
        }
    `;

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <title>${type} - ${id}</title>
                <style>${printStyles}</style>
            </head>
            <body>
                <div class="page">
                    ${content}
                </div>
            </body>
        </html>
    `;
};

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization, onSelectTier }) => {
    const { state, dispatch } = useAppContext();
    const org = organization || state.currentOrganization;
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);

    // Derived values with memoization for performance and stability
    const { isProposal, isOther, prop, job, id, total, subtotal, tax, customerName, address, date, status, signature, items } = useMemo(() => {
        const isProposal = type === 'Proposal';
        const isOther = type === 'Other';
        
        // Master Logic: Try to find the latest version in global state if we have an ID
        const providedId = data?.id;
        const globalProp = isProposal && providedId ? state.proposals.find(p => p.id === providedId) : null;
        const globalJob = !isProposal && !isOther && providedId ? state.jobs.find(j => j.id === providedId) : null;

        const prop = globalProp || (isProposal ? data as Proposal : null);
        const job = globalJob || (!isProposal && !isOther ? data as Job : null);
        
        const rawItems = isProposal ? prop?.items || [] : job?.invoice?.items || [];
        const activeTier = prop?.selectedOption || (rawItems.length > 0 && !isProposal ? (rawItems[0] as any).tier : 'Good');
        const safeActiveTier = activeTier || 'Good';
        
        const items = rawItems.filter((i: any) => !isProposal || (i.tier && i.tier.toLowerCase() === safeActiveTier.toLowerCase()) || (!i.tier && safeActiveTier === 'Good')).map((item: any) => ({
            id: item.id,
            name: item.name || item.title || (isProposal ? '' : item.description),
            description: item.description,
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
        const id = providedId || (isProposal ? 'DRAFT' : 'PREVIEW');
        const status = isProposal ? prop?.status : (isOther ? 'Signed' : job?.invoice?.status);
        const signature = isProposal 
            ? (prop?.signatureDataUrl || prop?.signature) 
            : (isOther 
                ? (data?.signatureImage || data?.signatureDataUrl || data?.signature || null) 
                : (job?.invoiceSignature || null));

        return { isProposal, isOther, prop, job, id, total, subtotal, tax, customerName, address, date, status, signature, items };
    }, [type, data, state.proposals, state.jobs, state.customers]);

    const calculateAvailableTiers = () => {
        if (!isProposal || !prop) return [];
        const tiers = ['Good', 'Better', 'Best'];
        return tiers.map(t => {
            const tierItems = (prop.items || []).filter((i: any) => (i.tier && i.tier.toLowerCase() === t.toLowerCase()) || (!i.tier && t === 'Good'));
            if (tierItems.length === 0) return null;
            const st = tierItems.reduce((sum, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            const taxable = tierItems.filter((i: any) => i.taxable !== false).reduce((sum, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            const taxAmount = taxable * ((org?.taxRate || 8.25) / 100);
            return { tier: t, items: tierItems, subtotal: st, taxAmount: taxAmount, total: st + taxAmount };
        }).filter(Boolean) as any[];
    };
    const multiTiers = calculateAvailableTiers();
    const showMultiTier = isProposal && multiTiers.length > 1 && !prop?.selectedOption;

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
            address: prop.customerName ? (state.customers.find(c => c.name === prop.customerName)?.address || '') : '',
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
            showToast.warn("Job/Invoice created successfully! View in Operations.");
            onClose();
        } catch (e) {
            console.error(e);
            showToast.warn("Conversion failed.");
        } finally {
            setIsConverting(false);
        }
    };

    const handlePrint = async () => {
        if (!printRef.current) return;
        const html = generatePrintHtml(type, id, printRef.current.innerHTML);

        if (Capacitor.isNativePlatform()) {
            try {
                await CapacitorPrinter.printHtml({ name: `Document-${id}`, html: html });
            } catch (e) {
                console.error('Native print failed', e);
                showToast.warn("Native printing failed. Opening browser print...");
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                    setTimeout(() => { win.print(); win.close(); }, 500);
                }
            }
        } else {
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                setTimeout(() => { win.print(); }, 500);
            }
        }
    };

    return ReactDOM.createPortal(
        <div id="document-preview-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 sm:p-6 z-[10000] animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-950 w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            {/* Control Header */}
            <div className="bg-white dark:bg-slate-800 shadow-xl p-3 md:p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 min-h-[5rem] md:h-20 shrink-0">
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

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-2 md:p-12 flex justify-center custom-scrollbar bg-slate-100 dark:bg-slate-900">
                <div 
                    ref={printRef}
                    className="bg-white text-slate-900 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[8.5in] p-4 md:p-16 box-border relative overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] h-fit mb-12 flex flex-col min-h-[11in]"
                >
                    <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                    
                    <div className="relative z-10 flex-1 flex flex-col">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between mb-8 md:mb-[60px] gap-6 md:gap-0 border-b-2 border-slate-50 pb-8">
                            <div className="text-center md:text-left">
                                {org?.logoUrl ? (
                                    <img src={org.logoUrl} alt="Logo" className="max-h-20 w-auto object-contain inline-block md:block" />
                                ) : org?.letterheadDataUrl ? (
                                    <img src={org.letterheadDataUrl} alt="Logo" className="max-h-20 w-auto object-contain inline-block md:block" />
                                ) : (
                                    <h1 className="text-2xl font-black text-primary-600">{org?.name}</h1>
                                )}
                                {org?.licenseNumber && (
                                    <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Licence # {org.licenseNumber}</div>
                                )}
                            </div>
                            <div className="text-center md:text-right">
                                <div className="inline-block bg-slate-100 px-4 py-1.5 rounded-lg font-black text-xs text-slate-500 mb-4">{type.toUpperCase()}</div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                    <span className="font-bold text-slate-400 uppercase">ID</span>
                                    <span className="font-black text-slate-900">#{id}</span>
                                    <span className="font-bold text-slate-400 uppercase">Date</span>
                                    <span className="font-black text-slate-900">{new Date(date).toLocaleDateString()}</span>
                                    <span className="font-bold text-slate-400 uppercase">Status</span>
                                    <span className="font-black text-primary-600">{status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Addresses Section */}
                        <div className="flex flex-col md:flex-row justify-between mb-8 md:mb-[50px] gap-6 md:gap-12">
                            <div className="flex-1">
                                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Bill To</div>
                                <div className="text-lg font-black text-slate-900 mb-1">{customerName}</div>
                                <div className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{address}</div>
                            </div>
                            <div className="flex-1 text-left md:text-right">
                                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Service From</div>
                                <div className="text-lg font-black text-slate-900 mb-1">{org?.name}</div>
                                <div className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
                                    {org?.address?.street}\n{org?.address?.city}, {org?.address?.state} {org?.address?.zip}
                                </div>
                                {org?.phone && <div className="mt-3 text-sm font-bold text-primary-600">{org.phone}</div>}
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1">
                            {isOther ? (
                                <div className="bg-slate-50 rounded-3xl p-6 md:p-10 border border-slate-100 min-h-[500px]">
                                    <h3 className="text-lg font-black text-slate-900 mb-6">{data.title || 'Document Content'}</h3>
                                    {data.htmlContent ? (
                                        <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.htmlContent) }} />
                                    ) : (data.url || data.dataUrl) && (
                                        (data.url?.toLowerCase().includes('.html')) || 
                                        (data.dataUrl?.includes('text/html')) ||
                                        (data.fileName?.toLowerCase().endsWith('.html'))
                                    ) ? (
                                        <iframe 
                                            srcDoc={data.dataUrl?.includes('base64,') ? decodeURIComponent(escape(atob(data.dataUrl.split('base64,')[1]))) : data.dataUrl}
                                            src={!data.dataUrl ? data.url : undefined} 
                                            className="w-full h-[600px] border-none rounded-2xl bg-white shadow-inner" 
                                            title="External Content"
                                        />
                                    ) : (
                                        <div className="text-slate-600 whitespace-pre-wrap">{data.content || data.body || 'No content available.'}</div>
                                    )}
                                </div>
                            ) : showMultiTier ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                    {multiTiers.map(t => (
                                        <div key={t.tier} onClick={() => onSelectTier?.(t.tier)} className={`p-6 border-2 rounded-2xl bg-white transition-all ${onSelectTier ? 'cursor-pointer hover:border-primary-400 hover:shadow-xl' : 'border-slate-200'} flex flex-col shadow-sm`}>
                                            <h3 className="text-center font-black text-xl uppercase mb-6 text-slate-800 tracking-tighter">{t.tier}</h3>
                                            <div className="text-center mb-6 border-b pb-4">
                                                <div className="text-3xl font-black tracking-tighter text-slate-900">${t.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                            </div>
                                            <div className="space-y-3 mb-6 flex-1">
                                                {t.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col gap-1">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-emerald-500 font-bold shrink-0 text-xs">✓</span>
                                                            <span className="font-bold text-slate-700 text-[11px] leading-tight">{item.name}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className={`mt-auto text-center border-t pt-4 ${onSelectTier ? 'text-primary-600 font-black text-[10px] uppercase tracking-widest' : 'text-slate-300'}`}>
                                                {onSelectTier ? 'Click to Select' : 'Option Available'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="table-area overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-l-xl">Description</th>
                                                <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                                                <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                                <th className="text-right py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-r-xl">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-50 last:border-none">
                                                    <td className="py-5 px-4">
                                                        <div className="font-black text-slate-900 text-sm">{item.name}</div>
                                                        {item.description && <div className="text-xs text-slate-400 mt-1 italic">{item.description}</div>}
                                                    </td>
                                                    <td className="py-5 px-4 text-center font-bold text-slate-600 text-sm">{item.quantity}</td>
                                                    <td className="py-5 px-4 text-center font-bold text-slate-600 text-sm">${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="py-5 px-4 text-right font-black text-slate-900 text-sm">${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Summary and Footer */}
                        {!isOther && !showMultiTier && (
                            <div className="flex justify-end mt-12 mb-16">
                                <div className="w-full md:w-80 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-400 uppercase">Subtotal</span>
                                        <span className="font-black text-slate-900">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-400 uppercase">Tax</span>
                                        <span className="font-black text-slate-900">${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900">
                                        <span className="font-black text-primary-600 text-lg uppercase italic tracking-tighter">Total Amount</span>
                                        <span className="text-3xl font-black text-slate-900 tracking-tighter">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    {org?.financingLink && isInternal && (
                                        <a href={org.financingLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-sky-600 text-white p-3.5 rounded-2xl no-underline font-black text-xs uppercase tracking-widest mt-6 shadow-xl shadow-sky-500/20 hover:scale-[1.02] transition-transform">
                                            <CreditCard size={18}/> Financing Options
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Signature Section */}
                        <div className="mt-auto pt-16 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12">
                            <div className="w-full md:w-[300px]">
                                {signature ? (
                                    <div className="relative">
                                        <img src={signature} alt="Sig" className="max-h-24 mx-auto md:ml-0 mb-2" />
                                        <div className="border-t-2 border-slate-900 pt-3">
                                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Authorized Signature</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t-2 border-slate-900 pt-3 h-24 flex flex-col justify-end">
                                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Authorized Signature Required</div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center md:text-right flex-1">
                                {org?.termsAndConditions && !isOther && (
                                    <p className="text-[9px] text-slate-400 text-justify md:text-right leading-relaxed mb-6 italic">{org.termsAndConditions}</p>
                                )}
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{org?.name}</div>
                                <div className="text-[9px] text-slate-400">Generated via {org?.name} Platform • {new Date().toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
            </div>
        </div>
    </div>
</div>,
document.body
);
};

export default DocumentPreview;
