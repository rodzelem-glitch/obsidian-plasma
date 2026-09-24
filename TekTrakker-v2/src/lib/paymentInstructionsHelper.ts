import type { Organization } from '../types';
import { formatFullAddress } from './utils';

export interface PaymentInstructionDetail {
    type: 'check' | 'wire' | 'ach';
    name: string;
    accepted: boolean;
    instructions: string;
    defaultInstructions: string;
    effectiveInstructions: string;
    badgeLabel: string;
}

export interface OrgPaymentInstructionsResult {
    hasAnyAccepted: boolean;
    acceptedCount: number;
    check: PaymentInstructionDetail;
    wire: PaymentInstructionDetail;
    ach: PaymentInstructionDetail;
    allMethods: PaymentInstructionDetail[];
    acceptedMethods: PaymentInstructionDetail[];
}

/**
 * Resolves the payment instructions configuration for an organization.
 */
export const getOrgPaymentInstructions = (org?: Organization | null): OrgPaymentInstructionsResult => {
    const orgName = org?.name || 'Company';
    const orgEmail = org?.email || '';
    const orgAddress = org?.address ? formatFullAddress(org.address, org.address.city, org.address.state, org.address.zip) : '';

    const defaultCheck = `Make checks payable to: ${orgName}${orgAddress ? `\nMailing Address: ${orgAddress}` : ''}\nMemo: Please include Invoice # / Customer Name on check memo line.`;
    const defaultWire = `Bank Name: Bank of America / Commercial Banking\nAccount Name: ${orgName}\nRouting Number (Wire): Contact billing for routing #\nAccount Number: Contact billing for account #\nReference: Please include Invoice # in wire remittance notes.`;
    const defaultAch = `Bank Name: Commercial Bank\nAccount Name: ${orgName}\nAccount Type: Business Checking\nRemittance: Please email remittance advice to ${orgEmail || 'our billing department'}.`;

    // Checks default to accepted if undefined, Wire and ACH default to configured state
    const acceptCheck = org?.acceptCheck !== false;
    const acceptWire = !!org?.acceptWire;
    const acceptAch = !!org?.acceptAch;

    const checkInstructions = org?.checkInstructions?.trim() || '';
    const wireInstructions = org?.wireInstructions?.trim() || '';
    const achInstructions = org?.achInstructions?.trim() || '';

    const checkDetail: PaymentInstructionDetail = {
        type: 'check',
        name: 'Physical Check',
        accepted: acceptCheck,
        instructions: checkInstructions,
        defaultInstructions: defaultCheck,
        effectiveInstructions: checkInstructions || defaultCheck,
        badgeLabel: 'Check'
    };

    const wireDetail: PaymentInstructionDetail = {
        type: 'wire',
        name: 'Wire Transfer',
        accepted: acceptWire,
        instructions: wireInstructions,
        defaultInstructions: defaultWire,
        effectiveInstructions: wireInstructions || defaultWire,
        badgeLabel: 'Wire Transfer'
    };

    const achDetail: PaymentInstructionDetail = {
        type: 'ach',
        name: 'ACH / Direct Deposit',
        accepted: acceptAch,
        instructions: achInstructions,
        defaultInstructions: defaultAch,
        effectiveInstructions: achInstructions || defaultAch,
        badgeLabel: 'ACH / Direct Bank'
    };

    const allMethods = [checkDetail, wireDetail, achDetail];
    const acceptedMethods = allMethods.filter(m => m.accepted);

    return {
        hasAnyAccepted: acceptedMethods.length > 0,
        acceptedCount: acceptedMethods.length,
        check: checkDetail,
        wire: wireDetail,
        ach: achDetail,
        allMethods,
        acceptedMethods
    };
};

/**
 * Formats payment instructions as clean plain text for email body or plain text notes.
 */
export const formatPaymentInstructionsText = (org?: Organization | null): string => {
    const config = getOrgPaymentInstructions(org);
    if (!config.hasAnyAccepted) return '';

    const parts: string[] = ['--- PAYMENT & REMITTANCE INSTRUCTIONS ---'];

    if (config.check.accepted) {
        parts.push(`\n[CHECK PAYMENT]\n${config.check.effectiveInstructions}`);
    }
    if (config.wire.accepted) {
        parts.push(`\n[WIRE TRANSFER]\n${config.wire.effectiveInstructions}`);
    }
    if (config.ach.accepted) {
        parts.push(`\n[ACH / DIRECT DEPOSIT]\n${config.ach.effectiveInstructions}`);
    }

    return parts.join('\n');
};

/**
 * Formats payment instructions as HTML for Statement of Account and email templates.
 */
export const formatPaymentInstructionsHtml = (org?: Organization | null, options?: { isPrint?: boolean }): string => {
    const config = getOrgPaymentInstructions(org);
    if (!config.hasAnyAccepted) return '';

    const isPrint = options?.isPrint;
    const boxBg = isPrint ? '#f8fafc' : '#f8fafc';
    const borderColor = '#cbd5e1';

    let contentHtml = '';

    if (config.check.accepted) {
        contentHtml += `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: 700; color: #123A63; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">• Check Payment Instructions:</div>
                <div style="color: #334155; font-size: 10px; white-space: pre-wrap; line-height: 1.4; padding-left: 8px;">${config.check.effectiveInstructions.replace(/\n/g, '<br/>')}</div>
            </div>
        `;
    }

    if (config.wire.accepted) {
        contentHtml += `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: 700; color: #123A63; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">• Wire Transfer Instructions:</div>
                <div style="color: #334155; font-size: 10px; white-space: pre-wrap; line-height: 1.4; padding-left: 8px;">${config.wire.effectiveInstructions.replace(/\n/g, '<br/>')}</div>
            </div>
        `;
    }

    if (config.ach.accepted) {
        contentHtml += `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: 700; color: #123A63; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">• ACH / Direct Deposit Instructions:</div>
                <div style="color: #334155; font-size: 10px; white-space: pre-wrap; line-height: 1.4; padding-left: 8px;">${config.ach.effectiveInstructions.replace(/\n/g, '<br/>')}</div>
            </div>
        `;
    }

    return `
        <div style="background-color: ${boxBg}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 10px 12px; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
            <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
                Direct Remittance &amp; Payment Instructions (Check / Wire / ACH)
            </div>
            ${contentHtml}
        </div>
    `;
};
