
import type { InvoiceDetails } from '../types/invoice';
import type { StoredFile } from '../types/file';
import type { ToolReading } from '../types/tool';
import type { Address } from '../types/organization';
import type { InspectionTemplate, BusinessDocument } from '../types';

export interface Job {
  id: string;
  organizationId: string;
  assignedPartnerId?: string | null; 
  partnerAllowDirectPayment?: boolean | null;
  customerName: string;
  firstName?: string | null;
  lastName?: string | null;
  address: string | Address;
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
      checklist?: string;
      internalNotes?: string;
      diagnosisChecklist?: string;
      qualityChecklist?: string;
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
  customerFeedback?: string;
  endTime?: string;

  // Added for B2B document sharing
  embeddedData?: {
    inspectionTemplates?: any[];
    waivers?: any[];
  };
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
