import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing | TekTrakker',
    description: 'Flexible pricing plans built for service businesses of all sizes. Find the right plan to scale your operations.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
