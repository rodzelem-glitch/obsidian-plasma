import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Toggle from 'components/ui/Toggle';
import { 
    DollarSign, 
    TrendingUp, 
    TrendingDown, 
    Package, 
    Clock, 
    AlertTriangle, 
    BarChart3, 
    Users,
    Filter,
    Activity,
    ArrowUpRight
} from 'lucide-react';
import type { ShiftLog, Job, User, InventoryItem, MarketingCampaign } from 'types';

const AnalyticsMaster: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    
    const [excludeTest, setExcludeTest] = useState(true);

    // Helper to check if item is test data
    const isTestItem = (name: string) => {
        if (!name) return false;
        const lower = name.toLowerCase();
        return lower.includes('test') || lower.includes('demo') || lower.includes('sample');
    };

    // Filtered Jobs
    const filteredJobs = useMemo(() => {
        return (state.jobs as Job[]).filter(j => 
            !excludeTest || (!isTestItem(j.customerName) && !isTestItem(j.specialInstructions))
        );
    }, [state.jobs, excludeTest]);

    // ------------------------------------------------------------------
    // 1. FINANCIAL HEALTH CALCULATIONS
    // ------------------------------------------------------------------
    const financialData = useMemo(() => {
        const revenue = filteredJobs
            .filter((j: Job) => j.invoice?.status === 'Paid')
            .reduce((sum: number, j: Job) => sum + (j.invoice.totalAmount || j.invoice.amount || 0), 0);

        const expenses = (state.expenses || [])
            .filter(e => !excludeTest || (!isTestItem(e.description) && !isTestItem(e.vendor)))
            .reduce((sum: number, e: any) => sum + e.amount, 0);

        const inventoryValue = (state.inventory as InventoryItem[])
             .filter(i => !excludeTest || !isTestItem(i.name))
             .reduce((sum: number, item: InventoryItem) => sum + (item.cost * item.quantity), 0);

        const profit = revenue - expenses;

        return { revenue, expenses, inventoryValue, profit };
    }, [filteredJobs, state.expenses, state.inventory, excludeTest]);

    // ------------------------------------------------------------------
    // 2. LABOR EFFICIENCY CALCULATIONS
    // ------------------------------------------------------------------
    const laborData = useMemo(() => {
        let billableHours = 0;
        filteredJobs.forEach((job: Job) => {
            if (job.invoice?.items) {
                job.invoice.items.forEach((item: any) => {
                    if (item.type === 'Labor') {
                        billableHours += (item.quantity || 0);
                    }
                });
            }
        });

        let clockedHours = 0;
        const allShiftLogs = Object.values(state.shiftLogs).flat() as ShiftLog[];
        
        allShiftLogs.forEach((log: ShiftLog) => {
            if (log.clockIn && log.clockOut) {
                const start = new Date(log.clockIn).getTime();
                const end = new Date(log.clockOut).getTime();
                const durationHours = (end - start) / (1000 * 60 * 60);
                if (durationHours > 0) clockedHours += durationHours;
            }
        });

        const efficiencyRate = clockedHours > 0 ? (billableHours / clockedHours) * 100 : 0;
        const wastedTime = Math.max(0, clockedHours - billableHours);

        return { billableHours, clockedHours, efficiencyRate, wastedTime };
    }, [filteredJobs, state.shiftLogs]);

    // ------------------------------------------------------------------
    // 3. LOSS & WASTE TRACKING
    // ------------------------------------------------------------------
    const wasteData = useMemo(() => {
        const usersWithPay = (state.users as User[]).filter((u: User) => {
            const rate = typeof u.payRate === 'number' ? u.payRate : parseFloat(u.payRate);
            return (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor') && !isNaN(rate) && rate > 0;
        });
        const totalPayRate = usersWithPay.reduce((sum: number, u: User) => {
            const rate = typeof u.payRate === 'number' ? u.payRate : parseFloat(u.payRate);
            return sum + (isNaN(rate) ? 0 : rate);
        }, 0);
        const avgPayRate = usersWithPay.length > 0 ? totalPayRate / usersWithPay.length : 0;

        const shrinkageCost = financialData.inventoryValue * 0.03; 
        const nonBillableLaborCost = laborData.wastedTime * avgPayRate;
        const totalEstimatedLoss = shrinkageCost + nonBillableLaborCost;

        return { shrinkageCost, nonBillableLaborCost, totalEstimatedLoss };
    }, [state.users, financialData.inventoryValue, laborData.wastedTime]);

    // ------------------------------------------------------------------
    // 4. MARKETING PERFORMANCE
    // ------------------------------------------------------------------
    const marketingData = useMemo(() => {
        let totalSpend = 0;
        let totalAttributedRevenue = 0;

        (state.campaigns as MarketingCampaign[])
            .filter(c => !excludeTest || !isTestItem(c.name))
            .forEach((camp: MarketingCampaign) => {
                totalSpend += camp.spend;
                
                const campaignJobs = filteredJobs.filter((j: Job) => 
                    j.source && j.source.toLowerCase().includes((camp.name || '').toLowerCase()) && j.invoice?.status === 'Paid'
                );
                
                const revenue = campaignJobs.reduce((sum: number, j: Job) => sum + (j.invoice.totalAmount || j.invoice.amount || 0), 0);
                totalAttributedRevenue += revenue;
            });

        const roi = totalSpend > 0 ? ((totalAttributedRevenue - totalSpend) / totalSpend) * 100 : 0;

        return { totalSpend, totalAttributedRevenue, roi };
    }, [state.campaigns, filteredJobs, excludeTest]);

    // ------------------------------------------------------------------
    // 5. TECHNICIAN LEADERBOARD
    // ------------------------------------------------------------------
    const techLeaderboard = useMemo(() => {
        const techMap: Record<string, number> = {};

        filteredJobs.forEach((job: Job) => {
            if (job.assignedTechnicianId && job.invoice?.status === 'Paid') {
                const amount = job.invoice.totalAmount || job.invoice.amount || 0;
                techMap[job.assignedTechnicianId] = (techMap[job.assignedTechnicianId] || 0) + amount;
            }
        });

        return Object.entries(techMap)
            .map(([id, revenue]) => {
                const user = (state.users as User[]).find((u: User) => u.id === id);
                return {
                    id,
                    name: user ? `${user.firstName} ${user.lastName}` : 'Unknown Tech',
                    revenue
                };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); 
    }, [filteredJobs, state.users]);


    // Helper for Currency Formatting
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Executive Insights</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Core business performance and operational efficiency.</p>
                </div>
                {state.currentUser?.role === 'master_admin' && (
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-slate-400"/>
                            <span className="text-[10px] font-black uppercase text-slate-400">Filters</span>
                        </div>
                        <Toggle label="Hide Test Data" enabled={excludeTest} onChange={setExcludeTest} />
                    </div>
                )}
            </header>

            {/* 1. FINANCIAL HEALTH ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card 
                    className="border-l-4 border-emerald-500 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => navigate('/admin/financials')}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(financialData.profit)}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </Card>

                <Card 
                    className="border-l-4 border-sky-500 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => navigate('/admin/financials')}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(financialData.revenue)}</p>
                        </div>
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-xl text-sky-600">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </Card>

                <Card 
                    className="border-l-4 border-rose-500 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => navigate('/admin/financials')}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
                            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{formatCurrency(financialData.expenses)}</p>
                        </div>
                        <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600">
                            <TrendingDown size={20} />
                        </div>
                    </div>
                </Card>

                <Card 
                    className="border-l-4 border-purple-500 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => navigate('/admin/records?tab=pricebook')}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Value</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(financialData.inventoryValue)}</p>
                        </div>
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600">
                            <Package size={20} />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 2. LABOR EFFICIENCY */}
                <Card className="flex flex-col justify-between" onClick={() => navigate('/admin/workforce')}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="text-slate-400" size={18} />
                            <h3 className="font-black uppercase tracking-widest text-xs">Labor Efficiency</h3>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-300"/>
                    </div>
                    
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <span className="text-5xl font-black text-slate-900 dark:text-white">{laborData.efficiencyRate.toFixed(1)}%</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Operational Utilization</p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-xs font-bold text-slate-500">Billable: <span className="text-emerald-600">{laborData.billableHours.toFixed(1)} hrs</span></p>
                            <p className="text-xs font-bold text-slate-500">Clocked: <span className="text-sky-600">{laborData.clockedHours.toFixed(1)} hrs</span></p>
                        </div>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mb-6 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                                laborData.efficiencyRate > 75 ? 'bg-emerald-500' : laborData.efficiencyRate > 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(laborData.efficiencyRate, 100)}%` }}
                        ></div>
                    </div>

                    <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                             <Clock size={16}/>
                             <span className="text-xs font-black uppercase tracking-widest">Non-Billable Leakage</span>
                        </div>
                        <span className="text-xl font-black text-rose-700 dark:text-rose-400">{laborData.wastedTime.toFixed(1)} hrs</span>
                    </div>
                </Card>

                {/* 3. LOSS & WASTE TRACKING */}
                <Card className="flex flex-col h-full" onClick={() => navigate('/admin/records')}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" size={18} />
                            <h3 className="font-black uppercase tracking-widest text-xs">Margin Leakage Estimate</h3>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-300"/>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">Inventory Shrinkage</p>
                                <p className="text-[10px] font-bold text-slate-400">Estimated 3% loss on stock</p>
                            </div>
                            <p className="text-lg font-black text-rose-600">-{formatCurrency(wasteData.shrinkageCost)}</p>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">Unproductive Labor</p>
                                <p className="text-[10px] font-bold text-slate-400">Wasted hours × Avg Pay Rate</p>
                            </div>
                            <p className="text-lg font-black text-orange-600">-{formatCurrency(wasteData.nonBillableLaborCost)}</p>
                        </div>

                        <div className="flex justify-between items-center pt-4">
                            <p className="font-black text-xs text-slate-500 uppercase tracking-widest">Total Net Leakage</p>
                            <p className="text-3xl font-black text-rose-700 dark:text-rose-500">-{formatCurrency(wasteData.totalEstimatedLoss)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 4. MARKETING PERFORMANCE */}
                <Card onClick={() => navigate('/admin/marketing')} className="border-t-4 border-primary-600">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="text-primary-600" size={18} />
                            <h3 className="font-black uppercase tracking-widest text-xs">Acquisition ROI</h3>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-300"/>
                    </div>

                    <div className="flex items-center justify-center py-4">
                        <div className="text-center relative">
                            <div className="absolute -inset-8 bg-primary-500/5 blur-3xl rounded-full"></div>
                            <span className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {marketingData.roi.toFixed(0)}%
                            </span>
                            <p className="text-xs font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">Efficiency Multiplier</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Marketing Spend</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(marketingData.totalSpend)}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Attributed Rev</p>
                            <p className="text-xl font-black text-emerald-600">{formatCurrency(marketingData.totalAttributedRevenue)}</p>
                        </div>
                    </div>
                </Card>

                {/* 5. TECHNICIAN LEADERBOARD */}
                <Card className="border-t-4 border-amber-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <Users className="text-amber-500" size={18} />
                            <h3 className="font-black uppercase tracking-widest text-xs">Revenue Top Producers</h3>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-300"/>
                    </div>

                    <div className="space-y-3">
                        {techLeaderboard.length > 0 ? techLeaderboard.map((tech: any, index: number) => (
                            <div key={tech.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-amber-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${
                                        index === 0 ? 'bg-amber-100 text-amber-700' : 
                                        index === 1 ? 'bg-slate-200 text-slate-700' : 
                                        index === 2 ? 'bg-orange-100 text-orange-800' : 
                                        'bg-white dark:bg-slate-800 text-slate-400'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white text-sm">{tech.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Field Producer</p>
                                    </div>
                                </div>
                                <span className="font-black text-emerald-600 text-lg">{formatCurrency(tech.revenue)}</span>
                            </div>
                        )) : (
                            <div className="text-center py-20 text-slate-400 font-medium italic bg-slate-50 rounded-2xl">Awaiting performance data...</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsMaster;
