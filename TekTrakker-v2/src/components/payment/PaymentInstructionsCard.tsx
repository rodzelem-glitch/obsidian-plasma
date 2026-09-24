import React, { useState } from 'react';
import { Building, CreditCard, CheckCircle2, Copy, Check, Info, FileText } from 'lucide-react';
import type { Organization } from '../../types';
import { getOrgPaymentInstructions, PaymentInstructionDetail } from '../../lib/paymentInstructionsHelper';
import showToast from '../../lib/toast';

interface PaymentInstructionsCardProps {
    organization?: Organization | null;
    title?: string;
    description?: string;
    variant?: 'card' | 'compact' | 'flat';
    className?: string;
    defaultExpanded?: boolean;
}

export const PaymentInstructionsCard: React.FC<PaymentInstructionsCardProps> = ({
    organization,
    title = "Direct & Offline Payment Instructions",
    description = "Prefer to pay via Check, Wire, or ACH bank transfer? Please follow the remittance details below:",
    variant = 'card',
    className = '',
    defaultExpanded = true
}) => {
    const config = getOrgPaymentInstructions(organization);
    const [selectedType, setSelectedType] = useState<'check' | 'wire' | 'ach'>(() => {
        if (config.check.accepted) return 'check';
        if (config.ach.accepted) return 'ach';
        if (config.wire.accepted) return 'wire';
        return 'check';
    });
    const [copiedType, setCopiedType] = useState<string | null>(null);

    if (!config.hasAnyAccepted) {
        return null;
    }

    const activeDetail: PaymentInstructionDetail = config[selectedType] || config.acceptedMethods[0] || config.check;

    const handleCopy = async (detail: PaymentInstructionDetail) => {
        try {
            await navigator.clipboard.writeText(detail.effectiveInstructions);
            setCopiedType(detail.type);
            showToast.success(`${detail.name} instructions copied to clipboard!`);
            setTimeout(() => setCopiedType(null), 2500);
        } catch (err) {
            showToast.error("Failed to copy instructions.");
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'wire': return <Building size={16} />;
            case 'ach': return <CreditCard size={16} />;
            default: return <FileText size={16} />;
        }
    };

    if (variant === 'compact') {
        return (
            <div className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 ${className}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Info size={14} className="text-blue-500" />
                        {title}
                    </span>
                    <div className="flex items-center gap-1">
                        {config.acceptedMethods.map(m => (
                            <button
                                key={m.type}
                                type="button"
                                onClick={() => setSelectedType(m.type)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                                    selectedType === m.type
                                        ? 'bg-[#123A63] text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {m.badgeLabel}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative mt-2 p-3 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                    <pre className="font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {activeDetail.effectiveInstructions}
                    </pre>
                    <button
                        type="button"
                        onClick={() => handleCopy(activeDetail)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Copy to Clipboard"
                    >
                        {copiedType === activeDetail.type ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-950 shadow-sm ${className}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <Building size={16} className="text-[#123A63] dark:text-sky-400" />
                        {title}
                    </h4>
                    {description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {description}
                        </p>
                    )}
                </div>
                
                {/* Method selector pills */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {config.acceptedMethods.map(m => {
                        const isSelected = selectedType === m.type;
                        return (
                            <button
                                key={m.type}
                                type="button"
                                onClick={() => setSelectedType(m.type)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                                    isSelected
                                        ? 'bg-[#123A63] dark:bg-sky-600 text-white shadow-md shadow-blue-900/10 scale-102'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                                }`}
                            >
                                {getIcon(m.type)}
                                <span>{m.badgeLabel}</span>
                                <CheckCircle2 size={12} className={isSelected ? 'text-sky-300' : 'text-emerald-500 opacity-60'} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Instruction content box */}
            <div className="mt-4 relative p-4 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-750 shadow-inner group">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-[#123A63] dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                {activeDetail.name}
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} /> Accepted by {organization?.name || 'Provider'}
                            </span>
                        </div>
                        <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed pt-2">
                            {activeDetail.effectiveInstructions}
                        </pre>
                    </div>

                    <button
                        type="button"
                        onClick={() => handleCopy(activeDetail)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shrink-0 self-start shadow-xs"
                    >
                        {copiedType === activeDetail.type ? (
                            <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 font-black">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                <span>Copy Details</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Helper footer */}
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                <span>Please include your Invoice # or Account # on all remittances.</span>
                {organization?.email && <span>Remittance notifications: {organization.email}</span>}
            </div>
        </div>
    );
};

export default PaymentInstructionsCard;
