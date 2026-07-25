import showToast from "lib/toast";
import { getBaseUrl, matchTier, displayTierName , cleanUndefinedFields } from "lib/utils";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { CheckCircle, Eye, Sparkles, Edit2, Mail, Book, Save } from 'lucide-react';
import { db } from 'lib/firebase';
import { getNextProposalNumber } from 'lib/numbering';
import type { Proposal, ProposalItem, ProposalPreset, Customer } from 'types';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import DocumentPreview from 'components/ui/DocumentPreview';
import Input from 'components/ui/Input';

// Modular Components
import AIGenerator, { AISuggestion, AISuggestionSet } from './field-proposal/components/AIGenerator';
import AISuggestionsList from './field-proposal/components/AISuggestionsList';
import ManualEntry from './field-proposal/components/ManualEntry';
import ProposalItemsList from './field-proposal/components/ProposalItemsList';
import PricebookModal from './field-proposal/components/PricebookModal';
import { globalConfirm } from "lib/globalConfirm";
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';

type Tier = 'Basic' | 'Premium' | 'Platinum';
type AddTool = 'ai' | 'manual' | 'pricebook';

// Change ProposalItem to use unitPrice internally
type InternalProposalItem = Omit<ProposalItem, 'price' | 'tier'> & { unitPrice: number, isPercentage?: boolean, tier: Tier };

const FieldProposal: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const jobIdRef = useRef<string | null>(searchParams.get('jobId'));
    const editProposalId = searchParams.get('proposalId');
    const source = searchParams.get('source');
    
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [items, setItems] = useState<InternalProposalItem[]>([]);
    const [recommendations, setRecommendations] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTier, setActiveTier] = useState<Tier>('Basic');
    const [selectedOption, setSelectedOption] = useState<Tier | null>(null);
    
    const [additionalFeePercent, setAdditionalFeePercent] = useState<number>(0);
    const [additionalFeeName, setAdditionalFeeName] = useState<string>('Processing Fee');
    
    const [activeTool, setActiveTool] = useState<AddTool>('ai');
    const [aiSuggestions, setAiSuggestions] = useState<AISuggestionSet | null>(null);
    const [isPricebookOpen, setIsPricebookOpen] = useState(false);
    const [pricebookSearch, setPricebookSearch] = useState('');

    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);

    const associatedJob = useMemo(() => {
        if (!jobIdRef.current) return null;
        return state.jobs.find(j => j.id === jobIdRef.current) || null;
    }, [state.jobs, jobIdRef.current]);

    const locationId = associatedJob?.locationId || null;

    const customer = state.customers.find((c: Customer) => c.id === customerId);

    const filteredPresets = useMemo(() => {
        return (state.proposalPresets as ProposalPreset[]).filter(p => 
            p.name.toLowerCase().includes(pricebookSearch.toLowerCase()) || 
            (p.category && p.category.toLowerCase().includes(pricebookSearch.toLowerCase()))
        );
    }, [state.proposalPresets, pricebookSearch]);

    useEffect(() => {
        if (jobIdRef.current && !customerId) {
            const job = state.jobs.find(j => j.id === jobIdRef.current);
            if (job) {
                setCustomerId(job.customerId || '');
                setStep(2);
            }
        }
    }, [jobIdRef, customerId, state.jobs]);

    const [hasCheckedExisting, setHasCheckedExisting] = useState(false);

    useEffect(() => {
        const checkExisting = async () => {
            if (jobIdRef.current && !editProposalId && !hasCheckedExisting && state.proposals.length > 0) {
                setHasCheckedExisting(true);
                const existing = state.proposals.find(p => p.jobId === jobIdRef.current && p.status !== 'Cancelled');
                if (existing) {
                    const continueExisting = await globalConfirm(
                        t('There is already a proposal started for this job. Would you like to continue editing the existing proposal instead of creating a new one?'),
                        t('Existing Proposal Found'),
                        t('Edit Existing'),
                        t('Create New Anyway')
                    );
                    if (continueExisting) {
                        navigate(`${window.location.pathname}?proposalId=${existing.id}&jobId=${jobIdRef.current}${source ? `&source=${source}` : ''}`, { replace: true });
                        return;
                    }
                }
            }
        };
        checkExisting();
    }, [jobIdRef, editProposalId, hasCheckedExisting, state.proposals, source, navigate, t]);

    const hasLoadedRef = useRef(false);

    useEffect(() => { const checkProposal = async () => {
        if (editProposalId && state.proposals.length > 0 && !hasLoadedRef.current) {
            const draftKey = `draft_field_proposal_${editProposalId}`;
            const rawDraft = localStorage.getItem(draftKey);
            let restored = false;
            if (rawDraft) {
                try {
                    const draft = JSON.parse(rawDraft);
                    const confirmRestore = await globalConfirm(
                        t("We found an unsaved draft for this proposal. Would you like to restore it?"),
                        t("Unsaved Draft Found"),
                        t("Restore Draft"),
                        t("Discard")
                    );
                    if (confirmRestore) {
                        setItems(draft.items || []);
                        setCustomerId(draft.customerId || '');
                        setRecommendations(draft.recommendations || '');
                        setActiveTier(draft.activeTier || 'Good');
                        setSelectedOption(draft.selectedOption || null);
                        setAdditionalFeePercent(draft.additionalFeePercent || 0);
                        setAdditionalFeeName(draft.additionalFeeName || 'Processing Fee');
                        setStep(draft.step || 1);
                        hasLoadedRef.current = true;
                        showToast.success(t("Draft restored!"));
                        restored = true;
                    } else {
                        localStorage.removeItem(draftKey);
                    }
                } catch (e) {
                    console.error("Failed to restore field proposal draft:", e);
                }
            }

            if (!restored) {
                const proposalToCopy = state.proposals.find((p: Proposal) => p.id === editProposalId);
                if (proposalToCopy) {
                    // Deep copy to prevent mutating the global AppContext state bypass
                    const proposal = JSON.parse(JSON.stringify(proposalToCopy));
                    
                    if (proposal.status === 'Accepted' || proposal.status === 'Sent' || proposal.status === 'Opened') {
                        if (await globalConfirm("Editing this finalized proposal will invalidate the current signature and revert it to a Draft. Do you want to proceed?")) {
                            proposal.status = 'Draft';
                            proposal.signatureDataUrl = null; 
                        } else {
                            navigate(-1);
                            return;
                        }
                    }

                    hasLoadedRef.current = true;
                    const exactCust = state.customers.find((c: Customer) => c.name === proposal.customerName);
                    if (exactCust) setCustomerId(exactCust.id);

                    const mappedItems = (proposal.items || []).map((item: any) => ({
                        ...item,
                        unitPrice: item.isPercentage ? (item.percentageRate || item.price || 0) : (item.price || 0),
                    }));
                    setItems(mappedItems as InternalProposalItem[]);
                    
                    setAdditionalFeePercent(proposal.additionalFeePercent || 0);
                    setAdditionalFeeName(proposal.additionalFeeName || 'Processing Fee');
                    setRecommendations(proposal.recommendations || '');
                    const mappedOption = proposal.selectedOption ? displayTierName(proposal.selectedOption) as Tier : null;
                    setSelectedOption(mappedOption);
                    if (mappedOption) setActiveTier(mappedOption);
                    setStep(2); 
                }
            }
        }
    }; checkProposal(); }, [editProposalId, state.proposals, state.customers, navigate]);

    useEffect(() => {
        if (!editProposalId) {
            hasLoadedRef.current = true;
        }
    }, [editProposalId]);

    useEffect(() => {
        const checkNewDraft = async () => {
            if (!editProposalId && jobIdRef.current) {
                const draftKey = `draft_field_proposal_${jobIdRef.current}`;
                const rawDraft = localStorage.getItem(draftKey);
                if (rawDraft) {
                    try {
                        const draft = JSON.parse(rawDraft);
                        const confirmRestore = await globalConfirm(
                            t("We found an unsaved draft for this proposal. Would you like to restore it?"),
                            t("Unsaved Draft Found"),
                            t("Restore Draft"),
                            t("Discard")
                        );
                        if (confirmRestore) {
                            setItems(draft.items || []);
                            setCustomerId(draft.customerId || '');
                            setRecommendations(draft.recommendations || '');
                            setActiveTier(draft.activeTier || 'Good');
                            setSelectedOption(draft.selectedOption || null);
                            setAdditionalFeePercent(draft.additionalFeePercent || 0);
                            setAdditionalFeeName(draft.additionalFeeName || 'Processing Fee');
                            setStep(draft.step || 1);
                            hasLoadedRef.current = true;
                            showToast.success(t("Draft restored!"));
                        } else {
                            localStorage.removeItem(draftKey);
                        }
                    } catch (e) {
                        console.error("Failed to restore new field proposal draft:", e);
                    }
                }
            }
        };
        checkNewDraft();
    }, [editProposalId, jobIdRef, t]);

    const calculateTierTotal = (tier: Tier) => {
        const tierItems = items.filter((i: InternalProposalItem) => matchTier(i.tier, tier));
        
        // Calculate base subtotal without percentage-based items
        const baseSubtotal = tierItems.filter(i => !i.isPercentage).reduce((sum: number, item: InternalProposalItem) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1)), 0);

        // Process items to calculate values for percentage-based items dynamically
        const processedItems = tierItems.map(item => {
            if (item.isPercentage) {
                // unitPrice represents the percentage (e.g. 10 for 10%)
                const calculatedAmount = baseSubtotal * (Number(item.unitPrice || 0) / 100);
                const finalAmount = item.type === 'Discount' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
                return { ...item, total: finalAmount * (item.quantity || 1) };
            }
            return item;
        });

        // Compute subtotal and tax using processed items
        const subtotal = processedItems.reduce((sum: number, item: InternalProposalItem) => {
            if (item.isPercentage) return sum + (item.total || 0);
            return sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1));
        }, 0);

        const taxableAmount = processedItems.filter(i => i.taxable !== false).reduce((sum: number, item: InternalProposalItem) => {
            if (item.isPercentage) return sum + (item.total || 0);
            return sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1));
        }, 0);

        const tax = taxableAmount * ((state.currentOrganization?.taxRate || 8.25) / 100);
        
        let total = subtotal + tax;
        const additionalFeeAmount = additionalFeePercent ? (total * (additionalFeePercent / 100)) : 0;
        total += additionalFeeAmount;

        return { subtotal, tax, total, additionalFeeAmount, items: processedItems };
    };

    const handleUpdateItem = (id: string, field: keyof InternalProposalItem, value: string | number | boolean) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                
                // 1. Handle type change rules
                if (field === 'type') {
                    if (value === 'Discount') {
                        updated.unitPrice = -Math.abs(Number(updated.unitPrice) || 0);
                        updated.taxable = false;
                    } else if (value === 'Fee') {
                        updated.unitPrice = Math.abs(Number(updated.unitPrice) || 0);
                    } else {
                        updated.unitPrice = Math.abs(Number(updated.unitPrice) || 0);
                        updated.taxable = value === 'Part';
                        updated.isPercentage = false; // Reset percentage for other types
                    }
                }

                // 2. Enforce negative/positive sign for Discount and Fee
                if (updated.type === 'Discount') {
                    if (!updated.isPercentage) {
                        updated.unitPrice = -Math.abs(Number(updated.unitPrice) || 0);
                    } else {
                        updated.unitPrice = Math.abs(Number(updated.unitPrice) || 0);
                    }
                    updated.taxable = false; // discounts are never taxable
                } else if (updated.type === 'Fee') {
                    updated.unitPrice = Math.abs(Number(updated.unitPrice) || 0);
                } else {
                    updated.unitPrice = Math.abs(Number(updated.unitPrice) || 0);
                }

                // 3. Recalculate static total
                if (field === 'unitPrice' || field === 'quantity' || field === 'type' || field === 'isPercentage') {
                    updated.total = (Number(updated.unitPrice) || 0) * (Number(updated.quantity) || 1);
                }

                return updated;
            }
            return item;
        }));
    };

    const handleDeleteItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const handleMoveItem = (id: string, direction: 'up' | 'down') => {
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return;

        const currentItem = items[idx];
        const itemTier = currentItem.tier;

        const sameTierIndices = items
            .map((item, i) => (matchTier(item.tier, itemTier) ? i : -1))
            .filter(i => i !== -1);

        const positionInTier = sameTierIndices.indexOf(idx);
        if (positionInTier === -1) return;

        const swapPosition = direction === 'up' ? positionInTier - 1 : positionInTier + 1;
        if (swapPosition < 0 || swapPosition >= sameTierIndices.length) return;

        const targetIndex = sameTierIndices[swapPosition];

        const updated = [...items];
        const temp = updated[idx];
        updated[idx] = updated[targetIndex];
        updated[targetIndex] = temp;
        setItems(updated);
    };

    const handleAddManualItem = (item: { name: string, description: string, quantity: number, price: number, type: string, isPercentage?: boolean, tier: Tier }) => {
        const newItem: InternalProposalItem = {
            id: `pi-man-${Date.now()}`,
            ...item,
            type: item.type as 'Part' | 'Labor' | 'Fee' | 'Discount' | 'Service',
            unitPrice: item.type === 'Discount' && !item.isPercentage ? -Math.abs(item.price) : Math.abs(item.price),
            partCost: 0, 
            laborHours: 0,
            hourlyRate: 0,
            margin: 0,
            total: item.type === 'Discount' && !item.isPercentage ? -Math.abs(item.price * item.quantity) : item.price * item.quantity, // This will be dynamically re-computed if isPercentage is true
            taxable: item.type === 'Part',
            isPercentage: item.isPercentage
        };
        setItems([...items, newItem]);
    };

    const handleAddFromPricebook = (preset: ProposalPreset) => {
        const laborRate = 120;
        const multiplier = state.currentOrganization?.marketMultiplier || 1.0;
        const newItems: InternalProposalItem[] = [];
        
        if (preset.baseCost > 0) {
            const partPrice = (preset.baseCost * 2) * multiplier;
            newItems.push({
                id: `pi-pb-p-${Date.now()}`,
                name: `${preset.name} (Part)`,
                description: preset.description,
                partCost: preset.baseCost,
                laborHours: 0,
                hourlyRate: 0,
                margin: 50,
                unitPrice: parseFloat(partPrice.toFixed(2)),
                type: 'Part',
                quantity: 1,
                total: parseFloat(partPrice.toFixed(2)),
                tier: activeTier,
                taxable: true
            });
        }

        if (preset.avgLabor > 0) {
             const laborPrice = (preset.avgLabor * laborRate) * multiplier;
             newItems.push({
                id: `pi-pb-l-${Date.now()}`,
                name: `${preset.name} (Labor)`,
                description: `Installation Labor (${preset.avgLabor} hrs)`,
                partCost: 0,
                laborHours: preset.avgLabor,
                hourlyRate: laborRate,
                margin: 100,
                unitPrice: parseFloat(laborPrice.toFixed(2)),
                type: 'Labor',
                quantity: 1,
                total: parseFloat(laborPrice.toFixed(2)),
                tier: activeTier,
                taxable: false
            });
        }
        
        if (newItems.length === 0) {
             newItems.push({
                id: `pi-pb-${Date.now()}`,
                name: preset.name,
                description: preset.description,
                partCost: 0,
                laborHours: 0,
                hourlyRate: 0,
                margin: 0,
                unitPrice: 0,
                type: 'Part',
                quantity: 1,
                total: 0,
                tier: activeTier,
                taxable: true
            });
        }

        setItems([...items, ...newItems]);
        setIsPricebookOpen(false);
    };

    const handleAcceptAiSuggestion = (suggestion: AISuggestion, targetTier: Tier) => {
        const laborRate = 120;
        const multiplier = state.currentOrganization?.marketMultiplier || 1.0;
        const newItems: InternalProposalItem[] = [];

        if (suggestion.baseCost > 0) {
            const partPrice = (suggestion.baseCost * 2) * multiplier;
            newItems.push({
                id: `pi-ai-part-${Date.now()}-${Math.random()}`,
                name: `${suggestion.name} (Material)`,
                description: suggestion.description,
                partCost: suggestion.baseCost,
                laborHours: 0,
                hourlyRate: 0,
                margin: 50,
                unitPrice: parseFloat(partPrice.toFixed(2)),
                type: 'Part',
                quantity: 1,
                total: parseFloat(partPrice.toFixed(2)),
                tier: targetTier.charAt(0).toUpperCase() + targetTier.slice(1).toLowerCase() as Tier,
                taxable: true
            });
        }

        if (suggestion.avgLabor > 0) {
            const laborPrice = (suggestion.avgLabor * laborRate) * multiplier;
            newItems.push({
                id: `pi-ai-labor-${Date.now()}-${Math.random()}`,
                name: `${suggestion.name} (Labor)`,
                description: `Installation Labor (~${suggestion.avgLabor} hrs)`,
                partCost: 0,
                laborHours: suggestion.avgLabor,
                hourlyRate: laborRate,
                margin: 100,
                unitPrice: parseFloat(laborPrice.toFixed(2)),
                type: 'Labor',
                quantity: 1,
                total: parseFloat(laborPrice.toFixed(2)),
                tier: targetTier.charAt(0).toUpperCase() + targetTier.slice(1).toLowerCase() as Tier,
                taxable: false
            });
        }

        setItems(prev => [...prev, ...newItems]);
        
        if (aiSuggestions) {
            const newSuggestions = { ...aiSuggestions };
            newSuggestions[targetTier.toLowerCase() as keyof AISuggestionSet] = 
                newSuggestions[targetTier.toLowerCase() as keyof AISuggestionSet].filter((s: AISuggestion) => s !== suggestion);
            setAiSuggestions(newSuggestions);
        }
    };

    const handleSaveProposal = async (action: 'saveDraft' | 'send' | 'accept' | 'verbalAccept', selectedEmails?: string[]) => {
        if (!customer || isSaving) return;

        let status: Proposal['status'];
        let signatureDataUrl: string | null = null;
        let finalSelectedOption: Tier | null = selectedOption;

        if (action === 'accept' || action === 'verbalAccept') {
            if (action === 'accept' && (!sigPadRef.current || sigPadRef.current.isEmpty())) {
                showToast.warn("Please sign the proposal to accept it.");
                return;
            }
            if (!selectedOption) {
                showToast.warn("Please select a pricing option (Basic, Premium, or Platinum) before accepting.");
                return;
            }
            status = 'Accepted';
            signatureDataUrl = action === 'verbalAccept' ? 'VERBAL_ACCEPTANCE' : (sigPadRef.current ? sigPadRef.current.toDataURL() : null);
        } else if (action === 'send') {
            status = 'Sent';
            finalSelectedOption = null; // Customer will select
        } else { // saveDraft
            status = 'Draft';
            finalSelectedOption = null; // Not yet selected
        }
        
        setIsSaving(true);
        
        const proposalId = editProposalId || await getNextProposalNumber(state.currentOrganization?.id || '');
        
        const getProcessedItems = () => {
            const baseSubtotals: Record<string, number> = { basic: 0, premium: 0, platinum: 0 };
            
            ['Basic', 'Premium', 'Platinum'].forEach(t => {
                const tItems = items.filter(i => matchTier(i.tier, t));
                baseSubtotals[t.toLowerCase()] = tItems.filter(i => !i.isPercentage).reduce((sum, i) => sum + (Number(i.unitPrice || 0) * Number(i.quantity || 1)), 0);
            });

            return items.map(item => {
                const itemTier = displayTierName(item.tier).toLowerCase();
                const { unitPrice, ...rest } = item;
                
                if (item.isPercentage) {
                    const calculatedAmount = (baseSubtotals[itemTier] || 0) * (Number(unitPrice || 0) / 100);
                    const finalAmount = item.type === 'Discount' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
                    return { ...rest, percentageRate: unitPrice, price: finalAmount, total: finalAmount * (item.quantity || 1) };
                }
                return { ...rest, price: unitPrice || 0 };
            });
        };

        const itemsToSave = getProcessedItems();

        const tierForTotals = selectedOption || activeTier;
        const { subtotal, tax, total, additionalFeeAmount } = calculateTierTotal(tierForTotals);

        const proposalLocationId = editProposalId 
            ? (state.proposals.find(p => p.id === editProposalId)?.locationId || locationId)
            : locationId;
            
        const proposalLocationName = editProposalId
            ? (state.proposals.find(p => p.id === editProposalId)?.locationName || associatedJob?.locationName || null)
            : (associatedJob?.locationName || null);

        const proposal: Proposal = {
            id: proposalId,
            jobId: jobIdRef.current,
            organizationId: state.currentOrganization?.id || '',
            technicianId: state.currentUser?.id || '',
            locationId: proposalLocationId,
            locationName: proposalLocationName,
            createdAt: state.proposals.find(p => p.id === editProposalId)?.createdAt || new Date().toISOString(),
            sentAt: action === 'send' ? new Date().toISOString() : (state.proposals.find(p => p.id === editProposalId)?.sentAt || null),
            remindersSent: state.proposals.find(p => p.id === editProposalId)?.remindersSent || [],
            customerName: customer.name,
            customerId: customer.id,
            customerEmail: selectedEmails && selectedEmails.length > 0 ? selectedEmails[0] : (customer.email || null),
            items: itemsToSave, 
            status,
            signatureDataUrl,
            selectedOption: finalSelectedOption,
            subtotal,
            taxAmount: tax,
            total,
            additionalFeePercent,
            additionalFeeName,
            additionalFeeAmount,
            recommendations: recommendations || '',
            poNumber: associatedJob?.poNumber || state.proposals.find(p => p.id === editProposalId)?.poNumber || null,
        };
        try {
            await db.collection('proposals').doc(proposalId).set(cleanUndefinedFields(proposal), { merge: true });
            
            const draftKey = `draft_field_proposal_${editProposalId || jobIdRef.current || 'new'}`;
            localStorage.removeItem(draftKey);
            
            if (jobIdRef.current) {
                await db.collection('jobs').doc(jobIdRef.current).update(cleanUndefinedFields({
                    proposalId: proposalId,
                    updatedAt: new Date().toISOString()
                }));
                const existingJob = state.jobs.find(j => j.id === jobIdRef.current);
                if (existingJob) {
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: { ...existingJob, proposalId: proposalId, updatedAt: new Date().toISOString() }
                    });
                }
            }
            
            // manually dispatch the update to the app's context
            dispatch({ 
                type: editProposalId ? 'UPDATE_PROPOSAL' : 'ADD_PROPOSAL', 
                payload: proposal 
            });

            // --- NOTIFY FIELD TECHNICIAN IMMEDIATELY ---
            if (action === 'accept' || action === 'verbalAccept') {
                const recipientId = proposal.technicianId || proposal.createdById;
                const modeText = action === 'verbalAccept' ? 'verbally ' : 'in person ';
                const notificationContent = `🎉 ${proposal.customerName || 'Your customer'} just ${modeText}accepted the "${finalSelectedOption}" option of Proposal ${proposal.id} for $${total.toFixed(2)}!`;
                
                try {
                    const { sendNotification, notifyAdmins } = await import('lib/notificationService');
                    const orgId = proposal.organizationId || state.currentOrganization?.id || '';
                    
                    if (recipientId) {
                        await sendNotification(recipientId, { title: 'Proposal Accepted In-Person', body: notificationContent, type: 'proposal_accepted' }, orgId);
                    }
                    if (orgId) {
                        await notifyAdmins(orgId, { title: 'Proposal Accepted In-Person', body: notificationContent, type: 'proposal_accepted' });
                    }
                } catch(e) { console.error('Failed to send push notifications', e); }

                if (recipientId) {
                    try {
                        await db.collection('messages').add(cleanUndefinedFields({
                            organizationId: proposal.organizationId || state.currentOrganization?.id || 'unknown',
                            senderId: 'system',
                            senderName: 'System Alerts',
                            receiverId: recipientId,
                            content: notificationContent,
                            type: 'alert',
                            timestamp: new Date().toISOString(),
                            read: false,
                            targetUrl: `/briefing/proposal?proposalId=${proposal.id}` 
                        }));
                    } catch(e) { console.error('Failed to notify tech', e); }
                }
            }

            if (action === 'send') {
                const emails = selectedEmails || (customer.email ? [customer.email] : []);
                if (emails.length > 0) {
                    const proposalLink = `${getBaseUrl()}/#/proposal-view/${proposalId}`;
                    await db.collection('mail_queue').add(cleanUndefinedFields({
                        to: emails,
                        replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                        message: {
                            subject: `New Proposal from ${state.currentOrganization?.name}`,
                            html: `<p>Hi ${customer.name}, we have a proposal for you. View it here: <a href="${proposalLink}">${proposalLink}</a></p>`,
                            replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                        },
                        organizationId: state.currentOrganization?.id,
                        type: 'ProposalLink',
                        createdAt: new Date().toISOString(),
                    }));
                }
            }
            
            // --- NAVIGATION LOGIC ---
            if (source === 'workflow' && jobIdRef.current) {
                dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: jobIdRef.current });
                navigate(`/briefing`);
            } else {
                 switch(action) {
                    case 'accept':
                    case 'verbalAccept':
                        showToast.warn("Proposal Accepted!");
                        navigate('/payments');
                        break;
                    case 'send':
                        showToast.warn("Proposal sent!");
                        navigate(-1);
                        break;
                    case 'saveDraft':
                        showToast.warn("Proposal saved successfully!");
                        navigate(-1);
                        break;
                }
            }
            
        } catch (e) { 
            console.error(e);
            showToast.warn('Save failed.'); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const generatePreviewData = () => {
        const { subtotal, tax, total, additionalFeeAmount } = calculateTierTotal(selectedOption || activeTier || 'Basic');
        
        const baseSubtotals: Record<string, number> = { basic: 0, premium: 0, platinum: 0 };
        ['Basic', 'Premium', 'Platinum'].forEach(t => {
            const tItems = items.filter(i => matchTier(i.tier, t));
            baseSubtotals[t.toLowerCase()] = tItems.filter(i => !i.isPercentage).reduce((sum, i) => sum + (Number(i.unitPrice || 0) * Number(i.quantity || 1)), 0);
        });

        const itemsToPreview = items.map(item => {
            const itemTier = displayTierName(item.tier).toLowerCase();
            const { unitPrice, ...rest } = item;
            if (item.isPercentage) {
                const calculatedAmount = (baseSubtotals[itemTier] || 0) * (Number(unitPrice || 0) / 100);
                const finalAmount = item.type === 'Discount' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
                return { ...rest, percentageRate: unitPrice, price: finalAmount, total: finalAmount * (item.quantity || 1) };
            }
            return { ...rest, price: unitPrice || 0 };
        });

        return {
            subtotal,
            taxAmount: tax,
            total,
            additionalFeePercent,
            additionalFeeName,
            additionalFeeAmount,
            customerName: customer?.name,
            items: itemsToPreview,
            selectedOption: null, // Force null so preview generates multi-tier layout automatically for technician to see
            recommendations: recommendations || '',
        };
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
        } else if (step === 2) {
            if (editProposalId || source === 'workflow') {
                navigate(-1);
            } else {
                setStep(1);
            }
        }
    };

    return (
        <div className="p-4 sm:p-8 pb-32 max-w-6xl mx-auto font-sans">
            <div className="mb-6 flex space-x-2">
                <button 
                    onClick={() => { window.history.length > 2 ? navigate(-1) : navigate('/admin/dashboard'); }}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                    &larr; {t("Exit Proposal Editor")}
                </button>
            </div>

            {isPreviewOpen && (
                <DocumentPreview 
                    type="Proposal" 
                    data={generatePreviewData()}
                    onClose={() => setIsPreviewOpen(false)} 
                    isInternal={true}
                    onSave={() => handleSaveProposal('saveDraft')}
                />
            )}

            {step === 1 && (
                <Card className="p-4 md:p-10 max-w-2xl mx-auto shadow-2xl rounded-3xl border-2 border-primary-50 bg-white dark:bg-slate-900">
                    <h2 className="text-3xl font-black mb-8 text-slate-900 dark:text-white">{t("New Proposal")}</h2>
                    <div className="mb-4 space-y-4">
                        <Input 
                            label={t("Search Customers")} 
                            placeholder={t("Type a name to filter...")} 
                            value={customerSearch} 
                            onChange={(e) => setCustomerSearch(e.target.value)} 
                        />
                        <Select label={customerSearch ? `${t("Filtered Results")} (${state.customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length})` : t("Select Customer")} value={customerId} onChange={e => setCustomerId(e.target.value)} data-tour="proposal-customer-select" className="h-14 text-lg">
                            <option value="">{t("-- Choose Customer --")}</option>
                            {state.customers
                                .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                    <div className="flex gap-4 mt-8">
                         <Button onClick={() => navigate(-1)} variant="secondary" className="h-14 px-4 md:px-8 text-xl font-bold">{t("Cancel")}</Button>
                         <Button onClick={() => setStep(2)} disabled={!customerId} data-tour="proposal-start-building-btn" className="flex-1 h-14 text-xl font-bold">{t("Start Building")} &rarr;</Button>
                    </div>
                </Card>
            )}

            {step === 2 && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex gap-2 bg-slate-200 dark:bg-slate-800 p-1.5 rounded-2xl max-w-xl mx-auto shadow-inner">
                        {(['Basic', 'Premium', 'Platinum'] as Tier[]).map(tier => (
                            <div 
                                key={tier}
                                role="button"
                                tabIndex={0}
                                onClick={() => setActiveTier(tier as Tier)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setActiveTier(tier as Tier);
                                    }
                                }}
                                className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${activeTier === tier ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-white shadow-xl' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} cursor-pointer`}
                            >
                                {t(tier)}
                            </div>
                        ))}
                    </div>

                    <Card className="p-4 md:p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl rounded-3xl bg-white dark:bg-slate-900">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
                            <button onClick={() => setActiveTool('ai')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTool === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Sparkles size={16}/> {t("AI Generator")}</button>
                            <button onClick={() => setIsPricebookOpen(true)} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300`}><Book size={16}/> {t("Pricebook")}</button>
                            <button onClick={() => setActiveTool('manual')} data-tour="proposal-manual-btn" className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTool === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Edit2 size={16}/> {t("Manual Entry")}</button>
                        </div>

                        {activeTool === 'ai' && <AIGenerator onSuggestions={setAiSuggestions} />}
                        {activeTool === 'manual' && <ManualEntry activeTier={activeTier} onAdd={handleAddManualItem} />}
                        {aiSuggestions && activeTool === 'ai' && <AISuggestionsList suggestions={aiSuggestions} onAccept={handleAcceptAiSuggestion} />}
                        
                        <ProposalItemsList items={calculateTierTotal(activeTier).items} activeTier={activeTier} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onMoveItem={handleMoveItem} />

                        {/* Additional Fees & Discounts */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                🏷️ {t("Global Fees & Discounts")}
                            </h4>
                            <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold tracking-widest">{t("Apply a percentage fee (e.g., Processing Fee = 3) or discount (e.g., Seasonal Discount = -10)")}</p>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <Input label={t("Adjustment Name")} value={additionalFeeName} onChange={e => setAdditionalFeeName(e.target.value)} placeholder={t("e.g. Processing Fee or Fall Discount")} />
                                </div>
                                <div className="flex-1">
                                    <Input label={t("Percentage (%)")} type="number" value={additionalFeePercent} onChange={e => setAdditionalFeePercent(parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                        </div>

                        {/* Technician Recommendations */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                💡 {t("Technician Recommendations")}
                            </h4>
                            <p className="text-[10px] text-slate-500 mb-3 uppercase font-bold tracking-widest">{t("Provide proactive service advice to the customer")}</p>
                            <textarea
                                className="w-full min-h-[80px] p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 transition-all resize-none text-slate-700 dark:text-slate-200"
                                value={recommendations}
                                onChange={e => setRecommendations(e.target.value)}
                                placeholder={t("e.g. Recommend replacing the capacitor within the next 6 months...")}
                            />
                        </div>

                        <div className="mt-12 flex justify-between items-end border-t border-slate-200 dark:border-slate-700 pt-8">
                            <div className="text-right flex-1">
                                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase mb-1">{t(activeTier)} {t("Option Total")}</p>
                                <div className="text-5xl font-black text-primary-600 dark:text-primary-400 tracking-tighter">${calculateTierTotal(activeTier).total.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={handleBack} className="px-4 md:px-8 font-bold">
                                {editProposalId || source === 'workflow' ? t('Cancel') : t('Back')}
                            </Button>
                            <Button variant="outline" onClick={() => handleSaveProposal('saveDraft')} disabled={isSaving} className="px-4 md:px-8 font-bold flex items-center gap-2">
                                <Save size={16} /> {isSaving ? t('Saving...') : t('Save')}
                            </Button>
                            <Button onClick={() => setStep(3)} disabled={items.length === 0} data-tour="proposal-next-step-btn" className="flex-1 h-14 text-xl font-black shadow-xl shadow-primary-500/30">{t("Review & Present")} &rarr;</Button>
                        </div>
                    </Card>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-10 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(['Basic', 'Premium', 'Platinum'] as Tier[]).map(tier => {
                            const { total, items: tierItems, additionalFeeAmount } = calculateTierTotal(tier);
                            const isSelected = selectedOption === tier;
                            if (tierItems.length === 0) return null;
                            return (
                                <div 
                                    key={tier} 
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedOption(tier)} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedOption(tier);
                                        }
                                    }}
                                    className={`relative p-4 md:p-10 rounded-[2.5rem] border-4 cursor-pointer transition-all duration-500 ${isSelected ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 shadow-2xl scale-105' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                                >
                                    <h3 className={`text-center font-black text-2xl uppercase mb-8 ${isSelected ? 'text-primary-700 dark:text-white' : 'text-slate-900 dark:text-slate-200'}`}>{t(tier)}</h3>
                                    <div className="text-center mb-10">
                                        <div className={`text-6xl font-black tracking-tighter ${isSelected ? 'text-primary-700 dark:text-white' : 'text-slate-900 dark:text-white'}`}>${total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                                        {!!additionalFeeAmount && (
                                            <div className={`text-sm font-bold mt-2 ${additionalFeeAmount < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                {t("Includes")} {additionalFeePercent}% {additionalFeeName || t('Adjustment')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4 mb-10">
                                        {tierItems.map(i => (
                                            <div key={i.id} className="flex flex-col gap-1">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle size={16} className="text-emerald-500 mt-1 shrink-0" />
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>{i.name}</p>
                                                </div>
                                                {i.description && (
                                                    <p className={`text-xs ml-7 italic leading-snug whitespace-pre-wrap ${isSelected ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>{i.description}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{isSelected && <CheckCircle size={16}/>}</div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <Card className="p-4 md:p-10 border-2 border-slate-200 dark:border-slate-700 shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{t("Customer Authorization")}</h3>
                            <Button onClick={() => setIsPreviewOpen(true)} variant="secondary" className="w-auto flex items-center gap-2 text-xs font-black"><Eye size={16}/> {t("Preview")}</Button>
                        </div>
                        <div data-tour="proposal-sig-pad">
                            <SignaturePad ref={sigPadRef} className="h-44 shadow-inner mb-8 bg-slate-50 dark:bg-slate-800 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <Button variant="secondary" onClick={() => setStep(2)} className="h-16 font-bold text-sm md:text-base">{t("Modify")}</Button>
                            <Button variant="outline" onClick={() => handleSaveProposal('saveDraft')} disabled={isSaving} className="h-16 font-bold text-sm md:text-base flex items-center justify-center gap-2">
                                <Save size={16} /> {isSaving ? t('Saving...') : t('Save')}
                            </Button>
                            <Button onClick={() => setIsRecipientModalOpen(true)} disabled={isSaving} className="h-16 font-black bg-indigo-600 hover:bg-indigo-700 text-sm md:text-base flex items-center justify-center gap-2"><Mail size={18} className="hidden md:block"/> {t("Email")}</Button>
                            <Button onClick={() => { if(window.confirm(t('Are you sure the customer has verbally agreed to this proposal?'))) handleSaveProposal('verbalAccept'); }} disabled={!selectedOption || isSaving} className="h-16 font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xl text-sm md:text-base leading-tight">{t("Verbal")}<br/>{t("Accept")}</Button>
                            <Button onClick={() => handleSaveProposal('accept')} disabled={!selectedOption || isSaving} data-tour="proposal-submit-btn" className="h-16 font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl text-sm md:text-base leading-tight flex items-center justify-center gap-1 md:gap-2"><CheckCircle size={18} className="hidden md:block"/> {t("Sign &")}<br className="md:hidden"/> {t("Accept")}</Button>
                        </div>
                    </Card>
                </div>
            )}

            <PricebookModal 
                isOpen={isPricebookOpen}
                onClose={() => setIsPricebookOpen(false)} 
                searchQuery={pricebookSearch} 
                onSearchChange={setPricebookSearch} 
                presets={filteredPresets} 
                onSelect={handleAddFromPricebook} 
                marketMultiplier={state.currentOrganization?.marketMultiplier || 1.0} 
            />

            {isRecipientModalOpen && (
                <RecipientSelectorModal
                    isOpen={isRecipientModalOpen}
                    onClose={() => setIsRecipientModalOpen(false)}
                    customerId={customerId}
                    locationId={locationId}
                    title="Select Proposal Recipients"
                    onConfirm={(emails) => {
                        handleSaveProposal('send', emails);
                        setIsRecipientModalOpen(false);
                    }}
                />
            )}
        </div>
    );
    // Auto-save draft changes for Field Proposal
    useEffect(() => {
        if (!hasLoadedRef.current) return;

        const original = editProposalId ? state.proposals.find(p => p.id === editProposalId) : null;
        
        const baseSubtotals: Record<string, number> = { basic: 0, premium: 0, platinum: 0 };
        ['Basic', 'Premium', 'Platinum'].forEach(t => {
            const tItems = items.filter(i => matchTier(i.tier, t));
            baseSubtotals[t.toLowerCase()] = tItems.filter(i => !i.isPercentage).reduce((sum, i) => sum + (Number(i.unitPrice || 0) * Number(i.quantity || 1)), 0);
        });

        const itemsToCompare = items.map(item => {
            const itemTier = displayTierName(item.tier).toLowerCase();
            const { unitPrice, ...rest } = item;
            if (item.isPercentage) {
                const calculatedAmount = (baseSubtotals[itemTier] || 0) * (Number(unitPrice || 0) / 100);
                const finalAmount = item.type === 'Discount' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
                return { ...rest, percentageRate: unitPrice, price: finalAmount, total: finalAmount * (item.quantity || 1) };
            }
            return { ...rest, price: unitPrice || 0 };
        });

        const hasChanges = !original ? (
            items.length > 0 ||
            customerId !== '' ||
            recommendations !== '' ||
            activeTier !== 'Basic' ||
            selectedOption !== null ||
            additionalFeePercent !== 0 ||
            additionalFeeName !== 'Processing Fee' ||
            step !== 1
        ) : (
            JSON.stringify(itemsToCompare) !== JSON.stringify(original.items || []) ||
            customerId !== (state.customers.find((c: Customer) => c.name === original.customerName)?.id || '') ||
            recommendations !== (original.recommendations || '') ||
            activeTier !== (original.selectedOption ? displayTierName(original.selectedOption) as Tier : 'Basic') ||
            selectedOption !== (original.selectedOption ? displayTierName(original.selectedOption) as Tier : null) ||
            additionalFeePercent !== (original.additionalFeePercent || 0) ||
            additionalFeeName !== (original.additionalFeeName || 'Processing Fee') ||
            step !== 2
        );

        const draftKey = `draft_field_proposal_${editProposalId || jobIdRef.current || 'new'}`;
        if (hasChanges) {
            const draftData = {
                items,
                customerId,
                recommendations,
                activeTier,
                selectedOption,
                additionalFeePercent,
                additionalFeeName,
                step
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
        } else {
            localStorage.removeItem(draftKey);
        }
    }, [
        items,
        customerId,
        recommendations,
        activeTier,
        selectedOption,
        additionalFeePercent,
        additionalFeeName,
        step,
        editProposalId,
        jobIdRef,
        state.proposals,
        state.customers
    ]);

};

export default FieldProposal;
