
export type IndustryVertical = 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General' | 'Cleaning' | 'Painting' | 'Roofing' | 'Contracting' | 'Masonry' | 'Telecommunications' | 'Solar' | 'Security' | 'Pet Grooming' | 'Property Management' | 'Appliance Repair' | 'Garage Door';

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
    isLeadingPro?: boolean;
    industry?: IndustryVertical;
    logoUrl?: string;
    website?: string;
    address?: Address;
    taxId?: string;
    taxRate?: number;
    primaryColor?: string;
    marketMultiplier?: number;
    ueid?: string | null;
    cageCode?: string | null;
    hrFileCategories?: string[];
    primaryNaics?: string | null;
    licenseNumber?: string | null;
    letterheadDataUrl?: string | null;
    complianceFooter?: string | null;
    financingLink?: string | null;
    termsAndConditions?: string | null;
    customerTerms?: string | null;
    proposalTerms?: string | null;
    membershipTerms?: string | null;
    footerImage?: string | null;
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
    subscriptionExpiryDate?: string | null;
    plan?: 'starter' | 'growth' | 'enterprise' | 'payments_only';
    cancellationReason?: string;
    cancellationFeedback?: string;
    canceledAt?: string;
    retentionOfferApplied?: string;
    createdAt?: string;
    paymentMethodAttached?: boolean;
    notificationEmails?: string[];
    supportedTrades?: IndustryVertical[];
    reviewLink?: string;
    stripePublicKey?: string | null;
    stripeAccountId?: string | null;
    squareApplicationId?: string | null;
    squareLocationId?: string | null;
    squareToken?: string | null;
    kortAccountId?: string | null;
    kortAccountStatus?: string | null;
    defaultPaymentGateway?: 'stripe' | 'square' | 'kort';
    platformVaultedPaymentMethodId?: string | null;
    platformVaultedPaymentType?: string | null;
    enabledPanels?: {
        inventory?: boolean;
        marketing?: boolean;
        memberships?: boolean;
        documents?: boolean;
        time_tracking?: boolean;
    };
    marketingSpend?: Record<string, number>;
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
    invoicePrefix?: string;
    invoiceStartNumber?: number;
    nextInvoiceNum?: number;
    proposalPrefix?: string;
    proposalStartNumber?: number;
    nextProposalNum?: number;
    salesRepId?: string;
    promoCode?: string | null;
    measureQuickApiKey?: string;
    virtualWorkerEnabled?: boolean;
    virtualWorkerBillingType?: 'monthly' | 'lifetime';
    franchiseId?: string;
    profileSlug?: string;
    gclid?: string;
    marketingConsent?: {
        sms: boolean;
        email: boolean;
        agreedAt: string;
        source: string;
        gclid?: string;
    };
}
