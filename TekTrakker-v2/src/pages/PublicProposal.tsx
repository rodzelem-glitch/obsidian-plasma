import showToast from "lib/toast";
import React, { useEffect, useState, useRef } from 'react';
import { Shield } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import type { Proposal, Organization } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';

const PublicProposal: React.FC = () => {
    const { proposalId } = useParams<{ proposalId: string }>();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [hasDeclinedTerms, setHasDeclinedTerms] = useState(false);

    useEffect(() => {
        const fetchProposal = async () => {
            if (!proposalId) { setError("Invalid Link"); setLoading(false); return; }
            try {
                if (!auth.currentUser) { try { await auth.signInAnonymously(); } catch (e) { console.error(e); } }

                const doc = await db.collection('proposals').doc(proposalId).get();
                if (!doc.exists) throw new Error("Proposal not found.");
                
                const data = { ...doc.data(), id: doc.id } as Proposal;
                setProposal(data);
                if (data.selectedOption) setSelectedOption(data.selectedOption);

                if (data.organizationId) {
                    const orgDoc = await db.collection('organizations').doc(data.organizationId).get();
                    if (orgDoc.exists) setOrganization({ ...orgDoc.data(), id: orgDoc.id } as Organization);
                }
                setLoading(false);
            } catch (e: any) {
                setError(e.message);
                setLoading(false);
            }
        };
        fetchProposal();
    }, [proposalId]);

    const calculateTierTotal = (tier: string) => {
        if (!proposal) return { subtotal: 0, taxAmount: 0, total: 0, items: [] };
        const tierItems = (proposal.items || []).filter((i: any) => i.tier === tier);
        const subtotal = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const taxableAmount = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const taxRate = organization?.taxRate || 8.25;
        const taxAmount = taxableAmount * (taxRate / 100);
        return { subtotal, taxAmount, total: subtotal + taxAmount, items: tierItems };
    };

    const availableTiers = ['Good', 'Better', 'Best'].filter(t => calculateTierTotal(t).items.length > 0);

    const handleAcceptProposal = async () => {
        if (!proposal || !sigPadRef.current || sigPadRef.current.isEmpty()) {
            showToast.warn("Please sign to accept.");
            return;
        }
        setIsSubmitting(true);
        const signatureDataUrl = sigPadRef.current.toDataURL();
        try {
            const finalTier = selectedOption || (availableTiers[0] || 'Good');
            const { subtotal, taxAmount, total } = calculateTierTotal(finalTier);

            await db.collection('proposals').doc(proposal.id).update({
                status: 'Accepted',
                signatureDataUrl,
                selectedOption: finalTier,
                subtotal,
                taxAmount,
                total,
            });

            // --- NOTIFY FIELD TECHNICIAN IMMEDIATELY ---
            const recipientId = proposal.technicianId || proposal.createdById;
            const notificationContent = `🎉 ${proposal.customerName || 'Your customer'} just signed and accepted the "${finalTier}" option of Proposal ${proposal.id} for $${total.toFixed(2)}!`;

            try {
                const { sendNotification, notifyAdmins } = await import('lib/notificationService');
                
                // Notify the technician via Push Notification
                if (recipientId) {
                    await sendNotification(recipientId, {
                        title: 'Proposal Accepted!',
                        body: notificationContent,
                        type: 'proposal_accepted'
                    }, proposal.organizationId || organization?.id);
                }
                
                // Notify Admins via Push Notification
                if (proposal.organizationId || organization?.id) {
                    await notifyAdmins(proposal.organizationId || organization?.id || '', {
                        title: 'Proposal Accepted!',
                        body: notificationContent,
                        type: 'proposal_accepted'
                    });
                }
                
                // Keep the old messages alert system for fallback
                if (recipientId) {
                    await db.collection('messages').add({
                        organizationId: proposal.organizationId || organization?.id || 'unknown',
                        senderId: 'system',
                        senderName: 'System Alerts',
                        receiverId: recipientId,
                        content: notificationContent,
                        type: 'alert',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetUrl: `/briefing/proposal?proposalId=${proposal.id}` 
                    });
                }
            } catch(e) { console.error('Failed to notify tech', e); }

            setProposal({ ...proposal, status: 'Accepted', selectedOption: finalTier, signatureDataUrl, subtotal, taxAmount, total });
            setIsSigningOpen(false);
        } catch (e: any) {
            showToast.warn('Failed to accept: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 md:p-10 text-center">Loading Proposal...</div>;
    if (error) return <div className="p-4 md:p-10 text-center text-red-500">{error}</div>;
    if (!proposal) return null;

    const previewProposal = { ...proposal, selectedOption: selectedOption || proposal.selectedOption };
    const needsTierSelection = proposal?.status !== 'Accepted' && !selectedOption && availableTiers.length > 1;

    const showProposalTermsOverlay = organization?.proposalTerms && !proposal.proposalTermsAgreed;

    const handleAgreeProposalTerms = async () => {
        try {
            const now = new Date().toISOString();
            try {
                await db.collection('proposals').doc(proposal.id).update({
                    proposalTermsAgreed: true,
                    proposalTermsAgreedAt: now
                });
            } catch (dbError: any) {
                console.warn("Firestore proposal terms update failed, falling back to local-only updates:", dbError);
            }
            setProposal({
                ...proposal,
                proposalTermsAgreed: true,
                proposalTermsAgreedAt: now
            });
            showToast.success("Terms accepted. You can now view the proposal.");
        } catch (e: any) {
            showToast.warn("Failed to accept terms: " + e.message);
        }
    };

    if (hasDeclinedTerms) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 text-center animate-fade-in">
                    <div className="flex justify-center text-rose-500 dark:text-rose-400 mb-4">
                        <Shield className="w-16 h-16 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Declined</h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                        You have declined the Terms of Agreement. In order to view this proposal details, authorize package options, or accept this estimate, you must review and agree to the terms from <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button 
                            onClick={() => setHasDeclinedTerms(false)}
                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none w-full"
                        >
                            Review Terms Again
                        </Button>
                        <Button 
                            variant="secondary"
                            onClick={() => window.close()}
                            className="h-12 rounded-xl w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                        >
                            Close Tab
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showProposalTermsOverlay) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-100 dark:border-slate-700 animate-fade-in text-left">
                    <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400">
                        <Shield size={32} />
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Proposal Terms of Agreement</h2>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                        Please review and accept the following terms of agreement before proceeding to view the proposal details from <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-60 mb-6 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans">
                        {organization?.proposalTerms}
                    </div>
                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                        <Button 
                            variant="secondary"
                            onClick={() => setHasDeclinedTerms(true)}
                            className="h-12 px-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                        >
                            Decline
                        </Button>
                        <Button 
                            onClick={handleAgreeProposalTerms}
                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            Accept & View Proposal
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            <DocumentPreview 
                type="Proposal" 
                data={previewProposal} 
                onClose={() => {}} 
                isInternal={false} 
                organization={organization}
                onSelectTier={proposal.status !== 'Accepted' ? setSelectedOption : undefined}
            />
            
            {proposal.status !== 'Accepted' && !needsTierSelection && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center gap-4 z-50 shadow-lg animate-fade-in-up">
                    {availableTiers.length > 1 && (
                        <Button variant="secondary" onClick={() => setSelectedOption(null)} className="h-12 px-6 font-bold">
                            &larr; Change Package
                        </Button>
                    )}
                    <Button onClick={() => setIsSigningOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 font-black h-12 px-4 md:px-8 text-lg shadow-xl">
                        Accept "{selectedOption || availableTiers[0]}" Proposal
                    </Button>
                </div>
            )}

            {!isSigningOpen && proposal.status === 'Accepted' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-emerald-50 border-t border-emerald-200 flex flex-col items-center justify-center gap-2 z-50">
                    <span className="text-emerald-700 font-black tracking-tight text-lg">Proposal Accepted</span>
                    <span className="text-emerald-600 text-xs">Thank you for your business!</span>
                </div>
            )}

            {isSigningOpen && (
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title="Accept Proposal">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            By signing below, I agree to the pricing and terms outlined in the "{selectedOption || availableTiers[0]}" option of this proposal from {organization?.name || 'Service Provider'}.
                        </p>
                        <SignaturePad ref={sigPadRef} className="h-40" />
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button variant="secondary" onClick={() => setIsSigningOpen(false)}>Cancel</Button>
                            <Button onClick={handleAcceptProposal} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 font-black">
                                {isSubmitting ? 'Processing...' : 'Sign & Complete'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PublicProposal;
