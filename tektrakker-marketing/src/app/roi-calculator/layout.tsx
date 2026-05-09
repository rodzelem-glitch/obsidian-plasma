import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'ROI Calculator | TekTrakker',
    description: 'Calculate your potential return on investment and savings by switching to TekTrakker.',
};

export default function ROILayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
