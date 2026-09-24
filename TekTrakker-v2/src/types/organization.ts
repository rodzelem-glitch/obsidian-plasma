
export type IndustryVertical = 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General' | 'Cleaning' | 'Painting' | 'Roofing' | 'Contracting' | 'Masonry' | 'Telecommunications' | 'Solar' | 'Security' | 'Pet Grooming' | 'Property Management' | 'Appliance Repair' | 'Garage Door';

export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface Division {
    id: string;
    name: string;
    trade: IndustryVertical;
    createdAt?: string;
}

export interface SubcontractorComplianceSettings {
    enforceComplianceBeforeAssignment?: boolean;
    allowTemporaryComplianceBypass?: boolean;
    complianceBypassReason?: string;
    notifyOnLink?: boolean;
    expiryWarningDays?: number;
    requiredDocuments?: Record<string, boolean>;
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
    slug?: string;
    customInboundSlug?: string;
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
    laborRate?: number;
    markupPct?: number;
    hourlyLaborRate?: number;
    defaultMarkupPct?: number;
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
    pricingDisclaimer?: string | null;
    proposalProtectionMode?: 'none' | 'summary' | 'nda';
    proposalNdaContent?: string | null;
    membershipTerms?: string | null;
    footerImage?: string | null;
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
    subscriptionExpiryDate?: string | null;
    nextBillingDate?: string | null;
    plan?: 'starter' | 'growth' | 'business' | 'enterprise' | 'payments_only';
    customPricing?: OrganizationCustomPricing;
    cancellationReason?: string;
    cancellationFeedback?: string;
    canceledAt?: string;
    retentionOfferApplied?: string;
    createdAt?: string;
    paymentMethodAttached?: boolean;
    notificationEmails?: string[];
    supportedTrades?: IndustryVertical[];
    divisions?: Division[];
    additionalDivisionsSlots?: number;
    reviewLink?: string;
    subcontractorComplianceSettings?: SubcontractorComplianceSettings;
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
    jobPrefix?: string;
    jobStartNumber?: number;
    nextJobNum?: number;
    invoicePrefix?: string;
    invoiceStartNumber?: number;
    nextInvoiceNum?: number;
    proposalPrefix?: string;
    proposalStartNumber?: number;
    nextProposalNum?: number;
    salesRepId?: string;
    promoCode?: string | null;
    measureQuickApiKey?: string;
    billingCycle?: 'monthly' | 'annual';
    virtualWorkerEnabled?: boolean;
    virtualWorkerBillingType?: 'monthly' | 'lifetime';
    aiVoiceAssistantEnabled?: boolean;
    aiVoiceAssistantBillingType?: 'monthly' | 'lifetime';
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
    lateFeeEnabled?: boolean;
    lateFeeType?: 'flat' | 'percent';
    lateFeeValue?: number;
    lateFeeInterestRate?: number;
    lateFeeGracePeriod?: number;
    ein?: string;
    businessType?: string;
    incorporationState?: string;
    formationDate?: string;
    businessDocuments?: Array<{ id: string; name: string; url: string; uploadedAt: string }>;
    acceptWire?: boolean;
    wireInstructions?: string;
    acceptCheck?: boolean;
    checkInstructions?: string;
    acceptAch?: boolean;
    achInstructions?: string;
    pciComplianceSealHtml?: string | null;
    autoRechargeSettings?: {
        enabled: boolean;
        thresholdPct: number;
        powerPackCount?: number;
        updatedAt?: string;
    };
    warrantyPlans?: Record<string, WarrantyPlanTemplate>;
    defaultWarrantyPlan?: WarrantyPlanTemplate;
    jbWarrantySettings?: JbWarrantySettings;
}

export interface JbWarrantySettings {
    enabled?: boolean;
    contractorLaborRate?: number; // 85 | 105 | 125 | 150 | 175 | 200 | 250 | 300
    contractorLaborRateTier?: number;
    markupPercentage?: number; // e.g. 40 or 50%
    defaultMarkupPercentage?: number;
    minimumMarkupDollars?: number;
    defaultTermYears?: number; // e.g. 10
    allowCustomerPortalPurchases?: boolean;
    enableCustomerPortalPurchases?: boolean;
    allowInvoiceAddition?: boolean;
}

export interface WarrantySublimit {
    id: string;
    category: string;
    examples: string;
    maxLimit: number;
    limitType: 'per_failure' | 'per_contract_year';
}

export interface WarrantyAgeTier {
    id: string;
    minYears: number;
    maxYears: number;
    label: string;
    annualPrice: number;
    additionalSystemPrice: number;
    enrollmentNotes: string;
    requiresManagementApproval?: boolean;
    isSpecialEndorsement?: boolean;
}

export interface WarrantyPlanTemplate {
    id: string;
    trade: IndustryVertical;
    planTitle: string;
    planSubtitle?: string;
    termMonths: number;
    allowAutoRenew: boolean;
    qualificationFee: number;
    qualificationFeeWaiverDays: number;
    waitingPeriodDays: number;
    serviceFee: number;
    annualAggregateLimit: number;
    replacementCreditLimit: number;
    ageTiers: WarrantyAgeTier[];
    sublimits: WarrantySublimit[];
    eligibleUnitTypes?: string[];
    eligibleRefrigerants?: string[];
    maxTonnage?: number;
    maxSystemAgeYears?: number;
    serviceAreaDescription?: string;
    knownExclusions?: string[];
    governingState?: string;
    governingCounty?: string;
    cancellationTerms?: string;
    acknowledgmentItems?: string[];
}

export interface WarrantyContract {
    id: string;
    contractNumber: string;
    organizationId: string;
    customerId: string;
    customerName: string;
    serviceAddress: string;
    customerPhone: string;
    customerEmail: string;
    trade: IndustryVertical;
    planTitle: string;
    agreementDate: string;
    effectiveDate: string;
    expirationDate: string;
    status: 'Draft' | 'Active' | 'Pending_Payment' | 'Expired' | 'Cancelled';
    
    // System specifications
    equipmentId?: string;
    systemType: string;
    refrigerant: string;
    nominalTons: number;
    approxAgeYears: number;
    outdoorModel?: string;
    outdoorSerial?: string;
    indoorModel?: string;
    indoorSerial?: string;
    qualifyingInvoiceNumber?: string;
    qualifyingJobId?: string;
    qualifyingServiceDate?: string;
    
    // Financials
    basePrice: number;
    qualificationFee: number;
    qualificationFeeWaived: boolean;
    totalAmount: number;
    paymentStatus: 'Paid' | 'Unpaid' | 'Pending';
    paymentMethod?: string;
    annualAggregateLimit: number;
    remainingBenefitLimit: number;
    serviceFee: number;
    replacementCreditLimit: number;
    
    // Limits & Rules snapshot
    ageTierLabel: string;
    sublimits: WarrantySublimit[];
    documentedExcludedConditions?: string;
    
    // Signatures & Acknowledgments
    customerSignature?: string;
    customerSignedName?: string;
    customerSignedDate?: string;
    companyRepSignature?: string;
    companyRepName?: string;
    companyRepTitle?: string;
    companyRepSignedDate?: string;
    acknowledgmentsChecked?: Record<string, boolean>;
    
    // Claims Tracking
    claimsCount?: number;
    totalClaimsPaid?: number;
    createdAt: string;
    updatedAt: string;
}
