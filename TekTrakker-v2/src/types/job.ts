
import type { InvoiceDetails } from '../types/invoice';
import type { StoredFile } from '../types/file';
import type { ToolReading } from '../types/tool';
import type { Address } from '../types/organization';
import type { InspectionTemplate, BusinessDocument } from '../types';

export interface Job {
  archived?: boolean;
  deleted?: boolean;
  deletedAt?: string;
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
  locationId?: string | null;
  locationName?: string | null;
  poNumber?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  jobStatus: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Needs Follow-up';
  repairPostponed?: boolean;
  repairPostponedReason?: string;
  proposalId?: string | null;
  appointmentTime: string; 
  specialInstructions: string;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  assignedCrew?: string[];
  assistants?: string[];
  workOrderNumber?: string | null;
  signatureMetadata?: any;
  signatureHistory?: any[];
  signatureUrl?: string | null;
  invoice?: InvoiceDetails;
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
      thankYouNote?: string;
  };
  source?: string | null;
  hvacType?: string | null;
  hvacBrand?: string | null;
  projectId?: string | null;
  linkedProposalIds?: string[];
  divisionId?: string | null;
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
  checkInTime?: string;
  checkOutTime?: string;
  transitStartTime?: string;
  timeOnSiteMinutes?: number;
  timeEntries?: Array<{
    checkInTime: string;
    checkOutTime?: string | null;
    timeOnSiteMinutes?: number | null;
  }>;
  linkedJobIds?: string[];
  linkedInvoiceIds?: string[];
  parentJobId?: string | null;
  isFollowUp?: boolean;
  isServicePlan?: boolean | null;
  servicePlanType?: 'membership' | 'maintenanceAgreement' | string | null;
  servicePlanId?: string | null;


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
  techRecommendations?: string;
  visitType?: 'Diagnostic Only' | 'Diagnostic & Repair' | 'Repair' | 'Maintenance' | 'Service Call' | 'Other';
  unitStates?: Array<{
    assetId: string;
    health?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthBefore?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthAfter?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    diagnosis?: string;
    repair?: string;
    recommendations?: string;
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
}

