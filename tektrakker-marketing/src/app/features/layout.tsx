import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Platform Features & Capabilities | TekTrakker',
    description: 'Explore the full suite of TekTrakker features, including visual dispatch boards, automated invoicing, offline technician app, customer CRM, and advanced AI automation tools.',
    openGraph: {
        title: 'Platform Features & Capabilities | TekTrakker',
        description: 'Explore the full suite of TekTrakker features, including visual dispatch boards, automated invoicing, offline technician app, customer CRM, and advanced AI automation tools.',
        url: 'https://tektrakker.com/features',
        type: 'website',
    }
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
