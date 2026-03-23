import type { 
    User, 
    Organization, 
    Job, 
    Customer, 
    Appointment, 
    InventoryItem, 
    Proposal, 
    MarketingCampaign, 
    BusinessDocument, 
    WorkSchedule, 
    Notification, 
    IncidentReport, 
    MembershipPlan, 
    ServiceAgreement, 
    RefrigerantCylinder, 
    ProposalPreset, 
    InspectionTemplate, 
    ShopOrder, 
    Project, 
    Subcontractor, 
    EquipmentRental, 
    Expense,
    Review,
    PlatformSettings,
    Message,
    PartOrder,
    Vehicle,
    ShiftLog,
    VehicleLog,
    RefrigerantTransaction,
    ToolMaintenanceLog,
    Lead,
    Applicant
} from 'types';

export interface AppState {
    currentUser: User | null;
    currentOrganization: Organization | null;
    isMasterAdmin: boolean;
    isDemoMode: boolean;
    theme: 'light' | 'dark';
    loading: boolean;
    users: User[];
    allOrganizations: Organization[];
    customers: Customer[];
    jobs: Job[];
    externalJobs: Job[];
    appointments: Appointment[];
    inventory: InventoryItem[];
    proposals: Proposal[];
    campaigns: MarketingCampaign[];
    documents: BusinessDocument[];
    schedules: WorkSchedule[];
    notifications: Notification[];
    incidents: IncidentReport[];
    membershipPlans: MembershipPlan[];
    serviceAgreements: ServiceAgreement[];
    refrigerantCylinders: RefrigerantCylinder[];
    refrigerantTransactions: RefrigerantTransaction[];
    proposalPresets: ProposalPreset[];
    inspectionTemplates: InspectionTemplate[];
    shopOrders: ShopOrder[];
    projects: Project[];
    subcontractors: Subcontractor[];
    rentals: EquipmentRental[];
    expenses: Expense[];
    reviews: Review[];
    applicants: Applicant[];
    platformSettings: PlatformSettings | null;
    messages: Message[];
    partOrders: PartOrder[];
    vehicles: Vehicle[];
    shiftLogs: ShiftLog[];
    vehicleLogs: VehicleLog[];
    toolMaintenanceLogs: ToolMaintenanceLog[];
    bids: any[];
    leads: Lead[];
    activeJobIdForWorkflow: string | null;
    customerProfile: Customer | null; // Added
    // Deprecated fields - TBD on removal
    marketingCampaigns: MarketingCampaign[]; 
    businessDocuments: BusinessDocument[];
    workSchedules: WorkSchedule[];
    equipmentRentals: EquipmentRental[];
    incidentReports: IncidentReport[];
}

export const initialState: AppState = {
    currentUser: null,
    currentOrganization: null,
    isMasterAdmin: false,
    isDemoMode: false,
    theme: 'light',
    loading: true,
    users: [],
    allOrganizations: [],
    customers: [],
    jobs: [],
    externalJobs: [],
    appointments: [],
    inventory: [],
    proposals: [],
    campaigns: [],
    documents: [],
    schedules: [],
    notifications: [],
    incidents: [],
    membershipPlans: [],
    serviceAgreements: [],
    refrigerantCylinders: [],
    refrigerantTransactions: [],
    proposalPresets: [],
    inspectionTemplates: [],
    shopOrders: [],
    projects: [],
    subcontractors: [],
    rentals: [],
    expenses: [],
    reviews: [],
    applicants: [],
    platformSettings: null,
    messages: [],
    partOrders: [],
    vehicles: [],
    shiftLogs: [],
    vehicleLogs: [],
    toolMaintenanceLogs: [],
    bids: [],
    leads: [],
    activeJobIdForWorkflow: null,
    customerProfile: null, // Added
    // Deprecated
    marketingCampaigns: [],
    businessDocuments: [],
    workSchedules: [],
    equipmentRentals: [],
    incidentReports: [],
};