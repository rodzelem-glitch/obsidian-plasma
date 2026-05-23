import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/site/*',
                    '/book',
                    '/careers/*',
                    '/franchise',
                    '/ai-worker-commands',
                    '/ai-worker'
                ],
                disallow: [
                    '/api/',
                    '/admin/',
                    '/master/',
                    '/portal/',
                    '/briefing',
                    '/timelog',
                    '/messages',
                    '/payments',
                    '/proposal',
                    '/invoice/',
                    '/report/',
                    '/proposal-view/'
                ],
            },
            {
                userAgent: 'GPTBot',
                disallow: [
                    '/admin/',
                    '/master/',
                    '/portal/',
                    '/briefing'
                ],
            }
        ],
        sitemap: 'https://tektrakker.com/sitemap.xml',
    };
}
