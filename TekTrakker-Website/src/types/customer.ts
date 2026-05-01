
import type { StoredFile } from '../types/file';

export interface EquipmentAsset {
    id: string;
    propertyId?: string;
    name?: string;
    brand: string;
    model: string;
    serial: string;
    type: string;
    location?: string;
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

export interface ServiceLocation {
   id: string;
   name: string;
   address: string;
   city?: string;
   state?: string;
   zip?: string;
   gateCode?: string;
   notes?: string;
   parentId?: string | null;
   locationType?: string;
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
  serviceLocations?: ServiceLocation[];
}
