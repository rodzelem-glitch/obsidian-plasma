
import type { StoredFile } from '../types/file';

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
}
