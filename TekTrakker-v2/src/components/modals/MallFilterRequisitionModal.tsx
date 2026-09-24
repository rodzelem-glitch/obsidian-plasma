import React, { useState, useMemo } from 'react';
import { Customer, ServiceLocation, EquipmentAsset } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { 
    Filter, 
    Printer, 
    Download, 
    Copy, 
    Building, 
    Search, 
    CheckCircle2, 
    AlertTriangle, 
    X, 
    Layers, 
    ShieldCheck, 
    DollarSign,
    Box,
    ExternalLink
} from 'lucide-react';
import Button from '../ui/Button';
import showToast from '../../lib/toast';

interface MallFilterRequisitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer?: Customer | null;
    customerId?: string;
}

interface FilterTallyItem {
    size: string;
    quantity: number;
    unitsCount: number;
    stores: string[];
}

export const MallFilterRequisitionModal: React.FC<MallFilterRequisitionModalProps> = ({
    isOpen,
    onClose,
    customer: propCustomer,
    customerId
}) => {
    const { state } = useAppContext();
    const [selectedMall, setSelectedMall] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'NEEDS_SURVEY'>('ALL');

    // Resolve active customer (defaults to Impact Service Group if not supplied)
    const customer = useMemo(() => {
        if (propCustomer) return propCustomer;
        if (customerId) return state.customers.find(c => c.id === customerId) || null;
        return state.customers.find(c => c.id === 'cust-1787187506048') || state.customers[0] || null;
    }, [propCustomer, customerId, state.customers]);

    // Service locations & equipment resolution
    const locations: ServiceLocation[] = useMemo(() => {
        return customer?.serviceLocations || [];
    }, [customer]);

    const equipmentList: EquipmentAsset[] = useMemo(() => {
        return customer?.equipment || [];
    }, [customer]);

    // List of unique Malls / Property Clusters
    const mallClusters = useMemo(() => {
        const clusterMap = new Map<string, { name: string; storeCount: number; unitCount: number }>();
        
        locations.forEach(loc => {
            const mall = loc.mall || loc.propertyName || 'Other Locations';
            const existing = clusterMap.get(mall) || { name: mall, storeCount: 0, unitCount: 0 };
            existing.storeCount += 1;
            clusterMap.set(mall, existing);
        });

        equipmentList.forEach(eq => {
            const loc = locations.find(l => l.id === eq.locationId || l.id === eq.propertyId);
            const mall = loc?.mall || loc?.propertyName || 'Other Locations';
            const existing = clusterMap.get(mall) || { name: mall, storeCount: 0, unitCount: 0 };
            existing.unitCount += 1;
            clusterMap.set(mall, existing);
        });

        return Array.from(clusterMap.values()).sort((a, b) => b.storeCount - a.storeCount);
    }, [locations, equipmentList]);

    // Enriched rows combining equipment with location details
    const enrichedRows = useMemo(() => {
        return equipmentList.map(eq => {
            const loc = locations.find(l => l.id === eq.locationId || l.id === eq.propertyId);
            const filterStr = eq.filterType || '';
            const isUnverified = !filterStr || 
                filterStr.toLowerCase().includes('see store') || 
                filterStr.toLowerCase().includes('verify') || 
                filterStr.trim() === '' ||
                !eq.serial || eq.serial === 'N/A' || eq.serial === '0';

            return {
                equipment: eq,
                location: loc,
                mall: loc?.mall || loc?.propertyName || 'Other Locations',
                storeName: loc?.name || eq.notes?.split('.')[0]?.replace('Store: ', '') || 'Unknown Store',
                filterSpec: filterStr || '⚠️ Verify on site',
                isUnverified,
                surveyFeeEligible: isUnverified || true
            };
        });
    }, [equipmentList, locations]);

    // Filtered rows by Mall, Search Query, and Status
    const filteredRows = useMemo(() => {
        return enrichedRows.filter(row => {
            if (selectedMall !== 'ALL' && row.mall !== selectedMall) return false;
            if (statusFilter === 'VERIFIED' && row.isUnverified) return false;
            if (statusFilter === 'NEEDS_SURVEY' && !row.isUnverified) return false;
            
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchStore = row.storeName.toLowerCase().includes(q);
                const matchMall = row.mall.toLowerCase().includes(q);
                const matchBrand = (row.equipment.brand || '').toLowerCase().includes(q);
                const matchModel = (row.equipment.model || '').toLowerCase().includes(q);
                const matchSerial = (row.equipment.serial || '').toLowerCase().includes(q);
                const matchFilter = row.filterSpec.toLowerCase().includes(q);
                if (!matchStore && !matchMall && !matchBrand && !matchModel && !matchSerial && !matchFilter) {
                    return false;
                }
            }
            return true;
        });
    }, [enrichedRows, selectedMall, statusFilter, searchQuery]);

    // Aggregate Filter Tally Calculation
    const filterTally = useMemo(() => {
        const tallyMap = new Map<string, FilterTallyItem>();

        filteredRows.forEach(row => {
            const spec = row.filterSpec;
            if (!spec || row.isUnverified) {
                const key = 'Needs Site Survey / Verify Size';
                const existing = tallyMap.get(key) || { size: key, quantity: 0, unitsCount: 0, stores: [] };
                existing.quantity += 1;
                existing.unitsCount += 1;
                if (!existing.stores.includes(row.storeName)) existing.stores.push(row.storeName);
                tallyMap.set(key, existing);
                return;
            }

            const matches = spec.matchAll(/(?:\((\d+)\)\s*|(\d+)\s*[-xX]\s*)?(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)/g);
            let matchedAny = false;

            for (const match of matches) {
                matchedAny = true;
                const qty = parseInt(match[1] || match[2] || '1', 10);
                const l = match[3];
                const w = match[4];
                const d = match[5];
                const normalizedSize = `${l}x${w}x${d}`;

                const existing = tallyMap.get(normalizedSize) || { size: normalizedSize, quantity: 0, unitsCount: 0, stores: [] };
                existing.quantity += qty;
                existing.unitsCount += 1;
                if (!existing.stores.includes(row.storeName)) existing.stores.push(row.storeName);
                tallyMap.set(normalizedSize, existing);
            }

            if (!matchedAny) {
                const key = spec.trim();
                const existing = tallyMap.get(key) || { size: key, quantity: 0, unitsCount: 0, stores: [] };
                existing.quantity += 1;
                existing.unitsCount += 1;
                if (!existing.stores.includes(row.storeName)) existing.stores.push(row.storeName);
                tallyMap.set(key, existing);
            }
        });

        return Array.from(tallyMap.values()).sort((a, b) => b.quantity - a.quantity);
    }, [filteredRows]);

    const totalFilterCount = useMemo(() => {
        return filterTally.reduce((sum, item) => sum + item.quantity, 0);
    }, [filterTally]);

    const unverifiedCount = useMemo(() => {
        return filteredRows.filter(r => r.isUnverified).length;
    }, [filteredRows]);

    const handleCopySummary = () => {
        let text = `MALL FILTER REQUISITION PULL SHEET\n`;
        text += `Client: ${customer?.name || 'Impact Service Group'} (Contract #2282)\n`;
        text += `Mall Cluster: ${selectedMall === 'ALL' ? 'All Malls' : selectedMall}\n`;
        text += `Total Units: ${filteredRows.length} | Total Filters Required: ${totalFilterCount}\n\n`;
        text += `FILTER TALLY SUMMARY:\n`;
        filterTally.forEach(item => {
            text += `- ${item.size}: ${item.quantity} qty (${item.unitsCount} units)\n`;
        });
        text += `\nSTORE LOADOUT BREAKDOWN:\n`;
        filteredRows.forEach(r => {
            text += `[ ] ${r.storeName} (${r.mall}) - ${r.equipment.brand} ${r.equipment.model} - Filters: ${r.filterSpec}\n`;
        });

        navigator.clipboard.writeText(text);
        showToast.success("Pull sheet summary copied to clipboard!");
    };

    const handlePrintPullSheet = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast.error("Pop-up blocked. Please allow pop-ups to print pull sheet.");
            return;
        }

        const tallyRowsHtml = filterTally.map(item => `
            <tr>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-weight: bold; font-family: monospace; font-size: 13px;">${item.size}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center; font-weight: 900; font-size: 14px; color: #0284c7;">${item.quantity}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${item.unitsCount}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-size: 11px; color: #555;">${item.stores.slice(0, 5).join(', ')}${item.stores.length > 5 ? ` +${item.stores.length - 5} more` : ''}</td>
            </tr>
        `).join('');

        const storeRowsHtml = filteredRows.map((r, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#fafafa' : '#fff'};">
                <td style="padding: 6px 8px; border: 1px solid #ddd; text-align: center; width: 30px;">
                    <div style="width: 14px; height: 14px; border: 1.5px solid #444; border-radius: 2px; margin: 0 auto;"></div>
                </td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-weight: bold; font-size: 12px;">${r.storeName}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-size: 11px; color: #666;">${r.mall}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-size: 11px;">
                    <strong>${r.equipment.brand || 'Unit'}</strong> ${r.equipment.model || ''}
                    <div style="font-family: monospace; font-size: 10px; color: #888;">S/N: ${r.equipment.serial || 'N/A'}</div>
                </td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; font-weight: bold; font-family: monospace; font-size: 12px; color: #0f172a;">${r.filterSpec}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center; font-size: 11px;">
                    ${r.isUnverified ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">⚠️ Verify ($45 Survey)</span>' : '<span style="color: #059669; font-weight: bold;">✓ Verified</span>'}
                </td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Mall Filter Pull Sheet - ${customer?.name || 'Impact Service Group'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #1e293b; }
                    h1 { margin: 0 0 4px 0; font-size: 20px; }
                    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .badge-box { display: inline-block; padding: 6px 12px; background: #e0f2fe; color: #0369a1; border-radius: 6px; font-weight: bold; font-size: 12px; margin-right: 8px; }
                    @media print {
                        body { margin: 10mm; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
                    <div>
                        <h1>📦 MALL FILTER REQUISITION PULL SHEET</h1>
                        <div class="meta">
                            <strong>Client:</strong> ${customer?.name || 'Impact Service Group, LLC'} (Contract No. 2282)<br/>
                            <strong>Mall Cluster:</strong> ${selectedMall === 'ALL' ? 'All Malls (49 Stores)' : selectedMall}<br/>
                            <strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="badge-box">Total Filters: ${totalFilterCount}</div>
                        <div class="badge-box" style="background: #fef3c7; color: #92400e;">Unverified Stores: ${unverifiedCount}</div>
                    </div>
                </div>

                <h3 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #334155;">1. Warehouse Requisition Tally (Van Loading Totals)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Filter Dimensions</th>
                            <th style="text-align: center;">Total Qty Needed</th>
                            <th style="text-align: center;">Units Count</th>
                            <th>Stores Requiring Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tallyRowsHtml}
                    </tbody>
                </table>

                <h3 style="margin: 20px 0 8px 0; font-size: 14px; text-transform: uppercase; color: #334155;">2. Store-by-Store Loadout Checklist</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center;">Load</th>
                            <th>Store / Suite</th>
                            <th>Mall / Cluster</th>
                            <th>Equipment Specs</th>
                            <th>Filter Specification</th>
                            <th style="text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${storeRowsHtml}
                    </tbody>
                </table>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10090] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-modal-in">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            <Box size={22} className="text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black uppercase tracking-wider text-white">
                                    Mall Filter Requisition & Warehouse Pull Sheet
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase border border-emerald-500/30">
                                    Contract #2282
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                {customer?.name || 'Impact Service Group'} • 49 Store Clusters • HVAC Rooftop & Air Handler Filter Specs
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleCopySummary}
                            className="h-8 text-xs font-bold flex items-center gap-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                            title="Copy Summary to Clipboard"
                        >
                            <Copy size={13} />
                            <span className="hidden sm:inline">Copy Text</span>
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handlePrintPullSheet}
                            className="h-8 text-xs font-black flex items-center gap-1.5 px-3 !bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-md border-0 cursor-pointer"
                            title="Print Warehouse Loadout Pull Sheet"
                        >
                            <Printer size={13} />
                            <span>Print Pull Sheet</span>
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Filtered Units</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-lg font-black text-slate-900 dark:text-white">{filteredRows.length}</span>
                            <span className="text-[10px] text-slate-500">of {equipmentList.length} total</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        <span className="text-[10px] font-extrabold uppercase text-indigo-500 block tracking-wider">Total Filters Needed</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{totalFilterCount}</span>
                            <span className="text-[10px] text-slate-500">filters to pull</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        <span className="text-[10px] font-extrabold uppercase text-amber-500 block tracking-wider">Unverified Filter Sizes</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400">{unverifiedCount}</span>
                            <span className="text-[10px] text-slate-500">units to survey</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600 block tracking-wider">Eligible $45 Survey Revenue</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                ${(filteredRows.length * 45).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-emerald-600/80 font-bold">($45 x {filteredRows.length})</span>
                        </div>
                    </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                    {/* Mall Clusters Tab Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar max-w-full pb-1">
                        <button
                            type="button"
                            onClick={() => setSelectedMall('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                                selectedMall === 'ALL'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                            🏬 All Malls ({locations.length})
                        </button>
                        {mallClusters.map(cluster => (
                            <button
                                key={cluster.name}
                                type="button"
                                onClick={() => setSelectedMall(cluster.name)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    selectedMall === cluster.name
                                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                            >
                                {cluster.name} ({cluster.storeCount})
                            </button>
                        ))}
                    </div>

                    {/* Search & Verification Status Filter */}
                    <div className="flex items-center gap-2 flex-1 min-w-[280px] justify-end">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search store, mall, unit, filter..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <select
                            aria-label="Filter by verification status"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="ALL">All Specs</option>
                            <option value="VERIFIED">Verified Sizes Only</option>
                            <option value="NEEDS_SURVEY">Needs $45 Survey Only</option>
                        </select>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {/* 1. Aggregate Filter Pull Summary */}
                    <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                                <Filter size={15} className="text-indigo-600 dark:text-indigo-400" />
                                Warehouse Filter Pull Tally for {selectedMall === 'ALL' ? 'All Locations' : selectedMall}
                            </h3>
                            <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                                {filterTally.length} distinct sizes tallied
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                            {filterTally.map(tally => (
                                <div 
                                    key={tally.size}
                                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                                        tally.size.includes('Needs') || tally.size.includes('Verify')
                                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
                                            : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900/50 text-slate-800 dark:text-slate-200 shadow-xs'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white truncate" title={tally.size}>
                                            {tally.size}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono font-black text-xs shrink-0 shadow-xs">
                                            x{tally.quantity}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                                        <span>{tally.unitsCount} unit{tally.unitsCount === 1 ? '' : 's'}</span>
                                        <span className="truncate max-w-[80px]" title={tally.stores.join(', ')}>
                                            {tally.stores.length} store{tally.stores.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Detailed Store Equipment Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-4 py-3">Store & Location</th>
                                    <th className="px-4 py-3">Mall Cluster</th>
                                    <th className="px-4 py-3">Equipment Specs</th>
                                    <th className="px-4 py-3 font-mono">Filter Requirement</th>
                                    <th className="px-4 py-3 text-center">First-Visit Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredRows.map(row => (
                                    <tr key={row.equipment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {row.storeName}
                                            </div>
                                            {row.location?.address && (
                                                <div className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">
                                                    {typeof row.location.address === 'string' ? row.location.address : row.location.address.street}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                                                {row.mall}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                {row.equipment.brand || 'Unit'} • {row.equipment.tonnage ? `${row.equipment.tonnage} Ton` : row.equipment.type}
                                            </div>
                                            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                                Mod: {row.equipment.model || 'N/A'} | Ser: {row.equipment.serial || 'N/A'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border ${
                                                row.isUnverified 
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                            }`}>
                                                {row.filterSpec}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            {row.isUnverified ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300">
                                                    <AlertTriangle size={11} /> Needs $45 Survey
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300">
                                                    <CheckCircle2 size={11} /> Verified Specs
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-400">
                                            No equipment found matching criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                        Showing {filteredRows.length} units across {selectedMall === 'ALL' ? 'all mall clusters' : selectedMall}.
                    </span>
                    <Button variant="secondary" onClick={onClose} className="px-4 py-1.5 cursor-pointer">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MallFilterRequisitionModal;
