import type { StoredFile } from '../types/file';

export interface CustomerContact {
    id: string;
    name: string;
    title?: string;
    email: string;
    phone: string;
    isPrimary?: boolean;
    portalRole?: 'corporate' | 'regional' | 'branch';
    allowedLocationIds?: string[];
    portalUserStatus?: 'invited' | 'active' | 'inactive';
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
    type: string;
    tonnage?: number;
    refrigerantType?: string;
    year?: string;
    heatType?: string;
    electricityType?: string;
    seerRating?: string;
    filterType?: string;
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
}

export interface Customer {
  id: string;
  organizationId: string;
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
  internalNotes?: string;
  vendorCompliance?: { w9Url?: string; coiUrl?: string; vendorAgreementUrl?: string; };
  pricingRules?: { 
      standardRate?: number; 
      emergencyRate?: number; 
      tripCharge?: number; 
      markupPercentage?: number; 
      contractedRate?: number;
  };

  // Legacy/Embedded Data
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

export interface MaintenanceVisit {
  id: string;
  targetMonth: string;
  targetDate?: string;
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
  status: 'Draft' | 'Active' | 'Cancelled' | 'Expired';
  startDate: string;
  endDate: string;
  value: number;
  billingFrequency: 'One-Time' | 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  paymentTerms: string;
  coveredItems: string[];
  coveredEquipmentIds: string[];
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

