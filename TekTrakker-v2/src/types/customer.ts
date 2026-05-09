import type { StoredFile } from '../types/file';

export interface CustomerContact {
    id: string;
    name: string;
    title?: string;
    email: string;
    phone: string;
    isPrimary?: boolean;
}

export interface EquipmentAsset {
    id: string;
    organizationId: string;
    customerId: string;
    locationId?: string; // Reference to ServiceLocation
    name?: string;
    brand: string;
    model: string;
    serial: string;
    type: string;
    tonnage?: number;
    refrigerantType?: string;
    physicalLocation?: string; // e.g. Roof, Mechanical Room
    installDate?: string;
    condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    serialPhotoUrl?: string;
    unitTagPhotoUrl?: string;
    conditionPhotoUrl?: string;
    notes?: string;
    linkedAssetIds?: string[];
    warranty?: AssetWarranty;
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
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  address: string;
  customerType: 'Residential' | 'Commercial' | 'Property Management'; 
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
  internalNotes?: string;
  vendorCompliance?: { w9Url?: string; coiUrl?: string; vendorAgreementUrl?: string; };
  pricingRules?: { standardRate?: number; emergencyRate?: number; tripCharge?: number; markupPercentage?: number; };

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
}
