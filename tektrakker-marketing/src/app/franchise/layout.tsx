import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Enterprise Franchise Operating System & Management Software | TekTrakker',
    description: 'Scale your franchise operations with TekTrakker\'s multi-location management, unified brand control, royalty tracking, and centralized AI dispatching.',
    keywords: ['Franchise Management Software', 'Multi-Location FSM', 'Franchise Dispatch System'],
    openGraph: {
        title: 'Enterprise Franchise Operating System | TekTrakker',
        description: 'Empower your franchisees with a turnkey, white-labeled dispatching and AI operational system.',
        type: 'website',
    }
};

export default function FranchiseLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
