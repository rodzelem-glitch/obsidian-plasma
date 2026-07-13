
import type { MembershipPlan, ServiceAgreement } from '../../types';

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
    },
    {
        id: 'demo-plan-3',
        organizationId: 'demo-org-123',
        name: 'Platinum Protector',
        monthlyPrice: 49.99,
        annualPrice: 499,
        discountPercentage: 20,
        discountScope: 'Both',
        visitsPerYear: 2,
        color: '#6b7280',
        benefits: ['2 Annual Precision Tune-ups', '20% Discount on Parts & Labor', 'No Diagnostic Fees', '24-Hour Service Guarantee', 'Annual Electrical & Plumbing Inspection']
    }
];

export const MOCK_DEMO_AGREEMENTS: ServiceAgreement[] = [
    {
        id: 'SA-001',
        organizationId: 'demo-org-123',
        customerId: 'demo-cust-2',
        customerName: 'Sarah Smith',
        planName: 'Gold Guardian',
        price: 299,
        billingCycle: 'Annual',
        startDate: '2023-11-01',
        endDate: '2024-11-01',
        status: 'Active',
        visitsTotal: 2,
        visitsRemaining: 1
    },
    {
        id: 'SA-002',
        organizationId: 'demo-org-123',
        customerId: 'demo-cust-3',
        customerName: 'Downtown Cafe',
        planName: 'Platinum Protector',
        price: 49.99,
        billingCycle: 'Monthly',
        startDate: '2024-02-15',
        endDate: '2025-02-15',
        status: 'Active',
        visitsTotal: 2,
        visitsRemaining: 2
    }
];
