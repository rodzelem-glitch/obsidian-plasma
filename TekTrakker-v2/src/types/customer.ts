import type { StoredFile } from '../types/file';

export type ContactRole = 'proposals' | 'invoicing' | 'ap' | 'on_site' | 'emergency' | 'account_manager' | 'incoming_workorders' | 'custom' | string;

export interface CustomerContact {
    id: string;
    name: string;
    title?: string;
    email: string;
    phone: string;
    extension?: string;
    isPrimary?: boolean;
    isAccountManager?: boolean;
    isIncomingWorkOrderContact?: boolean;
    portalRole?: 'corporate' | 'regional' | 'branch';
    allowedLocationIds?: string[];
    assignedLocationIds?: string[];
    assignedJobIds?: string[];
    portalUserStatus?: 'invited' | 'active' | 'inactive';
    contactRoles?: ContactRole[];
    customRoleName?: string;
    canApproveProposals?: boolean;
    canAuthorizeWorkOrders?: boolean;
    isBillingContact?: boolean;
    isEmergencyContact?: boolean;
    notes?: string;
}

export interface CheckInProcedure {
    required?: boolean;
    method?: 'IVR' | 'SMS' | 'App' | 'WebPortal' | 'OnSiteTablet' | 'Custom' | string;
    phoneNumber?: string;
    portalUrl?: string;
    instructions?: string;
}

export interface EarlyPayTerms {
    enabled?: boolean;
    standardDays?: number;
    tiers?: Array<{ days: number; discountPercent: number }>;
}

export interface CustomerSubmissionRules {
    requirePoNumber?: boolean;
    poPattern?: string;
    requireSignedWorkOrder?: boolean;
    requireBeforeAfterPhotos?: boolean;
    requireEquipmentSerial?: boolean;
    requireSingleWoPerInvoice?: boolean;
    allowedFileFormats?: ('PDF' | 'JPEG' | 'PNG' | string)[];
    thirdPartyPortal?: {
        required: boolean;
        portalName?: 'NEST Facilitate / ISP Connect' | 'ServiceChannel' | 'Corrigo' | 'FM Pilot' | 'Verisae' | 'Fixx' | 'OfficeTrax' | 'Other' | string;
        portalWoNumberRequired?: boolean;
        portalUrl?: string;
        phoneNumber?: string;
        submissionNotes?: string;
        username?: string;
        password?: string;
        apiKey?: string;
        pinCode?: string;
    };
    checkInProcedure?: CheckInProcedure;
    earlyPayTerms?: EarlyPayTerms;
    customSubmissionNotes?: string;
    requireNteApprovalCall?: boolean;
    defaultNteLimit?: number;
    accountManagerContact?: {
        name?: string;
        phone?: string;
        extension?: string;
        email?: string;
    };
    requireProposalWithin24Hours?: boolean;
    noPaperworkForStoreAssociate?: boolean;
    doNotDiscussPricingWithStoreAssociate?: boolean;
    allowEmergencyPaperSignOff?: boolean;
    invoiceSubmissionEmail?: string;
    apInquiryEmail?: string;
    submissionDeadlineDays?: number;
}

export interface EquipmentAsset {
    id: string;
    organizationId: string;
    customerId: string;
    locationId?: string; // Reference to ServiceLocation
    propertyId?: string; // Interoperability with propertyId
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

export interface LocationContact {
    id: string;
    role: 'property_manager' | 'tenant' | 'building_engineer' | 'owner' | 'emergency_contact' | string;
    name: string;
    phone: string;
    email: string;
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
   organizationId: string;
   customerId: string; // Links back to Customer parent
   propertyName: string; // e.g. Stone Oak Retail Center, Unit 104
   storeNumber?: string; // e.g. Store #4663, Store #CK058
   locationNumber?: string; // e.g. Store #1042, Loc-004
   mall?: string; // Shopping center, mall, or plaza name (e.g. South Park Mall, Standalone / Strip Center)
   building?: string; // e.g. Building B, North Wing
   address: string;
   city?: string;
   state?: string;
   zip?: string;
   propertyType?: string; // commercial, retail, multi-family, etc.
   unitNumber?: string;
   accessInstructions?: string; // Gate codes, lockboxes, roof access
   afterHoursAccess?: 'yes' | 'no' | 'requires_approval' | string;
   preferredServiceWindow?: string;
   approvalLimits?: {
       preApprovedLimit: number;
       requireWrittenApproval: boolean;
       emergencyOverride: boolean;
   };
   approvalContactId?: string;
   poRequired?: boolean;
   poNumber?: string;
   contacts?: LocationContact[];
   preferredTechnicianId?: string;
   createdAt?: string;
   
   // Photos & Layout Details
   photos?: string[];
   layoutPhotoUrl?: string;
   layoutProfessionalSvg?: string;
   layoutHotspots?: LayoutHotspot[];
   layoutVertices?: { id: string; x: number; y: number }[];
   layoutCustomShapes?: any[];

   // Location-Specific Billing Overrides
   billToSameAsSite?: boolean;
   billToName?: string;
   billToAddress?: string;
}

export interface CustomerMarkupRule {
    id: string;
    condition: 'under' | 'over'; // 'under' = <= threshold, 'over' = > threshold
    threshold: number;           // e.g. 1500
    rate: number;                // e.g. 43
    label?: string;              // e.g. "Standard Commercial Parts"
}

export interface CustomerRateVisibility {
    showStandardRate?: boolean;
    showOvertimeRate?: boolean;
    showEmergencyRate?: boolean;
    showTripFee?: boolean;
    showEmergencyTripCharge?: boolean;
    showEmergencyTripFee?: boolean;
    showPartsMarkup?: boolean;
    showPaymentTerms?: boolean;
    showTaxExemptStatus?: boolean;
    showAccountSla?: boolean;
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
  
  // Property Management / Commercial specific billing & compliance
  billingContact?: { name: string; email: string; phone: string; };
  contacts?: CustomerContact[];
  invoiceDelivery?: 'email' | 'mail' | 'both' | string;
  paymentTerms?: 'due_on_receipt' | 'net_7' | 'net_15' | 'net_30' | 'custom' | string;
  taxExempt?: boolean;
  taxExemptCertUrl?: string;
  taxExemptNumber?: string;
  vendorId?: string;
  externalAccountingId?: string;
  accountSla?: 'emergency_4hr' | 'same_day_8hr' | 'next_day_24hr' | 'standard_48hr' | string;
  onboarding?: {
      packetStatus?: 'not_sent' | 'sent' | 'signed' | 'expired';
      w9OnFile?: boolean;
      coiOnFile?: boolean;
      packetEnvelopeId?: string;
      correspondenceDate?: string;
      correspondenceDateFormatted?: string;
      tekAirContactEmail?: string;
      requiredForms?: string[];
      onboardingStatus?: string;
      notes?: string;
  };
  internalNotes?: string;
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
      partsMarkupRules?: CustomerMarkupRule[];
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
      visibility?: CustomerRateVisibility;
  };
  rateVisibility?: CustomerRateVisibility;
  submissionRules?: CustomerSubmissionRules;

  // Legacy/Embedded Data
  hvacSystem: { brand: string; type: string; installDate?: string | null; };
  equipment?: EquipmentAsset[];
  warrantyContracts?: any[];
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
  
  // Optional embedded array for legacy or quick-access locations, but root collection is preferred.
  serviceLocations?: ServiceLocation[];
  createdAt?: string;
  agreedToCustomerTerms?: boolean | null;
  customerTermsAgreedAt?: string | null;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  blacklistedAt?: string;
  blacklistedBy?: string;
  maintenanceAgreement?: MaintenanceAgreement | null;
}

export interface UnitConsumableSpec {
  id: string;
  name: string; // e.g. "Air Filter", "Drive Belt", "Water Filtration Cartridge", "Sacrificial Anode", "UPS Battery", "Door Gasket"
  sizeOrPartNo: string; // e.g. "20x25x2 MERV 11", "AX-48", "3M HF40-S", "12V 7Ah"
  quantity: number;
  intervalMonths?: number; // e.g. 2 (every 2 months)
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

