import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'App Integrations | TekTrakker',
    description: 'Connect TekTrakker with your favorite tools like QuickBooks, Zapier, Instagram, and more to streamline your workflows.',
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
