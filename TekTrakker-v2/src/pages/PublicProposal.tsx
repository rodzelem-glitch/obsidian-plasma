import showToast from "lib/toast";
import { matchTier, displayTierName , cleanUndefinedFields } from 'lib/utils';
import React, { useEffect, useState, useRef } from 'react';
import { Shield } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import type { Proposal, Organization } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';

const PublicProposal: React.FC = () => {
    const { proposalId } = useParams<{ proposalId: string }>();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [hasDeclinedTerms, setHasDeclinedTerms] = useState(false);
    
    // NDA Gating State
    const [ndaSignerName, setNdaSignerName] = useState('');
    const [isSigningNda, setIsSigningNda] = useState(false);
    const ndaSigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        const fetchProposal = async () => {
            if (!proposalId) { setError("Invalid Link"); setLoading(false); return; }
            try {
                if (!auth.currentUser) {
                    try {
                        await auth.signInAnonymously();
                    } catch (e: any) {
                        console.warn("Anonymous sign-in not available, proceeding unauthenticated:", e.message || e);
                    }
                }

                const doc = await db.collection('proposals').doc(proposalId).get();
                if (!doc.exists) throw new Error("Proposal not found.");
                
                const data = { ...doc.data(), id: doc.id } as Proposal;
                if (data.status === 'Draft') {
                    throw new Error("Proposal not found.");
                }
                setProposal(data);
                if (data.selectedOption) setSelectedOption(data.selectedOption);

                if (data.organizationId) {
                    const orgDoc = await db.collection('organizations').doc(data.organizationId).get();
                    if (orgDoc.exists) {
                        const orgData = { ...orgDoc.data(), id: orgDoc.id } as Organization;
                        setOrganization(orgData);

                        // Device-sharing check if NDA or Terms are already signed
                        if ((data.proposalTermsAgreed || (data as any).ndaSigned) && (!auth.currentUser || auth.currentUser.isAnonymous)) {
                            const localToken = localStorage.getItem(`tektrakker_proposal_device_${data.id}`);
                            if (!localToken) {
                                const now = new Date().toISOString();
                                const newDeviceToken = `dev-prop-share-${data.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
                                localStorage.setItem(`tektrakker_proposal_device_${data.id}`, newDeviceToken);
                                
                                const ua = navigator.userAgent;
                                const updatedHistory = [
                                    ...(data.trackingHistory || []),
                                    {
                                        status: 'Possible Share Detected',
                                        timestamp: now,
                                        updatedBy: 'Security System',
                                        notes: `Proposal opened on a new device/browser (User Agent: ${ua})`
                                    }
                                ];
                                
                                await db.collection('proposals').doc(data.id).update(cleanUndefinedFields({
                                    trackingHistory: updatedHistory
                                }));
                                
                                data.trackingHistory = updatedHistory;
                                
                                // Notify staff members
                                try {
                                    const recipientId = data.technicianId || data.createdById;
                                    if (recipientId) {
                                        const notificationContent = `⚠️ Security Warning: Proposal ${data.id} for "${data.customerName}" was opened on a new device/browser after NDA signing. Possible bid shopping or forwarding detected!`;
                                        const { sendNotification } = await import('lib/notificationService');
                                        await sendNotification(recipientId, {
                                            title: 'Potential Proposal Share!',
                                            body: notificationContent,
                                            type: 'proposal_share_warning'
                                        }, data.organizationId);

                                        await db.collection('messages').add(cleanUndefinedFields({
                                            organizationId: data.organizationId || 'unknown',
                                            senderId: 'system',
                                            senderName: 'Security Alerts',
                                            receiverId: recipientId,
                                            content: notificationContent,
                                            type: 'alert',
                                            timestamp: now,
                                            read: false,
                                            targetUrl: `/briefing/proposal?proposalId=${data.id}`
                                        }));
                                    }
                                } catch (err) {
                                    console.error("Failed to send security alert:", err);
                                }
                            }
                        }
                    }
                }

                // Auto-track "Opened" state
                if (data.status === 'Sent' && (!auth.currentUser || auth.currentUser.isAnonymous)) {
                    const hasOpened = data.trackingHistory?.some((entry: any) => entry.status === 'Opened');
                    if (!hasOpened) {
                        const updatedHistory = [
                            ...(data.trackingHistory || []),
                            {
                                status: 'Opened',
                                timestamp: new Date().toISOString(),
                                updatedBy: 'Customer',
                                notes: 'Proposal opened for review'
                            }
                        ];
                        await db.collection('proposals').doc(data.id).update(cleanUndefinedFields({
                            status: 'Opened',
                            trackingHistory: updatedHistory
                        }));
                        data.status = 'Opened';
                        data.trackingHistory = updatedHistory;
                        setProposal(data);
                    }
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
        const tierItems = (proposal.items || []).filter((i: any) => matchTier(i.tier, tier));
        const subtotal = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const taxableAmount = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const taxRate = organization?.taxRate || 8.25;
        const taxAmount = taxableAmount * (taxRate / 100);
        return { subtotal, taxAmount, total: subtotal + taxAmount, items: tierItems };
    };

    const availableTiers = ['Basic', 'Premium', 'Platinum'].filter(t => calculateTierTotal(t).items.length > 0);

    const handleAcceptProposal = async () => {
        if (!proposal || !sigPadRef.current || sigPadRef.current.isEmpty()) {
            showToast.warn("Please sign to accept.");
            return;
        }
        setIsSubmitting(true);
        const signatureDataUrl = sigPadRef.current.toDataURL();
        try {
            const finalTier = selectedOption || (availableTiers[0] || 'Basic');
            const { subtotal, taxAmount, total, items: tierItems } = calculateTierTotal(finalTier);

            let invoiceId = proposal.invoiceId || null;

            // If jobId is set on proposal, update the associated job's invoice
            if (proposal.jobId) {
                try {
                    const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                    if (jobDoc.exists) {
                        const jobData = jobDoc.data();
                        const existingInvoice = jobData?.invoice || {};
                        invoiceId = existingInvoice.id || null;
                        
                        const invoiceItems = tierItems.map((pItem: any) => ({
                            id: pItem.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            description: pItem.name || pItem.description || 'Proposal Item',
                            quantity: pItem.quantity || 1,
                            unitPrice: pItem.price || 0,
                            total: pItem.total || ((pItem.price || 0) * (pItem.quantity || 1)),
                            type: (pItem.type as any) || 'Part'
                        }));

                        const updatedInvoice = {
                            ...existingInvoice,
                            proposalId: proposal.id,
                            items: invoiceItems,
                            subtotal,
                            taxAmount,
                            totalAmount: total,
                            amount: total,
                            status: existingInvoice.status || 'Unpaid'
                        };

                        await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                            proposalId: proposal.id,
                            invoice: updatedInvoice,
                            updatedAt: new Date().toISOString()
                        }));
                    }
                } catch (jobErr) {
                    console.error("Error updating associated job's invoice:", jobErr);
                }
            }

            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                status: 'Accepted',
                signatureDataUrl,
                selectedOption: finalTier,
                subtotal,
                taxAmount,
                total,
                invoiceId
            }));

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
                    await db.collection('messages').add(cleanUndefinedFields({
                        organizationId: proposal.organizationId || organization?.id || 'unknown',
                        senderId: 'system',
                        senderName: 'System Alerts',
                        receiverId: recipientId,
                        content: notificationContent,
                        type: 'alert',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetUrl: `/briefing/proposal?proposalId=${proposal.id}` 
                    }));
                }
            } catch(e) { console.error('Failed to notify tech', e); }

            const firstDeviceToken = `dev-prop-share-${proposal.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
            localStorage.setItem(`tektrakker_proposal_device_${proposal.id}`, firstDeviceToken);

            setProposal({ ...proposal, status: 'Accepted', selectedOption: finalTier, signatureDataUrl, subtotal, taxAmount, total, invoiceId });
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

    const showProposalNdaGate = false; // Disable NDA Gate on standard B2C/residential proposals to avoid sales friction
    const showProposalTermsOverlay = false;

    const handleAgreeNda = async () => {
        if (!proposal || !ndaSignerName.trim() || !ndaSigPadRef.current || ndaSigPadRef.current.isEmpty()) {
            showToast.warn("Please enter your name and sign the NDA.");
            return;
        }
        setIsSigningNda(true);
        const ndaSignatureDataUrl = ndaSigPadRef.current.toDataURL();
        try {
            const now = new Date().toISOString();
            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                ndaSigned: true,
                ndaSignedAt: now,
                ndaSignerName: ndaSignerName.trim(),
                ndaSignatureDataUrl: ndaSignatureDataUrl
            }));
            const firstDeviceToken = `dev-prop-share-${proposal.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
            localStorage.setItem(`tektrakker_proposal_device_${proposal.id}`, firstDeviceToken);

            setProposal({
                ...proposal,
                ndaSigned: true,
                ndaSignedAt: now,
                ndaSignerName: ndaSignerName.trim(),
                ndaSignatureDataUrl: ndaSignatureDataUrl
            } as any);
            showToast.success("NDA signed successfully. You can now view the proposal.");
        } catch (e: any) {
            showToast.warn("Failed to sign NDA: " + e.message);
        } finally {
            setIsSigningNda(false);
        }
    };

    const handleAgreeProposalTerms = async () => {
        try {
            const now = new Date().toISOString();
            try {
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                    proposalTermsAgreed: true,
                    proposalTermsAgreedAt: now
                }));
            } catch (dbError: any) {
                console.warn("Firestore proposal terms update failed, falling back to local-only updates:", dbError);
            }
            const firstDeviceToken = `dev-prop-share-${proposal.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
            localStorage.setItem(`tektrakker_proposal_device_${proposal.id}`, firstDeviceToken);

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
                        You have declined the required legal agreements (Terms of Agreement or Non-Disclosure Agreement). In order to view this proposal details, authorize package options, or accept this estimate, you must review and agree to the required agreements from <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button 
                            onClick={() => setHasDeclinedTerms(false)}
                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none w-full"
                        >
                            Review Agreement Again
                        </Button>
                        <Button 
                            variant="secondary"
                            onClick={() => {
                                window.close();
                                setTimeout(() => {
                                    if (organization?.website) {
                                        window.location.href = organization.website.startsWith('http') 
                                            ? organization.website 
                                            : `https://${organization.website}`;
                                    } else if (proposal?.organizationId) {
                                        navigate(`/site/${proposal.organizationId}`);
                                    } else {
                                        navigate('/');
                                    }
                                }, 500);
                            }}
                            className="h-12 rounded-xl w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                        >
                            Close Tab
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showProposalNdaGate) {
        const defaultNdaTemplate = `MUTUAL NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT

This Non-Disclosure and Confidentiality Agreement (the "Agreement") is entered into and made effective by and between:

DISCLOSING PARTY: {organizationName} ("Discloser")
and
RECEIVING PARTY: {customerName} ("Recipient")

WHEREAS, Discloser has compiled detailed technical proposals, custom pricing tiers, specifications, and project scope plans (the "Confidential Information") in connection with evaluating a potential business engagement (the "Purpose");

Recipient agrees to hold Discloser's Confidential Information in strict confidence and shall not disclose or distribute it to any third party (specifically including competitor contractors) without prior written consent. Recipient agrees not to utilize Discloser's Confidential Information for the purpose of seeking competitive quotes ("bid shopping"). 

Any breach of this Agreement shall cause irreparable harm, and Discloser shall be entitled to seek injunctive relief and recovery of reasonable legal fees.`;

        const rawNdaText = organization?.proposalNdaContent || defaultNdaTemplate;
        const formattedNdaText = rawNdaText
            .replace(/{organizationName}/g, organization?.name || 'Service Provider')
            .replace(/{organization}/g, organization?.name || 'Service Provider')
            .replace(/{customerName}/g, proposal?.customerName || 'Recipient')
            .replace(/{customer}/g, proposal?.customerName || 'Recipient')
            .replace(/{recipient}/g, proposal?.customerName || 'Recipient');

        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-100 dark:border-slate-700 animate-fade-in text-left">
                    <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400">
                        <Shield size={32} />
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Mutual Non-Disclosure Agreement</h2>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                        Please review and sign the following confidentiality agreement to protect proprietary information before viewing the proposal details from <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-60 mb-6 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                        {formattedNdaText}
                    </div>
                    
                    <div className="space-y-4 mb-6">
                        <Input 
                            label="Full Legal Signer Name"
                            value={ndaSignerName}
                            onChange={(e) => setNdaSignerName(e.target.value)}
                            placeholder="Type your full legal name"
                            required
                        />
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Draw Your Digital Signature</label>
                            <SignaturePad ref={ndaSigPadRef} className="h-32 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden" />
                        </div>
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
                            onClick={handleAgreeNda}
                            disabled={isSigningNda}
                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            {isSigningNda ? 'Signing...' : 'Sign & View Proposal'}
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
                disableScopeLock={true}
                onClose={() => {
                    const isReferrerSameOrigin = document.referrer && document.referrer.includes(window.location.origin);
                    if (isReferrerSameOrigin) {
                        navigate(-1);
                    } else {
                        window.close();
                        setTimeout(() => {
                            if (organization?.website) {
                                window.location.href = organization.website.startsWith('http') 
                                    ? organization.website 
                                    : `https://${organization.website}`;
                            } else if (proposal?.organizationId) {
                                navigate(`/site/${proposal.organizationId}`);
                            } else {
                                navigate('/');
                            }
                        }, 500);
                    }
                }} 
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
                    <Button onClick={() => setIsSigningOpen(true)} className="bg-[#1D4ED8] hover:bg-[#1e40af] font-black h-12 px-4 md:px-8 text-lg shadow-xl">
                        Accept "{selectedOption || availableTiers[0]}" Proposal
                    </Button>
                </div>
            )}

            {!isSigningOpen && proposal.status === 'Accepted' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-emerald-50 border-t border-emerald-200 flex flex-col items-center justify-center gap-2 z-50">
                    <span className="text-emerald-700 font-black tracking-tight text-lg">Proposal Accepted</span>
                    <span className="text-emerald-600 text-xs">Thank you for your business!</span>
                    {proposal.jobId && (
                        <a 
                            href={`/#/invoice/${proposal.jobId}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 bg-[#1D4ED8] hover:bg-[#1e40af] text-white font-black px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 no-underline text-sm uppercase tracking-wider"
                        >
                            View / Pay Invoice
                        </a>
                    )}
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
                            <Button onClick={handleAcceptProposal} disabled={isSubmitting} className="bg-[#1D4ED8] hover:bg-[#1e40af] font-black">
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
