import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart2, 
  PhoneCall, 
  BrainCircuit, 
  Database, 
  FileText, 
  ArrowRight, 
  ChevronLeft
} from 'lucide-react';

// Sub-components
import PlatformAnalytics from './PlatformAnalytics';
import TelephonyAnalytics from './TelephonyAnalytics';
import AiUsageMaster from '../admin/AiUsageMaster';
import StorageUsageMaster from '../admin/StorageUsageMaster';
import VirtualWorkerReports from '../admin/VirtualWorkerReports';

export interface AnalyticsCardItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  accentBg: string;
  hoverBorder: string;
}

const ANALYTICS_CARDS: AnalyticsCardItem[] = [
  {
    id: 'platform',
    title: 'Platform Analytics',
    subtitle: 'System Health & API Latency',
    description: 'Monitor Google Cloud core infrastructure, API request throughput, server error rates, and system uptime.',
    icon: BarChart2,
    badge: 'Core Infra',
    badgeColor: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    accentBg: 'from-violet-500/10 via-purple-500/5 to-transparent',
    hoverBorder: 'hover:border-violet-500 dark:hover:border-violet-400'
  },
  {
    id: 'telephony',
    title: 'Telephony & Voice Analytics',
    subtitle: 'Call Volume & AI Dispatcher Logs',
    description: 'Track inbound/outbound call metrics, Twilio voice logs, AI dispatcher answer rates, and SMS delivery telemetry.',
    icon: PhoneCall,
    badge: 'Voice & SMS',
    badgeColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    accentBg: 'from-blue-500/10 via-cyan-500/5 to-transparent',
    hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-400'
  },
  {
    id: 'ai-usage',
    title: 'AI Usage & Token Metrics',
    subtitle: 'Gemini 3.7 Flash & Quota Limits',
    description: 'Real-time agent model usage, Gemini 3.7 Flash token consumption, estimated platform costs, and per-tenant AI limits.',
    icon: BrainCircuit,
    badge: 'Gemini 3.7 Flash',
    badgeColor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    accentBg: 'from-purple-500/10 via-indigo-500/5 to-transparent',
    hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-400'
  },
  {
    id: 'storage',
    title: 'Blob & Storage Metrics',
    subtitle: 'Cloud Media & File Host Telemetry',
    description: 'Audit total Firebase bucket storage, media attachment distribution across tenants, and multimedia quotas.',
    icon: Database,
    badge: 'Cloud Storage',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    accentBg: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-400'
  },
  {
    id: 'ai-reports',
    title: 'AI Worker Reports & Audit',
    subtitle: 'Agent Logs & Long-Form Outputs',
    description: 'View generated agent execution logs, historical research reports, automated workflow outputs, and PDF exports.',
    icon: FileText,
    badge: 'Agent Audit',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    accentBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
    hoverBorder: 'hover:border-amber-500 dark:hover:border-amber-400'
  }
];

const MasterAnalyticsHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'hub';

  const selectTab = (tabId: string) => {
    if (tabId === 'hub') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'platform':
        return <PlatformAnalytics />;
      case 'telephony':
        return <TelephonyAnalytics />;
      case 'ai-usage':
        return <AiUsageMaster />;
      case 'storage':
        return <StorageUsageMaster />;
      case 'ai-reports':
        return <VirtualWorkerReports />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Show back button only when inside a specific metrics page */}
      {activeTab !== 'hub' && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => selectTab('hub')}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <ChevronLeft size={16} /> Back to Metrics Hub
          </button>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {ANALYTICS_CARDS.find(c => c.id === activeTab)?.title || 'Analytics Detail'}
          </span>
        </div>
      )}

      {/* Main View Mode: Hub Cards vs Active Sub-Page */}
      {activeTab === 'hub' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ANALYTICS_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => selectTab(card.id)}
                className={`group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${card.hoverBorder}`}
              >
                {/* Background Accent Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.accentBg} opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                <div>
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-slate-800 dark:text-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 shadow-sm">
                      <Icon size={24} />
                    </div>
                    <span className={`text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="relative z-10 mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed relative z-10 mb-6">
                    {card.description}
                  </p>
                </div>

                {/* Card Action Link */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between relative z-10 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Open {card.title}</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {renderActiveTabContent()}
        </div>
      )}
    </div>
  );
};

export default MasterAnalyticsHub;
