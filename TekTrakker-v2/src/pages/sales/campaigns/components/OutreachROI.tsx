
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, MousePointer2, Mail, MessageSquare, BarChart2 } from 'lucide-react';
import Card from 'components/ui/Card';
import { db } from 'lib/firebase';

interface AggregateStats {
    sent: number;
    opened: number;
    clicked: number;
    responded: number;
    converted: number;
}

const OutreachROI: React.FC = () => {
    const [stats, setStats] = useState<AggregateStats>({
        sent: 0, opened: 0, clicked: 0, responded: 0, converted: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsub = db.collection('sales_campaigns').onSnapshot(snap => {
            const aggregate = snap.docs.reduce((acc, doc) => {
                const data = doc.data();
                const s = data.stats || { sent: 0, opened: 0, clicked: 0, responded: 0 };
                return {
                    sent: acc.sent + (s.sent || 0),
                    opened: acc.opened + (s.opened || 0),
                    clicked: acc.clicked + (s.clicked || 0),
                    responded: acc.responded + (s.responded || 0),
                    converted: acc.converted + (s.converted || 0) // Assuming converted is tracked
                };
            }, { sent: 0, opened: 0, clicked: 0, responded: 0, converted: 0 });
            
            setStats(aggregate);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const formatPercent = (val: number, total: number) => total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';

    const cards = [
        { label: 'Total Outreach', value: stats.sent.toLocaleString(), change: '', icon: Users, color: 'blue' },
        { label: 'Open Rate', value: formatPercent(stats.opened, stats.sent), change: '', icon: Mail, color: 'purple' },
        { label: 'Click Rate', value: formatPercent(stats.clicked, stats.sent), change: '', icon: MousePointer2, color: 'orange' },
        { label: 'Total Responses', value: stats.responded.toLocaleString(), change: '', icon: Target, color: 'emerald' },
    ];

    if (isLoading) return <div className="p-4 md:p-10 text-center text-gray-400">Calculating ROI...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {cards.map(stat => (
                    <Card key={stat.label} className="relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 text-${stat.color}-500`}>
                            <stat.icon size={48} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <div className="mt-2 flex items-end gap-3">
                            <p className="text-3xl font-black">{stat.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold mb-6 flex items-center gap-2">
                        <BarChart2 size={18} className="text-primary-500"/> Conversion Funnel
                    </h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Sent', count: stats.sent, pct: 100, color: 'slate' },
                            { label: 'Opened', count: stats.opened, pct: parseFloat(formatPercent(stats.opened, stats.sent)), color: 'blue' },
                            { label: 'Clicked', count: stats.clicked, pct: parseFloat(formatPercent(stats.clicked, stats.sent)), color: 'purple' },
                            { label: 'Replied', count: stats.responded, pct: parseFloat(formatPercent(stats.responded, stats.sent)), color: 'indigo' },
                        ].map(step => (
                            <div key={step.label} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                                    <span className="text-slate-500">{step.label}</span>
                                    <span className="text-slate-900">{step.count.toLocaleString()} ({step.pct}%)</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full bg-primary-500 transition-all`} style={{ width: `${step.pct}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500"/> Performance Insights
                    </h3>
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 text-center">
                        <p className="text-slate-400 italic text-sm">Detailed channel performance will be available as more campaign data is collected from the Registry.</p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default OutreachROI;
