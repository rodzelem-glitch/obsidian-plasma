import showToast from "lib/toast";
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { AlertCircle, PauseCircle, Tag, XCircle, Gift, CheckCircle2 } from 'lucide-react';
import { db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { Capacitor } from '@capacitor/core';

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type CancelStep = 'initial' | 'feedback' | 'retention' | 'confirm' | 'success_canceled' | 'success_retained';

const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({ isOpen, onClose }) => {
    const { state, dispatch } = useAppContext();
    const [step, setStep] = useState<CancelStep>('initial');
    const [feedbackReason, setFeedbackReason] = useState<string>('');
    const [additionalFeedback, setAdditionalFeedback] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset state when opened
    React.useEffect(() => {
        if (isOpen) {
            setStep('initial');
            setFeedbackReason('');
            setAdditionalFeedback('');
            setIsProcessing(false);
        }
    }, [isOpen]);

    const handleApplyRetention = async (type: 'pause' | 'discount') => {
        if (!state.currentOrganization) return;
        setIsProcessing(true);
        try {
            const orgRef = db.collection('organizations').doc(state.currentOrganization.id);
            
            if (type === 'discount') {
                // Apply a 50% discount modifier for 3 months
                const currentPct = state.currentOrganization.customDiscountPct || 0;
                const newPct = Math.max(currentPct, 50); // Ensure they get at least 50%
                await orgRef.update({ 
                    customDiscountPct: newPct,
                    subscriptionStatus: 'active',
                    retentionOfferApplied: new Date().toISOString()
                });
                dispatch({ 
                    type: 'UPDATE_ORGANIZATION', 
                    payload: { ...state.currentOrganization, customDiscountPct: newPct, subscriptionStatus: 'active' } 
                });
            } else if (type === 'pause') {
                await orgRef.update({ 
                    subscriptionStatus: 'paused',
                    retentionOfferApplied: new Date().toISOString()
                });
                dispatch({ 
                    type: 'UPDATE_ORGANIZATION', 
                    payload: { ...state.currentOrganization, subscriptionStatus: 'paused' } 
                });
            }
            setStep('success_retained');
        } catch (error) {
            showToast.warn('Failed to process. Please contact support.');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinalCancel = async () => {
        if (!state.currentOrganization) return;
        setIsProcessing(true);
        try {
            // App Store Compliance: If on iOS, we MUST direct the user to Apple Subscriptions
            // because Apple does not allow third-party APIs to physically cancel auto-renewing App Store subs.
            if (Capacitor.getPlatform() === 'ios') {
                 window.open('https://apps.apple.com/account/subscriptions', '_blank');
                 setStep('success_canceled');
                 return;
            }

            await db.collection('organizations').doc(state.currentOrganization.id).update({
                subscriptionStatus: 'cancelled',
                cancellationReason: feedbackReason,
                cancellationFeedback: additionalFeedback,
                canceledAt: new Date().toISOString()
            });
            dispatch({ 
                type: 'UPDATE_ORGANIZATION', 
                payload: { ...state.currentOrganization, subscriptionStatus: 'cancelled' } 
            });
            setStep('success_canceled');
        } catch (error) {
            showToast.warn('Failed to process cancellation. Please try again.');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFeedbackSubmit = () => {
        if (!feedbackReason) return;
        setStep('retention');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Subscription">
            <div className="min-h-[300px] flex flex-col pt-2">
                
                {step === 'initial' && (
                    <div className="space-y-6 flex-1 animate-fade-in">
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800 flex gap-3">
                            <AlertCircle className="shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold">Thinking of leaving?</h4>
                                <p className="text-sm mt-1">
                                    Canceling your subscription will schedule your account for deactivation at the end of your current billing cycle. You will lose access to all your data.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={onClose}>Keep My Subscription</Button>
                            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setStep('feedback')}>Proceed to Cancel</Button>
                        </div>
                    </div>
                )}

                {step === 'feedback' && (
                    <div className="space-y-4 flex-1 animate-fade-in">
                        <h4 className="font-bold text-slate-900 dark:text-white">We're sorry to see you go. How can we improve?</h4>
                        <p className="text-sm text-slate-500">Please let us know why you are considering canceling so we can serve you better.</p>
                        
                        <div className="space-y-2 mt-4">
                            {[
                                'Too expensive',
                                'Missing necessary features',
                                'Hard to use / confusing',
                                'Need a temporary pause',
                                'Switching to a competitor',
                                'My business is closing',
                                'Other'
                            ].map(reason => (
                                <label key={reason} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${feedbackReason === reason ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <input 
                                        type="radio" 
                                        name="cancelReason" 
                                        value={reason}
                                        checked={feedbackReason === reason}
                                        onChange={(e) => setFeedbackReason(e.target.value)}
                                        className="text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium">{reason}</span>
                                </label>
                            ))}
                        </div>

                        {feedbackReason === 'Other' || feedbackReason === 'Missing necessary features' ? (
                            <textarea 
                                className="w-full p-3 border rounded-lg text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
                                placeholder="Please elaborate (optional)"
                                rows={3}
                                value={additionalFeedback}
                                onChange={(e) => setAdditionalFeedback(e.target.value)}
                            />
                        ) : null}

                        <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                            <Button variant="secondary" onClick={() => setStep('initial')}>Back</Button>
                            <Button disabled={!feedbackReason} onClick={handleFeedbackSubmit}>Continue</Button>
                        </div>
                    </div>
                )}

                {step === 'retention' && (
                    <div className="space-y-6 flex-1 animate-fade-in">
                        <h4 className="font-bold text-xl text-slate-900 dark:text-white">Wait! Before you leave...</h4>
                        
                        {(feedbackReason === 'Too expensive' || feedbackReason === 'Switching to a competitor' || feedbackReason === 'Hard to use / confusing') && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 mb-2">
                                    <Gift size={24} />
                                    <h5 className="font-black text-lg">Special Offer: 50% Off</h5>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                                    We know times can be tough. We want to support your business. Extend your subscription today and get <strong className="font-black text-emerald-600 dark:text-emerald-400">50% off for the next 3 months</strong>.
                                </p>
                                <Button 
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12"
                                    onClick={() => handleApplyRetention('discount')}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? 'Applying Offer...' : 'Claim 50% Off & Stay'}
                                </Button>
                            </div>
                        )}

                        {(feedbackReason === 'Need a temporary pause' || feedbackReason === 'Other' || feedbackReason === 'My business is closing' || feedbackReason === 'Missing necessary features') && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400 mb-2">
                                    <PauseCircle size={24} />
                                    <h5 className="font-black text-lg">Pause Account Instead</h5>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                                    Don't lose your configurations, customers, and history. We can securely pause your account right now. You won't be billed, and you can reactive anytime within 3 months.
                                </p>
                                <Button 
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"
                                    onClick={() => handleApplyRetention('pause')}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? 'Pausing Account...' : 'Pause Account Instead'}
                                </Button>
                            </div>
                        )}

                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={() => setStep('confirm')} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold underline transition-colors"
                            >
                                No thanks, I still want to cancel.
                            </button>
                        </div>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-6 flex-1 animate-fade-in flex flex-col justify-center items-center text-center">
                        <XCircle size={64} className="text-red-500 mb-2" />
                        <div>
                            <h4 className="font-black text-2xl text-slate-900 dark:text-white">Confirm Cancellation</h4>
                            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                                This action is permanent. Your subscription will not renew, and access to the platform will be revoked at the end of your billing cycle.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
                            <Button className="flex-1" variant="secondary" onClick={onClose} disabled={isProcessing}>
                                Nevermind, Keep Account
                            </Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleFinalCancel} disabled={isProcessing}>
                                {isProcessing ? 'Processing...' : 'Confirm Cancellation'}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'success_retained' && (
                    <div className="space-y-4 flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-8">
                        <CheckCircle2 size={64} className="text-emerald-500 mb-2 animate-bounce flex-shrink-0" />
                        <h4 className="font-black text-2xl text-slate-900 dark:text-white">Offer Applied!</h4>
                        <p className="text-slate-500">Your account has been successfully updated. We're so glad you're staying with us!</p>
                        <Button className="mt-4 w-full sm:w-auto" onClick={onClose}>Return to Settings</Button>
                    </div>
                )}

                {step === 'success_canceled' && (
                    <div className="space-y-4 flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-8">
                        <CheckCircle2 size={64} className="text-slate-400 mb-2 flex-shrink-0" />
                        <h4 className="font-black text-2xl text-slate-900 dark:text-white">Subscription Canceled</h4>
                        <p className="text-slate-500">Your subscription has been canceled. You'll retain access until the end of your billing cycle.</p>
                        <Button className="mt-4 w-full sm:w-auto" onClick={onClose}>Close</Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CancelSubscriptionModal;

