import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AI Virtual Worker Commands & Capabilities Guide | TekTrakker',
    description: 'Learn how to command your TekTrakker AI Virtual Worker. Examples of scheduling prompts, dispatch requests, mileage audit commands, and financial reporting.',
    keywords: ['AI Assistant Commands', 'AI Dispatch Prompts', 'Field Service Automation Prompt Examples'],
    openGraph: {
        title: 'AI Virtual Worker Commands Directory | TekTrakker',
        description: 'Reference guide of natural language prompts to control dispatching, invoicing, tracking, and fleet audits.',
        type: 'website',
    }
};

export default function AiWorkerCommandsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
