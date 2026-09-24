
import type { 
    Organization, User, Customer, Job, Project, Proposal, MembershipPlan, 
    ServiceAgreement, BusinessDocument, InventoryItem, RefrigerantCylinder, 
    RefrigerantTransaction, MarketingCampaign, IncidentReport, PartOrder, Bid, Applicant, Appointment 
} from '../../types';
import { MOCK_DEMO_PROPOSALS } from './proposals';
import {
    MOCK_DEMO_VEHICLES,
    MOCK_DEMO_REVIEWS,
    MOCK_DEMO_EXPENSES,
    MOCK_DEMO_RENTALS,
    MOCK_DEMO_SUBCONTRACTORS
} from '../mockDemoData';

// --- APEX SERVICE SOLUTIONS - High-Revenue Demo Data ---

export const APEX_MOCK_ORG: Organization = {
    id: 'apex-org-456',
    name: 'Apex Mechanical & Mission-Critical Solutions',
    email: 'contact@apex-solutions.demo',
    phone: '(555) 789-1234',
    industry: 'Commercial, Industrial & Mission-Critical Mechanical Engineering',
    address: {
        street: '789 Enterprise Parkway, Suite 500',
        city: 'Denver',
        state: 'CO',
        zip: '80216'
    },
    website: 'www.apex-solutions.demo',
    logoUrl: '/apex-logo.png',
    subscriptionStatus: 'active',
    isFreeAccess: true,
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
    proposalDisclaimer: 'This proposal is valid for 60 days. Pricing reflects prevailing commercial engineering rates, certified master mechanical labor, and ASME/ASHRAE code compliance. Backed by our 100% satisfaction guarantee.',
    invoiceTerms: 'NET 30. Payments received within contractual terms are eligible for preferred Master Service Agreement discounts. 1.5% monthly finance charge on aged commercial balances.',
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
        role: 'admin', // Operations Director & VP of Field Services
        status: 'active',
        phone: '(555) 789-1001',
        payRate: 145000,
        payType: 'salary',
        billableRate: 325,
        ptoAccrued: 180,
        hireDate: '2021-03-01',
        lastLoginAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
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
        role: 'employee', // Commercial Accounts & Capital Projects Director
        status: 'active',
        phone: '(555) 789-1002',
        payRate: 98000,
        payType: 'salary',
        billableRate: 250, 
        commissionRate: 0.05,
        ptoAccrued: 90,
        hireDate: '2022-01-15',
        lastLoginAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        reportsTo: 'apex-sales-manager-id',
        profilePicUrl: '/avatars/richard.jpg'
    },
    {
        id: 'apex-estimator-id',
        uid: 'apex-estimator-id',
        organizationId: 'apex-org-456',
        firstName: 'Victoria',
        lastName: 'Sterling',
        email: 'victoria@apex-solutions.demo',
        username: 'victoria_sterling',
        role: 'employee', // Senior Project Estimator & Contracts Administrator
        status: 'active',
        phone: '(555) 789-1007',
        payRate: 88000,
        payType: 'salary',
        billableRate: 220,
        ptoAccrued: 70,
        hireDate: '2022-06-01',
        lastLoginAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
        profilePicUrl: '/avatars/eleanor.jpg'
    },
    {
        id: 'apex-lead-tech-id',
        uid: 'apex-lead-tech-id',
        organizationId: 'apex-org-456',
        firstName: 'Leo',
        lastName: 'Masters',
        email: 'leo@apex-solutions.demo',
        username: 'leo_masters',
        role: 'employee', // Master Chiller & Central Utility Plant Specialist
        status: 'active',
        phone: '(555) 789-1003',
        payRate: 64,
        payType: 'hourly',
        billableRate: 225,
        ptoAccrued: 80,
        hireDate: '2021-08-01',
        lastLoginAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        digitalId: 'LM-9012',
        profilePicUrl: '/avatars/leo.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2028-01-01' },
            { name: 'Centrifugal Chiller Master Specialist (Trane / York)', expiryDate: '2027-06-01' },
            { name: 'Master Mechanical Contractor License (State of CO)', expiryDate: '2027-11-15' },
            { name: 'OSHA 30 Construction Safety', expiryDate: '2028-04-10' }
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
        role: 'employee', // Senior Industrial Refrigeration & Ammonia Tech
        status: 'active',
        phone: '(555) 789-1004',
        payRate: 56,
        payType: 'hourly',
        billableRate: 195,
        ptoAccrued: 60,
        hireDate: '2022-05-20',
        lastLoginAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        digitalId: 'FF-3456',
        profilePicUrl: '/avatars/frank.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-10-01' },
            { name: 'RETA Certified Industrial Refrigeration Operator (CIRO)', expiryDate: '2027-04-10' }
        ]
    },
    {
        id: 'apex-tech-3-id',
        uid: 'apex-tech-3-id',
        organizationId: 'apex-org-456',
        firstName: 'Marcus',
        lastName: 'Brody',
        email: 'marcus@apex-solutions.demo',
        username: 'marcus_brody',
        role: 'employee', // Senior BAS / Direct Digital Controls (DDC) Engineer
        status: 'active',
        phone: '(555) 789-1005',
        payRate: 58,
        payType: 'hourly',
        billableRate: 205,
        ptoAccrued: 55,
        hireDate: '2022-11-01',
        lastLoginAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        digitalId: 'MB-7821',
        profilePicUrl: '/avatars/marcus.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-02-15' },
            { name: 'Tridium Niagara 4 TCP Certified Engineer', expiryDate: '2027-08-20' },
            { name: 'BACnet Building Automation Integration Specialist', expiryDate: '2026-12-15' }
        ]
    },
    {
        id: 'apex-tech-4-id',
        uid: 'apex-tech-4-id',
        organizationId: 'apex-org-456',
        firstName: 'Sam',
        lastName: 'Rivera',
        email: 'sam@apex-solutions.demo',
        username: 'sam_rivera',
        role: 'employee', // Cleanroom & Medical Gas Validation Specialist
        status: 'active',
        phone: '(555) 789-1006',
        payRate: 56,
        payType: 'hourly',
        billableRate: 200,
        ptoAccrued: 62,
        hireDate: '2023-01-15',
        lastLoginAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        digitalId: 'SR-4190',
        profilePicUrl: '/avatars/sam.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-05-12' },
            { name: 'ASSE 6040 Medical Gas Maintenance Specialist', expiryDate: '2027-09-01' },
            { name: 'ISO-14644 Cleanroom Testing & Laminar Flow Certification', expiryDate: '2026-12-01' }
        ]
    },
    {
        id: 'apex-tech-5-id',
        uid: 'apex-tech-5-id',
        organizationId: 'apex-org-456',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        email: 'carlos@apex-solutions.demo',
        username: 'carlos_mendoza',
        role: 'employee', // Variable Refrigerant Flow (VRF) Lead Engineer
        status: 'active',
        phone: '(555) 789-1008',
        payRate: 54,
        payType: 'hourly',
        billableRate: 190,
        ptoAccrued: 48,
        hireDate: '2023-04-10',
        lastLoginAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
        digitalId: 'CM-6102',
        profilePicUrl: '/avatars/carlos.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-04-15' },
            { name: 'Mitsubishi Diamond Commercial VRF Service Master', expiryDate: '2027-06-30' },
            { name: 'Daikin VRV Advanced Systems Commissioning', expiryDate: '2026-10-15' }
        ]
    },
    {
        id: 'apex-tech-6-id',
        uid: 'apex-tech-6-id',
        organizationId: 'apex-org-456',
        firstName: 'Brett',
        lastName: 'Anderson',
        email: 'brett@apex-solutions.demo',
        username: 'brett_anderson',
        role: 'employee', // Central Hydronic Boilers & Steam Systems Specialist
        status: 'active',
        phone: '(555) 789-1009',
        payRate: 55,
        payType: 'hourly',
        billableRate: 195,
        ptoAccrued: 52,
        hireDate: '2023-07-01',
        lastLoginAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        digitalId: 'BA-2291',
        profilePicUrl: '/avatars/brett.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-07-20' },
            { name: 'ASME Section IV & VIII High-Pressure Boiler Inspector', expiryDate: '2027-03-10' }
        ]
    },
    {
        id: 'apex-tech-7-id',
        uid: 'apex-tech-7-id',
        organizationId: 'apex-org-456',
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@apex-solutions.demo',
        username: 'elena_rostova',
        role: 'employee', // Commissioning & TAB (Testing, Adjusting, Balancing) Engineer
        status: 'active',
        phone: '(555) 789-1010',
        payRate: 58,
        payType: 'hourly',
        billableRate: 210,
        ptoAccrued: 56,
        hireDate: '2023-09-15',
        lastLoginAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        digitalId: 'ER-5530',
        profilePicUrl: '/avatars/elena.jpg',
        certifications: [
            { name: 'Universal EPA Certification', expiryDate: '2027-09-01' },
            { name: 'NEBB Certified TAB Professional', expiryDate: '2027-05-15' },
            { name: 'ASHRAE Certified Building Commissioning Professional (BCxP)', expiryDate: '2026-11-20' }
        ]
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
        accountNumber: 'ACC-COM-1001',
        name: 'The Grand Hotel',
        firstName: 'Charles',
        lastName: 'Montgomery',
        email: 'charles@grandhotel.demo',
        phone: '(555) 300-1000',
        address: '1 Grand Plaza, Aspen, CO 81611',
        city: 'Aspen',
        state: 'CO',
        zip: '81611',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Contact for all maintenance and service requests. High-priority luxury hospitality client.',
        equipment: [
            { id: 'eq-c1-1', brand: 'Trane', model: 'Centravac Chiller-500', serial: 'SN-CH-001', type: 'Chiller', location: 'Central Utility Plant' },
            { id: 'eq-c1-2', brand: 'Trane', model: 'Voyager RTU-250', serial: 'SN-RTU-105', type: 'Rooftop Unit', location: 'North Wing Roof' },
            { id: 'eq-c1-3', brand: 'Manitowoc', model: 'Indigo NXT Ice-500', serial: 'SN-ICE-020', type: 'Ice Machine', location: 'Main Banquet Kitchen' },
            { id: 'eq-c1-4', brand: 'Liebert', model: 'Challenger 3000 CRAC', serial: 'SN-CRAC-09', type: 'Precision AC', location: 'Server Facility Room' }
        ]
    },
    {
        id: 'apex-cust-2',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-2002',
        name: 'Sterling Residences',
        firstName: 'Eleanor',
        lastName: 'Sterling',
        email: 'eleanor@sterling.demo',
        phone: '(555) 400-2000',
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        city: 'Cherry Hills Village',
        state: 'CO',
        zip: '80113',
        customerType: 'Residential',
        notes: 'High-net-worth individual. Requires discretion and premium white-glove service.',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        taxExempt: false,
        pricingRules: {
            contractedRate: 145.00,
            standardRate: 165.00,
            overtimeContractedRate: 195.00,
            emergencyContractedRate: 215.00,
            tripCharge: 65.00,
            partsMarkupPercentage: 10
        },
        hvacSystem: { brand: 'Lennox', type: 'Geothermal', installDate: '2021-09-15' },
        maintenanceAgreement: {
            id: 'maint-sterling-01',
            agreementName: 'Custom Geothermal & Indoor Air Quality Comprehensive Agreement',
            tradeType: 'HVAC & Mechanical',
            status: 'Active',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            value: 948.00,
            billingFrequency: 'Monthly',
            paymentTerms: 'net_30',
            frequency: 'Quarterly',
            partsDiscountPercentage: 15,
            partsAllowanceTotal: 250.00,
            partsAllowanceRemaining: 250.00,
            coveredItems: [
                'Spring Geothermal Ground Loop Pressure & Cooling Calibration',
                'Fall Heating Combustion & Heat Exchanger Safety Analysis',
                'Whole-Home Humidifier Water Panel Replacement & Solenoid Flush',
                'High-Efficiency Media Filter Replacements (16x25x4 MERV 11)',
                'Condensate Line Chemical Treatment & Algae Prevention'
            ],
            coveredEquipmentIds: ['eq-c2-1', 'eq-c2-2'],
            coveredUnitRules: [
                {
                    unitId: 'eq-c2-1',
                    unitName: 'Lennox GHP-100 Geothermal Heat Pump',
                    serviceFrequency: 'Semi-Annually',
                    consumables: [
                        { id: 'c-1', name: 'High-Capacity Media Filter', sizeOrPartNo: '16x25x4 MERV 11', quantity: 1, intervalMonths: 3, category: 'Filter' },
                        { id: 'c-2', name: 'Condensate Drain Pan Treatment', sizeOrPartNo: 'Algae Guard Tabs', quantity: 6, intervalMonths: 6, category: 'Chemical' }
                    ],
                    tasks: ['Loop pressure check', 'Compressor amps', 'Refrigerant superheat', 'Thermostat calibration']
                },
                {
                    unitId: 'eq-c2-2',
                    unitName: 'Aprilaire Humid-800 Whole-Home Humidifier',
                    serviceFrequency: 'Semi-Annually',
                    consumables: [
                        { id: 'c-3', name: 'Evaporator Water Panel', sizeOrPartNo: 'Model 35 Water Panel', quantity: 1, intervalMonths: 6, category: 'Filter' },
                        { id: 'c-4', name: 'Inline Water Strainer Orifice', sizeOrPartNo: 'Aprilaire #4004', quantity: 1, intervalMonths: 12, category: 'Plumbing' }
                    ],
                    tasks: ['Solenoid valve flush', 'Humidistat accuracy verification', 'Drain flow test']
                }
            ],
            visits: [
                {
                    id: 'v-1',
                    targetMonth: '2026-01',
                    targetDate: '2026-01-15',
                    title: 'Winter Comprehensive Geothermal Heating & Humidifier Tune-Up',
                    status: 'Completed',
                    jobId: 'apex-job-1',
                    assignedTechId: 'apex-lead-tech-id',
                    assignedTechName: 'Leo Masters',
                    notes: 'Loop pressure verified at 42 PSI. 16x25x4 filter & humidifier water panel replaced.',
                    completedAt: '2026-01-15T14:30:00Z'
                },
                {
                    id: 'v-2',
                    targetMonth: '2026-05',
                    targetDate: '2026-05-15',
                    title: 'Spring Geothermal Cooling Startup & Filter Swap',
                    status: 'Scheduled',
                    assignedTechId: 'apex-lead-tech-id',
                    assignedTechName: 'Leo Masters',
                    notes: 'Pre-season cooling calibration, condensate drain flush, and 16x25x4 filter swap.'
                },
                {
                    id: 'v-3',
                    targetMonth: '2026-08',
                    targetDate: '2026-08-15',
                    title: 'Mid-Summer High-Capacity Filter & Airflow Check',
                    status: 'Pending',
                    notes: 'Media filter swap and indoor air quality check.'
                },
                {
                    id: 'v-4',
                    targetMonth: '2026-10',
                    targetDate: '2026-10-15',
                    title: 'Fall Heating Preparation & Humidifier Startup',
                    status: 'Pending',
                    notes: 'Humidifier Model 35 water panel replacement, heating safety check.'
                }
            ]
        },
        equipment: [
            { id: 'eq-c2-1', brand: 'Lennox', model: 'GHP-100', serial: 'SN-GEO-001', type: 'Geothermal Heat Pump', location: 'Mechanical Room' },
            { id: 'eq-c2-2', brand: 'Aprilaire', model: 'Humid-800', serial: 'SN-HUM-005', type: 'Whole-Home Humidifier', location: 'Mechanical Room' }
        ]
    },
    {
        id: 'apex-cust-3',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-3003',
        name: 'Mile High Distribution Center',
        firstName: 'Mike',
        lastName: 'Kowalski',
        email: 'mike@milehighdist.demo',
        phone: '(555) 500-3000',
        address: '500 Industrial Rd, Denver, CO 80216',
        city: 'Denver',
        state: 'CO',
        zip: '80216',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Cold-chain logistics facility. 24/7 uptime required for perishable cargo.',
        equipment: [
            { id: 'eq-c3-1', brand: 'Carrier', model: 'REF-1000 Commercial Evaporator', serial: 'SN-REF-801', type: 'Walk-in Cooler', location: 'Cold Bay A' },
            { id: 'eq-c3-2', brand: 'Carrier', model: 'REF-1000 Deep Freeze Coil', serial: 'SN-REF-802', type: 'Walk-in Freezer', location: 'Cold Bay B' },
            { id: 'eq-c3-3', brand: 'Hoshizaki', model: 'IM-200 Commercial Cube', serial: 'SN-IM-301', type: 'Ice Machine', location: 'Logistics Breakroom' }
        ]
    },
    {
        id: 'demo-cust-2',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-4004',
        name: 'Tractor Supply - Converse, TX',
        firstName: 'Gary',
        lastName: 'Vance',
        email: 'converse@tractorsupply.demo',
        phone: '(210) 318-4197',
        address: '8318 FM 78, Converse, TX 78109',
        city: 'Converse',
        state: 'TX',
        zip: '78109',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'both',
        notes: 'Commercial Tractor Supply retail branch. Multi-zone rooftop unit management.',
        equipment: [
            { id: 'eq-tsc-1', brand: 'Carrier', model: 'WeatherExpert 15-Ton RTU', serial: 'SN-TSC-001', type: 'Rooftop Unit', location: 'Retail Floor Roof' },
            { id: 'eq-tsc-2', brand: 'Lennox', model: 'Energence 10-Ton RTU', serial: 'SN-TSC-002', type: 'Rooftop Unit', location: 'Warehouse Backstage' }
        ]
    },
    {
        id: 'apex-cust-4',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-5005',
        name: 'Rocky Mountain Brewery',
        firstName: 'Liam',
        lastName: 'O\'Connor',
        email: 'liam@rockymtnbrewery.demo',
        phone: '(555) 620-4400',
        address: '1420 Brewery Lane, Golden, CO 80401',
        city: 'Golden',
        state: 'CO',
        zip: '80401',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Production brewery with glycol chiller loops and fermenter jacket monitoring.',
        equipment: [
            { id: 'eq-c4-1', brand: 'Pro Refrigeration', model: 'ProChiller 25-Ton Glycol', serial: 'SN-GLY-992', type: 'Glycol Chiller', location: 'Brewhouse Pad' },
            { id: 'eq-c4-2', brand: 'Bohn', model: 'Low-Temp Keg Evaporator', serial: 'SN-BOHN-331', type: 'Cold Storage Room', location: 'Distribution Keg Vault' },
            { id: 'eq-c4-3', brand: 'Honeywell', model: 'BACnet CO2/O2 Sensor Array', serial: 'SN-GAS-410', type: 'Air Quality Safety', location: 'Fermentation Hall' }
        ]
    },
    {
        id: 'apex-cust-5',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-6006',
        name: 'Front Range Surgery Center',
        firstName: 'Dr. Rebecca',
        lastName: 'Alvarez',
        email: 'ralvarez@frontrangesurgery.demo',
        phone: '(555) 710-8800',
        address: '9200 Health Park Blvd, Suite 300, Lone Tree, CO 80124',
        city: 'Lone Tree',
        state: 'CO',
        zip: '80124',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Ambulatory outpatient surgical suites. Strict HEPA laminar flow and positive air pressure requirements.',
        equipment: [
            { id: 'eq-c5-1', brand: 'Engineered Air', model: 'Cleanroom AHU-1200 HEPA', serial: 'SN-SURG-101', type: 'Air Handling Unit', location: 'Operating Suite Penthouse' },
            { id: 'eq-c5-2', brand: 'Liebert', model: 'Mini-Mate2 Precision DX', serial: 'SN-MM-442', type: 'Precision AC', location: 'Medical Imaging Core' },
            { id: 'eq-c5-3', brand: 'Trane', model: 'Precedent 20-Ton Backup DX', serial: 'SN-PRE-551', type: 'Rooftop Unit', location: 'Surgical Annex Roof' }
        ]
    },
    {
        id: 'apex-cust-6',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-7007',
        name: 'Denver Tech Logistics Hub',
        firstName: 'Derek',
        lastName: 'Stone',
        email: 'derek@dentechlogistics.demo',
        phone: '(555) 884-2100',
        address: '18400 E 40th Ave, Aurora, CO 80011',
        city: 'Aurora',
        state: 'CO',
        zip: '80011',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'High-speed automated logistics hub. 4 dedicated packaged rooftop units with smart economizers.',
        equipment: [
            { id: 'eq-c6-1', brand: 'Daikin', model: 'VRV IV Heat Recovery System', serial: 'SN-VRV-901', type: 'VRF Heat Recovery', location: 'Office Mezzanine' },
            { id: 'eq-c6-2', brand: 'Lennox', model: 'Energence 20-Ton Gas/Electric RTU', serial: 'SN-LEN-881', type: 'Rooftop Unit', location: 'Sorting Bay Roof' }
        ]
    },
    {
        id: 'apex-cust-7',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-8008',
        name: 'Highlands Luxury Lofts HOA',
        firstName: 'Julian',
        lastName: 'Mercer',
        email: 'jmercer@highlandslofts.demo',
        phone: '(555) 433-9191',
        address: '3200 Tejon St, Denver, CO 80211',
        city: 'Denver',
        state: 'CO',
        zip: '80211',
        customerType: 'Property Management',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Premier 48-unit luxury loft building. Central hydronic heating and multi-zone VRF cooling.',
        equipment: [
            { id: 'eq-c7-1', brand: 'Mitsubishi', model: 'City Multi VRF Modular Condenser', serial: 'SN-MITS-601', type: 'Multi-Zone VRF', location: 'Residential Roof' },
            { id: 'eq-c7-2', brand: 'Lochinvar', model: 'Crest Condensing Hydronic Boiler', serial: 'SN-LOCH-202', type: 'Commercial Boiler', location: 'Basement Mechanical' }
        ]
    },
    {
        id: 'apex-cust-8',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-9009',
        name: 'Alpine Peak Data Facility',
        firstName: 'Nate',
        lastName: 'Carlson',
        email: 'ncarlson@alpinepeakdata.demo',
        phone: '(555) 919-7300',
        address: '6800 S Tucson Way, Centennial, CO 80112',
        city: 'Centennial',
        state: 'CO',
        zip: '80112',
        customerType: 'Commercial',
        paymentTerms: 'net_15',
        invoiceDelivery: 'email',
        notes: 'Tier III Co-location Data Center. N+1 redundant chilled water CRAC cooling loops.',
        equipment: [
            { id: 'eq-c8-1', brand: 'Schneider Electric', model: 'Uniflair InRow Chilled Water 50kW', serial: 'SN-SCH-112', type: 'InRow Cooling', location: 'Data Suite Alpha' },
            { id: 'eq-c8-2', brand: 'Liebert', model: 'CRV High-Efficiency Precision Cooling', serial: 'SN-CRV-883', type: 'Precision AC', location: 'Data Suite Bravo' }
        ]
    },
    {
        id: 'apex-cust-9',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-9010',
        name: 'Red Rocks Health & Wellness',
        firstName: 'Cassandra',
        lastName: 'Holt',
        email: 'cholt@redrockswellness.demo',
        phone: '(555) 697-3200',
        address: '16100 Morrison Rd, Morrison, CO 80465',
        city: 'Morrison',
        state: 'CO',
        zip: '80465',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Sports fitness clinic, sauna and aquatic center. Special dehumidification and air quality requirements.',
        equipment: [
            { id: 'eq-c9-1', brand: 'Desert Aire', model: 'SelectAire Commercial Dehumidifier', serial: 'SN-DA-501', type: 'Pool Dehumidifier', location: 'Aquatic Center Core' },
            { id: 'eq-c9-2', brand: 'Carrier', model: 'WeatherMaker 12.5-Ton Heat Pump', serial: 'SN-WM-702', type: 'Rooftop Unit', location: 'Main Gym Roof' }
        ]
    },
    {
        id: 'apex-cust-10',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-COM-9011',
        name: 'Cherry Creek Financial Tower',
        firstName: 'David',
        lastName: 'Sterling',
        email: 'dsterling@cherrycreektower.demo',
        phone: '(555) 321-8000',
        address: '100 Fillmore St, Denver, CO 80206',
        city: 'Denver',
        state: 'CO',
        zip: '80206',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: '12-story high-rise Class A office tower. Central cooling tower and automated BMS integration.',
        equipment: [
            { id: 'eq-c10-1', brand: 'York', model: 'YMC2 Magnetic Centrifugal Chiller 400-Ton', serial: 'SN-YORK-400', type: 'Chiller', location: 'Sub-Basement CUP' },
            { id: 'eq-c10-2', brand: 'Bell & Gossett', model: 'Series e-1510 Base Mounted Pumps', serial: 'SN-BG-201', type: 'Hydronic Pumps', location: 'Sub-Basement CUP' }
        ]
    },
    {
        id: 'apex-cust-11',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-3001',
        name: 'Marcus & Chloe Montgomery',
        firstName: 'Marcus',
        lastName: 'Montgomery',
        email: 'marcus.m@skylinehomes.demo',
        phone: '(555) 449-1122',
        address: '740 Flagstaff Rd, Boulder, CO 80302',
        city: 'Boulder',
        state: 'CO',
        zip: '80302',
        customerType: 'Residential',
        paymentTerms: 'due_on_receipt',
        invoiceDelivery: 'email',
        notes: 'Net-zero custom modern home. Variable-speed heat pump with HEPA filtration.',
        equipment: [
            { id: 'eq-c11-1', brand: 'Carrier', model: 'Infinity 24 Greenspeed Heat Pump 25VNA4', serial: 'SN-CAR-908', type: 'Heat Pump', location: 'Exterior East Courtyard' },
            { id: 'eq-c11-2', brand: 'Carrier', model: 'Infinity Air Purifier DGAPA', serial: 'SN-AIR-334', type: 'Air Filtration', location: 'Attic Air Handler' }
        ]
    },
    {
        id: 'apex-cust-12',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-3002',
        name: 'Dr. Arthur & Helen Vance',
        firstName: 'Arthur',
        lastName: 'Vance',
        email: 'avance@denverhealthnet.demo',
        phone: '(555) 773-4500',
        address: '44 Crestmoor Dr, Cherry Hills Village, CO 80113',
        city: 'Cherry Hills Village',
        state: 'CO',
        zip: '80113',
        customerType: 'Residential',
        paymentTerms: 'due_on_receipt',
        invoiceDelivery: 'email',
        notes: 'VIP Residential client. Prefers weekend service appointments with text dispatch notifications.',
        equipment: [
            { id: 'eq-c12-1', brand: 'Trane', model: 'XV20i TruComfort Variable Speed 5-Ton', serial: 'SN-TRN-771', type: 'Air Conditioner', location: 'South Lawn Mechanical' },
            { id: 'eq-c12-2', brand: 'Trane', model: 'CleanEffects Whole House Air Filtration', serial: 'SN-CE-109', type: 'Air Filtration', location: 'Basement Furnace Rm' }
        ]
    },
    {
        id: 'apex-cust-13',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-3003',
        name: 'Jonathan & Claire Dupont',
        firstName: 'Jonathan',
        lastName: 'Dupont',
        email: 'jdupont@dupontinvest.demo',
        phone: '(555) 832-6100',
        address: '5800 S University Blvd, Greenwood Village, CO 80121',
        city: 'Greenwood Village',
        state: 'CO',
        zip: '80121',
        customerType: 'Residential',
        paymentTerms: 'due_on_receipt',
        invoiceDelivery: 'email',
        notes: 'Two-story custom estate. Dual system with zoning dampers.',
        equipment: [
            { id: 'eq-c13-1', brand: 'Lennox', model: 'SL280V Variable-Speed Gas Furnace', serial: 'SN-LEN-441', type: 'Furnace', location: 'Lower Level Utility' },
            { id: 'eq-c13-2', brand: 'Lennox', model: 'XC21 High Efficiency Air Conditioner', serial: 'SN-LEN-442', type: 'Air Conditioner', location: 'Back Patio' }
        ]
    },
    {
        id: 'apex-cust-14',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-3004',
        name: 'Evelyn Thorne',
        firstName: 'Evelyn',
        lastName: 'Thorne',
        email: 'ethorne@mountainarch.demo',
        phone: '(555) 668-9022',
        address: '1240 Castle Point Dr, Castle Rock, CO 80108',
        city: 'Castle Rock',
        state: 'CO',
        zip: '80108',
        customerType: 'Residential',
        paymentTerms: 'due_on_receipt',
        invoiceDelivery: 'email',
        notes: 'Architectural mountain home with zoned ducted inverter heat pump.',
        equipment: [
            { id: 'eq-c14-1', brand: 'Bosch', model: 'IDS 2.0 Inverter Ducted Packaged Heat Pump', serial: 'SN-BOSCH-89', type: 'Heat Pump', location: 'East Grade Level' },
            { id: 'eq-c14-2', brand: 'RGF', model: 'REME HALO Whole Home In-Duct Purifier', serial: 'SN-REME-910', type: 'Air Purifier', location: 'Ductwork Plenum' }
        ]
    },
    {
        id: 'apex-cust-15',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-RES-3005',
        name: 'Harrison & Beatrice Wells',
        firstName: 'Harrison',
        lastName: 'Wells',
        email: 'hwells@wellscapital.demo',
        phone: '(555) 902-3344',
        address: '884 Country Club Pkwy, Castle Pines, CO 80108',
        city: 'Castle Pines',
        state: 'CO',
        zip: '80108',
        customerType: 'Residential',
        paymentTerms: 'due_on_receipt',
        invoiceDelivery: 'email',
        notes: 'Country club estate with high-efficiency variable-speed split system.',
        equipment: [
            { id: 'eq-c15-1', brand: 'Bryant', model: 'Evolution Extreme 26 Variable-Speed AC', serial: 'SN-BRY-772', type: 'Air Conditioner', location: 'Side Yard' },
            { id: 'eq-c15-2', brand: 'Bryant', model: 'Evolution Perfect Air Purifier', serial: 'SN-BRY-883', type: 'Air Filtration', location: 'Basement Furnace Rm' }
        ]
    },
    {
        id: 'apex-cust-16',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-ENT-4001',
        name: 'Denver International Airport - Concourse CUP',
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'marcus.vance@flydenver.demo',
        phone: '(303) 342-2000',
        address: '8500 Peña Blvd, Concourse B Central Utility Plant, Denver, CO 80249',
        city: 'Denver',
        state: 'CO',
        zip: '80249',
        customerType: 'Commercial',
        paymentTerms: 'net_60',
        invoiceDelivery: 'email',
        notes: 'Mission-critical municipal aviation account. Mandatory Badging & Security clearance required. 24/7 central plant monitoring.',
        pricingRules: {
            contractedRate: 225.00,
            standardRate: 245.00,
            overtimeContractedRate: 310.00,
            emergencyContractedRate: 365.00,
            tripCharge: 0.00,
            partsMarkupPercentage: 12
        },
        equipment: [
            { id: 'eq-c16-1', brand: 'York', model: 'YK Centrifugal Liquid Chiller 1200-Ton', serial: 'SN-YK-1200B', type: 'Chiller', location: 'Concourse B Utility Plant Sub-level 1' },
            { id: 'eq-c16-2', brand: 'Marley', model: 'NC Class Induced Draft Crossflow Cooling Tower 2400-GPM', serial: 'SN-MAR-2400', type: 'Cooling Tower', location: 'Roof Plant Level 4' },
            { id: 'eq-c16-3', brand: 'Bell & Gossett', model: 'Series e-1510 End Suction Pumps (Lead/Lag Skid)', serial: 'SN-BG-1510-1', type: 'Pump Skid', location: 'CUP Hydronic Room' },
            { id: 'eq-c16-4', brand: 'Automated Logic', model: 'WebCTRL BACnet IP Central DDC Automation Gateway', serial: 'SN-ALC-WC01', type: 'BMS Controls', location: 'Central Plant Operations Center' }
        ]
    },
    {
        id: 'apex-cust-17',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-ENT-4002',
        name: 'CU Anschutz Medical Research Campus',
        firstName: 'Dr. Sarah',
        lastName: 'Lin',
        email: 'sarah.lin@cuanschutz.demo',
        phone: '(303) 724-5000',
        address: '13001 E 17th Pl, Biosafety Research Tower 2, Aurora, CO 80045',
        city: 'Aurora',
        state: 'CO',
        zip: '80045',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'BSL-3 biocontainment and cleanroom vivarium. Strict adherence to ASHRAE 170 and CDC biosafety differential pressure protocols.',
        pricingRules: {
            contractedRate: 215.00,
            standardRate: 235.00,
            overtimeContractedRate: 295.00,
            emergencyContractedRate: 350.00,
            tripCharge: 0.00,
            partsMarkupPercentage: 10
        },
        equipment: [
            { id: 'eq-c17-1', brand: 'Haakon', model: 'Custom Cleanroom Air Handling Unit 40,000 CFM', serial: 'SN-HKN-40K', type: 'Air Handling Unit', location: 'Penthouse Mechanical Room B' },
            { id: 'eq-c17-2', brand: 'Camfil', model: 'Megalam Terminal HEPA Filtration Bank ISO Class 5', serial: 'SN-CAM-HEPA-01', type: 'Air Filtration', location: 'Surgical Suites 3 & 4' },
            { id: 'eq-c17-3', brand: 'Phoenix Controls', model: 'Precision Venturi High-Speed Room Pressure Air Valves', serial: 'SN-PHX-VAV-88', type: 'Airflow Control', location: 'Vivarium Exhaust Shaft' },
            { id: 'eq-c17-4', brand: 'Johnson Controls', model: 'Metasys NAE55 Network Automation Supervisory Engine', serial: 'SN-JCI-NAE55', type: 'BMS Controls', location: 'Facility Control Core' }
        ]
    },
    {
        id: 'apex-cust-18',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-ENT-4003',
        name: 'Lockheed Martin Space Systems - Cleanroom Alpha',
        firstName: 'James',
        lastName: 'Sterling',
        email: 'james.sterling@lmco-space.demo',
        phone: '(303) 977-3000',
        address: '12257 S Wadsworth Blvd, High-Bay Building 100, Littleton, CO 80125',
        city: 'Littleton',
        state: 'CO',
        zip: '80125',
        customerType: 'Commercial',
        paymentTerms: 'net_60',
        invoiceDelivery: 'email',
        notes: 'Aerospace satellite assembly cleanroom. Requires ITAR compliance verification and continuous relative humidity control within +/- 1.5%.',
        pricingRules: {
            contractedRate: 230.00,
            standardRate: 250.00,
            overtimeContractedRate: 320.00,
            emergencyContractedRate: 375.00,
            tripCharge: 0.00,
            partsMarkupPercentage: 12
        },
        equipment: [
            { id: 'eq-c18-1', brand: 'Munters', model: 'DryCool Desiccant Ultra-Low Humidity Air Dehumidifier', serial: 'SN-MNT-DC12', type: 'Dehumidification', location: 'Satellite Integration Bay' },
            { id: 'eq-c18-2', brand: 'Trane', model: 'CenTraVac EarthWise Low-Pressure Chiller 600-Ton', serial: 'SN-TRN-CTV600', type: 'Chiller', location: 'Central Mechanical Wing' },
            { id: 'eq-c18-3', brand: 'Cleanpak', model: 'Laminar Flow Ceiling Grid Fan-Filter Units (FFU)', serial: 'SN-CPK-FFU99', type: 'Cleanroom Filtration', location: 'Assembly Bay Alpha' }
        ]
    },
    {
        id: 'apex-cust-19',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-ENT-4004',
        name: 'CoreSite DNV2 Enterprise Data Center',
        firstName: 'David K.',
        lastName: 'Ramirez',
        email: 'david.ramirez@coresite.demo',
        phone: '(303) 405-1000',
        address: '910 15th St, Mission Critical Level 3, Denver, CO 80202',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Tier III enterprise colocation data center. 100% uptime SLA requirement. Redundant N+1 dual power feeds and thermal containment.',
        pricingRules: {
            contractedRate: 210.00,
            standardRate: 230.00,
            overtimeContractedRate: 290.00,
            emergencyContractedRate: 345.00,
            tripCharge: 0.00,
            partsMarkupPercentage: 10
        },
        equipment: [
            { id: 'eq-c19-1', brand: 'Schneider Electric', model: 'Uniflair InRow Chilled Water Precision Coolers (x4)', serial: 'SN-UNF-01-04', type: 'Precision Cooling', location: 'High-Density Server Pod B' },
            { id: 'eq-c19-2', brand: 'Stulz', model: 'CyberAir Precision Perimeter CRAH Units with EC Fans', serial: 'SN-STZ-CRAH-01', type: 'CRAH Unit', location: 'Perimeter Wall Raised Floor' },
            { id: 'eq-c19-3', brand: 'Vertiv Liebert', model: 'DSE Pumped Refrigerant Economizer Thermal Management', serial: 'SN-VERT-DSE', type: 'Economizer', location: 'Mezzanine Plant' }
        ]
    },
    {
        id: 'apex-cust-20',
        organizationId: 'apex-org-456',
        accountNumber: 'ACC-ENT-4005',
        name: 'The Broadmoor Resort & International Center',
        firstName: 'Robert',
        lastName: 'Pemberton',
        email: 'robert.p@broadmoor.demo',
        phone: '(719) 577-5775',
        address: '1 Lake Ave, Central Engineering Complex, Colorado Springs, CO 80906',
        city: 'Colorado Springs',
        state: 'CO',
        zip: '80906',
        customerType: 'Commercial',
        paymentTerms: 'net_30',
        invoiceDelivery: 'email',
        notes: 'Historic 5-star resort campus. Comprehensive high-pressure steam boiler plant, golf clubhouse chillers, and event arena mechanical systems.',
        pricingRules: {
            contractedRate: 195.00,
            standardRate: 215.00,
            overtimeContractedRate: 275.00,
            emergencyContractedRate: 325.00,
            tripCharge: 0.00,
            partsMarkupPercentage: 10
        },
        equipment: [
            { id: 'eq-c20-1', brand: 'Cleaver-Brooks', model: 'Prometha 400-HP High-Pressure Steam Boiler (Dual-Fuel)', serial: 'SN-CB-400-01', type: 'Steam Boiler', location: 'Central Boiler Plant' },
            { id: 'eq-c20-2', brand: 'Daikin Applied', model: 'Pathfinder Air-Cooled Screw Chiller with VFD 350-Ton', serial: 'SN-DAIK-350', type: 'Chiller', location: 'Convention Center Roof' },
            { id: 'eq-c20-3', brand: 'Evapco', model: 'AT Closed-Circuit Industrial Cooling Tower', serial: 'SN-EVAP-CC02', type: 'Cooling Tower', location: 'Golf Club House Mechanical' }
        ]
    }
];

export const APEX_MOCK_JOBS: Job[] = [
    {
        id: 'apex-job-1',
        organizationId: 'apex-org-456',
        customerName: 'The Grand Hotel',
        customerId: 'apex-cust-1',
        customerEmail: 'charles@grandhotel.demo',
        customerPhone: '(555) 300-1000',
        address: '1 Grand Plaza, Aspen, CO 81611',
        tasks: ['Quarterly Centravac Chiller Maintenance', 'High-Efficiency Media Filter Replacement'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Check in with facilities engineering director Charles Montgomery. Service elevator access on loading dock.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-id'],
        jobEvents: [{ type: 'scheduled', timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' }],
        invoice: {
            id: 'INV-2001',
            items: [
                { id: 'item-c1-1', description: 'Comprehensive Chiller Preventive Maintenance Visit (Covered under Annual Agreement)', quantity: 1, unitPrice: 0, total: 0, type: 'Fee', taxable: false }
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
        customerEmail: 'eleanor@sterling.demo',
        customerPhone: '(555) 400-2000',
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        tasks: ['Geothermal System Fault', 'Emergency Inverter Diagnostic'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
        specialInstructions: 'High-priority VIP client. Call ahead 15 minutes prior to arrival. Security gate code #5567.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        jobEvents: [{ type: 'dispatched', timestamp: new Date().toISOString(), user: 'Valerie Vance' }],
        invoice: {
            id: 'INV-2002',
            items: [
                { id: 'item-c2-1', description: 'Emergency Diagnostic Fee - Geothermal Loop', quantity: 1, unitPrice: 350, total: 350, type: 'Fee', taxable: true }
            ],
            subtotal: 350,
            taxRate: 0.0825,
            taxAmount: 28.88,
            totalAmount: 378.88,
            amount: 378.88,
            status: 'Unpaid',
            workmanshipWarrantyMonths: 12,
            partsWarrantyMonths: 12,
            warrantyDisclaimerAgreed: false
        },
        files: [
            {
                id: 'file-waiver-1',
                fileName: 'Pre-Service_Equipment_Access_Waiver.html',
                fileType: 'text/html',
                fileSize: 1024,
                uploadedAt: new Date().toISOString(),
                dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(`
                    <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                        <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Pre-Service Equipment Access Waiver</h3>
                        <p>I authorize certified field technicians from <strong>TekTrakker Services</strong> to inspect and perform emergency diagnostic testing on the geothermal mechanical system.</p>
                        <p><strong>Terms:</strong> Standard manufacturer parts warranty applies upon project authorization. Workmanship is guaranteed for 12 months.</p>
                    </div>
                `))),
                metadata: {
                    isActionRequired: true,
                    status: 'Pending Signature',
                    label: 'Service Waiver'
                }
            }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-3',
        organizationId: 'apex-org-456',
        customerName: 'Mile High Distribution Center',
        customerId: 'apex-cust-3',
        customerEmail: 'mike@milehighdist.demo',
        customerPhone: '(555) 500-3000',
        address: '500 Industrial Rd, Denver, CO 80216',
        tasks: ['Walk-In Deep Freeze Evaporator Coil Replacement', 'System Vacuum & Refrigerant Recharge'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-id'],
        specialInstructions: 'Cold Bay B. High-voltage lock-out tag-out protocols required.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }],
        invoice: {
            id: 'INV-2003',
            items: [
                { id: 'item-3-1', description: 'Carrier Commercial Evaporator Coil Assembly OEM', quantity: 1, unitPrice: 8900, total: 8900, type: 'Part', taxable: true },
                { id: 'item-3-2', description: 'R-404A Low-Temp Refrigerant (45 lbs @ $60/lb)', quantity: 45, unitPrice: 60, total: 2700, type: 'Part', taxable: true },
                { id: 'item-3-3', description: 'Master Refrigeration Certified Labor (16 hrs)', quantity: 16, unitPrice: 195, total: 3120, type: 'Labor', taxable: false },
                { id: 'item-3-4', description: 'EPA Refrigerant Recovery & Environmental Disposal', quantity: 1, unitPrice: 130, total: 130, type: 'Fee', taxable: false }
            ],
            subtotal: 14850,
            taxRate: 0.0825,
            taxAmount: 957.00,
            totalAmount: 15807.00,
            amount: 15807.00,
            amountPaid: 15807.00,
            status: 'Paid',
            paidDate: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-4',
        organizationId: 'apex-org-456',
        customerName: 'Front Range Surgery Center',
        customerId: 'apex-cust-5',
        customerEmail: 'ralvarez@frontrangesurgery.demo',
        customerPhone: '(555) 710-8800',
        address: '9200 Health Park Blvd, Suite 300, Lone Tree, CO 80124',
        tasks: ['Annual Cleanroom AHU HEPA Validation & Airflow Balance', 'Differential Pressure Gauge Calibration'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        specialInstructions: 'Sterile surgical zone. Shoe covers, hairnets, and scrub attire required before entering penthouse.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(), user: 'Sam Rivera' }],
        invoice: {
            id: 'INV-2004',
            items: [
                { id: 'item-4-1', description: 'Cleanroom Medical Grade HEPA Filters 24x24x12 99.99%', quantity: 6, unitPrice: 420, total: 2520, type: 'Part', taxable: true },
                { id: 'item-4-2', description: 'Precision Airflow & Room Pressurization Certification', quantity: 1, unitPrice: 1680, total: 1680, type: 'Service', taxable: false },
                { id: 'item-4-3', description: 'Dwyer Magnehelic Differential Pressure Calibration', quantity: 2, unitPrice: 500, total: 1000, type: 'Service', taxable: false }
            ],
            subtotal: 5200,
            taxRate: 0.0825,
            taxAmount: 207.90,
            totalAmount: 5407.90,
            amount: 5407.90,
            amountPaid: 5407.90,
            status: 'Paid',
            paidDate: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-5',
        organizationId: 'apex-org-456',
        customerName: 'Rocky Mountain Brewery',
        customerId: 'apex-cust-4',
        customerEmail: 'liam@rockymtnbrewery.demo',
        customerPhone: '(555) 620-4400',
        address: '1420 Brewery Lane, Golden, CO 80401',
        tasks: ['Emergency Glycol Chiller Compressor Motor Replacement', 'Oil Acid Test & Filter Drier Core Change'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-3-id'],
        specialInstructions: 'Critical brew cycle running in fermenter tanks 3 and 4. Minimizing chiller downtime is paramount.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }],
        invoice: {
            id: 'INV-2005',
            items: [
                { id: 'item-5-1', description: 'Copeland Discus 15-HP Semi-Hermetic Compressor', quantity: 1, unitPrice: 5400, total: 5400, type: 'Part', taxable: true },
                { id: 'item-5-2', description: 'Sporlan Catch-All High-Capacity Suction Filter Core', quantity: 2, unitPrice: 175, total: 350, type: 'Part', taxable: true },
                { id: 'item-5-3', description: 'Emergency Mobilization & Rapid Mechanical Overhaul', quantity: 16, unitPrice: 195, total: 3120, type: 'Labor', taxable: false },
                { id: 'item-5-4', description: 'Propylene Glycol Food-Grade Top-Off (10 Gallons)', quantity: 1, unitPrice: 80, total: 80, type: 'Part', taxable: true }
            ],
            subtotal: 8950,
            taxRate: 0.0825,
            taxAmount: 480.98,
            totalAmount: 9430.98,
            amount: 9430.98,
            amountPaid: 9430.98,
            status: 'Paid',
            paidDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-6',
        organizationId: 'apex-org-456',
        customerName: 'Denver Tech Logistics Hub',
        customerId: 'apex-cust-6',
        customerEmail: 'derek@dentechlogistics.demo',
        customerPhone: '(555) 884-2100',
        address: '18400 E 40th Ave, Aurora, CO 80011',
        tasks: ['4-Unit Packaged Gas/Electric RTU Spring Commissioning', 'Belts, Bearings & Burner Safety Audit'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        specialInstructions: 'Check in at shipping guard gate. Roof ladder key available in security office.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }],
        invoice: {
            id: 'INV-2006',
            items: [
                { id: 'item-6-1', description: 'Commercial RTU Spring Comprehensive Inspection (4 Units)', quantity: 4, unitPrice: 450, total: 1800, type: 'Service', taxable: false },
                { id: 'item-6-2', description: 'High-Tensile GripNotch V-Belts Replacement (8 Belts)', quantity: 8, unitPrice: 65, total: 520, type: 'Part', taxable: true },
                { id: 'item-6-3', description: 'Pleated MERV 11 Commercial Filter Sets (4 Sets)', quantity: 4, unitPrice: 195, total: 780, type: 'Part', taxable: true },
                { id: 'item-6-4', description: 'Bearing Greasing & Shaft Alignment Service', quantity: 1, unitPrice: 500, total: 500, type: 'Labor', taxable: false }
            ],
            subtotal: 3600,
            taxRate: 0.0825,
            taxAmount: 107.25,
            totalAmount: 3707.25,
            amount: 3707.25,
            amountPaid: 3707.25,
            status: 'Paid',
            paidDate: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-7',
        organizationId: 'apex-org-456',
        customerName: 'Alpine Peak Data Facility',
        customerId: 'apex-cust-8',
        customerEmail: 'ncarlson@alpinepeakdata.demo',
        customerPhone: '(555) 919-7300',
        address: '6800 S Tucson Way, Centennial, CO 80112',
        tasks: ['Liebert CRAC Precision Condenser Fan Assembly Overhaul', 'Variable Frequency Inverter Programming'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        specialInstructions: 'Strict biometric sign-in at front lobby. Static discharge straps must be worn inside cold aisles.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(), user: 'Sam Rivera' }],
        invoice: {
            id: 'INV-2007',
            items: [
                { id: 'item-7-1', description: 'EBM-Papst EC Condenser Fan Motor Assemblies', quantity: 2, unitPrice: 1950, total: 3900, type: 'Part', taxable: true },
                { id: 'item-7-2', description: 'Precision CRAC Controls Diagnostic & Modbus Parameter Setup', quantity: 1, unitPrice: 1250, total: 1250, type: 'Labor', taxable: false },
                { id: 'item-7-3', description: 'Thermal Imaging Infrared Hotspot Scan & Report', quantity: 1, unitPrice: 1250, total: 1250, type: 'Service', taxable: false }
            ],
            subtotal: 6400,
            taxRate: 0.0825,
            taxAmount: 321.75,
            totalAmount: 6721.75,
            amount: 6721.75,
            amountPaid: 6721.75,
            status: 'Paid',
            paidDate: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-8',
        organizationId: 'apex-org-456',
        customerName: 'Highlands Luxury Lofts HOA',
        customerId: 'apex-cust-7',
        customerEmail: 'jmercer@highlandslofts.demo',
        customerPhone: '(555) 433-9191',
        address: '3200 Tejon St, Denver, CO 80211',
        tasks: ['Hydronic Heating Boiler Combustion Overhaul & Decalcification', 'Backflow Preventer Testing'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        specialInstructions: 'Key fob provided by property manager Julian Mercer in lockbox code 8821.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), user: 'Marcus Brody' }],
        invoice: {
            id: 'INV-2008',
            items: [
                { id: 'item-8-1', description: 'Lochinvar Crest Boiler Full Heat Exchanger Acid Decalcification', quantity: 1, unitPrice: 1850, total: 1850, type: 'Service', taxable: false },
                { id: 'item-8-2', description: 'OEM Spark Igniter, Flame Sensor & Gasket Kit', quantity: 1, unitPrice: 650, total: 650, type: 'Part', taxable: true },
                { id: 'item-8-3', description: 'Digital Flue Gas Combustion Analysis & Efficiency Calibration', quantity: 1, unitPrice: 850, total: 850, type: 'Labor', taxable: false },
                { id: 'item-8-4', description: 'Hydronic Expansion Tank Pressure Recharge', quantity: 1, unitPrice: 750, total: 750, type: 'Service', taxable: false }
            ],
            subtotal: 4100,
            taxRate: 0.0825,
            taxAmount: 53.63,
            totalAmount: 4153.63,
            amount: 4153.63,
            amountPaid: 4153.63,
            status: 'Paid',
            paidDate: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 32 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-9',
        organizationId: 'apex-org-456',
        customerName: 'Red Rocks Health & Wellness',
        customerId: 'apex-cust-9',
        customerEmail: 'cholt@redrockswellness.demo',
        customerPhone: '(555) 697-3200',
        address: '16100 Morrison Rd, Morrison, CO 80465',
        tasks: ['Dehumidifier Compressor & Heat Exchanger Service', 'Blower Bearing Re-alignment'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 17 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 17 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        specialInstructions: 'Coordinate with Cassandra Holt. Work in mechanical room adjacent to indoor pool.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 17 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }],
        invoice: {
            id: 'INV-2009',
            items: [
                { id: 'item-9-1', description: 'Desert Aire Coated Dehumidifier Coil Deep Chemical Wash', quantity: 1, unitPrice: 1400, total: 1400, type: 'Service', taxable: false },
                { id: 'item-9-2', description: 'Heavy-Duty Pillow Block Blower Bearings (Pair)', quantity: 2, unitPrice: 225, total: 450, type: 'Part', taxable: true },
                { id: 'item-9-3', description: 'Refrigerant Charge Verification & Superheat Adjustment', quantity: 1, unitPrice: 900, total: 900, type: 'Labor', taxable: false },
                { id: 'item-9-4', description: 'Electronic Humidistat Controller Calibration', quantity: 1, unitPrice: 1000, total: 1000, type: 'Service', taxable: false }
            ],
            subtotal: 3750,
            taxRate: 0.0825,
            taxAmount: 37.13,
            totalAmount: 3787.13,
            amount: 3787.13,
            amountPaid: 3787.13,
            status: 'Paid',
            paidDate: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-10',
        organizationId: 'apex-org-456',
        customerName: 'Cherry Creek Financial Tower',
        customerId: 'apex-cust-10',
        customerEmail: 'dsterling@cherrycreektower.demo',
        customerPhone: '(555) 321-8000',
        address: '100 Fillmore St, Denver, CO 80206',
        tasks: ['400-Ton Centrifugal Chiller Oil Analysis & Eddy Current Testing', 'Vane Actuator Calibration'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-4-id'],
        specialInstructions: 'Sub-basement CUP access. Chief engineer David Sterling onsite.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }],
        invoice: {
            id: 'INV-2010',
            items: [
                { id: 'item-10-1', description: 'York Centrifugal Chiller Non-Destructive Eddy Current Testing', quantity: 1, unitPrice: 5800, total: 5800, type: 'Service', taxable: false },
                { id: 'item-10-2', description: 'Synthetic Chiller Oil Charge & Filter Cartridge Replacement', quantity: 1, unitPrice: 2800, total: 2800, type: 'Part', taxable: true },
                { id: 'item-10-3', description: 'Master Chiller Technician Precision Calibration (24 Hours)', quantity: 24, unitPrice: 162.50, total: 3900, type: 'Labor', taxable: false }
            ],
            subtotal: 12500,
            taxRate: 0.0825,
            taxAmount: 231.00,
            totalAmount: 12731.00,
            amount: 12731.00,
            amountPaid: 12731.00,
            status: 'Paid',
            paidDate: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 27 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-11',
        organizationId: 'apex-org-456',
        customerName: 'Tractor Supply - Converse, TX',
        customerId: 'demo-cust-2',
        customerEmail: 'converse@tractorsupply.demo',
        customerPhone: '(210) 318-4197',
        address: '8318 FM 78, Converse, TX 78109',
        tasks: ['Rooftop Unit Economizer Damper Actuator Replacement', 'Thermostat Schedule Reprogramming'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        specialInstructions: 'Commercial Tractor Supply retail branch. Store manager Gary Vance approved work order.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }],
        invoice: {
            id: 'INV-2011',
            items: [
                { id: 'item-11-1', description: 'Honeywell Direct Coupled Modulating Damper Actuator', quantity: 2, unitPrice: 420, total: 840, type: 'Part', taxable: true },
                { id: 'item-11-2', description: 'Economizer Outside Air Sensor & Enthalpy Control Kit', quantity: 1, unitPrice: 380, total: 380, type: 'Part', taxable: true },
                { id: 'item-11-3', description: 'Installation, Wiring & Calibration Labor', quantity: 4, unitPrice: 157.50, total: 630, type: 'Labor', taxable: false }
            ],
            subtotal: 1850,
            taxRate: 0.0825,
            taxAmount: 100.65,
            totalAmount: 1950.65,
            amount: 1950.65,
            amountPaid: 1950.65,
            status: 'Paid',
            paidDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-12',
        organizationId: 'apex-org-456',
        customerName: 'Dr. Arthur & Helen Vance',
        customerId: 'apex-cust-12',
        customerEmail: 'avance@denverhealthnet.demo',
        customerPhone: '(555) 773-4500',
        address: '44 Crestmoor Dr, Cherry Hills Village, CO 80113',
        tasks: ['Whole House Air Purifier & Variable-Speed Inverter Service', 'Fieldpiece Diagnostic Readings'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        specialInstructions: 'Client is a physician. Please wear boot covers inside home at all times.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), user: 'Sam Rivera' }],
        invoice: {
            id: 'INV-2012',
            items: [
                { id: 'item-12-1', description: 'Trane CleanEffects Cell Wash & Corona Field Sensor Test', quantity: 1, unitPrice: 320, total: 320, type: 'Service', taxable: false },
                { id: 'item-12-2', description: 'Replacement Collection Filter Inserts OEM', quantity: 2, unitPrice: 95, total: 190, type: 'Part', taxable: true },
                { id: 'item-12-3', description: 'Variable-Speed Inverter Frequency Test & Refrigerant Superheat', quantity: 1, unitPrice: 380, total: 380, type: 'Labor', taxable: false }
            ],
            subtotal: 890,
            taxRate: 0.0825,
            taxAmount: 15.68,
            totalAmount: 905.68,
            amount: 905.68,
            amountPaid: 905.68,
            status: 'Paid',
            paidDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-13',
        organizationId: 'apex-org-456',
        customerName: 'Marcus & Chloe Montgomery',
        customerId: 'apex-cust-11',
        customerEmail: 'marcus.m@skylinehomes.demo',
        customerPhone: '(555) 449-1122',
        address: '740 Flagstaff Rd, Boulder, CO 80302',
        tasks: ['Infinity Greenspeed Heat Pump Electronic Expansion Valve Replacement', 'Nitrogen Pressure Test'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        specialInstructions: 'Modern net-zero home. System connected to home energy storage bank.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }],
        invoice: {
            id: 'INV-2013',
            items: [
                { id: 'item-13-1', description: 'Carrier OEM Stepper Motor Electronic Expansion Valve (EEV)', quantity: 1, unitPrice: 580, total: 580, type: 'Part', taxable: true },
                { id: 'item-13-2', description: 'High-Purity Dry Nitrogen Pressure Test & Deep Evacuation (<300 microns)', quantity: 1, unitPrice: 340, total: 340, type: 'Service', taxable: false },
                { id: 'item-13-3', description: 'Refrigerant Recovery & Weigh-In Factory Charge', quantity: 1, unitPrice: 500, total: 500, type: 'Labor', taxable: false }
            ],
            subtotal: 1420,
            taxRate: 0.0825,
            taxAmount: 47.85,
            totalAmount: 1467.85,
            amount: 1467.85,
            amountPaid: 1467.85,
            status: 'Paid',
            paidDate: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-14',
        organizationId: 'apex-org-456',
        customerName: 'Jonathan & Claire Dupont',
        customerId: 'apex-cust-13',
        customerEmail: 'jdupont@dupontinvest.demo',
        customerPhone: '(555) 832-6100',
        address: '5800 S University Blvd, Greenwood Village, CO 80121',
        tasks: ['Lennox SL280V Variable Speed Blower Motor Replacement', 'Static Pressure Optimization'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        specialInstructions: 'Lower level mechanical room. Beware of small dog in backyard.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }],
        invoice: {
            id: 'INV-2014',
            items: [
                { id: 'item-14-1', description: 'Lennox ECM Variable-Speed Blower Motor & End-Bell Module', quantity: 1, unitPrice: 650, total: 650, type: 'Part', taxable: true },
                { id: 'item-14-2', description: 'Duct Static Pressure Testing & CFM Balancing', quantity: 1, unitPrice: 250, total: 250, type: 'Service', taxable: false },
                { id: 'item-14-3', description: 'Certified Technician Installation Labor', quantity: 1, unitPrice: 250, total: 250, type: 'Labor', taxable: false }
            ],
            subtotal: 1150,
            taxRate: 0.0825,
            taxAmount: 53.63,
            totalAmount: 1203.63,
            amount: 1203.63,
            amountPaid: 1203.63,
            status: 'Paid',
            paidDate: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-15',
        organizationId: 'apex-org-456',
        customerName: 'Evelyn Thorne',
        customerId: 'apex-cust-14',
        customerEmail: 'ethorne@mountainarch.demo',
        customerPhone: '(555) 668-9022',
        address: '1240 Castle Point Dr, Castle Rock, CO 80108',
        tasks: ['Bosch Inverter Heat Pump Pre-Season Calibration', 'REME HALO UV Cell Replacement'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        specialInstructions: 'Access key is in master lockbox on garage side door. Code 4102.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), user: 'Marcus Brody' }],
        invoice: {
            id: 'INV-2015',
            items: [
                { id: 'item-15-1', description: 'REME HALO Replacement UV Ionization Cell OEM', quantity: 1, unitPrice: 380, total: 380, type: 'Part', taxable: true },
                { id: 'item-15-2', description: 'Bosch Inverter System 32-Point Precision Safety & Performance Tune-Up', quantity: 1, unitPrice: 250, total: 250, type: 'Service', taxable: false },
                { id: 'item-15-3', description: 'Condensate EZ-Trap Cleanout & Biocide Treatment', quantity: 1, unitPrice: 150, total: 150, type: 'Labor', taxable: false }
            ],
            subtotal: 780,
            taxRate: 0.0825,
            taxAmount: 31.35,
            totalAmount: 811.35,
            amount: 811.35,
            amountPaid: 811.35,
            status: 'Paid',
            paidDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-16',
        organizationId: 'apex-org-456',
        customerName: 'Harrison & Beatrice Wells',
        customerId: 'apex-cust-15',
        customerEmail: 'hwells@wellscapital.demo',
        customerPhone: '(555) 902-3344',
        address: '884 Country Club Pkwy, Castle Pines, CO 80108',
        tasks: ['Bryant Evolution Multi-Point Tune-Up', 'Dual Run Capacitor Replacement (45/5 MFD)'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        specialInstructions: 'Park in guest driveway turnaround. Homeowners working remotely.',
        jobEvents: [{ type: 'completed', timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), user: 'Marcus Brody' }],
        invoice: {
            id: 'INV-2016',
            items: [
                { id: 'item-16-1', description: 'AmRad Turbo 200 Heavy-Duty Dual Run Capacitor 45/5 MFD', quantity: 1, unitPrice: 165, total: 165, type: 'Part', taxable: true },
                { id: 'item-16-2', description: 'Residential Seasonal Air Conditioning Precision Tune-Up', quantity: 1, unitPrice: 180, total: 180, type: 'Service', taxable: false },
                { id: 'item-16-3', description: 'Contactor Points Inspection & Voltage Drop Analysis', quantity: 1, unitPrice: 150, total: 150, type: 'Labor', taxable: false }
            ],
            subtotal: 495,
            taxRate: 0.0825,
            taxAmount: 13.61,
            totalAmount: 508.61,
            amount: 508.61,
            amountPaid: 508.61,
            status: 'Paid',
            paidDate: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-prog-1',
        organizationId: 'apex-org-456',
        customerName: 'Rocky Mountain Brewery',
        customerId: 'apex-cust-4',
        customerEmail: 'liam@rockymtnbrewery.demo',
        customerPhone: '(555) 620-4400',
        address: '1420 Brewery Lane, Golden, CO 80401',
        tasks: ['Fermenter Glycol Pressure Sensor & Digital Manifold Calibration', 'BACnet Transmitter Diagnosis'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        specialInstructions: 'Lead technician Leo Masters onsite in the main Brewhouse. Testing glycol supply loop differential.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        jobEvents: [{ type: 'in_progress', timestamp: new Date().toISOString(), user: 'Leo Masters' }],
        invoice: {
            id: 'INV-2017',
            items: [
                { id: 'item-17-1', description: 'Danfoss Commercial Glycol Differential Pressure Transducer 0-100 PSI', quantity: 1, unitPrice: 850, total: 850, type: 'Part', taxable: true },
                { id: 'item-17-2', description: 'Specialized Industrial Controls Diagnostics & Software Tuning', quantity: 1, unitPrice: 1000, total: 1000, type: 'Labor', taxable: false }
            ],
            subtotal: 1850,
            taxRate: 0.0825,
            taxAmount: 70.13,
            totalAmount: 1920.13,
            amount: 1920.13,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-prog-2',
        organizationId: 'apex-org-456',
        customerName: 'Front Range Surgery Center',
        customerId: 'apex-cust-5',
        customerEmail: 'ralvarez@frontrangesurgery.demo',
        customerPhone: '(555) 710-8800',
        address: '9200 Health Park Blvd, Suite 300, Lone Tree, CO 80124',
        tasks: ['Cleanroom AHU VFD Motor Inverter Replacement', 'Positive Pressure Isolation Validation'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        specialInstructions: 'Sam Rivera dispatched. Facility engineer Dr. Alvarez requested completion prior to morning procedures.',
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        jobEvents: [{ type: 'in_progress', timestamp: new Date().toISOString(), user: 'Sam Rivera' }],
        invoice: {
            id: 'INV-2018',
            items: [
                { id: 'item-18-1', description: 'ABB 15-HP ACH580 Ultra-Low Harmonic HVAC Variable Frequency Drive', quantity: 1, unitPrice: 3200, total: 3200, type: 'Part', taxable: true },
                { id: 'item-18-2', description: 'Cleanroom Medical Electrical Integration & Drive Commissioning', quantity: 1, unitPrice: 1620, total: 1620, type: 'Labor', taxable: false }
            ],
            subtotal: 4820,
            taxRate: 0.0825,
            taxAmount: 264.00,
            totalAmount: 5084.00,
            amount: 5084.00,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-prog-3',
        organizationId: 'apex-org-456',
        customerName: 'Denver Tech Logistics Hub',
        customerId: 'apex-cust-6',
        customerEmail: 'derek@dentechlogistics.demo',
        customerPhone: '(555) 884-2100',
        address: '18400 E 40th Ave, Aurora, CO 80011',
        tasks: ['Packaged RTU Variable Frequency Drive Diagnostics', 'Economizer Outdoor Damper Tuning'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        specialInstructions: 'Frank Fisher onsite. Safety gear required. Sorting warehouse bay 3 roof unit.',
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        jobEvents: [{ type: 'in_progress', timestamp: new Date().toISOString(), user: 'Frank Fisher' }],
        invoice: {
            id: 'INV-2019',
            items: [
                { id: 'item-19-1', description: 'Yaskawa Commercial Inverter Bypass Contactor Assembly', quantity: 1, unitPrice: 1450, total: 1450, type: 'Part', taxable: true },
                { id: 'item-19-2', description: 'Industrial Rooftop Diagnostics & VFD Re-programming', quantity: 1, unitPrice: 800, total: 800, type: 'Labor', taxable: false }
            ],
            subtotal: 2250,
            taxRate: 0.0825,
            taxAmount: 119.63,
            totalAmount: 2369.63,
            amount: 2369.63,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-sched-1',
        organizationId: 'apex-org-456',
        customerName: 'Alpine Peak Data Facility',
        customerId: 'apex-cust-8',
        customerEmail: 'ncarlson@alpinepeakdata.demo',
        customerPhone: '(555) 919-7300',
        address: '6800 S Tucson Way, Centennial, CO 80112',
        tasks: ['Redundant CRAC Cooling Loop Inspection', 'Underfloor Chilled Water Pressure Balancing'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Tier III Co-location facility. High security protocol.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        invoice: {
            id: 'INV-2020',
            items: [
                { id: 'item-20-1', description: 'Mission-Critical CRAC Performance & Underfloor Airflow Survey', quantity: 1, unitPrice: 1650, total: 1650, type: 'Service', taxable: false }
            ],
            subtotal: 1650,
            taxRate: 0.0825,
            taxAmount: 0,
            totalAmount: 1650,
            amount: 1650,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-sched-2',
        organizationId: 'apex-org-456',
        customerName: 'Highlands Luxury Lofts HOA',
        customerId: 'apex-cust-7',
        customerEmail: 'jmercer@highlandslofts.demo',
        customerPhone: '(555) 433-9191',
        address: '3200 Tejon St, Denver, CO 80211',
        tasks: ['Multi-Zone VRF Refrigerant Pressure Balancing', 'Branch Controller Filter Inspection'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Access via building elevator to north mechanical penthouse.',
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        invoice: {
            id: 'INV-2021',
            items: [
                { id: 'item-21-1', description: 'VRF 24-Zone Branch Controller Optimization & Electronic Expansion Calibration', quantity: 1, unitPrice: 2100, total: 2100, type: 'Service', taxable: false }
            ],
            subtotal: 2100,
            taxRate: 0.0825,
            taxAmount: 0,
            totalAmount: 2100,
            amount: 2100,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-sched-3',
        organizationId: 'apex-org-456',
        customerName: 'Dr. Arthur & Helen Vance',
        customerId: 'apex-cust-12',
        customerEmail: 'avance@denverhealthnet.demo',
        customerPhone: '(555) 773-4500',
        address: '44 Crestmoor Dr, Cherry Hills Village, CO 80113',
        tasks: ['Residential Summer Cooling Pre-Season Multi-Point Tune-Up'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Covered under Residential Elite Membership Plan.',
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        invoice: {
            id: 'INV-2022',
            items: [
                { id: 'item-22-1', description: 'Residential Elite Semi-Annual Comprehensive Air Conditioning Service', quantity: 1, unitPrice: 249, total: 249, type: 'Service', taxable: false }
            ],
            subtotal: 249,
            taxRate: 0.0825,
            taxAmount: 0,
            totalAmount: 249,
            amount: 249,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-sched-4',
        organizationId: 'apex-org-456',
        customerName: 'Marcus & Chloe Montgomery',
        customerId: 'apex-cust-11',
        customerEmail: 'marcus.m@skylinehomes.demo',
        customerPhone: '(555) 449-1122',
        address: '740 Flagstaff Rd, Boulder, CO 80302',
        tasks: ['Carrier Infinity Touch Thermostat Firmware Update', 'MERV 15 Media Air Cleaner Replacements'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Homeowner requested morning window (9:00 AM - 11:00 AM).',
        assignedTechnicianId: 'apex-tech-id',
        assignedTechnicianName: 'Frank Fisher',
        invoice: {
            id: 'INV-2023',
            items: [
                { id: 'item-23-1', description: 'Carrier Infinity Air Purifier Filter Cartridge OEM MERV 15', quantity: 1, unitPrice: 190, total: 190, type: 'Part', taxable: true },
                { id: 'item-23-2', description: 'Thermostat Diagnostics, Wi-Fi Setup & System Calibration', quantity: 1, unitPrice: 150, total: 150, type: 'Labor', taxable: false }
            ],
            subtotal: 340,
            taxRate: 0.0825,
            taxAmount: 15.68,
            totalAmount: 355.68,
            amount: 355.68,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-24',
        organizationId: 'apex-org-456',
        customerName: 'Denver International Airport - Concourse CUP',
        customerId: 'apex-cust-16',
        customerEmail: 'marcus.vance@flydenver.demo',
        customerPhone: '(303) 342-2000',
        address: '8500 Peña Blvd, Concourse B Central Utility Plant, Denver, CO 80249',
        tasks: ['York 1200-Ton Centrifugal Chiller Major Overhaul', 'Eddy-Current Tube Testing & Refrigerant Oil Reclamation', 'Magnetic Bearing Calibration & Sensor Telemetry Verification'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Enter through Concourse B Security Gate 4. Mandatory TSA badges and TWIC credentials displayed at all times.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-6-id', 'apex-tech-7-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'dispatched', timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }
        ],
        invoice: {
            id: 'INV-ENT-3001',
            items: [
                { id: 'item-24-1', description: 'York 1200-Ton Centravac Chiller Eddy-Current Non-Destructive Tube Analysis (520 Tubes)', quantity: 1, unitPrice: 14500, total: 14500, type: 'Service', taxable: false },
                { id: 'item-24-2', description: 'Compressor Bearing Thrust Inspection, Purge Unit Modernization & Gasket Rebuild Kit', quantity: 1, unitPrice: 28900, total: 28900, type: 'Part', taxable: true },
                { id: 'item-24-3', description: 'Senior Master Chiller Specialist & Certified NDT Crew Labor (160 Man-Hours)', quantity: 160, unitPrice: 225, total: 36000, type: 'Labor', taxable: false },
                { id: 'item-24-4', description: 'EPA Certified R-513A Closed-Loop Reclamation, Dehydration & Molecular Sieve Core Recharging', quantity: 1, unitPrice: 6000, total: 6000, type: 'Service', taxable: false }
            ],
            subtotal: 85400,
            taxRate: 0.0825,
            taxAmount: 2384.25,
            totalAmount: 87784.25,
            amount: 87784.25,
            amountPaid: 87784.25,
            status: 'Paid',
            paidDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-25',
        organizationId: 'apex-org-456',
        customerName: 'CU Anschutz Medical Research Campus',
        customerId: 'apex-cust-17',
        customerEmail: 'sarah.lin@cuanschutz.demo',
        customerPhone: '(303) 724-5000',
        address: '13001 E 17th Pl, Biosafety Research Tower 2, Aurora, CO 80045',
        tasks: ['Surgical Suites ISO Class 5 HEPA Terminal Bank Certification', 'Phoenix Controls Venturi Airflow & Cascade Differential Pressure Balancing', 'Aerosol Photometer Filter Leak Scan'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Biosafety Level 3 protocol. Full cleanroom gowning required prior to anteroom entry.',
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        assignedCrew: ['apex-tech-4-id', 'apex-tech-7-id', 'apex-tech-3-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), user: 'Sam Rivera' }
        ],
        invoice: {
            id: 'INV-ENT-3002',
            items: [
                { id: 'item-25-1', description: 'Camfil Megalam ISO Class 5 Fluid-Seal Terminal HEPA Filter Cartridges (x12)', quantity: 12, unitPrice: 1150, total: 13800, type: 'Part', taxable: true },
                { id: 'item-25-2', description: 'Phoenix Controls High-Speed Venturi Air Valve Recalibration & Potentiometer Tuning', quantity: 1, unitPrice: 8400, total: 8400, type: 'Part', taxable: true },
                { id: 'item-25-3', description: 'NEBB Certified TAB & Cleanroom Bio-Containment Validation Testing', quantity: 1, unitPrice: 14200, total: 14200, type: 'Service', taxable: false },
                { id: 'item-25-4', description: 'Master MedGas & Bio-Containment Commissioning Engineer Labor (56 Hours)', quantity: 56, unitPrice: 215, total: 12040, type: 'Labor', taxable: false }
            ],
            subtotal: 48440,
            taxRate: 0.0825,
            taxAmount: 1831.50,
            totalAmount: 50271.50,
            amount: 50271.50,
            amountPaid: 50271.50,
            status: 'Paid',
            paidDate: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-26',
        organizationId: 'apex-org-456',
        customerName: 'CoreSite DNV2 Enterprise Data Center',
        customerId: 'apex-cust-19',
        customerEmail: 'david.ramirez@coresite.demo',
        customerPhone: '(303) 405-1000',
        address: '910 15th St, Mission Critical Level 3, Denver, CO 80202',
        tasks: ['Schneider Uniflair InRow Chilled Water Precision Coolers Commissioning', 'Dual Variable Pumping Skid Integration', 'Thermal Containment Pod Load Testing'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Critical server halls live. Zero static discharge precautions mandatory.',
        assignedTechnicianId: 'apex-tech-2-id',
        assignedTechnicianName: 'Frank Fisher',
        assignedCrew: ['apex-tech-2-id', 'apex-tech-3-id', 'apex-tech-5-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }
        ],
        invoice: {
            id: 'INV-ENT-3003',
            items: [
                { id: 'item-26-1', description: 'Schneider InRow CW Variable-Speed EC Fan Modules & 3-Way Modulating Water Valves', quantity: 2, unitPrice: 14200, total: 28400, type: 'Part', taxable: true },
                { id: 'item-26-2', description: 'Modbus/BACnet MSTP Environmental Sensor Grid & Cold-Aisle Containment Baffles', quantity: 1, unitPrice: 12600, total: 12600, type: 'Part', taxable: true },
                { id: 'item-26-3', description: 'Mission-Critical N+1 Redundancy Load Shed Simulation & Thermal Balancing', quantity: 1, unitPrice: 9800, total: 9800, type: 'Service', taxable: false },
                { id: 'item-26-4', description: 'Industrial Refrigeration & BAS Controls Engineering Labor (64 Hours)', quantity: 64, unitPrice: 210, total: 13440, type: 'Labor', taxable: false }
            ],
            subtotal: 64240,
            taxRate: 0.0825,
            taxAmount: 3382.50,
            totalAmount: 67622.50,
            amount: 67622.50,
            amountPaid: 67622.50,
            status: 'Paid',
            paidDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-27',
        organizationId: 'apex-org-456',
        customerName: 'Lockheed Martin Space Systems - Cleanroom Alpha',
        customerId: 'apex-cust-18',
        customerEmail: 'james.sterling@lmco-space.demo',
        customerPhone: '(303) 977-3000',
        address: '12257 S Wadsworth Blvd, High-Bay Building 100, Littleton, CO 80125',
        tasks: ['Munters DryCool Desiccant Ultra-Low Humidity Air Dehumidifier Overhaul', 'Rotor Reactivation Burner Service', 'Trane CenTraVac Bypass Loop Balancing'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Defense security badge required. Escort by James Sterling from security gatehouse.',
        assignedTechnicianId: 'apex-lead-tech-id',
        assignedTechnicianName: 'Leo Masters',
        assignedCrew: ['apex-lead-tech-id', 'apex-tech-4-id', 'apex-tech-7-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), user: 'Leo Masters' }
        ],
        invoice: {
            id: 'INV-ENT-3004',
            items: [
                { id: 'item-27-1', description: 'Munters Titanium Silica Gel Desiccant Rotor Assembly Replacement', quantity: 1, unitPrice: 24800, total: 24800, type: 'Part', taxable: true },
                { id: 'item-27-2', description: 'High-Temperature Reactivation Electric Heating Coil & Modulation SCR Kit', quantity: 1, unitPrice: 9200, total: 9200, type: 'Part', taxable: true },
                { id: 'item-27-3', description: 'Cleanroom Relative Humidity NIST Calibration & Dewpoint Sensor Validation', quantity: 1, unitPrice: 5600, total: 5600, type: 'Service', taxable: false },
                { id: 'item-27-4', description: 'Aerospace Mechanical Engineering Field Specialist Labor (58 Hours)', quantity: 58, unitPrice: 230, total: 13340, type: 'Labor', taxable: false }
            ],
            subtotal: 52940,
            taxRate: 0.0825,
            taxAmount: 2805.00,
            totalAmount: 55745.00,
            amount: 55745.00,
            amountPaid: 55745.00,
            status: 'Paid',
            paidDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-28',
        organizationId: 'apex-org-456',
        customerName: 'The Broadmoor Resort & International Center',
        customerId: 'apex-cust-20',
        customerEmail: 'robert.p@broadmoor.demo',
        customerPhone: '(719) 577-5775',
        address: '1 Lake Ave, Central Engineering Complex, Colorado Springs, CO 80906',
        tasks: ['Cleaver-Brooks 400-HP High-Pressure Steam Boiler Annual Overhaul', 'ASME Section IV Waterside Descaling', 'Honeywell Linkageless Combustion Control Recalibration'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Boiler room entrance adjacent to West Tower loading dock.',
        assignedTechnicianId: 'apex-tech-6-id',
        assignedTechnicianName: 'Brett Anderson',
        assignedCrew: ['apex-tech-6-id', 'apex-tech-2-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(), user: 'Brett Anderson' }
        ],
        invoice: {
            id: 'INV-ENT-3005',
            items: [
                { id: 'item-28-1', description: 'ASME Section IV High-Pressure Boiler Gasket Kits, Handhole & Manhole Seals', quantity: 1, unitPrice: 4800, total: 4800, type: 'Part', taxable: true },
                { id: 'item-28-2', description: 'Honeywell ControLinks Servo Actuator & UV Flame Scanner Replacement', quantity: 1, unitPrice: 7900, total: 7900, type: 'Part', taxable: true },
                { id: 'item-28-3', description: 'Ultrasonic Flue Gas Analysis, Combustion Tuning & State Boiler Safety Certificate', quantity: 1, unitPrice: 11400, total: 11400, type: 'Service', taxable: false },
                { id: 'item-28-4', description: 'Master Hydronics & High-Pressure Steam Inspector Labor (76 Hours)', quantity: 76, unitPrice: 195, total: 14820, type: 'Labor', taxable: false }
            ],
            subtotal: 38920,
            taxRate: 0.0825,
            taxAmount: 1047.75,
            totalAmount: 39967.75,
            amount: 39967.75,
            amountPaid: 39967.75,
            status: 'Paid',
            paidDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-29',
        organizationId: 'apex-org-456',
        customerName: 'Denver International Airport - Concourse CUP',
        customerId: 'apex-cust-16',
        customerEmail: 'marcus.vance@flydenver.demo',
        customerPhone: '(303) 342-2000',
        address: '8500 Peña Blvd, Concourse B Central Utility Plant, Denver, CO 80249',
        tasks: ['Terminal VAV Terminal Box Digital Actuator Retrofit', 'Automated Logic WebCTRL DDC BACnet Node Upgrades'],
        jobStatus: 'In Progress',
        appointmentTime: new Date().toISOString(),
        specialInstructions: 'Work taking place during low airport passenger traffic window (11:00 PM - 5:00 AM).',
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        assignedCrew: ['apex-tech-3-id', 'apex-tech-5-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'dispatched', timestamp: new Date().toISOString(), user: 'Valerie Vance' }
        ],
        invoice: {
            id: 'INV-ENT-3006',
            items: [
                { id: 'item-29-1', description: 'Belimo AFB24-SR Spring Return Modulating VAV Actuators (x40)', quantity: 40, unitPrice: 485, total: 19400, type: 'Part', taxable: true },
                { id: 'item-29-2', description: 'BACnet MS/TP Digital Room Temperature & CO2 Sensors', quantity: 40, unitPrice: 220, total: 8800, type: 'Part', taxable: true },
                { id: 'item-29-3', description: 'BAS DDC Controls Programming, Point Mapping & Airflow Commissioning (72 Hours)', quantity: 72, unitPrice: 200, total: 14400, type: 'Labor', taxable: false }
            ],
            subtotal: 42600,
            taxRate: 0.0825,
            taxAmount: 2326.50,
            totalAmount: 44926.50,
            amount: 44926.50,
            status: 'Unpaid'
        },
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-30',
        organizationId: 'apex-org-456',
        customerName: 'CU Anschutz Medical Research Campus',
        customerId: 'apex-cust-17',
        customerEmail: 'sarah.lin@cuanschutz.demo',
        customerPhone: '(303) 724-5000',
        address: '13001 E 17th Pl, Biosafety Research Tower 2, Aurora, CO 80045',
        tasks: ['Vivarium Negative Pressure Exhaust Isolation Overhaul', 'Redundant Strobic Air High-Plume Dilution Fan Alignment'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Confirm biocontainment autoclave shutdown with Dr. Sarah Lin prior to duct disconnection.',
        assignedTechnicianId: 'apex-tech-4-id',
        assignedTechnicianName: 'Sam Rivera',
        assignedCrew: ['apex-tech-4-id', 'apex-tech-7-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date().toISOString(), user: 'Valerie Vance' }
        ],
        invoice: {
            id: 'INV-ENT-3007',
            items: [
                { id: 'item-30-1', description: 'Strobic Air Tri-Stack High-Plume Fan Bearing Assemblies & Dynamic V-Belts', quantity: 2, unitPrice: 5900, total: 11800, type: 'Part', taxable: true },
                { id: 'item-30-2', description: 'Fast-Acting Biosecurity Isolation Dampers with Pneumatic Fail-Safe Actuation', quantity: 2, unitPrice: 4600, total: 9200, type: 'Part', taxable: true },
                { id: 'item-30-3', description: 'NEBB Cleanroom Negative Differential Pressure Testing & Velocity Mapping (64 Hours)', quantity: 64, unitPrice: 215, total: 13760, type: 'Labor', taxable: false }
            ],
            subtotal: 34760,
            taxRate: 0.0825,
            taxAmount: 1732.50,
            totalAmount: 36492.50,
            amount: 36492.50,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-31',
        organizationId: 'apex-org-456',
        customerName: 'CoreSite DNV2 Enterprise Data Center',
        customerId: 'apex-cust-19',
        customerEmail: 'david.ramirez@coresite.demo',
        customerPhone: '(303) 405-1000',
        address: '910 15th St, Mission Critical Level 3, Denver, CO 80202',
        tasks: ['Emergency CRAC Unit #4 Variable Speed Drive Inverter Fault', 'Harmonic Filter Replacement & 24hr Burn-In Test'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Critical Tier III response - resolved within 45 minutes of dispatch.',
        assignedTechnicianId: 'apex-tech-3-id',
        assignedTechnicianName: 'Marcus Brody',
        assignedCrew: ['apex-tech-3-id', 'apex-lead-tech-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), user: 'Marcus Brody' }
        ],
        invoice: {
            id: 'INV-ENT-3008',
            items: [
                { id: 'item-31-1', description: 'Danfoss VLT HVAC Drive Inverter 30-HP Commercial Module', quantity: 1, unitPrice: 11200, total: 11200, type: 'Part', taxable: true },
                { id: 'item-31-2', description: 'Active Harmonic Line Filter & Transient Surge Suppressor', quantity: 1, unitPrice: 3850, total: 3850, type: 'Part', taxable: true },
                { id: 'item-31-3', description: 'Emergency 2-Hour Response Dispatch & Field Controls Engineering (22 Hours)', quantity: 22, unitPrice: 200, total: 4400, type: 'Labor', taxable: false }
            ],
            subtotal: 19450,
            taxRate: 0.0825,
            taxAmount: 1241.63,
            totalAmount: 20691.63,
            amount: 20691.63,
            amountPaid: 20691.63,
            status: 'Paid',
            paidDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-32',
        organizationId: 'apex-org-456',
        customerName: 'Lockheed Martin Space Systems - Cleanroom Alpha',
        customerId: 'apex-cust-18',
        customerEmail: 'james.sterling@lmco-space.demo',
        customerPhone: '(303) 977-3000',
        address: '12257 S Wadsworth Blvd, High-Bay Building 100, Littleton, CO 80125',
        tasks: ['Satellite Thermal Vacuum Chamber Chiller Fluid Flushing', 'Spectroscopic Thermal Fluid Viscosity Analysis'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'ITAR cleared personnel only. Mobile closed-loop reclamation rig required on site.',
        assignedTechnicianId: 'apex-tech-2-id',
        assignedTechnicianName: 'Frank Fisher',
        assignedCrew: ['apex-tech-2-id', 'apex-tech-6-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date().toISOString(), user: 'Valerie Vance' }
        ],
        invoice: {
            id: 'INV-ENT-3009',
            items: [
                { id: 'item-32-1', description: 'Dowtherm SR-1 Ultra-Pure Inhibited Ethylene Glycol (4 Drum Skid)', quantity: 4, unitPrice: 2850, total: 11400, type: 'Part', taxable: true },
                { id: 'item-32-2', description: 'Closed-Loop Hydronic Micro-Filtration Cartridge Skid Service', quantity: 1, unitPrice: 4100, total: 4100, type: 'Part', taxable: true },
                { id: 'item-32-3', description: 'Cryogenic & Low-Temp Refrigeration Senior Technician Labor (56 Hours)', quantity: 56, unitPrice: 200, total: 11200, type: 'Labor', taxable: false }
            ],
            subtotal: 26700,
            taxRate: 0.0825,
            taxAmount: 1278.75,
            totalAmount: 27978.75,
            amount: 27978.75,
            status: 'Unpaid'
        },
        createdAt: new Date().toISOString()
    },
    {
        id: 'apex-job-33',
        organizationId: 'apex-org-456',
        customerName: 'The Broadmoor Resort & International Center',
        customerId: 'apex-cust-20',
        customerEmail: 'robert.p@broadmoor.demo',
        customerPhone: '(719) 577-5775',
        address: '1 Lake Ave, Central Engineering Complex, Colorado Springs, CO 80906',
        tasks: ['International Center Evapco Cooling Tower Drive Realignment', 'Fan Bearing Replacement & Laser Shaft Alignment'],
        jobStatus: 'In Progress',
        appointmentTime: new Date().toISOString(),
        specialInstructions: 'Coordination required with resort event schedule.',
        assignedTechnicianId: 'apex-tech-6-id',
        assignedTechnicianName: 'Brett Anderson',
        assignedCrew: ['apex-tech-6-id', 'apex-lead-tech-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'dispatched', timestamp: new Date().toISOString(), user: 'Valerie Vance' }
        ],
        invoice: {
            id: 'INV-ENT-3010',
            items: [
                { id: 'item-33-1', description: 'Evapco Power-Band Drive Belts & Severe-Duty Stainless Bearings', quantity: 1, unitPrice: 4200, total: 4200, type: 'Part', taxable: true },
                { id: 'item-33-2', description: 'Laser Shaft Dynamic Alignment & Full Vibration Spectral Sweep', quantity: 1, unitPrice: 3800, total: 3800, type: 'Service', taxable: false },
                { id: 'item-33-3', description: 'Master Hydronics Technician Labor (35 Hours)', quantity: 35, unitPrice: 195, total: 6825, type: 'Labor', taxable: false }
            ],
            subtotal: 14825,
            taxRate: 0.0825,
            taxAmount: 346.50,
            totalAmount: 15171.50,
            amount: 15171.50,
            status: 'Unpaid'
        },
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-34',
        organizationId: 'apex-org-456',
        customerName: 'Mile High Distribution Center',
        customerId: 'apex-cust-3',
        customerEmail: 'dispatch@milehighdist.demo',
        customerPhone: '(555) 500-3000',
        address: '500 Industrial Rd, Denver, CO 80216',
        tasks: ['Central Ammonia Refrigeration Screw Compressor Shaft Seal Replacement', 'Oil Separator Core Exchange & Non-Condensables Purge'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Safety breathing apparatus & ammonia detectors required in engine room.',
        assignedTechnicianId: 'apex-tech-2-id',
        assignedTechnicianName: 'Frank Fisher',
        assignedCrew: ['apex-tech-2-id', 'apex-lead-tech-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(), user: 'Frank Fisher' }
        ],
        invoice: {
            id: 'INV-ENT-3011',
            items: [
                { id: 'item-34-1', description: 'Vilter Single Screw Ammonia Compressor Mechanical Shaft Seal & O-Ring Overhaul Kit', quantity: 1, unitPrice: 12800, total: 12800, type: 'Part', taxable: true },
                { id: 'item-34-2', description: 'Synthetic Ammonia Refrigeration Compressor Lubricant (55 Gallon Drum)', quantity: 1, unitPrice: 3200, total: 3200, type: 'Part', taxable: true },
                { id: 'item-34-3', description: 'Ammonia Certified Senior Lead Tech Labor (75 Hours)', quantity: 75, unitPrice: 205, total: 15375, type: 'Labor', taxable: false }
            ],
            subtotal: 31375,
            taxRate: 0.0825,
            taxAmount: 1320.00,
            totalAmount: 32695.00,
            amount: 32695.00,
            amountPaid: 32695.00,
            status: 'Paid',
            paidDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'apex-job-35',
        organizationId: 'apex-org-456',
        customerName: 'Rocky Mountain Brewery',
        customerId: 'apex-cust-4',
        customerEmail: 'brewmaster@rockymtnbrew.demo',
        customerPhone: '(555) 600-4000',
        address: '100 Craft Way, Boulder, CO 80301',
        tasks: ['Glycol Chiller Header Redesign & Variable Frequency Pumping Skid Retrofit', 'Automated Cellar Tank Solenoid Control Integration'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        specialInstructions: 'Sanitary food-grade plumbing fittings required on glycol-to-fermentation lines.',
        assignedTechnicianId: 'apex-tech-6-id',
        assignedTechnicianName: 'Brett Anderson',
        assignedCrew: ['apex-tech-6-id', 'apex-tech-5-id'],
        jobEvents: [
            { type: 'scheduled', timestamp: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(), user: 'Valerie Vance' },
            { type: 'completed', timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), user: 'Brett Anderson' }
        ],
        invoice: {
            id: 'INV-ENT-3012',
            items: [
                { id: 'item-35-1', description: 'Grundfos Magna3 Variable-Speed Stainless Industrial Circulation Pumps (Lead/Lag Pair)', quantity: 2, unitPrice: 6400, total: 12800, type: 'Part', taxable: true },
                { id: 'item-35-2', description: 'Welded 304 Stainless Steel Header Piping & High-Flow Balancing Valves', quantity: 1, unitPrice: 6200, total: 6200, type: 'Part', taxable: true },
                { id: 'item-35-3', description: 'Hydronic Engineering & Industrial Brewery Piping Installation Labor (50 Hours)', quantity: 50, unitPrice: 195, total: 9750, type: 'Labor', taxable: false }
            ],
            subtotal: 28750,
            taxRate: 0.0825,
            taxAmount: 1567.50,
            totalAmount: 30317.50,
            amount: 30317.50,
            amountPaid: 30317.50,
            status: 'Paid',
            paidDate: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'mhm-job-1',
        organizationId: 'mhm-org-789',
        customerName: 'Sterling Residences',
        customerId: 'apex-cust-2',
        customerEmail: 'eleanor@sterling.demo',
        address: '2 Sterling Way, Cherry Hills Village, CO 80113',
        tasks: ['Annual Furnace Tune-Up'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        completionDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        assignedTechnicianName: 'MHM Technician',
        invoice: {
            id: 'INV-MHM-101',
            items: [
                { id: 'item-mhm-1', description: 'Standard HVAC Tune-Up', quantity: 1, unitPrice: 129, total: 129, type: 'Service', taxable: false }
            ],
            subtotal: 129,
            taxRate: 0.0765,
            taxAmount: 0,
            totalAmount: 129,
            amount: 129,
            amountPaid: 129,
            status: 'Paid',
            paidDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
        },
        createdAt: new Date(Date.now() - 92 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_DOCUMENTS: BusinessDocument[] = [
    // --- 1. Repository Documents (Customer Releases & Active Agreements) ---
    {
        id: 'doc-waiver-1',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        jobId: 'apex-job-2',
        title: 'Customer Safety & Service Authorization Release - Sterling',
        category: 'Waiver',
        type: 'waiver',
        status: 'Pending Signature',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Customer Safety & Service Authorization Release</h2>
                <p style="font-size: 14px; margin-bottom: 16px;">This legal authorization confirms permission for certified HVAC technicians from <strong>Apex Mechanical Solutions</strong> to access the mechanical equipment, ductwork, and electrical disconnects at the designated service address.</p>
                <h4 style="font-size: 15px; font-weight: 700; color: #334155; margin-top: 18px; margin-bottom: 8px;">Scope of Authorization</h4>
                <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin-bottom: 16px;">
                    <li>Comprehensive electrical and mechanical diagnostic testing</li>
                    <li>Refrigerant pressure verification and leak detection analysis</li>
                    <li>Safety control switch testing (high/low pressure switches, flame sensors, limit switches)</li>
                    <li>Filter inspection and airflow optimization testing</li>
                </ul>
                <h4 style="font-size: 15px; font-weight: 700; color: #334155; margin-top: 18px; margin-bottom: 8px;">Warranty & Terms</h4>
                <p style="font-size: 13px; color: #475569;">All labor performed is backed by our standard 12-month workmanship warranty. Installed parts are covered under manufacturer warranty guidelines. By executing your digital signature below, you authorize the diagnostic inspection and confirm property access.</p>
            </div>
        `,
        url: '#',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        version: '1.0'
    },
    {
        id: 'doc-agreement-1',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        title: 'Master Service & Preventive Maintenance Agreement - Sterling Residences',
        category: 'Service Agreement',
        type: 'Service Agreement',
        status: 'Signed',
        signedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        signedBy: 'Eleanor Sterling',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Master Commercial Service &amp; Preventive Maintenance Agreement</h2>
                <p style="font-size: 13px; margin-bottom: 12px;"><strong>Client:</strong> Sterling Residences (Eleanor Sterling)</p>
                <p style="font-size: 13px; margin-bottom: 16px;"><strong>Contract Term:</strong> Annual Renewable · Priority 2-Hour Dispatch</p>
                <h4 style="font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px;">Scope of Preventive Maintenance</h4>
                <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin-bottom: 16px;">
                    <li>2 precision multi-point HVAC &amp; Geothermal tune-up inspections per annum</li>
                    <li>Full combustion efficiency testing &amp; heat exchanger integrity check</li>
                    <li>Capacitor, contactor, and electrical disconnect voltage verification</li>
                    <li>15% contracted discount on all replacement parts and non-routine repair labor</li>
                    <li>Zero trip mobilization fees on standard service dispatches</li>
                </ul>
                <h4 style="font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px;">Billing &amp; Net Terms</h4>
                <p style="font-size: 13px; color: #475569;">Invoices delivered electronically with Net 30 terms. Maintenance fee of $79.00 billed monthly.</p>
                <div style="margin-top: 24px; padding: 12px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #065f46; font-weight: 800;">✓ Digitally Signed &amp; Executed by Eleanor Sterling</p>
                </div>
            </div>
        `,
        url: '#',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        version: '1.0'
    },
    {
        id: 'doc-msa-dia',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-16',
        title: 'Master Service Level Agreement (SLA) - Denver International Airport CUP',
        category: 'Contracts & Agreements',
        type: 'Service Agreement',
        status: 'Signed',
        signedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        signedBy: 'Robert Martinez, PE',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Enterprise Tier IV Mission-Critical SLA</h2>
                <p style="font-size: 13px; margin-bottom: 12px;"><strong>Client:</strong> City &amp; County of Denver / Denver International Airport Central Utility Plant</p>
                <p style="font-size: 13px; margin-bottom: 16px;"><strong>Monthly Retainer:</strong> $18,500.00 / month · 24/7 Dedicated Chiller Response</p>
                <p style="font-size: 13px; color: #475569;">Full turnkey mechanical monitoring for York 1200-Ton Centrifugal chillers and cooling towers.</p>
            </div>
        `,
        url: '#',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        version: '2.1'
    },
    {
        id: 'doc-cert-dia',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-16',
        jobId: 'apex-job-24',
        title: 'York 1200-Ton Centravac Chiller Eddy-Current NDT Inspection Report',
        category: 'Equipment Manuals & Specs',
        type: 'Inspection Report',
        status: 'Signed',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Non-Destructive Tube Analysis Certification</h2>
                <p style="font-size: 13px; color: #334155;"><strong>Unit:</strong> York YK-1200 Centrifugal Chiller · SN-YK-991204</p>
                <p style="font-size: 13px; color: #334155;"><strong>Result:</strong> 520 Copper-Nickel condenser tubes inspected. Zero active tube pitting exceeding ASME Section VIII limits.</p>
            </div>
        `,
        url: '#',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        version: '1.0'
    },
    {
        id: 'doc-cleanroom-anschutz',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-17',
        jobId: 'apex-job-25',
        title: 'CU Anschutz Surgical Suites ISO Class 5 HEPA Certification Certificate',
        category: 'Warranties & Certificates',
        type: 'Certification',
        status: 'Signed',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">ISO-14644 Cleanroom Compliance Certificate</h2>
                <p style="font-size: 13px; color: #334155;"><strong>Facility:</strong> Anschutz Surgical Suite 3A-3D</p>
                <p style="font-size: 13px; color: #059669; font-weight: bold;">Status: Certified Compliant (Zero particle bypass, 99.997% @ 0.3 micron efficiency)</p>
            </div>
        `,
        url: '#',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        version: '1.0'
    },

    // --- 2. Master Files & Schematics (Master Upload Tab) ---
    {
        id: 'doc-schematic-dia',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-16',
        title: 'Denver International Airport Central Plant P&ID CAD Mechanical Schematic.pdf',
        category: 'Blueprints & Schematics',
        type: 'Master Upload',
        url: '#',
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        version: '4.0',
        content: 'PE-stamped engineering piping and instrumentation diagram for Concourse B Central Chiller Plant modernization.'
    },
    {
        id: 'doc-cad-anschutz',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-17',
        title: 'CU Anschutz Medical Research Surgical AHU Cleanroom Layout & Airflow Matrix.pdf',
        category: 'Blueprints & Schematics',
        type: 'Master Upload',
        url: '#',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        version: '2.0',
        content: 'Cleanroom AHU supply & return airflow balance matrix and Phoenix venturi valve submittal.'
    },
    {
        id: 'doc-singleline-coresite',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-19',
        title: 'CoreSite DNV2 Data Center Single-Line Critical Power & Chiller Plant Diagram.pdf',
        category: 'Blueprints & Schematics',
        type: 'Master Upload',
        url: '#',
        createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        version: '3.2',
        content: 'Single-line electrical and hydraulic schematic for Pod B Schneider InRow CW precision coolers.'
    },

    // --- 3. Policies & Handbooks (Policies Tab) ---
    {
        id: 'doc-policy-ashrae',
        organizationId: 'apex-org-456',
        title: 'ASHRAE 15 & 34 Safety Standard for Mechanical Refrigeration Systems',
        category: 'Policies',
        type: 'Policy',
        status: 'Active',
        url: '#',
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        version: '2026.1',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">ASHRAE 15 & 34 Mechanical Room Compliance Standard</h2>
                <p style="font-size: 13px; color: #475569;">Mandatory protocols for refrigerant monitoring, mechanical room emergency exhaust activation, breathing apparatus usage, and leak sensor calibration for A1, A2L, and B2 refrigerants.</p>
            </div>
        `
    },
    {
        id: 'doc-policy-loto',
        organizationId: 'apex-org-456',
        title: 'OSHA 1910.147 Control of Hazardous Energy (Lockout/Tagout) Corporate Protocol',
        category: 'Policies',
        type: 'Policy',
        status: 'Active',
        url: '#',
        createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
        version: '3.0',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Zero Energy Verification & Lockout/Tagout Protocol</h2>
                <p style="font-size: 13px; color: #475569;">Rigorous procedures for de-energizing 480V 3-phase industrial power, pneumatic lines, hydraulic loops, and thermal hazards prior to servicing chillers, boilers, and AHUs.</p>
            </div>
        `
    },
    {
        id: 'doc-policy-heat',
        organizationId: 'apex-org-456',
        title: 'OSHA Extreme Heat Illness Prevention & High-Temperature Rooftop Operations Mandate',
        category: 'Policies',
        type: 'Policy',
        status: 'Active',
        url: '#',
        createdAt: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
        version: '1.2',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Rooftop Thermal Safety & Hydration Mandate</h2>
                <p style="font-size: 13px; color: #475569;">Enacts mandatory 15-minute shaded rest cycles and electrolyte replenishment whenever ambient rooftop temperatures exceed 95°F.</p>
            </div>
        `
    },
    {
        id: 'doc-handbook-ops',
        organizationId: 'apex-org-456',
        title: 'Apex Mechanical & Mission-Critical Solutions Standard Operating Procedures (SOP)',
        category: 'Handbooks',
        type: 'Handbook',
        status: 'Active',
        url: '#',
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        version: '5.4',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Apex Engineering Operations Handbook</h2>
                <p style="font-size: 13px; color: #475569;">Comprehensive handbook covering standard service ticketing, digital work orders, parts procurement, fleet telematics, customer communications, and emergency dispatch escalation.</p>
            </div>
        `
    },
    {
        id: 'doc-handbook-tech',
        organizationId: 'apex-org-456',
        title: 'Commercial HVAC Journeyman & Master Technician Field Guide (2026 Edition)',
        category: 'Handbooks',
        type: 'Handbook',
        status: 'Active',
        url: '#',
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        version: '2026.2',
        content: `
            <div style="font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b;">
                <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Journeyman Field Technical Reference Guide</h2>
                <p style="font-size: 13px; color: #475569;">Reference charts for R-513A / R-1233zd(E) thermodynamic properties, VFD harmonic filter troubleshooting, BACnet MSTP baud rates, and Cleaver-Brooks combustion trim parameters.</p>
            </div>
        `
    },

    // --- 4. Templates (Templates Tab) ---
    {
        id: 'doc-template-msa',
        organizationId: 'apex-org-456',
        title: 'Commercial Mechanical Master Service Level Agreement (MSA) Blank Client Contract',
        category: 'Templates',
        type: 'Master Template',
        url: '#',
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        version: '3.0',
        content: 'Standard master agreement template with customizable emergency response tiers, hourly labor brackets, and preventative maintenance schedules.'
    },
    {
        id: 'doc-template-waiver',
        organizationId: 'apex-org-456',
        title: 'Property Access & Commercial Equipment Liability Release Form',
        category: 'Templates',
        type: 'Waiver Template',
        url: '#',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        version: '2.0',
        content: 'Customer digital waiver template for hazardous mechanical room access and pre-service diagnostic release.'
    },

    // --- 5. Tax Forms (Tax Forms Tab) ---
    {
        id: 'doc-tax-1099',
        organizationId: 'apex-org-456',
        title: 'Form 1099-NEC (Nonemployee Compensation) - Apex Master Rigging Subcontractor',
        category: 'Tax Forms',
        type: '1099-NEC',
        url: '#',
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        version: '2026',
        content: 'Tax year 1099-NEC record for commercial crane and heavy equipment rigging subcontractor payouts.'
    },
    {
        id: 'doc-tax-w9',
        organizationId: 'apex-org-456',
        title: 'Form W-9 Request for Taxpayer Identification Number - Apex Mechanical Solutions',
        category: 'Tax Forms',
        type: '1099-NEC',
        url: '#',
        createdAt: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(),
        version: '2026',
        content: 'Official corporate W-9 verification document with federal EIN and commercial mechanical contracting NAICS code 238220.'
    },

    // --- 6. Hiring Packets (Hiring Packets Tab) ---
    {
        id: 'doc-hiring-bas',
        organizationId: 'apex-org-456',
        title: 'Senior Building Automation & Niagara 4 TCP Systems Specialist Onboarding Packet',
        category: 'Hiring Packets',
        type: 'Hiring Packet',
        url: '#',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        version: '1.0',
        content: 'Complete onboarding packet: Form W-4, Form I-9, Direct Deposit, Handbook Receipt, and Niagara 4 TCP Certification Verification.'
    },
    {
        id: 'doc-hiring-ammonia',
        organizationId: 'apex-org-456',
        title: 'Industrial Ammonia Refrigeration Lead Technician Offer & Safety Packet',
        category: 'Hiring Packets',
        type: 'Hiring Packet',
        url: '#',
        createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        version: '1.0',
        content: 'Complete onboarding packet: RETA CIRO safety compliance verification, hazardous chemicals handling clearance, and emergency respirator fit test protocol.'
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
        startDate: '2026-08-01T09:00:00Z',
        endDate: '2026-10-30T17:00:00Z',
        budget: 750000,
        description: 'Complete overhaul and modernization of the central chiller plant, including two new 500-ton centrifugal chillers, Bell & Gossett variable-speed pumps, and automated BAS controls.',
        address: '1 Grand Plaza, Aspen, CO 81611',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-lead-tech-id', 'apex-tech-id', 'apex-tech-4-id'],
        projectTasks: [
            {
                id: 'pt-1',
                description: 'Phase 1: Decommission and EPA refrigerant recovery on old chiller vessels',
                status: 'Completed',
                isBenchmark: true,
                dueDate: '2026-08-15'
            },
            {
                id: 'pt-2',
                description: 'Phase 2: Equipment pad structural reinforcement & vibration isolation springs',
                status: 'In Progress',
                isBenchmark: true,
                dueDate: '2026-08-30'
            },
            {
                id: 'pt-3',
                description: 'Phase 3: Rigging crane lift & installation of new 500-ton Centravac units',
                status: 'Pending',
                isBenchmark: true,
                dueDate: '2026-09-20'
            },
            {
                id: 'pt-4',
                description: 'Phase 4: Chilled water loop hydro-test, BACnet DDC commissioning & factory startup',
                status: 'Pending',
                isBenchmark: true,
                dueDate: '2026-10-15'
            }
        ],
        createdAt: '2026-07-15T10:00:00Z'
    },
    {
        id: 'apex-project-2',
        organizationId: 'apex-org-456',
        name: 'Mile High Logistics Cold-Chain Expansion',
        customerId: 'apex-cust-3',
        customerName: 'Mile High Distribution Center',
        status: 'Planning',
        startDate: '2026-10-15T09:00:00Z',
        endDate: '2026-12-20T17:00:00Z',
        budget: 450000,
        description: 'Installation of two new high-efficiency sub-zero industrial walk-in blast freezer coils, redundant condensing units, and remote temperature telemetry.',
        address: '500 Industrial Rd, Denver, CO 80216',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-lead-tech-id', 'apex-tech-3-id'],
        projectTasks: [
            { id: 'pt2-1', description: 'Finalize engineering submittals & structural load calculations', status: 'Completed', isBenchmark: true, dueDate: '2026-09-30' },
            { id: 'pt2-2', description: 'Procure long-lead custom low-temp evaporator coils and compressors', status: 'In Progress', isBenchmark: false, dueDate: '2026-10-10' },
            { id: 'pt2-3', description: 'Refrigerant line-set braze and triple-evacuation to 250 microns', status: 'Pending', isBenchmark: true, dueDate: '2026-11-15' }
        ],
        createdAt: '2026-08-20T14:00:00Z'
    },
    {
        id: 'demo-project-1',
        organizationId: 'apex-org-456',
        name: 'Tractor Supply Retail Rooftop Retrofit',
        customerId: 'demo-cust-2',
        customerName: 'Tractor Supply - Converse, TX',
        status: 'In Progress',
        startDate: '2026-08-01T09:00:00Z',
        endDate: '2026-09-30T17:00:00Z',
        budget: 100000,
        description: 'Scheduled multi-unit rooftop packaged unit replacement with Carrier high-efficiency gas/electric units and motorized economizers.',
        address: '8318 FM 78, Converse, TX 78109',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-tech-id'],
        projectTasks: [
            { id: 'pt3-1', description: 'Curb adapter fabrication and crane mobilization', status: 'Completed', isBenchmark: true, dueDate: '2026-08-10' },
            { id: 'pt3-2', description: 'Set and secure Carrier 15-ton and 10-ton RTUs', status: 'In Progress', isBenchmark: true, dueDate: '2026-08-28' },
            { id: 'pt3-3', description: 'Gas piping tie-in, high-voltage hookup, and digital economizer calibration', status: 'Pending', isBenchmark: true, dueDate: '2026-09-15' }
        ],
        createdAt: '2026-07-01T10:00:00Z'
    },
    {
        id: 'apex-project-4',
        organizationId: 'apex-org-456',
        name: 'Alpine Peak Data Facility N+1 CRAC Upgrade',
        customerId: 'apex-cust-8',
        customerName: 'Alpine Peak Data Facility',
        status: 'In Progress',
        startDate: '2026-07-01T08:00:00Z',
        endDate: '2026-10-15T18:00:00Z',
        budget: 320000,
        description: 'Mission-critical redundancy enhancement: Installing dual Schneider Uniflair InRow chilled water precision computer room air conditioners with automated failover switching.',
        address: '6800 S Tucson Way, Centennial, CO 80112',
        managerId: 'apex-sales-manager-id',
        teamIds: ['apex-lead-tech-id', 'apex-tech-4-id'],
        projectTasks: [
            { id: 'pt4-1', description: 'Underfloor raised-floor chilled water piping loop tie-in', status: 'Completed', isBenchmark: true, dueDate: '2026-07-20' },
            { id: 'pt4-2', description: 'Position and level Uniflair InRow precision cooling units', status: 'Completed', isBenchmark: true, dueDate: '2026-08-10' },
            { id: 'pt4-3', description: 'Modbus/BACnet BMS integration and thermal load containment testing', status: 'In Progress', isBenchmark: true, dueDate: '2026-09-05' },
            { id: 'pt4-4', description: 'Simulated electrical outage failover commissioning', status: 'Pending', isBenchmark: true, dueDate: '2026-09-25' }
        ],
        createdAt: '2026-06-15T09:00:00Z'
    },
    {
        id: 'apex-project-5',
        organizationId: 'apex-org-456',
        name: 'DIA Concourse Central Chiller Plant Modernization',
        customerId: 'apex-cust-16',
        customerName: 'Denver International Airport - Concourse CUP',
        status: 'In Progress',
        startDate: '2026-05-01T08:00:00Z',
        endDate: '2026-11-30T17:00:00Z',
        budget: 1850000,
        description: 'Full replacement and BACnet automation of two 1,200-ton York centrifugal chillers, Marley cooling towers, primary-secondary variable pumping skids, and airport terminal air distribution.',
        address: '8500 Peña Blvd, Concourse B Central Utility Plant, Denver, CO 80249',
        managerId: 'apex-operations-vp-id',
        teamIds: ['apex-lead-tech-id', 'apex-tech-6-id', 'apex-tech-7-id', 'apex-tech-3-id'],
        projectTasks: [
            { id: 'pt5-1', description: 'Phase 1: Central plant demolition, EPA refrigerant recovery & containment', status: 'Completed', isBenchmark: true, dueDate: '2026-06-15' },
            { id: 'pt5-2', description: 'Phase 2: 120-Ton crane mobilization & rigging of York 1200-ton chiller vessels', status: 'Completed', isBenchmark: true, dueDate: '2026-07-20' },
            { id: 'pt5-3', description: 'Phase 3: 16-inch schedule 40 chilled water header welding & hydro-testing', status: 'In Progress', isBenchmark: true, dueDate: '2026-09-15' },
            { id: 'pt5-4', description: 'Phase 4: Automated Logic BACnet DDC commissioning & terminal flight gate airflow validation', status: 'Pending', isBenchmark: true, dueDate: '2026-11-15' }
        ],
        createdAt: '2026-04-15T09:00:00Z'
    },
    {
        id: 'apex-project-6',
        organizationId: 'apex-org-456',
        name: 'CU Anschutz Surgical AHU & ISO Cleanroom Retrofit',
        customerId: 'apex-cust-17',
        customerName: 'CU Anschutz Medical Research Campus',
        status: 'In Progress',
        startDate: '2026-06-15T08:00:00Z',
        endDate: '2026-12-15T17:00:00Z',
        budget: 920000,
        description: 'Installation of custom 40,000 CFM Haakon cleanroom air handling systems with HEPA filtration cascades, room pressure differential monitoring, and redundant exhaust air scrubbers.',
        address: '13001 E 17th Pl, Biosafety Research Tower 2, Aurora, CO 80045',
        managerId: 'apex-estimator-id',
        teamIds: ['apex-tech-4-id', 'apex-tech-7-id', 'apex-tech-3-id', 'apex-tech-5-id'],
        projectTasks: [
            { id: 'pt6-1', description: 'Phase 1: Architectural biosafety submittals & structural seismic vibration isolator engineering', status: 'Completed', isBenchmark: true, dueDate: '2026-07-10' },
            { id: 'pt6-2', description: 'Phase 2: Haakon modular cleanroom AHU sections delivery & rooftop penthouse assembly', status: 'Completed', isBenchmark: true, dueDate: '2026-08-20' },
            { id: 'pt6-3', description: 'Phase 3: Terminal HEPA bank duct connections, Phoenix venturi valves & aerosol scan', status: 'In Progress', isBenchmark: true, dueDate: '2026-10-15' },
            { id: 'pt6-4', description: 'Phase 4: ISO Class 5 particulate counting, NEBB TAB certification & CDC signoff', status: 'Pending', isBenchmark: true, dueDate: '2026-12-01' }
        ],
        createdAt: '2026-05-20T10:00:00Z'
    }
];

export const APEX_MOCK_PROPOSALS: Proposal[] = [
    {
        id: 'APEX-PROP-001',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        customerName: 'Sterling Residences',
        jobId: 'apex-job-2',
        status: 'Sent',
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
    },
    {
        id: 'APEX-PROP-003',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-16',
        customerName: 'Denver International Airport - Concourse CUP',
        jobId: 'apex-job-24',
        status: 'Sent',
        total: 285000,
        subtotal: 263279.45,
        taxAmount: 21720.55,
        createdAt: '2026-08-15T14:00:00Z',
        createdById: 'apex-sales-rep-id',
        createdByName: 'Richard King',
        technicianId: 'apex-lead-tech-id',
        selectedOption: 'Best',
        items: [
            // Good Option
            { id: 'ap3-item-1', name: 'Marley Cooling Tower VFD Retrofit (4 Cells)', description: 'ABB ACH580 Variable Frequency Inverters with bypass cabinets.', quantity: 4, price: 24000, total: 96000, type: 'Part', tier: 'Good', taxable: true },
            
            // Better Option
            { id: 'ap3-item-2', name: 'Marley VFDs + Bell & Gossett Intelligent Pump Skids', description: 'Includes 4 VFD cabinets plus dual Bell & Gossett smart secondary pump controllers.', quantity: 1, price: 178000, total: 178000, type: 'Part', tier: 'Better', taxable: true },

            // Best Option
            { id: 'ap3-item-3', name: 'Complete Turnkey CUP Variable Flow Automation Skid', description: 'Full plant integration: Marley VFDs, Bell & Gossett smart pumps, Automated Logic BACnet gateway, and 5-year mission-critical support guarantee.', quantity: 1, price: 255000, total: 255000, type: 'Part', tier: 'Best', taxable: true },
            { id: 'ap3-item-4', name: 'Master Engineering Rigging, Commissioning & Energy Modeling', quantity: 1, price: 30000, total: 30000, type: 'Labor', tier: 'Best' }
        ]
    },
    {
        id: 'APEX-PROP-004',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-17',
        customerName: 'CU Anschutz Medical Research Campus',
        jobId: 'apex-job-25',
        status: 'Accepted',
        total: 142500,
        subtotal: 131639.72,
        taxAmount: 10860.28,
        createdAt: '2026-08-18T10:30:00Z',
        createdById: 'apex-estimator-id',
        createdByName: 'Victoria Sterling',
        technicianId: 'apex-tech-4-id',
        selectedOption: 'Best',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        items: [
            { id: 'ap4-item-1', name: 'Phoenix Controls Precision Venturi Airflow Valves (x8)', quantity: 8, price: 6200, total: 49600, type: 'Part', tier: 'Good', taxable: true },
            { id: 'ap4-item-2', name: 'Phoenix Venturi Valves + Camfil Fluid-Seal Terminal HEPA Units (x16)', quantity: 1, price: 98000, total: 98000, type: 'Part', tier: 'Better', taxable: true },
            { id: 'ap4-item-3', name: 'Biosafety Level 3 Automated Airflow Containment Suite Package', description: 'Turnkey Phoenix Controls valves, Camfil Megalam HEPA terminal banks, Johnson Controls Metasys BACnet interface, and NEBB validation.', quantity: 1, price: 128000, total: 128000, type: 'Part', tier: 'Best', taxable: true },
            { id: 'ap4-item-4', name: 'Cleanroom TAB Testing, Air Balancing & CDC Compliance Certification', quantity: 1, price: 14500, total: 14500, type: 'Labor', tier: 'Best' }
        ]
    },
    {
        id: 'APEX-PROP-005',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-18',
        customerName: 'Lockheed Martin Space Systems - Cleanroom Alpha',
        jobId: 'apex-job-27',
        status: 'Sent',
        total: 168000,
        subtotal: 155196.30,
        taxAmount: 12803.70,
        createdAt: '2026-08-22T15:45:00Z',
        createdById: 'apex-lead-tech-id',
        createdByName: 'Leo Masters',
        technicianId: 'apex-lead-tech-id',
        selectedOption: null,
        items: [
            { id: 'ap5-item-1', name: 'Munters Desiccant Ultra-Low Humidity Air Dehumidifier Upgrade', quantity: 1, price: 92000, total: 92000, type: 'Part', tier: 'Good', taxable: true },
            { id: 'ap5-item-2', name: 'Munters Dehumidifier + Trane Low-Pressure Chilled Water Modulating Loop', quantity: 1, price: 135000, total: 135000, type: 'Part', tier: 'Better', taxable: true },
            { id: 'ap5-item-3', name: 'Aerospace Cleanroom High-Reliability Climate & Dewpoint Control Package', description: 'Munters Titanium rotor dehumidifier, dual bypass valves, Cleanpak laminar flow FFU grid interface, and NIST sensor calibration.', quantity: 1, price: 152000, total: 152000, type: 'Part', tier: 'Best', taxable: true },
            { id: 'ap5-item-4', name: 'Cleanroom Engineering Installation, Helium Leak-Check & Precision Commissioning', quantity: 1, price: 16000, total: 16000, type: 'Labor', tier: 'Best' }
        ]
    },
    {
        id: 'APEX-PROP-PROJ-001',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-2',
        customerName: 'Sterling Residences',
        status: 'Draft',
        total: 45000,
        subtotal: 42000,
        taxAmount: 3000,
        createdAt: '2026-06-24T10:00:00Z',
        isProjectLevel: true,
        title: 'Rooftop HVAC Replacement Project',
        laborItems: [
            { id: 'l-1', unitName: 'RTU #1', scope: 'RTU replacement labor', hours: 40, rate: 150, value: 6000 }
        ],
        partItems: [
            { id: 'p-1', unitName: 'RTU #1', partName: '15-Ton Carrier RTU', quantity: 1, vendorCost: 25000, markupPct: 20, customerUnitPrice: 30000, customerLineTotal: 30000, availability: 'In Stock' }
        ],
        allowanceItems: [
            { id: 'a-1', description: 'Crane Service mobilization', basis: 'Flat crane fee', amount: 9000 }
        ]
    },
    ...MOCK_DEMO_PROPOSALS.map(p => ({ ...p, organizationId: 'apex-org-456' }))
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
        benefits: ['4 Annual Precision Tune-ups per unit', '15% Discount on Parts & Labor', '24/7 Priority Commercial Dispatch', 'Dedicated Account Manager & Equipment Log']
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
        benefits: ['2 Annual Precision Heating & AC Tune-ups', '20% Discount on all repair services', 'Zero Diagnostic Fees', 'Indoor Air Quality Monitoring & Filter Supply']
    },
    {
        id: 'apex-plan-3',
        organizationId: 'apex-org-456',
        name: 'Industrial Chill & Cold Care',
        monthlyPrice: 1450,
        annualPrice: 16000,
        discountPercentage: 20,
        discountScope: 'Both',
        visitsPerYear: 6,
        color: '#0284c7',
        benefits: ['6 Comprehensive Refrigeration & Chiller Audits/Year', '2-Hour Emergency Response SLA', '20% Discount on Compressors, Coils & Parts', 'Annual Oil & Refrigerant Spectro-Chemical Analysis']
    },
    {
        id: 'apex-plan-4',
        organizationId: 'apex-org-456',
        name: 'Medical Clean Air Platinum',
        monthlyPrice: 1800,
        annualPrice: 20000,
        discountPercentage: 25,
        discountScope: 'Both',
        visitsPerYear: 4,
        color: '#059669',
        benefits: ['Quarterly HEPA Cleanroom Certification & Airflow Validation', 'Zero Trip/Mobilization Surcharges', '25% Discount on Specialty Filtration & VFD Controls', 'Annual Microbial Swab & Compliance Documentation']
    },
    {
        id: 'apex-plan-5',
        organizationId: 'apex-org-456',
        name: 'Enterprise Mission-Critical Master Service Agreement',
        monthlyPrice: 18500,
        annualPrice: 210000,
        discountPercentage: 30,
        discountScope: 'Both',
        visitsPerYear: 12,
        color: '#dc2626',
        benefits: [
            '24/7/365 1-Hour Mission-Critical Emergency Response SLA',
            'Monthly Comprehensive Thermal & Vibration Spectrometric Analysis',
            'Dedicated Master Mechanical Engineer & Controls Specialist Lead',
            '30% Discount on Capital Unit Replacements, Coils & Custom Parts',
            'Annual NEBB Certified Air Balancing & ASME Re-certification Included'
        ]
    },
    {
        id: 'apex-plan-6',
        organizationId: 'apex-org-456',
        name: 'Institutional Campus Facility Agreement',
        monthlyPrice: 14500,
        annualPrice: 165000,
        discountPercentage: 25,
        discountScope: 'Both',
        visitsPerYear: 12,
        color: '#0891b2',
        benefits: [
            'Monthly Central Utility Plant & High-Pressure Steam Boiler Audits',
            'Automated BAS Energy Optimization & Modulating Valve Recalibration',
            'Dedicated On-Call Crew with Direct VP of Operations Escalation',
            '25% Discount on Specialty Actuators, VFDs & Parts',
            'Zero Emergency Truck Roll or Trip Mobilization Fees'
        ]
    }
];

export const APEX_MOCK_AGREEMENTS: ServiceAgreement[] = [
    {
        id: 'SA-APEX-001',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-1',
        customerName: 'The Grand Hotel',
        planName: 'Commercial Advantage',
        price: 11200,
        billingCycle: 'Annual',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 16,
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
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 2,
        visitsRemaining: 1
    },
    {
        id: 'SA-APEX-003',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-3',
        customerName: 'Mile High Distribution Center',
        planName: 'Industrial Chill & Cold Care',
        price: 1450,
        billingCycle: 'Monthly',
        startDate: '2026-02-01',
        endDate: '2027-02-01',
        status: 'Active',
        visitsTotal: 6,
        visitsRemaining: 4
    },
    {
        id: 'SA-APEX-004',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-4',
        customerName: 'Rocky Mountain Brewery',
        planName: 'Industrial Chill & Cold Care',
        price: 1650,
        billingCycle: 'Monthly',
        startDate: '2026-01-15',
        endDate: '2027-01-15',
        status: 'Active',
        visitsTotal: 6,
        visitsRemaining: 5
    },
    {
        id: 'SA-APEX-005',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-5',
        customerName: 'Front Range Surgery Center',
        planName: 'Medical Clean Air Platinum',
        price: 1800,
        billingCycle: 'Monthly',
        startDate: '2026-03-01',
        endDate: '2027-03-01',
        status: 'Active',
        visitsTotal: 4,
        visitsRemaining: 3
    },
    {
        id: 'SA-APEX-006',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-6',
        customerName: 'Denver Tech Logistics Hub',
        planName: 'Commercial Advantage',
        price: 249,
        billingCycle: 'Monthly',
        startDate: '2026-02-15',
        endDate: '2027-02-15',
        status: 'Active',
        visitsTotal: 4,
        visitsRemaining: 3
    },
    {
        id: 'SA-APEX-007',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-7',
        customerName: 'Highlands Luxury Lofts HOA',
        planName: 'Commercial Advantage',
        price: 498,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 8,
        visitsRemaining: 6
    },
    {
        id: 'SA-APEX-008',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-8',
        customerName: 'Alpine Peak Data Facility',
        planName: 'Industrial Chill & Cold Care',
        price: 2900,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 9
    },
    {
        id: 'SA-APEX-009',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-16',
        customerName: 'Denver International Airport - Concourse CUP',
        planName: 'Enterprise Mission-Critical Master Service Agreement',
        price: 18500,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 8
    },
    {
        id: 'SA-APEX-010',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-17',
        customerName: 'CU Anschutz Medical Research Campus',
        planName: 'Medical Clean Air Platinum',
        price: 16200,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 9
    },
    {
        id: 'SA-APEX-011',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-18',
        customerName: 'Lockheed Martin Space Systems - Cleanroom Alpha',
        planName: 'Enterprise Mission-Critical Master Service Agreement',
        price: 14500,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 10
    },
    {
        id: 'SA-APEX-012',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-19',
        customerName: 'CoreSite DNV2 Enterprise Data Center',
        planName: 'Enterprise Mission-Critical Master Service Agreement',
        price: 12800,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 7
    },
    {
        id: 'SA-APEX-013',
        organizationId: 'apex-org-456',
        customerId: 'apex-cust-20',
        customerName: 'The Broadmoor Resort & International Center',
        planName: 'Institutional Campus Facility Agreement',
        price: 14500,
        billingCycle: 'Monthly',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        status: 'Active',
        visitsTotal: 12,
        visitsRemaining: 8
    }
];

export const APEX_MOCK_INVENTORY: InventoryItem[] = [
    {
        id: 'inv-1',
        organizationId: 'apex-org-456',
        name: 'Copeland 15-Ton Discus Semi-Hermetic Compressor',
        sku: 'COP-4DA3-1500',
        barcode: 'INV-COP-15T',
        category: 'Compressors',
        quantity: 4,
        minQuantity: 2,
        cost: 3200,
        price: 5100,
        location: 'Warehouse - Bay 3B Heavy Skids',
        lastUpdated: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-2',
        organizationId: 'apex-org-456',
        name: 'Belimo AFB24-SR Spring Return Modulating Actuator (24V)',
        sku: 'BEL-AFB24-SR',
        barcode: 'INV-BEL-24SR',
        category: 'Controls & Actuators',
        quantity: 28,
        minQuantity: 10,
        cost: 285,
        price: 485,
        location: 'Warehouse - Shelf A-12',
        lastUpdated: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-3',
        organizationId: 'apex-org-456',
        name: 'Danfoss VLT HVAC Drive Inverter 30-HP 480V 3-Phase',
        sku: 'DAN-VLT-FC102',
        barcode: 'INV-DAN-30HP',
        category: 'Drives & VFDs',
        quantity: 3,
        minQuantity: 1,
        cost: 5800,
        price: 11200,
        location: 'Warehouse - Electronics Secure Cage',
        lastUpdated: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-4',
        organizationId: 'apex-org-456',
        name: 'Camfil Megalam ISO Class 5 Terminal Cleanroom HEPA Filter',
        sku: 'CAM-MEG-2424',
        barcode: 'INV-CAM-HEPA',
        category: 'Filtration',
        quantity: 32,
        minQuantity: 12,
        cost: 520,
        price: 1150,
        location: 'Cleanroom Staging Room C',
        lastUpdated: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-5',
        organizationId: 'apex-org-456',
        name: 'Trane CenTraVac RuptureGuard Low-Pressure Rupture Disc Assembly',
        sku: 'TRN-RD-600C',
        barcode: 'INV-TRN-RUPT',
        category: 'Chiller Specialty',
        quantity: 6,
        minQuantity: 2,
        cost: 1100,
        price: 2450,
        location: 'Van #101 Stock - Leo Masters',
        lastUpdated: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-6',
        organizationId: 'apex-org-456',
        name: 'Grundfos Magna3 Stainless Mechanical Shaft Seal Kit',
        sku: 'GRN-SEAL-984',
        barcode: 'INV-GRN-SEAL',
        category: 'Pumps & Hydronics',
        quantity: 8,
        minQuantity: 3,
        cost: 640,
        price: 1420,
        location: 'Van #107 Stock - Brett Anderson',
        lastUpdated: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-7',
        organizationId: 'apex-org-456',
        name: 'Sporlan SERI-F Electric Expansion Valve & Step Motor',
        sku: 'SPOR-EEV-88',
        barcode: 'INV-SPOR-EEV',
        category: 'Refrigeration Valves',
        quantity: 12,
        minQuantity: 4,
        cost: 340,
        price: 780,
        location: 'Warehouse - Shelf B-04',
        lastUpdated: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-8',
        organizationId: 'apex-org-456',
        name: 'Automated Logic BACnet IP WebCTRL Router Node',
        sku: 'ALC-LGR-BAC',
        barcode: 'INV-ALC-ROUTER',
        category: 'Controls & Actuators',
        quantity: 6,
        minQuantity: 2,
        cost: 890,
        price: 1850,
        location: 'Van #103 Stock - Marcus Brody',
        lastUpdated: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-9',
        organizationId: 'apex-org-456',
        name: 'Honeywell ControLinks Servo Actuator & UV Flame Scanner',
        sku: 'HON-ML-7984',
        barcode: 'INV-HON-BOILER',
        category: 'Boiler & Steam',
        quantity: 5,
        minQuantity: 2,
        cost: 1450,
        price: 2850,
        location: 'Van #107 Stock - Brett Anderson',
        lastUpdated: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-10',
        organizationId: 'apex-org-456',
        name: 'Fluke 1587 FC 2-in-1 Insulation Multimeter Kit',
        sku: 'FLK-1587-FC',
        barcode: 'INV-FLK-1587',
        category: 'Testing & Diagnostics',
        quantity: 7,
        minQuantity: 3,
        cost: 780,
        price: 1450,
        location: 'Tool Crib - Calibration Locker',
        lastUpdated: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-11',
        organizationId: 'apex-org-456',
        name: 'Carrier Infinity Touch Wi-Fi Commercial Thermostat SYSTXCCITC01',
        sku: 'CAR-INF-TOUCH',
        barcode: 'INV-CAR-TOUCH',
        category: 'Thermostats & Sensors',
        quantity: 14,
        minQuantity: 5,
        cost: 380,
        price: 750,
        location: 'Warehouse - Shelf A-02',
        lastUpdated: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inv-12',
        organizationId: 'apex-org-456',
        name: 'High-Pressure Nitrogen Regulator 0-800 PSI Braze Skid',
        sku: 'REG-NIT-800',
        barcode: 'INV-NIT-REG',
        category: 'Tools & Equipment',
        quantity: 8,
        minQuantity: 3,
        cost: 240,
        price: 495,
        location: 'Warehouse - Gas Dock Rack 1',
        lastUpdated: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_CYLINDERS: RefrigerantCylinder[] = [
    {
        id: 'cyl-1',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-513A-01',
        type: 'R-513A (Opteon XP10)',
        status: 'In Use',
        totalWeight: 125,
        remainingWeight: 92,
        assignedTechId: 'apex-lead-tech-id',
        createdAt: '2026-01-10T08:00:00Z'
    },
    {
        id: 'cyl-2',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-410A-04',
        type: 'R-410A Puron',
        status: 'In Use',
        totalWeight: 125,
        remainingWeight: 68,
        assignedTechId: 'apex-tech-5-id',
        createdAt: '2026-02-01T09:00:00Z'
    },
    {
        id: 'cyl-3',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-134A-08',
        type: 'R-134a Industrial Low-Temp',
        status: 'In Use',
        totalWeight: 125,
        remainingWeight: 110,
        assignedTechId: 'apex-tech-2-id',
        createdAt: '2026-01-15T11:00:00Z'
    },
    {
        id: 'cyl-4',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-REC-99',
        type: 'Recovery Cylinder (Certified NDT Reclaim)',
        status: 'In Use',
        totalWeight: 250,
        remainingWeight: 184,
        assignedTechId: 'apex-lead-tech-id',
        createdAt: '2026-03-05T14:00:00Z'
    },
    {
        id: 'cyl-5',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-NIT-02',
        type: 'High-Purity Dry Nitrogen (Industrial Grade)',
        status: 'Full',
        totalWeight: 80,
        remainingWeight: 80,
        assignedTechId: 'apex-tech-4-id',
        createdAt: '2026-02-18T10:00:00Z'
    },
    {
        id: 'cyl-6',
        organizationId: 'apex-org-456',
        tag: 'DOT-EPA-513A-02',
        type: 'R-513A (Opteon XP10)',
        status: 'Full',
        totalWeight: 125,
        remainingWeight: 125,
        assignedTechId: 'apex-operations-vp-id',
        createdAt: '2026-03-12T16:00:00Z'
    }
];

export const APEX_MOCK_REF_TRANSACTIONS: RefrigerantTransaction[] = [
    {
        id: 'ref-tx-1',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        action: 'Recovery',
        cylinderId: 'cyl-4',
        amount: 142,
        notes: 'EPA recovery from York 1200-Ton Centravac Chiller during DIA Concourse B overhaul. Hydro-tested at 250 microns.',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'ref-tx-2',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        action: 'Addition / Charge',
        cylinderId: 'cyl-2',
        amount: 28,
        notes: 'CoreSite DNV2 Data Center - InRow CRAC #4 circuit recharge post inverter service. Operating at 12°F subcooling.',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'ref-tx-3',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        action: 'Recovery',
        cylinderId: 'cyl-3',
        amount: 45,
        notes: 'Grand Hotel Chiller retrofit Phase 1 - temporary bypass recovery.',
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'ref-tx-4',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        action: 'Disposal / Reclaim Depot Transfer',
        cylinderId: 'cyl-4',
        amount: 184,
        notes: 'Delivered to Airgas Reclaim Depot for ARI-700 purity fractional distillation.',
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'ref-tx-5',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        action: 'Addition / Charge',
        cylinderId: 'cyl-1',
        amount: 33,
        notes: 'Rocky Mountain Brewery glycol header tie-in commissioning.',
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'ref-tx-6',
        organizationId: 'apex-org-456',
        date: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        action: 'Leak Check & Top-Off',
        cylinderId: 'cyl-2',
        amount: 14,
        notes: 'CU Anschutz Surgical AHU 3-way modulating valve seal replacement and charge trim.',
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_CAMPAIGNS: MarketingCampaign[] = [
    {
        id: 'camp-1',
        organizationId: 'apex-org-456',
        name: 'Google Ads - Commercial Chiller & Boiler Maintenance Denver',
        platform: 'Google Ads',
        startDate: '2026-01-01',
        endDate: null,
        spend: 8450,
        status: 'Active',
        impressions: 42800,
        clicks: 1840
    },
    {
        id: 'camp-2',
        organizationId: 'apex-org-456',
        name: 'LinkedIn Sponsored - Mission-Critical Data Center Cooling SLAs',
        platform: 'Other',
        startDate: '2026-02-01',
        endDate: null,
        spend: 5200,
        status: 'Active',
        impressions: 28400,
        clicks: 820
    },
    {
        id: 'camp-3',
        organizationId: 'apex-org-456',
        name: 'Meta Ads - Commercial VRF & Clean Air Systems Retrofit',
        platform: 'Meta Ads',
        startDate: '2026-01-15',
        endDate: null,
        spend: 3600,
        status: 'Active',
        impressions: 64100,
        clicks: 1410
    },
    {
        id: 'camp-4',
        organizationId: 'apex-org-456',
        name: 'Direct Email - Q1 Healthcare Biosafety Cleanroom Compliance',
        platform: 'Email',
        startDate: '2026-01-10',
        endDate: '2026-02-28',
        spend: 1250,
        status: 'Ended',
        impressions: 8900,
        clicks: 940
    },
    {
        id: 'camp-5',
        organizationId: 'apex-org-456',
        name: 'Google Local Services - 24/7 Industrial Refrigeration Emergency Call',
        platform: 'Google Ads',
        startDate: '2026-02-10',
        endDate: null,
        spend: 6800,
        status: 'Active',
        impressions: 31500,
        clicks: 1220
    }
];

export const APEX_MOCK_INCIDENTS: IncidentReport[] = [
    {
        id: 'inc-1',
        organizationId: 'apex-org-456',
        reporterId: 'apex-lead-tech-id',
        reporterName: 'Leo Masters',
        date: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        type: 'Injury',
        description: 'Minor knuckle laceration while aligning York chiller end-bell gasket. First aid kit administered on site.',
        status: 'Resolved',
        resolutionNotes: 'Employee treated with sterile wash and bandage. Returned to work immediately. Zero lost days. Kevlar gloves mandatory for all gasket work.',
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inc-2',
        organizationId: 'apex-org-456',
        reporterId: 'apex-operations-vp-id',
        reporterName: 'Valerie Vance',
        date: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        type: 'Other',
        description: 'High heat advisory protocol implemented for rooftop chiller servicing (ambient temp 98°F).',
        status: 'Resolved',
        resolutionNotes: 'Mandatory 15-minute shaded hydration breaks enacted per OSHA Heat Illness Prevention standards.',
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'inc-3',
        organizationId: 'apex-org-456',
        reporterId: 'apex-tech-6-id',
        reporterName: 'Brett Anderson',
        date: new Date(Date.now() - 32 * 24 * 3600 * 1000).toISOString(),
        type: 'Property Damage',
        description: 'Rigging tag-line snagged temporary protective plywood during chiller crane lift. Plywood replaced.',
        status: 'Resolved',
        resolutionNotes: 'Stop-work authority exercised, tag-line re-routed. Chiller undamaged. Safety review completed with crane operator.',
        createdAt: new Date(Date.now() - 32 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_PART_ORDERS: PartOrder[] = [
    {
        id: 'po-101',
        organizationId: 'apex-org-456',
        jobId: 'apex-job-24',
        parts: 'York 1200-Ton Centravac Chiller OEM Condenser Tube Bundle (520 Copper-Nickel Tubes)',
        cost: 28900,
        status: 'Received',
        orderedBy: 'Leo Masters',
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'po-102',
        organizationId: 'apex-org-456',
        jobId: 'apex-job-25',
        parts: 'Camfil Megalam ISO Class 5 Fluid-Seal Terminal HEPA Filter Cartridges (12-pack)',
        cost: 13800,
        status: 'Received',
        orderedBy: 'Sam Rivera',
        createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'po-103',
        organizationId: 'apex-org-456',
        jobId: 'apex-job-26',
        parts: 'Schneider InRow CW Variable-Speed EC Fan Modules & Modulating 3-Way Control Valves',
        cost: 28400,
        status: 'Received',
        orderedBy: 'Frank Fisher',
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'po-104',
        organizationId: 'apex-org-456',
        jobId: 'apex-job-31',
        parts: 'Danfoss VLT HVAC Drive Inverter 30-HP Commercial Module & Active Harmonic Filter',
        cost: 11200,
        status: 'Received',
        orderedBy: 'Marcus Brody',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
        id: 'po-105',
        organizationId: 'apex-org-456',
        jobId: 'apex-job-35',
        parts: 'Grundfos Magna3 Variable-Speed Stainless Industrial Circulation Pumps (Lead/Lag Pair)',
        cost: 12800,
        status: 'In Transit',
        orderedBy: 'Brett Anderson',
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    }
];

export const APEX_MOCK_BIDS: Bid[] = [
    {
        id: 'bid-1',
        organizationId: 'apex-org-456',
        title: 'Cherry Creek Regional Medical Pavilion - Central Utility Plant Mechanical RFP',
        agency: 'HealthONE Hospital System',
        solicitationNumber: 'RFP-HONE-2026-08',
        dueDate: '2026-10-15',
        status: 'Submitted',
        requirements: [
            'Turnkey replacement of dual 750-ton centrifugal chillers with magnetic levitation compressors',
            'Full BACnet IP supervisory DDC integration with existing hospital Metasys BMS',
            'Mandatory 24/7 temporary backup cooling skid during changeout period',
            'ASME Section VIII pressure vessel certification and ASHRAE 170 compliance'
        ],
        deliverables: [
            'Mechanical engineering stamped drawings',
            'Equipment schedule & submittals',
            'Seismic vibration isolation engineering analysis',
            'NEBB certified testing, adjusting and balancing (TAB) report'
        ],
        summary: 'Competitive mechanical proposal for central utility plant modernization supporting 140-bed surgical tower.',
        totalValue: 485000,
        paymentStatus: 'Paid',
        files: [],
        createdAt: '2026-08-01T10:00:00Z'
    },
    {
        id: 'bid-2',
        organizationId: 'apex-org-456',
        title: 'RTD FasTracks Commuter Rail Maintenance Facility - Infrared Radiant & Make-Up Air Unit Modernization',
        agency: 'Regional Transportation District (RTD)',
        solicitationNumber: 'SOL-RTD-8821',
        dueDate: '2026-11-01',
        status: 'Analyzing',
        requirements: [
            'Installation of 18 high-efficiency gas-fired low-intensity infrared radiant tube heaters in train maintenance bay',
            'Two 30,000 CFM indirect gas-fired make-up air units with automated carbon monoxide and nitrogen dioxide sensors'
        ],
        summary: 'Public transit maintenance depot mechanical heating and ventilation infrastructure upgrade.',
        totalValue: 320000,
        paymentStatus: 'Pending',
        files: [],
        createdAt: '2026-08-20T14:00:00Z'
    },
    {
        id: 'bid-3',
        organizationId: 'apex-org-456',
        title: 'Denver Water Central Treatment Operations - High-Capacity Variable Frequency Pumping Skid Retrofit',
        agency: 'Denver Board of Water Commissioners',
        solicitationNumber: 'DW-ENG-2026-44',
        dueDate: '2026-11-20',
        status: 'Costing',
        requirements: [
            'Complete turnkey skid fabrication of dual 100-HP split-case booster pumps with ABB ACH580 VFDs',
            'Stainless steel headers, magnetic flow meters, and Allen-Bradley PLC automation interface'
        ],
        summary: 'Municipal water distribution high-reliability pumping station upgrade.',
        totalValue: 640000,
        paymentStatus: 'Pending',
        files: [],
        createdAt: '2026-09-01T09:00:00Z'
    }
];

export const APEX_MOCK_APPLICANTS: Applicant[] = [
    {
        id: 'app-ent-1',
        organizationId: 'apex-org-456',
        firstName: 'David',
        lastName: 'Hensley',
        name: 'David Hensley',
        email: 'd.hensley@rockymtncontrols.demo',
        phone: '(303) 890-4411',
        status: 'Interviewing',
        position: 'Senior Building Automation & Niagara 4 Controls Specialist',
        appliedDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        applicationDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        notes: 'Exceptional background in Niagara 4 TCP, BACnet IP networks, and Automated Logic WebCTRL. Completed second round interview with Valerie Vance.',
        experienceYears: 9,
        resumeFileName: 'David_Hensley_BAS_Controls_Resume.pdf'
    },
    {
        id: 'app-ent-2',
        organizationId: 'apex-org-456',
        firstName: 'Sofia',
        lastName: 'Morales',
        name: 'Sofia Morales',
        email: 'sofia.morales@precisionair.demo',
        phone: '(303) 772-1088',
        status: 'Interviewing',
        position: 'Cleanroom Biosafety TAB / NEBB Certified Test & Balance Specialist',
        appliedDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        applicationDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        notes: 'NEBB Certified TAB Professional with 7 years specializing in pharmaceutical cleanrooms and hospital vivariums. References verified.',
        experienceYears: 7,
        resumeFileName: 'Sofia_Morales_NEBB_TAB_CV.pdf'
    },
    {
        id: 'app-ent-3',
        organizationId: 'apex-org-456',
        firstName: 'Marcus',
        lastName: 'Vance Jr.',
        name: 'Marcus Vance Jr.',
        email: 'm.vance.jr@coloradoindustrial.demo',
        phone: '(303) 441-9988',
        status: 'Hired',
        position: 'Journeyman Industrial Chiller & Ammonia Refrigeration Technician',
        appliedDate: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        applicationDate: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        notes: 'Offer letter signed. Start date set for October 1st. RETA CARO certified and OSHA 30 certified.',
        experienceYears: 6,
        resumeFileName: 'Marcus_Vance_Refrigeration_Resume.pdf'
    },
    {
        id: 'app-ent-4',
        organizationId: 'apex-org-456',
        firstName: 'Tyler',
        lastName: 'Brooks',
        name: 'Tyler Brooks',
        email: 'tbrooks@highplainsmech.demo',
        phone: '(303) 552-3311',
        status: 'New',
        position: 'Senior Commercial Mechanical Estimator & Project Controls Engineer',
        appliedDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        applicationDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        notes: 'Strong experience bidding multi-million dollar mechanical engineering packages using FastPIPE and Trimble AutoBid.',
        experienceYears: 8,
        resumeFileName: 'Tyler_Brooks_Estimating_Resume.pdf'
    }
];

export const APEX_MOCK_APPOINTMENTS: Appointment[] = [
    {
        id: 'apt-1',
        organizationId: 'apex-org-456',
        customerName: 'Denver International Airport - Concourse CUP',
        customerPhone: '(303) 342-2000',
        customerEmail: 'marcus.vance@flydenver.demo',
        address: '8500 Peña Blvd, Concourse B Central Utility Plant, Denver, CO 80249',
        city: 'Denver',
        state: 'CO',
        zip: '80249',
        appointmentDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        timeSlot: '08:00 AM - 12:00 PM',
        serviceType: 'Chiller Plant Semi-Annual Vibration Sweep',
        status: 'Scheduled',
        notes: 'Check in with airport operations at Gate 4. TSA escorts required.',
        assignedTechId: 'apex-lead-tech-id',
        assignedTechName: 'Leo Masters',
        createdAt: new Date().toISOString()
    },
    {
        id: 'apt-2',
        organizationId: 'apex-org-456',
        customerName: 'CU Anschutz Medical Research Campus',
        customerPhone: '(303) 724-5000',
        customerEmail: 'sarah.lin@cuanschutz.demo',
        address: '13001 E 17th Pl, Biosafety Research Tower 2, Aurora, CO 80045',
        city: 'Aurora',
        state: 'CO',
        zip: '80045',
        appointmentDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        timeSlot: '09:00 AM - 01:00 PM',
        serviceType: 'BSL-3 Negative Pressure Differential Validation',
        status: 'Scheduled',
        notes: 'Cleanroom gowning protocol strictly enforced.',
        assignedTechId: 'apex-tech-4-id',
        assignedTechName: 'Sam Rivera',
        createdAt: new Date().toISOString()
    },
    {
        id: 'apt-3',
        organizationId: 'apex-org-456',
        customerName: 'CoreSite DNV2 Enterprise Data Center',
        customerPhone: '(303) 405-1000',
        customerEmail: 'david.ramirez@coresite.demo',
        address: '910 15th St, Mission Critical Level 3, Denver, CO 80202',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        appointmentDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
        timeSlot: '10:00 AM - 02:00 PM',
        serviceType: 'Schneider InRow Precision Cooling Preventative Check',
        status: 'Scheduled',
        notes: 'Server hall Pod B access credentials approved.',
        assignedTechId: 'apex-tech-3-id',
        assignedTechName: 'Marcus Brody',
        createdAt: new Date().toISOString()
    },
    {
        id: 'apt-4',
        organizationId: 'apex-org-456',
        customerName: 'The Broadmoor Resort & International Center',
        customerPhone: '(719) 577-5775',
        customerEmail: 'robert.p@broadmoor.demo',
        address: '1 Lake Ave, Central Engineering Complex, Colorado Springs, CO 80906',
        city: 'Colorado Springs',
        state: 'CO',
        zip: '80906',
        appointmentDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        timeSlot: '08:00 AM - 04:00 PM',
        serviceType: 'Cleaver-Brooks Steam Boiler Safety Interlock Test',
        status: 'Scheduled',
        notes: 'State boiler inspector on site at 10:00 AM.',
        assignedTechId: 'apex-tech-6-id',
        assignedTechName: 'Brett Anderson',
        createdAt: new Date().toISOString()
    },
    {
        id: 'apt-5',
        organizationId: 'apex-org-456',
        customerName: 'The Grand Hotel',
        customerPhone: '(555) 300-1000',
        customerEmail: 'charles@grandhotel.demo',
        address: '1 Grand Plaza, Aspen, CO 81611',
        city: 'Aspen',
        state: 'CO',
        zip: '81611',
        appointmentDate: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
        timeSlot: '09:00 AM - 01:00 PM',
        serviceType: 'Central Chiller Plant Rigging Crane Coordination Meeting',
        status: 'Scheduled',
        notes: 'Meeting with Charles Montgomery and rigging crew supervisor.',
        assignedTechId: 'apex-lead-tech-id',
        assignedTechName: 'Leo Masters',
        createdAt: new Date().toISOString()
    }
];

/**
 * Dynamic Rolling Date Generator for Demo Environments
 * Ensures all jobs, invoices, documents, appointments, agreements, projects,
 * users, expenses, and compliance records have live rolling dates relative to Date.now().
 * Nothing is ever expired, overdue, archived, or filtered out.
 */
export function getDynamicApexDemoData(targetOrgId: string = 'apex-org-456', baseTime: number = Date.now()) {
    const orgId = targetOrgId;
    const now = new Date(baseTime);

    // 1. Organization
    const org: Organization = {
        ...APEX_MOCK_ORG,
        id: orgId,
        updatedAt: now.toISOString()
    };

    // 2. Staff Profiles (always active in the last 5-30 mins for activeTechnicians count)
    const users: User[] = APEX_MOCK_USERS.map((u, i) => ({
        ...u,
        id: orgId === 'apex-org-456' ? u.id : `${orgId}-${u.id}`,
        organizationId: orgId,
        email: orgId === 'apex-org-456' ? u.email : `${u.username}@${orgId}.demo`,
        lastLoginAt: new Date(baseTime - (i * 3 + 4) * 60 * 1000).toISOString(),
        lastLocationUpdate: new Date(baseTime - (i * 2 + 2) * 60 * 1000).toISOString(),
        status: 'Active',
        archived: false
    }));

    // 3. Customers
    const customers: Customer[] = APEX_MOCK_CUSTOMERS.map(c => ({
        ...c,
        id: orgId === 'apex-org-456' ? c.id : `${orgId}-${c.id}`,
        organizationId: orgId
    }));

    // 4. Jobs & Invoices (Strategic distribution across today, tomorrow, this week, and current month)
    const jobs: Job[] = APEX_MOCK_JOBS.map((j, i) => {
        const jobId = orgId === 'apex-org-456' ? j.id : `${orgId}-${j.id}`;
        const custId = orgId === 'apex-org-456' ? j.customerId : `${orgId}-${j.customerId}`;
        const techId = j.assignedTechnicianId ? (orgId === 'apex-org-456' ? j.assignedTechnicianId : `${orgId}-${j.assignedTechnicianId}`) : null;
        const crew = j.assignedCrew ? j.assignedCrew.map(tid => orgId === 'apex-org-456' ? tid : `${orgId}-${tid}`) : undefined;

        let appointmentTime: string;
        let jobStatus = j.jobStatus;
        let completedAt: string | undefined = undefined;
        let createdAt: string;

        if (j.id === 'apex-job-2') {
            // High priority job: In Progress right now
            appointmentTime = new Date(baseTime - 1 * 3600 * 1000).toISOString();
            createdAt = new Date(baseTime - 3 * 3600 * 1000).toISOString();
            jobStatus = 'In Progress';
        } else if (i === 0 || i === 15 || i === 24) {
            // Scheduled for TODAY (at 9am, 1pm, 3pm)
            const hoursOffset = (i === 0 ? 1 : (i === 15 ? 3 : 5));
            appointmentTime = new Date(baseTime + hoursOffset * 3600 * 1000).toISOString();
            createdAt = new Date(baseTime - 24 * 3600 * 1000).toISOString();
            jobStatus = 'Scheduled';
        } else if (i === 3 || i === 5 || i === 8 || i === 12) {
            // Scheduled for TOMORROW
            const hour = 9 + (i % 4) * 2;
            const tomorrow = new Date(baseTime + 24 * 3600 * 1000);
            tomorrow.setHours(hour, 0, 0, 0);
            appointmentTime = tomorrow.toISOString();
            createdAt = new Date(baseTime - 24 * 3600 * 1000).toISOString();
            jobStatus = 'Scheduled';
        } else if (i === 6 || i === 9 || i === 14 || i === 20) {
            // Scheduled for UPCOMING DAYS (Day +2 to Day +6)
            const daysOut = (i % 5) + 2;
            appointmentTime = new Date(baseTime + daysOut * 86400000).toISOString();
            createdAt = new Date(baseTime - 48 * 3600 * 1000).toISOString();
            jobStatus = 'Scheduled';
        } else if (i === 1 || i === 4 || i === 7) {
            // Completed YESTERDAY (Day -1)
            const pastTime = new Date(baseTime - 1 * 86400000);
            appointmentTime = pastTime.toISOString();
            completedAt = pastTime.toISOString();
            createdAt = new Date(baseTime - 3 * 86400000).toISOString();
            jobStatus = 'Completed';
        } else if (i === 10 || i === 11 || i === 13) {
            // Completed 2-3 DAYS AGO (in current work week for DailyBriefing!)
            const pastDays = (i % 2) + 2;
            const pastTime = new Date(baseTime - pastDays * 86400000);
            appointmentTime = pastTime.toISOString();
            completedAt = pastTime.toISOString();
            createdAt = new Date(baseTime - (pastDays + 2) * 86400000).toISOString();
            jobStatus = 'Completed';
        } else {
            // Completed EARLIER THIS MONTH (5 to 25 days ago)
            const pastDays = 5 + ((i * 3) % 20);
            const pastTime = new Date(baseTime - pastDays * 86400000);
            appointmentTime = pastTime.toISOString();
            completedAt = pastTime.toISOString();
            createdAt = new Date(baseTime - (pastDays + 3) * 86400000).toISOString();
            jobStatus = 'Completed';
        }

        const invoice = j.invoice ? {
            ...j.invoice,
            paidDate: j.invoice.status === 'Paid' ? (completedAt || appointmentTime) : undefined,
            dueDate: j.invoice.status === 'Unpaid' ? new Date(baseTime + 30 * 86400000).toISOString() : undefined
        } : undefined;

        return {
            ...j,
            id: jobId,
            organizationId: orgId,
            customerId: custId,
            assignedTechnicianId: techId,
            assignedCrew: crew,
            appointmentTime,
            completedAt,
            completionDate: completedAt,
            createdAt,
            jobStatus,
            archived: false,
            deleted: false,
            invoice
        };
    });

    // 5. Documents (18 enterprise documents spanning all 6 tabs)
    const documents: BusinessDocument[] = APEX_MOCK_DOCUMENTS.map((d, i) => ({
        ...d,
        id: orgId === 'apex-org-456' ? d.id : `${orgId}-${d.id}`,
        organizationId: orgId,
        customerId: d.customerId ? (orgId === 'apex-org-456' ? d.customerId : `${orgId}-${d.customerId}`) : undefined,
        jobId: d.jobId ? (orgId === 'apex-org-456' ? d.jobId : `${orgId}-${d.jobId}`) : undefined,
        createdAt: new Date(baseTime - (i * 18 + 2) * 3600 * 1000).toISOString(),
        updatedAt: now.toISOString(),
        archived: false
    }));

    // 6. Appointments (5 upcoming commercial dispatch appointments)
    const appointments: Appointment[] = APEX_MOCK_APPOINTMENTS.map((apt, i) => {
        const aptDate = new Date(baseTime + (i + 1) * 86400000);
        aptDate.setHours(9 + (i % 3) * 2, 0, 0, 0);
        return {
            ...apt,
            id: orgId === 'apex-org-456' ? apt.id : `${orgId}-${apt.id}`,
            organizationId: orgId,
            assignedTechId: apt.assignedTechId ? (orgId === 'apex-org-456' ? apt.assignedTechId : `${orgId}-${apt.assignedTechId}`) : undefined,
            appointmentDate: aptDate.toISOString(),
            createdAt: new Date(baseTime - 2 * 86400000).toISOString(),
            status: 'Scheduled',
            archived: false
        };
    });

    // 7. Proposals (15 proposals with future validUntil dates)
    const proposals: Proposal[] = APEX_MOCK_PROPOSALS.map((p, i) => ({
        ...p,
        id: orgId === 'apex-org-456' ? p.id : `${orgId}-${p.id}`,
        organizationId: orgId,
        customerId: orgId === 'apex-org-456' ? p.customerId : `${orgId}-${p.customerId}`,
        jobId: p.jobId ? (orgId === 'apex-org-456' ? p.jobId : `${orgId}-${p.jobId}`) : undefined,
        technicianId: p.technicianId ? (orgId === 'apex-org-456' ? p.technicianId : `${orgId}-${p.technicianId}`) : undefined,
        createdAt: new Date(baseTime - (i * 2 + 1) * 86400000).toISOString(),
        validUntil: new Date(baseTime + 45 * 86400000).toISOString(),
        archived: false
    }));

    // 8. Projects (6 capital projects actively in progress)
    const projects: Project[] = APEX_MOCK_PROJECTS.map((pr, i) => ({
        ...pr,
        id: orgId === 'apex-org-456' ? pr.id : `${orgId}-${pr.id}`,
        organizationId: orgId,
        customerId: orgId === 'apex-org-456' ? pr.customerId : `${orgId}-${pr.customerId}`,
        managerId: pr.managerId ? (orgId === 'apex-org-456' ? pr.managerId : `${orgId}-${pr.managerId}`) : undefined,
        teamIds: pr.teamIds ? pr.teamIds.map(tid => orgId === 'apex-org-456' ? tid : `${orgId}-${tid}`) : undefined,
        startDate: new Date(baseTime - (i * 5 + 20) * 86400000).toISOString(),
        endDate: new Date(baseTime + (90 + i * 15) * 86400000).toISOString(),
        projectTasks: pr.projectTasks ? pr.projectTasks.map((t, ti) => {
            const taskDays = (ti === 0 ? -10 : (ti === 1 ? 5 : (ti === 2 ? 25 : 60)));
            return {
                ...t,
                dueDate: new Date(baseTime + taskDays * 86400000).toISOString().split('T')[0]
            };
        }) : undefined,
        createdAt: new Date(baseTime - 30 * 86400000).toISOString(),
        archived: false
    }));

    // 9. Membership Plans & Agreements
    const membershipPlans: MembershipPlan[] = APEX_MOCK_PLANS.map(pl => ({
        ...pl,
        id: orgId === 'apex-org-456' ? pl.id : `${orgId}-${pl.id}`,
        organizationId: orgId
    }));

    const serviceAgreements: ServiceAgreement[] = APEX_MOCK_AGREEMENTS.map((a, i) => ({
        ...a,
        id: orgId === 'apex-org-456' ? a.id : `${orgId}-${a.id}`,
        organizationId: orgId,
        customerId: orgId === 'apex-org-456' ? a.customerId : `${orgId}-${a.customerId}`,
        startDate: new Date(baseTime - 45 * 86400000).toISOString(),
        endDate: new Date(baseTime + 320 * 86400000).toISOString(),
        nextServiceDate: new Date(baseTime + (i * 4 + 7) * 86400000).toISOString(),
        status: 'Active'
    }));

    // 10. Heavy Industrial Inventory
    const inventory: InventoryItem[] = APEX_MOCK_INVENTORY.map(item => ({
        ...item,
        id: orgId === 'apex-org-456' ? item.id : `${orgId}-${item.id}`,
        organizationId: orgId
    }));

    // 11. EPA Refrigerant Cylinders & Transactions
    const refrigerantCylinders: RefrigerantCylinder[] = APEX_MOCK_CYLINDERS.map(cyl => ({
        ...cyl,
        id: orgId === 'apex-org-456' ? cyl.id : `${orgId}-${cyl.id}`,
        organizationId: orgId,
        assignedTechId: cyl.assignedTechId ? (orgId === 'apex-org-456' ? cyl.assignedTechId : `${orgId}-${cyl.assignedTechId}`) : undefined,
        lastInspectionDate: new Date(baseTime - 7 * 86400000).toISOString()
    }));

    const refrigerantTransactions: RefrigerantTransaction[] = APEX_MOCK_REF_TRANSACTIONS.map((tx, i) => ({
        ...tx,
        id: orgId === 'apex-org-456' ? tx.id : `${orgId}-${tx.id}`,
        organizationId: orgId,
        cylinderId: orgId === 'apex-org-456' ? tx.cylinderId : `${orgId}-${tx.cylinderId}`,
        technicianId: tx.technicianId ? (orgId === 'apex-org-456' ? tx.technicianId : `${orgId}-${tx.technicianId}`) : undefined,
        jobId: tx.jobId ? (orgId === 'apex-org-456' ? tx.jobId : `${orgId}-${tx.jobId}`) : undefined,
        createdAt: new Date(baseTime - (i * 2 + 1) * 86400000).toISOString()
    }));

    // 12. Marketing Campaigns
    const campaigns: MarketingCampaign[] = APEX_MOCK_CAMPAIGNS.map(camp => ({
        ...camp,
        id: orgId === 'apex-org-456' ? camp.id : `${orgId}-${camp.id}`,
        organizationId: orgId,
        startDate: new Date(baseTime - 25 * 86400000).toISOString().split('T')[0],
        status: 'Active'
    }));

    // 13. OSHA Incident Reports
    const incidents: IncidentReport[] = APEX_MOCK_INCIDENTS.map((inc, i) => ({
        ...inc,
        id: orgId === 'apex-org-456' ? inc.id : `${orgId}-${inc.id}`,
        organizationId: orgId,
        reporterId: inc.reporterId ? (orgId === 'apex-org-456' ? inc.reporterId : `${orgId}-${inc.reporterId}`) : undefined,
        date: new Date(baseTime - (i * 7 + 3) * 86400000).toISOString(),
        createdAt: new Date(baseTime - (i * 7 + 3) * 86400000).toISOString()
    }));

    // 14. Part Orders
    const partOrders: PartOrder[] = APEX_MOCK_PART_ORDERS.map((po, i) => ({
        ...po,
        id: orgId === 'apex-org-456' ? po.id : `${orgId}-${po.id}`,
        organizationId: orgId,
        jobId: po.jobId ? (orgId === 'apex-org-456' ? po.jobId : `${orgId}-${po.jobId}`) : undefined,
        createdAt: new Date(baseTime - (i * 2 + 1) * 86400000).toISOString()
    }));

    // 15. Bids
    const bids: Bid[] = APEX_MOCK_BIDS.map((b, i) => ({
        ...b,
        id: orgId === 'apex-org-456' ? b.id : `${orgId}-${b.id}`,
        organizationId: orgId,
        createdAt: new Date(baseTime - 12 * 86400000).toISOString(),
        dueDate: new Date(baseTime + (i * 15 + 14) * 86400000).toISOString().split('T')[0]
    }));

    // 16. Applicants
    const applicants: Applicant[] = APEX_MOCK_APPLICANTS.map((app, i) => ({
        ...app,
        id: orgId === 'apex-org-456' ? app.id : `${orgId}-${app.id}`,
        organizationId: orgId,
        appliedDate: new Date(baseTime - (i * 2 + 2) * 86400000).toISOString(),
        applicationDate: new Date(baseTime - (i * 2 + 2) * 86400000).toISOString()
    }));

    // 17. Fleet Vehicles
    const vehicles = MOCK_DEMO_VEHICLES.filter(v => v.organizationId === 'apex-org-456').map(v => ({
        ...v,
        id: orgId === 'apex-org-456' ? v.id : `${orgId}-${v.id}`,
        organizationId: orgId,
        assignedUserId: v.assignedUserId ? (orgId === 'apex-org-456' ? v.assignedUserId : `${orgId}-${v.assignedUserId}`) : undefined
    }));

    // 18. Operational Expenses (Distributed in current month for Financials P&L)
    const expenses = MOCK_DEMO_EXPENSES.filter(e => e.organizationId === 'apex-org-456').map((e, i) => {
        const expDate = new Date(baseTime - ((i % 24) + 1) * 86400000);
        return {
            ...e,
            id: orgId === 'apex-org-456' ? e.id : `${orgId}-${e.id}`,
            organizationId: orgId,
            paidById: e.paidById ? (orgId === 'apex-org-456' ? e.paidById : `${orgId}-${e.paidById}`) : undefined,
            date: expDate.toISOString().split('T')[0],
            createdAt: expDate.toISOString()
        };
    });

    // 19. Reviews
    const reviews = MOCK_DEMO_REVIEWS.filter(r => r.organizationId === 'apex-org-456').map((r, i) => ({
        ...r,
        id: orgId === 'apex-org-456' ? r.id : `${orgId}-${r.id}`,
        organizationId: orgId,
        createdAt: new Date(baseTime - (i * 3 + 2) * 86400000).toISOString()
    }));

    // 20. Rentals & Subcontractors
    const rentals = MOCK_DEMO_RENTALS.filter(rent => rent.organizationId === 'apex-org-456').map(rent => ({
        ...rent,
        id: orgId === 'apex-org-456' ? rent.id : `${orgId}-${rent.id}`,
        organizationId: orgId
    }));

    const subcontractors = MOCK_DEMO_SUBCONTRACTORS.filter(s => s.organizationId === 'apex-org-456').map(s => ({
        ...s,
        id: orgId === 'apex-org-456' ? s.id : `${orgId}-${s.id}`,
        organizationId: orgId
    }));

    return {
        org,
        users,
        customers,
        jobs,
        documents,
        appointments,
        proposals,
        projects,
        membershipPlans,
        serviceAgreements,
        inventory,
        refrigerantCylinders,
        refrigerantTransactions,
        campaigns,
        incidents,
        partOrders,
        bids,
        applicants,
        vehicles,
        expenses,
        reviews,
            rentals,
        subcontractors
    };
}

/**
 * Dynamic rolling date normalizer for demo environments (in-memory or live Firestore tenants).
 * Guarantees that demo records are never marked archived, expired, or past-due,
 * and dynamically projects dates relative to Date.now() so they always appear
 * on Today's and upcoming views of DispatchBoard, CompanyCalendar, DailyBriefing, and Financials P&L.
 */
export function normalizeDemoCollectionDates(collection: string, items: any[], _orgId?: string): any[] {
    if (!items || !Array.isArray(items) || items.length === 0) return items;
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Documents: ensure unarchived and dynamically rolled createdAt across all 6 DocumentCreator tabs
    if (collection === 'documents') {
        return items.map((doc, idx) => ({
            ...doc,
            archived: false,
            createdAt: doc.createdAt && (nowMs - new Date(doc.createdAt).getTime() < 14 * 86400000 && new Date(doc.createdAt).getTime() <= nowMs)
                ? doc.createdAt
                : new Date(nowMs - (idx * 18 + 2) * 3600 * 1000).toISOString(),
            updatedAt: now.toISOString()
        }));
    }

    // 2. Jobs: ensure unarchived, non-deleted, and dynamically mapped appointment & completion dates
    if (collection === 'jobs') {
        const scheduledJobs = items.filter(j => (j.jobStatus === 'Scheduled' || j.jobStatus === 'In Progress') && j.appointmentTime);
        let daysOffset = 0;
        if (scheduledJobs.length > 0) {
            const firstScheduled = scheduledJobs.reduce((earliest, j) => {
                const t = new Date(j.appointmentTime || 0).getTime();
                return t < earliest ? t : earliest;
            }, Infinity);
            
            if (firstScheduled !== Infinity) {
                const scheduledDate = new Date(firstScheduled);
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const schedMidnight = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate()).getTime();
                daysOffset = Math.floor((todayMidnight - schedMidnight) / 86400000);
            }
        }

        return items.map((job, idx) => {
            let aptTime = job.appointmentTime;
            let compAt = job.completedAt || job.completionDate;
            let createdAt = job.createdAt;

            if (daysOffset !== 0 && aptTime) {
                const shifted = new Date(new Date(aptTime).getTime() + daysOffset * 86400000);
                aptTime = shifted.toISOString();
            }

            if (daysOffset !== 0 && compAt) {
                const shiftedComp = new Date(new Date(compAt).getTime() + daysOffset * 86400000);
                if (shiftedComp.getTime() > nowMs) {
                    compAt = new Date(nowMs - ((idx % 3) + 1) * 86400000).toISOString();
                } else {
                    compAt = shiftedComp.toISOString();
                }
            }

            let invoice = job.invoice;
            if (invoice) {
                let paidAt = invoice.paidAt;
                if (daysOffset !== 0 && paidAt) {
                    const shiftedPaid = new Date(new Date(paidAt).getTime() + daysOffset * 86400000);
                    paidAt = shiftedPaid.getTime() > nowMs ? new Date(nowMs - 86400000).toISOString() : shiftedPaid.toISOString();
                }
                invoice = {
                    ...invoice,
                    paidAt,
                    issueDate: compAt ? compAt.split('T')[0] : invoice.issueDate
                };
            }

            return {
                ...job,
                appointmentTime: aptTime,
                completedAt: compAt,
                completionDate: compAt,
                createdAt: createdAt || new Date(nowMs - 7 * 86400000).toISOString(),
                archived: false,
                deleted: false,
                invoice
            };
        });
    }

    // 3. Users: active status, recent login & GPS updates within last 30 minutes
    if (collection === 'users') {
        return items.map((u, idx) => ({
            ...u,
            archived: false,
            lastLoginAt: new Date(nowMs - (idx * 3 + 5) * 60 * 1000).toISOString(),
            lastLocationUpdate: new Date(nowMs - (idx * 2 + 2) * 60 * 1000).toISOString()
        }));
    }

    // 4. Proposals: unarchived, validUntil in the future (never expired)
    if (collection === 'proposals') {
        return items.map(p => ({
            ...p,
            archived: false,
            validUntil: new Date(nowMs + 45 * 86400000).toISOString()
        }));
    }

    // 5. Appointments: unarchived, upcoming dates across the next 7 days
    if (collection === 'appointments') {
        return items.map((apt, idx) => {
            const aptDate = new Date(nowMs + (idx + 1) * 86400000);
            aptDate.setHours(9 + (idx % 3) * 2, 0, 0, 0);
            return {
                ...apt,
                archived: false,
                appointmentDate: aptDate.toISOString()
            };
        });
    }

    // 6. Bids: unarchived, future due dates (never past-due)
    if (collection === 'bids') {
        return items.map((b, idx) => ({
            ...b,
            archived: false,
            dueDate: new Date(nowMs + (idx * 10 + 14) * 86400000).toISOString().split('T')[0]
        }));
    }

    // 7. Projects: unarchived
    if (collection === 'projects') {
        return items.map(pr => ({
            ...pr,
            archived: false
        }));
    }

    // 8. Expenses: ensure current calendar month for Financials P&L
    if (collection === 'expenses') {
        return items.map((e, idx) => {
            const expDate = new Date(nowMs - ((idx % 24) + 1) * 86400000);
            return {
                ...e,
                archived: false,
                date: expDate.toISOString().split('T')[0],
                createdAt: expDate.toISOString()
            };
        });
    }

    // Default: ensure archived is false for all demo items
    return items.map(item => ({
        ...item,
        archived: false
    }));
}
