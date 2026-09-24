import type { ServiceAgreement } from '../types';

/**
 * Evaluates whether an agreement is an actual recurring customer membership subscription
 * (e.g. Gold Plan $29/mo, Silver Plan $19/mo, Residential Elite) rather than an hourly
 * or milestone-billed commercial contractor agreement, rate schedule, or Master Service Agreement (MSA).
 */
export const isRecurringMembership = (agreement: ServiceAgreement | any): boolean => {
    if (!agreement) return false;

    // Explicit exclusion flags
    if (agreement.excludeFromMrr === true) return false;
    if (agreement.isContractorAgreement === true) return false;
    if (agreement.agreementType && agreement.agreementType !== 'membership') return false;

    // Check title/plan name keywords indicative of commercial contractor/facility network agreements
    const planName = (agreement.planName || '').toLowerCase();
    const isCommercialContractName = 
        planName.includes('contractor agreement') ||
        planName.includes('master service agreement') ||
        planName.includes('facility network') ||
        planName.includes('rate schedule') ||
        planName.includes('commercial retail') ||
        planName.includes('vendor agreement') ||
        planName.includes('subcontractor agreement');

    if (isCommercialContractName) return false;

    // If agreement contains hourly labor rate or commercial contract number without recurring fee
    if (agreement.laborRate !== undefined || agreement.contractNumber) {
        return false;
    }

    // Must have a valid positive recurring price and standard recurring billing cycle
    const price = Number(agreement.price);
    if (isNaN(price) || price <= 0) return false;
    if (agreement.billingCycle !== 'Monthly' && agreement.billingCycle !== 'Annual') return false;

    return true;
};

/**
 * Checks if an agreement is a commercial contractor agreement or master service agreement
 */
export const isCommercialContract = (agreement: ServiceAgreement | any): boolean => {
    return !isRecurringMembership(agreement);
};

/**
 * Calculates total Monthly Recurring Revenue (MRR) strictly from active recurring membership plans.
 * Normalizes Annual plans by dividing by 12. Guaranteed to return a valid number (never NaN).
 */
export const calculateAgreementMRR = (agreements: (ServiceAgreement | any)[] = []): number => {
    if (!Array.isArray(agreements)) return 0;

    return agreements
        .filter(a => a && a.status === 'Active' && isRecurringMembership(a))
        .reduce((sum, a) => {
            const rawPrice = Number(a.price);
            const price = isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
            const monthlyVal = a.billingCycle === 'Monthly' ? price : (price / 12);
            return sum + (isFinite(monthlyVal) ? monthlyVal : 0);
        }, 0);
};

/**
 * Formats agreement dates safely to avoid JavaScript "Invalid Date" errors
 */
export const formatAgreementDate = (agreement: ServiceAgreement | any): string => {
    if (!agreement) return 'N/A';

    const parseValidDate = (val: any): string | null => {
        if (!val) return null;
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString();
        }
        return null;
    };

    const endDate = parseValidDate(agreement.endDate);
    if (endDate) return endDate;

    const effectiveDate = parseValidDate(agreement.effectiveDate);
    if (effectiveDate) return `Eff: ${effectiveDate}`;

    const startDate = parseValidDate(agreement.startDate);
    if (startDate) return `Start: ${startDate}`;

    const agreementDate = parseValidDate(agreement.agreementDate);
    if (agreementDate) return `Agreed: ${agreementDate}`;

    return 'Ongoing / Active Term';
};

/**
 * Returns clean classification metadata and badges for UI rendering
 */
export const getAgreementClassification = (agreement: ServiceAgreement | any) => {
    const isMembership = isRecurringMembership(agreement);

    if (isMembership) {
        return {
            type: 'membership' as const,
            label: 'Membership (MRR)',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
        };
    }

    return {
        type: 'contractor' as const,
        label: 'Commercial Contract (Non-MRR)',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
    };
};
