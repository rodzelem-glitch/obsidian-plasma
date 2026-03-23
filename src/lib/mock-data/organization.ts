
import type { Organization } from '../../types';

export const MOCK_DEMO_ORG: Organization = {
    id: 'demo-org-123',
    name: 'Summit Peak Services',
    email: 'hello@summitpeak.demo',
    phone: '(555) 123-4567',
    industry: 'HVAC',
    address: {
        street: '123 Mountain View Dr',
        city: 'Denver',
        state: 'CO',
        zip: '80202'
    },
    website: 'www.summitpeak.demo',
    logoUrl: '/summit-peak-logo.png',
    subscriptionStatus: 'active',
    plan: 'growth',
    primaryColor: '#0284c7',
    taxRate: 0.08,
    createdAt: '2023-01-15T09:00:00Z',
    enabledPanels: {
        inventory: true,
        marketing: true,
        memberships: true,
        documents: true,
        time_tracking: true
    },
    reviewLink: 'https://g.page/r/AbcDeFgHiJk/review',
    financingLink: 'https://app.gethearth.com/summitpeak',
    proposalDisclaimer: 'This proposal is valid for 30 days. Prices are subject to change based on material costs.',
    invoiceTerms: 'Payment due upon receipt. A late fee of 1.5% per month will be applied to all overdue balances.',
    socialLinks: {
        facebook: 'https://facebook.com/summitpeak',
        x: 'https://x.com/summitpeak',
        instagram: 'https://instagram.com/summitpeak',
        youtube: 'https://youtube.com/summitpeak'
    }
};
