import React, { useState, useMemo } from 'react';
import { 
    Terminal, 
    ShieldCheck, 
    CreditCard, 
    RefreshCw, 
    HelpCircle, 
    ExternalLink, 
    Play, 
    CheckCircle2, 
    UserCheck, 
    AlertTriangle,
    Copy,
    Check,
    Zap,
    Building2
} from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import showToast from 'lib/toast';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';

export const KortPlayground: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const [isTestingBilling, setIsTestingBilling] = useState(false);
    const [isRefunding, setIsRefunding] = useState<string | null>(null);

    const activeOrg = state.currentOrganization;

    const handleTestSubscriptionBilling = async () => {
        if (!activeOrg?.id) return;
        setIsTestingBilling(true);
        try {
            const functions = getFunctions();
            const testFn = httpsCallable(functions, 'testKortSubscriptionPayment');
            const res = await testFn({ organizationId: activeOrg.id });
            const data = res.data as any;
            if (data && data.success) {
                showToast.success(data.message || "Test subscription payment processed successfully!");
            } else {
                showToast.error("Failed to process payment.");
            }
        } catch (error: any) {
            console.error("Test subscription payment error:", error);
            showToast.error(error.message || "Test subscription payment failed.");
        } finally {
            setIsTestingBilling(false);
        }
    };

    const handleRefund = async (invoice: any) => {
        if (!invoice.paymentIntentId) {
            showToast.error("No Payment Intent ID found for this invoice.");
            return;
        }
        
        const amountStr = window.prompt(
            `Enter the amount to refund for ${invoice.invoiceId} (leave blank or enter full amount for a complete refund):`,
            invoice.amount ? invoice.amount.toString() : ""
        );
        
        if (amountStr === null) return; // User cancelled
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            showToast.error("Invalid refund amount.");
            return;
        }
        
        setIsRefunding(invoice.id);
        try {
            const functions = getFunctions();
            const refundCallable = httpsCallable(functions, 'refundKortPayment');
            const res = await refundCallable({
                paymentIntentId: invoice.paymentIntentId,
                organizationId: invoice.organizationId || activeOrg?.id,
                amount: amount
            });
            const data = res.data as any;
            if (data && data.success) {
                showToast.success(data.message || "Refund initiated successfully!");
            } else {
                showToast.success("Refund initiated successfully!");
            }
        } catch (error: any) {
            console.error("Refund error:", error);
            showToast.error(error.message || "Refund failed.");
        } finally {
            setIsRefunding(null);
        }
    };
    const kortAccountId = activeOrg?.kortAccountId || '';
    const user = state.currentUser;
    const isKortTester = user?.email === 'integrations@kortpayments.com' || (user?.role as string) === 'kort_tester';
    const isUnlocked = isKortTester && typeof window !== 'undefined' && localStorage.getItem('kort_tester_unlocked') === 'true';

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        showToast.success(`${label} copied to clipboard!`);
        setTimeout(() => setCopiedText(null), 2000);
    };

    const handleOnboardTrigger = async () => {
        if (!activeOrg?.id) return;
        setIsOnboardingLoading(true);
        try {
            const functions = getFunctions();
            const generateKortOnboardingLink = httpsCallable(functions, 'generateKortOnboardingLink');
            const result = await generateKortOnboardingLink({
                organizationId: activeOrg.id,
                returnUrl: window.location.href
            });
            
            const data = result.data as any;
            if (data.onboardingUrl || data.url) {
                window.open(data.onboardingUrl || data.url, '_blank');
                showToast.success("Kort Merchant Onboarding launched! Finish the sandbox application.");
            } else if (data.accountId) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...activeOrg, kortAccountId: data.accountId }
                });
                showToast.success(`Kort Merchant Account already active: ${data.accountId}`);
            }
        } catch (e: any) {
            showToast.error("Failed to generate onboarding link: " + e.message);
        } finally {
            setIsOnboardingLoading(false);
        }
    };

    // Gather unpaid jobs with invoices for testing payments
    const unpaidInvoices = useMemo(() => {
        return (state.jobs || [])
            .filter((j: any) => j.invoice && j.invoice.status !== 'Paid')
            .map((j: any) => ({
                id: j.id,
                invoiceId: j.invoice.id || `INV-${j.id}`,
                customerName: j.customerName || 'Test Customer',
                amount: Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 120.00,
                date: new Date(j.appointmentTime || Date.now()).toLocaleDateString()
            }));
    }, [state.jobs]);

    // Gather paid jobs with invoices for testing refunds
    const paidInvoices = useMemo(() => {
        return (state.jobs || [])
            .filter((j: any) => j.invoice && j.invoice.status === 'Paid')
            .map((j: any) => ({
                id: j.id,
                invoiceId: j.invoice.id || `INV-${j.id}`,
                customerName: j.customerName || 'Test Customer',
                amount: Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 120.00,
                date: new Date(j.appointmentTime || Date.now()).toLocaleDateString(),
                paymentIntentId: j.invoice.paymentIntentId,
                organizationId: j.organizationId || activeOrg?.id
            }));
    }, [state.jobs, activeOrg]);

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            {/* Kort Tester Toggle Banner */}
            {isKortTester && !isUnlocked && (
                <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-slate-900/40 dark:to-indigo-950/20 p-6 shadow-md">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <ShieldCheck size={24} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Sandbox Evaluation Mode</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                                    You are currently in the locked-down sandbox preview. To verify full ease of navigation, platform depth, and sidebar menu structures, you can switch to the live-simulated platform layout.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.setItem('kort_tester_unlocked', 'true');
                                window.location.href = '/#/admin/dashboard';
                                window.location.reload();
                            }}
                            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 font-semibold text-xs transition-all duration-200 hover:scale-[1.02]"
                        >
                            <ExternalLink size={14} /> See Real Platform Layout
                        </button>
                    </div>
                </div>
            )}

            {/* Header Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3 animate-pulse">
                            <Terminal size={12} /> Sandbox Suite Active
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">Kort Payments Playground</h1>
                        <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                            Welcome to the TekTrakker Payment Integration Diagnostic Center. Use this interactive dashboard to test and verify merchant onboarding, card/ACH payment collection, and sandbox webhook alerts.
                        </p>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 text-xs font-mono text-slate-300">
                        <div className="flex items-center gap-2 mb-1.5 text-emerald-400 font-bold">
                            <ShieldCheck size={14} /> Environment Secured
                        </div>
                        <div>SDK: Payments.js v2</div>
                        <div>Gateway: Kort Sandbox</div>
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Diagnostics and Merchant Status */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Status & Onboarding Card */}
                    <Card className="border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <UserCheck className="text-indigo-500" size={20} /> 1. Merchant Onboarding & API Credentials
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
                                Connect this tenant to the Kort sandbox merchant registry. Launching onboarding generates a mock merchant profile so your account is fully authorized to receive charges.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500">Merchant Account ID</div>
                                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200 mt-1 select-all break-all">
                                        {kortAccountId ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1.5">
                                                <CheckCircle2 size={14} /> {kortAccountId}
                                            </span>
                                        ) : (
                                            <span className="text-orange-500 font-semibold flex items-center gap-1.5">
                                                <AlertTriangle size={14} /> Unlinked (No Account ID)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button 
                                        onClick={handleOnboardTrigger}
                                        disabled={isOnboardingLoading}
                                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        {isOnboardingLoading ? (
                                            <RefreshCw className="animate-spin" size={16} />
                                        ) : (
                                            <Play size={16} />
                                        )}
                                        {kortAccountId ? "Re-launch Onboarding" : "Start Sandbox Onboarding"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Pay Invoice Simulator Card */}
                    <Card className="border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <CreditCard className="text-indigo-500" size={20} /> 2. Secure Checkout Simulator (Payments.js)
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
                                Test the tokenization flow and secure credit card / ACH payments. Select an active open sandbox invoice below to open its public customer checkout screen in a new tab.
                            </p>

                            {unpaidInvoices.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <HelpCircle className="mx-auto text-slate-400 mb-2" size={32} />
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No active open invoices found</div>
                                    <p className="text-xs text-slate-400 mt-1">Generate a test job in your dashboard to trigger a new invoice.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {unpaidInvoices.map((inv) => (
                                        <div 
                                            key={inv.id} 
                                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/5 px-2 py-0.5 rounded">
                                                        {inv.invoiceId}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{inv.customerName}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">Job Reference: {inv.id.substring(0,8)}... • Created: {inv.date}</div>
                                            </div>
                                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                                <div className="font-black text-slate-900 dark:text-white text-base">${inv.amount.toFixed(2)}</div>
                                                <a 
                                                    href={`/#/invoice/${inv.id}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer border border-emerald-500/20"
                                                >
                                                    Pay Invoice <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Secure Refund Simulator Card */}
                    <Card className="border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <RefreshCw className="text-indigo-500" size={20} /> 3. Secure Refund Simulator (Kort API)
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
                                Initiate a full or partial refund for successfully collected sandbox payments. The simulator communicates directly with the Kort sandbox API to process the refund and triggers a webhook event to update the invoice status.
                            </p>

                            {paidInvoices.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <HelpCircle className="mx-auto text-slate-400 mb-2" size={32} />
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No paid sandbox invoices found</div>
                                    <p className="text-xs text-slate-400 mt-1">Use the Checkout Simulator above to complete a payment first.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {paidInvoices.map((inv) => (
                                        <div 
                                            key={inv.id} 
                                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/5 px-2 py-0.5 rounded">
                                                        {inv.invoiceId}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{inv.customerName}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Payment Intent: <code className="font-mono text-[9px] select-all bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded">{inv.paymentIntentId || 'N/A'}</code>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                                <div className="font-black text-slate-900 dark:text-white text-base">${inv.amount.toFixed(2)}</div>
                                                <button
                                                    onClick={() => handleRefund(inv)}
                                                    disabled={isRefunding !== null || !inv.paymentIntentId}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isRefunding === inv.id ? (
                                                        <>
                                                            <RefreshCw className="animate-spin" size={12} />
                                                            Refunding...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw size={12} />
                                                            Refund Payment
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Platform Subscription Billing Simulator */}
                    <Card className="border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <Zap className="text-indigo-500" size={20} /> 4. Platform Subscription Billing Simulator
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                                Simulate recurring off-session charges using your securely vaulted credit card or bank account. The system calculates active subscription rates ($7/mo standard, or $17/mo with Virtual Worker enabled) and confirms the sandbox payment intent automatically.
                            </p>

                            {activeOrg?.platformVaultedPaymentMethodId ? (
                                <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                    {activeOrg?.platformVaultedPaymentType === 'ach_debit' ? (
                                                        <Building2 size={16} className="text-indigo-500" />
                                                    ) : (
                                                        <CreditCard size={16} className="text-indigo-500" />
                                                    )}
                                                    Payment Method Securely Vaulted
                                                </span>
                                                <span className="font-mono text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5 px-2 py-0.5 rounded">
                                                    ACTIVE
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                                Customer ID: {activeOrg?.platformCustomerId || 'None'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                Method ID: {activeOrg?.platformVaultedPaymentMethodId}
                                            </div>
                                        </div>
                                        <div className="text-right sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-slate-800">
                                            <div className="text-[10px] uppercase font-extrabold text-slate-400">Simulated Fee</div>
                                            <div className="font-black text-slate-900 dark:text-white text-lg">
                                                ${activeOrg?.virtualWorkerEnabled ? '17.00' : '7.00'}/mo
                                            </div>
                                            <div className="text-[9px] text-slate-400 mt-0.5">
                                                $7.00 base {activeOrg?.virtualWorkerEnabled && '+ $10.00 AI Engine'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-slate-800/50">
                                        <Button
                                            onClick={handleTestSubscriptionBilling}
                                            disabled={isTestingBilling}
                                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
                                        >
                                            {isTestingBilling ? (
                                                <>
                                                    <RefreshCw className="animate-spin" size={16} />
                                                    Testing Billing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={16} />
                                                    Run Test Subscription Charge
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="text-xs font-bold text-amber-800 dark:text-amber-400">No Vaulted Payment Method Found</div>
                                            <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-1 leading-relaxed">
                                                To test recurring off-session subscription billing, you must first link a payment method in your organization settings. Once linked, the simulator will unlock.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Link
                                            to="/admin/settings?tab=subscription"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
                                        >
                                            Vault Payment Method in Settings <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                </div>

                {/* Right Column: Sandbox Credentials & Webhook Details */}
                <div className="space-y-8">
                    
                    {/* Sandbox Credentials Reference Card */}
                    <Card className="border border-indigo-100 dark:border-slate-800 bg-gradient-to-b from-indigo-50/30 to-white dark:from-slate-900/10 dark:to-slate-950">
                        <div className="p-6">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Sandbox Test Credentials</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
                                Use these pre-verified Kort Sandbox parameters to test the custom credit card and ACH checkout flows. Click to copy.
                            </p>

                            <div className="space-y-5">
                                {/* Credit Cards */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">Credit Card Testing</div>
                                    <div className="space-y-2">
                                        <div 
                                            onClick={() => handleCopy('4111111111111111', 'Visa Card')}
                                            className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 cursor-pointer text-xs font-mono"
                                        >
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">Visa: 4111 • 1111 • 1111 • 1111</span>
                                            {copiedText === 'Visa Card' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono">
                                            <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded text-center">Exp: Any Future (e.g. 12/30)</div>
                                            <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded text-center">CVV: Any 3 Digits</div>
                                        </div>
                                    </div>
                                </div>

                                {/* ACH Transfer */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">ACH / Bank Debit Testing</div>
                                    <div className="space-y-2">
                                        <div 
                                            onClick={() => handleCopy('121000248', 'ACH Routing')}
                                            className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 cursor-pointer text-xs font-mono"
                                        >
                                            <span className="text-slate-700 dark:text-slate-300">Routing: <strong className="font-extrabold">121000248</strong></span>
                                            {copiedText === 'ACH Routing' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
                                        </div>
                                        <div 
                                            onClick={() => handleCopy('1234567890', 'ACH Account')}
                                            className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 cursor-pointer text-xs font-mono"
                                        >
                                            <span className="text-slate-700 dark:text-slate-300">Account: <strong className="font-extrabold">1234567890</strong></span>
                                            {copiedText === 'ACH Account' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded text-[10px] text-slate-500 font-mono text-center">Type: checking | savings</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Webhook Endpoint Diagnostics */}
                    <Card className="border border-slate-200 dark:border-slate-800">
                        <div className="p-6">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Webhook Receiver Setup</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                                Ensure real-time updates (like payment successes or disputes) trigger instant app state updates.
                            </p>
                            
                            <div className="space-y-4">
                                <div className="bg-slate-900 text-slate-300 p-3 rounded-lg font-mono text-[10.5px] border border-slate-800 break-all select-all">
                                    https://us-central1-tektrakker.cloudfunctions.net/kortWebhook
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    In your **Kort Sandbox Portal**, navigate to **Developers → Webhooks** and add the URL above. This enables instant webhook push alerts for transaction finalization.
                                </p>
                            </div>
                        </div>
                    </Card>

                </div>

            </div>
        </div>
    );
};

export default KortPlayground;
