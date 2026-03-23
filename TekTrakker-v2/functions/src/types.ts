
export type IndustryVertical = 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General' | 'Cleaning' | 'Painting' | 'Roofing' | 'Contracting' | 'Masonry' | 'Telecommunications' | 'Solar' | 'Security' | 'Pet Grooming';

export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface Organization {
    id: string;
    name: string;
    phone: string;
    email: string;
    industry?: IndustryVertical;
    industries?: IndustryVertical[];
    logoUrl?: string;
    website?: string;
    address?: Address;
    taxId?: string;
    taxRate?: number;
    primaryColor?: string;
    marketMultiplier?: number;
    ueid?: string | null;
    cageCode?: string | null;
    primaryNaics?: string | null;
    licenseNumber?: string | null;
    letterheadDataUrl?: string | null;
    complianceFooter?: string | null;
    financingLink?: string | null;
    termsAndConditions?: string | null;
    membershipTerms?: string | null;
    footerImage?: string | null;
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled';
    subscriptionExpiryDate?: string | null;
    plan?: 'starter' | 'growth' | 'enterprise';
    createdAt?: string;
    paymentMethodAttached?: boolean;
    notificationEmails?: string[];
    supportedTrades?: IndustryVertical[];
    reviewLink?: string;
    paypalClientId?: string | null;
    stripePublicKey?: string | null;
    stripeAccountId?: string | null;
    squareApplicationId?: string | null;
    squareLocationId?: string | null;
    enabledPanels?: {
        inventory?: boolean;
        marketing?: boolean;
        memberships?: boolean;
        documents?: boolean;
        time_tracking?: boolean;
    };
    linkedPartners?: string[];
    partnerRequests?: { fromOrgId: string; fromOrgName: string; status: 'pending' | 'accepted' }[];
    smtpConfig?: {
        host: string;
        port: number;
        user: string;
        pass: string;
        fromEmail: string;
        fromName: string;
        secure: boolean;
    };
    twilioConfig?: {
        accountSid: string;
        authToken: string;
        phoneNumber: string;
    };
    googleApiConnected?: boolean;
    googleClientId?: string;
    socialLinks?: {
        facebook?: string;
        instagram?: string;
        linkedin?: string;
        x?: string;
        youtube?: string;
        tiktok?: string;
    };
    reviewLinks?: {
        google?: string;
        yelp?: string;
        nextdoor?: string;
        angi?: string;
        bbb?: string;
        trustpilot?: string;
        homeadvisor?: string;
        houzz?: string;
    };
    customPositions?: string[];
    requiredCertifications?: string[];
    proposalDisclaimer?: string;
    invoiceTerms?: string;
    additionalUserSlots?: number;
    isFreeAccess?: boolean;
    customDiscountPct?: number;
    quickbooksConnected?: boolean;
    aiPricebookEnabled?: boolean;
    salesRepId?: string;
    settings?: any; 
    isVerified?: boolean; 
    publicProfile?: boolean; 
    publicDescription?: string; 
    publicProfileEnabled?: boolean; 
    ownerId?: string;
    bannerUrl?: string;
    serviceTypes?: ('Residential' | 'Commercial')[]; 
    specializations?: string[];
    stripeCustomerId?: string; 
    profileImageUrl?: string; 
    coverImageUrl?: string; 
    contactEmail?: string; 
    contactPhone?: string;
    bio?: string; // Added
    features?: any; // Added
    branding?: any; // Added
    serviceableRegions?: string[]; // Added
    avgRating?: number; // Added
    reviewCount?: number; // Added
}

export interface PlatformSettings {
    id: string;
    plans: {
        starter: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
        growth: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
        enterprise: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
    };
    excessUserFee: number;
    updatedAt: string;
    platformPaypalClientId?: string;
}

export interface CommissionSettings {
    baseRate: number;
    acceleratorRate: number;
    annualQuota: number;
    renewalRate: number;
    rampUpMonths: {
        phase1: number;
        phase1QuotaPct: number;
        phase2: number;
        phase2QuotaPct: number;
    }
}
