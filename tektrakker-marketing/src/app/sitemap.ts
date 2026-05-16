import { MetadataRoute } from 'next';
import { industriesData } from './data/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://tektrakker.com';

    // Static routes
    const routes = [
        '',
        '/about',
        '/features',
        '/pricing',
        '/integrations',
        '/roi-calculator',
        '/franchise',
        '/faq',
        '/terms',
        '/privacy',
        '/eula'
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // Dynamic Industry routes
    const industryRoutes = Object.keys(industriesData).map((slug) => ({
        url: `${baseUrl}/industries/${slug}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'monthly' as const,
        priority: 0.9,
    }));

    return [...routes, ...industryRoutes];
}
