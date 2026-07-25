
import type { Proposal } from '../../types';

export const MOCK_DEMO_PROPOSALS: Proposal[] = [
    {
        id: 'PROP-001',
        organizationId: 'demo-org-123',
        customerId: 'demo-cust-1',
        customerName: 'Jordan Homeowner',
        jobId: 'demo-job-1',
        status: 'Accepted',
        total: 8250,
        subtotal: 7638.89,
        taxAmount: 611.11,
        createdAt: '2024-07-22T14:00:00Z',
        createdById: 'demo-tech-id',
        createdByName: 'Terry Tech',
        technicianId: 'demo-tech-id',
        selectedOption: 'Best',
        signature: '/signatures/jordan-homeowner-sig.png',
        items: [
            // Good Option
            { id: 'p-item-1', name: 'Standard Efficiency Furnace', description: '80% AFUE, single-stage furnace.', quantity: 1, price: 4500, total: 4500, type: 'Part', tier: 'Good', taxable: true },
            { id: 'p-item-2', name: 'Installation Labor', quantity: 8, price: 100, total: 800, type: 'Labor', tier: 'Good' },
            
            // Better Option
            { id: 'p-item-3', name: 'High-Efficiency Furnace', description: '95% AFUE, two-stage furnace for better comfort.', quantity: 1, price: 6200, total: 6200, type: 'Part', tier: 'Better', taxable: true },
            { id: 'p-item-4', name: 'Installation Labor', quantity: 8, price: 110, total: 880, type: 'Labor', tier: 'Better' },
            { id: 'p-item-5', name: 'New Digital Thermostat', quantity: 1, price: 250, total: 250, type: 'Part', tier: 'Better', taxable: true },

            // Best Option
            { id: 'p-item-6', name: 'Modulating High-Efficiency Furnace', description: '98% AFUE, fully modulating for maximum efficiency and comfort.', quantity: 1, price: 7500, total: 7500, type: 'Part', tier: 'Best', taxable: true },
            { id: 'p-item-7', name: 'Premium Installation', description: 'Includes flush and full system diagnostic.', quantity: 10, price: 120, total: 1200, type: 'Labor', tier: 'Best' },
            { id: 'p-item-8', name: 'Smart WiFi Thermostat', quantity: 1, price: 450, total: 450, type: 'Part', tier: 'Best', taxable: true },
            { id: 'p-item-9', name: 'Whole-Home Surge Protector', quantity: 1, price: 350, total: 350, type: 'Part', tier: 'Best', taxable: true }
        ]
    },
    {
        id: 'PROP-002',
        organizationId: 'demo-org-123',
        customerId: 'demo-cust-2',
        customerName: 'Sarah Smith',
        jobId: 'demo-job-2',
        status: 'Pending',
        total: 1250,
        subtotal: 1157.41,
        taxAmount: 92.59,
        createdAt: '2024-07-25T10:30:00Z',
        createdById: 'demo-admin-id',
        createdByName: 'Alex Admin',
        technicianId: 'demo-admin-id',
        items: [
            { id: 'p-item-10', name: 'Duct Cleaning Service', description: 'Full cleaning of all air ducts in the home.', quantity: 1, price: 750, total: 750, type: 'Labor', tier: 'Good' },
            { id: 'p-item-11', name: 'UV Air Purifier Installation', quantity: 1, price: 500, total: 500, type: 'Part', tier: 'Good', taxable: true },
        ]
    },
    {
        id: 'PROP-PROJ-001',
        organizationId: 'demo-org-123',
        customerId: 'demo-cust-2',
        customerName: 'Tractor Supply - Converse, TX',
        projectId: 'demo-project-1',
        projectName: 'New Furnace Installation',
        status: 'Sent',
        createdAt: '2026-06-10T08:00:00Z',
        createdById: 'demo-admin-id',
        createdByName: 'Alex Admin',
        technicianId: 'demo-admin-id',
        isProjectLevel: true,
        title: 'HVAC Labor, Parts & Crane Pricing Breakdown',
        locationAddress: '8318 FM 78, Converse, TX 78109',
        poNumber: '1238980',
        scid: '2602-28403',
        preparedByOrganization: 'TekAir Inc',
        preparedByPhone: '210-318-4197',
        preparedByLicence: 'TACLA73240E',
        
        laborSubtotal: 35235,
        roundedLaborProposal: 35500,
        roundedLaborBasis: 'Rounded for proposal presentation',
        laborItems: [
            { id: 'l-1', unitName: 'RTU #1', scope: 'Repair labor - contactors, pressure controls, leak search, latches, filters, startup documentation', hours: 30, rate: 135, value: 4050 },
            { id: 'l-2', unitName: 'RTU #2', scope: 'Repair labor - contactor, leak search, filters, operational verification', hours: 12, rate: 135, value: 1620 },
            { id: 'l-3', unitName: 'RTU #3', scope: 'Repair labor - leak search, filter replacement, operational verification', hours: 11, rate: 135, value: 1485 },
            { id: 'l-4', unitName: 'RTU #4', scope: 'Repair labor - pressure controls, contactor, fan motors/blades, leak search, wiring, filters, startup', hours: 38, rate: 135, value: 5130 },
            { id: 'l-5', unitName: 'RTU #5', scope: 'Full 15-ton RTU replacement changeout labor only - customer/vendor supplies unit and all parts/materials', hours: 72, rate: 135, value: 9720 },
            { id: 'l-6', unitName: 'RTU #6', scope: 'Repair labor - leak check, latch, filters, insulation/cleanup, startup verification', hours: 18, rate: 135, value: 2430 },
            { id: 'l-7', unitName: 'RTU #7', scope: 'Full 10-ton RTU replacement changeout labor only - customer/vendor supplies unit and all parts/materials', hours: 64, rate: 135, value: 8640 },
            { id: 'l-8', unitName: 'Project Management', scope: 'Parts coordination, scheduling, crane coordination, field documentation, closeout support', hours: 16, rate: 135, value: 2160 }
        ],
        
        partsTotal: 5453.26,
        partItems: [
            { id: 'p-1', unitName: 'RTU #1', partName: 'High pressure cutout/actuator', quantity: 1, vendorCost: 104.12, markupPct: 100, customerUnitPrice: 208.24, customerLineTotal: 208.24, availability: '3 business days' },
            { id: 'p-2', unitName: 'RTU #1', partName: 'Pressure switch/control', quantity: 1, vendorCost: 22.36, markupPct: 100, customerUnitPrice: 44.72, customerLineTotal: 44.72, availability: '3 business days' },
            { id: 'p-3', unitName: 'RTU #1', partName: 'Pressure switch/control', quantity: 1, vendorCost: 19.67, markupPct: 100, customerUnitPrice: 39.34, customerLineTotal: 39.34, availability: '3 business days' },
            { id: 'p-4', unitName: 'RTU #1', partName: 'Low pressure switch/control', quantity: 2, vendorCost: 49.80, markupPct: 100, customerUnitPrice: 99.60, customerLineTotal: 199.20, availability: '3 business days' },
            { id: 'p-5', unitName: 'RTU #1', partName: '3-pole contactor', quantity: 2, vendorCost: 16.53, markupPct: 100, customerUnitPrice: 33.06, customerLineTotal: 66.12, availability: '3 business days' },
            { id: 'p-6', unitName: 'RTU #1', partName: 'Contactor/ auxiliary contact/screw assembly', quantity: 1, vendorCost: 22.36, markupPct: 100, customerUnitPrice: 44.72, customerLineTotal: 44.72, availability: '3 business days' },
            { id: 'p-7', unitName: 'RTU #1', partName: '20x25x2 filters', quantity: 4, vendorCost: 5.38, markupPct: 100, customerUnitPrice: 10.76, customerLineTotal: 43.04, availability: '3 business days' },
            { id: 'p-8', unitName: 'RTU #1', partName: 'Door latch locking handle', quantity: 2, vendorCost: 57.11, markupPct: 100, customerUnitPrice: 114.22, customerLineTotal: 228.44, availability: '3 business days' },
            { id: 'p-9', unitName: 'RTU #1', partName: 'Freight/handling', quantity: 1, vendorCost: 26.00, markupPct: 100, customerUnitPrice: 52.00, customerLineTotal: 52.00, availability: '3 business days' },
            { id: 'p-10', unitName: 'RTU #2', partName: '2-pole contactor', quantity: 1, vendorCost: 22.54, markupPct: 100, customerUnitPrice: 45.08, customerLineTotal: 45.08, availability: 'In stock' },
            { id: 'p-11', unitName: 'RTU #2', partName: '20x25x2 filters', quantity: 6, vendorCost: 5.38, markupPct: 100, customerUnitPrice: 10.76, customerLineTotal: 64.56, availability: 'In stock' },
            { id: 'p-12', unitName: 'RTU #3', partName: '20x25x2 filters', quantity: 6, vendorCost: 5.38, markupPct: 100, customerUnitPrice: 10.76, customerLineTotal: 64.56, availability: 'In stock' },
            { id: 'p-13', unitName: 'RTU #4', partName: 'High pressure cutout/actuator', quantity: 1, vendorCost: 30.40, markupPct: 100, customerUnitPrice: 60.80, customerLineTotal: 60.80, availability: '3 business days' },
            { id: 'p-14', unitName: 'RTU #4', partName: 'High pressure control', quantity: 1, vendorCost: 26.03, markupPct: 100, customerUnitPrice: 52.06, customerLineTotal: 52.06, availability: '3 business days' },
            { id: 'p-15', unitName: 'RTU #4', partName: 'Low pressure control', quantity: 1, vendorCost: 57.46, markupPct: 100, customerUnitPrice: 114.92, customerLineTotal: 114.92, availability: '3 business days' },
            { id: 'p-16', unitName: 'RTU #4', partName: 'Low pressure control', quantity: 1, vendorCost: 27.86, markupPct: 100, customerUnitPrice: 55.72, customerLineTotal: 55.72, availability: '3 business days' },
            { id: 'p-17', unitName: 'RTU #4', partName: '3-pole contactor', quantity: 1, vendorCost: 16.53, markupPct: 100, customerUnitPrice: 33.06, customerLineTotal: 33.06, availability: '3 business days' },
            { id: 'p-18', unitName: 'RTU #4', partName: 'Condenser fan motor', quantity: 2, vendorCost: 818.22, markupPct: 50, customerUnitPrice: 1227.33, customerLineTotal: 2454.66, availability: '3 business days' },
            { id: 'p-19', unitName: 'RTU #4', partName: 'Condenser fan blade', quantity: 2, vendorCost: 312.05, markupPct: 100, customerUnitPrice: 624.10, customerLineTotal: 1248.20, availability: '3 business days' },
            { id: 'p-20', unitName: 'RTU #4', partName: '20x25x2 filters', quantity: 6, vendorCost: 5.38, markupPct: 100, customerUnitPrice: 10.76, customerLineTotal: 64.56, availability: '3 business days' },
            { id: 'p-21', unitName: 'RTU #4', partName: 'Freight/handling', quantity: 1, vendorCost: 28.00, markupPct: 100, customerUnitPrice: 56.00, customerLineTotal: 56.00, availability: '3 business days' },
            { id: 'p-22', unitName: 'RTU #6', partName: '20x25x2 filters', quantity: 4, vendorCost: 5.38, markupPct: 100, customerUnitPrice: 10.76, customerLineTotal: 43.04, availability: 'In stock' },
            { id: 'p-23', unitName: 'RTU #6', partName: 'Door latch locking handle', quantity: 1, vendorCost: 57.11, markupPct: 100, customerUnitPrice: 114.22, customerLineTotal: 114.22, availability: 'In stock' },
            { id: 'p-24', unitName: 'RTU #6', partName: 'Freight/handling', quantity: 1, vendorCost: 28.00, markupPct: 100, customerUnitPrice: 56.00, customerLineTotal: 56.00, availability: 'In stock' }
        ],
        
        allowanceTotal: 7500,
        allowanceItems: [
            { id: 'a-1', description: '60-ton crane allowance', basis: 'One scheduled crane mobilization for RTU removal/set support', amount: 7500 }
        ],
        
        clarifications: [
            'TekAir-supplied repair parts are included only for RTU #1, #2, #3, #4, and #6 as itemized above.',
            'RTU #5 and RTU #7 are full replacement changeout labor only. Customer/vendor supplies the RTUs and all associated parts/materials for those two units.'
        ],
        exclusions: [
            'Proposal excludes major roof/curb structural modifications, major gas piping replacement, major electrical code corrections, duct modifications, roof repairs, traffic control, permits, and after-hours premiums unless specifically listed.',
            'Pricing is based on available information, supplier quotations, and field notes provided. Availability and supplier pricing may change until parts are ordered and confirmed.'
        ],
        importantClarification: 'RTU #5 and RTU #7 are full HVAC rooftop unit replacement changeouts. TekAir pricing for these two units includes labor only. TekAir is not supplying replacement equipment, switches, controls, filters, motors, refrigerant, curb adapters, hail guards, or other parts/materials for RTU #5 or RTU #7 unless added by written change order.',
        
        calculatedTotal: 48453.26,
        recommendedRoundedTotal: 48500,
        subtotal: 48453.26,
        total: 48500,
        taxAmount: 0,
        items: []
    }
]
