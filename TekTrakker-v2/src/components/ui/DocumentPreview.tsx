import showToast from "lib/toast";
import { getPaymentTermsDays, matchTier, displayTierName, cleanUndefinedFields, getOrGenerateAccountNumber, formatFullAddress, getAddressLines, resolveServiceLocation, getAvailableProposalTiers, getProposalTierLabel, resolveSiteLocationName, sanitizeCustomerScopeText } from 'lib/utils';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, CreditCard, FileText, Save, Shield, Lock, ShieldCheck, Phone, Mail, Building2, User, CheckCircle, X, MapPin, Download, ExternalLink } from 'lucide-react';
import type { Proposal, Job, Organization, Address, ProposalItem, InvoiceLineItem, SignedWaiver, Customer } from 'types';
import Button from './Button';
import Card from './Card';
import { db, auth } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';
import { Printer as CapacitorPrinter } from '@capgo/capacitor-printer';
import { Capacitor } from '@capacitor/core';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { getOrgPaymentInstructions } from 'lib/paymentInstructionsHelper';
import { getNextJobNumber, extractJobSlug, resolveJobInvoiceNumber, resolveJobProposalNumber, resolveDocumentDisplayId } from 'lib/numbering';
import { detectFileType } from 'lib/fileViewerHelper';

const PublicProjectProposal = React.lazy(() => import('pages/PublicProjectProposal'));
const CustomerPayment = React.lazy(() => import('pages/CustomerPayment'));

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other' | 'Work Order' | 'Receipt' | 'Estimate' | 'Signed Agreement';
    data: Partial<Proposal> | Partial<Job> | Partial<SignedWaiver> | any;
    onClose: () => void;
    isInternal?: boolean;
    organization?: Organization | null;
    onSelectTier?: (tier: string) => void;
    autoPrint?: boolean;
    onSave?: (savedData?: any) => void;
    disableScopeLock?: boolean;
    id?: string;
    customer?: Customer | null;
    isModal?: boolean;
    jobOrProposalId?: string;
    onAccept?: () => void;
    onDecline?: () => void;
    zIndex?: string;
}

const formatAddress = (addr: Address | string | undefined | null, city?: string | null, state?: string | null, zip?: string | null): string => {
    return formatFullAddress(addr, city, state, zip);
};

const formatServiceLocationAddress = (loc: any) => {
    if (!loc) return '';
    let addressStr = loc.address || '';
    
    const details = [];
    if (loc.city && !addressStr.includes(loc.city)) details.push(loc.city);
    if (loc.state && !addressStr.includes(loc.state)) details.push(loc.state);
    if (loc.zip && !addressStr.includes(loc.zip)) details.push(loc.zip);
    
    if (details.length > 0) {
        if (addressStr) {
            addressStr = `${addressStr}, ${details.join(', ')}`;
        } else {
            addressStr = details.join(', ');
        }
    }
    return addressStr;
};

const formatLocalDate = (dateVal: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
        const cleanStr = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            const dateObj = new Date(cleanStr.replace(/-/g, '/'));
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toLocaleDateString(undefined, options);
            }
        }
    }
    const dateObj = new Date(dateVal);
    if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString(undefined, options);
    }
    return '';
};

const resolveSafePdfUrl = (rawSrc: string): string => {
    if (!rawSrc) return '';
    if (rawSrc.startsWith('data:application/pdf;base64,')) {
        try {
            const base64Data = rawSrc.replace(/^data:application\/pdf;base64,/, '');
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.warn("Base64 to blob conversion warning:", e);
            return rawSrc;
        }
    }
    return rawSrc;
};

/**
 * Helper to extract all active in-memory CSS rules (Tailwind + custom) from document.styleSheets & <style> tags
 * This ensures PDF generation and Print windows never fail or render raw unstyled text after server deployments.
 */
const getAllActiveStylesHtml = (): string => {
    let cssText = '';
    try {
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                if (sheet.cssRules) {
                    Array.from(sheet.cssRules).forEach(rule => {
                        cssText += rule.cssText + '\n';
                    });
                }
            } catch (e) {
                // Ignore cross-origin sheet errors
            }
        });
    } catch (e) {
        console.warn('Could not extract styleSheets rules:', e);
    }
    
    const inlineStyles = Array.from(document.querySelectorAll('head style'))
        .map(style => style.innerHTML)
        .join('\n');
        
    return `<style>${inlineStyles}\n${cssText}</style>`;
};

/**
 * Master-level Print Service Utility
 */
const generatePrintHtml = (type: string, id: string, content: string) => {
    const activeStyles = getAllActiveStylesHtml();
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
        .item-description { font-size: 12px; color: #64748b; line-height: 1.6; white-space: pre-wrap; }
        
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

        .address-grid, .grid-cols-3 {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 16px !important;
        }

        .header, .address-section, .address-grid, .grid-cols-3, .item-table tr, .summary-wrapper, .signature-section, .footer, .pdf-avoid-break, .pdf-card, .pdf-unit-card, .pdf-photo, .pdf-section, table, tr, blockquote {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
        }

        @media print {
            body { background: white; -webkit-print-color-adjust: exact; }
            .page { padding: 0.25in; box-shadow: none; border: none; position: relative; }
            .no-print { display: none !important; }
            .doc-watermark { display: block !important; opacity: 0.04 !important; }
            .address-grid, .grid-cols-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 16px !important; }
            .header, .address-section, .address-grid, .grid-cols-3, .item-table tr, .summary-wrapper, .signature-section, .footer, .pdf-avoid-break, .pdf-card, .pdf-unit-card, .pdf-photo, .pdf-section, table, tr, blockquote {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
        }
    `;

    const cleanContent = content.replace(/https:\/\/tektrakker\.web\.app\/tektrakker-logo-web\.png/g, '/tektrakker-logo-web.png');
    return `
        <!DOCTYPE html>
        <html>
            <head>
                <title>${type} - ${id}</title>
                ${activeStyles}
                <style>${printStyles}</style>
            </head>
            <body>
                <div class="page">
                    ${cleanContent}
                </div>
            </body>
        </html>
    `;
};

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization, onSelectTier, autoPrint, onSave, disableScopeLock = false, zIndex = 'z-[100100]' }) => {
    const { state, dispatch } = useAppContext();
    const org = organization || state.currentOrganization;
    const isProposal = type === 'Proposal';
    const isOther = type === 'Other';
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [loadedJob, setLoadedJob] = useState<Job | null>(null);
    const [loadedCustomer, setLoadedCustomer] = useState<Customer | null>(null);
    const [loadedProposal, setLoadedProposal] = useState<Proposal | null>(null);
    const [viewMode, setViewMode] = useState<'customer' | 'pdf'>('customer');

    const custIdFromData = (data as any)?.customerId || (data as any)?.invoice?.customerId;
    useEffect(() => {
        if (custIdFromData) {
            const found = state.customers.find(c => c.id === custIdFromData);
            if (found) {
                setLoadedCustomer(found);
            } else {
                db.collection('customers').doc(custIdFromData).get().then(doc => {
                    if (doc.exists) {
                        setLoadedCustomer({ id: doc.id, ...doc.data() } as Customer);
                    }
                }).catch(err => console.error("Error fetching customer for document preview: ", err));
            }
        }
    }, [custIdFromData, state.customers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const providedId = (data as any)?.id || (data as any)?.invoiceId || (data as any)?.invoiceNumber;
        if (!isProposal && !isOther && providedId) {
            const foundInState = state.jobs.find(j => j.id === providedId || j.invoice?.id === providedId || j.invoice?.invoiceNumber === providedId);
            if (foundInState) {
                setLoadedJob(foundInState);
            } else {
                if (String(providedId).startsWith('INV-') || String(providedId).startsWith('inv-')) {
                    db.collection('jobs').where('invoice.id', '==', providedId).limit(1).get().then(snap => {
                        if (!snap.empty) {
                            setLoadedJob({ id: snap.docs[0].id, ...snap.docs[0].data() } as Job);
                        } else {
                            db.collection('jobs').where('invoice.invoiceNumber', '==', providedId).limit(1).get().then(snap2 => {
                                if (!snap2.empty) {
                                    setLoadedJob({ id: snap2.docs[0].id, ...snap2.docs[0].data() } as Job);
                                }
                            });
                        }
                    }).catch(err => console.error("Error fetching job for invoice preview:", err));
                } else {
                    db.collection('jobs').doc(providedId).get().then(doc => {
                        if (doc.exists) {
                            setLoadedJob({ id: doc.id, ...doc.data() } as Job);
                        }
                    }).catch(err => console.error("Error fetching job for document preview:", err));
                }
            }
        }
    }, [data, type, state.jobs, isProposal, isOther]);

    const { prop, job, id, referenceNumber, total, subtotal, tax, taxRatePct, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName, address, billToName, billToAddress, poNumber, jobNumber, woNumber, distinctPoNumber, customerId, date, status, signature, resolvedSignerName, resolvedSignatureDate, resolvedTechSignature, resolvedTechSignerName, resolvedTechSignatureDate, items, recommendations, otherData, dueDate, isMcAlisters, overdueDetails, associatedCust, associatedCustAddress, associatedCustAddrLines, billToAddrLines, serviceLocAddrLines, matchedLocAddress, serviceLocation, docDepositAmount, docDepositNotes, docDepositPaid, docPaymentTerms, docAmountPaid, docAmountRefunded, docNetPaid, docPayments, docRefunds, docBalanceRemaining, canonical } = useMemo(() => {
        
        // Master Logic: Try to find the latest version in global state if we have an ID
        const providedId = data?.id;
        const globalProp = isProposal && providedId ? state.proposals.find(p => p.id === providedId) : null;
        const globalJob = !isProposal && !isOther && providedId 
            ? (state.jobs.find(j => j.id === providedId || j.invoice?.id === providedId || j.invoice?.invoiceNumber === providedId) || loadedJob || null) 
            : (loadedJob || null);

        const prop = globalProp || (isProposal ? data as Proposal : null);
        const job = globalJob || (!isProposal && !isOther ? data as Job : null);
        const otherData = isOther ? { ...(data as any) } : null;
        if (otherData) {
            const rawHtml = otherData.htmlContent || otherData.dataUrl;
            if (rawHtml && rawHtml.startsWith('data:text/html;base64,')) {
                try {
                    const base64Part = rawHtml.split('base64,')[1];
                    otherData.htmlContent = decodeURIComponent(escape(atob(base64Part)));
                } catch (err) {
                    console.error("Failed to decode base64 htmlContent in DocumentPreview:", err);
                }
            } else if (rawHtml && rawHtml.includes('<html>')) {
                otherData.htmlContent = rawHtml;
            }
        }
        
        const associatedJob = (isProposal && prop) 
            ? (
                (prop.jobId ? state.jobs.find(j => j.id === prop.jobId) : null) ||
                (prop.invoiceId ? state.jobs.find(j => j.invoice?.id === prop.invoiceId) : null) ||
                state.jobs.find(j => j.proposalId === prop.id) ||
                state.jobs.find(j => prop.linkedJobIds?.includes(j.id)) ||
                state.jobs.find(j => j.linkedProposalIds?.includes(prop.id)) ||
                loadedJob || null
              )
            : (loadedJob || job || null);

        let rawItems = (isProposal ? prop?.items : (isOther ? (otherData as any)?.items : (job?.invoice?.items || (data as any)?.items || (data as any)?.lineItems || (job as any)?.lineItems))) || [];

        // If it's an accepted proposal with a selected option, filter to the accepted tier items:
        if (isProposal && prop && (prop.status === 'Accepted' || prop.selectedOption)) {
            const activeOption = prop.selectedOption;
            if (activeOption && rawItems.some((i: any) => i.tier)) {
                rawItems = rawItems.filter((i: any) => !i.tier || matchTier(i.tier, activeOption));
            }
        }

        // If it's a project proposal with labor/part/allowance items instead of prop.items:
        if (isProposal && rawItems.length === 0 && prop) {
            const synthItems: any[] = [];
            if (Array.isArray((prop as any).laborItems) && (prop as any).laborItems.length > 0) {
                (prop as any).laborItems.forEach((l: any, idx: number) => {
                    const unitStr = l.unitName ? `[${l.unitName}] ` : '';
                    const title = l.unitName || l.title || l.description || 'Mechanical Installation Labor';
                    const scopeDesc = l.scope || (l.hours ? `${l.hours} hours @ $${l.rate || 0}/hr` : (l.description || ''));
                    const rate = Number(l.rate ?? l.value ?? l.cost ?? 0);
                    const hours = Number(l.hours || 1);
                    const lineTotal = Number(l.total ?? (hours * rate));
                    synthItems.push({
                        id: l.id || `labor-${idx}`,
                        name: `Labor: ${title}`,
                        description: scopeDesc,
                        quantity: hours,
                        unitPrice: rate,
                        price: rate,
                        total: lineTotal,
                        type: 'Labor',
                        taxable: false,
                        tier: 'Basic'
                    });
                });
            }
            if (Array.isArray((prop as any).partItems) && (prop as any).partItems.length > 0) {
                (prop as any).partItems.forEach((p: any, idx: number) => {
                    const partName = p.partName || p.name || p.description || 'Part / Material';
                    const unitStr = p.unitName ? `[${p.unitName}] ` : '';
                    const availStr = p.availability ? ` • Availability: ${p.availability}` : '';
                    const descStr = p.partNumber ? `Part #: ${p.partNumber}${availStr}` : (p.description || (p.availability ? `Availability: ${p.availability}` : ''));
                    const unitPrice = Number(p.customerUnitPrice ?? p.unitPrice ?? p.price ?? 0);
                    const qty = Number(p.quantity || 1);
                    const lineTotal = Number(p.customerLineTotal ?? p.total ?? (qty * unitPrice));
                    synthItems.push({
                        id: p.id || `part-${idx}`,
                        name: `${unitStr}${partName}`,
                        description: descStr,
                        quantity: qty,
                        unitPrice: unitPrice,
                        price: unitPrice,
                        total: lineTotal,
                        type: unitPrice < 0 ? 'Discount' : 'Part',
                        taxable: p.taxable !== false && unitPrice >= 0,
                        tier: 'Basic'
                    });
                });
            }
            if (Array.isArray((prop as any).allowanceItems) && (prop as any).allowanceItems.length > 0) {
                (prop as any).allowanceItems.forEach((a: any, idx: number) => {
                    const desc = a.description || a.name || 'Logistics / Equipment';
                    const rawNotes = a.basis || a.notes || '';
                    const notes = sanitizeCustomerScopeText(rawNotes);
                    const amt = Number(a.amount ?? a.cost ?? 0);
                    synthItems.push({
                        id: a.id || `allowance-${idx}`,
                        name: `Allowance: ${desc}`,
                        description: notes,
                        quantity: 1,
                        unitPrice: amt,
                        price: amt,
                        total: amt,
                        type: 'Fee',
                        taxable: false,
                        tier: 'Basic'
                    });
                });
            }
            if (synthItems.length > 0) {
                rawItems = synthItems;
            }
        }

        const items = rawItems.map(item => {
            const isPropItem = isProposal && ('price' in item || 'tier' in item);
            const pItem = isPropItem ? item as ProposalItem : null;
            const iItem = !isPropItem ? item as InvoiceLineItem : null;
            
            const rawSub = (item as any).subItems || (item as any).subLineItems || (pItem as any)?.subItems || (pItem as any)?.subLineItems || (iItem as any)?.subItems;
            const fallbackSubItems = rawSub || 
                associatedJob?.invoice?.items?.find((invItem: any) => invItem.id === item.id || invItem.name === (item as any).name || invItem.description === item.description)?.subItems;

            const unitP = isPropItem 
                ? (pItem?.price ?? (pItem as any)?.unitPrice ?? (item as any)?.cost ?? (item as any)?.amount ?? (item as any)?.rate ?? 0) 
                : (iItem?.unitPrice ?? (item as any)?.price ?? (item as any)?.cost ?? (item as any)?.amount ?? (item as any)?.rate ?? 0);

            return {
                id: item.id,
                name: (isPropItem ? (pItem?.name || (pItem as any)?.title || (pItem as any)?.description) : (iItem?.name || iItem?.description || (item as any)?.title)) || '',
                description: item.description,
                quantity: item.quantity || 1,
                unitPrice: unitP,
                price: unitP,
                total: item.total !== undefined && item.total !== null ? Number(item.total) : (unitP * (item.quantity || 1)),
                tier: (item as any).tier,
                isPercentage: (item as any).isPercentage,
                percentageRate: (item as any).percentageRate,
                subItems: fallbackSubItems || []
            };
        });

        const total = (isProposal ? prop?.total : (job?.invoice?.totalAmount || job?.invoice?.amount || (data as any)?.totalAmount || (data as any)?.total || (data as any)?.amount)) || 0;
        const subtotal = (isProposal ? prop?.subtotal : (job?.invoice?.subtotal || (data as any)?.subtotal)) || 0;
        const tax = (isProposal ? prop?.taxAmount : (job?.invoice?.taxAmount || (data as any)?.taxAmount)) || 0;
        const taxRateVal = (isProposal ? prop?.taxRate : (job?.invoice?.taxRate ?? (data as any)?.taxRate)) ?? (org?.taxRate !== undefined && org?.taxRate !== null ? Number(org.taxRate) / 100 : 0.0825);
        const taxRatePct = (taxRateVal * 100).toFixed(2).replace(/\.00$/, '');
        
        const additionalFeeName = isProposal ? prop?.additionalFeeName : (job?.invoice?.additionalFeeName || (data as any)?.additionalFeeName);
        const additionalFeePercent = isProposal ? prop?.additionalFeePercent : (job?.invoice?.additionalFeePercent || (data as any)?.additionalFeePercent);
        const additionalFeeAmount = isProposal ? prop?.additionalFeeAmount : (job?.invoice?.additionalFeeAmount || (data as any)?.additionalFeeAmount);
        const customerName = isProposal ? prop?.customerName : (isOther ? (otherData?.customerName || '') : (job?.customerName || (data as any)?.customerName));
        
        const associatedCust = state.customers.find(c => 
            (c.id && c.id === prop?.customerId) || 
            (c.id && c.id === (job || loadedJob)?.customerId) || 
            (customerName && c.name?.trim().toLowerCase() === customerName.trim().toLowerCase())
        ) || loadedCustomer || null;

        const associatedCustAddress = associatedCust ? (
            formatFullAddress(associatedCust.address, associatedCust.city, associatedCust.state, associatedCust.zip) ||
            formatFullAddress((associatedCust as any).billingAddress, (associatedCust as any).city, (associatedCust as any).state, (associatedCust as any).zip)
        ) : (formatFullAddress((prop as any)?.customerAddress, (prop as any)?.city, (prop as any)?.state, (prop as any)?.zip) || formatFullAddress((prop as any)?.billingAddress, (prop as any)?.city, (prop as any)?.state, (prop as any)?.zip) || (loadedCustomer ? formatFullAddress(loadedCustomer.address, loadedCustomer.city, loadedCustomer.state, loadedCustomer.zip) : ''));

        const isCommercialCust = !!(
            associatedCust?.customerType === 'Commercial' || 
            associatedCust?.customerType === 'Property Management' || 
            (associatedCust?.serviceLocations && associatedCust.serviceLocations.length > 0)
        );

        const serviceLocation = resolveServiceLocation(
            job || loadedJob || associatedJob || prop,
            associatedCust,
            (state as any)?.serviceLocations
        );
        const matchedLocAddress = serviceLocation ? formatFullAddress(serviceLocation, serviceLocation.city, serviceLocation.state, serviceLocation.zip) : '';

        const addressObj = isProposal 
            ? (matchedLocAddress || (associatedJob as any)?.serviceLocationAddress || (associatedJob as any)?.locationAddress || associatedJob?.address || prop?.locationAddress || (prop as any)?.serviceLocationAddress || (prop as any)?.siteAddress || (prop as any)?.address || (!isCommercialCust ? associatedCustAddress : '')) 
            : (isOther ? (otherData?.address || '') : (matchedLocAddress || (job as any)?.serviceLocationAddress || (job as any)?.locationAddress || job?.address));
        const address = matchedLocAddress || formatFullAddress(addressObj, serviceLocation?.city || (job as any)?.serviceLocationCity || (associatedJob as any)?.city || (job as any)?.city, serviceLocation?.state || (job as any)?.serviceLocationState || (associatedJob as any)?.state || (job as any)?.state, serviceLocation?.zip || (job as any)?.serviceLocationZip || (associatedJob as any)?.zip || (job as any)?.zip) || (!isCommercialCust ? associatedCustAddress : (addressObj || ''));

        const associatedCustAddrLines = getAddressLines(
            associatedCust?.address || (associatedCust as any)?.billingAddress || (prop as any)?.customerAddress || (prop as any)?.billingAddress || loadedCustomer?.address,
            associatedCust?.city || (prop as any)?.city || loadedCustomer?.city,
            associatedCust?.state || (prop as any)?.state || loadedCustomer?.state,
            associatedCust?.zip || (prop as any)?.zip || loadedCustomer?.zip
        );

        const locBillToName = serviceLocation?.billToName || (serviceLocation?.billToSameAsSite ? (serviceLocation.propertyName || serviceLocation.name) : null);
        const locBillToAddr = serviceLocation?.billToAddress || (serviceLocation?.billToSameAsSite ? (serviceLocation.address || addressObj) : null);

        const billToName = (!isProposal && !isOther && (job?.invoice?.billToName || (job as any)?.billToName)) 
            ? (job?.invoice?.billToName || (job as any)?.billToName) 
            : (locBillToName || (prop as any)?.billToName || (prop as any)?.billingCompany || (associatedCust as any)?.billingCompany || associatedCust?.name || customerName);

        const rawBillToAddr = isProposal 
            ? ((prop as any)?.billToAddress || (prop as any)?.billingAddress || locBillToAddr || (associatedCust as any)?.billingAddress || associatedCustAddress || addressObj)
            : ((!isOther && (job?.invoice?.billToAddress || (job as any)?.billToAddress)) 
                ? (job?.invoice?.billToAddress || (job as any)?.billToAddress) 
                : (locBillToAddr || (job as any)?.billingAddress || (associatedCust as any)?.billingAddress || addressObj));

        const serviceLocCity = serviceLocation?.city || (job as any)?.serviceLocationCity || (associatedJob as any)?.serviceLocationCity || (job as any)?.city || (associatedJob as any)?.city || (prop as any)?.serviceLocationCity || (prop as any)?.city || associatedCust?.city || '';
        const serviceLocState = serviceLocation?.state || (job as any)?.serviceLocationState || (associatedJob as any)?.serviceLocationState || (job as any)?.state || (associatedJob as any)?.state || (prop as any)?.serviceLocationState || (prop as any)?.state || associatedCust?.state || '';
        const serviceLocZip = serviceLocation?.zip || (job as any)?.serviceLocationZip || (associatedJob as any)?.serviceLocationZip || (job as any)?.zip || (associatedJob as any)?.zip || (prop as any)?.serviceLocationZip || (prop as any)?.zip || associatedCust?.zip || '';

        const billToCity = serviceLocation?.billToSameAsSite ? (serviceLocation?.city || serviceLocCity) : ((associatedCust as any)?.city || (job as any)?.city || (prop as any)?.city);
        const billToState = serviceLocation?.billToSameAsSite ? (serviceLocation?.state || serviceLocState) : ((associatedCust as any)?.state || (job as any)?.state || (prop as any)?.state);
        const billToZip = serviceLocation?.billToSameAsSite ? (serviceLocation?.zip || serviceLocZip) : ((associatedCust as any)?.zip || (job as any)?.zip || (prop as any)?.zip);

        const billToAddress = formatFullAddress(rawBillToAddr, billToCity, billToState, billToZip) || associatedCustAddress || address;
        const billToAddrLines = getAddressLines(
            rawBillToAddr,
            billToCity,
            billToState,
            billToZip
        );

        const serviceLocAddrLines = getAddressLines(
            serviceLocation?.address || (job as any)?.serviceLocationAddress || (job as any)?.locationAddress || serviceLocation || addressObj,
            serviceLocCity,
            serviceLocState,
            serviceLocZip
        );

        const rawDate = isProposal 
            ? (prop?.createdAt || new Date().toISOString()) 
            : (isOther 
                ? (otherData?.createdAt || otherData?.timestamp || new Date().toISOString()) 
                : (job?.invoice?.invoiceDate || job?.invoice?.date || job?.appointmentTime));
        const date = rawDate;
        
        const docResolved = resolveDocumentDisplayId(type, isProposal ? (prop || data) : (job || data));
        const id = docResolved.id || (isProposal ? 'DRAFT' : 'PREVIEW');
        const referenceNumber = docResolved.referenceNumber || (prop as any)?.referenceNumber || (job?.invoice as any)?.referenceNumber || (data as any)?.referenceNumber || null;
        
        const status = isProposal ? prop?.status : (isOther ? 'Signed' : job?.invoice?.status);
        const signature = isProposal 
            ? (prop?.signatureDataUrl || prop?.signature) 
            : (isOther 
                ? (otherData?.signatureImage || otherData?.signatureDataUrl || otherData?.signature || null) 
                : (job?.customerSignature || job?.signature || job?.siteManagerSignature || job?.invoiceSignature || (job as any)?.workflowState?.customerSignature || (job as any)?.workflowState?.siteManagerSignature || (job as any)?.workflowState?.signature || (job?.invoice as any)?.signatureUrl || (job as any)?.signOff?.sheetUrl || job?.signOffSheetUrl || (job as any)?.signoffSheetUrl || null));

        const resolvedSignerName = isProposal 
            ? ((prop as any)?.signerName || (prop as any)?.customerSignatureName || null) 
            : (isOther 
                ? (otherData?.signerName || otherData?.managerName || null) 
                : (job?.customerSignatureName || job?.signerName || (job as any)?.siteManagerName || (job as any)?.workflowState?.customerSignatureName || (job as any)?.workflowState?.siteManagerName || (job as any)?.workflowState?.signerName || (job as any)?.signOff?.managerName || null));

        const resolvedSignatureDate = isProposal
            ? ((prop as any)?.signedAt || (prop as any)?.signatureTimestamp || null)
            : (isOther
                ? (otherData?.signedAt || otherData?.timestamp || null)
                : (job?.signatureTimestamp || job?.signedAt || (job as any)?.workflowState?.signatureTimestamp || (job as any)?.signOff?.timestamp || (job?.invoice as any)?.signedAt || null));

        const resolvedTechSignature = (!isProposal && !isOther)
            ? (job?.techSignature || (job as any)?.workflowState?.techSignature || null)
            : null;

        const resolvedTechSignerName = (!isProposal && !isOther)
            ? (job?.techSignatureName || (job as any)?.workflowState?.techSignatureName || job?.assignedTechnicianName || null)
            : null;

        const resolvedTechSignatureDate = (!isProposal && !isOther)
            ? ((job as any)?.techSignatureTimestamp || (job as any)?.workflowState?.techSignatureTimestamp || null)
            : null;

        const jobNumber = (() => {
            if (!isProposal && !isOther) {
                const raw = job?.jobNumber || (job?.id && !job.id.startsWith('inv-') && !job.id.startsWith('INV-') ? job.id : null) || (job as any)?.jobId || loadedJob?.jobNumber || loadedJob?.id || null;
                if (!raw) return null;
                return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
            }
            if (isProposal) {
                const raw = (prop as any)?.jobNumber || (prop as any)?.jobId || (Array.isArray(prop?.linkedJobIds) && prop?.linkedJobIds[0]) || loadedJob?.jobNumber || loadedJob?.id || null;
                if (!raw) return null;
                return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
            }
            const raw = otherData?.jobNumber || otherData?.jobId || null;
            if (!raw) return null;
            return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
        })();

        const woNumber = (!isProposal && !isOther)
            ? (job?.workOrderNumber || (job as any)?.woNumber || job?.poNumber || (job?.invoice as any)?.workOrderNumber || (job?.invoice as any)?.woNumber || (job?.invoice as any)?.poNumber || (data as any)?.workOrderNumber || (data as any)?.poNumber || loadedJob?.workOrderNumber || (loadedJob as any)?.woNumber || loadedJob?.poNumber || null)
            : (prop?.workOrderNumber || (prop as any)?.woNumber || prop?.poNumber || (prop as any)?.customWorkOrderNumber || (data as any)?.workOrderNumber || (data as any)?.poNumber || null);

        const poNumber = woNumber;

        const distinctPoNumber = (() => {
            const rawPo = (!isProposal && !isOther)
                ? (job?.poNumber || (job?.invoice as any)?.poNumber || (data as any)?.poNumber || loadedJob?.poNumber || null)
                : (prop?.poNumber || (data as any)?.poNumber || loadedJob?.poNumber || null);
            if (!rawPo) return null;
            if (woNumber && String(rawPo).trim().toLowerCase() === String(woNumber).trim().toLowerCase()) return null;
            return String(rawPo);
        })();

        const recommendations = isProposal ? prop?.recommendations : (isOther ? null : (job?.invoice?.recommendations || job?.invoice?.notes || (job as any)?.techRecommendations || (job as any)?.recommendations));

        const customerId = (isProposal ? prop?.customerId : (isOther ? null : job?.customerId)) || state.customers.find(c => c.name === customerName)?.id || null;
        const rawDueDate = (() => {
            if (isProposal) return null;
            if (job?.invoice?.dueDate) return job.invoice.dueDate;
            const dateStr = job?.invoice?.invoiceDate || job?.invoice?.date || job?.appointmentTime;
            if (!dateStr) return null;
            const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const dateObj = new Date(cleanStr.replace(/-/g, '/'));
            if (isNaN(dateObj.getTime())) return null;
            const associatedCust = state.customers.find(c => c.id === customerId);
            const terms = job?.invoice?.paymentTerms || associatedCust?.paymentTerms || 'net_30';
            const days = getPaymentTermsDays(terms);
            dateObj.setDate(dateObj.getDate() + days);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        })();
        const dueDate = rawDueDate;

        const isMcAlisters = (
            customerName?.toLowerCase().includes('mcalister') ||
            customerName?.toLowerCase().includes('best choice') ||
            billToName?.toLowerCase().includes('best choice') ||
            prop?.customerName?.toLowerCase().includes('mcalister') ||
            prop?.customerName?.toLowerCase().includes('best choice')
        );

        let finalCustomerName = customerName;
        let finalAddress = address;
        let finalBillToName = billToName;
        let finalBillToAddress = billToAddress;

        // Calculate overdue late fees/interest for unpaid invoices
        const overdueDetails = (() => {
            if (isProposal || isOther || !dueDate || status === 'Paid' || !org) {
                return { overdueDays: 0, lateFeeAmountApplied: 0, interestAmountApplied: 0, totalLateFees: 0 };
            }
            
            const today = new Date();
            let dueDateObj = new Date(dueDate);
            if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
                dueDateObj = new Date(dueDate.replace(/-/g, '/'));
            }
            dueDateObj.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            
            const msPerDay = 24 * 60 * 60 * 1000;
            const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / msPerDay));
            
            const gracePeriod = org.lateFeeGracePeriod || 0;
            if (isNaN(overdueDays) || overdueDays <= gracePeriod) {
                return { overdueDays: isNaN(overdueDays) ? 0 : overdueDays, lateFeeAmountApplied: 0, interestAmountApplied: 0, totalLateFees: 0 };
            }
            
            const amountPaid = job?.invoice?.amountPaid || 0;
            const baseBalanceDue = Math.max(0, total - amountPaid);
            
            let lateFeeAmountApplied = 0;
            let interestAmountApplied = 0;
            
            if (org.lateFeeEnabled) {
                if (org.lateFeeType === 'flat') {
                    lateFeeAmountApplied = org.lateFeeValue || 0;
                } else if (org.lateFeeType === 'percent') {
                    lateFeeAmountApplied = baseBalanceDue * ((org.lateFeeValue || 0) / 100);
                }
            }
            
            if (org.lateFeeInterestRate > 0) {
                interestAmountApplied = baseBalanceDue * ((org.lateFeeInterestRate) / 100) * (overdueDays / 30);
            }
            
            const roundedLateFee = Math.round((lateFeeAmountApplied + Number.EPSILON) * 100) / 100;
            const roundedInterest = Math.round((interestAmountApplied + Number.EPSILON) * 100) / 100;
            const totalLateFees = Math.round((roundedLateFee + roundedInterest + Number.EPSILON) * 100) / 100;
            
            return {
                overdueDays,
                lateFeeAmountApplied: roundedLateFee,
                interestAmountApplied: roundedInterest,
                totalLateFees
            };
        })();

        const canonical = computeCanonicalFinancials({
            items,
            subtotal,
            taxAmount: tax,
            additionalFeePercent,
            additionalFeeName,
            additionalFeeAmount,
            depositType: isProposal ? ((data as any)?.depositType || (prop as any)?.depositType || 'none') : ((data as any)?.depositType || (job as any)?.invoice?.depositType || (prop as any)?.depositType),
            depositValue: isProposal ? ((data as any)?.depositValue ?? (prop as any)?.depositValue ?? 0) : ((data as any)?.depositValue || (job as any)?.invoice?.depositValue || (prop as any)?.depositValue),
            depositAmount: isProposal ? ((data as any)?.depositAmount ?? (prop as any)?.depositAmount ?? 0) : ((data as any)?.depositAmount || (job as any)?.invoice?.depositAmount || (prop as any)?.depositAmount),
            depositPaid: isProposal ? !!((data as any)?.depositPaid || (prop as any)?.depositPaid) : !!((data as any)?.depositPaid || (job as any)?.invoice?.depositPaid || (prop as any)?.depositPaid),
            depositPaidAmount: isProposal ? ((data as any)?.depositPaidAmount || (prop as any)?.depositPaidAmount || 0) : ((data as any)?.depositPaidAmount || (job as any)?.invoice?.depositPaidAmount || (prop as any)?.depositPaidAmount),
            depositNotes: isProposal ? ((data as any)?.depositNotes || (prop as any)?.depositNotes || '') : ((data as any)?.depositNotes || (job as any)?.invoice?.depositNotes || (prop as any)?.depositNotes),
            paymentTerms: (data as any)?.paymentTerms || (job as any)?.invoice?.paymentTerms || (prop as any)?.paymentTerms || (org as any)?.paymentTerms || 'net_30',
            amountPaid: (data as any)?.amountPaid || (job as any)?.invoice?.amountPaid || (prop as any)?.amountPaid,
            amountRefunded: (data as any)?.amountRefunded || (job as any)?.invoice?.amountRefunded || (job as any)?.amountRefunded,
            netPaid: (data as any)?.netPaid || (job as any)?.invoice?.netPaid || (job as any)?.netPaid,
            payments: (data as any)?.payments || (job as any)?.invoice?.payments || (job as any)?.payments || [],
            refunds: (data as any)?.refunds || (job as any)?.invoice?.refunds || (job as any)?.refunds || [],
            status
        });

        const docDepositAmount = canonical.depositRequired;
        const docDepositNotes = canonical.depositNotes;
        const docDepositPaid = canonical.depositPaid;
        const docPaymentTerms = (data as any)?.paymentTerms || (job as any)?.invoice?.paymentTerms || (prop as any)?.paymentTerms || (org as any)?.paymentTerms || 'Net Terms';
        const docAmountPaid = canonical.amountPaid;
        const docAmountRefunded = canonical.amountRefunded;
        const docNetPaid = canonical.netPaid;
        const docPayments = canonical.payments || [];
        const docRefunds = canonical.refunds || [];
        const docBalanceRemaining = canonical.balanceDue;

        return { prop, job, id, referenceNumber, total: canonical.grandTotal, subtotal: canonical.subtotal, tax: canonical.taxAmount, taxRatePct, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName: finalCustomerName, address: finalAddress, billToName: finalBillToName, billToAddress: finalBillToAddress, poNumber, jobNumber, woNumber, distinctPoNumber, customerId, date, status, signature, resolvedSignerName, resolvedSignatureDate, resolvedTechSignature, resolvedTechSignerName, resolvedTechSignatureDate, items, recommendations, otherData, dueDate, isMcAlisters, overdueDetails, associatedCust, associatedCustAddress, associatedCustAddrLines, billToAddrLines, serviceLocAddrLines, matchedLocAddress, serviceLocation, docDepositAmount, docDepositNotes, docDepositPaid, docPaymentTerms, docAmountPaid, docAmountRefunded, docNetPaid, docPayments, docRefunds, docBalanceRemaining, canonical };
    }, [type, isProposal, isOther, data, state.proposals, state.jobs, state.customers, loadedJob, loadedCustomer, org]);

    const isPnL = type === 'Other' && (
        otherData?.title?.includes('Profit & Loss') || 
        otherData?.title?.includes('Profit and Loss') || 
        (data as any)?.title?.includes('Profit & Loss') || 
        (data as any)?.title?.includes('Profit and Loss')
    );

    const getTierDisplay = (tierName: string) => {
        return getProposalTierLabel(prop, tierName);
    };

    const calculateAvailableTiers = () => {
        if (!isProposal || !prop) return [];
        const tiers = getAvailableProposalTiers(prop);
        const results: any[] = [];
        for (const t of tiers) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tierItems = (items || []).filter((i: any) => matchTier(i.tier, t));
            if (tierItems.length === 0) continue;
            // Avoid duplicate tier representations (e.g. Basic and Option 1 mapping to same items)
            if (results.some(r => matchTier(r.tier, t))) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const st = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const taxable = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
            const taxAmount = taxable * ((org?.taxRate || 8.25) / 100);
            const totalBeforeFee = st + taxAmount;
            const additionalFeeAmountTier = prop.additionalFeePercent ? (totalBeforeFee * (prop.additionalFeePercent / 100)) : 0;
            results.push({ tier: t, items: tierItems, subtotal: st, taxAmount: taxAmount, additionalFeeAmount: additionalFeeAmountTier, total: totalBeforeFee + additionalFeeAmountTier });
        }
        return results;
    };
    const multiTiers = calculateAvailableTiers();
    const showMultiTier = isProposal && multiTiers.length > 1 && (!prop?.selectedOption || prop?.status !== 'Accepted');
    const proposalId = job?.proposalId;

    useEffect(() => {
        if (proposalId) {
            const found = state.proposals.find(p => p.id === proposalId);
            if (found) {
                setLoadedProposal(found);
            } else {
                db.collection('proposals').doc(proposalId).get().then(doc => {
                    if (doc.exists) {
                        setLoadedProposal({ id: doc.id, ...doc.data() } as Proposal);
                    }
                }).catch(err => console.error("Error fetching linked proposal: ", err));
            }
        }
    }, [proposalId, state.proposals]);

    const jobIdForProp = isProposal ? prop?.jobId : null;

    useEffect(() => {
        if (jobIdForProp) {
            const found = state.jobs.find(j => j.id === jobIdForProp);
            if (found) {
                setLoadedJob(found);
            } else {
                db.collection('jobs').doc(jobIdForProp).get().then(doc => {
                    if (doc.exists) {
                        setLoadedJob({ id: doc.id, ...doc.data() } as Job);
                    }
                }).catch(err => console.error("Error fetching linked job for proposal: ", err));
            }
        }
    }, [jobIdForProp, state.jobs]);

    const activeProp = prop || loadedProposal;

    const [agreedNotToShare, setAgreedNotToShare] = useState(() => {
        if (activeProp?.competitorAgreementAgreed) return true;
        if (activeProp?.id) {
            return localStorage.getItem(`competitor_agreement_${activeProp.id}`) === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (activeProp?.competitorAgreementAgreed) {
            setAgreedNotToShare(true);
        } else if (activeProp?.id) {
            if (localStorage.getItem(`competitor_agreement_${activeProp.id}`) === 'true') {
                setAgreedNotToShare(true);
            }
        }
    }, [activeProp]);

    const handleUnlockDetails = async () => {
        setAgreedNotToShare(true);
        if (activeProp?.id) {
            localStorage.setItem(`competitor_agreement_${activeProp.id}`, 'true');
            try {
                await db.collection('proposals').doc(activeProp.id).update(cleanUndefinedFields({
                    competitorAgreementAgreed: true,
                    competitorAgreementAgreedAt: new Date().toISOString()
                }));
            } catch (err) {
                console.warn("Could not save competitor agreement to Firestore, fallback to local storage:", err);
            }
        }
    };

    const hasAgreedToPortalTerms = useMemo(() => {
        if (!state.currentUser) return false;
        const email = state.currentUser.email?.trim().toLowerCase();
        const uid = state.currentUser.uid;
        const customerId = (state.currentUser as any).customerId;

        const matchedCustomer = state.customers.find(c => 
            (customerId && c.id === customerId) ||
            (uid && (c as any).userId === uid) ||
            (email && c.email?.trim().toLowerCase() === email)
        );

        return matchedCustomer?.agreedToCustomerTerms === true;
    }, [state.currentUser, state.customers]);

    const isUserLoggedIn = auth.currentUser && !auth.currentUser.isAnonymous;
    const isSummaryHidden = false;


    const handleConvertToJob = async () => {
        if (!isProposal || !prop || !state.currentOrganization) return;
        
        let existingJobId = prop.jobId;
        let existingJob = existingJobId ? (state.jobs.find(j => j.id === existingJobId) || null) : null;

        if (!existingJob) {
            // Check if any job explicitly links to this proposal or matching PO number
            const propJob = state.jobs.find(j => 
                j.proposalId === prop.id || 
                j.linkedProposalIds?.includes(prop.id) ||
                prop.linkedJobIds?.includes(j.id) ||
                (j.poNumber && prop.poNumber && j.poNumber.replace('#', '').trim() === prop.poNumber.replace('#', '').trim())
            );
            if (propJob) {
                existingJob = propJob;
                existingJobId = propJob.id;
            }
        }

        let shouldUpdateExisting = false;
        let shouldCreateNew = false;

        if (existingJob) {
            if (await globalConfirm(`An existing job/invoice #${existingJobId} (${existingJob.jobStatus}) linked to this proposal was found. Update that job/invoice with this proposal's accepted items?`)) {
                shouldUpdateExisting = true;
            } else {
                if (await globalConfirm(`Create a new Job/Invoice instead?`)) {
                    shouldCreateNew = true;
                }
            }
        } else {
            if (await globalConfirm(`Convert this proposal for ${prop.customerName} into an active Job/Invoice?`)) {
                shouldCreateNew = true;
            }
        }

        if (!shouldUpdateExisting && !shouldCreateNew) return;

        setIsConverting(true);
        const customer = state.customers.find(c => c.name === prop.customerName);

        try {
            // Determine the target items to convert:
            // If the proposal is tiered (or has options), only convert the accepted/selected tier!
            let proposalRawItems: any[] = Array.isArray(prop.items) && prop.items.length > 0 ? prop.items : [];
            
            // If project proposal or no standard items, synthesize from labor, parts, allowances:
            if (proposalRawItems.length === 0 && (prop.laborItems?.length || prop.partItems?.length || prop.allowanceItems?.length)) {
                const synthItems: any[] = [];
                if (Array.isArray(prop.laborItems)) {
                    prop.laborItems.forEach((l: any, idx: number) => {
                        const unitStr = l.unitName ? `[${l.unitName}] ` : '';
                        const title = l.title || l.unitName || 'Mechanical Installation Labor';
                        const scopeDesc = l.scope || (l.hours ? `${l.hours} hours @ $${l.rate || 0}/hr` : (l.description || (l.unitName ? `Labor hours for unit: ${l.unitName}` : '')));
                        const rate = Number(l.rate ?? l.value ?? 0);
                        const hours = Number(l.hours || 1);
                        const lineTotal = Number(l.total ?? (hours * rate));
                        const cost = Number(l.cost ?? l.laborCost ?? 0) || undefined;
                        synthItems.push({
                            id: l.id || `labor-${idx}`,
                            name: `${unitStr}${title}`,
                            description: scopeDesc,
                            quantity: hours,
                            unitPrice: rate,
                            price: rate,
                            total: lineTotal,
                            type: 'Labor',
                            taxable: false,
                            vendorCost: cost,
                            cost: cost,
                            tier: 'Basic'
                        });
                    });
                }
                if (Array.isArray(prop.partItems)) {
                    prop.partItems.forEach((p: any, idx: number) => {
                        const partName = p.partName || p.name || p.description || 'Part / Material';
                        const unitStr = p.unitName ? `[${p.unitName}] ` : '';
                        const availStr = p.availability ? ` • Availability: ${p.availability}` : '';
                        const descStr = p.partNumber ? `Part #: ${p.partNumber}${availStr}` : (p.description || (p.availability ? `Availability: ${p.availability}` : (p.unitName ? `Part for unit: ${p.unitName}` : '')));
                        const unitPrice = Number(p.customerUnitPrice ?? p.unitPrice ?? p.price ?? 0);
                        const qty = Number(p.quantity || 1);
                        const lineTotal = Number(p.customerLineTotal ?? p.total ?? (qty * unitPrice));
                        const vendorCost = p.vendorCost !== undefined ? Number(p.vendorCost) : undefined;
                        const markupPct = p.markupPct !== undefined ? Number(p.markupPct) : undefined;
                        synthItems.push({
                            id: p.id || `part-${idx}`,
                            name: `${unitStr}${partName}`,
                            description: descStr,
                            quantity: qty,
                            unitPrice: unitPrice,
                            price: unitPrice,
                            total: lineTotal,
                            type: unitPrice < 0 ? 'Discount' : 'Part',
                            taxable: p.taxable !== false && unitPrice >= 0,
                            vendorCost: vendorCost,
                            cost: vendorCost,
                            markupPct: markupPct,
                            tier: 'Basic'
                        });
                    });
                }
                if (Array.isArray(prop.allowanceItems)) {
                    prop.allowanceItems.forEach((a: any, idx: number) => {
                        const desc = a.description || a.name || 'Logistics / Equipment';
                        const rawNotes = a.basis || a.notes || '';
                        const notes = sanitizeCustomerScopeText(rawNotes);
                        const amt = Number(a.amount ?? a.cost ?? 0);
                        const cost = Number(a.cost ?? a.amount ?? 0) || undefined;
                        synthItems.push({
                            id: a.id || `allowance-${idx}`,
                            name: `Allowance: ${desc}`,
                            description: notes,
                            quantity: 1,
                            unitPrice: amt,
                            price: amt,
                            total: amt,
                            type: 'Fee',
                            taxable: a.taxable !== false,
                            vendorCost: cost,
                            cost: cost,
                            tier: 'Basic'
                        });
                    });
                }
                proposalRawItems = synthItems;
            }

            const hasTiers = proposalRawItems.some((i: any) => i.tier);
            const targetConversionTier = prop.selectedOption || (multiTiers.length > 0 ? multiTiers[0].tier : null);
            
            let filteredPropItems = proposalRawItems;
            if (hasTiers && targetConversionTier) {
                filteredPropItems = proposalRawItems.filter((i: any) => !i.tier || matchTier(i.tier, targetConversionTier));
            }

            const invoiceItemsToConvert = filteredPropItems.map((i: any) => {
                const unitPrice = Number(i.price ?? i.unitPrice ?? 0);
                const qty = Number(i.quantity || 1);
                const lineTotal = i.total !== undefined && i.total !== null ? Number(i.total) : (unitPrice * qty);
                const rawCost = i.vendorCost ?? i.cost ?? i.partCost;
                const numericCost = rawCost !== undefined ? Number(rawCost) : undefined;
                const numericMarkup = i.markupPct !== undefined ? Number(i.markupPct) : undefined;

                return {
                    id: i.id || `inv-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    name: i.name || i.description || 'Service Item',
                    description: i.description || i.name || '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    price: unitPrice,
                    total: lineTotal,
                    type: (i.type as any) || 'Part',
                    taxable: i.taxable !== false,
                    vendorCost: numericCost,
                    cost: numericCost,
                    markupPct: numericMarkup,
                    tier: i.tier,
                    isWarrantyWork: i.isWarrantyWork,
                    isPercentage: i.isPercentage,
                    percentageRate: i.percentageRate,
                    subItems: i.subItems ? i.subItems.map((sub: any) => ({
                        ...sub,
                        id: sub.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
                    })) : undefined
                };
            });

            const conversionFinancials = computeCanonicalFinancials({
                items: invoiceItemsToConvert,
                taxRate: (prop.taxRate !== undefined && prop.taxRate !== null)
                    ? (Number(prop.taxRate) <= 1 ? Number(prop.taxRate) : Number(prop.taxRate) / 100)
                    : ((state.currentOrganization.taxRate || 8.25) / 100),
                taxAmount: (hasTiers ? undefined : prop.taxAmount),
                depositType: prop.depositType || 'percentage',
                depositValue: prop.depositValue,
                paymentTerms: (prop as any).paymentTerms || (existingJob?.invoice?.paymentTerms || 'net_30'),
                requireDeposit: prop.requireDeposit ?? ((prop.depositValue && prop.depositValue > 0) || (prop.depositAmount && prop.depositAmount > 0)),
                depositNotes: prop.depositNotes,
                additionalFeePercent: prop.additionalFeePercent || 0,
                additionalFeeName: prop.additionalFeeName || '',
                additionalFeeAmount: prop.additionalFeeAmount || 0,
            });

            if (shouldUpdateExisting && existingJob && existingJobId) {
                // Update the existing job's invoice
                const existingJobSlug = extractJobSlug(existingJob.jobNumber || existingJob.id);
                const targetInvoiceId = existingJob.invoice?.id || prop.invoiceId || resolveJobInvoiceNumber(existingJob);
                const updatedInvoice = {
                    id: targetInvoiceId,
                    ...existingJob.invoice,
                    proposalId: prop.id,
                    proposalNumber: prop.proposalNumber || prop.id,
                    poNumber: prop.poNumber || existingJob.invoice?.poNumber || existingJob.poNumber || '',
                    displayFormat: prop.displayFormat || existingJob.invoice?.displayFormat || 'itemized',
                    items: invoiceItemsToConvert,
                    subtotal: conversionFinancials.subtotal,
                    taxRate: conversionFinancials.taxRate,
                    taxAmount: conversionFinancials.taxAmount,
                    totalAmount: conversionFinancials.grandTotal,
                    grandTotal: conversionFinancials.grandTotal,
                    amount: conversionFinancials.grandTotal,
                    additionalFeeName: conversionFinancials.additionalFeeName || prop.additionalFeeName,
                    additionalFeePercent: conversionFinancials.additionalFeePercent ?? prop.additionalFeePercent,
                    additionalFeeAmount: conversionFinancials.additionalFeeAmount ?? prop.additionalFeeAmount,
                    depositType: conversionFinancials.depositType as any,
                    depositValue: conversionFinancials.depositValue,
                    depositAmount: conversionFinancials.depositRequired,
                    depositRequired: conversionFinancials.depositRequired,
                    depositPaid: conversionFinancials.depositPaid ?? prop.depositPaid,
                    depositPaidAmount: conversionFinancials.depositPaidAmount ?? prop.depositPaidAmount,
                    depositNotes: conversionFinancials.depositNotes || prop.depositNotes,
                    amountDueToday: conversionFinancials.amountDueToday,
                    amountDueNet: conversionFinancials.amountDueNet,
                    balanceDue: conversionFinancials.balanceDue,
                    balanceRemaining: conversionFinancials.balanceRemaining,
                    financialStatus: conversionFinancials.financialStatus,
                    paymentTerms: conversionFinancials.paymentTerms,
                    paymentTermsLabel: conversionFinancials.paymentTermsLabel,
                    recommendations: prop.recommendations || existingJob.invoice?.recommendations || '',
                    notes: prop.recommendations || existingJob.invoice?.notes || '',
                    warrantyNotes: prop.warrantyTerms || existingJob.invoice?.warrantyNotes || '',
                    status: existingJob.invoice?.status || 'Unpaid'
                };

                const updatedJobPropIds = Array.from(new Set([...(existingJob.linkedProposalIds || []), prop.id]));
                const updatedJob: Job = {
                    ...existingJob,
                    proposalId: prop.id,
                    linkedProposalIds: updatedJobPropIds,
                    invoice: updatedInvoice,
                    specialInstructions: `${existingJob.specialInstructions || ''}\nUpdated from Proposal #${prop.id}`.trim(),
                    updatedAt: new Date().toISOString()
                };

                await db.collection('jobs').doc(existingJobId).set(cleanUndefinedFields(updatedJob));
                dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                
                // Write back invoiceId and linkedJobIds to the proposal in Firestore
                const updatedJobIds = Array.from(new Set([...(prop.linkedJobIds || []), existingJobId]));
                const updatedProp = {
                    ...prop,
                    invoiceId: targetInvoiceId,
                    jobId: existingJobId,
                    linkedJobIds: updatedJobIds,
                    status: 'Accepted'
                };
                await db.collection('proposals').doc(prop.id).update(cleanUndefinedFields({
                    invoiceId: targetInvoiceId,
                    jobId: existingJobId,
                    linkedJobIds: updatedJobIds,
                    status: 'Accepted'
                }));
                dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProp });

                showToast.success("Job & Invoice linked and updated successfully with proposal items!");
            } else {
                // Create a new job/invoice (no existing job linked or follow-up job requested)
                const jobId = await getNextJobNumber(state.currentOrganization.id);
                const invoiceId = resolveJobInvoiceNumber(jobId);

                const targetJobAddress = (prop as any)?.locationAddress || 
                                        (prop as any)?.serviceLocationAddress || 
                                        (prop as any)?.siteAddress || 
                                        (prop as any)?.address || 
                                        existingJob?.address || 
                                        matchedLocAddress || 
                                        (customer?.address || '');

                const targetLocationName = resolveSiteLocationName(prop, serviceLocation) || 
                                           existingJob?.locationName || 
                                           (serviceLocation as any)?.propertyName || 
                                           serviceLocation?.name || 
                                           null;

                const targetLocationId = (prop as any)?.locationId || 
                                         existingJob?.locationId || 
                                         serviceLocation?.id || 
                                         null;

                const newJob: Job = {
                    id: jobId,
                    jobNumber: jobId,
                    organizationId: state.currentOrganization.id,
                    customerName: prop.customerName,
                    customerId: customer?.id || null,
                    proposalId: prop.id,
                    linkedProposalIds: [prop.id],
                    parentJobId: existingJob ? existingJob.id : null,
                    linkedJobIds: existingJob ? [existingJob.id] : [],
                    address: targetJobAddress,
                    locationName: targetLocationName,
                    locationId: targetLocationId,
                    poNumber: prop.poNumber || existingJob?.poNumber || null,
                    workOrderNumber: prop.poNumber || existingJob?.workOrderNumber || existingJob?.poNumber || null,
                    tasks: invoiceItemsToConvert.map(i => i.name),
                    jobStatus: 'Scheduled',
                    appointmentTime: new Date().toISOString(),
                    assignedTechnicianId: prop.createdById || state.currentUser?.id || null,
                    invoice: {
                        id: invoiceId,
                        invoiceNumber: invoiceId,
                        number: invoiceId,
                        proposalId: prop.id,
                        proposalNumber: prop.proposalNumber || prop.id,
                        poNumber: prop.poNumber || existingJob?.poNumber || '',
                        displayFormat: prop.displayFormat || 'itemized',
                        items: invoiceItemsToConvert,
                        subtotal: conversionFinancials.subtotal,
                        taxRate: conversionFinancials.taxRate,
                        taxAmount: conversionFinancials.taxAmount,
                        totalAmount: conversionFinancials.grandTotal,
                        grandTotal: conversionFinancials.grandTotal,
                        amount: conversionFinancials.grandTotal,
                        additionalFeeName: conversionFinancials.additionalFeeName || prop.additionalFeeName,
                        additionalFeePercent: conversionFinancials.additionalFeePercent ?? prop.additionalFeePercent,
                        additionalFeeAmount: conversionFinancials.additionalFeeAmount ?? prop.additionalFeeAmount,
                        depositType: conversionFinancials.depositType as any,
                        depositValue: conversionFinancials.depositValue,
                        depositAmount: conversionFinancials.depositRequired,
                        depositRequired: conversionFinancials.depositRequired,
                        depositPaid: conversionFinancials.depositPaid ?? prop.depositPaid,
                        depositPaidAmount: conversionFinancials.depositPaidAmount ?? prop.depositPaidAmount,
                        depositNotes: conversionFinancials.depositNotes || prop.depositNotes,
                        amountPaid: conversionFinancials.amountPaid,
                        balanceDue: conversionFinancials.balanceDue,
                        balanceRemaining: conversionFinancials.balanceRemaining,
                        amountDueToday: conversionFinancials.amountDueToday,
                        amountDueNet: conversionFinancials.amountDueNet,
                        paymentTerms: conversionFinancials.paymentTerms,
                        paymentTermsLabel: conversionFinancials.paymentTermsLabel,
                        financialStatus: conversionFinancials.financialStatus,
                        recommendations: prop.recommendations || '',
                        notes: prop.recommendations || '',
                        warrantyNotes: prop.warrantyTerms || '',
                        status: 'Unpaid'
                    },
                    jobEvents: [],
                    specialInstructions: `Auto-converted from Proposal #${prop.id}`,
                    source: 'ProposalConversion',
                    createdAt: new Date().toISOString()
                };

                await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(newJob));
                dispatch({ type: 'ADD_JOB', payload: newJob });

                // If an existing job was present, update its linkedJobIds to link to this new follow-up job
                if (existingJob) {
                    const updatedExistingJobIds = Array.from(new Set([...(existingJob.linkedJobIds || []), jobId]));
                    await db.collection('jobs').doc(existingJob.id).update(cleanUndefinedFields({
                        linkedJobIds: updatedExistingJobIds,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: {
                            ...existingJob,
                            linkedJobIds: updatedExistingJobIds
                        }
                    });
                }

                // Write back invoiceId and jobId to the proposal in Firestore to ensure bidirectional linkage
                const updatedJobIds = Array.from(new Set([...(prop.linkedJobIds || []), ...(existingJob ? [existingJob.id] : []), jobId]));
                const propRefNum = prop.referenceNumber || (prop.id.startsWith('PROP-') && !prop.id.includes(extractJobSlug(jobId)) ? prop.id : null);
                const updatedProp = {
                    ...prop,
                    invoiceId: invoiceId,
                    jobId: jobId,
                    linkedJobIds: updatedJobIds,
                    referenceNumber: propRefNum,
                    status: 'Accepted'
                };
                await db.collection('proposals').doc(prop.id).update(cleanUndefinedFields({
                    invoiceId: invoiceId,
                    jobId: jobId,
                    linkedJobIds: updatedJobIds,
                    referenceNumber: propRefNum,
                    status: 'Accepted'
                }));
                dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProp });

                showToast.success("Job & Invoice created and linked successfully! View in Operations.");
            }
            onClose();
        } catch (e) {
            console.error(e);
            showToast.warn("Conversion/Update failed.");
        } finally {
            setIsConverting(false);
        }
    };
    const handlePrint = async () => {
        const originalViewMode = viewMode;
        
        try {
            if (originalViewMode !== 'pdf') {
                setViewMode('pdf');
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (!printRef.current) {
                setViewMode(originalViewMode);
                return;
            }
            
            // Final polish of content for printing
            const html = generatePrintHtml(type, id, printRef.current.innerHTML);
            
            // Restore viewMode immediately after capturing HTML content
            setViewMode(originalViewMode);

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
        } catch (e) {
            console.error('Print failed', e);
            setViewMode(originalViewMode);
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
        setIsDownloading(true);
        const originalViewMode = viewMode;
        
        try {
            if (isProposal && (activeProp || prop || data)) {
                const { generateProposalPdfAttachment } = await import('lib/pdfHelper');
                const { downloadFile } = await import('lib/downloadHelper');
                const att = await generateProposalPdfAttachment(activeProp || prop || data, org || state.currentOrganization);
                const dataUri = att.content ? `data:application/pdf;base64,${att.content}` : (att.path || '');
                if (!dataUri) throw new Error("Could not produce downloadable proposal PDF.");
                await downloadFile(dataUri, att.filename);
                setIsDownloading(false);
                return;
            }

            if ((type === 'Invoice' || (!isProposal && (job?.invoice || (data as any)?.invoice || (data as any)?.subtotal !== undefined))) && (job || data)) {
                const { generateInvoicePdfAttachment } = await import('lib/pdfHelper');
                const { downloadFile } = await import('lib/downloadHelper');
                const att = await generateInvoicePdfAttachment(job || data, org || state.currentOrganization);
                const dataUri = att.content ? `data:application/pdf;base64,${att.content}` : (att.path || '');
                if (!dataUri) throw new Error("Could not produce downloadable invoice PDF.");
                await downloadFile(dataUri, att.filename);
                setIsDownloading(false);
                return;
            }

            if (((type as string) === 'Service Report' || (type as string) === 'Work Order' || (type as string) === 'Service_Report' || (type as string) === 'Work_Order') && (job || data)) {
                const { generateJobReportPdfAttachment } = await import('lib/pdfHelper');
                const { downloadFile } = await import('lib/downloadHelper');
                const att = await generateJobReportPdfAttachment(job || data, org || state.currentOrganization);
                const dataUri = att.content ? `data:application/pdf;base64,${att.content}` : (att.path || '');
                if (!dataUri) throw new Error("Could not produce downloadable service report PDF.");
                await downloadFile(dataUri, att.filename);
                setIsDownloading(false);
                return;
            }

            if (originalViewMode !== 'pdf') {
                setViewMode('pdf');
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (!printRef.current) {
                setViewMode(originalViewMode);
                return;
            }

            // Create a clean clone of the document for PDF generation
            const clone = printRef.current.cloneNode(true) as HTMLElement;
            clone.style.boxShadow = 'none';
            clone.style.margin = '0';
            clone.style.padding = '24px'; // 0.25in padding for professional margin spacing inside PDF
            clone.style.width = '720px'; // Exact printable width in pixels for Letter page (7.5 inches at 96 DPI)
            clone.style.height = 'auto';
            clone.style.overflow = 'visible'; // Ensure nothing is cut off
            clone.querySelectorAll('.no-print').forEach(el => el.remove());

            // Inject all active in-memory CSS rules directly into clone so html2canvas never relies on network CSS link fetches
            const styleElem = document.createElement('style');
            styleElem.innerHTML = getAllActiveStylesHtml().replace(/<\/?style>/g, '');
            clone.prepend(styleElem);

            // Fix CORS issue for the TekTrakker footer logo inside emails/other docs by using relative same-origin URL
            clone.querySelectorAll('img').forEach((img) => {
                if (img.src && img.src.includes('tektrakker.web.app/tektrakker-logo-web.png')) {
                    img.src = '/tektrakker-logo-web.png';
                }
            });
            
            const fileName = customerName ? `${type}-${customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf` : `${type}-${id}.pdf`;
            
            const { renderHtmlToSmartPdf } = await import('lib/pdfHelper');
            const result = await renderHtmlToSmartPdf(clone, {
                filename: fileName,
                margin: [0.25, 0.25, 0.25, 0.25],
                windowWidth: 780,
                pdfFormat: 'letter',
                pdfOrientation: 'portrait',
                scale: 2,
                quality: 0.98
            });
            const { downloadFile } = await import('lib/downloadHelper');
            await downloadFile(result.dataUri, fileName);
        } catch (e) {
            console.error('Download failed', e);
            showToast.warn('Failed to generate PDF directly. Falling back to print dialog...');
            handlePrint();
        } finally {
            setIsDownloading(false);
            setViewMode(originalViewMode);
        }
    };


    return ReactDOM.createPortal(
        <div id="document-preview-overlay" onClick={onClose} className={`fixed inset-0 bg-slate-900/60 sm:backdrop-blur-md flex items-center justify-center p-0 sm:p-4 md:p-6 ${zIndex} animate-in fade-in duration-200 overflow-y-auto`}>
            <div onClick={e => e.stopPropagation()} className="bg-slate-50 dark:bg-slate-950 w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl xl:max-w-6xl sm:rounded-[2.5rem] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            {/* Control Header */}
            <div className="bg-white dark:bg-slate-800 shadow-xl p-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                {/* Row 1: Document Identity & ID (Left) + Prominent Close Button (Right) */}
                <div className="flex items-center justify-between gap-3 min-w-0 pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="bg-primary-600 p-2 rounded-xl text-white shadow-md shadow-primary-500/20 shrink-0">
                            <FileText size={18} className="sm:w-5 sm:h-5"/>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 
                                title={(data as any)?.title || (data as any)?.name || (data as any)?.fileName || `Reviewing ${type}`}
                                className="text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white leading-tight truncate"
                            >
                                {(data as any)?.title || (data as any)?.name || (data as any)?.fileName || `Reviewing ${type}`}
                            </h2>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">
                                {type === 'Other' && (data as any)?.id ? `ID: #${(data as any).id}` : `ID: #${id}`}
                            </p>
                        </div>
                    </div>

                    {/* Dedicated, non-overlapping Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-xs"
                        aria-label="Close"
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Row 2: View Mode Switcher (Left) + Action Buttons Toolbar (Right) */}
                <div className="pt-2.5 flex flex-wrap items-center justify-between gap-2">
                    {!isOther ? (
                        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 shrink-0 border border-slate-200/50 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setViewMode('customer')}
                                className={`px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'customer'
                                        ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm border-none'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-none bg-transparent'
                                }`}
                            >
                                Customer Portal
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('pdf')}
                                className={`px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'pdf'
                                        ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm border-none'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-none bg-transparent'
                                }`}
                            >
                                Print PDF
                            </button>
                        </div>
                    ) : <div />}

                    {/* Action Buttons Toolbar with flex-wrap - zero clipping or off-screen overflow */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {onSave && (
                            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md shadow-emerald-500/20 py-1.5 sm:py-2 px-2.5 sm:px-3.5">
                                <Save size={14} className="sm:w-4 sm:h-4"/> <span>Save</span>
                            </Button>
                        )}
                        {isProposal && status === 'Accepted' && isInternal && (
                            <Button onClick={handleConvertToJob} disabled={isConverting} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md shadow-emerald-500/20 py-1.5 sm:py-2 px-2.5 sm:px-3.5">
                                <ArrowRight size={14} className="sm:w-4 sm:h-4"/> <span>{isConverting ? '...' : 'Convert'}</span>
                            </Button>
                        )}
                        <Button onClick={handleDownload} disabled={isDownloading} variant="secondary" className="flex items-center gap-1 sm:gap-1.5 text-xs font-black border-slate-200 dark:border-slate-700 py-1.5 sm:py-2 px-2.5 sm:px-3.5">
                            <FileText size={14} className="sm:w-4 sm:h-4"/> <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                        </Button>
                        {type !== 'Invoice' && (
                            <Button onClick={handlePrint} className="flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md shadow-primary-500/20 py-1.5 sm:py-2 px-2.5 sm:px-3.5">
                                <Printer size={14} className="sm:w-4 sm:h-4"/> <span>Print</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="w-full p-2 sm:p-4 md:p-12 flex justify-center">
                    {viewMode === 'customer' ? (
                        <div ref={printRef} className="w-full max-w-4xl sm:shrink-0 h-fit mb-12 flex flex-col bg-transparent text-slate-900 animate-in fade-in duration-300">
                            {type === 'Invoice' ? (
                                <div className="w-full max-w-4xl mx-auto py-2 px-2 text-left font-sans">
                                    <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading invoice preview...</div>}>
                                        <CustomerPayment 
                                            jobId={(job as any)?.id || (loadedJob as any)?.id || (data as any)?.jobId || (data as any)?.id || id}
                                            jobData={((job || loadedJob || data) as any)}
                                            orgData={org}
                                            embedded={true}
                                        />
                                    </React.Suspense>
                                </div>
                            ) : type === 'Other' ? (() => {
                                if (isPnL) {
                                    return (
                                        <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans animate-in fade-in duration-300">
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden">
                                                {otherData?.htmlContent ? (
                                                    <div className="prose max-w-none text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                                ) : (
                                                    <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{otherData?.content || otherData?.body || 'No content available.'}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                const rawFileSrc = otherData?.url || otherData?.fileUrl || otherData?.dataUrl || otherData?.path || (otherData as any)?.receiptUrl || '';
                                const fileSrc = resolveSafePdfUrl(rawFileSrc);
                                const docTitle = otherData?.title || otherData?.name || otherData?.fileName || (otherData?.metadata as any)?.label || otherData?.label || 'Uploaded Document';
                                const fileInfo = detectFileType(fileSrc, docTitle, otherData?.fileType || otherData?.type || otherData?.mimeType);

                                if (otherData?.htmlContent) {
                                    return (
                                        <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans animate-in fade-in duration-300">
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden">
                                                <div className="prose max-w-none text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col space-y-4 shadow-xl">
                                            {/* Header with Title and Quick Actions */}
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                        <FileText className="text-indigo-500" size={20} />
                                                        {docTitle}
                                                    </h3>
                                                    {fileInfo.extension && (
                                                        <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                                                            Format: .{fileInfo.extension}
                                                        </span>
                                                    )}
                                                </div>
                                                {fileSrc && (
                                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                                        <a
                                                            href={fileSrc}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                                        >
                                                            <ExternalLink size={14} /> Open Full / Download
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Viewer Body */}
                                            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                                                {fileInfo.isImage ? (
                                                    <img 
                                                        src={fileSrc} 
                                                        alt={docTitle} 
                                                        className="max-h-[75vh] w-auto max-w-full mx-auto object-contain rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 bg-white" 
                                                    />
                                                ) : fileInfo.isHtml ? (
                                                    <iframe 
                                                        srcDoc={fileSrc.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(fileSrc.split('base64,')[1]))) : undefined}
                                                        src={!fileSrc.startsWith('data:text/html;base64,') ? fileSrc : undefined} 
                                                        className="w-full h-[650px] border-none rounded-2xl bg-white shadow-inner" 
                                                        title={docTitle}
                                                    />
                                                ) : fileInfo.isPdf ? (
                                                    <div className="w-full h-full flex flex-col space-y-2">
                                                        <iframe
                                                            src={fileInfo.previewUrl}
                                                            className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                                                            title={docTitle}
                                                        />
                                                        <div className="text-center">
                                                            <a 
                                                                href={fileSrc} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                            >
                                                                Having trouble viewing? Click here to open PDF in a new tab.
                                                            </a>
                                                        </div>
                                                    </div>
                                                ) : fileInfo.googleDocsViewerUrl ? (
                                                    <div className="w-full h-full flex flex-col space-y-2">
                                                        <iframe
                                                            src={fileInfo.googleDocsViewerUrl}
                                                            className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                                                            title={docTitle}
                                                        />
                                                    </div>
                                                ) : (otherData?.content || otherData?.body) ? (
                                                    <div className="w-full text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-sm p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                        {otherData?.content || otherData?.body}
                                                    </div>
                                                ) : fileSrc ? (
                                                    <div className="text-center p-8 space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md mx-auto">
                                                        <FileText size={48} className="mx-auto text-indigo-500" />
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 dark:text-white">{docTitle}</h4>
                                                            <p className="text-xs text-slate-500 mt-1">This file type cannot be previewed directly in the browser.</p>
                                                        </div>
                                                        <a
                                                            href={fileSrc}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                                                        >
                                                            <Download size={14} /> Download File
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">No content available.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans">
                                    {/* Proposal Content */}
                                    <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading proposal preview...</div>}>
                                        <PublicProjectProposal proposalData={activeProp} embedded={true} />
                                    </React.Suspense>
                                </div>
                            )}
                        </div>
                    ) : (
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
                                {isProposal && status === 'Accepted' && prop?.jobId && (
                                    <div className="no-print mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-500 text-white p-2 rounded-xl">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">Proposal Accepted</h4>
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                    This proposal is linked to {(prop.invoiceId || loadedJob?.invoice?.id) ? `Invoice #${prop.invoiceId || loadedJob?.invoice?.id}` : 'an invoice'}.
                                                </p>
                                            </div>
                                        </div>
                                        <a href={`/#/invoice/${prop.jobId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 no-underline">
                                            View Invoice
                                        </a>
                                    </div>
                                )}
                                {!isProposal && !isOther && job?.proposalId && (
                                    <div className="no-print mb-6 p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-primary-500 text-white p-2 rounded-xl">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-primary-950 dark:text-primary-200">
                                                    {job?.invoice?.status === 'Paid' ? 'Receipt Linked' : 'Invoice Linked'}
                                                </h4>
                                                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">This document is linked to Proposal #{job.proposalId}.</p>
                                            </div>
                                        </div>
                                        <a href={`/#/proposal-view/${job.proposalId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-black bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary-500/20 no-underline">
                                            View Proposal
                                        </a>
                                    </div>
                                )}
        
                                {/* Header Section */}
                                {!isPnL && !isOther && (
                                <div className="header flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4 sm:gap-8 border-b-2 border-slate-50 pb-8">
                                    <div className="text-left flex flex-col items-start max-w-[38%]">
                                        {org?.logoUrl ? (
                                            <img src={org.logoUrl} alt="Logo" className="logo-img max-h-[90px] w-auto object-contain block mb-3" />
                                        ) : org?.letterheadDataUrl ? (
                                            <img src={org.letterheadDataUrl} alt="Logo" className="logo-img max-h-[90px] w-auto object-contain block mb-3" />
                                        ) : null}
                                        <h1 className="text-xl font-black text-slate-900 leading-tight mb-1">{org?.name}</h1>
                                        {org?.address && (
                                            <div className="text-xs text-slate-500 font-medium font-sans">
                                                {formatFullAddress(org.address, (org as any)?.city, (org as any)?.state, (org as any)?.zip)}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                                            {org?.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone size={12} className="text-slate-400 shrink-0" />
                                                    <span>{org.phone}</span>
                                                </div>
                                            )}
                                            {org?.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail size={12} className="text-slate-400 shrink-0" />
                                                    <span>{org.email}</span>
                                                </div>
                                            )}
                                        </div>
                                        {(org as any)?.licenseNumber && (
                                            <div className="text-[11px] text-slate-400 font-semibold mt-1">
                                                License #: {(org as any).licenseNumber}
                                            </div>
                                        )}
                                    </div>

                                    {/* Top Middle: Bold INVOICE / PROPOSAL / RECEIPT Label */}
                                    <div className="flex flex-col items-center justify-center text-center self-center px-4">
                                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
                                            {status === 'Paid' ? 'RECEIPT' : (isProposal ? 'PROPOSAL' : 'INVOICE')}
                                        </h2>
                                    </div>

                                    <div className="meta-stack text-right flex flex-col gap-2">
                                        <div className="flex flex-col gap-1 text-[11px]">
                                            <div className="meta-line flex justify-end gap-3">
                                                <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Document #</span>
                                                <span className="meta-value font-black text-slate-900">#{id}</span>
                                            </div>
                                            {referenceNumber && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Ref #</span>
                                                    <span className="meta-value font-mono font-bold text-indigo-600">#{referenceNumber}</span>
                                                </div>
                                            )}
                                            {jobNumber && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Job #</span>
                                                    <span className="meta-value font-mono font-bold text-slate-900">{jobNumber}</span>
                                                </div>
                                            )}
                                            {woNumber && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">WO #</span>
                                                    {customerId ? (
                                                        <button 
                                                            onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: woNumber, customerId } })}
                                                            className="meta-value font-mono font-bold text-slate-900 cursor-pointer hover:underline border-none bg-transparent p-0 text-right font-sans"
                                                        >
                                                            {woNumber}
                                                        </button>
                                                    ) : (
                                                        <span className="meta-value font-mono font-bold text-slate-900">
                                                            {woNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {distinctPoNumber && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">PO #</span>
                                                    <span className="meta-value font-mono font-bold text-slate-900">
                                                        {distinctPoNumber}
                                                    </span>
                                                </div>
                                            )}
                                            {((associatedCust as any)?.accountNumber || (prop as any)?.accountNumber || (job as any)?.accountNumber || (associatedCust ? getOrGenerateAccountNumber(associatedCust) : '')) && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Account #</span>
                                                    <span className="meta-value font-mono font-bold text-indigo-600">
                                                        {(associatedCust as any)?.accountNumber || (prop as any)?.accountNumber || (job as any)?.accountNumber || (associatedCust ? getOrGenerateAccountNumber(associatedCust) : '')}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="meta-line flex justify-end gap-3">
                                                <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Date</span>
                                                <span className="meta-value font-black text-slate-900">{formatLocalDate(date, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            </div>
                                            {isProposal && prop?.validUntil && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Valid Until</span>
                                                    <span className="meta-value font-black text-slate-900">{formatLocalDate(prop.validUntil, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                             {(type as string) === 'Invoice' && job?.appointmentTime && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Site Visit Date</span>
                                                    <span className="meta-value font-black text-slate-900">{formatLocalDate(job.appointmentTime, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {(type as string) === 'Invoice' && dueDate && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Due Date</span>
                                                    <span className="meta-value font-black text-slate-900">{formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            <div className="meta-line flex justify-end gap-3">
                                                <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                                <span className={`meta-value status-badge font-black uppercase ${status === 'Paid' ? 'text-emerald-600' : 'text-primary-600'}`}>{status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )}

                                {/* Addresses Section */}
                                {!isPnL && !isOther && (
                                    <div className="grid grid-cols-3 gap-4 mb-8 text-xs text-left address-grid">
                                        {/* Box 1: Customer / Property Mgr */}
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-left">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">1. CUSTOMER / PROPERTY MGR</div>
                                            <div className="font-bold text-sm text-slate-900">{customerName || 'Valued Customer'}</div>
                                            <div className="text-xs text-slate-500 font-medium font-sans">
                                                {associatedCustAddrLines.street && <div>{associatedCustAddrLines.street}</div>}
                                                {associatedCustAddrLines.cityStateZip && <div>{associatedCustAddrLines.cityStateZip}</div>}
                                                {!associatedCustAddrLines.street && !associatedCustAddrLines.cityStateZip && <div>Address on file</div>}
                                            </div>
                                            {prop?.projectName && <div className="text-[11px] text-slate-400 font-semibold pt-1">Project: {prop.projectName}</div>}
                                        </div>

                                        {/* Box 2: Bill To (Paying Entity) */}
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-left">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">2. BILL TO (PAYING ENTITY)</div>
                                            <div className="font-bold text-sm text-slate-900">{billToName || (prop as any)?.billToName || (prop as any)?.billingCompany || customerName || 'Valued Customer'}</div>
                                            <div className="text-xs text-slate-500 font-medium font-sans">
                                                {billToAddrLines.street && <div>{billToAddrLines.street}</div>}
                                                {billToAddrLines.cityStateZip && <div>{billToAddrLines.cityStateZip}</div>}
                                                {!billToAddrLines.street && !billToAddrLines.cityStateZip && (
                                                    <>
                                                        {associatedCustAddrLines.street && <div>{associatedCustAddrLines.street}</div>}
                                                        {associatedCustAddrLines.cityStateZip && <div>{associatedCustAddrLines.cityStateZip}</div>}
                                                        {!associatedCustAddrLines.street && !associatedCustAddrLines.cityStateZip && <div>Address on file</div>}
                                                    </>
                                                )}
                                            </div>
                                            {poNumber && (
                                                <div className="text-[11px] font-mono text-slate-400 font-bold pt-1">
                                                    WO #: {poNumber}
                                                </div>
                                            )}
                                        </div>

                                        {/* Box 3: Service Site Location */}
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-left">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">3. SERVICE SITE LOCATION</div>
                                            <div className="font-bold text-sm text-slate-900">
                                                {resolveSiteLocationName(job || prop, serviceLocation) || customerName}
                                            </div>
                                            <div className="flex items-start gap-1.5 text-xs text-slate-500 font-medium pb-1">
                                                <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                                <div>
                                                    {serviceLocAddrLines.street && <div>{serviceLocAddrLines.street}</div>}
                                                    {serviceLocAddrLines.cityStateZip && <div>{serviceLocAddrLines.cityStateZip}</div>}
                                                    {!serviceLocAddrLines.street && !serviceLocAddrLines.cityStateZip && (
                                                        <span className="text-slate-400 italic font-normal">Site Location Pending / Unspecified</span>
                                                    )}
                                                </div>
                                            </div>
                                            {((job as any)?.appointmentTime || (data as any)?.appointmentTime) && (
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    <span className="font-semibold text-slate-700">Appointment:</span> {new Date((job as any)?.appointmentTime || (data as any)?.appointmentTime).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                            {((job as any)?.assignedTechnicianName || (data as any)?.assignedTechnicianName) && (
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    <span className="font-semibold text-slate-700">Tech:</span> {(job as any)?.assignedTechnicianName || (data as any)?.assignedTechnicianName}
                                                </div>
                                            )}
                                            {((job as any)?.jobStatus || (data as any)?.jobStatus) && (
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    <span className="font-semibold text-slate-700">Time on Site:</span> {(job as any)?.jobStatus || (data as any)?.jobStatus}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
        
                                {/* Main Content Area */}
                                <div className="flex-1">
                                    {isOther ? (
                                        isPnL ? (
                                            <div className="w-full">
                                                {otherData?.htmlContent ? (
                                                    <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                                ) : (
                                                    <div className="text-slate-600 whitespace-pre-wrap">{otherData?.content || otherData?.body || 'No content available.'}</div>
                                                )}
                                            </div>
                                        ) : (() => {
                                            const fileSrc = otherData?.url || otherData?.fileUrl || otherData?.dataUrl || otherData?.path || (otherData as any)?.receiptUrl || '';
                                            const docTitle = otherData?.title || otherData?.name || otherData?.fileName || 'Uploaded Document';
                                            const fileInfo = detectFileType(fileSrc, docTitle, otherData?.fileType || otherData?.type || otherData?.mimeType);

                                            if (otherData?.htmlContent) {
                                                return (
                                                    <div className="w-full">
                                                        <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col space-y-4">
                                                    {/* Header with Title and Quick Actions */}
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                                                        <div>
                                                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                                <FileText className="text-indigo-500" size={20} />
                                                                {docTitle}
                                                            </h3>
                                                            {fileInfo.extension && (
                                                                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                                                                    Format: .{fileInfo.extension}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {fileSrc && (
                                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                                <a
                                                                    href={fileSrc}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                                                >
                                                                    <ExternalLink size={14} /> Open Full / Download
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Viewer Body */}
                                                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                                                        {fileInfo.isImage ? (
                                                            <img 
                                                                src={fileSrc} 
                                                                alt={docTitle} 
                                                                className="max-h-[65vh] w-auto max-w-full mx-auto object-contain rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 bg-white" 
                                                            />
                                                        ) : fileInfo.isHtml ? (
                                                            <iframe 
                                                                srcDoc={fileSrc.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(fileSrc.split('base64,')[1]))) : undefined}
                                                                src={!fileSrc.startsWith('data:text/html;base64,') ? fileSrc : undefined} 
                                                                className="w-full h-[650px] border-none rounded-2xl bg-white shadow-inner" 
                                                                title={docTitle}
                                                            />
                                                        ) : fileInfo.isPdf ? (
                                                            <div className="w-full h-full flex flex-col space-y-2">
                                                                <iframe
                                                                    src={fileInfo.previewUrl}
                                                                    className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                                                                    title={docTitle}
                                                                />
                                                                <div className="text-center">
                                                                    <a 
                                                                        href={fileSrc} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                                    >
                                                                        Having trouble viewing? Click here to open PDF in a new tab.
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ) : fileInfo.googleDocsViewerUrl ? (
                                                            <div className="w-full h-full flex flex-col space-y-2">
                                                                <iframe
                                                                    src={fileInfo.googleDocsViewerUrl}
                                                                    className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                                                                    title={docTitle}
                                                                />
                                                            </div>
                                                        ) : (otherData?.content || otherData?.body) ? (
                                                            <div className="w-full text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-sm p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                                {otherData?.content || otherData?.body}
                                                            </div>
                                                        ) : fileSrc ? (
                                                            <div className="text-center p-8 space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md mx-auto">
                                                                <FileText size={48} className="mx-auto text-indigo-500" />
                                                                <div>
                                                                    <h4 className="font-bold text-slate-800 dark:text-white">{docTitle}</h4>
                                                                    <p className="text-xs text-slate-400 mt-1">This document is ready to view or download.</p>
                                                                </div>
                                                                <a
                                                                    href={fileSrc}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md"
                                                                >
                                                                    <Download size={16} /> Open / Download File
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-400 italic text-center p-8">
                                                                No document content or file URL available.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ) : showMultiTier ? (
                                        <div className="space-y-6 mb-10">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                {multiTiers.map(t => {
                                                    const isSelected = matchTier(t.tier, prop?.selectedOption);
                                                    return (
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
                                                            className={`p-6 border-2 rounded-2xl transition-all flex flex-col shadow-sm relative ${
                                                                isSelected 
                                                                    ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500 shadow-xl' 
                                                                    : onSelectTier 
                                                                        ? 'border-slate-200 bg-white hover:border-primary-400 hover:shadow-xl cursor-pointer' 
                                                                        : 'border-slate-200 bg-white'
                                                            }`}
                                                        >
                                                            {isSelected && (
                                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-md flex items-center gap-1">
                                                                    <span>✓ Selected</span>
                                                                </div>
                                                            )}
                                                            <h3 className={`text-center font-black text-xl uppercase mb-6 tracking-tighter ${isSelected ? 'text-primary-700' : 'text-slate-800'}`}>
                                                                {getTierDisplay(t.tier)} Option
                                                            </h3>
                                                            <div className="text-center mb-6 border-b pb-4">
                                                                <div className={`text-3xl font-black tracking-tighter ${isSelected ? 'text-primary-600' : 'text-slate-900'}`}>
                                                                    ${t.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                </div>
                                                                {!!t.additionalFeeAmount && (
                                                                    <div className={`text-[10px] font-bold mt-1 ${t.additionalFeeAmount < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                        Includes {prop?.additionalFeePercent}% {prop?.additionalFeeName || 'Adjustment'}
                                                                    </div>
                                                                )}
                                                                {(() => {
                                                                    const hasDep = (docDepositAmount > 0) || ((prop as any)?.depositValue > 0) || ((prop as any)?.depositAmount > 0);
                                                                    if (!hasDep) return null;
                                                                    let tierDeposit = 0;
                                                                    if ((prop as any)?.depositType === 'percentage' && (prop as any)?.depositValue > 0) {
                                                                        tierDeposit = (t.total * (prop as any).depositValue) / 100;
                                                                    } else if ((prop as any)?.depositValue > 0) {
                                                                        tierDeposit = Math.min(t.total, Number((prop as any).depositValue));
                                                                    } else if (docDepositAmount > 0) {
                                                                        tierDeposit = Math.min(t.total, docDepositAmount);
                                                                    }
                                                                    if (tierDeposit <= 0) return null;
                                                                    return (
                                                                        <div className="text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg py-1 px-2.5 mt-2 inline-flex items-center gap-1.5 shadow-sm">
                                                                            <span>💳 Deposit Required:</span>
                                                                            <span className="font-black">${tierDeposit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                                            {(prop as any)?.depositType === 'percentage' && (prop as any)?.depositValue && (
                                                                                <span className="text-[10px] text-amber-600 font-bold">({(prop as any).depositValue}%)</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            {isSummaryHidden ? (
                                                                <div className="space-y-3 mb-6 flex-1 flex flex-col items-center justify-center min-h-[150px] bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 text-center border border-dashed border-slate-200 dark:border-slate-800">
                                                                    <Lock size={20} className="text-slate-450 dark:text-slate-400 mb-1" />
                                                                    <div className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Detailed Scope Locked</div>
                                                                    <p className="text-[9px] text-slate-455 dark:text-slate-500 leading-relaxed max-w-[160px]">
                                                                        Specific parts, labor, and model numbers are hidden to protect proprietary design.
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3 mb-6 flex-1">
                                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                                    {t.items.map((item: any, idx: number) => (
                                                                        <div key={idx} className="flex flex-col gap-1 border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <div className="flex items-start gap-2">
                                                                                    <span className="text-emerald-500 font-bold shrink-0 text-xs">✓</span>
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-bold text-slate-700 text-[11px] leading-tight">{item.name || item.title || item.description}</span>
                                                                                        {item.description && item.description !== (item.name || item.title) && <span className="text-[9px] text-slate-400 mt-0.5 leading-snug whitespace-pre-wrap">{item.description}</span>}
                                                                                        {item.subItems && item.subItems.length > 0 && (
                                                                                            <ul className="mt-1 pl-2 space-y-0.5 border-l border-slate-200">
                                                                                                {item.subItems.map((sub: any, sIdx: number) => (
                                                                                                    <li key={sIdx} className="text-[9px] text-slate-500 font-medium flex justify-between gap-2">
                                                                                                        <span>- {sub.description}</span>
                                                                                                        {sub.unitPrice ? (
                                                                                                            <span className="text-slate-400 shrink-0">
                                                                                                                {sub.quantity && sub.quantity > 1 ? `${sub.quantity} × ` : ''}${Number(sub.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                                                            </span>
                                                                                                        ) : null}
                                                                                                    </li>
                                                                                                ))}
                                                                                            </ul>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right shrink-0 flex flex-col">
                                                                                    <span className="font-bold text-[10px] text-slate-650">
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
                                                            )}
                                                            <div className={`mt-auto text-center border-t pt-4 ${isSelected ? 'text-emerald-700 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5' : onSelectTier ? 'text-primary-600 font-black text-[10px] uppercase tracking-widest' : 'text-slate-350'}`}>
                                                                {isSelected ? '✓ Selected Option' : onSelectTier ? 'Click to Select Option →' : 'Option Available'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {docDepositNotes && (
                                                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 text-xs my-4 shadow-sm text-left">
                                                    <span className="font-extrabold uppercase tracking-wider text-[11px] shrink-0">💳 Deposit Instructions:</span>
                                                    <span className="italic font-medium leading-relaxed">{docDepositNotes}</span>
                                                </div>
                                            )}
                                            {isSummaryHidden && (
                                                <div className="p-8 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 font-sans w-full max-w-xl mx-auto my-6 animate-fade-in">
                                                    <Shield size={32} className="text-indigo-500 animate-pulse" />
                                                    <div className="space-y-1">
                                                        <h4 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-widest">Unlock Detailed Scope & Parts</h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-medium">
                                                            Specific model numbers, manufacturer warranty details, and itemized scopes are hidden. Agree to the competitor sharing terms below to unlock details.
                                                        </p>
                                                    </div>
                                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl text-left space-y-3 w-full max-w-md">
                                                        <p className="text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                                                            By unlocking, you agree not to share or distribute this itemized quote, equipment selection, or project design details with competitors or other third-party contractors.
                                                        </p>
                                                        <button 
                                                            type="button"
                                                            onClick={handleUnlockDetails}
                                                            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer font-sans border-none"
                                                        >
                                                            <ShieldCheck size={14} />
                                                            Agree & Unlock Detailed Scope
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : isSummaryHidden ? (
                                        <div className="p-8 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 font-sans w-full min-h-[200px] my-4 max-w-lg mx-auto">
                                            <Lock size={32} className="text-indigo-500 animate-pulse" />
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-widest">Scope Breakdown Locked</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-medium">
                                                    Detailed parts list, exact model numbers, and specific installation services are locked to protect proprietary engineering scope.
                                                </p>
                                            </div>
                                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl text-left space-y-3 max-w-md w-full">
                                                <p className="text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                                                    By unlocking, you agree not to share or distribute this itemized quote, equipment selection, or project design details with competitors or other third-party contractors.
                                                </p>
                                                <button 
                                                    type="button"
                                                    onClick={handleUnlockDetails}
                                                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer font-sans border-none"
                                                >
                                                    <ShieldCheck size={14} />
                                                    Agree & Unlock Detailed Scope
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="item-table-wrap overflow-x-auto custom-scrollbar border-b-2 border-slate-50">
                                            <table className="item-table w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50">
                                                        <th className="th text-left py-3 px-2 sm:py-4 sm:px-6 text-[10px] font-black text-slate-450 uppercase tracking-[0.15em] rounded-tl-2xl">Description of Service / Items</th>
                                                        <th className="th th-center text-center py-3 px-2 sm:py-4 sm:px-4 text-[10px] font-black text-slate-450 uppercase tracking-[0.15em] w-20">Qty</th>
                                                        <th className="th th-right text-right py-3 px-2 sm:py-4 sm:px-4 text-[10px] font-black text-slate-455 uppercase tracking-[0.15em] w-32">Unit Price</th>
                                                        <th className="th th-right text-right py-3 px-2 sm:py-4 sm:px-6 text-[10px] font-black text-slate-455 uppercase tracking-[0.15em] w-32 rounded-tr-2xl">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, idx) => (
                                                        <tr key={idx} className="item-row border-b border-slate-50 last:border-none group">
                                                            <td className="td py-4 px-2 sm:py-8 sm:px-6">
                                                                <span className="item-title font-black text-slate-900 text-base mb-2">{item.name}</span>
                                                                {item.description && (
                                                                    <div className="item-description text-sm text-slate-500 leading-relaxed max-w-lg whitespace-pre-wrap">
                                                                        {item.description}
                                                                    </div>
                                                                )}
                                                                {(item as any).subItems && (item as any).subItems.length > 0 && (
                                                                    <ul className="mt-2 pl-3 space-y-1 border-l-2 border-slate-200">
                                                                        {(item as any).subItems.map((sub: any, sIdx: number) => (
                                                                            <li key={sIdx} className="text-xs text-slate-600 font-medium flex justify-between gap-4">
                                                                                <span>• {sub.description}</span>
                                                                                {sub.unitPrice ? (
                                                                                    <span className="text-slate-500 shrink-0 font-semibold">
                                                                                        {sub.quantity && sub.quantity > 1 ? `${sub.quantity} × ` : ''}${Number(sub.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                                    </span>
                                                                                ) : null}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </td>
                                                            <td className="td td-center py-4 px-2 sm:py-8 sm:px-4 text-center font-bold text-slate-600 text-sm">{item.quantity}</td>
                                                            <td className={`td td-right py-4 px-2 sm:py-8 sm:px-4 text-right font-bold text-sm ${item.unitPrice < 0 ? 'text-emerald-600' : 'text-slate-650'}`}>
                                                                {item.isPercentage && item.percentageRate 
                                                                    ? `${Number(item.percentageRate)}%` 
                                                                    : (item.unitPrice < 0
                                                                        ? `-$${Math.abs(Number(item.unitPrice)).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                                        : `$${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}`)
                                                                }
                                                            </td>
                                                            <td className={`td td-right py-4 px-2 sm:py-8 sm:px-6 text-right font-black text-sm ${item.total < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                                {item.total < 0
                                                                    ? `-$${Math.abs(Number(item.total)).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                                    : `$${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                                }
                                                            </td>
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
                                                <span className="font-bold text-slate-455 uppercase tracking-wider">Subtotal</span>
                                                <span className="font-black text-slate-900">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="summary-row flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-455 uppercase tracking-wider">Sales Tax ({taxRatePct}%)</span>
                                                <span className="font-black text-slate-900">${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            {!!additionalFeeAmount && (
                                                <div className="summary-row flex justify-between items-center text-sm">
                                                    <span className={`font-bold uppercase tracking-wider ${additionalFeeAmount < 0 ? 'text-emerald-600' : 'text-slate-455'}`}>
                                                        {additionalFeeName || 'Adjustment'}
                                                    </span>
                                                    <span className={`font-black ${additionalFeeAmount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                        {additionalFeeAmount < 0 ? '-' : ''}${Math.abs(additionalFeeAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </span>
                                                </div>
                                            )}
                                            {overdueDetails && overdueDetails.lateFeeAmountApplied > 0 && (
                                                <div className="summary-row flex justify-between items-center text-sm text-rose-600 font-bold animate-in fade-in duration-200">
                                                    <span className="uppercase tracking-wider">Late Fee</span>
                                                    <span className="font-black">+${overdueDetails.lateFeeAmountApplied.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                </div>
                                            )}
                                            {overdueDetails && overdueDetails.interestAmountApplied > 0 && (
                                                <div className="summary-row flex justify-between items-center text-sm text-rose-600 font-bold animate-in fade-in duration-200">
                                                    <span className="uppercase tracking-wider">Overdue Interest ({org?.lateFeeInterestRate || 1.5}%)</span>
                                                    <span className="font-black">+${overdueDetails.interestAmountApplied.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                </div>
                                            )}
                                            {/* Financial Terms Breakdown: Due Today, Due Net Terms, Grand Total */}
                                            <div className="space-y-1.5 pt-3 border-t-2 border-slate-900 mt-3">
                                                {docDepositAmount > 0 && !docDepositPaid && (canonical?.amountDueToday ?? 0) > 0 && (
                                                    <div className="summary-row flex justify-between items-center text-sm font-extrabold text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                                                        <span className="uppercase tracking-wider flex items-center gap-1">
                                                            {isProposal ? 'Deposit Required / Due Today' : 'Deposit Due Today'}
                                                            {isProposal && (prop as any)?.depositType === 'percentage' && (prop as any)?.depositValue && (
                                                                <span className="text-xs font-normal text-amber-600">({(prop as any).depositValue}%)</span>
                                                            )}
                                                        </span>
                                                        <span className="font-black text-amber-900">
                                                            ${(canonical?.amountDueToday ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </span>
                                                    </div>
                                                )}

                                                {docDepositAmount > 0 && !docDepositPaid && (canonical?.amountDueToday ?? 0) > 0 && (
                                                    <div className="summary-row flex justify-between items-center text-sm font-bold text-slate-700 p-1.5">
                                                        <span className="uppercase tracking-wider">
                                                            Final Balance Due ({canonical?.isNetTerms ? canonical.paymentTerms.replace('_', ' ').toUpperCase() : 'Upon Completion'})
                                                        </span>
                                                        <span className="font-black text-slate-900">
                                                            ${(canonical?.amountDueNet ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="summary-row total flex justify-between items-center pt-2 border-t border-slate-200">
                                                    <span className="font-black uppercase tracking-wider text-slate-900">Grand Total</span>
                                                    <span className="total-value font-black font-sans text-slate-950 text-xl">${(total + (overdueDetails?.totalLateFees || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                </div>

                                                {docAmountRefunded > 0 ? (
                                                    <div className="space-y-1 mt-2">
                                                        <div className="summary-row flex justify-between items-center text-sm font-bold text-emerald-700 bg-emerald-50/90 p-2 rounded-lg border border-emerald-200">
                                                            <span className="uppercase tracking-wider">Total Payments</span>
                                                            <span className="font-black text-emerald-800">-${docAmountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                        <div className="summary-row flex justify-between items-center text-sm font-bold text-rose-700 bg-rose-50/90 p-2 rounded-lg border border-rose-200">
                                                            <span className="uppercase tracking-wider">Refund Issued</span>
                                                            <span className="font-black text-rose-700">+${docAmountRefunded.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                        <div className="summary-row flex justify-between items-center text-sm font-black text-emerald-800 bg-emerald-100/90 p-2 rounded-lg border border-emerald-300">
                                                            <span className="uppercase tracking-wider">Net Paid</span>
                                                            <span className="font-black text-emerald-950">-${docNetPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                    </div>
                                                ) : (docAmountPaid > 0 || docDepositPaid) && (
                                                    <div className="summary-row flex justify-between items-center text-sm font-bold text-emerald-700 bg-emerald-50/90 p-2 rounded-lg border border-emerald-200 mt-2">
                                                        <span className="uppercase tracking-wider">{docDepositPaid ? 'Deposit Paid' : 'Paid to Date'}</span>
                                                        <span className="font-black text-emerald-800">-${docAmountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                )}

                                                <div className="summary-row flex justify-between items-center text-base font-black bg-[#FFF8DB] dark:bg-[#2A2415] p-3.5 rounded-xl border-2 border-[#D4AF37] shadow-sm mt-2">
                                                    <span className="uppercase tracking-wider text-[#8B6508] dark:text-[#F3C649] text-xs sm:text-sm font-black">
                                                        {canonical?.isNetTerms ? `Balance Due (${canonical.paymentTerms.replace('_', ' ').toUpperCase()})` : 'Total Due'}
                                                    </span>
                                                    <span className="total-value font-black font-sans text-[#8B6508] dark:text-[#FFF8DB] text-2xl">${docBalanceRemaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                </div>
                                            </div>
                                            {docDepositNotes && (
                                                <div className="text-[11px] text-amber-800 italic bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2 flex items-start gap-1">
                                                    <span className="font-bold uppercase tracking-wider not-italic text-[10px] text-amber-900 shrink-0">💳 Deposit Instructions:</span>
                                                    <span>{docDepositNotes}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Payments & Refunds Transaction History Ledger */}
                                {(docPayments.length > 0 || docRefunds.length > 0) && (
                                    <div className="mt-8 mb-10 p-5 bg-white border border-slate-200 rounded-2xl text-left space-y-4 shadow-sm font-sans">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                    💳
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                        Payment &amp; Refund Transaction History
                                                    </h3>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        Itemized record of all card payments, processing fee surcharges, and overpayment refunds.
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                {docPayments.length + docRefunds.length} Transactions
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                                                        <th className="p-2.5">Date / Time</th>
                                                        <th className="p-2.5">Transaction &amp; Details</th>
                                                        <th className="p-2.5">Card / Reference</th>
                                                        <th className="p-2.5 text-center">Status</th>
                                                        <th className="p-2.5 text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-sans">
                                                    {docPayments.map((pmt: any, pIdx: number) => (
                                                        <tr key={pmt.id || `pmt-${pIdx}`} className="hover:bg-slate-50/60">
                                                            <td className="p-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                                                                {pmt.date ? new Date(pmt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <div className="font-bold text-slate-900 text-xs">
                                                                    {pmt.notes || (pmt.baseAmount && pmt.fee ? `Card Payment ($${Number(pmt.baseAmount).toFixed(2)} + $${Number(pmt.fee).toFixed(2)} processing fee)` : 'Card Payment')}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {pmt.method || 'Credit Card'}
                                                                    {pmt.fee ? ` • Includes $${Number(pmt.fee).toFixed(2)} CC fee` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="p-2.5 font-mono text-[11px] text-slate-600">
                                                                {pmt.reference || pmt.paymentIntentId || '—'}
                                                            </td>
                                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    Paid ✓
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                                                +${Number(pmt.amount || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {docRefunds.map((ref: any, rIdx: number) => (
                                                        <tr key={ref.id || `ref-${rIdx}`} className="bg-amber-50/40 hover:bg-amber-50/70 border-t border-amber-100">
                                                            <td className="p-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                                                                {ref.date ? new Date(ref.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <div className="font-bold text-rose-700 text-xs flex items-center gap-1.5">
                                                                    <span>Overpayment Refund</span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-600">
                                                                    {ref.reason || ref.notes || 'Customer refund processed'}
                                                                    {ref.method ? ` • ${ref.method}` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="p-2.5 font-mono text-[11px] text-slate-600">
                                                                {ref.reference || ref.refundId || '—'}
                                                            </td>
                                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                                                    Refund Issued
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                                                                -${Number(ref.amount || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                                                    <tr>
                                                        <td colSpan={4} className="p-2.5 text-right text-slate-700 uppercase tracking-wider text-[11px]">
                                                            Total Payments Collected:
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                                            ${(docPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || docAmountPaid).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                    {docRefunds.length > 0 && (
                                                        <>
                                                            <tr>
                                                                <td colSpan={4} className="p-2 text-right text-rose-700 uppercase tracking-wider text-[11px]">
                                                                    Overpayment Refund:
                                                                </td>
                                                                <td className="p-2 text-right font-mono font-black text-rose-600">
                                                                    -${(docRefunds.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0) || docAmountRefunded).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                            <tr className="border-t border-slate-300 bg-slate-100/80">
                                                                <td colSpan={4} className="p-2.5 text-right text-slate-900 font-black uppercase tracking-wider text-[11px]">
                                                                    Net Customer Remittance:
                                                                </td>
                                                                <td className="p-2.5 text-right font-mono font-black text-slate-900">
                                                                    ${docNetPaid.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        </>
                                                    )}
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Authorizations and Signatures */}
                                {!isPnL && !isOther && !showMultiTier && (
                                <div className="signature-section flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mt-16 pb-12 border-b border-slate-50">
                                    <div className="sig-block w-[300px] text-left">
                                        <div className="sig-image-wrap border-b-2 border-slate-200 min-h-[60px] flex items-end pb-2">
                                            {signature === 'VERBAL_ACCEPTANCE' ? (
                                                <div className="h-12 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-lg flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                                                    <CheckCircle size={16} className="text-amber-500 shrink-0" />
                                                    <span>Authorized Verbally</span>
                                                </div>
                                            ) : signature ? (
                                                <img 
                                                    src={signature} 
                                                    alt="Customer Signature" 
                                                    className="sig-image max-h-[80px] w-auto object-contain block" 
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-10 text-slate-250 font-black italic uppercase text-xs tracking-widest">Awaiting Signature</div>
                                            )}
                                        </div>
                                        <div className="sig-label text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] mt-3">Customer Authorization</div>
                                        {resolvedSignerName && (
                                            <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                                                <span>Signed by: </span><strong className="text-slate-800 dark:text-slate-200">{resolvedSignerName}</strong>
                                                {resolvedSignatureDate && <span className="text-[9px] text-slate-400 block">{new Date(resolvedSignatureDate).toLocaleDateString()}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sig-block w-[300px] text-left md:text-right">
                                        {resolvedTechSignature ? (
                                            <div>
                                                <div className="sig-image-wrap border-b-2 border-slate-200 min-h-[60px] flex items-end justify-start md:justify-end pb-2">
                                                    <img 
                                                        src={resolvedTechSignature} 
                                                        alt="Technician Signature" 
                                                        className="sig-image max-h-[80px] w-auto object-contain block" 
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                                <div className="sig-label text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] mt-3">
                                                    Technician Certification
                                                </div>
                                                {resolvedTechSignerName && (
                                                    <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                                                        <span>Certified by: </span><strong className="text-slate-800 dark:text-slate-200">{resolvedTechSignerName}</strong>
                                                        {resolvedTechSignatureDate && <span className="text-[9px] text-slate-400 block">{new Date(resolvedTechSignatureDate).toLocaleDateString()}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex-1 text-center md:text-right">
                                                <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">{org?.name}</div>
                                                <div className="text-[10px] text-slate-500 font-medium">Professional Field Service Solutions</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}
        
                                {/* Center Aligned Terms and Footer */}
                                <div className="footer border-t border-slate-100 pt-10 mt-12">
                                    {((type as string) === 'Proposal' || isProposal) && (() => {
                                        const pDisclaimer = (data as any)?.pricingDisclaimer || org?.pricingDisclaimer || org?.proposalDisclaimer;
                                        if (!pDisclaimer) return null;
                                        return (
                                            <div className="mb-6 p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl text-left max-w-3xl mx-auto shadow-xs">
                                                <div className="text-[10px] font-black text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                    <span>📋 Pricing & Estimate Disclaimer</span>
                                                </div>
                                                <p className="text-[10px] text-amber-950 leading-relaxed font-medium">
                                                    {pDisclaimer}
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {org?.termsAndConditions && !isOther && (
                                        <div className="mb-8">
                                            <div className="sig-label text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] mb-4">Terms & Conditions</div>
                                            <p className="terms-text text-[10px] text-slate-500 text-center leading-relaxed italic max-w-3xl mx-auto px-6">
                                                {(type as string) === 'Invoice' && dueDate ? (() => {
                                                    const associatedCust = state.customers.find(c => c.id === customerId);
                                                    const terms = job?.invoice?.paymentTerms || associatedCust?.paymentTerms || 'net_30';
                                                    if (terms === 'due_on_receipt') {
                                                        return `Payment is due upon receipt. Due Date: ${formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })}. ${org.termsAndConditions.replace(/Payment is due upon receipt/ig, '').replace(/PAYMENT: Payment is due upon receipt unless otherwise noted\./ig, '')}`;
                                                    }
                                                    const days = getPaymentTermsDays(terms);
                                                    return `Payment is due within ${days} days of the invoice date. Due Date: ${formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })}. ${org.termsAndConditions.replace(/Payment is due upon receipt/ig, '').replace(/PAYMENT: Payment is due upon receipt unless otherwise noted\./ig, '')}`;
                                                })() : (
                                                    org.termsAndConditions
                                                )}
                                            </p>
                                        </div>
                                    )}
                                    {org?.lateFeeEnabled && (type as string) === 'Invoice' && dueDate && (
                                        <div className="mt-2 mb-6 text-[9px] text-slate-400 text-center italic max-w-2xl mx-auto">
                                            * Invoices unpaid after {formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })} are subject to a {org.lateFeeType === 'flat' ? `$${org.lateFeeValue}` : `${org.lateFeeValue}%`} late fee and a {org.lateFeeInterestRate}% monthly interest charge.
                                        </div>
                                    )}

                                    {/* Direct Remittance & Payment Instructions */}
                                    {(type as string) === 'Invoice' && (() => {
                                        const paymentConfig = getOrgPaymentInstructions(org);
                                        if (!paymentConfig.hasAnyAccepted) return null;
                                        return (
                                            <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left max-w-3xl mx-auto">
                                                <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5 text-[#123A63]">
                                                    Direct Remittance &amp; Payment Instructions
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] text-slate-600">
                                                    {paymentConfig.check.accepted && (
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-slate-800 uppercase text-[9px]">• Check Payment</div>
                                                            <div className="whitespace-pre-wrap leading-relaxed">{paymentConfig.check.effectiveInstructions}</div>
                                                        </div>
                                                    )}
                                                    {paymentConfig.wire.accepted && (
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-slate-800 uppercase text-[9px]">• Wire Transfer</div>
                                                            <div className="whitespace-pre-wrap leading-relaxed">{paymentConfig.wire.effectiveInstructions}</div>
                                                        </div>
                                                    )}
                                                    {paymentConfig.ach.accepted && (
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-slate-800 uppercase text-[9px]">• ACH / Direct Deposit</div>
                                                            <div className="whitespace-pre-wrap leading-relaxed">{paymentConfig.ach.effectiveInstructions}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="branding-footer text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Generated via {org?.name} Platform</div>
                                        
                                        {!isPnL && !isOther && (() => {
                                            const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
                                            const compText = org?.complianceFooter || (isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711, 1-800-803-9202, 512-463-6599; website: www.tdlr.texas.gov' : '');
                                            if (!org?.licenseNumber && !compText) return null;
                                            return (
                                                <div className="tdlr-footer text-[10px] text-slate-455 text-center leading-loose max-w-2xl mx-auto font-medium">
                                                    {org?.licenseNumber && <div className="font-black text-slate-500 mb-2 tracking-widest uppercase">State License # {org.licenseNumber}</div>}
                                                    {compText && <div>{compText}</div>}
                                                </div>
                                            );
                                        })()}
        
                                        <div className="text-[9px] text-slate-350 font-bold uppercase tracking-widest bg-slate-50 px-6 py-2 rounded-full border border-slate-100">
                                            {new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>,
document.body
);
};

export default DocumentPreview;
