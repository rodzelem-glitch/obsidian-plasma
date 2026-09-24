import showToast from "lib/toast";
import { getBaseUrl, matchTier, displayTierName, cleanUndefinedFields, createEmailButtonHtml, extractJobRecommendations } from "lib/utils";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { CheckCircle, Eye, Sparkles, Edit2, Mail, Book, Save, Plus, TrendingDown, ChevronDown, ChevronUp, Layers, ShieldCheck, FileText, Check } from 'lucide-react';
import { db } from 'lib/firebase';
import { getNextProposalNumber, resolveJobProposalNumber } from 'lib/numbering';
import type { Proposal, ProposalItem, SubLineItem, ProposalPreset, Customer } from 'types';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import DocumentPreview from 'components/ui/DocumentPreview';
import Input from 'components/ui/Input';
import AutoResizeTextarea from 'components/ui/AutoResizeTextarea';

// Modular Components
import AIGenerator, { AISuggestion, AISuggestionSet } from './field-proposal/components/AIGenerator';
import AISuggestionsList from './field-proposal/components/AISuggestionsList';
import ManualEntry from './field-proposal/components/ManualEntry';
import ProposalItemsList from './field-proposal/components/ProposalItemsList';
import PricebookModal from './field-proposal/components/PricebookModal';
import { globalConfirm } from "lib/globalConfirm";
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import { LocationSearchSelector } from 'components/common/LocationSearchSelector';
import { generateProposalPdfAttachment } from 'lib/pdfHelper';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { sanitizeEmailAttachments } from 'lib/notificationService';
import { calculateCustomerPartMarkup } from 'lib/estimatorRules';

type Tier = 'Basic' | 'Premium' | 'Platinum';
type AddTool = 'ai' | 'manual' | 'pricebook';

const toFieldTier = (opt: string | undefined | null): Tier => {
    if (!opt) return 'Basic';
    if (matchTier(opt, 'Platinum')) return 'Platinum';
    if (matchTier(opt, 'Premium')) return 'Premium';
    return 'Basic';
};

// Change ProposalItem to use unitPrice internally
type InternalProposalItem = Omit<ProposalItem, 'price' | 'tier'> & { 
    unitPrice: number; 
    isPercentage?: boolean; 
    tier: Tier;
    cost?: number;
    vendorCost?: number;
    partCost?: number;
    markupPct?: number;
    margin?: number;
};

const FieldProposal: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const jobIdRef = useRef<string | null>(searchParams.get('jobId'));
    const editProposalId = searchParams.get('proposalId');
    const source = searchParams.get('source');
    
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [step1Mode, setStep1Mode] = useState<'job' | 'standalone'>('job');
    const [jobSearch, setJobSearch] = useState('');
    const [title, setTitle] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [selectedLocationName, setSelectedLocationName] = useState<string>('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [items, setItems] = useState<InternalProposalItem[]>([]);
    const [recommendations, setRecommendations] = useState('');
    const [displayFormat, setDisplayFormat] = useState<'itemized' | 'progressive'>('itemized');
    const [pricingDisclaimer, setPricingDisclaimer] = useState<string>('');
    const [warrantyTerms, setWarrantyTerms] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTier, setActiveTier] = useState<Tier>('Basic');
    const [selectedOption, setSelectedOption] = useState<Tier | null>(null);
    const [proposalStatus, setProposalStatus] = useState<Proposal['status']>('Draft');
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
    const [signedAt, setSignedAt] = useState<string | null>(null);
    const [isUnlockedForEdit, setIsUnlockedForEdit] = useState<boolean>(false);
    
    const [additionalFeePercent, setAdditionalFeePercent] = useState<number>(0);
    const [additionalFeeName, setAdditionalFeeName] = useState<string>('Processing Fee');
    
    // Deposit / Down Payment State
    const [requireDeposit, setRequireDeposit] = useState<boolean>(false);
    const [depositType, setDepositType] = useState<'flat' | 'percentage'>('flat');
    const [depositValue, setDepositValue] = useState<number>(0);
    const [depositNotes, setDepositNotes] = useState<string>('');
    const [depositPaid, setDepositPaid] = useState<boolean>(false);
    
    // Mobile navigation & accordion collapses
    const [collapsedSections, setCollapsedSections] = useState<{
        fees: boolean;
        deposit: boolean;
        recommendations: boolean;
        disclaimer: boolean;
        warranty: boolean;
    }>({
        fees: true,
        deposit: true,
        recommendations: true,
        disclaimer: true,
        warranty: true,
    });

    const toggleSection = (sec: 'fees' | 'deposit' | 'recommendations' | 'disclaimer' | 'warranty') => {
        setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const [mobilePresentationTier, setMobilePresentationTier] = useState<Tier | 'all'>('Basic');

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

    // Contracted rate overrides from Customer pricing rules
    const customerContractedRate = customer?.pricingRules?.contractedRate ?? customer?.pricingRules?.standardRate;
    const customerMarkupPct = customer?.pricingRules?.markupPercentage ?? customer?.pricingRules?.partsMarkupPercentage;

    const effectiveLaborRate = useMemo(() => {
        if (customerContractedRate !== undefined && Number(customerContractedRate) > 0) {
            return Number(customerContractedRate);
        }
        return state.currentOrganization?.laborRate ?? state.currentOrganization?.hourlyLaborRate ?? 120;
    }, [customerContractedRate, state.currentOrganization?.laborRate, state.currentOrganization?.hourlyLaborRate]);

    const effectiveMarkupPct = useMemo(() => {
        if (customerMarkupPct !== undefined && Number(customerMarkupPct) >= 0) {
            return Number(customerMarkupPct);
        }
        return state.currentOrganization?.markupPct ?? state.currentOrganization?.defaultMarkupPct ?? 50;
    }, [customerMarkupPct, state.currentOrganization?.markupPct, state.currentOrganization?.defaultMarkupPct]);

    const getTierLabel = (tierName: string) => {
        const hasGBB = items.some((i: InternalProposalItem) => {
            const t = (i.tier || '').toLowerCase();
            return t === 'good' || t === 'better' || t === 'best';
        });
        const lower = (tierName || '').toLowerCase();
        if (lower === 'basic' || lower === 'good') return hasGBB ? t('Good') : t('Basic');
        if (lower === 'premium' || lower === 'better') return hasGBB ? t('Better') : t('Premium');
        if (lower === 'platinum' || lower === 'best') return hasGBB ? t('Best') : t('Platinum');
        return t(tierName);
    };

    const filteredPresets = useMemo(() => {
        return (state.proposalPresets as ProposalPreset[]).filter(p => {
            // Customer isolation: if a preset is scoped to a specific customer, only show it when that customer is selected
            if ((p as any).customerId && (p as any).customerId !== customerId) {
                return false;
            }
            return p.name.toLowerCase().includes(pricebookSearch.toLowerCase()) || 
                (p.category && p.category.toLowerCase().includes(pricebookSearch.toLowerCase()));
        });
    }, [state.proposalPresets, pricebookSearch, customerId]);

    useEffect(() => {
        if (jobIdRef.current) {
            const job = state.jobs.find(j => j.id === jobIdRef.current);
            if (job) {
                if (!customerId) setCustomerId(job.customerId || '');
                if (!title) setTitle(`Proposal for ${job.customerName || 'Work Order'} (WO #${job.poNumber || job.id.slice(-6)})`);
                setStep(2);
            }
        }
    }, [jobIdRef, customerId, title, state.jobs]);

    const handleImportJobDiagnostics = () => {
        if (!associatedJob) {
            showToast.error(t("No work order linked to import diagnostic line items from!"));
            return;
        }

        const imported: InternalProposalItem[] = [];

        // 1. Extract from associatedJob.invoice?.items
        if (associatedJob.invoice?.items && Array.isArray(associatedJob.invoice.items)) {
            associatedJob.invoice.items.forEach((invItem: any, idx: number) => {
                imported.push({
                    id: `diag-inv-${Date.now()}-${idx}`,
                    name: invItem.name || invItem.description || 'Job Diagnostic Item',
                    description: invItem.description || `Diagnosed on work order #${associatedJob.poNumber || associatedJob.id.slice(-6)}`,
                    unitPrice: Number(invItem.amount || invItem.price || invItem.total || 0),
                    quantity: Number(invItem.quantity || 1),
                    type: 'Service',
                    tier: activeTier || 'Basic',
                    taxable: false,
                    total: (Number(invItem.amount || invItem.price || invItem.total || 0)) * (Number(invItem.quantity || 1))
                });
            });
        }

        // 2. Extract from associatedJob.unitStates (equipment unit work & line items)
        if (associatedJob.unitStates && Array.isArray(associatedJob.unitStates)) {
            associatedJob.unitStates.forEach((unitState: any) => {
                if (unitState.unitLineItems && Array.isArray(unitState.unitLineItems)) {
                    unitState.unitLineItems.forEach((uItem: any, idx: number) => {
                        imported.push({
                            id: `diag-unit-${unitState.assetId}-${Date.now()}-${idx}`,
                            name: uItem.name || uItem.description || `Unit ${unitState.unitName || unitState.assetId} Repair`,
                            description: uItem.description || `Diagnosed repair for equipment unit ${unitState.unitName || unitState.assetId}`,
                            unitPrice: Number(uItem.amount || uItem.price || uItem.total || 0),
                            quantity: Number(uItem.quantity || 1),
                            type: 'Part',
                            tier: activeTier || 'Basic',
                            taxable: true,
                            total: (Number(uItem.amount || uItem.price || uItem.total || 0)) * (Number(uItem.quantity || 1))
                        });
                    });
                }
            });
        }

        // 3. Extract from associatedJob.parts or associatedJob.lineItems
        if ((associatedJob as any).parts && Array.isArray((associatedJob as any).parts)) {
            (associatedJob as any).parts.forEach((pItem: any, idx: number) => {
                imported.push({
                    id: `diag-part-${Date.now()}-${idx}`,
                    name: pItem.name || pItem.partName || 'Replacement Part',
                    description: pItem.description || `Part recorded during site diagnosis`,
                    unitPrice: Number(pItem.price || pItem.unitPrice || pItem.amount || 0),
                    quantity: Number(pItem.quantity || 1),
                    type: 'Part',
                    tier: activeTier || 'Basic',
                    taxable: true,
                    total: (Number(pItem.price || pItem.unitPrice || pItem.amount || 0)) * (Number(pItem.quantity || 1))
                });
            });
        }

        if (imported.length === 0) {
            showToast.error(t("No diagnostic line items found on this job yet. Add items in Unit Work or Invoice first."));
            return;
        }

        // Filter out duplicates by name
        const existingNames = new Set(items.map(i => i.name.toLowerCase().trim()));
        const newOnly = imported.filter(i => !existingNames.has(i.name.toLowerCase().trim()));

        if (newOnly.length === 0) {
            showToast.info(t("All diagnostic line items from this job have already been imported!"));
            return;
        }

        setItems(prev => [...prev, ...newOnly]);
        showToast.success(`Imported ${newOnly.length} diagnostic line item(s) from Job #${associatedJob.poNumber || associatedJob.id.slice(-6)}!`);
    };

    const autoImportedRef = useRef(false);
    useEffect(() => {
        if (associatedJob && items.length === 0 && !editProposalId && !autoImportedRef.current) {
            autoImportedRef.current = true;
            const hasInvItems = associatedJob.invoice?.items && associatedJob.invoice.items.length > 0;
            const hasUnitItems = associatedJob.unitStates && associatedJob.unitStates.some((u: any) => u.unitLineItems && u.unitLineItems.length > 0);
            if (hasInvItems || hasUnitItems) {
                handleImportJobDiagnostics();
            }
        }
    }, [associatedJob, items.length, editProposalId]);

    const isNewRequested = searchParams.get('new') === 'true';

    const handleCreateNewProposalForJob = () => {
        setItems([]);
        setTitle(`Proposal #${(state.proposals.length || 0) + 1} for ${associatedJob?.customerName || 'Work Order'} (WO #${associatedJob?.poNumber || associatedJob?.id.slice(-6)})`);
        setRecommendations('');
        setSelectedOption(null);
        setActiveTier('Basic');
        setProposalStatus('Draft');
        setSignatureDataUrl(null);
        setSignedAt(null);
        setAdditionalFeePercent(0);
        setAdditionalFeeName('Processing Fee');
        setDepositType('flat');
        setDepositValue(0);
        setDepositNotes('');
        setDepositPaid(false);
        setStep(2);
        navigate(`${location.pathname}?jobId=${jobIdRef.current}&new=true${source ? `&source=${source}` : ''}`, { replace: true });
        showToast.success(t("Started a new clean slate proposal linked to this job!"));
    };

    const [hasCheckedExisting, setHasCheckedExisting] = useState(false);

    useEffect(() => {
        const checkExisting = () => {
            if (jobIdRef.current && !editProposalId && !isNewRequested && !hasCheckedExisting && state.proposals.length > 0) {
                setHasCheckedExisting(true);
                const existing = state.proposals.find(p => (p.jobId === jobIdRef.current || (associatedJob?.linkedProposalIds && associatedJob.linkedProposalIds.includes(p.id)) || associatedJob?.proposalId === p.id) && p.status !== 'Cancelled');
                if (existing) {
                    navigate(`${location.pathname}?proposalId=${existing.id}&jobId=${jobIdRef.current}${source ? `&source=${source}` : ''}`, { replace: true });
                }
            }
        };
        checkExisting();
    }, [jobIdRef, editProposalId, isNewRequested, hasCheckedExisting, state.proposals, associatedJob, source, navigate, location.pathname]);

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
                        const restoredItems = (draft.items || []).map((item: any) => {
                            const rawCost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
                            const unitPrice = Number(item.unitPrice ?? (item.isPercentage ? (item.percentageRate || item.price || 0) : (item.price || 0)));
                            let rawMarkup = item.markupPct !== undefined ? Number(item.markupPct) : (item.margin !== undefined ? Number(item.margin) : undefined);
                            if (rawMarkup === undefined && rawCost > 0 && unitPrice > 0) {
                                rawMarkup = Number((((unitPrice - rawCost) / rawCost) * 100).toFixed(1));
                            }
                            return {
                                ...item,
                                cost: rawCost,
                                vendorCost: rawCost,
                                partCost: rawCost,
                                markupPct: rawMarkup ?? 0,
                                margin: rawMarkup ?? 0,
                                unitPrice: unitPrice
                            };
                        });
                        setItems(restoredItems);
                        setTitle(draft.title || '');
                        setCustomerId(draft.customerId || '');
                        setRecommendations(draft.recommendations || '');
                        setDisplayFormat(draft.displayFormat || 'itemized');
                        setPricingDisclaimer(draft.pricingDisclaimer || '');
                        setWarrantyTerms(draft.warrantyTerms || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                        setActiveTier(draft.activeTier || 'Good');
                        setSelectedOption(draft.selectedOption || null);
                        setAdditionalFeePercent(draft.additionalFeePercent || 0);
                        setAdditionalFeeName(draft.additionalFeeName || 'Processing Fee');
                        const hasDraftDep = draft.requireDeposit ?? ((draft.depositValue && draft.depositValue > 0) || (draft.depositAmount && draft.depositAmount > 0));
                        setRequireDeposit(Boolean(hasDraftDep));
                        setDepositType(draft.depositType || 'flat');
                        setDepositValue(draft.depositValue || 0);
                        setDepositNotes(draft.depositNotes || '');
                        setDepositPaid(draft.depositPaid || false);
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
                    
                    setProposalStatus(proposal.status || 'Draft');
                    setSignatureDataUrl(proposal.signatureDataUrl || null);
                    setSignedAt(proposal.signedAt || null);

                    hasLoadedRef.current = true;
                    setTitle(proposal.title || '');
                    const exactCust = state.customers.find((c: Customer) => c.name === proposal.customerName);
                    if (exactCust) setCustomerId(exactCust.id);

                    const mappedItems = (proposal.items || []).map((item: any) => {
                        const rawCost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
                        const unitPrice = item.isPercentage ? (item.percentageRate || item.price || 0) : (item.price || 0);
                        let rawMarkup = item.markupPct !== undefined ? Number(item.markupPct) : (item.margin !== undefined ? Number(item.margin) : undefined);
                        if (rawMarkup === undefined && rawCost > 0 && unitPrice > 0) {
                            rawMarkup = Number((((unitPrice - rawCost) / rawCost) * 100).toFixed(1));
                        }
                        return {
                            ...item,
                            cost: rawCost,
                            vendorCost: rawCost,
                            partCost: rawCost,
                            markupPct: rawMarkup ?? 0,
                            margin: rawMarkup ?? 0,
                            unitPrice: unitPrice,
                        };
                    });
                    setItems(mappedItems as InternalProposalItem[]);
                    
                    setAdditionalFeePercent(proposal.additionalFeePercent || 0);
                    setAdditionalFeeName(proposal.additionalFeeName || 'Processing Fee');
                    const hasPropDep = proposal.requireDeposit ?? ((proposal.depositValue && proposal.depositValue > 0) || (proposal.depositAmount && proposal.depositAmount > 0));
                    setRequireDeposit(Boolean(hasPropDep));
                    setDepositType(proposal.depositType || 'flat');
                    setDepositValue(proposal.depositValue || 0);
                    setDepositNotes(proposal.depositNotes || '');
                    setDepositPaid(!!proposal.depositPaid);
                    setRecommendations(proposal.recommendations || '');
                    setDisplayFormat(proposal.displayFormat || 'itemized');
                    setPricingDisclaimer(proposal.pricingDisclaimer || (state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || '');
                    setWarrantyTerms(proposal.warrantyTerms || proposal.warrantyDisclaimer || (proposal as any)?.warrantyNotes || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                    const mappedOption = proposal.selectedOption ? toFieldTier(proposal.selectedOption) : null;
                    setSelectedOption(mappedOption);
                    if (mappedOption) setActiveTier(mappedOption);
                    setStep(2); 
                }
            }
        }
    }; checkProposal(); }, [editProposalId, state.proposals, state.customers, navigate, state.currentOrganization]);

    useEffect(() => {
        if (!editProposalId) {
            hasLoadedRef.current = true;
            if (!pricingDisclaimer && state.currentOrganization) {
                setPricingDisclaimer((state.currentOrganization as any).pricingDisclaimer || (state.currentOrganization as any).proposalDisclaimer || "Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability.");
            }
            if (!warrantyTerms && state.currentOrganization) {
                setWarrantyTerms((state.currentOrganization as any).warrantyTerms || (state.currentOrganization as any).warrantyDisclaimer || '');
            }
        }
    }, [editProposalId, state.currentOrganization]);

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
                            setDisplayFormat(draft.displayFormat || 'itemized');
                            setPricingDisclaimer(draft.pricingDisclaimer || '');
                            setWarrantyTerms(draft.warrantyTerms || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
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

    const handleImportJobRecommendations = async () => {
        if (!associatedJob) {
            showToast.warn(t("No associated job record found for this proposal."));
            return;
        }
        const extracted = extractJobRecommendations(associatedJob);
        if (!extracted || !extracted.trim()) {
            showToast.warn(t("No recommendations, unit inspection notes, or diagnostic findings found on this job record."));
            return;
        }

        if (recommendations && recommendations.trim()) {
            const shouldOverwrite = await globalConfirm(
                t("Would you like to overwrite existing recommendations or append to them?"),
                t("Import Job Recommendations"),
                t("Overwrite"),
                t("Append")
            );
            if (shouldOverwrite) {
                setRecommendations(extracted);
            } else {
                setRecommendations(prev => `${prev}\n\n${extracted}`);
            }
        } else {
            setRecommendations(extracted);
        }
        showToast.success(t("Recommendations successfully imported from job!"));
    };

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

        let depositAmount = 0;
        if (requireDeposit && depositValue > 0) {
            depositAmount = depositType === 'percentage'
                ? parseFloat(((total * depositValue) / 100).toFixed(2))
                : parseFloat(depositValue.toFixed(2));
        }

        return { subtotal, tax, total, additionalFeeAmount, depositAmount, items: processedItems };
    };

    const handleUpdateItem = (id: string, field: keyof InternalProposalItem, value: string | number | boolean) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                
                // 1. Cost & Markup calculation rules
                if (field === 'cost' || (field as string) === 'vendorCost' || (field as string) === 'partCost') {
                    const numericCost = Math.max(0, Number(value) || 0);
                    updated.cost = numericCost;
                    updated.vendorCost = numericCost;
                    updated.partCost = numericCost;

                    let markup = item.markupPct ?? item.margin;
                    // If markup is not yet set or 0, calculate default markup via customer contracted rates or tiered schedule
                    if (markup === undefined || markup === null || markup === 0) {
                        markup = calculateCustomerPartMarkup(
                            numericCost,
                            customer?.pricingRules?.partsMarkupRules,
                            effectiveMarkupPct,
                            { tier1: customer?.pricingRules?.partsMarkupTier1, tier2: customer?.pricingRules?.partsMarkupTier2 }
                        );
                    }
                    updated.markupPct = markup;
                    updated.margin = markup;

                    if (numericCost > 0) {
                        updated.unitPrice = Number((numericCost * (1 + markup / 100)).toFixed(2));
                    }
                } else if (field === 'markupPct' || (field as string) === 'margin') {
                    const markup = Number(value) || 0;
                    updated.markupPct = markup;
                    updated.margin = markup;
                    const cost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
                    if (cost > 0) {
                        updated.unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
                    }
                } else if (field === 'unitPrice') {
                    const unitPrice = Number(value) || 0;
                    const cost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
                    if (cost > 0) {
                        const calculatedMarkup = Number((((unitPrice - cost) / cost) * 100).toFixed(1));
                        updated.markupPct = calculatedMarkup;
                        updated.margin = calculatedMarkup;
                    }
                }

                // 2. Handle type change rules
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

                // 3. Enforce negative/positive sign for Discount and Fee
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

                // 4. Recalculate static total
                if (
                    field === 'unitPrice' || field === 'quantity' || field === 'type' || 
                    field === 'isPercentage' || field === 'cost' || (field as string) === 'vendorCost' || 
                    (field as string) === 'partCost' || field === 'markupPct' || (field as string) === 'margin'
                ) {
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

    const handleAddSubItem = (itemId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newSub: SubLineItem = {
                    id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    total: 0
                };
                const updatedSubItems = [...(item.subItems || []), newSub];
                const subSum = updatedSubItems.reduce((sum, s) => sum + (s.total || 0), 0);
                const effectiveUnitPrice = subSum > 0 ? subSum : item.unitPrice;
                const effectiveTotal = (item.quantity || 1) * effectiveUnitPrice;
                return {
                    ...item,
                    subItems: updatedSubItems,
                    unitPrice: effectiveUnitPrice,
                    total: effectiveTotal
                };
            }
            return item;
        }));
    };

    const handleUpdateSubItem = (itemId: string, subItemId: string, field: keyof SubLineItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId && item.subItems) {
                const updatedSubItems = item.subItems.map(sub => {
                    if (sub.id === subItemId) {
                        const updatedSub = { ...sub, [field]: value };
                        if (field === 'quantity' || field === 'unitPrice') {
                            const q = field === 'quantity' ? (parseFloat(value) || 0) : (sub.quantity || 0);
                            const p = field === 'unitPrice' ? (parseFloat(value) || 0) : (sub.unitPrice || 0);
                            updatedSub.total = q * p;
                        }
                        return updatedSub;
                    }
                    return sub;
                });
                const subSum = updatedSubItems.reduce((sum, s) => sum + (s.total || 0), 0);
                const effectiveUnitPrice = subSum > 0 ? subSum : item.unitPrice;
                const effectiveTotal = (item.quantity || 1) * effectiveUnitPrice;
                return {
                    ...item,
                    subItems: updatedSubItems,
                    unitPrice: effectiveUnitPrice,
                    total: effectiveTotal
                };
            }
            return item;
        }));
    };

    const handleDeleteSubItem = (itemId: string, subItemId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId && item.subItems) {
                const filtered = item.subItems.filter(sub => sub.id !== subItemId);
                const subSum = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
                const effectiveUnitPrice = subSum > 0 ? subSum : item.unitPrice;
                const effectiveTotal = (item.quantity || 1) * effectiveUnitPrice;
                return {
                    ...item,
                    subItems: filtered.length > 0 ? filtered : undefined,
                    unitPrice: effectiveUnitPrice,
                    total: effectiveTotal
                };
            }
            return item;
        }));
    };

    const handleAddManualItem = (item: { 
        name: string, 
        description: string, 
        quantity: number, 
        price: number, 
        type: string, 
        isPercentage?: boolean, 
        tier: Tier,
        cost?: number,
        vendorCost?: number,
        partCost?: number,
        markupPct?: number,
        margin?: number
    }) => {
        const rawCost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
        const rawMarkup = item.markupPct !== undefined 
            ? Number(item.markupPct) 
            : (item.margin !== undefined 
                ? Number(item.margin) 
                : (rawCost > 0 ? calculateCustomerPartMarkup(rawCost, customer?.pricingRules?.partsMarkupRules, effectiveMarkupPct) : 0));

        const newItem: InternalProposalItem = {
            id: `pi-man-${Date.now()}`,
            ...item,
            type: item.type as 'Part' | 'Labor' | 'Fee' | 'Discount' | 'Service',
            cost: rawCost,
            vendorCost: rawCost,
            partCost: rawCost,
            markupPct: rawMarkup,
            margin: rawMarkup,
            unitPrice: item.type === 'Discount' && !item.isPercentage ? -Math.abs(item.price) : Math.abs(item.price),
            laborHours: 0,
            hourlyRate: 0,
            total: item.type === 'Discount' && !item.isPercentage ? -Math.abs(item.price * item.quantity) : item.price * item.quantity,
            taxable: item.type === 'Part',
            isPercentage: item.isPercentage
        };
        setItems([...items, newItem]);
    };

    const handleAddFromPricebook = (preset: ProposalPreset) => {
        const laborRate = effectiveLaborRate;
        const markupPct = calculateCustomerPartMarkup(
            preset.baseCost,
            customer?.pricingRules?.partsMarkupRules,
            effectiveMarkupPct,
            { tier1: customer?.pricingRules?.partsMarkupTier1, tier2: customer?.pricingRules?.partsMarkupTier2 }
        );
        const markupFactor = 1 + (markupPct / 100);
        const multiplier = state.currentOrganization?.marketMultiplier || 1.0;
        const newItems: InternalProposalItem[] = [];
        
        if (preset.baseCost > 0) {
            const partPrice = (preset.baseCost * markupFactor) * multiplier;
            newItems.push({
                id: `pi-pb-p-${Date.now()}`,
                name: `${preset.name} (Part)`,
                description: preset.description,
                cost: preset.baseCost,
                vendorCost: preset.baseCost,
                partCost: preset.baseCost,
                laborHours: 0,
                hourlyRate: 0,
                markupPct: markupPct,
                margin: markupPct,
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
             const contractedTag = (customerContractedRate && Number(customerContractedRate) > 0) ? ' [Contracted Rate Applied]' : '';
             newItems.push({
                id: `pi-pb-l-${Date.now()}`,
                name: `${preset.name} (Labor)`,
                description: `Installation Labor (${preset.avgLabor} hrs)${contractedTag}`,
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
        const laborRate = suggestion.appliedLaborRate || effectiveLaborRate;
        const markupPct = calculateCustomerPartMarkup(
            suggestion.baseCost,
            customer?.pricingRules?.partsMarkupRules,
            effectiveMarkupPct,
            { tier1: customer?.pricingRules?.partsMarkupTier1, tier2: customer?.pricingRules?.partsMarkupTier2 }
        );
        const markupFactor = 1 + (markupPct / 100);
        const multiplier = state.currentOrganization?.marketMultiplier || 1.0;
        const newItems: InternalProposalItem[] = [];

        if (suggestion.baseCost > 0) {
            const partPrice = (suggestion.baseCost * markupFactor) * multiplier;
            newItems.push({
                id: `pi-ai-part-${Date.now()}-${Math.random()}`,
                name: `${suggestion.name} (Material)`,
                description: suggestion.description,
                cost: suggestion.baseCost,
                vendorCost: suggestion.baseCost,
                partCost: suggestion.baseCost,
                laborHours: 0,
                hourlyRate: 0,
                markupPct: markupPct,
                margin: markupPct,
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
            const rateLabel = suggestion.rateType === 'emergency'
                ? ' [Emergency Rate Applied]'
                : suggestion.rateType === 'overtime'
                    ? ' [Overtime Rate Applied]'
                    : ((customerContractedRate && Number(customerContractedRate) > 0) ? ' [Contracted Rate Applied]' : '');

            newItems.push({
                id: `pi-ai-labor-${Date.now()}-${Math.random()}`,
                name: `${suggestion.name} (Labor)`,
                description: `Installation Labor (~${suggestion.avgLabor} hrs)${rateLabel}`,
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

    const handleSaveProposal = async (action: 'saveDraft' | 'send' | 'accept' | 'verbalAccept', selectedEmails?: string[], attachPdf?: boolean) => {
        if (!customer || isSaving) return;

        let status: Proposal['status'];
        let signatureDataUrl: string | null = null;
        let finalSelectedOption: Tier | null = selectedOption;

        if (action === 'accept' || action === 'verbalAccept') {
            if (action === 'accept' && (!sigPadRef.current || sigPadRef.current.isEmpty())) {
                showToast.warn("Please sign the proposal to accept it.");
                return;
            }
            if (!finalSelectedOption) {
                finalSelectedOption = activeTier || 'Basic';
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
        
        let proposalId = editProposalId;
        if (!proposalId) {
            if (jobIdRef.current || associatedJob) {
                const targetJob = associatedJob || state.jobs.find(j => j.id === jobIdRef.current);
                const existingCount = (state.proposals || []).filter(p => p.jobId === targetJob?.id || targetJob?.linkedProposalIds?.includes(p.id)).length;
                proposalId = resolveJobProposalNumber(targetJob, existingCount);
            } else {
                proposalId = await getNextProposalNumber(state.currentOrganization?.id || '');
            }
        }
        
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
        const tierCalc = calculateTierTotal(tierForTotals);

        const canonical = computeCanonicalFinancials({
            items: itemsToSave.filter(i => matchTier(i.tier, tierForTotals)),
            subtotal: tierCalc.subtotal,
            taxAmount: tierCalc.tax,
            taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
            additionalFeePercent,
            additionalFeeName,
            additionalFeeAmount: tierCalc.additionalFeeAmount,
            requireDeposit,
            depositType: requireDeposit ? depositType : 'none',
            depositValue: requireDeposit ? depositValue : 0,
            depositAmount: requireDeposit ? tierCalc.depositAmount : 0,
            depositPaid: requireDeposit ? depositPaid : false,
            depositNotes: requireDeposit ? depositNotes : '',
            paymentTerms: 'net_30',
            status
        });

        const proposalLocationId = selectedLocationId
            || (editProposalId ? state.proposals.find(p => p.id === editProposalId)?.locationId : null)
            || locationId;
            
        const proposalLocationName = selectedLocationName
            || (editProposalId ? state.proposals.find(p => p.id === editProposalId)?.locationName : null)
            || (associatedJob?.locationName || null);

        const proposalTitle = title.trim() || (itemsToSave[0]?.name ? `${itemsToSave[0].name} Proposal` : (customer?.name ? `Service Proposal - ${customer.name}` : 'Service Proposal'));

        const proposal: Proposal = {
            id: proposalId,
            title: proposalTitle,
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
            subtotal: canonical.subtotal,
            taxRate: canonical.taxRate,
            taxAmount: canonical.taxAmount,
            total: canonical.grandTotal,
            totalAmount: canonical.grandTotal,
            grandTotal: canonical.grandTotal,
            additionalFeePercent: canonical.additionalFeePercent,
            additionalFeeName: canonical.additionalFeeName,
            additionalFeeAmount: canonical.additionalFeeAmount,
            requireDeposit,
            depositType: canonical.depositType as any,
            depositValue: canonical.depositValue,
            depositAmount: canonical.depositRequired,
            depositRequired: canonical.depositRequired,
            depositNotes: canonical.depositNotes,
            depositPaid: canonical.depositPaid,
            depositPaidAmount: canonical.depositPaidAmount,
            amountPaid: canonical.amountPaid,
            balanceDue: canonical.balanceDue,
            balanceRemaining: canonical.balanceRemaining,
            amountDueToday: canonical.amountDueToday,
            amountDueNet: canonical.amountDueNet,
            paymentTermsLabel: canonical.paymentTermsLabel,
            financialStatus: canonical.financialStatus,
            recommendations: recommendations || '',
            displayFormat: displayFormat || 'itemized',
            pricingDisclaimer: pricingDisclaimer.trim(),
            warrantyTerms: warrantyTerms.trim(),
            warrantyDisclaimer: warrantyTerms.trim(),
            poNumber: associatedJob?.poNumber || state.proposals.find(p => p.id === editProposalId)?.poNumber || null,
        };
        try {
            await db.collection('proposals').doc(proposalId).set(cleanUndefinedFields(proposal), { merge: true });
            
            const draftKey = `draft_field_proposal_${editProposalId || jobIdRef.current || 'new'}`;
            localStorage.removeItem(draftKey);
            
            if (jobIdRef.current) {
                const existingJob = state.jobs.find(j => j.id === jobIdRef.current) || associatedJob;
                const primaryPropId = existingJob?.proposalId || proposalId;
                const updatedLinkedProposalIds = Array.from(new Set([
                    ...(existingJob?.linkedProposalIds || []),
                    ...(existingJob?.proposalId ? [existingJob.proposalId] : []),
                    proposalId
                ]));

                let updatedJobData: any = {
                    proposalId: primaryPropId,
                    linkedProposalIds: updatedLinkedProposalIds,
                    updatedAt: new Date().toISOString()
                };

                if (status === 'Accepted') {
                    const existingInvoice: any = (existingJob as any)?.invoice || {};
                    const targetJobId = jobIdRef.current || existingJob?.id || 'JOB';
                    const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                    const invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                    const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;
                    const acceptedTierCalc = calculateTierTotal(finalSelectedOption || 'Basic');

                    const invoiceItems = acceptedTierCalc.items.map((pItem: any) => ({
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
                        poNumber: proposal.poNumber || existingInvoice.poNumber || existingJob?.poNumber || existingJob?.workOrderNumber || '',
                        recommendations: proposal.recommendations || existingInvoice.recommendations || '',
                        items: invoiceItems,
                        subtotal: canonical.subtotal,
                        taxAmount: canonical.taxAmount,
                        totalAmount: canonical.grandTotal,
                        amount: canonical.grandTotal,
                        status: existingInvoice.status || 'Unpaid'
                    };

                    updatedJobData.invoice = updatedInvoice;
                }

                await db.collection('jobs').doc(jobIdRef.current).update(cleanUndefinedFields(updatedJobData));
                if (existingJob) {
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: { 
                            ...existingJob, 
                            ...updatedJobData
                        }
                    });
                }
            }
            
            // manually dispatch the update to the app's context
            dispatch({ 
                type: editProposalId ? 'UPDATE_PROPOSAL' : 'ADD_PROPOSAL', 
                payload: proposal 
            });

            if (!editProposalId) {
                navigate(`${location.pathname}?proposalId=${proposalId}&jobId=${jobIdRef.current}${source ? `&source=${source}` : ''}`, { replace: true });
            }
            setProposalStatus(status);
            setSignatureDataUrl(signatureDataUrl);
            if (status === 'Accepted') {
                setSignedAt(new Date().toISOString());
            }

            // --- NOTIFY FIELD TECHNICIAN IMMEDIATELY ---
            if (action === 'accept' || action === 'verbalAccept') {
                const recipientId = proposal.technicianId || proposal.createdById;
                const modeText = action === 'verbalAccept' ? 'verbally ' : 'in person ';
                const notificationContent = `🎉 ${proposal.customerName || 'Your customer'} just ${modeText}accepted the "${finalSelectedOption}" option of Proposal ${proposal.id} for $${(proposal.total || 0).toFixed(2)}!`;
                
                try {
                    const { sendNotification, notifyAdmins } = await import('lib/notificationService');
                    const orgId = proposal.organizationId || state.currentOrganization?.id || '';
                    const notifPayload = {
                        title: 'Proposal Accepted In-Person',
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
                        await sendNotification(recipientId, notifPayload, orgId);
                    }
                    if (orgId) {
                        await notifyAdmins(orgId, notifPayload);
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
                    let pdfAttachments: any[] = [];
                    if (attachPdf !== false) {
                        try {
                            showToast.info(t("Generating proposal PDF attachment..."));
                            const pdfAtt = await generateProposalPdfAttachment(proposal, state.currentOrganization);
                            if (pdfAtt) {
                                const sanitizedAtts = await sanitizeEmailAttachments([pdfAtt], state.currentOrganization?.id);
                                pdfAttachments.push(...sanitizedAtts);
                            }
                        } catch (pdfErr) {
                            console.error("Error generating proposal PDF for field proposal:", pdfErr);
                        }
                    }

                    const proposalLink = `${getBaseUrl()}/#/proposal-view/${proposalId}`;
                    await db.collection('mail_queue').add(cleanUndefinedFields({
                        to: emails,
                        replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                        message: {
                            subject: `New Proposal from ${state.currentOrganization?.name || 'Service Provider'}`,
                            html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #e0f2fe;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;"><h2 style="color:#0284c7;margin-top:0;">New Proposal Ready</h2><p style="font-size:15px;color:#334155;">Hi ${customer.name},</p><p style="font-size:15px;color:#334155;">We have prepared a new proposal for you (total: <strong>$${(proposal.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>). Please review and sign it online:</p>${createEmailButtonHtml('View &amp; Sign Proposal Online', proposalLink, '#0284c7')}<p style="font-size:13px;color:#64748b;margin-top:20px;">Thank you for your business!</p></div>`,
                            text: `New Proposal from ${state.currentOrganization?.name || 'Service Provider'} for $${(proposal.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}. View here: ${proposalLink}`,
                            replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                            ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
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
            id: editProposalId || undefined,
            subtotal,
            taxAmount: tax,
            total,
            additionalFeePercent,
            additionalFeeName,
            additionalFeeAmount,
            depositType,
            depositValue,
            depositAmount: calculateTierTotal(selectedOption || activeTier || 'Basic').depositAmount,
            depositNotes,
            depositPaid,
            customerName: customer?.name,
            items: itemsToPreview,
            selectedOption: proposalStatus === 'Accepted' ? (selectedOption || activeTier || 'Basic') : null,
            status: proposalStatus,
            signatureDataUrl: signatureDataUrl,
            signature: signatureDataUrl,
            signedAt: signedAt,
            recommendations: recommendations || '',
            displayFormat: displayFormat || 'itemized',
            jobId: jobIdRef.current || (editProposalId ? state.proposals.find(p => p.id === editProposalId)?.jobId : null),
        };
    };

    const handleExit = () => {
        if (location.pathname.startsWith('/briefing')) {
            navigate('/briefing');
        } else if (window.history.length > 2) {
            navigate(-1);
        } else {
            navigate('/admin/dashboard');
        }
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
        } else if (step === 2) {
            if (editProposalId || source === 'workflow') {
                handleExit();
            } else {
                setStep(1);
            }
        }
    };

    // Auto-save draft changes for Field Proposal
    useEffect(() => {
        if (!hasLoadedRef.current || proposalStatus === 'Accepted') return;

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
            pricingDisclaimer !== (original.pricingDisclaimer || '') ||
            warrantyTerms !== (original.warrantyTerms || '') ||
            activeTier !== (original.selectedOption ? toFieldTier(original.selectedOption) : 'Basic') ||
            selectedOption !== (original.selectedOption ? toFieldTier(original.selectedOption) : null) ||
            additionalFeePercent !== (original.additionalFeePercent || 0) ||
            additionalFeeName !== (original.additionalFeeName || 'Processing Fee') ||
            step !== 2
        );

        const draftKey = `draft_field_proposal_${editProposalId || jobIdRef.current || 'new'}`;
        if (hasChanges) {
            const draftData = {
                items,
                title,
                customerId,
                recommendations,
                pricingDisclaimer,
                warrantyTerms,
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
        title,
        customerId,
        recommendations,
        pricingDisclaimer,
        warrantyTerms,
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

    return (
        <div className="p-4 sm:p-8 pb-32 max-w-6xl mx-auto font-sans">
            {associatedJob && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-xl mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black text-lg">
                            📑
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-blue-200 tracking-wider block">
                                {t("Linked Work Order")}
                            </span>
                            <h3 className="text-base font-extrabold">
                                WO #{associatedJob.poNumber || associatedJob.id.slice(-6)} — {associatedJob.customerName || 'Customer'}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleImportJobDiagnostics}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                        >
                            <Sparkles size={16} />
                            <span>{t("Import Job Diagnostics")}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateNewProposalForJob}
                            className="bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                            title={t("Start a brand new proposal with a clean slate for this job")}
                        >
                            <Plus size={16} />
                            <span>{t("Create Additional Proposal")}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExit}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/20"
                        >
                            &larr; {t("Back to Job")}
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-4 flex items-center justify-between">
                <button 
                    onClick={handleExit}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                    &larr; {t("Exit Proposal Editor")}
                </button>
            </div>

            {/* Step Wizard / Progress Bar */}
            <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 sm:p-2 shadow-sm">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            step === 1
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${step === 1 ? 'bg-white text-primary-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            1
                        </span>
                        <span className="truncate">{t("Job / Customer")}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (customerId || jobIdRef.current) setStep(2);
                        }}
                        disabled={!customerId && !jobIdRef.current}
                        className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            step === 2
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${step === 2 ? 'bg-white text-primary-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            2
                        </span>
                        <span className="truncate">{t("Build Options")}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (items.length > 0) {
                                if (!selectedOption) setSelectedOption(activeTier || 'Basic');
                                setStep(3);
                            }
                        }}
                        disabled={items.length === 0}
                        className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            step === 3
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${step === 3 ? 'bg-white text-primary-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            3
                        </span>
                        <span className="truncate">{t("Review & Sign")}</span>
                    </button>
                </div>
            </div>

            {proposalStatus === 'Accepted' && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-5 mb-6 text-emerald-900 dark:text-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-emerald-500 shrink-0" size={28} />
                        <div>
                            <div className="font-black text-lg flex items-center gap-2">
                                {t("Proposal Accepted")} {selectedOption ? `(${selectedOption} Option)` : ''}
                                {signatureDataUrl === 'VERBAL_ACCEPTANCE' && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white uppercase tracking-wider">
                                        {t("Verbal")}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                                {signatureDataUrl === 'VERBAL_ACCEPTANCE' 
                                    ? t("This proposal was verbally accepted by the customer.") 
                                    : t("This proposal was electronically signed & accepted by the customer.")}
                                {signedAt ? ` (${new Date(signedAt).toLocaleDateString()})` : ''}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                        <Button 
                            onClick={() => setIsPreviewOpen(true)} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs md:text-sm flex-1 md:flex-initial"
                        >
                            {t("Convert to Invoice / View Document")} &rarr;
                        </Button>
                        {!isUnlockedForEdit && (
                            <Button 
                                variant="outline" 
                                onClick={async () => {
                                    if (await globalConfirm(t("Revising an accepted proposal will clear the signature and return it to Draft status. Are you sure you want to unlock for editing?"))) {
                                        setIsUnlockedForEdit(true);
                                        setProposalStatus('Draft');
                                        setSignatureDataUrl(null);
                                    }
                                }}
                                className="text-xs font-bold border-emerald-300 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                            >
                                {t("Unlock & Revise")}
                            </Button>
                        )}
                    </div>
                </div>
            )}

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
                <Card className="p-4 md:p-10 max-w-3xl mx-auto shadow-2xl rounded-3xl border-2 border-primary-50 bg-white dark:bg-slate-900">
                    <h2 className="text-3xl font-black mb-6 text-slate-900 dark:text-white">{t("New Proposal")}</h2>
                    
                    {/* Mode Selector */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
                        <button
                            type="button"
                            onClick={() => setStep1Mode('job')}
                            className={`flex-1 py-3 text-xs md:text-sm font-black rounded-xl transition-all ${
                                step1Mode === 'job'
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-300 shadow-md'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            📋 Select Open Work Order / Job (Recommended)
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep1Mode('standalone')}
                            className={`flex-1 py-3 text-xs md:text-sm font-black rounded-xl transition-all ${
                                step1Mode === 'standalone'
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-300 shadow-md'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            📄 Standalone Proposal (Without Job)
                        </button>
                    </div>

                    {step1Mode === 'job' ? (
                        <div className="space-y-4">
                            <Input 
                                label={t("Search Open Work Orders")}
                                placeholder={t("Search by WO #, PO #, customer, address, or issue...")}
                                value={jobSearch} 
                                onChange={(e) => setJobSearch(e.target.value)} 
                                autoFocus
                            />
                            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                                {(() => {
                                    const searchLower = jobSearch.toLowerCase();
                                    const openJobs = (state.jobs || []).filter((j: any) => {
                                        if (j.archived || j.deleted || j.jobStatus === 'Archived') return false;
                                        if (!searchLower) return true;
                                        return (
                                            (j.customerName && j.customerName.toLowerCase().includes(searchLower)) ||
                                            (j.poNumber && j.poNumber.toLowerCase().includes(searchLower)) ||
                                            (j.id && j.id.toLowerCase().includes(searchLower)) ||
                                            (j.locationName && j.locationName.toLowerCase().includes(searchLower)) ||
                                            (j.address && j.address.toLowerCase().includes(searchLower)) ||
                                            (j.tasks && j.tasks.some((t: string) => t.toLowerCase().includes(searchLower)))
                                        );
                                    }).sort((a: any, b: any) => new Date(b.createdAt || b.appointmentTime || 0).getTime() - new Date(a.createdAt || a.appointmentTime || 0).getTime());

                                    if (openJobs.length === 0) {
                                        return (
                                            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                No matching open jobs found. You can switch to "Standalone Proposal" above.
                                            </div>
                                        );
                                    }

                                    return openJobs.map((j: any) => {
                                        const existingProposal = (state.proposals || []).find((p: any) => 
                                            (p.jobId === j.id || (j.linkedProposalIds && j.linkedProposalIds.includes(p.id)) || j.proposalId === p.id) && 
                                            p.status !== 'Cancelled'
                                        );

                                        return (
                                            <div
                                                key={j.id}
                                                className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm group"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-black text-sm text-[#123A63] dark:text-sky-300">
                                                            {j.customerName || 'Customer'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                            WO #{j.poNumber || j.id.slice(-6)}
                                                        </span>
                                                        {existingProposal && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                                                PROP #{existingProposal.id} &bull; ${(Number(existingProposal.totalAmount || existingProposal.grandTotal || existingProposal.total || 0)).toFixed(2)} ({existingProposal.status || 'Draft'})
                                                            </span>
                                                        )}
                                                        {j.tasks && j.tasks.length > 0 && !existingProposal && (
                                                            <span className="text-[11px] text-slate-400 font-medium">
                                                                • {j.tasks[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                                                        {j.locationName ? `${j.locationName} • ` : ''}{j.address || 'No address specified'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    {existingProposal ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    jobIdRef.current = j.id;
                                                                    if (j.customerId) setCustomerId(j.customerId);
                                                                    if (j.locationId) {
                                                                        setSelectedLocationId(j.locationId);
                                                                        setSelectedLocationName(j.locationName || '');
                                                                    }
                                                                    navigate(`${location.pathname}?proposalId=${existingProposal.id}&jobId=${j.id}${source ? `&source=${source}` : ''}`, { replace: true });
                                                                    setStep(2);
                                                                    showToast.success(`Loaded Proposal #${existingProposal.id} for WO #${j.poNumber || j.id.slice(-6)}!`);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1"
                                                                title="Modify current existing proposal for this job"
                                                             >
                                                                ✏️ Modify Current PROP #{existingProposal.id}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    jobIdRef.current = j.id;
                                                                    if (j.customerId) setCustomerId(j.customerId);
                                                                    if (j.locationId) {
                                                                        setSelectedLocationId(j.locationId);
                                                                        setSelectedLocationName(j.locationName || '');
                                                                    }
                                                                    handleCreateNewProposalForJob();
                                                                }}
                                                                className="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm transition-all flex items-center gap-1"
                                                                title="Create an additional new proposal for this job"
                                                            >
                                                                + New Proposal
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                jobIdRef.current = j.id;
                                                                if (j.customerId) setCustomerId(j.customerId);
                                                                if (j.locationId) {
                                                                    setSelectedLocationId(j.locationId);
                                                                    setSelectedLocationName(j.locationName || '');
                                                                }
                                                                setTitle(`Proposal for ${j.customerName || 'Work Order'} (WO #${j.poNumber || j.id.slice(-6)})`);
                                                                navigate(`${location.pathname}?jobId=${j.id}${source ? `&source=${source}` : ''}`, { replace: true });
                                                                setStep(2);
                                                                showToast.success(`Linked to WO #${j.poNumber || j.id.slice(-6)} (${j.customerName || 'Customer'})!`);
                                                            }}
                                                            className="px-4 py-2 text-xs font-black bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1"
                                                        >
                                                            + Build Proposal &rarr;
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                                <Button onClick={() => navigate(-1)} variant="secondary" className="px-6 font-bold">{t("Cancel")}</Button>
                                <button
                                    type="button"
                                    onClick={() => setStep1Mode('standalone')}
                                    className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-sky-400 underline"
                                >
                                    Don't have a work order? Create Standalone Proposal &rarr;
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-4 space-y-4">
                                <Input 
                                    label={t("Search Customers")} 
                                    placeholder={t("Type a name to filter...")} 
                                    value={customerSearch} 
                                    onChange={(e) => setCustomerSearch(e.target.value)} 
                                />
                                <Select 
                                    label={customerSearch ? `${t("Filtered Results")} (${state.customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length})` : t("Select Customer")} 
                                    value={customerId} 
                                    onChange={e => {
                                        const newId = e.target.value;
                                        setCustomerId(newId);
                                        if (newId) {
                                            const cust = state.customers.find(c => c.id === newId);
                                            if (cust && cust.serviceLocations && cust.serviceLocations.length > 0) {
                                                setSelectedLocationId(cust.serviceLocations[0].id || '');
                                                setSelectedLocationName(cust.serviceLocations[0].propertyName || cust.serviceLocations[0].name || '');
                                            } else {
                                                setSelectedLocationId('');
                                                setSelectedLocationName('');
                                            }
                                        } else {
                                            setSelectedLocationId('');
                                            setSelectedLocationName('');
                                        }
                                    }} 
                                    data-tour="proposal-customer-select" 
                                    className="h-14 text-lg"
                                >
                                    <option value="">{t("-- Choose Customer --")}</option>
                                    {state.customers
                                        .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>

                                {customer && (
                                    <div className="pt-2">
                                        <LocationSearchSelector 
                                            locations={customer.serviceLocations || []}
                                            selectedLocationId={selectedLocationId}
                                            onSelectLocation={(loc) => {
                                                const locId = loc.id === 'default' ? '' : loc.id;
                                                setSelectedLocationId(locId);
                                                setSelectedLocationName(loc.propertyName || loc.name || '');
                                            }}
                                            label={t("Target Property / Service Location")}
                                            placeholder={t("Search location by property name, store #, address, city...")}
                                            customerDefaultAddress={customer.customerType !== 'Property Management' && customer.address ? {
                                                name: `${customer.name} (Main Site)`,
                                                address: customer.address,
                                                city: customer.city || '',
                                                state: customer.state || '',
                                                zip: customer.zip || ''
                                            } : undefined}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 mt-8">
                                <Button onClick={() => setStep1Mode('job')} variant="secondary" className="h-14 px-4 md:px-8 text-base font-bold">&larr; {t("Back to Job Selection")}</Button>
                                <Button onClick={() => setStep(2)} disabled={!customerId} data-tour="proposal-start-building-btn" className="flex-1 h-14 text-xl font-bold">{t("Start Building")} &rarr;</Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {step === 2 && (
                <div className="space-y-8 animate-fade-in">
                    <div className="sticky top-2 z-30 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl max-w-xl mx-auto shadow-md border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex gap-1.5 sm:gap-2">
                            {(['Basic', 'Premium', 'Platinum'] as Tier[]).map(tier => {
                                const tierCalc = calculateTierTotal(tier);
                                const tierCount = items.filter(i => matchTier(i.tier, tier)).length;
                                const isActive = activeTier === tier;
                                return (
                                    <button 
                                        key={tier}
                                        type="button"
                                        onClick={() => setActiveTier(tier as Tier)}
                                        className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer ${
                                            isActive
                                                ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-sky-300 shadow-md border border-slate-200/80 dark:border-slate-700'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-black uppercase tracking-tight">
                                            <span>{getTierLabel(tier)}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                                isActive ? 'bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                            }`}>
                                                {tierCount}
                                            </span>
                                        </div>
                                        <span className="text-[11px] sm:text-xs font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
                                            ${tierCalc.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Card className="p-4 md:p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl rounded-3xl bg-white dark:bg-slate-900 pb-28 md:pb-8">
                        {customerContractedRate !== undefined && Number(customerContractedRate) > 0 && (
                            <div className="mb-6 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between animate-fade-in">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                                    <TrendingDown size={18} className="text-amber-600 dark:text-amber-400" />
                                    <span>{t("Customer Contracted Labor Rate Active:")} <strong className="text-sm font-black text-amber-900 dark:text-amber-100">${Number(customerContractedRate).toFixed(2)}/hr</strong> ({t("Overrides standard")} ${state.currentOrganization?.laborRate ?? 120}/hr)</span>
                                    {customerMarkupPct !== undefined && Number(customerMarkupPct) >= 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-800 dark:text-amber-200">({customerMarkupPct}% Parts Markup)</span>
                                    )}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-700">
                                    {t("Contracted Rates Applied")}
                                </span>
                            </div>
                        )}
                        <div className="mb-6">
                            <Input
                                label={t("Proposal Title")}
                                placeholder={t("e.g., HVAC System Replacement & Ductwork")}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full text-base font-semibold"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
                            <button onClick={() => setActiveTool('ai')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTool === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Sparkles size={16}/> {t("AI Generator")}</button>
                            <button onClick={() => setIsPricebookOpen(true)} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300`}><Book size={16}/> {t("Pricebook")}</button>
                            <button onClick={() => setActiveTool('manual')} data-tour="proposal-manual-btn" className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTool === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><Edit2 size={16}/> {t("Manual Entry")}</button>
                        </div>

                        {activeTool === 'ai' && <AIGenerator onSuggestions={setAiSuggestions} customerId={customerId} customerName={customerSearch} customer={customer} />}
                        {activeTool === 'manual' && (
                            <ManualEntry 
                                activeTier={activeTier} 
                                onAdd={handleAddManualItem} 
                                defaultMarkupPct={effectiveMarkupPct}
                                customerRules={customer?.pricingRules?.partsMarkupRules}
                            />
                        )}
                        {aiSuggestions && activeTool === 'ai' && <AISuggestionsList suggestions={aiSuggestions} onAccept={handleAcceptAiSuggestion} />}
                        
                        <ProposalItemsList items={calculateTierTotal(activeTier).items} activeTier={activeTier} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onMoveItem={handleMoveItem} onAddSubItem={handleAddSubItem} onUpdateSubItem={handleUpdateSubItem} onDeleteSubItem={handleDeleteSubItem} />

                        {/* Proposal Presentation Format Selector */}
                        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl">
                            <div>
                                <h4 className="text-xs font-black uppercase text-indigo-950 dark:text-indigo-200 tracking-wider flex items-center gap-1.5">
                                    📋 {t("Proposal Presentation Format")}
                                </h4>
                                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mt-0.5">
                                    {t("Select how line items appear on customer proposal links, viewer modals, and PDFs.")}
                                </p>
                            </div>
                            <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setDisplayFormat('itemized')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                        displayFormat === 'itemized'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    📄 {t("Itemized Breakdown (As Typed)")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDisplayFormat('progressive')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                        displayFormat === 'progressive'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    📊 {t("Grouped Progress Matrix (AIA)")}
                                </button>
                            </div>
                        </div>

                        {/* Collapsible Accordions for Secondary Sections */}
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                            {/* Accordion 1: Fees & Discounts */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('fees')}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">🏷️</span>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                {t("Global Fees & Discounts")}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest hidden sm:block">
                                                {t("Apply a percentage fee or discount to the proposal")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            additionalFeePercent !== 0 
                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black' 
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                            {additionalFeePercent !== 0 ? `${additionalFeePercent > 0 ? '+' : ''}${additionalFeePercent}%` : t("None")}
                                        </span>
                                        {collapsedSections.fees ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </div>
                                </button>
                                {!collapsedSections.fees && (
                                    <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                                        <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold tracking-widest sm:hidden">{t("Apply a percentage fee (e.g., Processing Fee = 3) or discount (e.g., Seasonal Discount = -10)")}</p>
                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                            <div className="flex-1 w-full">
                                                <Input label={t("Adjustment Name")} value={additionalFeeName} onChange={e => setAdditionalFeeName(e.target.value)} placeholder={t("e.g. Processing Fee or Fall Discount")} />
                                            </div>
                                            <div className="flex-1 w-full">
                                                <Input label={t("Percentage (%)")} type="number" value={additionalFeePercent} onChange={e => setAdditionalFeePercent(parseFloat(e.target.value) || 0)} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Accordion 2: Down Payment / Deposit Requirement */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('deposit')}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">💵</span>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                {t("Down Payment / Deposit")}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest hidden sm:block">
                                                {t("Specify an optional deposit required before work starts")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            requireDeposit 
                                                ? (depositPaid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black')
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                            {requireDeposit ? (depositPaid ? t("Deposit Paid") : `${depositType === 'percentage' ? `${depositValue}%` : `$${depositValue.toFixed(2)}`}`) : t("None")}
                                        </span>
                                        {collapsedSections.deposit ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </div>
                                </button>
                                {!collapsedSections.deposit && (
                                    <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500">{t("Enable mandatory deposit for this proposal")}</span>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={requireDeposit}
                                                    onChange={e => {
                                                        const enabled = e.target.checked;
                                                        setRequireDeposit(enabled);
                                                        if (!enabled) {
                                                            setDepositValue(0);
                                                            setDepositPaid(false);
                                                        }
                                                    }}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {t("Require Deposit")} ({requireDeposit ? t("ENABLED") : t("OFF")})
                                                </span>
                                            </label>
                                        </div>
                                        
                                        {requireDeposit && (
                                            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-4 animate-in fade-in duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t("Deposit Type")}</label>
                                                        <select
                                                            value={depositType}
                                                            onChange={e => setDepositType(e.target.value as 'flat' | 'percentage')}
                                                            className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                                                        >
                                                            <option value="flat">Flat Dollar ($)</option>
                                                            <option value="percentage">Percentage (%)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <Input
                                                            label={depositType === 'percentage' ? t("Deposit Percentage (%)") : t("Deposit Amount ($)")}
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={depositValue}
                                                            onChange={e => setDepositValue(parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Input
                                                            label={t("Calculated Deposit Due")}
                                                            type="text"
                                                            disabled
                                                            value={`$${(calculateTierTotal(activeTier).depositAmount || 0).toFixed(2)}`}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                                    <div className="flex-1 w-full">
                                                        <Input
                                                            label={t("Deposit Notes / Payment Instructions")}
                                                            value={depositNotes}
                                                            onChange={e => setDepositNotes(e.target.value)}
                                                            placeholder={t("e.g. Deposit required prior to scheduling / start of work")}
                                                        />
                                                    </div>
                                                    {(depositValue > 0 || depositPaid || calculateTierTotal(activeTier).depositAmount > 0) && (
                                                        <label className="flex items-center gap-2 cursor-pointer pt-4 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={depositPaid}
                                                                onChange={e => setDepositPaid(e.target.checked)}
                                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {t("Deposit Marked Paid")} ({depositPaid ? t('YES') : t('NO')})
                                                            </span>
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Accordion 3: Technician Recommendations */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('recommendations')}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">💡</span>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                {t("Technician Recommendations")}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest hidden sm:block">
                                                {t("Provide proactive service advice to the customer")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            recommendations.trim() 
                                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold' 
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                            {recommendations.trim() ? t("Added") : t("Empty")}
                                        </span>
                                        {collapsedSections.recommendations ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </div>
                                </button>
                                {!collapsedSections.recommendations && (
                                    <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t("Provide proactive service advice to the customer")}</p>
                                            {associatedJob && (
                                                <button
                                                    type="button"
                                                    onClick={handleImportJobRecommendations}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs cursor-pointer"
                                                >
                                                    <Sparkles size={12} className="text-indigo-600 dark:text-indigo-400" />
                                                    {t("Import from Job")}
                                                </button>
                                            )}
                                        </div>
                                        <AutoResizeTextarea
                                            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200"
                                            value={recommendations}
                                            onChange={e => setRecommendations(e.target.value)}
                                            placeholder={t("e.g. Recommend replacing the capacitor within the next 6 months...")}
                                            minHeight={80}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Accordion 4: Pricing & Estimate Disclaimer */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('disclaimer')}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">📋</span>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                {t("Pricing & Estimate Disclaimer")}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest hidden sm:block">
                                                {t("Specify rate validity, material escalation, or price terms")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {pricingDisclaimer.trim() ? t("Customized") : t("Default")}
                                        </span>
                                        {collapsedSections.disclaimer ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </div>
                                </button>
                                {!collapsedSections.disclaimer && (
                                    <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t("Specify rate validity, material escalation, or price terms for this proposal")}</p>
                                            <button 
                                                type="button" 
                                                onClick={() => setPricingDisclaimer((state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || "Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability.")}
                                                className="text-[11px] font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline cursor-pointer"
                                            >
                                                {t("Reset to Default")}
                                            </button>
                                        </div>
                                        <AutoResizeTextarea
                                            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200"
                                            value={pricingDisclaimer}
                                            onChange={e => setPricingDisclaimer(e.target.value)}
                                            placeholder={t("e.g. Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates. Any unforeseen structural, electrical, or existing damage discovered during execution will be quoted separately.")}
                                            minHeight={80}
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center">{t("Quick Insert:")}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPricingDisclaimer("Quoted installation price is based on a standard installation and includes only the equipment and scope specifically listed in this proposal. Price does not include additional refrigerant, copper line set or additional copper piping, ductwork modifications or replacement, electrical upgrades, drain modifications, structural repairs, code-required upgrades, or other unforeseen materials or labor unless specifically stated. If additional work or materials are found to be necessary during installation, TekAir Inc. will notify the customer and obtain approval for any additional charges before proceeding whenever reasonably possible.")}
                                                className="text-[10px] bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold px-2.5 py-1 rounded-lg border border-primary-200 dark:border-primary-800 cursor-pointer transition-all"
                                            >
                                                + Standard Installation Scope &amp; Unforeseen Conditions (TekAir)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPricingDisclaimer(prev => prev ? `${prev} Pricing is strictly valid for 30 days.` : "Pricing is valid for 30 days from issuance.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + 30-Day Rate Guarantee
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPricingDisclaimer(prev => prev ? `${prev} Pricing is subject to material and equipment manufacturer availability.` : "Pricing is subject to material and equipment manufacturer availability.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + Market Fluctuation Notice
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPricingDisclaimer(prev => prev ? `${prev} Excludes unforeseen electrical, plumbing, or structural repairs.` : "Excludes unforeseen electrical, plumbing, or structural repairs.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + Unforeseen Repairs Exclusion
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Accordion 5: Warranty Terms & Service Guarantee */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('warranty')}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">🛡️</span>
                                        <div>
                                            <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-400">
                                                {t("Warranty Terms & Service Guarantee")}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest hidden sm:block">
                                                {t("Specify labor workmanship coverage and manufacturer parts duration")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {warrantyTerms.trim() ? t("Customized") : t("Default")}
                                        </span>
                                        {collapsedSections.warranty ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </div>
                                </button>
                                {!collapsedSections.warranty && (
                                    <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t("Specify labor workmanship coverage, manufacturer parts duration, and warranty terms for this proposal")}</p>
                                            <button 
                                                type="button" 
                                                onClick={() => setWarrantyTerms((state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '')}
                                                className="text-[11px] font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline cursor-pointer"
                                            >
                                                {t("Reset to Default")}
                                            </button>
                                        </div>
                                        <AutoResizeTextarea
                                            className="w-full p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-sm focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 dark:text-slate-200"
                                            value={warrantyTerms}
                                            onChange={e => setWarrantyTerms(e.target.value)}
                                            placeholder={t("e.g. 3-Year TekAir Inc. Workmanship Warranty on installation labor. 10-Year Manufacturer Parts Warranty registered upon completion.")}
                                            minHeight={90}
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center">{t("Quick Insert:")}</span>
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyTerms(`TekAir Inc. provides a 3-Year Workmanship Warranty on this HVAC system installation. This warranty covers defects directly resulting from TekAir Inc.’s installation labor and workmanship for three (3) years from the original installation date.\n\nThe installed equipment includes a 10-Year Manufacturer Parts Warranty. Equipment will be registered as required to maintain the full manufacturer warranty coverage.\n\nThe manufacturer’s 10-year warranty covers qualifying equipment components in accordance with the manufacturer’s warranty terms and exclusions. Manufacturer warranty coverage is provided by the equipment manufacturer and is separate from TekAir Inc.’s workmanship warranty.\n\nUnless specifically included in writing, the manufacturer parts warranty does not cover labor, refrigerant, diagnostic charges, trip charges, shipping, freight, crane service, equipment access, permits, or other costs associated with diagnosing or replacing a covered component.\n\nTekAir Inc.’s workmanship warranty does not cover failures caused by lack of maintenance, dirty filters or coils, clogged drains, electrical issues outside of the installed HVAC equipment, power surges, utility-related conditions, flooding, fire, severe weather, animals or pests, corrosion, misuse, abuse, improper operation, alterations, building or ductwork deficiencies, or failure of manufacturer-supplied components.\n\nWarranty coverage may be denied if the system is modified, repaired, altered, relocated, or serviced by an unauthorized third party and that work causes, contributes to, or interferes with determining the cause of the failure.\n\nAll warranty claims are subject to inspection and verification by TekAir Inc.\n\n3-Year TekAir Inc. Workmanship Warranty\n10-Year Manufacturer Parts Warranty`)}
                                                className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer transition-all"
                                            >
                                                + 3-Year Workmanship &amp; 10-Year Manufacturer (TekAir Full)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyTerms(prev => prev ? `${prev}\n\n1-Year Complete Labor & Workmanship Warranty from date of service.` : "1-Year Complete Labor & Workmanship Warranty from date of service.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + 1-Year Labor Warranty
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyTerms(prev => prev ? `${prev}\n\n10-Year Manufacturer Parts Warranty on registered equipment.` : "10-Year Manufacturer Parts Warranty on registered equipment.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + 10-Year Parts Warranty
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyTerms(prev => prev ? `${prev}\n\n5-Year Premium Workmanship Protection Plan.` : "5-Year Premium Workmanship Protection Plan.")}
                                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                            >
                                                + 5-Year Workmanship
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-12 border-t border-slate-200 dark:border-slate-700 pt-8 flex flex-wrap justify-between items-start gap-4">
                            {(() => {
                                const tierCalc = calculateTierTotal(activeTier);
                                const pTerms = (state.currentOrganization as any)?.paymentTerms || 'Net Terms';
                                const isNet = pTerms.toLowerCase().includes('net');
                                const depAmt = tierCalc.depositAmount || 0;
                                const dueToday = depAmt > 0 ? (depositPaid ? 0 : depAmt) : (isNet ? 0 : tierCalc.total);
                                const dueNet = depAmt > 0 ? Math.max(0, tierCalc.total - depAmt) : (isNet ? tierCalc.total : 0);

                                const activeTierItems = items.filter(i => matchTier(i.tier, activeTier));
                                const totalCost = activeTierItems.reduce((acc, curr) => {
                                    if (curr.isPercentage || curr.type === 'Fee' || curr.type === 'Discount') return acc;
                                    const cost = Number(curr.cost ?? curr.vendorCost ?? curr.partCost ?? 0);
                                    return acc + (cost * Number(curr.quantity || 1));
                                }, 0);
                                const hasCostData = totalCost > 0;
                                const grossProfit = Math.max(0, tierCalc.subtotal - totalCost);
                                const grossMarginPct = tierCalc.subtotal > 0 ? (grossProfit / tierCalc.subtotal) * 100 : 0;

                                return (
                                    <>
                                        {hasCostData ? (
                                            <div className="w-full max-w-sm space-y-2 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-fade-in">
                                                <div className="flex items-center justify-between border-b border-indigo-200/60 dark:border-indigo-800/40 pb-2">
                                                    <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                                                        <span>📊</span> {t("Internal Cost & Profit")}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">
                                                        {t("Editor Only")}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                    <span>{t("Total Cost:")}</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">${totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                    <span>{t("Est. Gross Profit:")}</span>
                                                    <span className="font-black">${grossProfit.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                                    <span>{t("Gross Profit Margin:")}</span>
                                                    <span className="font-black">{grossMarginPct.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ) : <div />}

                                        <div className="w-full max-w-sm space-y-2 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 ml-auto">
                                            <div className="flex justify-between items-center text-sm font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                                                <span className="uppercase tracking-wider">{t("Amount Due Today")}</span>
                                                <span className="font-black text-amber-900 dark:text-amber-300">
                                                    ${dueToday.toFixed(2)}
                                                    {depositPaid && depAmt > 0 && (
                                                        <span className="ml-2 text-xs text-emerald-600 font-bold">
                                                            (${depAmt.toFixed(2)} {t("DEPOSIT PAID")})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 px-2">
                                                <span className="uppercase tracking-wider">{t("Amount Due")} ({pTerms})</span>
                                                <span className="font-black">${dueNet.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 px-2">
                                                <span className="uppercase tracking-wider">{t(activeTier)} {t("Grand Total")}</span>
                                                <span className="text-3xl font-black text-primary-600 dark:text-primary-400">${tierCalc.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex gap-4 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={handleBack} className="px-4 md:px-8 font-bold">
                                {editProposalId || source === 'workflow' ? t('Cancel') : t('Back')}
                            </Button>
                            <Button variant="outline" onClick={() => handleSaveProposal('saveDraft')} disabled={isSaving} className="px-4 md:px-8 font-bold flex items-center gap-2">
                                <Save size={16} /> {isSaving ? t('Saving...') : t('Save')}
                            </Button>
                            <Button onClick={() => { if (!selectedOption) setSelectedOption(activeTier || 'Basic'); setStep(3); }} disabled={items.length === 0} data-tour="proposal-next-step-btn" className="flex-1 h-14 text-xl font-black shadow-xl shadow-primary-500/30">{t("Review & Present")} &rarr;</Button>
                        </div>
                    </Card>

                    {/* Mobile Sticky Bottom Action & Pricing Bar */}
                    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 px-4 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] safe-area-inset-bottom">
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider truncate">
                                {getTierLabel(activeTier)} {t("Total")}
                            </span>
                            <span className="text-lg font-black text-primary-600 dark:text-sky-400">
                                ${calculateTierTotal(activeTier).total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleSaveProposal('saveDraft')}
                                disabled={isSaving}
                                className="h-11 px-3 text-xs font-bold flex items-center gap-1 border-slate-300 dark:border-slate-700"
                            >
                                <Save size={15} />
                                <span>{isSaving ? t('Saving...') : t('Save')}</span>
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!selectedOption) setSelectedOption(activeTier || 'Basic');
                                    setStep(3);
                                }}
                                disabled={items.length === 0}
                                className="h-11 px-3.5 text-xs font-black bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md flex items-center gap-1"
                            >
                                <span>{t("Review")}</span>
                                <span>&rarr;</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (() => {
                const activeSelectedOption = selectedOption || activeTier || 'Basic';
                const selectedTierTotal = calculateTierTotal(activeSelectedOption);
                const canAccept = !isSaving && selectedTierTotal.items.length > 0;

                const availableTiers = (['Basic', 'Premium', 'Platinum'] as Tier[]).filter(tier => {
                    const { items: tierItems } = calculateTierTotal(tier);
                    return tierItems.length > 0;
                });

                return (
                    <div className="space-y-6 md:space-y-10 animate-fade-in pb-12">
                        {/* Mobile Tier Selector Tabs */}
                        {availableTiers.length > 1 && (
                            <div className="flex md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1 border border-slate-200 dark:border-slate-700">
                                {availableTiers.map(tier => {
                                    const { total } = calculateTierTotal(tier);
                                    const isViewing = (mobilePresentationTier === 'all' && activeSelectedOption === tier) || mobilePresentationTier === tier;
                                    return (
                                        <button
                                            key={tier}
                                            type="button"
                                            onClick={() => {
                                                setSelectedOption(tier);
                                                setMobilePresentationTier(tier);
                                            }}
                                            className={`flex-1 py-2 px-1.5 rounded-xl transition-all flex flex-col items-center justify-center ${
                                                isViewing && mobilePresentationTier !== 'all'
                                                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-sky-300 shadow-md font-black'
                                                    : 'text-slate-600 dark:text-slate-400 font-bold'
                                            }`}
                                        >
                                            <span className="text-xs uppercase">{getTierLabel(tier)}</span>
                                            <span className="text-[11px] font-mono">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setMobilePresentationTier('all')}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                                        mobilePresentationTier === 'all'
                                            ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-sky-300 shadow-md'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    {t("All")}
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(['Basic', 'Premium', 'Platinum'] as Tier[]).map(tier => {
                                const { total, items: tierItems, additionalFeeAmount } = calculateTierTotal(tier);
                                const isSelected = activeSelectedOption === tier;
                                if (tierItems.length === 0) return null;

                                const isHiddenOnMobile = mobilePresentationTier !== 'all' && mobilePresentationTier !== tier;

                                return (
                                    <div 
                                        key={tier} 
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            setSelectedOption(tier);
                                            setMobilePresentationTier(tier);
                                        }} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedOption(tier);
                                                setMobilePresentationTier(tier);
                                            }
                                        }}
                                        className={`${isHiddenOnMobile ? 'hidden md:block' : 'block'} relative p-5 md:p-10 rounded-3xl md:rounded-[2.5rem] border-4 cursor-pointer transition-all duration-300 ${isSelected ? 'border-primary-600 bg-primary-50/60 dark:bg-primary-900/20 shadow-xl scale-[1.01] md:scale-105' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                                    >
                                        <div className="flex items-center justify-between mb-4 md:mb-8">
                                            <h3 className={`font-black text-xl md:text-2xl uppercase ${isSelected ? 'text-primary-700 dark:text-white' : 'text-slate-900 dark:text-slate-200'}`}>{getTierLabel(tier)}</h3>
                                            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{isSelected && <CheckCircle size={16}/>}</div>
                                        </div>
                                        <div className="text-center mb-6 md:mb-10">
                                            <div className={`text-4xl md:text-6xl font-black tracking-tighter ${isSelected ? 'text-primary-700 dark:text-white' : 'text-slate-900 dark:text-white'}`}>${total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                                            {!!additionalFeeAmount && (
                                                <div className={`text-xs md:text-sm font-bold mt-2 ${additionalFeeAmount < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {t("Includes")} {additionalFeePercent}% {additionalFeeName || t('Adjustment')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3 md:space-y-4 mb-6 md:mb-10">
                                            {tierItems.map(i => (
                                                <div key={i.id} className="flex flex-col gap-1">
                                                    <div className="flex items-start gap-2.5 md:gap-3">
                                                        <CheckCircle size={16} className="text-emerald-500 mt-1 shrink-0" />
                                                        <p className={`text-xs md:text-sm font-bold ${isSelected ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>{i.name}</p>
                                                    </div>
                                                    {i.description && (
                                                        <p className={`text-[11px] md:text-xs ml-6 md:ml-7 italic leading-snug whitespace-pre-wrap ${isSelected ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>{i.description}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center pt-2">
                                            <span className={`inline-block text-xs font-black uppercase tracking-wider py-1.5 px-4 rounded-full ${isSelected ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {isSelected ? t("Selected Option") : t("Tap to Select")}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <Card className="p-4 md:p-10 border-2 border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900">
                            <div className="flex justify-between items-center mb-6 md:mb-8">
                                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{t("Customer Authorization")}</h3>
                                <Button onClick={() => setIsPreviewOpen(true)} variant="secondary" className="w-auto flex items-center gap-1.5 text-xs font-black"><Eye size={16}/> {t("Preview")}</Button>
                            </div>
                            <div data-tour="proposal-sig-pad">
                                <SignaturePad ref={sigPadRef} className="h-40 md:h-44 shadow-inner mb-6 md:mb-8 bg-slate-50 dark:bg-slate-800 rounded-xl" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
                                <Button variant="secondary" onClick={() => setStep(2)} className="h-12 md:h-16 font-bold text-xs md:text-base">{t("Modify")}</Button>
                                <Button variant="outline" onClick={() => handleSaveProposal('saveDraft')} disabled={isSaving} className="h-12 md:h-16 font-bold text-xs md:text-base flex items-center justify-center gap-1.5 md:gap-2">
                                    <Save size={16} /> {isSaving ? t('Saving...') : t('Save Draft')}
                                </Button>
                                <Button onClick={() => setIsRecipientModalOpen(true)} disabled={isSaving} className="h-12 md:h-16 font-black bg-indigo-600 hover:bg-indigo-700 text-xs md:text-base flex items-center justify-center gap-1.5 md:gap-2"><Mail size={16} className="shrink-0"/> {t("Email")}</Button>
                                <Button onClick={async () => { if(await globalConfirm(t('Are you sure the customer has verbally agreed to this proposal?'), t('Verbal Authorization'), t('Confirm Verbal Agreement'), t('Cancel'))) handleSaveProposal('verbalAccept'); }} disabled={!canAccept} className="h-12 md:h-16 font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xl text-xs md:text-base leading-tight">{t("Verbal")}<span className="hidden md:inline">&nbsp;{t("Accept")}</span></Button>
                                <Button onClick={() => handleSaveProposal('accept')} disabled={!canAccept} data-tour="proposal-submit-btn" className="col-span-2 md:col-span-1 h-14 md:h-16 font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl text-sm md:text-base leading-tight flex items-center justify-center gap-1.5 md:gap-2"><CheckCircle size={18} /> <span>{t("Sign & Accept")}</span></Button>
                            </div>
                        </Card>
                    </div>
                );
            })()}

            <PricebookModal 
                isOpen={isPricebookOpen}
                onClose={() => setIsPricebookOpen(false)} 
                searchQuery={pricebookSearch} 
                onSearchChange={setPricebookSearch} 
                presets={filteredPresets} 
                onSelect={handleAddFromPricebook} 
                marketMultiplier={state.currentOrganization?.marketMultiplier || 1.0} 
                laborRate={effectiveLaborRate}
                markupPct={effectiveMarkupPct}
            />

            {isRecipientModalOpen && (
                <RecipientSelectorModal
                    isOpen={isRecipientModalOpen}
                    onClose={() => setIsRecipientModalOpen(false)}
                    customerId={customerId}
                    locationId={locationId || (associatedJob as any)?.serviceLocationId}
                    locationName={associatedJob?.locationName || (associatedJob as any)?.siteLocationName || (associatedJob as any)?.address}
                    documentType="proposal"
                    title="Select Proposal Recipients"
                    defaultAttachPdf={true}
                    onConfirm={(emails, attachPdf) => {
                        handleSaveProposal('send', emails, attachPdf);
                        setIsRecipientModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default FieldProposal;
