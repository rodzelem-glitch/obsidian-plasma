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
    onSuccess?: (paymentId: string) => void;
    onError?: (error: string) => void;
}

export const KortPaymentForm: React.FC<KortPaymentFormProps> = ({ amount, jobId, accountId, organizationId, onSuccess, onError }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentsInstance, setPaymentsInstance] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentForm, setPaymentForm] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach_debit'>('card');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cardholderName, setCardholderName] = useState('');

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
                } else if (paymentMethod === 'ach_debit') {
                    const accountField = formInstance.createField('bankAccount', { styles: commonStyles });
                    const routingField = formInstance.createField('bankRoutingNumber', { styles: commonStyles });
                    accountField.inject('#kort-ach-account');
                    routingField.inject('#kort-ach-routing');
                }

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
        if (!paymentsInstance || !paymentForm) return;

        setIsProcessing(true);
        setError(null);

        try {
            // 1. Get Payment Intent from our backend
            const functions = getFunctions();
            const createIntent = httpsCallable(functions, 'createKortPaymentIntent');
            const intentRes = await createIntent({
                amount: amount,
                currency: 'usd',
                organizationId: organizationId,
                accountId: activeAccountId,
                jobId: jobId,
                paymentMethodType: paymentMethod
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { client_secret } = intentRes.data as any;

            if (!client_secret) {
                throw new Error('Failed to retrieve payment intent from server.');
            }

            // 2. Confirm the payment on the frontend using the client_secret
            const result = await paymentsInstance.confirmPayment(client_secret, {
                payment_method: {
                    form: paymentForm,
                    type: paymentMethod,
                    billing_details: {
                        name: cardholderName || 'Customer Name',
                    }
                }
            });

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
            
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600 dark:text-slate-400">Total Amount</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                        ${amount.toFixed(2)}
                    </span>
                </div>
                
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
                                <label htmlFor="kort-ach-routing" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Routing Number</label>
                                <div 
                                    id="kort-ach-routing" 
                                    className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                />
                            </div>
                            <div>
                                <label htmlFor="kort-ach-account" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Account Number</label>
                                <div 
                                    id="kort-ach-account" 
                                    className="flex flex-col justify-center px-3 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                                />
                            </div>
                        </>
                    )}
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
                disabled={isProcessing || !paymentForm || !!error}
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    `Pay $${amount.toFixed(2)}`
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
