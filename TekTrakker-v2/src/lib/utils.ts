
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

export const formatAddress = (address: string | Address | undefined | null): string => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
};

export const formatFlatAddress = (loc: any): string => {
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

export const getBaseUrl = (): string => {
    const { hostname, protocol, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'capacitor:') {
        return 'https://app.tektrakker.com';
    }
    return origin;
};

export const hasPermission = (user: any | null | undefined, permissionId: string): boolean => {
  if (!user) return false;
  if (user.role === 'master_admin') return true;
  
  // If the user's role is not admin, supervisor, or both (superuser), they don't have access to admin sections anyway
  if (!['admin', 'both', 'supervisor'].includes(user.role)) return false;
  
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

export const matchTier = (itemTier: string | undefined | null, targetTier: string): boolean => {
    if (!itemTier) return targetTier.toLowerCase() === 'basic' || targetTier.toLowerCase() === 'good';
    const it = itemTier.toLowerCase();
    const tt = targetTier.toLowerCase();
    if (tt === 'good' || tt === 'basic') return it === 'good' || it === 'basic';
    if (tt === 'better' || tt === 'premium') return it === 'better' || it === 'premium';
    if (tt === 'best' || tt === 'platinum') return it === 'best' || it === 'platinum';
    return it === tt;
};

export const displayTierName = (tier: string | undefined | null): string => {
    if (!tier) return 'Basic';
    const lower = tier.toLowerCase();
    if (lower === 'good' || lower === 'basic') return 'Basic';
    if (lower === 'better' || lower === 'premium') return 'Premium';
    if (lower === 'best' || lower === 'platinum') return 'Platinum';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
};

export const cleanUndefinedFields = <T>(obj: T, seen = new WeakSet()): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj as object)) return obj;

    // Do not recurse into Date instances, Firestore Timestamps, FieldValues, DocumentReferences, or non-plain objects
    if (
        obj instanceof Date ||
        ('seconds' in obj && 'nanoseconds' in obj) ||
        ('_methodName' in obj) ||
        ('firestore' in obj) ||
        ('converter' in obj) ||
        ('path' in obj && 'id' in obj) ||
        (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array')
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



