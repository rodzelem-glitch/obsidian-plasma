
import { User, Organization, Job, Customer, MembershipPlan, Proposal, InvoiceLineItem, PlatformLead, PlatformCommission, Project, Expense, EquipmentRental, Subcontractor, Applicant, BusinessDocument, Vehicle, Review } from '../types';

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
        experienceYears: 10,
        resumeDataUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        resumeFileName: 'michael_scott_resume.pdf'
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
        experienceYears: 15,
        resumeDataUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        resumeFileName: 'schrute_farms_cv.pdf'
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
        id: 'apex-veh-1',
        organizationId: 'apex-org-456',
        make: 'Ford',
        model: 'Transit 250 High Roof Extended',
        year: 2023,
        vin: '1FTBR2Y83PK109283',
        assignedUserId: 'apex-lead-tech-id',
        licensePlate: 'APEX-101',
        barcode: 'V-APEX-101'
    },
    {
        id: 'apex-veh-2',
        organizationId: 'apex-org-456',
        make: 'Mercedes-Benz',
        model: 'Sprinter 2500 Cargo Van',
        year: 2022,
        vin: 'WD3PF4CD5NP492019',
        assignedUserId: 'apex-tech-id',
        licensePlate: 'APEX-102',
        barcode: 'V-APEX-102'
    },
    {
        id: 'apex-veh-3',
        organizationId: 'apex-org-456',
        make: 'Ram',
        model: 'ProMaster 3500 High Roof',
        year: 2023,
        vin: '3C6URVJG9PE819203',
        assignedUserId: 'apex-tech-3-id',
        licensePlate: 'APEX-103',
        barcode: 'V-APEX-103'
    },
    {
        id: 'apex-veh-4',
        organizationId: 'apex-org-456',
        make: 'Ford',
        model: 'F-250 Super Duty Service Body',
        year: 2024,
        vin: '1FT8W2BN8REC99210',
        assignedUserId: 'apex-tech-4-id',
        licensePlate: 'APEX-104',
        barcode: 'V-APEX-104'
    },
    {
        id: 'apex-veh-5',
        organizationId: 'apex-org-456',
        make: 'Chevrolet',
        model: 'Express 3500 Utility Van',
        year: 2021,
        vin: '1GC4G0BG8M1109482',
        assignedUserId: 'apex-sales-manager-id',
        licensePlate: 'APEX-105',
        barcode: 'V-APEX-105'
    },
    {
        id: 'apex-veh-6',
        organizationId: 'apex-org-456',
        make: 'Ford',
        model: 'Transit 350 Extended High Roof (VRF Lab)',
        year: 2023,
        vin: '1FTNE3Y89PK884920',
        assignedUserId: 'apex-tech-5-id',
        licensePlate: 'APEX-106',
        barcode: 'V-APEX-106'
    },
    {
        id: 'apex-veh-7',
        organizationId: 'apex-org-456',
        make: 'Ram',
        model: '4500 Heavy-Duty Service Crane Body (Steam & Boilers)',
        year: 2024,
        vin: '3C7WRNCL4RG772910',
        assignedUserId: 'apex-tech-6-id',
        licensePlate: 'APEX-107',
        barcode: 'V-APEX-107'
    },
    {
        id: 'apex-veh-8',
        organizationId: 'apex-org-456',
        make: 'Mercedes-Benz',
        model: 'Sprinter 3500 Cleanroom TAB Calibration Mobile Lab',
        year: 2024,
        vin: 'WD3PF4EE8RP551029',
        assignedUserId: 'apex-tech-7-id',
        licensePlate: 'APEX-108',
        barcode: 'V-APEX-108'
    },
    {
        id: 'apex-veh-9',
        organizationId: 'apex-org-456',
        make: 'Peterbilt',
        model: '348 Heavy Commercial Chiller Rigging Truck',
        year: 2022,
        vin: '1NPAL40X8ND901824',
        assignedUserId: 'apex-lead-tech-id',
        licensePlate: 'APEX-109',
        barcode: 'V-APEX-109'
    },
    {
        id: 'apex-veh-10',
        organizationId: 'apex-org-456',
        make: 'Ford',
        model: 'F-150 Lightning Pro EV (Commercial Estimating)',
        year: 2024,
        vin: '1FT6W1EV9PW119024',
        assignedUserId: 'apex-estimator-id',
        licensePlate: 'APEX-110',
        barcode: 'V-APEX-110'
    },
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
        id: 'rev-apex-1',
        organizationId: 'apex-org-456',
        customerName: 'Charles Montgomery (The Grand Hotel)',
        rating: 5,
        content: 'Apex Service Solutions and TekTrakker have transformed our hospitality facility operations. The central chiller overhaul was completed ahead of schedule, and their technicians are true master craftsmen. The digital proposals and transparent pricing make board approvals effortless.',
        date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Thank you Charles! It is an absolute privilege partnering with The Grand Hotel. We appreciate your continued trust in our commercial team.'
    },
    {
        id: 'rev-apex-2',
        organizationId: 'apex-org-456',
        customerName: 'Eleanor Sterling (Sterling Residences)',
        rating: 5,
        content: 'Leo Masters was prompt, respectful, and remarkably thorough when diagnosing our geothermal system. Approving the repair proposal digitally from my iPad with clear Good/Better/Best tiers made the whole experience painless.',
        date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Mrs. Sterling, thank you for your kind words! We pride ourselves on white-glove residential service and ensuring your comfort year-round.'
    },
    {
        id: 'rev-apex-3',
        organizationId: 'apex-org-456',
        customerName: 'Liam O\'Connor (Rocky Mountain Brewery)',
        rating: 5,
        content: 'When our glycol chiller faulted right in the middle of a massive fermentation cycle, Apex had Leo on site in under 45 minutes. Saved a $60,000 batch of our flagship IPA. Their preventative agreement is worth every penny.',
        date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Cheers Liam! Keeping Colorado brewing at peak performance is what we live for. Glad we could save the batch!'
    },
    {
        id: 'rev-apex-4',
        organizationId: 'apex-org-456',
        customerName: 'Dr. Rebecca Alvarez (Front Range Surgery Center)',
        rating: 5,
        content: 'Sam Rivera demonstrated exceptional professionalism adhering to our cleanroom sterile protocol. Differential pressure readings and HEPA certification documents were delivered straight to our compliance inbox before he even left.',
        date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true
    },
    {
        id: 'rev-apex-5',
        organizationId: 'apex-org-456',
        customerName: 'Derek Stone (Denver Tech Logistics Hub)',
        rating: 5,
        content: 'Frank Fisher and the Apex service crew maintain 4 major rooftop packaged units for our sorting facility. Zero downtime during peak summer heat waves. Top tier contractor.',
        date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: false
    },
    {
        id: 'rev-apex-6',
        organizationId: 'apex-org-456',
        customerName: 'Nate Carlson (Alpine Peak Data Facility)',
        rating: 5,
        content: 'Mission-critical data center precision cooling requires zero margin for error. Apex understands precision CRAC units, underfloor airflow, and tight SLAs. Highly recommended for commercial facilities.',
        date: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true
    },
    {
        id: 'rev-apex-7',
        organizationId: 'apex-org-456',
        customerName: 'Julian Mercer (Highlands Luxury Lofts HOA)',
        rating: 5,
        content: 'Managing HVAC and boilers for 48 luxury condominiums used to give our HOA board headaches. Apex streamlined our annual maintenance contracts and our utility bills are noticeably lower.',
        date: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: false
    },
    {
        id: 'rev-apex-8',
        organizationId: 'apex-org-456',
        customerName: 'Dr. Arthur Vance',
        rating: 5,
        content: 'Courteous, meticulous technicians who wear shoe covers and explain technical readings in plain English. Our whole-home air filtration system is performing flawlessly.',
        date: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true
    },
    {
        id: 'rev-apex-9',
        organizationId: 'apex-org-456',
        customerName: 'Marcus Vance (Denver International Airport)',
        rating: 5,
        content: 'Managing Concourse B central utility infrastructure requires world-class partners. Leo Masters and the Apex engineering crew completed the 1200-ton chiller overhaul ahead of holiday travel without a single passenger area temperature excursion. Their automated service reports and ASME/ASHRAE documentation are second to none.',
        date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Thank you Marcus! Keeping DIA travelers comfortable 24/7 is a mission we take immense pride in.'
    },
    {
        id: 'rev-apex-10',
        organizationId: 'apex-org-456',
        customerName: 'Dr. Sarah Lin (CU Anschutz Medical Research Campus)',
        rating: 5,
        content: 'Our BSL-3 surgical suites and research cleanrooms demand zero tolerance for air balance fluctuations. Sam Rivera and Elena Rostova delivered flawless ISO Class 5 HEPA certifications and Phoenix Controls calibration. Exceptional engineering caliber.',
        date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Dr. Lin, we appreciate your continued trust. Supporting life-saving biomedical research with precision biocontainment is an honor.'
    },
    {
        id: 'rev-apex-11',
        organizationId: 'apex-org-456',
        customerName: 'James Sterling (Lockheed Martin Space Systems)',
        rating: 5,
        content: 'Apex’s response time and technical rigor on our satellite cleanroom desiccant system were exemplary. Their technicians hold all required security clearances and treat high-value space hardware with paramount care.',
        date: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Thank you James. We look forward to supporting upcoming satellite integration milestones.'
    },
    {
        id: 'rev-apex-12',
        organizationId: 'apex-org-456',
        customerName: 'David K. Ramirez (CoreSite DNV2 Enterprise Data Center)',
        rating: 5,
        content: 'When CRAC #4 experienced an inverter fault on a 98-degree afternoon, Marcus Brody was in our server pod in 35 minutes. N+1 redundancy preserved, zero thermal throttles. Their mission-critical SLA is real.',
        date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'David, 100% uptime is our commitment to CoreSite. Glad we could resolve the inverter instantly.'
    },
    {
        id: 'rev-apex-13',
        organizationId: 'apex-org-456',
        customerName: 'Robert Pemberton (The Broadmoor Resort & International Center)',
        rating: 5,
        content: 'Brett Anderson and the hydronics crew handled our high-pressure steam boiler recertification and cooling tower alignment seamlessly. Historic luxury properties require contractors who respect tradition while delivering cutting-edge efficiency.',
        date: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(),
        platform: 'Google',
        responded: true,
        responseContent: 'Thank you Robert! The Broadmoor is a Colorado legend and we are honored to keep its central plant operating at peak efficiency.'
    },
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
        rating: 5,
        content: 'The technician was polite, extremely clean, and replaced our blower capacitor in 20 minutes. Great experience!',
        date: new Date(Date.now() - 86400000 * 6).toISOString(),
        platform: 'Google',
        responded: true
    }
];

export const MOCK_DEMO_JOBS: Job[] = [
    {
        id: 'job-23rd-565621',
        organizationId: 'demo-org-123',
        customerName: '23rd Group Facility Services',
        customerId: 'cust-23rd-group',
        customerEmail: 'VendorInvoices@23rdgroup.com',
        workOrderNumber: '565621',
        poNumber: 'REF: 344489',
        address: '5920 FM 78, San Antonio, TX 78219',
        tasks: ['HVAC Diagnostics & Temperature Audit', 'Humana #06148 Conviva Kirby - Temp set at 70, displaying 75'],
        jobStatus: 'Scheduled',
        appointmentTime: '2026-08-10T08:00:00.000Z',
        assignedCrew: ['ryan-user-id'],
        assignedTechnicianId: 'ryan-user-id',
        assignedTechnicianName: 'Ryan Vavrecan',
        nteLimit: 300,
        checkInPhoneNumber: '704-823-6108',
        checkInPinCode: '348137',
        checkInWorkOrderNumber: '565621',
        accountManagerContact: {
            name: 'Taylor C.',
            phone: '(704) 909-4423',
            extension: '7990',
            email: 'TaylorC@23rdgroup.com'
        },
        specialInstructions: 'MANDATORY FOR ALL HUMANA CLINICAL LOCATIONS:\n- 1st trip completion PREFERRED wherever possible\n- IVR MUST BE USED TO CHECK IN/OUT (Call 704-823-6108, PIN 348137, WO# 565621)\n- Technician MUST wear mask when working within clinics (Patient-facing client)\n- Proper Dress Code Required\n- Check in and out with manager on duty\n- NO VAPING/SMOKING ON CLINIC PROPERTY\n- All requests for NTE increase must be made while tech is onsite (Labor MUST match IVR hours)\n- Call AM (Taylor C. 704-909-4423 x7990) prior to leaving site for NTE increase or ballpark quote\n- Proposals required within 24 hours of site visit\n- Record make/model # of HVAC unit(s) being serviced',
        files: [
            {
                id: 'file-wo-565621',
                name: 'WorkOrder_565621_23rdGroup_Humana.pdf',
                url: 'https://firebasestorage.googleapis.com/v0/b/tektrakker.appspot.com/o/work_orders%2FWorkOrder_565621_23rdGroup_Humana.pdf?alt=media',
                type: 'pdf',
                size: '245 KB',
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'System'
            }
        ],
        jobEvents: [{ type: 'assignment', timestamp: new Date().toISOString(), user: 'TekAir Dispatch' }],
        createdAt: new Date().toISOString()
    },
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
        id: 'apex-exp-1',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Ferguson HVAC Supply - Denver',
        category: 'Materials',
        amount: 5400.00,
        subtotal: 5400.00,
        taxAmount: 0,
        description: 'Copeland Discus 15-HP Semi-Hermetic Compressor (Stock replenishment for Rocky Mtn Brewery job)',
        date: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-2',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Johnstone Supply',
        category: 'Materials',
        amount: 8900.00,
        subtotal: 8900.00,
        taxAmount: 0,
        description: 'Carrier Commercial Blast Freeze Evaporator Coil Assembly OEM',
        date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-3',
        organizationId: 'apex-org-456',
        paidByName: 'Frank Fisher',
        paidById: 'apex-tech-id',
        createdById: 'apex-tech-id',
        createdByName: 'Frank Fisher',
        paidBy: 'Frank Fisher',
        vendor: 'Trane Supply Denver Wholesale',
        category: 'Materials',
        amount: 1850.00,
        subtotal: 1850.00,
        taxAmount: 0,
        description: 'R-410A (x4 25-lb cylinders) & R-404A Low Temp Refrigerant',
        date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-4',
        organizationId: 'apex-org-456',
        paidByName: 'Sam Rivera',
        paidById: 'apex-tech-4-id',
        createdById: 'apex-tech-4-id',
        createdByName: 'Sam Rivera',
        paidBy: 'Sam Rivera',
        vendor: 'Grainger Industrial',
        category: 'Materials',
        amount: 1420.00,
        subtotal: 1420.00,
        taxAmount: 0,
        description: 'Cleanroom Medical Grade HEPA Filters (24x24x12 99.99%) - Front Range Surgery Center stock',
        date: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-5',
        organizationId: 'apex-org-456',
        paidByName: 'Marcus Brody',
        paidById: 'apex-tech-3-id',
        createdById: 'apex-tech-3-id',
        createdByName: 'Marcus Brody',
        paidBy: 'Marcus Brody',
        vendor: 'Carrier Enterprise Rocky Mountain',
        category: 'Materials',
        amount: 780.00,
        subtotal: 780.00,
        taxAmount: 0,
        description: 'High-Capacity Pleated MERV 11 Commercial Filter Sets (4 Cartons)',
        date: new Date(Date.now() - 17 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-6',
        organizationId: 'apex-org-456',
        paidByName: 'Frank Fisher',
        paidById: 'apex-tech-id',
        createdById: 'apex-tech-id',
        createdByName: 'Frank Fisher',
        paidBy: 'Frank Fisher',
        vendor: 'United Rentals Denver',
        category: 'Equipment Rental',
        amount: 1250.00,
        subtotal: 1250.00,
        taxAmount: 0,
        description: '45-ft Articulating Electric Boom Lift - Denver Tech Logistics RTU Service',
        date: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-7',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Shell Fleet Commercial',
        category: 'Car and truck expenses',
        amount: 540.00,
        subtotal: 540.00,
        taxAmount: 0,
        description: 'Fleet Fuel Card - Ford Transit 250 (Van #101)',
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-8',
        organizationId: 'apex-org-456',
        paidByName: 'Frank Fisher',
        paidById: 'apex-tech-id',
        createdById: 'apex-tech-id',
        createdByName: 'Frank Fisher',
        paidBy: 'Frank Fisher',
        vendor: 'Shell Fleet Commercial',
        category: 'Car and truck expenses',
        amount: 480.00,
        subtotal: 480.00,
        taxAmount: 0,
        description: 'Fleet Fuel Card - Sprinter 2500 (Van #102)',
        date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-9',
        organizationId: 'apex-org-456',
        paidByName: 'Marcus Brody',
        paidById: 'apex-tech-3-id',
        createdById: 'apex-tech-3-id',
        createdByName: 'Marcus Brody',
        paidBy: 'Marcus Brody',
        vendor: 'Shell Fleet Commercial',
        category: 'Car and truck expenses',
        amount: 510.00,
        subtotal: 510.00,
        taxAmount: 0,
        description: 'Fleet Fuel Card - ProMaster 3500 (Van #103)',
        date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-10',
        organizationId: 'apex-org-456',
        paidByName: 'Sam Rivera',
        paidById: 'apex-tech-4-id',
        createdById: 'apex-tech-4-id',
        createdByName: 'Sam Rivera',
        paidBy: 'Sam Rivera',
        vendor: 'Shell Fleet Commercial',
        category: 'Car and truck expenses',
        amount: 495.00,
        subtotal: 495.00,
        taxAmount: 0,
        description: 'Fleet Fuel Card - F-250 Service Body (Truck #104)',
        date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-11',
        organizationId: 'apex-org-456',
        paidByName: 'Sam Rivera',
        paidById: 'apex-tech-4-id',
        createdById: 'apex-tech-4-id',
        createdByName: 'Sam Rivera',
        paidBy: 'Sam Rivera',
        vendor: 'Fieldpiece Instruments Direct',
        category: 'Tools & Equipment',
        amount: 895.00,
        subtotal: 895.00,
        taxAmount: 0,
        description: 'SMAN 4-Port Wireless Digital Manifold with Micron Gauge & Pipe Clamps',
        date: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-12',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Fluke Calibration Laboratory',
        category: 'Tools & Equipment',
        amount: 650.00,
        subtotal: 650.00,
        taxAmount: 0,
        description: 'Annual NIST Traceable Calibration for Tech Multimeters & Insulation Testers',
        date: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-13',
        organizationId: 'apex-org-456',
        paidByName: 'Valerie Vance',
        paidById: 'apex-sales-manager-id',
        createdById: 'apex-sales-manager-id',
        createdByName: 'Valerie Vance',
        paidBy: 'Valerie Vance',
        vendor: 'HVAC Excellence & NATE',
        category: 'Professional Development',
        amount: 750.00,
        subtotal: 750.00,
        taxAmount: 0,
        description: 'Commercial Variable Refrigerant Flow (VRF) & Chiller Master Recertifications (4 Techs)',
        date: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-14',
        organizationId: 'apex-org-456',
        paidByName: 'Frank Fisher',
        paidById: 'apex-tech-id',
        createdById: 'apex-tech-id',
        createdByName: 'Frank Fisher',
        paidBy: 'Frank Fisher',
        vendor: 'The Home Depot Pro',
        category: 'Materials',
        amount: 410.00,
        subtotal: 410.00,
        taxAmount: 0,
        description: 'Unistrut Channels, 15% Silver Solder Braze Alloys & Nitrogen Regulator Fittings',
        date: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-15',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Sunbelt Rentals Denver',
        category: 'Equipment Rental',
        amount: 2100.00,
        subtotal: 2100.00,
        taxAmount: 0,
        description: '50-Ton Mobile Trailer Chiller Temporary Bypass - Grand Hotel Chiller Retrofit Phase 1',
        date: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-16',
        organizationId: 'apex-org-456',
        paidByName: 'Valerie Vance',
        paidById: 'apex-sales-manager-id',
        createdById: 'apex-sales-manager-id',
        createdByName: 'Valerie Vance',
        paidBy: 'Valerie Vance',
        vendor: 'Magid Glove & Safety',
        category: 'Safety & Compliance',
        amount: 580.00,
        subtotal: 580.00,
        taxAmount: 0,
        description: 'NFPA 70E Arc Flash Safety Hoods, 1000V Insulated Gloves & Hard Hats',
        date: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-17',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Trane Commercial Direct',
        category: 'Materials',
        amount: 32500.00,
        subtotal: 32500.00,
        taxAmount: 0,
        description: 'Centravac Chiller OEM Replacement 520-Tube Condenser Bundle & Rupture Discs',
        date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-18',
        organizationId: 'apex-org-456',
        paidByName: 'Marcus Brody',
        paidById: 'apex-tech-3-id',
        createdById: 'apex-tech-3-id',
        createdByName: 'Marcus Brody',
        paidBy: 'Marcus Brody',
        vendor: 'Johnson Controls Metasys Direct',
        category: 'Materials',
        amount: 18400.00,
        subtotal: 18400.00,
        taxAmount: 0,
        description: 'Metasys NAE55 Supervisory BACnet DDC Controllers & VAV Actuators',
        date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-19',
        organizationId: 'apex-org-456',
        paidByName: 'Valerie Vance',
        paidById: 'apex-operations-vp-id',
        createdById: 'apex-operations-vp-id',
        createdByName: 'Valerie Vance',
        paidBy: 'Valerie Vance',
        vendor: 'Sterett Crane & Rigging',
        category: 'Equipment Rental',
        amount: 14800.00,
        subtotal: 14800.00,
        taxAmount: 0,
        description: '120-Ton Hydraulic All-Terrain Mobile Crane 3-Day Rigging Mobilization (DIA Central Plant)',
        date: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-20',
        organizationId: 'apex-org-456',
        paidByName: 'Sam Rivera',
        paidById: 'apex-tech-4-id',
        createdById: 'apex-tech-4-id',
        createdByName: 'Sam Rivera',
        paidBy: 'Sam Rivera',
        vendor: 'Camfil Clean Air Solutions',
        category: 'Materials',
        amount: 9600.00,
        subtotal: 9600.00,
        taxAmount: 0,
        description: 'Megalam ISO Class 5 Fluid-Seal Terminal Cleanroom HEPA Filters (CU Anschutz)',
        date: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-21',
        organizationId: 'apex-org-456',
        paidByName: 'Leo Masters',
        paidById: 'apex-lead-tech-id',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        paidBy: 'Leo Masters',
        vendor: 'Airgas Industrial Gases',
        category: 'Supplies',
        amount: 6250.00,
        subtotal: 6250.00,
        taxAmount: 0,
        description: 'R-513A Low-GWP Refrigerant (8x 125lb Cylinders) & High-Purity Dry Nitrogen',
        date: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-22',
        organizationId: 'apex-org-456',
        paidByName: 'Valerie Vance',
        paidById: 'apex-operations-vp-id',
        createdById: 'apex-operations-vp-id',
        createdByName: 'Valerie Vance',
        paidBy: 'Valerie Vance',
        vendor: 'Shell Commercial Fleet Services',
        category: 'Car and truck expenses',
        amount: 3850.00,
        subtotal: 3850.00,
        taxAmount: 0,
        description: 'Monthly Commercial Fleet Diesel & Gasoline Billing (8 Heavy Service Vans/Trucks)',
        date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
    {
        id: 'apex-exp-23',
        organizationId: 'apex-org-456',
        paidByName: 'Valerie Vance',
        paidById: 'apex-operations-vp-id',
        createdById: 'apex-operations-vp-id',
        createdByName: 'Valerie Vance',
        paidBy: 'Valerie Vance',
        vendor: 'Travelers Commercial Specialty Insurance',
        category: 'Insurance',
        amount: 7400.00,
        subtotal: 7400.00,
        taxAmount: 0,
        description: 'Commercial General Liability, $10M Umbrella & Mission-Critical Rigging Rider',
        date: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(),
        expenseType: 'business'
    },
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
    },
    {
        id: 'demo-expense-sales-1',
        organizationId: 'platform',
        paidByName: 'Sam Sales',
        paidById: 'demo-sales-id',
        createdById: 'demo-sales-id',
        createdByName: 'Sam Sales',
        paidBy: 'Sam Sales',
        category: 'Travel',
        amount: 120.00,
        description: 'Flight to customer demo site',
        date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        expenseType: 'business'
    },
    {
        id: 'demo-expense-sales-2',
        organizationId: 'platform',
        paidByName: 'Sam Sales',
        paidById: 'demo-sales-id',
        createdById: 'demo-sales-id',
        createdByName: 'Sam Sales',
        paidBy: 'Sam Sales',
        category: 'Meals (50% deductible)',
        amount: 45.50,
        description: 'Client lunch with Bright Spark Electric',
        date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
        expenseType: 'business'
    }
];

export const MOCK_DEMO_RENTALS: EquipmentRental[] = [
    {
        id: 'apex-rental-1',
        organizationId: 'apex-org-456',
        projectId: 'apex-project-1',
        equipmentName: '120-Ton Hydraulic Mobile Crane Rig',
        vendor: 'Sterett Crane & Rigging',
        startDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        endDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        cost: 6500,
        status: 'Active'
    },
    {
        id: 'apex-rental-2',
        organizationId: 'apex-org-456',
        projectId: 'demo-project-1',
        equipmentName: '40-Ton Boom Crane for Retail RTU Lift',
        vendor: 'United Rentals Heavy Equipment',
        startDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        endDate: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
        cost: 2800,
        status: 'Returned'
    },
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
        id: 'apex-sub-1',
        organizationId: 'apex-org-456',
        companyName: 'Mile High Industrial Electrical Contractors',
        trade: 'Electrical',
        contactName: 'Marcus Vance',
        phone: '(555) 720-3300',
        email: 'mvance@milehighelectric.demo',
        status: 'Active',
        rating: 5
    },
    {
        id: 'apex-sub-2',
        organizationId: 'apex-org-456',
        companyName: 'Rocky Mountain Crane & Rigging Specialists',
        trade: 'Crane Operator',
        contactName: 'Garrett Holt',
        phone: '(555) 890-4411',
        email: 'gholt@rockymtncrane.demo',
        status: 'Active',
        rating: 5
    },
    {
        id: 'apex-sub-3',
        organizationId: 'apex-org-456',
        companyName: 'Alpine Environmental Insulation & Duct Testing',
        trade: 'Insulation & TAB',
        contactName: 'Chloe Keller',
        phone: '(555) 441-9988',
        email: 'ckeller@alpine-env.demo',
        status: 'Active',
        rating: 5
    },
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
