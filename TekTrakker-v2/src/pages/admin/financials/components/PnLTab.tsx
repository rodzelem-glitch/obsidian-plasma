import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Calculator, Printer, Calendar, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';

interface PnLTabProps {
    financialData: any;
    setIsReportModalOpen: (val: boolean) => void;
    startDate: string;
    endDate: string;
    setStartDate: (val: string) => void;
    setEndDate: (val: string) => void;
    preset: string;
    setPreset: (val: string) => void;
}

const PnLTab: React.FC<PnLTabProps> = ({ 
    financialData, 
    setIsReportModalOpen,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    preset,
    setPreset
}) => {
    const { t } = useLanguage();
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

    const handlePresetChange = (p: string) => {
        setPreset(p);
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();

        if (p === 'this_month') {
            setStartDate(new Date(y, m, 1).toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        } else if (p === 'last_month') {
            setStartDate(new Date(y, m - 1, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, m, 0).toISOString().split('T')[0]);
        } else if (p === 'this_quarter') {
            const quarterMonth = Math.floor(m / 3) * 3;
            setStartDate(new Date(y, quarterMonth, 1).toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        } else if (p === 'this_year') {
            setStartDate(new Date(y, 0, 1).toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        } else if (p === 'all_time') {
            setStartDate('');
            setEndDate('');
        }
    };

    const profitMargin = financialData.totalCollected > 0 
        ? (financialData.netIncome / financialData.totalCollected) * 100 
        : 0;

    return (
        <div className="space-y-6">
            {/* Control Panel Card */}
            <Card className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={16} className="text-blue-500" />
                            {t("Filter Statement Period")}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t("Choose predefined fiscal terms or select a custom range.")}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Preset Select Dropdown */}
                        <div className="min-w-[150px]">
                            <select
                                aria-label="Fiscal Period"
                                title="Fiscal Period"
                                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2.5 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                value={preset}
                                onChange={e => handlePresetChange(e.target.value)}
                            >
                                <option value="this_month">{t("This Month")}</option>
                                <option value="last_month">{t("Last Month")}</option>
                                <option value="this_quarter">{t("This Quarter")}</option>
                                <option value="this_year">{t("This Year")}</option>
                                <option value="all_time">{t("All Time")}</option>
                                <option value="custom">{t("Custom Range")}</option>
                            </select>
                        </div>

                        {/* Custom Date Inputs */}
                        <div className="flex items-center gap-2">
                            <input
                                aria-label="Start Date"
                                title="Start Date"
                                type="date"
                                className="text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
                                disabled={preset !== 'custom'}
                            />
                            <span className="text-slate-400 dark:text-slate-600 font-bold text-xs">&rarr;</span>
                            <input
                                aria-label="End Date"
                                title="End Date"
                                type="date"
                                className="text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
                                disabled={preset !== 'custom'}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Main Financial Report Sheet */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 sm:p-8 relative overflow-hidden">
                
                {/* Boardroom Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-2 border-slate-900 dark:border-slate-100 pb-5 mb-6 gap-4">
                    <div className="space-y-1.5">
                        <h3 className="font-black text-2xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                            <Calculator size={24} className="text-blue-500" />
                            {t("Statement of Profit & Loss")}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <span>{t("Accrual Basis")}</span>
                            <span>&bull;</span>
                            <span>
                                {startDate ? new Date(startDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : t("All Time")}
                                {' '}&mdash;{' '}
                                {endDate ? new Date(endDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : t("Today")}
                            </span>
                        </div>
                    </div>

                    <Button 
                        onClick={() => setIsReportModalOpen(true)} 
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center gap-2 border-none shadow-md"
                    >
                        <Printer size={14} /> {t("Professional PDF Report")}
                    </Button>
                </div>

                {/* Financial Statement Sheet Breakdown */}
                <div className="space-y-8 font-sans">
                    
                    {/* Income Section */}
                    <div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg flex justify-between items-center mb-3">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">{t("Revenues & Inflows")}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Category Total")}</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs px-2">
                            <div className="flex justify-between items-center py-3">
                                <span className="font-medium text-slate-600 dark:text-slate-400">{t("Gross Job Invoicing & Credits")}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(financialData.totalCollected)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-blue-50/20 dark:bg-blue-950/5 font-extrabold text-sm border-t border-slate-300 dark:border-slate-700">
                                <span className="text-slate-800 dark:text-slate-200 uppercase tracking-wide">{t("Total Operating Revenue")}</span>
                                <span className="text-blue-600 dark:text-blue-400 border-b-2 border-slate-900 dark:border-slate-200 pb-0.5">{fmt(financialData.totalCollected)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Expenses Section */}
                    <div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg flex justify-between items-center mb-3">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">{t("Operating Expenses")}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Tax Classification")}</span>
                        </div>
                        
                        {Object.keys(financialData.expenseCats).length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic p-4 text-center">{t("No expenses recorded in the selected period.")}</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800/40 text-xs px-2">
                                {Object.entries(financialData.expenseCats).map(([cat, amount]: any) => (
                                    <div key={cat} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800/40">
                                        <span className="font-medium text-slate-600 dark:text-slate-400">{t(cat)}</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center py-3 bg-red-50/20 dark:bg-red-950/5 font-extrabold text-sm border-t border-slate-300 dark:border-slate-700 mt-4 px-2">
                            <span className="text-slate-800 dark:text-slate-200 uppercase tracking-wide">{t("Total Operating Expenses")}</span>
                            <span className="text-red-500 border-b-2 border-slate-900 dark:border-slate-200 pb-0.5">({fmt(financialData.totalExpenses)})</span>
                        </div>
                    </div>

                    {/* Net Income Summary Banner */}
                    <div className="bg-slate-50 dark:bg-slate-800/20 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t("Corporate Net Summary")}</span>
                            <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                                {financialData.netIncome >= 0 ? (
                                    <>
                                        <TrendingUp size={18} className="text-emerald-500" />
                                        {t("Net Operating Surplus")}
                                    </>
                                ) : (
                                    <>
                                        <TrendingDown size={18} className="text-red-500" />
                                        {t("Net Operating Deficit")}
                                    </>
                                )}
                            </h4>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <span className="block text-[10px] text-slate-400 uppercase font-extrabold">{t("Net Income / Profit")}</span>
                                <span className={`text-2xl sm:text-3xl font-black ${financialData.netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'} border-b-4 border-double border-slate-800 dark:border-slate-200 pb-1`}>
                                    {fmt(financialData.netIncome)}
                                </span>
                            </div>

                            <div className="border-l border-slate-200 dark:border-slate-800 pl-8 text-right">
                                <span className="block text-[10px] text-slate-400 uppercase font-extrabold">{t("Operating Margin")}</span>
                                <span className={`text-xl sm:text-2xl font-black ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'} flex items-center justify-end gap-1 mt-1`}>
                                    {profitMargin.toFixed(1)}%
                                    <ArrowRight size={14} className="opacity-40" />
                                </span>
                            </div>
                        </div>

                    </div>

                    {financialData.totalPersonalExpenses > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-6 border border-amber-100 dark:border-amber-900/40 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fade-in">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-widest">{t("Personal Draw Summary")}</span>
                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                    {t("Personal Expenses")}
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                                    {t("Tracked personal items (e.g. personal meals/travel) excluded from corporate operating surplus and net income.")}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="block text-[10px] text-slate-400 uppercase font-extrabold">{t("Total Personal")}</span>
                                <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 border-b-4 border-double border-amber-500 dark:border-amber-400 pb-1">
                                    {fmt(financialData.totalPersonalExpenses)}
                                </span>
                            </div>
                        </div>
                    )}

                </div>

            </Card>
        </div>
    );
};

export default PnLTab;
