import { initialState, type AppState } from './state';
import type { 
    User, Organization, Job, Customer, Appointment, 
    PartOrder, Proposal, InventoryItem, 
    MarketingCampaign, Vehicle, VehicleLog, ShiftLog, 
    BusinessDocument, WorkSchedule, Notification, 
    IncidentReport, MembershipPlan, ServiceAgreement,
    PlatformSettings, Review, InspectionTemplate, Message,
    PlatformLead, PlatformCommission, RefrigerantCylinder, ToolMaintenanceLog, ProposalPreset,
    Project, Subcontractor, EquipmentRental, Expense, ShopOrder, ProjectTask, Permit, RefrigerantTransaction, Applicant
} from 'types';

export type Action =
    | { type: 'LOGIN_SUCCESS'; payload: { user: User; organization?: Organization, isMasterAdmin: boolean } }
    | { type: 'SET_CURRENT_USER'; payload: User | null }
    | { type: 'SET_CURRENT_ORGANIZATION'; payload: Organization | null }
    | { type: 'SET_THEME'; payload: 'light' | 'dark' }
    | { type: 'TOGGLE_THEME' }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'LOGOUT' }
    | { type: 'LOGIN'; payload: { user: User; currentOrganization?: Organization } }
    | { type: 'UPDATE_EMPLOYEE'; payload: Partial<User> & { id: string } }
    | { type: 'SET_USERS'; payload: User[] }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'UPDATE_USER'; payload: User }
    | { type: 'DELETE_USER'; payload: string }
    | { type: 'SET_ALL_ORGANIZATIONS'; payload: Organization[] }
    | { type: 'UPDATE_ORGANIZATION'; payload: Organization }
    | { type: 'SYNC_ALL_ORGS'; payload: Organization[] }
    | { type: 'SET_CUSTOMERS'; payload: Customer[] }
    | { type: 'ADD_CUSTOMER'; payload: Customer }
    | { type: 'UPDATE_CUSTOMER'; payload: any }
    | { type: 'DELETE_CUSTOMER'; payload: string }
    | { type: 'SET_PROPOSALS'; payload: Proposal[] }
    | { type: 'MERGE_PROPOSALS'; payload: Proposal[] }
    | { type: 'ADD_PROPOSAL'; payload: Proposal }
    | { type: 'UPDATE_PROPOSAL'; payload: any }
    | { type: 'DELETE_PROPOSAL'; payload: string }
    | { type: 'SET_JOBS'; payload: Job[] }
    | { type: 'SET_EXTERNAL_JOBS'; payload: Job[] }
    | { type: 'MERGE_JOBS'; payload: Job[] }
    | { type: 'ADD_JOB'; payload: Job }
    | { type: 'UPDATE_JOB'; payload: any }
    | { type: 'DELETE_JOB'; payload: string }
    | { type: 'SET_APPOINTMENTS'; payload: Appointment[] }
    | { type: 'ADD_APPOINTMENT'; payload: Appointment }
    | { type: 'UPDATE_APPOINTMENT'; payload: Appointment }
    | { type: 'DELETE_APPOINTMENT'; payload: string }
    | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
    | { type: 'ADD_INVENTORY'; payload: any }
    | { type: 'UPDATE_INVENTORY'; payload: any }
    | { type: 'DELETE_INVENTORY'; payload: string }
    | { type: 'SET_CAMPAIGNS'; payload: MarketingCampaign[] }
    | { type: 'ADD_CAMPAIGN'; payload: any }
    | { type: 'UPDATE_CAMPAIGN'; payload: any }
    | { type: 'DELETE_CAMPAIGN'; payload: string }
    | { type: 'SET_DOCUMENTS'; payload: BusinessDocument[] }
    | { type: 'ADD_DOCUMENT'; payload: any }
    | { type: 'UPDATE_DOCUMENT'; payload: any }
    | { type: 'DELETE_DOCUMENT'; payload: string }
    | { type: 'SET_SCHEDULES'; payload: WorkSchedule[] }
    | { type: 'ADD_SCHEDULE'; payload: any }
    | { type: 'UPDATE_SCHEDULE'; payload: any }
    | { type: 'DELETE_SCHEDULE'; payload: string }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'MARK_ALL_READ'; payload?: any }
    | { type: 'MARK_NOTIFICATION_READ'; payload: string }
    | { type: 'SET_INCIDENTS'; payload: IncidentReport[] }
    | { type: 'ADD_INCIDENT'; payload: any }
    | { type: 'UPDATE_INCIDENT'; payload: any }
    | { type: 'SET_MEMBERSHIP_PLANS'; payload: MembershipPlan[] }
    | { type: 'ADD_MEMBERSHIP_PLAN'; payload: MembershipPlan }
    | { type: 'UPDATE_MEMBERSHIP_PLAN'; payload: any }
    | { type: 'SET_AGREEMENTS'; payload: ServiceAgreement[] }
    | { type: 'ADD_AGREEMENT'; payload: any }
    | { type: 'UPDATE_AGREEMENT'; payload: any }
    | { type: 'SET_CYLINDERS'; payload: RefrigerantCylinder[] }
    | { type: 'UPDATE_CYLINDER'; payload: any }
    | { type: 'ADD_CYLINDER'; payload: any }
    | { type: 'DELETE_CYLINDER'; payload: string }
    | { type: 'SET_REF_TRANSACTIONS'; payload: RefrigerantTransaction[] }
    | { type: 'ADD_REF_TRANSACTION'; payload: any }
    | { type: 'SET_TOOL_LOGS'; payload: ToolMaintenanceLog[] }
    | { type: 'ADD_TOOL_LOG'; payload: any }
    | { type: 'SET_PROPOSAL_PRESETS'; payload: ProposalPreset[] }
    | { type: 'ADD_PROPOSAL_PRESET'; payload: any }
    | { type: 'UPDATE_PROPOSAL_PRESET'; payload: any }
    | { type: 'DELETE_PROPOSAL_PRESET'; payload: string }
    | { type: 'SET_INSPECTION_TEMPLATES'; payload: InspectionTemplate[] }
    | { type: 'ADD_INSPECTION_TEMPLATE'; payload: any }
    | { type: 'UPDATE_INSPECTION_TEMPLATE'; payload: any }
    | { type: 'DELETE_INSPECTION_TEMPLATE'; payload: string }
    | { type: 'SET_SHOP_ORDERS'; payload: ShopOrder[] }
    | { type: 'UPDATE_SHOP_ORDER'; payload: any }
    | { type: 'DELETE_SHOP_ORDER'; payload: string }
    | { type: 'SET_PROJECTS'; payload: Project[] }
    | { type: 'ADD_PROJECT'; payload: any }
    | { type: 'UPDATE_PROJECT'; payload: any }
    | { type: 'DELETE_PROJECT'; payload: string }
    | { type: 'SET_SUBCONTRACTORS'; payload: Subcontractor[] }
    | { type: 'ADD_SUBCONTRACTOR'; payload: any }
    | { type: 'UPDATE_SUBCONTRACTOR'; payload: any }
    | { type: 'SET_RENTALS'; payload: EquipmentRental[] }
    | { type: 'ADD_RENTAL'; payload: any }
    | { type: 'UPDATE_RENTAL'; payload: any }
    | { type: 'SET_EXPENSES'; payload: Expense[] }
    | { type: 'ADD_EXPENSE'; payload: any }
    | { type: 'UPDATE_EXPENSE'; payload: any }
    | { type: 'DELETE_EXPENSE'; payload: string }
    | { type: 'SET_REVIEWS'; payload: Review[] }
    | { type: 'ADD_REVIEW'; payload: Review } 
    | { type: 'SET_APPLICANTS'; payload: Applicant[] }
    | { type: 'UPDATE_APPLICANT'; payload: Applicant }
    | { type: 'SET_PLATFORM_SETTINGS'; payload: PlatformSettings | null }
    | { type: 'SYNC_DATA'; payload: any }
    | { type: 'SET_MESSAGES'; payload: Message[] }
    | { type: 'MERGE_MESSAGES'; payload: Message[] }
    | { type: 'UPDATE_SHIFT_LOG'; payload: { userId: string, log: ShiftLog } }
    | { type: 'ADD_SHIFT_LOG'; payload: { userId: string, log: ShiftLog } }
    | { type: 'SET_SHIFT_LOGS'; payload: { userId: string, logs: ShiftLog[] } }
    | { type: 'SET_VEHICLES'; payload: Vehicle[] }
    | { type: 'UPDATE_VEHICLE'; payload: any }
    | { type: 'ADD_VEHICLE'; payload: any }
    | { type: 'DELETE_VEHICLE'; payload: string }
    | { type: 'SET_VEHICLE_LOGS'; payload: VehicleLog[] }
    | { type: 'ADD_VEHICLE_LOG'; payload: VehicleLog }
    | { type: 'UPDATE_VEHICLE_LOG'; payload: VehicleLog }
    | { type: 'DELETE_VEHICLE_LOG'; payload: string }
    | { type: 'SET_PART_ORDERS'; payload: PartOrder[] }
    | { type: 'ADD_PART_ORDER'; payload: PartOrder }
    | { type: 'UPDATE_PART_ORDER'; payload: any }
    | { type: 'DELETE_PART_ORDER'; payload: string }
    | { type: 'ADD_TASK'; payload: Partial<ProjectTask> }
    | { type: 'UPDATE_TASK'; payload: Partial<ProjectTask> }
    | { type: 'ADD_PERMIT'; payload: Partial<Permit> }
    | { type: 'UPDATE_PERMIT'; payload: Partial<Permit> }
    | { type: 'SET_BIDS'; payload: any[] }
    | { type: 'START_DEMO'; payload: any }
    | { type: 'EXIT_DEMO' }
    | { type: 'SET_CUSTOMER_PROFILE'; payload: Customer | null } 
    | { type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW'; payload: string | null };

export const appReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'START_DEMO': 
            return {
                ...initialState,
                ...action.payload,
                isDemoMode: true, 
                loading: false,
                theme: state.theme, // Persist theme
            };
        case 'EXIT_DEMO': 
            return {
                ...initialState,
                theme: state.theme, // Persist theme
                loading: false, // Ensure loading is false
            };
        case 'LOGIN_SUCCESS':
            // Start from a clean slate, preserving only the theme from the previous state.
            return {
                ...initialState,
                theme: state.theme,
                currentUser: action.payload.user,
                currentOrganization: action.payload.organization || null,
                isMasterAdmin: action.payload.isMasterAdmin,
                loading: false,
            };
        case 'SET_CURRENT_USER': return { ...state, currentUser: action.payload };
        case 'SET_CURRENT_ORGANIZATION': return { ...state, currentOrganization: action.payload };
        case 'SET_THEME': return { ...state, theme: action.payload };
        case 'TOGGLE_THEME': return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
        case 'SET_LOADING': return { ...state, loading: action.payload };
        case 'LOGOUT':
            // Reset the entire state to its initial condition, but carry over the theme and stop loading.
            return {
                ...initialState,
                theme: state.theme,
                loading: false, // STOP LOADING
            };
        case 'LOGIN': return { ...state, currentUser: action.payload.user, currentOrganization: action.payload.currentOrganization || state.currentOrganization };
        case 'UPDATE_EMPLOYEE': return { ...state, users: state.users.map(u => u.id === action.payload.id ? { ...u, ...action.payload } : u), currentUser: state.currentUser?.id === action.payload.id ? { ...state.currentUser, ...action.payload } as User : state.currentUser };
        case 'SET_ALL_ORGANIZATIONS':
        case 'SYNC_ALL_ORGS': return { ...state, allOrganizations: action.payload };
        case 'UPDATE_ORGANIZATION': return { ...state, currentOrganization: state.currentOrganization?.id === action.payload.id ? action.payload : state.currentOrganization, allOrganizations: state.allOrganizations.map(o => o.id === action.payload.id ? action.payload : o) };
        case 'SET_CUSTOMERS': return { ...state, customers: action.payload };
        case 'ADD_CUSTOMER': return { ...state, customers: [...state.customers, action.payload] };
        case 'UPDATE_CUSTOMER': return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
        case 'DELETE_CUSTOMER': return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };
        case 'SET_JOBS': return { ...state, jobs: action.payload };
        case 'MERGE_JOBS': {
            const currentJobs = state.jobs;
            const newJobs = action.payload;
            const merged = [...currentJobs];
            newJobs.forEach(nj => {
                const idx = merged.findIndex(j => j.id === nj.id);
                if (idx !== -1) {
                    merged[idx] = nj; // Update existing
                } else {
                    merged.push(nj); // Add new
                }
            });
            return { ...state, jobs: merged };
        }
        case 'SET_EXTERNAL_JOBS': return { ...state, externalJobs: action.payload };
        case 'ADD_JOB': 
            if (state.jobs.some(j => j.id === action.payload.id)) return state;
            return { ...state, jobs: [...state.jobs, action.payload] };
        case 'UPDATE_JOB': return { ...state, jobs: state.jobs.map(j => j.id === action.payload.id ? { ...j, ...action.payload } : j), externalJobs: state.externalJobs.map(j => j.id === action.payload.id ? { ...j, ...action.payload } : j) };
        case 'DELETE_JOB': return { ...state, jobs: state.jobs.filter(j => j.id !== action.payload), externalJobs: state.externalJobs.filter(j => j.id !== action.payload) };
        case 'SET_APPOINTMENTS': return { ...state, appointments: action.payload };
        case 'ADD_APPOINTMENT': return { ...state, appointments: [...state.appointments, action.payload] };
        case 'UPDATE_APPOINTMENT': return { ...state, appointments: state.appointments.map(a => a.id === action.payload.id ? action.payload : a) };
        case 'DELETE_APPOINTMENT': return { ...state, appointments: state.appointments.filter(a => a.id !== action.payload) };
        case 'SET_INVENTORY': return { ...state, inventory: action.payload };
        case 'ADD_INVENTORY': return { ...state, inventory: [...state.inventory, action.payload] };
        case 'UPDATE_INVENTORY': return { ...state, inventory: state.inventory.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
        case 'DELETE_INVENTORY': return { ...state, inventory: state.inventory.filter(i => i.id !== action.payload) };
        case 'SET_PROPOSALS': return { ...state, proposals: action.payload };
        case 'MERGE_PROPOSALS': {
            const currentProposals = state.proposals;
            const newProposals = action.payload;
            const merged = [...currentProposals];
            newProposals.forEach(np => {
                const idx = merged.findIndex(p => p.id === np.id);
                if (idx !== -1) {
                    merged[idx] = np; // Update existing
                } else {
                    merged.push(np); // Add new
                }
            });
            return { ...state, proposals: merged };
        }
        case 'ADD_PROPOSAL': 
            if (state.proposals.some(p => p.id === action.payload.id)) return state;
            return { ...state, proposals: [...state.proposals, action.payload] };
        case 'UPDATE_PROPOSAL': return { ...state, proposals: state.proposals.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
        case 'DELETE_PROPOSAL': return { ...state, proposals: state.proposals.filter(p => p.id !== action.payload) };
        case 'SET_CAMPAIGNS': return { ...state, campaigns: action.payload, marketingCampaigns: action.payload };
        case 'ADD_CAMPAIGN': return { ...state, campaigns: [...state.campaigns, action.payload], marketingCampaigns: [...state.marketingCampaigns, action.payload] };
        case 'UPDATE_CAMPAIGN': { const updated = state.campaigns.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c); return { ...state, campaigns: updated, marketingCampaigns: updated }; }
        case 'DELETE_CAMPAIGN': return { ...state, campaigns: state.campaigns.filter(c => c.id !== action.payload), marketingCampaigns: state.marketingCampaigns.filter(c => c.id !== action.payload) };
        case 'SET_DOCUMENTS': return { ...state, documents: action.payload, businessDocuments: action.payload };
        case 'ADD_DOCUMENT': return { ...state, documents: [...state.documents, action.payload], businessDocuments: [...state.businessDocuments, action.payload] };
        case 'UPDATE_DOCUMENT': { const updated = state.documents.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d); return { ...state, documents: updated, businessDocuments: updated }; }
        case 'DELETE_DOCUMENT': return { ...state, documents: state.documents.filter(d => d.id !== action.payload), businessDocuments: state.businessDocuments.filter(d => d.id !== action.payload) };
        case 'SET_SCHEDULES': return { ...state, schedules: action.payload, workSchedules: action.payload };
        case 'UPDATE_SCHEDULE': { const updated = state.schedules.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s); return { ...state, schedules: updated, workSchedules: updated }; }
        case 'SET_EXPENSES': return { ...state, expenses: action.payload };
        case 'ADD_EXPENSE': return { ...state, expenses: [...state.expenses, action.payload] };
        case 'UPDATE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? { ...e, ...action.payload } : e) };
        case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
        case 'SET_PROJECTS': return { ...state, projects: action.payload };
        case 'ADD_PROJECT': return { ...state, projects: [...state.projects, action.payload] };
        case 'UPDATE_PROJECT': return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
        case 'DELETE_PROJECT': return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
        case 'SYNC_DATA': return { ...state, ...action.payload };
        case 'MARK_ALL_READ': return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
        case 'MARK_NOTIFICATION_READ': return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
        case 'SET_MEMBERSHIP_PLANS': return { ...state, membershipPlans: action.payload };
        case 'UPDATE_MEMBERSHIP_PLAN': return { ...state, membershipPlans: state.membershipPlans.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
        case 'SET_AGREEMENTS': return { ...state, serviceAgreements: action.payload };
        case 'ADD_AGREEMENT': return { ...state, serviceAgreements: [...state.serviceAgreements, action.payload] };
        case 'SET_CYLINDERS': return { ...state, refrigerantCylinders: action.payload };
        case 'UPDATE_CYLINDER': return { ...state, refrigerantCylinders: state.refrigerantCylinders.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
        case 'ADD_CYLINDER': return { ...state, refrigerantCylinders: [...state.refrigerantCylinders, action.payload] };
        case 'DELETE_CYLINDER': return { ...state, refrigerantCylinders: state.refrigerantCylinders.filter(c => c.id !== action.payload) };
        case 'SET_REF_TRANSACTIONS': return { ...state, refrigerantTransactions: action.payload };
        case 'ADD_REF_TRANSACTION': return { ...state, refrigerantTransactions: [...state.refrigerantTransactions, action.payload] };
        case 'SET_TOOL_LOGS': return { ...state, toolMaintenanceLogs: action.payload };
        case 'ADD_TOOL_LOG': return { ...state, toolMaintenanceLogs: [...state.toolMaintenanceLogs, action.payload] };
        case 'SET_PROPOSAL_PRESETS': return { ...state, proposalPresets: action.payload };
        case 'ADD_PROPOSAL_PRESET': return { ...state, proposalPresets: [...state.proposalPresets, action.payload] };
        case 'UPDATE_PROPOSAL_PRESET': return { ...state, proposalPresets: state.proposalPresets.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
        case 'DELETE_PROPOSAL_PRESET': return { ...state, proposalPresets: state.proposalPresets.filter(p => p.id !== action.payload) };
        case 'SET_INSPECTION_TEMPLATES': return { ...state, inspectionTemplates: action.payload };
        case 'ADD_INSPECTION_TEMPLATE': return { ...state, inspectionTemplates: [...state.inspectionTemplates, action.payload] };
        case 'UPDATE_INSPECTION_TEMPLATE': return { ...state, inspectionTemplates: state.inspectionTemplates.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
        case 'DELETE_INSPECTION_TEMPLATE': return { ...state, inspectionTemplates: state.inspectionTemplates.filter(i => i.id !== action.payload) };
        case 'SET_SHOP_ORDERS': return { ...state, shopOrders: action.payload };
        case 'UPDATE_SHOP_ORDER': return { ...state, shopOrders: state.shopOrders.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o) };
        case 'DELETE_SHOP_ORDER': return { ...state, shopOrders: state.shopOrders.filter(o => o.id !== action.payload) };
        case 'UPDATE_SHIFT_LOG': {
            const { userId, log } = action.payload;
            const userLogs = state.shiftLogs[userId] || [];
            const updatedUserLogs = userLogs.map(s => s.id === log.id ? log : s);
            if (!userLogs.find(s => s.id === log.id)) updatedUserLogs.push(log);
            return { ...state, shiftLogs: { ...state.shiftLogs, [userId]: updatedUserLogs } };
        }
        case 'ADD_SHIFT_LOG': {
            const { userId, log } = action.payload;
            const userLogs = state.shiftLogs[userId] || [];
            return { ...state, shiftLogs: { ...state.shiftLogs, [userId]: [...userLogs, log] } };
        }
        case 'SET_SHIFT_LOGS': {
            const { userId, logs } = action.payload;
            return { ...state, shiftLogs: { ...state.shiftLogs, [userId]: logs } };
        }
        case 'SET_VEHICLES': return { ...state, vehicles: action.payload };
        case 'UPDATE_VEHICLE': return { ...state, vehicles: state.vehicles.map(v => v.id === action.payload.id ? { ...v, ...action.payload } : v) };
        case 'ADD_VEHICLE': return { ...state, vehicles: [...state.vehicles, action.payload] };
        case 'DELETE_VEHICLE': return { ...state, vehicles: state.vehicles.filter(v => v.id !== action.payload) };
        case 'SET_SUBCONTRACTORS': return { ...state, subcontractors: action.payload };
        case 'ADD_SUBCONTRACTOR': return { ...state, subcontractors: [...state.subcontractors, action.payload] };
        case 'UPDATE_SUBCONTRACTOR': return { ...state, subcontractors: state.subcontractors.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s) };
        case 'SET_RENTALS': return { ...state, rentals: action.payload, equipmentRentals: action.payload };
        case 'ADD_RENTAL': return { ...state, rentals: [...state.rentals, action.payload], equipmentRentals: [...state.equipmentRentals, action.payload] };
        case 'UPDATE_RENTAL': { const updated = state.rentals.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r); return { ...state, rentals: updated, equipmentRentals: updated }; }
        case 'SET_PLATFORM_SETTINGS': return { ...state, platformSettings: action.payload };
        case 'SET_REVIEWS': return { ...state, reviews: action.payload };
        case 'ADD_REVIEW': return { ...state, reviews: [...state.reviews, action.payload] }; 
        case 'SET_USERS': return { ...state, users: action.payload };
        case 'ADD_USER': return { ...state, users: [...state.users, action.payload] };
        case 'UPDATE_USER': return { ...state, users: state.users.map(u => u.id === action.payload.id ? { ...u, ...action.payload } : u) };
        case 'DELETE_USER': return { ...state, users: state.users.filter(u => u.id !== action.payload) };
        case 'SET_PART_ORDERS': return { ...state, partOrders: action.payload };
        case 'ADD_PART_ORDER': return { ...state, partOrders: [...state.partOrders, action.payload] };
        case 'UPDATE_PART_ORDER': return { ...state, partOrders: state.partOrders.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o) };
        case 'DELETE_PART_ORDER': return { ...state, partOrders: state.partOrders.filter(o => o.id !== action.payload) };
        case 'SET_MESSAGES': return { ...state, messages: action.payload };
        case 'MERGE_MESSAGES': {
            const currentMsgs = [...state.messages];
            action.payload.forEach((msg: Message) => {
                const idx = currentMsgs.findIndex(m => m.id === msg.id);
                if (idx > -1) currentMsgs[idx] = msg;
                else currentMsgs.push(msg);
            });
            return { ...state, messages: currentMsgs.sort((a,b) => (b.createdAt || b.timestamp || '').localeCompare(a.createdAt || a.timestamp || '')) };
        }
        case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload };
        case 'SET_APPLICANTS': return { ...state, applicants: action.payload };
        case 'UPDATE_APPLICANT': return { ...state, applicants: state.applicants.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a) };
        
        // VEHICLE LOGS
        case 'SET_VEHICLE_LOGS': return { ...state, vehicleLogs: action.payload };
        case 'ADD_VEHICLE_LOG': return { ...state, vehicleLogs: [...state.vehicleLogs, action.payload] };
        case 'UPDATE_VEHICLE_LOG': return { ...state, vehicleLogs: state.vehicleLogs.map(l => l.id === action.payload.id ? action.payload : l) };
        case 'DELETE_VEHICLE_LOG': return { ...state, vehicleLogs: state.vehicleLogs.filter(l => l.id !== action.payload) };

        case 'SET_CUSTOMER_PROFILE': return { ...state, customerProfile: action.payload }; 
        case 'ADD_TASK': return state; 
        case 'UPDATE_TASK': return state; 
        case 'ADD_PERMIT': return state; 
        case 'UPDATE_PERMIT': return state; 
        case 'SET_INCIDENTS': return { ...state, incidents: action.payload, incidentReports: action.payload };
        case 'SET_BIDS': return { ...state, bids: action.payload };
        case 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW': return { ...state, activeJobIdForWorkflow: action.payload };

        default: return state;
    }
};