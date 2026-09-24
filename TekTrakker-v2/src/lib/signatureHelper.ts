import type { User } from '../types/user';

export interface SignatureOptions {
    customName?: string;
    customTitle?: string;
    customPhone?: string;
    customEmail?: string;
    customWebsite?: string;
    customLicense?: string;
    customBadge?: string;
    customTagline?: string;
    customSubtitle?: string;
    customLogoUrl?: string;
    accentColor?: string;
    primaryColor?: string;
}

/**
 * Generates an email-compliant, multi-column branded HTML signature based on
 * the logged-in user and active organization with zero hardcoded company leakage.
 */
export const generateUserEmailSignatureHtml = (
    user?: Partial<User> | null,
    org?: any | null,
    options?: SignatureOptions
): string => {
    const orgName = org?.name || 'Service Provider';

    // 1. Resolve User Identity
    let fullName = options?.customName || '';
    if (!fullName && user) {
        fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.username || '';
    }
    if (!fullName) {
        fullName = 'Team Member';
    }

    // 2. Resolve Title & Role
    let title = options?.customTitle || user?.title || '';
    if (!title && user?.role) {
        if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'Administrator') {
            title = 'Operations & Administration';
        } else if (user.role === 'both') {
            title = 'Operations Lead & Field Specialist';
        } else {
            title = String(user.role);
        }
    }
    if (!title) {
        title = 'Service Specialist';
    }

    // 3. Resolve Subtitle / Industry Services
    let servicesSubtitle = options?.customSubtitle || '';
    if (!servicesSubtitle && org?.industry) {
        const industry = String(org.industry).trim();
        servicesSubtitle = `Commercial & Residential ${industry} Services`;
    }

    // 4. Resolve Contact Information
    const phone = options?.customPhone || user?.phone || org?.phone || '';
    const email = options?.customEmail || user?.email || org?.email || '';
    const website = options?.customWebsite || org?.website || '';
    const webHref = website ? (website.startsWith('http://') || website.startsWith('https://') ? website : `https://${website}`) : '';
    const webDisplay = website ? website.replace(/^https?:\/\//i, '').replace(/\/$/, '') : '';

    // 5. Resolve Regulatory & License Details (Tenant-Specific)
    let licenseNumber = options?.customLicense || org?.licenseNumber || '';
    if (!licenseNumber && org?.complianceFooter) {
        const match = org.complianceFooter.match(/([A-Z]{2,6}[0-9A-Z-]+)/i) || org.complianceFooter.match(/License\s*#?:?\s*([A-Z0-9-]+)/i);
        if (match) {
            licenseNumber = match[0];
        }
    }

    const statePrefix = (typeof org?.address === 'object' && org?.address?.state) ? org.address.state : (org?.state || '');
    const industryPrefix = org?.industry || '';
    const licenseText = licenseNumber 
        ? `${statePrefix ? `${statePrefix} ` : ''}${industryPrefix ? `${industryPrefix} ` : ''}Contractor <strong style="color: #334155;">${licenseNumber}</strong>` 
        : '';

    // 6. Business Classification & Badges (Tenant-Specific)
    let businessBadge = options?.customBadge || '';
    if (!businessBadge && org?.cageCode) {
        businessBadge = `CAGE Code: ${org.cageCode} • Certified Business`;
    }

    // 7. Value Proposition / Tagline
    let tagline = options?.customTagline || '';
    if (!tagline && (org?.industry || licenseNumber)) {
        tagline = 'Licensed & Insured • Residential & Commercial • Professional Service';
    }

    // 8. Colors & Logo URL
    const primaryNavy = '#1e3a8a';
    const slateDark = '#334155';
    const slateLight = '#64748b';
    const brandPrimary = options?.primaryColor || org?.primaryColor || '#0284c7';
    const accentDivider = options?.accentColor || org?.primaryColor || '#c26127';

    const logoUrl = options?.customLogoUrl || org?.logoUrl || org?.letterheadDataUrl || '';
    const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${orgName}" style="height: 60px; max-width: 180px; object-fit: contain; display: block;" />`
        : `<div style="font-size: 20px; font-weight: 900; color: ${brandPrimary}; letter-spacing: -0.5px;">${orgName}</div>`;

    // 9. Build Pure Inline-CSS Email Table (Rock-solid across Outlook, Gmail, Apple Mail, Yahoo)
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.4; color: ${slateDark}; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <!-- Left: Organization Logo / Name -->
      <td valign="middle" style="padding-right: 20px; vertical-align: middle;">
        ${logoHtml}
      </td>
      <!-- Middle: Brand Divider -->
      <td valign="middle" style="border-left: 3px solid ${accentDivider}; width: 1px; padding-left: 20px; vertical-align: middle;">
      </td>
      <!-- Right: User & Corporate Details -->
      <td valign="top" style="vertical-align: top;">
        <!-- Full Name -->
        <div style="font-size: 18px; font-weight: 800; color: ${primaryNavy}; line-height: 1.2; margin: 0 0 2px 0;">
          ${fullName}
        </div>
        <!-- Title / Role -->
        <div style="font-size: 13px; font-weight: 700; color: ${slateDark}; margin: 0 0 2px 0;">
          ${title}
        </div>
        <!-- Services Subtitle -->
        ${servicesSubtitle ? `<div style="font-size: 12px; color: ${slateLight}; margin: 0 0 8px 0;">${servicesSubtitle}</div>` : '<div style="margin-bottom: 6px;"></div>'}
        
        <!-- Contact Rows -->
        ${(phone || email || website) ? `
        <table cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; line-height: 1.5; color: ${slateDark};">
          ${phone ? `
          <tr>
            <td style="padding: 0; padding-right: 6px; font-weight: 800; color: ${primaryNavy}; width: 16px;">P:</td>
            <td style="padding: 0;"><span style="color: ${slateDark};">${phone}</span></td>
          </tr>` : ''}
          ${email ? `
          <tr>
            <td style="padding: 0; padding-right: 6px; font-weight: 800; color: ${primaryNavy}; width: 16px;">E:</td>
            <td style="padding: 0;"><a href="mailto:${email}" style="color: ${slateDark}; text-decoration: none;">${email}</a></td>
          </tr>` : ''}
          ${website ? `
          <tr>
            <td style="padding: 0; padding-right: 6px; font-weight: 800; color: ${primaryNavy}; width: 16px;">W:</td>
            <td style="padding: 0;"><a href="${webHref}" target="_blank" style="color: ${accentDivider}; font-weight: 700; text-decoration: none;">${webDisplay}</a></td>
          </tr>` : ''}
        </table>` : ''}

        <!-- Licensing & Compliance Info -->
        ${(licenseText || businessBadge) ? `
        <div style="margin-top: 8px; font-size: 11px; color: ${slateLight}; line-height: 1.4;">
          ${licenseText ? `<div>${licenseText}</div>` : ''}
          ${businessBadge ? `<div>${businessBadge}</div>` : ''}
        </div>` : ''}

        <!-- Bottom Tagline -->
        ${tagline ? `
        <div style="margin-top: 6px; font-size: 11px; font-weight: 700; color: ${primaryNavy}; line-height: 1.3;">
          ${tagline}
        </div>` : ''}
      </td>
    </tr>
  </table>
</div>
`.trim();
};
