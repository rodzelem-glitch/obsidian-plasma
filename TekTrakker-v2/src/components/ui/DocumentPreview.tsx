import showToast from "lib/toast";
import { getPaymentTermsDays, matchTier, displayTierName , cleanUndefinedFields } from 'lib/utils';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, CreditCard, FileText, Save, Shield, Lock, ShieldCheck, Phone, Building2, User, CheckCircle, X, MapPin } from 'lucide-react';
import type { Proposal, Job, Organization, Address, ProposalItem, InvoiceLineItem, SignedWaiver } from 'types';
import Button from './Button';
import Card from './Card';
import { db, auth } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import DOMPurify from 'dompurify';
import { Printer as CapacitorPrinter } from '@capgo/capacitor-printer';
import { Capacitor } from '@capacitor/core';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import PublicProjectProposal from 'pages/PublicProjectProposal';

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other';
    data: Partial<Proposal> | Partial<Job> | Partial<SignedWaiver>;
    onClose: () => void;
    isInternal?: boolean;
    organization?: Organization | null;
    onSelectTier?: (tier: string) => void;
    autoPrint?: boolean;
    onSave?: () => void;
    disableScopeLock?: boolean;
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

        @media print {
            body { background: white; -webkit-print-color-adjust: exact; }
            .page { padding: 0.5in; box-shadow: none; border: none; position: relative; }
            .no-print { display: none; }
            .doc-watermark { display: block !important; opacity: 0.04 !important; }
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

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization, onSelectTier, autoPrint, onSave, disableScopeLock = false }) => {
    const { state, dispatch } = useAppContext();
    const org = organization || state.currentOrganization;
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [loadedJob, setLoadedJob] = useState<Job | null>(null);
    const [viewMode, setViewMode] = useState<'customer' | 'pdf'>('customer');

    const { isProposal, isOther, prop, job, id, total, subtotal, tax, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName, address, billToName, billToAddress, poNumber, customerId, date, status, signature, items, recommendations, otherData, dueDate, isMcAlisters, overdueDetails, serviceLocationPoNumber } = useMemo(() => {
        const isProposal = type === 'Proposal';
        const isOther = type === 'Other';
        
        // Master Logic: Try to find the latest version in global state if we have an ID
        const providedId = data?.id;
        const globalProp = isProposal && providedId ? state.proposals.find(p => p.id === providedId) : null;
        const globalJob = !isProposal && !isOther && providedId ? state.jobs.find(j => j.id === providedId) : null;

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
        
        const rawItems = isProposal ? (
            prop?.isProjectLevel 
                ? [
                    ...(prop.laborItems || []).map(item => ({
                        id: item.id || `labor-${Math.random()}`,
                        name: `${item.unitName || 'Labor'} - Hours`,
                        description: item.scope || `Labor hours for unit: ${item.unitName}`,
                        quantity: item.hours || 1,
                        unitPrice: item.rate || 0,
                        total: item.value || ((item.rate || 0) * (item.hours || 1)),
                        type: 'Labor' as const
                    })),
                    ...(prop.partItems || []).map(item => ({
                        id: item.id || `part-${Math.random()}`,
                        name: item.partName || 'Part',
                        description: `Part for unit: ${item.unitName}`,
                        quantity: item.quantity || 1,
                        unitPrice: item.customerUnitPrice || 0,
                        total: item.customerLineTotal || ((item.customerUnitPrice || 0) * (item.quantity || 1)),
                        type: 'Part' as const
                    })),
                    ...(prop.allowanceItems || []).map(item => ({
                        id: item.id || `allowance-${Math.random()}`,
                        name: item.description || 'Allowance',
                        description: `Scope basis: ${item.basis}`,
                        quantity: 1,
                        unitPrice: item.amount || 0,
                        total: item.amount || 0,
                        type: 'Fee' as const
                    }))
                ]
                : (prop?.items || [])
        ) : (job?.invoice?.items || []);

        const populatedTiers = ['Basic', 'Premium', 'Platinum'].filter(t => 
            (rawItems as (ProposalItem | InvoiceLineItem)[]).some(i => 'tier' in i && matchTier((i as ProposalItem).tier, t))
        );
        const defaultTier = populatedTiers.length > 0 ? populatedTiers[0] : 'Basic';
        const activeTier = prop?.selectedOption 
            ? displayTierName(prop.selectedOption)
            : (isProposal ? defaultTier : (rawItems.length > 0 && !isProposal && 'tier' in rawItems[0] ? displayTierName((rawItems[0] as ProposalItem).tier) : 'Basic'));
        const safeActiveTier = activeTier || 'Basic';
        
        const items = (rawItems as (ProposalItem | InvoiceLineItem)[]).filter(i => {
            if (isProposal && prop?.isProjectLevel) return true;
            const hasTier = 'tier' in i;
            const itemTier = hasTier ? (i as ProposalItem).tier : null;
            return !isProposal || matchTier(itemTier, safeActiveTier);
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
        
        const associatedJob = isProposal && prop?.jobId ? state.jobs.find(j => j.id === prop.jobId) : null;
        const addressObj = isProposal 
            ? (prop?.locationAddress || (prop as any)?.address || (associatedJob && associatedJob.address) || state.customers.find(c => c.name === prop?.customerName)?.address) 
            : (isOther ? (otherData?.address || '') : job?.address);
        const address = formatAddress(addressObj);

        const date = isProposal 
            ? (prop?.createdAt || new Date().toISOString()) 
            : (isOther 
                ? (otherData?.createdAt || otherData?.timestamp || new Date().toISOString()) 
                : (job?.invoice?.invoiceDate || job?.invoice?.date || job?.appointmentTime));
        const id = providedId || (isProposal ? 'DRAFT' : 'PREVIEW');
        const status = isProposal ? prop?.status : (isOther ? 'Signed' : job?.invoice?.status);
        const signature = isProposal 
            ? (prop?.signatureDataUrl || prop?.signature) 
            : (isOther 
                ? (otherData?.signatureImage || otherData?.signatureDataUrl || otherData?.signature || null) 
                : (job?.invoiceSignature || null));

        const billToName = (!isProposal && !isOther && job?.invoice?.billToName) ? job.invoice.billToName : customerName;
        const billToAddress = isProposal 
            ? formatAddress(state.customers.find(c => c.name === prop?.customerName)?.address)
            : ((!isOther && job?.invoice?.billToAddress) ? job.invoice.billToAddress : address);
        const poNumber = (!isProposal && !isOther) 
            ? (job?.poNumber || null) 
            : (isProposal ? (prop?.poNumber || loadedJob?.poNumber || (associatedJob && associatedJob.poNumber) || null) : null);
        const recommendations = isProposal ? prop?.recommendations : (isOther ? null : job?.invoice?.recommendations);

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

        // Resolve store name and physical address for McAlisters / Best Choice
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

        if (isMcAlisters) {
            finalBillToName = 'Best Choice Florida, LLC';
            finalBillToAddress = '4515 Lyndon B. Johnson Freeway, Dallas, TX 75244';

            // Try to resolve store number from job, proposal, or associated job
            let storeNumber = '';
            const checkObj = (job || prop || {}) as any;
            
            const nameStr = (checkObj.locationName || checkObj.customerName || prop?.customerName || '').toLowerCase();
            const addrStr = (checkObj.address || checkObj.locationAddress || checkObj.invoice?.billToAddress || (associatedJob && (associatedJob.address || associatedJob.invoice?.billToAddress)) || '').toLowerCase();
            const idStr = (checkObj.id || '').toLowerCase();
            const parentIdStr = (checkObj.parentJobId || '').toLowerCase();
            const specInstructions = (checkObj.specialInstructions || (associatedJob && associatedJob.specialInstructions) || '').toLowerCase();

            if (nameStr.includes('1404') || addrStr.includes('pat booker') || addrStr.includes('8121') || idStr.includes('127557') || parentIdStr.includes('127557') || specInstructions.includes('127557')) {
                storeNumber = '1404';
            } else if (nameStr.includes('1386') || addrStr.includes('military hwy') || addrStr.includes('16820')) {
                storeNumber = '1386';
            } else if (nameStr.includes('103139') || addrStr.includes('fm 78') || addrStr.includes('8540')) {
                storeNumber = '103139';
            } else if (nameStr.includes('101075') || addrStr.includes('se military') || addrStr.includes('2314')) {
                storeNumber = '101075';
            } else if (nameStr.includes('103135') || addrStr.includes('loop 1604') || addrStr.includes('7010')) {
                storeNumber = '103135';
            }

            // Check items / descriptions
            if (!storeNumber && checkObj.items && checkObj.items.length > 0) {
                for (const item of checkObj.items) {
                    const itemName = (item.name || item.description || '').toLowerCase();
                    if (itemName.includes('cooler evaporator c2') || itemName.includes('cooler condenser c2') || itemName.includes('freezer evaporator f1') || itemName.includes('freezer condenser f1') || itemName.includes('c2 cooler') || itemName.includes('f1 freezer') || itemName.includes('cooler c2') || itemName.includes('freezer f1')) {
                        storeNumber = '1404';
                        break;
                    }
                }
            }

            // Check assets in job or associatedJob
            const unitStates = checkObj.unitStates || (associatedJob && associatedJob.unitStates) || [];
            if (!storeNumber && unitStates.length > 0) {
                for (const u of unitStates) {
                    const assetId = u.assetId || '';
                    if (assetId.includes('1781049548128') || assetId.includes('1781049905036') || assetId.includes('1781064483880') || assetId.includes('1781064750798')) {
                        storeNumber = '1404';
                        break;
                    } else if (assetId.includes('1780185429101')) {
                        storeNumber = '101075';
                        break;
                    }
                }
            }

            // If we still don't have it, try checking sibling jobs for the same invoice ID
            if (!storeNumber && !isProposal && job?.invoice?.id) {
                const sibling = state.jobs.find(j => j.id !== job.id && j.invoice?.id === job.invoice?.id);
                if (sibling) {
                    const sibName = (sibling.customerName || '').toLowerCase();
                    const sibAddr = (sibling.address || sibling.invoice?.billToAddress || '').toLowerCase();
                    if (sibName.includes('1404') || sibAddr.includes('pat booker') || sibAddr.includes('8121')) {
                        storeNumber = '1404';
                    } else if (sibName.includes('1386') || sibAddr.includes('military hwy') || sibAddr.includes('16820')) {
                        storeNumber = '1386';
                    } else if (sibName.includes('103139') || sibAddr.includes('fm 78') || sibAddr.includes('8540')) {
                        storeNumber = '103139';
                    } else if (sibName.includes('101075') || sibAddr.includes('se military') || sibAddr.includes('2314')) {
                        storeNumber = '101075';
                    } else if (sibName.includes('103135') || sibAddr.includes('loop 1604') || sibAddr.includes('7010')) {
                        storeNumber = '103135';
                    }
                }
            }

            const storeMap: { [key: string]: { name: string, address: string } } = {
                '1404': { name: 'McAlisters Deli #1404', address: '8121 Pat Booker Rd, Live Oak, TX 78233' },
                '1386': { name: 'McAlisters Deli #1386', address: '16820 NM Military Hwy, Shavano Park, TX 78231' },
                '103139': { name: 'McAlisters Deli #103139', address: '8540 FM 78, Converse, TX 78109' },
                '101075': { name: 'McAlisters Deli #101075', address: '2314 SE Military Dr, San Antonio, TX 78223' },
                '103135': { name: 'McAlisters Deli #103135', address: '7010 W. Loop 1604 N., San Antonio, TX 78254' }
            };

            if (storeNumber && storeMap[storeNumber]) {
                finalCustomerName = storeMap[storeNumber].name;
                finalAddress = storeMap[storeNumber].address;
            } else {
                finalCustomerName = checkObj.locationName && !checkObj.locationName.toLowerCase().includes('best choice') 
                    ? checkObj.locationName 
                    : 'McAlisters Deli';
                const possibleAddress = checkObj.address || checkObj.locationAddress;
                finalAddress = typeof possibleAddress === 'string' && !possibleAddress.includes('Johnson') 
                    ? possibleAddress 
                    : (associatedJob && typeof associatedJob.address === 'string' && !associatedJob.address.includes('Johnson')
                        ? associatedJob.address
                        : '8121 Pat Booker Rd, Live Oak, TX 78233'); // Default fallback to Pat Booker if completely unresolved
            }
        }

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

        const customer = state.customers?.find(c => c.id === customerId);
        const serviceLocation = (() => {
            if (!customer) return null;
            const jobAddr = typeof finalAddress === 'string' ? finalAddress.trim().toLowerCase() : '';
            const locationId = job?.locationId || (prop as any)?.locationId;
            return customer.serviceLocations?.find(loc => {
                if (locationId && loc.id === locationId) return true;
                const locAddr = typeof loc.address === 'string' ? loc.address.trim().toLowerCase() : '';
                const formattedLocAddr = formatServiceLocationAddress(loc).trim().toLowerCase();
                return (locAddr && jobAddr && (locAddr === jobAddr || locAddr.includes(jobAddr) || jobAddr.includes(locAddr))) ||
                       (formattedLocAddr && jobAddr && (formattedLocAddr === jobAddr || formattedLocAddr.includes(jobAddr) || jobAddr.includes(formattedLocAddr)));
            });
        })();
        const serviceLocationPoNumber = (serviceLocation as any)?.poNumber || null;

        return { isProposal, isOther, prop, job, id, total, subtotal, tax, additionalFeeName, additionalFeePercent, additionalFeeAmount, customerName: finalCustomerName, address: finalAddress, billToName: finalBillToName, billToAddress: finalBillToAddress, poNumber, customerId, date, status, signature, items, recommendations, otherData, dueDate, isMcAlisters, overdueDetails, serviceLocationPoNumber };
    }, [type, data, state.proposals, state.jobs, state.customers, loadedJob, org]);

    const isPnL = type === 'Other' && (
        otherData?.title?.includes('Profit & Loss') || 
        otherData?.title?.includes('Profit and Loss') || 
        (data as any)?.title?.includes('Profit & Loss') || 
        (data as any)?.title?.includes('Profit and Loss')
    );

    const calculateAvailableTiers = () => {
        if (!isProposal || !prop) return [];
        const tiers = ['Basic', 'Premium', 'Platinum'];
        return tiers.map(t => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tierItems = (prop.items || []).filter((i: any) => matchTier(i.tier, t));
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

    const [loadedProposal, setLoadedProposal] = useState<Proposal | null>(null);
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
            // Find recent jobs for this customer that don't have a proposal linked
            const customerJobs = state.jobs.filter(j => 
                ((j.customerId && j.customerId === prop.customerId) || 
                 (j.customerName && j.customerName === prop.customerName)) &&
                !j.proposalId
            );
            if (customerJobs.length > 0) {
                // Sort by most recent based on creation or appointment time
                customerJobs.sort((a, b) => new Date(b.createdAt || b.appointmentTime || 0).getTime() - new Date(a.createdAt || a.appointmentTime || 0).getTime());
                existingJob = customerJobs[0];
                existingJobId = existingJob.id;
            }
        }

        let shouldUpdateExisting = false;
        let shouldCreateNew = false;

        if (existingJob) {
            if (await globalConfirm(`An existing job/invoice #${existingJobId} (${existingJob.jobStatus}) was found for this customer. Update that job/invoice with this proposal's accepted items?`)) {
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
            if (shouldUpdateExisting && existingJob && existingJobId) {
                // Update the existing job's invoice
                const updatedInvoice = {
                    ...existingJob.invoice,
                    proposalId: prop.id,
                    items: items.map(i => ({
                        id: i.id,
                        description: i.name,
                        type: 'Part' as const,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        total: i.total
                    })),
                    subtotal,
                    taxRate: (state.currentOrganization.taxRate || 8.25) / 100,
                    taxAmount: tax,
                    totalAmount: total,
                    amount: total,
                    status: existingJob.invoice?.status || 'Unpaid'
                };

                const updatedJob: Job = {
                    ...existingJob,
                    proposalId: prop.id,
                    invoice: updatedInvoice,
                    specialInstructions: `${existingJob.specialInstructions || ''}\nUpdated from Proposal #${prop.id}`.trim(),
                    updatedAt: new Date().toISOString()
                };

                await db.collection('jobs').doc(existingJobId).set(cleanUndefinedFields(updatedJob));
                dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                
                // Write back invoiceId to the proposal in Firestore to ensure bidirectional linkage
                const updatedProp = {
                    ...prop,
                    invoiceId: updatedInvoice.id || null,
                    jobId: existingJobId
                };
                await db.collection('proposals').doc(prop.id).update(cleanUndefinedFields({
                    invoiceId: updatedInvoice.id || null,
                    jobId: existingJobId
                }));
                dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProp });

                showToast.warn("Job/Invoice updated successfully with proposal items!");
            } else {
                // Create a new job/invoice (no existing job linked)
                const jobId = `job-${Date.now()}`;
                const invoiceId = `INV-${Date.now()}`;
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
                        id: invoiceId,
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

                await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(newJob));
                dispatch({ type: 'ADD_JOB', payload: newJob });

                // Write back invoiceId and jobId to the proposal in Firestore to ensure bidirectional linkage
                const updatedProp = {
                    ...prop,
                    invoiceId: invoiceId,
                    jobId: jobId
                };
                await db.collection('proposals').doc(prop.id).update(cleanUndefinedFields({
                    invoiceId: invoiceId,
                    jobId: jobId
                }));
                dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProp });

                showToast.warn("Job/Invoice created successfully! View in Operations.");
            }
            onClose();
        } catch (e) {
            console.error(e);
            showToast.warn("Conversion/Update failed.");
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
        setIsDownloading(true);
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
            
            const html2pdfFunc = typeof html2pdf === 'function' ? html2pdf : (html2pdf as any)?.default;
            const pdfDataUri = await html2pdfFunc().from(clone).set(opt).outputPdf('datauristring');
            const { downloadFile } = await import('lib/downloadHelper');
            await downloadFile(pdfDataUri, fileName);
            document.body.removeChild(wrapper);
        } catch (e) {
            console.error('Download failed', e);
            showToast.warn('Failed to generate PDF directly. Falling back to print dialog...');
            handlePrint();
        } finally {
            setIsDownloading(false);
            setViewMode(originalViewMode);
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


    return ReactDOM.createPortal(
        <div id="document-preview-overlay" onClick={onClose} className="fixed inset-0 bg-slate-900/60 sm:backdrop-blur-md flex items-center justify-center p-0 sm:p-6 z-[10000] animate-in fade-in duration-200 overflow-y-auto">
            <div onClick={e => e.stopPropagation()} className="bg-slate-50 dark:bg-slate-950 w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            {/* Control Header */}
            <div className="bg-white dark:bg-slate-800 shadow-xl p-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:p-4 md:pt-4 flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 h-auto py-3 md:py-4 shrink-0 gap-3 relative pr-12 md:pr-16">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-primary-600 p-1.5 md:p-2 rounded-xl text-white shadow-lg shadow-primary-500/20">
                        <FileText size={20} className="md:w-6 md:h-6"/>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">Reviewing {type}</h2>
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest truncate">ID: #{id}</p>
                    </div>
                </div>
                {!isOther && (
                    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 shrink-0 border border-slate-200/50 dark:border-slate-800">
                        <button
                            onClick={() => setViewMode('customer')}
                            className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                viewMode === 'customer'
                                    ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm border-none'
                                    : 'text-slate-500 hover:text-slate-700 border-none bg-transparent'
                            }`}
                        >
                            Customer Portal
                        </button>
                        <button
                            onClick={() => setViewMode('pdf')}
                            className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                viewMode === 'pdf'
                                    ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm border-none'
                                    : 'text-slate-500 hover:text-slate-700 border-none bg-transparent'
                            }`}
                        >
                            Print PDF
                        </button>
                    </div>
                )}
                <div className="flex flex-row flex-nowrap gap-2 md:gap-4 justify-center items-center shrink-0">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={onClose} 
                        className="text-xs md:text-sm font-black uppercase tracking-wider border-slate-200"
                    >
                        Close
                    </Button>
                    {onSave && (
                        <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 md:gap-2 text-xs md:text-sm font-black shadow-xl shadow-emerald-500/20">
                            <Save size={14} className="md:w-4 md:h-4"/> Save
                        </Button>
                    )}
                    {isProposal && status === 'Accepted' && isInternal && (
                        <Button onClick={handleConvertToJob} disabled={isConverting} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 md:gap-2 text-xs md:text-sm font-black shadow-xl shadow-emerald-500/20">
                            <ArrowRight size={14} className="md:w-4 md:h-4"/> {isConverting ? '...' : 'Convert'}
                        </Button>
                    )}
                    <Button onClick={handleDownload} disabled={isDownloading} variant="secondary" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-black border-slate-200">
                        <FileText size={14} className="md:w-4 md:h-4"/> {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </Button>
                    {type !== 'Invoice' && (
                        <Button onClick={handlePrint} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-black shadow-xl shadow-primary-500/20">
                            <Printer size={14} className="md:w-4 md:h-4"/> Print
                        </Button>
                    )}
                </div>
                {/* Close Button X */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 md:top-1/2 md:-translate-y-1/2 right-3 md:right-5 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <X size={18} className="md:w-5 md:h-5" />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 custom-scrollbar touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="w-full p-2 sm:p-4 md:p-12 flex justify-center">
                    {viewMode === 'customer' ? (
                        <div ref={printRef} className="w-full max-w-4xl sm:shrink-0 h-fit mb-12 flex flex-col bg-transparent text-slate-900 animate-in fade-in duration-300">
                            {type === 'Invoice' ? (
                                <div className="w-full max-w-4xl mx-auto py-2 px-2 text-left font-sans">
                                    <iframe 
                                        src={`/#/invoice/${data?.id || id || job?.id}`} 
                                        className="w-full h-[85vh] border-0 rounded-2xl shadow-xl bg-white"
                                        title="Invoice Preview"
                                    />
                                </div>
                            ) : type === 'Other' ? (
                                <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans animate-in fade-in duration-300">
                                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden">
                                        {otherData?.htmlContent ? (
                                            <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                        ) : (
                                            <div className="text-slate-600 whitespace-pre-wrap">{otherData?.content || otherData?.body || 'No content available.'}</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-4xl mx-auto py-4 px-4 text-left font-sans">
                                    {/* Stepper bar */}
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 flex justify-between items-center relative overflow-hidden shadow-sm">
                                        <div className="flex items-center gap-4">
                                            {org?.logoUrl ? (
                                                <img src={org.logoUrl} className="h-10 w-auto object-contain" alt="Logo"/>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">
                                                    {org?.name?.substring(0, 2).toUpperCase() || 'TT'}
                                                </div>
                                            )}
                                            <div>
                                                <h1 className="text-base font-extrabold text-slate-800 tracking-tight">TekTrakker Proposal Portal</h1>
                                                <p className="text-[10px] text-slate-500 font-semibold">{org?.name}</p>
                                            </div>
                                        </div>
                                        
                                        {/* Stepper */}
                                        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <span className="text-primary-600 flex items-center gap-1.5"><ShieldCheck size={14}/> 1. Terms Agreement</span>
                                            <span className="w-8 h-0.5 bg-slate-200"></span>
                                            <span>2. Signature</span>
                                            <span className="w-8 h-0.5 bg-slate-200"></span>
                                            <span>3. Completed</span>
                                        </div>
                                    </div>

                                    {/* Proposal Content */}
                                    <PublicProjectProposal proposalData={activeProp} embedded={true} />
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
                                                <span className="meta-value font-black text-slate-900">{formatLocalDate(date, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            </div>
                                            {type === 'Invoice' && job?.appointmentTime && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Site Visit Date</span>
                                                    <span className="meta-value font-black text-slate-900">{formatLocalDate(job.appointmentTime, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {type === 'Invoice' && dueDate && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Due Date</span>
                                                    <span className="meta-value font-black text-slate-900">{formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            <div className="meta-line flex justify-end gap-3">
                                                <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                                <span className={`meta-value status-badge font-black uppercase ${status === 'Paid' ? 'text-emerald-600' : 'text-primary-600'}`}>{status}</span>
                                            </div>
                                            {poNumber && (
                                                <div className="meta-line flex justify-end gap-3">
                                                    <span className="meta-label font-bold text-slate-400 uppercase tracking-wider">PO / WO #</span>
                                                    <button 
                                                        onClick={() => customerId && dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId } })}
                                                        className="meta-value font-black text-slate-900 cursor-pointer hover:underline border-none bg-transparent p-0 text-right font-sans"
                                                        disabled={!customerId}
                                                    >
                                                        {poNumber}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                )}

                                {/* Addresses Section */}
                                {!isPnL && !isOther && (
                                    isProposal ? (
                                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-xs">
                                                                            {/* Box 1: Customer / Property Mgr */}
                                                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                                                                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">1. CUSTOMER / PROPERTY MGR</div>
                                                                                <div className="font-bold text-sm text-slate-900">{customerName || '23rd Group Facility Services'}</div>
                                                                                <div className="text-xs text-slate-500 font-medium font-sans">{(prop as any)?.customerAddress || (prop as any)?.clientAddress || address || '4944 Parkway Plaza Blvd, Charlotte, NC 28217'}</div>
                                                                                {prop?.projectName && <div className="text-[11px] text-slate-400 font-semibold pt-1">Project: {prop.projectName}</div>}
                                                                            </div>

                                                                            {/* Box 2: Bill To (Paying Entity) */}
                                                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                                                                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">2. BILL TO (PAYING ENTITY)</div>
                                                                                <div className="font-bold text-sm text-slate-900">{billToName || (prop as any)?.billToName || (prop as any)?.billingCompany || customerName || '23rd Group Facility Services'}</div>
                                                                                <div className="text-xs text-slate-500 font-medium font-sans">{billToAddress || (prop as any)?.billToAddress || (prop as any)?.billingAddress || address || '4944 Parkway Plaza Blvd, Charlotte, NC 28217'}</div>
                                                                                {poNumber && <div className="text-[11px] font-mono text-slate-400 font-bold pt-1">PO #: {poNumber}</div>}
                                                                            </div>

                                                                            {/* Box 3: Service Site Location */}
                                                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                                                                                <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">3. SERVICE SITE LOCATION</div>
                                                                                <div className="font-bold text-sm text-slate-900">{(prop as any)?.serviceLocationName || (prop as any)?.siteName || customerName || 'Humana Conviva'}</div>
                                                                                <div className="flex items-start gap-1.5 text-xs text-slate-500 font-medium">
                                                                                    <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                                                                    <span>{(prop as any)?.serviceLocationAddress || (prop as any)?.siteAddress || (prop as any)?.locationAddress || address || '4455 Thousands Oaks Drive, San Antonio, TX 78233'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="address-section flex flex-col sm:flex-row justify-between mb-12 sm:mb-16 gap-6 sm:gap-10">
                                                                            <div className="address-block flex-1">
                                                                                <div className="addr-title text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4">Bill To</div>
                                                                                <div className="addr-name text-xl font-black text-slate-900 mb-2">{billToName}</div>
                                                                                <div className="addr-details text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{billToAddress}</div>
                                                                                
                                                                                {(billToName !== customerName || billToAddress !== address || serviceLocationPoNumber) && (
                                                                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                                                                        <div className="addr-title text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4">
                                                                                            Service Location {serviceLocationPoNumber && <span className="normal-case text-emerald-500 font-mono ml-2 font-bold">(PO: {serviceLocationPoNumber})</span>}
                                                                                        </div>
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
                                                                    )
                                                                )}
        
                                {/* Main Content Area */}
                                <div className="flex-1">
                                    {isOther ? (
                                        isPnL || otherData?.htmlContent ? (
                                            <div className="w-full">
                                                {otherData?.htmlContent ? (
                                                    <div className="prose max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(otherData.htmlContent) }} />
                                                ) : (
                                                    <div className="text-slate-600 whitespace-pre-wrap">{otherData?.content || otherData?.body || 'No content available.'}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 rounded-3xl p-10 border border-slate-100 min-h-[500px]">
                                                <h3 className="text-lg font-black text-slate-900 mb-6">{otherData?.title || 'Document Content'}</h3>
                                                {(otherData?.url || otherData?.dataUrl) && (
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
                                        )
                                    ) : showMultiTier ? (
                                        <div className="space-y-6 mb-10">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                                        <div className={`mt-auto text-center border-t pt-4 ${onSelectTier ? 'text-primary-600 font-black text-[10px] uppercase tracking-widest' : 'text-slate-350'}`}>
                                                            {onSelectTier ? 'Click to Select' : 'Option Available'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
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
                                                            </td>
                                                            <td className="td td-center py-4 px-2 sm:py-8 sm:px-4 text-center font-bold text-slate-600 text-sm">{item.quantity}</td>
                                                            <td className="td td-right py-4 px-2 sm:py-8 sm:px-4 text-right font-bold text-slate-650 text-sm">
                                                                {item.isPercentage && item.percentageRate 
                                                                    ? `${Number(item.percentageRate)}%` 
                                                                    : `$${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                                                }
                                                            </td>
                                                            <td className="td td-right py-4 px-2 sm:py-8 sm:px-6 text-right font-black text-slate-900 text-sm">${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
                                                <span className="font-bold text-slate-455 uppercase tracking-wider">Tax</span>
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
                                            <div className="summary-row total flex justify-between items-center">
                                                <span className="font-black uppercase tracking-wider">Total</span>
                                                <span className="total-value font-black font-sans text-slate-950">${(total + (overdueDetails?.totalLateFees || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
        
                                {/* Authorizations and Signatures */}
                                {!isPnL && !isOther && !showMultiTier && (
                                <div className="signature-section flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mt-16 pb-12 border-b border-slate-50">
                                    <div className="sig-block w-[300px] text-left">
                                        <div className="sig-image-wrap border-b-2 border-slate-200 min-h-[60px] flex items-end pb-2">
                                            {signature ? (
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
                                    </div>
                                    <div className="flex-1 text-center md:text-right">
                                        <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">{org?.name}</div>
                                        <div className="text-[10px] text-slate-500 font-medium">Professional Field Service Solutions</div>
                                    </div>
                                </div>
                                )}
        
                                {/* Center Aligned Terms and Footer */}
                                <div className="footer border-t border-slate-100 pt-10 mt-12">
                                    {org?.termsAndConditions && !isOther && (
                                        <div className="mb-8">
                                            <div className="sig-label text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] mb-4">Terms & Conditions</div>
                                            <p className="terms-text text-[10px] text-slate-500 text-center leading-relaxed italic max-w-3xl mx-auto px-6">
                                                {type === 'Invoice' && dueDate ? (() => {
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
                                    {org?.lateFeeEnabled && type === 'Invoice' && dueDate && (
                                        <div className="mt-2 mb-6 text-[9px] text-slate-400 text-center italic max-w-2xl mx-auto">
                                            * Invoices unpaid after {formatLocalDate(dueDate, { year: 'numeric', month: 'long', day: 'numeric' })} are subject to a {org.lateFeeType === 'flat' ? `$${org.lateFeeValue}` : `${org.lateFeeValue}%`} late fee and a {org.lateFeeInterestRate}% monthly interest charge.
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="branding-footer text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Generated via {org?.name} Platform</div>
                                        
                                        {!isPnL && !isOther && (
                                        <div className="tdlr-footer text-[10px] text-slate-455 text-center leading-loose max-w-2xl mx-auto font-medium">
                                            {org?.licenseNumber && <div className="font-black text-slate-500 mb-2 tracking-widest uppercase">State License # {org.licenseNumber}</div>}
                                            {org?.complianceFooter ? org.complianceFooter : (
                                                <>Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711, 1-800-803-9202, 512-463-6599; website: www.tdlr.texas.gov</>
                                            )}
                                        </div>
                                        )}
        
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
