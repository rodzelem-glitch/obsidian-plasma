import type { Job, ProposalPreset } from 'types';

export interface CustomerPricingPattern {
    customerId?: string;
    customerName?: string;
    totalCompletedJobs: number;
    avgLaborRateBilled: number;
    defaultLaborRate: number;
    isContractedRate: boolean;
    contractedDiscountPct: number;
    frequentItemsUsed: Array<{
        name: string;
        avgBilledPrice: number;
        count: number;
    }>;
}

export interface CompanyPricingIntelligence {
    organizationId: string;
    totalAnalyzedJobs: number;
    avgEffectiveLaborRate: number;
    customerPatterns: Record<string, CustomerPricingPattern>; // keyed by customerId or customerName
}

/**
 * Analyzes completed job history for an organization (e.g. TekAir Inc)
 * to detect pricing patterns, custom labor rates, and customer contract rates.
 */
export function analyzeHistoricalJobPricing(
    jobs: Job[],
    standardLaborRate: number = 125
): CompanyPricingIntelligence {
    const completedJobs = (jobs || []).filter(j => j.jobStatus === 'Completed' && j.invoice);
    
    const customerMap: Record<string, {
        name: string;
        totalJobs: number;
        totalLaborBilled: number;
        totalLaborHours: number;
        items: Record<string, { totalPrice: number; count: number }>;
    }> = {};

    let globalTotalLaborBilled = 0;
    let globalTotalLaborHours = 0;

    completedJobs.forEach(job => {
        const custKey = job.customerId || job.customerName || 'Unknown Customer';
        if (!customerMap[custKey]) {
            customerMap[custKey] = {
                name: job.customerName || 'Unknown',
                totalJobs: 0,
                totalLaborBilled: 0,
                totalLaborHours: 0,
                items: {}
            };
        }

        const entry = customerMap[custKey];
        entry.totalJobs += 1;

        if (job.invoice && Array.isArray(job.invoice.items)) {
            job.invoice.items.forEach(item => {
                const itemType = item.type || '';
                const qty = item.quantity || 1;
                const unitPrice = item.unitPrice || 0;
                const total = item.total || (qty * unitPrice);

                if (itemType === 'Labor' || item.name?.toLowerCase().includes('labor')) {
                    entry.totalLaborBilled += total;
                    entry.totalLaborHours += qty;
                    globalTotalLaborBilled += total;
                    globalTotalLaborHours += qty;
                }

                if (item.name) {
                    if (!entry.items[item.name]) {
                        entry.items[item.name] = { totalPrice: 0, count: 0 };
                    }
                    entry.items[item.name].totalPrice += total;
                    entry.items[item.name].count += 1;
                }
            });
        }
    });

    const customerPatterns: Record<string, CustomerPricingPattern> = {};

    Object.entries(customerMap).forEach(([key, custData]) => {
        const avgLaborRate = custData.totalLaborHours > 0 
            ? custData.totalLaborBilled / custData.totalLaborHours 
            : standardLaborRate;

        // If billed labor rate is > 15% below standard company rate, flag as contracted customer rate
        const isContracted = avgLaborRate < (standardLaborRate * 0.85);
        const discountPct = isContracted 
            ? Math.round(((standardLaborRate - avgLaborRate) / standardLaborRate) * 100) 
            : 0;

        const frequentItems = Object.entries(custData.items)
            .map(([name, stat]) => ({
                name,
                avgBilledPrice: Math.round((stat.totalPrice / stat.count) * 100) / 100,
                count: stat.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        customerPatterns[key] = {
            customerId: key,
            customerName: custData.name,
            totalCompletedJobs: custData.totalJobs,
            avgLaborRateBilled: Math.round(avgLaborRate * 100) / 100,
            defaultLaborRate: standardLaborRate,
            isContractedRate: isContracted,
            contractedDiscountPct: discountPct,
            frequentItemsUsed: frequentItems
        };
    });

    const globalAvgRate = globalTotalLaborHours > 0 
        ? Math.round((globalTotalLaborBilled / globalTotalLaborHours) * 100) / 100 
        : standardLaborRate;

    return {
        organizationId: jobs[0]?.organizationId || '',
        totalAnalyzedJobs: completedJobs.length,
        avgEffectiveLaborRate: globalAvgRate,
        customerPatterns
    };
}
