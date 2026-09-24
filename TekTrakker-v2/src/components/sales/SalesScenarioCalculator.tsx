import React, { useState, useMemo } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import type { CommissionSettings } from '../../types';
import { DEFAULT_COMMISSION_RULES } from '../../utils/salesContractGenerator';
import { 
    Calculator, DollarSign, TrendingUp, Award, Zap, 
    Calendar, ShieldCheck, Sparkles, CheckCircle, ArrowRight, Layers, HelpCircle
} from 'lucide-react';

interface SalesScenarioCalculatorProps {
    rules?: CommissionSettings;
    repName?: string;
    isModal?: boolean;
}

export const SalesScenarioCalculator: React.FC<SalesScenarioCalculatorProps> = ({ 
    rules = DEFAULT_COMMISSION_RULES,
    repName,
    isModal = false
}) => {
    // Interactive state
    const [dealsPerMonth, setDealsPerMonth] = useState<number>(8);
    const [avgPlanMrr, setAvgPlanMrr] = useState<number>(299);
    const [annualMixPct, setAnnualMixPct] = useState<number>(30); // 30% upfront annual

    const effectiveRules = rules || DEFAULT_COMMISSION_RULES;
    const baseRate = effectiveRules.baseRate ?? 0.25;
    const kickerRate = effectiveRules.annualPrepaidKickerRate ?? 0.05;
    const year2Rate = (effectiveRules.year2Rate !== undefined ? effectiveRules.year2Rate : effectiveRules.renewalRate) ?? 0.05;
    const lifetimeRate = effectiveRules.lifetimeRate ?? 0.03;

    // Plan Presets
    const presets = [
        { name: 'Starter', mrr: 199 },
        { name: 'Professional', mrr: 299 },
        { name: 'Business Pro', mrr: 399 },
        { name: 'Enterprise', mrr: 499 }
    ];

    // Calculations
    const calculations = useMemo(() => {
        const monthlyDeals = Math.round(dealsPerMonth * (1 - (annualMixPct / 100)));
        const annualDeals = dealsPerMonth - monthlyDeals;

        // New Monthly MRR added
        const monthlyMrr = dealsPerMonth * avgPlanMrr;
        const newArrAnnualized = monthlyMrr * 12;

        // 1. Determine Accelerator Rate
        const accelerators = effectiveRules.monthlyMrrAccelerators && effectiveRules.monthlyMrrAccelerators.length > 0
            ? [...effectiveRules.monthlyMrrAccelerators].sort((a, b) => b.minMrr - a.minMrr)
            : [
                { minMrr: 5000, rate: 0.30 },
                { minMrr: 2500, maxMrr: 4999.99, rate: 0.275 },
                { minMrr: 0, maxMrr: 2499.99, rate: 0.25 }
            ];

        let matchedAccel = accelerators.find(a => monthlyMrr >= a.minMrr) || { rate: baseRate, minMrr: 0 };
        const earnedRate = matchedAccel.rate;

        // Distance to next accelerator tier
        const sortedAsc = [...accelerators].sort((a, b) => a.minMrr - b.minMrr);
        const nextTier = sortedAsc.find(a => a.minMrr > monthlyMrr);
        const distanceToNextTier = nextTier ? nextTier.minMrr - monthlyMrr : 0;

        // 2. Annual Prepaid Kicker Rate
        const annualRate = earnedRate + kickerRate;

        // 3. First Month Cash Commission
        const monthlyDealsComm = (monthlyDeals * avgPlanMrr) * earnedRate;
        const annualDealsUpfrontComm = (annualDeals * (avgPlanMrr * 12)) * annualRate;
        const totalMonth1Commission = monthlyDealsComm + annualDealsUpfrontComm;

        // 4. Monthly Performance Cash Bonus (Highest Tier Achieved)
        const bonusTiers = effectiveRules.monthlyMrrBonuses && effectiveRules.monthlyMrrBonuses.length > 0
            ? [...effectiveRules.monthlyMrrBonuses].sort((a, b) => b.mrr - a.mrr)
            : [
                { mrr: 20000, bonus: 7500 },
                { mrr: 15000, bonus: 4500 },
                { mrr: 10000, bonus: 2500 },
                { mrr: 7500, bonus: 1500 },
                { mrr: 5000, bonus: 750 },
                { mrr: 2500, bonus: 250 }
            ];

        const earnedMonthlyBonusObj = bonusTiers.find(b => monthlyMrr >= b.mrr);
        const earnedMonthlyBonus = earnedMonthlyBonusObj ? earnedMonthlyBonusObj.bonus : 0;

        const nextBonusTier = [...bonusTiers].sort((a, b) => a.mrr - b.mrr).find(b => b.mrr > monthlyMrr);
        const distanceToNextBonus = nextBonusTier ? nextBonusTier.mrr - monthlyMrr : 0;

        // Total Take-Home for Month 1
        const totalMonth1TakeHome = totalMonth1Commission + earnedMonthlyBonus;

        // 5. 12-Month Sustained Projection
        // Monthly subscriptions compound over 12 months (sum of 1 to 12 = 78 months of cohort fees)
        const annualCohortMonthlySubs = monthlyDealsComm * 78;
        const annualCohortAnnualSubs = annualDealsUpfrontComm * 12;
        const totalAnnualCommission = annualCohortMonthlySubs + annualCohortAnnualSubs;
        const totalAnnualMonthlyBonuses = earnedMonthlyBonus * 12;

        // Annual Production ARR Bonus
        const totalArrCreated = newArrAnnualized;
        const arrBonusTiers = effectiveRules.annualArrBonuses && effectiveRules.annualArrBonuses.length > 0
            ? [...effectiveRules.annualArrBonuses].sort((a, b) => b.arr - a.arr)
            : [
                { arr: 150000, bonus: 40000 },
                { arr: 100000, bonus: 25000 },
                { arr: 60000, bonus: 12000 },
                { arr: 30000, bonus: 5000 }
            ];
        const earnedArrBonusObj = arrBonusTiers.find(ab => totalArrCreated >= ab.arr);
        const earnedArrBonus = earnedArrBonusObj ? earnedArrBonusObj.bonus : 0;

        const totalYear1Gross = totalAnnualCommission + totalAnnualMonthlyBonuses + earnedArrBonus;

        // 6. Passive Residual Income Projections (Years 2 & 3+)
        // Cumulative active book of business after 1 year: (dealsPerMonth * 12) clients
        const totalClientsYearEnd = dealsPerMonth * 12;
        const totalBookMrr = totalClientsYearEnd * avgPlanMrr;

        const year2MonthlyResidual = totalBookMrr * year2Rate;
        const year2AnnualResidual = year2MonthlyResidual * 12;

        const year3MonthlyResidual = totalBookMrr * lifetimeRate;
        const year3AnnualResidual = year3MonthlyResidual * 12;

        return {
            monthlyDeals,
            annualDeals,
            monthlyMrr,
            newArrAnnualized,
            earnedRate,
            annualRate,
            distanceToNextTier,
            nextTier,
            totalMonth1Commission,
            earnedMonthlyBonus,
            distanceToNextBonus,
            nextBonusTier,
            totalMonth1TakeHome,
            totalYear1Gross,
            totalAnnualCommission,
            totalAnnualMonthlyBonuses,
            earnedArrBonus,
            totalClientsYearEnd,
            totalBookMrr,
            year2MonthlyResidual,
            year2AnnualResidual,
            year3MonthlyResidual,
            year3AnnualResidual
        };
    }, [dealsPerMonth, avgPlanMrr, annualMixPct, effectiveRules, baseRate, kickerRate, year2Rate, lifetimeRate]);

    const formatCurrency = (n: number) => `$${Math.round(n).toLocaleString()}`;

    return (
        <div className={`space-y-6 ${isModal ? 'p-1' : ''}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500 text-white rounded-lg shadow-sm">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg sm:text-xl">
                                Sales Compensation & Earnings Simulator
                            </h3>
                            <p className="text-xs text-slate-500">
                                {repName ? `Custom scenario projection for ${repName}` : 'Interactive what-if calculator based on your live compensation plan'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Base: {(baseRate * 100).toFixed(1)}% | Kicker: +{(kickerRate * 100).toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* Interactive Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                {/* 1. Deals Closed Per Month */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            New Deals / Month
                        </label>
                        <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                            {dealsPerMonth} deals
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="25" 
                        step="1" 
                        value={dealsPerMonth} 
                        onChange={e => setDealsPerMonth(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>1 deal</span>
                        <span>10 deals</span>
                        <span>25 deals</span>
                    </div>
                </div>

                {/* 2. Average Monthly Subscription Price */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Avg Plan MRR ($/mo)
                        </label>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                            ${avgPlanMrr}/mo
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="149" 
                        max="699" 
                        step="25" 
                        value={avgPlanMrr} 
                        onChange={e => setAvgPlanMrr(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex gap-1 pt-0.5">
                        {presets.map(p => (
                            <button
                                key={p.name}
                                type="button"
                                onClick={() => setAvgPlanMrr(p.mrr)}
                                className={`text-[10px] flex-1 py-1 rounded font-semibold transition-all ${
                                    avgPlanMrr === p.mrr 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {p.name} (${p.mrr})
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Upfront Annual Prepayment Mix */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            Annual Upfront Mix <span className="text-[10px] text-amber-600 font-bold">(+5% Kicker!)</span>
                        </label>
                        <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                            {annualMixPct}% Annual
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="10" 
                        value={annualMixPct} 
                        onChange={e => setAnnualMixPct(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>0% (All Monthly)</span>
                        <span>50%</span>
                        <span>100% (All Annual)</span>
                    </div>
                </div>
            </div>

            {/* Performance Tier Callout Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* MRR Production */}
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">Monthly MRR Added</span>
                    <div className="text-xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
                        {formatCurrency(calculations.monthlyMrr)} <span className="text-xs font-normal text-slate-500">/mo</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                        Annual Contract Value: <strong>{formatCurrency(calculations.newArrAnnualized)}</strong>
                    </span>
                </div>

                {/* Unlocked Commission Rate */}
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Commission Accelerator</span>
                    <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center gap-1.5">
                        {(calculations.earnedRate * 100).toFixed(1)}% 
                        {annualMixPct > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                                {(calculations.annualRate * 100).toFixed(1)}% on Annual
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                        {calculations.distanceToNextTier > 0 
                            ? `Only ${formatCurrency(calculations.distanceToNextTier)} MRR to ${(calculations.nextTier!.rate * 100).toFixed(1)}% tier!`
                            : '⚡ Maximum Top-Producer Accelerator reached!'}
                    </span>
                </div>

                {/* Monthly Cash Bonus Unlocked */}
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Monthly Cash Bonus</span>
                    <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                        {calculations.earnedMonthlyBonus > 0 ? formatCurrency(calculations.earnedMonthlyBonus) : '$0'}
                        <span className="text-xs font-semibold text-slate-500 ml-1">lump sum</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                        {calculations.distanceToNextBonus > 0 
                            ? `+${formatCurrency(calculations.distanceToNextBonus)} MRR to unlock ${formatCurrency(calculations.nextBonusTier!.bonus)} bonus!`
                            : '🏆 Top monthly cash bonus tier achieved!'}
                    </span>
                </div>
            </div>

            {/* Projection Cards: Month 1 vs Year 1 vs Future Residuals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Month 1 Earnings */}
                <div className="bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900 dark:to-blue-950/20 p-5 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-full">
                            Month 1 Take-Home
                        </span>
                        <Zap size={16} className="text-blue-500" />
                    </div>

                    <div className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                        {formatCurrency(calculations.totalMonth1TakeHome)}
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                            <span>Direct Commissions:</span>
                            <span className="font-bold">{formatCurrency(calculations.totalMonth1Commission)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Monthly Cash Bonus:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">+{formatCurrency(calculations.earnedMonthlyBonus)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-dashed">
                            <span>Monthly Sub Deals ({calculations.monthlyDeals}):</span>
                            <span>{formatCurrency((calculations.monthlyDeals * avgPlanMrr) * calculations.earnedRate)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Annual Upfront Deals ({calculations.annualDeals}):</span>
                            <span className="font-semibold text-emerald-600">{formatCurrency((calculations.annualDeals * (avgPlanMrr * 12)) * calculations.annualRate)}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Full Year 1 Annual Projection */}
                <div className="bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 p-5 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles size={12} /> Year 1 Annual Total
                        </span>
                        <Award size={18} className="text-emerald-600" />
                    </div>

                    <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mb-3">
                        {formatCurrency(calculations.totalYear1Gross)}
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                            <span>Compounding Commissions (12 mo):</span>
                            <span className="font-bold">{formatCurrency(calculations.totalAnnualCommission)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Monthly Performance Bonuses:</span>
                            <span className="font-bold text-amber-600">+{formatCurrency(calculations.totalAnnualMonthlyBonuses)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Annual ARR Production Bonus:</span>
                            <span className="font-bold text-purple-600">+{formatCurrency(calculations.earnedArrBonus)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-dashed">
                            <span>Total Clients Acquired:</span>
                            <span className="font-bold">{calculations.totalClientsYearEnd} businesses</span>
                        </div>
                    </div>
                </div>

                {/* 3. Passive Residual Income (Years 2 and 3+) */}
                <div className="bg-gradient-to-br from-white to-purple-50/40 dark:from-slate-900 dark:to-purple-950/20 p-5 rounded-xl border border-purple-200 dark:border-purple-900 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2.5 py-0.5 rounded-full">
                            Passive Residual Income
                        </span>
                        <TrendingUp size={16} className="text-purple-600" />
                    </div>

                    <div className="text-2xl font-black text-purple-900 dark:text-purple-200 mb-1">
                        {formatCurrency(calculations.year2MonthlyResidual)} <span className="text-xs font-normal text-slate-500">/month</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                        Year 2 Residuals (5.0%) without closing any extra deals!
                    </p>

                    <div className="space-y-2 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                            <span>Year 2 Annual Residual:</span>
                            <span className="font-bold text-purple-700 dark:text-purple-300">{formatCurrency(calculations.year2AnnualResidual)} / yr</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Year 3+ Lifetime Residual (3%):</span>
                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(calculations.year3MonthlyResidual)} / mo</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-dashed">
                            <span>Active Book Portfolio MRR:</span>
                            <span className="font-semibold">{formatCurrency(calculations.totalBookMrr)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Explanatory Footer */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 border border-slate-200 dark:border-slate-700">
                <HelpCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                    <strong>Scenario Simulation Rationale:</strong> Commissions are calculated using your active compensation agreement ({((calculations.earnedRate) * 100).toFixed(1)}% base/accelerator + {((kickerRate) * 100).toFixed(0)}% annual prepayment kicker). Monthly subscription cohorts recur each month throughout Year 1, and convert to 5.0% in Year 2 and 3.0% thereafter, conditional upon maintaining Active Standing under Section 10. Metered usage (AI, SMS, voice) is excluded.
                </div>
            </div>
        </div>
    );
};

export default SalesScenarioCalculator;
