import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Transparent Payment Processing Pricing & Savings | TekTrakker',
    description: 'Calculate your savings with TekTrakker\'s integrated flat-rate payment processing (2.79% + $0.25). No hidden fees or monthly minimums.',
    keywords: ['Credit Card Processing', 'Merchant Services', 'Contractor Payments', 'Square vs Stripe savings calculator'],
    openGraph: {
        title: 'Transparent Payment Processing Pricing | TekTrakker',
        description: 'Simple flat-rate payment processing built directly into your field service workflow.',
        type: 'website',
    }
};

export default function PaymentProcessingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
