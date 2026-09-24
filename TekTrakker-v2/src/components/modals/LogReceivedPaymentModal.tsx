import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Customer, Job } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { 
    getCustomerOpenInvoices, 
    autoAllocatePayment, 
    OpenInvoiceItem,
    PaymentAllocationResult 
} from '../../lib/paymentAllocation';
import { getOrgPaymentInstructions } from '../../lib/paymentInstructionsHelper';
import { 
    DollarSign, 
    CheckCircle2, 
    Sparkles, 
    ArrowRight, 
    Calendar, 
    FileText, 
    CreditCard, 
    X, 
    RefreshCw, 
    CheckSquare,
    Square,
    AlertCircle,
    Building,
    Search,
    Users,
    Percent
} from 'lucide-react';
import Button from '../ui/Button';

interface LogReceivedPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer?: Customer | null;
    jobs?: Job[];
    defaultCustomerId?: string;
    zIndex?: string;
}

export const LogReceivedPaymentModal: React.FC<LogReceivedPaymentModalProps> = ({
    isOpen,
    onClose,
    customer,
    jobs,
    defaultCustomerId,
    zIndex
}) => {
    const { state, dispatch } = useAppContext();

    // Customer Selection State (if not pre-locked by customer prop)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customer?.id || defaultCustomerId || '');
    const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
    const [isChangingCustomer, setIsChangingCustomer] = useState<boolean>(!customer && !defaultCustomerId && !selectedCustomerId);
    const [isShaking, setIsShaking] = useState<boolean>(false);

    useEffect(() => {
        if (customer?.id) {
            setSelectedCustomerId(customer.id);
            setIsChangingCustomer(false);
        } else if (defaultCustomerId) {
            setSelectedCustomerId(defaultCustomerId);
            setIsChangingCustomer(false);
        } else {
            setSelectedCustomerId('');
            setIsChangingCustomer(true);
        }
    }, [customer, defaultCustomerId, isOpen]);

    const effectiveJobs = jobs || state.jobs || [];

    // Map of all customers with open balances
    const customersWithBalances = useMemo(() => {
        const custMap = new Map<string, { customer: Customer; openBalance: number; openCount: number }>();
        const allCustomers = state.customers || [];

        for (const cust of allCustomers) {
            const open = getCustomerOpenInvoices(effectiveJobs, cust.id);
            const bal = open.reduce((sum, o) => sum + o.balanceDue, 0);
            if (bal > 0.01) {
                custMap.set(cust.id, { customer: cust, openBalance: bal, openCount: open.length });
            }
        }
        return Array.from(custMap.values()).sort((a, b) => b.openBalance - a.openBalance);
    }, [state.customers, effectiveJobs]);

    // Active customer resolution (Strictly no automatic defaulting)
    const activeCustomer: Customer | null = useMemo(() => {
        if (customer) return customer;
        if (selectedCustomerId) {
            return (state.customers || []).find(c => c.id === selectedCustomerId) || null;
        }
        return null;
    }, [customer, selectedCustomerId, state.customers]);

    // Impact Service Group (Contract #2282) Detection - Strictly Isolated
    const isImpactCustomer = useMemo(() => {
        if (!activeCustomer) return false;
        return activeCustomer.id === 'cust-1787187506048' || 
               (activeCustomer.name && activeCustomer.name.toLowerCase().includes('impact service group'));
    }, [activeCustomer]);

    // 7% Broker Fee Auto-Reconciliation state (Isolated to Impact Service Group)
    const [autoReconcileBrokerFee, setAutoReconcileBrokerFee] = useState<boolean>(true);

    // Form inputs
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Check');
    const [referenceNumber, setReferenceNumber] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Allocation state: jobId -> allocated amount
    const [allocations, setAllocations] = useState<{ [jobId: string]: number }>({});
    const [strategyUsed, setStrategyUsed] = useState<'exact_combination' | 'fifo' | 'manual'>('fifo');

    // Extract all open invoices for active customer
    const openInvoices = useMemo(() => {
        if (!activeCustomer) return [];
        return getCustomerOpenInvoices(effectiveJobs, activeCustomer.id);
    }, [effectiveJobs, activeCustomer]);

    const totalOpenBalance = useMemo(() => {
        return openInvoices.reduce((sum, item) => sum + item.balanceDue, 0);
    }, [openInvoices]);

    // Impact Financial Breakdown
    const impactGrossDue = totalOpenBalance;
    const impactBrokerFeeDue = parseFloat((impactGrossDue * 0.07).toFixed(2));
    const impactNetCheckDue = parseFloat((impactGrossDue * 0.93).toFixed(2));

    // Calculate total broker fee auto-reconciled across current allocations
    const totalBrokerFeeReconciled = useMemo(() => {
        if (!isImpactCustomer || !autoReconcileBrokerFee) return 0;
        let feeSum = 0;
        for (const [jobId, allocAmount] of Object.entries(allocations)) {
            if (!allocAmount || allocAmount <= 0) continue;
            const openItem = openInvoices.find(item => item.jobId === jobId);
            if (!openItem) continue;
            const calculatedFee = parseFloat((allocAmount * (7 / 93)).toFixed(2));
            const remainingBalance = Math.max(0, openItem.balanceDue - allocAmount);
            feeSum += Math.min(remainingBalance, calculatedFee);
        }
        return parseFloat(feeSum.toFixed(2));
    }, [isImpactCustomer, autoReconcileBrokerFee, allocations, openInvoices]);

    // Re-run allocation when customer changes
    const handleSelectCustomer = (custId: string) => {
        setSelectedCustomerId(custId);
        setIsChangingCustomer(false);
        setAllocations({});
        const targetCust = (state.customers || []).find(c => c.id === custId);
        if (targetCust?.id === 'cust-1787187506048' || targetCust?.name?.toLowerCase().includes('impact service group')) {
            setAutoReconcileBrokerFee(true);
        }
        if (paymentAmount) {
            const num = parseFloat(paymentAmount);
            if (!isNaN(num) && num > 0) {
                const targetCustomerInvoices = getCustomerOpenInvoices(effectiveJobs, custId);
                const result = autoAllocatePayment(targetCustomerInvoices, num);
                setAllocations(result.allocations);
                setStrategyUsed(result.strategyUsed);
            }
        }
    };

    // Perform auto-allocation whenever payment amount changes
    const runAutoAllocate = (amountNum: number) => {
        if (isNaN(amountNum) || amountNum <= 0) {
            setAllocations({});
            setStrategyUsed('fifo');
            return;
        }

        const result: PaymentAllocationResult = autoAllocatePayment(openInvoices, amountNum);
        setAllocations(result.allocations);
        setStrategyUsed(result.strategyUsed);
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPaymentAmount(val);
        const num = parseFloat(val);
        runAutoAllocate(num);
    };

    // Quick allocation helpers
    const handleAllocateFullOpenBalance = () => {
        setPaymentAmount(totalOpenBalance.toFixed(2));
        runAutoAllocate(totalOpenBalance);
    };

    const handleAllocateImpactNetRemittance = () => {
        const netAmount = parseFloat((totalOpenBalance * 0.93).toFixed(2));
        setPaymentAmount(netAmount.toFixed(2));
        setPaymentMethod('Check');
        setNotes('Impact Service Group 93% Net Remittance (7% Broker Fee Auto-Reconciled)');
        setStrategyUsed('manual');
        const newAllocations: { [jobId: string]: number } = {};
        openInvoices.forEach(inv => {
            const netAlloc = parseFloat((inv.balanceDue * 0.93).toFixed(2));
            if (netAlloc > 0) {
                newAllocations[inv.jobId] = netAlloc;
            }
        });
        setAllocations(newAllocations);
    };

    const handleClearAllocations = () => {
        setAllocations({});
        setStrategyUsed('manual');
    };

    // Manual row allocation change
    const handleRowAllocationChange = (jobId: string, maxDue: number, newValStr: string) => {
        const num = parseFloat(newValStr);
        setStrategyUsed('manual');
        setAllocations(prev => {
            const next = { ...prev };
            if (isNaN(num) || num <= 0) {
                delete next[jobId];
            } else {
                next[jobId] = Math.min(maxDue, parseFloat(num.toFixed(2)));
            }
            return next;
        });
    };

    const handleToggleRow = (jobId: string, maxDue: number) => {
        setStrategyUsed('manual');
        setAllocations(prev => {
            const next = { ...prev };
            if (next[jobId] && next[jobId] > 0) {
                delete next[jobId];
            } else {
                next[jobId] = maxDue;
            }
            return next;
        });
    };

    // Computations
    const numPaymentAmount = parseFloat(paymentAmount) || 0;
    const totalAllocated = useMemo(() => {
        return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
    }, [allocations]);

    const unallocatedAmount = Math.max(0, numPaymentAmount - totalAllocated);
    const overAllocatedAmount = Math.max(0, totalAllocated - numPaymentAmount);
    const allocatedInvoiceCount = Object.keys(allocations).filter(k => (allocations[k] || 0) > 0).length;

    if (!isOpen) return null;

    const handleSave = async () => {
        if (allocatedInvoiceCount === 0) {
            showToast.error("Please allocate payment to at least one invoice.");
            return;
        }

        if (totalAllocated <= 0) {
            showToast.error("Total allocated amount must be greater than $0.00.");
            return;
        }

        setIsSaving(true);
        try {
            const nowIso = new Date().toISOString();
            const batchUpdatedJobs: Job[] = [];
            let totalBrokerFeeRecorded = 0;

            for (const [jobId, allocAmount] of Object.entries(allocations)) {
                if (!allocAmount || allocAmount <= 0) continue;

                const openItem = openInvoices.find(item => item.jobId === jobId);
                if (!openItem) continue;

                const originalJob = openItem.job;
                const inv = originalJob.invoice ? { ...originalJob.invoice } : ({} as any);

                // Calculate Impact 7% Broker Fee adjustment if applicable
                let brokerFeeAmount = 0;
                if (isImpactCustomer && autoReconcileBrokerFee) {
                    const calculatedFee = parseFloat((allocAmount * (7 / 93)).toFixed(2));
                    const remainingBalance = Math.max(0, openItem.balanceDue - allocAmount);
                    brokerFeeAmount = Math.min(remainingBalance, calculatedFee);
                    totalBrokerFeeRecorded += brokerFeeAmount;
                }

                const currentAmountPaid = Number(inv.amountPaid) || 0;
                const newAmountPaid = parseFloat((currentAmountPaid + allocAmount + brokerFeeAmount).toFixed(2));
                const invoiceTotal = Number(inv.totalAmount) || Number(inv.amount) || openItem.totalAmount;
                const remainingDue = Math.max(0, parseFloat((invoiceTotal - newAmountPaid).toFixed(2)));
                const isFullySettled = remainingDue <= 0.01;

                // 1. Primary Received Payment Record (Net Remittance from Check / ACH)
                const primaryPaymentRecord = {
                    id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    amount: allocAmount,
                    method: paymentMethod,
                    reference: referenceNumber.trim() || undefined,
                    date: paymentDate,
                    notes: notes.trim() 
                        ? (isImpactCustomer && brokerFeeAmount > 0 ? `${notes.trim()} (Net Remittance)` : notes.trim())
                        : (isImpactCustomer && brokerFeeAmount > 0 ? 'Impact Service Group 93% Net Remittance' : undefined),
                    createdAt: nowIso
                };

                const newPaymentsList: any[] = [primaryPaymentRecord];

                // 2. Auto-Reconciled Broker Fee Record (Contract #2282 Deduction)
                if (brokerFeeAmount > 0) {
                    const feePaymentRecord = {
                        id: `pay-${Date.now() + 1}-${Math.random().toString(36).substr(2, 6)}`,
                        amount: brokerFeeAmount,
                        method: 'Broker Fee Deduction',
                        reference: 'Contract #2282 (7% Broker Fee)',
                        date: paymentDate,
                        notes: `Impact Service Group 7% Contract Broker Fee auto-reconciled on Invoice #${openItem.invoiceId}.`,
                        createdAt: nowIso
                    };
                    newPaymentsList.push(feePaymentRecord);
                }

                const updatedPayments = Array.isArray(inv.payments) 
                    ? [...inv.payments, ...newPaymentsList] 
                    : newPaymentsList;

                const updatedInvoice = {
                    ...inv,
                    amountPaid: newAmountPaid,
                    payments: updatedPayments,
                    status: isFullySettled ? 'Paid' : 'Partially Paid',
                    ...(isFullySettled ? {
                        paidDate: paymentDate || nowIso,
                        paymentMethod: paymentMethod
                    } : {})
                };

                const updatedJob: Job = {
                    ...originalJob,
                    invoice: updatedInvoice,
                    updatedAt: nowIso
                };

                // Sync to Firestore
                const cleanedPayload = cleanUndefinedFields(updatedJob);
                await db.collection('jobs').doc(jobId).set(cleanedPayload, { merge: true });

                // Dispatch to local state
                dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                batchUpdatedJobs.push(updatedJob);
            }

            if (totalBrokerFeeRecorded > 0) {
                showToast.success(`Recorded Net Payment of $${totalAllocated.toFixed(2)} + auto-reconciled $${totalBrokerFeeRecorded.toFixed(2)} in 7% Broker Fees across ${batchUpdatedJobs.length} invoice(s)!`);
            } else {
                showToast.success(`Successfully logged payment of $${totalAllocated.toFixed(2)} across ${batchUpdatedJobs.length} invoice(s)!`);
            }
            onClose();
        } catch (error: any) {
            console.error("Error logging received payment:", error);
            showToast.error(`Failed to record payment: ${error?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const zIndexClass = zIndex || 'z-[10080]';

    return ReactDOM.createPortal(
        <div 
            role="presentation"
            className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200`}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 300);
                }
            }}
        >
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-modal-in transition-all duration-150 ease-out ${isShaking ? 'scale-[1.015] ring-4 ring-emerald-500/40 shadow-emerald-500/20' : ''}`}>
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <DollarSign size={24} />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-lg text-[#123A63] dark:text-sky-300">Log Received Payment</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#123A63]/10 text-[#123A63] dark:bg-sky-950/40 dark:text-sky-300">
                                    Multi-Invoice Match
                                </span>
                            </div>

                            {activeCustomer && !isChangingCustomer ? (
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Customer: <strong className="text-slate-800 dark:text-slate-200">{activeCustomer.name}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Open Balance: <strong className="text-rose-600 font-black">${totalOpenBalance.toFixed(2)}</strong> ({openInvoices.length} open invoices)
                                    </span>
                                    {!customer && (
                                        <button 
                                            type="button" 
                                            onClick={() => setIsChangingCustomer(true)} 
                                            className="text-[11px] font-bold text-primary-600 hover:text-primary-700 dark:text-sky-400 underline ml-1"
                                        >
                                            Change Customer
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mt-1.5 max-w-md">
                                    <select
                                        aria-label="Select Customer with Open Balance"
                                        title="Select Customer with Open Balance"
                                        value={selectedCustomerId}
                                        onChange={(e) => handleSelectCustomer(e.target.value)}
                                        className="w-full text-xs font-bold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                    >
                                        <option value="" disabled>-- Select Customer --</option>
                                        {customersWithBalances.length > 0 && (
                                            <optgroup label="Customers with Open Balances">
                                                {customersWithBalances.map(({ customer: c, openBalance, openCount }) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} (${openBalance.toFixed(2)} due &bull; {openCount} inv)
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="All Customers">
                                            {(state.customers || []).map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    {activeCustomer && (
                                        <button 
                                            type="button" 
                                            onClick={() => setIsChangingCustomer(false)}
                                            className="text-xs text-slate-400 hover:text-slate-600 shrink-0 font-semibold"
                                        >
                                            Done
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {!activeCustomer ? (
                        <div className="space-y-6 max-w-2xl mx-auto py-6">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                                    <Users size={24} />
                                </div>
                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Select Customer to Receive Payment</h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto">
                                    Choose a customer to load their outstanding work orders, auto-match invoices, and record payment.
                                </p>
                            </div>

                            {/* Customer Search Filter */}
                            <div className="relative">
                                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search customer by name, address, or phone..."
                                    value={customerSearchQuery}
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-white font-medium"
                                />
                            </div>

                            {/* Top Customers with Balances */}
                            {customersWithBalances.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                            Customers with Outstanding Balances ({customersWithBalances.length})
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                                        {customersWithBalances
                                            .filter(({ customer: c }) => 
                                                !customerSearchQuery || 
                                                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                (c.phone && c.phone.includes(customerSearchQuery)) ||
                                                (c.address && c.address.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                                            )
                                            .map(({ customer: c, openBalance, openCount }) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => handleSelectCustomer(c.id)}
                                                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all text-left group flex items-center justify-between"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                                                            {c.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                            {openCount} open {openCount === 1 ? 'invoice' : 'invoices'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                                                            ${openBalance.toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                                                            Select &rarr;
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Dropdown of all customers */}
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Or Pick Any Customer From Directory:
                                </label>
                                <select
                                    aria-label="Pick Any Customer From Directory"
                                    title="Pick Any Customer From Directory"
                                    value={selectedCustomerId}
                                    onChange={(e) => handleSelectCustomer(e.target.value)}
                                    className="w-full text-xs font-bold py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="" disabled>-- Select Customer --</option>
                                    {(state.customers || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} {c.address ? `(${c.address})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* Impact Service Group 7% Broker Fee Auto-Reconciliation Card (Contract #2282 Exclusive) */}
                    {isImpactCustomer && (
                        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 text-amber-950 dark:text-amber-200 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                                        <Percent size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h5 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-100">
                                                Impact Service Group (Contract #2282) &bull; 7% Broker Fee Reconciliation
                                            </h5>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                                                Net 93% Remittance Check
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300 mt-1 max-w-2xl">
                                            Impact automatically deducts a mandatory <strong>7% broker fee</strong> from all gross invoices. 
                                            Auto-reconciliation logs the 93% net check and records the 7% fee adjustment so your invoices settle to <strong>$0.00 Paid in Full</strong> without creating phantom balances.
                                        </p>
                                        <div className="flex items-center gap-4 mt-2.5 text-xs font-extrabold flex-wrap">
                                            <span className="text-slate-700 dark:text-slate-300">
                                                Gross Balance: <strong className="font-mono text-slate-900 dark:text-white">${impactGrossDue.toFixed(2)}</strong>
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                            <span className="text-amber-700 dark:text-amber-400">
                                                7% Broker Fee: <strong className="font-mono">-${impactBrokerFeeDue.toFixed(2)}</strong>
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                            <span className="text-emerald-700 dark:text-emerald-400">
                                                Expected 93% Check: <strong className="font-mono">${impactNetCheckDue.toFixed(2)}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleAllocateImpactNetRemittance}
                                        className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-amber-600/20 flex items-center gap-1.5 transition-all"
                                    >
                                        <Sparkles size={14} />
                                        <span>⚡ Allocate Net 93% (${impactNetCheckDue.toFixed(2)})</span>
                                    </button>
                                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-amber-900 dark:text-amber-200">
                                        <input
                                            type="checkbox"
                                            checked={autoReconcileBrokerFee}
                                            onChange={(e) => setAutoReconcileBrokerFee(e.target.checked)}
                                            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                        />
                                        <span>Auto-reconcile 7% broker fee</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        {/* Amount */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider mb-1">
                                Payment Amount ($) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChange={handleAmountChange}
                                    className="w-full pl-8 pr-3 py-2 text-base font-extrabold text-[#123A63] dark:text-sky-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider mb-1">
                                Payment Method
                            </label>
                            <select 
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                <option value="Check">Check {getOrgPaymentInstructions(state.currentOrganization).check.accepted ? '✓' : ''}</option>
                                <option value="ACH / Direct Deposit">ACH / Direct Deposit {getOrgPaymentInstructions(state.currentOrganization).ach.accepted ? '✓' : ''}</option>
                                <option value="Wire Transfer">Wire Transfer {getOrgPaymentInstructions(state.currentOrganization).wire.accepted ? '✓' : ''}</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="Kort / Online">Kort / Online</option>
                                <option value="Cash">Cash</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Reference / Check # */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider mb-1">
                                Check # / Reference
                            </label>
                            <input 
                                type="text"
                                placeholder="e.g. Check 1042 / Wire ID"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>

                        {/* Payment Date */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider mb-1">
                                Payment Date
                            </label>
                            <input 
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Auto-Match Intelligence Banner */}
                    {numPaymentAmount > 0 && (
                        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            strategyUsed === 'exact_combination'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                {strategyUsed === 'exact_combination' ? (
                                    <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                    <RefreshCw size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                )}
                                <div>
                                    {strategyUsed === 'exact_combination' ? (
                                        <p className="font-extrabold">
                                            ✨ Exact Smart Match Found: System matched {allocatedInvoiceCount} invoice(s) totaling exactly ${totalAllocated.toFixed(2)}!
                                        </p>
                                    ) : strategyUsed === 'fifo' ? (
                                        <p className="font-semibold">
                                            FIFO Waterfall Applied: Allocating payment from oldest to newest invoice ({allocatedInvoiceCount} invoice(s) covered).
                                        </p>
                                    ) : (
                                        <p className="font-semibold">
                                            Custom Allocation: Manual amounts assigned across {allocatedInvoiceCount} invoice(s).
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => runAutoAllocate(numPaymentAmount)}
                                    className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-bold text-[10px] shadow-sm transition-all"
                                >
                                    Re-Match
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Allocation Table Section */}
                    <div>
                        <div className="flex flex-wrap items-center justify-between pb-3 gap-2">
                            <div>
                                <h4 className="font-extrabold text-sm text-[#123A63] dark:text-sky-300">Invoice Allocation Breakdown</h4>
                                <p className="text-[11px] text-slate-500">Review matched invoices or manually adjust the allocated amounts below</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isImpactCustomer && (
                                    <button 
                                        type="button" 
                                        onClick={handleAllocateImpactNetRemittance}
                                        className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/80 border border-amber-300 dark:border-amber-700 transition-colors flex items-center gap-1"
                                    >
                                        <span>⚡ Net 93% (${impactNetCheckDue.toFixed(2)})</span>
                                    </button>
                                )}
                                <button 
                                    type="button" 
                                    onClick={handleAllocateFullOpenBalance}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                    Pay Entire Balance (${totalOpenBalance.toFixed(2)})
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleClearAllocations}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div className="overflow-x-auto max-h-[340px]">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[9px] tracking-wider">
                                            <th className="px-3 py-2.5 text-center w-8">
                                                <CheckSquare size={13} className="text-slate-400 inline" />
                                            </th>
                                            <th className="px-3 py-2.5">Date</th>
                                            <th className="px-3 py-2.5">Invoice #</th>
                                            <th className="px-3 py-2.5">Location / Address</th>
                                            <th className="px-3 py-2.5">Ref / PO #</th>
                                            <th className="px-3 py-2.5 text-right">Total</th>
                                            <th className="px-3 py-2.5 text-right">Current Due</th>
                                            <th className="px-3 py-2.5 text-right w-36">
                                                {isImpactCustomer && autoReconcileBrokerFee ? 'Check Net 93% ($)' : 'Apply Payment ($)'}
                                            </th>
                                            {isImpactCustomer && autoReconcileBrokerFee && (
                                                <th className="px-3 py-2.5 text-right text-amber-700 dark:text-amber-400">7% Fee</th>
                                            )}
                                            <th className="px-3 py-2.5 text-right">Post Due</th>
                                            <th className="px-3 py-2.5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {openInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={isImpactCustomer && autoReconcileBrokerFee ? 11 : 10} className="px-4 py-8 text-center text-slate-400 italic">
                                                    No open or unpaid invoices found for this customer!
                                                </td>
                                            </tr>
                                        ) : (
                                            openInvoices.map((item) => {
                                                const alloc = allocations[item.jobId] || 0;
                                                const isAllocated = alloc > 0;
                                                let rowBrokerFee = 0;
                                                if (isImpactCustomer && autoReconcileBrokerFee && alloc > 0) {
                                                    const calcFee = parseFloat((alloc * (7 / 93)).toFixed(2));
                                                    const remaining = Math.max(0, item.balanceDue - alloc);
                                                    rowBrokerFee = Math.min(remaining, calcFee);
                                                }
                                                const effectiveApplied = alloc + rowBrokerFee;
                                                const postDue = Math.max(0, parseFloat((item.balanceDue - effectiveApplied).toFixed(2)));
                                                const isFullySettled = postDue <= 0.009 && isAllocated;

                                                return (
                                                    <tr 
                                                        key={item.jobId}
                                                        className={`transition-colors ${
                                                            isFullySettled 
                                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20' 
                                                                : isAllocated 
                                                                ? 'bg-blue-50/40 dark:bg-blue-950/20' 
                                                                : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                                                        }`}
                                                    >
                                                        {/* Checkbox */}
                                                        <td className="px-3 py-2 text-center">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleToggleRow(item.jobId, item.balanceDue)}
                                                                className="text-slate-400 hover:text-emerald-600 transition-colors"
                                                            >
                                                                {isAllocated ? (
                                                                    <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
                                                                ) : (
                                                                    <Square size={16} />
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* Date */}
                                                        <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                            {item.date}
                                                        </td>

                                                        {/* Invoice # */}
                                                        <td className="px-3 py-2 font-bold font-mono text-[#123A63] dark:text-sky-300 whitespace-nowrap">
                                                            #{item.invoiceId}
                                                        </td>

                                                        {/* Location / Address */}
                                                        <td className="px-3 py-2 max-w-[180px] truncate" title={`${item.locationName} - ${item.address}`}>
                                                            <strong className="block text-slate-800 dark:text-slate-200 truncate">{item.locationName}</strong>
                                                            <span className="text-[10px] text-slate-400 block truncate">{item.address}</span>
                                                        </td>

                                                        {/* PO / Ref */}
                                                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                                            {item.workOrderNumber || item.poNumber || '—'}
                                                        </td>

                                                        {/* Total */}
                                                        <td className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                                                            ${item.totalAmount.toFixed(2)}
                                                        </td>

                                                        {/* Current Due */}
                                                        <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                                                            ${item.balanceDue.toFixed(2)}
                                                        </td>

                                                        {/* Applied Payment Input */}
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="relative inline-block w-28">
                                                                <span className="absolute left-2 top-1.5 text-slate-400 text-xs font-bold">$</span>
                                                                <input 
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max={item.balanceDue}
                                                                    value={alloc > 0 ? alloc : ''}
                                                                    placeholder="0.00"
                                                                    onChange={(e) => handleRowAllocationChange(item.jobId, item.balanceDue, e.target.value)}
                                                                    className={`w-full pl-5 pr-2 py-1 text-right text-xs font-bold rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                                                        isAllocated 
                                                                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold' 
                                                                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* 7% Broker Fee Auto-Reconciliation column */}
                                                        {isImpactCustomer && autoReconcileBrokerFee && (
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                                                {rowBrokerFee > 0 ? `+$${rowBrokerFee.toFixed(2)}` : '—'}
                                                            </td>
                                                        )}

                                                        {/* Post Due */}
                                                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                                                            ${postDue.toFixed(2)}
                                                        </td>

                                                        {/* Status Badge */}
                                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                                            {isFullySettled ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                    PAID IN FULL
                                                                </span>
                                                            ) : isAllocated ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                                                    PARTIAL
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                    UNPAID
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Memo / Notes input */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider mb-1">
                            Remittance Advice / Internal Memo (Optional)
                        </label>
                        <input 
                            type="text"
                            placeholder="e.g. Received via weekly check run batch"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                    </div>
                    </>
                    )}
                </div>

                {/* Modal Footer Summary & Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 gap-4">
                    {/* Live Financial Totals */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Payment Logged:</span>
                            <span className="font-extrabold text-sm text-[#123A63] dark:text-sky-300">${numPaymentAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Allocated:</span>
                            <span className="font-extrabold text-sm text-emerald-600">${totalAllocated.toFixed(2)}</span>
                        </div>
                        {isImpactCustomer && autoReconcileBrokerFee && totalBrokerFeeReconciled > 0 && (
                            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold block">7% Fee Reconciled:</span>
                                <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 font-mono">+${totalBrokerFeeReconciled.toFixed(2)}</span>
                            </div>
                        )}
                        {unallocatedAmount > 0.009 && (
                            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                                <span className="text-[10px] text-amber-600 uppercase font-bold block">Unallocated Difference:</span>
                                <span className="font-extrabold text-xs text-amber-600">${unallocatedAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {overAllocatedAmount > 0.009 && (
                            <div className="border-l border-slate-200 dark:border-slate-700 pl-4 flex items-center gap-1 text-rose-600 font-bold">
                                <AlertCircle size={14} />
                                <span>Allocated exceeds payment by ${overAllocatedAmount.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <Button 
                            type="button" 
                            variant="secondary"
                            onClick={onClose}
                            disabled={isSaving}
                            className="text-xs py-2 px-4 border-slate-300 dark:border-slate-700 font-bold"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleSave}
                            disabled={isSaving || allocatedInvoiceCount === 0 || totalAllocated <= 0}
                            className="text-xs py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md hover:shadow-emerald-600/20 flex items-center gap-2 border-0"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} />
                                    Confirm & Record Payment (${(totalAllocated + totalBrokerFeeReconciled).toFixed(2)})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
export default LogReceivedPaymentModal;
