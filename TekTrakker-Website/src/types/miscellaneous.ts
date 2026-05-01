
import type { StoredFile } from './file';

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

export interface ServiceItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    avgLabor: number;
    quantity?: number;
}

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
    amount: number;
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
    attachmentUrls?: string[];
    createdAt?: string;
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

export interface WorkSchedule {
    id: string;
    organizationId: string;
    userId: string;
    dayOfWeek: number; 
    startTime: string; 
    endTime: string; 
    isOff: boolean;
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

export interface ProposalItem {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
    total: number;
    type: 'Labor' | 'Part' | 'Fee' | 'Discount';
    tier: 'Good' | 'Better' | 'Best';
    partCost?: number;
    laborHours?: number;
    hourlyRate?: number;
    margin?: number;
    taxable?: boolean;
}

export interface Proposal {
    id: string;
    organizationId: string;
    customerId?: string; // Added customerId
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
    selectedOption?: string | null;
    signature?: string | null;
    signatureDataUrl?: string | null;
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
    paidById?: string; // Audit trail
    paidByName?: string; // Audit trail
    projectId?: string | null;
    receiptData?: string | null;
    receiptUrl?: string | null;
    receiptUrls?: string[];
    createdAt?: string;
    createdById?: string;
    createdByName?: string;
    updatedAt?: string;
    updatedById?: string;
    updatedByName?: string;
}

export interface InspectionTemplateItem {
    id: string;
    label: string;
    type: 'PassFail' | 'Text' | 'Textarea' | 'Photo';
    required: boolean;
}

export interface InspectionTemplate {
    id: string;
    organizationId: string;
    name: string; // Changed from title to name to match usage
    items: InspectionTemplateItem[];
    createdAt: string;
    updatedAt: string;
}

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

export interface Review {
    id: string;
    organizationId: string;
    platform: string;
    customerName: string;
    rating: number;
    content: string;
    date: string;
    responded: boolean;
    responseContent?: string;
    aiDraft?: string | null;
}

export interface Message {
    id: string;
    organizationId: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
    type: 'text' | 'sms' | 'email' | 'customer-log' | 'alert';
    deliveryStatus?: 'queued' | 'sent' | 'failed';
    deliveryError?: string;
    isEdited?: boolean;
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

export interface PlatformSettings {
    id: string;
    plans: {
        starter: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
        growth: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
        enterprise: { monthly: number; annual: number; maxUsers: number; paypalMonthlyId?: string; paypalAnnualId?: string };
    };
    excessUserFee: number;
    updatedAt: string;
    platformPaypalClientId?: string;
    franchiseFeePct?: number;
    franchiseDiscountCodes?: { code: string; discountPct: number; active: boolean }[];
}

export interface ProjectNote {
    id: string;
    author: string;
    content: string;
    timestamp: string;
}

export interface OrganizationTeam {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    memberIds: string[]; // User IDs or Subcontractor IDs
}

export interface ProjectSubtask {
    id: string;
    title: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    assignedTo?: string;
}

export interface TaskComment {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: string;
}

export interface ProjectTask {
    id: string;
    description: string;
    status: 'Pending' | 'In Progress' | 'Blocked' | 'Review' | 'Completed';
    isBenchmark: boolean;
    dueDate?: string;
    assignedTo?: string;
    subtasks?: ProjectSubtask[];
    dependencies?: string[]; // Array of Task IDs
    priority?: 'Low' | 'Medium' | 'High' | 'Critical';
    swimlane?: string;
    phaseId?: string;
    deliverableId?: string;
    workPackageId?: string;
    // Scrum/Agile fields
    storyPoints?: number;           // Fibonacci: 1, 2, 3, 5, 8, 13
    estimatedHours?: number;        // Time estimate
    actualHours?: number;           // Time tracking
    sprintId?: string;              // Which sprint this belongs to
    labels?: string[];              // Tags: ["plumbing", "urgent", "permit-required"]
    acceptanceCriteria?: string[];  // Definition of Done checklist
    comments?: TaskComment[];       // Per-task discussion thread
    blockedReason?: string;         // If status is Blocked, why
    completedAt?: string;           // When task was marked done
    createdAt?: string;             // When task was created
    order?: number;                 // Position in backlog/board column
}

export interface WorkPackage {
    id: string;
    name: string;
    description?: string;
    assignedTeam?: string;
    tasks: ProjectTask[];
}

export interface Deliverable {
    id: string;
    name: string;
    description?: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    dueDate?: string;
    workPackages: WorkPackage[];
}

export interface ProjectPhase {
    id: string;
    name: string;
    description?: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    startDate?: string;
    endDate?: string;
    deliverables: Deliverable[];
}

export interface RiskLogEntry {
    id: string;
    title: string;
    description: string;
    probability: 'Low' | 'Medium' | 'High';
    impact: 'Low' | 'Medium' | 'High';
    status: 'Open' | 'Mitigated' | 'Closed';
    mitigationPlan?: string;
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

export interface Sprint {
    id: string;
    name: string;                    // "Sprint 1", "Week of 4/28"
    goal?: string;                   // "Complete Building A rough-in"
    status: 'Planning' | 'Active' | 'Completed' | 'Cancelled';
    startDate: string;
    endDate: string;
    taskIds: string[];               // Tasks committed to this sprint
    velocity?: number;               // Story points completed
    retrospectiveNotes?: string;     // What went well / what to improve
    createdAt?: string;
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
    projectTasks?: ProjectTask[]; // Legacy flat tasks or backlog
    phases?: ProjectPhase[];
    backlog?: ProjectTask[];
    sprints?: Sprint[];           // Scrum sprints (time-boxed iterations)
    riskLog?: RiskLogEntry[];
    permits?: Permit[];
    files?: StoredFile[];
    defaultView?: 'board' | 'list' | 'wbs';  // User's preferred PM view
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
    
    // Handshake / Platform Linking
    linkedOrgId?: string | null;       // If they are an existing TekTrakker org
    handshakeStatus?: 'None' | 'Pending' | 'Linked';
    referralCode?: string;             // For new invites
    referralExpiry?: string;
    allowDirectPayment?: boolean;      // Added for B2B control

    // Payment Rules
    paymentType: 'perJob' | 'percentage';
    paymentPercentage?: number; // Optional, only if paymentType is 'percentage'
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

export interface BidLineItem {
    id: string;
    description: string;
    unit: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    source?: 'Manual' | 'AI Extracted' | 'Pricebook';
    aiRecommendedPrice?: number;
}

export interface BidQuestion {
    id: string;
    question: string;
    answer: string;
    source?: string;
}

export interface RFPNotice {
    id: string;
    organizationId: string; // The GC/Originator
    title: string;
    description: string;
    trade: string; // Legacy/Primary trade
    trades?: string[]; // Multiple components/trades
    location: string;
    budgetRange: string;
    dueDate: string;
    status: 'Open' | 'Closed' | 'Partially Awarded' | 'Awarded';
    awardedTo?: string; // Legacy single awardee
    awardedToIds?: string[]; // Multiple awardees
    visibility: 'Public' | 'Private';
    requirements: string[];
    files: string[];
    projectId?: string; // Project to auto-assign winner to
    createdAt: string;
}

export interface RFPBidSubmission {
    id: string;
    noticeId: string;
    bidderOrgId: string; // The Subcontractor
    status: 'Pending' | 'Accepted' | 'Rejected';
    proposedAmount: number;
    estimatedDays: number;
    proposalUrl?: string; // Link to the document or internal reference
    notes: string;
    createdAt: string;
}

export interface BidDoc {
    title: string;
    content: string;
    type?: 'html' | 'csv';
}

export interface Bid {
    id: string;
    organizationId: string;
    title: string;
    agency?: string;
    solicitationNumber?: string;
    dueDate?: string;
    status: 'Draft' | 'Analyzing' | 'Costing' | 'Review' | 'Submitted' | 'Won' | 'Lost';
    requirements: string[];
    deliverables?: string[];
    summary?: string;
    notes?: string;
    files: StoredFile[];
    lineItems?: BidLineItem[];
    questions?: BidQuestion[];
    generatedDocs?: BidDoc[];
    paymentStatus: 'Pending' | 'Paid';
    totalValue?: number;
    submittedDate?: string;
    projectId?: string;
    noticeId?: string;
    createdAt: string;
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

export type SignedWaiver = any;
