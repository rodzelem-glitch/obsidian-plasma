import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Button from '../ui/Button';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

// Use the global Payments object injected by the script in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare var Payments: any;

interface KortPaymentFormProps {
    amount: number; // in dollars
    jobId: string;
    accountId?: string;
    organizationId?: string;
    organization?: any;
    onSuccess?: (paymentId: string) => void;
    onError?: (error: string) => void;
}

export const KortPaymentForm: React.FC<KortPaymentFormProps> = ({ amount, jobId, accountId, organizationId, organization, onSuccess, onError }) => {
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
    const [billingStreet, setBillingStreet] = useState('123 Main St');
    const [billingCity, setBillingCity] = useState('Austin');
    const [billingState, setBillingState] = useState('TX');
    const [billingZip, setBillingZip] = useState('78701');
    const [billingCountry, setBillingCountry] = useState('US');

    // Calculate fee dynamically
    const cardEnabled = organization?.cardProcessingFeeEnabled || false;
    const cardPercent = organization?.cardProcessingFeePercent || 0;
    const cardFlat = organization?.cardProcessingFeeFlat || 0;
    const achEnabled = organization?.achProcessingFeeEnabled || false;
    const achPercent = organization?.achProcessingFeePercent || 0;
    const achFlat = organization?.achProcessingFeeFlat || 0;

    let fee = 0;
    if (paymentMethod === 'card' && cardEnabled) {
        fee = (amount * cardPercent / 100) + cardFlat;
    } else if (paymentMethod === 'ach_debit' && achEnabled) {
        fee = (amount * achPercent / 100) + achFlat;
    }
    fee = Math.round(fee * 100) / 100;
    const totalAmount = amount + fee;

    const publishableKey = import.meta.env.VITE_KORT_PUBLISHABLE_KEY;
    const activeAccountId = accountId || import.meta.env.VITE_KORT_ACCOUNT_ID;

    useEffect(() => {
        if (!publishableKey || !activeAccountId) {
            setError('Missing Kort Payments configuration.');
            return;
        }

        if (typeof Payments === 'undefined') {
            setError('Payments SDK failed to load. Please check your network connection.');
            return;
        }

        let ignore = false;
        let formInstance: any = null;
        let cardNumberField: any;
        let cardExpiryField: any;
        let cardCvcField: any;

        const initForm = async () => {
            try {
                // Initialize Kort Payments SDK
                const payments = new Payments(publishableKey, activeAccountId, { sandbox: true });
                setPaymentsInstance(payments);


                // ACH is processed entirely server-side, no SDK form needed
                if (paymentMethod === 'ach_debit') {
                    setPaymentForm(null);
                    return;
                }
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
                const numberContainer = document.querySelector('#kort-card-number');
                const expiryContainer = document.querySelector('#kort-card-expiry');
                const cvcContainer = document.querySelector('#kort-card-cvc');
                const accountContainer = document.querySelector('#kort-ach-account');
                const routingContainer = document.querySelector('#kort-ach-routing');
                if (numberContainer) numberContainer.innerHTML = '';
                if (expiryContainer) expiryContainer.innerHTML = '';
                if (cvcContainer) cvcContainer.innerHTML = '';
                if (accountContainer) accountContainer.innerHTML = '';
                if (routingContainer) routingContainer.innerHTML = '';

                if (paymentMethod === 'card') {
                    // Create fields
                    cardNumberField = formInstance.createField('cardNumber', { styles: commonStyles });
                    cardExpiryField = formInstance.createField('cardExpiry', { styles: commonStyles });
                    cardCvcField = formInstance.createField('cardCvv', { styles: commonStyles });
                    // Inject fields
                    cardNumberField.inject('#kort-card-number');
                    cardExpiryField.inject('#kort-card-expiry');
                    cardCvcField.inject('#kort-card-cvc');
                }
                // ACH fields are now regular HTML inputs (processed server-side), no SDK iframes needed

                // Build the form
                await formInstance.build();
            } catch (err: any) {
                console.error('Error initializing Kort Payments:', err);
                setError('Failed to initialize payment form.');
            }
        };

        initForm();

        // Clean up the fields when unmounted
        return () => {
            ignore = true;
            if (formInstance) {
                try { formInstance.teardown(); } catch (e) {}
            }
            // Ensure iframes are completely removed to prevent duplicates in React Strict Mode
            const numberContainer = document.querySelector('#kort-card-number');
            const expiryContainer = document.querySelector('#kort-card-expiry');
            const cvcContainer = document.querySelector('#kort-card-cvc');
            const accountContainer = document.querySelector('#kort-ach-account');
            const routingContainer = document.querySelector('#kort-ach-routing');
            if (numberContainer) numberContainer.innerHTML = '';
            if (expiryContainer) expiryContainer.innerHTML = '';
            if (cvcContainer) cvcContainer.innerHTML = '';
            if (accountContainer) accountContainer.innerHTML = '';
            if (routingContainer) routingContainer.innerHTML = '';
        };
    }, [publishableKey, activeAccountId, paymentMethod]);

    const handlePayment = async () => {
        if (!paymentsInstance || (!paymentForm && paymentMethod !== 'ach_debit')) return;

        setIsProcessing(true);
        setError(null);

        try {
            // 1. Get Payment Intent from our backend
            const functions = getFunctions();
            const createIntent = httpsCallable(functions, 'createKortPaymentIntent');
            const intentRes = await createIntent({
                amount: totalAmount,
                currency: 'usd',
                organizationId: organizationId,
                accountId: activeAccountId,
                jobId: jobId,
                paymentMethodType: paymentMethod,
                metadata: {
                    originalAmount: amount,
                    processingFee: fee
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { client_secret } = intentRes.data as any;

            if (!client_secret) {
                throw new Error('Failed to retrieve payment intent from server.');
            }

            // 2. Confirm the payment on the frontend using the client_secret
            const paymentMethodData: any = {
                form: paymentForm,
                type: paymentMethod,
                billing_details: {
                    name: cardholderName || 'Customer Name',
                    address: {
                        line1: billingStreet,
                        street: billingStreet,
                        city: billingCity,
                        state: billingState,
                        postal_code: billingZip,
                        zip: billingZip,
                        country: billingCountry
                    }
                }
            };

            // For ACH, process entirely server-side to avoid SDK iframe address mapping issues
            if (paymentMethod === 'ach_debit') {
                if (!achAccountNumber || !achRoutingNumber) {
                    throw new Error('Please enter your bank account and routing numbers.');
                }
                console.log('[KortPayment] Processing ACH payment server-side');
                const confirmACHFn = httpsCallable(functions, 'confirmKortACHPayment');
                const achResult = await confirmACHFn({
                    clientSecret: client_secret,
                    accountId: activeAccountId,
                    organizationId,
                    billingDetails: {
                        name: cardholderName || 'Customer',
                        street: billingStreet,
                        city: billingCity,
                        state: billingState,
                        zip: billingZip,
                        country: billingCountry,
                    },
                    achDetails: {
                        accountType,
                        accountNumber: achAccountNumber,
                        routingNumber: achRoutingNumber,
                    }
                });
                const achData = achResult.data as any;
                if (achData.success) {
                    if (onSuccess) onSuccess(achData.id || 'ach_payment');
                    return;
                } else {
                    throw new Error('ACH payment failed.');
                }
            }

            console.log('[KortPayment] Confirming payment with:', JSON.stringify({ type: paymentMethodData.type, billing_details: paymentMethodData.billing_details }, null, 2));
            const result = await paymentsInstance.confirmPayment(client_secret, { payment_method: paymentMethodData });

            if (result.error) {
                // Display error.message to the customer
                throw new Error(result.error.message);
            }

            // 3. Success!
            if (onSuccess) {
                const intentId = result.paymentIntent?.id || result.payment_intent?.id || result.id || 'unknown_intent';
                if (!result.paymentIntent && !result.payment_intent && !result.id) {
                    console.log('Tilled successful result payload:', result);
                }
                onSuccess(intentId);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Payment Error:', err);
            let errorMessage = err.message || 'An unknown error occurred during payment.';
            if (errorMessage.includes("Field of type 'cardNumber'' is not valid") || errorMessage.includes('is not valid')) {
                errorMessage = 'Please complete all payment fields correctly.';
            }
            setError(errorMessage);
            if (onError) onError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Secure Checkout
            </h3>
            
            <div className="mb-6 border-b border-slate-100 dark:border-slate-700/50 pb-4">
                <div className="flex justify-between items-center text-sm mb-2 text-slate-500">
                    <span>Subtotal</span>
                    <span>${amount.toFixed(2)}</span>
                </div>
                {fee > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2 text-slate-500">
                        <span>Processing Fee</span>
                        <span>${fee.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-800 dark:text-slate-200 font-medium">Total Charged</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                        ${totalAmount.toFixed(2)}
                    </span>
                </div>
                
                <div className="flex gap-2 mb-6">
                    <button 
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        onClick={() => { setPaymentMethod('card'); setError(null); }}
                    >
                        Credit Card
                    </button>
                    <button 
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === 'ach_debit' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        onClick={() => { setPaymentMethod('ach_debit'); setError(null); }}
                    >
                        Bank Transfer (ACH)
                    </button>
                </div>
                
                <div className="mb-6 space-y-4">
                    <div>
                        <label htmlFor="kort-cardholder-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {paymentMethod === 'card' ? 'Cardholder Name' : 'Account Holder Name'}
                        </label>
                        <input
                            id="kort-cardholder-name"
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
                                <label htmlFor="kort-card-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Card Number</label>
                                <div 
                                    id="kort-card-number" 
                                    className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="kort-card-expiry" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Expiration</label>
                                    <div 
                                        id="kort-card-expiry" 
                                        className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="kort-card-cvc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">CVC</label>
                                    <div 
                                        id="kort-card-cvc" 
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
                                <label htmlFor="kort-ach-routing" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Routing Number</label>
                                <input
                                    id="kort-ach-routing"
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
                                <label htmlFor="kort-ach-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Account Number</label>
                                <input
                                    id="kort-ach-account"
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
                        </>
                    )}

                    {/* Shared Billing Address (Visible for both Card and ACH) */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                            Billing Address
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="kort-billing-street" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Street Address</label>
                                <input
                                    id="kort-billing-street"
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
                                    <label htmlFor="kort-billing-city" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">City</label>
                                    <input
                                        id="kort-billing-city"
                                        type="text"
                                        value={billingCity}
                                        onChange={(e) => setBillingCity(e.target.value)}
                                        placeholder="Austin"
                                        className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="kort-billing-state" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">State</label>
                                    <input
                                        id="kort-billing-state"
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
                                    <label htmlFor="kort-billing-zip" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ZIP / Postal Code</label>
                                    <input
                                        id="kort-billing-zip"
                                        type="text"
                                        value={billingZip}
                                        onChange={(e) => setBillingZip(e.target.value)}
                                        placeholder="78701"
                                        className="w-full px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="kort-billing-country" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Country Code</label>
                                    <input
                                        id="kort-billing-country"
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
                </div>
            </div>
            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                    {error}
                </div>
            )}

            <Button 
                className="w-full" 
                size="lg" 
                onClick={handlePayment} 
                disabled={isProcessing || (!paymentForm && paymentMethod !== 'ach_debit') || !!error}
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    `Pay ${totalAmount.toFixed(2)}`
                )}
            </Button>
            
            <p className="mt-4 text-xs text-center text-slate-500 flex items-center justify-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Payments are secure and encrypted
            </p>
        </div>
    );
};
