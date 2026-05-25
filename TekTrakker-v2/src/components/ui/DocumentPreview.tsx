import showToast from "lib/toast";
import React, { useRef, useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, CreditCard, FileText } from 'lucide-react';
import type { Proposal, Job, Organization, Address, ProposalItem, InvoiceLineItem, SignedWaiver } from 'types';
import Button from './Button';
import { db } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';
import { Printer as CapacitorPrinter } from '@capgo/capacitor-printer';
import { Capacitor } from '@capacitor/core';

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other';
    data: Partial<Proposal> | Partial<Job> | Partial<SignedWaiver>;
    onClose: () => void;
    isInternal?: boolean;
    organization?: Organization | null;
    onSelectTier?: (tier: string) => void;
    autoPrint?: boolean;
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 0; margin: 0; color: #1e293b; background: white; line-height: 1.6; }
        .page { width: 100%; padding: 0.75in; margin: 0; background: white; box-sizing: border-box; position: relative; }
        
        /* Header & Meta */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; padding-bottom: 30px; border-bottom: 2px solid #f8fafc; }
        .logo-img { max-height: 100px; width: auto; object-fit: contain; }
        .meta-stack { text-align: right; display: flex; flex-direction: column; gap: 4px; }
        .doc-type { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; letter-spacing: -0.02em; }
        .meta-line { font-size: 11px; display: flex; justify-content: flex-end; gap: 8px; }
        .meta-label { font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-value { font-weight: 700; color: #1e293b; }
        .status-badge { color: #0284c7; font-weight: 800; }

        /* Addresses */
        .address-section { display: flex; justify-content: space-between; margin-bottom: 60px; gap: 40px; }
        .address-block { flex: 1; }
        .address-block.right { text-align: right; }
        .addr-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 12px; }
        .addr-name { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
        .addr-details { font-size: 12px; color: #64748b; line-height: 1.5; white-space: pre-wrap; }

        /* Table */
        .item-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .th { text-align: left; padding: 12px 15px; background: #f8fafc; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; letter-spacing: 0.05em; }
        .th-right { text-align: right; width: 120px; }
        .th-center { text-align: center; width: 80px; }
        .td { padding: 18px 15px; border-bottom: 1px solid #f8fafc; vertical-align: top; font-size: 13px; }
        .td-right { text-align: right; }
        .td-center { text-align: center; }
        .item-row { margin-bottom: 20px; } /* Added for spacing between line items */
        .item-title { font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 6px; display: block; }
        .item-description { font-size: 12px; color: #64748b; line-height: 1.6; }
        
        /* Summary */
        .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 30px; }
        .summary-box { width: 350px; display: flex; flex-direction: column; gap: 12px; }
        .summary-row { display: flex; justify-content: space-between; font-size: 14px; color: #64748b; }
        .summary-row.total { border-top: 3px solid #0f172a; margin-top: 15px; padding-top: 20px; font-size: 20px; font-weight: 800; color: #0f172a; }
        .total-value { font-size: 28px; color: #0284c7; }

        /* Signature & Footer */
        .signature-section { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
        .sig-block { width: 250px; }
        .sig-image-wrap { border-bottom: 2px solid #0f172a; margin-bottom: 10px; min-height: 60px; display: flex; align-items: flex-end; }
        .sig-image { max-height: 70px; max-width: 100%; object-fit: contain; }
        .sig-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
        
        .footer { margin-top: 80px; padding-top: 40px; border-top: 1px solid #f1f5f9; text-align: center; }
        .tdlr-footer { font-size: 9px; color: #94a3b8; line-height: 1.8; max-width: 650px; margin: 25px auto 0; text-align: center; font-weight: 500; }
        .terms-text { font-size: 10px; color: #64748b; line-height: 1.6; max-width: 600px; margin: 0 auto 25px; text-align: center; font-style: italic; }
        .branding-footer { font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 15px; }

        .doc-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            width: 70%;
            opacity: 0.04;
            z-index: 0;
            pointer-events: none;
            user-select: none;
            -webkit-print-color-adjust: exact;
        }

        @media print {
            body { background: white; -webkit-print-color-adjust: exact; }
            .page { padding: 0.5in; box-shadow: none; border: none; position: relative; }
            .no-print { display: none; }
            .doc-watermark { display: block !important; opacity: 0.04 !important; }
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

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization, onSelectTier, autoPrint }) => {
    const { state, dispatch } = useAppContext();
    const org = organization || state.currentOrganization;
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const { isProposal, isOther, prop, id, total, subtotal, tax, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName, address, billToName, billToAddress, poNumber, date, status, signature, items, recommendations, otherData } = useMemo(() => {
        const isProposal = type === 'Proposal';
        const isOther = type === 'Other';
        
        // Master Logic: Try to find the latest version in global state if we have an ID
        const providedId = data?.id;
        const globalProp = isProposal && providedId ? state.proposals.find(p => p.id === providedId) : null;
        const globalJob = !isProposal && !isOther && providedId ? state.jobs.find(j => j.id === providedId) : null;

        const prop = globalProp || (isProposal ? data as Proposal : null);
        const job = globalJob || (!isProposal && !isOther ? data as Job : null);
        const otherData = isOther ? data as SignedWaiver : null;
        
        const rawItems = isProposal ? (prop?.items || []) : (job?.invoice?.items || []);
        const populatedTiers = ['Good', 'Better', 'Best'].filter(t => 
            (rawItems as (ProposalItem | InvoiceLineItem)[]).some(i => 'tier' in i && (i as ProposalItem).tier.toLowerCase() === t.toLowerCase())
        );
        const defaultTier = populatedTiers.length > 0 ? populatedTiers[0] : 'Good';
        const activeTier = prop?.selectedOption || (isProposal ? defaultTier : (rawItems.length > 0 && !isProposal && 'tier' in rawItems[0] ? (rawItems[0] as ProposalItem).tier : 'Good'));
        const safeActiveTier = activeTier || 'Good';
        
        const items = (rawItems as (ProposalItem | InvoiceLineItem)[]).filter(i => {
            const hasTier = 'tier' in i;
            const itemTier = hasTier ? (i as ProposalItem).tier : null;
            return !isProposal || (itemTier && itemTier.toLowerCase() === safeActiveTier.toLowerCase()) || (!itemTier && safeActiveTier === 'Good');
        }).map(item => {
            const isPropItem = 'tier' in item;
            const pItem = isPropItem ? item as ProposalItem : null;
            const iItem = !isPropItem ? item as InvoiceLineItem : null;
            
            return {
                id: item.id,
                name: (isPropItem ? pItem?.name : (iItem?.name || iItem?.description)) || '',
                description: item.description,
                quantity: item.quantity || 1,
                unitPrice: isPropItem ? pItem?.price : (iItem?.unitPrice || 0),
                total: item.total || ((isPropItem ? pItem?.price : (iItem?.unitPrice || 0)) * (item.quantity || 1)),
                isPercentage: (item as any).isPercentage,
                percentageRate: (item as any).percentageRate
            };
        });

        const total = (isProposal ? prop?.total : (job?.invoice?.totalAmount || job?.invoice?.amount)) || 0;
        const subtotal = (isProposal ? prop?.subtotal : job?.invoice?.subtotal) || 0;
        const tax = (isProposal ? prop?.taxAmount : job?.invoice?.taxAmount) || 0;
        
        const additionalFeeName = isProposal ? prop?.additionalFeeName : job?.invoice?.additionalFeeName;
        const additionalFeePercent = isProposal ? prop?.additionalFeePercent : job?.invoice?.additionalFeePercent;
        const additionalFeeAmount = isProposal ? prop?.additionalFeeAmount : job?.invoice?.additionalFeeAmount;
        const customerName = isProposal ? prop?.customerName : (isOther ? (otherData?.customerName || '') : job?.customerName);
        
        const addressObj = isProposal ? (state.customers.find(c => c.name === prop?.customerName)?.address) : (isOther ? (otherData?.address || '') : job?.address);
        const address = formatAddress(addressObj);

        const date = isProposal ? (prop?.createdAt || new Date().toISOString()) : (isOther ? (otherData?.createdAt || otherData?.timestamp || new Date().toISOString()) : job?.appointmentTime);
        const id = providedId || (isProposal ? 'DRAFT' : 'PREVIEW');
        const status = isProposal ? prop?.status : (isOther ? 'Signed' : job?.invoice?.status);
        const signature = isProposal 
            ? (prop?.signatureDataUrl || prop?.signature) 
            : (isOther 
                ? (otherData?.signatureImage || otherData?.signatureDataUrl || otherData?.signature || null) 
                : (job?.invoiceSignature || null));

        const billToName = (!isProposal && !isOther && job?.invoice?.billToName) ? job.invoice.billToName : customerName;
        const billToAddress = (!isProposal && !isOther && job?.invoice?.billToAddress) ? job.invoice.billToAddress : address;
        const poNumber = (!isProposal && !isOther) ? job?.poNumber : null;
        const recommendations = isProposal ? prop?.recommendations : (isOther ? null : job?.invoice?.recommendations);

        return { isProposal, isOther, prop, id, total, subtotal, tax, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName, address, billToName, billToAddress, poNumber, date, status, signature, items, recommendations, otherData };
    }, [type, data, state.proposals, state.jobs, state.customers, type]);

    const calculateAvailableTiers = () => {
        if (!isProposal || !prop) return [];
        const tiers = ['Good', 'Better', 'Best'];
        return tiers.map(t => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tierItems = (prop.items || []).filter((i: any) => (i.tier && i.tier.toLowerCase() === t.toLowerCase()) || (!i.tier && t === 'Good'));
            if (tierItems.length === 0) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const st = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const taxable = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            const taxAmount = taxable * ((org?.taxRate || 8.25) / 100);
            const totalBeforeFee = st + taxAmount;
            const additionalFeeAmountTier = prop.additionalFeePercent ? (totalBeforeFee * (prop.additionalFeePercent / 100)) : 0;
            return { tier: t, items: tierItems, subtotal: st, taxAmount: taxAmount, additionalFeeAmount: additionalFeeAmountTier, total: totalBeforeFee + additionalFeeAmountTier };
        }).filter(Boolean);
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
            proposalId: prop.id,
            address: prop.customerName ? (state.customers.find(c => c.name === prop.customerName)?.address || '') : '',
            tasks: items.map(i => i.name),
            jobStatus: 'Scheduled',
            appointmentTime: new Date().toISOString(),
            assignedTechnicianId: prop.createdById || state.currentUser?.id || null,
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

    useEffect(() => {
        if (autoPrint) {
            // Slight delay to ensure refs and styles are populated
            const timer = setTimeout(() => {
                handlePrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPrint]);

    const handleDownload = async () => {
        if (!printRef.current) return;
        setIsDownloading(true);
        
        try {
            // @ts-ignore - html2pdf has no types available right now
            const html2pdf = (await import('html2pdf.js')).default;
            
            // Create a clean clone of the document for PDF generation
            const clone = printRef.current.cloneNode(true) as HTMLElement;
            clone.style.boxShadow = 'none';
            clone.style.margin = '0';
            clone.style.padding = '24px'; // 0.25in padding for professional margin spacing inside PDF
            clone.style.width = '720px'; // Exact printable width in pixels for Letter page (7.5 inches at 96 DPI)
            clone.style.height = 'auto';
            clone.style.overflow = 'visible'; // Ensure nothing is cut off
            
            // Temporarily append to body to ensure CSS is computed
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            
            const fileName = customerName ? `${type}-${customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf` : `${type}-${id}.pdf`;
            
            const opt: any = {
                margin:       0.5,
                filename:     fileName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 720 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            
            const pdfDataUri = await html2pdf().from(clone).set(opt).output('datauristring');
            const { downloadFile } = await import('lib/downloadHelper');
            await downloadFile(pdfDataUri, fileName);
            document.body.removeChild(wrapper);
        } catch (e) {
            console.error('Download failed', e);
            showToast.warn('Failed to generate PDF directly. Falling back to print dialog...');
            handlePrint();
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePrint = async () => {
        if (!printRef.current) return;
        
        // Final polish of content for printing
        const html = generatePrintHtml(type, id, printRef.current.innerHTML);

        if (Capacitor.isNativePlatform()) {
            try {
                await CapacitorPrinter.printHtml({ name: `${type}-${id}`, html: html });
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
                // Brief delay to ensure styles and fonts load
                setTimeout(() => { 
                    win.print(); 
                    // Optional: win.close(); after print dialog closes
                }, 800);
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
                    <Button onClick={handleDownload} disabled={isDownloading} variant="secondary" className="flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black border-slate-200">
                        <FileText size={14} className="md:w-4 md:h-4"/> {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </Button>
                    <Button onClick={handlePrint} className="flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black shadow-xl shadow-primary-500/20">
                        <Printer size={14} className="md:w-4 md:h-4"/> Print
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 custom-scrollbar">
                <div className="w-full p-2 sm:p-4 md:p-12 flex justify-center">
                    <div 
                        ref={printRef}
                        className="bg-white text-slate-900 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[816px] shrink-0 p-4 sm:p-8 md:p-16 box-border relative md:rounded-[2.5rem] rounded-xl h-fit mb-12 flex flex-col min-h-[11in]"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                    
                    {/* Watermarks - Multi-Pattern for visual security */}
                    {(org?.logoUrl || org?.letterheadDataUrl) && (
                        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                            <img 
                                src={org.logoUrl || org.letterheadDataUrl || ''} 
                                alt="" 
                                className="doc-watermark absolute top-[20%] left-[10%] w-[35%] opacity-[0.05] -rotate-12" 
                            />
                            <img 
                                src={org.logoUrl || org.letterheadDataUrl || ''} 
                                alt="" 
                                className="doc-watermark absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] opacity-[0.05] -rotate-12" 
                            />
                            <img 
                                src={org.logoUrl || org.letterheadDataUrl || ''} 
                                alt="" 
                                className="doc-watermark absolute bottom-[20%] right-[10%] w-[35%] opacity-[0.05] -rotate-12" 
                            />
                        </div>
                    )}
                    
                    <div className="relative z-10 flex-1 flex flex-col w-full">
                        {/* Header Section */}
                        <div className="header flex flex-col sm:flex-row justify-between mb-8 sm:mb-12 gap-4 sm:gap-8 border-b-2 border-slate-50 pb-8">
                            <div className="text-left flex flex-col items-start">
                                {org?.logoUrl ? (
                                    <img src={org.logoUrl} alt="Logo" className="logo-img max-h-[100px] w-auto object-contain block mb-4" />
                                ) : org?.letterheadDataUrl ? (
                                    <img src={org.letterheadDataUrl} alt="Logo" className="logo-img max-h-[100px] w-auto object-contain block mb-4" />
                                ) : (
                                    <h1 className="text-3xl font-black text-primary-600 mb-2">{org?.name}</h1>
                                )}
                            </div>
                            <div className="meta-stack text-right flex flex-col gap-2">
                                <h2 className="doc-type text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">
                                    {status === 'Paid' ? 'Receipt' : type}
                                </h2>
                                <div className="flex flex-col gap-1 text-[11px]">
                                    <div className="meta-line flex justify-end gap-3">
                                        <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Document #</span>
                                        <span className="meta-value font-black text-slate-900">#{id}</span>
                                    </div>
                                    <div className="meta-line flex justify-end gap-3">
                                        <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Date</span>
                                        <span className="meta-value font-black text-slate-900">{new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    <div className="meta-line flex justify-end gap-3">
                                        <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                        <span className={`meta-value status-badge font-black uppercase ${status === 'Paid' ? 'text-emerald-600' : 'text-primary-600'}`}>{status}</span>
                                    </div>
                                    {poNumber && (
                                        <div className="meta-line flex justify-end gap-3">
                                            <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">PO / Ref</span>
                                            <span className="meta-value font-black text-slate-900">{poNumber}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Addresses Section */}
                        <div className="address-section flex flex-col sm:flex-row justify-between mb-12 sm:mb-16 gap-6 sm:gap-10">
                            <div className="address-block flex-1">
                                <div className="addr-title text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4">Bill To</div>
                                <div className="addr-name text-xl font-black text-slate-900 mb-2">{billToName}</div>
                                <div className="addr-details text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{billToAddress}</div>
                                
                                {(billToName !== customerName || billToAddress !== address) && (
                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                        <div className="addr-title text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4">Service Location</div>
                                        <div className="addr-name text-lg font-black text-slate-900 mb-1">{customerName}</div>
                                        <div className="addr-details text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{address}</div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="address-block right flex-1 text-left sm:text-right">
                                <div className="addr-title text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4">Service From</div>
                                <div className="addr-name text-xl font-black text-slate-900 mb-2">{org?.name}</div>
                                <div className="addr-details text-sm text-slate-500 leading-relaxed">
                                    {org?.address ? (
                                        <>
                                            {org.address.street}<br />
                                            {org.address.city}, {org.address.state} {org.address.zip}
                                        </>
                                    ) : 'Address not configured'}
                                </div>
                                {org?.phone && <div className="mt-4 text-sm font-black text-primary-600">{org.phone}</div>}
                                {org?.email && <div className="text-xs font-bold text-slate-400 mt-1">{org.email}</div>}
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1">
                            {isOther ? (
                                <div className="bg-slate-50 rounded-3xl p-10 border border-slate-100 min-h-[500px]">
                                    <h3 className="text-lg font-black text-slate-900 mb-6">{otherData?.title || 'Document Content'}</h3>
                                    {otherData?.htmlContent ? (
                                        <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                    ) : (otherData?.url || otherData?.dataUrl) && (
                                        (otherData.url?.toLowerCase().includes('.html')) || 
                                        (otherData.dataUrl?.includes('text/html')) ||
                                        (otherData.fileName?.toLowerCase().endsWith('.html'))
                                    ) ? (
                                        <iframe 
                                            srcDoc={otherData.dataUrl?.includes('base64,') ? decodeURIComponent(escape(atob(otherData.dataUrl.split('base64,')[1]))) : otherData.dataUrl}
                                            src={!otherData.dataUrl ? otherData.url : undefined} 
                                            className="w-full h-[600px] border-none rounded-2xl bg-white shadow-inner" 
                                            title="External Content"
                                        />
                                    ) : (
                                        <div className="text-slate-600 whitespace-pre-wrap">{otherData?.content || otherData?.body || 'No content available.'}</div>
                                    )}
                                </div>
                            ) : showMultiTier ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                                    {multiTiers.map(t => (
                                        <div 
                                            key={t.tier} 
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onSelectTier?.(t.tier)} 
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onSelectTier?.(t.tier);
                                                }
                                            }}
                                            className={`p-6 border-2 rounded-2xl bg-white transition-all ${onSelectTier ? 'cursor-pointer hover:border-primary-400 hover:shadow-xl' : 'border-slate-200'} flex flex-col shadow-sm`}
                                        >
                                            <h3 className="text-center font-black text-xl uppercase mb-6 text-slate-800 tracking-tighter">{t.tier}</h3>
                                            <div className="text-center mb-6 border-b pb-4">
                                                <div className="text-3xl font-black tracking-tighter text-slate-900">${t.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                                {!!t.additionalFeeAmount && (
                                                    <div className={`text-[10px] font-bold mt-1 ${t.additionalFeeAmount < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        Includes {prop?.additionalFeePercent}% {prop?.additionalFeeName || 'Adjustment'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-3 mb-6 flex-1">
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                {t.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col gap-1 border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-emerald-500 font-bold shrink-0 text-xs">✓</span>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-700 text-[11px] leading-tight">{item.name || item.title || item.description}</span>
                                                                    {item.description && item.description !== (item.name || item.title) && <span className="text-[9px] text-slate-400 mt-0.5 leading-snug">{item.description}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0 flex flex-col">
                                                                <span className="font-bold text-[10px] text-slate-600">
                                                                    {item.isPercentage && item.percentageRate 
                                                                        ? `${Number(item.percentageRate)}%` 
                                                                        : `$${Number(item.price || item.unitPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                                    }
                                                                </span>
                                                                {item.quantity > 1 && <span className="text-[8px] text-slate-400">Qty: {item.quantity}</span>}
                                                            </div>
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
                                <div className="item-table-wrap overflow-x-auto border-b-2 border-slate-50">
                                    <table className="item-table w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="th text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] rounded-tl-2xl">Description of Service / Items</th>
                                                <th className="th th-center text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-20">Qty</th>
                                                <th className="th th-right text-right py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-32">Unit Price</th>
                                                <th className="th th-right text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-32 rounded-tr-2xl">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="item-row border-b border-slate-50 last:border-none group">
                                                    <td className="td py-8 px-6">
                                                        <span className="item-title font-black text-slate-900 text-base mb-2">{item.name}</span>
                                                        {item.description && (
                                                            <div className="item-description text-sm text-slate-500 leading-relaxed max-w-lg">
                                                                {item.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="td td-center py-8 px-4 text-center font-bold text-slate-600 text-sm">{item.quantity}</td>
                                                    <td className="td td-right py-8 px-4 text-right font-bold text-slate-600 text-sm">
                                                        {item.isPercentage && item.percentageRate 
                                                            ? `${Number(item.percentageRate)}%` 
                                                            : `$${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                        }
                                                    </td>
                                                    <td className="td td-right py-8 px-6 text-right font-black text-slate-900 text-sm">${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Recommendations Section */}
                        {recommendations && (
                            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border-l-4 border-primary-500">
                                <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    💡 Technician Recommendations
                                </h4>
                                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                                    "{recommendations}"
                                </div>
                            </div>
                        )}

                        {/* Summary and Footer */}
                        {!isOther && !showMultiTier && (
                            <div className="summary-wrapper flex justify-end mt-16 mb-20">
                                <div className="summary-box w-[350px] space-y-4">
                                    <div className="summary-row flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-400 uppercase tracking-wider">Subtotal</span>
                                        <span className="font-black text-slate-900">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="summary-row flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-400 uppercase tracking-wider">Tax</span>
                                        <span className="font-black text-slate-900">${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    {!!additionalFeeAmount && (
                                        <div className="summary-row flex justify-between items-center text-sm">
                                            <span className="font-bold text-slate-400 uppercase tracking-wider">{additionalFeeName || 'Adjustment'} {additionalFeePercent ? `(${additionalFeePercent}%)` : ''}</span>
                                            <span className={`font-black ${additionalFeeAmount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                {additionalFeeAmount < 0 ? '-' : ''}${Math.abs(additionalFeeAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </span>
                                        </div>
                                    )}
                                    <div className="summary-row total flex justify-between items-center pt-6 mt-6 border-t-[3px] border-slate-900">
                                        <span className="font-black text-slate-900 text-xl uppercase tracking-tighter">Grand Total</span>
                                        <span className="total-value text-4xl font-black text-primary-600 tracking-tighter">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    {org?.financingLink && isInternal && (
                                        <a href={org.financingLink} target="_blank" rel="noopener noreferrer" className="no-print flex items-center justify-center gap-2 bg-sky-600 text-white p-4 rounded-2xl no-underline font-black text-xs uppercase tracking-widest mt-8 shadow-xl shadow-sky-500/20 hover:scale-[1.02] transition-transform">
                                            <CreditCard size={18}/> Financing Options Available
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Signature Section */}
                        <div className="signature-section mt-auto">
                            <div className="flex flex-row justify-between items-end gap-16 pb-12">
                                <div className="sig-block w-[320px]">
                                    <div className="sig-image-wrap min-h-[100px] flex items-end justify-start border-b-2 border-slate-900 pb-2">
                                        {signature ? (
                                            <img 
                                                src={signature} 
                                                alt="Authorized Signature" 
                                                className="sig-image max-h-24 w-auto object-contain" 
                                                onError={(e) => {
                                                    // Fallback for broken signature images
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="h-10 text-slate-200 font-black italic uppercase text-xs tracking-widest">Awaiting Signature</div>
                                        )}
                                    </div>
                                    <div className="sig-label text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">Customer Authorization</div>
                                </div>
                                <div className="flex-1 text-center md:text-right">
                                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">{org?.name}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">Professional Field Service Solutions</div>
                                </div>
                            </div>

                            {/* Center Aligned Terms and Footer */}
                            <div className="footer border-t border-slate-100 pt-10 mt-12">
                                {org?.termsAndConditions && !isOther && (
                                    <div className="mb-8">
                                        <div className="sig-label text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Terms & Conditions</div>
                                        <p className="terms-text text-[10px] text-slate-500 text-center leading-relaxed italic max-w-3xl mx-auto px-6">
                                            {org.termsAndConditions}
                                        </p>
                                    </div>
                                )}
                                
                                <div className="flex flex-col items-center gap-6">
                                    <div className="branding-footer text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Generated via {org?.name} Platform</div>
                                    
                                    <div className="tdlr-footer text-[10px] text-slate-400 text-center leading-loose max-w-2xl mx-auto font-medium">
                                        {org?.licenseNumber && <div className="font-black text-slate-500 mb-2 tracking-widest uppercase">State License # {org.licenseNumber}</div>}
                                        {org?.complianceFooter ? org.complianceFooter : (
                                            <>Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711, 1-800-803-9202, 512-463-6599; website: www.tdlr.texas.gov</>
                                        )}
                                    </div>

                                    <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest bg-slate-50 px-6 py-2 rounded-full border border-slate-100">
                                        {new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
                                    </div>
                                </div>
                            </div>
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
