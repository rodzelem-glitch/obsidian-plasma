import type { SubcontractorChargeback, Subcontractor, Job } from '../types';
import { formatFullAddress } from './utils';

export interface ChargebackSummary {
    totalActive: number;
    pendingTotal: number;
    appliedTotal: number;
    disputedTotal: number;
    waivedTotal: number;
    count: number;
    activeCount: number;
}

/**
 * Calculates chargeback summary metrics for a given list of chargebacks.
 */
export function calculateSubcontractorChargebackTotals(
    chargebacks: SubcontractorChargeback[] = [],
    subcontractorId?: string
): ChargebackSummary {
    const relevant = subcontractorId
        ? chargebacks.filter(cb => cb.subcontractorId === subcontractorId)
        : chargebacks;

    let pendingTotal = 0;
    let appliedTotal = 0;
    let disputedTotal = 0;
    let waivedTotal = 0;

    relevant.forEach(cb => {
        const amt = Number(cb.amount) || 0;
        if (cb.status === 'Pending') pendingTotal += amt;
        else if (cb.status === 'Applied') appliedTotal += amt;
        else if (cb.status === 'Disputed') disputedTotal += amt;
        else if (cb.status === 'Waived') waivedTotal += amt;
    });

    const totalActive = appliedTotal + pendingTotal;
    const activeCount = relevant.filter(cb => cb.status === 'Pending' || cb.status === 'Applied').length;

    return {
        totalActive: Math.round(totalActive * 100) / 100,
        pendingTotal: Math.round(pendingTotal * 100) / 100,
        appliedTotal: Math.round(appliedTotal * 100) / 100,
        disputedTotal: Math.round(disputedTotal * 100) / 100,
        waivedTotal: Math.round(waivedTotal * 100) / 100,
        count: relevant.length,
        activeCount
    };
}

/**
 * Formats a category slug to a user-facing title.
 */
export function formatChargebackCategory(category?: string): string {
    switch (category) {
        case 'property_damage':
            return 'Property Damage';
        case 'faulty_work':
            return 'Faulty Workmanship / Rework';
        case 'material_loss':
            return 'Material Loss / Scrap';
        case 'safety_violation':
            return 'Safety Violation / Fine';
        default:
            return 'Site Property Chargeback';
    }
}

/**
 * Generates a clean, unique Subcontractor Payment Statement number.
 */
export function generateSubcontractorStatementNumber(subcontractorId?: string, date = new Date()): string {
    const cleanId = (subcontractorId || 'SUB').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const randStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `SPS-${cleanId}-${dateStr}-${randStr}`;
}

export interface StatementItemJob {
    job: Job;
    workOrderNumber?: string;
    customerName: string;
    serviceLocation?: string;
    date: string;
    description?: string;
    orgNTE?: number;
    subNTE?: number;
    payoutAmount: number;
    status: 'Paid' | 'Unpaid' | 'Settled';
    paidAt?: string;
}

export interface SubcontractorStatementHtmlOptions {
    organization: any;
    subcontractor: Subcontractor;
    statementNumber: string;
    statementDate: string;
    statementPeriod: string;
    jobs: StatementItemJob[];
    chargebacks: SubcontractorChargeback[];
    notes?: string;
    paymentInstructions?: string;
    paymentMethod?: string;
}

/**
 * Generates an executive, print-ready and email-ready HTML Subcontractor Payment Statement & Remittance.
 */
export function generateSubcontractorStatementHtml(options: SubcontractorStatementHtmlOptions): string {
    const {
        organization,
        subcontractor,
        statementNumber,
        statementDate,
        statementPeriod,
        jobs = [],
        chargebacks = [],
        notes = '',
        paymentInstructions = '',
        paymentMethod = ''
    } = options;

    const orgName = organization?.name || 'TekAir Inc.';
    const orgAddress = organization?.address ? formatFullAddress(organization.address) : '';
    const orgPhone = organization?.phone || '';
    const orgEmail = organization?.email || '';
    const orgLogo = organization?.logoUrl || organization?.logo || '';

    const subName = subcontractor?.companyName || subcontractor?.contactName || 'Subcontractor Partner';
    const subContact = subcontractor?.contactName || '';
    const subEmail = subcontractor?.email || '';
    const subPhone = subcontractor?.phone || subcontractor?.contactPhone || '';
    const subTrade = subcontractor?.trade || 'Contracting Partner';
    const subLicense = subcontractor?.licenseNumber || '';

    // Calculate Financials
    const totalGrossEarnings = jobs.reduce((sum, j) => sum + (Number(j.payoutAmount) || 0), 0);
    const totalPaidEarnings = jobs
        .filter(j => j.status === 'Paid' || (j.status as string) === 'Settled' || Number(j.payoutAmount) === 0)
        .reduce((sum, j) => sum + (Number(j.payoutAmount) || 0), 0);
    const totalUnpaidEarnings = Math.max(0, totalGrossEarnings - totalPaidEarnings);
    const activeChargebacks = chargebacks.filter(cb => cb.status === 'Applied' || cb.status === 'Pending');
    const totalChargebackDeductions = activeChargebacks.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
    const netPayoutAmount = Math.max(0, totalUnpaidEarnings - totalChargebackDeductions);
    const isFullyPaid = totalUnpaidEarnings === 0 && totalGrossEarnings > 0;

    // Collect all evidence photos and receipts across ALL chargebacks (including waived)
    const allEvidencePhotos = chargebacks.flatMap(cb => 
        (cb.evidencePhotos || []).map(p => ({ ...p, chargebackTitle: cb.title, date: cb.date }))
    );
    const allReceipts = chargebacks.flatMap(cb => 
        (cb.receiptsAndInvoices || []).map(r => ({ ...r, chargebackTitle: cb.title, date: cb.date }))
    );

    const jobsRowsHtml = jobs.length === 0
        ? `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; border-bottom: 1px solid #e2e8f0;">No completed jobs in this statement period.</td></tr>`
        : jobs.map((item, idx) => {
            const woNum = item.workOrderNumber || item.job.workOrderNumber || item.job.poNumber || item.job.id.slice(0, 8).toUpperCase();
            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid !important; break-inside: avoid !important;">
                    <td style="padding: 10px 12px; font-weight: 700; font-family: monospace; font-size: 11px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                        #${woNum}
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; color: #475569; border-bottom: 1px solid #e2e8f0;">
                        ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                        <strong style="color: #0f172a; display: block;">${item.serviceLocation || 'Field Service Site'}</strong>
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; color: #475569; border-bottom: 1px solid #e2e8f0;">
                        ${item.description || `${subTrade} Service & Field Labor`}
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9px; font-weight: 800; text-transform: uppercase; ${(item.status === 'Paid' || item.status === 'Settled' || Number(item.payoutAmount) === 0) ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fef3c7; color: #92400e;'}">
                            ${Number(item.payoutAmount) === 0 ? 'Settled' : item.status}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; font-size: 12px; font-weight: 800; text-align: right; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">
                        $${(Number(item.payoutAmount) || 0).toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');

    const chargebacksRowsHtml = chargebacks.length === 0
        ? `<tr><td colspan="5" style="padding: 14px; text-align: center; color: #166534; background-color: #f0fdf4; font-weight: 600; font-size: 11px; border-bottom: 1px solid #bbf7d0;">✓ Zero Property Damage or Faulty Work Chargebacks on record for this period.</td></tr>`
        : chargebacks.map((cb, idx) => {
            const catName = formatChargebackCategory(cb.category);
            const photoCount = cb.evidencePhotos?.length || 0;
            const receiptCount = cb.receiptsAndInvoices?.length || 0;
            const isWaived = cb.status === 'Waived';
            const evidenceBadges: string[] = [];
            if (photoCount > 0) evidenceBadges.push(`📷 ${photoCount} Damage Photo${photoCount > 1 ? 's' : ''}`);
            if (receiptCount > 0) evidenceBadges.push(`🧾 ${receiptCount} Receipt/Work Order${receiptCount > 1 ? 's' : ''}`);

            const rowBg = isWaived 
                ? (idx % 2 === 0 ? '#f0fdf4' : '#f8fafc') 
                : (idx % 2 === 0 ? '#fff5f5' : '#fff1f2');
            const borderCol = isWaived ? '#bbf7d0' : '#fecdd3';

            return `
                <tr style="background-color: ${rowBg}; page-break-inside: avoid !important; break-inside: avoid !important;">
                    <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid ${borderCol};">
                        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; ${isWaived ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fee2e2; color: #991b1b;'} font-weight: 800; font-size: 9px; text-transform: uppercase;">
                            ${catName}
                        </span>
                        ${isWaived ? `<span style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; background-color: #dcfce7; color: #166534; font-weight: 800; font-size: 9px; text-transform: uppercase;">Forgiven</span>` : ''}
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                            ${cb.date ? new Date(cb.date).toLocaleDateString() : ''}
                        </div>
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #1e293b; border-bottom: 1px solid ${borderCol};">
                        ${cb.title}
                        ${cb.workOrderNumber ? `<div style="font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px;">Work Order: #${cb.workOrderNumber}</div>` : ''}
                    </td>
                    <td style="padding: 10px 12px; font-size: 11px; color: #334155; border-bottom: 1px solid ${borderCol};">
                        ${cb.description || 'Site property damage or rework to correct faulty work.'}
                    </td>
                    <td style="padding: 10px 12px; font-size: 10px; color: #64748b; border-bottom: 1px solid ${borderCol};">
                        ${evidenceBadges.length > 0 ? evidenceBadges.join('<br/>') : 'Incident Report Logged'}
                    </td>
                    <td style="padding: 10px 12px; font-size: 12px; font-weight: 800; text-align: right; font-family: monospace; border-bottom: 1px solid ${borderCol};">
                        ${isWaived ? `
                            <div style="font-size: 10px; text-decoration: line-through; color: #94a3b8;">-$${(Number(cb.amount) || 0).toFixed(2)}</div>
                            <div style="color: #166534; font-size: 12px;">-$0.00</div>
                            <div style="font-size: 8px; color: #166534; font-weight: 800; text-transform: uppercase;">(Forgiven)</div>
                        ` : `
                            <span style="color: #b91c1c;">-$${(Number(cb.amount) || 0).toFixed(2)}</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');

    // Receipts breakdown html
    const receiptsSectionHtml = allReceipts.length === 0 ? '' : `
        <div class="receipts-section pdf-avoid-break avoid-break" style="margin-top: 24px; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #334155; letter-spacing: 0.05em;">
                🧾 Receipts & Repair Invoices Charged Back
            </h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase;">
                        <th style="padding: 6px 8px;">Receipt / Work Order Doc</th>
                        <th style="padding: 6px 8px;">Chargeback Cause</th>
                        <th style="padding: 6px 8px;">Notes / Replacement Parts</th>
                        <th style="padding: 6px 8px; text-align: right;">Cost ($)</th>
                    </tr>
                </thead>
                <tbody>
                    ${allReceipts.map((r, i) => `
                        <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid !important; break-inside: avoid !important;">
                            <td style="padding: 6px 8px; font-weight: 700; color: #1e293b;">
                                ${r.url ? `<a href="${r.url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${r.name || 'Receipt Document'}</a>` : (r.name || 'Receipt Document')}
                            </td>
                            <td style="padding: 6px 8px; color: #64748b;">${r.chargebackTitle || 'Damage Repair'}</td>
                            <td style="padding: 6px 8px; color: #475569;">${r.notes || 'Replacement materials / technician labor to repair faulty work'}</td>
                            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">
                                ${r.amount ? `$${Number(r.amount).toFixed(2)}` : '--'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Evidence photos gallery html
    const photosGalleryHtml = allEvidencePhotos.length === 0 ? '' : `
        <div class="evidence-gallery page-break-before" style="margin-top: 32px; padding: 16px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; page-break-before: always !important; break-before: page !important;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <h4 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #991b1b; letter-spacing: 0.05em;">
                    📷 Damage & Faulty Work Evidence Documentation
                </h4>
                <span style="font-size: 10px; font-weight: 700; color: #991b1b; background-color: #fee2e2; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                    Attached Incident Exhibit (${allEvidencePhotos.length} Photos)
                </span>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 11px; color: #7f1d1d;">
                The following photographic evidence was recorded and verified on site regarding the property damage or faulty workmanship deductions listed above:
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                ${allEvidencePhotos.map((p) => `
                    <div class="photo-card pdf-avoid-break avoid-break" style="flex: 1 1 200px; max-width: 240px; border: 1px solid #fda4af; border-radius: 6px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); page-break-inside: avoid !important; break-inside: avoid !important;">
                        <div style="height: 140px; background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="${p.url}" alt="Site Damage Evidence" style="width: 100%; height: 100%; object-fit: cover;" />
                        </div>
                        <div style="padding: 8px 10px;">
                            <div style="font-size: 10px; font-weight: 700; color: #991b1b;">${p.chargebackTitle || 'Property Damage'}</div>
                            <div style="font-size: 10px; color: #475569; margin-top: 2px;">${p.caption || 'Site photographic proof'}</div>
                            ${p.timestamp ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 3px;">📅 ${new Date(p.timestamp).toLocaleString()}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Subcontractor Payment Statement #${statementNumber}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #0f172a;
                    background-color: #ffffff;
                    margin: 0;
                    padding: 24px;
                    line-height: 1.5;
                }
                .statement-container {
                    max-width: 850px;
                    margin: 0 auto;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 32px;
                    background-color: #ffffff;
                }
                @media print {
                    body { padding: 0; }
                    .statement-container { border: none; padding: 0; max-width: 100%; }
                    .avoid-break, .pdf-avoid-break, .chargeback-section, .remittance-box, .receipts-section, .photo-card, .statement-notes, tr, table {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    h1, h2, h3, h4 {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                }
                .avoid-break, .pdf-avoid-break, .chargeback-section, .remittance-box, .receipts-section, .photo-card, .statement-notes, tr, table {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                h1, h2, h3, h4 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }
                .page-break-before {
                    page-break-before: always !important;
                    break-before: page !important;
                }
            </style>
        </head>
        <body>
            <div class="statement-container">
                <!-- Header -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr>
                        <td style="vertical-align: top; width: 55%;">
                            ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="max-height: 48px; margin-bottom: 8px; display: block;" />` : ''}
                            <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${orgName}</h2>
                            ${orgAddress ? `<div style="font-size: 11px; color: #475569;">${orgAddress}</div>` : ''}
                            ${orgPhone ? `<div style="font-size: 11px; color: #475569;">Phone: ${orgPhone}</div>` : ''}
                            ${orgEmail ? `<div style="font-size: 11px; color: #475569;">Email: ${orgEmail}</div>` : ''}
                        </td>
                        <td style="vertical-align: top; text-align: right; width: 45%;">
                            <div style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                                Subcontractor Payment Statement
                            </div>
                            <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-top: 4px;">
                                <tr>
                                    <td style="text-align: right; color: #64748b; padding: 2px 6px;">Statement #:</td>
                                    <td style="text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${statementNumber}</td>
                                </tr>
                                <tr>
                                    <td style="text-align: right; color: #64748b; padding: 2px 6px;">Date Issued:</td>
                                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${statementDate}</td>
                                </tr>
                                <tr>
                                    <td style="text-align: right; color: #64748b; padding: 2px 6px;">Period:</td>
                                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${statementPeriod}</td>
                                </tr>
                                <tr>
                                    <td style="text-align: right; color: #64748b; padding: 2px 6px;">Settlement Status:</td>
                                    <td style="text-align: right;">
                                        <strong style="${isFullyPaid ? 'color: #16a34a;' : 'color: #ea580c;'}">
                                            ${isFullyPaid ? 'Settled (Paid)' : 'Pending Payout'}
                                        </strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Subcontractor & Payee Card -->
                <div class="pdf-avoid-break avoid-break" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; page-break-inside: avoid !important; break-inside: avoid !important;">
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
                        Subcontractor / Payee Remittance Details
                    </div>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${subName}</div>
                            ${subContact && subContact !== subName ? `<div style="font-size: 12px; color: #475569;">Attn: ${subContact}</div>` : ''}
                            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Trade: <strong>${subTrade}</strong> ${subLicense ? `| License #: <strong>${subLicense}</strong>` : ''}</div>
                        </div>
                        <div style="text-align: right; font-size: 11px; color: #475569;">
                            ${subEmail ? `<div>Email: <strong>${subEmail}</strong></div>` : ''}
                            ${subPhone ? `<div>Phone: <strong>${subPhone}</strong></div>` : ''}
                        </div>
                    </div>
                    ${paymentMethod ? `
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                        <span style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px;">Payment Remitted Via:</span>
                        <span style="color: #0f172a; font-weight: 800; font-family: monospace;">${paymentMethod}</span>
                    </div>
                    ` : ''}
                </div>

                <!-- Section 1: Gross Labor & Completed Work Orders -->
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1e293b; letter-spacing: 0.05em;">
                            1. Completed Work Orders & Labor Earnings (Gross)
                        </h3>
                        <span style="font-size: 11px; font-weight: 700; color: #475569;">${jobs.length} Job${jobs.length === 1 ? '' : 's'}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #0f172a; color: #ffffff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
                                <th style="padding: 8px 12px;">Work Order</th>
                                <th style="padding: 8px 12px;">Date</th>
                                <th style="padding: 8px 12px;">Site / Location</th>
                                <th style="padding: 8px 12px;">Scope of Work</th>
                                <th style="padding: 8px 12px; text-align: center;">Status</th>
                                <th style="padding: 8px 12px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${jobsRowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f1f5f9; font-weight: 800; page-break-inside: avoid !important; break-inside: avoid !important;">
                                <td colspan="5" style="padding: 10px 12px; text-align: right; color: #334155; font-size: 11px;">
                                    Total Gross Labor Earnings:
                                </td>
                                <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; color: #0f172a;">
                                    $${totalGrossEarnings.toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Section 2: Property Damage & Rework Deductions (Chargebacks) -->
                <div class="chargeback-section pdf-avoid-break avoid-break" style="margin-bottom: 24px; page-break-inside: avoid !important; break-inside: avoid !important;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #991b1b; letter-spacing: 0.05em;">
                            2. Property Damage & Faulty Workmanship Deductions (Chargebacks)
                        </h3>
                        <span style="font-size: 11px; font-weight: 700; color: #991b1b;">
                            ${chargebacks.length} Record${chargebacks.length === 1 ? '' : 's'}${chargebacks.some(c => c.status === 'Waived') ? ' (Includes Forgiven on Record)' : ''}
                        </span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #991b1b; color: #ffffff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
                                <th style="padding: 8px 12px;">Category</th>
                                <th style="padding: 8px 12px;">Incident / Job</th>
                                <th style="padding: 8px 12px;">Description of Damage / Faulty Work</th>
                                <th style="padding: 8px 12px;">Attached Evidence</th>
                                <th style="padding: 8px 12px; text-align: right;">Deduction</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${chargebacksRowsHtml}
                        </tbody>
                        ${chargebacks.length > 0 ? `
                        <tfoot>
                            <tr style="background-color: #f1f5f9; font-weight: 800; page-break-inside: avoid !important; break-inside: avoid !important;">
                                <td colspan="4" style="padding: 10px 12px; text-align: right; color: #334155; font-size: 11px;">
                                    Total Active Chargeback Deductions:
                                </td>
                                <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; color: ${totalChargebackDeductions > 0 ? '#991b1b' : '#166534'};">
                                    -$${totalChargebackDeductions.toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>

                ${receiptsSectionHtml}

                <!-- Financial Remittance Summary Box -->
                <div class="remittance-box pdf-avoid-break avoid-break" style="margin-top: 28px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); page-break-inside: avoid !important; break-inside: avoid !important;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="vertical-align: middle; width: 60%;">
                                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">
                                    Final Payment Remittance Calculation
                                </div>
                                <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">
                                    Gross Earnings minus validated site property damage & rework chargebacks.
                                </div>
                                ${paymentMethod ? `
                                <div style="margin-top: 14px; padding: 8px 12px; background-color: rgba(255,255,255,0.08); border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); display: inline-block;">
                                    <span style="color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Remittance Method: </span>
                                    <span style="color: #38bdf8; font-weight: 800; font-family: monospace; font-size: 11px;">${paymentMethod}</span>
                                </div>
                                ` : ''}
                            </td>
                            <td style="vertical-align: middle; text-align: right; width: 40%;">
                                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                                    <tr>
                                        <td style="text-align: right; color: #cbd5e1; padding: 2px 8px;">Gross Earnings:</td>
                                        <td style="text-align: right; font-weight: 700; font-family: monospace;">$${totalGrossEarnings.toFixed(2)}</td>
                                    </tr>
                                    ${totalPaidEarnings > 0 ? `
                                    <tr>
                                        <td style="text-align: right; color: #86efac; padding: 2px 8px;">Less Amount Paid / Settled:</td>
                                        <td style="text-align: right; font-weight: 700; font-family: monospace; color: #86efac;">-$${totalPaidEarnings.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                    <tr>
                                        <td style="text-align: right; color: #fca5a5; padding: 2px 8px;">Less Active Chargebacks:</td>
                                        <td style="text-align: right; font-weight: 700; font-family: monospace; color: #fca5a5;">-$${totalChargebackDeductions.toFixed(2)}</td>
                                    </tr>
                                    <tr style="border-top: 1px solid #475569;">
                                        <td style="text-align: right; font-weight: 800; font-size: 14px; padding: 8px 8px 0 8px; color: #ffffff;">Net Remittance Due:</td>
                                        <td style="text-align: right; font-weight: 900; font-size: 18px; font-family: monospace; padding: 8px 0 0 8px; color: ${netPayoutAmount === 0 ? '#34d399' : '#fbbf24'};">
                                            $${netPayoutAmount.toFixed(2)}${isFullyPaid ? ' (PAID IN FULL)' : ''}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Notes / Remittance Instructions -->
                <div class="statement-notes pdf-avoid-break avoid-break" style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; page-break-inside: avoid !important; break-inside: avoid !important;">
                    ${paymentMethod ? `<p style="margin: 0 0 6px 0;"><strong>Payment Method / Remittance:</strong> ${paymentMethod}</p>` : ''}
                    ${paymentInstructions ? `<p style="margin: 0 0 6px 0;"><strong>Payment Terms:</strong> ${paymentInstructions}</p>` : `<p style="margin: 0 0 6px 0;"><strong>Remittance Policy:</strong> Payouts are remitted via Direct ACH / Company Check per Master Subcontractor Agreement terms. Chargebacks are documented with photo proof and material receipts.</p>`}
                    ${notes ? `<p style="margin: 0 0 6px 0;"><strong>Statement Notes:</strong> ${notes}</p>` : ''}
                    <p style="margin: 8px 0 0 0; font-size: 10px; color: #94a3b8;">
                        Please direct all billing inquiries or chargeback dispute evidence to ${orgEmail || 'Accounts Payable'} within 5 business days of statement issuance.
                    </p>
                </div>

                ${photosGalleryHtml}
            </div>
        </body>
        </html>
    `;
}
