import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Merchant Services & Payment Processing Signup | TekTrakker',
    description: 'Sign up for TekTrakker\'s flat-rate card processing. Keep more of every dollar you earn with zero setup costs.',
    keywords: ['Sign up merchant account', 'payment processing enrollment', 'merchant services setup'],
    openGraph: {
        title: 'Merchant Services & Payment Processing Signup | TekTrakker',
        description: 'Get started with flat-rate merchant processing today.',
        type: 'website',
    }
};

export default function PaymentProcessingSignupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
