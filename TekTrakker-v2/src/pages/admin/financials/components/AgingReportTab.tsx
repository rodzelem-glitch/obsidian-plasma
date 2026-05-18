import React, { useMemo } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';

interface AgingReportTabProps {
    jobs: any[];
}

const AgingReportTab: React.FC<AgingReportTabProps> = ({ jobs }) => {
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

    const agingData = useMemo(() => {
        const unpaidJobs = jobs.filter(j => j.invoice && j.invoice.status !== 'Paid');
        const now = new Date().getTime();
        const buckets = {
            current: [] as any[],
            days30: [] as any[],
            days60: [] as any[],
            older: [] as any[]
        };

        unpaidJobs.forEach(job => {
            const date = new Date(job.appointmentTime).getTime();
            const daysOverdue = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            
            if (daysOverdue <= 30) buckets.current.push(job);
            else if (daysOverdue <= 60) buckets.days30.push(job);
            else if (daysOverdue <= 90) buckets.days60.push(job);
            else buckets.older.push(job);
        });

        const totals = {
            current: buckets.current.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0), 0),
            days30: buckets.days30.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0), 0),
            days60: buckets.days60.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0), 0),
            older: buckets.older.reduce((sum, j) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0), 0)
        };

        return { buckets, totals };
    }, [jobs]);

    const totalReceivables = agingData.totals.current + agingData.totals.days30 + agingData.totals.days60 + agingData.totals.older;

    return (
        <Card>
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Accounts Receivable Aging Summary</h3>
                <p className="text-sm text-slate-500">Overview of unpaid invoices categorized by time since creation.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-bold text-slate-500 uppercase">0-30 Days</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{fmt(agingData.totals.current)}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/30">
                    <div className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase">31-60 Days</div>
                    <div className="text-lg font-black text-yellow-700 dark:text-yellow-400">{fmt(agingData.totals.days30)}</div>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/30">
                    <div className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase">61-90 Days</div>
                    <div className="text-lg font-black text-orange-700 dark:text-orange-400">{fmt(agingData.totals.days60)}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
                    <div className="text-xs font-bold text-red-600 dark:text-red-500 uppercase">90+ Days</div>
                    <div className="text-lg font-black text-red-700 dark:text-red-400">{fmt(agingData.totals.older)}</div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase">Total Unpaid</div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{fmt(totalReceivables)}</div>
                </div>
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white mb-4 mt-8">Aging Details</h4>
            <Table headers={['Customer', 'Invoice #', 'Date', 'Age (Days)', 'Amount']}>
                {['current', 'days30', 'days60', 'older'].flatMap((bucketKey) => {
                    return agingData.buckets[bucketKey as keyof typeof agingData.buckets].map((job: any) => {
                        const amt = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
                        const date = new Date(job.appointmentTime).getTime();
                        const days = Math.floor((new Date().getTime() - date) / (1000 * 60 * 60 * 24));
                        return (
                            <tr key={job.id} className="bg-white dark:bg-slate-900/50">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{job.customerName}</td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{job.invoice.id}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${days > 90 ? 'bg-red-100 text-red-800' : days > 60 ? 'bg-orange-100 text-orange-800' : days > 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>
                                        {days} Days
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{fmt(amt)}</td>
                            </tr>
                        );
                    });
                })}
            </Table>
        </Card>
    );
};

export default AgingReportTab;
