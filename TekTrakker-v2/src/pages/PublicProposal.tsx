import showToast from "lib/toast";
import React, { useEffect, useState, useRef } from 'react';
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
            if (recipientId) {
                try {
                    await db.collection('messages').add({
                        organizationId: proposal.organizationId || organization?.id || 'unknown',
                        senderId: 'system',
                        senderName: 'System Alerts',
                        receiverId: recipientId,
                        content: `🎉 ${proposal.customerName || 'Your customer'} just signed and accepted the "${finalTier}" option of Proposal ${proposal.id} for $${total.toFixed(2)}!`,
                        type: 'alert',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetUrl: `/briefing/proposal?proposalId=${proposal.id}` 
                    });
                } catch(e) { console.error('Failed to notify tech', e); }
            }

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
