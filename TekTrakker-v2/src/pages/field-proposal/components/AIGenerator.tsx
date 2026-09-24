import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { BrainCircuit, TrendingDown, Tag, Sliders, Zap, Clock, AlertTriangle } from 'lucide-react';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLanguage } from 'context/LanguageContext';
import { useAppContext } from 'context/AppContext';
import { analyzeHistoricalJobPricing } from 'lib/pricebookLearning';
import { extractCustomerContractedRates, calculateMarginProtectedCost } from 'lib/estimatorRules';
import type { Customer } from 'types';

interface AISuggestion {
    name: string;
    description: string;
    baseCost: number;
    avgLabor: number;
    appliedLaborRate?: number;
    rateType?: 'standard' | 'overtime' | 'emergency';
}

interface AISuggestionSet {
    good: AISuggestion[];
    better: AISuggestion[];
    best: AISuggestion[];
}

interface AIGeneratorProps {
    onSuggestions: (suggestions: AISuggestionSet) => void;
    customerId?: string;
    customerName?: string;
    customer?: Customer | null;
}

const AIGenerator: React.FC<AIGeneratorProps> = ({ onSuggestions, customerId, customerName, customer }) => {
    const { state } = useAppContext();
    const [problemDesc, setProblemDesc] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const { t } = useLanguage();

    const resolvedCustomer = useMemo(() => {
        return customer || (customerId ? (state.customers || []).find(c => c.id === customerId) : null) || null;
    }, [customer, customerId, state.customers]);

    const customerRates = useMemo(() => {
        return extractCustomerContractedRates(resolvedCustomer, state.currentOrganization);
    }, [resolvedCustomer, state.currentOrganization]);

    const [selectedRateType, setSelectedRateType] = useState<'standard' | 'overtime' | 'emergency'>('standard');
    const [showRules, setShowRules] = useState(false);
    const [discountPct, setDiscountPct] = useState<number>(0);
    const [buildDiscountIntoCost, setBuildDiscountIntoCost] = useState<boolean>(false);

    const standardLaborRate = Number((state.platformSettings as any)?.laborRate) || Number((state.currentOrganization as any)?.laborRate) || 125;

    // Analyze historical job pricing patterns for TekAir Inc and specific customer
    const pricingAnalytics = useMemo(() => {
        return analyzeHistoricalJobPricing(state.jobs || [], standardLaborRate);
    }, [state.jobs, standardLaborRate]);

    const activeCustKey = customerId || customerName || '';
    const custPattern = activeCustKey ? (pricingAnalytics.customerPatterns[activeCustKey] || pricingAnalytics.customerPatterns[customerName || '']) : null;

    const activeLaborRate = selectedRateType === 'emergency' 
        ? customerRates.emergencyRate 
        : (selectedRateType === 'overtime' ? customerRates.overtimeRate : customerRates.standardRate);

    const handleAIEstimate = async () => {
        if (!problemDesc.trim()) return;
        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            let contractDirectives = `ACTIVE CONTRACT & RATE CONSTRAINTS:
- Client Name: ${resolvedCustomer?.name || customerName || 'Commercial Client'}
- Selected Labor Shift: ${selectedRateType.toUpperCase()} RATE ($${activeLaborRate.toFixed(2)}/hr)
- Standard Contracted Labor Rate: $${customerRates.standardRate.toFixed(2)}/hr ${customerRates.isStandardContracted ? '[Contracted]' : ''}
- Overtime Labor Rate: $${customerRates.overtimeRate.toFixed(2)}/hr ${customerRates.isOvertimeContracted ? '[Contracted]' : ''}
- Emergency Labor Rate: $${customerRates.emergencyRate.toFixed(2)}/hr ${customerRates.isEmergencyContracted ? '[Contracted]' : ''}`;

            if (customerRates.partsMarkupRules && customerRates.partsMarkupRules.length > 0) {
                contractDirectives += `\n- Contracted Parts Markup (Tiered): ${customerRates.partsMarkupRules.map(r => `${r.condition === 'under' ? '≤' : '>'} $${r.threshold} (${r.rate}%)`).join(', ')}`;
            } else if (customerRates.partsMarkupTier1 && customerRates.partsMarkupTier2) {
                contractDirectives += `\n- Contracted Parts Markup (Tiered): parts ≤ $1,500 at ${customerRates.partsMarkupTier1}%, parts > $1,500 at ${customerRates.partsMarkupTier2}%`;
            } else if (customerRates.partsMarkupPct !== undefined) {
                contractDirectives += `\n- Contracted Parts Markup: ${customerRates.partsMarkupPct}%`;
            }
            if (customerRates.tripCharge !== undefined) {
                contractDirectives += `\n- Contracted Trip Fee: $${customerRates.tripCharge.toFixed(2)}`;
            }
            if (discountPct > 0) {
                contractDirectives += `\n- Customer Negotiated Discount: ${discountPct}%`;
                if (buildDiscountIntoCost) {
                    const multiplier = Number((1 / (1 - (discountPct / 100))).toFixed(4));
                    contractDirectives += ` [MARGIN PROTECTION ACTIVE: Inflate base vendor costs by ${((multiplier - 1) * 100).toFixed(2)}% so that the ${discountPct}% customer discount preserves target company profit.]`;
                }
            }

            let historicalContextStr = `Standard Company Labor Rate: $${standardLaborRate}/hr. Total Analyzed Completed Jobs: ${pricingAnalytics.totalAnalyzedJobs}.`;
            if (custPattern && custPattern.totalCompletedJobs > 0) {
                historicalContextStr += `\nCUSTOMER HISTORICAL CONTEXT: "${custPattern.customerName}" has ${custPattern.totalCompletedJobs} completed jobs with an average billed labor rate of $${custPattern.avgLaborRateBilled}/hr.`;
            }
            
            const prompt = `Expert HVAC & Trades Estimator: Generate tiered repair/replacement options (Basic, Premium, Platinum) for the following problem description: "${problemDesc}". 
            
${contractDirectives}

HISTORICAL BILLING CONTEXT:
${historicalContextStr}

Break down each option into parts cost (baseCost) and labor hours (avgLabor) for a field technician.
Base labor hours realistically on typical trade times for each scope of work, accounting for the ${selectedRateType.toUpperCase()} shift at $${activeLaborRate.toFixed(2)}/hr.

Provide the response strictly as a valid JSON object with this exact structure:
{
  "good": [{"name": "string", "description": "string", "baseCost": number, "avgLabor": number}],
  "better": [...],
  "best": [...]
}`;

            const result = await callGeminiAI({ 
                prompt, 
                modelName: "gemini-3.7-flash",
                config: {
                    responseMimeType: "application/json"
                }
            });

            const data = result.data as { text?: string };
            const rawText = (data?.text || '').trim();

            if (!rawText) {
                throw new Error("Empty response received from AI model.");
            }

            // Extract JSON content (stripping markdown code blocks and external text)
            let cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }

            const parsed = JSON.parse(cleanText);

            if (!parsed || typeof parsed !== 'object') {
                throw new Error("Invalid JSON structure returned from AI model.");
            }

            // Map and tag suggestions with the selected rate type and margin-protected costs
            const mapTier = (arr: any[]): AISuggestion[] => {
                if (!Array.isArray(arr)) return [];
                return arr.map(item => {
                    let cost = Number(item.baseCost) || 0;
                    if (discountPct > 0 && buildDiscountIntoCost) {
                        cost = calculateMarginProtectedCost(cost, discountPct);
                    }
                    return {
                        name: String(item.name || 'Repair Option'),
                        description: String(item.description || ''),
                        baseCost: cost,
                        avgLabor: Number(item.avgLabor) || 0,
                        appliedLaborRate: activeLaborRate,
                        rateType: selectedRateType
                    };
                });
            };

            onSuggestions({
                good: mapTier(parsed.good),
                better: mapTier(parsed.better),
                best: mapTier(parsed.best)
            });
            
        } catch (e) { 
            console.error("AI Estimation Error:", e);
            showToast.warn(t("Failed to generate AI suggestions. Please try manual entry."));
        } finally { 
            setIsThinking(false); 
        }
    };

    return (
        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 mb-8 animate-fade-in">
            {/* Header with Title and Contracted Rates Indicators */}
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h4 className="font-black text-sm uppercase text-indigo-500 dark:text-indigo-400 flex items-center gap-2">
                    <BrainCircuit size={16}/> {t("AI Proposal Engine")}
                </h4>
                
                <div className="flex flex-wrap items-center gap-2">
                    {resolvedCustomer && (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-slate-700 dark:text-slate-300">
                            <Tag size={13} className="text-indigo-600" />
                            {resolvedCustomer.name}:
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        Standard: ${customerRates.standardRate.toFixed(2)}/hr {customerRates.isStandardContracted ? ' [Contracted]' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-800">
                        Overtime: ${customerRates.overtimeRate.toFixed(2)}/hr
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                        Emergency: ${customerRates.emergencyRate.toFixed(2)}/hr
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowRules(!showRules)}
                        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            showRules 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-slate-700 hover:bg-indigo-50'
                        }`}
                    >
                        <Sliders size={12} />
                        <span>{t("Estimating Rules")}</span>
                        {discountPct > 0 && (
                            <span className="bg-amber-500 text-white text-[9px] px-1 rounded-full font-black">
                                {discountPct}%
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Rate Mode Selector Pills */}
            <div className="flex flex-wrap items-center gap-2 mb-3 pt-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock size={13} /> {t("Select Shift / Rate Tier:")}
                </span>
                <button
                    type="button"
                    onClick={() => setSelectedRateType('standard')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedRateType === 'standard'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                >
                    Standard (${customerRates.standardRate.toFixed(2)}/hr)
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedRateType('overtime')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedRateType === 'overtime'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                >
                    Overtime (${customerRates.overtimeRate.toFixed(2)}/hr)
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedRateType('emergency')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedRateType === 'emergency'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                >
                    Emergency (${customerRates.emergencyRate.toFixed(2)}/hr)
                </button>
            </div>

            {/* Expandable Rules Panel */}
            {showRules && (
                <div className="mb-4 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-slate-700 text-xs space-y-3 animate-fade-in shadow-xs">
                    <div className="flex justify-between items-center border-b pb-1.5 dark:border-slate-800">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {t("Field Estimator Rules & Margin Protection")}
                        </span>
                        {resolvedCustomer?.name?.includes('Impact') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDiscountPct(7);
                                    setBuildDiscountIntoCost(true);
                                    setSelectedRateType('standard');
                                }}
                                className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold hover:bg-amber-200 transition-all cursor-pointer flex items-center gap-1"
                            >
                                <Zap size={11} /> Impact 7% Formula
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Discount %:</span>
                            <input
                                type="number"
                                placeholder="0"
                                value={discountPct || ''}
                                onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                                className="w-16 p-1.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={buildDiscountIntoCost}
                                onChange={(e) => setBuildDiscountIntoCost(e.target.checked)}
                                className="rounded text-indigo-600 cursor-pointer"
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {t("Bake discount into base material cost (Margin Protection)")}
                            </span>
                        </label>
                    </div>
                </div>
            )}

            {/* Prompt Input Row */}
            <div className="flex flex-col md:flex-row gap-4">
                <Input 
                    placeholder={t("Describe the problem (e.g., 'Emergency RTU #1 blower motor replacement after hours')...")} 
                    value={problemDesc} 
                    onChange={e => setProblemDesc(e.target.value)} 
                    className="flex-1 bg-white dark:bg-slate-900 border-indigo-200 focus:ring-indigo-500 text-slate-900 dark:text-white" 
                />
                <Button onClick={handleAIEstimate} disabled={isThinking} className="bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-6 font-bold shadow-lg">
                    {isThinking ? t('Thinking...') : t('Generate Options')}
                </Button>
            </div>
        </div>
    );
};

export default AIGenerator;
export type { AISuggestion, AISuggestionSet };

