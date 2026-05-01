import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Users, FileText, ClipboardList, TrendingUp, Settings, Route as RouteIcon, Box, 
    ShieldCheck, Video, Calendar, Map, CheckSquare, MessageSquare, Briefcase, Truck, HardDrive, Cpu, 
    Layers, Search, Globe, CreditCard, Wrench, BarChart2, CheckCircle, Database, Building2, BrainCircuit, Book
} from 'lucide-react';

const ROUTE_CONFIG: Record<string, { title: string, subtitle: string, icon: any, bgClass: string }> = {
    // Admin Routes
    '/admin/dashboard': { title: 'Dashboard', subtitle: 'Platform overview and daily operations hub.', icon: LayoutDashboard, bgClass: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    '/admin/workforce': { title: 'Workforce', subtitle: 'Manage your entire team footprint and organization chart.', icon: Users, bgClass: 'bg-gradient-to-r from-violet-600 to-indigo-800' },
    '/admin/hr': { title: 'HR Operations', subtitle: 'Payroll staging, benefits tracking, and Gusto integration.', icon: ShieldCheck, bgClass: 'bg-gradient-to-r from-indigo-600 to-purple-600' },
    '/admin/estimator': { title: 'Price Book & Estimator', subtitle: 'Configure high-speed flat rate pricing and AI generation.', icon: Book, bgClass: 'bg-gradient-to-r from-indigo-600 to-cyan-600' },
    '/admin/proposals': { title: 'Estimates', subtitle: 'Build proposals, review active pipelines, and close deals.', icon: FileText, bgClass: 'bg-gradient-to-r from-emerald-600 to-teal-600' },
    '/admin/sales': { title: 'Sales Pipeline', subtitle: 'Manage leads and view active contract conversions.', icon: TrendingUp, bgClass: 'bg-gradient-to-r from-green-600 to-emerald-700' },
    '/admin/timesheets': { title: 'Time Tracking', subtitle: 'Review shift logs, approve hours, and monitor PTO.', icon: Calendar, bgClass: 'bg-gradient-to-r from-amber-600 to-orange-600' },
    '/admin/dispatch': { title: 'Dispatch Core', subtitle: 'Route jobs, assign technicians, and monitor map movements.', icon: Map, bgClass: 'bg-gradient-to-r from-red-600 to-orange-600' },
    '/admin/inventory': { title: 'Asset Ledger', subtitle: 'Track equipment, parts, and warehouse distributions.', icon: Box, bgClass: 'bg-gradient-to-r from-sky-500 to-blue-600' },
    '/admin/settings': { title: 'Configuration', subtitle: 'Manage platform behavior, integrations, and global toggles.', icon: Settings, bgClass: 'bg-gradient-to-r from-slate-600 to-gray-800' },
    '/admin/training': { title: 'Training Hub', subtitle: 'Interactive guides and onboarding workflows.', icon: Video, bgClass: 'bg-gradient-to-r from-fuchsia-600 to-pink-600' },
    '/admin/financials': { title: 'Financials', subtitle: 'Accounts receivable, invoice tracking, and revenue.', icon: CreditCard, bgClass: 'bg-gradient-to-r from-emerald-700 to-green-800' },
    '/admin/maintenance': { title: 'Maintenance', subtitle: 'Scheduled service agreements and recurring truck rolls.', icon: Wrench, bgClass: 'bg-gradient-to-r from-cyan-600 to-teal-700' },
    '/admin/operations': { title: 'Operations', subtitle: 'Deep dive into raw ticket flows and technical assignments.', icon: CheckCircle, bgClass: 'bg-gradient-to-r from-blue-700 to-sky-800' },
    '/admin/customers': { title: 'Customer Center', subtitle: 'CRM directory, service locations, and contact records.', icon: Globe, bgClass: 'bg-gradient-to-r from-blue-500 to-indigo-500' },
    '/admin/records': { title: 'Records Depot', subtitle: 'Archived files, refrigerant logs, and historical data.', icon: Database, bgClass: 'bg-gradient-to-r from-stone-600 to-neutral-800' },
    '/admin/compliance': { title: 'Compliance Checks', subtitle: 'Audit trails and background verification records.', icon: FileText, bgClass: 'bg-gradient-to-r from-rose-600 to-red-700' },
    '/admin/hiring': { title: 'Hiring Pipeline', subtitle: 'Applicant tracking, interviews, and onboarding.', icon: Users, bgClass: 'bg-gradient-to-r from-pink-600 to-rose-600' },
    '/admin/reviews': { title: 'Reputation', subtitle: 'Track customer sentiment and external review platforms.', icon: MessageSquare, bgClass: 'bg-gradient-to-r from-amber-500 to-yellow-600' },
    '/admin/messages': { title: 'Comms Hub', subtitle: 'Internal messaging and organizational chat routing.', icon: MessageSquare, bgClass: 'bg-gradient-to-r from-blue-600 to-cyan-600' },
    '/admin/projects': { title: 'Project Engine', subtitle: 'Multi-day installations and large-scale deployments.', icon: Layers, bgClass: 'bg-gradient-to-r from-indigo-500 to-blue-600' },
    '/admin/marketing': { title: 'Marketing ROI', subtitle: 'Evaluate ad-spend efficiency and inbound conversion paths.', icon: BarChart2, bgClass: 'bg-gradient-to-r from-rose-500 to-red-600' },
    '/admin/social': { title: 'Social Media Hub', subtitle: 'Manage out-bound generic brand announcements.', icon: Globe, bgClass: 'bg-gradient-to-r from-fuchsia-500 to-purple-600' },
    '/admin/contracts': { title: 'Bid Optimization Tool', subtitle: '', icon: FileText, bgClass: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    '/admin/contractor-network': { title: 'Contractor Network', subtitle: 'Discover B2B opportunities, post RFPs, and connect with trusted subcontractors.', icon: Users, bgClass: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    '/admin/analytics': { title: 'Admin Analytics', subtitle: 'Deep operational and platform engagement metrics.', icon: BarChart2, bgClass: 'bg-gradient-to-r from-violet-600 to-purple-800' },
    
    // Master Admin Routes
    '/master/analytics': { title: 'Platform Analytics', subtitle: 'An overview of platform usage, billing, and API metrics from Google Cloud.', icon: BarChart2, bgClass: 'bg-gradient-to-r from-violet-800 to-fuchsia-800' },
    '/master/franchises': { title: 'Franchise Operations', subtitle: 'Manage tenant silos, custom branding, and BYOK configurations.', icon: Building2, bgClass: 'bg-gradient-to-r from-blue-800 to-slate-900' },
    '/master/compliance': { title: 'Compliance Registry', subtitle: 'Audit platform usage and background check integrations.', icon: CheckSquare, bgClass: 'bg-gradient-to-r from-rose-800 to-red-700' },
    '/master/organizations': { title: 'Tenants', subtitle: 'Platform organization routing and environment variables.', icon: Briefcase, bgClass: 'bg-gradient-to-r from-indigo-800 to-slate-900' },
    '/master/members': { title: 'Global Identity', subtitle: 'Cross-tenant global authentication ledger.', icon: ShieldCheck, bgClass: 'bg-gradient-to-r from-slate-700 to-neutral-900' },
    '/master/users': { title: 'Global User Registry', subtitle: 'Total platform user base and activity monitoring.', icon: Users, bgClass: 'bg-gradient-to-r from-blue-700 to-indigo-900' },
    '/master/customers': { title: 'Global CRM', subtitle: 'Platform-wide customer ledger.', icon: Globe, bgClass: 'bg-gradient-to-r from-teal-700 to-emerald-900' },
    '/master/billing': { title: 'Platform Ledger', subtitle: 'Stripe SaaS subscriptions and RevenueCat syncs.', icon: CreditCard, bgClass: 'bg-gradient-to-r from-emerald-700 to-green-900' },
    '/master/ai-usage': { title: 'AI Telemetry', subtitle: 'Real-time agent model usage, token limits, and task analysis.', icon: BrainCircuit, bgClass: 'bg-gradient-to-r from-purple-700 to-indigo-900' },
    '/master/integration-requests': { title: 'Integration Requests', subtitle: 'Monitor and manage stubbed integration activations.', icon: Box, bgClass: 'bg-gradient-to-r from-amber-600 to-orange-800' },
    '/master/storage-usage': { title: 'Blob Storage', subtitle: 'File hosting telemetry and multimedia quotas.', icon: HardDrive, bgClass: 'bg-gradient-to-r from-slate-600 to-slate-800' }
};

const PageHeader: React.FC = () => {
    const location = useLocation();

    // Skip rendering on the Training Hub since it already has a gigantic native hero section
    if (location.pathname === '/admin/training') return null;
    
    // Dynamic fallback generation based on the path string
    const fallbackPathSegment = location.pathname.split('/').pop() || '';
    const fallbackTitle = fallbackPathSegment.replace(/-/g, ' ').toUpperCase() || 'DASHBOARD';
    
    // Fallback logic for dynamic route gradients
    const gradients = ['bg-gradient-to-r from-emerald-600 to-teal-700', 'bg-gradient-to-r from-blue-600 to-indigo-700', 'bg-gradient-to-r from-violet-600 to-fuchsia-700', 'bg-gradient-to-r from-amber-600 to-orange-700', 'bg-gradient-to-r from-rose-600 to-pink-700', 'bg-gradient-to-r from-cyan-600 to-blue-700'];
    const randomGradient = gradients[fallbackTitle.length % gradients.length];
    
    const config = ROUTE_CONFIG[location.pathname] || {
        title: fallbackTitle,
        subtitle: 'Manage and review data for this architecture path.',
        icon: LayoutDashboard,
        bgClass: randomGradient
    };

    const Icon = config.icon;

    return (
        <div className={`relative overflow-hidden rounded-2xl ${config.bgClass} p-4 sm:p-7 shadow-lg mb-6 shrink-0 border border-black/10 dark:border-white/5`}>
            {/* Background Pattern - inline instead of external URL */}
            <div className="absolute inset-0 opacity-[0.04] page-header-dot-pattern"></div>
            
            {/* Watermark Icon */}
            <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 p-6 sm:p-8 opacity-[0.08] pointer-events-none">
                <Icon className="w-28 h-28 sm:w-40 sm:h-40 text-white" />
            </div>
            
            <div className="relative z-10 flex items-center gap-4 sm:gap-6">
                <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 backdrop-blur-md shadow-inner border border-white/20">
                    <Icon className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight capitalize">
                        {config.title}
                    </h1>
                    {config.subtitle && (
                        <p className="text-xs sm:text-sm text-white/70 max-w-xl font-medium mt-0.5 hidden sm:block">
                            {config.subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PageHeader;
