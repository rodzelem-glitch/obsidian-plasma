import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Transparent Flat-Rate Pricing Plans | TekTrakker',
    description: 'Find the perfect plan for your trade business. Clean, transparent pricing for Starter, Growth, and Enterprise plans with no hidden user fees.',
    keywords: ['Contractor Software Pricing', 'HVAC CRM Pricing', 'Flat Rate Dispatch Software Cost', 'TekTrakker Tiers', 'ServiceTitan Alternatives'],
    openGraph: {
        title: 'Transparent Flat-Rate Pricing Plans | TekTrakker',
        description: 'Flat-rate SaaS tiers built for contractor teams of all sizes. No per-user fees, no hidden locks, and optional AI dispatch worker add-on.',
        type: 'website',
    }
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
