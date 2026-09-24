import React from 'react';
import { DollarSign, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';

interface WholesaleMarginBadgeProps {
    retailPrice: number | string | undefined | null;
    wholesaleCost?: number;
    unit?: string;
    isSoftwareLicense?: boolean;
    provider?: string;
    customNote?: string;
    className?: string;
}

export const WholesaleMarginBadge: React.FC<WholesaleMarginBadgeProps> = ({
    retailPrice,
    wholesaleCost = 0,
    unit = '',
    isSoftwareLicense = false,
    provider,
    customNote,
    className = ''
}) => {
    const priceNum = typeof retailPrice === 'string' ? parseFloat(retailPrice) || 0 : (retailPrice ?? 0);

    if (isSoftwareLicense || wholesaleCost === 0) {
        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 ${className}`}>
                <ShieldCheck size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                    <strong>We Pay:</strong> $0.00 {provider ? `(${provider})` : '(Software License)'} &bull; <span className="font-black text-indigo-900 dark:text-indigo-100">100% Gross Margin</span>
                </span>
            </div>
        );
    }

    const profit = priceNum - wholesaleCost;
    const marginPct = priceNum > 0 ? (profit / priceNum) * 100 : 0;
    const isProfitable = profit > 0.000001;
    const isBreakEven = Math.abs(profit) <= 0.000001;

    // Formatting helper for small per-unit fractions
    const formatCost = (val: number) => {
        if (val === 0) return '$0.00';
        if (Math.abs(val) < 0.01) {
            return `$${val.toFixed(4)}`;
        }
        return `$${val.toFixed(2)}`;
    };

    return (
        <div className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            isProfitable
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : isBreakEven
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        } ${className}`}>
            <span className="flex items-center gap-1 shrink-0 text-slate-600 dark:text-slate-400">
                <DollarSign size={12} className="text-slate-500" />
                <strong>We Pay:</strong> {formatCost(wholesaleCost)}{unit} {provider ? `(${provider})` : ''}
            </span>
            <span className="text-slate-400 dark:text-slate-600 font-bold">&bull;</span>
            <span className="flex items-center gap-1 font-bold shrink-0">
                {isProfitable ? (
                    <>
                        <TrendingUp size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Profit: +{formatCost(profit)}{unit}</span>
                        <span className="bg-emerald-200 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.2 rounded text-[11px] font-black">
                            {marginPct.toFixed(1)}% Margin
                        </span>
                    </>
                ) : isBreakEven ? (
                    <>
                        <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                        <span>At Cost ($0.00 Profit)</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={12} className="text-rose-600 dark:text-rose-400" />
                        <span>Loss: {formatCost(profit)}{unit} ({marginPct.toFixed(1)}%)</span>
                    </>
                )}
            </span>
            {customNote && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    ({customNote})
                </span>
            )}
        </div>
    );
};

export default WholesaleMarginBadge;
