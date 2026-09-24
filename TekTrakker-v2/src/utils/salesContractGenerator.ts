import type { User, CommissionSettings } from '../types';

export const DEFAULT_COMMISSION_RULES: CommissionSettings = {
    baseRate: 0.25,
    acceleratorRate: 0.30,
    annualQuota: 500000,
    renewalRate: 0.05,
    year2Rate: 0.05,
    lifetimeRate: 0.03,
    quarterlyMinDeals: 3,
    quarterlyMinVolume: 10000,
    inactivityCliffDays: 180,
    abandonmentDays: 60,
    annualPrepaidKickerRate: 0.05,
    monthlyMrrAccelerators: [
        { minMrr: 0, maxMrr: 2499.99, rate: 0.25 },
        { minMrr: 2500, maxMrr: 4999.99, rate: 0.275 },
        { minMrr: 5000, rate: 0.30 }
    ],
    monthlyMrrBonuses: [
        { mrr: 2500, bonus: 250 },
        { mrr: 5000, bonus: 750 },
        { mrr: 7500, bonus: 1500 },
        { mrr: 10000, bonus: 2500 },
        { mrr: 15000, bonus: 4500 },
        { mrr: 20000, bonus: 7500 }
    ],
    annualArrBonuses: [
        { arr: 30000, bonus: 5000 },
        { arr: 60000, bonus: 12000 },
        { arr: 100000, bonus: 25000 },
        { arr: 150000, bonus: 40000 }
    ],
    rampUpMonths: {
        phase1: 3,
        phase1QuotaPct: 0.50,
        phase2: 6,
        phase2QuotaPct: 0.75
    }
};

/**
 * Generates the full, standardized HTML legal agreement for an independent sales representative
 * incorporating the 19-section TekTrakker Sales Compensation Plan.
 */
export const generateSalesRepContractHtml = (rep: Partial<User>, rules: CommissionSettings = DEFAULT_COMMISSION_RULES): string => {
    const effectiveDate = rep.salesContractDate 
        ? new Date(rep.salesContractDate).toLocaleDateString()
        : new Date().toLocaleDateString();

    const repName = `${rep.firstName || ''} ${rep.lastName || ''}`.trim() || 'Representative';
    const repEmail = rep.email || '';
    const repPhone = rep.phone || rep.mobilePhone || 'N/A';
    const repAddress = rep.address 
        ? `${rep.address.street || ''}, ${rep.address.city || ''}, ${rep.address.state || ''} ${rep.address.zip || ''}`.trim().replace(/^,?\s*,?/, '')
        : 'On file with company';

    const effectiveRules = rep.customCommissionSettings || rules || DEFAULT_COMMISSION_RULES;
    const isCustomPlan = !!rep.customCommissionSettings;
    const basePct = ((effectiveRules.baseRate ?? 0.25) * 100).toFixed(1);
    const kickerPct = (((effectiveRules.annualPrepaidKickerRate ?? 0.05)) * 100).toFixed(0);
    const annualWithKickerPct = (((effectiveRules.baseRate ?? 0.25) + (effectiveRules.annualPrepaidKickerRate ?? 0.05)) * 100).toFixed(1);
    const year2Pct = (((effectiveRules.year2Rate !== undefined ? effectiveRules.year2Rate : effectiveRules.renewalRate) ?? 0.05) * 100).toFixed(1);
    const lifetimePct = ((effectiveRules.lifetimeRate ?? 0.03) * 100).toFixed(1);
    const minDeals = effectiveRules.quarterlyMinDeals ?? 3;
    const minVolFormatted = (effectiveRules.quarterlyMinVolume || 10000).toLocaleString();
    const cliffDays = effectiveRules.inactivityCliffDays ?? 180;
    const abandonDays = effectiveRules.abandonmentDays ?? 60;

    const topAcceleratorRate = (effectiveRules.monthlyMrrAccelerators && effectiveRules.monthlyMrrAccelerators.length > 0)
        ? effectiveRules.monthlyMrrAccelerators[effectiveRules.monthlyMrrAccelerators.length - 1].rate
        : (effectiveRules.baseRate ?? 0.25);
    const topAcceleratorPct = (topAcceleratorRate * 100).toFixed(1);
    const maxPossiblePct = (((topAcceleratorRate) + (effectiveRules.annualPrepaidKickerRate ?? 0.05)) * 100).toFixed(1);

    const acceleratorsTableRows = (effectiveRules.monthlyMrrAccelerators && effectiveRules.monthlyMrrAccelerators.length > 0 
        ? effectiveRules.monthlyMrrAccelerators 
        : DEFAULT_COMMISSION_RULES.monthlyMrrAccelerators!
    ).map((acc, idx, arr) => {
        const rangeText = acc.maxMrr 
            ? `$${acc.minMrr.toLocaleString()} – $${Math.floor(acc.maxMrr).toLocaleString()}`
            : `$${acc.minMrr.toLocaleString()}+`;
        const rateText = `${(acc.rate * 100).toFixed(1)}%`;
        const label = idx === 0 ? 'Standard Base' : idx === arr.length - 1 ? 'Top Producer Accelerator' : `Tier ${idx} Accelerator`;
        return `
            <tr style="${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${rangeText}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: ${idx === 0 ? '#1e293b' : idx === arr.length - 1 ? '#16a34a' : '#2563eb'};">${rateText} (${label})</td>
            </tr>
        `;
    }).join('');

    const monthlyBonusesTableRows = (effectiveRules.monthlyMrrBonuses && effectiveRules.monthlyMrrBonuses.length > 0
        ? effectiveRules.monthlyMrrBonuses
        : DEFAULT_COMMISSION_RULES.monthlyMrrBonuses!
    ).map((b, idx, arr) => {
        const mrrText = `$${b.mrr.toLocaleString()}${idx === arr.length - 1 ? '+' : ''}`;
        const bonusText = `$${b.bonus.toLocaleString()}`;
        return `
            <tr style="${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1;">${mrrText}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; font-weight: ${idx === arr.length - 1 ? '700' : '600'}; color: ${idx === arr.length - 1 ? '#16a34a' : '#0f172a'};">${bonusText}</td>
            </tr>
        `;
    }).join('');

    const annualBonusesTableRows = (effectiveRules.annualArrBonuses && effectiveRules.annualArrBonuses.length > 0
        ? effectiveRules.annualArrBonuses
        : DEFAULT_COMMISSION_RULES.annualArrBonuses!
    ).map((ab, idx, arr) => {
        const arrText = `$${ab.arr.toLocaleString()}${idx === arr.length - 1 ? '+' : ''}`;
        const bonusText = `$${ab.bonus.toLocaleString()}`;
        return `
            <tr style="${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1;">${arrText}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; font-weight: ${idx === arr.length - 1 ? '700' : '600'}; color: ${idx === arr.length - 1 ? '#16a34a' : '#0f172a'};">${bonusText}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 10px;">
            <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
                <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a;">TekTrakker Platform</h1>
                <h2 style="font-size: 15px; font-weight: 700; margin: 0; color: #334155; text-transform: uppercase; letter-spacing: 0.02em;">Independent Sales Representative Agreement, Proprietary Rights Covenant & Compensation Plan</h2>
            </div>

            <p style="margin-bottom: 16px; font-size: 13.5px;">
                This Independent Sales Representative Agreement, Proprietary Rights Covenant, and Sales Compensation Plan ("Agreement") is entered into and made effective as of <strong>${effectiveDate}</strong> ("Effective Date"), by and between <strong>TekTrakker Platform</strong> ("Company" or "TekTrakker") and <strong>${repName}</strong> ("Representative").
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px;">
                <p style="margin: 0 0 6px 0;"><strong>Company:</strong> TekTrakker Platform, field service management SaaS system.</p>
                <p style="margin: 0;"><strong>Sales Representative:</strong> <strong>${repName}</strong><br/>
                <strong>Email:</strong> ${repEmail} &nbsp;|&nbsp; <strong>Phone:</strong> ${repPhone}<br/>
                <strong>Address:</strong> ${repAddress}</p>
            </div>

            ${isCustomPlan ? `
                <div style="background-color: #f5f3ff; border: 1.5px solid #a78bfa; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; color: #6d28d9; margin-bottom: 6px;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #7c3aed;"></span>
                        Exhibit A: Individualized Sales Compensation Schedule
                    </div>
                    <p style="margin: 0 0 8px 0; line-height: 1.5; color: #4c1d95; font-size: 12.5px;">
                        This Agreement incorporates an individualized compensation schedule customized specifically for <strong>${repName}</strong>. All custom commission percentages, accelerator tiers, cash bonuses, residual percentages, and quarterly benchmarks set forth in this Agreement supersede standard platform defaults.
                    </p>
                    <div style="font-size: 11.5px; color: #5b21b6; font-weight: 600; background-color: rgba(255,255,255,0.85); padding: 8px 12px; border-radius: 6px; display: flex; flex-wrap: wrap; gap: 12px; border: 1px solid #ddd6fe;">
                        <span><strong>Base Rate:</strong> ${basePct}%</span>
                        <span>&bull;</span>
                        <span><strong>Annual Prepayment Kicker:</strong> +${kickerPct}%</span>
                        <span>&bull;</span>
                        <span><strong>Year 2 Residual:</strong> ${year2Pct}%</span>
                        <span>&bull;</span>
                        <span><strong>Year 3+ Residual:</strong> ${lifetimePct}%</span>
                        <span>&bull;</span>
                        <span><strong>Top Accelerator:</strong> ${topAcceleratorPct}%</span>
                        <span>&bull;</span>
                        <span><strong>Max Combined:</strong> ${maxPossiblePct}%</span>
                    </div>
                </div>
            ` : ''}

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">1. Engagement & Compensation Philosophy</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                TekTrakker engages Representative on a non-exclusive, independent contractor basis to solicit prospective customers for TekTrakker software subscriptions. TekTrakker is looking for exceptional revenue producers, not traditional salaried personnel. This plan provides unlimited upside for salespeople who consistently generate new, paying customers while strictly protecting TekTrakker from commissions being paid on unpaid, fraudulent, refunded, or uncollected business. There is no fixed salary, draw, or commission ceiling. High-performing sales representatives can substantially increase earnings through new business, accelerators, bonuses, and recurring residual commissions.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">2. Independent Contractor Status & Tax Indemnification</h3>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; font-size: 12.5px; line-height: 1.6;">
                <p style="margin: 0 0 8px 0;"><strong>2.1 Non-Employee Status:</strong> Representative acknowledges that they are an independent contractor and NOT an employee, partner, joint venturer, or legal agent of TekTrakker. Representative retains complete discretion, control, and autonomy over the manner, means, schedule, hours, and location of their sales activities.</p>
                <p style="margin: 0 0 8px 0;"><strong>2.2 Taxes & 1099-NEC:</strong> TekTrakker will not withhold income taxes, Social Security (FICA), Medicare, or unemployment insurance. Representative is solely responsible for paying all applicable federal, state, and local self-employment and income taxes on all amounts paid under this Agreement and must furnish a valid IRS Form W-9. Representative agrees to indemnify and hold TekTrakker harmless against any claims, liabilities, or penalties relating to unpaid taxes.</p>
                <p style="margin: 0 0 8px 0;"><strong>2.3 No Employee Benefits & Business Expenses:</strong> Representative is not eligible for, and expressly waives any claim to, workers' compensation, unemployment benefits, health insurance, paid time off, pension, retirement, or equity plans. Representative shall bear all business expenses incurred in the performance of their activities (including mobile phone, computer, internet, travel, and transportation) without reimbursement.</p>
                <p style="margin: 0;"><strong>2.4 No Agency Authority to Bind:</strong> Representative has NO power, authority, or agency to execute agreements on behalf of TekTrakker, bind the Company to any contractual obligation, alter standard pricing or licensing terms, grant unauthorized discounts, or make any express or implied warranty or representation regarding the software not contained in official Company documentation.</p>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">3. Qualifying Revenue & Condition Precedent ("Cleared Funds Only")</h3>
            <p style="margin-bottom: 6px; font-size: 13px;"><strong>3.1 Qualifying Commissionable Revenue consists strictly of:</strong></p>
            <ul style="margin: 0 0 10px 20px; padding: 0; font-size: 13px;">
                <li>TekTrakker core monthly subscription revenue actually collected from customers acquired by Representative.</li>
                <li>TekTrakker annual upfront subscription revenue actually collected from customers acquired by Representative.</li>
                <li>Qualifying TekTrakker fixed subscription add-ons (such as Virtual Worker Suite or AI Voice Receptionist monthly seat fees) actually collected from those customers.</li>
            </ul>
            <p style="margin-bottom: 6px; font-size: 13px;"><strong>3.2 Strict Exclusions (0% Non-Commissionable):</strong></p>
            <ul style="margin: 0 0 10px 20px; padding: 0; font-size: 13px; color: #991b1b;">
                <li>Metered AI token usage, LLM computing fees, and overages</li>
                <li>Metered SMS delivery and messaging unit fees</li>
                <li>Metered voice telephony minutes, trunking, and call recording fees</li>
                <li>Other usage-based infrastructure charges (e.g., cloud document storage overages)</li>
                <li>One-time onboarding, data migration, setup, or custom integration services</li>
                <li>Taxes, regulatory surcharges, or third-party merchant payment processing fees</li>
                <li>Invoices that are uncollected, written off, refunded, or charged back</li>
            </ul>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; margin-bottom: 14px; font-size: 12.5px; color: #991b1b; font-weight: 600;">
                Condition Precedent: Commission is earned ONLY on cleared money actually received and deposited in TekTrakker's bank account. A signed proposal, order form, application, verbal promise, or uncollected invoice does NOT constitute a commissionable sale.
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">4. First-Year Base Commission</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                For the initial 12 billing months following a customer's first paid subscription activation, Representative receives a <strong>Base Commission of ${basePct}%</strong> of qualifying subscription revenue actually collected by TekTrakker from that customer. <em>(Example: On a recurring subscription of $399/month, base commission is $399 × ${basePct}% = $${((399 * (effectiveRules.baseRate ?? 0.25))).toFixed(2)} for that month's collected qualifying revenue).</em>
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">5. Monthly New-MRR Accelerators</h3>
            <p style="margin-bottom: 8px; font-size: 13px;">
                Accelerators reward exceptional monthly production. The commission rate applied to all qualifying new monthly recurring revenue (MRR) collected during that calendar month scales dynamically based on total new qualifying MRR cleared:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">New Qualifying MRR Collected (Calendar Month)</th>
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">Applied Commission Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${acceleratorsTableRows}
                </tbody>
            </table>
            <p style="margin-bottom: 12px; font-size: 12px; color: #475569;">
                The applicable accelerator rate applies to all qualifying new first-year subscription revenue generated during that production calendar month. MRR counters reset to zero at 00:00:00 UTC on the first calendar day of each month.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">6. Monthly Performance Cash Bonuses</h3>
            <p style="margin-bottom: 8px; font-size: 13px;">
                In addition to commission percentages, Representative can earn a monthly lump-sum performance cash bonus based on new qualifying MRR collected in that calendar month:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">New Qualifying MRR Collected (Month)</th>
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">Monthly Cash Bonus</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthlyBonusesTableRows}
                </tbody>
            </table>
            <p style="margin-bottom: 12px; font-size: 12.5px; color: #475569;">
                <strong>Highest Tier Rule:</strong> Monthly bonuses are non-cumulative. Only the single highest milestone achieved during the calendar month is paid. (For example, generating $7,500 of new MRR pays the $1,500 bonus, not the sum of lower tiers). Bonuses are disbursed exclusively after customer funds clear.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">7. Annual Production Bonuses</h3>
            <p style="margin-bottom: 8px; font-size: 13px;">
                Annual production bonuses reward sustained year-long performance based on cumulative new qualifying annual recurring revenue (ARR) collected during the calendar year:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">Annual Cumulative New ARR Collected</th>
                        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 700;">Annual Production Bonus</th>
                    </tr>
                </thead>
                <tbody>
                    ${annualBonusesTableRows}
                </tbody>
            </table>
            <p style="margin-bottom: 12px; font-size: 12.5px; color: #475569;">
                Annual bonuses are non-cumulative and paid only upon the single highest milestone reached at the close of the calendar year, subject to verified cleared revenue retention.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">8. Annual Subscription Prepayment Incentive (+${kickerPct}% Kicker)</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                Upfront annual subscriptions substantially improve customer retention and capital efficiency. TekTrakker awards an additional <strong>+${kickerPct} percentage-point commission kicker</strong> for any qualifying customer who purchases and pays for an upfront annual subscription. <em>(Standard first-year base commission of ${basePct}% increases to <strong>${annualWithKickerPct}%</strong>, or up to <strong>${maxPossiblePct}%</strong> when combined with the top monthly accelerator rate of ${topAcceleratorPct}%).</em> The kicker applies exclusively to collected software subscription revenue.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">9. Year 2 & Year 3+ Recurring Residual Commissions</h3>
            <p style="margin-bottom: 8px; font-size: 13px;">
                To align Representative with long-term customer success and account health:
            </p>
            <ul style="margin: 0 0 12px 20px; padding: 0; font-size: 13px;">
                <li><strong>Year 2 Residual (Months 13–24):</strong> <strong>${year2Pct}%</strong> of qualifying subscription revenue actually collected from the customer.</li>
                <li><strong>Year 3 and Beyond Residual (Months 25+):</strong> <strong>${lifetimePct}%</strong> of qualifying subscription revenue collected for the active life of the customer account, subject to maintaining Active Standing under Section 10.</li>
            </ul>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">10. Residual Eligibility, Quota Benchmarks & Inactivity Sunset Standards</h3>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 14px; font-size: 12.5px; line-height: 1.55;">
                <p style="margin: 0 0 8px 0;">Recurring residuals represent ongoing compensation for continued business development, customer advocacy, and brand representation. To remain eligible for residual commissions, Representative must maintain Active Standing:</p>
                <ul style="margin: 0 0 10px 18px; padding: 0;">
                    <li><strong>Quarterly Production Standard:</strong> Representative must close a minimum of <strong>${minDeals} new qualifying subscription Organizations</strong> (or generate at least <strong>$${minVolFormatted}</strong> in new annual contract value) per calendar quarter.</li>
                    <li><strong>Temporary Suspension:</strong> Missing the quarterly benchmark places Representative in <em>Suspended Residual Status</em>, temporarily pausing Year 3+ (${lifetimePct}%) residuals for the following quarter. No retroactive backpay is provided upon curing.</li>
                    <li><strong>The ${cliffDays}-Day Production Cliff:</strong> Failing to meet the quarterly standard for two (2) consecutive calendar quarters (${cliffDays} days) classifies Representative as <em>Permanently Inactive</em>. All residual rights permanently terminate and revert to Company Direct ("House").</li>
                    <li><strong>The ${abandonDays}-Day Platform Abandonment Rule:</strong> Zero activity (no logins, lead status changes, or logged outreach) in the TekTrakker Sales Portal for ${abandonDays} consecutive calendar days constitutes voluntary abandonment, causing immediate, irreversible forfeiture of all ongoing residuals.</li>
                    <li><strong>30-Day Notice to Cure:</strong> Company issues electronic notice thirty (30) days prior to the ${cliffDays}-day cliff. Representative may cure by closing at least one (1) qualifying paid subscription deal within said 30-day period.</li>
                </ul>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">11. Lead Registration, Attribution & House Accounts</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                A customer is credited to Representative only if Representative has logged and registered the prospect inside the TekTrakker CRM prior to initial deal close. Inbound marketing leads, website signups, strategic partner accounts, and re-activated churned accounts are Company House Accounts unless specifically assigned in writing by TekTrakker management. TekTrakker possesses sole, final, and unappealable authority in resolving any lead attribution or territory disputes.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">12. Payment Schedule, Disbursals & Right of Setoff</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                <strong>12.1 Disbursals:</strong> Earned commissions on cleared funds are calculated at the end of each calendar month and disbursed within thirty (30) days following month-end reconciliation.<br/>
                <strong>12.2 Comprehensive Right of Setoff:</strong> TekTrakker reserves the absolute right to deduct, withhold, or offset any sums owed by Representative to Company—including chargebacks, customer refunds, clawbacks, overpayments, or unearned commissions—from any present or future commission payments, bonuses, or residuals.<br/>
                <strong>12.3 Repayment of Negative Balances:</strong> If an account adjustment or customer cancellation produces a negative balance, Representative covenants and agrees to remit payment in full to TekTrakker within thirty (30) calendar days of written demand.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">13. Clawbacks, Cancellations & Anti-Fraud Safeguards</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                Commissions correspond strictly to retained subscription revenue. If a customer cancels, disputes, requests a chargeback, or defaults on payment within ninety (90) days of initial purchase, 100% of the commission and bonus credited for that transaction is subject to clawback. Representative shall not engage in self-dealing, create fictitious accounts, pay customer subscription fees out-of-pocket, or offer unauthorized side kickbacks to trigger bonuses. Any such conduct constitutes material breach, resulting in immediate termination for Cause and total forfeiture of all accrued and future compensation.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">14. Proprietary Property, Customer Data & Trade Secrets (DTSA Notice)</h3>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; font-size: 12px; line-height: 1.55;">
                <p style="margin: 0 0 8px 0;"><strong>14.1 Sole Ownership:</strong> All customer lists, prospective lead lists, subscriber records, CRM data, pricing formulas, platform architectures, marketing workflows, and software assets are and shall remain the exclusive, confidential, and proprietary property of TekTrakker. Representative acquires zero ownership or license in any customer relationship or Company data.</p>
                <p style="margin: 0 0 8px 0;"><strong>14.2 Strict Non-Disclosure:</strong> Representative covenants not to disclose, duplicate, download, or utilize Company Trade Secrets or Confidential Information at any time during or after the term of this Agreement, except as strictly required to solicit subscriptions for TekTrakker.</p>
                <p style="margin: 0;"><strong>14.3 Defend Trade Secrets Act (DTSA) Notice (18 U.S.C. § 1833(b)):</strong> Representative is hereby notified that an individual shall not be held criminally or civilly liable under any federal or state trade secret law for the disclosure of a trade secret that is made in confidence to a federal, state, or local government official, or to an attorney, solely for the purpose of reporting or investigating a suspected violation of law, or made in a complaint filed under seal in a lawsuit.</p>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">15. Restrictive Covenants: Non-Solicitation & Non-Circumvention</h3>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; font-size: 12px; line-height: 1.55;">
                <p style="margin: 0 0 8px 0;">In consideration of the confidential data, trade secrets, and substantial upside provided herein, Representative covenants and agrees that during this Agreement and for a period of <strong>twelve (12) months following termination</strong> for any reason, Representative shall not directly or indirectly:</p>
                <ul style="margin: 0 0 8px 18px; padding: 0;">
                    <li>Solicit, divert, induce, or encourage any customer, subscriber, or registered prospect of TekTrakker to cancel, terminate, downgrade, or transfer their software subscription.</li>
                    <li>Circumvent TekTrakker by steering, brokering, or selling any competing field service management (FSM) software, CRM, or contractor platform to any customer or lead introduced or serviced during their affiliation with TekTrakker.</li>
                    <li>Solicit, recruit, or entice any employee, independent contractor, or representative of TekTrakker to terminate their affiliation with the Company.</li>
                </ul>
                <p style="margin: 0;">Representative agrees that these covenants are fair, reasonable, and necessary to protect TekTrakker's legitimate business interests and proprietary trade secrets.</p>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">16. Non-Disparagement & Professional Integrity</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                Representative covenants that neither during the term nor thereafter shall Representative make, publish, or disseminate any defamatory, disparaging, derogatory, or false statements, whether orally or in writing (including on social media, review platforms, or industry forums), concerning TekTrakker, its software platform, founders, directors, officers, or affiliates.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">17. Discretionary Monthly Contests, Spiffs & Spotlight Rewards</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                From time to time, TekTrakker management may establish discretionary monthly spotlight incentives, spot bonuses, physical prize giveaways (e.g. premium electronics, TVs, or equipment), or performance milestone raffles. Such spiffs are promotional in nature, are governed by the specific dates and criteria published by Company, and are awarded at Company's sole discretion upon verified receipt of cleared customer funds. TekTrakker reserves the right to modify, substitute, or conclude promotional contests at any time.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">18. Term, Termination & Forfeiture</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                <strong>18.1 At-Will Termination:</strong> Either party may terminate this Agreement at any time, with or without cause, upon written notice.<br/>
                <strong>18.2 Termination for Cause:</strong> If Representative engages in fraud, willful misconduct, material breach of this Agreement, violation of Section 14 (Confidentiality/Trade Secrets), Section 15 (Non-Solicitation/Non-Circumvention), or Section 16 (Non-Disparagement), TekTrakker may terminate immediately for Cause. In such event, Representative immediately and permanently forfeits all accrued, pending, and future commissions, bonuses, and residuals.<br/>
                <strong>18.3 Post-Termination Commissions:</strong> Upon termination without cause, Representative is entitled to receive commissions on qualifying revenue collected prior to the effective date of termination. Residual rights sunset in accordance with Section 10.
            </p>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">19. Mandatory Arbitration, Class Action Waiver & Governing Law</h3>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; font-size: 12px; line-height: 1.55;">
                <p style="margin: 0 0 8px 0;"><strong>19.1 Governing Law:</strong> This Agreement and any dispute arising out of or related to it shall be governed by and construed in accordance with the laws of the State of Delaware (or Company's principal place of business), without regard to conflicts of law principles.</p>
                <p style="margin: 0 0 8px 0;"><strong>19.2 Mandatory Binding Arbitration:</strong> Except for actions seeking temporary or permanent injunctive relief under Sections 14 or 15, any dispute, controversy, or claim arising out of or relating to this Agreement, its breach, or the independent contractor relationship shall be settled by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules, before a single neutral arbitrator.</p>
                <p style="margin: 0 0 8px 0;"><strong>19.3 Class & Collective Action Waiver:</strong> Representative and Company mutually agree that all claims must be brought strictly in each party's individual capacity, and NOT as a plaintiff or class member in any purported class, collective, or representative proceeding. The arbitrator may not consolidate claims or preside over any form of representative proceeding.</p>
                <p style="margin: 0 0 8px 0;"><strong>19.4 Waiver of Jury Trial:</strong> THE PARTIES VOLUNTARILY, INTENTIONALLY, AND UNCONDITIONALLY WAIVE ANY AND ALL RIGHTS TO A TRIAL BY JURY IN ANY LEGAL ACTION ARISING HEREUNDER.</p>
                <p style="margin: 0 0 8px 0;"><strong>19.5 Injunctive Relief:</strong> Representative acknowledges that any breach of Sections 14, 15, or 16 will result in immediate, irreparable injury for which monetary damages are inadequate. Company shall be entitled to obtain preliminary and permanent injunctive relief in any court of competent jurisdiction without the requirement of posting a bond.</p>
                <p style="margin: 0;"><strong>19.6 Prevailing Party Attorneys' Fees:</strong> In any arbitration or legal proceeding arising out of this Agreement, the prevailing party shall be entitled to recover from the non-prevailing party all reasonable attorneys' fees, expert fees, arbitration expenses, and court costs.</p>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">20. Entire Agreement, Severability & Electronic Signatures</h3>
            <p style="margin-bottom: 12px; font-size: 13px;">
                <strong>20.1 Merger & Integration:</strong> This Agreement constitutes the complete, final, and exclusive understanding between Company and Representative, superseding all prior oral discussions, representations, promises, emails, or drafts. No modification or amendment shall be binding unless executed in writing by an authorized executive officer of TekTrakker.<br/>
                <strong>20.2 Severability & Reformation:</strong> If any provision of this Agreement is held to be invalid or unenforceable, such provision shall be severed or reformed to the minimum extent necessary to make it valid and enforceable, and all remaining provisions shall remain in full force and effect.<br/>
                <strong>20.3 Electronic Signatures (E-SIGN Act):</strong> The parties consent to electronic execution under the Federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.) and the Uniform Electronic Transactions Act (UETA). Digital signatures, timestamped biometric consents, or uploaded signature images shall have the full legal force and effect of an original manual ink signature.
            </p>
        </div>
    `;
};

/**
 * Appends the visual signature stamps and execution section to the contract HTML.
 */
export const formatContractWithSignature = (contractHtml: string, rep: Partial<User>): string => {
    const repName = `${rep.firstName || ''} ${rep.lastName || ''}`.trim() || 'Sales Representative';
    const signedDate = rep.salesContractDate ? new Date(rep.salesContractDate).toLocaleString() : '';

    const signatureSection = rep.salesContractSigned && rep.salesContractSignature ? `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #0f172a; display: flex; justify-content: space-between; page-break-inside: avoid; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="width: 46%;">
                <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 13px; color: #0f172a;">TekTrakker Platform</p>
                <div style="height: 50px; border-bottom: 1px solid #334155; display: flex; align-items: flex-end; padding-bottom: 4px;">
                    <span style="font-family: cursive, serif; font-size: 18px; color: #2563eb;">TekTrakker Executive Office</span>
                </div>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Authorized Company Representative</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #16a34a; font-weight: 600;">Status: Approved & Verified</p>
            </div>
            <div style="width: 46%;">
                <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 13px; color: #0f172a;">${repName}</p>
                <div style="height: 50px; border-bottom: 1px solid #334155; display: flex; align-items: flex-end; padding-bottom: 4px;">
                    <img src="${rep.salesContractSignature}" alt="Signature" style="max-height: 48px; max-width: 100%; display: block;" />
                </div>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Independent Sales Representative</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #16a34a; font-weight: 600;">Electronically Signed: ${signedDate || 'Recorded'}</p>
            </div>
        </div>
    ` : `
        <div style="margin-top: 30px; padding: 14px; background-color: #fffbeb; border: 1px dashed #f59e0b; border-radius: 6px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <p style="margin: 0; color: #b45309; font-weight: 700; font-size: 13px; text-transform: uppercase;">Agreement Pending Signature</p>
            <p style="margin: 4px 0 0 0; color: #92400e; font-size: 12px;">This agreement requires the representative's electronic signature prior to commission payout activation.</p>
        </div>
    `;

    return contractHtml + signatureSection;
};
