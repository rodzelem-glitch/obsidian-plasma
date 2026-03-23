
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
    }
]
