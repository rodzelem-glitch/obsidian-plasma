import type { Customer, Organization, CustomerMarkupRule } from 'types';

export interface CustomerContractedRates {
    hasContractedRates: boolean;
    standardRate: number;
    isStandardContracted: boolean;
    overtimeRate: number;
    isOvertimeContracted: boolean;
    emergencyRate: number;
    isEmergencyContracted: boolean;
    partsMarkupPct?: number;
    isPartsMarkupContracted: boolean;
    partsMarkupRules?: CustomerMarkupRule[];
    partsMarkupTier1?: number;
    partsMarkupTier2?: number;
    partsMarkupNotes?: string;
    tripCharge?: number;
    travelTime?: string;
    travelIncluded?: boolean;
}

export type RateMode = 'auto' | 'standard' | 'overtime' | 'emergency' | 'custom';
export type MarkupMode = 'tiered' | 'contracted' | 'flat' | 'costPlus';
export type DiscountScope = 'partsAndAllowances' | 'all' | 'partsOnly' | 'allowancesOnly' | 'laborOnly';

export interface EstimatorAIRules {
    rateMode: RateMode;
    customLaborRate?: number;
    markupMode: MarkupMode;
    flatMarkupPct?: number;
    discountPct?: number;
    discountScope: DiscountScope;
    discountName?: string;
    buildDiscountIntoCost: boolean;
    includeTripCharge: boolean;
    craneAllowanceAmount?: number;
    permitAllowanceAmount?: number;
    customDirectives?: string;
}

export const DEFAULT_ESTIMATOR_RULES: EstimatorAIRules = {
    rateMode: 'auto',
    markupMode: 'tiered',
    discountPct: 0,
    discountScope: 'partsAndAllowances',
    discountName: 'Customer Contract Discount',
    buildDiscountIntoCost: false,
    includeTripCharge: false,
    craneAllowanceAmount: 0,
    permitAllowanceAmount: 0,
    customDirectives: ''
};

/**
 * Extracts and normalizes customer contracted rates across all legacy and current fields.
 */
export function extractCustomerContractedRates(
    customer: Customer | null | undefined,
    org?: Organization | null
): CustomerContractedRates {
    const orgStandardLabor = Number((org as any)?.laborRate) || Number((org as any)?.hourlyLaborRate) || 135;
    const orgOvertimeLabor = Number((org as any)?.overtimeLaborRate) || Number((org as any)?.overtimeRate) || (orgStandardLabor * 1.5);
    const orgEmergencyLabor = Number((org as any)?.emergencyLaborRate) || Number((org as any)?.emergencyRate) || (orgStandardLabor * 2.0);

    if (!customer || !customer.pricingRules) {
        return {
            hasContractedRates: false,
            standardRate: orgStandardLabor,
            isStandardContracted: false,
            overtimeRate: orgOvertimeLabor,
            isOvertimeContracted: false,
            emergencyRate: orgEmergencyLabor,
            isEmergencyContracted: false,
            partsMarkupPct: undefined,
            isPartsMarkupContracted: false,
            tripCharge: undefined,
            travelTime: undefined,
            travelIncluded: false
        };
    }

    const pr = customer.pricingRules as any;

    // Standard rate detection
    const hasContractedStandard = pr.contractedRate !== undefined && Number(pr.contractedRate) > 0;
    const standardRate = hasContractedStandard
        ? Number(pr.contractedRate)
        : (pr.standardRate !== undefined && Number(pr.standardRate) > 0 ? Number(pr.standardRate) : orgStandardLabor);

    // Overtime rate detection
    const hasContractedOvertime = 
        (pr.overtimeContractedRate !== undefined && Number(pr.overtimeContractedRate) > 0) ||
        (pr.overtimeLaborRate !== undefined && Number(pr.overtimeLaborRate) > 0) ||
        (pr.overtimeRate !== undefined && Number(pr.overtimeRate) > 0);
    
    const overtimeRate = hasContractedOvertime
        ? Number(pr.overtimeContractedRate ?? pr.overtimeLaborRate ?? pr.overtimeRate)
        : (standardRate * 1.5);

    // Emergency rate detection
    const hasContractedEmergency = 
        (pr.emergencyContractedRate !== undefined && Number(pr.emergencyContractedRate) > 0) ||
        (pr.emergencyRate !== undefined && Number(pr.emergencyRate) > 0);

    const emergencyRate = hasContractedEmergency
        ? Number(pr.emergencyContractedRate ?? pr.emergencyRate)
        : (standardRate * 2.0);

    // Parts markup detection
    const partsMarkupRules = Array.isArray(pr.partsMarkupRules) && pr.partsMarkupRules.length > 0 
        ? pr.partsMarkupRules 
        : undefined;
    const partsMarkupTier1 = pr.partsMarkupTier1 !== undefined ? Number(pr.partsMarkupTier1) : undefined;
    const partsMarkupTier2 = pr.partsMarkupTier2 !== undefined ? Number(pr.partsMarkupTier2) : undefined;
    const partsMarkupNotes = pr.partsMarkupNotes || undefined;

    const hasContractedMarkup = 
        (partsMarkupRules !== undefined) ||
        (partsMarkupTier1 !== undefined) ||
        (partsMarkupTier2 !== undefined) ||
        (pr.partsMarkupPercentage !== undefined && Number(pr.partsMarkupPercentage) >= 0) ||
        (pr.markupPercentage !== undefined && Number(pr.markupPercentage) >= 0);
    const partsMarkupPct = (pr.partsMarkupPercentage !== undefined && Number(pr.partsMarkupPercentage) >= 0)
        ? Number(pr.partsMarkupPercentage)
        : (pr.markupPercentage !== undefined && Number(pr.markupPercentage) >= 0 ? Number(pr.markupPercentage) : undefined);

    // Trip & Travel terms
    const tripCharge = pr.tripCharge !== undefined ? Number(pr.tripCharge) : (pr.tripFee !== undefined ? Number(pr.tripFee) : undefined);
    const travelTime = pr.travelTime;
    const travelIncluded = pr.travelIncluded === true || String(travelTime).toLowerCase().includes('included');

    const hasAnyContract = hasContractedStandard || hasContractedOvertime || hasContractedEmergency || hasContractedMarkup || tripCharge !== undefined || travelIncluded;

    return {
        hasContractedRates: Boolean(hasAnyContract),
        standardRate,
        isStandardContracted: hasContractedStandard,
        overtimeRate,
        isOvertimeContracted: hasContractedOvertime,
        emergencyRate,
        isEmergencyContracted: hasContractedEmergency,
        partsMarkupPct,
        isPartsMarkupContracted: hasContractedMarkup,
        partsMarkupRules,
        partsMarkupTier1,
        partsMarkupTier2,
        partsMarkupNotes,
        tripCharge,
        travelTime,
        travelIncluded
    };
}

/**
 * Calculates the exact markup percentage for a part cost based on customer contracted rules,
 * legacy tiers, flat rate, or standard commercial brackets.
 */
export function calculateCustomerPartMarkup(
    cost: number,
    rules?: CustomerMarkupRule[],
    fallbackRate?: number,
    legacyTiers?: { tier1?: number; tier2?: number }
): number {
    const numericCost = Number(cost) || 0;

    if (Array.isArray(rules) && rules.length > 0) {
        for (const rule of rules) {
            const threshold = Number(rule.threshold) || 0;
            const rate = Number(rule.rate);
            if (isNaN(rate)) continue;
            if (rule.condition === 'under' && numericCost <= threshold) {
                return rate;
            }
            if (rule.condition === 'over' && numericCost > threshold) {
                return rate;
            }
        }
    }

    // Backward compatibility with legacy tier 1 (<= $1,500) and tier 2 (> $1,500)
    if (legacyTiers?.tier1 !== undefined || legacyTiers?.tier2 !== undefined) {
        if (numericCost <= 1500 && legacyTiers.tier1 !== undefined) {
            return Number(legacyTiers.tier1);
        }
        if (numericCost > 1500 && legacyTiers.tier2 !== undefined) {
            return Number(legacyTiers.tier2);
        }
    }

    if (fallbackRate !== undefined && !isNaN(fallbackRate) && fallbackRate >= 0) {
        return fallbackRate;
    }

    // Default commercial tiered schedule fallback
    if (numericCost < 500) return 100;
    if (numericCost < 750) return 75;
    if (numericCost < 1000) return 50;
    return 35;
}

/**
 * Detects whether the user's prompt implies emergency, overtime, or standard work.
 */
export function detectRateModeFromPrompt(promptText: string): 'emergency' | 'overtime' | 'standard' {
    const lower = promptText.toLowerCase();
    
    // Emergency trigger keywords
    if (
        lower.includes('emergency') || 
        lower.includes('urgent') || 
        lower.includes('same day dispatch') || 
        lower.includes('holiday') || 
        lower.includes('critical shutdown') ||
        lower.includes('immediate response')
    ) {
        return 'emergency';
    }

    // Overtime / After-hours keywords
    if (
        lower.includes('overtime') || 
        lower.includes('after hours') || 
        lower.includes('after-hours') || 
        lower.includes('night shift') || 
        lower.includes('weekend') || 
        lower.includes('saturday') || 
        lower.includes('sunday') || 
        lower.includes('extended shift')
    ) {
        return 'overtime';
    }

    return 'standard';
}

/**
 * Calculates pre-discount cost scaled with margin protection (hidden markup) so customer discount retains target profit.
 * Formula: ProtectedCost = BaseCost / (1 - (discountPct / 100))
 */
export function calculateMarginProtectedCost(baseCost: number, discountPct: number): number {
    if (!discountPct || discountPct <= 0 || discountPct >= 100) return baseCost;
    const factor = 1 - (discountPct / 100);
    return Number((baseCost / factor).toFixed(2));
}

/**
 * Builds the AI prompt instruction block with customer contracted rates and active rules.
 */
export function buildEstimatorAIPromptDirectives(
    customer: Customer | null | undefined,
    org: Organization | null | undefined,
    rules: EstimatorAIRules,
    promptText: string = ''
): string {
    const rates = extractCustomerContractedRates(customer, org);
    const customerName = customer?.name || 'Commercial Client';

    // Determine target rate
    let effectiveRateType: 'standard' | 'overtime' | 'emergency' | 'custom' = 'standard';
    let targetRateVal = rates.standardRate;

    if (rules.rateMode === 'auto') {
        effectiveRateType = detectRateModeFromPrompt(promptText);
        targetRateVal = effectiveRateType === 'emergency' 
            ? rates.emergencyRate 
            : effectiveRateType === 'overtime' 
                ? rates.overtimeRate 
                : rates.standardRate;
    } else if (rules.rateMode === 'overtime') {
        effectiveRateType = 'overtime';
        targetRateVal = rates.overtimeRate;
    } else if (rules.rateMode === 'emergency') {
        effectiveRateType = 'emergency';
        targetRateVal = rates.emergencyRate;
    } else if (rules.rateMode === 'custom' && rules.customLaborRate && rules.customLaborRate > 0) {
        effectiveRateType = 'custom';
        targetRateVal = rules.customLaborRate;
    }

    const lines: string[] = [
        `=== CUSTOMER CONTRACTED RATES & PRICING RULES (MANDATORY INSTRUCTIONS) ===`,
        `Client Name: ${customerName}`,
        `Customer Contracted Rates Profile:`,
        `- Standard Contracted Labor Rate: $${rates.standardRate.toFixed(2)}/hr ${rates.isStandardContracted ? '[CONTRACT AGREEMENT]' : '[Standard]'}`,
        `- Overtime Labor Rate: $${rates.overtimeRate.toFixed(2)}/hr ${rates.isOvertimeContracted ? '[CONTRACT AGREEMENT]' : '[1.5x Standard]'}`,
        `- Emergency Labor Rate: $${rates.emergencyRate.toFixed(2)}/hr ${rates.isEmergencyContracted ? '[CONTRACT AGREEMENT]' : '[2.0x Standard]'}`,
        rates.tripCharge !== undefined ? `- Contracted Trip Charge / Fee: $${rates.tripCharge.toFixed(2)}` : '',
        rates.travelIncluded ? `- Travel Time: CONTRACTED AS INCLUDED (Do NOT bill separate travel hours unless requested)` : (rates.travelTime ? `- Travel Terms: ${rates.travelTime}` : ''),
        rates.partsMarkupRules && rates.partsMarkupRules.length > 0 
            ? `- Contracted Parts Markup (Tiered): ${rates.partsMarkupRules.map(r => `${r.condition === 'under' ? '≤' : '>'} $${r.threshold} (${r.rate}%)`).join(', ')}`
            : (rates.partsMarkupTier1 && rates.partsMarkupTier2 
                ? `- Contracted Parts Markup (Tiered): ≤ $1,500 (${rates.partsMarkupTier1}%), > $1,500 (${rates.partsMarkupTier2}%)`
                : (rates.partsMarkupPct !== undefined ? `- Contracted Parts Markup: ${rates.partsMarkupPct}%` : '')),
        '',
        `ACTIVE ESTIMATING RULE DIRECTIVES:`,
        `1. LABOR BILLING RATE:`,
        `   - Active Rate Target: $${targetRateVal.toFixed(2)}/hr (${effectiveRateType.toUpperCase()} RATE).`,
        `   - ALL generated labor items MUST use "rate": ${targetRateVal} by default.`,
        `   - If user explicitly mentions both regular daytime work and after-hours/emergency work in the prompt, tag daytime items at $${rates.standardRate.toFixed(2)}/hr and after-hours/emergency items at $${rates.overtimeRate.toFixed(2)}/hr or $${rates.emergencyRate.toFixed(2)}/hr with clear descriptions like "(Overtime Shift)" or "(Emergency Response)".`,
        '',
        `2. PARTS & MATERIAL MARKUP:`,
    ];

    if (rules.markupMode === 'contracted') {
        if (rates.partsMarkupRules && rates.partsMarkupRules.length > 0) {
            lines.push(`   - Apply customer's contracted tiered parts markup: ${rates.partsMarkupRules.map(r => `${r.condition === 'under' ? '≤' : '>'} $${r.threshold} (${r.rate}%)`).join(', ')}.`);
        } else if (rates.partsMarkupTier1 && rates.partsMarkupTier2) {
            lines.push(`   - Apply customer's contracted tiered parts markup: parts ≤ $1,500 at ${rates.partsMarkupTier1}%, parts > $1,500 at ${rates.partsMarkupTier2}%.`);
        } else if (rates.partsMarkupPct !== undefined) {
            lines.push(`   - Apply customer's contracted markup of ${rates.partsMarkupPct}% to all partItems.`);
        } else {
            lines.push(`   - Tiered Schedule: Under $500 (100%), $500-$750 (75%), $750-$1,000 (50%), Over $1,000 (35%).`);
        }
    } else if (rules.markupMode === 'flat' && rules.flatMarkupPct !== undefined && rules.flatMarkupPct >= 0) {
        lines.push(`   - Apply a flat markup of ${rules.flatMarkupPct}% to all partItems.`);
    } else {
        lines.push(`   - Tiered Schedule: Under $500 (100%), $500-$750 (75%), $750-$1,000 (50%), Over $1,000 (35%).`);
    }

    if (rules.discountPct && rules.discountPct > 0) {
        lines.push('');
        lines.push(`3. CUSTOMER DISCOUNT & MARGIN PROTECTION (CRITICAL):`);
        lines.push(`   - The customer negotiated a ${rules.discountPct}% discount on ${rules.discountScope}.`);
        if (rules.buildDiscountIntoCost) {
            const markupMultiplier = Number((1 / (1 - (rules.discountPct / 100))).toFixed(4));
            lines.push(`   - HIDDEN COST BUILD-IN (MARGIN PROTECTION ACTIVE): You MUST scale up base vendor costs and pricing on covered items by approximately ${((markupMultiplier - 1) * 100).toFixed(2)}% (multiplier: ${markupMultiplier}) so that when the customer receives their requested ${rules.discountPct}% discount, the contractor's net profit margin remains 100% protected.`);
        }
        lines.push(`   - Provide realistic itemized prices and note the ${rules.discountPct}% discount terms in the scope or clarifications.`);
    }

    if (rules.includeTripCharge && rates.tripCharge !== undefined && rates.tripCharge > 0) {
        lines.push('');
        lines.push(`4. ALLOWANCES & TRIP CHARGES:`);
        lines.push(`   - Include an allowance item for Contracted Trip Fee / Mobilization of $${rates.tripCharge.toFixed(2)}.`);
    }

    if (rules.craneAllowanceAmount && rules.craneAllowanceAmount > 0) {
        lines.push(`   - Include an allowance item for Scheduled Crane Rental / Rigging of $${rules.craneAllowanceAmount.toFixed(2)}.`);
    }

    if (rules.permitAllowanceAmount && rules.permitAllowanceAmount > 0) {
        lines.push(`   - Include an allowance item for City Permits / Smoke Detector Testing of $${rules.permitAllowanceAmount.toFixed(2)}.`);
    }

    if (rules.customDirectives && rules.customDirectives.trim()) {
        lines.push('');
        lines.push(`5. SPECIAL USER DIRECTIVES & CONSTRAINTS:`);
        lines.push(`   "${rules.customDirectives.trim()}"`);
    }

    return lines.filter(Boolean).join('\n');
}

/**
 * Applies active rules to parsed AI suggestions data to ensure strict mathematical compliance.
 */
export function applyEstimatorRulesToParsedData(
    parsed: any,
    rules: EstimatorAIRules,
    customerRates: CustomerContractedRates,
    promptText: string = ''
): any {
    if (!parsed || typeof parsed !== 'object') return parsed;

    const result = { ...parsed };

    // Determine target labor rate
    let effectiveRate = customerRates.standardRate;
    if (rules.rateMode === 'auto') {
        const detected = detectRateModeFromPrompt(promptText);
        effectiveRate = detected === 'emergency' ? customerRates.emergencyRate : (detected === 'overtime' ? customerRates.overtimeRate : customerRates.standardRate);
    } else if (rules.rateMode === 'overtime') {
        effectiveRate = customerRates.overtimeRate;
    } else if (rules.rateMode === 'emergency') {
        effectiveRate = customerRates.emergencyRate;
    } else if (rules.rateMode === 'custom' && rules.customLaborRate && rules.customLaborRate > 0) {
        effectiveRate = rules.customLaborRate;
    }

    // 1. Enforce Labor Rates
    if (Array.isArray(result.laborItems)) {
        result.laborItems = result.laborItems.map((item: any) => {
            const scopeLower = (item.scope || '').toLowerCase();
            let rowRate = effectiveRate;

            // If scope explicitly designates overtime or emergency
            if (scopeLower.includes('emergency') || scopeLower.includes('urgent')) {
                rowRate = customerRates.emergencyRate;
            } else if (scopeLower.includes('overtime') || scopeLower.includes('after hours') || scopeLower.includes('night') || scopeLower.includes('weekend')) {
                rowRate = customerRates.overtimeRate;
            }

            const hours = Number(item.hours) || 0;
            return {
                ...item,
                rate: rowRate,
                value: Number((hours * rowRate).toFixed(2))
            };
        });
    }

    // 2. Enforce Parts Markup and Built-in Margin Protection
    if (Array.isArray(result.partItems)) {
        result.partItems = result.partItems.map((item: any) => {
            let cost = Number(item.vendorCost) || 0;
            const qty = Number(item.quantity) || 1;

            // Apply hidden margin protection if discount is active and buildDiscountIntoCost is true
            if (rules.discountPct && rules.discountPct > 0 && rules.buildDiscountIntoCost) {
                if (rules.discountScope === 'partsAndAllowances' || rules.discountScope === 'partsOnly' || rules.discountScope === 'all') {
                    cost = calculateMarginProtectedCost(cost, rules.discountPct);
                }
            }

            let markup = item.markupPct;
            if (rules.markupMode === 'contracted') {
                markup = calculateCustomerPartMarkup(
                    cost,
                    customerRates.partsMarkupRules,
                    customerRates.partsMarkupPct,
                    { tier1: customerRates.partsMarkupTier1, tier2: customerRates.partsMarkupTier2 }
                );
            } else if (rules.markupMode === 'flat' && rules.flatMarkupPct !== undefined) {
                markup = rules.flatMarkupPct;
            } else if (markup === undefined || markup <= 0) {
                markup = calculateCustomerPartMarkup(
                    cost,
                    customerRates.partsMarkupRules,
                    customerRates.partsMarkupPct,
                    { tier1: customerRates.partsMarkupTier1, tier2: customerRates.partsMarkupTier2 }
                );
            }

            const unitPrice = Number((cost * (1 + (markup / 100))).toFixed(2));
            return {
                ...item,
                vendorCost: cost,
                markupPct: markup,
                customerUnitPrice: unitPrice,
                customerLineTotal: Number((unitPrice * qty).toFixed(2))
            };
        });
    }

    // 3. Allowances: trip charge, crane, permit
    if (!Array.isArray(result.allowanceItems)) {
        result.allowanceItems = [];
    }

    if (rules.includeTripCharge && customerRates.tripCharge && customerRates.tripCharge > 0) {
        const hasTrip = result.allowanceItems.some((a: any) => (a.description || '').toLowerCase().includes('trip'));
        if (!hasTrip) {
            result.allowanceItems.push({
                description: 'Contracted Mobilization / Trip Fee',
                basis: 'Contracted standard service call trip fee',
                amount: customerRates.tripCharge
            });
        }
    }

    if (rules.craneAllowanceAmount && rules.craneAllowanceAmount > 0) {
        const hasCrane = result.allowanceItems.some((a: any) => (a.description || '').toLowerCase().includes('crane'));
        if (!hasCrane) {
            result.allowanceItems.push({
                description: 'Scheduled Crane Rental & Rigging Allowance',
                basis: 'Certified crane service and operator allowance for RTU lift',
                amount: rules.craneAllowanceAmount
            });
        }
    }

    if (rules.permitAllowanceAmount && rules.permitAllowanceAmount > 0) {
        const hasPermit = result.allowanceItems.some((a: any) => (a.description || '').toLowerCase().includes('permit') || (a.description || '').toLowerCase().includes('smoke'));
        if (!hasPermit) {
            result.allowanceItems.push({
                description: 'City Permits & Smoke Detector Testing Allowance',
                basis: 'Jurisdictional mechanical permit fees and fire/smoke detector testing allowance',
                amount: rules.permitAllowanceAmount
            });
        }
    }

    // If margin protection is enabled on allowances
    if (rules.discountPct && rules.discountPct > 0 && rules.buildDiscountIntoCost) {
        if (rules.discountScope === 'partsAndAllowances' || rules.discountScope === 'allowancesOnly' || rules.discountScope === 'all') {
            result.allowanceItems = result.allowanceItems.map((a: any) => ({
                ...a,
                amount: calculateMarginProtectedCost(Number(a.amount) || 0, rules.discountPct!)
            }));
        }
    }

    return result;
}
