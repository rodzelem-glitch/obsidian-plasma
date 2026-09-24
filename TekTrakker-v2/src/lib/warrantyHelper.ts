import { IndustryVertical, Organization, WarrantyPlanTemplate, WarrantyContract, WarrantyAgeTier, WarrantySublimit } from '../types';

/**
 * Returns the default customizable Warranty & Protection Plan template for an organization and trade.
 * For HVAC, this default accurately reflects the 3-page HVAC Limited Repair Warranty structure.
 */
export const getDefaultWarrantyPlan = (
    trade: IndustryVertical = 'HVAC',
    org?: Organization | null
): WarrantyPlanTemplate => {
    const orgState = org?.address?.state || 'Texas';
    const orgCity = org?.address?.city || 'San Antonio';
    const countyGuess = orgState === 'TX' && orgCity.toLowerCase().includes('san antonio') ? 'Bexar County' : `${orgCity} County`;

    if (trade === 'HVAC') {
        return {
            id: `plan_hvac_${Date.now()}`,
            trade: 'HVAC',
            planTitle: 'HVAC LIMITED REPAIR WARRANTY',
            planSubtitle: 'LOCAL SERVICE. REAL PROTECTION.',
            termMonths: 12,
            allowAutoRenew: false,
            qualificationFee: 129,
            qualificationFeeWaiverDays: 30,
            waitingPeriodDays: 30,
            serviceFee: 125,
            annualAggregateLimit: 2500,
            replacementCreditLimit: 1500,
            ageTiers: [
                {
                    id: 'tier_0_10',
                    minYears: 0,
                    maxYears: 10,
                    label: '0–10 Years',
                    annualPrice: 649,
                    additionalSystemPrice: 549,
                    enrollmentNotes: 'Standard eligibility upon inspection approval'
                },
                {
                    id: 'tier_11_15',
                    minYears: 11,
                    maxYears: 15,
                    label: '11–15 Years',
                    annualPrice: 799,
                    additionalSystemPrice: 699,
                    enrollmentNotes: 'Higher-risk age band; management approval required',
                    requiresManagementApproval: true
                },
                {
                    id: 'tier_16_plus',
                    minYears: 16,
                    maxYears: 99,
                    label: '16+ Years',
                    annualPrice: 999,
                    additionalSystemPrice: 899,
                    enrollmentNotes: 'Only by written special endorsement',
                    isSpecialEndorsement: true
                }
            ],
            sublimits: [
                {
                    id: 'sub_sealed',
                    category: 'Major Sealed-System',
                    examples: 'Compressor, evaporator coil, condenser coil, reversing valve',
                    maxLimit: 1500,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_heatex',
                    category: 'Heat Exchanger / Furnace Safety',
                    examples: 'Major heat exchanger failure, primary safety limit breakdown',
                    maxLimit: 1000,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_airmoving',
                    category: 'Air-Moving Components',
                    examples: 'Indoor blower motor/ECM module, condenser fan motor',
                    maxLimit: 900,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_heating',
                    category: 'Heating Components',
                    examples: 'Inducer motor, gas valve, igniter, limit switches, approved heat strips',
                    maxLimit: 750,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_metering',
                    category: 'Metering Devices',
                    examples: 'TXV or fixed metering device (when failure is verified by provider)',
                    maxLimit: 750,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_electrical',
                    category: 'Electrical & Controls',
                    examples: 'Control boards, contactors, capacitors, relays, transformers, pressure switches',
                    maxLimit: 600,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_refrigerant',
                    category: 'Refrigerant Allowance',
                    examples: 'Refrigerant required as part of an authorized covered repair',
                    maxLimit: 400,
                    limitType: 'per_contract_year'
                },
                {
                    id: 'sub_condensate',
                    category: 'Condensate Components',
                    examples: 'Standard condensate float switch, overflow trap, or condensate pump',
                    maxLimit: 250,
                    limitType: 'per_contract_year'
                },
                {
                    id: 'sub_thermostat',
                    category: 'Standard Thermostat',
                    examples: 'Basic compatible non-programmable/digital thermostat and standard installation',
                    maxLimit: 200,
                    limitType: 'per_contract_year'
                }
            ],
            eligibleUnitTypes: ['Split', 'Package', 'Heat Pump', 'Gas-Electric', 'Ductless Mini-Split'],
            eligibleRefrigerants: ['R-410A', 'R-454B', 'R-32', 'R-22 (Endorsement Only)', 'Other'],
            maxTonnage: 5,
            maxSystemAgeYears: 15,
            serviceAreaDescription: `Residential properties within authorized ${orgCity}, ${orgState} service territory`,
            governingState: orgState,
            governingCounty: countyGuess,
            cancellationTerms: `Customer Cancellation: Cancelable anytime in writing. Full refund minus benefits paid if canceled during Days 1–30. Daily pro-rata refund minus benefits paid and a $50 processing fee if canceled on or after Day 31. Provider Cancellation: Permitted for non-payment, fraud, misrepresentation, or unsafe access upon 5 days' written notice with pro-rata refund.`,
            acknowledgmentItems: [
                'I received and reviewed the complete agreement, including component sublimits, exclusions, and total aggregate caps.',
                'I understand this is a limited repair warranty, not homeowners insurance and not a guarantee of full system replacement.',
                'I acknowledge the $125 service fee per claim, the 30-day waiting period, and the $2,500 annual limit.',
                'I understand that the service provider must directly authorize all repairs and that pre-existing conditions are strictly excluded.',
                'I acknowledge there is no automatic renewal upon expiration of the 12-month term.'
            ]
        };
    }

    if (trade === 'Plumbing') {
        return {
            id: `plan_plumbing_${Date.now()}`,
            trade: 'Plumbing',
            planTitle: 'PLUMBING LIMITED REPAIR WARRANTY',
            planSubtitle: 'COMPLETE HOME PLUMBING PROTECTION',
            termMonths: 12,
            allowAutoRenew: false,
            qualificationFee: 129,
            qualificationFeeWaiverDays: 30,
            waitingPeriodDays: 30,
            serviceFee: 125,
            annualAggregateLimit: 2500,
            replacementCreditLimit: 1200,
            ageTiers: [
                {
                    id: 'tier_0_10',
                    minYears: 0,
                    maxYears: 10,
                    label: '0–10 Years',
                    annualPrice: 549,
                    additionalSystemPrice: 449,
                    enrollmentNotes: 'Standard eligibility upon inspection approval'
                },
                {
                    id: 'tier_11_20',
                    minYears: 11,
                    maxYears: 20,
                    label: '11–20 Years',
                    annualPrice: 699,
                    additionalSystemPrice: 599,
                    enrollmentNotes: 'Requires diagnostic inspection and static pressure test'
                }
            ],
            sublimits: [
                {
                    id: 'sub_waterheater',
                    category: 'Water Heater & Tank Breakdown',
                    examples: 'Burner assembly, heating elements, thermostats, gas valves, dip tube, T&P valve',
                    maxLimit: 1200,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_mainvalves',
                    category: 'Main Shutoff & Pressure Regulating Valves',
                    examples: 'PRV valve replacement, main ball valve, whole-home backflow preventer',
                    maxLimit: 800,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_drainlines',
                    category: 'Interior Waste & Supply Line Clearances',
                    examples: 'Mechanical snaking, trap repair, supply angle stops, toilet fill valves',
                    maxLimit: 500,
                    limitType: 'per_contract_year'
                }
            ],
            eligibleUnitTypes: ['Tank Water Heater', 'Tankless Water Heater', 'Standard Whole-Home Plumbing'],
            serviceAreaDescription: `Residential properties within authorized ${orgCity}, ${orgState} service territory`,
            governingState: orgState,
            governingCounty: countyGuess,
            cancellationTerms: `Cancelable anytime in writing. Full refund minus benefits paid during Days 1–30. Pro-rata refund minus benefits and a $50 processing fee thereafter.`,
            acknowledgmentItems: [
                'I received and reviewed the complete agreement, including component sublimits, exclusions, and total aggregate caps.',
                'I understand this is a limited repair warranty and not homeowners insurance.',
                'I acknowledge the $125 service fee per claim, the 30-day waiting period, and the annual aggregate limit.',
                'I understand that all service must be authorized prior to work and pre-existing leaks are excluded.',
                'I acknowledge there is no automatic renewal upon expiration of the 12-month term.'
            ]
        };
    }

    if (trade === 'Electrical') {
        return {
            id: `plan_electrical_${Date.now()}`,
            trade: 'Electrical',
            planTitle: 'ELECTRICAL LIMITED REPAIR WARRANTY',
            planSubtitle: 'RESIDENTIAL ELECTRICAL SYSTEM PROTECTION',
            termMonths: 12,
            allowAutoRenew: false,
            qualificationFee: 129,
            qualificationFeeWaiverDays: 30,
            waitingPeriodDays: 30,
            serviceFee: 125,
            annualAggregateLimit: 2500,
            replacementCreditLimit: 1500,
            ageTiers: [
                {
                    id: 'tier_0_15',
                    minYears: 0,
                    maxYears: 15,
                    label: '0–15 Years',
                    annualPrice: 499,
                    additionalSystemPrice: 399,
                    enrollmentNotes: 'Standard residential panel and circuit coverage'
                },
                {
                    id: 'tier_16_plus',
                    minYears: 16,
                    maxYears: 99,
                    label: '16+ Years',
                    annualPrice: 649,
                    additionalSystemPrice: 549,
                    enrollmentNotes: 'Requires panel safety and thermal inspection'
                }
            ],
            sublimits: [
                {
                    id: 'sub_mainpanel',
                    category: 'Main Distribution Panel & Bus Bars',
                    examples: 'Main breaker, bus bar failure, internal panel lugs, surge protection module',
                    maxLimit: 1500,
                    limitType: 'per_failure'
                },
                {
                    id: 'sub_breakers',
                    category: 'Branch Circuit Breakers & GFCI/AFCI',
                    examples: 'Standard and dual-function AFCI/GFCI breakers, dedicated disconnect switches',
                    maxLimit: 600,
                    limitType: 'per_failure'
                }
            ],
            eligibleUnitTypes: ['Main Service Panel', 'Subpanel', 'Whole-Home Electrical System'],
            serviceAreaDescription: `Residential properties within authorized ${orgCity}, ${orgState} service territory`,
            governingState: orgState,
            governingCounty: countyGuess,
            cancellationTerms: `Cancelable anytime in writing. Full refund minus benefits paid during Days 1–30. Pro-rata refund minus benefits and a $50 processing fee thereafter.`,
            acknowledgmentItems: [
                'I received and reviewed the complete agreement, including component sublimits, exclusions, and total aggregate caps.',
                'I understand this is a limited repair warranty and not homeowners insurance.',
                'I acknowledge the $125 service fee per claim, the 30-day waiting period, and the annual aggregate limit.',
                'I understand that all service must be authorized prior to work and ungrounded knob-and-tube or aluminum wiring is excluded.',
                'I acknowledge there is no automatic renewal upon expiration of the 12-month term.'
            ]
        };
    }

    return {
        id: `plan_generic_${Date.now()}`,
        trade,
        planTitle: `${trade.toUpperCase()} LIMITED REPAIR WARRANTY`,
        planSubtitle: 'SERVICE & REPAIR PROTECTION PLAN',
        termMonths: 12,
        allowAutoRenew: false,
        qualificationFee: 129,
        qualificationFeeWaiverDays: 30,
        waitingPeriodDays: 30,
        serviceFee: 125,
        annualAggregateLimit: 2500,
        replacementCreditLimit: 1200,
        ageTiers: [
            {
                id: 'tier_standard',
                minYears: 0,
                maxYears: 15,
                label: 'Standard System',
                annualPrice: 599,
                additionalSystemPrice: 499,
                enrollmentNotes: 'Standard residential equipment eligibility upon inspection'
            }
        ],
        sublimits: [
            {
                id: 'sub_primary',
                category: 'Primary Mechanical Breakdown',
                examples: 'Primary mechanical components, motors, valves, and controls',
                maxLimit: 1500,
                limitType: 'per_failure'
            }
        ],
        eligibleUnitTypes: ['Standard Residential System'],
        serviceAreaDescription: `Residential properties within authorized ${orgCity}, ${orgState} service territory`,
        governingState: orgState,
        governingCounty: countyGuess,
        cancellationTerms: `Cancelable anytime in writing. Full refund minus benefits paid during Days 1–30. Pro-rata refund minus benefits and a $50 processing fee thereafter.`,
        acknowledgmentItems: [
            'I received and reviewed the complete agreement, including component sublimits, exclusions, and total aggregate caps.',
            'I understand this is a limited repair warranty and not homeowners insurance.',
            'I acknowledge the service fee per claim, the waiting period, and the annual aggregate limit.',
            'I understand that all service must be authorized prior to work and pre-existing conditions are excluded.',
            'I acknowledge there is no automatic renewal upon expiration of the 12-month term.'
        ]
    };
};

export const calculateWarrantyPricing = (
    plan: WarrantyPlanTemplate,
    approxAgeYears: number,
    isAdditionalSystem = false,
    hasRecentPaidService = false
) => {
    let matchedTier = plan.ageTiers.find(t => approxAgeYears >= t.minYears && approxAgeYears <= t.maxYears);
    if (!matchedTier && plan.ageTiers.length > 0) {
        matchedTier = plan.ageTiers[plan.ageTiers.length - 1];
    }

    const basePrice = matchedTier 
        ? (isAdditionalSystem ? matchedTier.additionalSystemPrice : matchedTier.annualPrice)
        : 649;

    const qualificationFee = hasRecentPaidService ? 0 : (plan.qualificationFee || 0);
    const totalAmount = basePrice + qualificationFee;

    const agreementDate = new Date();
    const effectiveDate = new Date(agreementDate);
    effectiveDate.setDate(effectiveDate.getDate() + (plan.waitingPeriodDays || 30));

    const expirationDate = new Date(agreementDate);
    expirationDate.setMonth(expirationDate.getMonth() + (plan.termMonths || 12));

    return {
        matchedTier,
        basePrice,
        qualificationFee,
        qualificationFeeWaived: hasRecentPaidService,
        totalAmount,
        agreementDate: agreementDate.toISOString().split('T')[0],
        effectiveDate: effectiveDate.toISOString().split('T')[0],
        expirationDate: expirationDate.toISOString().split('T')[0]
    };
};

export const generateWarrantyContractHtml = (
    contract: WarrantyContract,
    org?: Organization | null
): string => {
    const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = org?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
    const orgPhone = org?.phone || (isTekAir ? '(210) 318-4197' : '');
    const orgEmail = org?.email || (isTekAir ? 'operations@tekairinc.com' : '');
    const orgWeb = org?.website || (isTekAir ? 'tekairinc.com' : '');
    const orgLicense = org?.licenseNumber || org?.taxId || (isTekAir ? 'TACLA73240E' : '');
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const orgCity = org?.address?.city || (isTekAir ? 'San Antonio' : '');
    const orgState = org?.address?.state || (isTekAir ? 'TX' : '');

    const agreementDateStr = contract.agreementDate ? new Date(contract.agreementDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const effectiveDateStr = contract.effectiveDate ? new Date(contract.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Day 31';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; }
    body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        background-color: #ffffff;
        margin: 0;
        padding: 0;
        font-size: 11px;
        line-height: 1.45;
    }
    .warranty-page {
        width: 100%;
        max-width: 780px;
        margin: 0 auto 30px auto;
        padding: 24px 30px;
        background: #ffffff;
        box-sizing: border-box;
    }
    .pdf-page-break {
        page-break-before: always !important;
        break-before: page !important;
    }
    .header-banner {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 16px;
    }
    .header-title-box h1 {
        margin: 0 0 2px 0;
        font-size: 26px;
        font-weight: 900;
        color: #0284c7;
        letter-spacing: -0.5px;
    }
    .header-title-box h2 {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        color: #1e293b;
        letter-spacing: 0.5px;
    }
    .header-title-box h3 {
        margin: 2px 0 0 0;
        font-size: 13px;
        font-weight: 900;
        color: #dc2626;
        letter-spacing: 0.5px;
    }
    .meta-box {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-bottom: 16px;
        overflow: hidden;
    }
    .meta-table {
        width: 100%;
        border-collapse: collapse;
    }
    .meta-table th {
        background: #0f172a;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        padding: 6px 12px;
        text-align: left;
        letter-spacing: 0.5px;
    }
    .meta-table td {
        padding: 6px 12px;
        font-size: 11px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
    }
    .section-header {
        font-size: 12px;
        font-weight: 900;
        color: #0f172a;
        text-transform: uppercase;
        border-bottom: 2px solid #f97316;
        padding-bottom: 3px;
        margin: 18px 0 10px 0;
        letter-spacing: 0.5px;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
        font-size: 10.5px;
    }
    .data-table th {
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
        padding: 6px 8px;
        text-align: left;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .data-table td {
        padding: 6px 8px;
        border: 1px solid #e2e8f0;
        vertical-align: top;
    }
    .data-table tr:nth-child(even) {
        background: #f8fafc;
    }
    .highlight-card {
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 14px;
    }
    .exclusion-box {
        border: 1px dashed #94a3b8;
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px 12px;
        margin: 10px 0;
        font-size: 10px;
        color: #475569;
    }
    .footer-stamp {
        border-top: 1px solid #cbd5e1;
        margin-top: 20px;
        padding-top: 8px;
        font-size: 9px;
        color: #64748b;
        display: flex;
        justify-content: space-between;
    }
    .sig-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }
    .sig-table td {
        width: 50%;
        padding: 10px 14px;
        vertical-align: top;
        border: 1px solid #cbd5e1;
        background: #ffffff;
    }
</style>
</head>
<body>

    <!-- PAGE 1 -->
    <div class="warranty-page">
        <div class="header-banner">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="60%" class="header-title-box">
                        ${orgLogo ? `<img src="${orgLogo}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 4px; display: block;" alt="${orgName}" />` : `<h1>${orgName.toUpperCase()}</h1>`}
                        <h2>LOCAL SERVICE. REAL PROTECTION.</h2>
                        <h3>${contract.planTitle || 'HVAC LIMITED REPAIR WARRANTY'}</h3>
                    </td>
                    <td width="40%" style="text-align: right; font-size: 10px; color: #475569; line-height: 1.4;">
                        <div style="font-weight: 800; color: #0f172a; font-size: 13px;">${orgName}</div>
                        <div>${orgCity}, ${orgState}</div>
                        <div>Phone: <strong>${orgPhone}</strong></div>
                        <div>Email: ${orgEmail}</div>
                        <div>Web: ${orgWeb}</div>
                        <div>License: <strong>${orgLicense}</strong></div>
                    </td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 12px;">
            <div class="section-header" style="margin-top: 0;">Agreement &amp; Customer Identification</div>
            <div style="font-size: 10px; color: #dc2626; font-weight: 700; margin-bottom: 8px;">
                No Automatic Renewal Notice: This agreement automatically expires at the end of its stated 12-month term. ${orgName} will not automatically renew it. A new warranty must be separately offered, qualified, priced, and accepted.
            </div>
            
            <div class="meta-box">
                <table class="meta-table">
                    <tr>
                        <th width="50%">AGREEMENT INFORMATION</th>
                        <th width="50%">CUSTOMER &amp; PROPERTY INFORMATION</th>
                    </tr>
                    <tr>
                        <td>
                            <div><strong>Agreement No.:</strong> ${contract.contractNumber || 'WAR-' + contract.id.slice(-8).toUpperCase()}</div>
                            <div style="margin-top: 4px;"><strong>Agreement Date:</strong> ${agreementDateStr}</div>
                            <div style="margin-top: 4px;"><strong>Contract Term:</strong> 12 Months from Agreement Date</div>
                            <div style="margin-top: 4px;"><strong>Coverage Effective:</strong> ${effectiveDateStr} (Day 31)</div>
                        </td>
                        <td>
                            <div><strong>Customer Name:</strong> ${contract.customerName || 'Valued Customer'}</div>
                            <div style="margin-top: 4px;"><strong>Service Address:</strong> ${contract.serviceAddress || 'Address on file'}</div>
                            <div style="margin-top: 4px;"><strong>Phone:</strong> ${contract.customerPhone || 'N/A'} &nbsp;|&nbsp; <strong>Email:</strong> ${contract.customerEmail || 'N/A'}</div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="section-header">1. Enrollment, System Eligibility &amp; Pricing</div>
        <p style="margin: 0 0 8px 0; font-size: 10.5px; color: #334155;">
            Coverage is issued only after ${orgName} completes and documents a qualifying service, repair, installation, or replacement on the exact system identified below.
        </p>

        <div class="meta-box" style="margin-bottom: 12px;">
            <table class="meta-table">
                <tr>
                    <th colspan="2">ENROLLED SYSTEM SPECIFICATIONS</th>
                </tr>
                <tr>
                    <td width="50%">
                        <div><strong>System Type:</strong> ${contract.systemType || 'Split System'}</div>
                        <div style="margin-top: 3px;"><strong>Nominal Tons:</strong> ${contract.nominalTons || 3} Tons</div>
                        <div style="margin-top: 3px;"><strong>Outdoor Model:</strong> ${contract.outdoorModel || 'N/A'}</div>
                        <div style="margin-top: 3px;"><strong>Indoor Model:</strong> ${contract.indoorModel || 'N/A'}</div>
                        <div style="margin-top: 3px;"><strong>Qualifying Invoice #:</strong> ${contract.qualifyingInvoiceNumber || 'INV-QUALIFIED'}</div>
                    </td>
                    <td width="50%">
                        <div><strong>Refrigerant:</strong> ${contract.refrigerant || 'R-410A'}</div>
                        <div style="margin-top: 3px;"><strong>Approx. Age:</strong> ${contract.approxAgeYears || 5} Years</div>
                        <div style="margin-top: 3px;"><strong>Outdoor Serial:</strong> ${contract.outdoorSerial || 'N/A'}</div>
                        <div style="margin-top: 3px;"><strong>Indoor Serial:</strong> ${contract.indoorSerial || 'N/A'}</div>
                        <div style="margin-top: 3px;"><strong>Qualifying Date:</strong> ${contract.qualifyingServiceDate || agreementDateStr}</div>
                    </td>
                </tr>
            </table>
        </div>

        <div style="font-weight: 800; font-size: 11px; margin-bottom: 4px; color: #0f172a;">Annual Pricing Structure</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th width="20%">ELIGIBLE SYSTEM AGE</th>
                    <th width="20%">ANNUAL PRICE</th>
                    <th width="25%">ADDITIONAL SYSTEM PRICE*</th>
                    <th width="35%">ENROLLMENT NOTES</th>
                </tr>
            </thead>
            <tbody>
                <tr ${contract.approxAgeYears <= 10 ? 'style="background: #e0f2fe; font-weight: bold;"' : ''}>
                    <td>0–10 Years</td>
                    <td>$649</td>
                    <td>$549</td>
                    <td>Standard eligibility upon inspection approval</td>
                </tr>
                <tr ${contract.approxAgeYears > 10 && contract.approxAgeYears <= 15 ? 'style="background: #e0f2fe; font-weight: bold;"' : ''}>
                    <td>11–15 Years</td>
                    <td>$799</td>
                    <td>$699</td>
                    <td>Higher-risk age band; management approval required</td>
                </tr>
                <tr ${contract.approxAgeYears > 15 ? 'style="background: #e0f2fe; font-weight: bold;"' : ''}>
                    <td>16+ Years</td>
                    <td>Special Endorsement</td>
                    <td>Special Endorsement</td>
                    <td>Only by written special endorsement</td>
                </tr>
            </tbody>
        </table>
        <div style="font-size: 9.5px; color: #64748b; margin-top: -8px; margin-bottom: 12px;">
            *Additional-system pricing applies only at the same service address and enrollment period. Each system must be separately qualified.
        </div>

        <div class="highlight-card">
            <div style="font-weight: 800; font-size: 11px; color: #166534; margin-bottom: 4px;">Core Financial Terms:</div>
            <ul style="margin: 0; padding-left: 18px; font-size: 10px; color: #15803d; line-height: 1.5;">
                <li><strong>Qualification Service Fee:</strong> $129 per system ${contract.qualificationFeeWaived ? '(WAIVED — qualifying service performed within preceding 30 days)' : '(due at enrollment)'}.</li>
                <li><strong>Waiting Period:</strong> Coverage begins on <strong>Day 31</strong> after Agreement Date (${effectiveDateStr}). Failures occurring during Days 1–30 are excluded.</li>
                <li><strong>Service Fee (Deductible):</strong> <strong>$125</strong> per covered-service event due at dispatch.</li>
                <li><strong>Annual Aggregate Limit:</strong> <strong>$2,500 maximum</strong> per covered system per contract year, covering all parts, labor, refrigerant, and replacement assistance.</li>
                <li><strong>Payment &amp; Existing Coverage:</strong> Full warranty price ($${contract.totalAmount || 649}) due prior to issuance. Manufacturer parts warranties or workmanship warranties remain separate and are utilized first.</li>
            </ul>
        </div>

        <div class="footer-stamp">
            <div>${orgName} | License: ${orgLicense} | Phone: ${orgPhone}</div>
            <div>Page 1 of 3</div>
        </div>
    </div>

    <!-- PAGE 2 -->
    <div class="warranty-page pdf-page-break">
        <div class="section-header" style="margin-top: 0;">2. Covered Failures &amp; Benefit Sublimits</div>
        <p style="margin: 0 0 10px 0; font-size: 10px; color: #334155;">
            Subject to all eligibility rules, exclusions, the $125 service fee, and the $2,500 annual aggregate limit, ${orgName} provides repair benefits for mechanical or electrical breakdown caused by ordinary residential use.
        </p>

        <table class="data-table">
            <thead>
                <tr>
                    <th width="30%">COVERAGE CATEGORY</th>
                    <th width="45%">EXAMPLES OF COVERED COMPONENTS</th>
                    <th width="25%">MAXIMUM BENEFIT LIMIT</th>
                </tr>
            </thead>
            <tbody>
                ${(contract.sublimits && contract.sublimits.length > 0 ? contract.sublimits : [
                    { category: 'Major Sealed-System', examples: 'Compressor, evaporator coil, condenser coil, reversing valve', maxLimit: 1500, limitType: 'per_failure' },
                    { category: 'Heat Exchanger / Furnace Safety', examples: 'Major heat exchanger failure, primary safety limit breakdown', maxLimit: 1000, limitType: 'per_failure' },
                    { category: 'Air-Moving Components', examples: 'Indoor blower motor/ECM module, condenser fan motor', maxLimit: 900, limitType: 'per_failure' },
                    { category: 'Heating Components', examples: 'Inducer motor, gas valve, igniter, limit switches, approved heat strips', maxLimit: 750, limitType: 'per_failure' },
                    { category: 'Metering Devices', examples: 'TXV or fixed metering device (when failure is verified by provider)', maxLimit: 750, limitType: 'per_failure' },
                    { category: 'Electrical & Controls', examples: 'Control boards, contactors, capacitors, relays, transformers, pressure switches', maxLimit: 600, limitType: 'per_failure' },
                    { category: 'Refrigerant Allowance', examples: 'Refrigerant required as part of an authorized covered repair', maxLimit: 400, limitType: 'per_contract_year' },
                    { category: 'Condensate Components', examples: 'Standard condensate float switch, overflow trap, or condensate pump', maxLimit: 250, limitType: 'per_contract_year' },
                    { category: 'Standard Thermostat', examples: 'Basic compatible non-programmable/digital thermostat and standard installation', maxLimit: 200, limitType: 'per_contract_year' }
                ]).map(sub => `
                    <tr>
                        <td><strong>${sub.category}</strong></td>
                        <td style="color: #475569;">${sub.examples}</td>
                        <td style="font-weight: 700; color: #0284c7;">$${sub.maxLimit} ${sub.limitType === 'per_contract_year' ? 'per contract year' : 'per covered failure'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
            <div style="font-weight: 800; font-size: 11px; color: #0f172a; margin-bottom: 3px;">System Replacement Assistance (Up to $1,500):</div>
            <div style="font-size: 10px; color: #475569; line-height: 1.45;">
                If ${orgName} determines that an otherwise covered major failure is unsafe, commercially unreasonable to repair, or cannot be repaired due to obsolete/unavailable components, ${orgName} may elect to apply up to <strong>$1,500</strong> as a credit toward a qualifying replacement HVAC system supplied and installed by ${orgName}. This credit is in lieu of repair benefits, counts toward the $2,500 annual aggregate limit, has no cash value, and is non-transferable.
            </div>
        </div>

        <div class="section-header">3. Eligibility Rules, Waiting Period &amp; Excluded Conditions</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 10px; color: #334155; line-height: 1.5;">
            <li><strong>Service Location:</strong> Residential properties within ${orgName}'s authorized service territory (${orgCity}, ${orgState}).</li>
            <li><strong>Equipment Eligibility:</strong> Conventional residential systems &le; 5 nominal tons and &le; 15 years of age. Ductless/mini-split, VRF, geothermal, R-22, or commercial systems are excluded unless added via written endorsement.</li>
            <li><strong>Day 1–30 Waiting Period:</strong> Breakdown benefits begin on the 31st calendar day after Agreement Date (${effectiveDateStr}). Symptoms, leaks, faults, or pre-existing conditions reported or existing during Days 1–30 are excluded.</li>
        </ul>

        <div style="margin-top: 10px;">
            <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #0f172a; margin-bottom: 4px;">Known / Excluded Conditions Documented at Enrollment</div>
            <div class="exclusion-box">
                ${contract.documentedExcludedConditions || 'None documented at time of initial enrollment inspection. System verified in operable condition.'}
            </div>
        </div>

        <div class="section-header">4. Requesting Service &amp; ${orgName.toUpperCase()} Repair Authority</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 10px; color: #334155; line-height: 1.5;">
            <li><strong>Direct Authorization Required:</strong> All failures must be reported directly to ${orgName} prior to work. No reimbursement is provided for repairs, parts, or diagnoses performed by third-party contractors without prior written ${orgName} approval.</li>
            <li><strong>Service Fee &amp; Response:</strong> $125 service fee is due at dispatch. Standard service response is initiated within 48 hours. Service fee is waived for return visits within 30 days for the same unresolved repair.</li>
            <li><strong>Repair Authority:</strong> ${orgName} retains sole authority to diagnose failures and determine repair vs. replacement methods.</li>
        </ul>

        <div class="footer-stamp">
            <div>${orgName} | License: ${orgLicense} | Phone: ${orgPhone}</div>
            <div>Page 2 of 3</div>
        </div>
    </div>

    <!-- PAGE 3 -->
    <div class="warranty-page pdf-page-break">
        <div class="section-header" style="margin-top: 0;">5. Standard Exclusions &amp; Limitations</div>
        <p style="margin: 0 0 6px 0; font-size: 10px; font-weight: bold; color: #dc2626;">This limited warranty does NOT cover:</p>
        <ul style="margin: 0; padding-left: 18px; font-size: 10px; color: #334155; line-height: 1.5;">
            <li><strong>Pre-Existing Conditions:</strong> Any fault, leak, or defect existing prior to Day 31 of coverage.</li>
            <li><strong>Maintenance &amp; Neglect:</strong> Dirty filters/coils, clogged condensate lines, lack of maintenance, or damage from continued operation after failure.</li>
            <li><strong>External Causes:</strong> Power surges, low/high grid voltage, weather, lightning, flood, freezing, pests, fire, or accidental damage.</li>
            <li><strong>Building &amp; Duct Infrastructure:</strong> Ductwork, grilles, electrical panels, gas piping, structural framing, or drywall access.</li>
            <li><strong>Cosmetic &amp; Comfort Complaints:</strong> Equipment noise, rust, odors, capacity sizing, utility costs, or thermostat programming.</li>
            <li><strong>Consequential Loss:</strong> Secondary water damage, property loss, temporary lodging, food spoilage, or indirect damages.</li>
        </ul>

        <div class="section-header">6. Cancellation, Transfer &amp; Legal Terms</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 10px; color: #334155; line-height: 1.5;">
            <li><strong>Customer Cancellation:</strong> Cancelable anytime in writing. Full refund minus benefits paid if canceled during Days 1–30. Daily pro-rata refund minus benefits paid and a $50 processing fee if canceled on or after Day 31.</li>
            <li><strong>Provider Cancellation:</strong> Permitted for non-payment, fraud, misrepresentation, or unsafe access upon 5 days' written notice with pro-rata refund.</li>
            <li><strong>Contract Limit &amp; Venue:</strong> Not an insurance policy. Maximum contractual exposure capped at $2,500 per term. Governed by ${orgState} law with venue restricted to Bexar County, ${orgState}. Requires 30-day written notice and opportunity to cure before legal proceedings.</li>
        </ul>

        <div class="section-header">7. Customer Acknowledgment &amp; Signatures</div>
        <p style="margin: 0 0 8px 0; font-size: 10px; color: #334155;">
            By signing below, the customer acknowledges and agrees to all terms, coverage limits, service fees, and exclusions set forth in this agreement:
        </p>

        <div style="font-size: 10px; color: #0f172a; margin-bottom: 12px; line-height: 1.6;">
            <div>☑ <strong>I received and reviewed the complete agreement</strong>, including component sublimits, exclusions, and total aggregate caps.</div>
            <div>☑ <strong>I understand this is a limited repair warranty</strong>, not homeowners insurance and not a guarantee of full system replacement.</div>
            <div>☑ <strong>I acknowledge the $125 service fee per claim</strong>, the 30-day waiting period, and the $2,500 annual limit.</div>
            <div>☑ <strong>I understand that ${orgName} must directly authorize all repairs</strong> and that pre-existing conditions are strictly excluded.</div>
            <div>☑ <strong>I acknowledge there is no automatic renewal</strong> upon expiration of the 12-month term.</div>
        </div>

        <table class="sig-table">
            <tr>
                <td>
                    <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Customer Signature:</div>
                    ${contract.customerSignature ? `
                        <img src="${contract.customerSignature}" style="max-height: 44px; max-width: 220px; object-fit: contain; margin-bottom: 4px; display: block;" alt="Customer Signature" />
                    ` : '<div style="height: 44px; border-bottom: 1px solid #0f172a;"></div>'}
                    <div style="font-size: 10px; color: #334155; margin-top: 4px;">
                        <strong>Printed Name:</strong> ${contract.customerSignedName || contract.customerName || 'Customer'}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                        <strong>Date:</strong> ${contract.customerSignedDate || agreementDateStr}
                    </div>
                </td>
                <td>
                    <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">${orgName} Representative Signature:</div>
                    ${contract.companyRepSignature ? `
                        <img src="${contract.companyRepSignature}" style="max-height: 44px; max-width: 220px; object-fit: contain; margin-bottom: 4px; display: block;" alt="Representative Signature" />
                    ` : '<div style="height: 44px; border-bottom: 1px solid #0f172a;"></div>'}
                    <div style="font-size: 10px; color: #334155; margin-top: 4px;">
                        <strong>Printed Name / Title:</strong> ${contract.companyRepName || 'Authorized Representative'} ${contract.companyRepTitle ? `(${contract.companyRepTitle})` : ''}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                        <strong>Date:</strong> ${contract.companyRepSignedDate || agreementDateStr}
                    </div>
                </td>
            </tr>
        </table>

        <div class="footer-stamp" style="margin-top: 30px;">
            <div>${orgName} | ${orgCity}, ${orgState} | ${orgLicense} | Customer Copy — Retain for your records.</div>
            <div>Page 3 of 3</div>
        </div>
    </div>

</body>
</html>`.trim();
};
