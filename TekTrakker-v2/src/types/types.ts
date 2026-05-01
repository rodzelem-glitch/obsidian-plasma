// Consolidated types for the Tektrakker project
// This file is used as a central hub for all type definitions via the 'types' alias.

// --- Organization & Address ---
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
    ueid?: string | null;
    cageCode?: string | null;
    hrFileCategories?: string[];
    primaryNaics?: string | null;
    licenseNumber?: string | null;
    letterheadDataUrl?: string | null;
    complianceFooter?: string | null;
    financingLink?: string | null;
    termsAndConditions?: string | null;
    membershipTerms?: string | null;
    footerImage?: string | null;
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
    subscriptionExpiryDate?: string | null;
    plan?: 'starter' | 'growth' | 'enterprise';
    cancellationReason?: string;
    cancellationFeedback?: string;
    canceledAt?: string;
    retentionOfferApplied?: string;
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
    unlockAllFeatures?: boolean;
    customDiscountPct?: number;
    quickbooksConnected?: boolean;
    aiPricebookEnabled?: boolean;
    virtualWorkerEnabled?: boolean;
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
    promoCode?: string | null;
    warrantyDisclaimer?: string;
    defaultWorkmanshipMonths?: number;
    defaultPartsMonths?: number;
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
  email?: string | null; 
  password?: string | null; 
  firstName: string;
  lastName: string;
  payRate: number | string; 
  payType?: 'hourly' | 'salary'; 
  billableRate?: number | null; 
  ptoAccrued: number; 
  role: 'master_admin' | 'admin' | 'employee' | 'both' | 'customer' | 'supervisor' | 'platform_sales' | 'Technician' | 'Subcontractor'; 
  reportsTo?: string | null; 
  hireDate?: string | null;
  ssn?: string | null; 
  taxId?: string;
  experienceYears?: number | null;
  emergencyContact?: { name: string; phone: string; };
  certifications?: { name: string; number?: string; expiryDate?: string; fileUrl?: string; }[];
  ptoAccrualRate?: number | null; 
  mileageRate?: number | null; 
  hasCompanyVehicle?: boolean | null;
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
  preferences?: any;
  permissions?: string[]; 
  marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; ip?: string; };
  signedPolicies?: Record<string, string>;
  digitalId?: string;
  salesContractSigned?: boolean;
  salesContractDate?: string;
  salesContractSignature?: string;
  salesContractContent?: string;
  profilePicUrl?: string;
  aiEstimatorEnabled?: boolean;
  w4Status?: 'Single' | 'Married' | 'Head of Household';
  w4DependentsAmount?: number;
  w4OtherIncome?: number;
  w4Deductions?: number;
  w4ExtraWithholding?: number;
  commissionRate?: number; 
  customCommissionSettings?: CommissionSettings;
  hasAppAccess?: boolean;
  kioskPin?: string;
}

// --- Customer & Assets ---
export interface EquipmentAsset {
    id: string;
    brand: string;
    model: string;
    serial: string;
    type: string;
    location?: string;
    installDate?: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  address: string; 
  customerType: 'Residential' | 'Commercial'; 
  email: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  hvacSystem: { brand: string; type: string; installDate?: string | null; };
  equipment?: EquipmentAsset[];
  serviceHistory: any[];
  notes?: string | null;
  files?: StoredFile[]; 
  marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; ip?: string; };
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
}

// --- Job & Scheduling ---
export interface Job {
  id: string;
  organizationId: string;
  assignedPartnerId?: string | null; 
  partnerAllowDirectPayment?: boolean | null;
  customerName: string;
  firstName?: string | null;
  lastName?: string | null;
  address: string; 
  tasks: string[];
  customerId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  jobStatus: 'Scheduled' | 'In Progress' | 'Completed';
  appointmentTime: string; 
  specialInstructions: string;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  assistants?: string[];
  invoice: InvoiceDetails;
  invoiceSignature?: string | null;
  invoiceSignedDate?: string | null;
  jobEvents: any[];
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
  };
  source?: string | null;
  hvacType?: string | null;
  hvacBrand?: string | null;
  projectId?: string | null;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  toolReadings?: ToolReading[];
  files?: StoredFile[];
  refrigerantLog?: any[]; 
  salesRepId?: string;
  total?: number; 
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
}

export interface Appointment {
    id: string;
    organizationId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    address: string;
    tasks: string[];
    appointmentTime: string;
    status: string;
    source?: string;
    specialInstructions?: string;
    customerId?: string;
    createdAt: string;
    marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; };
}

// --- Invoice & Billing ---
export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount' | 'Service'; 
    taxable?: boolean;
    name?: string; 
}

export interface InvoiceDetails {
    id: string;
    items: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number; 
    status: 'Paid' | 'Unpaid' | 'Pending';
    dueDate?: string | null;
    notes?: string | null;
    amount: number; 
    paidDate?: string | null;
    accountingSynced?: boolean;
    accountingSyncDate?: string;
    paymentRecipientName?: string;
    paymentMethod?: string;
}

// --- Proposals ---
export interface ProposalItem {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
    total: number;
    type: 'Labor' | 'Part' | 'Fee' | 'Service'; 
    tier: 'Good' | 'Better' | 'Best';
    partCost?: number;
    laborHours?: number;
    hourlyRate?: number;
    margin?: number;
    taxable?: boolean;
    cost?: number; 
}

export interface Proposal {
    id: string;
    organizationId: string;
    customerId?: string;
    customerName: string;
    items: ProposalItem[];
    total: number;
    subtotal: number;
    taxAmount: number;
    status: string;
    createdAt: string;
    createdById?: string;
    createdByName?: string;
    technicianId: string;
    jobId?: string;
    customerEmail?: string;
    selectedOption?: string | null;
    signature?: string | null;
    signatureDataUrl?: string | null;
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

export interface ProjectTask {
    id: string;
    description: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    isBenchmark: boolean;
    dueDate?: string;
    assignedTo?: string;
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
    notesList?: ProjectNote[];
    projectTasks?: ProjectTask[];
    permits?: Permit[];
    files?: StoredFile[];
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
    data: any;
    results: any;
    summary: string;
    reportUrl?: string;
    type?: string; 
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
    organizationId: string;
    vehicleId: string;
    userId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    type: 'Mileage' | 'Fuel' | 'Maintenance';
    cost: number;
    mileage: number;
    startMileage?: number;
    endMileage?: number;
    isCompanyVehicle?: boolean;
    notes: string;
    receiptData?: string | null;
    receiptUrl?: string | null;
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
    organizationId: string;
    userId: string; 
    clockIn: string; 
    clockOut?: string | null; 
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
    createdAt?: string;
}

// --- Platform & Master ---
export interface PlatformSettingsPlan {
    monthly: number;
    annual: number;
    maxUsers: number;
    unlimitedUsers?: boolean;
    paypalMonthlyId?: string;
    paypalAnnualId?: string;
    ribbonText?: string;
    features?: string[];
    aiTokensPerMonth?: number;
}

export interface PlatformSettings {
    id: string;
    plans: {
        starter: PlatformSettingsPlan;
        growth: PlatformSettingsPlan;
        enterprise: PlatformSettingsPlan;
        [key: string]: PlatformSettingsPlan;
    };
    excessUserFee: number;
    updatedAt: string;
    platformPaypalClientId?: string;
}

export interface PlatformLead {
    id: string;
    repId?: string;
    companyName: string;
    contactName: string;
    email?: string;
    phone?: string;
    value: number;
    status: 'New' | 'Contacted' | 'Demo Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
    notes?: string;
    createdAt: string;
    updatedAt?: string;
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
    metadata?: any;
    label?: string; // High-res label for quicker filtering
}

export interface Notification {
    id: string;
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    read: boolean;
    link?: string;
    createdAt: string;
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
}

export interface BusinessDocument {
    id: string;
    organizationId: string;
    title: string;
    type: 'Other' | 'Service Agreement' | 'Contract' | 'Policy' | 'Letter' | 'Membership Terms' | 'Handbook' | 'Master Upload' | 'Waiver Template' | 'Master Template' | 'Tax Form' | '1099-NEC';
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
    experienceYears: number;
    status: string;
    appliedDate: string;
    applicationDate?: string;
    resumeDataUrl?: string;
    resumeFileName?: string;
    notes?: string;
    marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; };
}

export interface InspectionTemplate {
    id: string;
    organizationId: string;
    name: string;
    items: any[];
    createdAt: string;
    updatedAt: string;
}

export interface ServiceAgreement {
    id: string;
    organizationId: string;
    customerId: string;
    customerName: string;
    planName: string; 
    price: number; 
    billingCycle: 'Monthly' | 'Annual';
    startDate: string;
    endDate: string; 
    status: 'Active' | 'Expired' | 'Cancelled';
    visitsTotal: number; 
    visitsRemaining: number;
    termsAccepted?: boolean;
    termsContentSnapshot?: string;
    termsSignedDate?: string;
    termsSignature?: string;
    systemCount?: number;
    autoBillingId?: string;
    autoBillingProcessor?: string;
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
    paypalPlanId?: string;
    pricePerAdditionalSystem?: number;
}

export interface Expense {
    id: string;
    organizationId: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    vendor?: string;
    paidBy?: string;
    paidById?: string;
    paidByName?: string;
    projectId?: string | null;
    receiptData?: string | null;
    receiptUrl?: string | null;
    createdAt?: string;
    createdById?: string;
    createdByName?: string;
    updatedAt?: string;
    updatedById?: string;
    updatedByName?: string;
}

export interface Subcontractor {
    id: string;
    organizationId: string;
    companyName: string;
    contactName: string;
    trade: string;
    email: string;
    phone: string;
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
    createdAt?: any;
}

export interface Bid {
    id: string;
    organizationId: string;
    title: string;
    agency?: string;
    solicitationNumber?: string;
    dueDate?: string;
    status: string;
    requirements: string[];
    deliverables?: string[];
    summary?: string;
    notes?: string;
    files: StoredFile[];
    lineItems?: any[];
    questions?: any[];
    generatedDocs?: any[];
    paymentStatus: 'Pending' | 'Paid';
    totalValue?: number;
    submittedDate?: string;
    createdAt: string;
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
}

export interface BidQuestion {
    id: string;
    question: string;
    answer: string;
    source?: string;
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
