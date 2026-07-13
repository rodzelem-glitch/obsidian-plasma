import { db } from './firebase';
import type { Organization } from 'types';

/**
 * Builds a structured AI context document from an organization's settings
 * and persists it to Firestore. This document is read by all AI functions
 * to provide org-specific context without leaking into other tenants.
 * 
 * Called automatically on Settings save.
 */
export function buildOrgAIContext(org: Organization): string {
    const lines: string[] = [
        `=== ORGANIZATION IDENTITY ===`,
        `Company Name: ${org.name || 'Unknown'}`,
        `Industry: ${org.industry || 'General'}`,
        org.supportedTrades?.length ? `Supported Trades: ${org.supportedTrades.join(', ')}` : '',
        `Phone: ${org.phone || 'N/A'}`,
        `Email: ${org.email || 'N/A'}`,
        org.website ? `Website: ${org.website}` : '',
        org.licenseNumber ? `License #: ${org.licenseNumber}` : '',
        '',
        `=== LOCATION ===`,
        org.address ? `Address: ${org.address.street}, ${org.address.city}, ${org.address.state} ${org.address.zip}` : 'Address: Not configured',
        '',
        `=== BRANDING ASSETS ===`,
        org.logoUrl && !org.logoUrl.startsWith('data:')
            ? `Logo URL (use this exact URL in <img> tags): ${org.logoUrl}`
            : org.logoUrl?.startsWith('data:')
                ? `Logo: Stored as base64 — do NOT embed. Use styled text header instead.`
                : `Logo: Not uploaded — use clean CSS text header.`,
        org.primaryColor ? `Brand Color: ${org.primaryColor}` : '',
        org.letterheadDataUrl ? `Letterhead Image URL: ${org.letterheadDataUrl}` : '',
        org.footerImage ? `Footer Image URL: ${org.footerImage}` : '',
        org.financingLink ? `Financing Link: ${org.financingLink}` : '',
        '',
        `=== LEGAL & COMPLIANCE ===`,
        org.termsAndConditions ? `Terms & Conditions: ${org.termsAndConditions.substring(0, 500)}` : '',
        org.proposalDisclaimer ? `Proposal Disclaimer: ${org.proposalDisclaimer.substring(0, 300)}` : '',
        org.invoiceTerms ? `Invoice Terms: ${org.invoiceTerms.substring(0, 300)}` : '',
        org.complianceFooter ? `Compliance Footer: ${org.complianceFooter}` : '',
        org.membershipTerms ? `Membership Terms: ${org.membershipTerms.substring(0, 300)}` : '',
        '',
        `=== BUSINESS CONFIG ===`,
        org.taxRate ? `Tax Rate: ${org.taxRate}%` : '',
        org.marketMultiplier ? `Market Multiplier: ${org.marketMultiplier}x` : '',
        org.plan ? `Subscription Plan: ${org.plan}` : '',
        '',
        `=== SOCIAL PRESENCE ===`,
        ...(org.socialLinks ? Object.entries(org.socialLinks).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`) : []),
        '',
        `=== REVIEW LINKS ===`,
        ...(org.reviewLinks ? Object.entries(org.reviewLinks).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`) : []),
    ];

    return lines.filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Persists the AI context document to Firestore under the org's subcollection.
 * Called from Settings.tsx after a successful save.
 */
export async function syncOrgAIContext(org: Organization): Promise<void> {
    if (!org?.id) return;
    const contextText = buildOrgAIContext(org);
    await db.collection('organizations').doc(org.id).collection('ai_context').doc('profile').set({
        context: contextText,
        updatedAt: new Date().toISOString(),
        orgId: org.id,
        orgName: org.name
    }, { merge: true });
}
