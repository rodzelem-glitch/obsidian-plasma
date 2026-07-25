import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AI Dispatcher & Virtual Office Assistant for Contractors | TekTrakker',
    description: 'Supercharge your office with TekTrakker\'s autonomous AI Virtual Worker. Automate customer dispatch, route mapping, invoice drafts, and service agreements 24/7.',
    keywords: ['AI Dispatcher', 'HVAC AI Assistant', 'Automatic Time Tracking', 'Automated Contractor Dispatch'],
    openGraph: {
        title: 'AI Dispatcher & Virtual Office Assistant | TekTrakker',
        description: 'Hire the Virtual Worker Add-On. It works 24/7/365, never takes a sick day, and understands your entire database instantly.',
        type: 'website',
    }
};

export default function AiWorkerLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
