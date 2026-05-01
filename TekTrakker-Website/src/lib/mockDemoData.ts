
import type { User, Organization, Job, Customer, MembershipPlan, Proposal, InvoiceLineItem, PlatformLead, PlatformCommission, Project, Expense, EquipmentRental, Subcontractor, Applicant, BusinessDocument, Vehicle, Review } from '../types';

export interface SalesResource {
    id: string;
    repId: string;
    type: 'email' | 'sms' | 'script' | 'idea';
    title: string;
    content: string;
    createdAt: string;
}

export const MOCK_DEMO_ORG: Organization = {
    id: 'demo-org-123',
    name: 'Summit Peak Services',
    email: 'hello@summitpeak.demo',
    phone: '(555) 123-4567',
    industry: 'HVAC',
    address: {
        street: '123 mountain View Dr',
        city: 'Denver',
        state: 'CO',
        zip: '80202'
    },
    subscriptionStatus: 'active',
    plan: 'growth',
    primaryColor: '#0284c7',
    taxRate: 0.08,
    createdAt: new Date().toISOString(),
    enabledPanels: {
        inventory: true,
        marketing: true,
        memberships: true,
        documents: true,
        time_tracking: true,
        ats: true,
        project_management: true,
        asset_tracking: true,
        reporting: true
    }
};

export const MOCK_DEMO_USERS: User[] = [
    {
        id: 'demo-admin-id',
        uid: 'demo-admin-id',
        organizationId: 'demo-org-123',
        firstName: 'Alex',
        lastName: 'Admin',
        email: 'admin@demo.com',
        username: 'alex_admin',
        role: 'admin',
        status: 'active',
        payRate: 45,
        ptoAccrued: 40,
        preferences: { theme: 'light' }
    },
    {
        id: 'demo-tech-id',
        uid: 'demo-tech-id',
        organizationId: 'demo-org-123',
        firstName: 'Terry',
        lastName: 'Tech',
        email: 'tech@demo.com',
        username: 'terry_tech',
        role: 'employee',
        status: 'active',
        payRate: 30,
        ptoAccrued: 24,
        digitalId: 'TT-7788'
    },
    {
        id: 'demo-customer-user-id',
        uid: 'demo-customer-user-id',
        organizationId: 'demo-org-123',
        firstName: 'Jordan',
        lastName: 'Homeowner',
        email: 'jordan@demo.com',
        username: 'jordan_h',
        role: 'customer',
        status: 'active',
        payRate: 0,
        ptoAccrued: 0
    },
    {
        id: 'demo-sales-id',
        uid: 'demo-sales-id',
        organizationId: 'platform',
        firstName: 'Sam',
        lastName: 'Sales',
        email: 'platform@tektrakker.com',
        username: 'sam_sales',
        role: 'platform_sales',
        status: 'active',
        payRate: 0,
        ptoAccrued: 0
    }
];

export const MOCK_DEMO_CUSTOMERS: Customer[] = [
    {
        id: 'demo-cust-1',
        organizationId: 'demo-org-123',
        name: 'Jordan Homeowner',
        email: 'jordan@demo.com',
        phone: '(555) 987-6543',
        address: '742 Evergreen Terrace, Denver, CO 80204',
        customerType: 'Residential',
        hvacSystem: { brand: 'Carrier', type: 'Split System', installDate: '2018-05-12' },
        serviceHistory: [],
        marketingConsent: { sms: true, email: true, agreedAt: new Date().toISOString(), source: 'Demo' }
    },
    {
        id: 'demo-cust-2',
        organizationId: 'demo-org-123',
        name: 'Sarah Smith',
        email: 'sarah@example.com',
        phone: '(555) 111-2222',
        address: '101 Main St, Denver, CO 80202',
        customerType: 'Residential',
        hvacSystem: { brand: 'Trane', type: 'Heat Pump', installDate: '2020-11-03' },
        serviceHistory: [],
        marketingConsent: { sms: false, email: true, agreedAt: new Date().toISOString(), source: 'Demo' }
    }
];

export const MOCK_DEMO_APPLICANTS: Applicant[] = [
    {
        id: 'app-1',
        organizationId: 'demo-org-123',
        name: 'Michael Scott',
        firstName: 'Michael',
        lastName: 'Scott',
        email: 'mscott@dundermifflin.com',
        phone: '555-123-1234',
        status: 'Interviewing',
        position: 'HVAC Technician',
        appliedDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        applicationDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        notes: 'Seems promising, if a bit eccentric. Strong background in paper, not HVAC.',
        experienceYears: 10
    },
    {
        id: 'app-2',
        organizationId: 'demo-org-123',
        name: 'Dwight Schrute',
        firstName: 'Dwight',
        lastName: 'Schrute',
        email: 'dschrute@dundermifflin.com',
        phone: '555-321-4321',
        status: 'New',
        position: 'HVAC Technician',
        appliedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        applicationDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        notes: 'Claims extensive knowledge of bears, beets, and Battlestar Galactica.',
        experienceYears: 15
    },
    {
        id: 'app-3',
        organizationId: 'demo-org-123',
        name: 'Jim Halpert',
        firstName: 'Jim',
        lastName: 'Halpert',
        email: 'jhalpert@dundermifflin.com',
        phone: '555-987-9876',
        status: 'Hired',
        position: 'Install Helper',
        appliedDate: new Date(Date.now() - 86400000 * 20).toISOString(),
        applicationDate: new Date(Date.now() - 86400000 * 20).toISOString(),
        notes: 'Good candidate. Seems very relaxed.',
        experienceYears: 5
    }
];

export const MOCK_DEMO_DOCUMENTS: BusinessDocument[] = [
    {
        id: 'doc-1',
        organizationId: 'demo-org-123',
        title: 'Employee Handbook',
        type: 'Handbook',
        url: '#',
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        content: 'Mock content for handbook',
        createdBy: 'demo-admin-id'
    },
    {
        id: 'doc-2',
        organizationId: 'demo-org-123',
        title: 'Safety Protocol',
        type: 'Policy',
        url: '#',
        createdAt: new Date(Date.now() - 86400000 * 100).toISOString(),
        content: 'Mock content for safety protocol',
        createdBy: 'demo-admin-id'
    }
];

export const MOCK_DEMO_VEHICLES: Vehicle[] = [
    {
        id: 'vehicle-1',
        organizationId: 'demo-org-123',
        make: 'Ford',
        model: 'Transit',
        year: 2022,
        vin: 'DEMOVIN123456789',
        assignedUserId: 'demo-tech-id',
        licensePlate: 'DEMO-101',
        barcode: 'V-101'
    },
    {
        id: 'vehicle-2',
        organizationId: 'demo-org-123',
        make: 'Mercedes-Benz',
        model: 'Sprinter',
        year: 2021,
        vin: 'DEMOVIN987654321',
        assignedUserId: 'demo-admin-id', 
        licensePlate: 'DEMO-201',
        barcode: 'V-201'
    }
];

export const MOCK_DEMO_REVIEWS: Review[] = [
    {
        id: 'review-1',
        organizationId: 'demo-org-123',
        customerName: 'Jordan Homeowner',
        rating: 5,
        content: 'Terry was fantastic! He was on time, very professional, and fixed our AC in no time. Highly recommend Summit Peak!',
        date: new Date().toISOString(),
        platform: 'Google',
        responded: true
    },
    {
        id: 'review-2',
        organizationId: 'demo-org-123',
        customerName: 'Sarah Smith',
        rating: 4,
        content: 'The technician was polite and did a good job. Only knocking one star because he was a little later than the scheduled window.',
        date: new Date(Date.now() - 86400000 * 6).toISOString(),
        platform: 'Yelp',
        responded: false
    }
];

export const MOCK_DEMO_JOBS: Job[] = [
    {
        id: 'demo-job-1',
        organizationId: 'demo-org-123',
        customerName: 'Jordan Homeowner',
        customerId: 'demo-cust-1',
        customerEmail: 'jordan@demo.com', // Added
        address: '742 Evergreen Terrace, Denver, CO 80204',
        tasks: ['AC Not Cooling', 'Maintenance'],
        jobStatus: 'In Progress',
        appointmentTime: new Date().toISOString(),
        specialInstructions: 'Gate code 1234. Beware of dog.',
        assignedTechnicianId: 'demo-tech-id',
        assignedTechnicianName: 'Terry Tech',
        invoice: {
            id: 'INV-1001',
            items: [
                { id: 'item-1', name: 'Diagnostic Fee', quantity: 1, unitPrice: 89, total: 89, type: 'Fee', taxable: true, tier: 'Good' },
                { id: 'item-2', name: 'Transformer - 40VA (Foot Mount)', quantity: 1, unitPrice: 125, total: 125, type: 'Part', taxable: true, tier: 'Good' }
            ],
            subtotal: 214,
            taxAmount: 17.12,
            totalAmount: 231.12,
            status: 'Unpaid',
            createdAt: new Date().toISOString()
        },
        jobEvents: [],
        createdAt: new Date().toISOString()
    },
    {
        id: 'demo-job-2',
        organizationId: 'demo-org-123',
        customerName: 'Sarah Smith',
        customerId: 'demo-cust-2',
        customerEmail: 'sarah@example.com', // Added
        address: '101 Main St, Denver, CO 80202',
        tasks: ['Furnace Tune-Up', 'Filter Change'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 86400000 * 7).toISOString(),
        completionDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        specialInstructions: 'Customer has a cat, be careful not to let it out.',
        assignedTechnicianId: 'demo-tech-id',
        assignedTechnicianName: 'Terry Tech',
        invoice: {
            id: 'INV-1002',
            items: [
                { id: 'item-3', name: 'Gold Guardian Tune-up', quantity: 1, unitPrice: 0, total: 0, type: 'Fee', taxable: false, tier: 'Better' },
                { id: 'item-4', name: 'MERV 13 Filter', quantity: 1, unitPrice: 45, total: 45, type: 'Part', taxable: true, tier: 'Better' }
            ],
            subtotal: 45,
            taxAmount: 3.60,
            totalAmount: 48.60,
            status: 'Paid',
            createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
        },
        jobEvents: [],
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
    }
];

export const MOCK_DEMO_PROJECTS: Project[] = [
    {
        id: 'demo-project-1',
        organizationId: 'demo-org-123',
        name: 'New Furnace Installation',
        customerId: 'demo-cust-2',
        customerName: 'Sarah Smith',
        status: 'In Progress',
        budget: 7500,
        managerId: 'demo-admin-id',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        projectTasks: [
            {
                id: 'task-1',
                description: 'Install new furnace unit',
                status: 'In Progress',
                assignedTo: 'demo-tech-id',
                isBenchmark: true
            }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'demo-project-2',
        organizationId: 'demo-org-123',
        name: 'Office AC Upgrade',
        customerId: 'demo-cust-1',
        customerName: 'Jordan Homeowner',
        status: 'Completed',
        budget: 15000,
        managerId: 'demo-admin-id',
        startDate: new Date(Date.now() - 86400000 * 45).toISOString(),
        endDate: new Date(Date.now() - 86400000 * 30).toISOString(),
        projectTasks: [
            {
                id: 'task-p2-1',
                description: 'Install two rooftop units',
                status: 'Completed',
                assignedTo: 'demo-tech-id',
                isBenchmark: true
            }
        ],
        createdAt: new Date(Date.now() - 86400000 * 45).toISOString()
    }
];

export const MOCK_DEMO_PLANS: MembershipPlan[] = [
    {
        id: 'demo-plan-1',
        organizationId: 'demo-org-123',
        name: 'Silver Shield',
        monthlyPrice: 19.99,
        annualPrice: 199,
        discountPercentage: 10,
        discountScope: 'Both',
        visitsPerYear: 1,
        color: '#94a3b8',
        benefits: ['1 Annual Precision Tune-up', '10% Discount on Parts & Labor', 'Priority Scheduling']
    },
    {
        id: 'demo-plan-2',
        organizationId: 'demo-org-123',
        name: 'Gold Guardian',
        monthlyPrice: 29.99,
        annualPrice: 299,
        discountPercentage: 15,
        discountScope: 'Both',
        visitsPerYear: 2,
        color: '#eab308',
        benefits: ['2 Annual Precision Tune-ups', '15% Discount on Parts & Labor', 'No Diagnostic Fees', '24-Hour Service Guarantee']
    }
];

export const MOCK_DEMO_EXPENSES: Expense[] = [
    {
        id: 'demo-expense-1',
        organizationId: 'demo-org-123',
        paidByName: 'Terry Tech',
        paidById: 'demo-tech-id',
        category: 'Materials',
        amount: 75.50,
        description: 'Capacitors and contactors for stock',
        date: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 'demo-expense-2',
        organizationId: 'demo-org-123',
        paidByName: 'Alex Admin',
        paidById: 'demo-admin-id',
        category: 'Software',
        amount: 29.99,
        description: 'Monthly subscription for design software',
        date: new Date(Date.now() - 86400000 * 5).toISOString()
    }
];

export const MOCK_DEMO_RENTALS: EquipmentRental[] = [
    {
        id: 'demo-rental-1',
        organizationId: 'demo-org-123',
        projectId: 'demo-project-1',
        equipmentName: 'Mini Excavator',
        vendor: 'Sunbelt Rentals',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        cost: 1200,
        status: 'Active'
    },
    {
        id: 'demo-rental-2',
        organizationId: 'demo-org-123',
        projectId: 'demo-project-2',
        equipmentName: 'Crane for Rooftop Lift',
        vendor: 'United Rentals',
        startDate: new Date(Date.now() - 86400000 * 44).toISOString(),
        endDate: new Date(Date.now() - 86400000 * 44).toISOString(),
        cost: 2500,
        status: 'Returned'
    }
];

export const MOCK_DEMO_SUBCONTRACTORS: Subcontractor[] = [
    {
        id: 'demo-sub-1',
        organizationId: 'demo-org-123',
        companyName: 'Reliable Electricians',
        trade: 'Electrical',
        contactName: 'Jane Spark',
        phone: '555-333-4444',
        email: 'jane@reliable-electric.demo',
        status: 'Active',
        rating: 5
    },
    {
        id: 'demo-sub-2',
        organizationId: 'demo-org-123',
        companyName: 'Pro Crane Services',
        trade: 'Crane Operator',
        contactName: 'Hank Hill',
        phone: '555-555-1234',
        email: 'hank@procrane.demo',
        status: 'Inactive',
        rating: 4
    }
];

export const MOCK_DEMO_RESOURCES: SalesResource[] = [
    {
        id: 'res-1',
        repId: 'demo-sales-id',
        type: 'email',
        title: 'Initial HVAC Outreach',
        content: 'Hi {{name}},\n\nI noticed you are managing a high volume of service calls. TekTrakker can help automate your dispatch and field proposals...',
        createdAt: new Date().toISOString()
    },
    {
        id: 'res-2',
        repId: 'demo-sales-id',
        type: 'sms',
        title: 'Quick Follow Up',
        content: 'Hi {{name}}, just following up on our demo. Do you have 5 mins to chat about the new AI diagnostics feature?',
        createdAt: new Date().toISOString()
    }
];

// --- PLATFORM SALES DEMO DATA ---
export const MOCK_DEMO_LEADS: PlatformLead[] = [
    {
        id: 'lead-1',
        repId: 'demo-sales-id',
        companyName: 'Alpine HVAC',
        contactName: 'Mike Johnson',
        email: 'mike@alpinehvac.demo',
        phone: '555-0101',
        value: 12000,
        status: 'Negotiation',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
        id: 'lead-2',
        repId: 'demo-sales-id',
        companyName: 'City Plumbing Co',
        contactName: 'Lisa Wong',
        email: 'lisa@cityplumb.demo',
        phone: '555-0102',
        value: 5000,
        status: 'Demo Scheduled',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 'lead-3',
        repId: 'demo-sales-id',
        companyName: 'Bright Spark Electric',
        contactName: 'Tom Davis',
        email: 'tom@brightspark.demo',
        phone: '555-0103',
        value: 15000,
        status: 'Closed Won',
        createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    }
];

export const MOCK_DEMO_COMMISSIONS: PlatformCommission[] = [
    {
        id: 'comm-1',
        repId: 'demo-sales-id',
        organizationId: 'org-real-1',
        organizationName: 'Bright Spark Electric',
        amount: 3750,
        status: 'Pending',
        dateEarned: new Date(Date.now() - 86400000 * 2).toISOString(),
        baseAmount: 15000,
        rateUsed: 0.25
    },
    {
        id: 'comm-2',
        repId: 'demo-sales-id',
        organizationId: 'org-real-2',
        organizationName: 'Elite Roofing',
        amount: 1200,
        status: 'Paid',
        dateEarned: new Date(Date.now() - 86400000 * 45).toISOString(),
        datePaid: new Date(Date.now() - 86400000 * 10).toISOString(),
        baseAmount: 4800,
        rateUsed: 0.25
    }
];
