import { Customer, EquipmentAsset } from '../types';

export interface MaintenanceScheduleCalculation {
    isOptedOut: boolean;
    intervalMonths: number;
    baseDate: Date;
    baseDateSource: 'lastMaintenanceDate' | 'installDate' | 'manufacturerStartDate' | 'customerCreatedAt' | 'fallback';
    nextDate: Date;
    daysUntil: number; // positive = days until due, negative = days overdue
    isOverdue: boolean;
    statusLabel: string;
}

export interface UpcomingMaintenanceItem {
    customer: Customer;
    asset: EquipmentAsset;
    nextDate: Date;
    daysUntil: number;
    isOverdue: boolean;
    statusLabel: string;
    intervalMonths: number;
    lastServicedDate: Date | null;
    isAgreementCovered?: boolean;
    agreementName?: string;
}

/**
 * Safely parses a date string or Date object avoiding timezone day-shift glitches.
 */
export const parseSafeDate = (val: string | Date | undefined | null): Date | null => {
    if (!val) return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        // If YYYY-MM-DD format, construct date at local noon to avoid UTC midnight timezone rollback
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            return new Date(y, m - 1, d, 12, 0, 0);
        }
        const d = new Date(trimmed);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

/**
 * Adds exact calendar months to a date.
 */
export const addMonthsToDate = (d: Date, months: number): Date => {
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
};

/**
 * Calculates the next maintenance due date and status for an equipment asset.
 * Uses smart fallbacks if explicit intervals or dates are omitted so that all
 * equipment in the field can be proactively tracked for preventative maintenance.
 */
export const calculateEquipmentMaintenanceSchedule = (
    asset: EquipmentAsset | any,
    customer?: Customer | any,
    now: Date = new Date(),
    defaultIntervalMonths: number = 6
): MaintenanceScheduleCalculation => {
    // Check if customer or asset has explicitly opted out of maintenance tracking
    const isOptedOut = asset?.warranty?.requiresMaintenance === false;
    
    // Interval defaults to 6 months for HVAC/seasonal, or configured interval
    const intervalMonths = (asset?.warranty?.maintenanceIntervalMonths && Number(asset.warranty.maintenanceIntervalMonths) > 0)
        ? Number(asset.warranty.maintenanceIntervalMonths)
        : defaultIntervalMonths;

    // Identify the best base date
    let baseDate: Date | null = null;
    let baseDateSource: MaintenanceScheduleCalculation['baseDateSource'] = 'fallback';

    if (asset?.warranty?.lastMaintenanceDate) {
        baseDate = parseSafeDate(asset.warranty.lastMaintenanceDate);
        if (baseDate) baseDateSource = 'lastMaintenanceDate';
    }

    if (!baseDate && asset?.installDate) {
        baseDate = parseSafeDate(asset.installDate);
        if (baseDate) baseDateSource = 'installDate';
    }

    if (!baseDate && asset?.warranty?.manufacturerStartDate) {
        baseDate = parseSafeDate(asset.warranty.manufacturerStartDate);
        if (baseDate) baseDateSource = 'manufacturerStartDate';
    }

    if (!baseDate && customer?.createdAt) {
        baseDate = parseSafeDate(customer.createdAt);
        if (baseDate) baseDateSource = 'customerCreatedAt';
    }

    if (!baseDate) {
        baseDate = new Date(now);
        baseDateSource = 'fallback';
    }

    // Project next maintenance date
    let nextDate = addMonthsToDate(baseDate, intervalMonths);

    // If nextDate is far in the past (e.g. installed 2+ years ago with no logged tune-up),
    // roll forward by intervalMonths until it reaches the active seasonal cycle.
    // We allow it to be overdue within the current cycle (up to 1 interval in the past),
    // but roll past expired historical cycles so admins get a timely seasonal target.
    const oneCyclePastThreshold = new Date(now);
    oneCyclePastThreshold.setMonth(oneCyclePastThreshold.getMonth() - intervalMonths);

    let safetyCount = 0;
    while (nextDate < oneCyclePastThreshold && safetyCount < 120) {
        nextDate = addMonthsToDate(nextDate, intervalMonths);
        safetyCount++;
    }

    const diffTime = nextDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntil < 0;

    let statusLabel = '';
    if (isOptedOut) {
        statusLabel = 'Tracking Off';
    } else if (isOverdue) {
        statusLabel = `Overdue (${Math.abs(daysUntil)} days)`;
    } else {
        statusLabel = `Due in ${daysUntil} days`;
    }

    return {
        isOptedOut,
        intervalMonths,
        baseDate,
        baseDateSource,
        nextDate,
        daysUntil,
        isOverdue,
        statusLabel
    };
};

/**
 * Scans all customers and extracts upcoming maintenance items according to filter criteria.
 */
export const extractAllUpcomingMaintenance = (
    customers: Customer[] | { [key: string]: Customer },
    serviceAgreements: any[] = [],
    now: Date = new Date(),
    filter: 'all' | 'overdue' | '30' | '45' | '60' | '90' | '180' = '45',
    searchQuery: string = ''
): UpcomingMaintenanceItem[] => {
    const list: UpcomingMaintenanceItem[] = [];
    const customerList = Array.isArray(customers) ? customers : Object.values(customers || {});
    const query = (searchQuery || '').trim().toLowerCase();

    // Map active service agreements by customer ID for quick cross-reference
    const activeAgreementsByCustomer = new Map<string, any>();
    (serviceAgreements || []).forEach(a => {
        if (a.status === 'Active' && a.customerId) {
            activeAgreementsByCustomer.set(a.customerId, a);
        }
    });

    customerList.forEach(customer => {
        if (!customer) return;
        const equipment = customer.equipment || [];
        const agreement = activeAgreementsByCustomer.get(customer.id);

        equipment.forEach(asset => {
            if (!asset) return;

            const calc = calculateEquipmentMaintenanceSchedule(asset, customer, now);
            if (calc.isOptedOut) return;

            // Apply time window filter
            let passesFilter = true;
            if (filter === 'overdue') {
                passesFilter = calc.isOverdue;
            } else if (filter === '30') {
                passesFilter = calc.daysUntil <= 30;
            } else if (filter === '45') {
                passesFilter = calc.daysUntil <= 45;
            } else if (filter === '60') {
                passesFilter = calc.daysUntil <= 60;
            } else if (filter === '90') {
                passesFilter = calc.daysUntil <= 90;
            } else if (filter === '180') {
                passesFilter = calc.daysUntil <= 180;
            } else if (filter === 'all') {
                passesFilter = true;
            }

            if (!passesFilter) return;

            // Apply search query filter if provided
            if (query) {
                const custName = (customer.name || '').toLowerCase();
                const custPhone = (customer.phone || '').toLowerCase();
                const custEmail = (customer.email || '').toLowerCase();
                const assetBrand = (asset.brand || '').toLowerCase();
                const assetModel = (asset.model || '').toLowerCase();
                const assetSerial = (asset.serial || '').toLowerCase();
                const assetType = (asset.type || '').toLowerCase();
                const assetName = (asset.name || '').toLowerCase();

                const matches = custName.includes(query) ||
                    custPhone.includes(query) ||
                    custEmail.includes(query) ||
                    assetBrand.includes(query) ||
                    assetModel.includes(query) ||
                    assetSerial.includes(query) ||
                    assetType.includes(query) ||
                    assetName.includes(query);

                if (!matches) return;
            }

            const lastServiced = parseSafeDate(asset.warranty?.lastMaintenanceDate || asset.installDate);

            list.push({
                customer,
                asset,
                nextDate: calc.nextDate,
                daysUntil: calc.daysUntil,
                isOverdue: calc.isOverdue,
                statusLabel: calc.statusLabel,
                intervalMonths: calc.intervalMonths,
                lastServicedDate: lastServiced,
                isAgreementCovered: !!agreement,
                agreementName: agreement?.planName || agreement?.name || undefined
            });
        });
    });

    // Sort: Overdue first (most overdue at top), then closest upcoming due dates
    list.sort((a, b) => a.daysUntil - b.daysUntil);
    return list;
};

/**
 * Returns the count of maintenance items due within maxDays (default 45 days)
 * for high-performance dashboard KPI badges.
 */
export const countMaintenanceDue = (
    customers: Customer[] | { [key: string]: Customer },
    now: Date = new Date(),
    maxDays: number = 45
): number => {
    let count = 0;
    const customerList = Array.isArray(customers) ? customers : Object.values(customers || {});

    customerList.forEach(customer => {
        if (!customer || !customer.equipment) return;
        customer.equipment.forEach(asset => {
            if (!asset) return;
            const calc = calculateEquipmentMaintenanceSchedule(asset, customer, now);
            if (!calc.isOptedOut && calc.daysUntil <= maxDays) {
                count++;
            }
        });
    });

    return count;
};
