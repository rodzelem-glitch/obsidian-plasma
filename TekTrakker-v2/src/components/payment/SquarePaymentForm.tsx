import React, { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import { Loader2, CreditCard, ShieldCheck } from 'lucide-react';

interface SquarePaymentFormProps {
    applicationId: string;
    locationId: string;
    amount: number;
    onSuccess: (paymentId: string) => void;
    onError: (error: string) => void;
    customerEmail?: string;
    jobId?: string;
    organizationId: string;
}

const SquarePaymentForm: React.FC<SquarePaymentFormProps> = ({ 
    applicationId, 
    locationId, 
    amount, 
    onSuccess, 
    onError,
    customerEmail,
    jobId,
    organizationId
}) => {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const cardRef = useRef<any>(null);
    const paymentsRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;

        const initSquare = async () => {
            if (!(window as any).Square) {
                // Wait for script to load if not already
                let attempts = 0;
                while (!(window as any).Square && attempts < 20) {
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
            }

            if (!(window as any).Square) {
                if (isMounted) onError("Square SDK failed to load. Please check your internet connection.");
                return;
            }

            try {
                const payments = (window as any).Square.payments(applicationId, locationId);
                paymentsRef.current = payments;
                
                // Clear container before re-attaching (prevents duplicates in dev)
                const container = document.getElementById('card-container');
                if (container) container.innerHTML = '';

                const card = await payments.card();
                await card.attach('#card-container');
                cardRef.current = card;
                if (isMounted) setLoading(false);
            } catch (e: any) {
                console.error("Square Init Error", e);
                if (isMounted) onError("Failed to initialize payment form. Please refresh.");
            }
        };

        initSquare();

        return () => {
            isMounted = false;
            if (cardRef.current) {
                cardRef.current.destroy();
            }
        };
    }, [applicationId, locationId]);

    const handlePayment = async () => {
        if (!cardRef.current || processing) return;

        setProcessing(true);
        try {
            const result = await cardRef.current.tokenize();
            if (result.status === 'OK') {
                const token = result.token;
                
                // Call our cloud function
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const processPayment = httpsCallable(functions, 'processSquarePayment');
                
                const response: any = await processPayment({
                    sourceId: token,
                    amount,
                    organizationId,
                    jobId,
                    customerEmail,
                    currency: 'USD'
                });

                if (response.data.success) {
                    onSuccess(response.data.paymentId);
                } else {
                    onError(response.data.error || "Payment failed");
                }
            } else {
                const errorMsg = result.errors && result.errors[0] ? result.errors[0].message : "Tokenization failed";
                onError(errorMsg);
            }
        } catch (e: any) {
            console.error("Payment submission error", e);
            onError(e.message || "An error occurred during payment processing.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <div id="card-container" className="min-h-[100px] p-4 border-2 border-slate-100 rounded-2xl bg-white shadow-inner focus-within:border-primary-500 transition-colors">
                    {/* Square SDK will inject the iframe here */}
                </div>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl z-10">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-primary-600" size={24} />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Securing connection...</span>
                        </div>
                    </div>
                )}
            </div>
            
            <Button 
                onClick={handlePayment} 
                disabled={loading || processing}
                className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-xl shadow-slate-200 text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
                {processing ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                {processing ? 'Processing...' : `Confirm Payment • $${amount.toFixed(2)}`}
            </Button>
            
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <ShieldCheck size={12} className="text-emerald-500" />
                PCI DSS Compliant • Encrypted Transaction
            </div>
        </div>
    );
};

export default SquarePaymentForm;
