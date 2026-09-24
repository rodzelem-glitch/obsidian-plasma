
import { Address } from '../types/organization';

// Simple image compression utility using canvas
export const compressFile = (file: File, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const isImage = file.type.startsWith('image/');
        // For non-image files, just read as Base64 without compression
        if (!isImage) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize logic: Max 1024px dimension
                const MAX_DIM = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx?.drawImage(img, 0, 0, width, height);

                // Get the data-URL with the specified quality
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const formatAddress = (address: any, city?: string | null, state?: string | null, zip?: string | null): string => {
    return formatFullAddress(address, city, state, zip);
};

export const formatFlatAddress = (loc: any): string => {
    if (!loc) return '';
    return formatFullAddress(loc, loc?.city, loc?.state, loc?.zip);
};

export const getBaseUrl = (): string => {
    if (typeof window === 'undefined') return 'https://tektrakker.web.app';
    const { hostname, protocol, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'capacitor:') {
        return 'https://tektrakker.web.app';
    }
    return origin && origin !== 'null' ? origin : 'https://tektrakker.web.app';
};

/**
 * Creates an email-client-safe, responsive HTML Action Button table that renders consistently
 * across Gmail, Outlook, Apple Mail, Yahoo, Thunderbird, and mobile clients.
 */
export const createEmailButtonHtml = (label: string, url: string, bgColor: string = '#2563eb', textColor: string = '#ffffff'): string => {
    return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0; border-collapse: separate;">
  <tr>
    <td align="center" bgcolor="${bgColor}" style="border-radius: 8px; background-color: ${bgColor}; padding: 0;">
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: ${textColor}; text-decoration: none; display: inline-block; padding: 14px 28px; border-radius: 8px; border: 1px solid ${bgColor}; background-color: ${bgColor}; letter-spacing: 0.02em;">
        ${label}
      </a>
    </td>
  </tr>
</table>
<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #64748b; margin-top: 10px; margin-bottom: 0;">
  Direct Link: <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: ${bgColor}; text-decoration: underline; word-break: break-all;">${url}</a>
</p>
    `.trim();
};

/**
 * Automatically wraps raw plaintext URLs with clickable <a> HTML tags.
 * Ignores URLs that are already part of an href attribute or anchor tag.
 */
export const autoLinkifyText = (text: string): string => {
    if (!text) return '';
    // Replace URLs not already preceded by href=" or href='
    const urlPattern = /(?<!href=["'])(https?:\/\/[^\s<]+)/gi;
    return text.replace(urlPattern, (match) => {
        return `<a href="${match}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${match}</a>`;
    });
};

/**
 * Helper to build the canonical standalone payment / deposit URL.
 */
export const getPaymentRequestUrl = (paymentRequestId: string): string => {
    return `${getBaseUrl()}/#/pay/${paymentRequestId}`;
};

export const hasPermission = (user: any | null | undefined, permissionId: string): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const userType = String(user.userType || user.user_type || user.type || '').toLowerCase();
  if (role === 'master_admin' || userType === 'master_admin') return true;
  
  // If the user's role is not admin, supervisor, or both (superuser), they don't have access to admin sections anyway
  const adminRoles = ['admin', 'both', 'supervisor', 'superuser', 'administrator', 'franchise_admin'];
  if (!adminRoles.includes(role) && !adminRoles.includes(userType)) return false;
  
  // Backward compatibility: if permissions array is not set, allow access by default for admin roles
  if (!user.permissions) return true;
  
  return user.permissions.includes(permissionId);
};

export const getPaymentTermsDays = (terms: string | undefined | null): number => {
    if (!terms) return 30; // default to 30 days as fallback
    if (terms === 'due_on_receipt') return 0;
    if (terms.startsWith('net_')) {
        const days = parseInt(terms.replace('net_', ''), 10);
        return isNaN(days) ? 30 : days;
    }
    const parsed = parseInt(terms, 10);
    return isNaN(parsed) ? 30 : parsed;
};

export const getPaymentTermsLabel = (terms: string | undefined | null): string => {
    if (!terms) return 'Default (Net 30)';
    if (terms === 'due_on_receipt') return 'Due on Receipt';
    if (terms.startsWith('net_')) {
        const days = terms.replace('net_', '');
        return `Net ${days}`;
    }
    const parsed = parseInt(terms, 10);
    if (!isNaN(parsed)) {
        return parsed === 0 ? 'Due on Receipt' : `Net ${parsed}`;
    }
    return terms; // fallback for custom text
};

export const matchTier = (itemTier: string | undefined | null, targetTier: string | undefined | null): boolean => {
    if (!itemTier && !targetTier) return true;
    if (!targetTier) return false;
    if (!itemTier) {
        const tt = targetTier.toLowerCase().trim();
        return tt === 'basic' || tt === 'good' || tt === 'option 1' || tt === 'opt-1' || tt === 'opt 1' || tt === 'option1';
    }
    const it = itemTier.toLowerCase().trim();
    const tt = targetTier.toLowerCase().trim();
    if (it === tt) return true;

    const normalizeTier = (t: string): string => {
        const clean = t.replace(/[\s\-_]+/g, '').toLowerCase();
        if (clean === 'good' || clean === 'basic' || clean === 'opt1' || clean === 'option1' || clean === '1') return '1';
        if (clean === 'better' || clean === 'premium' || clean === 'opt2' || clean === 'option2' || clean === '2') return '2';
        if (clean === 'best' || clean === 'platinum' || clean === 'opt3' || clean === 'option3' || clean === '3') return '3';
        return clean;
    };

    return normalizeTier(it) === normalizeTier(tt);
};

export const displayTierName = (tier: string | undefined | null): string => {
    if (!tier) return 'Basic';
    const clean = tier.replace(/[\s\-_]+/g, '').toLowerCase();
    if (clean === 'good') return 'Good';
    if (clean === 'better') return 'Better';
    if (clean === 'best') return 'Best';
    if (clean === 'basic') return 'Basic';
    if (clean === 'premium') return 'Premium';
    if (clean === 'platinum') return 'Platinum';
    if (clean === 'opt1' || clean === 'option1' || clean === '1') return 'Option 1';
    if (clean === 'opt2' || clean === 'option2' || clean === '2') return 'Option 2';
    if (clean === 'opt3' || clean === 'option3' || clean === '3') return 'Option 3';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
};

export const getAvailableProposalTiers = (proposal: any): string[] => {
    if (!proposal) return [];

    // 1. If proposal has explicit options array with items/names
    if (Array.isArray(proposal.options) && proposal.options.length > 0) {
        const optionNames = proposal.options.map((o: any) => o.name || o.title || o.tier).filter(Boolean);
        if (optionNames.length > 0) {
            const unique: string[] = [];
            for (const name of optionNames) {
                if (!unique.some(u => matchTier(u, name))) {
                    unique.push(name);
                }
            }
            if (unique.length > 0) return unique;
        }
    }

    // 2. If proposal has explicit tiers array
    if (Array.isArray(proposal.tiers) && proposal.tiers.length > 0) {
        const tierNames = proposal.tiers.map((t: any) => typeof t === 'string' ? t : (t.name || t.tier)).filter(Boolean);
        if (tierNames.length > 0) {
            const unique: string[] = [];
            for (const name of tierNames) {
                if (!unique.some(u => matchTier(u, name))) {
                    unique.push(name);
                }
            }
            if (unique.length > 0) return unique;
        }
    }

    // 3. Inspect items in proposal
    const items = proposal.items || proposal.equipmentList || proposal.lineItems || [];
    const rawDistinctItemTiers = Array.from(new Set(items.map((i: any) => i.tier).filter(Boolean))) as string[];

    if (rawDistinctItemTiers.length === 0) {
        return items.length > 0 ? ['Good'] : [];
    }

    const hasExplicitOption = rawDistinctItemTiers.some((t: string) => {
        const l = t.toLowerCase();
        return l.includes('option') || l.startsWith('opt');
    });
    const hasGBB = rawDistinctItemTiers.some((t: string) => {
        const l = t.toLowerCase();
        return l === 'good' || l === 'better' || l === 'best';
    });
    const hasBasic = rawDistinctItemTiers.some((t: string) => {
        const l = t.toLowerCase();
        return l === 'basic' || l === 'premium' || l === 'platinum';
    });

    const tierOrder = hasExplicitOption 
        ? ['Option 1', 'Option 2', 'Option 3']
        : (hasGBB ? ['Good', 'Better', 'Best'] : (hasBasic ? ['Basic', 'Premium', 'Platinum'] : ['Good', 'Better', 'Best']));

    const tiersFound: string[] = [];
    for (const t of tierOrder) {
        const hasMatchingItems = items.some((i: any) => matchTier(i.tier, t));
        if (hasMatchingItems) {
            tiersFound.push(t);
        }
    }

    for (const customTier of rawDistinctItemTiers) {
        if (!tierOrder.some(t => matchTier(t, customTier)) && !tiersFound.includes(customTier)) {
            tiersFound.push(customTier);
        }
    }

    return tiersFound;
};

export const getProposalTierLabel = (proposal: any, tierName: string | undefined | null): string => {
    if (!tierName) return 'Standard';

    if (Array.isArray(proposal?.options) && proposal.options.length > 0) {
        const opt = proposal.options.find((o: any) => matchTier(o.name || o.title || o.tier, tierName));
        if (opt?.name) return opt.name;
        if (opt?.title) return opt.title;
    }

    if (Array.isArray(proposal?.tiers) && proposal.tiers.length > 0) {
        const tFound = proposal.tiers.find((t: any) => matchTier(typeof t === 'string' ? t : (t.name || t.tier), tierName));
        if (tFound) {
            return typeof tFound === 'string' ? tFound : (tFound.name || tFound.tier || tierName);
        }
    }

    const rawDistinctItemTiers = Array.from(new Set((proposal?.items || proposal?.equipmentList || proposal?.lineItems || []).map((i: any) => i.tier).filter(Boolean))) as string[];
    const hasExplicitOption = rawDistinctItemTiers.some((t: string) => {
        const l = t.toLowerCase();
        return l.includes('option') || l.startsWith('opt');
    });
    const hasGBB = rawDistinctItemTiers.some((t: string) => {
        const l = t.toLowerCase();
        return l === 'good' || l === 'better' || l === 'best';
    });

    const lower = tierName.toLowerCase().trim();
    if (hasExplicitOption) {
        if (matchTier(lower, 'Option 1')) return 'Option 1';
        if (matchTier(lower, 'Option 2')) return 'Option 2';
        if (matchTier(lower, 'Option 3')) return 'Option 3';
    }
    if (hasGBB) {
        if (matchTier(lower, 'Good')) return 'Good';
        if (matchTier(lower, 'Better')) return 'Better';
        if (matchTier(lower, 'Best')) return 'Best';
    }

    return displayTierName(tierName);
};

export const cleanUndefinedFields = <T>(obj: T, seen = new WeakSet()): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj as object)) return obj;

    // Do not recurse into Date instances, Firestore Timestamps, FieldValues, DocumentReferences, etc.
    if (
        obj instanceof Date ||
        ('seconds' in obj && 'nanoseconds' in obj) ||
        ('_methodName' in obj) ||
        ('_delegate' in obj) ||
        (typeof (obj as any)?.isEqual === 'function' && typeof (obj as any)?.toMillis !== 'function') ||
        ((obj as any)?.constructor?.name === 'FieldValue') ||
        ('firestore' in obj) ||
        ('converter' in obj) ||
        ('path' in obj && 'id' in obj && typeof (obj as any).get === 'function')
    ) {
        return obj;
    }

    seen.add(obj as object);

    if (Array.isArray(obj)) {
        return obj
            .filter(item => item !== undefined)
            .map(item => typeof item === 'object' && item !== null ? cleanUndefinedFields(item, seen) : item) as unknown as T;
    }

    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj as Record<string, any>)) {
        const value = (obj as Record<string, any>)[key];
        if (value !== undefined) {
            cleaned[key] = typeof value === 'object' && value !== null
                ? cleanUndefinedFields(value, seen)
                : value;
        }
    }
    return cleaned as T;
};

export const isPaymentProcessingFeeItem = (item: any): boolean => {
    if (!item) return false;
    const nameStr = (item.name || item.description || '').toLowerCase().trim();
    if (
        nameStr === 'credit card processing fee' ||
        nameStr === 'ach bank transfer fee' ||
        nameStr === 'payment processing fee' ||
        nameStr === 'card processing fee' ||
        nameStr.includes('processing fee') ||
        nameStr.includes('bank transfer fee')
    ) {
        return true;
    }
    if (item.type === 'Fee' && typeof item.id === 'string' && (item.id.startsWith('fee-') || item.id.startsWith('payment-fee-'))) {
        if (nameStr.includes('fee') && (nameStr.includes('processing') || nameStr.includes('card') || nameStr.includes('ach') || nameStr.includes('payment'))) {
            return true;
        }
    }
    return false;
};

export const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
};

export const formatPhoneNumberInput = (val: string): string => {
    if (!val) return '';
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

export const parseAddressComponents = (fullAddress: string | undefined | null): { street: string; city: string; state: string; zip: string } => {
    if (!fullAddress) return { street: '', city: '', state: '', zip: '' };

    const parts = fullAddress.split(',').map(p => p.trim());
    if (parts.length >= 3) {
        const street = parts[0];
        const city = parts[1];
        const stateZipPart = parts.slice(2).join(' ');
        const stateZipMatch = stateZipPart.match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?/);
        const state = stateZipMatch ? stateZipMatch[1].toUpperCase() : stateZipPart;
        const zip = stateZipMatch && stateZipMatch[2] ? stateZipMatch[2] : '';

        return { street, city, state, zip };
    }

    const match = fullAddress.match(/^(.*?)(?:,\s*|\s+)([A-Za-z\s]+),\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    if (match) {
        return {
            street: match[1]?.trim() || fullAddress,
            city: match[2]?.trim() || '',
            state: match[3]?.trim().toUpperCase() || '',
            zip: match[4]?.trim() || ''
        };
    }

    return { street: fullAddress, city: '', state: '', zip: '' };
};

export const formatDisplayId = (id: string | null | undefined): string => {
    if (!id) return '';
    if (id.length <= 16) return id;
    return id.slice(0, 12);
};

export const openDocumentUrl = (url: string) => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }
    if (url.startsWith('data:')) {
        try {
            const parts = url.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
            const binaryStr = atob(parts[1]);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            const win = window.open(blobUrl, '_blank');
            if (!win) {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.target = '_blank';
                link.click();
            }
        } catch (e) {
            console.error("Error opening data URL blob:", e);
            const win = window.open();
            if (win) {
                if (url.startsWith('data:image/')) {
                    win.document.write(`<body style="margin:0;display:flex;justify-content:center;align-items:center;background:#111;height:100vh;"><img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                } else {
                    win.document.write(`<body style="margin:0;height:100vh;"><iframe src="${url}" style="width:100vw;height:100vh;border:none;"></iframe></body>`);
                }
            }
        }
    }
};

export const safeParseDate = (dateStr: string | number | Date | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    
    let str = String(dateStr).trim();
    if (!str) return null;

    if (!str.includes('T') && str.includes('-') && !str.includes(' ')) {
        str = `${str}T12:00:00`;
    } else if (str.endsWith('T00:00:00.000Z')) {
        str = str.replace('T00:00:00.000Z', 'T12:00:00');
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
};

export const safeFormatTimeString = (dateStr: string | number | Date | null | undefined, options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }): string => {
    if (!dateStr) return '';
    const d = safeParseDate(dateStr);
    if (!d) return String(dateStr);
    try {
        return d.toLocaleTimeString([], options);
    } catch {
        return String(dateStr);
    }
};

export const safeFormatDateString = (dateStr: string | number | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
    if (!dateStr) return '';
    const d = safeParseDate(dateStr);
    if (!d) return String(dateStr);
    try {
        return d.toLocaleDateString([], options);
    } catch {
        return String(dateStr);
    }
};

export const safeFormatDateTimeString = (dateStr: string | number | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
    if (!dateStr) return '';
    const d = safeParseDate(dateStr);
    if (!d) return String(dateStr);
    try {
        return d.toLocaleString([], options);
    } catch {
        return String(dateStr);
    }
};

export const getOrGenerateAccountNumber = (customer?: any): string => {
    if (!customer) return '';
    if (customer.accountNumber && String(customer.accountNumber).trim()) {
        return String(customer.accountNumber).trim();
    }
    const id = customer.id || '';
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanId) {
        const suffix = cleanId.length >= 5 ? cleanId.slice(-5) : cleanId.padStart(5, '0');
        return `ACT-${suffix}`;
    }
    const nameSeed = (customer.name || 'CUST').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3);
    return `ACT-${nameSeed}01`;
};

export const formatFullAddress = (
    addrObjOrStr?: any, 
    fallbackCity?: string | null, 
    fallbackState?: string | null, 
    fallbackZip?: string | null
): string => {
    if (!addrObjOrStr && !fallbackCity && !fallbackState && !fallbackZip) return '';

    let street = '';
    let city = (fallbackCity || '').trim();
    let state = (fallbackState || '').trim();
    let zip = (fallbackZip || '').trim();

    if (typeof addrObjOrStr === 'string') {
        const raw = addrObjOrStr.replace(/,\s*undefined/g, '').replace(/undefined/g, '').trim();
        street = (raw === 'undefined' || raw === 'N/A') ? '' : raw;
    } else if (addrObjOrStr && typeof addrObjOrStr === 'object') {
        const objStreet = addrObjOrStr.street || addrObjOrStr.street1 || addrObjOrStr.line1 || (typeof addrObjOrStr.address === 'string' ? addrObjOrStr.address : '');
        street = (objStreet && objStreet !== 'undefined' && objStreet !== 'N/A') ? String(objStreet).trim() : '';
        if (addrObjOrStr.city && addrObjOrStr.city !== 'undefined' && addrObjOrStr.city !== 'N/A') city = String(addrObjOrStr.city).trim();
        if (addrObjOrStr.state && addrObjOrStr.state !== 'undefined' && addrObjOrStr.state !== 'N/A') state = String(addrObjOrStr.state).trim();
        const objZip = addrObjOrStr.zip || addrObjOrStr.zipCode || addrObjOrStr.postalCode;
        if (objZip && objZip !== 'undefined' && objZip !== 'N/A') zip = String(objZip).trim();
    }

    // If there is no street address, return empty string so cascading fallback address is used
    if (!street) {
        return '';
    }

    // If the street string itself already contains a 5-digit zip code (e.g. "9727 Poteet Jourdanton Freeway, San Antonio , TX, 78211"), it is already a complete address
    if (/\b\d{5}(-\d{4})?\b/.test(street)) {
        return street.replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').trim();
    }

    if (city === 'undefined' || city === 'N/A') city = '';
    if (state === 'undefined' || state === 'N/A') state = '';
    if (zip === 'undefined' || zip === 'N/A') zip = '';

    const streetLower = street.toLowerCase();
    const cityInStreet = city && streetLower.includes(city.toLowerCase());
    const stateInStreet = state && (streetLower.includes(state.toLowerCase()) || streetLower.includes(` ${state.toLowerCase()} `) || streetLower.endsWith(` ${state.toLowerCase()}`));
    const zipInStreet = zip && streetLower.includes(zip.toLowerCase());

    const parts: string[] = [];
    if (street) parts.push(street);
    if (city && !cityInStreet) parts.push(city);

    let stateZip = '';
    if (state && !stateInStreet) stateZip += state;
    if (zip && !zipInStreet) stateZip += (stateZip ? ` ${zip}` : zip);
    if (stateZip) parts.push(stateZip);

    return parts.join(', ').replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').trim();
};

export interface SanitizedAddress {
    address: string;
    city: string;
    state: string;
    zip: string;
    fullAddress: string;
}

export const sanitizeAddressFields = (
    rawAddress?: any,
    rawCity?: string | null,
    rawState?: string | null,
    rawZip?: string | null
): SanitizedAddress => {
    let street = '';
    let city = (rawCity || '').trim();
    let state = (rawState || '').trim();
    let zip = (rawZip || '').trim();

    if (rawAddress && typeof rawAddress === 'object') {
        const objStreet = rawAddress.street || rawAddress.street1 || rawAddress.line1 || (typeof rawAddress.address === 'string' ? rawAddress.address : '');
        street = (objStreet && objStreet !== 'undefined' && objStreet !== 'N/A') ? String(objStreet).trim() : '';
        if (rawAddress.city && rawAddress.city !== 'undefined' && rawAddress.city !== 'N/A') city = String(rawAddress.city).trim();
        if (rawAddress.state && rawAddress.state !== 'undefined' && rawAddress.state !== 'N/A') state = String(rawAddress.state).trim();
        const objZip = rawAddress.zip || rawAddress.zipCode || rawAddress.postalCode;
        if (objZip && objZip !== 'undefined' && objZip !== 'N/A') zip = String(objZip).trim();
    } else if (typeof rawAddress === 'string') {
        const raw = rawAddress.replace(/,\s*undefined/g, '').replace(/undefined/g, '').trim();
        street = (raw === 'undefined' || raw === 'N/A') ? '' : raw;
    }

    if (city === 'undefined' || city === 'N/A') city = '';
    if (state === 'undefined' || state === 'N/A') state = '';
    if (zip === 'undefined' || zip === 'N/A') zip = '';

    if (street) {
        // Match standard US address: "Street, City, ST 12345" or "Street, City, State 12345"
        const fullMatch = street.match(/^(.*?)[,\s]+([A-Za-z\s.]+?)[,\s]+([A-Za-z]{2})[,\s]+(\d{5}(?:-\d{4})?)$/);
        if (fullMatch) {
            const extractedStreet = fullMatch[1].trim();
            const extractedCity = fullMatch[2].trim();
            const extractedState = fullMatch[3].trim().toUpperCase();
            const extractedZip = fullMatch[4].trim();

            if (extractedStreet) street = extractedStreet;
            if (!city || city.toLowerCase() === extractedCity.toLowerCase()) city = extractedCity;
            if (!state || state.toLowerCase() === extractedState.toLowerCase()) state = extractedState;
            if (!zip || zip === extractedZip) zip = extractedZip;
        } else if (/\b\d{5}(-\d{4})?\b/.test(street)) {
            const zipMatch = street.match(/\b(\d{5}(?:-\d{4})?)\b/);
            if (zipMatch && !zip) {
                zip = zipMatch[1];
            }
        }
    }

    // Strip redundant trailing zip/state/city from street string
    if (street) {
        if (zip) {
            const zipRegex = new RegExp(`[,\\s]*${zip.replace('-', '\\-')}\\b`, 'i');
            street = street.replace(zipRegex, '').trim();
        }
        if (state) {
            const stateRegex = new RegExp(`[,\\s]+${state}\\b`, 'i');
            street = street.replace(stateRegex, '').trim();
        }
        if (city) {
            const cityRegex = new RegExp(`[,\\s]+${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            street = street.replace(cityRegex, '').trim();
        }
        street = street.replace(/,\s*$/, '').replace(/^,\s*/, '').trim();
    }

    if (state && state.length === 2) {
        state = state.toUpperCase();
    } else if (state) {
        const stateMap: Record<string, string> = {
            'texas': 'TX', 'california': 'CA', 'florida': 'FL', 'new york': 'NY', 'north carolina': 'NC',
            'illinois': 'IL', 'pennsylvania': 'PA', 'ohio': 'OH', 'georgia': 'GA', 'michigan': 'MI',
            'arizona': 'AZ', 'colorado': 'CO', 'washington': 'WA', 'tennessee': 'TN', 'virginia': 'VA'
        };
        const mapped = stateMap[state.toLowerCase()];
        if (mapped) state = mapped;
    }

    if (city) {
        city = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    const fullAddress = formatFullAddress(street, city, state, zip);

    return {
        address: street,
        city,
        state,
        zip,
        fullAddress
    };
};

export const sanitizeCustomer = <T extends any>(c: T): T => {
    if (!c || typeof c !== 'object') return c;
    const custAny = c as any;
    const sanitized = sanitizeAddressFields(custAny.address, custAny.city, custAny.state, custAny.zip);
    const isCommercial = custAny.customerType === 'Commercial' || custAny.customerType === 'Property Management';

    const sanitizedLocations = Array.isArray(custAny.serviceLocations)
        ? custAny.serviceLocations.map((loc: any) => {
            const fallbackCity = isCommercial ? (loc.city || '') : (loc.city || sanitized.city);
            const fallbackState = isCommercial ? (loc.state || '') : (loc.state || sanitized.state);
            const fallbackZip = isCommercial ? (loc.zip || '') : (loc.zip || sanitized.zip);

            const locClean = sanitizeAddressFields(loc.address, fallbackCity, fallbackState, fallbackZip);
            return {
                ...loc,
                address: locClean.address,
                city: locClean.city,
                state: locClean.state,
                zip: locClean.zip,
                propertyName: (loc.propertyName || loc.name || '').trim(),
                name: (loc.propertyName || loc.name || '').trim()
            };
        })
        : custAny.serviceLocations;

    return {
        ...c,
        address: sanitized.address,
        city: sanitized.city,
        state: sanitized.state,
        zip: sanitized.zip,
        serviceLocations: sanitizedLocations
    };
};

/**
 * Universal helper to resolve the exact service location entity from a job, proposal, or invoice.
 * Correctly matches locationId, locationName, or address against customer serviceLocations without false HQ fallbacks.
 */
export const resolveServiceLocation = (
    paramA: any,
    paramB?: any,
    serviceLocationsCollection?: any[]
): any => {
    if (!paramA && !paramB) return null;

    let customer: any = null;
    let jobOrProp: any = null;

    if (paramA && (paramA.serviceLocations || paramA.locations || paramA.customerType || Array.isArray(paramA.properties))) {
        customer = paramA;
        jobOrProp = paramB;
    } else if (paramB && (paramB.serviceLocations || paramB.locations || paramB.customerType || Array.isArray(paramB.properties))) {
        customer = paramB;
        jobOrProp = paramA;
    } else {
        jobOrProp = paramA;
        customer = paramB;
    }

    const enrichLocation = (loc: any) => {
        if (!loc || typeof loc !== 'object') return loc;
        const custCity = customer?.city || (jobOrProp as any)?.customerCity || (jobOrProp as any)?.city || '';
        const custState = customer?.state || (jobOrProp as any)?.customerState || (jobOrProp as any)?.state || '';
        const custZip = customer?.zip || (jobOrProp as any)?.customerZip || (jobOrProp as any)?.zip || '';
        const rawAddr = loc.address || loc.street || loc.fullAddress;
        const sanitized = sanitizeAddressFields(
            rawAddr,
            loc.city || custCity,
            loc.state || custState,
            loc.zip || custZip
        );
        return {
            ...loc,
            address: sanitized.address || rawAddr || '',
            city: sanitized.city || loc.city || custCity,
            state: sanitized.state || loc.state || custState,
            zip: sanitized.zip || loc.zip || custZip,
            propertyName: (loc.propertyName || loc.name || '').trim(),
            name: (loc.name || loc.propertyName || '').trim(),
            mall: (loc.mall || '').trim()
        };
    };

    const isCommercial = customer?.customerType === 'Commercial' || customer?.customerType === 'Property Management';
    const locs: any[] = [
        ...(customer?.serviceLocations || []),
        ...(customer?.locations || []),
        ...(Array.isArray(serviceLocationsCollection) ? serviceLocationsCollection : [])
    ];

    const uniqueLocs: any[] = [];
    const seenIds = new Set<string>();
    for (const l of locs) {
        if (l && typeof l === 'object') {
            const id = l.id || l.locationId || l.address;
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                uniqueLocs.push(l);
            }
        }
    }

    const locId = jobOrProp?.locationId || (jobOrProp as any)?.serviceLocationId || (jobOrProp as any)?.propertyId || (typeof jobOrProp === 'string' ? jobOrProp : null);
    if (locId) {
        const byId = uniqueLocs.find(l => l.id === locId || l.locationId === locId);
        if (byId) return enrichLocation(byId);
    }

    const targetLocName = (jobOrProp as any)?.serviceLocationName || (jobOrProp as any)?.locationName || (jobOrProp as any)?.siteName;
    if (targetLocName && typeof targetLocName === 'string') {
        const target = targetLocName.toLowerCase().trim();
        const byName = uniqueLocs.find(l => {
            const lName = (l.name || '').toLowerCase().trim();
            const pName = (l.propertyName || '').toLowerCase().trim();
            return (lName && (lName === target || target.includes(lName) || lName.includes(target))) ||
                   (pName && (pName === target || target.includes(pName) || pName.includes(target)));
        });
        if (byName) return enrichLocation(byName);
    }

    const targetAddress = (jobOrProp as any)?.serviceLocationAddress || (jobOrProp as any)?.locationAddress || jobOrProp?.address;
    if (targetAddress && typeof targetAddress === 'string') {
        const tAddr = targetAddress.toLowerCase().trim();
        const byAddr = uniqueLocs.find(l => {
            if (!l.address || typeof l.address !== 'string') return false;
            const lAddr = l.address.toLowerCase().trim();
            return tAddr === lAddr || tAddr.includes(lAddr) || lAddr.includes(tAddr);
        });
        if (byAddr) return enrichLocation(byAddr);
    }

    if (uniqueLocs.length === 1 && (isCommercial || uniqueLocs[0].address)) {
        return enrichLocation(uniqueLocs[0]);
    }

    if (jobOrProp && (jobOrProp.serviceLocationName || jobOrProp.locationName || jobOrProp.serviceLocationAddress || jobOrProp.address)) {
        return enrichLocation({
            name: jobOrProp.serviceLocationName || jobOrProp.locationName || jobOrProp.siteName || '',
            propertyName: jobOrProp.serviceLocationName || jobOrProp.locationName || jobOrProp.siteName || '',
            address: jobOrProp.serviceLocationAddress || jobOrProp.locationAddress || jobOrProp.address || '',
            city: jobOrProp.serviceLocationCity || jobOrProp.city || customer?.city || '',
            state: jobOrProp.serviceLocationState || jobOrProp.state || customer?.state || '',
            zip: jobOrProp.serviceLocationZip || jobOrProp.zip || customer?.zip || '',
            mall: (jobOrProp as any)?.mall || ''
        });
    }

    return null;
};

/**
 * Resolves the user-facing display name for a job's site location across all tables and modals.
 * Correctly prioritizes tenant/store names over generic mall, plaza, or structure types (e.g. 'Standalone / Strip Center').
 */
export const resolveSiteLocationName = (job?: any, loc?: any): string => {
    const rawJobLoc = (job?.locationName || (job as any)?.serviceLocationName || (job as any)?.siteLocationName || (job as any)?.siteName || '').trim();
    const locProp = (loc?.propertyName || '').trim();
    const locName = (loc?.name || '').trim();
    const locMall = (loc?.mall || '').trim();
    const storeNum = (loc?.storeNumber || loc?.locationNumber || '').trim();

    // 1. If job already has a comprehensive name containing parentheses with store info (e.g. "BOX LUNCH - 4663 (South Park Mall)")
    if (rawJobLoc && rawJobLoc.includes('(') && rawJobLoc.includes(')')) {
        return rawJobLoc;
    }

    // 2. Check if loc has a canonical propertyName with parentheses (e.g. "AMERICAS BEST CONTACTS - 5870 (Standalone / Strip Center)")
    if (locProp && locProp.includes('(') && locProp.includes(')')) {
        return locProp;
    }

    // 3. If rawJobLoc is just a generic structure type or mall name (e.g. "Standalone / Strip Center", "Standalone")
    const isGenericStructureOrMall = !rawJobLoc || 
        rawJobLoc.toLowerCase() === 'house' || 
        rawJobLoc.toLowerCase().includes('standalone') || 
        rawJobLoc.toLowerCase().includes('strip center') || 
        (locMall && rawJobLoc.toLowerCase() === locMall.toLowerCase()) || 
        (locProp && rawJobLoc.toLowerCase() === locProp.toLowerCase() && storeNum && !locProp.toLowerCase().includes(storeNum.toLowerCase()));

    if (isGenericStructureOrMall) {
        const storeLabel = (storeNum && storeNum.length > 2) ? storeNum : (locName && locName.toLowerCase() !== rawJobLoc.toLowerCase() ? locName : '');
        const mallLabel = locMall || (rawJobLoc && !rawJobLoc.toLowerCase().includes('standalone') ? rawJobLoc : (locProp && !locProp.toLowerCase().includes('standalone') ? locProp : ''));
        
        if (storeLabel && mallLabel && storeLabel.toLowerCase() !== mallLabel.toLowerCase()) {
            return `${storeLabel} (${mallLabel})`;
        }
        if (storeLabel) {
            const extra = (locMall || rawJobLoc || locProp);
            return extra && extra.toLowerCase() !== storeLabel.toLowerCase() ? `${storeLabel} (${extra})` : storeLabel;
        }
        if (locProp && locProp.toLowerCase() !== 'house') return locProp;
        if (locName && locName.toLowerCase() !== 'house') return locName;
        return (rawJobLoc && rawJobLoc.toLowerCase() !== 'house') ? rawJobLoc : '';
    }

    // 4. If loc has both a store name and mall name, combine them if not already combined
    if (locName && locMall && locName.toLowerCase() !== locMall.toLowerCase() && !locName.includes('(')) {
        return `${locName} (${locMall})`;
    }

    return rawJobLoc || locProp || locName || (storeNum ? `Store #${storeNum}` : '');
};

export interface AddressLines {
    street: string;
    cityStateZip: string;
    fullFormatted: string;
}

export const getAddressLines = (
    addrObjOrStr?: any,
    fallbackCity?: string | null,
    fallbackState?: string | null,
    fallbackZip?: string | null
): AddressLines => {
    const sanitized = sanitizeAddressFields(addrObjOrStr, fallbackCity, fallbackState, fallbackZip);

    const street = sanitized.address;
    const city = sanitized.city;
    const state = sanitized.state;
    const zip = sanitized.zip;

    const cityStateParts: string[] = [];
    if (city) {
        cityStateParts.push(city);
    }

    let stateZip = '';
    if (state) stateZip += state;
    if (zip) stateZip += (stateZip ? ` ${zip}` : zip);
    if (stateZip) cityStateParts.push(stateZip);

    const cityStateZip = cityStateParts.join(', ').trim();
    const fullFormatted = [street, cityStateZip].filter(Boolean).join('\n');

    return {
        street,
        cityStateZip,
        fullFormatted
    };
};

/**
 * Single source of truth for identifying internal/sensitive documents, expenses, supplier receipts, and vendor bills.
 * These files MUST NEVER be shown or attached in customer-facing emails, customer portals, or public reports.
 */
export const isInternalExpenseFile = (f: any): boolean => {
    if (!f) return false;

    // 1. Explicit boolean / metadata flags
    if (
        f.internalOnly === true || 
        f.isInternal === true || 
        f.isLocked === true || 
        f.locked === true || 
        f.isExpense === true || 
        !!f.expenseId || 
        f.metadata?.internalOnly === true || 
        f.metadata?.isInternal === true || 
        f.metadata?.isLocked === true || 
        f.metadata?.locked === true || 
        f.metadata?.isExpense === true || 
        f.metadata?.isSubcontractorDoc === true ||
        f.metadata?.isSubcontractorInvoice === true
    ) {
        return true;
    }

    // 2. Category checks
    const cat = String(f.category || f.metadata?.category || f.type || '').toLowerCase().trim();
    if (
        cat === 'expense' || 
        cat === 'expenses' || 
        cat === 'receipt' || 
        cat === 'receipts' || 
        cat === 'internal' || 
        cat === 'internal_doc' || 
        cat === 'internal_docs' || 
        cat === 'subcontractor' || 
        cat === 'subcontractor_bill' || 
        cat === 'subcontractor_invoice' || 
        cat === 'subcontractor labor' || 
        cat === 'payable' || 
        cat === 'vendor' ||
        cat === 'vendor bill'
    ) {
        return true;
    }

    // 3. Label, Filename, and URL pattern matching
    const label = String(f.metadata?.label || f.label || f.title || '').toLowerCase();
    const name = String(f.fileName || f.name || '').toLowerCase();
    const url = String(f.fileUrl || f.dataUrl || f.url || f.path || f.downloadUrl || '').toLowerCase();

    // Sensitive internal keywords
    const forbiddenKeywords = [
        'expense', 'receipt', 'vendor', 'bill', 'subcontractor', 'payable', 
        'purchase order', 'cost sheet', 'distributing', 'supplier', 'wholesale', 
        'sub-inv', 'subcontractor_bill', 'subcontractor_invoice', 'century hvac', 'reimbursement'
    ];

    const hasForbiddenKeyword = forbiddenKeywords.some(keyword => 
        label.includes(keyword) || name.includes(keyword) || url.includes(keyword)
    );

    if (hasForbiddenKeyword) {
        // Exempt waivers and signed work orders that are customer-facing legal forms
        const isCustomerWaiver = 
            name.includes('signed_waiver') || 
            name.includes('waiver_pending') || 
            label.includes('signed waiver') || 
            label.includes('pending signature');
        if (!isCustomerWaiver) {
            return true;
        }
    }

    return false;
};

/**
 * Single source of truth for identifying whether a file/attachment is an image/photo.
 * Strictly excludes documents, HTML proposals, contracts, spreadsheets, PDFs, and internal expense receipts.
 */
export const isFilePhoto = (f: any): boolean => {
    if (!f) return false;
    if (isInternalExpenseFile(f)) return false;

    const url = String(f.fileUrl || f.dataUrl || f.url || f.path || f.downloadUrl || f.fileDataUrl || '').toLowerCase();
    const type = String(f.fileType || f.type || f.contentType || '').toLowerCase();
    const name = String(f.fileName || f.name || f.title || '').toLowerCase();
    const label = String(f.metadata?.label || f.label || '').toLowerCase();
    const cat = String(f.category || f.metadata?.category || '').toLowerCase();

    // Strict exclusion for non-image documents, proposals, contracts, and legal forms
    if (
        name.endsWith('.pdf') || type.includes('pdf') ||
        name.endsWith('.html') || name.endsWith('.htm') || type.includes('html') ||
        name.endsWith('.doc') || name.endsWith('.docx') || type.includes('word') ||
        name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv') || type.includes('excel') || type.includes('spreadsheet') ||
        name.endsWith('.txt') || name.endsWith('.zip') || name.endsWith('.json') ||
        cat.includes('proposal') || cat.includes('contract') || cat.includes('agreement') || cat.includes('quote') ||
        label.includes('proposal') || name.includes('proposal') ||
        cat.includes('signoff') || cat.includes('sign-off') ||
        name.includes('signoff') || name.includes('sign-off') ||
        label.includes('signoff') || label.includes('sign-off')
    ) {
        return false;
    }

    return (
        f.isPhoto === true ||
        type.startsWith('image/') ||
        type === 'photo' ||
        cat.includes('photo') || cat.includes('image') || cat.includes('picture') ||
        cat.includes('tag') || cat.includes('serial') ||
        f.type === 'Photo' ||
        /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)($|\?)/i.test(name) ||
        /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)($|\?)/i.test(url) ||
        url.startsWith('data:image/')
    );
};

/**
 * Verifies whether a job has valid equipment specifications and/or serial number(s)
 * across direct job fields, unit states, precomputed job assets, customer equipment,
 * or global equipment inventory.
 */
export const checkJobHasVerifiedEquipmentSerial = (
    job: any,
    customer?: any,
    globalEquipment?: any[],
    precomputedJobAssets?: any[]
): boolean => {
    if (!job) return false;

    const isValidSerial = (s: any): boolean => {
        if (!s || typeof s !== 'string') return false;
        const clean = s.trim().toUpperCase();
        return clean.length > 0 && 
            clean !== 'N/A' && 
            clean !== 'UNKNOWN' && 
            clean !== 'NONE' && 
            clean !== 'UNDEFINED' && 
            clean !== 'NULL' &&
            clean !== 'TBD';
    };

    // 1. Direct serial fields on the job
    const directSerialFields = [
        job.equipmentSerial,
        job.serialNo,
        job.serialNumber,
        job.hvacSerial,
        job.draftData?.serialNo,
        job.draftData?.serialNumber,
        job.customFields?.serial,
        job.customFields?.serialNumber
    ];
    if (directSerialFields.some(isValidSerial)) return true;

    // 2. Precomputed job assets (e.g. from JobDetailModal or DocumentPreview)
    if (Array.isArray(precomputedJobAssets) && precomputedJobAssets.length > 0) {
        const hasAssetWithSerial = precomputedJobAssets.some((a: any) => 
            isValidSerial(a?.serial) || 
            isValidSerial(a?.serialNumber) || 
            isValidSerial(a?.serialNo) ||
            isValidSerial(a?.model) || 
            isValidSerial(a?.modelNumber)
        );
        if (hasAssetWithSerial) return true;
    }

    // 3. Direct equipment array on job
    if (Array.isArray(job.equipment) && job.equipment.length > 0) {
        const hasValidEq = job.equipment.some((e: any) => {
            if (typeof e === 'string') return isValidSerial(e);
            return isValidSerial(e?.serial) || isValidSerial(e?.serialNumber) || isValidSerial(e?.serialNo) || isValidSerial(e?.model) || isValidSerial(e?.modelNumber);
        });
        if (hasValidEq) return true;
    }

    // Direct equipmentList array on job
    if (Array.isArray(job.equipmentList) && job.equipmentList.length > 0) {
        const hasValidEq = job.equipmentList.some((e: any) => {
            if (typeof e === 'string') return isValidSerial(e);
            return isValidSerial(e?.serial) || isValidSerial(e?.serialNumber) || isValidSerial(e?.serialNo) || isValidSerial(e?.model) || isValidSerial(e?.modelNumber);
        });
        if (hasValidEq) return true;
    }

    // Direct units array on job
    if (Array.isArray(job.units) && job.units.length > 0) {
        const hasValidUnit = job.units.some((u: any) => {
            if (typeof u === 'string') return isValidSerial(u);
            return isValidSerial(u?.serial) || isValidSerial(u?.serialNumber) || isValidSerial(u?.serialNo) || isValidSerial(u?.model) || isValidSerial(u?.modelNumber);
        });
        if (hasValidUnit) return true;
    }

    // Build lookup pool of all available equipment from customer and global state
    const equipmentPool: any[] = [];
    if (Array.isArray(customer?.equipment)) {
        equipmentPool.push(...customer.equipment);
    }
    if (Array.isArray(globalEquipment)) {
        equipmentPool.push(...globalEquipment);
    }

    const findEquipmentInPool = (id: string) => {
        if (!id) return null;
        return equipmentPool.find(e => e && (e.id === id || e.assetId === id || e.assetTag === id));
    };

    // 4. Job unit states (tech recorded visits or linked units)
    const unitStates = Array.isArray(job.unitStates) ? job.unitStates : [];
    if (unitStates.length > 0) {
        for (const us of unitStates) {
            if (isValidSerial(us?.serial) || isValidSerial(us?.serialNumber) || isValidSerial(us?.serialNo)) {
                return true;
            }
            const assetId = us?.assetId || us?.equipmentId || us?.id;
            if (assetId) {
                const matched = findEquipmentInPool(assetId);
                if (matched && (isValidSerial(matched.serial) || isValidSerial(matched.serialNumber) || isValidSerial(matched.serialNo) || isValidSerial(matched.model) || isValidSerial(matched.modelNumber))) {
                    return true;
                }
            }
        }
    }

    // 5. Check equipment matching the job's location
    const jobLocId = job.locationId || job.propertyId || job.serviceLocationId;
    if (jobLocId && equipmentPool.length > 0) {
        const locationMatches = equipmentPool.filter(e => 
            e && (e.propertyId === jobLocId || e.locationId === jobLocId || e.serviceLocationId === jobLocId)
        );
        if (locationMatches.some(e => isValidSerial(e.serial) || isValidSerial(e.serialNumber) || isValidSerial(e.serialNo) || isValidSerial(e.model) || isValidSerial(e.modelNumber))) {
            return true;
        }
    }

    // 6. If customer has only 1 location or if equipment belongs to this customer
    if (equipmentPool.length > 0 && customer?.id && job.customerId === customer.id) {
        const custLocationsCount = (customer.serviceLocations?.length || 0);
        if (custLocationsCount <= 1) {
            if (equipmentPool.some(e => isValidSerial(e?.serial) || isValidSerial(e?.serialNumber) || isValidSerial(e?.serialNo) || isValidSerial(e?.model) || isValidSerial(e?.modelNumber))) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Sanitizes customer-facing scope descriptions, allowance notes, and disclaimers to ensure
 * internal cost basis, markups, or wholesale pricing notes are never revealed to the customer.
 */
export const sanitizeCustomerScopeText = (text?: string | null): string => {
    if (!text) return '';
    return text
        // Strip "(Built-in cost basis: $X (+Y% markup))" or "Built-in cost basis: $X"
        .replace(/\(?(?:built-in\s+)?cost\s+basis:?\s*\$?[0-9,.]+(?:\s*\(\+[0-9.]+%?\s*(?:contract\s+)?markup\))?\)?/gi, '')
        // Strip "(interim estimate on file pending final 3-unit multi-pick quote from LiftHigh Crane; calculated at $3,747.40 cost basis + 20% contract markup)"
        .replace(/\(?(?:interim\s+estimate\s+on\s+file[^;)]*;?\s*)?calculated\s+at\s*\$?[0-9,.]+\s+cost\s+basis\s*\+\s*[0-9.]+%?\s*(?:contract\s+)?markup\)?/gi, '')
        // Strip "(+X% markup)" or "(+X% contract markup)"
        .replace(/\(\+[0-9.]+%?\s*(?:contract\s+)?markup\)/gi, '')
        // Strip "+X% markup" standalone
        .replace(/\+[0-9.]+%?\s*(?:contract\s+)?markup/gi, '')
        // Strip "quoted at approved contract cost-plus markups (23% RTU, 43% parts...)"
        .replace(/quoted\s+at\s+approved\s+contract\s+cost-plus\s+markups\s*\([^)]*\)/gi, 'quoted under approved contract schedule')
        // Clean leftover punctuation and multiple spaces
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\(\s*\)/g, '')
        .trim();
};

/**
 * Sanitizes and normalizes text for safe vector rendering in jsPDF with standard Type 1 fonts (Helvetica, Times, Courier).
 * Prevents jsPDF from falling back to UTF-16BE / monospaced Courier fallback and line-overflowing
 * caused by non-WinAnsi unicode characters (such as non-breaking hyphens U+2011, smart quotes, dashes, etc.).
 */
export const cleanPdfText = <T extends string | string[] | null | undefined>(text: T): T => {
    if (!text) return text;
    if (Array.isArray(text)) {
        return text.map(t => cleanPdfText(t)) as T;
    }
    const str = String(text)
        // Normalize unicode hyphens, minus, and dashes to standard ASCII hyphen
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
        // Normalize unicode single quotes / apostrophes to standard ASCII single quote
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'")
        // Normalize unicode double quotes to standard ASCII double quote
        .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
        // Normalize bullet variants to standard middle dot (WinAnsi 0xB7)
        .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '·')
        // Normalize ellipsis to three dots
        .replace(/[\u2026]/g, '...')
        // Normalize non-breaking spaces and wide whitespace
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
        // Strip zero-width characters and BOM
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
        // Normalize common symbols
        .replace(/[\u20AC]/g, 'EUR')
        .replace(/[\u2122]/g, 'TM');

    return str as T;
};

/**
 * Extracts recommendations and actionable diagnostic advice from a Job record.
 * Checks explicit recommendations, per-unit inspection findings, and diagnostic notes.
 */
export const extractJobRecommendations = (job: any): string => {
    if (!job) return '';

    const recs: string[] = [];

    // 1. Direct explicit recommendations
    const explicitRec = job.recommendations || 
        job.techRecommendations || 
        (job.notes as any)?.recommendations || 
        (job.notes as any)?.recommendation || 
        (job.workflowState as any)?.recommendations ||
        (job.invoice as any)?.recommendations;

    if (explicitRec && typeof explicitRec === 'string' && explicitRec.trim()) {
        recs.push(explicitRec.trim());
    }

    // 2. Unit states / equipment inspection recommendations
    if (Array.isArray(job.unitStates) && job.unitStates.length > 0) {
        const unitFindings: string[] = [];
        job.unitStates.forEach((unit: any) => {
            const unitName = unit.unitName || unit.name || unit.serialNumber || (unit.id ? `Unit ${unit.id}` : 'Equipment');
            const unitRec = unit.recommendation || unit.recommendations || unit.notes || unit.diagnosticNotes;
            if (unitRec && typeof unitRec === 'string' && unitRec.trim()) {
                unitFindings.push(`${unitName}: ${unitRec.trim()}`);
            }
        });
        if (unitFindings.length > 0) {
            const unitSection = unitFindings.join('\n');
            if (!recs.some(r => r.includes(unitFindings[0]))) {
                recs.push(unitSection);
            }
        }
    }

    // 3. Fallback to diagnostic findings or arrival notes if no explicit recommendation found
    if (recs.length === 0) {
        const diag = (job.notes as any)?.diagnosis || job.diagnosisNotes || (job.notes as any)?.diagnosticNotes;
        const arrival = job.arrivalNotes || (job.notes as any)?.arrivalNotes || (job.notes as any)?.arrival;
        const work = (job.notes as any)?.workNotes || (job.notes as any)?.work || job.workNotes;

        if (diag && typeof diag === 'string' && diag.trim()) {
            recs.push(`Diagnostic Finding: ${diag.trim()}`);
        } else if (arrival && typeof arrival === 'string' && arrival.trim()) {
            recs.push(`Technician Finding: ${arrival.trim()}`);
        } else if (work && typeof work === 'string' && work.trim()) {
            recs.push(`Service Note: ${work.trim()}`);
        }
    }

    return recs.join('\n\n').trim();
};
