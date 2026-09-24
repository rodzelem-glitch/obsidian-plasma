import { EquipmentAsset, JbWarrantySettings } from '../../types';

export type JbLaborRateTier = 85 | 105 | 125 | 150 | 175 | 200 | 250 | 300;

export const JB_LABOR_RATE_TIERS: JbLaborRateTier[] = [85, 105, 125, 150, 175, 200, 250, 300];

export type JbCoverageTier = 'parts_and_labor_plus' | 'labor_plus' | 'labor_only' | 'parts_only';

export type JbSystemCategory = 
    | 'ac_split_or_package'
    | 'hp_dual_fuel_split'
    | 'ac_hp_condenser_coil'
    | 'furnace_only'
    | 'air_handler_coil'
    | 'outdoor_condenser_only'
    | 'ductless_mini_split'
    | 'water_heater_tank'
    | 'water_heater_hybrid'
    | 'water_heater_tankless'
    | 'boiler'
    | 'commercial_package_or_split';

export interface JbWarrantyPlanEntry {
    sku: string;
    trade: 'HVAC' | 'Plumbing';
    category: JbSystemCategory;
    categoryLabel: string;
    coverageTier: JbCoverageTier;
    coverageLabel: string;
    termYears: number;
    rates: Record<JbLaborRateTier, number>;
    description: string;
    whatIsCovered: string[];
    whatIsNotCovered: string[];
    oemRequirements?: string;
    jbwCoverageNotes?: string;
    isPopular?: boolean;
}

/**
 * 2025 JB Warranties Master Catalog for Residential & Commercial HVAC & Plumbing
 * Data transcribed directly from the official 2025 JB Warranties Price Book.
 */
export const JB_WARRANTY_CATALOG: JbWarrantyPlanEntry[] = [
    // =========================================================================
    // RESIDENTIAL HVAC (1.5 - 5 TON): PARTS & LABOR PLUS (Pages 10-11)
    // =========================================================================
    {
        sku: 'JBACSS',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 5,
        rates: { 85: 677, 105: 835, 125: 993, 150: 1101, 175: 1243, 200: 1394, 250: 1748, 300: 1975 },
        description: 'Complete 5-Year Parts & Labor Plus warranty for residential AC split systems or package units (1.5–5 Ton).',
        whatIsCovered: [
            '100% covered mechanical & electrical parts',
            '100% covered labor by certified TekAir technicians',
            'Refrigerant allowance & reclamation covered',
            'Diagnostic trip charge covered ($0 customer deductible)',
            'Parts allowance schedule included',
            '100% free transferability to future homeowners'
        ],
        whatIsNotCovered: ['Pre-existing faults prior to Day 91', 'Routine maintenance, filters, and cleanings', 'External acts of nature or electrical grid surges'],
        oemRequirements: 'OEM Parts: 1 Year • Compressor: 5 Years',
        jbwCoverageNotes: 'JBW Parts: 2–5 Years • Labor: 91 Days–5 Years'
    },
    {
        sku: 'JBALTW',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 10,
        rates: { 85: 765, 105: 946, 125: 1126, 150: 1328, 175: 1502, 200: 1678, 250: 2027, 300: 2376 },
        description: 'Flagship 10-Year Parts & Labor Plus extended warranty for residential AC split systems (1.5–5 Ton).',
        whatIsCovered: [
            '100% covered mechanical & electrical parts for a full decade',
            '100% covered labor with zero hourly fees',
            'Full refrigerant recharge & recovery allowance included',
            '$65 diagnostic trip charge covered with zero deductible',
            'No penalties or aggregate caps for multiple repairs',
            'Free transferability increases home resale value'
        ],
        whatIsNotCovered: ['Pre-existing mechanical failures prior to Day 91', 'Dirty filters, clogged coils, or lack of annual tune-ups', 'Cosmetic noise or cabinet rust'],
        oemRequirements: 'OEM Parts: 5 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years',
        isPopular: true
    },
    {
        sku: 'JBALEP',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 12,
        rates: { 85: 779, 105: 869, 125: 979, 150: 1129, 175: 1299, 200: 1429, 250: 1729, 300: 2029 },
        description: 'Maximum 12-Year Parts & Labor Plus warranty for premium AC complete split systems (1.5–5 Ton).',
        whatIsCovered: [
            'Maximum 12-year extended parts & labor warranty',
            'Complete mechanical & electrical breakdown coverage',
            'Refrigerant, reclaim, and parts allowances included',
            'Zero out-of-pocket trip charges or repair deductibles',
            'Fully transferable to any new homeowner at no cost'
        ],
        whatIsNotCovered: ['Pre-existing conditions', 'Routine seasonal maintenance & air filter changes'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10/12 Years',
        jbwCoverageNotes: 'JBW Parts: 11–12 Years • Labor: 91 Days–12 Years'
    },
    {
        sku: 'JBALTY',
        trade: 'HVAC',
        category: 'hp_dual_fuel_split',
        categoryLabel: 'Heat Pump or Dual Fuel Complete Split System',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 10,
        rates: { 85: 1070, 105: 1268, 125: 1467, 150: 2048, 175: 2318, 200: 2588, 250: 3127, 300: 3668 },
        description: 'Flagship 10-Year Parts & Labor Plus protection for Heat Pump and Dual Fuel Split Systems (1.5–5 Ton).',
        whatIsCovered: [
            'Complete Heat Pump sealed system, reversing valve, compressor & coil coverage',
            'Full electric heat strip, defrost control & blower motor coverage',
            '100% parts & labor covered with zero deductibles',
            'Refrigerant allowance (R-410A, R-454B, R-32) and recovery included',
            'Diagnostic and trip charges included on every claim',
            '100% free transferability upon sale of property'
        ],
        whatIsNotCovered: ['Pre-existing faults prior to Day 91', 'Unmaintained filters or outdoor foliage obstruction'],
        oemRequirements: 'OEM Parts: 5 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years',
        isPopular: true
    },
    {
        sku: 'JBALEQ',
        trade: 'HVAC',
        category: 'hp_dual_fuel_split',
        categoryLabel: 'Heat Pump or Dual Fuel Complete Split System',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 12,
        rates: { 85: 899, 105: 989, 125: 1129, 150: 1319, 175: 1469, 200: 1639, 250: 1979, 300: 2319 },
        description: '12-Year Ultimate Heat Pump & Dual Fuel Parts & Labor Plus warranty.',
        whatIsCovered: [
            'Full 12 years of heat pump parts & labor protection',
            'Reversing valves, ECM blowers, circuit boards, and compressor',
            'Refrigerant allowance and leak repair allowances',
            'Zero customer deductibles'
        ],
        whatIsNotCovered: ['Pre-existing issues', 'Lack of basic maintenance'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10/12 Years',
        jbwCoverageNotes: 'JBW Parts: 11–12 Years • Labor: 91 Days–12 Years'
    },
    {
        sku: 'JBALLC',
        trade: 'HVAC',
        category: 'furnace_only',
        categoryLabel: 'Furnace Only',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 10,
        rates: { 85: 439, 105: 540, 125: 641, 150: 788, 175: 890, 200: 992, 250: 1200, 300: 1407 },
        description: '10-Year Parts & Labor Plus coverage for residential gas or electric furnace.',
        whatIsCovered: [
            'Heat exchanger, inducer motor, gas valve, igniter & safety switches',
            'Primary circuit board and blower motor',
            '100% labor and parts covered with zero trip fees'
        ],
        whatIsNotCovered: ['External gas supply lines or electrical feed', 'Dirty filters causing high-limit trips'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years'
    },
    {
        sku: 'JBALUB',
        trade: 'HVAC',
        category: 'air_handler_coil',
        categoryLabel: 'Air Handler Including Coil',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 10,
        rates: { 85: 681, 105: 818, 125: 953, 150: 1223, 175: 1386, 200: 1547, 250: 1868, 300: 2189 },
        description: '10-Year Parts & Labor Plus coverage for residential air handler and evaporator coil.',
        whatIsCovered: [
            'Evaporator coil, TXV expansion valve, ECM blower motor, heat strips & drain pan',
            '100% labor and parts covered with refrigerant allowance',
            'Zero customer deductible'
        ],
        whatIsNotCovered: ['Clogged primary/secondary condensate drain lines from lack of maintenance'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years'
    },

    // =========================================================================
    // RESIDENTIAL HVAC: LABOR PLUS (Includes Refrigerant) (Pages 8-9)
    // =========================================================================
    {
        sku: 'JBALTH',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'labor_plus',
        coverageLabel: 'Labor Plus (Includes Refrigerant)',
        termYears: 10,
        rates: { 85: 621, 105: 768, 125: 914, 150: 1040, 175: 1177, 200: 1309, 250: 1588, 300: 1858 },
        description: '10-Year Labor Plus protection covering all technician labor, refrigerant recharges, and diagnostic trip fees.',
        whatIsCovered: [
            '100% covered labor for any repair on the complete AC system',
            'Refrigerant allowance (R-410A, R-454B, R-32) & reclaim allowance covered',
            'Diagnostic and trip charge included on every call ($0 deductible)',
            'Parts allowance schedule ($5–$45) per repair',
            '100% transferable to new homeowner'
        ],
        whatIsNotCovered: ['Wholesale parts costs (pairs with existing factory parts warranty)', 'Routine maintenance'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    },
    {
        sku: 'JBALTJ',
        trade: 'HVAC',
        category: 'hp_dual_fuel_split',
        categoryLabel: 'Heat Pump or Dual Fuel Complete Split System',
        coverageTier: 'labor_plus',
        coverageLabel: 'Labor Plus (Includes Refrigerant)',
        termYears: 10,
        rates: { 85: 762, 105: 941, 125: 1119, 150: 1254, 175: 1419, 200: 1637, 250: 1855, 300: 2183 },
        description: '10-Year Labor Plus protection for Heat Pump systems including refrigerant allowance.',
        whatIsCovered: [
            '100% covered labor for heat pump breakdowns over 10 full years',
            'Refrigerant allowance & reclaim fees covered',
            'Trip charge covered ($0 deductible)',
            'Transferable'
        ],
        whatIsNotCovered: ['Wholesale parts costs (covered by OEM)', 'Neglect or uncleaned filters'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    },
    {
        sku: 'JBALLI',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'labor_plus',
        coverageLabel: 'Labor Plus (Includes Refrigerant)',
        termYears: 5,
        rates: { 85: 344, 105: 389, 125: 434, 150: 512, 175: 577, 200: 654, 250: 763, 300: 873 },
        description: '5-Year Labor Plus warranty covering labor and refrigerant for AC systems.',
        whatIsCovered: ['100% covered labor for 5 years', 'Refrigerant allowance covered', 'Diagnostic trip charge covered', 'Zero deductible'],
        whatIsNotCovered: ['Parts cost', 'Routine filters'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–5 Years'
    },
    {
        sku: 'JBALLZ',
        trade: 'HVAC',
        category: 'hp_dual_fuel_split',
        categoryLabel: 'Heat Pump or Dual Fuel Complete Split System',
        coverageTier: 'labor_plus',
        coverageLabel: 'Labor Plus (Includes Refrigerant)',
        termYears: 5,
        rates: { 85: 486, 105: 565, 125: 643, 150: 760, 175: 858, 200: 960, 250: 1167, 300: 1363 },
        description: '5-Year Labor Plus warranty for Heat Pump systems including refrigerant.',
        whatIsCovered: ['100% covered labor for 5 years', 'Refrigerant and trip charge covered', 'Zero deductible'],
        whatIsNotCovered: ['Parts cost', 'Routine filters'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–5 Years'
    },

    // =========================================================================
    // RESIDENTIAL HVAC: LABOR ONLY (Pages 6-7)
    // =========================================================================
    {
        sku: 'JBALSC',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'labor_only',
        coverageLabel: 'Labor Only',
        termYears: 10,
        rates: { 85: 473, 105: 584, 125: 695, 150: 803, 175: 904, 200: 1013, 250: 1177, 300: 1391 },
        description: 'Budget-friendly 10-Year Labor Only warranty covering technician repair labor & trip charge.',
        whatIsCovered: [
            '100% covered technician labor for 10 years',
            'Diagnostic trip charge included ($0 customer fee)',
            'Multiple repairs allowed without penalty',
            'Free transfer to next homeowner'
        ],
        whatIsNotCovered: ['Refrigerant recharges', 'Parts costs', 'Routine maintenance'],
        oemRequirements: 'OEM Parts: 10 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    },
    {
        sku: 'JBALSJ',
        trade: 'HVAC',
        category: 'hp_dual_fuel_split',
        categoryLabel: 'Heat Pump or Dual Fuel Complete Split System',
        coverageTier: 'labor_only',
        coverageLabel: 'Labor Only',
        termYears: 10,
        rates: { 85: 544, 105: 670, 125: 797, 150: 909, 175: 1027, 200: 1144, 250: 1380, 300: 1605 },
        description: '10-Year Labor Only warranty for Heat Pump split systems.',
        whatIsCovered: ['100% labor covered for heat pump service', 'Trip charge covered', 'Zero deductible'],
        whatIsNotCovered: ['Refrigerant', 'Parts cost', 'Routine maintenance'],
        oemRequirements: 'OEM Parts: 10 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    },
    {
        sku: 'JBAMPB',
        trade: 'HVAC',
        category: 'ac_split_or_package',
        categoryLabel: 'AC Complete Split System or Package Unit',
        coverageTier: 'labor_only',
        coverageLabel: 'Labor Only',
        termYears: 5,
        rates: { 85: 279, 105: 346, 125: 412, 150: 459, 175: 534, 200: 588, 250: 695, 300: 802 },
        description: '5-Year Labor Only warranty for residential AC systems.',
        whatIsCovered: ['100% covered labor for 5 years', 'Diagnostic trip charge included', 'Zero deductible'],
        whatIsNotCovered: ['Refrigerant', 'Parts cost'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–5 Years'
    },

    // =========================================================================
    // RESIDENTIAL DUCTLESS MINI SPLITS (Pages 14-15)
    // =========================================================================
    {
        sku: 'JBAMTF',
        trade: 'HVAC',
        category: 'ductless_mini_split',
        categoryLabel: 'Ductless Mini-Split (1 Indoor & 1 Outdoor)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 10,
        rates: { 85: 336, 105: 415, 125: 492, 150: 555, 175: 629, 200: 702, 250: 807, 300: 912 },
        description: '10-Year Parts & Labor Plus extended protection for Ductless Mini-Split systems (1:1 single zone).',
        whatIsCovered: [
            '100% covered inverter compressor, circuit board, fan motors & coils',
            'Full technician labor covered with zero hourly fees',
            'Refrigerant allowance and leak repair covered',
            'Diagnostic and trip charge included',
            '100% transferable to new homeowner'
        ],
        whatIsNotCovered: ['Pre-existing faults prior to Day 91', 'Dirty filters, mold cleaning, or line set physical damage'],
        oemRequirements: 'OEM Parts: 5 Years • Compressor: 5 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years',
        isPopular: true
    },
    {
        sku: 'JBAMRF',
        trade: 'HVAC',
        category: 'ductless_mini_split',
        categoryLabel: 'Ductless Mini-Split (1 Indoor & 1 Outdoor)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts & Labor Plus',
        termYears: 12,
        rates: { 85: 369, 105: 455, 125: 542, 150: 606, 175: 663, 200: 722, 250: 819, 300: 969 },
        description: '12-Year Ultimate Mini-Split Parts & Labor Plus warranty for premium ductless heat pumps.',
        whatIsCovered: ['Full 12 years of inverter parts & labor protection', 'Zero deductible', 'Refrigerant & trip charges included'],
        whatIsNotCovered: ['Routine coil wash and air filters'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Parts: 11–12 Years • Labor: 91 Days–12 Years'
    },
    {
        sku: 'JBAMSZ',
        trade: 'HVAC',
        category: 'ductless_mini_split',
        categoryLabel: 'Ductless Mini-Split (1 Indoor & 1 Outdoor)',
        coverageTier: 'labor_plus',
        coverageLabel: 'Labor Plus (Includes Refrigerant)',
        termYears: 10,
        rates: { 85: 292, 105: 361, 125: 429, 150: 492, 175: 545, 200: 608, 250: 681, 300: 755 },
        description: '10-Year Labor Plus warranty for Ductless Mini-Split systems including refrigerant allowance.',
        whatIsCovered: ['100% labor covered for mini-split repairs', 'Refrigerant allowance and trip charge included', 'Zero deductible'],
        whatIsNotCovered: ['Parts costs (covered by OEM)', 'Maintenance'],
        oemRequirements: 'OEM Parts: 10 Years • Compressor: 10 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    },

    // =========================================================================
    // PLUMBING: WATER HEATERS & BOILERS (Pages 24-25)
    // =========================================================================
    {
        sku: 'JBARHT',
        trade: 'Plumbing',
        category: 'water_heater_tank',
        categoryLabel: 'Residential Water Heater (<= 100 Gallons)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts and Labor Plus',
        termYears: 10,
        rates: { 85: 168, 105: 209, 125: 249, 150: 289, 175: 322, 200: 360, 250: 452, 300: 510 },
        description: '10-Year Parts and Labor Plus warranty for residential standard tank water heaters (<= 100 Gallons).',
        whatIsCovered: [
            'Heating elements, thermostat, gas control valve, burner & dip tube',
            'Tank replacement coverage (limited to 1 replacement per policy)',
            '100% parts & labor covered with zero deductibles',
            'Trip charge included',
            'Transferable'
        ],
        whatIsNotCovered: ['Sediment flush neglect', 'Hard water calcification without treatment'],
        oemRequirements: 'OEM Parts: 6 Years • Factory Tank Warranty: 6 Years',
        jbwCoverageNotes: 'JBW Parts: 7–10 Years • Labor: 91 Days–10 Years • Tank: 7–10 Years',
        isPopular: true
    },
    {
        sku: 'JBARWLB',
        trade: 'Plumbing',
        category: 'water_heater_tank',
        categoryLabel: 'Residential Water Heater (<= 100 Gallons)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts and Labor Plus',
        termYears: 8,
        rates: { 85: 179, 105: 199, 125: 229, 150: 259, 175: 299, 200: 329, 250: 399, 300: 469 },
        description: '8-Year Parts and Labor Plus warranty for standard residential water heaters.',
        whatIsCovered: ['Elements, thermostats, valves, burner and tank replacement', '100% parts and labor'],
        whatIsNotCovered: ['External piping or pressure relief drain line'],
        oemRequirements: 'OEM Parts: 1 Year • Factory Tank Warranty: 1 Year',
        jbwCoverageNotes: 'JBW Parts: 2–8 Years • Labor: 91 Days–8 Years • Tank: 2–8 Years'
    },
    {
        sku: 'JBARJY',
        trade: 'Plumbing',
        category: 'water_heater_tankless',
        categoryLabel: 'Tankless Water Heater (<= 200K BTUH)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts and Labor Plus',
        termYears: 10,
        rates: { 85: 259, 105: 320, 125: 380, 150: 419, 175: 469, 200: 519, 250: 619, 300: 719 },
        description: '10-Year Parts and Labor Plus warranty for Tankless Water Heaters (<= 200K BTUH).',
        whatIsCovered: [
            'Heat exchanger, gas valve, flow sensors, igniter & electronic control board',
            'Internal water recirculating pump & safety switches',
            '100% covered parts and labor with zero trip fees',
            'Transferable'
        ],
        whatIsNotCovered: ['Mineral scale buildup without periodic descaling', 'Freeze damage to outdoor units'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Parts: 6–10 Years • Labor: 91 Days–10 Years',
        isPopular: true
    },
    {
        sku: 'JBARJX',
        trade: 'Plumbing',
        category: 'water_heater_tankless',
        categoryLabel: 'Tankless Water Heater (<= 200K BTUH)',
        coverageTier: 'parts_and_labor_plus',
        coverageLabel: 'Parts and Labor Plus',
        termYears: 5,
        rates: { 85: 202, 105: 226, 125: 256, 150: 294, 175: 334, 200: 374, 250: 450, 300: 530 },
        description: '5-Year Parts and Labor Plus warranty for Tankless Water Heaters.',
        whatIsCovered: ['100% covered labor and parts assistance', 'Diagnostic trip charge included'],
        whatIsNotCovered: ['Lack of descaling'],
        oemRequirements: 'OEM Parts: 5 Years',
        jbwCoverageNotes: 'JBW Labor: 91 Days–5 Years'
    },
    {
        sku: 'JBABSD',
        trade: 'Plumbing',
        category: 'boiler',
        categoryLabel: 'Boilers / Combi-Boilers',
        coverageTier: 'labor_only',
        coverageLabel: 'Labor Only',
        termYears: 10,
        rates: { 85: 508, 105: 628, 125: 747, 150: 863, 175: 973, 200: 1093, 250: 1315, 300: 1545 },
        description: '10-Year Labor Only warranty for residential boilers and combi-boilers (all fuels).',
        whatIsCovered: ['100% labor for boiler breakdowns', 'Trip charges covered', 'Zero deductible'],
        whatIsNotCovered: ['Wholesale parts costs', 'Chimney flue or external piping'],
        oemRequirements: 'N/A',
        jbwCoverageNotes: 'JBW Labor: 91 Days–10 Years'
    }
];

export interface CalculatedWarrantyPrice {
    sku: string;
    plan: JbWarrantyPlanEntry;
    contractorLaborRate: JbLaborRateTier;
    wholesaleCost: number;
    markupPercentage: number;
    markupAmount: number;
    retailPrice: number;
    profit: number;
    monthlyPriceEstimate: number;
}

/**
 * Calculates wholesale cost, markup, and customer retail price for a given JB Warranty plan SKU.
 */
export const calculateJBWarrantyPricing = (
    planOrSku: JbWarrantyPlanEntry | string,
    contractorLaborRate: JbLaborRateTier = 175,
    markupPercentage: number = 40,
    minimumMarkupDollars: number = 150
): CalculatedWarrantyPrice | null => {
    const plan = typeof planOrSku === 'string'
        ? JB_WARRANTY_CATALOG.find(p => p.sku === planOrSku)
        : planOrSku;

    if (!plan) return null;

    const rateToUse: JbLaborRateTier = JB_LABOR_RATE_TIERS.includes(contractorLaborRate) ? contractorLaborRate : 175;
    const wholesaleCost = plan.rates[rateToUse] || plan.rates[175] || 500;

    let markupAmount = wholesaleCost * (markupPercentage / 100);
    if (minimumMarkupDollars && markupAmount < minimumMarkupDollars) {
        markupAmount = minimumMarkupDollars;
    }

    const rawRetail = wholesaleCost + markupAmount;
    // Round retail price to a clean customer-facing price (e.g. nearest $5)
    const retailPrice = Math.round(rawRetail / 5) * 5;
    const profit = retailPrice - wholesaleCost;
    const monthlyPriceEstimate = Math.round((retailPrice / 12) * 100) / 100;

    return {
        sku: plan.sku,
        plan,
        contractorLaborRate: rateToUse,
        wholesaleCost,
        markupPercentage,
        markupAmount: profit,
        retailPrice,
        profit,
        monthlyPriceEstimate
    };
};

/**
 * Normalizes equipment text/attributes into a correlated JB Warranties system category.
 */
export const detectEquipmentCategory = (equipment: Partial<EquipmentAsset> | any): JbSystemCategory => {
    if (!equipment) return 'ac_split_or_package';

    const text = [
        equipment.type || '',
        equipment.name || '',
        equipment.model || '',
        equipment.modelNumber || '',
        equipment.heatType || '',
        equipment.systemNickname || '',
        equipment.description || ''
    ].join(' ').toLowerCase();

    // 1. Plumbing / Water Heaters
    if (text.includes('tankless')) return 'water_heater_tankless';
    if (text.includes('boiler') || text.includes('combi')) return 'boiler';
    if (text.includes('hybrid water heater') || text.includes('heat pump water heater')) return 'water_heater_hybrid';
    if (text.includes('water heater') || text.includes('water tank') || text.includes('hot water')) return 'water_heater_tank';

    // 2. Ductless Mini-Splits
    if (text.includes('mini-split') || text.includes('mini split') || text.includes('ductless') || text.includes('multi-split')) {
        return 'ductless_mini_split';
    }

    // 3. Furnaces & Air Handlers (Individual components)
    if (text.includes('furnace') && !text.includes('split') && !text.includes('package') && !text.includes('ac')) {
        return 'furnace_only';
    }
    if (text.includes('air handler') && !text.includes('split') && !text.includes('condenser')) {
        return 'air_handler_coil';
    }

    // 4. Heat Pumps & Dual Fuel
    if (text.includes('heat pump') || text.includes('heat-pump') || text.includes('dual fuel') || text.includes('dual-fuel')) {
        return 'hp_dual_fuel_split';
    }

    // 5. Default: AC Complete Split or Package Unit
    return 'ac_split_or_package';
};

export interface CorrelatedWarrantyRecommendation {
    category: JbSystemCategory;
    equipmentSummary: {
        id?: string;
        name: string;
        brand: string;
        model: string;
        serial: string;
        tonnage?: number;
        ageYears?: number;
        isEligibleForExtended: boolean;
        eligibilityReason: string;
    };
    plans: Array<{
        sku: string;
        planId?: string;
        planName: string;
        coverageTier: JbCoverageTier;
        coverageBadge: string;
        termYears: number;
        retailPrice: number;
        monthlyEstimate: number;
        wholesaleCost: number; // Internal only
        profit: number; // Internal only
        markupPercentage?: number;
        contractorLaborRate?: number;
        description: string;
        whatIsCovered: string[];
        coverageHighlights: string[];
        whatIsNotCovered: string[];
        isRecommended: boolean;
        recommended?: boolean;
    }>;
}

export type CorrelatedWarrantyPlan = CorrelatedWarrantyRecommendation['plans'][number];

/**
 * Correlates a customer's registered equipment with appropriate JB Warranties plans,
 * calculating customer-facing retail prices with markup and returning formatted presentation cards.
 */
export const getCorrelatedWarrantyPlans = (
    equipment: Partial<EquipmentAsset> | any,
    settings?: JbWarrantySettings | null
): CorrelatedWarrantyRecommendation => {
    const category = detectEquipmentCategory(equipment);

    const laborRate: JbLaborRateTier = (settings?.contractorLaborRate as JbLaborRateTier) || 175;
    const markupPct = settings?.markupPercentage ?? 40;
    const minMarkup = settings?.minimumMarkupDollars ?? 150;

    // Filter matching catalog plans for this category
    let matchedPlans = JB_WARRANTY_CATALOG.filter(p => p.category === category);

    // If specific sub-type had no matches, fallback to general AC split
    if (matchedPlans.length === 0) {
        matchedPlans = JB_WARRANTY_CATALOG.filter(p => p.category === 'ac_split_or_package');
    }

    // Equipment info
    const brand = equipment?.brand || 'System';
    const model = equipment?.model || equipment?.modelNumber || 'Residential Unit';
    const serial = equipment?.serial || equipment?.serialNumber || 'Verified';
    const tonnage = equipment?.tonnage ? Number(equipment.tonnage) : 3;
    const ageYears = equipment?.ageYears ? Number(equipment.ageYears) : 2;

    const isEligibleForExtended = ageYears <= 3;
    const eligibilityReason = isEligibleForExtended
        ? 'Fully eligible for extended 5–12 year protection (within startup window).'
        : 'System requires standard preliminary diagnostic inspection prior to enrollment.';

    // Generate formatted presentation plans
    const plans = matchedPlans.map(entry => {
        const pricing = calculateJBWarrantyPricing(entry, laborRate, markupPct, minMarkup);
        const retailPrice = pricing ? pricing.retailPrice : 1195;
        const wholesaleCost = pricing ? pricing.wholesaleCost : 750;
        const profit = pricing ? pricing.profit : 445;
        const monthlyEstimate = pricing ? pricing.monthlyPriceEstimate : Math.round((retailPrice / 12) * 100) / 100;

        let coverageBadge = 'Standard Protection';
        if (entry.coverageTier === 'parts_and_labor_plus') {
            coverageBadge = 'Full Parts & Labor (Best Value)';
        } else if (entry.coverageTier === 'labor_plus') {
            coverageBadge = 'Labor & Refrigerant Shield';
        } else if (entry.coverageTier === 'labor_only') {
            coverageBadge = 'Essential Labor Coverage';
        }

        const isRecommended = !!entry.isPopular || entry.coverageTier === 'parts_and_labor_plus';

        const planName = `${entry.termYears}-Year ${entry.coverageLabel} Extended Warranty`;

        return {
            sku: entry.sku,
            planId: entry.sku,
            planName,
            coverageTier: entry.coverageTier,
            coverageBadge,
            termYears: entry.termYears,
            retailPrice,
            monthlyEstimate,
            wholesaleCost,
            profit,
            markupPercentage: markupPct,
            contractorLaborRate: laborRate,
            description: entry.description,
            whatIsCovered: entry.whatIsCovered,
            coverageHighlights: entry.whatIsCovered,
            whatIsNotCovered: entry.whatIsNotCovered,
            isRecommended,
            recommended: isRecommended
        };
    });

    // Sort so recommended (Parts & Labor Plus 10-Year) comes first
    plans.sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return b.termYears - a.termYears;
    });

    return {
        category,
        equipmentSummary: {
            id: equipment?.id,
            name: equipment?.name || `${brand} ${tonnage}T ${equipment?.type || 'HVAC'}`,
            brand,
            model,
            serial,
            tonnage,
            ageYears,
            isEligibleForExtended,
            eligibilityReason
        },
        plans
    };
};
