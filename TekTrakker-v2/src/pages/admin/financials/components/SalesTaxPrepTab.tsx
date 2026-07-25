import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { 
    Calculator, Printer, Calendar, Download, Copy, Check, ExternalLink, 
    FileText, Info, DollarSign, Scale, Percent, ArrowRight, RefreshCw, 
    ShieldCheck, Search, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';
import DocumentPreview from 'components/ui/DocumentPreview';
import type { Job } from 'types';
import { US_STATE_TAX_RULES, StateTaxRule } from '../../../../constants/stateTaxRules';

interface SalesTaxPrepTabProps {
    jobs: Job[];
    orgTaxRate?: number;
    orgName?: string;
}

const SalesTaxPrepTab: React.FC<SalesTaxPrepTabProps> = ({ 
    jobs, 
    orgTaxRate = 8.25, 
    orgName = 'Your Business' 
}) => {
    const { t } = useLanguage();
    const { state } = useAppContext();

    // Determine Organization Default State (e.g. TX, CA, FL, NY)
    const rawOrgState = (state.currentOrganization as any)?.state || '';
    const detectedStateCode = useMemo(() => {
        if (!rawOrgState) return 'TX';
        const cleaned = rawOrgState.trim().toUpperCase();
        if (cleaned.length === 2 && US_STATE_TAX_RULES[cleaned]) return cleaned;
        // Search by state name
        const match = (Object.values(US_STATE_TAX_RULES) as StateTaxRule[]).find(s => s.name.toLowerCase() === cleaned.toLowerCase());
        return match ? match.code : 'TX';
    }, [rawOrgState]);

    const [selectedStateCode, setSelectedStateCode] = useState<string>(detectedStateCode);

    // Preset & Date Range state
    const [preset, setPreset] = useState<string>('this_month');
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [accountingBasis, setAccountingBasis] = useState<'cash' | 'accrual'>('cash');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
    const fmtWhole = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

    // Handle Preset Date Changes
    const handlePresetChange = (p: string) => {
        setPreset(p);
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();

        if (p === 'this_month') {
            setStartDate(new Date(y, m, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, m + 1, 0).toISOString().split('T')[0]);
        } else if (p === 'last_month') {
            setStartDate(new Date(y, m - 1, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, m, 0).toISOString().split('T')[0]);
        } else if (p === 'this_quarter') {
            const quarterMonth = Math.floor(m / 3) * 3;
            setStartDate(new Date(y, quarterMonth, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, quarterMonth + 3, 0).toISOString().split('T')[0]);
        } else if (p === 'last_quarter') {
            const currentQuarterMonth = Math.floor(m / 3) * 3;
            const lastQuarterMonth = currentQuarterMonth - 3;
            const qYear = lastQuarterMonth < 0 ? y - 1 : y;
            const actualLastQuarterMonth = (lastQuarterMonth + 12) % 12;
            setStartDate(new Date(qYear, actualLastQuarterMonth, 1).toISOString().split('T')[0]);
            setEndDate(new Date(qYear, actualLastQuarterMonth + 3, 0).toISOString().split('T')[0]);
        } else if (p === 'q1_this_year') {
            setStartDate(new Date(y, 0, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, 2, 31).toISOString().split('T')[0]);
        } else if (p === 'q2_this_year') {
            setStartDate(new Date(y, 3, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, 5, 30).toISOString().split('T')[0]);
        } else if (p === 'q3_this_year') {
            setStartDate(new Date(y, 6, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, 8, 30).toISOString().split('T')[0]);
        } else if (p === 'q4_this_year') {
            setStartDate(new Date(y, 9, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, 11, 31).toISOString().split('T')[0]);
        } else if (p === 'this_year') {
            setStartDate(new Date(y, 0, 1).toISOString().split('T')[0]);
            setEndDate(new Date(y, 11, 31).toISOString().split('T')[0]);
        } else if (p === 'all_time') {
            setStartDate('');
            setEndDate('');
        }
    };

    // Filter jobs & calculate sales tax metrics
    const taxData = useMemo(() => {
        const filteredJobs: any[] = [];
        let totalGrossSales = 0;
        let totalTaxableSales = 0;
        let totalExemptSales = 0;
        let totalTaxCollected = 0;

        jobs.forEach((j: any) => {
            if (!j.invoice || j.deleted || j.archived) return;

            const inv = j.invoice;
            const dateStr = accountingBasis === 'cash'
                ? (inv.paidDate || j.appointmentTime || j.createdAt)
                : (j.appointmentTime || j.createdAt);

            if (!dateStr) return;
            const dateOnly = dateStr.split('T')[0];

            if (startDate && dateOnly < startDate) return;
            if (endDate && dateOnly > endDate) return;

            // In Cash Basis mode, only include paid invoices or invoices with collected payments
            if (accountingBasis === 'cash' && inv.status !== 'Paid' && !(Number(inv.amountPaid) > 0)) {
                return;
            }

            // Check if Customer is Tax Exempt
            const cust = j.customerId ? state.customers?.find(c => c.id === j.customerId) : null;
            const isTaxExemptCustomer = !!(
                cust?.taxExempt || 
                cust?.taxExemptCertUrl || 
                inv.taxExempt || 
                inv.customerTaxExempt
            );
            const certUrl = cust?.taxExemptCertUrl || inv.taxExemptCertUrl || inv.customerTaxExemptCertUrl || null;
            const certNumber = cust?.taxExemptNumber || inv.taxExemptNumber || null;

            // Calculation per invoice
            const lineItems: any[] = inv.items || [];
            let invTaxable = 0;
            let invExempt = 0;
            let invSubtotal = Number(inv.subtotal) || 0;

            if (isTaxExemptCustomer) {
                // Tax Exempt customer: 100% of invoice subtotal is tax-exempt
                if (lineItems.length > 0) {
                    invExempt = lineItems.reduce((sum, i) => sum + (Number(i.total) || (Number(i.quantity || 1) * Number(i.unitPrice || i.price || 0))), 0);
                } else {
                    invExempt = invSubtotal;
                }
                invTaxable = 0;
                if (invSubtotal === 0) invSubtotal = invExempt;
            } else if (lineItems.length > 0) {
                lineItems.forEach((item: any) => {
                    const itemQty = Number(item.quantity) || 1;
                    const itemUnitPrice = Number(item.unitPrice || item.price) || 0;
                    const itemTotal = item.total !== undefined ? Number(item.total) : (itemQty * itemUnitPrice);
                    if (item.taxable !== false) {
                        invTaxable += itemTotal;
                    } else {
                        invExempt += itemTotal;
                    }
                });
                if (invSubtotal === 0) {
                    invSubtotal = invTaxable + invExempt;
                }
            } else {
                // Fallback if no detailed line items exist
                const invTaxRate = Number(inv.taxRate) || (orgTaxRate / 100);
                const invTaxAmt = Number(inv.taxAmount) || 0;
                if (invTaxAmt > 0 && invTaxRate > 0) {
                    invTaxable = invTaxAmt / invTaxRate;
                    invExempt = Math.max(0, invSubtotal - invTaxable);
                } else {
                    invExempt = invSubtotal;
                    invTaxable = 0;
                }
            }

            const invTaxAmount = isTaxExemptCustomer ? 0 : (Number(inv.taxAmount) || (invTaxable * ((Number(inv.taxRate) || (orgTaxRate / 100)))));
            const invTotal = Number(inv.totalAmount) || Number(inv.amount) || (invSubtotal + invTaxAmount);

            totalGrossSales += invSubtotal;
            totalTaxableSales += invTaxable;
            totalExemptSales += invExempt;
            totalTaxCollected += invTaxAmount;

            filteredJobs.push({
                jobId: j.id,
                invoiceId: inv.id || j.id,
                customerName: j.customerName || 'Customer',
                date: dateOnly,
                status: inv.status || 'Unpaid',
                subtotal: invSubtotal,
                taxable: invTaxable,
                exempt: invExempt,
                taxRate: isTaxExemptCustomer ? 0 : (Number(inv.taxRate) ? Number(inv.taxRate) * (Number(inv.taxRate) <= 1 ? 100 : 1) : orgTaxRate),
                taxCollected: invTaxAmount,
                total: invTotal,
                isTaxExemptCustomer,
                certUrl,
                certNumber,
                lineItems
            });
        });

        // Selected State Rule
        const currentStateRule = US_STATE_TAX_RULES[selectedStateCode] || US_STATE_TAX_RULES['TX'];

        // Calculate Tax Paid on Supplies/Materials from Expenses (Credit for Tax Paid to Suppliers)
        let totalTaxPaidSupplies = 0;
        (state.expenses || []).forEach((exp: any) => {
            if (!exp.date) return;
            const expDate = exp.date.split('T')[0];
            if (startDate && expDate < startDate) return;
            if (endDate && expDate > endDate) return;
            if (exp.category === 'Materials (COGS)' || exp.category === 'Supplies' || exp.category === 'Taxes and licenses') {
                totalTaxPaidSupplies += (Number(exp.amount) || 0);
            }
        });

        // Tax-Paid Purchases Credit (estimated tax paid at supply house)
        const taxPaidToSuppliersCredit = totalTaxPaidSupplies * ((orgTaxRate / 100) / (1 + (orgTaxRate / 100)));

        // State Tax vs Local Tax Breakdown
        const stateTaxRate = currentStateRule.defaultStateRate;
        const effectiveTotalRate = orgTaxRate || (currentStateRule.defaultStateRate + currentStateRule.defaultLocalRate);
        const localTaxRate = Math.max(0, effectiveTotalRate - stateTaxRate);

        const stateTaxDue = totalTaxableSales * (stateTaxRate / 100);
        const localTaxDue = totalTaxableSales * (localTaxRate / 100);

        // State Timely Filing Discount calculation
        let timelyFilingDiscount = totalTaxCollected * (currentStateRule.timelyDiscountPercent / 100);
        if (currentStateRule.timelyDiscountCap && timelyFilingDiscount > currentStateRule.timelyDiscountCap) {
            timelyFilingDiscount = currentStateRule.timelyDiscountCap;
        }
        const netTaxPayable = Math.max(0, totalTaxCollected - timelyFilingDiscount);

        return {
            filteredJobs: filteredJobs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stateRule: currentStateRule,
            totalGrossSales,
            totalTaxableSales,
            totalExemptSales,
            totalTaxCollected,
            stateTaxRate,
            localTaxRate,
            stateTaxDue,
            localTaxDue,
            totalTaxPaidSupplies,
            taxPaidToSuppliersCredit,
            timelyFilingDiscount,
            netTaxPayable
        };
    }, [jobs, startDate, endDate, accountingBasis, orgTaxRate, state.expenses, state.customers, selectedStateCode]);

    // Copy to clipboard helper
    const handleCopy = (fieldId: string, textToCopy: string, label: string) => {
        navigator.clipboard.writeText(textToCopy);
        setCopiedField(fieldId);
        showToast.info(`Copied ${label}: ${textToCopy}`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // CSV Download Generator
    const handleExportCSV = () => {
        const headers = [
            'Invoice #',
            'Date',
            'Customer',
            'Status',
            'Gross Subtotal ($)',
            'Taxable Sales ($)',
            'Tax-Exempt Sales ($)',
            'Tax Rate (%)',
            'Tax Collected ($)',
            'Total Amount ($)'
        ];

        const rows = taxData.filteredJobs.map(item => [
            `"${item.invoiceId}"`,
            `"${item.date}"`,
            `"${item.customerName.replace(/"/g, '""')}"`,
            `"${item.status}"`,
            item.subtotal.toFixed(2),
            item.taxable.toFixed(2),
            item.exempt.toFixed(2),
            item.taxRate.toFixed(2),
            item.taxCollected.toFixed(2),
            item.total.toFixed(2)
        ]);

        const summaryHeader = [
            ['TEXAS SALES & USE TAX FILING REPORT'],
            [`Business Name`, `"${orgName}"`],
            [`Filing Period`, `"${startDate || 'Start'} to ${endDate || 'Today'}"`],
            [`Accounting Basis`, `"${accountingBasis.toUpperCase()}"`],
            [`Effective Tax Rate`, `"${orgTaxRate}%"`],
            [''],
            ['TEXAS COMPTROLLER FORM 01-114 WEBFILE SUMMARY'],
            ['Item 1: Total Gross Sales (Exact)', taxData.totalGrossSales.toFixed(2)],
            ['Item 1: Total Gross Sales (WebFile Whole Dollars)', Math.round(taxData.totalGrossSales)],
            ['Item 2: Total Taxable Sales (Exact)', taxData.totalTaxableSales.toFixed(2)],
            ['Item 2: Total Taxable Sales (WebFile Whole Dollars)', Math.round(taxData.totalTaxableSales)],
            ['Item 3: Total Tax-Exempt Sales (Exact)', taxData.totalExemptSales.toFixed(2)],
            ['Item 3: Total Tax-Exempt Sales (WebFile Whole Dollars)', Math.round(taxData.totalExemptSales)],
            ['State Tax Portion (6.25%)', taxData.stateTaxDue.toFixed(2)],
            ['Local Tax Portion (' + taxData.localTaxRate.toFixed(2) + '%)', taxData.localTaxDue.toFixed(2)],
            ['Item 4: Total Tax Collected / Due (Exact)', taxData.totalTaxCollected.toFixed(2)],
            ['Item 4: Total Tax Collected (WebFile Whole Dollars)', Math.round(taxData.totalTaxCollected)],
            ['Timely Filing Discount (0.5%)', taxData.timelyFilingDiscount.toFixed(2)],
            ['Net Tax Payable to State', taxData.netTaxPayable.toFixed(2)],
            [''],
            ['INVOICE TRANSACTION AUDIT LEDGER'],
            headers
        ];

        const csvContent = summaryHeader.map(r => r.join(',')).join('\n') + '\n' + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Texas_Sales_Tax_Report_${startDate || 'all'}_to_${endDate || 'today'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter invoices by search
    const displayedInvoices = useMemo(() => {
        if (!searchQuery.trim()) return taxData.filteredJobs;
        const q = searchQuery.toLowerCase();
        return taxData.filteredJobs.filter(inv => 
            inv.invoiceId.toLowerCase().includes(q) ||
            inv.customerName.toLowerCase().includes(q) ||
            inv.status.toLowerCase().includes(q)
        );
    }, [taxData.filteredJobs, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Legal Disclaimer & Operational Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                <ShieldCheck size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                    <h5 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Operational Tax Prep Tool & Legal Disclaimer
                    </h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                        TekTrakker is an operational management and recordkeeping platform. TekTrakker is <strong>not</strong> a licensed accounting software, Certified Public Accountant (CPA) firm, or tax preparation authority. The sales tax calculations, WebFile return summaries, tax-exempt tracking tools, and expense credit estimates provided herein are generated solely to assist your business with recordkeeping and filing preparation for official tax software or personal accounting records. You are advised to review all financial data with a certified tax professional or CPA prior to submitting official state or federal filings.
                    </p>
                </div>
            </div>

            {/* Filter & Control Panel */}
            <Card className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Scale size={18} className="text-emerald-600 dark:text-emerald-400" />
                            {taxData.stateRule.name} Sales & Use Tax Filing Prep
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Calculate exact figures for filing with {taxData.stateRule.agency} ({taxData.stateRule.formName}).
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* State Jurisdiction Selector */}
                        <div className="min-w-[180px]">
                            <select
                                aria-label="Filing State Jurisdiction"
                                title="Filing State Jurisdiction"
                                className="w-full text-xs font-bold border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 p-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                value={selectedStateCode}
                                onChange={e => setSelectedStateCode(e.target.value)}
                            >
                                {(Object.values(US_STATE_TAX_RULES) as StateTaxRule[]).map((s: StateTaxRule) => (
                                    <option key={s.code} value={s.code}>
                                        🏛️ {s.name} ({s.code}) {s.noSalesTax ? '- No Sales Tax' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Accounting Basis Switcher */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-1 rounded-xl flex items-center shadow-inner">
                            <button
                                type="button"
                                onClick={() => setAccountingBasis('cash')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    accountingBasis === 'cash'
                                        ? 'bg-emerald-600 text-white shadow'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Cash Basis
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccountingBasis('accrual')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    accountingBasis === 'accrual'
                                        ? 'bg-emerald-600 text-white shadow'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Accrual Basis
                            </button>
                        </div>

                        {/* Period Select Dropdown */}
                        <div className="min-w-[160px]">
                            <select
                                aria-label="Tax Filing Period"
                                title="Tax Filing Period"
                                className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                value={preset}
                                onChange={e => handlePresetChange(e.target.value)}
                            >
                                <optgroup label="Monthly Returns">
                                    <option value="this_month">This Month</option>
                                    <option value="last_month">Last Month</option>
                                </optgroup>
                                <optgroup label="Quarterly Returns">
                                    <option value="this_quarter">Current Quarter</option>
                                    <option value="last_quarter">Last Quarter</option>
                                    <option value="q1_this_year">Q1 (Jan - Mar)</option>
                                    <option value="q2_this_year">Q2 (Apr - Jun)</option>
                                    <option value="q3_this_year">Q3 (Jul - Sep)</option>
                                    <option value="q4_this_year">Q4 (Oct - Dec)</option>
                                </optgroup>
                                <optgroup label="Annual & Custom">
                                    <option value="this_year">Full Year (Annual)</option>
                                    <option value="all_time">All Time</option>
                                    <option value="custom">Custom Range</option>
                                </optgroup>
                            </select>
                        </div>

                        {/* Date Pickers */}
                        <div className="flex items-center gap-2">
                            <input
                                aria-label="Start Date"
                                title="Start Date"
                                type="date"
                                className="text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-40"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
                                disabled={preset !== 'custom'}
                            />
                            <span className="text-slate-400 font-bold text-xs">&rarr;</span>
                            <input
                                aria-label="End Date"
                                title="End Date"
                                type="date"
                                className="text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-40"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
                                disabled={preset !== 'custom'}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Main Texas WebFile Return Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Item 1: Total Gross Sales */}
                <Card className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
                                Item 1
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Texas WebFile</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total Gross Sales
                        </h5>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                            {fmt(taxData.totalGrossSales)}
                        </p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            WebFile Round: {fmtWhole(taxData.totalGrossSales)}
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleCopy('gross_whole', Math.round(taxData.totalGrossSales).toString(), 'Gross Sales Whole Dollars')}
                            className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            {copiedField === 'gross_whole' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            Copy WebFile ($)
                        </button>
                    </div>
                </Card>

                {/* Item 2: Taxable Sales */}
                <Card className="bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-900/50 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
                                Item 2
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Taxed Revenue</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total Taxable Sales
                        </h5>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {fmt(taxData.totalTaxableSales)}
                        </p>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                            WebFile Round: {fmtWhole(taxData.totalTaxableSales)}
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleCopy('taxable_whole', Math.round(taxData.totalTaxableSales).toString(), 'Taxable Sales Whole Dollars')}
                            className="flex-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            {copiedField === 'taxable_whole' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            Copy WebFile ($)
                        </button>
                    </div>
                </Card>

                {/* Item 3: Tax-Exempt Sales */}
                <Card className="bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-900/50 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
                                Item 3
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Non-Taxable</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total Tax-Exempt Sales
                        </h5>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                            {fmt(taxData.totalExemptSales)}
                        </p>
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mt-1">
                            WebFile Round: {fmtWhole(taxData.totalExemptSales)}
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleCopy('exempt_whole', Math.round(taxData.totalExemptSales).toString(), 'Exempt Sales Whole Dollars')}
                            className="flex-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-800 dark:text-blue-300 text-[11px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            {copiedField === 'exempt_whole' ? <Check size={12} className="text-blue-600" /> : <Copy size={12} />}
                            Copy WebFile ($)
                        </button>
                    </div>
                </Card>

                {/* Item 4: Total Tax Collected / Due */}
                <Card className="bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-900/50 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
                                Item 4
                            </span>
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">Rate: {orgTaxRate}%</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total Tax Collected
                        </h5>
                        <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                            {fmt(taxData.totalTaxCollected)}
                        </p>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-1">
                            WebFile Round: {fmtWhole(taxData.totalTaxCollected)}
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleCopy('tax_whole', Math.round(taxData.totalTaxCollected).toString(), 'Tax Collected Whole Dollars')}
                            className="flex-1 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-800 dark:text-purple-300 text-[11px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            {copiedField === 'tax_whole' ? <Check size={12} className="text-purple-600" /> : <Copy size={12} />}
                            Copy WebFile ($)
                        </button>
                    </div>
                </Card>

            </div>

            {/* State Trade & Contractor Sales Tax Rules Reference Card */}
            <Card className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-5 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h5 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                        <Info size={16} className="text-blue-600 dark:text-blue-400" />
                        {taxData.stateRule.name} Trade & Contractor Rules ({taxData.stateRule.agency})
                    </h5>
                    <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold px-2 py-0.5 rounded uppercase">
                        {taxData.stateRule.code} Automated Rules
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <span>🏠 Residential Jobs</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                            <strong>Parts & Equipment:</strong> {taxData.stateRule.noSalesTax ? 'Exempt' : 'Taxable'}<br/>
                            <strong>Repair/Remodel Labor:</strong> {taxData.stateRule.residentialLaborTaxable ? 'Taxable' : 'Exempt / Non-Taxable'}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <span>🏢 Commercial Jobs</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                            <strong>Parts & Equipment:</strong> {taxData.stateRule.noSalesTax ? 'Exempt' : 'Taxable'}<br/>
                            <strong>Repair/Remodel Labor:</strong> {taxData.stateRule.commercialLaborTaxable ? 'Taxable' : 'Exempt / Non-Taxable'}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <span>📦 State Specific Notes</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                            {taxData.stateRule.contractorNotes}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Detailed State/Local Breakdown & Timely Filing Discount Sheet */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
                    <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="text-emerald-600 dark:text-emerald-400" size={22} />
                            {taxData.stateRule.name} Sales & Use Tax Return Worksheet ({taxData.stateRule.formName})
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Breakdown of State ({taxData.stateTaxRate.toFixed(2)}%) vs Local ({taxData.localTaxRate.toFixed(2)}%) tax components and timely payment discounts for {taxData.stateRule.agency}.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            onClick={handleExportCSV}
                            variant="secondary"
                            className="text-xs font-bold py-2.5 px-4 flex items-center gap-2 border-slate-300 dark:border-slate-700"
                        >
                            <Download size={14} /> Export CSV
                        </Button>
                        <Button
                            onClick={() => setIsReportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase py-2.5 px-4 flex items-center gap-2 shadow"
                        >
                            <Printer size={14} /> Official PDF Report
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Left Column: Form Line Breakdown */}
                    <div className="space-y-4 text-xs font-sans">
                        <h5 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs border-b pb-2">
                            State vs. Local Jurisdiction Division
                        </h5>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Texas State Sales Tax Rate</span>
                                <span className="font-extrabold text-slate-900 dark:text-white">6.250%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 dark:text-slate-400">Texas State Sales Tax Due</span>
                                <span className="font-bold text-slate-900 dark:text-white">{fmt(taxData.stateTaxDue)}</span>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Local Jurisdiction Tax Rate (City/County/Transit)</span>
                                <span className="font-extrabold text-slate-900 dark:text-white">{taxData.localTaxRate.toFixed(3)}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 dark:text-slate-400">Local Jurisdiction Tax Due</span>
                                <span className="font-bold text-slate-900 dark:text-white">{fmt(taxData.localTaxDue)}</span>
                            </div>
                        </div>

                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl space-y-2 border border-emerald-200 dark:border-emerald-900/40">
                            <div className="flex justify-between items-center">
                                <span className="font-extrabold text-emerald-900 dark:text-emerald-300">Total Combined Sales Tax Collected</span>
                                <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">{fmt(taxData.totalTaxCollected)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Timely Filing Discount & Net Payable */}
                    <div className="space-y-4 text-xs font-sans">
                        <h5 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs border-b pb-2">
                            Timely Payment & Net Remittance
                        </h5>

                        <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <Percent size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span className="font-bold text-blue-900 dark:text-blue-300">Texas Timely Filing Discount (0.5%)</span>
                                </div>
                                <span className="font-black text-blue-700 dark:text-blue-400">{fmt(taxData.timelyFilingDiscount)}</span>
                            </div>
                            <p className="text-[11px] text-blue-800 dark:text-blue-300">
                                If you file and pay on or before the due date (20th of the month), Texas allows a 0.5% timely filing discount deduction.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow border border-slate-800 space-y-2">
                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block">Net Amount Due to Texas Comptroller</span>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-2xl font-black text-white">{fmt(taxData.netTaxPayable)}</span>
                                    <span className="block text-[11px] text-slate-400 mt-0.5">
                                        WebFile Rounded: {fmtWhole(taxData.netTaxPayable)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopy('net_payable', Math.round(taxData.netTaxPayable).toString(), 'Net Tax Payable')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                    {copiedField === 'net_payable' ? <Check size={12} /> : <Copy size={12} />}
                                    Copy Net Amount
                                </button>
                            </div>
                        </div>

                        {/* Direct Portal Helper */}
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-[11px] text-amber-900 dark:text-amber-300 font-semibold">
                                    Texas Sales Tax returns are due by the 20th of the month following the period.
                                </span>
                            </div>
                            <a
                                href="https://comptroller.texas.gov/taxes/webfile/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1 shrink-0 transition-colors ml-2"
                            >
                                WebFile Portal <ExternalLink size={10} />
                            </a>
                        </div>
                    </div>

                </div>
            </Card>

            {/* Audit Invoice Ledger Table */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
                    <div>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Search size={16} className="text-emerald-600" />
                            Tax Transaction Audit Ledger ({taxData.filteredJobs.length} Invoices)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Audit individual invoice subtotals, taxable items, exempt items, and tax collected.
                        </p>
                    </div>

                    <div className="w-full sm:w-64">
                        <Input
                            aria-label="Search Invoices"
                            placeholder="Search by ID, customer..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="text-xs"
                        />
                    </div>
                </div>

                {displayedInvoices.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic border border-dashed rounded-xl">
                        No invoices found for the selected period or filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto border rounded-xl dark:border-slate-800">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Invoice #</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Taxable</th>
                                    <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">Exempt</th>
                                    <th className="px-4 py-3 text-right">Tax Rate</th>
                                    <th className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">Tax Collected</th>
                                    <th className="px-4 py-3 text-right font-black">Total</th>
                                    <th className="px-2 py-3 text-center">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                {displayedInvoices.map((inv) => {
                                    const isExpanded = expandedInvoiceId === inv.jobId;
                                    return (
                                        <React.Fragment key={inv.jobId}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{inv.date}</td>
                                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">#{inv.invoiceId}</td>
                                                <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-semibold">
                                                    <div>{inv.customerName}</div>
                                                    {inv.isTaxExemptCustomer && (
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                                                🏛️ Tax Exempt {inv.certNumber ? `(#${inv.certNumber})` : ''}
                                                            </span>
                                                            {inv.certUrl && (
                                                                <a 
                                                                    href={inv.certUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                                                >
                                                                    View Cert ↗
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                                        inv.status === 'Paid' 
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                    }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold">{fmt(inv.subtotal)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(inv.taxable)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">{fmt(inv.exempt)}</td>
                                                <td className="px-4 py-3 text-right text-slate-500">{inv.taxRate.toFixed(2)}%</td>
                                                <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400">{fmt(inv.taxCollected)}</td>
                                                <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">{fmt(inv.total)}</td>
                                                <td className="px-2 py-3 text-center">
                                                    {inv.lineItems && inv.lineItems.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.jobId)}
                                                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                                                            title="Toggle Line Items"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expandable Line Item Details */}
                                            {isExpanded && inv.lineItems && inv.lineItems.length > 0 && (
                                                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-t border-b border-slate-200 dark:border-slate-700">
                                                    <td colSpan={11} className="p-4">
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                                                                Line Item Classification Breakdown for #{inv.invoiceId}
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                {inv.lineItems.map((item: any, idx: number) => {
                                                                    const itemQty = Number(item.quantity) || 1;
                                                                    const itemUnitPrice = Number(item.unitPrice || item.price) || 0;
                                                                    const itemTotal = item.total !== undefined ? Number(item.total) : (itemQty * itemUnitPrice);
                                                                    const isTaxable = item.taxable !== false;
                                                                    return (
                                                                        <div key={idx} className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center shadow-sm">
                                                                            <div>
                                                                                <p className="font-bold text-slate-800 dark:text-slate-200">{item.name || item.description || 'Line Item'}</p>
                                                                                <p className="text-[10px] text-slate-500">{itemQty} &times; ${itemUnitPrice.toFixed(2)}</p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="font-bold">{fmt(itemTotal)}</p>
                                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                                                    isTaxable 
                                                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                                                                }`}>
                                                                                    {isTaxable ? 'Taxable' : 'Tax-Exempt'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Official Printable PDF Report Modal */}
            {isReportModalOpen && (
                <DocumentPreview
                    type="Other"
                    data={{
                        id: `TX-SALES-TAX-${Date.now()}`,
                        title: 'Texas Sales & Use Tax Return Report',
                        customerName: orgName,
                        htmlContent: `
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 10px auto; padding: 35px; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 8px;">
                                <!-- Header -->
                                <div style="border-bottom: 3px solid #047857; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
                                    <div>
                                        <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.025em;">${orgName}</h1>
                                        <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #047857; margin: 0; letter-spacing: 0.05em;">Texas Comptroller Form 01-114 / 01-116 Sales & Use Tax Return Worksheet</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <h2 style="font-size: 15px; font-weight: 900; color: #047857; text-transform: uppercase; margin: 0 0 4px 0;">Official Filing Record</h2>
                                        <p style="font-size: 11px; color: #475569; font-weight: 600; margin: 0;">Period: ${startDate ? new Date(startDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'Start'} &ndash; ${endDate ? new Date(endDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'Today'}</p>
                                        <p style="font-size: 10px; color: #64748b; font-weight: 500; margin: 2px 0 0 0;">Basis: ${accountingBasis.toUpperCase()} &bull; Rate: ${orgTaxRate}%</p>
                                    </div>
                                </div>

                                <!-- Key Filing Fields Table -->
                                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px;">
                                    <thead>
                                        <tr style="background-color: #f0fdf4; border-bottom: 2px solid #047857; text-align: left;">
                                            <th style="padding: 10px; font-weight: 800; color: #064e3b; text-transform: uppercase; letter-spacing: 0.05em; width: 120px;">WebFile Field</th>
                                            <th style="padding: 10px; font-weight: 800; color: #064e3b; text-transform: uppercase; letter-spacing: 0.05em;">Tax Line Item Description</th>
                                            <th style="padding: 10px; text-align: right; font-weight: 800; color: #064e3b; text-transform: uppercase; letter-spacing: 0.05em;">Exact Cents ($)</th>
                                            <th style="padding: 10px; text-align: right; font-weight: 800; color: #064e3b; text-transform: uppercase; letter-spacing: 0.05em; width: 140px;">WebFile Whole ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 10px; font-weight: 800; color: #047857;">Item 1</td>
                                            <td style="padding: 10px; font-weight: 700; color: #1e293b;">Total Gross Sales</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600;">${taxData.totalGrossSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 900; color: #047857; background: #f8fafc;">$${Math.round(taxData.totalGrossSales).toLocaleString()}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 10px; font-weight: 800; color: #047857;">Item 2</td>
                                            <td style="padding: 10px; font-weight: 700; color: #1e293b;">Total Taxable Sales</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600;">${taxData.totalTaxableSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 900; color: #047857; background: #f8fafc;">$${Math.round(taxData.totalTaxableSales).toLocaleString()}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 10px; font-weight: 800; color: #047857;">Item 3</td>
                                            <td style="padding: 10px; font-weight: 700; color: #1e293b;">Total Tax-Exempt Sales</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600;">${taxData.totalExemptSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 900; color: #047857; background: #f8fafc;">$${Math.round(taxData.totalExemptSales).toLocaleString()}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 10px; font-weight: 800; color: #047857;">Item 4</td>
                                            <td style="padding: 10px; font-weight: 700; color: #1e293b;">Total Tax Collected / Due (${orgTaxRate}%)</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600;">${taxData.totalTaxCollected.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 900; color: #047857; background: #f8fafc;">$${Math.round(taxData.totalTaxCollected).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <!-- Jurisdiction & Discount Breakdown -->
                                <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                                    <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; background-color: #f8fafc;">
                                        <h4 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin: 0 0 10px 0;">Jurisdiction Split</h4>
                                        <div style="font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                                            <span>Texas State Tax (6.25%):</span>
                                            <strong style="color: #0f172a;">$${taxData.stateTaxDue.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                        <div style="font-size: 11px; display: flex; justify-content: space-between;">
                                            <span>Local Jurisdiction (${taxData.localTaxRate.toFixed(2)}%):</span>
                                            <strong style="color: #0f172a;">$${taxData.localTaxDue.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                    </div>

                                    <div style="flex: 1; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; background-color: #f0fdf4;">
                                        <h4 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #166534; margin: 0 0 10px 0;">Timely Discount & Net Remittance</h4>
                                        <div style="font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                                            <span>Timely Filing Discount (0.5%):</span>
                                            <strong style="color: #15803d;">-$${taxData.timelyFilingDiscount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                        <div style="font-size: 12px; font-weight: 900; display: flex; justify-content: space-between; border-top: 1.5px solid #86efac; padding-top: 6px; color: #14532d;">
                                            <span>Net Tax Due to State:</span>
                                            <span>$${taxData.netTaxPayable.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Signature Block -->
                                <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
                                    <p style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 25px;">Filing Verification & Sign-Off</p>
                                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #334155;">
                                        <div style="width: 45%; border-top: 1px solid #94a3b8; padding-top: 4px;">
                                            Prepared By Signature / Title
                                        </div>
                                        <div style="width: 25%; border-top: 1px solid #94a3b8; padding-top: 4px;">
                                            Filing Date
                                        </div>
                                        <div style="width: 20%; border-top: 1px solid #94a3b8; padding-top: 4px;">
                                            Confirmation #
                                        </div>
                                    </div>
                                </div>

                                <!-- Legal Disclaimer -->
                                <div style="margin-top: 25px; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 9px; color: #64748b; line-height: 1.4;">
                                    <strong>LEGAL DISCLAIMER:</strong> TekTrakker is an operational management and recordkeeping platform. TekTrakker is not a certified public accounting (CPA) firm, licensed tax advisor, or tax filing service. The sales tax calculations, WebFile return summaries, tax-exempt tracking tools, and expense credit estimates contained in this document are generated solely for organizational recordkeeping and tax preparation convenience. Tax laws and rates vary by jurisdiction. Please consult a qualified CPA or licensed tax professional prior to submitting official state or federal filings.
                                </div>
                            </div>
                        `
                    }}
                    onClose={() => setIsReportModalOpen(false)}
                />
            )}
        </div>
    );
};

export default SalesTaxPrepTab;
