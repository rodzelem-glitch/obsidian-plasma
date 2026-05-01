
import type { Organization, User, Customer, Job, Project, Proposal, MembershipPlan, ServiceAgreement, BusinessDocument } from '../../types';

// --- APEX SERVICE SOLUTIONS - High-Revenue Demo Data ---

export const APEX_MOCK_ORG: Organization = {
    id: 'apex-org-456',
    name: 'Apex Service Solutions',
    email: 'contact@apex-solutions.demo',
    phone: '(555) 789-1234',
    industry: 'Commercial HVAC & Refrigeration',
    address: {
        street: '789 Commerce Parkway',
        city: 'Denver',
        state: 'CO',
        zip: '80216'
    },
    website: 'www.apex-solutions.demo',
    logoUrl: '/apex-logo.png',
    subscriptionStatus: 'active',
    plan: 'enterprise',
    primaryColor: '#4f46e5', // Indigo
    taxRate: 0.0825,
    createdAt: '2022-03-20T09:00:00Z',
    enabledPanels: {
        inventory: true,
        marketing: true,
        memberships: true,
        documents: true,
        time_tracking: true,
        reporting: true, // Enterprise feature
        api_access: true // Enterprise feature
    },
    reviewLink: 'https://g.page/r/BcdEfGhIjKl/review',
    financingLink: 'https://app.gethearth.com/apex-solutions',
    proposalDisclaimer: 'This proposal is valid for 60 days. Pricing reflects current market rates and is subject to change. All work is backed by our 100% satisfaction guarantee.',
    invoiceTerms: 'NET 30. A finance charge of 2% per month will be assessed on unpaid balances over 30 days.',
    socialLinks: {
        linkedin: 'https://linkedin.com/company/apex-solutions'
    }
};

export const MILE_HIGH_MOCK_ORG: Organization = {
    id: 'mhm-org-789',
    name: 'Mile High Mechanical',
    email: 'service@milehighmechanical.demo',
    phone: '(555) 234-5678',
    industry: 'Residential HVAC',
    address: {
        street: '456 Main Street',
        city: 'Denver',
        state: 'CO',
        zip: '80205'
    },
    website: 'www.milehighmechanical.demo',
    logoUrl: '/mhm-logo.png',
    subscriptionStatus: 'active',
    plan: 'growth',
    primaryColor: '#dc2626', // Red
    taxRate: 0.0765,
    createdAt: '2023-01-10T10:00:00Z',
    enabledPanels: {
        inventory: true,
        marketing: true,
        memberships: true,
        documents: true,
        time_tracking: true,
        reporting: false,
        api_access: false
    }
};

export const APEX_MOCK_USERS: User[] = [
    {
        id: 'apex-sales-manager-id',
        uid: 'apex-sales-manager-id',
        organizationId: 'apex-org-456',
        firstName: 'Valerie',
        lastName: 'Vance',
        email: 'valerie@apex-solutions.demo',
        username: 'valerie_vance',
        role: 'admin', // Sales Manager
        status: 'active',
        payRate: 120000, // Salary
        payType: 'salary',
        billableRate: 300,
        ptoAccrued: 160,
        hireDate: '2022-04-01',
        profilePicUrl: '/avatars/valerie.jpg',
        preferences: { theme: 'dark', notifications: true }
    },
    {
        id: 'apex-sales-rep-id',
        uid: 'apex-sales-rep-id',
        organizationId: 'apex-org-456',
        firstName: 'Richard',
        lastName: 'King',
        email: 'richard@apex-solutions.demo',
        username: 'richard_king',
        role: 'employee', // Sales Rep
        status: 'active',
        payRate: 80000, // Base Salary
        payType: 'salary',
        billableRate: 200, 
        commissionRate: 0.05, // 5% commission
        ptoAccrued: 80,
        hireDate: '2023-01-15',
        reportsTo: 'apex-sales-manager-id',
        profilePicUrl: '/avatars/richard.jpg'
    },
    {
        id: 'apex-lead-tech-id',
        uid: 'apex-lead-tech-id',
        organizationId: 'apex-org-456',
        firstName: 'Leo',
        lastName: 'Masters',
        email: 'leo@apex-solutions.demo',
        username: 'leo_masters',
        role: 'employee', // Lead Technician
        status: 'active',
        payRate: 55,
        payType: 'hourly',
        billableRate: 180,
        ptoAccrued: 60,
        hireDate: '2022-09-01',
        digitalId: 'LM-9012',
        profilePicUrl: '/avatars/leo.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2026-01-01' },
            { name: 'Advanced Commercial Refrigeration', expiryDate: '2025-06-01' }
        ]
    },
    {
        id: 'apex-tech-id',
        uid: 'apex-tech-id',
        organizationId: 'apex-org-456',
        firstName: 'Frank',
        lastName: 'Fisher',
        email: 'frank@apex-solutions.demo',
        username: 'frank_fisher',
        role: 'employee',
        status: 'active',
        payRate: 48,
        payType: 'hourly',
        billableRate: 160,
        ptoAccrued: 40,
        hireDate: '2023-05-20',
        digitalId: 'FF-3456',
        profilePicUrl: '/avatars/frank.jpg'
    },
    {
        id: 'apex-customer-id',
        uid: 'apex-customer-id',
        organizationId: 'apex-org-456',
        firstName: 'Eleanor',
        lastName: 'Sterling',
        email: 'eleanor@sterling.demo',
        username: 'eleanor_sterling',
        role: 'customer',
        status: 'active',
        payRate: 0,
        payType: 'na',
        billableRate: 0,
        ptoAccrued: 0,
        hireDate: 'na',
        profilePicUrl: '/avatars/eleanor.jpg'
    }
];

export const APEX_MOCK_CUSTOMERS: Customer[] = [
    {
        id: 'apex-cust-1',
        organizationId: 'apex-org-456',
        name: 'The Grand Hotel',
        firstName: 'Charles',
        lastName: 'Montgomery',
        email: 'charles@grandhotel.demo',
        phone: '(555) 300-1000',
        address: '1 Grand Plaza, Aspen, CO 81611',
        customerType: 'Commercial',
        notes: 'Contact for all maintenance and service requests. High-priority client.',
        equipment: [
            { id: 'eq-c1-1', brand: 'Trane', model: 'Chiller-500', serial: 'SN-CH-001', type: 'Chiller', location: 'Roof' },
            { id: 'eq-c1-2', brand: 'Trane', model: 'RTU-250', serial: 'SN-RTU-105', type: 'Rooftop Unit', location: 'Roof' },
            { id: 'eq-c1-3', brand: 'Manitowoc', model: 'Ice-500', serial: 'SN-ICE-020', type: 'Ice Machine', location: 'Kitchen 1' }
        ]
    },
    {
        id: 'apex-cust-2',
        organizationId: 'apex-org-456',
        name: 'Sterling Residences',
        firstName: 'Eleanor',
        lastName: 'Sterling',
        email: 'eleanor@sterling.demo',
        phone: '(555) 400-2000',
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        customerType: 'Residential',
        notes: 'High-net-worth individual. Requires discretion and premium service.',
        hvacSystem: { brand: 'Lennox', type: 'Geothermal', installDate: '2021-09-15' },
        equipment: [
            { id: 'eq-c2-1', brand: 'Lennox', model: 'GHP-100', serial: 'SN-GEO-001', type: 'Geothermal Heat Pump', location: 'Mechanical Room' },
            { id: 'eq-c2-2', brand: 'Aprilaire', model: 'Humid-800', serial: 'SN-HUM-005', type: 'Whole-Home Humidifier', location: 'Mechanical Room' }
        ]
    },
    {
        id: 'apex-cust-3',
        organizationId: 'apex-org-456',
        name: 'Mile High Distribution Center',
        firstName: 'Mike',
        lastName: 'Manager',
        email: 'mike@milehighdist.demo',
        phone: '(555) 500-3000',
        address: '500 Industrial Rd, Denver, CO 80216',
        customerType: 'Commercial',
        notes: 'Large warehouse with extensive refrigeration needs.',
        equipment: [
            { id: 'eq-c3-1', brand: 'Carrier', model: 'REF-1000', serial: 'SN-REF-801', type: 'Walk-in Cooler', location: 'Warehouse Section A' },
            { id: 'eq-c3-2', brand: 'Carrier', model: 'REF-1000', serial: 'SN-REF-802', type: 'Walk-in Cooler', location: 'Warehouse Section B' },
            { id: 'eq-c3-3', brand: 'Hoshizaki', model: 'IM-200', serial: 'SN-IM-301', type: 'Ice Machine', location: 'Breakroom' }
        ]
    }
];

export const APEX_MOCK_JOBS: Job[] = [
    {
        id: 'apex-job-1',
        organizationId: 'apex-org-456',
        customerName: 'The Grand Hotel',
        customerId: 'apex-cust-1',
        customerEmail: 'charles@grandhotel.demo', // Added
        address: '1 Grand Plaza, Aspen, CO 81611',
        tasks: ['Quarterly Chiller Maintenance', 'Filter Replacement'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(), // 5 days from now
        specialInstructions: 'Check in with facilities manager upon arrival. Use service entrance.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        invoice: {
            id: 'INV-2001',
            items: [
                { id: 'item-c1-1', description: 'Service Agreement Visit', quantity: 1, unitPrice: 0, total: 0, type: 'Fee', taxable: false }
            ],
            subtotal: 0,
            taxRate: 0.0825,
            taxAmount: 0,
            totalAmount: 0,
            amount: 0,
            status: 'Paid',
            paidDate: new Date().toISOString()
        },
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-2',
        organizationId: 'apex-org-456',
        customerName: 'Sterling Residences',
        customerId: 'apex-cust-2',
        customerEmail: 'eleanor@sterling.demo', // Added
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        tasks: ['Geothermal System Fault', 'Emergency Diagnosis'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 1 * 3600 * 1000).toISOString(), // 1 hour from now
        specialInstructions: 'High-priority client. Call ahead. Gate code is #5567.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        invoice: {
            id: 'INV-2002',
            items: [
                { id: 'item-c2-1', description: 'Emergency Diagnostic Fee', quantity: 1, unitPrice: 350, total: 350, type: 'Fee', taxable: true },
            ],
            subtotal: 350,
            taxRate: 0.0825,
            taxAmount: 28.88,
            totalAmount: 378.88,
            amount: 378.88,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'mhm-job-1',
        organizationId: 'mhm-org-789',
        customerName: 'Sterling Residences',
        customerId: 'apex-cust-2',
        customerEmail: 'eleanor@sterling.demo', // Added
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        tasks: ['Annual Furnace Tune-Up'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(), // 90 days ago
        completionDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianName: 'MHM Technician',
        invoice: {
            id: 'INV-MHM-101',
            items: [
                { id: 'item-mhm-1', description: 'Standard HVAC Tune-Up', quantity: 1, unitPrice: 129, total: 129, type: 'Service', taxable: false }
            ],
            subtotal: 129,
            taxRate: 0.0765,
            taxAmount: 0, // Not taxable
            totalAmount: 129,
            amount: 129,
            status: 'Paid',
            paidDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 92 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_DOCUMENTS: BusinessDocument[] = [
    {
        id: 'doc-waiver-1',
        organizationId: 'mhm-org-789',
        customerId: 'apex-cust-2',
        jobId: 'mhm-job-1',
        title: 'Signed Service Waiver - 1/15/24',
        category: 'Waiver',
        url: '#', // In a real scenario, this would be a URL to the PDF
        createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        version: '1.0'
    },
    {
        id: 'doc-invoice-1',
        organizationId: 'mhm-org-789',
        customerId: 'apex-cust-2',
        jobId: 'mhm-job-1',
        title: 'Paid Invoice - #INV-MHM-101',
        category: 'Invoice',
        url: '#',
        createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        version: '1.0'
    }
];

export const APEX_MOCK_PROJECTS: Project[] = [
    {
        id: 'apex-project-1',
        organizationId: 'apex-org-456',
        name: 'Grand Hotel Chiller Plant Retrofit',
        customerId: 'apex-cust-1',
        customerName: 'The Grand Hotel',
        status: 'In Progress',
        startDate: '2024-08-01T09:00:00Z',
        endDate: '2024-09-30T17:00:00Z',
        budget: 750000,
        description: 'Complete overhaul and modernization of the central chiller plant, including two new 500-ton chillers and associated controls.',
        address: '1 Grand Plaza, Aspen, CO 81611',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-lead-tech-id', 'apex-tech-id'],
        projectTasks: [
            {
                id: 'pt-1',
                description: 'Phase 1: Decommission and remove old chiller units',
                status: 'Completed',
                isBenchmark: true,
                dueDate: '2024-08-15'
            },
            {
                id: 'pt-2',
                description: 'Phase 2: Site prep and concrete pads for new units',
                status: 'In Progress',
                isBenchmark: true,
                dueDate: '2024-08-30'
            },
            {
                id: 'pt-3',
                description: 'Phase 3: Install new chillers and primary piping',
                status: 'Pending',
                isBenchmark: true,
                dueDate: '2024-09-15'
            },
            {
                id: 'pt-4',
                description: 'Phase 4: Electrical and controls integration',
                status: 'Pending',
                isBenchmark: true,
                dueDate: '2024-09-25'
            }
        ],
        createdAt: '2024-06-15T10:00:00Z'
    },
    {
        id: 'apex-project-2',
        organizationId: 'apex-org-456',
        name: 'Mile High Refrigeration Upgrade',
        customerId: 'apex-cust-3',
        customerName: 'Mile High Distribution Center',
        status: 'Planning',
        startDate: '2024-10-15T09:00:00Z',
        endDate: '2024-11-20T17:00:00Z',
        budget: 450000,
        description: 'Installation of two new high-efficiency walk-in freezer units and replacement of existing coolant lines.',
        address: '500 Industrial Rd, Denver, CO 80216',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-lead-tech-id'],
        projectTasks: [
            { id: 'pt2-1', description: 'Finalize equipment selection', status: 'Pending', isBenchmark: true, dueDate: '2024-09-30' },
            { id: 'pt2-2', description: 'Procure long-lead items', status: 'Pending', isBenchmark: false, dueDate: '2024-10-10' }
        ],
        createdAt: '2024-07-20T14:00:00Z'
    }
];

export const APEX_MOCK_PROPOSALS: Proposal[] = [
    {
        id: 'APEX-PROP-001',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        customerName: 'Sterling Residences',
        jobId: 'apex-job-2',
        status: 'Accepted',
        total: 28500,
        subtotal: 26325.23,
        taxAmount: 2174.77,
        createdAt: '2024-07-28T11:00:00Z',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        technicianId: 'apex-lead-tech-id',
        selectedOption: 'Best',
        items: [
            // Good - Repair
            { id: 'ap-item-1', name: 'Compressor Repair', description: 'Repair existing geothermal compressor. 1-year warranty.', quantity: 1, price: 8500, total: 8500, type: 'Labor', tier: 'Good' },
            
            // Better - Replacement
            { id: 'ap-item-2', name: 'Geothermal Compressor Replacement', description: 'Replace with OEM compressor. 5-year warranty.', quantity: 1, price: 16000, total: 16000, type: 'Part', tier: 'Better', taxable: true },
            { id: 'ap-item-3', name: 'Full System Flush & Recharge', quantity: 1, price: 2500, total: 2500, type: 'Labor', tier: 'Better' },

            // Best - Full Unit Replacement
            { id: 'ap-item-4', name: 'New High-Efficiency Geothermal Unit', description: 'Lennox GHP-120 with 15-year parts and labor warranty.', quantity: 1, price: 25000, total: 25000, type: 'Part', tier: 'Best', taxable: true },
            { id: 'ap-item-5', name: 'Premium Installation & Commissioning', quantity: 1, price: 3500, total: 3500, type: 'Labor', tier: 'Best' }
        ]
    },
    {
        id: 'APEX-PROP-002',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-1',
        customerName: 'The Grand Hotel',
        jobId: 'apex-job-1',
        status: 'Pending',
        total: 18500,
        subtotal: 17092.34,
        taxAmount: 1407.66,
        createdAt: '2024-07-25T16:30:00Z',
        createdById: 'apex-sales-rep-id',
        createdByName: 'Richard King',
        technicianId: 'apex-lead-tech-id',
        selectedOption: null,
        items: [
            { id: 'ap2-item-1', name: 'Ice Machine Coil Cleaning', description: 'Chemical cleaning of condenser and evaporator coils.', quantity: 2, price: 800, total: 1600, type: 'Labor', tier: 'Good' },
            { id: 'ap2-item-2', name: 'Controls Upgrade', description: 'Upgrade RTU controls to new digital thermostats.', quantity: 4, price: 4000, total: 16000, type: 'Part', taxable: true, tier: 'Better' },
            { id: 'ap2-item-3', name: 'Extended Warranty', description: 'Adds 2 years to standard warranty.', quantity: 1, price: 900, total: 900, type: 'Fee', tier: 'Best' }
        ]
    }
];

export const APEX_MOCK_PLANS: MembershipPlan[] = [
    {
        id: 'apex-plan-1',
        organizationId: 'apex-org-456',
        name: 'Commercial Advantage',
        monthlyPrice: 249,
        annualPrice: 2800,
        discountPercentage: 15,
        discountScope: 'Both',
        visitsPerYear: 4,
        color: '#374151',
        benefits: ['4 Annual Precision Tune-ups per unit', '15% Discount on Parts & Labor', '24/7 Emergency Service', 'Dedicated Account Manager']
    },
    {
        id: 'apex-plan-2',
        organizationId: 'apex-org-456',
        name: 'Residential Elite',
        monthlyPrice: 79,
        annualPrice: 850,
        discountPercentage: 20,
        discountScope: 'Both',
        visitsPerYear: 2,
        color: '#4f46e5',
        benefits: ['2 Annual Precision Tune-ups', '20% Discount on all services', 'No Diagnostic Fees', 'Air Quality Monitoring']
    }
];

export const APEX_MOCK_AGREEMENTS: ServiceAgreement[] = [
    {
        id: 'SA-APEX-001',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-1',
        customerName: 'The Grand Hotel',
        planName: 'Commercial Advantage',
        price: 11200, // 4 units @ 2800/yr
        billingCycle: 'Annual',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'Active',
        visitsTotal: 16, // 4 visits x 4 units
        visitsRemaining: 12
    },
    {
        id: 'SA-APEX-002',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        customerName: 'Sterling Residences',
        planName: 'Residential Elite',
        price: 79,
        billingCycle: 'Monthly',
        startDate: '2023-09-01',
        endDate: '2024-09-01',
        status: 'Active',
        visitsTotal: 2,
        visitsRemaining: 1
    }
];
