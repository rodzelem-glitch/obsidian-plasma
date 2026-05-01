
import type { Customer } from '../../types';

export const MOCK_DEMO_CUSTOMERS: Customer[] = [
    {
        id: 'demo-cust-1',
        organizationId: 'demo-org-123',
        name: 'Jordan Homeowner',
        firstName: 'Jordan',
        lastName: 'Homeowner',
        email: 'jordan@demo.com',
        phone: '(555) 987-6543',
        address: '742 Evergreen Terrace, Denver, CO 80204',
        customerType: 'Residential',
        hvacSystem: { brand: 'Carrier', type: 'Split System', installDate: '2018-05-12' },
        equipment: [
            { id: 'eq-1', brand: 'Carrier', model: 'AC-5000', serial: 'SN12345', type: 'Air Conditioner', location: 'Roof' },
            { id: 'eq-2', brand: 'Carrier', model: 'F-9000', serial: 'SN67890', type: 'Furnace', location: 'Basement' }
        ],
        serviceHistory: [],
        marketingConsent: { sms: true, email: true, agreedAt: '2023-02-20T10:00:00Z', source: 'Website' },
        preferredContactMethod: 'Email',
        bestTimeToContact: 'Weekdays, 9am - 5pm'
    },
    {
        id: 'demo-cust-2',
        organizationId: 'demo-org-123',
        name: 'Sarah Smith',
        firstName: 'Sarah',
        lastName: 'Smith',
        email: 'sarah@example.com',
        phone: '(555) 111-2222',
        address: '101 Main St, Denver, CO 80202',
        customerType: 'Residential',
        hvacSystem: { brand: 'Trane', type: 'Heat Pump', installDate: '2020-11-03' },
        equipment: [
            { id: 'eq-3', brand: 'Trane', model: 'HP-2020', serial: 'SNABCDE', type: 'Heat Pump', location: 'Side Yard' }
        ],
        serviceHistory: [],
        notes: 'Customer has a friendly dog named Max. Always call before arriving.',
        marketingConsent: { sms: false, email: true, agreedAt: '2022-11-03T14:30:00Z', source: 'Referral' }
    },
    {
        id: 'demo-cust-3',
        organizationId: 'demo-org-123',
        name: 'Downtown Cafe',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria@downtowncafe.demo',
        phone: '(555) 555-1212',
        address: '456 Business Blvd, Denver, CO 80203',
        customerType: 'Commercial',
        hvacSystem: { brand: 'Lennox', type: 'Rooftop Unit', installDate: '2019-08-21' },
        equipment: [
            { id: 'eq-4', brand: 'Lennox', model: 'RTU-100', serial: 'SNFGHIJ', type: 'Rooftop Unit', location: 'Roof' },
            { id: 'eq-5', brand: 'Manitowoc', model: 'ICE-200', serial: 'SNKLMNO', type: 'Ice Machine', location: 'Kitchen' }
        ],
        serviceHistory: [],
        preferredContactMethod: 'Phone',
        bestTimeToContact: 'Mornings before 11am'
    }
];
