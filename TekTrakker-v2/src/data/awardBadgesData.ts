export interface RatingMetric {
  name: string;
  score: number; // 0 - 100
  weight: number;
  benchmark: string;
}

export type BadgeTheme = 'gold_luxury' | 'platinum_elite' | 'diamond_titan' | 'emerald_eco' | 'cyber_tech';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface TekTrakkerAward {
  id: string;
  orgId: string;
  orgName: string;
  orgLogo?: string;
  category: string;
  categoryId: string;
  year: number;
  overallScore: number; // e.g. 98.6
  percentile: string; // e.g. "Top 1% Nationwide"
  starRating: number; // e.g. 4.9
  reviewCount: number;
  issuedDate: string;
  claimed: boolean;
  claimedAt?: string;
  enabledForWidget?: boolean;
  badgeTheme: BadgeTheme;
  metrics: RatingMetric[];
  verificationCode: string;
  description: string;
}

export interface AwardCategoryDef {
  id: string;
  title: string;
  icon: string;
  defaultTheme: BadgeTheme;
  description: string;
  criteria: string[];
}

export const AWARD_CATEGORIES: AwardCategoryDef[] = [
  {
    id: 'hvac_excellence',
    title: 'HVAC Excellence & Comfort Provider',
    icon: 'Flame',
    defaultTheme: 'gold_luxury',
    description: 'Recognizes organizations demonstrating exceptional HVAC diagnostic accuracy, efficiency, and customer satisfaction.',
    criteria: ['95%+ First-Time Fix Rate', 'Under 45 Min Dispatch Response', '100% Refrigerant Compliance', '4.8+ Star Rating']
  },
  {
    id: 'electrical_innovation',
    title: 'Electrical Safety & Innovation Leader',
    icon: 'Zap',
    defaultTheme: 'platinum_elite',
    description: 'Awarded to top electrical contractors adhering to rigorous safety protocols and advanced smart-grid integrations.',
    criteria: ['Zero Safety Incidents', 'Verified Code Compliance', 'Smart Load Monitoring Mastery', 'Certified Master Techs']
  },
  {
    id: 'plumbing_mastery',
    title: 'Plumbing Reliability & Mastery Award',
    icon: 'Droplet',
    defaultTheme: 'diamond_titan',
    description: 'Honors field services with outstanding pipework engineering, emergency response, and water efficiency metrics.',
    criteria: ['24/7 Rapid Emergency Response', 'Advanced Leak Detection Tech', 'Clean Jobsite Protocol', '98%+ On-Time Rate']
  },
  {
    id: 'commercial_titan',
    title: 'Commercial Service Industry Titan',
    icon: 'Building2',
    defaultTheme: 'cyber_tech',
    description: 'Presented to multi-site commercial operators maintaining enterprise SLAs, preventive maintenance, and asset longevity.',
    criteria: ['99.2% SLA Compliance', 'Multi-Facility Operations', 'Asset Life-Extension Score > 90', 'Automated Maintenance Logs']
  },
  {
    id: 'eco_green_ops',
    title: 'Eco-Green Field Operations Winner',
    icon: 'Leaf',
    defaultTheme: 'emerald_eco',
    description: 'Celebrates sustainability, eco-friendly refrigerant recovery, low-emission fleet routing, and energy savings.',
    criteria: ['100% Eco-Safe Refrigerant Tracking', 'Route Optimization Savings', 'Paperless Mobile Invoicing', 'Energy Star Certified']
  },
  {
    id: 'five_star_satisfaction',
    title: '5-Star Customer Satisfaction Excellence',
    icon: 'Star',
    defaultTheme: 'gold_luxury',
    description: 'Highest distinction awarded based on direct customer reviews, transparent billing, and technician professionalism.',
    criteria: ['4.9+ Average Review Rating', '500+ Verified Reviews', 'Instant SMS Customer Tracking', 'Transparent Upfront Pricing']
  }
];

const STABLE_DEFAULT_ORG_LOGO = 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9';

export function resolveOrgLogo(orgId?: string): string {
  if (typeof window !== 'undefined') {
    try {
      const orgRaw = localStorage.getItem('tektrakker_organization') || localStorage.getItem('currentOrganization');
      if (orgRaw) {
        const org = JSON.parse(orgRaw);
        if (org.logoUrl) return org.logoUrl;
        if (org.letterheadDataUrl) return org.letterheadDataUrl;
        if (org.logo) return org.logo;
      }
    } catch {}
  }
  return STABLE_DEFAULT_ORG_LOGO;
}

export const INITIAL_AWARDS: TekTrakkerAward[] = [
  {
    id: 'award-hvac-2026-001',
    orgId: 'org_apex_hvac',
    orgName: 'Apex HVAC & Climate Solutions',
    orgLogo: STABLE_DEFAULT_ORG_LOGO,
    category: 'HVAC Excellence & Comfort Provider 2026',
    categoryId: 'hvac_excellence',
    year: 2026,
    overallScore: 98.7,
    percentile: 'Top 1% Nationwide',
    starRating: 4.95,
    reviewCount: 684,
    issuedDate: '2026-01-15',
    claimed: true,
    claimedAt: '2026-01-18T10:30:00Z',
    badgeTheme: 'gold_luxury',
    verificationCode: 'TT-AWD-2026-8892',
    description: 'Official TekTrakker rating certification recognizing Apex HVAC for industry-leading technician response times, precision diagnostics, and 99.1% customer approval.',
    metrics: [
      { name: 'First-Time Fix Rate', score: 99.1, weight: 0.3, benchmark: '98.5% industry top decile' },
      { name: 'Average Response Time', score: 97.5, weight: 0.25, benchmark: '32 mins avg dispatch' },
      { name: 'Safety & Refrigerant Compliance', score: 100, weight: 0.25, benchmark: 'Zero EPA audit flags' },
      { name: 'Customer Satisfaction Index', score: 98.2, weight: 0.2, benchmark: '4.95 / 5.0 stars' }
    ]
  },
  {
    id: 'award-elec-2026-002',
    orgId: 'org_apex_hvac',
    orgName: 'Apex HVAC & Climate Solutions',
    orgLogo: STABLE_DEFAULT_ORG_LOGO,
    category: 'Electrical Safety & Innovation Leader 2026',
    categoryId: 'electrical_innovation',
    year: 2026,
    overallScore: 97.4,
    percentile: 'Top 3% Regionally',
    starRating: 4.90,
    reviewCount: 412,
    issuedDate: '2026-03-01',
    claimed: true,
    claimedAt: '2026-03-02T14:15:00Z',
    badgeTheme: 'platinum_elite',
    verificationCode: 'TT-AWD-2026-4419',
    description: 'Awarded by TekTrakker for exceptional electrical safety standards, zero-incident workplace rating, and smart IoT telemetry adoption.',
    metrics: [
      { name: 'Zero Safety Incidents', score: 100, weight: 0.35, benchmark: '100% compliant' },
      { name: 'Smart Grid & Diagnostic Tech', score: 96.0, weight: 0.25, benchmark: 'Advanced digital tools' },
      { name: 'Code Compliance Verification', score: 98.0, weight: 0.25, benchmark: 'Verified master electricians' },
      { name: 'Customer Feedback Score', score: 95.5, weight: 0.15, benchmark: '4.90 / 5.0 stars' }
    ]
  },
  {
    id: 'award-eco-2026-003',
    orgId: 'org_apex_hvac',
    orgName: 'Apex HVAC & Climate Solutions',
    orgLogo: STABLE_DEFAULT_ORG_LOGO,
    category: 'Eco-Green Field Operations Winner 2026',
    categoryId: 'eco_green_ops',
    year: 2026,
    overallScore: 99.2,
    percentile: 'Top 1% Sustainability',
    starRating: 4.98,
    reviewCount: 310,
    issuedDate: '2026-05-10',
    claimed: false,
    badgeTheme: 'emerald_eco',
    verificationCode: 'TT-AWD-2026-9021',
    description: 'Presented by TekTrakker for zero-paper operations, 100% eco-compliant refrigerant recycling, and optimized low-carbon service dispatching.',
    metrics: [
      { name: 'Refrigerant Recovery Compliance', score: 100, weight: 0.4, benchmark: '100% digital audit track' },
      { name: 'Fleet Emission Savings', score: 98.0, weight: 0.3, benchmark: '-24% fuel per job' },
      { name: 'Paperless Digital Invoicing', score: 100, weight: 0.3, benchmark: '100% digital' }
    ]
  }
];

const STORAGE_KEY = 'tektrakker_awards_store';

export function getStoredAwards(): TekTrakkerAward[] {
  if (typeof window === 'undefined') return INITIAL_AWARDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base: TekTrakkerAward[] = raw ? JSON.parse(raw) : INITIAL_AWARDS;
    const list = Array.isArray(base) && base.length > 0 ? base : INITIAL_AWARDS;
    return list.map((a) => ({
      ...a,
      orgLogo: a.orgLogo || resolveOrgLogo(a.orgId)
    }));
  } catch {
    return INITIAL_AWARDS.map((a) => ({
      ...a,
      orgLogo: a.orgLogo || resolveOrgLogo(a.orgId)
    }));
  }
}

export function saveStoredAwards(awards: TekTrakkerAward[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(awards));
  } catch (err) {
    console.error('Failed to save awards to local storage', err);
  }
}


export function generateScriptEmbedCode(award: TekTrakkerAward, theme: BadgeTheme, size: BadgeSize): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  return `<!-- Start TekTrakker Verified Business Award Badge -->
<div id="tektrakker-award-widget-${award.id}"></div>
<script src="${baseUrl}/widgets/tektrakker-award.js" 
  data-award-id="${award.id}" 
  data-theme="${theme}" 
  data-size="${size}"
  async></script>
<noscript>
  <a href="${baseUrl}/#/awards/verify/${award.id}" target="_blank" rel="noopener">
    <img src="${baseUrl}/api/awards/${award.id}/badge.png" alt="TekTrakker ${award.category} Verified Business Award" />
  </a>
</noscript>
<!-- End TekTrakker Verified Business Award Badge -->`;
}

export function generateIframeEmbedCode(award: TekTrakkerAward, theme: BadgeTheme, size: BadgeSize): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  const width = size === 'sm' ? 160 : size === 'md' ? 240 : 340;
  const height = size === 'sm' ? 200 : size === 'md' ? 290 : 400;
  const widgetUrl = `${baseUrl}/#/widgets/award/${award.id}?theme=${theme}&size=${size}`;
  
  return `<iframe src="${widgetUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  scrolling="no" 
  title="TekTrakker Verified Business Award - ${award.orgName}"
  style="border:none; overflow:hidden; border-radius:12px; transition:transform 0.2s ease-in-out;">
</iframe>`;
}

export function generateReactEmbedCode(award: TekTrakkerAward, theme: BadgeTheme): string {
  return `import React from 'react';

export const TekTrakkerAwardBadgeWidget = () => (
  <div style={{ display: 'inline-block', textDecoration: 'none' }}>
    <a 
      href="https://tektrakker.com/#/awards/verify/${award.id}" 
      target="_blank" 
      rel="noopener noreferrer"
      title="Verify ${award.orgName} on TekTrakker"
    >
      <iframe 
        src="https://tektrakker.com/#/widgets/award/${award.id}?theme=${theme}" 
        width="240" 
        height="290" 
        style={{ border: 'none', overflow: 'hidden' }}
      />
    </a>
  </div>
);`;
}

export function generateJsonLdSchema(award: TekTrakkerAward): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Award',
    'name': award.category,
    'description': award.description,
    'sponsor': {
      '@type': 'Organization',
      'name': 'TekTrakker Verified Business Awards Committee',
      'url': 'https://tektrakker.com'
    },
    'winner': {
      '@type': 'LocalBusiness',
      'name': award.orgName,
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': award.overallScore,
        'bestRating': '100',
        'worstRating': '0',
        'ratingCount': award.reviewCount
      }
    },
    'dateCreated': award.issuedDate,
    'url': `${baseUrl}/#/awards/verify/${award.id}`
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

export function generateMultiAwardScriptCode(orgId: string, theme: BadgeTheme = 'gold_luxury'): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  return `<!-- Start TekTrakker Multi-Award Showcase Widget -->
<div id="tektrakker-awards-showcase-${orgId}"></div>
<script src="${baseUrl}/widgets/tektrakker-awards-showcase.js" 
  data-org-id="${orgId}" 
  data-theme="${theme}" 
  async></script>
<!-- End TekTrakker Multi-Award Showcase Widget -->`;
}

export function generateMultiAwardIframeCode(orgId: string, theme: BadgeTheme = 'gold_luxury', layout: 'full' | 'footer' = 'full'): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  const height = layout === 'footer' ? 95 : 360;
  const widgetUrl = `${baseUrl}/#/widgets/awards/${orgId}?theme=${theme}&layout=${layout}`;
  
  return `<iframe src="${widgetUrl}" 
  width="100%" 
  height="${height}" 
  frameborder="0" 
  scrolling="no" 
  title="TekTrakker Verified Business Awards Showcase"
  style="border:none; overflow:hidden; border-radius:${layout === 'footer' ? '12px' : '16px'}; max-width:900px; width:100%;">
</iframe>`;
}

export function generateMultiAwardReactCode(orgId: string, theme: BadgeTheme = 'gold_luxury', layout: 'full' | 'footer' = 'full'): string {
  const height = layout === 'footer' ? 95 : 360;
  return `import React from 'react';

export const TekTrakkerAwardsShowcaseWidget = () => (
  <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
    <iframe 
      src="https://tektrakker.com/#/widgets/awards/${orgId}?theme=${theme}&layout=${layout}" 
      width="100%" 
      height="${height}" 
      style={{ border: 'none', overflow: 'hidden', borderRadius: '${layout === 'footer' ? '12px' : '16px'}' }}
      title="TekTrakker Awards Showcase"
    />
  </div>
);`;
}
