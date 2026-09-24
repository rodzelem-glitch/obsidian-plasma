import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import { 
    CreditCard, DollarSign, Receipt, AlertCircle, 
    CheckCircle2, Wrench, Building2, MapPin, Calendar, 
    FileText, ArrowRight, ShieldCheck, Sparkles, Lock, Building
} from 'lucide-react';
import type { Job, Customer, Organization, Proposal } from 'types';
import { formatAddress } from 'lib/utils';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { PaymentInstructionsCard } from 'components/payment/PaymentInstructionsCard';
import { SiteSealEmbed } from 'components/payment/SiteSealEmbed';
import { getOrgPaymentInstructions } from 'lib/paymentInstructionsHelper';

interface SubmitPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    organization: Organization | null;
    jobs: Job[];
    proposals?: Proposal[];
    onProceedToPayment: (jobId: string, customAmount?: number, isDeposit?: boolean) => void;
}

const SubmitPaymentModal: React.FC<SubmitPaymentModalProps> = ({
    isOpen,
    onClose,
    customer,
    organization,
    jobs = [],
    proposals = [],
    onProceedToPayment
}) => {
    const [selectedTab, setSelectedTab] = useState<'invoices' | 'deposit' | 'custom' | 'offline'>('invoices');
    const paymentConfig = getOrgPaymentInstructions(organization);
    
    // Deposit state
    const [selectedJobIdForDeposit, setSelectedJobIdForDeposit] = useState<string>('');
    const [depositAmount, setDepositAmount] = useState<string>('250');
    const [depositNotes, setDepositNotes] = useState<string>('');

    // Custom payment state
    const [customPayAmount, setCustomPayAmount] = useState<string>('100');
    const [customPayMemo, setCustomPayMemo] = useState<string>('');

    const unpaidJobs = useMemo(() => {
        return jobs.filter(j => {
            if (!j.invoice) return false;
            const inv = j.invoice;
            const canonical = computeCanonicalFinancials({
                items: inv.items || [],
                subtotal: inv.subtotal,
                taxRate: inv.taxRate,
                taxAmount: inv.taxAmount,
                totalAmount: inv.totalAmount ?? inv.amount,
                amountPaid: inv.amountPaid,
                depositPaid: inv.depositPaid,
                depositPaidAmount: inv.depositPaidAmount,
                status: inv.status
            });
            const isPaid = String(inv.status).toLowerCase() === 'paid' || canonical.financialStatus === 'PAID' || canonical.balanceDue <= 0;
            const hasBillableAmount = canonical.grandTotal > 0 || (Array.isArray(inv.items) && inv.items.length > 0);
            return !isPaid && hasBillableAmount && canonical.balanceDue > 0;
        });
    }, [jobs]);

    const activeJobsForDeposit = useMemo(() => {
        return jobs.filter(j => j.jobStatus !== 'Completed');
    }, [jobs]);

    const totalUnpaidBalance = useMemo(() => {
        return unpaidJobs.reduce((sum, j) => {
            const inv: any = j.invoice || {};
            const canonical = computeCanonicalFinancials({
                items: inv.items || [],
                subtotal: inv.subtotal,
                taxRate: inv.taxRate,
                taxAmount: inv.taxAmount,
                totalAmount: inv.totalAmount ?? inv.amount,
                amountPaid: inv.amountPaid,
                depositPaid: inv.depositPaid,
                depositPaidAmount: inv.depositPaidAmount,
                status: inv.status
            });
            return sum + canonical.balanceDue;
        }, 0);
    }, [unpaidJobs]);

    // Initialize default selected job if needed
    React.useEffect(() => {
        if (activeJobsForDeposit.length > 0 && !selectedJobIdForDeposit) {
            setSelectedJobIdForDeposit(activeJobsForDeposit[0].id);
        }
    }, [activeJobsForDeposit, selectedJobIdForDeposit]);

    if (!isOpen) return null;

    const handlePayInvoice = (job: Job) => {
        onClose();
        onProceedToPayment(job.id);
    };

    const handleSubmitDeposit = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(depositAmount);
        if (isNaN(amt) || amt <= 0) return;
        const targetJobId = selectedJobIdForDeposit || (activeJobsForDeposit[0]?.id) || (jobs[0]?.id);
        if (!targetJobId) return;
        onClose();
        onProceedToPayment(targetJobId, amt, true);
    };

    const handleCustomPay = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(customPayAmount);
        if (isNaN(amt) || amt <= 0) return;
        const targetJobId = unpaidJobs[0]?.id || activeJobsForDeposit[0]?.id || jobs[0]?.id || 'general';
        onClose();
        onProceedToPayment(targetJobId, amt, true);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Submit Payment or Project Deposit" 
            size="lg"
        >
            <div className="space-y-6">
                {/* Organization & Trust Header */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-base text-white">
                                {organization?.name || 'TekTrakker Merchant Gateway'}
                            </h4>
                            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                                <Lock size={12} className="text-emerald-400" />
                                <span>256-Bit SSL Encrypted & PCI-Compliant Checkout</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {organization?.pciComplianceSealHtml && (
                            <div className="hidden sm:block">
                                <SiteSealEmbed sealHtml={organization.pciComplianceSealHtml} showLabel={false} />
                            </div>
                        )}
                        {totalUnpaidBalance > 0 && (
                            <div className="bg-rose-500/20 border border-rose-500/40 px-3.5 py-1.5 rounded-xl text-right">
                                <span className="text-[10px] uppercase font-black tracking-wider text-rose-300 block">Total Due</span>
                                <span className="text-lg font-black font-mono text-white">${totalUnpaidBalance.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {organization?.pciComplianceSealHtml && (
                    <div className="sm:hidden flex justify-center -mt-2">
                        <SiteSealEmbed sealHtml={organization.pciComplianceSealHtml} />
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setSelectedTab('invoices')}
                        className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedTab === 'invoices'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Receipt size={14} className="shrink-0" />
                        <span className="truncate">Invoices</span>
                        {unpaidJobs.length > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                                {unpaidJobs.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTab('deposit')}
                        className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedTab === 'deposit'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <DollarSign size={14} className="shrink-0" />
                        <span className="truncate">Deposit</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTab('custom')}
                        className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedTab === 'custom'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Sparkles size={14} className="shrink-0" />
                        <span className="truncate">Custom</span>
                    </button>

                    {paymentConfig.hasAnyAccepted && (
                        <button
                            type="button"
                            onClick={() => setSelectedTab('offline')}
                            className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                selectedTab === 'offline'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Building size={14} className="shrink-0" />
                            <span className="truncate">ACH / Wire</span>
                        </button>
                    )}
                </div>

                {/* TAB 1: UNPAID INVOICES */}
                {selectedTab === 'invoices' && (
                    <div className="space-y-3">
                        {unpaidJobs.length === 0 ? (
                            <div className="text-center py-10 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                                <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
                                <h5 className="text-sm font-black text-emerald-900 dark:text-emerald-300">All Invoices Are Up To Date!</h5>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                    You have $0.00 in outstanding balances. If you would like to submit a deposit for an upcoming job, switch to the "Project Deposit" tab.
                                </p>
                            </div>
                        ) : (
                            unpaidJobs.map(j => {
                                const inv: any = j.invoice || {};
                                const canonical = computeCanonicalFinancials({
                                    items: inv.items || [],
                                    subtotal: inv.subtotal,
                                    taxRate: inv.taxRate,
                                    taxAmount: inv.taxAmount,
                                    totalAmount: inv.totalAmount ?? inv.amount,
                                    amountPaid: inv.amountPaid,
                                    depositPaid: inv.depositPaid,
                                    depositPaidAmount: inv.depositPaidAmount,
                                    status: inv.status
                                });
                                const invoiceDisplayId = inv.id || (j.jobNumber && String(j.jobNumber).startsWith('job-') ? j.jobNumber.toUpperCase() : (j.jobNumber || `INV-${j.id.slice(-6).toUpperCase()}`));
                                const amount = canonical.balanceDue;
                                return (
                                    <Card 
                                        key={j.id} 
                                        className="p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-all"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                                    Invoice #{invoiceDisplayId}
                                                </span>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                    Unpaid Balance
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {j.tasks?.join(', ') || 'Service Work Order'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                                <span>📅 {new Date(j.appointmentTime).toLocaleDateString()}</span>
                                                {j.locationName && <span>📍 {j.locationName}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 self-end sm:self-center">
                                            <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                                                ${amount.toFixed(2)}
                                            </span>
                                            <Button
                                                onClick={() => handlePayInvoice(j)}
                                                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                                            >
                                                <CreditCard size={13} /> Pay Now
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                )}

                {/* TAB 2: PROJECT DEPOSIT */}
                {selectedTab === 'deposit' && (
                    <form onSubmit={handleSubmitDeposit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                Select Scheduled Work Order / Project
                            </label>
                            {activeJobsForDeposit.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                                    No active work orders currently scheduled. Your deposit will be credited to your customer account profile.
                                </p>
                            ) : (
                                <select
                                    value={selectedJobIdForDeposit}
                                    onChange={(e) => setSelectedJobIdForDeposit(e.target.value)}
                                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    {activeJobsForDeposit.map(j => (
                                        <option key={j.id} value={j.id}>
                                            WO #{j.workOrderNumber || j.id.slice(-6).toUpperCase()} - {j.tasks?.join(', ') || 'Service Visit'} ({new Date(j.appointmentTime).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                Deposit Amount ($)
                            </label>
                            <div className="grid grid-cols-4 gap-2 mb-2">
                                {['100', '250', '500', '1000'].map(preset => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setDepositAmount(preset)}
                                        className={`py-2 text-xs font-black rounded-xl border transition-all ${
                                            depositAmount === preset
                                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        ${preset}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                                    placeholder="Enter deposit amount"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                Notes or Memo (Optional)
                            </label>
                            <input
                                type="text"
                                value={depositNotes}
                                onChange={(e) => setDepositNotes(e.target.value)}
                                placeholder="e.g. Deposit for AC replacement materials"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
                        >
                            <Lock size={14} />
                            <span>Continue to Secure Checkout (${parseFloat(depositAmount || '0').toFixed(2)})</span>
                            <ArrowRight size={14} />
                        </Button>
                    </form>
                )}

                {/* TAB 3: CUSTOM PAYMENT */}
                {selectedTab === 'custom' && (
                    <form onSubmit={handleCustomPay} className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Submit a custom payment or advance account credit toward your account with <strong>{organization?.name || 'TekTrakker'}</strong>.
                        </p>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                Payment Amount ($)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={customPayAmount}
                                    onChange={(e) => setCustomPayAmount(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2.5 text-base font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                Memo / Reference
                            </label>
                            <input
                                type="text"
                                value={customPayMemo}
                                onChange={(e) => setCustomPayMemo(e.target.value)}
                                placeholder="e.g. Advance payment for maintenance"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
                        >
                            <CreditCard size={14} />
                            <span>Proceed to Payment (${parseFloat(customPayAmount || '0').toFixed(2)})</span>
                            <ArrowRight size={14} />
                        </Button>
                    </form>
                )}

                {/* TAB 4: OFFLINE / DIRECT REMITTANCE (CHECK / WIRE / ACH) */}
                {selectedTab === 'offline' && (
                    <div className="space-y-4">
                        <PaymentInstructionsCard 
                            organization={organization}
                            title="Direct Remittance Instructions"
                            description="Use the following details to submit payment via Physical Check, Wire Transfer, or ACH Direct Bank Deposit:"
                        />
                        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300">
                            <p className="font-bold flex items-center gap-1.5 mb-1">
                                <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                                <span>Remittance Advice Notification</span>
                            </p>
                            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                                Once you have initiated a wire transfer, ACH deposit, or mailed a check, please email your remittance confirmation or check tracking to <strong>{organization?.email || 'our billing department'}</strong> so our accounting team can promptly credit your account.
                            </p>
                        </div>
                    </div>
                )}

                {/* Helper footer link for offline methods when on other tabs */}
                {selectedTab !== 'offline' && paymentConfig.hasAnyAccepted && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                        <span>Prefer to pay by Check, Wire, or ACH bank transfer?</span>
                        <button
                            type="button"
                            onClick={() => setSelectedTab('offline')}
                            className="text-primary-600 dark:text-sky-400 font-bold hover:underline"
                        >
                            View Remittance Details &rarr;
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SubmitPaymentModal;
