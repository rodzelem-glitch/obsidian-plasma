import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import { useLanguage } from 'context/LanguageContext';
import { matchTier, displayTierName , cleanUndefinedFields } from 'lib/utils';
import { useAppContext } from 'context/AppContext';
import type { Proposal, Organization, Job } from 'types';
import showToast from 'lib/toast';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { getPendingCompetingProposals } from 'components/modals/MultipleProposalsModal';
import { 
    Shield, Printer, FileDown, CheckCircle, Sparkles, Phone, Mail, 
    MapPin, FileText, ClipboardCheck, Info, X, Calendar, UserCheck, AlertCircle
} from 'lucide-react';

export interface PublicProjectProposalProps {
    proposalId?: string;
    proposalData?: Proposal | null;
    embedded?: boolean;
}

const PublicProjectProposal: React.FC<PublicProjectProposalProps> = ({ 
    proposalId: propIdFromProps, 
    proposalData: propDataFromProps, 
    embedded = false 
}) => {
    const { proposalId: propIdFromParams } = useParams<{ proposalId: string }>();
    const effectiveProposalId = propIdFromProps || propIdFromParams;
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { state: appState, dispatch } = useAppContext();
    
    const [proposal, setProposal] = useState<Proposal | null>(propDataFromProps || null);
    const [organization, setOrganization] = useState<Organization | null>(appState.currentOrganization || null);
    const [loading, setLoading] = useState(!propDataFromProps);
    const [error, setError] = useState('');
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [signerName, setSignerName] = useState('');
    const [associatedJob, setAssociatedJob] = useState<Job | null>(null);
    
    const [hasDeclinedTerms, setHasDeclinedTerms] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(propDataFromProps?.selectedOption || null);

    // NDA Gating State
    const [ndaSignerName, setNdaSignerName] = useState('');
    const [isSigningNda, setIsSigningNda] = useState(false);
    const ndaSigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        if (propDataFromProps) {
            setProposal(propDataFromProps);
            if (propDataFromProps.selectedOption) setSelectedOption(propDataFromProps.selectedOption);
            if (appState.currentOrganization) {
                setOrganization(appState.currentOrganization);
            } else if (propDataFromProps.organizationId) {
                db.collection('organizations').doc(propDataFromProps.organizationId).get().then(orgDoc => {
                    if (orgDoc.exists) setOrganization({ ...orgDoc.data(), id: orgDoc.id } as Organization);
                });
            }
            setLoading(false);
            return;
        }

        if (appState.loading) return;

        const fetchProposal = async () => {
            if (!effectiveProposalId) {
                setError("Invalid link");
                setLoading(false);
                return;
            }
            try {
                if (!appState.isDemoMode && !auth.currentUser) {
                    try {
                        await auth.signInAnonymously();
                    } catch (e: any) {
                        console.warn("Anonymous sign-in not available, proceeding unauthenticated:", e.message || e);
                    }
                }

                let data: Proposal | null = null;
                if (appState.isDemoMode) {
                    const mockProp = appState.proposals?.find(p => p.id === effectiveProposalId);
                    if (mockProp) {
                        data = mockProp;
                    }
                }

                if (!data) {
                    const doc = await db.collection('proposals').doc(effectiveProposalId).get();
                    if (!doc.exists) {
                        throw new Error("Commercial proposal not found.");
                    }
                    data = { ...doc.data(), id: doc.id } as Proposal;
                }
                
                const isEmployee = appState.currentUser && appState.currentUser.role !== 'customer';
                const isUserLoggedIn = (auth.currentUser && !auth.currentUser.isAnonymous) || !!isEmployee;
                if (data.status === 'Draft' && !isUserLoggedIn) {
                    throw new Error("Commercial proposal not found.");
                }
                setProposal(data);
                if (data.selectedOption) setSelectedOption(data.selectedOption);

                // Fetch associated job if jobId exists
                if (data.jobId) {
                    if (appState.isDemoMode) {
                        const mockJob = appState.jobs?.find(j => j.id === data.jobId);
                        if (mockJob) {
                            setAssociatedJob(mockJob);
                        }
                    } else {
                        try {
                            const jobDoc = await db.collection('jobs').doc(data.jobId).get();
                            if (jobDoc.exists) {
                                setAssociatedJob({ id: jobDoc.id, ...jobDoc.data() } as Job);
                            }
                        } catch (jobErr) {
                            console.error("Error fetching associated job:", jobErr);
                        }
                    }
                }

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
                                
                                if (!appState.isDemoMode) {
                                    await db.collection('proposals').doc(data.id).update(cleanUndefinedFields({
                                        trackingHistory: updatedHistory
                                    }));
                                }
                                dispatch({
                                    type: 'UPDATE_PROPOSAL',
                                    payload: { id: data.id, trackingHistory: updatedHistory }
                                });
                                
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

                                        if (!appState.isDemoMode) {
                                            await db.collection('messages').add(cleanUndefinedFields({
                                                organizationId: data.organizationId || 'unknown',
                                                senderId: 'system',
                                                senderName: 'Security Alerts',
                                                receiverId: recipientId,
                                                content: notificationContent,
                                                type: 'alert',
                                                timestamp: now,
                                                read: false,
                                                targetUrl: `/admin/project-proposals?editId=${data.id}`
                                            }));
                                        }
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
                    const hasOpened = data.trackingHistory?.some(entry => entry.status === 'Opened');
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
                        if (!appState.isDemoMode) {
                            await db.collection('proposals').doc(data.id).update(cleanUndefinedFields({
                                status: 'Opened',
                                trackingHistory: updatedHistory
                            }));
                        }
                        dispatch({
                            type: 'UPDATE_PROPOSAL',
                            payload: { id: data.id, status: 'Opened', trackingHistory: updatedHistory }
                        });
                        data.status = 'Opened';
                        data.trackingHistory = updatedHistory;
                        setProposal(data);
                    }
                }
                setLoading(false);
            } catch (e: any) {
                console.error(e);
                setError(e.message || "Failed to load proposal");
                setLoading(false);
            }
        };

        fetchProposal();
    }, [effectiveProposalId, appState.loading, appState.isDemoMode, appState.proposals, appState.currentUser, dispatch, propDataFromProps]);

    const isStandardProposal = !proposal?.laborItems?.length && !proposal?.partItems?.length && !proposal?.allowanceItems?.length && !!(proposal?.items && proposal.items.length > 0);

    const calculateTierTotal = (tierName: string) => {
        if (!proposal) return { subtotal: 0, taxAmount: 0, total: 0, items: [] };
        const tierItems = (proposal.items || []).filter((i: any) => matchTier(i.tier, tierName));
        const subtotal = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
        const taxableAmount = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
        const taxRateVal = organization?.taxRate || 8.25;
        const taxAmount = taxableAmount * (taxRateVal / 100);
        return { subtotal, taxAmount, total: subtotal + taxAmount, items: tierItems };
    };

    const availableTiers = useMemo(() => {
        if (!proposal) return [];
        return ['Basic', 'Premium', 'Platinum'].filter(t => calculateTierTotal(t).items.length > 0);
    }, [proposal, organization]);

    const activeTier = selectedOption || (availableTiers[0] || 'Basic');
    const showMultiTier = isStandardProposal && availableTiers.length > 1 && !selectedOption;

    const tierItems = useMemo(() => {
        if (!proposal) return [];
        return (proposal.items || []).filter((i: any) => matchTier(i.tier, activeTier));
    }, [proposal, activeTier]);

    const handleAcceptProposal = async () => {
        if (!proposal) return;
        
        if (!signerName.trim()) {
            showToast.warn("Please enter your name to authorize.");
            return;
        }

        if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
            showToast.warn("Please provide your digital signature.");
            return;
        }

        setIsSubmitting(true);
        const signatureDataUrl = sigPadRef.current.toDataURL();
        const signedAtStr = new Date().toISOString();

        try {
            let finalTier = selectedOption || 'Basic';
            let finalSubtotal = calculatedSubtotal;
            let finalTaxAmount = calculatedTaxAmount;
            let finalTotal = grandTotal;
            let invoiceId = proposal.invoiceId || null;

            if (isStandardProposal) {
                finalTier = selectedOption || (availableTiers[0] || 'Basic');
                const tierCalc = calculateTierTotal(finalTier);
                finalSubtotal = tierCalc.subtotal;
                finalTaxAmount = tierCalc.taxAmount;
                finalTotal = tierCalc.total;

                if (proposal.jobId) {
                    try {
                        const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                        if (jobDoc.exists) {
                            const jobData = jobDoc.data();
                            const existingInvoice = jobData?.invoice || {};
                            invoiceId = existingInvoice.id || null;
                            
                            const invoiceItems = tierCalc.items.map((pItem: any) => ({
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
                                subtotal: finalSubtotal,
                                taxAmount: finalTaxAmount,
                                totalAmount: finalTotal,
                                amount: finalTotal,
                                status: existingInvoice.status || 'Unpaid'
                            };

                            if (!appState.isDemoMode) {
                                await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                                    proposalId: proposal.id,
                                    invoice: updatedInvoice,
                                    updatedAt: new Date().toISOString()
                                }));
                            }
                            
                            setAssociatedJob({
                                ...jobData,
                                id: jobDoc.id,
                                proposalId: proposal.id,
                                invoice: updatedInvoice,
                                updatedAt: new Date().toISOString()
                            } as Job);
                        }
                    } catch (jobErr) {
                        console.error("Error updating associated job's invoice:", jobErr);
                    }
                }
            }

            const updatedHistory = [
                ...(proposal.trackingHistory || []),
                {
                    status: 'Accepted',
                    timestamp: signedAtStr,
                    updatedBy: signerName,
                    notes: `Proposal electronically signed and accepted by ${signerName}`
                }
            ];

            // Write update to Firestore
            if (!appState.isDemoMode) {
                const updatePayload: any = {
                    status: 'Accepted',
                    signatureDataUrl,
                    signatureName: signerName,
                    signedAt: signedAtStr,
                    trackingHistory: updatedHistory
                };
                if (isStandardProposal) {
                    updatePayload.selectedOption = finalTier;
                    updatePayload.subtotal = finalSubtotal;
                    updatePayload.taxAmount = finalTaxAmount;
                    updatePayload.total = finalTotal;
                    updatePayload.invoiceId = invoiceId;
                }
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updatePayload));
            }
            
            const updatePayloadForState: any = {
                id: proposal.id,
                status: 'Accepted',
                signatureDataUrl,
                signatureName: signerName,
                signedAt: signedAtStr,
                trackingHistory: updatedHistory
            };
            if (isStandardProposal) {
                updatePayloadForState.selectedOption = finalTier;
                updatePayloadForState.subtotal = finalSubtotal;
                updatePayloadForState.taxAmount = finalTaxAmount;
                updatePayloadForState.total = finalTotal;
                updatePayloadForState.invoiceId = invoiceId;
            }
            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: updatePayloadForState
            });

            const firstDeviceToken = `dev-prop-share-${proposal.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
            localStorage.setItem(`tektrakker_proposal_device_${proposal.id}`, firstDeviceToken);

            // Update local state
            setProposal({
                ...proposal,
                status: 'Accepted',
                signatureDataUrl,
                signatureName: signerName,
                signedAt: signedAtStr,
                trackingHistory: updatedHistory,
                ...(isStandardProposal ? {
                    selectedOption: finalTier,
                    subtotal: finalSubtotal,
                    taxAmount: finalTaxAmount,
                    total: finalTotal,
                    invoiceId
                } : {})
            });

            // Check & auto-decline competing pending proposals for this job/customer
            try {
                const pendingCompeting = getPendingCompetingProposals(proposal, appState.proposals || []);
                for (const pendingProp of pendingCompeting) {
                    await db.collection('proposals').doc(pendingProp.id).update(cleanUndefinedFields({
                        status: 'Declined',
                        declineReason: `Declined automatically: Customer accepted alternative proposal #${proposal.id} ("${proposal.title || 'Proposal'}")`,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({
                        type: 'UPDATE_PROPOSAL',
                        payload: {
                            id: pendingProp.id,
                            status: 'Declined',
                            declineReason: `Declined automatically: Customer accepted alternative proposal #${proposal.id}`
                        }
                    });
                }
            } catch (compErr) {
                console.error("Error auto-declining competing proposals:", compErr);
            }

            // --- NOTIFY FIELD TECHNICIAN & ADMINS ---
            const recipientId = proposal.technicianId || proposal.createdById;
            const notificationContent = `🎉 ${proposal.customerName || 'Your customer'} just signed and accepted the proposal "${proposal.title}" for $${finalTotal.toFixed(2)}!`;

            try {
                const { sendNotification, notifyAdmins } = await import('lib/notificationService');
                
                if (recipientId) {
                    await sendNotification(recipientId, {
                        title: 'Proposal Accepted!',
                        body: notificationContent,
                        type: 'proposal_accepted'
                    }, proposal.organizationId || organization?.id);
                }
                
                if (proposal.organizationId || organization?.id) {
                    await notifyAdmins(proposal.organizationId || organization?.id || '', {
                        title: 'Proposal Accepted!',
                        body: notificationContent,
                        type: 'proposal_accepted'
                    });
                }

                // Add to system messages collection for tracking
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
                        targetUrl: isStandardProposal ? `/briefing/proposal?proposalId=${proposal.id}` : `/admin/project-proposals?editId=${proposal.id}` 
                    }));
                }
            } catch(e) { 
                console.error('Failed to notify staff members', e); 
            }

            showToast.success("Proposal approved & signed successfully!");
            setIsSigningOpen(false);
        } catch (e: any) {
            console.error(e);
            showToast.error('Failed to submit authorization: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerbalAccept = async () => {
        if (!proposal) return;
        
        if (!window.confirm(t("Are you sure you want to mark this proposal as verbally accepted?"))) {
            return;
        }

        setIsSubmitting(true);
        const signedAtStr = new Date().toISOString();
        const signerName = "Verbal Acceptance";

        try {
            let finalTier = selectedOption || 'Basic';
            let finalSubtotal = calculatedSubtotal;
            let finalTaxAmount = calculatedTaxAmount;
            let finalTotal = grandTotal;
            let invoiceId = proposal.invoiceId || null;

            if (isStandardProposal) {
                finalTier = selectedOption || (availableTiers[0] || 'Basic');
                const tierCalc = calculateTierTotal(finalTier);
                finalSubtotal = tierCalc.subtotal;
                finalTaxAmount = tierCalc.taxAmount;
                finalTotal = tierCalc.total;

                if (proposal.jobId) {
                    try {
                        const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                        if (jobDoc.exists) {
                            const jobData = jobDoc.data();
                            const existingInvoice = jobData?.invoice || {};
                            invoiceId = existingInvoice.id || null;
                            
                            const invoiceItems = tierCalc.items.map((pItem: any) => ({
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
                                subtotal: finalSubtotal,
                                taxAmount: finalTaxAmount,
                                totalAmount: finalTotal,
                                amount: finalTotal,
                                status: existingInvoice.status || 'Unpaid'
                            };

                            if (!appState.isDemoMode) {
                                await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                                    proposalId: proposal.id,
                                    invoice: updatedInvoice,
                                    updatedAt: new Date().toISOString()
                                }));
                            }
                        }
                    } catch (jobErr) {
                        console.error("Error updating associated job:", jobErr);
                    }
                }
            }

            const updatedHistory = [
                ...(proposal.trackingHistory || []),
                {
                    status: 'Accepted',
                    timestamp: signedAtStr,
                    updatedBy: signerName,
                    notes: `Proposal verbally accepted.`
                }
            ];

            // Write update to Firestore
            if (!appState.isDemoMode) {
                const updatePayload: any = {
                    status: 'Accepted',
                    signatureDataUrl: 'VERBAL_ACCEPTANCE',
                    signatureName: signerName,
                    signedAt: signedAtStr,
                    trackingHistory: updatedHistory
                };
                if (isStandardProposal) {
                    updatePayload.selectedOption = finalTier;
                    updatePayload.subtotal = finalSubtotal;
                    updatePayload.taxAmount = finalTaxAmount;
                    updatePayload.total = finalTotal;
                    updatePayload.invoiceId = invoiceId;
                }
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updatePayload));
            }
            
            showToast.success("Proposal verbally accepted successfully!");
            
            setProposal(prev => prev ? {
                ...prev,
                status: 'Accepted',
                signatureDataUrl: 'VERBAL_ACCEPTANCE',
                signatureName: signerName,
                signedAt: signedAtStr,
                trackingHistory: updatedHistory,
                selectedOption: isStandardProposal ? finalTier : prev.selectedOption,
                subtotal: isStandardProposal ? finalSubtotal : prev.subtotal,
                taxAmount: isStandardProposal ? finalTaxAmount : prev.taxAmount,
                total: isStandardProposal ? finalTotal : prev.total,
                invoiceId: isStandardProposal ? invoiceId : prev.invoiceId
            } : null);

        } catch (e: any) {
            console.error(e);
            showToast.error('Failed to submit verbal acceptance: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeclineProposal = async () => {
        if (!proposal) return;
        const reason = window.prompt(t("Please enter a reason for declining (optional):"));
        if (reason === null) return; // cancelled

        try {
            const timestamp = new Date().toISOString();
            const updatedHistory = [
                ...(proposal.trackingHistory || []),
                {
                    status: 'Declined',
                    timestamp,
                    updatedBy: 'Customer',
                    notes: `Proposal declined by customer. Reason: ${reason || 'No reason provided'}`
                }
            ];

            if (!appState.isDemoMode) {
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                    status: 'Declined',
                    trackingHistory: updatedHistory
                }));
            }

            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: {
                    id: proposal.id,
                    status: 'Declined',
                    trackingHistory: updatedHistory
                }
            });

            setProposal({
                ...proposal,
                status: 'Declined',
                trackingHistory: updatedHistory
            });

            showToast.warn(t("Proposal marked as Declined."));
        } catch (e: any) {
            console.error(e);
            showToast.error('Failed to decline proposal: ' + e.message);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center flex-col gap-3">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-500">{t("Fetching commercial proposal details...")}</p>
        </div>
    );

    if (error || !proposal) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <Card className="p-6 md:p-8 max-w-md w-full text-center border-l-4 border-rose-500">
                <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{t("Loading Error")}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">{error || "Proposal not found."}</p>
                <Button onClick={() => navigate('/')} className="w-full">{t("Go to Home")}</Button>
            </Card>
        </div>
    );

    const isEmployee = appState.currentUser && appState.currentUser.role !== 'customer';
    const isUserLoggedIn = (auth.currentUser && !auth.currentUser.isAnonymous) || !!isEmployee;
    const needsNda = !isStandardProposal && organization?.proposalProtectionMode === 'nda' && !proposal?.ndaSigned && proposal?.status !== 'Accepted';
    const needsTerms = !isStandardProposal && organization?.proposalTerms && !proposal?.proposalTermsAgreed && proposal?.status !== 'Accepted';
    const showCombinedOverlay = !isUserLoggedIn && (needsNda || needsTerms);

    const handleAgreeBoth = async () => {
        if (!proposal) return;
        setIsSigningNda(true);
        try {
            const now = new Date().toISOString();
            const updates: any = {};
            if (needsNda) {
                updates.ndaSigned = true;
                updates.ndaSignedAt = now;
                updates.ndaSignerName = 'Authorized Client';
                updates.ndaSignatureDataUrl = 'agreed-via-click';
            }
            if (needsTerms) {
                updates.proposalTermsAgreed = true;
                updates.proposalTermsAgreedAt = now;
            }
            
            if (!appState.isDemoMode) {
                await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: {
                    id: proposal.id,
                    ...updates
                }
            });

            // Set device sharing token
            const firstDeviceToken = `dev-prop-share-${proposal.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
            localStorage.setItem(`tektrakker_proposal_device_${proposal.id}`, firstDeviceToken);

            setProposal({
                ...proposal,
                ...updates
            } as any);
            showToast.success(t("Agreement accepted. Access unlocked."));
        } catch (e: any) {
            console.error(e);
            showToast.warn(t("Failed to accept agreement: ") + e.message);
        } finally {
            setIsSigningNda(false);
        }
    };

    const formatCurrency = (n: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
    };

    const handlePrint = () => {
        window.print();
    };

    if (!proposal) return null;

    if (hasDeclinedTerms) {
        return (
            <div className="min-h-screen bg-slate-955 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center animate-fade-in">
                    <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t("Access Declined")}</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                        {t("You declined the required legal agreements (Terms of Agreement or Non-Disclosure Agreement). In order to view, download, or authorize this commercial bid, you must review and agree to the required agreements from")} <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button onClick={() => setHasDeclinedTerms(false)} className="w-full font-bold">
                            {t("Review Agreement")}
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
                            className="w-full font-bold"
                        >
                            {t("Close Window")}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showCombinedOverlay) {
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-800 animate-fade-in text-left">
                    <div className="flex items-center gap-3 mb-6 text-primary-600 dark:text-primary-400">
                        <Shield size={32} />
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t("Terms & Confidentiality Agreement")}</h2>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                        {t("Please review and accept the agreements below to protect proprietary information and terms before viewing the proposal details from")} <strong>{organization?.name || 'Service Provider'}</strong>.
                    </p>

                    <div className="space-y-4 mb-6">
                        {needsNda && (
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{t("1. Non-Disclosure Agreement")}</h3>
                                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-40 text-sm text-slate-700 dark:text-slate-350 whitespace-pre-wrap leading-relaxed">
                                    {formattedNdaText}
                                </div>
                            </div>
                        )}
                        
                        {needsTerms && (
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{t("2. Terms of Agreement")}</h3>
                                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-40 text-sm text-slate-700 dark:text-slate-350 whitespace-pre-wrap leading-relaxed">
                                    {organization?.proposalTerms}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button 
                            variant="secondary"
                            onClick={() => setHasDeclinedTerms(true)}
                            className="h-12 px-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                        >
                            {t("Decline")}
                        </Button>
                        <Button 
                            onClick={handleAgreeBoth}
                            disabled={isSigningNda}
                            className="bg-gradient-to-r from-primary-600 to-indigo-600 border-0 font-bold h-12 px-6 rounded-xl shadow-lg text-white"
                        >
                            {isSigningNda ? t('Signing...') : t('Accept & View Proposal')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const isSummaryHidden = false; // For commercial we only want to keep the first popup one

    const laborSub = proposal.laborSubtotal || 0;
    const roundedLabor = proposal.roundedLaborProposal || 0;
    const partsTot = proposal.partsTotal || 0;
    const allowanceTot = proposal.allowanceTotal || 0;

    const calculatedSubtotal = isStandardProposal 
        ? (calculateTierTotal(activeTier).subtotal)
        : ((roundedLabor || laborSub) + partsTot + allowanceTot);
    const baseSubtotal = proposal.recommendedRoundedTotal || calculatedSubtotal;
    const roundingAdjustment = proposal.recommendedRoundedTotal ? (proposal.recommendedRoundedTotal - calculatedSubtotal) : 0;
    
    const tRate = proposal.taxRate || 0;
    const calculatedTaxAmount = isStandardProposal
        ? (calculateTierTotal(activeTier).taxAmount)
        : (proposal.taxAmount !== undefined ? proposal.taxAmount : Number((baseSubtotal * (tRate / 100)).toFixed(2)));
    
    const pRate = proposal.processingFeeRate || 0;
    const calculatedProcessingFeeAmount = proposal.processingFeeAmount !== undefined 
        ? proposal.processingFeeAmount 
        : Number(((baseSubtotal + calculatedTaxAmount) * (pRate / 100)).toFixed(2));
    
    const grandTotal = isStandardProposal
        ? (calculateTierTotal(activeTier).total)
        : (baseSubtotal + calculatedTaxAmount + calculatedProcessingFeeAmount);
    const valTotal = grandTotal;

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 print:bg-white text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
            {/* FLOATING ACTION HEADER */}
            <div className="bg-white/80 dark:bg-slate-900/80 sm:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-3 px-4 md:px-6 sticky top-0 z-40 flex flex-col sm:flex-row justify-between items-center print:hidden shadow-sm gap-3 h-auto min-h-[4rem]">
                <div className="flex items-center gap-3">
                    {organization?.logoUrl || organization?.letterheadDataUrl ? (
                        <img 
                            src={organization.logoUrl || organization.letterheadDataUrl} 
                            alt={proposal.preparedByOrganization || 'Logo'} 
                            className="h-9 max-w-[140px] object-contain rounded"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md">
                            {proposal.preparedByOrganization?.slice(0,2).toUpperCase() || 'TT'}
                        </div>
                    )}
                    <div>
                        <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{proposal.preparedByOrganization || 'TekAir Inc'}</h1>
                        <p className="text-[10px] text-slate-500 font-semibold">{t("Commercial Proposal Portal")}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {availableTiers.length > 1 && selectedOption && proposal.status !== 'Accepted' && (
                        <Button variant="secondary" size="sm" onClick={() => setSelectedOption(null)} className="flex items-center gap-1.5 font-bold">
                            &larr; {t("Change Package")}
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5 font-bold">
                        <Printer size={14} />
                        {t("Print")}
                    </Button>
                    {proposal.status === 'Accepted' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200/50">
                            <CheckCircle size={14} />
                            {t("Approved")}
                        </span>
                    ) : proposal.status === 'Declined' ? (
                        <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-full border border-rose-200/50">
                            <X size={14} />
                            {t("Declined")}
                        </span>
                    ) : (
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleDeclineProposal}
                                variant="danger" 
                                size="sm" 
                                className="flex items-center gap-1.5 font-bold"
                            >
                                <X size={14} />
                                {t("Decline")}
                            </Button>
                            <Button 
                                onClick={() => setIsSigningOpen(true)} 
                                className="bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] border-0 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all py-2 px-4"
                            >
                                <ClipboardCheck size={16} />
                                {t("Accept & Sign")}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN PORTAL BODY */}
            <div className="flex-grow py-8 px-4 md:px-8 max-w-5xl mx-auto w-full space-y-6 print:py-0 print:px-0">
                {showMultiTier ? (
                    <div className="space-y-6 mb-10 animate-fade-in">
                        <div className="text-center max-w-xl mx-auto mb-8">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">{t("Select Your Package Option")}</h2>
                            <p className="text-slate-500 text-sm mt-2">{t("Please choose one of the options below to review the detailed scope, pricing, and authorize the proposal.")}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {availableTiers.map(tierName => {
                                const tierCalc = calculateTierTotal(tierName);
                                return (
                                    <div 
                                        key={tierName} 
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedOption(tierName)} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedOption(tierName);
                                            }
                                        }}
                                        className="p-8 border-2 border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-400 rounded-3xl bg-white dark:bg-slate-900 transition-all cursor-pointer hover:shadow-2xl flex flex-col hover:scale-[1.02] transform active:scale-95 text-left"
                                    >
                                        <h3 className="text-center font-black text-2xl uppercase mb-6 text-slate-800 dark:text-slate-200 tracking-tight">{tierName} Option</h3>
                                        <div className="text-center mb-8 border-b dark:border-slate-800 pb-6">
                                            <div className="text-4xl font-black tracking-tight text-primary-600 dark:text-primary-400 font-mono">${tierCalc.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">{t("All-Inclusive Total")}</div>
                                        </div>
                                        <div className="space-y-4 mb-8 flex-grow">
                                            {tierCalc.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0">
                                                    <div className="flex items-start justify-between gap-2 text-xs">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-850 dark:text-slate-200 leading-tight">{item.name || item.description}</span>
                                                                {item.description && item.description !== item.name && (
                                                                    <span className="text-[10px] text-slate-500 mt-0.5 leading-snug whitespace-pre-wrap">{item.description}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0 flex flex-col">
                                                            <span className="font-black text-slate-700 dark:text-slate-300 font-mono">
                                                                {item.isPercentage && item.percentageRate 
                                                                    ? `${item.percentageRate}%` 
                                                                    : formatCurrency(item.price || item.unitPrice || 0)
                                                                }
                                                            </span>
                                                            {item.quantity > 1 && <span className="text-[9px] text-slate-500 font-medium">Qty: {item.quantity}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button className="mt-auto w-full bg-gradient-to-r from-primary-600 to-indigo-600 border-0 font-bold text-xs uppercase tracking-widest h-12 shadow-lg">{t("Select Option")}</Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Card className="p-8 md:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl print:border-0 print:shadow-none print:p-0 relative overflow-hidden">
                    {/* Watermarks - Multi-Pattern for visual security */}
                    {(organization?.logoUrl || organization?.letterheadDataUrl) && (
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                            <img 
                                src={organization.logoUrl || organization.letterheadDataUrl} 
                                alt="" 
                                className="absolute top-[20%] left-[10%] w-[35%] opacity-[0.04] dark:opacity-[0.02] -rotate-12 select-none" 
                            />
                            <img 
                                src={organization.logoUrl || organization.letterheadDataUrl} 
                                alt="" 
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] opacity-[0.04] dark:opacity-[0.02] -rotate-12 select-none" 
                            />
                            <img 
                                src={organization.logoUrl || organization.letterheadDataUrl} 
                                alt="" 
                                className="absolute bottom-[20%] right-[10%] w-[35%] opacity-[0.04] dark:opacity-[0.02] -rotate-12 select-none" 
                            />
                        </div>
                    )}
                    
                    <div className="relative z-10 space-y-8 flex flex-col w-full">
                        {/* Invoice/Proposal Header block */}
                        <div className="flex flex-col md:flex-row justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                            {/* Prepared by / logo */}
                            <div className="flex items-center">
                                {organization?.logoUrl || organization?.letterheadDataUrl ? (
                                    <img 
                                        src={organization.logoUrl || organization.letterheadDataUrl} 
                                        alt={proposal.preparedByOrganization || 'Logo'} 
                                        className="h-28 max-w-[420px] md:h-32 object-contain py-1"
                                    />
                                ) : (
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{proposal.preparedByOrganization}</h2>
                                )}
                            </div>

                        {/* Proposal metadata / prepared for */}
                        <div className="space-y-4 md:text-right">
                            <div className="inline-block bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl md:text-left min-w-[240px]">
                                <h3 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">{t("Proposal Details")}</h3>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500 font-medium">{t("Proposal ID:")}</span>
                                        <strong className="text-slate-900 dark:text-white font-mono">#{proposal.id}</strong>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500 font-medium">{t("Date:")}</span>
                                        <strong className="text-slate-900 dark:text-white">{new Date(proposal.createdAt).toLocaleDateString()}</strong>
                                    </div>
                                    {proposal.poNumber && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 font-medium">{t("PO Number:")}</span>
                                            <strong className="text-slate-900 dark:text-white">{proposal.poNumber}</strong>
                                        </div>
                                    )}
                                    {proposal.scid && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 font-medium">{t("SCID:")}</span>
                                            <strong className="text-slate-900 dark:text-white">{proposal.scid}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3-Tier Multi-Entity Address Header Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Box 1: Customer / Property Mgr */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400">{t("1. CUSTOMER / PROPERTY MGR")}</h3>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{proposal.customerName || '23rd Group Facility Services'}</p>
                            <p className="text-xs text-slate-500 font-medium">{(proposal as any).customerAddress || (proposal as any).clientAddress || '4944 Parkway Plaza Blvd, Charlotte, NC 28217'}</p>
                            {proposal.projectName && <p className="text-[11px] text-slate-400 font-semibold pt-1">Project: {proposal.projectName}</p>}
                        </div>

                        {/* Box 2: Bill To (Paying Entity) */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400">{t("2. BILL TO (PAYING ENTITY)")}</h3>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{(proposal as any).billToName || (proposal as any).billingCompany || proposal.customerName || '23rd Group Facility Services'}</p>
                            <p className="text-xs text-slate-500 font-medium">{(proposal as any).billToAddress || (proposal as any).billingAddress || (proposal as any).customerAddress || '4944 Parkway Plaza Blvd, Charlotte, NC 28217'}</p>
                            {proposal.poNumber && <p className="text-[11px] font-mono text-slate-400 font-bold pt-1">PO #: {proposal.poNumber}</p>}
                        </div>

                        {/* Box 3: Service Site Location */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                            <h3 className="text-[10px] uppercase font-black tracking-widest text-sky-600 dark:text-sky-400">{t("3. SERVICE SITE LOCATION")}</h3>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{(proposal as any).serviceLocationName || (proposal as any).siteName || proposal.customerName || 'Humana Conviva'}</p>
                            <div className="flex items-start gap-1.5 text-xs text-slate-500 font-medium">
                                <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                <span>{(proposal as any).serviceLocationAddress || (proposal as any).siteAddress || proposal.locationAddress || '4455 Thousands Oaks Drive, San Antonio, TX 78233'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Big Proposal Title */}
                    <div className="space-y-2 text-center md:text-left py-4">
                        <h2 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight border-l-4 border-indigo-500 pl-3">
                            {proposal.title || t("HVAC Labor, Parts & Crane Pricing Breakdown")}
                        </h2>
                    </div>

                    {/* PRICING SUMMARY TABLE */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">{t("Pricing Summary Breakdown")}</h3>
                        <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850">
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Category")}</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Basis Details")}</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-40">{t("Amount")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isStandardProposal ? (
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-4 font-bold text-slate-950 dark:text-white">{t("Base Scope Subtotal")}</td>
                                            <td className="p-4 text-xs text-slate-500 font-medium">
                                                {t("Total value of selected solutions")}
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(calculatedSubtotal)}</td>
                                        </tr>
                                    ) : (
                                        <>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-4 font-bold text-slate-950 dark:text-white">{t("Labor Subtotal")}</td>
                                                <td className="p-4 text-xs text-slate-500 font-medium">
                                                    {proposal.laborItems && proposal.laborItems.length > 0 
                                                        ? `${proposal.laborItems.reduce((sum, item) => sum + item.hours, 0)} estimated labor hours` 
                                                        : t("All estimated labor hours")}
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(proposal.laborSubtotal || 0)}</td>
                                            </tr>
                                            {!!proposal.roundedLaborProposal && (
                                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                                    <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{t("Rounded Labor Proposal")}</td>
                                                    <td className="p-4 text-xs text-slate-500 font-medium italic">{proposal.roundedLaborBasis}</td>
                                                    <td className="p-4 text-right font-black text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(proposal.roundedLaborProposal)}</td>
                                                </tr>
                                            )}
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-4 font-bold text-slate-950 dark:text-white">{proposal.preparedByOrganization}-supplied repair parts</td>
                                                <td className="p-4 text-xs text-slate-500 font-medium">
                                                    {proposal.partItems && proposal.partItems.length > 0
                                                        ? `${proposal.partItems.length} itemized parts with wait times`
                                                        : t("Itemized parts and supplies")}
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(proposal.partsTotal || 0)}</td>
                                            </tr>
                                            {proposal.allowanceTotal && proposal.allowanceTotal > 0 ? (
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="p-4 font-bold text-slate-950 dark:text-white">{t("Logistics / Crane Allowances")}</td>
                                                    <td className="p-4 text-xs text-slate-500 font-medium">
                                                        {proposal.allowanceItems && proposal.allowanceItems.length > 0
                                                            ? proposal.allowanceItems.map(a => a.description).join(', ')
                                                            : t("Mobilization allowances")}
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(proposal.allowanceTotal)}</td>
                                                </tr>
                                            ) : null}
                                            <tr className="border-b border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-955">
                                                <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{t("Calculated HVAC Subtotal")}</td>
                                                <td className="p-4 text-xs text-slate-400 font-medium">Labor + parts + crane allowances</td>
                                                <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(calculatedSubtotal)}</td>
                                            </tr>
                                        </>
                                    )}
                                    {proposal.recommendedRoundedTotal && proposal.recommendedRoundedTotal > 0 ? (
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{t("Rounding/Discount Adjustment")}</td>
                                            <td className="p-4 text-xs text-slate-400 font-medium italic">Adjusted presentation total</td>
                                            <td className={`p-4 text-right font-mono font-bold ${roundingAdjustment < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {roundingAdjustment < 0 ? '-' : '+'}{formatCurrency(Math.abs(roundingAdjustment))}
                                            </td>
                                        </tr>
                                    ) : null}
                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-950/25">
                                        <td className="p-4 font-bold text-slate-900 dark:text-white">{t("Adjusted Subtotal")}</td>
                                        <td className="p-4 text-xs text-slate-500 font-medium">Base contract presentation total</td>
                                        <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">{formatCurrency(baseSubtotal)}</td>
                                    </tr>
                                    {tRate > 0 && (
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{t("Sales Tax")} ({tRate}%)</td>
                                            <td className="p-4 text-xs text-slate-450 font-medium">State & local sales tax</td>
                                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(calculatedTaxAmount)}</td>
                                        </tr>
                                    )}
                                    {pRate > 0 && (
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{t("Processing/Convenience Fee")} ({pRate}%)</td>
                                            <td className="p-4 text-xs text-slate-450 font-medium">Convenience fee on final balance</td>
                                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(calculatedProcessingFeeAmount)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-slate-800/40 dark:to-indigo-950/40">
                                        <td className="p-4 font-black text-slate-950 dark:text-white text-base">{t("Final Grand Total")}</td>
                                        <td className="p-4 text-xs text-indigo-700 dark:text-indigo-350 font-bold uppercase tracking-wider">{t("All Inclusive Contract Total")}</td>
                                        <td className="p-4 text-right font-black text-xl text-primary-600 dark:text-primary-400 font-mono">{formatCurrency(grandTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* DETAILED SECTIONS */}
                    {isSummaryHidden ? (
                        <div className="p-8 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center rounded-2xl flex flex-col items-center justify-center space-y-3 font-sans w-full min-h-[200px] my-6">
                            <Shield size={32} className="text-slate-400 animate-pulse" />
                            <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">{t("Detailed Scope Breakdown Locked")}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed font-medium">
                                {t("Itemized labor hours, specific parts SKUs, and crane/logistics allowances are locked to protect proprietary engineering scope. All details will unlock upon proposal acceptance.")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {isStandardProposal && tierItems.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">{t("Detailed Scope of Work / Items")}</h3>
                                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Installed Solution / Item")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-24">{t("Qty")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-36">{t("Unit Price")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-40">{t("Total")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tierItems.map((item: any, idx: number) => (
                                                    <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                                                        <td className="p-3 text-left">
                                                            <div className="font-bold text-slate-900 dark:text-white">{item.name || item.description}</div>
                                                            {item.description && item.description !== item.name && (
                                                                <div className="text-xs text-slate-505 font-medium leading-relaxed mt-0.5 whitespace-pre-wrap">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center text-xs font-mono font-bold text-slate-700 dark:text-slate-350">{item.quantity}</td>
                                                        <td className="p-3 text-right text-xs font-mono text-slate-550">
                                                            {item.isPercentage && item.percentageRate 
                                                                ? `${item.percentageRate}%` 
                                                                : formatCurrency(item.price || item.unitPrice || 0)
                                                            }
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.total || ((item.price || item.unitPrice || 0) * (item.quantity || 1)))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* DETAILED LABOR BREAKDOWN */}
                            {!isStandardProposal && proposal.laborItems && proposal.laborItems.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">{t("Detailed Labor Breakdown")}</h3>
                                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-850 rounded-2xl">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-955 border-b border-slate-200 dark:border-slate-850">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-40">{t("Unit")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Scope of Work Description")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-24">{t("Hours")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-28">{t("Rate")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-32">{t("Value")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proposal.laborItems.map((item, idx) => (
                                                    <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-905/10">
                                                        <td className="p-3 font-bold text-slate-900 dark:text-white">{item.unitName}</td>
                                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{item.scope}</td>
                                                        <td className="p-3 text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-350">{item.hours}</td>
                                                        <td className="p-3 text-right text-xs font-mono text-slate-505">{formatCurrency(item.rate)}/hr</td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* DETAILED PARTS BREAKDOWN */}
                            {!isStandardProposal && proposal.partItems && proposal.partItems.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">{t("Itemized Repair Parts Breakdown")}</h3>
                                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-850 rounded-2xl">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-32">{t("Unit")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Part Description")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-16">{t("Qty")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-28">{t("Unit Price")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-36">{t("Availability")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-32">{t("Total")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proposal.partItems.map((item, idx) => (
                                                    <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                                                        <td className="p-3 font-semibold text-slate-900 dark:text-white text-xs">{item.unitName}</td>
                                                        <td className="p-3 text-xs text-slate-700 dark:text-slate-300 font-medium">{item.partName}</td>
                                                        <td className="p-3 text-center text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{item.quantity}</td>
                                                        <td className="p-3 text-right text-xs font-mono text-slate-500">{formatCurrency(item.customerUnitPrice)}</td>
                                                        <td className="p-3 text-xs text-slate-505 font-medium">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                item.availability === 'In stock' 
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                                            }`}>
                                                                {item.availability}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.customerLineTotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ALLOWANCES DETAILED */}
                            {!isStandardProposal && proposal.allowanceItems && proposal.allowanceItems.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">{t("Special Logistics & Allowances")}</h3>
                                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-850 rounded-2xl">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-64">{t("Special Allowance")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Scope Basis")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-40">{t("Amount")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proposal.allowanceItems.map((item, idx) => (
                                                    <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800">
                                                        <td className="p-3 font-bold text-slate-900 dark:text-white text-xs">{item.description}</td>
                                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.basis}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* CRITICAL BOLD CALLOUT CLARIFICATION */}
                    {proposal.importantClarification && (
                        <div className="p-5 bg-indigo-50 dark:bg-indigo-950/25 border-l-4 border-indigo-500 rounded-r-xl">
                            <div className="flex gap-3">
                                <Info className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">{t("Important Clarification Scope Details")}</h4>
                                    <p className="text-xs text-indigo-950 dark:text-indigo-200 font-bold leading-relaxed mt-1 whitespace-pre-line">
                                        {proposal.importantClarification}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CLARIFICATIONS & EXCLUSIONS COLUMN SPLIT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {/* Inclusions / Clarifications */}
                        {proposal.clarifications && proposal.clarifications.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <ClipboardCheck className="text-indigo-500" size={14} />
                                    {t("Clarifications & Inclusions")}
                                </h4>
                                <ul className="space-y-2.5">
                                    {proposal.clarifications.map((c, idx) => (
                                        <li key={idx} className="flex gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-350">
                                            <span className="text-indigo-500 font-bold">•</span>
                                            <span>{c}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Exclusions */}
                        {proposal.exclusions && proposal.exclusions.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <X className="text-rose-500" size={14} />
                                    {t("Exclusions & Disclaimers")}
                                </h4>
                                <ul className="space-y-2.5">
                                    {proposal.exclusions.map((e, idx) => (
                                        <li key={idx} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-450">
                                            <span className="text-rose-500 font-bold">•</span>
                                            <span>{e}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* SIGNATURE / AUTHORIZATION WATERMARK BOX */}
                    <div className="pt-8 border-t border-slate-200 dark:border-slate-850">
                        {proposal.status === 'Accepted' ? (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 animate-fade-in">
                                <div className="space-y-2 text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 dark:text-emerald-400">
                                        <UserCheck size={20} />
                                        <h3 className="text-lg font-black tracking-tight">{t("Authorized & Accepted")}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {t("This proposal has been electronically authorized and signed.")}
                                    </p>
                                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 font-semibold pt-1">
                                        <p>Authorized Signer: <strong className="text-slate-800 dark:text-slate-200">{proposal.signatureName}</strong></p>
                                        {proposal.signedAt && (
                                            <div className="flex items-center justify-center md:justify-start gap-1">
                                                <Calendar size={12} className="text-slate-400" />
                                                <span>Signed Date: {new Date(proposal.signedAt).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {proposal.jobId && (
                                            <div className="pt-2 no-print">
                                                <a 
                                                    href={`/#/invoice/${proposal.jobId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-black bg-emerald-650 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-md hover:scale-105 active:scale-95 no-underline uppercase tracking-wider"
                                                >
                                                    <span>View Invoice {(proposal.invoiceId || associatedJob?.invoice?.id) ? `#${proposal.invoiceId || associatedJob?.invoice?.id}` : ''}</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {proposal.signatureDataUrl && (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm max-w-[280px]">
                                        <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1 border-b pb-1">Signature Capture</p>
                                        <img 
                                            src={proposal.signatureDataUrl} 
                                            alt="Client Electronic Signature" 
                                            className="max-h-20 object-contain mx-auto"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : proposal.status === 'Declined' ? (
                            <div className="bg-rose-50/50 dark:bg-rose-955/10 border border-rose-250 dark:border-rose-900/30 p-6 md:p-8 rounded-2xl flex flex-col justify-center items-center gap-4 animate-fade-in text-center">
                                <X className="text-rose-600 dark:text-rose-400 shrink-0" size={36} />
                                <h3 className="text-lg font-black tracking-tight text-rose-700 dark:text-rose-405">{t("Proposal Declined")}</h3>
                                <p className="text-xs text-slate-500 font-medium max-w-lg mx-auto">
                                    {t("This commercial proposal has been declined by the customer and cannot be authorized. Please contact the service provider to make changes and submit a new proposal.")}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl text-center border border-slate-200 dark:border-slate-850 space-y-4">
                                <h3 className="text-base font-black text-slate-950 dark:text-white">{t("Commercial Proposal Approval")}</h3>
                                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                                    {t("Review all details above. Once satisfied, click below to supply your name and digital signature. Signing authorizes this commercial contract estimate work to proceed.")}
                                </p>
                                <div className="flex justify-center gap-4">
                                    <Button 
                                        onClick={handleDeclineProposal}
                                        variant="danger"
                                        className="px-8 py-3 text-base font-black hover:scale-105 active:scale-95 transition-all animate-fade-in"
                                    >
                                        {t("Decline Proposal")}
                                    </Button>
                                    <Button 
                                        onClick={() => setIsSigningOpen(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 text-base shadow-lg hover:scale-105 active:scale-95 transition-all"
                                    >
                                        {t("Authorize and Sign Bid")}
                                    </Button>
                                    <Button 
                                        onClick={handleVerbalAccept}
                                        disabled={isSubmitting}
                                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-3 text-base shadow-lg hover:scale-105 active:scale-95 transition-all animate-fade-in"
                                    >
                                        {isSubmitting ? t("Submitting...") : t("Verbal Accept")}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Terms & Conditions & Legal Compliance Footer */}
                    <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4 text-center">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-1">
                            <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t("TERMS & CONDITIONS")}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                {t("Proposal pricing is valid for 30 days from issuance. Payment terms are net 30 days upon project completion unless otherwise negotiated. All work will be performed during standard business hours in compliance with local commercial building codes. TekAir Inc. maintains full commercial liability and worker's compensation insurance.")}
                            </p>
                        </div>
                        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 font-semibold pt-2">
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                                STATE LICENSE # {organization?.licenseNumber || proposal?.preparedByLicence || 'TACLA73240E'} — © {new Date().getFullYear()} {proposal?.preparedByOrganization || organization?.name || 'TekAir Inc.'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-normal max-w-2xl mx-auto">
                                {organization?.complianceFooter || 'Regulated by The Texas Department of Licensing and Regulation P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov'}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold pt-1">
                                TEKTRAKKER SERVICE VERIFICATION SYSTEM
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
            )}
            </div>

            {/* PRINT FOOTER */}
            <div className="hidden print:block text-[9px] text-slate-400 text-center py-6 border-t mt-12 font-medium">
                {proposal.preparedByOrganization} • License: {proposal.preparedByLicence} • Powered by TekTrakker
            </div>

            {/* SIGNATURE PAD MODAL */}
            {isSigningOpen && (
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title={t("Authorize Commercial Proposal")}>
                    <div className="space-y-4 animate-modal-in">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {t("Please input your full legal name and draw your signature on the pad below to accept the estimate.")}
                        </p>
                        
                        <Input 
                            label={t("Full Authorized Name")}
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder={t("e.g. John Doe, Operations Manager")}
                            required
                        />

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t("Digital Signature Pad")}</label>
                            <SignaturePad ref={sigPadRef} className="h-40 border border-slate-300 dark:border-slate-700 rounded-lg bg-white overflow-hidden" />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setIsSigningOpen(false)}>
                                {t("Cancel")}
                            </Button>
                            <Button 
                                onClick={handleAcceptProposal} 
                                disabled={isSubmitting} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                            >
                                {isSubmitting ? t('Submitting...') : t('Sign & Accept')}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PublicProjectProposal;
