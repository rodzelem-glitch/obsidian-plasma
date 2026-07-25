import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Free Homeowner Consumer Portal & Service Vault | TekTrakker',
    description: 'Securely store your property\'s service history, invoices, proposals, and appliance warranties. Hire verified local trade professionals with zero lead fees.',
    keywords: ['Consumer Vault', 'Homeowner Portal', 'Home Service History', 'Free Home Maintenance App'],
    openGraph: {
        title: 'Free Homeowner Consumer Portal & Service Vault | TekTrakker',
        description: 'Keep your home service history organized in one digital vault. Free forever.',
        type: 'website',
    }
};

export default function HomeownersLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
