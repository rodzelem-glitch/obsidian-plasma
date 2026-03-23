
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    TrendingUp, Target, Megaphone, 
    DollarSign, Sparkles, Wand2, 
    ArrowUpRight, ArrowDownRight, RefreshCw, Layers
} from 'lucide-react';
import type { Lead, Job } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';

const MarketingROI: React.FC = () => {
    const { state } = useAppContext();
    const [isThinking, setIsThinking] = useState(false);
    const [aiInsights, setAiInsights] = useState<string | null>(null);

    // Calculate Marketing Stats
    const stats = useMemo(() => {
        const jobs = state.jobs || [];
        const leads = state.leads || [];
        
        const sources: Record<string, { leads: number, jobs: number, revenue: number, cost: number }> = {};
        
        const commonSources = ['Google Ads', 'Facebook', 'Yelp', 'Referral', 'LSAs', 'Direct Mail', 'Organic Search'];
        commonSources.forEach(s => sources[s] = { leads: 0, jobs: 0, revenue: 0, cost: 0 });

        leads.forEach(l => {
            if (l.source && sources[l.source]) {
                sources[l.source].leads++;
            }
        });

        jobs.forEach(j => {
            if (j.source && sources[j.source]) {
                sources[j.source].jobs++;
                sources[j.source].revenue += (j.total || 0);
            }
        });

        if (sources['Google Ads']) sources['Google Ads'].cost = 1500;
        if (sources['Facebook']) sources['Facebook'].cost = 800;
        if (sources['Yelp']) sources['Yelp'].cost = 400;

        return Object.entries(sources).map(([name, data]) => ({
            name,
            ...data,
            roi: data.cost > 0 ? ((data.revenue - data.cost) / data.cost) * 100 : 0,
            conversion: data.leads > 0 ? (data.jobs / data.leads) * 100 : 0
        })).filter(s => s.leads > 0 || s.jobs > 0).sort((a, b) => b.revenue - a.revenue);
    }, [state.jobs, state.leads]);

    const totalRevenue = useMemo(() => stats.reduce((sum, s) => sum + s.revenue, 0), [stats]);
    const totalSpend = useMemo(() => stats.reduce((sum, s) => sum + s.cost, 0), [stats]);

    const handleGenerateInsights = async () => {
        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            const prompt = `
                Analyze this marketing performance data for a service company:
                Total Ad Spend: $${totalSpend}
                Total Revenue: $${totalRevenue}
                Data breakdown by source: ${JSON.stringify(stats)}

                Provide 3 actionable insights on where to reallocate budget to maximize ROI. 
                Keep it concise and professional. Return as HTML.
            `;

            const result = await callGeminiAI({ 
                prompt,
                modelName: "gemini-3-pro-preview" 
            });
            const data = result.data as { text: string };
            setAiInsights(data.text);
        } catch (error) {
            console.error("Marketing AI Error:", error);
            alert("Error generating insights.");
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black flex items-center gap-2"><Megaphone /> Marketing ROI</h2>
                    <p className="text-slate-500 font-medium">Track lead sources, ad spend, and conversion value.</p>
                </div>
                <Button variant="secondary" onClick={() => window.print()} className="hidden md:flex">
                    Export Report
                </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 bg-primary-600 text-white shadow-xl shadow-primary-500/20">
                    <p className="text-primary-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Ad Revenue</p>
                    <h3 className="text-3xl font-black">${totalRevenue.toLocaleString()}</h3>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                        <ArrowUpRight size={14}/> +12% from last month
                    </div>
                </Card>
                <Card className="p-6">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Estimated Ad Spend</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">${totalSpend.toLocaleString()}</h3>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500">
                        <ArrowUpRight size={14}/> +5% Budget Used
                    </div>
                </Card>
                <Card className="p-6">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Avg. Cost Per Lead</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">$42.50</h3>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <ArrowDownRight size={14}/> -8% Efficiency
                    </div>
                </Card>
                <Card className="p-6">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Blended ROI</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                        {totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(0) : 0}%
                    </h3>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <TrendingUp size={14}/> Target: 300%
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Performance Table */}
                <Card className="lg:col-span-2 p-0 overflow-hidden border-2 border-slate-100 dark:border-slate-800">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-black text-lg flex items-center gap-2"><Target size={20} className="text-primary-500"/> Source Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Source</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Leads</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Jobs</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Revenue</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">ROI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.map((s, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-6 py-4"><span className="font-black text-slate-900 dark:text-white">{s.name}</span></td>
                                        <td className="px-6 py-4 font-bold text-slate-600">{s.leads}</td>
                                        <td className="px-6 py-4 font-bold text-slate-600">{s.jobs}</td>
                                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white">${s.revenue.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${s.roi > 200 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {s.roi.toFixed(0)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* AI Insights Panel */}
                <div className="space-y-6">
                    <Card className="p-6 border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-900/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-indigo-600 flex items-center gap-2"><Sparkles size={20}/> Marketing Strategist</h3>
                            <Button 
                                size="sm" 
                                className="bg-indigo-600 text-white"
                                onClick={handleGenerateInsights}
                                disabled={isThinking}
                            >
                                {isThinking ? <RefreshCw size={14} className="animate-spin"/> : <Wand2 size={14}/>}
                            </Button>
                        </div>
                        
                        {aiInsights ? (
                            <div className="prose dark:prose-invert prose-sm max-w-none animate-fade-in" dangerouslySetInnerHTML={{ __html: aiInsights }} />
                        ) : (
                            <div className="text-center py-10 text-slate-400">
                                <Layers size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-xs font-bold px-4 md:px-8 leading-relaxed">Click the button to have AI analyze your source performance and suggest budget shifts.</p>
                            </div>
                        )}
                    </Card>

                    <Card className="p-6">
                        <h4 className="font-black text-xs uppercase text-slate-400 mb-4 tracking-widest">Conversion Funnel</h4>
                        <div className="space-y-4">
                            {[
                                { label: 'Total Leads', count: state.leads?.length || 0, color: 'bg-primary-500' },
                                { label: 'Estimates Sent', count: state.proposals?.length || 0, color: 'bg-primary-600' },
                                { label: 'Jobs Booked', count: state.jobs?.length || 0, color: 'bg-primary-700' },
                            ].map((item, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                        <span className="text-slate-500">{item.label}</span>
                                        <span className="text-slate-900 dark:text-white">{item.count}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${item.color}`} 
                                            style={{ width: `${Math.min(100, (item.count / (state.leads?.length || 1)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default MarketingROI;
