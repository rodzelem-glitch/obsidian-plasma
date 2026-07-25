import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Button from '../ui/Button';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import showToast from '../../lib/toast';

// Use the global Payments object injected by the script in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare var Payments: any;

interface KortSetupFormProps {
    onSuccess?: (paymentMethodId: string) => void;
    onError?: (error: string) => void;
}

export const KortSetupForm: React.FC<KortSetupFormProps> = ({ onSuccess, onError }) => {
    const { state } = useAppContext();
    const organizationId = state.currentOrganization?.id;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentsInstance, setPaymentsInstance] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentForm, setPaymentForm] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach_debit'>('card');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cardholderName, setCardholderName] = useState('');
    const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
    const [achAccountNumber, setAchAccountNumber] = useState('');
    const [achRoutingNumber, setAchRoutingNumber] = useState('');
    
    // Load existing organization address if available
    const orgAddress = state.currentOrganization?.address;
    const [billingStreet, setBillingStreet] = useState(orgAddress?.street || '123 Main St');
    const [billingCity, setBillingCity] = useState(orgAddress?.city || 'Austin');
    const [billingState, setBillingState] = useState(orgAddress?.state || 'TX');
    const [billingZip, setBillingZip] = useState(orgAddress?.zip || '78701');
    const [billingCountry, setBillingCountry] = useState((orgAddress as any)?.country || 'US');

    const isACHEnabled = true; // Enabled since ACH processing is live again

    const publishableKey = import.meta.env.VITE_KORT_PUBLISHABLE_KEY;
    const rawAccountId = state.currentOrganization?.kortAccountId || import.meta.env.VITE_KORT_ACCOUNT_ID;
    const isSandbox = !publishableKey || !publishableKey.startsWith('pk_rYhq');
    const fallbackMerchantId = isSandbox ? 'acct_zDruOrRgOZVtafF9TPC2J' : 'acct_k5kvc1P0G1Rf4HNizIH8I';
    // Fallback to active connected merchant account if the account is the partner account (which has Card/ACH disabled)
    const activeAccountId = (rawAccountId === 'acct_AJdH2w6qvR8UAFn7KxIwc' || rawAccountId === 'acct_gmcBDSjKycUPv7zm5ym5Q') ? fallbackMerchantId : rawAccountId;


    useEffect(() => {
        if (!publishableKey || !activeAccountId) {
            setError('Missing Kort Payments configuration.');
            return;
        }

        let ignore = false;
        let formInstance: any = null;

        const loadPaymentsSdk = (): Promise<any> => {
            return new Promise((resolve, reject) => {
                const globalPayments = (window as any).Payments || (window as any).Tilled;
                if (globalPayments) {
                    (window as any).Payments = globalPayments;
                    resolve(globalPayments);
                    return;
                }

                const existingScript = document.getElementById('tilled-payments-js');
                if (existingScript) {
                    const checkInterval = setInterval(() => {
                        const sdk = (window as any).Payments || (window as any).Tilled;
                        if (sdk) {
                            clearInterval(checkInterval);
                            (window as any).Payments = sdk;
                            resolve(sdk);
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        reject(new Error('Payments SDK failed to load. Please check your network connection.'));
                    }, 10000);
                    return;
                }

                const script = document.createElement('script');
                script.id = 'tilled-payments-js';
                script.src = 'https://js.tilled.com/v2/tilled.js';
                script.async = true;
                script.onload = () => {
                    const sdk = (window as any).Payments || (window as any).Tilled;
                    if (sdk) {
                        (window as any).Payments = sdk;
                        resolve(sdk);
                    } else {
                        reject(new Error('Payments SDK failed to load. Please check your network connection.'));
                    }
                };
                script.onerror = () => {
                    reject(new Error('Payments SDK failed to load. Please check your network connection.'));
                };
                document.head.appendChild(script);
            });
        };

        const initForm = async () => {
            try {
                const PaymentsSDK = await loadPaymentsSdk();
                if (ignore) return;

                // ACH is processed entirely server-side, no SDK form needed
                if (paymentMethod === 'ach_debit') {
                    setPaymentsInstance(null);
                    setPaymentForm(null);
                    return;
                }

                // Initialize Kort Payments SDK for the platform account
                const payments = new PaymentsSDK(publishableKey, activeAccountId, { sandbox: isSandbox });
                setPaymentsInstance(payments);

                // Create the form asynchronously based on selected payment method
                formInstance = await payments.form({ payment_method_type: paymentMethod, pci_compliant: true });
                if (ignore) {
                    formInstance.teardown();
                    return;
                }
                setPaymentForm(formInstance);

                const commonStyles = {
                    base: {
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        color: '#334155', // slate-700
                        fontSize: '16px',
                        '::placeholder': {
                            color: '#94a3b8' // slate-400
                        }
                    },
                    invalid: {
                        color: '#ef4444' // red-500
                    }
                };

                // Clear previous injections to prevent duplicates
                const fields = ['kort-setup-card-number', 'kort-setup-card-expiry', 'kort-setup-card-cvc', 'kort-setup-ach-account', 'kort-setup-ach-routing'];
                fields.forEach(id => {
                    const el = document.querySelector(`#${id}`);
                    if (el) el.innerHTML = '';
                });

                if (paymentMethod === 'card') {
                    const cardNumberField = formInstance.createField('cardNumber', { styles: commonStyles });
                    const cardExpiryField = formInstance.createField('cardExpiry', { styles: commonStyles });
                    const cardCvcField = formInstance.createField('cardCvv', { styles: commonStyles });
                    cardNumberField.inject('#kort-setup-card-number');
                    cardExpiryField.inject('#kort-setup-card-expiry');
                    cardCvcField.inject('#kort-setup-card-cvc');
                } else if (paymentMethod === 'ach_debit') {
                    const accountField = formInstance.createField('bankAccountNumber', { styles: commonStyles });
                    const routingField = formInstance.createField('bankRoutingNumber', { styles: commonStyles });
                    accountField.inject('#kort-setup-ach-account');
                    routingField.inject('#kort-setup-ach-routing');
                }

                await formInstance.build();
            } catch (err: any) {
                console.error('Error initializing Kort Setup Form:', err);
                setError('Failed to initialize payment form.');
            }
        };

        initForm();

        return () => {
            ignore = true;
            if (formInstance) {
                try { formInstance.teardown(); } catch (e) {}
            }
            const fields = ['kort-setup-card-number', 'kort-setup-card-expiry', 'kort-setup-card-cvc', 'kort-setup-ach-account', 'kort-setup-ach-routing'];
            fields.forEach(id => {
                const el = document.querySelector(`#${id}`);
                if (el) el.innerHTML = '';
            });
        };
    }, [publishableKey, activeAccountId, paymentMethod]);

    const handleSavePaymentMethod = async () => {
        if (!organizationId) return;
        if (paymentMethod !== 'ach_debit' && (!paymentsInstance || !paymentForm)) return;

        setIsProcessing(true);
        setError(null);

        try {
            let pmId = '';

            if (paymentMethod === 'ach_debit') {
                if (!achAccountNumber || !achRoutingNumber) {
                    throw new Error('Please enter your bank account and routing numbers.');
                }

                // Call attachKortPaymentMethod passing achDetails and billingDetails for server-side token creation + attachment
                const functions = getFunctions();
                const attachKortPaymentMethodFn = httpsCallable(functions, 'attachKortPaymentMethod');
                const attachRes = await attachKortPaymentMethodFn({
                    organizationId,
                    paymentMethodType: 'ach_debit',
                    billingDetails: {
                        name: cardholderName || 'Customer',
                        street: billingStreet,
                        city: billingCity,
                        state: billingState,
                        zip: billingZip,
                        country: billingCountry
                    },
                    achDetails: {
                        accountType,
                        accountNumber: achAccountNumber,
                        routingNumber: achRoutingNumber
                    }
                });

                const attachData = attachRes.data as any;
                if (!attachData || !attachData.success) {
                    throw new Error('Failed to attach bank account to organization.');
                }
                pmId = attachData.paymentMethodId;
            } else {
                // 1. Build billing details and call paymentsInstance.createPaymentMethod
                const paymentMethodData: any = {
                    form: paymentForm,
                    type: paymentMethod,
                    billing_details: {
                        name: cardholderName || 'Customer Name',
                        address: {
                            street: billingStreet,
                            city: billingCity,
                            state: billingState,
                            zip: billingZip,
                            country: billingCountry
                        }
                    }
                };

                const result = await paymentsInstance.createPaymentMethod(paymentMethodData);

                if (result.error) {
                    throw new Error(result.error.message);
                }

                pmId = result.id;
                if (!pmId) {
                    throw new Error('Failed to generate secure payment method token.');
                }

                // 2. Pass the generated paymentMethod.id to backend attachKortPaymentMethod
                const functions = getFunctions();
                const attachKortPaymentMethodFn = httpsCallable(functions, 'attachKortPaymentMethod');
                const attachRes = await attachKortPaymentMethodFn({
                    organizationId,
                    paymentMethodId: pmId,
                    paymentMethodType: paymentMethod
                });

                const attachData = attachRes.data as any;
                if (!attachData || !attachData.success) {
                    throw new Error('Failed to attach payment method to organization.');
                }
            }

            // 3. Success! The payment method is now vaulted (updated on the server side via the Cloud Function).
            showToast.success('Payment method securely vaulted!');

            if (onSuccess) {
                onSuccess(pmId);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Setup Error:', err);
            let errorMessage = err.message || 'An unknown error occurred during saving.';
            if (errorMessage.includes("Field of type 'cardNumber' is not valid") || errorMessage.includes('is not valid')) {
                errorMessage = 'Please complete all payment fields correctly.';
            }
            setError(errorMessage);
            if (onError) onError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-md font-semibold text-slate-900 dark:text-white">
                    Add Payment Method
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Securely save a card or bank account for platform subscriptions and fees.
                </p>
            </div>
            
            <div className="p-6">
                {isACHEnabled && (
                    <div className="flex gap-2 mb-6">
                        <button 
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                            onClick={() => setPaymentMethod('card')}
                        >
                            Credit Card
                        </button>
                        <button 
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === 'ach_debit' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                            onClick={() => setPaymentMethod('ach_debit')}
                        >
                            Bank Account (ACH)
                        </button>
                    </div>
                )}
                
                <div className="mb-6 space-y-4">
                    <div>
                        <label htmlFor="kort-setup-cardholder-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {paymentMethod === 'card' ? 'Name on Card' : 'Name on Account'}
                        </label>
                        <input
                            id="kort-setup-cardholder-name"
                            type="text"
                            value={cardholderName}
                            onChange={(e) => setCardholderName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {paymentMethod === 'card' && (
                        <>
                            <div>
                                <label htmlFor="kort-setup-card-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Card Number</label>
                                <div 
                                    id="kort-setup-card-number" 
                                    className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="kort-setup-card-expiry" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Expiration</label>
                                    <div 
                                        id="kort-setup-card-expiry" 
                                        className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="kort-setup-card-cvc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">CVC</label>
                                    <div 
                                        id="kort-setup-card-cvc" 
                                        className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                    {paymentMethod === 'ach_debit' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Account Type</label>
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === 'checking' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                        onClick={() => setAccountType('checking')}
                                    >
                                        Checking
                                    </button>
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === 'savings' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                        onClick={() => setAccountType('savings')}
                                    >
                                        Savings
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="kort-setup-ach-routing" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Routing Number</label>
                                <input
                                    id="kort-setup-ach-routing"
                                    type="text"
                                    inputMode="numeric"
                                    value={achRoutingNumber}
                                    onChange={(e) => setAchRoutingNumber(e.target.value.replace(/\D/g, '').substring(0, 9))}
                                    placeholder="021000021"
                                    maxLength={9}
                                    className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="kort-setup-ach-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Account Number</label>
                                <input
                                    id="kort-setup-ach-account"
                                    type="text"
                                    inputMode="numeric"
                                    value={achAccountNumber}
                                    onChange={(e) => setAchAccountNumber(e.target.value.replace(/\D/g, '').substring(0, 17))}
                                    placeholder="Account number"
                                    maxLength={17}
                                    className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                    Billing Address
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="kort-setup-billing-street" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Street Address</label>
                                        <input
                                            id="kort-setup-billing-street"
                                            type="text"
                                            value={billingStreet}
                                            onChange={(e) => setBillingStreet(e.target.value)}
                                            placeholder="123 Main St"
                                            className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="kort-setup-billing-city" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">City</label>
                                            <input
                                                id="kort-setup-billing-city"
                                                type="text"
                                                value={billingCity}
                                                onChange={(e) => setBillingCity(e.target.value)}
                                                placeholder="Austin"
                                                className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="kort-setup-billing-state" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">State</label>
                                            <input
                                                id="kort-setup-billing-state"
                                                type="text"
                                                value={billingState}
                                                onChange={(e) => setBillingState(e.target.value)}
                                                placeholder="TX"
                                                className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="kort-setup-billing-zip" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ZIP / Postal Code</label>
                                            <input
                                                id="kort-setup-billing-zip"
                                                type="text"
                                                value={billingZip}
                                                onChange={(e) => setBillingZip(e.target.value)}
                                                placeholder="78701"
                                                className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="kort-setup-billing-country" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Country Code</label>
                                            <input
                                                id="kort-setup-billing-country"
                                                type="text"
                                                value={billingCountry}
                                                onChange={(e) => setBillingCountry(e.target.value)}
                                                placeholder="US"
                                                className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleSavePaymentMethod} 
                    disabled={isProcessing || (paymentMethod !== 'ach_debit' && !paymentForm) || !!error || !cardholderName}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save Payment Method'
                    )}
                </Button>
                
                <p className="mt-4 text-xs text-center text-slate-500 flex items-center justify-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Stored securely with Tilled Vault
                </p>
            </div>
        </div>
    );
};


