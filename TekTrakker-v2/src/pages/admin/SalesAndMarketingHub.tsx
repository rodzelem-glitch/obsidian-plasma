import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from 'components/ui/Card';
import { Code, BarChart3, Share2, FileText, ArrowRight, ArrowLeft } from 'lucide-react';

const SalesAndMarketingHub: React.FC = () => {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Campaign Studio',
            description: 'Design and dispatch targeted email and SMS campaigns.',
            icon: <Code className="w-8 h-8 text-indigo-500" />,
            path: '/admin/campaigns',
            color: 'bg-indigo-50 dark:bg-indigo-900/30'
        },
        {
            title: 'Analytics',
            description: 'Track campaign performance, open rates, and engagement.',
            icon: <BarChart3 className="w-8 h-8 text-emerald-500" />,
            path: '/admin/campaigns?tab=analytics',
            color: 'bg-emerald-50 dark:bg-emerald-900/30'
        },
        {
            title: 'Social Media Hub',
            description: 'Manage out-bound generic brand announcements.',
            icon: <Share2 className="w-8 h-8 text-blue-500" />,
            path: '/admin/social',
            color: 'bg-blue-50 dark:bg-blue-900/30'
        },
        {
            title: 'Blog & Profiles',
            description: 'Manage company blog posts, articles, and public profiles.',
            icon: <FileText className="w-8 h-8 text-amber-500" />,
            path: '/admin/blog',
            color: 'bg-amber-50 dark:bg-amber-900/30'
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 px-4 mt-8 md:mt-2">
            <header className="mb-8 flex items-start gap-4">
                <button onClick={() => navigate(-1)} title="Go Back" aria-label="Go Back" className="mt-1 p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Sales & Marketing Hub</h2>
                <p className="text-slate-500 dark:text-slate-400">Manage your outreach, campaigns, and public presence.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {modules.map((mod, idx) => (
                    <Card 
                        key={idx} 
                        className="p-6 cursor-pointer hover:border-primary-500 transition-all hover:shadow-md group flex flex-col justify-between"
                        onClick={() => navigate(mod.path)}
                    >
                        <div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${mod.color}`}>
                                {mod.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{mod.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{mod.description}</p>
                        </div>
                        <div className="flex items-center text-sm font-bold text-primary-600 group-hover:text-primary-700 transition-colors">
                            Launch Module <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default SalesAndMarketingHub;
