import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Frequently Asked Questions | TekTrakker',
    description: 'Find answers to common questions about TekTrakker, from setup and billing to advanced features and integrations.',
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
