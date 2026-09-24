import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import { useLanguage } from 'context/LanguageContext';
import { matchTier, displayTierName, cleanUndefinedFields, getOrGenerateAccountNumber, formatFullAddress, getAddressLines, resolveServiceLocation, getAvailableProposalTiers, getProposalTierLabel, sanitizeCustomerScopeText } from 'lib/utils';
import { useAppContext } from 'context/AppContext';
import type { Proposal, Organization, Job, Customer } from 'types';
import showToast from 'lib/toast';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { getPendingCompetingProposals } from 'components/modals/MultipleProposalsModal';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { globalConfirm } from 'lib/globalConfirm';
import { 
    Shield, Printer, FileDown, CheckCircle, Sparkles, Phone, Mail, 
    MapPin, FileText, ClipboardCheck, Info, X, Calendar, UserCheck, AlertCircle,
    Scale, FileSignature
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
    const [customer, setCustomer] = useState<Customer | null>(null);
    
    const [hasDeclinedTerms, setHasDeclinedTerms] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(propDataFromProps?.selectedOption || null);

    const formatAddr = (addr: any, city?: string | null, state?: string | null, zip?: string | null): string => {
        return formatFullAddress(addr, city, state, zip);
    };

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

            // Always resolve customer if not already in customer state
            const targetCustId = propDataFromProps.customerId || (propDataFromProps as any).clientCustomerId;
            const targetCustName = propDataFromProps.customerName;
            if (targetCustId) {
                const found = appState.customers?.find(c => c.id === targetCustId);
                if (found) setCustomer(found);
                else {
                    db.collection('customers').doc(targetCustId).get().then(doc => {
                        if (doc.exists) setCustomer({ id: doc.id, ...doc.data() } as Customer);
                    }).catch(err => console.error("Error fetching customer:", err));
                }
            } else if (targetCustName) {
                const found = appState.customers?.find(c => {
                    const cName = (c.name || '').toLowerCase().trim();
                    const tName = targetCustName.toLowerCase().trim();
                    return cName === tName || cName.includes(tName) || tName.includes(cName);
                });
                if (found) setCustomer(found);
                else {
                    const orgId = propDataFromProps.organizationId || appState.currentOrganization?.id || '';
                    const q = orgId ? db.collection('customers').where('organizationId', '==', orgId) : db.collection('customers');
                    q.get().then(snap => {
                        const allC = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
                        const target = targetCustName.toLowerCase().trim();
                        const match = allC.find(c => {
                            const cName = (c.name || '').toLowerCase().trim();
                            return cName === target || cName.includes(target) || target.includes(cName);
                        });
                        if (match) setCustomer(match);
                    }).catch(err => console.error("Error querying customer by name:", err));
                }
            }

            const propIdToLook = propDataFromProps.jobId || propDataFromProps.id || (propDataFromProps as any).proposalNumber;
            const fJob = appState.jobs?.find(j => (propDataFromProps.jobId && j.id === propDataFromProps.jobId) || (propIdToLook && j.proposalId === propIdToLook));
            if (fJob) {
                setAssociatedJob(fJob);
            } else if (propDataFromProps.jobId) {
                db.collection('jobs').doc(propDataFromProps.jobId).get().then(jDoc => {
                    if (jDoc.exists) setAssociatedJob({ id: jDoc.id, ...jDoc.data() } as Job);
                }).catch(err => console.error("Error fetching job:", err));
            } else if (propIdToLook) {
                db.collection('jobs').where('proposalId', '==', propIdToLook).limit(1).get().then(snap => {
                    if (!snap.empty) setAssociatedJob({ id: snap.docs[0].id, ...snap.docs[0].data() } as Job);
                }).catch(err => console.warn("Error querying job by proposalId:", err));
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
                        throw new Error("Proposal not found.");
                    }
                    data = { ...doc.data(), id: doc.id } as Proposal;
                }
                
                const isEmployee = appState.currentUser && appState.currentUser.role !== 'customer';
                const isUserLoggedIn = (auth.currentUser && !auth.currentUser.isAnonymous) || !!isEmployee;
                if (data.status === 'Draft' && !isUserLoggedIn) {
                    throw new Error("Proposal not found.");
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

                const targetCustId = data.customerId || (data as any).clientCustomerId;

                // Fallback job lookup by proposalId or customer if jobId wasn't directly linked
                if (!data.jobId) {
                    if (appState.isDemoMode) {
                        const mockJob = appState.jobs?.find(j => j.proposalId === effectiveProposalId || (data?.id && j.proposalId === data.id) || (targetCustId && j.customerId === targetCustId) || (data?.customerName && j.customerName === data.customerName));
                        if (mockJob) setAssociatedJob(mockJob);
                    } else {
                        try {
                            const propJobSnap = await db.collection('jobs')
                                .where('proposalId', '==', effectiveProposalId)
                                .limit(1)
                                .get();
                            if (!propJobSnap.empty) {
                                setAssociatedJob({ id: propJobSnap.docs[0].id, ...propJobSnap.docs[0].data() } as Job);
                            } else if (targetCustId || data.customerName) {
                                const jobSnap = await db.collection('jobs')
                                    .where(targetCustId ? 'customerId' : 'customerName', '==', targetCustId || data.customerName)
                                    .limit(1)
                                    .get();
                                if (!jobSnap.empty) {
                                    setAssociatedJob({ id: jobSnap.docs[0].id, ...jobSnap.docs[0].data() } as Job);
                                }
                            }
                        } catch (jErr) {
                            console.warn("Fallback job lookup failed:", jErr);
                        }
                    }
                }

                // Fetch customer record by customerId or customerName
                if (targetCustId) {
                    if (appState.isDemoMode) {
                        const mockCust = appState.customers?.find(c => c.id === targetCustId);
                        if (mockCust) setCustomer(mockCust);
                    } else {
                        try {
                            const custDoc = await db.collection('customers').doc(targetCustId).get();
                            if (custDoc.exists) setCustomer({ id: custDoc.id, ...custDoc.data() } as Customer);
                        } catch (cErr) {
                            console.error("Error fetching customer:", cErr);
                        }
                    }
                } else if (data.customerName) {
                    if (appState.isDemoMode) {
                        const mockCust = appState.customers?.find(c => {
                            const cName = (c.name || '').toLowerCase().trim();
                            const tName = (data?.customerName || '').toLowerCase().trim();
                            return cName === tName || cName.includes(tName) || tName.includes(cName);
                        });
                        if (mockCust) setCustomer(mockCust);
                    } else {
                        try {
                            const custSnap = await db.collection('customers').where('name', '==', data.customerName).limit(1).get();
                            if (!custSnap.empty) {
                                setCustomer({ id: custSnap.docs[0].id, ...custSnap.docs[0].data() } as Customer);
                            } else if (data.organizationId) {
                                const orgCustSnap = await db.collection('customers').where('organizationId', '==', data.organizationId).get();
                                const allC = orgCustSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
                                const target = data.customerName.toLowerCase().trim();
                                const match = allC.find(c => {
                                    const cName = (c.name || '').toLowerCase().trim();
                                    return cName === target || cName.includes(target) || target.includes(cName);
                                });
                                if (match) setCustomer(match);
                            }
                        } catch (cErr) {
                            console.error("Error fetching customer by name:", cErr);
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
                                            type: 'proposal_share_warning',
                                            link: `/proposal-view/${data.id}`,
                                            data: {
                                                proposalId: data.id,
                                                customerId: data.customerId,
                                                type: 'proposal_share_warning'
                                            }
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
        return getAvailableProposalTiers(proposal);
    }, [proposal]);

    const getTierLabel = (tierName: string) => {
        return getProposalTierLabel(proposal, tierName);
    };

    const activeTier = selectedOption || (proposal?.selectedOption ? getProposalTierLabel(proposal, proposal.selectedOption) : null) || (availableTiers[0] || 'Basic');
    const hasMultipleTiers = isStandardProposal && availableTiers.length > 1;
    const showMultiTier = hasMultipleTiers;

    const sanitizeLineItemDescription = (desc?: string) => {
        if (!desc) return '';
        const m = desc.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
        if (m && m.index !== undefined) {
            return desc.substring(0, m.index).trim();
        }
        return desc.trim();
    };

    const rawPricingDisclaimer = proposal?.pricingDisclaimer 
        || (proposal as any)?.pricingTerms 
        || organization?.pricingDisclaimer 
        || organization?.proposalDisclaimer 
        || "Proposal pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability.";
    const effectivePricingDisclaimer = sanitizeCustomerScopeText(rawPricingDisclaimer);

    const effectiveWarranty = useMemo(() => {
        if (proposal?.warrantyTerms) return proposal.warrantyTerms;
        if (proposal?.warrantyDisclaimer) return proposal.warrantyDisclaimer;
        if ((proposal as any)?.warrantyNotes) return (proposal as any).warrantyNotes;

        // Extract from any line items if embedded
        const allItems = [...(proposal?.items || []), ...(proposal?.tierItems || []), ...(proposal?.lineItems || [])];
        for (const it of allItems) {
            const d = it?.description || '';
            const m = d.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
            if (m && m.index !== undefined) {
                return d.substring(m.index).trim();
            }
        }

        return (
            (organization as any)?.warrantyTerms ||
            (organization as any)?.warrantyDisclaimer ||
            (organization as any)?.warrantyNotes ||
            ''
        );
    }, [proposal, organization]);

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
            let finalTier = activeTier || 'Basic';
            let finalSubtotal = calculatedSubtotal;
            let finalTaxAmount = calculatedTaxAmount;
            let finalTotal = grandTotal;
            let invoiceId = proposal.invoiceId || null;

            if (isStandardProposal) {
                finalTier = activeTier || (availableTiers[0] || 'Basic');
                const tierCalc = calculateTierTotal(finalTier);
                finalSubtotal = tierCalc.subtotal;
                finalTaxAmount = tierCalc.taxAmount;
                finalTotal = tierCalc.total;

                const invoiceItems = tierCalc.items.map((pItem: any) => ({
                    id: pItem.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    name: pItem.name || pItem.description || 'Proposal Item',
                    description: pItem.description || pItem.name || 'Proposal Item',
                    details: pItem.details || pItem.description || '',
                    notes: pItem.notes || '',
                    scopeOfWork: pItem.scopeOfWork || '',
                    subItems: Array.isArray(pItem.subItems) ? pItem.subItems : [],
                    quantity: Number(pItem.quantity || 1),
                    unitPrice: Number(pItem.price || pItem.unitPrice || 0),
                    price: Number(pItem.price || pItem.unitPrice || 0),
                    total: Number(pItem.total || ((pItem.price || pItem.unitPrice || 0) * (pItem.quantity || 1))),
                    type: (pItem.type as any) || 'Part',
                    partCost: pItem.partCost,
                    laborHours: pItem.laborHours,
                    hourlyRate: pItem.hourlyRate,
                    margin: pItem.margin,
                    taxable: pItem.taxable !== false
                }));

                const canonical = computeCanonicalFinancials({
                    items: invoiceItems,
                    subtotal: finalSubtotal,
                    taxAmount: finalTaxAmount,
                    depositType: (proposal as any).depositType,
                    depositValue: (proposal as any).depositValue,
                    depositAmount: (proposal as any).depositAmount,
                    depositPaid: (proposal as any).depositPaid,
                    depositPaidAmount: (proposal as any).depositPaidAmount,
                    depositNotes: (proposal as any).depositNotes,
                    paymentTerms: (proposal as any).paymentTerms || 'net_30',
                    amountPaid: (proposal as any).amountPaid || 0,
                    additionalFeePercent: (proposal as any).additionalFeePercent || 0,
                    additionalFeeName: (proposal as any).additionalFeeName || '',
                    additionalFeeAmount: (proposal as any).additionalFeeAmount || 0,
                });

                if (proposal.jobId) {
                    try {
                        const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                        if (jobDoc.exists) {
                            const jobData = jobDoc.data();
                            const existingInvoice = jobData?.invoice || {};
                            const isJobCompletedOrPaid = jobData?.jobStatus === 'Completed' || jobData?.jobStatus === 'Archived' || existingInvoice?.status === 'Paid';

                            if (isJobCompletedOrPaid) {
                                // Do NOT overwrite completed job's existing invoice (e.g. diagnostic service call).
                                // Keep proposal bidirectionally linked in linkedProposalIds without destroying invoice.
                                if (!appState.isDemoMode) {
                                    const linkedProps = Array.from(new Set([...(jobData?.linkedProposalIds || []), proposal.id]));
                                    await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                                        linkedProposalIds: linkedProps,
                                        updatedAt: new Date().toISOString()
                                    }));
                                }
                            } else {
                                const targetJobId = proposal.jobId || jobDoc.id || 'JOB';
                                const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                                invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                                const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;

                                const updatedInvoice = {
                                    ...existingInvoice,
                                    id: invoiceId,
                                    invoiceNumber: invoiceNumber,
                                    number: invoiceNumber,
                                    proposalId: proposal.id,
                                    proposalNumber: proposal.proposalNumber || proposal.id,
                                    poNumber: proposal.poNumber || existingInvoice.poNumber || jobData?.poNumber || jobData?.workOrderNumber || '',
                                    recommendations: proposal.recommendations || existingInvoice.recommendations || '',
                                    items: invoiceItems,
                                    subtotal: canonical.subtotal,
                                    taxRate: canonical.taxRate,
                                    taxAmount: canonical.taxAmount,
                                    totalAmount: canonical.grandTotal,
                                    grandTotal: canonical.grandTotal,
                                    amount: canonical.grandTotal,
                                    depositType: canonical.depositType,
                                    depositValue: canonical.depositValue,
                                    depositAmount: canonical.depositRequired,
                                    depositRequired: canonical.depositRequired,
                                    depositPaid: canonical.depositPaid,
                                    depositPaidAmount: canonical.depositPaidAmount,
                                    depositNotes: canonical.depositNotes,
                                    amountPaid: canonical.amountPaid,
                                    balanceDue: canonical.balanceDue,
                                    balanceRemaining: canonical.balanceRemaining,
                                    amountDueToday: canonical.amountDueToday,
                                    amountDueNet: canonical.amountDueNet,
                                    paymentTerms: canonical.paymentTerms,
                                    paymentTermsLabel: canonical.paymentTermsLabel,
                                    financialStatus: canonical.financialStatus,
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
                    updatePayload.totalAmount = finalTotal;
                    updatePayload.grandTotal = finalTotal;
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
                
                const notifPayload = {
                    title: 'Proposal Accepted!',
                    body: notificationContent,
                    type: 'proposal_accepted',
                    link: `/proposal-view/${proposal.id}`,
                    data: {
                        proposalId: proposal.id,
                        customerId: proposal.customerId,
                        type: 'proposal_accepted'
                    }
                };

                if (recipientId) {
                    await sendNotification(recipientId, notifPayload, proposal.organizationId || organization?.id);
                }
                
                if (proposal.organizationId || organization?.id) {
                    await notifyAdmins(proposal.organizationId || organization?.id || '', notifPayload);
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
        
        if (!(await globalConfirm(t("Are you sure you want to mark this proposal as verbally accepted?"), t("Verbal Authorization"), t("Accept Proposal"), t("Cancel")))) {
            return;
        }

        setIsSubmitting(true);
        const signedAtStr = new Date().toISOString();
        const signerName = "Verbal Acceptance";

        try {
            let finalTier = activeTier || 'Basic';
            let finalSubtotal = calculatedSubtotal;
            let finalTaxAmount = calculatedTaxAmount;
            let finalTotal = grandTotal;
            let invoiceId = proposal.invoiceId || null;

            if (isStandardProposal) {
                finalTier = activeTier || (availableTiers[0] || 'Basic');
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
                            const isJobCompletedOrPaid = jobData?.jobStatus === 'Completed' || jobData?.jobStatus === 'Archived' || existingInvoice?.status === 'Paid';

                            if (isJobCompletedOrPaid) {
                                // Do NOT overwrite completed job's existing invoice (e.g. diagnostic service call).
                                // Keep proposal bidirectionally linked in linkedProposalIds without destroying invoice.
                                if (!appState.isDemoMode) {
                                    const linkedProps = Array.from(new Set([...(jobData?.linkedProposalIds || []), proposal.id]));
                                    await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                                        linkedProposalIds: linkedProps,
                                        updatedAt: new Date().toISOString()
                                    }));
                                }
                            } else {
                                const targetJobId = proposal.jobId || jobDoc.id || 'JOB';
                                const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                                invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                                const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;
                                
                                const invoiceItems = tierCalc.items.map((pItem: any) => ({
                                    id: pItem.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                    name: pItem.name || pItem.description || 'Proposal Item',
                                    description: pItem.description || pItem.name || 'Proposal Item',
                                    details: pItem.details || pItem.description || '',
                                    notes: pItem.notes || '',
                                    scopeOfWork: pItem.scopeOfWork || '',
                                    subItems: Array.isArray(pItem.subItems) ? pItem.subItems : [],
                                    quantity: Number(pItem.quantity || 1),
                                    unitPrice: Number(pItem.price || pItem.unitPrice || 0),
                                    price: Number(pItem.price || pItem.unitPrice || 0),
                                    total: Number(pItem.total || ((pItem.price || pItem.unitPrice || 0) * (pItem.quantity || 1))),
                                    type: (pItem.type as any) || 'Part',
                                    partCost: pItem.partCost,
                                    laborHours: pItem.laborHours,
                                    hourlyRate: pItem.hourlyRate,
                                    margin: pItem.margin,
                                    taxable: pItem.taxable !== false
                                }));

                                const updatedInvoice = {
                                    ...existingInvoice,
                                    id: invoiceId,
                                    invoiceNumber: invoiceNumber,
                                    number: invoiceNumber,
                                    proposalId: proposal.id,
                                    proposalNumber: proposal.proposalNumber || proposal.id,
                                    poNumber: proposal.poNumber || existingInvoice.poNumber || jobData?.poNumber || jobData?.workOrderNumber || '',
                                    recommendations: proposal.recommendations || existingInvoice.recommendations || '',
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
                dispatch({
                    type: 'UPDATE_PROPOSAL',
                    payload: {
                        id: proposal.id,
                        ...updatePayload
                    }
                });
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
            <p className="text-sm font-bold text-slate-500">{t("Fetching proposal details...")}</p>
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

    const handleDownloadPdf = async () => {
        if (!proposal) return;
        try {
            showToast.info(t("Generating PDF document..."));
            const { generateProposalPdfAttachment } = await import('lib/pdfHelper');
            const { downloadFile } = await import('lib/downloadHelper');
            const propToExport = {
                ...proposal,
                selectedOption: selectedOption || activeTier
            };
            const att = await generateProposalPdfAttachment(propToExport, organization);
            const dataUri = `data:application/pdf;base64,${att.content}`;
            await downloadFile(dataUri, att.filename);
            showToast.success(t("PDF downloaded successfully!"));
        } catch (err: any) {
            console.error("PDF download error:", err);
            showToast.error(t("Failed to generate PDF: ") + (err.message || err));
        }
    };

    if (!proposal) return null;

    if (hasDeclinedTerms) {
        return (
            <div className="min-h-screen bg-slate-955 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center animate-fade-in">
                    <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t("Access Declined")}</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                        {t("You declined the required legal agreements (Terms of Agreement or Non-Disclosure Agreement). In order to view, download, or authorize this proposal, you must review and agree to the required agreements from")} <strong>{organization?.name || 'Service Provider'}</strong>.
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

    const isCommercial = !!(
        customer?.customerType === 'Commercial' || 
        customer?.customerType === 'Property Management' || 
        (customer?.serviceLocations && customer.serviceLocations.length > 0) ||
        (proposal as any)?.customerType === 'Commercial' ||
        (proposal as any)?.isProjectLevel === true ||
        (proposal as any)?.isCommercial === true
    );

    const isSummaryHidden = false; // For commercial we only want to keep the first popup one

    const laborSub = (proposal.laborItems && proposal.laborItems.length > 0)
        ? proposal.laborItems.reduce((sum: number, it: any) => sum + (Number(it.value) || (Number(it.hours || 0) * Number(it.rate || 0))), 0)
        : (proposal.laborSubtotal || 0);
    const roundedLabor = proposal.roundedLaborProposal || 0;
    const partsTot = (proposal.partItems && proposal.partItems.length > 0)
        ? proposal.partItems.reduce((sum: number, it: any) => sum + (Number(it.customerLineTotal) || (Number(it.quantity || 1) * Number(it.customerUnitPrice || 0))), 0)
        : (proposal.partsTotal || 0);
    const allowanceTot = (proposal.allowanceItems && proposal.allowanceItems.length > 0)
        ? proposal.allowanceItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0)
        : (proposal.allowanceTotal || 0);

    const activeTierCalc = isStandardProposal ? calculateTierTotal(activeTier) : null;
    const calculatedSubtotal = isStandardProposal 
        ? ((activeTierCalc && activeTierCalc.subtotal > 0) ? activeTierCalc.subtotal : (proposal.subtotal || proposal.total || 0))
        : ((roundedLabor || laborSub) + partsTot + allowanceTot);
    const baseSubtotal = proposal.recommendedRoundedTotal || calculatedSubtotal || proposal.subtotal || proposal.total || 0;
    const roundingAdjustment = proposal.recommendedRoundedTotal ? (proposal.recommendedRoundedTotal - calculatedSubtotal) : 0;
    
    const tRate = proposal.taxRate || 0;
    const calculatedTaxAmount = isStandardProposal
        ? (activeTierCalc ? activeTierCalc.taxAmount : (proposal.taxAmount !== undefined ? proposal.taxAmount : 0))
        : (proposal.taxAmount !== undefined ? proposal.taxAmount : Number((baseSubtotal * (tRate / 100)).toFixed(2)));
    
    const pRate = proposal.processingFeeRate || 0;
    const calculatedProcessingFeeAmount = proposal.processingFeeAmount !== undefined 
        ? proposal.processingFeeAmount 
        : Number(((baseSubtotal + calculatedTaxAmount) * (pRate / 100)).toFixed(2));
    
    const grandTotal = isStandardProposal
        ? ((activeTierCalc && activeTierCalc.total > 0) ? activeTierCalc.total : (proposal.total || (proposal as any).amount || baseSubtotal))
        : (baseSubtotal + calculatedTaxAmount + calculatedProcessingFeeAmount);
    const valTotal = grandTotal;

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 print:bg-white text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
            {/* FLOATING ACTION HEADER */}
            <div className={`bg-white/80 dark:bg-slate-900/80 sm:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-3 px-4 md:px-6 sticky top-0 z-40 flex flex-col sm:flex-row ${embedded ? 'justify-end' : 'justify-between'} items-center print:hidden shadow-sm gap-3 h-auto min-h-[3.5rem] ${embedded ? 'rounded-2xl mb-4 border shadow-none bg-white dark:bg-slate-900' : ''}`}>
                {!embedded && (
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
                            <p className="text-[10px] text-slate-500 font-semibold">{isCommercial ? t("Commercial Proposal Portal") : t("Proposal Portal")}</p>
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                    {hasMultipleTiers && proposal.status !== 'Accepted' && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-wider hidden md:inline">Tier:</span>
                            {availableTiers.map(tierName => {
                                const isSel = matchTier(tierName, activeTier);
                                const tCalc = calculateTierTotal(tierName);
                                return (
                                    <button
                                        key={tierName}
                                        type="button"
                                        onClick={() => setSelectedOption(tierName)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                            isSel
                                                ? 'bg-primary-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {isSel && <CheckCircle size={13} />}
                                        <span>{getTierLabel(tierName)}</span>
                                        <span className="opacity-75 text-[11px] font-mono">(${tCalc.total.toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {!embedded && (
                        <>
                            <Button variant="secondary" size="sm" onClick={handleDownloadPdf} className="flex items-center gap-1.5 font-bold">
                                <FileDown size={14} />
                                {t("Download PDF")}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5 font-bold">
                                <Printer size={14} />
                                {t("Print")}
                            </Button>
                        </>
                    )}
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
                            {appState.currentUser && (
                                <Button 
                                    onClick={handleVerbalAccept}
                                    disabled={isSubmitting}
                                    className="bg-amber-500 hover:bg-amber-600 hover:scale-[1.02] border-0 text-white font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all py-2 px-3.5 text-xs md:text-sm"
                                >
                                    <span>{t("Verbal Accept")}{hasMultipleTiers ? ` "${getTierLabel(activeTier)}"` : ''}</span>
                                </Button>
                            )}
                            <Button 
                                onClick={() => setIsSigningOpen(true)} 
                                className="bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] border-0 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all py-2 px-4"
                            >
                                <ClipboardCheck size={16} />
                                {hasMultipleTiers ? `${t("Accept & Sign")} "${getTierLabel(activeTier)}"` : t("Accept & Sign")}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN PORTAL BODY */}
            <div className="flex-grow py-8 px-4 md:px-8 max-w-5xl mx-auto w-full space-y-6 print:py-0 print:px-0">
                {showMultiTier && (
                    <div className="space-y-6 mb-10 animate-fade-in">
                        <div className="text-center max-w-xl mx-auto mb-8">
                            <span className="inline-block px-3 py-1 bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-[11px] font-black uppercase tracking-widest rounded-full mb-2">
                                {proposal.status === 'Accepted' ? t("Package Options Comparison") : t("Package Options")}
                            </span>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">{t("Select Your Package Option")}</h2>
                            <p className="text-slate-500 text-sm mt-2">{t("Click any option below to review its detailed scope, price, and select it for your authorization.")}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {availableTiers.map(tierName => {
                                const tierCalc = calculateTierTotal(tierName);
                                const isSelected = matchTier(tierName, activeTier);
                                const isAcceptedThisTier = proposal.status === 'Accepted' && matchTier(tierName, proposal.selectedOption || activeTier);

                                return (
                                    <div 
                                        key={tierName} 
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (proposal.status !== 'Accepted') {
                                                setSelectedOption(tierName);
                                            }
                                        }} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                if (proposal.status !== 'Accepted') {
                                                    setSelectedOption(tierName);
                                                }
                                            }
                                        }}
                                        className={`p-8 border-3 rounded-3xl transition-all flex flex-col text-left relative ${
                                            isSelected 
                                                ? 'border-primary-600 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 shadow-2xl ring-4 ring-primary-500/20 scale-[1.02]' 
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xl'
                                        } ${proposal.status !== 'Accepted' ? 'cursor-pointer' : ''}`}
                                    >
                                        {/* Selected Badge */}
                                        {isSelected && (
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md flex items-center gap-1">
                                                <CheckCircle size={12} />
                                                <span>{isAcceptedThisTier ? t("Accepted Package") : t("Selected Package")}</span>
                                            </div>
                                        )}

                                        <h3 className={`text-center font-black text-2xl uppercase mb-6 tracking-tight ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {(() => {
                                                const lbl = getTierLabel(tierName);
                                                return lbl.toLowerCase().includes('option') ? lbl : `${lbl} Option`;
                                            })()}
                                        </h3>
                                        <div className="text-center mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
                                            <div className={`text-4xl font-black tracking-tight font-mono ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>
                                                ${tierCalc.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">{t("All-Inclusive Total")}</div>
                                            {(() => {
                                                const hasDep = ((proposal as any)?.depositAmount > 0) || ((proposal as any)?.depositValue > 0);
                                                if (!hasDep) return null;
                                                let tDep = 0;
                                                if ((proposal as any)?.depositType === 'percentage' && (proposal as any)?.depositValue > 0) {
                                                    tDep = (tierCalc.total * Number((proposal as any).depositValue)) / 100;
                                                } else if ((proposal as any)?.depositValue > 0) {
                                                    tDep = Math.min(tierCalc.total, Number((proposal as any).depositValue));
                                                } else if ((proposal as any)?.depositAmount > 0) {
                                                    tDep = Math.min(tierCalc.total, Number((proposal as any).depositAmount));
                                                }
                                                if (tDep <= 0) return null;
                                                return (
                                                    <div className="text-xs font-extrabold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl py-1.5 px-3 mt-3 inline-flex items-center gap-1.5 shadow-sm">
                                                        <span>💳 {t("Deposit Required:")}</span>
                                                        <span className="font-black">${tDep.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        {(proposal as any)?.depositType === 'percentage' && (proposal as any)?.depositValue && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">({(proposal as any).depositValue}%)</span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="space-y-4 mb-8 flex-grow">
                                            {tierCalc.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0">
                                                    <div className="flex items-start justify-between gap-2 text-xs">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-850 dark:text-slate-200 leading-tight">{item.name || sanitizeLineItemDescription(item.description)}</span>
                                                                {sanitizeLineItemDescription(item.description) && sanitizeLineItemDescription(item.description) !== item.name && (
                                                                    <span className="text-[10px] text-slate-500 mt-0.5 leading-snug whitespace-pre-wrap">{sanitizeLineItemDescription(item.description)}</span>
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

                                        {proposal.status !== 'Accepted' ? (
                                            isSelected ? (
                                                <div className="mt-auto w-full py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                                                    <CheckCircle size={16} />
                                                    <span>{t("Selected Option")}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOption(tierName);
                                                    }}
                                                    className="mt-auto w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-600 hover:text-white text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
                                                >
                                                    <span>{t("Select This Option")}</span>
                                                    <span>&rarr;</span>
                                                </button>
                                            )
                                        ) : (
                                            <div className="mt-auto text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                                                {isAcceptedThisTier ? `✓ ${t("Accepted")}` : t("Alternative Option")}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                            {/* Prepared by / logo & organization contact details */}
                            <div className="flex flex-col items-start max-w-[38%] text-left">
                                {organization?.logoUrl || organization?.letterheadDataUrl ? (
                                    <img 
                                        src={organization.logoUrl || organization.letterheadDataUrl} 
                                        alt={proposal.preparedByOrganization || 'Logo'} 
                                        className="h-20 max-w-[320px] object-contain py-1 mb-2"
                                    />
                                ) : null}
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{organization?.name || proposal.preparedByOrganization}</h2>
                                {organization?.address && (
                                    <div className="text-xs text-slate-500 font-medium font-sans mt-0.5">
                                        {formatFullAddress(organization.address, (organization as any)?.city, (organization as any)?.state, (organization as any)?.zip)}
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                                    {organization?.phone && (
                                        <div className="flex items-center gap-1">
                                            <Phone size={12} className="text-slate-400 shrink-0" />
                                            <span>{organization.phone}</span>
                                        </div>
                                    )}
                                    {organization?.email && (
                                        <div className="flex items-center gap-1">
                                            <Mail size={12} className="text-slate-400 shrink-0" />
                                            <span>{organization.email}</span>
                                        </div>
                                    )}
                                </div>
                                {(organization as any)?.licenseNumber && (
                                    <div className="text-[11px] text-slate-400 font-semibold mt-1">
                                        License #: {(organization as any).licenseNumber}
                                    </div>
                                )}
                            </div>

                            {/* Center: Bold PROPOSAL Label */}
                            <div className="flex flex-col items-center justify-center text-center self-center px-4">
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                    PROPOSAL
                                </h2>
                            </div>

                            {/* Proposal metadata / prepared for */}
                            <div className="space-y-4 md:text-right">
                                <div className="inline-block bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl md:text-left min-w-[260px] shadow-sm text-left">
                                    <h3 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 border-b border-slate-200/60 dark:border-slate-800 pb-1">{t("Proposal Details")}</h3>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 font-medium">{t("Proposal ID:")}</span>
                                            <strong className="text-slate-900 dark:text-white font-mono">#{(proposal as any).customProposalNumber || proposal.id}</strong>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 font-medium">{t("Date:")}</span>
                                            <strong className="text-slate-900 dark:text-white">{new Date(proposal.createdAt).toLocaleDateString()}</strong>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 font-medium">{t("Valid Until:")}</span>
                                            <strong className="text-slate-900 dark:text-white">{proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString() : new Date(new Date(proposal.createdAt).getTime() + 30*86400000).toLocaleDateString()}</strong>
                                        </div>
                                        {((customer as any)?.accountNumber || (proposal as any)?.accountNumber || (customer ? getOrGenerateAccountNumber(customer) : '')) && (
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500 font-medium">{t("Account #:")}</span>
                                                <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                                    {(customer as any)?.accountNumber || (proposal as any)?.accountNumber || (customer ? getOrGenerateAccountNumber(customer) : '')}
                                                </strong>
                                            </div>
                                        )}
                                        {((proposal as any).workOrderNumber || (proposal as any).woNumber || proposal.poNumber || associatedJob?.workOrderNumber || (associatedJob as any)?.woNumber || associatedJob?.poNumber || (proposal as any).customWorkOrderNumber) && (
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500 font-medium">{t("WO Number:")}</span>
                                                <strong className="text-slate-900 dark:text-white font-mono">{(proposal as any).workOrderNumber || (proposal as any).woNumber || proposal.poNumber || associatedJob?.workOrderNumber || (associatedJob as any)?.woNumber || associatedJob?.poNumber || (proposal as any).customWorkOrderNumber}</strong>
                                            </div>
                                        )}
                                        {proposal.scid && (
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500 font-medium">{t("SCID:")}</span>
                                                <strong className="text-slate-900 dark:text-white">{proposal.scid}</strong>
                                            </div>
                                        )}
                                        {proposal.status && (
                                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                                <span className="text-slate-500 font-medium">{t("Status:")}</span>
                                                <strong className={`uppercase font-bold tracking-wider text-[10px] px-2 py-0.5 rounded-full ${proposal.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                    {proposal.status}
                                                </strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* 3-Tier Multi-Entity Address Header Layout */}
                    {(() => {
                        const targetLocationId = (proposal as any)?.locationId || associatedJob?.locationId;
                        const isCommercial = !!(
                            customer?.customerType === 'Commercial' || 
                            customer?.customerType === 'Property Management' || 
                            (customer?.serviceLocations && customer.serviceLocations.length > 0)
                        );

                        const matchedLocation = resolveServiceLocation(
                            proposal || associatedJob,
                            customer
                        );

                        const box1Name = proposal?.customerName || customer?.name || 'Customer';
                        const box1Lines = getAddressLines(
                            customer?.address || (proposal as any)?.customerAddress || (proposal as any)?.clientAddress || (customer as any)?.billingAddress,
                            (proposal as any)?.city || customer?.city,
                            (proposal as any)?.state || customer?.state,
                            (proposal as any)?.zip || customer?.zip
                        );

                        const locPropBillToName = matchedLocation?.billToName || (matchedLocation?.billToSameAsSite ? (matchedLocation.propertyName || matchedLocation.name) : null);
                        const locPropBillToAddr = matchedLocation?.billToAddress || (matchedLocation?.billToSameAsSite ? (matchedLocation.address || (proposal as any)?.serviceLocationAddress || associatedJob?.address) : null);

                        const box2Name = (proposal as any)?.billToName || (proposal as any)?.billingCompany || locPropBillToName || (customer as any)?.billingCompany || customer?.name || proposal?.customerName;
                        const box2Lines = getAddressLines(
                            (proposal as any)?.billToAddress || (proposal as any)?.billingAddress || locPropBillToAddr || (customer as any)?.billingAddress || customer?.address || (proposal as any)?.customerAddress,
                            matchedLocation?.billToSameAsSite ? (matchedLocation.city || (proposal as any)?.serviceLocationCity || customer?.city) : ((proposal as any)?.city || customer?.city),
                            matchedLocation?.billToSameAsSite ? (matchedLocation.state || (proposal as any)?.serviceLocationState || customer?.state) : ((proposal as any)?.state || customer?.state),
                            matchedLocation?.billToSameAsSite ? (matchedLocation.zip || (proposal as any)?.serviceLocationZip || customer?.zip) : ((proposal as any)?.zip || customer?.zip)
                        );

                        const box3Name = matchedLocation?.propertyName || matchedLocation?.name || (proposal as any)?.serviceLocationName || (proposal as any)?.locationName || (proposal as any)?.siteName || associatedJob?.locationName || (associatedJob as any)?.customerName || proposal?.customerName;
                        const rawBox3Addr = matchedLocation?.address || (proposal as any)?.serviceLocationAddress || (proposal as any)?.locationAddress || (proposal as any)?.siteAddress || (proposal as any)?.address || associatedJob?.address;
                        const box3City = matchedLocation?.city || (proposal as any)?.serviceLocationCity || (proposal as any)?.city || (associatedJob as any)?.city || customer?.city || '';
                        const box3State = matchedLocation?.state || (proposal as any)?.serviceLocationState || (proposal as any)?.state || (associatedJob as any)?.state || customer?.state || '';
                        const box3Zip = matchedLocation?.zip || (proposal as any)?.serviceLocationZip || (proposal as any)?.zip || (associatedJob as any)?.zip || customer?.zip || '';

                        const box3Lines = getAddressLines(
                            rawBox3Addr,
                            box3City,
                            box3State,
                            box3Zip
                        );

                        const effectiveWo = (proposal as any).workOrderNumber || (proposal as any).woNumber || proposal.poNumber || associatedJob?.workOrderNumber || (associatedJob as any)?.woNumber || associatedJob?.poNumber || (proposal as any).customWorkOrderNumber || '';

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                {/* Box 1: Customer / Property Mgr */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1 text-left">
                                    <h3 className="text-[10px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400">{t("1. CUSTOMER / PROPERTY MGR")}</h3>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{box1Name}</p>
                                    <div className="text-xs text-slate-500 font-medium font-sans">
                                        {box1Lines.street && <div>{box1Lines.street}</div>}
                                        {box1Lines.cityStateZip && <div>{box1Lines.cityStateZip}</div>}
                                        {!box1Lines.street && !box1Lines.cityStateZip && <div>Address on file</div>}
                                    </div>
                                    {proposal.projectName && <p className="text-[11px] text-slate-400 font-semibold pt-1">Project: {proposal.projectName}</p>}
                                </div>

                                {/* Box 2: Bill To (Paying Entity) */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1 text-left">
                                    <h3 className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400">{t("2. BILL TO (PAYING ENTITY)")}</h3>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{box2Name}</p>
                                    <div className="text-xs text-slate-500 font-medium font-sans">
                                        {box2Lines.street && <div>{box2Lines.street}</div>}
                                        {box2Lines.cityStateZip && <div>{box2Lines.cityStateZip}</div>}
                                        {!box2Lines.street && !box2Lines.cityStateZip && (
                                            <>
                                                {box1Lines.street && <div>{box1Lines.street}</div>}
                                                {box1Lines.cityStateZip && <div>{box1Lines.cityStateZip}</div>}
                                                {!box1Lines.street && !box1Lines.cityStateZip && <div>Address on file</div>}
                                            </>
                                        )}
                                    </div>
                                    {effectiveWo && (
                                        <p className="text-[11px] font-mono text-slate-400 font-bold pt-1">
                                            WO #: {effectiveWo}
                                        </p>
                                    )}
                                </div>

                                {/* Box 3: Service Site Location */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1 text-left">
                                    <h3 className="text-[10px] uppercase font-black tracking-widest text-sky-600 dark:text-sky-400">{t("3. SERVICE SITE LOCATION")}</h3>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{box3Name}</p>
                                    <div className="flex items-start gap-1.5 text-xs text-slate-500 font-medium">
                                        <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                        <div>
                                            {box3Lines.street && <div>{box3Lines.street}</div>}
                                            {box3Lines.cityStateZip && <div>{box3Lines.cityStateZip}</div>}
                                            {!box3Lines.street && !box3Lines.cityStateZip && (
                                                <span className="text-slate-400 italic font-normal">Site Location Pending / Unspecified</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

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
                                                 <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(laborSub)}</td>
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
                                                <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(partsTot)}</td>
                                            </tr>
                                            {allowanceTot > 0 ? (
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="p-4 font-bold text-slate-950 dark:text-white">{t("Logistics / Crane Allowances")}</td>
                                                    <td className="p-4 text-xs text-slate-500 font-medium">
                                                        {proposal.allowanceItems && proposal.allowanceItems.length > 0
                                                            ? proposal.allowanceItems.map(a => a.description).join(', ')
                                                            : t("Mobilization allowances")}
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(allowanceTot)}</td>
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
                                    {(() => {
                                        const hasDep = ((proposal as any)?.depositAmount > 0) || ((proposal as any)?.depositValue > 0);
                                        if (!hasDep) return null;
                                        let depAmt = 0;
                                        if ((proposal as any)?.depositType === 'percentage' && (proposal as any)?.depositValue > 0) {
                                            depAmt = (grandTotal * Number((proposal as any).depositValue)) / 100;
                                        } else if ((proposal as any)?.depositValue > 0) {
                                            depAmt = Math.min(grandTotal, Number((proposal as any).depositValue));
                                        } else if ((proposal as any)?.depositAmount > 0) {
                                            depAmt = Math.min(grandTotal, Number((proposal as any).depositAmount));
                                        }
                                        if (depAmt <= 0) return null;
                                        const remainingBal = Math.max(0, grandTotal - depAmt);
                                        const depPaid = !!(proposal as any)?.depositPaid;
                                        const termsLabel = ((proposal as any)?.paymentTerms || 'net_30').replace('_', ' ').toUpperCase();
                                        return (
                                            <>
                                                <tr className="border-t-2 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30">
                                                    <td className="p-4 font-black text-amber-900 dark:text-amber-200 text-sm">
                                                        {t("Required Upfront Deposit (Due Today)")}
                                                        {(proposal as any)?.depositType === 'percentage' && (proposal as any)?.depositValue && (
                                                            <span className="text-xs font-normal text-amber-700 dark:text-amber-400 ml-1.5">({(proposal as any).depositValue}%)</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-xs text-amber-800 dark:text-amber-300 font-bold">
                                                        {depPaid ? t("Deposit Paid & Verified") : t("Due upon proposal acceptance before work begins")}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-base text-amber-900 dark:text-amber-200 font-mono">
                                                        {formatCurrency(depAmt)}
                                                        {depPaid && <span className="text-xs text-emerald-600 block">({t("PAID")})</span>}
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                                                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                        {t("Remaining Balance Due")} ({termsLabel.includes('NET') ? termsLabel : t("Upon Completion")})
                                                    </td>
                                                    <td className="p-4 text-xs text-slate-500 font-medium">
                                                        {t("Payable upon project milestones or completion")}
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                                                        {formatCurrency(remainingBal)}
                                                    </td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {(proposal as any)?.depositNotes && (
                        <div className="p-4 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs shadow-sm">
                            <span className="font-extrabold uppercase tracking-wider text-[11px] shrink-0">💳 {t("Deposit Instructions & Terms:")}</span>
                            <span className="italic font-medium leading-relaxed">{(proposal as any).depositNotes}</span>
                        </div>
                    )}

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
                                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-l-4 border-[#B38728] pl-3">
                                        {t("Detailed Scope of Work / Items")}{hasMultipleTiers ? ` (${getTierLabel(activeTier)} Option)` : ''}
                                    </h3>
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
                                                            <div className="font-bold text-slate-900 dark:text-white">{item.name || sanitizeLineItemDescription(item.description)}</div>
                                                            {sanitizeLineItemDescription(item.description) && sanitizeLineItemDescription(item.description) !== item.name && (
                                                                <div className="text-xs text-slate-505 font-medium leading-relaxed mt-0.5 whitespace-pre-wrap">{sanitizeLineItemDescription(item.description)}</div>
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
                                                        <td className={`p-3 text-right text-xs font-mono ${item.customerUnitPrice < 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'}`}>{formatCurrency(item.customerUnitPrice)}</td>
                                                        <td className="p-3 text-xs text-slate-500 font-medium">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                item.availability === 'In stock' || item.availability === 'Immediate' || item.customerLineTotal < 0
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                                            }`}>
                                                                {item.availability}
                                                            </span>
                                                        </td>
                                                        <td className={`p-3 text-right font-mono font-bold ${item.customerLineTotal < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(item.customerLineTotal)}</td>
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
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Scope of Work")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-40">{t("Amount")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proposal.allowanceItems.map((item, idx) => (
                                                    <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800">
                                                        <td className="p-3 font-bold text-slate-900 dark:text-white text-xs">{item.description}</td>
                                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{sanitizeCustomerScopeText(item.basis)}</td>
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

                    {/* SIGNATURE / AUTHORIZATION WATERMARK BOX (Positioned directly above Disclaimers & Warranty) */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-850">
                        {proposal.status === 'Accepted' ? (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 animate-fade-in">
                                <div className="space-y-2 text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 dark:text-emerald-400">
                                        <UserCheck size={20} />
                                        <h3 className="text-lg font-black tracking-tight">{t("Authorized & Accepted")}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {t("By signing below, customer approves the proposed scope of work, accepts the terms, and authorizes services as specified.")}
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
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs flex flex-col items-center gap-1 shrink-0">
                                        <img src={proposal.signatureDataUrl} alt="Signature" className="h-14 max-w-[200px] object-contain" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Digital Audit Verified</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-950 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="space-y-1 text-center md:text-left">
                                    <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                                        {isCommercial ? t("Commercial Proposal Authorization") : t("Ready to Authorize?")}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {t("By signing below, customer approves the proposed scope of work, accepts the terms, and authorizes services as specified.")}
                                    </p>
                                </div>
                                <Button 
                                    onClick={() => setIsSigningOpen(true)} 
                                    className="bg-primary-600 hover:bg-primary-700 text-white font-black h-12 px-6 rounded-xl shadow-lg shadow-primary-500/20 uppercase tracking-wider text-xs flex items-center gap-2"
                                >
                                    <FileSignature size={16} />
                                    <span>
                                        {hasMultipleTiers 
                                            ? `Authorize & Sign "${getTierLabel(activeTier)}" (${formatCurrency(grandTotal)})` 
                                            : t("Authorize & Digitally Sign Proposal")
                                        }
                                    </span>
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* PRICING & ESTIMATE DISCLAIMER */}
                    {effectivePricingDisclaimer && (
                        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-1.5 animate-fade-in text-left">
                            <h4 className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Scale size={14} className="text-amber-600 dark:text-amber-400" />
                                {t("Pricing & Estimate Disclaimer")}
                            </h4>
                            <p className="text-xs text-amber-950 dark:text-amber-200/90 leading-relaxed font-medium">
                                {effectivePricingDisclaimer}
                            </p>
                        </div>
                    )}

                    {/* WARRANTY TERMS & SERVICE GUARANTEE */}
                    {effectiveWarranty && (
                        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl space-y-1.5 animate-fade-in text-left border-l-4 border-l-indigo-600">
                            <h4 className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                                {t("Warranty Terms & Service Guarantee")}
                            </h4>
                            <p className="text-xs text-indigo-950 dark:text-indigo-200/90 leading-relaxed font-medium whitespace-pre-line">
                                {effectiveWarranty}
                            </p>
                        </div>
                    )}

                    {/* Terms & Conditions & Legal Compliance Footer */}
                    <div className="pt-8 border-t border-slate-200 dark:border-slate-850 space-y-4 text-center">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-1">
                            <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t("TERMS & CONDITIONS")}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                {organization?.termsAndConditions || organization?.proposalTerms || effectivePricingDisclaimer || t(`Proposal pricing is valid for 30 days from issuance. Payment terms are net 30 days upon project completion unless otherwise negotiated. All work will be performed during standard business hours in compliance with local ${isCommercial ? 'commercial ' : ''}building codes. ${organization?.name || proposal?.preparedByOrganization || 'TekAir Inc.'} maintains full liability and worker's compensation insurance.`)}
                            </p>
                        </div>
                        {(() => {
                            const isTekAir = String(organization?.name || proposal?.preparedByOrganization || '').toLowerCase().includes('tekair') || organization?.id === 'org-1765817997819';
                            const orgName = proposal?.preparedByOrganization || organization?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
                            const licNum = organization?.licenseNumber || proposal?.preparedByLicence || (isTekAir ? 'TACLA73240E' : '');
                            const compText = organization?.complianceFooter || (organization as any)?.footerText || (isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '');
                            return (
                                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 font-semibold pt-2">
                                    <p className="font-bold text-slate-800 dark:text-slate-200">
                                        {licNum ? `STATE LICENSE # ${licNum} — ` : ''}© {new Date().getFullYear()} {orgName}
                                    </p>
                                    {compText && (
                                        <p className="text-[11px] text-slate-500 font-normal max-w-2xl mx-auto">
                                            {compText}
                                        </p>
                                    )}
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold pt-1">
                                        TEKTRAKKER SERVICE VERIFICATION SYSTEM
                                    </p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </Card>
            </div>

            {/* PRINT FOOTER */}
            <div className="hidden print:block text-[9px] text-slate-400 text-center py-6 border-t mt-12 font-medium">
                {proposal.preparedByOrganization} • License: {proposal.preparedByLicence} • Powered by TekTrakker
            </div>

            {/* SIGNATURE PAD MODAL */}
            {isSigningOpen && (
                <Modal isOpen={true} onClose={() => setIsSigningOpen(false)} title={isCommercial ? t("Authorize Commercial Proposal") : t("Authorize Proposal")}>
                    <div className="space-y-4 animate-modal-in">
                        {hasMultipleTiers && (
                            <div className="p-3.5 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-xl flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{t("Selected Package:")}</span>
                                <span className="font-black text-primary-600 dark:text-primary-400 font-mono text-sm">
                                    {getTierLabel(activeTier).toLowerCase().includes('option') ? getTierLabel(activeTier) : `${getTierLabel(activeTier)} Option`} — {formatCurrency(grandTotal)}
                                </span>
                            </div>
                        )}
                        {effectivePricingDisclaimer && (
                            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                                <span className="font-bold text-amber-800 dark:text-amber-300">📌 {t("Pricing Terms")}: </span>
                                {effectivePricingDisclaimer}
                            </div>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            {t(`By signing below, customer approves the proposed scope of work, accepts the terms, and authorizes ${organization?.name || proposal?.preparedByOrganization || 'TekAir Inc.'} to perform services as specified.`)}
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
