import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'App Integrations & QuickBooks Sync | TekTrakker',
    description: 'Connect TekTrakker with your favorite tools like QuickBooks, Zapier, Stripe, and more. Direct, native integrations and Open APIs to streamline your business.',
    keywords: [
        'QuickBooks Online Integration FSM',
        'Direct QuickBooks Sync Contractor',
        'Stripe Payments Field Service',
        'TekTrakker API Webhooks',
        'Zapier FSM Integration',
        'Offline Sync Contractor App'
    ],
    openGraph: {
        title: 'App Integrations & QuickBooks Sync | TekTrakker',
        description: 'Direct, native integrations with QuickBooks, Stripe, and more to streamline your field service workflows. Custom APIs and Webhooks included.',
        type: 'website',
    }
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
