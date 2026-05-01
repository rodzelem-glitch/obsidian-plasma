
import type { Address } from './organization';

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
  role: 'master_admin' | 'franchise_admin' | 'admin' | 'employee' | 'both' | 'customer' | 'supervisor' | 'platform_sales' | 'Technician' | 'Subcontractor'; 
  franchiseId?: string;
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
  marketingConsent?: { sms: boolean; email: boolean; agreedAt: string; source: string; ip?: string; gclid?: string; };
  signedPolicies?: Record<string, string>;
  digitalId?: string;
  salesContractSigned?: boolean;
  salesContractDate?: string;
  salesContractSignature?: string;
  salesContractContent?: string;
  taxW9Content?: string;
  profilePicUrl?: string;
  aiEstimatorEnabled?: boolean;
  w4Status?: 'Single' | 'Married' | 'Head of Household';
  w4DependentsAmount?: number;
  w4OtherIncome?: number;
  w4Deductions?: number;
  w4ExtraWithholding?: number;
  squareTeamMemberId?: string | null;
  gustoEmployeeId?: string | null;
  hasAppAccess?: boolean;
  kioskPin?: string;
  gclid?: string;
}
