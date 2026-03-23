
import type { Address } from './organization';

export interface EmployeeDocument {
  id: string;
  organizationId: string;
  fileName: string;
  label: string;
  dataUrl: string; 
  createdAt?: string;
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
}
