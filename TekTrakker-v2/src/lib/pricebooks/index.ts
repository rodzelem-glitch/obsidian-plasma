
export const AVAILABLE_VERTICALS = [
    'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Roofing', 'Painting',
    'Contracting', 'Cleaning', 'General', 'Masonry', 'Telecommunications',
    'Solar', 'Security', 'Pet Grooming'
] as const;

export type VerticalType = typeof AVAILABLE_VERTICALS[number];

/**
 * Asynchronously loads a specific trade's master pricebook on-demand,
 * preventing multi-megabyte bundle bloat.
 */
export async function loadPriceBook(vertical: string): Promise<any[]> {
    switch (vertical) {
        case 'HVAC': return (await import('./hvac')).HVAC_MASTER_BOOK;
        case 'Plumbing': return (await import('./plumbing')).PLUMBING_MASTER_BOOK;
        case 'Electrical': return (await import('./electrical')).ELECTRICAL_MASTER_BOOK;
        case 'Landscaping': return (await import('./landscaping')).LANDSCAPING_MASTER_BOOK;
        case 'Roofing': return (await import('./roofing')).ROOFING_MASTER_BOOK;
        case 'Painting': return (await import('./painting')).PAINTING_MASTER_BOOK;
        case 'Contracting': return (await import('./contracting')).CONTRACTING_MASTER_BOOK;
        case 'Cleaning': return (await import('./cleaning')).CLEANING_MASTER_BOOK;
        case 'General': return (await import('./general')).GENERAL_MASTER_BOOK;
        case 'Masonry': return (await import('./masonry')).MASONRY_MASTER_BOOK;
        case 'Telecommunications': return (await import('./telecommunications')).TELECOMMUNICATIONS_MASTER_BOOK;
        case 'Solar': return (await import('./solar')).SOLAR_MASTER_BOOK;
        case 'Security': return (await import('./security')).SECURITY_MASTER_BOOK;
        case 'Pet Grooming': return (await import('./pet_grooming')).PET_GROOMING_MASTER_BOOK;
        default: return [];
    }
}

