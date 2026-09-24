// Consolidated types for the Tektrakker project
// This file is used as a central hub for all type definitions via the 'types' alias.

import type { 
    JbWarrantySettings, 
    WarrantySublimit, 
    WarrantyAgeTier, 
    WarrantyPlanTemplate, 
    WarrantyContract 
} from './organization';

export type { CustomerContact, CustomerMarkupRule } from './customer';
export type { 
    JbWarrantySettings, 
    WarrantySublimit, 
    WarrantyAgeTier, 
    WarrantyPlanTemplate, 
    WarrantyContract 
};

// --- Organization & Address ---
export type IndustryVertical = 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General' | 'Cleaning' | 'Painting' | 'Roofing' | 'Contracting' | 'Masonry' | 'Telecommunications' | 'Solar' | 'Security' | 'Pet Grooming' | 'Property Management' | 'Appliance Repair' | 'Garage Door';

export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface SignedWaiver {
    id: string;
    customerName: string;
    address?: string | Address;
    signatureImage?: string;
    signatureDataUrl?: string;
    signature?: string;
    htmlContent?: string;
    title?: string;
    timestamp: string;
    createdAt?: string;
    fileName?: string;
    url?: string;
    dataUrl?: string;
    content?: string;
    body?: string;
}

export interface SubcontractorComplianceDoc {
    id: string;
    docKey: string;
    name: string;
    fileUrl?: string;
    fileName?: string;
    uploadedAt?: string;
    expiresAt?: string;
    status: 'missing' | 'pending' | 'verified' | 'rejected' | 'expired';
    notes?: string;
    verifiedBy?: string;
    verifiedAt?: string;
}

export interface SubcontractorContract {
    id: string;
    title: string;
    contractType: 'Master Service Agreement' | 'Independent Contractor Agreement' | 'Work Order Sub-Contract' | 'NDA / Non-Compete' | 'Custom Agreement';
    effectiveDate?: string;
    expirationDate?: string;
    fileUrl?: string;
    fileName?: string;
    content?: string;
    status: 'Draft' | 'Sent' | 'Signed' | 'Expired';
    signedAt?: string;
    signedByName?: string;
    signedByEmail?: string;
    signatureDataUrl?: string;
    uploadedAt?: string;
    notes?: string;
}

export interface SubcontractorComplianceSettings {
    enforceComplianceBeforeAssignment?: boolean;
    allowTemporaryComplianceBypass?: boolean;
    complianceBypassReason?: string;
    notifyOnLink?: boolean;
    expiryWarningDays?: number;
    requiredDocuments?: Record<string, boolean>;
}

export interface OrganizationSettings {
    publicProfile?: boolean;
    publicLogoUrl?: string;
    publicDescription?: string;
    publicCredentials?: string[];
    publicServices?: string[];
    hiring?: boolean;
    serviceArea?: string[];
    openWeatherApiKey?: string;
    shovelsApiKey?: string;
    shovelsUsageCount?: number;
    subcontractorComplianceSettings?: SubcontractorComplianceSettings;
    [key: string]: unknown;
}

export interface Division {
    id: string;
    name: string;
    trade: IndustryVertical;
    createdAt?: string;
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
    slug?: string;
    customInboundSlug?: string;
    franchiseId?: string;
    gustoOnboardingUrl?: string;
    gustoCompanyUuid?: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    isLeadingPro?: boolean;
    industry?: IndustryVertical;
    industries?: IndustryVertical[];
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
    jbWarrantySettings?: JbWarrantySettings;
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
    isComplimentary?: boolean;
    billingExemptions?: {
        twilio?: boolean;
        ai?: boolean;
        storage?: boolean;
        hosting?: boolean;
    };
    autoRechargeSettings?: any;
    cancellationReason?: string;
    cancellationFeedback?: string;
    canceledAt?: string;
    retentionOfferApplied?: string;
    createdAt?: string;
    lastLoginAt?: string | null;
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
    unlockAllFeatures?: boolean;
    customDiscountPct?: number;
    customPricing?: OrganizationCustomPricing;
    quickbooksConnected?: boolean;
    aiPricebookEnabled?: boolean;
    allowPartialPayments?: boolean;
    jobPrefix?: string;
    jobStartNumber?: number;
    nextJobNum?: number;
    invoicePrefix?: string;
    invoiceStartNumber?: number;
    nextInvoiceNum?: number;
    proposalPrefix?: string;
    proposalStartNumber?: number;
    nextProposalNum?: number;
    billingCycle?: 'monthly' | 'annual';
    virtualWorkerEnabled?: boolean;
    virtualWorkerBillingType?: 'monthly' | 'lifetime';
    aiVoiceAssistantEnabled?: boolean;
    aiVoiceAssistantBillingType?: 'monthly' | 'lifetime';
    salesRepId?: string;
    settings?: OrganizationSettings; 
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
    features?: Record<string, boolean>; // Added
    branding?: Record<string, unknown>; // Added
    serviceableRegions?: string[]; // Added
    avgRating?: number; // Added
    reviewCount?: number; // Added
    promoCode?: string | null;
    warrantyDisclaimer?: string;
    defaultWorkmanshipMonths?: number;
    defaultPartsMonths?: number;
    marketingSpend?: Record<string, number>;
    acceptsSubcontracting?: boolean;
    profileSlug?: string;
    gclid?: string;
    marketingConsent?: {
        sms: boolean;
        email: boolean;
        agreedAt: string;
        source: string;
        gclid?: string;
    };
    platformCustomerId?: string | null;
    cardProcessingFeeEnabled?: boolean;
    cardProcessingFeePercent?: number;
    cardProcessingFeeFlat?: number;
    achProcessingFeeEnabled?: boolean;
    achProcessingFeePercent?: number;
    achProcessingFeeFlat?: number;
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
    warrantyPlans?: Record<string, WarrantyPlanTemplate>;
    defaultWarrantyPlan?: WarrantyPlanTemplate | null;
}

// --- User & Employee ---
export interface EmployeeDocument {
  id: string;
  organizationId: string;
  fileName: string;
  label: string;
  dataUrl: string; 
  createdAt?: string;
  fileType?: string;
  isVisibleToEmployee?: boolean;
  uploadedBy?: string;
  tags?: string[];
  description?: string;
}

export interface User {
  id: string;
  organizationId: string; 
  uid?: string; 
  username: string;
  name?: string;
  email?: string | null; 
  password?: string | null; 
  firstName: string;
  lastName: string;
  title?: string;
  includeSignatureInOutbound?: boolean;
  payRate: number | string; 
  payType?: 'hourly' | 'salary'; 
  billableRate?: number | null; 
  ptoAccrued: number; 
  role: 'master_admin' | 'admin' | 'employee' | 'both' | 'customer' | 'supervisor' | 'platform_sales' | 'Technician' | 'Subcontractor' | 'franchise_admin';
  franchiseId?: string;
  dispatchTeamIds?: string[];
  taxW9Content?: string; 
  reportsTo?: string | null; 
  hireDate?: string | null;
  ssn?: string | null; 
  taxId?: string;
  experienceYears?: number | null;
  emergencyContact?: { name: string; phone: string; relationship?: string; alternatePhone?: string; };
  certifications?: { name: string; number?: string; expiryDate?: string; fileUrl?: string; }[];
  ptoAccrualRate?: number | null; 
  mileageRate?: number | null; 
  hasCompanyVehicle?: boolean | null;
  dob?: string;
  driversLicense?: { number: string; state: string; expiryDate: string; };
  employmentType?: 'Full-Time' | 'Part-Time' | 'Temporary';
  department?: string;
  directDeposit?: {
    preference?: 'Direct Deposit' | 'Paper Check';
    bankName?: string;
    accountType?: 'Checking' | 'Savings';
    routingNumber?: string;
    accountNumber?: string;
    effectiveDate?: string;
  };
  infoSheetSignature?: { signature: string; date: string; };
  documents?: EmployeeDocument[]; 
  status?: 'active' | 'archived';
  phone?: string | null;
  address?: Address;
  certificationDate?: string | null;
  otherCertifications?: string | null;
  notes?: string | null;
  cashBalance?: number | null; 
  handbookSignedDate?: string | null;
  location?: { lat: number; lng: number; timestamp: string; };
  lastLocationUpdate?: string | null;
  lastLoginAt?: string | null; 
  preferences?: {
      sidebarOrder?: string[];
      customLabels?: Record<string, string>;
      hiddenSidebarPaths?: string[];
      [key: string]: unknown;
  };
  permissions?: string[]; 
  marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; ip?: string; gclid?: string; unsubscribedAt?: string | null; optOutReason?: string | null; auditNotes?: string | null; };
  signedPolicies?: Record<string, string>;
  policySignatures?: Record<string, string>;
  formSubmissions?: Record<string, { timestamp?: string; responses?: Record<string, string>; fileUrl?: string; fileName?: string; [key: string]: unknown }>;
  digitalId?: string;
  salesContractSigned?: boolean;
  salesContractDate?: string;
  salesContractSignature?: string;
  salesContractContent?: string;
  salesRepStatus?: 'Active' | 'Suspended' | 'Forfeited' | 'Inactive';
  lastSalesActivityAt?: string;
  lastSalesLoginAt?: string;
  profilePicUrl?: string;
  emailSignatureHtml?: string;
  aiEstimatorEnabled?: boolean;
  w4Status?: 'Single' | 'Married' | 'Head of Household';
  w4DependentsAmount?: number;
  w4OtherIncome?: number;
  w4Deductions?: number;
  w4ExtraWithholding?: number;
  weeklyStandardHours?: number;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadius?: number | null;
  commissionRate?: number; 
  customCommissionSettings?: CommissionSettings;
  squareTeamMemberId?: string | null;
  gustoEmployeeId?: string | null;
  adpEmployeeId?: string | null;
  hasAppAccess?: boolean;
  kioskPin?: string;
  gclid?: string;
  hiringPacketStatus?: {
    w4Completed: boolean;
    i9Completed: boolean;
    directDepositCompleted: boolean;
    handbookSigned: boolean;
    idUploaded: boolean;
    completedAt?: string;
  };
  mfaEnabled?: boolean;
  mfaSecret?: string;
  allowedLocationIds?: string[];
  customerPortalRole?: 'corporate' | 'regional' | 'branch';
  assignedDivisions?: string[];
  subcontractorId?: string | null;
}

// --- Customer & Assets ---
export interface EquipmentAsset {
    id: string;
    organizationId?: string;
    customerId?: string;
    locationId?: string;
    propertyId?: string;
    name?: string;
    brand: string;
    model: string;
    serial: string;
    modelNumber?: string;
    serialNumber?: string;
    indoorModel?: string;
    indoorSerial?: string;
    ageYears?: number | string;
    systemNickname?: string;
    type: string;
    tonnage?: number;
    refrigerantType?: string;
    year?: string;
    heatType?: string;
    electricityType?: string;
    seerRating?: string;
    filterType?: string;
    volts?: string;
    amps?: string;
    phase?: string;
    refrigerantCharge?: string;
    btuCapacity?: string;
    compressorType?: string;
    blowerType?: string;
    location?: string; // Legacy text location
    physicalLocation?: string; // e.g. Roof, Mechanical Room
    exactPlacement?: string;   // e.g. Front left corner, North wall near ladder
    servesArea?: string;       // e.g. Dining room, Kitchen
    zone?: string;             // e.g. Zone 1, RTU Zone
    assetTag?: string;         // e.g. TK-RTU-000142
    installDate?: string;
    condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    status?: 'Operational' | 'Down' | 'Waiting for Parts' | 'Blower Motor Burnt Out' | string;
    
    // Photos
    serialPhotoUrl?: string;
    serialPhotoLabel?: string;
    unitTagPhotoUrl?: string;
    unitTagPhotoLabel?: string;
    conditionPhotoUrl?: string;
    conditionPhotoLabel?: string;
    wideLocationPhotoUrl?: string;
    wideLocationPhotoLabel?: string;
    accessPointPhotoUrl?: string;
    accessPointPhotoLabel?: string;
    qrCodePhotoUrl?: string;
    qrCodePhotoLabel?: string;
    
    notes?: string;
    linkedAssetIds?: string[];
    warranty?: AssetWarranty;
    
    // Geographical Positioning
    gpsPin?: { lat: number; lng: number };
    
    // Refrigeration / Linked System Relationship
    systemGroupId?: string;
    systemGroupName?: string;
    systemGroupRole?: 'Evaporator' | 'Condensing Unit' | 'Controller' | 'Compressor' | 'Standalone' | string;

    // Component & Parts Replacement Tracking
    replacedParts?: ReplacedPartRecord[];
}

export interface ReplacedPartRecord {
    id: string;
    name: string;
    partNumber?: string;
    sku?: string;
    quantity?: number;
    unitPrice?: number;
    replacedAt?: string;
    jobId?: string;
    poNumber?: string;
    technicianName?: string;
    warrantyDurationMonths?: number;
    notes?: string;
    photoUrl?: string;
    equipmentId?: string;
    equipmentName?: string;
}

export interface AssetWarranty {
    manufacturerDurationMonths?: number;
    manufacturerStartDate?: string;
    manufacturerTerms?: string;
    manufacturerClaimUrl?: string; // or info on how to claim
    laborDurationMonths?: number;
    laborStartDate?: string;
    laborTerms?: string;
    requiresMaintenance?: boolean;
    maintenanceIntervalMonths?: number;
    lastMaintenanceDate?: string;
    warrantyNotes?: string;
}

export interface WarrantyClaim {
    id: string;
    organizationId: string;
    customerId: string;
    customerName: string;
    equipmentId?: string;
    jobId?: string; // Job where the warranty work was performed
    status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Credit Received' | 'Part Received';
    claimType: 'Manufacturer Parts' | 'Manufacturer Labor' | 'In-House Workmanship';
    claimDate: string;
    amountClaimed?: number;
    amountApproved?: number;
    notes?: string;
    trackingNumber?: string;
    rmaNumber?: string;
    createdAt?: string;
}

export interface LayoutHotspot {
    id: string;
    equipmentId?: string;
    label: string;
    x: number;
    y: number;
    isManual?: boolean;
}

export interface ServiceLocation {
   id: string;
   name: string;
   propertyName?: string;
   subLocationName?: string;
   storeNumber?: string;
   locationNumber?: string;
   mall?: string;
   building?: string;
   address: string;
   city?: string;
   state?: string;
   zip?: string;
   gateCode?: string;
   notes?: string;
   parentId?: string | null;
   locationType?: string;
   contacts?: { name: string; phone: string; email?: string; role?: string }[];
   photos?: string[];
   layoutPhotoUrl?: string;
   layoutProfessionalSvg?: string;
   layoutHotspots?: LayoutHotspot[];
   layoutVertices?: { id: string; x: number; y: number }[];
   layoutCustomShapes?: any[];
   poNumber?: string;
   billToSameAsSite?: boolean;
   billToName?: string;
   billToAddress?: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  accountNumber?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  address: string; 
  customerType: 'Residential' | 'Commercial' | 'Property Management'; 
  dispatchTeamIds?: string[];
  email: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  hvacSystem: { brand: string; type: string; installDate?: string | null; };
  equipment?: EquipmentAsset[];
  warrantyContracts?: WarrantyContract[];
  serviceHistory: Record<string, unknown>[];
  notes?: string | null;
  files?: StoredFile[]; 
  marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; ip?: string; gclid?: string; unsubscribedAt?: string | null; optOutReason?: string | null; auditNotes?: string | null; };
  profilePhotoUrl?: string | null;
  preferredContactMethod?: 'Phone' | 'SMS' | 'Email';
  bestTimeToContact?: string;
  languagePreference?: string;
  propertyType?: string;
  ownershipStatus?: 'Owner' | 'Renter';
  landlordInfo?: { name: string; phone: string };
  accessInstructions?: { type: string; code?: string };
  technicianNotes?: string;
  savedProviders?: string[]; 
  serviceLocations?: ServiceLocation[];
  contacts?: import('./customer').CustomerContact[];
  billingContact?: { name: string; email: string; phone: string; };
  agreedToCustomerTerms?: boolean | null;
  customerTermsAgreedAt?: string | null;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  blacklistedAt?: string;
  blacklistedBy?: string;
  vendorCompliance?: { 
      w9Url?: string; 
      coiUrl?: string; 
      vendorAgreementUrl?: string; 
      vendorStatus?: string;
      vendorNumber?: string;
      correspondenceDate?: string;
      correspondenceDateFormatted?: string;
      tekAirContactEmail?: string;
      requiredForms?: string[];
      onboardingStatus?: string;
      notes?: string;
  };
  pricingRules?: { 
      standardRate?: number; 
      emergencyRate?: number; 
      tripCharge?: number; 
      tripFee?: number;
      emergencyTripCharge?: number;
      emergencyTripFee?: number;
      markupPercentage?: number; 
      partsMarkupPercentage?: number;
      partsMarkupRules?: import('./customer').CustomerMarkupRule[];
      partsMarkupTier1?: number;
      partsMarkupTier2?: number;
      partsMarkupNotes?: string;
      contractedRate?: number;
      emergencyContractedRate?: number;
      overtimeRate?: number;
      overtimeLaborRate?: number;
      overtimeContractedRate?: number;
      travelTime?: string;
      travelIncluded?: boolean;
      visibility?: import('./customer').CustomerRateVisibility;
  };
  rateVisibility?: import('./customer').CustomerRateVisibility;
  submissionRules?: import('./customer').CustomerSubmissionRules;
  paymentTerms?: string | null;
  taxExempt?: boolean;
  taxExemptCertUrl?: string;
  taxExemptNumber?: string;
  maintenanceAgreement?: MaintenanceAgreement | null;
}

// --- Job & Scheduling ---
export interface CheckInLogEntry {
    id: string;
    action: 'check_in' | 'check_out';
    method: 'Twilio SMS' | 'Twilio IVR' | 'Native SMS' | 'Native Call' | 'Manual' | string;
    status: 'success' | 'failed';
    timestamp: string;
    woNumber: string;
    phoneNumber: string;
    techId?: string;
    techName?: string;
    responseMessage?: string;
    dtmfPayload?: string;
}

export interface Job {
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  deleted?: boolean;
  deletedAt?: string;
  discrepancyDismissed?: boolean;
  hideRolledInNotice?: boolean;
  duration?: number;
  timeOnSiteMinutes?: number;
  checkInLogs?: CheckInLogEntry[];
  timeEntries?: Array<{
    checkInTime: string;
    checkOutTime?: string | null;
    timeOnSiteMinutes?: number | null;
  }>;
  linkedJobIds?: string[];
  linkedInvoiceIds?: string[];
  linkedProposalIds?: string[];
  parentJobId?: string | null;
  isFollowUp?: boolean;
  isServicePlan?: boolean | null;
  servicePlanType?: 'membership' | 'maintenanceAgreement' | string | null;
  servicePlanId?: string | null;
  workOrderNumber?: string | null;
  nteLimit?: number | null;
  accountManagerContact?: {
    name?: string;
    phone?: string;
    extension?: string;
    email?: string;
    title?: string;
  } | null;
  pocContact?: {
    name?: string;
    phone?: string;
    extension?: string;
    email?: string;
    title?: string;
    role?: string;
  } | null;
  signatureMetadata?: any;
  signatureHistory?: any[];
  signatureUrl?: string | null;
  jobRecordSignedOff?: boolean;
  jobRecordSignedOffAt?: string;
  jobRecordSignedOffBy?: string;
  jobRecordSignedOffNotes?: string;
  signOff?: any;
  signOffSheetUrl?: string | null;
  signoffSheetUrl?: string | null;
  customWorkOrderFormUrl?: string | null;
  signOffSignature?: string | null;
  customerSignature?: string | null;
  customerSignatureName?: string | null;
  siteManagerSignature?: string | null;
  siteManagerName?: string | null;
  techSignature?: string | null;
  techSignatureName?: string | null;
  signature?: string | null;
  signerName?: string | null;
  signatureTimestamp?: string | null;
  signedAt?: string | null;
  workflowState?: any;

  checkInTime?: string;
  checkOutTime?: string;
  transitStartTime?: string;
  id: string;
  organizationId: string;
  assignedPartnerId?: string | null; 
  partnerAllowDirectPayment?: boolean | null;
  customerName: string;
  firstName?: string | null;
  lastName?: string | null;
  address: string; 
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  serviceLocationCity?: string | null;
  serviceLocationState?: string | null;
  serviceLocationZip?: string | null;
  serviceLocationAddress?: string | null;
  billToName?: string | null;
  billToAddress?: string | null;
  tasks: string[];
  customerId?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  poNumber?: string | null;
  linkedPoNumbers?: string[];
  linkedWorkOrderNumbers?: string[];
  jobNumber?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  jobStatus: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Needs Follow-up' | 'Needs Review';
  needsAdminVerification?: boolean;
  repairPostponed?: boolean;
  repairPostponedReason?: string;
  scheduledDate?: string;
  appointmentTime: string; 
  specialInstructions: string;
  serviceType?: string;
  isPaymentRequest?: boolean;
  paymentRequestId?: string;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
    assignedCrew?: string[];
  assistants?: string[];
  invoice?: InvoiceDetails | null;
  invoiceSignature?: string | null;
  invoiceSignedDate?: string | null;
  jobEvents: Record<string, unknown>[];
  notes?: {
      preRepair?: string;
      workNotes?: string;
      completion?: string;
      feedback?: string;
      employeeFeedback?: string;
      customerFeedback?: string;
      diagnosisChecklist?: string;
      qualityChecklist?: string;
      checklist?: string;
      internalNotes?: string;
      arrival?: string;
      diagnosis?: string;
      work?: string;
      thankYouNote?: string;
  };
  source?: string | null;
  hvacType?: string | null;
  hvacBrand?: string | null;
  projectId?: string | null;
  divisionId?: string | null;
  proposalId?: string | null;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  toolReadings?: ToolReading[];
  files?: StoredFile[];
  refrigerantLog?: Record<string, unknown>[]; 
  salesRepId?: string;
  total?: number; 
  paidAmount?: number;
  tipAmount?: number;
  payments?: InvoicePaymentRecord[];
  processedPaymentIntentIds?: string[];
  requiredWaiverIds?: string[];
  requiredDiagnosisChecklistIds?: string[];
  requiredQualityChecklistIds?: string[];
  embeddedData?: {
    inspectionTemplates?: InspectionTemplate[];
    waivers?: BusinessDocument[];
  } | null;
  partsUsed?: Array<{
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
    total?: number;
    location?: string;
  }>;
  qcAudits?: Array<{
    id: string;
    status: 'pass' | 'fail' | 'warning' | 'manual';
    comments: string;
    timestamp: string;
    imageUrl?: string;
  }>;
  techRecommendations?: string;
  visitType?: 'Diagnostic Only' | 'Diagnostic & Repair' | 'Diagnostic & Troubleshooting' | 'Repair' | 'Maintenance' | 'Service Call' | 'Emergency Repair (No Heat / No AC / Leak)' | 'Request for Proposal (RFP) / Capital Quote' | 'Scheduled Component Repair' | 'Seasonal Maintenance & Comprehensive Tune-Up' | 'System Installation & Retrofit' | 'Warranty Recall & Follow-Up Service' | 'Safety & Code Compliance Inspection' | 'Other' | string;
  includedUnitIds?: string[];
  unitStates?: Array<{
    assetId: string;
    includeOnWorkOrder?: boolean;
    health?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthBefore?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthAfter?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    diagnosis?: string;
    repair?: string;
    recommendations?: string;
    refrigerantType?: string;
    make?: string;
    model?: string;
    serialNumber?: string;
    mfd?: string;
    systemType?: string;
    location?: string;
  }>;
  subcontractorWorkOrder?: {
    nte: number;
    ivrPin: string;
    ivrNumber: string;
    visitInstructions: string[];
    specialInstructions: string;
    terms: string[];
    createdAt?: string;
    sentAt?: string;
    composedById?: string;
    composedByName?: string;
    subcontractorId?: string;
    status?: 'pending' | 'accepted' | 'declined';
    availabilityWindow?: {
      date: string;
      startTime: string;
      endTime: string;
      notes?: string;
    };
    organization?: {
      name: string;
      phone: string;
      address: string;
      logoUrl?: string;
    };
  };
  subcontractorId?: string | null;
  depositType?: 'flat' | 'percentage' | 'none';
  depositValue?: number;
  depositAmount?: number;
  depositRequired?: number;
  depositNotes?: string;
  depositPaid?: boolean;
  depositPaidAmount?: number;
  depositPaidDate?: string;
}


export interface Appointment {
    id: string;
    organizationId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    tasks: string[];
    appointmentTime: string;
    status: string;
    source?: string;
    specialInstructions?: string;
    customerId?: string;
    createdAt: string;
    marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; gclid?: string; };
}

// --- Invoice & Billing ---
export interface SubLineItem {
    id: string;
    description: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
}

export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount' | 'Service' | 'Tip'; 
    taxable?: boolean;
    name?: string; 
    isWarrantyWork?: boolean;
    isExtendedWarranty?: boolean;
    extendedWarrantyData?: {
        planSku?: string;
        planName?: string;
        coverageTier?: string;
        termYears?: number;
        equipmentId?: string;
        equipmentName?: string;
        serial?: string;
        wholesaleCost?: number;
        profit?: number;
    };
    isPercentage?: boolean;
    percentageRate?: number;
    subItems?: SubLineItem[];
    cost?: number;
    vendorCost?: number;
    markupPct?: number;
    tier?: string;
}

export interface InvoiceDetails {
    id: string;
    referenceNumber?: string | null;
    invoiceNumber?: string | null;
    number?: string | null;
    poNumber?: string | null;
    proposalId?: string | null;
    proposalNumber?: string | null;
    items: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paymentProofUrl?: string | null;
    paymentProofDate?: string | null; 
    status: 'Paid' | 'Unpaid' | 'Pending' | 'Partially Paid' | 'Failed' | 'Payment Pending';
    signatureUrl?: string | null;
    signatureMetadata?: any;
    signatureHistory?: any[];
    failedDate?: string | null;
    lastFailureReason?: string;
    dueDate?: string | null;
    invoiceDate?: string | null;
    date?: string | null;
    notes?: string | null;
    amountPaid?: number;
    amount: number; 
    paidDate?: string | null;
    billToName?: string;
    billToAddress?: string;
    accountingSynced?: boolean;
    accountingSyncDate?: string;
    paymentRecipientName?: string;
    paymentMethod?: string;
    recommendations?: string;
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    tipAmount?: number;
    sentAt?: string;
    remindersSent?: string[];
    opened?: boolean;
    openedAt?: string;
    paymentTerms?: string | null;
    displayFormat?: 'itemized' | 'progressive';
    retainagePercent?: number;
    retainageAmount?: number;
    workmanshipWarrantyMonths?: number;
    partsWarrantyMonths?: number;
    warrantyNotes?: string;
    warrantyDisclaimerAgreed?: boolean;
    warrantyIssuedDate?: string | null;
    membershipEnrollment?: any;

    // Down Payment / Deposit fields
    depositType?: 'flat' | 'percentage' | 'none';
    depositValue?: number;
    depositAmount?: number;
    depositRequired?: number;
    depositNotes?: string;
    depositPaid?: boolean;
    depositPaidAmount?: number;
    grandTotal?: number;
    balanceDue?: number;
    balanceRemaining?: number;
    amountDueToday?: number;
    amountDueNet?: number;
    paymentTermsLabel?: string;
    financialStatus?: 'PAID' | 'PARTIALLY_PAID' | 'DEPOSIT_PAID' | 'UNPAID' | 'OVERDUE';
    hideRolledInNotice?: boolean;
    payments?: InvoicePaymentRecord[];
    refunds?: InvoiceRefundRecord[];
    amountRefunded?: number;
    netPaid?: number;
    processedPaymentIntentIds?: string[];
}

export interface InvoiceRefundRecord {
    id: string;
    refundId?: string;
    paymentIntentId?: string;
    amount: number;
    date: string;
    reason?: string;
    method?: string;
    reference?: string;
    notes?: string;
    status?: string;
    createdAt?: string;
}

export interface InvoicePaymentRecord {
    id: string;
    paymentIntentId?: string;
    amount: number;
    baseAmount?: number;
    fee?: number;
    tip?: number;
    date: string;
    method?: string;
    reference?: string;
    notes?: string;
    status?: string;
    createdAt?: string;
}

// --- Proposals ---
export interface ProposalItem {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount' | 'Service'; 
    tier: 'Good' | 'Better' | 'Best' | 'Basic' | 'Premium' | 'Platinum' | string;
    partCost?: number;
    laborHours?: number;
    hourlyRate?: number;
    margin?: number;
    taxable?: boolean;
    cost?: number; 
    vendorCost?: number;
    markupPct?: number;
    subItems?: SubLineItem[];
}

export interface Proposal {
    id: string;
    referenceNumber?: string | null;
    proposalNumber?: string | null;
    organizationId: string;
    customerId?: string;
    customerName: string;
    locationId?: string | null;
    locationName?: string | null;
    serviceLocationName?: string | null;
    items: ProposalItem[];
    total: number;
    subtotal: number;
    taxAmount: number;
    status: string;
    createdAt: string;
    updatedAt?: string;
    sentDate?: string;
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    createdById?: string;
    createdByName?: string;
    technicianId: string;
    jobId?: string;
    linkedJobIds?: string[];
    divisionId?: string;
    invoiceId?: string | null;
    customerEmail?: string;
    customerPhone?: string;
    selectedOption?: string | null;
    signature?: string | null;
    signatureDataUrl?: string | null;
    recommendations?: string;
    pricingDisclaimer?: string | null;
    warrantyTerms?: string | null;
    warrantyDisclaimer?: string | null;
    tierItems?: any[];
    lineItems?: any[];
    title?: string | null;
    sentAt?: string;
    remindersSent?: string[];
    proposalTermsAgreed?: boolean | null;
    proposalTermsAgreedAt?: string | null;
    ndaSigned?: boolean | null;
    ndaSignedAt?: string | null;
    ndaSignerName?: string | null;
    ndaSignatureDataUrl?: string | null;
    competitorAgreementAgreed?: boolean | null;
    competitorAgreementAgreedAt?: string | null;
    archived?: boolean;
    archivedAt?: string | null;
    archivedBy?: string | null;

    // Project-level proposal fields
    isProjectLevel?: boolean;
    projectId?: string | null;
    projectName?: string | null;
    locationAddress?: string;
    poNumber?: string;
    scid?: string;
    validUntil?: string;
    customProposalNumber?: string;
    workOrderNumber?: string;
    accountNumber?: string;
    laborItems?: ProjectProposalLaborItem[];
    laborSubtotal?: number;
    roundedLaborProposal?: number;
    roundedLaborBasis?: string;
    partItems?: ProjectProposalPartItem[];
    partsTotal?: number;
    markupScheduleJson?: string;
    allowanceItems?: ProjectProposalAllowanceItem[];
    allowanceTotal?: number;
    clarifications?: string[];
    exclusions?: string[];
    importantClarification?: string;
    calculatedTotal?: number;
    recommendedRoundedTotal?: number;
    preparedByOrganization?: string;
    preparedByPhone?: string;
    preparedByLicence?: string;
    signedAt?: string | null;
    signatureName?: string | null;
    taxRate?: number;
    processingFeeRate?: number;
    processingFeeAmount?: number;
    trackingHistory?: ProposalTrackingEntry[];

    // Down Payment / Deposit fields
    requireDeposit?: boolean;
    depositType?: 'flat' | 'percentage' | 'none';
    depositValue?: number;
    depositAmount?: number;
    depositRequired?: number;
    depositNotes?: string;
    depositPaid?: boolean;
    depositPaidAmount?: number;
    amountPaid?: number;
    totalAmount?: number;
    grandTotal?: number;
    balanceDue?: number;
    balanceRemaining?: number;
    amountDueToday?: number;
    amountDueNet?: number;
    paymentTermsLabel?: string;
    financialStatus?: 'PAID' | 'PARTIALLY_PAID' | 'DEPOSIT_PAID' | 'UNPAID' | 'OVERDUE';
    displayFormat?: 'itemized' | 'progressive';
}

export interface ProposalTrackingEntry {
    status: string;
    timestamp: string;
    updatedBy: string;
    notes?: string;
}

export interface ProposalPreset {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    baseCost: number;
    avgLabor: number;
    category?: string;
}

// --- Projects & Tasks ---
export interface ProjectNote {
    id: string;
    author: string;
    content: string;
    timestamp: string;
}

export interface ProjectSubtask {
    id: string;
    title: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    assignedTo?: string;
}

export interface TaskComment {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: string;
}

export interface ProjectTask {
    id: string;
    description: string;
    status: 'Pending' | 'In Progress' | 'Blocked' | 'Review' | 'Completed';
    isBenchmark: boolean;
    dueDate?: string;
    assignedTo?: string;
    subtasks?: ProjectSubtask[];
    dependencies?: string[]; // Array of Task IDs
    priority?: 'Low' | 'Medium' | 'High' | 'Critical';
    swimlane?: string;
    phaseId?: string;
    deliverableId?: string;
    workPackageId?: string;
    // Scrum/Agile fields
    storyPoints?: number;
    estimatedHours?: number;
    actualHours?: number;
    sprintId?: string;
    labels?: string[];
    acceptanceCriteria?: string[];
    comments?: TaskComment[];
    blockedReason?: string;
    completedAt?: string;
    createdAt?: string;
    order?: number;
}

export interface WorkPackage {
    id: string;
    name: string;
    description?: string;
    assignedTeam?: string;
    tasks: ProjectTask[];
}

export interface Deliverable {
    id: string;
    name: string;
    description?: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    dueDate?: string;
    workPackages: WorkPackage[];
}

export interface ProjectPhase {
    id: string;
    name: string;
    description?: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    startDate?: string;
    endDate?: string;
    deliverables: Deliverable[];
}

export interface RiskLogEntry {
    id: string;
    title: string;
    description: string;
    probability: 'Low' | 'Medium' | 'High';
    impact: 'Low' | 'Medium' | 'High';
    status: 'Open' | 'Mitigated' | 'Closed';
    mitigationPlan?: string;
}

export interface Permit {
    id: string;
    number: string;
    type: string;
    status: 'Pending' | 'Approved' | 'Failed' | 'Closed';
    issueDate?: string;
    inspectionDate?: string;
    expirationDate?: string;
    notes?: string;
    files?: StoredFile[];
}

export interface Sprint {
    id: string;
    name: string;
    goal?: string;
    status: 'Planning' | 'Active' | 'Completed' | 'Cancelled';
    startDate: string;
    endDate: string;
    taskIds: string[];
    velocity?: number;
    retrospectiveNotes?: string;
    createdAt?: string;
}

export interface Project {
    id: string;
    organizationId: string;
    name: string;
    customerId: string;
    customerName: string;
    status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
    startDate: string;
    endDate: string; 
    budget: number;
    description?: string;
    address?: string;
    managerId?: string; 
    teamIds?: string[]; 
    assignedSubcontractorIds?: string[]; 
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
    notesList?: ProjectNote[];
    projectTasks?: ProjectTask[];
    phases?: ProjectPhase[];
    backlog?: ProjectTask[];
    sprints?: Sprint[];
    riskLog?: RiskLogEntry[];
    permits?: Permit[];
    files?: StoredFile[];
    removedFiles?: StoredFile[];
    excludedFileIds?: string[];
    defaultView?: 'board' | 'list' | 'wbs';
}

// --- Inventory & Tools ---
export interface InventoryItem {
    id: string;
    organizationId: string;
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    quantity: number;
    minQuantity: number;
    cost: number;
    price: number;
    location: string;
    lastUpdated: string;
}

export interface ToolReading {
    id: string;
    toolType: string;
    date: string;
    technicianId: string;
    data: Record<string, unknown>;
    results: Record<string, unknown>;
    summary: string;
    reportUrl?: string;
    type?: string; 
    phase?: 'before' | 'after';
}

export interface ToolMaintenanceLog {
    id: string;
    organizationId: string;
    date: string;
    toolType: string;
    serialNumber: string;
    action?: string;
    result?: string;
    nextDueDate?: string;
    notes?: string;
}

// --- Fleet & Time ---
export interface Vehicle {
    id: string;
    organizationId: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    vin: string;
    barcode: string;
    assignedUserId: string;
    maintenanceInterval?: number;
    lastServiceMileage?: number;
}

export interface VehicleLog {
    id: string;
    organizationId?: string;
    vehicleId?: string;
    userId: string;
    userName?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    type: 'Mileage' | 'Fuel' | 'Maintenance';
    category?: string;
    cost?: number;
    amount?: number;
    subtotal?: number;
    tax?: number;
    taxAmount?: number;
    vendor?: string;
    vendorName?: string;
    paidBy?: string;
    mileage?: number;
    miles?: number;
    startMileage?: number;
    endMileage?: number;
    isCompanyVehicle?: boolean;
    notes?: string;
    description?: string;
    receiptData?: string | null;
    receiptUrl?: string | null;
    receiptUrls?: string[];
    receipt?: string;
    location?: { lat: number; lng: number };
    startLocation?: { lat: number; lng: number };
    endLocation?: { lat: number; lng: number };
}

export interface ShiftEdit {
    timestamp: string;
    adminName: string;
    originalClockIn: string;
    originalClockOut?: string | null;
    newClockIn: string;
    newClockOut?: string | null;
    reason: string;
}

export interface ShiftLog {
    id: string;
    organizationId?: string;
    userId: string; 
    clockIn: string; 
    clockOut?: string | null; 
    date?: string;
    hoursWorked?: number;
    status?: string;
    clockInLocation?: any;
    clockOutLocation?: any;
    edits?: ShiftEdit[];
    isApproved?: boolean | null;
    startLocation?: { lat: number; lng: number; accuracy: number };
    endLocation?: { lat: number; lng: number; accuracy: number };
}

// --- Marketing & Sales ---
export interface MarketingCampaign {
    id: string;
    organizationId: string;
    name: string;
    platform: 'Google Ads' | 'Meta Ads' | 'TikTok' | 'Email' | 'Other' | 'Nextdoor';
    startDate: string;
    endDate?: string | null;
    spend: number;
    status: 'Active' | 'Paused' | 'Ended';
    impressions?: number;
    clicks?: number;
}

export interface Lead {
    id: string;
    organizationId: string;
    customerName: string;
    email?: string;
    phone?: string;
    source?: string;
    status: string;
    notes?: string;
    createdAt: string;
}

// --- Compliance & Incidents ---
export interface RefrigerantCylinder {
    id: string;
    organizationId: string;
    tag: string;
    type: string; 
    status: 'Full' | 'In Use' | 'Empty';
    totalWeight: number; 
    remainingWeight: number; 
    assignedTechId?: string;
    createdAt?: string;
}

export interface RefrigerantTransaction {
    id: string;
    organizationId: string;
    date: string;
    action: string;
    cylinderId?: string;
    type?: string;
    amount: number;
    customerId?: string;
    customerName?: string;
    technicianId?: string;
    technicianName?: string;
    notes?: string;
    createdAt?: string;
}

export interface IncidentReport {
    id: string;
    organizationId: string;
    reporterId: string;
    reporterName: string;
    date: string;
    type: 'Injury' | 'Vehicle' | 'Hazmat' | 'Property Damage' | 'Other';
    description: string;
    status: 'Open' | 'Resolved';
    resolutionNotes?: string;
    attachmentUrls?: string[];
    createdAt?: string;
}

// --- Platform & Master ---
export interface PlatformSettingsPlan {
    monthly: number;
    annual: number;
    maxUsers: number;
    unlimitedUsers?: boolean;
    ribbonText?: string;
    features?: string[];
    aiTokensPerMonth?: number;
    supportResponseTime?: string;
    includedStorageGB?: number;
    storageOverageRatePerGB?: number;
}

export interface SupportTicket {
    id: string;
    organizationId: string;
    organizationName: string;
    customerName: string;
    customerEmail: string;
    subject: string;
    description: string;
    plan: 'starter' | 'growth' | 'business' | 'enterprise' | 'payments_only';
    slaLabel: string;
    slaHours: number;
    createdAt: string;
    targetDueDate: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Breached';
    isPlatformIssue?: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
}

export interface PlatformSettings {
    id: string;
    plans: {
        starter: PlatformSettingsPlan;
        growth: PlatformSettingsPlan;
        business?: PlatformSettingsPlan;
        enterprise: PlatformSettingsPlan;
        payments_only: PlatformSettingsPlan;
        [key: string]: PlatformSettingsPlan | undefined;
    };
    excessUserFee: number;
    subscriptionFee?: number;
    virtualWorkerFee?: number;
    virtualWorkerLifetimeFee?: number;
    aiPowerPackPrice?: number;
    aiPowerPackTokens?: number;
    divisionFee?: number;
    smsRate?: number;
    voiceRate?: number;
    phoneLineFee?: number;
    aiTokenOverageRatePer1k?: number;
    aiVoiceAssistantMonthlyFee?: number;
    aiVoiceAssistantRatePerMinute?: number;
    updatedAt: string;
    franchiseFeePct?: number;
    franchiseBaseFee?: number;
    franchiseSetupFee?: number;
    franchiseLifetimeFee?: number;
    franchiseRevSharePerUser?: number;
    franchiseRevSharePerVirtualWorker?: number;
    franchiseDiscountCodes?: { code: string; discountPct: number; active: boolean }[];
}

export interface PlatformLead {
    id: string;
    repId?: string;
    companyName?: string;
    contactName?: string;
    company?: string;
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    value?: number;
    source?: string;
    status?: 'New' | 'Contacted' | 'Demo Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Closed Won' | 'Closed Lost' | string;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
    lastUpdated?: any;
    convertedOrgId?: string;
    additionalContacts?: { name: string; role: string; email: string; phone: string }[];
}

export interface PlatformCommission {
    id: string;
    repId: string;
    organizationId: string; 
    organizationName: string;
    amount: number;
    status: 'Pending' | 'Paid';
    dateEarned: string;
    datePaid?: string;
    baseAmount: number; 
    rateUsed: number;
    customerPaymentStatus?: 'Unpaid' | 'Paid';
    createdAt?: string;
    isAnnual?: boolean;
    mrrValue?: number;
}

export interface SalesIncentiveContest {
    id?: string;
    title: string;
    description: string;
    rewardType: 'prize' | 'cash' | 'raffle' | 'experience' | 'custom';
    rewardValue: string; // e.g. '75" 4K Smart TV' or '$1,000 Cash'
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    criteriaType: 'top_volume' | 'top_deals' | 'threshold_volume' | 'threshold_deals' | 'raffle';
    targetThreshold?: number; // e.g. 2500 for $2,500 MRR or 8 for 8 deals
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

// --- Miscellaneous ---
export interface StoredFile {
    id: string;
    organizationId: string;
    parentId?: string;
    parentType?: 'job' | 'customer' | 'project' | 'bid';
    fileName: string;
    fileType: string;
    dataUrl: string;
    createdAt: string;
    uploadedBy: string;
    metadata?: Record<string, unknown>;
    label?: string; // High-res label for quicker filtering
    assetId?: string; // Equipment unit linkage ID
    url?: string;
}

export type DriveAccessLevel = 
    | 'inherit' 
    | 'all_staff' 
    | 'management_only' 
    | 'technicians_only' 
    | 'office_only' 
    | 'admins_only' 
    | 'custom_roles';

export interface CompanyDriveFolder {
    id: string;
    organizationId: string;
    name: string;
    parentId: string | null;
    color?: string;
    accessLevel: DriveAccessLevel;
    allowedRoles?: string[];
    description?: string;
    createdAt: string;
    createdBy: string;
    createdById?: string;
    updatedAt: string;
}

export interface CompanyDriveFile {
    id: string;
    organizationId: string;
    folderId: string | null;
    fileName: string;
    label: string;
    fileType: string;
    url: string;
    dataUrl?: string;
    sizeBytes: number;
    accessLevel: DriveAccessLevel;
    allowedRoles?: string[];
    allowedUserIds?: string[];
    isLocked?: boolean;
    tags?: string[];
    description?: string;
    version?: number;
    createdAt: string;
    createdBy: string;
    createdById?: string;
    updatedAt: string;
}

export interface Notification {
    id: string;
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    read: boolean;
    readBy?: string[];
    link?: string;
    createdAt: string;
    type?: string;
    data?: Record<string, any>;
    senderId?: string;
    body?: string;
    url?: string;
}

export interface MessageAttachment {
    name: string;
    url: string;
    type: string;
    size?: number;
}

export interface Message {
    id: string;
    organizationId: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    content: string;
    timestamp: string;
    createdAt?: string;
    read: boolean;
    type: 'text' | 'sms' | 'email' | 'customer-log' | 'alert';
    deliveryStatus?: 'queued' | 'sent' | 'failed';
    deliveryError?: string;
    isEdited?: boolean;
    attachments?: MessageAttachment[];
    senderEmail?: string;
    senderRole?: string;
    receiverName?: string;
    receiverPhone?: string;
    receiverEmail?: string;
}

export interface BusinessDocument {
    id: string;
    organizationId: string;
    title: string;
    type: 'Other' | 'Service Agreement' | 'Contract' | 'Policy' | 'Letter' | 'Membership Terms' | 'Handbook' | 'Master Upload' | 'Waiver Template' | 'Master Template' | 'Tax Form' | '1099-NEC' | 'Hiring Packet';
    content: string; 
    createdAt: string;
    createdBy: string;
    context?: string;
    jobId?: string;
    url?: string;
    customerId?: string; 
}

export interface Applicant {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    name?: string;
    email: string;
    phone: string;
    position: string;
    experienceYears: number | string;
    status: string;
    appliedDate: string;
    applicationDate?: string;
    resumeDataUrl?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    notes?: string;
    marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; };
    desiredSalary?: number | string;
    referredBy?: string;
    skills?: string[];
    availability?: string[];
    driversLicense?: string;
    license?: string;
    workAuthorized?: boolean;
    address?: string;
    smsOptIn?: boolean;
}

export interface InspectionTemplateItem {
    id: string;
    label: string;
    type: 'PassFail' | 'Text' | 'Textarea' | 'Photo' | 'Checkbox' | 'CheckboxGroup' | 'Date' | 'Signature' | 'YesNo';
    required: boolean;
    options?: string[];
}

export interface InspectionTemplate {
    id: string;
    organizationId: string;
    name: string;
    items: InspectionTemplateItem[];
    createdAt: string;
    updatedAt: string;
    isHiringPacket?: boolean;
}

export interface ServiceAgreement {
    id: string;
    organizationId: string;
    customerId: string;
    customerName: string;
    planName: string; 
    price?: number; 
    billingCycle?: 'Monthly' | 'Annual' | string;
    startDate?: string;
    endDate?: string; 
    status: 'Active' | 'Expired' | 'Cancelled';
    visitsTotal?: number; 
    visitsRemaining?: number;
    termsAccepted?: boolean;
    termsContentSnapshot?: string;
    termsSignedDate?: string;
    termsSignature?: string;
    systemCount?: number;
    autoBillingId?: string;
    autoBillingProcessor?: string;
    agreementType?: 'membership' | 'contractor' | 'commercial_contract' | 'msa' | string;
    isContractorAgreement?: boolean;
    excludeFromMrr?: boolean;
    contractNumber?: string;
    effectiveDate?: string;
    agreementDate?: string;
    paymentTerms?: string;
    laborRate?: number;
    overtimeRate?: number;
    tripCharge?: number;
    partsMarkupTier1?: number;
    partsMarkupTier2?: number;
    subcontractorMarkupTier1?: number;
    subcontractorMarkupTier2?: number;
    salesMarketingFeePct?: number;
    refrigerant40PctMarkup?: boolean;
    signers?: string;
    siteCount?: number;
    notes?: string;
    documentHtml?: string;
    documentUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface MembershipPlan {
    id: string;
    organizationId: string;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    discountPercentage: number;
    discountScope?: 'Labor' | 'Part' | 'Both';
    visitsPerYear: number;
    color: string;
    benefits?: string[];
    pricePerAdditionalSystem?: number;
    addonFeeName?: string;
    addonFeeAmount?: number;
    addonFeePercent?: number;
}

export interface Expense {
    id: string;
    organizationId: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    subtotal?: number;
    taxAmount?: number;
    vendor?: string;
    paidBy?: string;
    paidById?: string;
    paidByName?: string;
    projectId?: string | null;
    inventoryItemId?: string | null;
    receiptData?: string | null;
    receiptUrl?: string | null;
    receiptUrls?: string[];
    createdAt?: string;
    createdById?: string;
    createdByName?: string;
    updatedAt?: string;
    updatedById?: string;
    updatedByName?: string;
    expenseType?: 'business' | 'personal';
    receiptNumber?: string;
    isPossibleDuplicate?: boolean;
    duplicateReason?: string;
    duplicateDismissed?: boolean;
}

export interface Subcontractor {
    id: string;
    organizationId: string;
    companyName: string;
    contactName: string;
    trade: string;
    email: string;
    phone: string;
    licenseNumber?: string;
    contactPhone?: string;
    status: 'Active' | 'Inactive';
    insuranceExpiry?: string;
    rating?: number;
    notes?: string;
    linkedOrgId?: string | null;
    handshakeStatus?: 'None' | 'Pending' | 'Linked';
    referralCode?: string;
    referralExpiry?: string;
    allowDirectPayment?: boolean;
    paymentType: 'perJob' | 'percentage';
    paymentPercentage?: number;
    complianceDocs?: SubcontractorComplianceDoc[];
    contracts?: SubcontractorContract[];
    temporaryComplianceBypass?: boolean;
    complianceBypassReason?: string;
}

export interface ChargebackEvidencePhoto {
    url: string;
    caption?: string;
    timestamp?: string;
    uploadedBy?: string;
}

export interface ChargebackReceipt {
    url: string;
    name: string;
    amount?: number;
    type?: 'receipt' | 'work_order' | 'invoice' | 'material_bill';
    notes?: string;
}

export interface SubcontractorChargeback {
    id: string;
    organizationId: string;
    subcontractorId: string;
    subcontractorName: string;
    jobId?: string;
    workOrderNumber?: string;
    customerName?: string;
    category: 'property_damage' | 'faulty_work' | 'safety_violation' | 'material_loss' | 'other';
    title: string;
    description: string;
    amount: number;
    date: string;
    status: 'Pending' | 'Applied' | 'Disputed' | 'Waived';
    evidencePhotos: ChargebackEvidencePhoto[];
    receiptsAndInvoices: ChargebackReceipt[];
    resolutionWorkOrderJobId?: string;
    deductedFromPayableId?: string | null;
    createdAt: string;
    updatedAt?: string;
    createdBy?: { id: string; name: string; role?: string };
}

export interface EquipmentRental {
    id: string;
    organizationId: string;
    projectId?: string;
    equipmentName: string;
    vendor: string;
    startDate: string;
    endDate: string;
    cost: number;
    status: 'Active' | 'Returned';
    notes?: string;
}

export interface PaymentRequest {
    id: string;
    organizationId: string;
    customerId?: string | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    amount: number;
    title: string;
    description?: string | null;
    status: 'pending' | 'paid' | 'cancelled' | 'failed';
    type?: 'deposit' | 'custom' | 'retainer' | 'service_fee';
    jobId?: string | null;
    proposalId?: string | null;
    createdAt: string;
    createdBy?: string | null;
    paidAt?: string | null;
    paymentId?: string | null;
    paymentMethod?: string | null;
    signatureUrl?: string | null;
    signatureDate?: string | null;
    notes?: string | null;
    allowCustomAmount?: boolean;
    minAmount?: number;
    maxAmount?: number;
}

export interface OrganizationTeam {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    memberIds: string[]; // User IDs or Subcontractor IDs
    customerIds?: string[];
}

export interface PartOrder {
    id: string;
    organizationId: string;
    jobId: string;
    parts: string;
    cost: number;
    status: string;
    orderedBy?: string;
    createdAt?: string;
}

export interface ShopOrder {
    id: string;
    organizationId: string;
    customer: { name: string; email: string; };
    items: { name: string; quantity: number; }[];
    total: number;
    status: string;
    createdAt?: string | number | { toDate: () => Date };
}

export interface Bid {
    id: string;
    organizationId: string;
    title: string;
    agency?: string;
    solicitationNumber?: string;
    dueDate?: string;
    importantDates?: {name: string, date: string}[];
    status: string;
    requirements: string[];
    deliverables?: string[];
    summary?: string;
    notes?: string;
    submissionEmail?: string;
    submissionLink?: string;
    files: StoredFile[];
    lineItems?: BidLineItem[];
    questions?: BidQuestion[];
    generatedDocs?: BidDoc[];
    paymentStatus: 'Pending' | 'Paid';
    totalValue?: number;
    submittedDate?: string;
    projectId?: string;
    noticeId?: string;
    createdAt: string;
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    sentAt?: string;
    remindersSent?: string[];
}

export interface BidDoc {
    title: string;
    content: string;
    type?: 'html' | 'csv';
}

export interface BidLineItem {
    id: string;
    description: string;
    unit: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    source?: 'Manual' | 'AI Extracted' | 'Pricebook';
    aiRecommendedPrice?: number;
}

export interface BidQuestion {
    id: string;
    question: string;
    answer: string;
    source?: string;
}

export interface RFPNotice {
    id: string;
    organizationId: string; // The GC/Originator
    title: string;
    description: string;
    trade: string; // Legacy/Primary trade
    trades?: string[]; // Multiple components/trades
    location: string;
    budgetRange: string;
    dueDate: string;
    status: 'Open' | 'Closed' | 'Partially Awarded' | 'Awarded';
    awardedTo?: string; // Legacy single awardee
    awardedToIds?: string[]; // Multiple awardees
    visibility: 'Public' | 'Private';
    requirements: string[];
    files: string[];
    projectId?: string; // Project to auto-assign winner to
    createdAt: string;
}

export interface RFPBidSubmission {
    id: string;
    noticeId: string;
    bidderOrgId: string; // The Subcontractor
    status: 'Pending' | 'Accepted' | 'Rejected';
    proposedAmount: number;
    estimatedDays: number;
    proposalUrl?: string; // Link to the document or internal reference
    notes: string;
    createdAt: string;
}

export interface WorkSchedule {
    id: string;
    organizationId: string;
    userId: string;
    dayOfWeek: number; 
    startTime: string; 
    endTime: string; 
    isOff: boolean;
}

export interface ServiceItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    avgLabor: number;
    quantity?: number;
}

export interface Review {
    id: string;
    organizationId: string;
    platform?: string; 
    customerName: string;
    rating: number;
    content: string;
    date: string;
    responded?: boolean; 
    responseContent?: string;
    aiDraft?: string | null;
    customerId?: string; 
    status?: 'pending' | 'approved' | 'rejected'; 
}

export interface Franchise { id: string; name: string; status: string; currentRoyaltyPct: number; currentMarketingFeePct: number; franchiseAgreementSignature?: string; franchiseAgreementSignedDate?: string; overrideSetupFee?: number; stripeAccountId?: string | null; ownerId?: string; createdAt: string; }

export interface ProjectProposalLaborItem {
    id: string;
    unitName: string;
    scope: string;
    hours: number;
    rate: number;
    value: number;
}

export interface ProjectProposalPartItem {
    id: string;
    unitName: string;
    partName: string;
    quantity: number;
    vendorCost: number;
    markupPct: number;
    customerUnitPrice: number;
    customerLineTotal: number;
    availability: string;
}

export interface ProjectProposalAllowanceItem {
    id: string;
    description: string;
    basis: string;
    amount: number;
}

export interface UnitConsumableSpec {
  id: string;
  name: string;
  sizeOrPartNo: string;
  quantity: number;
  intervalMonths?: number;
  category?: 'Filter' | 'Belt' | 'Chemical' | 'Electrical' | 'Plumbing' | 'Custom';
  notes?: string;
}

export interface CoveredUnitMaintenanceRule {
  unitId: string;
  unitName?: string;
  serviceFrequency?: 'Monthly' | 'Bi-Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  consumables?: UnitConsumableSpec[];
  tasks?: string[];
  partsDiscountPct?: number;
  partsAllowance?: number;
  unitMonthlyFee?: number;
  notes?: string;
}

export interface MaintenanceVisit {
  id: string;
  targetMonth: string;
  targetDate?: string;
  title?: string;
  scope?: string;
  coveredUnitIds?: string[];
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Overdue';
  assignedTechId?: string;
  assignedTechName?: string;
  jobId?: string;
  notes?: string;
  completedAt?: string;
}

export interface MaintenanceAgreement {
  id: string;
  agreementName: string;
  tradeType?: 'HVAC' | 'Plumbing' | 'Electrical' | 'Refrigeration' | 'Fire Safety' | 'General' | string;
  status: 'Draft' | 'Active' | 'Cancelled' | 'Expired';
  startDate: string;
  endDate: string;
  value: number;
  billingFrequency: 'One-Time' | 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  paymentTerms: string;
  coveredItems: string[];
  coveredEquipmentIds: string[];
  coveredUnitRules?: CoveredUnitMaintenanceRule[];
  partsDiscountPercentage?: number;
  partsAllowanceTotal?: number;
  partsAllowanceRemaining?: number;
  frequency: 'Monthly' | 'Bi-Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  visits: MaintenanceVisit[];
  notes?: string;
  notificationsSent?: Array<{
    sentAt: string;
    type: 'Email' | 'SMS';
    recipient: string;
    visitId: string;
  }>;
}

export interface CustomerReferral {
    id: string;
    referrerUserId: string;
    referrerEmail: string;
    referrerName?: string;
    businessName: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    trade: string;
    notes?: string;
    status: 'Invited' | 'Demo Scheduled' | 'Trial Active' | 'Active Customer' | 'Closed Lost';
    subscriptionPlan?: string;
    estimatedMonthlyCommission?: number;
    totalEarnedCommission?: number;
    lastStatusUpdate?: string;
    createdAt: string;
}



