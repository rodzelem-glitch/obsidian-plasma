
import type { Job } from '../../types';

export const MOCK_DEMO_JOBS: Job[] = [
    {
        id: 'demo-job-1',
        organizationId: 'demo-org-123',
        customerName: 'Jordan Homeowner',
        customerId: 'demo-cust-1',
        address: '742 Evergreen Terrace, Denver, CO 80204',
        tasks: ['AC Not Cooling', 'System Diagnosis'],
        jobStatus: 'In Progress',
        appointmentTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // 2 hours from now
        specialInstructions: 'Gate code 1234. Beware of dog.',
        assignedTechnicianId: 'demo-tech-id',
        assignedTechnicianName: 'Terry Tech',
        invoice: {
            id: 'INV-1001',
            items: [
                { id: 'item-1', description: 'Diagnostic Fee', quantity: 1, unitPrice: 89, total: 89, type: 'Fee', taxable: true },
                { id: 'item-2', description: 'Transformer - 40VA (Foot Mount)', quantity: 1, unitPrice: 125, total: 125, type: 'Part', taxable: true }
            ],
            subtotal: 214,
            taxRate: 0.08,
            taxAmount: 17.12,
            totalAmount: 231.12,
            amount: 231.12,
            status: 'Unpaid',
            paidDate: null
        },
        jobEvents: [{ type: 'assignment', timestamp: new Date().toISOString(), user: 'Alex Admin' }],
        notes: {
            preRepair: 'Found failed 24V transformer. Likely surge related.',
            internalNotes: 'Customer requested estimate for whole-home surge protector.'
        },
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString() // Yesterday
    },
    {
        id: 'demo-job-2',
        organizationId: 'demo-org-123',
        customerName: 'Sarah Smith',
        customerId: 'demo-cust-2',
        address: '101 Main St, Denver, CO 80202',
        tasks: ['Annual Maintenance', 'Filter Change'],
        jobStatus: 'Scheduled',
        appointmentTime: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), // 3 days from now
        specialInstructions: 'Please call 30 minutes before arrival.',
        assignedTechnicianId: 'demo-tech-2-id',
        assignedTechnicianName: 'Brian Mechanic',
        invoice: {
            id: 'INV-1002',
            items: [
                { id: 'item-3', description: 'Annual Maintenance Plan Visit', quantity: 1, unitPrice: 0, total: 0, type: 'Fee', taxable: false }
            ],
            subtotal: 0,
            taxRate: 0.08,
            taxAmount: 0,
            totalAmount: 0,
            amount: 0,
            status: 'Paid',
            paidDate: new Date().toISOString()
        },
        jobEvents: [],
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() // 2 days ago
    },
    {
        id: 'demo-job-3',
        organizationId: 'demo-org-123',
        customerName: 'Downtown Cafe',
        customerId: 'demo-cust-3',
        address: '456 Business Blvd, Denver, CO 80203',
        tasks: ['Ice Machine Repair'],
        jobStatus: 'Completed',
        appointmentTime: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), // Last week
        specialInstructions: 'Enter through the back service door.',
        assignedTechnicianId: 'demo-tech-id',
        assignedTechnicianName: 'Terry Tech',
        invoice: {
            id: 'INV-1003',
            items: [
                { id: 'item-4', description: 'Commercial Diagnostic Fee', quantity: 1, unitPrice: 150, total: 150, type: 'Fee', taxable: true },
                { id: 'item-5', description: 'Water Inlet Valve Replacement', quantity: 1, unitPrice: 275, total: 275, type: 'Part', taxable: true },
                { id: 'item-6', description: 'Labor (2 hours)', quantity: 2, unitPrice: 120, total: 240, type: 'Labor', taxable: false }
            ],
            subtotal: 665,
            taxRate: 0.08,
            taxAmount: 34,
            totalAmount: 699,
            amount: 699,
            status: 'Paid',
            paidDate: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
        },
        jobEvents: [],
        notes: {
            completion: 'Replaced faulty water inlet valve on ice machine. System now functioning correctly.',
            customerFeedback: 'Service was fast and efficient!'
        },
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    }
];
