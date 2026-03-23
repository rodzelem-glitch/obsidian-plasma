
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

    useEffect(() => {
        const fetchProposal = async () => {
            if (!proposalId) { setError("Invalid Link"); setLoading(false); return; }
            try {
                if (!auth.currentUser) { try { await auth.signInAnonymously(); } catch (e) {} }

                const doc = await db.collection('proposals').doc(proposalId).get();
                if (!doc.exists) throw new Error("Proposal not found.");
                
                const data = { ...doc.data(), id: doc.id } as Proposal;
                setProposal(data);

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

    const handleAcceptProposal = async () => {
        if (!proposal || !sigPadRef.current || sigPadRef.current.isEmpty()) {
            alert("Please sign to accept.");
            return;
        }
        setIsSubmitting(true);
        const signatureDataUrl = sigPadRef.current.toDataURL();
        try {
            await db.collection('proposals').doc(proposal.id).update({
                status: 'Accepted',
                signatureDataUrl
            });
            setProposal({ ...proposal, status: 'Accepted', signatureDataUrl });
            setIsSigningOpen(false);
            alert("Proposal Accepted! We have been notified.");
        } catch (e) {
            console.error(e);
            alert("Failed to accept. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 md:p-10 text-center">Loading Proposal...</div>;
    if (error) return <div className="p-4 md:p-10 text-center text-red-500">{error}</div>;
    if (!proposal) return null;

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            <DocumentPreview 
                type="Proposal" 
                data={proposal} 
                onClose={() => {}} 
                isInternal={false} 
                organization={organization}
            />
            
            {proposal.status === 'Sent' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50 shadow-lg">
                    <Button onClick={() => setIsSigningOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 font-black h-12 px-4 md:px-8 text-lg shadow-xl">
                        Review & Accept Proposal
                    </Button>
                </div>
            )}

            {isSigningOpen && (
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title="Accept Proposal">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            By signing below, I agree to the pricing and terms outlined in this proposal from {organization?.name || 'Service Provider'}.
                        </p>
                        <SignaturePad ref={sigPadRef} className="h-40" />
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setIsSigningOpen(false)}>Cancel</Button>
                            <Button onClick={handleAcceptProposal} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                                {isSubmitting ? 'Processing...' : 'Sign & Confirm'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PublicProposal;
