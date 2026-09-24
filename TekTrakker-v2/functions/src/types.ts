
export type IndustryVertical = 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General' | 'Cleaning' | 'Painting' | 'Roofing' | 'Contracting' | 'Masonry' | 'Telecommunications' | 'Solar' | 'Security' | 'Pet Grooming';

export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface OrganizationCustomPricing {
    customMonthlyPlanFee?: number;
    customSmsRate?: number;
    customVoiceRate?: number;
    customPhoneLineFee?: number;
    customStorageOverageRate?: number;
    customAiTokenOverageRate?: number;
    customExcessUserFee?: number;
    customDivisionFee?: number;
    customVirtualWorkerFee?: number;
    customIncludedStorageGB?: number;
    customIncludedAiTokens?: number;
    customAiVoiceAssistantRate?: number;
    customAiVoiceAssistantMonthlyFee?: number;
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
    plan?: 'starter' | 'growth' | 'business' | 'enterprise' | 'payments_only';
    customPricing?: OrganizationCustomPricing;
    createdAt?: string;
    paymentMethodAttached?: boolean;
    notificationEmails?: string[];
    supportedTrades?: IndustryVertical[];
    reviewLink?: string;
    gustoCompanyId?: string | null;
    gustoOnboardingUrl?: string | null;
    hasPayrollEnabled?: boolean;
    bofaCashProApiKey?: string | null;
    bofaMerchantGatewayId?: string | null;
    gustoClientId?: string | null;
    gustoClientSecret?: string | null;
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
    virtualWorkerEnabled?: boolean;
    virtualWorkerBillingType?: 'monthly' | 'lifetime';
    aiVoiceAssistantEnabled?: boolean;
    aiVoiceAssistantBillingType?: 'monthly' | 'lifetime';
    revenuecatId?: string;
    salesRepId?: string;
    settings?: any; 
    isVerified?: boolean; 
    publicProfile?: boolean; 
    publicDescription?: string; 
    publicProfileEnabled?: boolean; 
    profileSlug?: string;
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
        starter: { monthly: number; annual: number; maxUsers: number; stripeMonthlyId?: string; stripeAnnualId?: string };
        growth: { monthly: number; annual: number; maxUsers: number; stripeMonthlyId?: string; stripeAnnualId?: string };
        business: { monthly: number; annual: number; maxUsers: number; stripeMonthlyId?: string; stripeAnnualId?: string };
        enterprise: { monthly: number; annual: number; maxUsers: number; stripeMonthlyId?: string; stripeAnnualId?: string };
        payments_only: { monthly: number; annual: number; maxUsers: number; stripeMonthlyId?: string; stripeAnnualId?: string };
    };
    excessUserFee: number;
    subscriptionFee?: number;
    virtualWorkerFee?: number;
    virtualWorkerLifetimeFee?: number;
    divisionFee?: number;
    smsRate?: number;
    voiceRate?: number;
    phoneLineFee?: number;
    aiTokenOverageRatePer1k?: number;
    aiVoiceAssistantMonthlyFee?: number;
    aiVoiceAssistantRatePerMinute?: number;
    franchiseLifetimeFee?: number;
    updatedAt: string;
}

export interface SalesIncentiveContest {
    id?: string;
    title: string;
    description: string;
    rewardType: 'prize' | 'cash' | 'raffle' | 'experience' | 'custom';
    rewardValue: string; // e.g. "75\" Sony 4K OLED TV" or "$1,000 Cash"
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    criteriaType: 'top_volume' | 'top_deals' | 'threshold_volume' | 'threshold_deals' | 'raffle';
    targetThreshold?: number; // e.g. 2500 for $2,500 MRR
    isActive: boolean;
    winnerRepId?: string;
    winnerRepName?: string;
    updatedAt?: string;
}

export interface CommissionSettings {
    baseRate: number;
    acceleratorRate: number;
    annualQuota: number;
    renewalRate: number; // Kept for backwards compatibility (aliases year2Rate)
    year2Rate?: number;
    lifetimeRate?: number;
    quarterlyMinDeals?: number;
    quarterlyMinVolume?: number;
    inactivityCliffDays?: number;
    abandonmentDays?: number;
    annualPrepaidKickerRate?: number; // e.g. 0.05 (+5 percentage points)
    monthlyMrrAccelerators?: { minMrr: number; maxMrr?: number; rate: number }[];
    monthlyMrrBonuses?: { mrr: number; bonus: number }[];
    annualArrBonuses?: { arr: number; bonus: number }[];
    activeMonthlyIncentive?: SalesIncentiveContest;
    rampUpMonths: {
        phase1: number;
        phase1QuotaPct: number;
        phase2: number;
        phase2QuotaPct: number;
    }
}

