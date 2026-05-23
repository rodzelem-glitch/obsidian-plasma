import { MetadataRoute } from 'next';
import { industriesData, platformFeatures } from './data/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://tektrakker.com';

    // Static routes
    const routes = [
        '',
        '/about',
        '/pricing',
        '/integrations',
        '/roi-calculator',
        '/payment-processing',
        '/payment-processing-signup',
        '/franchise',
        '/faq',
        '/terms',
        '/privacy',
        '/eula',
        '/homeowners',
        '/ai-worker',
        '/ai-worker-commands'
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1.0 : 0.8,
    }));

    // Dynamic Industry routes
    const industryRoutes = Object.keys(industriesData).map((slug) => ({
        url: `${baseUrl}/industries/${slug}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'monthly' as const,
        priority: 0.9,
    }));

    // Dynamic Feature routes
    const featureRoutes = Object.keys(platformFeatures).map((slug) => ({
        url: `${baseUrl}/features/${slug}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'monthly' as const,
        priority: 0.9,
    }));

    return [...routes, ...industryRoutes, ...featureRoutes];
}
