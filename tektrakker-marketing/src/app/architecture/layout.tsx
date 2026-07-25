import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Platform System Architecture & Sync Protocols | TekTrakker',
    description: 'Learn about TekTrakker\'s system design, including our offline-first SQLite synchronization, eventual consistency merge engine, native QuickBooks integration, and double-entry financial ledger.',
    keywords: [
        'TekTrakker System Design',
        'Offline First Sync Protocol',
        'Capacitor SQLite Sync',
        'CRDT Field Merge FSM',
        'QuickBooks Native API Integration',
        'Service-Disabled Veteran-Owned Small Business FSM'
    ],
    openGraph: {
        title: 'Platform System Architecture & Sync Protocols | TekTrakker',
        description: 'Read the deep technical specification of TekTrakker\'s distributed architecture. Designed for 99.99% uptime, offline-first reliability, and direct accounting synchronization.',
        type: 'website',
    }
};

export default function ArchitectureLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
