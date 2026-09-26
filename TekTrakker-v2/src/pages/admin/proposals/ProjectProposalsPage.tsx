import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input, { NumberInput } from 'components/ui/Input';
import Select from 'components/ui/Select';
import SearchableSelect, { SearchableSelectOption } from 'components/ui/SearchableSelect';
import Textarea from 'components/ui/Textarea';
import { db, firebase } from 'lib/firebase';
import showToast from 'lib/toast';
import { 
    FileText, Sparkles, Trash2, Plus, Search, DollarSign, Edit2, Save, 
    ArrowLeft, Copy, ExternalLink, Clock, User, CheckCircle, AlertCircle, X,
    Layers, Landmark, ClipboardList, Info, FileSpreadsheet, Upload, Loader2, Send,
    ChevronUp, ChevronDown, MapPin, MessageSquare, Scale, Shield,
    Sliders, Tag, Percent, Zap, AlertTriangle, Archive, ArchiveRestore
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Proposal, ProjectProposalLaborItem, ProjectProposalPartItem, ProjectProposalAllowanceItem, Project } from 'types';
import { 
    extractCustomerContractedRates, 
    buildEstimatorAIPromptDirectives, 
    applyEstimatorRulesToParsedData, 
    DEFAULT_ESTIMATOR_RULES,
    type EstimatorAIRules,
    type CustomerContractedRates,
    type RateMode,
    type MarkupMode,
    type DiscountScope
} from 'lib/estimatorRules';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import SendSMSModal from 'components/modals/SendSMSModal';
import { LocationSearchSelector } from 'components/common/LocationSearchSelector';
import { getBaseUrl, cleanUndefinedFields, createEmailButtonHtml, matchTier } from 'lib/utils';
import { globalConfirm } from 'lib/globalConfirm';
import { generateProposalPdfAttachment } from 'lib/pdfHelper';

type EditorTab = 'details' | 'labor' | 'parts' | 'allowances' | 'summary';

const cleanAndParseJson = (text: string): any => {
    let clean = text.replace(/```json|```/g, '').trim();

    // Extract JSON structure if wrapped in other text
    const startObj = clean.indexOf('{');
    const startArr = clean.indexOf('[');
    let start = -1;
    if (startObj !== -1 && startArr !== -1) {
        start = Math.min(startObj, startArr);
    } else if (startObj !== -1) {
        start = startObj;
    } else if (startArr !== -1) {
        start = startArr;
    }

    if (start !== -1) {
        const endChar = start === startObj ? '}' : ']';
        const end = clean.lastIndexOf(endChar);
        if (end !== -1 && end > start) {
            clean = clean.substring(start, end + 1);
        }
    }

    // Clean trailing commas
    clean = clean.replace(/,\s*([\]}])/g, '$1');

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("Standard JSON parsing failed, attempting aggressive sanitization...", e);
        try {
            // Remove comments
            let fallback = clean.replace(/\/\*[\s\S]*?\*\//g, '');
            fallback = fallback.replace(/(^|[^:])\/\/.*$/gm, '$1');

            // Convert single quotes to double quotes
            fallback = fallback.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

            // Reclean trailing commas
            fallback = fallback.replace(/,\s*([\]}])/g, '$1');

            return JSON.parse(fallback);
        } catch (innerError) {
            console.error("Aggressive JSON parsing failed. Cleaned string:", clean);
            throw e;
        }
    }
};

const ProjectProposalsPage: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Query parameters to handle page states
    const createParam = searchParams.get('create');
    const projectIdParam = searchParams.get('projectId');
    const customerIdParam = searchParams.get('customerId');
    const editIdParam = searchParams.get('editId');

    const isEditing = !!editIdParam || createParam === 'true';

    // List view search & filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Editor form state
    const [editorTab, setEditorTab] = useState<EditorTab>('details');
    const [proposalId, setProposalId] = useState('');
    const [title, setTitle] = useState('HVAC Labor, Parts & Crane Pricing Breakdown');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [serviceLocationName, setServiceLocationName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [scid, setScid] = useState('');
    const isCurrentTekAir = !!(state.currentOrganization?.name?.toLowerCase().includes('tekair') || state.currentOrganization?.id === 'org-1765817997819');
    const defaultOrgName = state.currentOrganization?.name || (isCurrentTekAir ? 'TekAir Inc.' : 'Service Provider');
    const defaultOrgPhone = state.currentOrganization?.phone || (isCurrentTekAir ? '210-318-4197' : '');
    const defaultOrgLicence = state.currentOrganization?.licenseNumber || state.currentOrganization?.taxId || (isCurrentTekAir ? 'TACLA73240E' : '');

    const [preparedByOrg, setPreparedByOrg] = useState(defaultOrgName);
    const [preparedByPhone, setPreparedByPhone] = useState(defaultOrgPhone);
    const [preparedByLicence, setPreparedByLicence] = useState(defaultOrgLicence);
    const [status, setStatus] = useState<'Draft' | 'Sent' | 'Accepted' | 'Declined'>('Draft');

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId) return null;
        return state.customers.find(c => c.id === selectedCustomerId) || null;
    }, [state.customers, selectedCustomerId]);

    // Labor breakdown state
    const [laborItems, setLaborItems] = useState<ProjectProposalLaborItem[]>([]);
    const [roundedLaborProposal, setRoundedLaborProposal] = useState<number>(0);
    const [roundedLaborBasis, setRoundedLaborBasis] = useState('Rounded for proposal presentation');

    // Parts breakdown state
    const [partItems, setPartItems] = useState<ProjectProposalPartItem[]>([]);

    // Allowances breakdown state
    const [allowanceItems, setAllowanceItems] = useState<ProjectProposalAllowanceItem[]>([]);

    // Clarifications and Exclusions
    const [clarifications, setClarifications] = useState<string[]>([
        'TekAir-supplied repair parts are included only for specified RTUs as itemized above.',
        'Replacements are changeout labor only. Customer/vendor supplies equipment and all associated materials unless itemized.'
    ]);
    const [newClarification, setNewClarification] = useState('');

    const [exclusions, setExclusions] = useState<string[]>([
        'Proposal excludes major roof/curb structural modifications, major gas piping replacement, major electrical code corrections, duct modifications, roof repairs, traffic control, permits, and after-hours premiums unless specifically listed.',
        'Pricing is based on available information, supplier quotations, and field notes. Availability and supplier pricing may change until parts are ordered.'
    ]);
    const [newExclusion, setNewExclusion] = useState('');

    const [importantClarification, setImportantClarification] = useState('');
    const [pricingDisclaimer, setPricingDisclaimer] = useState<string>('');
    const [warrantyTerms, setWarrantyTerms] = useState<string>('');
    const [displayFormat, setDisplayFormat] = useState<'itemized' | 'progressive'>('itemized');
    const [recommendedRoundedTotal, setRecommendedRoundedTotal] = useState<number>(0);

    // Pricing & tracking states
    const [taxRate, setTaxRate] = useState<number>(0);
    const [processingFeeRate, setProcessingFeeRate] = useState<number>(0);
    const [requireDeposit, setRequireDeposit] = useState<boolean>(false);
    const [depositType, setDepositType] = useState<'flat' | 'percentage'>('flat');
    const [depositValue, setDepositValue] = useState<number>(0);
    const [depositNotes, setDepositNotes] = useState<string>('');
    const [depositPaid, setDepositPaid] = useState<boolean>(false);
    const [trackingHistory, setTrackingHistory] = useState<any[]>([]);
    const [sendModalConfig, setSendModalConfig] = useState<{
        proposalId: string;
        customerId: string;
        locationId?: string | null;
        locationName?: string | null;
    } | null>(null);
    const [smsModalProposal, setSmsModalProposal] = useState<any | null>(null);

    // AI Generation / Parsing states
    const [aiPrompt, setAiPrompt] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [activeAiAction, setActiveAiAction] = useState<'prompt' | 'parse' | null>(null);

    // Estimator AI Rules & Contracted Rates state
    const [isEstimatorRulesOpen, setIsEstimatorRulesOpen] = useState(false);
    const [estimatorRules, setEstimatorRules] = useState<EstimatorAIRules>(DEFAULT_ESTIMATOR_RULES);

    const customerContractedRates = useMemo<CustomerContractedRates>(() => {
        return extractCustomerContractedRates(selectedCustomer, state.currentOrganization);
    }, [selectedCustomer, state.currentOrganization]);

    // Filter project-level proposals for the list view
    const customerOptions = useMemo<SearchableSelectOption[]>(() => {
        return (state.customers || []).map(c => ({
            value: c.id,
            label: c.name,
            subLabel: c.address || ''
        }));
    }, [state.customers]);

    const projectProposals = useMemo(() => {
        return (state.proposals || []).filter((p: Proposal) => p.isProjectLevel);
    }, [state.proposals]);

    // List view metrics
    const metrics = useMemo(() => {
        let totalVal = 0;
        let acceptedVal = 0;
        let pendingVal = 0;
        let draftVal = 0;

        let acceptedCount = 0;
        let pendingCount = 0;
        let draftCount = 0;

        projectProposals.forEach(p => {
            if (p.archived) return;
            const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
            totalVal += val;
            if (p.status === 'Accepted') {
                acceptedVal += val;
                acceptedCount++;
            } else if (p.status === 'Sent') {
                pendingVal += val;
                pendingCount++;
            } else {
                draftVal += val;
                draftCount++;
            }
        });

        return {
            totalVal,
            acceptedVal,
            pendingVal,
            draftVal,
            totalCount: projectProposals.filter(p => !p.archived).length,
            acceptedCount,
            pendingCount,
            draftCount
        };
    }, [projectProposals]);

    // Calculations
    const laborSubtotal = useMemo(() => {
        return laborItems.reduce((sum, item) => sum + (item.hours * item.rate), 0);
    }, [laborItems]);

    const partsTotal = useMemo(() => {
        return partItems.reduce((sum, item) => sum + item.customerLineTotal, 0);
    }, [partItems]);

    const allowanceTotal = useMemo(() => {
        return allowanceItems.reduce((sum, item) => sum + item.amount, 0);
    }, [allowanceItems]);

    const calculatedTotal = useMemo(() => {
        return (roundedLaborProposal || laborSubtotal) + partsTotal + allowanceTotal;
    }, [roundedLaborProposal, laborSubtotal, partsTotal, allowanceTotal]);

    // Tiered markup calculator logic
    const calculateDefaultMarkup = (cost: number): number => {
        if (cost < 500) return 100;
        if (cost < 750) return 75;
        if (cost < 1000) return 50;
        return 35;
    };    // Load selected proposal details or pre-fill on create
    useEffect(() => {
        const loadProposalDetails = async () => {
            if (isEditing) {
                if (editIdParam) {
                    const p = state.proposals.find(item => item.id === editIdParam);
                    if (p) {
                        // Check local storage draft first
                        const draftKey = `draft_project_proposal_${editIdParam}`;
                        const rawDraft = localStorage.getItem(draftKey);
                        let restored = false;
                        if (rawDraft) {
                            try {
                                const draft = JSON.parse(rawDraft);
                                const confirmRestore = await globalConfirm("We found an unsaved draft for this proposal. Would you like to restore it?");
                                if (confirmRestore) {
                                    setProposalId(draft.proposalId || p.id);
                                    setTitle(draft.title || p.title);
                                    setSelectedProjectId(draft.selectedProjectId || p.projectId || '');
                                    setSelectedCustomerId(draft.selectedCustomerId || p.customerId || '');
                                    setSelectedLocationId(draft.selectedLocationId || p.locationId || '');
                                    setServiceLocationName(draft.serviceLocationName || p.locationName || (p as any).serviceLocationName || '');
                                    setCustomerName(draft.customerName || p.customerName || '');
                                    setLocationAddress(draft.locationAddress || p.locationAddress || '');
                                    setPoNumber(draft.poNumber || p.poNumber || '');
                                    setPreparedByOrg(draft.preparedByOrg || p.preparedByOrganization || defaultOrgName);
                                    setPreparedByPhone(draft.preparedByPhone || p.preparedByPhone || defaultOrgPhone);
                                    setPreparedByLicence(draft.preparedByLicence || p.preparedByLicence || defaultOrgLicence);
                                    setStatus(draft.status || (p.status as any) || 'Draft');

                                    setLaborItems(draft.laborItems || p.laborItems || []);
                                    setRoundedLaborProposal(draft.roundedLaborProposal || p.roundedLaborProposal || 0);
                                    setRoundedLaborBasis(draft.roundedLaborBasis || p.roundedLaborBasis || 'Rounded for proposal presentation');

                                    setPartItems(draft.partItems || p.partItems || []);
                                    setAllowanceItems(draft.allowanceItems || p.allowanceItems || []);
                                    setClarifications(draft.clarifications || p.clarifications || []);
                                    setExclusions(draft.exclusions || p.exclusions || []);
                                    setImportantClarification(draft.importantClarification || p.importantClarification || '');
                                    setPricingDisclaimer(draft.pricingDisclaimer || p.pricingDisclaimer || (state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || '');
                                    setWarrantyTerms(draft.warrantyTerms || p.warrantyTerms || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                                    setRecommendedRoundedTotal(draft.recommendedRoundedTotal || p.recommendedRoundedTotal || 0);
                                    setTaxRate(draft.taxRate || p.taxRate || 0);
                                    setProcessingFeeRate(draft.processingFeeRate || p.processingFeeRate || 0);
                                    setRequireDeposit(draft.requireDeposit ?? p.requireDeposit ?? ((p.depositValue && p.depositValue > 0) || (p.depositAmount && p.depositAmount > 0) || false));
                                    setDepositType(draft.depositType === 'percentage' || p.depositType === 'percentage' ? 'percentage' : 'flat');
                                    setDepositValue(draft.depositValue ?? p.depositValue ?? 0);
                                    setDepositNotes(draft.depositNotes || p.depositNotes || '');
                                    setDepositPaid(draft.depositPaid ?? p.depositPaid ?? false);
                                    setDisplayFormat(draft.displayFormat || p.displayFormat || 'itemized');
                                    setTrackingHistory(draft.trackingHistory || p.trackingHistory || []);
                                    showToast.success("Draft restored!");
                                    restored = true;
                                } else {
                                    localStorage.removeItem(draftKey);
                                }
                            } catch (e) {
                                console.error("Failed to restore project proposal draft:", e);
                            }
                        }

                        if (!restored) {
                            setProposalId(p.id);
                            setTitle(p.title || 'HVAC Labor, Parts & Crane Pricing Breakdown');
                            setSelectedProjectId(p.projectId || '');
                            setSelectedCustomerId(p.customerId || '');
                            setSelectedLocationId(p.locationId || '');
                            setServiceLocationName(p.locationName || (p as any).serviceLocationName || '');
                            setCustomerName(p.customerName || '');
                            setLocationAddress(p.locationAddress || '');
                            setPoNumber(p.poNumber || '');
                            setPreparedByOrg(p.preparedByOrganization || defaultOrgName);
                            setPreparedByPhone(p.preparedByPhone || defaultOrgPhone);
                            setPreparedByLicence(p.preparedByLicence || defaultOrgLicence);
                            setStatus((p.status as any) || 'Draft');

                            setLaborItems(p.laborItems || []);
                            setRoundedLaborProposal(p.roundedLaborProposal || 0);
                            setRoundedLaborBasis(p.roundedLaborBasis || 'Rounded for proposal presentation');

                            setPartItems(p.partItems || []);
                            setAllowanceItems(p.allowanceItems || []);
                            setClarifications(p.clarifications || []);
                            setExclusions(p.exclusions || []);
                            setImportantClarification(p.importantClarification || '');
                            setPricingDisclaimer(p.pricingDisclaimer || (state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || '');
                            setWarrantyTerms(p.warrantyTerms || p.warrantyDisclaimer || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                            setRecommendedRoundedTotal(p.recommendedRoundedTotal || 0);
                            setTaxRate(p.taxRate || 0);
                            setProcessingFeeRate(p.processingFeeRate || 0);
                            setRequireDeposit(p.requireDeposit ?? ((p.depositValue && p.depositValue > 0) || (p.depositAmount && p.depositAmount > 0) || false));
                            setDepositType(p.depositType === 'percentage' ? 'percentage' : 'flat');
                            setDepositValue(p.depositValue ?? 0);
                            setDepositNotes(p.depositNotes || '');
                            setDepositPaid(p.depositPaid ?? false);
                            setDisplayFormat(p.displayFormat || 'itemized');
                            setTrackingHistory(p.trackingHistory || []);
                        }
                    } else {
                        showToast.error('Proposal not found');
                        navigate('/admin/project-proposals');
                    }
                } else {
                    // Creating a new proposal
                    const draftKey = `draft_project_proposal_new`;
                    const rawDraft = localStorage.getItem(draftKey);
                    let restored = false;
                    if (rawDraft) {
                        try {
                            const draft = JSON.parse(rawDraft);
                            const confirmRestore = await globalConfirm("We found an unsaved draft for a new proposal. Would you like to restore it?");
                            if (confirmRestore) {
                                setProposalId(draft.proposalId);
                                setTitle(draft.title || 'HVAC Labor, Parts & Crane Pricing Breakdown');
                                setSelectedProjectId(draft.selectedProjectId || '');
                                setSelectedCustomerId(draft.selectedCustomerId || '');
                                setSelectedLocationId(draft.selectedLocationId || '');
                                setServiceLocationName(draft.serviceLocationName || '');
                                setCustomerName(draft.customerName || '');
                                locationAddress && setLocationAddress(draft.locationAddress || '');
                                setPoNumber(draft.poNumber || '');
                                setPreparedByOrg(draft.preparedByOrg || defaultOrgName);
                                setPreparedByPhone(draft.preparedByPhone || defaultOrgPhone);
                                setPreparedByLicence(draft.preparedByLicence || defaultOrgLicence);
                                setStatus(draft.status || 'Draft');

                                setLaborItems(draft.laborItems || []);
                                setRoundedLaborProposal(draft.roundedLaborProposal || 0);
                                setRoundedLaborBasis(draft.roundedLaborBasis || 'Rounded for proposal presentation');

                                setPartItems(draft.partItems || []);
                                setAllowanceItems(draft.allowanceItems || []);
                                setClarifications(draft.clarifications || []);
                                setExclusions(draft.exclusions || []);
                                setImportantClarification(draft.importantClarification || '');
                                setPricingDisclaimer(draft.pricingDisclaimer || (state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || '');
                                setWarrantyTerms(draft.warrantyTerms || (state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                                setRecommendedRoundedTotal(draft.recommendedRoundedTotal || 0);
                                setTaxRate(draft.taxRate || 0);
                                setProcessingFeeRate(draft.processingFeeRate || 0);
                                setRequireDeposit(draft.requireDeposit || false);
                                setDepositType(draft.depositType === 'percentage' ? 'percentage' : 'flat');
                                setDepositValue(draft.depositValue || 0);
                                setDepositNotes(draft.depositNotes || '');
                                setDepositPaid(draft.depositPaid || false);
                                setDisplayFormat(draft.displayFormat || 'itemized');
                                setTrackingHistory(draft.trackingHistory || []);
                                showToast.success("Draft restored!");
                                restored = true;
                            } else {
                                localStorage.removeItem(draftKey);
                            }
                        } catch (e) {
                            console.error("Failed to restore project proposal draft:", e);
                        }
                    }
                    if (!restored && !pricingDisclaimer && state.currentOrganization) {
                        setPricingDisclaimer((state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || "Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability.");
                    }
                    if (!restored && !warrantyTerms && state.currentOrganization) {
                        setWarrantyTerms((state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '');
                    }

                    if (!restored) {
                        const newId = `PROP-PROJ-${Math.floor(100000 + Math.random() * 900000)}`;
                        setProposalId(newId);
                        setTitle('HVAC Labor, Parts & Crane Pricing Breakdown');
                        setPoNumber('');
                        setScid('');
                        setStatus('Draft');
                        setDisplayFormat('itemized');

                        if (projectIdParam) {
                            setSelectedProjectId(projectIdParam);
                            const proj = state.projects.find(p => p.id === projectIdParam);
                            if (proj) {
                                setSelectedCustomerId(proj.customerId || '');
                                setSelectedLocationId((proj as any).locationId || '');
                                setServiceLocationName((proj as any).locationName || '');
                                setCustomerName(proj.customerName || '');
                                setLocationAddress(proj.address || '');
                            }
                        } else {
                            setSelectedProjectId('');
                            setSelectedCustomerId('');
                            setSelectedLocationId('');
                            setServiceLocationName('');
                            setCustomerName('');
                            setLocationAddress('');
                        }

                        setLaborItems([]);
                        setRoundedLaborProposal(0);
                        setRoundedLaborBasis('Rounded for proposal presentation');
                        setPartItems([]);
                        setAllowanceItems([]);
                        setClarifications([
                            'TekAir-supplied repair parts are included only for specified RTUs as itemized above.',
                            'Replacements are changeout labor only. Customer/vendor supplies equipment and all associated materials unless itemized.'
                        ]);
                        setExclusions([
                            'Proposal excludes major roof/curb structural modifications, major gas piping replacement, major electrical code corrections, duct modifications, roof repairs, traffic control, permits, and after-hours premiums unless specifically listed.',
                            'Pricing is based on available information, supplier quotations, and field notes. Availability and supplier pricing may change until parts are ordered.'
                        ]);
                        setImportantClarification('');
                        setRecommendedRoundedTotal(0);
                        setTaxRate(0);
                        setProcessingFeeRate(0);
                        setRequireDeposit(false);
                        setDepositType('flat');
                        setDepositValue(0);
                        setDepositNotes('');
                        setDepositPaid(false);
                        setTrackingHistory([]);
                    }
                }
                setEditorTab('details');
            }
        };
        loadProposalDetails();
    }, [editIdParam, createParam, projectIdParam, state.proposals, state.projects, isEditing, navigate]);
    // Handle project selection change to auto-fill customer and address details
    const handleProjectChange = (projId: string) => {
        setSelectedProjectId(projId);
        if (projId) {
            const proj = state.projects.find(p => p.id === projId);
            if (proj) {
                setSelectedCustomerId(proj.customerId || '');
                setCustomerName(proj.customerName || '');
                setLocationAddress(proj.address || '');
            }
        }
    };

    // Table labor actions
    const addLaborItem = () => {
        const defaultRate = customerContractedRates.standardRate || 135;
        const newItem: ProjectProposalLaborItem = {
            id: `l-${Math.random().toString(36).substr(2, 9)}`,
            unitName: '',
            scope: '',
            hours: 0,
            rate: defaultRate,
            value: 0
        };
        setLaborItems([...laborItems, newItem]);
    };

    const updateLaborItem = (id: string, field: keyof ProjectProposalLaborItem, val: any) => {
        setLaborItems(laborItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: val };
                if (field === 'hours' || field === 'rate') {
                    const h = field === 'hours' ? Number(val) : item.hours;
                    const r = field === 'rate' ? Number(val) : item.rate;
                    updated.value = h * r;
                }
                return updated;
            }
            return item;
        }));
    };

    const removeLaborItem = (id: string) => {
        setLaborItems(laborItems.filter(item => item.id !== id));
    };

    // Table parts actions
    const addPartItem = () => {
        const newItem: ProjectProposalPartItem = {
            id: `p-${Math.random().toString(36).substr(2, 9)}`,
            unitName: '',
            partName: '',
            quantity: 1,
            vendorCost: 0,
            markupPct: 100,
            customerUnitPrice: 0,
            customerLineTotal: 0,
            availability: 'In stock'
        };
        setPartItems([...partItems, newItem]);
    };

    const updatePartItem = (id: string, field: keyof ProjectProposalPartItem, val: any) => {
        setPartItems(partItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: val };
                
                // Live recalculate customer pricing
                const cost = field === 'vendorCost' ? Number(val) : item.vendorCost;
                const qty = field === 'quantity' ? Number(val) : item.quantity;
                let markup = item.markupPct;

                // If vendorCost changed, autocalculate the markup percentage using our tiered schedule
                if (field === 'vendorCost') {
                    markup = calculateDefaultMarkup(cost);
                    updated.markupPct = markup;
                } else if (field === 'markupPct') {
                    markup = Number(val);
                }

                const unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
                updated.customerUnitPrice = unitPrice;
                updated.customerLineTotal = Number((unitPrice * qty).toFixed(2));

                return updated;
            }
            return item;
        }));
    };

    const removePartItem = (id: string) => {
        setPartItems(partItems.filter(item => item.id !== id));
    };

    // Table allowances actions
    const addAllowanceItem = () => {
        const newItem: ProjectProposalAllowanceItem = {
            id: `a-${Math.random().toString(36).substr(2, 9)}`,
            description: '',
            basis: '',
            amount: 0
        };
        setAllowanceItems([...allowanceItems, newItem]);
    };

    const updateAllowanceItem = (id: string, field: keyof ProjectProposalAllowanceItem, val: any) => {
        setAllowanceItems(allowanceItems.map(item => {
            if (item.id === id) {
                return { ...item, [field]: field === 'amount' ? Number(val) : val };
            }
            return item;
        }));
    };

    const removeAllowanceItem = (id: string) => {
        setAllowanceItems(allowanceItems.filter(item => item.id !== id));
    };

    const moveLaborItem = (id: string, direction: 'up' | 'down') => {
        const index = laborItems.findIndex(i => i.id === id);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= laborItems.length) return;
        
        const updated = [...laborItems];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        setLaborItems(updated);
    };

    const movePartItem = (id: string, direction: 'up' | 'down') => {
        const index = partItems.findIndex(i => i.id === id);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= partItems.length) return;
        
        const updated = [...partItems];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        setPartItems(updated);
    };

    const moveAllowanceItem = (id: string, direction: 'up' | 'down') => {
        const index = allowanceItems.findIndex(i => i.id === id);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= allowanceItems.length) return;
        
        const updated = [...allowanceItems];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        setAllowanceItems(updated);
    };

    // Add Clarifications & Exclusions lists
    const addClarification = () => {
        if (newClarification.trim()) {
            setClarifications([...clarifications, newClarification.trim()]);
            setNewClarification('');
        }
    };

    const removeClarification = (index: number) => {
        setClarifications(clarifications.filter((_, i) => i !== index));
    };

    const addExclusion = () => {
        if (newExclusion.trim()) {
            setExclusions([...exclusions, newExclusion.trim()]);
            setNewExclusion('');
        }
    };

    const removeExclusion = (index: number) => {
        setExclusions(exclusions.filter((_, i) => i !== index));
    };

    // AI Generation & Parsing Helpers
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiLoading(true);
        setActiveAiAction('prompt');
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            const rulesDirective = buildEstimatorAIPromptDirectives(
                selectedCustomer,
                state.currentOrganization,
                estimatorRules,
                aiPrompt
            );

            const systemPrompt = `You are an expert commercial HVAC estimator and proposal writer.
Based on the user's description and the mandatory client contracted rates and pricing rules, draft a commercial HVAC project proposal.
User description: "${aiPrompt}"

${rulesDirective}

Ensure that you return a valid JSON object matching the following TypeScript structure exactly:
{
  "title": "string (the proposal title, e.g., HVAC Labor, Parts & Crane Pricing Breakdown)",
  "poNumber": "string (extract PO number if mentioned)",
  "scid": "string (extract service call ID / SCID if mentioned)",
  "preparedByOrganization": "string (the company name, default to 'TekAir Inc')",
  "preparedByPhone": "string (default to '210-318-4197')",
  "preparedByLicence": "string (default to 'TACLA73240E')",
  "laborItems": [
    {
      "unitName": "string (e.g. 'RTU #1' or 'General Labor')",
      "scope": "string (detailed description of work to perform)",
      "hours": number,
      "rate": number (follow active rate directive: $${customerContractedRates.standardRate}/hr standard, $${customerContractedRates.overtimeRate}/hr overtime, or $${customerContractedRates.emergencyRate}/hr emergency)
    }
  ],
  "partItems": [
    {
      "unitName": "string (e.g. 'RTU #1')",
      "partName": "string (description of the part/material)",
      "quantity": number,
      "vendorCost": number (unit vendor cost before markup),
      "markupPct": number (suggested markup percent according to markup directive),
      "availability": "string (e.g., 'In stock' or '2-3 days')"
    }
  ],
  "allowanceItems": [
    {
      "description": "string (e.g. '60-ton crane allowance' or 'Contracted trip fee')",
      "basis": "string (explanation of the allowance)",
      "amount": number
    }
  ],
  "clarifications": ["string (general exclusions or clarifications)"],
  "exclusions": ["string (exclusions)"],
  "importantClarification": "string (extra highlighted summary or note)",
  "recommendedRoundedTotal": number (optional recommended rounded total)
}

CRITICAL:
1. ONLY return the JSON. No markdown backticks, no wrap in \`\`\`json. Just the JSON object.
2. The numbers should be numeric values, not string representation.
3. Be professional and detailed. Use standard HVAC nomenclature (RTUs, contactor, actuator, compressor, belt, condenser fan motor, refrigerant, recovery, etc.) where appropriate.
4. Strictly obey the CUSTOMER CONTRACTED RATES & PRICING RULES directive above.`;

            const result = await callGeminiAI({
                prompt: systemPrompt,
                modelName: "gemini-3.7-flash",
                config: {
                    responseMimeType: "application/json"
                }
            });

            const data = result.data as { text: string };
            const parsed = cleanAndParseJson(data.text);
            const standardized = applyEstimatorRulesToParsedData(
                parsed,
                estimatorRules,
                customerContractedRates,
                aiPrompt
            );

            await applyAiSuggestionData(standardized);
            showToast.success(t("AI suggestion applied successfully with active contracted rates and pricing rules!"));
            setAiPrompt('');
        } catch (error) {
            console.error("AI Generation Error:", error);
            showToast.warn(t("Failed to generate AI suggestion."));
        } finally {
            setIsAiLoading(false);
            setActiveAiAction(null);
        }
    };

    const handleParseDocument = async () => {
        if (!selectedFile) return;
        setIsAiLoading(true);
        setActiveAiAction('parse');
        try {
            const file = selectedFile;
            const isText = file.type === 'text/plain' || file.name.endsWith('.csv') || file.name.endsWith('.txt');

            if (isText) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const textContent = e.target?.result as string;
                    await sendFileAndPromptToAI(textContent, file.type, file.name, false);
                };
                reader.readAsText(file);
            } else {
                const reader = new FileReader();
                reader.onload = async () => {
                    const dataUrl = reader.result as string;
                    const base64Data = dataUrl.split(',')[1];
                    await sendFileAndPromptToAI(base64Data, file.type, file.name, true);
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error("Parse Document Error:", error);
            showToast.warn(t("Failed to parse document."));
            setIsAiLoading(false);
            setActiveAiAction(null);
        }
    };

    const sendFileAndPromptToAI = async (fileData: string, mimeType: string, fileName: string, isBase64: boolean) => {
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            const rulesDirective = buildEstimatorAIPromptDirectives(
                selectedCustomer,
                state.currentOrganization,
                estimatorRules,
                fileName
            );

            const systemPrompt = `You are an expert commercial HVAC estimator and proposal quote parser.
Analyze the attached document (named "${fileName}" of type "${mimeType}") which represents a vendor quote, technician notes, invoice, or bid specifications.
Extract and match any labor rows, part rows, allowance rows, PO numbers, SCID numbers, customer name, and general descriptions.

${rulesDirective}

Return a valid JSON object matching the following structure EXACTLY:
{
  "title": "string (a descriptive title for the proposal based on the document)",
  "poNumber": "string (if found in document)",
  "scid": "string (if found in document)",
  "preparedByOrganization": "string (default to 'TekAir Inc')",
  "preparedByPhone": "string (default to '210-318-4197')",
  "preparedByLicence": "string (default to 'TACLA73240E')",
  "laborItems": [
    {
      "unitName": "string (e.g. 'RTU #1')",
      "scope": "string (description of labor/services)",
      "hours": number,
      "rate": number (default to $${customerContractedRates.standardRate})
    }
  ],
  "partItems": [
    {
      "unitName": "string (e.g. 'RTU #1')",
      "partName": "string (description of the part/material)",
      "quantity": number,
      "vendorCost": number (unit vendor cost before markup),
      "markupPct": number (suggested markup percent according to markup directive),
      "availability": "string (e.g., 'In stock' or '2-3 days')"
    }
  ],
  "allowanceItems": [
    {
      "description": "string (e.g. 'Crane allowance')",
      "basis": "string (basis of allowance)",
      "amount": number
    }
  ],
  "clarifications": ["string"],
  "exclusions": ["string"],
  "importantClarification": "string"
}

CRITICAL:
1. ONLY return the JSON. No markdown backticks, no wrap in \`\`\`json. Just the JSON object.
2. If the document has vendor quote details, extract all individual parts and their prices/costs into 'partItems'.
3. If labor hours are not explicitly stated but tasks are described, estimate realistic labor hours at $${customerContractedRates.standardRate}/hr (or overtime/emergency rates if specified).
4. Strictly obey the CUSTOMER CONTRACTED RATES & PRICING RULES directive above.`;

            const payload: any = {
                prompt: isBase64 ? systemPrompt : `${systemPrompt}\n\nDOCUMENT TEXT CONTENT:\n${fileData}`,
                modelName: "gemini-3.7-flash",
                config: {
                    responseMimeType: "application/json"
                }
            };

            if (isBase64) {
                payload.image = {
                    data: fileData,
                    mimeType: mimeType || 'application/pdf'
                };
            }

            const result = await callGeminiAI(payload);
            const data = result.data as { text: string };
            const parsed = cleanAndParseJson(data.text);
            const standardized = applyEstimatorRulesToParsedData(
                parsed,
                estimatorRules,
                customerContractedRates,
                fileName
            );

            await applyAiSuggestionData(standardized);
            showToast.success(t("Document successfully parsed and proposal items updated!"));
            setSelectedFile(null);
        } catch (error) {
            console.error("AI File Parsing Error:", error);
            showToast.warn(t("Failed to parse document with AI."));
        } finally {
            setIsAiLoading(false);
            setActiveAiAction(null);
        }
    };

    const applyAiSuggestionData = async (parsed: any) => {
        const hasExisting = laborItems.length > 0 || partItems.length > 0 || allowanceItems.length > 0;
        const append = hasExisting ? await globalConfirm(
            t("You already have items in this proposal. Would you like to append/merge the new AI/parsed items to the existing ones?"),
            t("Merge Proposal Items"),
            t("Append & Merge"),
            t("Overwrite / Replace")
        ) : false;

        if (parsed.title && !append) setTitle(parsed.title);
        if (parsed.poNumber && !append) setPoNumber(parsed.poNumber);
        if (parsed.scid && !append) setScid(parsed.scid);
        if (parsed.preparedByOrganization && !append) setPreparedByOrg(parsed.preparedByOrganization);
        if (parsed.preparedByPhone && !append) setPreparedByPhone(parsed.preparedByPhone);
        if (parsed.preparedByLicence && !append) setPreparedByLicence(parsed.preparedByLicence);

        if (parsed.laborItems && Array.isArray(parsed.laborItems)) {
            const items = parsed.laborItems.map((li: any) => ({
                id: `l-${Math.random().toString(36).substr(2, 9)}`,
                unitName: li.unitName || '',
                scope: li.scope || '',
                hours: Number(li.hours) || 0,
                rate: Number(li.rate) || 135,
                value: (Number(li.hours) || 0) * (Number(li.rate) || 135)
            }));
            
            if (append) {
                const merged = [...laborItems];
                items.forEach((newItem: any) => {
                    const idx = merged.findIndex(
                        (existing: any) => 
                            (existing.unitName || '').trim().toLowerCase() === (newItem.unitName || '').trim().toLowerCase() && 
                            (existing.scope || '').trim().toLowerCase() === (newItem.scope || '').trim().toLowerCase()
                    );
                    if (idx > -1) {
                        const existing = merged[idx];
                        const totalHours = existing.hours + newItem.hours;
                        merged[idx] = {
                            ...existing,
                            hours: totalHours,
                            value: Number((totalHours * existing.rate).toFixed(2))
                        };
                    } else {
                        merged.push(newItem);
                    }
                });
                setLaborItems(merged);
            } else {
                setLaborItems(items);
            }
        }

        if (parsed.partItems && Array.isArray(parsed.partItems)) {
            const items = parsed.partItems.map((pi: any) => {
                const cost = Number(pi.vendorCost) || 0;
                const qty = Number(pi.quantity) || 1;
                const markup = pi.markupPct !== undefined ? Number(pi.markupPct) : calculateDefaultMarkup(cost);
                const unitPrice = Number((cost * (1 + markup / 100)).toFixed(2));
                return {
                    id: `p-${Math.random().toString(36).substr(2, 9)}`,
                    unitName: pi.unitName || '',
                    partName: pi.partName || '',
                    quantity: qty,
                    vendorCost: cost,
                    markupPct: markup,
                    customerUnitPrice: unitPrice,
                    customerLineTotal: Number((unitPrice * qty).toFixed(2)),
                    availability: pi.availability || 'In stock'
                };
            });
            
            if (append) {
                const merged = [...partItems];
                items.forEach((newItem: any) => {
                    const idx = merged.findIndex(
                        (existing: any) => 
                            (existing.unitName || '').trim().toLowerCase() === (newItem.unitName || '').trim().toLowerCase() && 
                            (existing.partName || '').trim().toLowerCase() === (newItem.partName || '').trim().toLowerCase()
                    );
                    if (idx > -1) {
                        const existing = merged[idx];
                        const totalQty = existing.quantity + newItem.quantity;
                        merged[idx] = {
                            ...existing,
                            quantity: totalQty,
                            customerLineTotal: Number((existing.customerUnitPrice * totalQty).toFixed(2))
                        };
                    } else {
                        merged.push(newItem);
                    }
                });
                setPartItems(merged);
            } else {
                setPartItems(items);
            }
        }

        if (parsed.allowanceItems && Array.isArray(parsed.allowanceItems)) {
            const items = parsed.allowanceItems.map((ai: any) => ({
                id: `a-${Math.random().toString(36).substr(2, 9)}`,
                description: ai.description || '',
                basis: ai.basis || '',
                amount: Number(ai.amount) || 0
            }));
            
            if (append) {
                const merged = [...allowanceItems];
                items.forEach((newItem: any) => {
                    const idx = merged.findIndex(
                        (existing: any) => 
                            (existing.description || '').trim().toLowerCase() === (newItem.description || '').trim().toLowerCase()
                    );
                    if (idx > -1) {
                        const existing = merged[idx];
                        merged[idx] = {
                            ...existing,
                            amount: Number((existing.amount + newItem.amount).toFixed(2))
                        };
                    } else {
                        merged.push(newItem);
                    }
                });
                setAllowanceItems(merged);
            } else {
                setAllowanceItems(items);
            }
        }

        if (parsed.clarifications && Array.isArray(parsed.clarifications)) {
            setClarifications(append ? [...new Set([...clarifications, ...parsed.clarifications])] : parsed.clarifications);
        }
        if (parsed.exclusions && Array.isArray(parsed.exclusions)) {
            setExclusions(append ? [...new Set([...exclusions, ...parsed.exclusions])] : parsed.exclusions);
        }
        if (parsed.importantClarification && !append) {
            setImportantClarification(parsed.importantClarification);
        }
        if (parsed.recommendedRoundedTotal && !append) {
            setRecommendedRoundedTotal(Number(parsed.recommendedRoundedTotal));
        }
    };

    // Save proposal to firebase and context state
    const handleSave = async (redirectAfterSave = true) => {
        if (!customerName) {
            showToast.warn('Customer Name is required');
            return;
        }

        const projectRef = state.projects.find(p => p.id === selectedProjectId);
        const baseSubtotal = recommendedRoundedTotal || calculatedTotal;
        const calculatedTaxAmount = Number((baseSubtotal * (taxRate / 100)).toFixed(2));
        const calculatedProcessingFeeAmount = Number(((baseSubtotal + calculatedTaxAmount) * (processingFeeRate / 100)).toFixed(2));
        const grandTotal = baseSubtotal + calculatedTaxAmount + calculatedProcessingFeeAmount;
        const calculatedDepositAmount = (requireDeposit && depositValue > 0)
            ? (depositType === 'percentage'
                ? Number(((grandTotal * depositValue) / 100).toFixed(2))
                : Math.min(grandTotal, Number(depositValue)))
            : 0;

        const payload: Proposal = {
            id: proposalId,
            organizationId: state.currentOrganization?.id || state.currentUser?.organizationId || 'org-1765817997819',
            customerId: selectedCustomerId || 'custom-customer',
            customerName,
            customerEmail: state.customers.find(c => c.id === selectedCustomerId)?.email || '',
            locationId: selectedLocationId || null,
            locationName: serviceLocationName || null,
            serviceLocationName: serviceLocationName || null,
            projectId: selectedProjectId || null,
            projectName: projectRef ? projectRef.name : null,
            status,
            createdAt: editIdParam ? (state.proposals.find(p => p.id === editIdParam)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            createdById: state.currentUser?.id || 'demo-admin-id',
            createdByName: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}`.trim() || 'Alex Admin' : 'Alex Admin',
            technicianId: state.currentUser?.id || 'demo-admin-id',
            
            isProjectLevel: true,
            title,
            locationAddress,
            poNumber,
            scid,
            preparedByOrganization: preparedByOrg,
            preparedByPhone,
            preparedByLicence,
            
            laborSubtotal,
            roundedLaborProposal,
            roundedLaborBasis,
            laborItems,
            
            partsTotal,
            partItems,
            
            allowanceTotal,
            allowanceItems,
            
            clarifications,
            exclusions,
            importantClarification,
            pricingDisclaimer: pricingDisclaimer.trim(),
            warrantyTerms: warrantyTerms.trim(),
            warrantyDisclaimer: warrantyTerms.trim(),
            displayFormat: displayFormat || 'itemized',
            
            calculatedTotal: calculatedTotal,
            recommendedRoundedTotal: recommendedRoundedTotal || 0,
            subtotal: baseSubtotal,
            taxRate,
            taxAmount: calculatedTaxAmount,
            processingFeeRate,
            processingFeeAmount: calculatedProcessingFeeAmount,
            total: grandTotal,
            requireDeposit,
            depositType: requireDeposit ? depositType : 'none',
            depositValue: requireDeposit ? depositValue : 0,
            depositAmount: requireDeposit ? calculatedDepositAmount : 0,
            depositRequired: requireDeposit ? calculatedDepositAmount : 0,
            depositNotes: requireDeposit ? depositNotes : '',
            depositPaid: requireDeposit ? depositPaid : false,
            depositPaidAmount: (requireDeposit && depositPaid) ? calculatedDepositAmount : 0,
            amountDueToday: requireDeposit && !depositPaid ? calculatedDepositAmount : 0,
            amountDueNet: requireDeposit && !depositPaid ? Math.max(0, grandTotal - calculatedDepositAmount) : grandTotal,
            items: [], // empty fallback so legacy pages don't crash
            trackingHistory: trackingHistory.length > 0 ? trackingHistory : [
                {
                    status: 'Draft',
                    timestamp: new Date().toISOString(),
                    updatedBy: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}`.trim() : 'System',
                    notes: 'Proposal created as draft'
                }
            ]
        };

        try {
            await db.collection('proposals').doc(proposalId).set(cleanUndefinedFields(payload), { merge: true });

            // If this proposal is tied to a project, sync any project document entries and budget if applicable
            if (payload.projectId) {
                try {
                    const projectSnap = await db.collection('projects').doc(payload.projectId).get();
                    if (projectSnap.exists) {
                        const projectData = projectSnap.data() as Project;
                        let hasProjectChanges = false;
                        let updatedFiles = projectData.files || [];
                        let updatedBudget = projectData.budget;

                        const newTotal = payload.recommendedRoundedTotal || payload.total || 0;
                        const propNumber = payload.proposalNumber || proposalId;
                        const formattedAmount = `$${newTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                        if (Array.isArray(updatedFiles)) {
                            updatedFiles = updatedFiles.map(f => {
                                const isMatching = 
                                    (propNumber && (f.label?.includes(propNumber) || f.id?.includes(propNumber))) ||
                                    (f.id && (f.id.toLowerCase().includes(proposalId.toLowerCase().replace(/[^a-z0-9]/g, '')) || f.label?.toLowerCase().includes(proposalId.toLowerCase())));
                                if (isMatching) {
                                    hasProjectChanges = true;
                                    let newLabel = f.label;
                                    if (newLabel && /\(\$[0-9,.]+\)/.test(newLabel)) {
                                        newLabel = newLabel.replace(/\(\$[0-9,.]+\)/, `(${formattedAmount})`);
                                    } else if (newLabel && /: \$[0-9,.]+/.test(newLabel)) {
                                        newLabel = newLabel.replace(/: \$[0-9,.]+/, `: ${formattedAmount}`);
                                    }
                                    return {
                                        ...f,
                                        label: newLabel,
                                        metadata: {
                                            ...f.metadata,
                                            amount: newTotal
                                        }
                                    };
                                }
                                return f;
                            });
                        }

                        // Also sync budget if it matched the previous proposal total or was 0
                        const oldProp = (state.proposals || []).find(p => p.id === proposalId);
                        const oldTotal = oldProp ? (oldProp.recommendedRoundedTotal || oldProp.total) : undefined;
                        if (oldTotal && projectData.budget === oldTotal) {
                            updatedBudget = newTotal;
                            hasProjectChanges = true;
                        }

                        if (hasProjectChanges) {
                            await db.collection('projects').doc(payload.projectId).update(cleanUndefinedFields({
                                files: updatedFiles,
                                budget: updatedBudget,
                                updatedAt: new Date().toISOString()
                            }));
                        }
                    }
                } catch (projSyncErr) {
                    console.error('Error syncing project proposal document/budget:', projSyncErr);
                }
            }

            const draftKey = `draft_project_proposal_${editIdParam || 'new'}`;
            localStorage.removeItem(draftKey);

            dispatch({
                type: editIdParam ? 'UPDATE_PROPOSAL' : 'ADD_PROPOSAL',
                payload
            });

            showToast.success(editIdParam ? 'Proposal updated successfully!' : 'Project Proposal created successfully!');
            
            if (redirectAfterSave) {
                navigate('/admin/project-proposals');
            }
        } catch (error) {
            console.error('Error saving project proposal:', error);
            showToast.error('Failed to save proposal');
        }
    };

    const handleOpenSendModal = (p: Proposal) => {
        setSendModalConfig({
            proposalId: p.id,
            customerId: p.customerId || 'custom-customer',
            locationId: p.locationId || (p as any).serviceLocationId || null,
            locationName: p.locationName || (p as any).siteLocationName || (p as any).address || null
        });
    };

    const handleSendFromBuilder = async () => {
        if (!customerName) {
            showToast.warn('Customer Name is required before sending');
            return;
        }
        await handleSave(false);
        const targetCust = state.customers?.find(c => c.id === selectedCustomerId);
        const targetLoc = targetCust?.serviceLocations?.find(l => l.id === selectedLocationId);
        setSendModalConfig({
            proposalId: proposalId,
            customerId: selectedCustomerId || 'custom-customer',
            locationId: selectedLocationId || null,
            locationName: targetLoc?.name || null
        });
    };

    const handleConfirmSend = async (selectedEmails: string[], attachPdf: boolean = true) => {
        if (!sendModalConfig) return;
        const targetId = sendModalConfig.proposalId;
        const baseP = state.proposals.find(item => item.id === targetId);

        // Build a comprehensive proposal object merging live editor state if active
        const isCurrentEditorProposal = targetId === proposalId || !baseP;
        
        const baseSub = isCurrentEditorProposal 
            ? (recommendedRoundedTotal || calculatedTotal)
            : (baseP?.subtotal || baseP?.recommendedRoundedTotal || baseP?.calculatedTotal || baseP?.total || 0);
        const tRate = isCurrentEditorProposal ? taxRate : (baseP?.taxRate || 0);
        const pRate = isCurrentEditorProposal ? processingFeeRate : (baseP?.processingFeeRate || 0);
        
        const taxAmt = Number((baseSub * (tRate / 100)).toFixed(2));
        const feeAmt = Number(((baseSub + taxAmt) * (pRate / 100)).toFixed(2));
        const totalVal = baseSub + taxAmt + feeAmt;

        const p: any = {
            id: targetId,
            title: isCurrentEditorProposal ? (title || 'Commercial HVAC Proposal') : (baseP?.title || title || 'Commercial HVAC Proposal'),
            customerName: isCurrentEditorProposal ? (customerName || baseP?.customerName || '') : (baseP?.customerName || customerName || ''),
            customerId: isCurrentEditorProposal ? (selectedCustomerId || baseP?.customerId) : (baseP?.customerId || selectedCustomerId),
            locationId: isCurrentEditorProposal ? (selectedLocationId || baseP?.locationId) : (baseP?.locationId || selectedLocationId),
            partItems: isCurrentEditorProposal ? partItems : (baseP?.partItems || partItems || []),
            laborItems: isCurrentEditorProposal ? laborItems : (baseP?.laborItems || laborItems || []),
            allowanceItems: isCurrentEditorProposal ? allowanceItems : (baseP?.allowanceItems || allowanceItems || []),
            clarifications: isCurrentEditorProposal ? clarifications : (baseP?.clarifications || clarifications || []),
            exclusions: isCurrentEditorProposal ? exclusions : (baseP?.exclusions || exclusions || []),
            importantClarification: isCurrentEditorProposal ? importantClarification : (baseP?.importantClarification || importantClarification || ''),
            items: baseP?.items || [],
            tiers: (baseP as any)?.tiers || [],
            selectedOption: (baseP as any)?.selectedOption || '',
            subtotal: baseSub,
            taxRate: tRate,
            processingFeeRate: pRate,
            taxAmount: taxAmt,
            totalAmount: totalVal,
            total: totalVal,
            preparedByOrganization: preparedByOrg || state.currentOrganization?.name || 'Service Provider',
            customerAddress: isCurrentEditorProposal ? (locationAddress || baseP?.locationAddress) : (baseP?.locationAddress || locationAddress),
            locationAddress: isCurrentEditorProposal ? (locationAddress || baseP?.locationAddress) : (baseP?.locationAddress || locationAddress),
            serviceLocationName: isCurrentEditorProposal ? (serviceLocationName || baseP?.serviceLocationName) : (baseP?.serviceLocationName || serviceLocationName),
            status: isCurrentEditorProposal ? (status || baseP?.status || 'Sent') : (baseP?.status || 'Sent'),
            createdAt: baseP?.createdAt || new Date().toISOString(),
            trackingHistory: isCurrentEditorProposal ? trackingHistory : (baseP?.trackingHistory || [])
        };

        try {
            const proposalLink = `${window.location.origin}/#/project-proposal-view/${p.id}`;
            const orgName = preparedByOrg || state.currentOrganization?.name || 'Service Provider';

            let pdfAttachments: any[] = [];
            if (attachPdf !== false) {
                showToast.info(t("Generating proposal PDF attachment..."));
                const pdfAtt = await generateProposalPdfAttachment(p, state.currentOrganization);
                if (pdfAtt) {
                    const sanitizedAtt = { ...pdfAtt };
                    if (sanitizedAtt.path && sanitizedAtt.content && sanitizedAtt.content.length > 400000) {
                        delete sanitizedAtt.content;
                    }
                    pdfAttachments.push(sanitizedAtt);
                }
            }

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: selectedEmails,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `New Commercial HVAC Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #e0f2fe;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;"><h2 style="color:#0284c7;margin-top:0;">New Proposal Ready</h2><p style="font-size:15px;color:#334155;">Hi ${p.customerName || customerName},</p><p style="font-size:15px;color:#334155;">We have prepared a new commercial HVAC contract proposal for you (total: <strong>$${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>). Please review and sign it online:</p>${createEmailButtonHtml('View &amp; Sign Proposal Online', proposalLink, '#0284c7')}<p style="font-size:13px;color:#64748b;margin-top:20px;">Thank you for choosing ${orgName}!</p></div>`,
                    text: `New Proposal from ${orgName} for $${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2})}. View here: ${proposalLink}`,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                    ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                },
                organizationId: state.currentOrganization?.id,
                type: 'ProposalLink',
                createdAt: new Date().toISOString()
            }));

            const timestamp = new Date().toISOString();
            const senderName = state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}`.trim() : 'System';
            
            const currentStatus = targetId === proposalId ? status : p.status;
            const isReminder = currentStatus === 'Sent' || currentStatus === 'Opened';
            const newStatus = isReminder ? currentStatus : 'Sent';
            const statusLabel = isReminder ? 'Reminder Sent' : 'Sent';

            const newEntry = {
                status: statusLabel,
                timestamp,
                updatedBy: senderName,
                notes: `${isReminder ? 'Reminder' : 'Proposal'} sent via email to: ${selectedEmails.join(', ')}`
            };
            
            const currentHistory = targetId === proposalId ? trackingHistory : (p.trackingHistory || []);
            const updatedHistory = [...currentHistory, newEntry];

            await db.collection('proposals').doc(p.id).update(cleanUndefinedFields({
                status: newStatus,
                sentAt: timestamp,
                trackingHistory: updatedHistory,
                // Update final total and tax/fee on proposal doc if it was sent from builder
                ...(targetId === proposalId ? {
                    taxRate: tRate,
                    taxAmount: taxAmt,
                    processingFeeRate: pRate,
                    processingFeeAmount: feeAmt,
                    subtotal: baseSub,
                    total: totalVal
                } : {})
            }));

            if (targetId === proposalId) {
                setStatus(newStatus as any);
                setTrackingHistory(updatedHistory);
                setTaxRate(tRate);
                setProcessingFeeRate(pRate);
            }

            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: {
                    ...p,
                    status: newStatus,
                    sentAt: timestamp,
                    trackingHistory: updatedHistory,
                    ...(targetId === proposalId ? {
                        taxRate: tRate,
                        taxAmount: taxAmt,
                        processingFeeRate: pRate,
                        processingFeeAmount: feeAmt,
                        subtotal: baseSub,
                        total: totalVal
                    } : {})
                }
            });

            showToast.success(isReminder ? "Reminder email sent successfully!" : "Proposal sent successfully!");
            setSendModalConfig(null);
        } catch (error) {
            console.error("Error sending proposal:", error);
            showToast.error("Failed to send proposal.");
        }
    };

    const handleDelete = async (id: string) => {
        if (await globalConfirm(t('Are you sure you want to delete this project proposal? (The job and other documents will remain active)'), t('Delete Proposal'), t('Delete Proposal'), t('Cancel'))) {
            try {
                if (!state.isDemoMode) {
                    await db.collection('proposals').doc(id).delete();
                    const linkedJobs = state.jobs.filter(j => j.proposalId === id || (j.linkedProposalIds || []).includes(id));
                    for (const j of linkedJobs) {
                        const newLinked = (j.linkedProposalIds || []).filter(pid => pid !== id);
                        const updates: any = { linkedProposalIds: newLinked };
                        if (j.proposalId === id) updates.proposalId = firebase.firestore.FieldValue.delete();
                        await db.collection('jobs').doc(j.id).update(updates).catch(() => {});
                        const updatedJob = { ...j, linkedProposalIds: newLinked };
                        if (j.proposalId === id) delete (updatedJob as any).proposalId;
                        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                    }
                }
                dispatch({ type: 'DELETE_PROPOSAL', payload: id });
                showToast.success('Proposal deleted successfully');
                if (isEditing) {
                    navigate('/admin/project-proposals');
                }
            } catch (err) {
                console.error(err);
                showToast.error('Failed to delete proposal');
            }
        }
    };

    const handleVerbalAccept = async (proposal: any) => {
        if (!(await globalConfirm(t("Are you sure you want to mark this proposal as verbally accepted?"), t("Verbal Authorization"), t("Accept Proposal"), t("Cancel")))) {
            return;
        }
        
        try {
            const signedAtStr = new Date().toISOString();
            const signerName = "Verbal Acceptance (Recorded by Admin)";
            const updatedHistory = [
                ...(proposal.trackingHistory || []),
                {
                    status: 'Accepted',
                    timestamp: signedAtStr,
                    updatedBy: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'Admin',
                    notes: `Proposal verbally accepted. Recorded by ${state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'Admin'}`
                }
            ];

            let updatePayload: any = {
                status: 'Accepted',
                signatureDataUrl: 'VERBAL_ACCEPTANCE',
                signatureName: signerName,
                signedAt: signedAtStr,
                trackingHistory: updatedHistory,
                updatedAt: signedAtStr
            };

            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updatePayload));
            dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposal.id, ...updatePayload } });

            if (proposal.jobId) {
                try {
                    const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                    if (jobDoc.exists) {
                        const jobData = jobDoc.data();
                        const existingInvoice = jobData?.invoice || {};
                        const targetJobId = proposal.jobId || jobDoc.id || 'JOB';
                        const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                        const invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                        const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;

                        const selectedTier = proposal.selectedOption || 'Basic';
                        const rawItems = Array.isArray(proposal.items) ? proposal.items : [];
                        const hasTiers = rawItems.some((i: any) => i.tier);
                        const targetItems = hasTiers 
                            ? rawItems.filter((i: any) => matchTier(i.tier, selectedTier))
                            : rawItems;

                        const invoiceItems = targetItems.map((pItem: any) => ({
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
                            subtotal: proposal.subtotal || 0,
                            taxAmount: proposal.taxAmount || 0,
                            totalAmount: proposal.total || 0,
                            amount: proposal.total || 0,
                            status: existingInvoice.status || 'Unpaid'
                        };

                        const updatedJob = {
                            ...jobData,
                            id: proposal.jobId,
                            proposalId: proposal.id,
                            invoice: updatedInvoice,
                            updatedAt: new Date().toISOString()
                        };

                        await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                            proposalId: proposal.id,
                            invoice: updatedInvoice,
                            updatedAt: new Date().toISOString()
                        }));
                        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

                        await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                            invoiceId: invoiceId
                        }));
                    }
                } catch (jobErr) {
                    console.error("Error updating associated job in ProjectProposalsPage:", jobErr);
                }
            }

            showToast.success(t("Proposal marked as verbally accepted."));
        } catch (e: any) {
            console.error("Error verbally accepting proposal:", e);
            showToast.error(t("Failed to accept proposal: ") + e.message);
        }
    };

    const copyPublicLink = (id: string) => {
        const url = `${window.location.origin}/#/project-proposal-view/${id}`;
        navigator.clipboard.writeText(url);
        showToast.success('Public review link copied to clipboard!');
    };

    const formatCurrency = (n: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    };

    const handleArchiveProposal = async (proposal: Proposal, archive: boolean) => {
        try {
            const updatedProposal: Proposal = {
                ...proposal,
                archived: archive,
                archivedAt: archive ? new Date().toISOString() : null,
                archivedBy: archive ? (state.currentUser?.name || state.currentUser?.email || 'User') : null,
                updatedAt: new Date().toISOString(),
            };

            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                archived: archive,
                archivedAt: archive ? new Date().toISOString() : null,
                archivedBy: archive ? (state.currentUser?.name || state.currentUser?.email || 'User') : null,
                updatedAt: new Date().toISOString(),
            }));

            dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal });
            showToast.success(archive ? t("Proposal archived successfully") : t("Proposal restored successfully"));
        } catch (error) {
            console.error("Error archiving proposal:", error);
            showToast.error(t("Failed to update proposal archive status"));
        }
    };

    const filteredProposals = useMemo(() => {
        return projectProposals.filter(p => {
            const matchesSearch = 
                (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.scid || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (statusFilter === 'Archived') {
                return p.archived && matchesSearch;
            }

            // When searching with "all" status, search everything including archived
            if (searchTerm.trim() && statusFilter === 'all') {
                return matchesSearch;
            }

            // Normal view: hide archived
            if (p.archived) return false;

            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [projectProposals, searchTerm, statusFilter]);

    // Auto-save draft changes for project proposals
    useEffect(() => {
        if (!isEditing) return;

        const original = editIdParam ? state.proposals.find(p => p.id === editIdParam) : null;
        
        const hasChanges = !original ? (
            title !== 'HVAC Labor, Parts & Crane Pricing Breakdown' ||
            selectedProjectId !== '' ||
            selectedCustomerId !== '' ||
            selectedLocationId !== '' ||
            serviceLocationName !== '' ||
            customerName !== '' ||
            locationAddress !== '' ||
            poNumber !== '' ||
            scid !== '' ||
            preparedByOrg !== defaultOrgName ||
            preparedByPhone !== defaultOrgPhone ||
            preparedByLicence !== defaultOrgLicence ||
            status !== 'Draft' ||
            laborItems.length > 0 ||
            roundedLaborProposal !== 0 ||
            partItems.length > 0 ||
            allowanceItems.length > 0 ||
            clarifications.length !== 2 ||
            exclusions.length !== 2 ||
            importantClarification !== '' ||
            recommendedRoundedTotal !== 0 ||
            taxRate !== 0 ||
            processingFeeRate !== 0 ||
            requireDeposit ||
            depositValue !== 0 ||
            depositPaid ||
            depositNotes !== ''
        ) : (
            title !== original.title ||
            selectedProjectId !== (original.projectId || '') ||
            selectedCustomerId !== (original.customerId || '') ||
            selectedLocationId !== (original.locationId || '') ||
            serviceLocationName !== (original.locationName || (original as any).serviceLocationName || '') ||
            customerName !== (original.customerName || '') ||
            locationAddress !== (original.locationAddress || '') ||
            poNumber !== (original.poNumber || '') ||
            scid !== (original.scid || '') ||
            preparedByOrg !== (original.preparedByOrganization || defaultOrgName) ||
            preparedByPhone !== (original.preparedByPhone || defaultOrgPhone) ||
            preparedByLicence !== (original.preparedByLicence || defaultOrgLicence) ||
            status !== (original.status || 'Draft') ||
            JSON.stringify(laborItems) !== JSON.stringify(original.laborItems || []) ||
            roundedLaborProposal !== (original.roundedLaborProposal || 0) ||
            roundedLaborBasis !== (original.roundedLaborBasis || 'Rounded for proposal presentation') ||
            JSON.stringify(partItems) !== JSON.stringify(original.partItems || []) ||
            JSON.stringify(allowanceItems) !== JSON.stringify(original.allowanceItems || []) ||
            JSON.stringify(clarifications) !== JSON.stringify(original.clarifications || []) ||
            JSON.stringify(exclusions) !== JSON.stringify(original.exclusions || []) ||
            importantClarification !== (original.importantClarification || '') ||
            pricingDisclaimer !== (original.pricingDisclaimer || '') ||
            warrantyTerms !== (original.warrantyTerms || '') ||
            recommendedRoundedTotal !== (original.recommendedRoundedTotal || 0) ||
            taxRate !== (original.taxRate || 0) ||
            processingFeeRate !== (original.processingFeeRate || 0) ||
            requireDeposit !== (original.requireDeposit || false) ||
            depositType !== (original.depositType || 'flat') ||
            depositValue !== (original.depositValue || 0) ||
            depositNotes !== (original.depositNotes || '') ||
            depositPaid !== (original.depositPaid || false) ||
            displayFormat !== (original.displayFormat || 'itemized')
        );

        const draftKey = `draft_project_proposal_${editIdParam || 'new'}`;
        if (hasChanges) {
            const draftData = {
                proposalId,
                title,
                selectedProjectId,
                selectedCustomerId,
                selectedLocationId,
                serviceLocationName,
                customerName,
                locationAddress,
                poNumber,
                scid,
                preparedByOrg,
                preparedByPhone,
                preparedByLicence,
                status,
                laborItems,
                roundedLaborProposal,
                roundedLaborBasis,
                partItems,
                allowanceItems,
                clarifications,
                exclusions,
                importantClarification,
                pricingDisclaimer,
                warrantyTerms,
                recommendedRoundedTotal,
                taxRate,
                processingFeeRate,
                requireDeposit,
                depositType,
                depositValue,
                depositNotes,
                depositPaid,
                displayFormat,
                trackingHistory
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
        } else {
            localStorage.removeItem(draftKey);
        }
    }, [
        isEditing,
        editIdParam,
        state.proposals,
        proposalId,
        title,
        selectedProjectId,
        selectedCustomerId,
        selectedLocationId,
        serviceLocationName,
        customerName,
        locationAddress,
        poNumber,
        scid,
        preparedByOrg,
        preparedByPhone,
        preparedByLicence,
        status,
        laborItems,
        roundedLaborProposal,
        roundedLaborBasis,
        partItems,
        allowanceItems,
        clarifications,
        exclusions,
        importantClarification,
        pricingDisclaimer,
        warrantyTerms,
        recommendedRoundedTotal,
        taxRate,
        processingFeeRate,
        requireDeposit,
        depositType,
        depositValue,
        depositNotes,
        depositPaid,
        displayFormat,
        trackingHistory
    ]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {!isEditing ? (
                // --- LIST VIEW ---
                <div className="space-y-6 animate-fade-in">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title={t("Back")}>
                                    <ArrowLeft size={20} />
                                </button>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <FileSpreadsheet className="text-primary-600 dark:text-primary-400" size={32} />
                                    {t("Project Proposals & Bids")}
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-10">
                                {t("Create and manage commercial level contract estimates and HVAC bid proposals.")}
                            </p>
                        </div>
                        <Button 
                            onClick={() => navigate('/admin/project-proposals?create=true')} 
                            className="flex items-center gap-2 shadow-lg bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0"
                        >
                            <Sparkles size={16} />
                            {t("Create New Commercial Bid")}
                        </Button>
                    </div>

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-primary-500 shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Total Projects Valued")}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(metrics.totalVal)}</p>
                            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                <span>{metrics.totalCount} {t("Proposals")}</span>
                            </div>
                        </Card>
                        <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Accepted Commercial Bids")}</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(metrics.acceptedVal)}</p>
                            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                <span>{metrics.acceptedCount} {t("Closed/Signed")}</span>
                            </div>
                        </Card>
                        <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Pending Out For Review")}</p>
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{formatCurrency(metrics.pendingVal)}</p>
                            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                <span>{metrics.pendingCount} {t("Sent to Clients")}</span>
                            </div>
                        </Card>
                        <Card className="p-4 bg-white dark:bg-slate-800 border-l-4 border-amber-500 shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("Draft Estimates")}</p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(metrics.draftVal)}</p>
                            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                <span>{metrics.draftCount} {t("In Draft Mode")}</span>
                            </div>
                        </Card>
                    </div>

                    {/* Filter and Search Bar */}
                    <Card className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-md">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder={t("Search by customer, PO, title...")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                <option value="all">{t("All Statuses")}</option>
                                <option value="Draft">{t("Draft")}</option>
                                <option value="Sent">{t("Sent")}</option>
                                <option value="Accepted">{t("Accepted")}</option>
                                <option value="Declined">{t("Declined")}</option>
                                <option value="Archived">{t("📦 Archived")}</option>
                            </select>
                        </div>
                    </Card>

                    {/* Mobile Proposals Cards View (App / Mobile View Only) */}
                    <div className="md:hidden space-y-3.5 mb-6">
                        {filteredProposals.map((p) => {
                            const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
                            const linkedJob = (state.jobs || []).find((j: any) => (p.linkedJobIds || []).includes(j.id) || j.proposalId === p.id || j.projectId === p.id || j.id === p.jobId);
                            const linkedCust = (state.customers || []).find((c: any) => c.id === p.customerId || c.name?.trim().toLowerCase() === p.customerName?.trim().toLowerCase());

                            let siteLocName = (p as any).serviceLocationName || (p as any).locationName || (p as any).siteName || linkedJob?.locationName || '';
                            let siteLocAddr = (p as any).serviceLocationAddress || (p as any).locationAddress || (p as any).siteAddress || (p as any).address || linkedJob?.address || '';

                            if (linkedCust?.serviceLocations?.length) {
                                const matchedLoc = linkedCust.serviceLocations.find((l: any) =>
                                    (p.locationId && l.id === p.locationId) ||
                                    (siteLocName && (l.name?.trim().toLowerCase() === siteLocName.trim().toLowerCase() || l.propertyName?.trim().toLowerCase() === siteLocName.trim().toLowerCase())) ||
                                    (siteLocAddr && l.address && siteLocAddr.toLowerCase().includes(l.address.toLowerCase()))
                                ) || (linkedCust.serviceLocations.length === 1 ? linkedCust.serviceLocations[0] : null);

                                if (matchedLoc) {
                                    if (!siteLocName || siteLocName === p.customerName) siteLocName = matchedLoc.propertyName || matchedLoc.name || siteLocName;
                                    if (!siteLocAddr) siteLocAddr = matchedLoc.address || '';
                                }
                            }

                            const hasBeenOpened = p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened');

                            return (
                                <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                                    {/* Top Row: Date, ID, Status */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-slate-400">
                                                #{p.proposalNumber || p.id}
                                            </span>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase">
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {p.archived ? (
                                                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                    <Archive size={11} />
                                                    {t("Archived")}
                                                </span>
                                            ) : (
                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                                    p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                    p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                    p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800' :
                                                    (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            )}
                                            {p.archived && (
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    ({p.status === 'Accepted' ? t("Job Completed") : p.status})
                                                </span>
                                            )}
                                            {hasBeenOpened && p.status !== 'Accepted' && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                    {t("Opened")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Customer & Total Value */}
                                    <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Customer</span>
                                            <p className="font-black text-slate-950 dark:text-white text-sm truncate" title={p.customerName}>
                                                {p.customerName || t('No Customer Specified')}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Total Value</span>
                                            <span className="font-black text-base text-slate-900 dark:text-white">
                                                {formatCurrency(val)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Site Location & PO */}
                                    {(siteLocName || siteLocAddr || p.poNumber || p.scid || p.title) && (
                                        <div className="space-y-1.5 pt-1 text-xs">
                                            {(siteLocName || siteLocAddr) && (
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                                                        <MapPin size={10} /> Site Location
                                                    </span>
                                                    {siteLocName && (
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block truncate" title={siteLocName}>
                                                            {siteLocName}
                                                        </span>
                                                    )}
                                                    {siteLocAddr && (
                                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate" title={siteLocAddr}>
                                                            {siteLocAddr}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {(p.poNumber || p.scid) && (
                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                    {p.poNumber && (
                                                        <span>PO:{' '}
                                                            <button
                                                                onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: p.poNumber, customerId: p.customerId || null } })}
                                                                className="text-slate-700 dark:text-slate-300 font-bold hover:underline transition cursor-pointer border-none bg-transparent p-0 inline font-sans text-xs"
                                                            >
                                                                {p.poNumber}
                                                            </button>
                                                        </span>
                                                    )}
                                                    {p.scid && <span>SCID: <strong className="text-slate-700 dark:text-slate-300">{p.scid}</strong></span>}
                                                </div>
                                            )}
                                            {p.title && !siteLocName && !siteLocAddr && (
                                                <p className="text-xs text-slate-400 italic">{p.title}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
                                        <button 
                                            title={t("Edit Proposal")}
                                            onClick={() => navigate(`/admin/project-proposals?editId=${p.id}`)}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Edit2 size={13} />
                                            {t("Edit")}
                                        </button>
                                        <button 
                                            title={t("Send to Customer")}
                                            onClick={() => handleOpenSendModal(p)}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Send size={13} />
                                            {t("Send")}
                                        </button>
                                        <button 
                                            title={t("Send via SMS")}
                                            onClick={() => setSmsModalProposal(p)}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <MessageSquare size={13} />
                                            {t("SMS")}
                                        </button>
                                        <button 
                                            title={t("Copy Public Link")}
                                            onClick={() => copyPublicLink(p.id)}
                                            className="flex items-center gap-1 px-2 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <Copy size={13} />
                                            {t("Link")}
                                        </button>
                                        <a 
                                            href={`/#/project-proposal-view/${p.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            title={t("Open Public View")}
                                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm"
                                        >
                                            <ExternalLink size={13} />
                                            {t("View")}
                                        </a>
                                        {p.status !== 'Accepted' && (
                                            <button 
                                                title={t("Verbal Accept")}
                                                onClick={() => handleVerbalAccept(p)}
                                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                            >
                                                <CheckCircle size={13} />
                                                {t("Accept")}
                                            </button>
                                        )}
                                        <button 
                                            title={p.archived ? t("Restore Proposal") : t("Archive Proposal")}
                                            aria-label={p.archived ? "Restore Proposal" : "Archive Proposal"}
                                            onClick={() => handleArchiveProposal(p, !p.archived)}
                                            className={`flex items-center gap-1 px-2.5 py-1 border rounded-md transition-colors font-bold shadow-sm ${
                                                p.archived 
                                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40' 
                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {p.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                            {p.archived ? t("Restore") : t("Archive")}
                                        </button>
                                        <button 
                                            title={t("Delete")}
                                            onClick={() => handleDelete(p.id)}
                                            className="flex items-center gap-1 px-2 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm ml-auto"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredProposals.length === 0 && (
                            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-medium italic">
                                <AlertCircle size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                                <span>{t("No project proposals found matching criteria.")}</span>
                            </div>
                        )}
                    </div>

                    {/* Main Table List (Desktop View Only) */}
                    <div className="hidden md:block">
                        <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl bg-white dark:bg-slate-900">
                        <Table headers={[t('Date'), t('Proposal ID'), t('Customer & Site Location'), t('PO / SCID'), t('Total Value'), t('Status')]}>
                            {filteredProposals.map((p) => {
                                 const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
                                 const linkedJob = (state.jobs || []).find((j: any) => (p.linkedJobIds || []).includes(j.id) || j.proposalId === p.id || j.projectId === p.id || j.id === p.jobId);
                                 const linkedCust = (state.customers || []).find((c: any) => c.id === p.customerId || c.name?.trim().toLowerCase() === p.customerName?.trim().toLowerCase());

                                 let siteLocName = (p as any).serviceLocationName || (p as any).locationName || (p as any).siteName || linkedJob?.locationName || '';
                                 let siteLocAddr = (p as any).serviceLocationAddress || (p as any).locationAddress || (p as any).siteAddress || (p as any).address || linkedJob?.address || '';

                                 if (linkedCust?.serviceLocations?.length) {
                                     const matchedLoc = linkedCust.serviceLocations.find((l: any) =>
                                         (p.locationId && l.id === p.locationId) ||
                                         (siteLocName && (l.name?.trim().toLowerCase() === siteLocName.trim().toLowerCase() || l.propertyName?.trim().toLowerCase() === siteLocName.trim().toLowerCase())) ||
                                         (siteLocAddr && l.address && siteLocAddr.toLowerCase().includes(l.address.toLowerCase()))
                                     ) || (linkedCust.serviceLocations.length === 1 ? linkedCust.serviceLocations[0] : null);

                                     if (matchedLoc) {
                                         if (!siteLocName || siteLocName === p.customerName) siteLocName = matchedLoc.propertyName || matchedLoc.name || siteLocName;
                                         if (!siteLocAddr) siteLocAddr = matchedLoc.address || '';
                                     }
                                 }

                                 return (
                                     <tbody key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                                         <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all">
                                             <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                 {new Date(p.createdAt).toLocaleDateString()}
                                             </td>
                                             <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                                 #{p.proposalNumber || p.id}
                                             </td>
                                             <td className="px-6 py-4">
                                                 <div className="flex flex-col gap-1 max-w-[220px]">
                                                     <div>
                                                         <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Customer</span>
                                                         <p className="font-black text-slate-950 dark:text-white text-xs truncate" title={p.customerName}>
                                                             {p.customerName}
                                                         </p>
                                                     </div>
                                                     {(siteLocName || siteLocAddr) && (
                                                         <div className="pt-0.5 border-t border-slate-100 dark:border-slate-800">
                                                             <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                                                                 <MapPin size={9} /> Site Location
                                                             </span>
                                                             {siteLocName && (
                                                                 <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate" title={siteLocName}>
                                                                     {siteLocName}
                                                                 </span>
                                                             )}
                                                             {siteLocAddr && (
                                                                 <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate" title={siteLocAddr}>
                                                                     {siteLocAddr}
                                                                 </span>
                                                             )}
                                                         </div>
                                                     )}
                                                     {p.title && !siteLocName && !siteLocAddr && (
                                                         <p className="text-xs text-slate-400 italic mt-0.5">{p.title}</p>
                                                     )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {p.poNumber || p.scid ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        {p.poNumber && (
                                                            <span>PO:{' '}
                                                                <button
                                                                    onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: p.poNumber, customerId: p.customerId || null } })}
                                                                    className="text-slate-700 dark:text-slate-300 font-bold hover:underline transition cursor-pointer border-none bg-transparent p-0 inline font-sans text-xs"
                                                                >
                                                                    {p.poNumber}
                                                                </button>
                                                            </span>
                                                        )}
                                                        {p.scid && <span>SCID: <strong className="text-slate-700 dark:text-slate-300">{p.scid}</strong></span>}
                                                    </div>
                                                ) : (
                                                    <span className="italic text-slate-400">--</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                                {formatCurrency(val)}
                                            </td>
                                            <td className="px-6 py-4">
                                                 <div className="flex flex-col gap-1 items-start">
                                                     {p.archived ? (
                                                         <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                             <Archive size={11} />
                                                             {t("Archived")}
                                                         </span>
                                                     ) : (
                                                         <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                                             p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                             p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                             p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800' :
                                                             (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800' :
                                                             'bg-amber-100 text-amber-800'
                                                         }`}>
                                                             {p.status}
                                                         </span>
                                                     )}
                                                     {p.archived && (
                                                         <span className="text-[10px] text-slate-500 font-medium">
                                                             ({p.status === 'Accepted' ? t("Job Completed") : p.status})
                                                         </span>
                                                     )}
                                                     {(() => {
                                                         const hasBeenOpened = p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened');
                                                         return hasBeenOpened && p.status !== 'Accepted' && (
                                                             <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 flex items-center gap-1">
                                                                 <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                                 {t("Opened")}
                                                             </span>
                                                         );
                                                     })()}
                                                 </div>
                                             </td>
                                         </tr>
                                         <tr className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                             <td colSpan={6} className="px-6 py-2 border-t-0">
                                                 <div className="flex flex-wrap gap-2 items-center text-xs">
                                                     <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-2">{t("Actions")}:</span>
                                                     <button 
                                                         title={t("Edit Proposal")}
                                                         onClick={() => navigate(`/admin/project-proposals?editId=${p.id}`)}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <Edit2 size={14} />
                                                         {t("Edit")}
                                                     </button>
                                                     <button 
                                                         title={t("Send to Customer")}
                                                         onClick={() => handleOpenSendModal(p)}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <Send size={14} />
                                                         {t("Send")}
                                                     </button>
                                                     <button 
                                                         title={t("Send via SMS")}
                                                         onClick={() => setSmsModalProposal(p)}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <MessageSquare size={14} />
                                                         {t("SMS")}
                                                     </button>
                                                     <button 
                                                         title={t("Copy Public Link")}
                                                         onClick={() => copyPublicLink(p.id)}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <Copy size={14} />
                                                         {t("Copy Link")}
                                                     </button>
                                                     <a 
                                                         href={`/#/project-proposal-view/${p.id}`} 
                                                         target="_blank" 
                                                         rel="noopener noreferrer"
                                                         title={t("Open Public View")}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <ExternalLink size={14} />
                                                         {t("Public View")}
                                                     </a>
                                                     {p.status !== 'Accepted' && (
                                                         <button 
                                                             title={t("Verbal Accept")}
                                                             onClick={() => handleVerbalAccept(p)}
                                                             className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                                         >
                                                             <CheckCircle size={14} />
                                                             {t("Verbal Accept")}
                                                         </button>
                                                     )}
                                                     <button 
                                                         title={p.archived ? t("Restore Proposal") : t("Archive Proposal")}
                                                         aria-label={p.archived ? "Restore Proposal" : "Archive Proposal"}
                                                         onClick={() => handleArchiveProposal(p, !p.archived)}
                                                         className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md transition-colors font-bold shadow-sm ${
                                                             p.archived 
                                                                 ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40' 
                                                                 : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                         }`}
                                                     >
                                                         {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                                         {p.archived ? t("Restore") : t("Archive")}
                                                     </button>
                                                     <button 
                                                         title={t("Delete")}
                                                         onClick={() => handleDelete(p.id)}
                                                         className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                                     >
                                                         <Trash2 size={14} />
                                                         {t("Delete")}
                                                     </button>
                                                 </div>
                                             </td>
                                        </tr>
                                    </tbody>
                                );
                            })}
                            {filteredProposals.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center text-slate-400 font-medium italic">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <AlertCircle size={28} className="text-slate-300 dark:text-slate-700" />
                                            <span>{t("No project proposals found matching criteria.")}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </Table>
                    </Card>
                    </div>
                </div>
            ) : (
                // --- INTERACTIVE BUILDER / EDITOR MODE ---
                <div className="space-y-6 animate-fade-in">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <button 
                            onClick={() => navigate('/admin/project-proposals')}
                            className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft size={16} />
                            {t("Back to Proposals List")}
                        </button>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {editIdParam && (
                                <Button 
                                    variant="danger" 
                                    onClick={() => handleDelete(proposalId)}
                                    className="flex items-center gap-2 text-xs py-1.5"
                                >
                                    <Trash2 size={14} />
                                    {t("Delete Proposal")}
                                </Button>
                            )}
                            <Button 
                                variant="secondary"
                                onClick={() => handleSave(false)}
                                className="flex items-center gap-2 text-xs py-1.5"
                            >
                                <Save size={14} />
                                {t("Quick Save Draft")}
                            </Button>
                            <Button 
                                onClick={() => handleSave(true)}
                                className="flex items-center gap-2 text-xs py-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0"
                            >
                                <CheckCircle size={14} />
                                {t("Save & Close")}
                            </Button>
                        </div>
                    </div>

                    {/* Proposal Meta Header */}
                    <Card className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-0 shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-10 -translate-y-10">
                            <Sparkles size={300} />
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                            <div>
                                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                                    {editIdParam ? t("Edit Mode") : t("Creator Mode")}
                                </span>
                                <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1">
                                    {customerName ? `${customerName} - ${title}` : t("Create Commercial Estimate Proposal")}
                                </h2>
                                <p className="text-xs text-indigo-200 mt-1 font-medium">
                                    Proposal ID: <strong className="font-mono text-white">#{proposalId}</strong>
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col md:items-end">
                                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{t("Estimated Bid Total")}</span>
                                <span className="text-2xl font-black text-emerald-400 mt-0.5">
                                    {formatCurrency(recommendedRoundedTotal || calculatedTotal)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* AI Commercial Proposal Assistant */}
                    <Card className="p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-800/40 dark:to-indigo-950/20 border border-indigo-100 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden animate-fade-in">
                        <div className="absolute right-0 bottom-0 opacity-[0.02] pointer-events-none translate-x-5 translate-y-5">
                            <Sparkles size={150} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="bg-indigo-600 text-white p-2 rounded-xl">
                                    <Sparkles size={20} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                                        {t("AI Commercial Proposal Assistant")}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t("Draft proposal details automatically using AI prompts or upload a PDF/text quote to extract items.")}
                                    </p>
                                </div>
                            </div>
                            
                            <button
                                type="button"
                                onClick={() => setIsEstimatorRulesOpen(!isEstimatorRulesOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                    isEstimatorRulesOpen 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                        : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 shadow-xs'
                                }`}
                            >
                                <Sliders size={14} />
                                <span>{isEstimatorRulesOpen ? t("Close Estimating Rules") : t("Configure Pricing & Estimating Rules")}</span>
                                {(estimatorRules.discountPct || 0) > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                                        {estimatorRules.discountPct}% Disc
                                    </span>
                                )}
                                {estimatorRules.rateMode !== 'auto' && (
                                    <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                        {estimatorRules.rateMode}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Customer Contracted Rates Summary Bar */}
                        <div className="relative z-10 mb-4">
                            {selectedCustomer ? (
                                <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-indigo-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                            <Tag size={13} className="text-indigo-600" />
                                            {selectedCustomer.name}:
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                            Standard: ${customerContractedRates.standardRate.toFixed(2)}/hr {customerContractedRates.isStandardContracted ? ' [Contracted]' : ''}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                            Overtime: ${customerContractedRates.overtimeRate.toFixed(2)}/hr {customerContractedRates.isOvertimeContracted ? ' [Contracted]' : ''}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                            Emergency: ${customerContractedRates.emergencyRate.toFixed(2)}/hr {customerContractedRates.isEmergencyContracted ? ' [Contracted]' : ''}
                                        </span>
                                        {customerContractedRates.tripCharge !== undefined && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                Trip Fee: ${customerContractedRates.tripCharge.toFixed(2)}
                                            </span>
                                        )}
                                        {customerContractedRates.travelIncluded && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                Travel: Included
                                            </span>
                                        )}
                                        {customerContractedRates.isPartsMarkupContracted && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                Markup: {customerContractedRates.partsMarkupRules && customerContractedRates.partsMarkupRules.length > 0 
                                                    ? `Tiered (${customerContractedRates.partsMarkupRules.map(r => `${r.condition === 'under' ? '≤' : '>'}$${r.threshold}:${r.rate}%`).join(', ')})`
                                                    : (customerContractedRates.partsMarkupTier1 && customerContractedRates.partsMarkupTier2 
                                                        ? `Tiered (≤$1.5k: 43%, >$1.5k: 23%)`
                                                        : `${customerContractedRates.partsMarkupPct}%`)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={15} className="shrink-0 text-amber-600" />
                                        <span>{t("Select a customer in Bid Details below to automatically apply their agreed standard, overtime, and emergency contracted rates.")}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Expandable Estimating Rules Drawer */}
                        {isEstimatorRulesOpen && (
                            <div className="relative z-10 mb-5 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-700 shadow-sm space-y-4 animate-fade-in text-xs">
                                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2 dark:border-slate-800">
                                    <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sliders size={14} className="text-indigo-600" />
                                        {t("Estimator AI Pricing Rules & Margin Protection")}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Quick Presets:")}</span>
                                        <button
                                            type="button"
                                            onClick={() => setEstimatorRules({
                                                ...estimatorRules,
                                                rateMode: 'standard',
                                                discountPct: 7,
                                                discountScope: 'partsAndAllowances',
                                                discountName: 'Impact Contract 7% Parts/Crane Discount',
                                                buildDiscountIntoCost: true,
                                                craneAllowanceAmount: 5000,
                                                includeTripCharge: false
                                            })}
                                            className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold hover:bg-amber-200 transition-all cursor-pointer flex items-center gap-1"
                                            title="Apply 7% discount on parts and crane, bake into actual cost for margin protection, $105/hr labor"
                                        >
                                            <Zap size={11} /> Impact Formula (7% Built-In)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEstimatorRules({
                                                ...estimatorRules,
                                                rateMode: 'overtime',
                                                customDirectives: 'After-hours evening/weekend shift work.'
                                            })}
                                            className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold hover:bg-blue-200 transition-all cursor-pointer"
                                        >
                                            Overtime Shift (${customerContractedRates.overtimeRate.toFixed(2)}/hr)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEstimatorRules({
                                                ...estimatorRules,
                                                rateMode: 'emergency',
                                                customDirectives: 'Immediate emergency dispatch response.'
                                            })}
                                            className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 font-bold hover:bg-rose-200 transition-all cursor-pointer"
                                        >
                                            Emergency Call (${customerContractedRates.emergencyRate.toFixed(2)}/hr)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEstimatorRules(DEFAULT_ESTIMATOR_RULES)}
                                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition-all cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Labor Rate Rule */}
                                    <div className="space-y-1.5">
                                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                            <span>{t("Labor Billing Rate")}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">Active: ${estimatorRules.rateMode === 'overtime' ? customerContractedRates.overtimeRate.toFixed(2) : estimatorRules.rateMode === 'emergency' ? customerContractedRates.emergencyRate.toFixed(2) : customerContractedRates.standardRate.toFixed(2)}/hr</span>
                                        </label>
                                        <select
                                            value={estimatorRules.rateMode}
                                            onChange={(e) => setEstimatorRules({ ...estimatorRules, rateMode: e.target.value as RateMode })}
                                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl dark:border-slate-700 text-slate-900 dark:text-white"
                                        >
                                            <option value="auto">⚡ Auto-Detect (Standard, Overtime, Emergency via prompt keywords)</option>
                                            <option value="standard">Standard Contracted Rate (${customerContractedRates.standardRate.toFixed(2)}/hr)</option>
                                            <option value="overtime">Overtime Rate (${customerContractedRates.overtimeRate.toFixed(2)}/hr)</option>
                                            <option value="emergency">Emergency Rate (${customerContractedRates.emergencyRate.toFixed(2)}/hr)</option>
                                            <option value="custom">Custom Labor Rate ($/hr)</option>
                                        </select>
                                        {estimatorRules.rateMode === 'custom' && (
                                            <input
                                                type="number"
                                                placeholder="Enter custom $/hr"
                                                value={estimatorRules.customLaborRate || ''}
                                                onChange={(e) => setEstimatorRules({ ...estimatorRules, customLaborRate: Number(e.target.value) || 0 })}
                                                className="w-full p-1.5 mt-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs"
                                            />
                                        )}
                                    </div>

                                    {/* Material Markup Rule */}
                                    <div className="space-y-1.5">
                                        <label className="font-bold text-slate-700 dark:text-slate-300">{t("Material / Parts Markup")}</label>
                                        <select
                                            value={estimatorRules.markupMode}
                                            onChange={(e) => setEstimatorRules({ ...estimatorRules, markupMode: e.target.value as MarkupMode })}
                                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl dark:border-slate-700 text-slate-900 dark:text-white"
                                        >
                                            <option value="tiered">Standard Commercial Tiered (100% &lt; $500, 75%, 50%, 35%)</option>
                                            {customerContractedRates.isPartsMarkupContracted && (
                                                <option value="contracted">
                                                    Customer Contracted Markup ({customerContractedRates.partsMarkupRules && customerContractedRates.partsMarkupRules.length > 0
                                                        ? customerContractedRates.partsMarkupRules.map(r => `${r.condition === 'under' ? '≤' : '>'}$${r.threshold}:${r.rate}%`).join(', ')
                                                        : (customerContractedRates.partsMarkupTier1 && customerContractedRates.partsMarkupTier2
                                                            ? '43% / 23% Tiered'
                                                            : `${customerContractedRates.partsMarkupPct}%`)})
                                                </option>
                                            )}
                                            <option value="flat">Flat Custom Markup %</option>
                                        </select>
                                        {estimatorRules.markupMode === 'flat' && (
                                            <input
                                                type="number"
                                                placeholder="Flat Markup % (e.g. 25)"
                                                value={estimatorRules.flatMarkupPct || ''}
                                                onChange={(e) => setEstimatorRules({ ...estimatorRules, flatMarkupPct: Number(e.target.value) || 0 })}
                                                className="w-full p-1.5 mt-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs"
                                            />
                                        )}
                                    </div>

                                    {/* Customer Discount & Scope */}
                                    <div className="space-y-1.5">
                                        <label className="font-bold text-slate-700 dark:text-slate-300">{t("Customer Negotiated Discount")}</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="e.g. 7"
                                                value={estimatorRules.discountPct || ''}
                                                onChange={(e) => setEstimatorRules({ ...estimatorRules, discountPct: Number(e.target.value) || 0 })}
                                                className="w-20 p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl dark:border-slate-700 text-slate-900 dark:text-white"
                                            />
                                            <select
                                                value={estimatorRules.discountScope}
                                                onChange={(e) => setEstimatorRules({ ...estimatorRules, discountScope: e.target.value as DiscountScope })}
                                                className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl dark:border-slate-700 text-slate-900 dark:text-white text-[11px]"
                                            >
                                                <option value="partsAndAllowances">Parts &amp; Allowances (Labor Excluded)</option>
                                                <option value="all">Entire Bid (All Items)</option>
                                                <option value="partsOnly">Parts / Materials Only</option>
                                                <option value="allowancesOnly">Allowances / Crane Only</option>
                                                <option value="laborOnly">Labor Only</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Hidden Margin Protection & Allowances */}
                                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t dark:border-slate-800">
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none max-w-lg">
                                        <input
                                            type="checkbox"
                                            checked={estimatorRules.buildDiscountIntoCost}
                                            onChange={(e) => setEstimatorRules({ ...estimatorRules, buildDiscountIntoCost: e.target.checked })}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {t("Bake discount into actual vendor cost (Margin Protection)")}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {estimatorRules.discountPct && estimatorRules.discountPct > 0
                                                    ? `Scales pre-discount baseline costs by +${((1 / (1 - estimatorRules.discountPct / 100) - 1) * 100).toFixed(2)}% so customer sees their ${estimatorRules.discountPct}% discount while company profit margin remains 100% protected.`
                                                    : 'Inflates baseline item costs to preserve target dollar margin.'
                                                }
                                            </span>
                                        </div>
                                    </label>

                                    <div className="flex flex-wrap items-center gap-3">
                                        {customerContractedRates.tripCharge !== undefined && (
                                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={estimatorRules.includeTripCharge}
                                                    onChange={(e) => setEstimatorRules({ ...estimatorRules, includeTripCharge: e.target.checked })}
                                                    className="rounded text-indigo-600 cursor-pointer"
                                                />
                                                <span>Include Trip Fee (${customerContractedRates.tripCharge.toFixed(2)})</span>
                                            </label>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-bold text-slate-500">Crane Allowance:</span>
                                            <input
                                                type="number"
                                                placeholder="$0"
                                                value={estimatorRules.craneAllowanceAmount || ''}
                                                onChange={(e) => setEstimatorRules({ ...estimatorRules, craneAllowanceAmount: Number(e.target.value) || 0 })}
                                                className="w-20 p-1 bg-slate-50 dark:bg-slate-800 border rounded text-[11px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                            {/* Left: AI Prompt Generation */}
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {t("1. AI Proposal Builder (Prompt)")}
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        placeholder={t("e.g. Draft HVAC repair proposal for Converse TX. 3 RTU contactor repairs (5 hrs @ $135/hr), parts under $400, and $5,000 crane fee.")}
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    />
                                    <Button 
                                        onClick={handleAIGenerate} 
                                        disabled={isAiLoading || !aiPrompt.trim()} 
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2"
                                    >
                                        {isAiLoading && activeAiAction === 'prompt' ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                {t("Drafting...")}
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} />
                                                {t("Draft Bid")}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Right: File Upload parsing */}
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {t("2. Document Quote Parser (Upload)")}
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer transition-all">
                                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                            <Upload size={16} />
                                            <span className="text-xs font-bold truncate max-w-[200px]">
                                                {selectedFile ? selectedFile.name : t("Choose PDF, image, or text quote...")}
                                            </span>
                                        </div>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.doc,.docx"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedFile(e.target.files[0]);
                                                }
                                            }}
                                            className="hidden" 
                                        />
                                    </label>
                                    <Button 
                                        onClick={handleParseDocument} 
                                        disabled={isAiLoading || !selectedFile} 
                                        className="bg-slate-950 dark:bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center gap-2"
                                    >
                                        {isAiLoading && activeAiAction === 'parse' ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                {t("Parsing...")}
                                            </>
                                        ) : (
                                            <>
                                                <FileSpreadsheet size={16} />
                                                {t("Parse Document")}
                                            </>
                                        )}
                                    </Button>
                                    {selectedFile && (
                                        <button 
                                            onClick={() => setSelectedFile(null)} 
                                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            title={t("Clear file")}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px custom-scrollbar">
                        {[
                            { id: 'details', label: t('1. Bid Details'), icon: ClipboardList },
                            { id: 'labor', label: t('2. Labor Estimate'), icon: Layers },
                            { id: 'parts', label: t('3. Parts & Markup'), icon: FileSpreadsheet },
                            { id: 'allowances', label: t('4. Allowances & Terms'), icon: Landmark },
                            { id: 'summary', label: t('5. Pricing Summary'), icon: Info }
                        ].map((tItem) => {
                            const Icon = tItem.icon;
                            const isActive = editorTab === tItem.id;
                            return (
                                <button
                                    key={tItem.id}
                                    onClick={() => setEditorTab(tItem.id as EditorTab)}
                                    className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                                        isActive 
                                            ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/20' 
                                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <Icon size={16} />
                                    {tItem.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* TAB CONTENTS */}
                    <div className="mt-4">
                        {/* 1. DETAILS TAB */}
                        {editorTab === 'details' && (
                            <div className="space-y-6 animate-fade-in">
                                <Card className="p-6 space-y-4">
                                    <h3 className="text-base font-black text-slate-950 dark:text-white border-b pb-2 mb-4">
                                        {t("Project & Customer Association")}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Select 
                                            label={t("Link to Existing Project (Optional)")}
                                            value={selectedProjectId}
                                            onChange={(e) => handleProjectChange(e.target.value)}
                                        >
                                            <option value="">{t("-- Select Project --")}</option>
                                            {state.projects.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.customerName} - {p.name}
                                                </option>
                                            ))}
                                        </Select>

                                        <SearchableSelect 
                                            label={t("Customer Reference (Optional)")}
                                            placeholder="-- Select Customer --"
                                            options={customerOptions}
                                            value={selectedCustomerId}
                                            onChange={(custId) => {
                                                setSelectedCustomerId(custId);
                                                if (custId) {
                                                    const cust = state.customers.find(c => c.id === custId);
                                                    if (cust) {
                                                        setCustomerName(cust.name);
                                                        const locs = cust.serviceLocations || [];
                                                        if (locs.length > 0) {
                                                            const firstLoc = locs[0];
                                                            setSelectedLocationId(firstLoc.id || '');
                                                            setServiceLocationName(firstLoc.propertyName || firstLoc.name || '');
                                                            const fullAddr = firstLoc.address 
                                                                ? [firstLoc.address, firstLoc.city, [firstLoc.state, firstLoc.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
                                                                : (cust.address || '');
                                                            setLocationAddress(fullAddr);
                                                        } else {
                                                            setSelectedLocationId('');
                                                            setServiceLocationName('');
                                                            setLocationAddress(cust.address || '');
                                                        }
                                                    }
                                                } else {
                                                    setSelectedCustomerId('');
                                                    setSelectedLocationId('');
                                                    setServiceLocationName('');
                                                    setCustomerName('');
                                                    setLocationAddress('');
                                                }
                                            }}
                                        />

                                        {selectedCustomer && (
                                            <div className="md:col-span-2 p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-3">
                                                <LocationSearchSelector 
                                                    locations={selectedCustomer.serviceLocations || []}
                                                    selectedLocationId={selectedLocationId}
                                                    onSelectLocation={(loc) => {
                                                        const locId = loc.id === 'default' ? '' : loc.id;
                                                        setSelectedLocationId(locId);
                                                        const name = loc.propertyName || loc.name || '';
                                                        setServiceLocationName(name);
                                                        const fullAddr = loc.address 
                                                            ? [loc.address, loc.city, [loc.state, loc.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
                                                            : (selectedCustomer.address || '');
                                                        setLocationAddress(fullAddr);
                                                    }}
                                                    label={t("Target Service Location / Property")}
                                                    placeholder={t("Search location by property name, store #, address, city...")}
                                                    customerDefaultAddress={selectedCustomer.customerType !== 'Property Management' && selectedCustomer.address ? {
                                                        name: `${selectedCustomer.name} (Main Site)`,
                                                        address: selectedCustomer.address,
                                                        city: selectedCustomer.city || '',
                                                        state: selectedCustomer.state || '',
                                                        zip: selectedCustomer.zip || ''
                                                    } : undefined}
                                                />
                                            </div>
                                        )}

                                        <Input 
                                            label={t("Customer/Organization Name")}
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            required
                                            placeholder="e.g. Tractor Supply"
                                        />

                                        <Input 
                                            label={t("Project Scope Title")}
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g. HVAC Labor, Parts & Crane Pricing Breakdown"
                                        />

                                        <Input 
                                            label={t("Service Location Address")}
                                            value={locationAddress}
                                            onChange={(e) => setLocationAddress(e.target.value)}
                                            placeholder="e.g. 8318 FM 78, Converse, TX 78109"
                                        />

                                        <div className="grid grid-cols-2 gap-2">
                                            <Input 
                                                label={t("Purchase Order (PO) #")}
                                                value={poNumber}
                                                onChange={(e) => setPoNumber(e.target.value)}
                                                placeholder="e.g. PO #1238980"
                                            />
                                            <Input 
                                                label={t("Service Contract ID (SCID)")}
                                                value={scid}
                                                onChange={(e) => setScid(e.target.value)}
                                                placeholder="e.g. SCID: 2602-28403"
                                            />
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-6 space-y-4">
                                    <h3 className="text-base font-black text-slate-950 dark:text-white border-b pb-2 mb-4">
                                        {t("Prepared By Credentials")}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input 
                                            label={t("Organization Name")}
                                            value={preparedByOrg}
                                            onChange={(e) => setPreparedByOrg(e.target.value)}
                                        />
                                        <Input 
                                            label={t("Prepared By Phone")}
                                            value={preparedByPhone}
                                            onChange={(e) => setPreparedByPhone(e.target.value)}
                                        />
                                        <Input 
                                            label={t("License Number")}
                                            value={preparedByLicence}
                                            onChange={(e) => setPreparedByLicence(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-48">
                                        <Select 
                                            label={t("Proposal Status")}
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as any)}
                                        >
                                            <option value="Draft">{t("Draft")}</option>
                                            <option value="Sent">{t("Sent")}</option>
                                            <option value="Accepted">{t("Accepted")}</option>
                                            <option value="Declined">{t("Declined")}</option>
                                        </Select>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* 2. LABOR ESTIMATE TAB */}
                        {editorTab === 'labor' && (
                            <div className="space-y-6 animate-fade-in">
                                <Card className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-base font-black text-slate-950 dark:text-white">
                                                {t("Labor Itemization Breakdown")}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {t("List the labor estimates for each rooftop unit, service tier, or project coordinator role.")}
                                            </p>
                                        </div>
                                        <Button 
                                            onClick={addLaborItem} 
                                            size="sm" 
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <Plus size={14} />
                                            {t("Add Labor Row")}
                                        </Button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-16 text-center">{t("Order")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-48">{t("Unit / Basis")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Labor Scope Description")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-24">{t("Hours")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28">{t("Rate ($/hr)")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28 text-right">{t("Value")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-16 text-center">{t("Remove")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {laborItems.map((item, index) => (
                                                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                        <td className="p-1 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveLaborItem(item.id, 'up')}
                                                                    disabled={index === 0}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move up")}
                                                                >
                                                                    <ChevronUp size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveLaborItem(item.id, 'down')}
                                                                    disabled={index === laborItems.length - 1}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move down")}
                                                                >
                                                                    <ChevronDown size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.unitName}
                                                                placeholder="e.g. RTU #1"
                                                                onChange={(e) => updateLaborItem(item.id, 'unitName', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.scope}
                                                                placeholder="e.g. Repair labor, startup, filters"
                                                                onChange={(e) => updateLaborItem(item.id, 'scope', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <NumberInput 
                                                                value={item.hours}
                                                                min="0"
                                                                onChange={(e) => updateLaborItem(item.id, 'hours', parseFloat(e.target.value) || 0)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="relative">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <NumberInput 
                                                                    value={item.rate}
                                                                    min="0"
                                                                    step="0.01"
                                                                    onChange={(e) => updateLaborItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                                    className="pl-5 pr-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">
                                                            {formatCurrency(item.value)}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                onClick={() => removeLaborItem(item.id)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {laborItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                                            {t("No labor items added. Click Add Labor Row to start estimating.")}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Labor Subtotal */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-6 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl gap-4 border border-slate-100 dark:border-slate-800">
                                        <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                            Labor Calculated Subtotal:{' '}
                                            <span className="text-lg text-slate-950 dark:text-white font-black ml-1">
                                                {formatCurrency(laborSubtotal)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                            <div className="w-full md:w-48">
                                                <Input 
                                                    label={t("Rounded Labor Proposal ($)")}
                                                    type="number"
                                                    value={roundedLaborProposal}
                                                    onChange={(e) => setRoundedLaborProposal(Number(e.target.value))}
                                                    placeholder="e.g. 35500"
                                                />
                                            </div>
                                            <div className="w-full md:w-64">
                                                <Input 
                                                    label={t("Rounding Presentation Basis")}
                                                    value={roundedLaborBasis}
                                                    onChange={(e) => setRoundedLaborBasis(e.target.value)}
                                                    placeholder="Rounded for proposal presentation"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* 3. PARTS & MARKUP TAB */}
                        {editorTab === 'parts' && (
                            <div className="space-y-6 animate-fade-in">
                                <Card className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-base font-black text-slate-950 dark:text-white">
                                                {t("Parts & Materials Pricing Grid")}
                                            </h3>
                                        </div>
                                        <Button 
                                            onClick={addPartItem} 
                                            size="sm" 
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <Plus size={14} />
                                            {t("Add Part Row")}
                                        </Button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-16 text-center">{t("Order")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-32">{t("Unit")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-48">{t("Part Name")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-20">{t("Qty")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28">{t("Cost ($)")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-24">{t("Markup %")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28">{t("Unit Price")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-32">{t("Availability")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28 text-right">{t("Total")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-12 text-center">{t("Del")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {partItems.map((item, index) => (
                                                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                        <td className="p-1 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => movePartItem(item.id, 'up')}
                                                                    disabled={index === 0}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move up")}
                                                                >
                                                                    <ChevronUp size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => movePartItem(item.id, 'down')}
                                                                    disabled={index === partItems.length - 1}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move down")}
                                                                >
                                                                    <ChevronDown size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="text"
                                                                value={item.unitName}
                                                                placeholder="e.g. RTU #1"
                                                                onChange={(e) => updatePartItem(item.id, 'unitName', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="text"
                                                                value={item.partName}
                                                                placeholder="Part description"
                                                                onChange={(e) => updatePartItem(item.id, 'partName', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <NumberInput 
                                                                value={item.quantity}
                                                                min="1"
                                                                onChange={(e) => updatePartItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <div className="relative">
                                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <NumberInput 
                                                                    value={item.vendorCost}
                                                                    min="0"
                                                                    step="0.01"
                                                                    onChange={(e) => updatePartItem(item.id, 'vendorCost', parseFloat(e.target.value) || 0)}
                                                                    className="pl-4 pr-1 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-1">
                                                            <NumberInput 
                                                                value={item.markupPct}
                                                                min="0"
                                                                step="0.1"
                                                                onChange={(e) => updatePartItem(item.id, 'markupPct', parseFloat(e.target.value) || 0)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1 font-semibold text-xs text-slate-600 dark:text-slate-400">
                                                            {formatCurrency(item.customerUnitPrice)}
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="text"
                                                                value={item.availability}
                                                                onChange={(e) => updatePartItem(item.id, 'availability', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1 text-right font-bold text-slate-900 dark:text-white">
                                                            {formatCurrency(item.customerLineTotal)}
                                                        </td>
                                                        <td className="p-1 text-center">
                                                            <button 
                                                                onClick={() => removePartItem(item.id)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {partItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                                                            {t("No parts added. Click Add Part Row to start estimating parts.")}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Parts Subtotal */}
                                    <div className="flex justify-end mt-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                            Parts Estimated Total:{' '}
                                            <span className="text-lg text-slate-950 dark:text-white font-black ml-1">
                                                {formatCurrency(partsTotal)}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* 4. ALLOWANCES & TERMS TAB */}
                        {editorTab === 'allowances' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Allowances (e.g. Crane Mobilization) */}
                                <Card className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-base font-black text-slate-950 dark:text-white">
                                                {t("Project Allowances (e.g. Crane, Specialty Rigging)")}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {t("Add lump-sum budget allowances for logistics, crane mobilizations, or sub-contract permits.")}
                                            </p>
                                        </div>
                                        <Button 
                                            onClick={addAllowanceItem} 
                                            size="sm" 
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <Plus size={14} />
                                            {t("Add Allowance Row")}
                                        </Button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-16 text-center">{t("Order")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-64">{t("Allowance Description")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest">{t("Basis & Specifics")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-40 text-right">{t("Estimated Amount")}</th>
                                                    <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-widest w-16 text-center">{t("Remove")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allowanceItems.map((item, index) => (
                                                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                        <td className="p-1 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveAllowanceItem(item.id, 'up')}
                                                                    disabled={index === 0}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move up")}
                                                                >
                                                                    <ChevronUp size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveAllowanceItem(item.id, 'down')}
                                                                    disabled={index === allowanceItems.length - 1}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    title={t("Move down")}
                                                                >
                                                                    <ChevronDown size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.description}
                                                                placeholder="e.g. 60-ton crane allowance"
                                                                onChange={(e) => updateAllowanceItem(item.id, 'description', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text"
                                                                value={item.basis}
                                                                placeholder="e.g. One scheduled crane mobilization allowance"
                                                                onChange={(e) => updateAllowanceItem(item.id, 'basis', e.target.value)}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="relative">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <NumberInput 
                                                                    value={item.amount}
                                                                    min="0"
                                                                    step="0.01"
                                                                    onChange={(e) => updateAllowanceItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                                                    className="pl-5 pr-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 text-right font-bold"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                onClick={() => removeAllowanceItem(item.id)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {allowanceItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                                            {t("No budget allowances added. (Optional)")}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Allowances Subtotal */}
                                    <div className="flex justify-end mt-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                            Allowances Subtotal:{' '}
                                            <span className="text-lg text-slate-950 dark:text-white font-black ml-1">
                                                {formatCurrency(allowanceTotal)}
                                            </span>
                                        </div>
                                    </div>
                                </Card>

                                {/* Clarifications and Exclusions Lists */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Clarifications */}
                                    <Card className="p-6 space-y-4">
                                        <h3 className="text-base font-black text-slate-950 dark:text-white border-b pb-2">
                                            {t("Bid Clarifications & Scope Inclusions")}
                                        </h3>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder={t("Add a clarification note...")}
                                                value={newClarification}
                                                onChange={(e) => setNewClarification(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addClarification()}
                                                className="px-3 py-2 flex-grow text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                            />
                                            <Button onClick={addClarification} size="sm">
                                                <Plus size={16} />
                                            </Button>
                                        </div>
                                        <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                            {clarifications.map((item, idx) => (
                                                <li key={idx} className="flex gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 relative group">
                                                    <span className="text-primary-600 dark:text-primary-400 font-bold">•</span>
                                                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed pr-6">{item}</span>
                                                    <button 
                                                        onClick={() => removeClarification(idx)}
                                                        className="absolute right-2 top-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>

                                    {/* Exclusions */}
                                    <Card className="p-6 space-y-4">
                                        <h3 className="text-base font-black text-slate-950 dark:text-white border-b pb-2">
                                            {t("Bid Exclusions & Terms")}
                                        </h3>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder={t("Add an exclusion note...")}
                                                value={newExclusion}
                                                onChange={(e) => setNewExclusion(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                                                className="px-3 py-2 flex-grow text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                            />
                                            <Button onClick={addExclusion} size="sm">
                                                <Plus size={16} />
                                            </Button>
                                        </div>
                                        <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                            {exclusions.map((item, idx) => (
                                                <li key={idx} className="flex gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 relative group">
                                                    <span className="text-red-500 dark:text-red-400 font-bold">•</span>
                                                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed pr-6">{item}</span>
                                                    <button 
                                                        onClick={() => removeExclusion(idx)}
                                                        className="absolute right-2 top-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                </div>

                                {/* Important Highlight Clarification */}
                                <Card className="p-6 space-y-4">
                                    <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                                        <Info className="text-primary-500" size={18} />
                                        {t("Critical Highlight/Summary Clarification")}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {t("This note will be highlighted in bold styling on the customer review portal to clarify critical scope divisions (e.g. equipment-owner supplied, labor-only clauses).")}
                                    </p>
                                    <Textarea
                                        value={importantClarification}
                                        onChange={(e) => setImportantClarification(e.target.value)}
                                        placeholder="e.g. RTU #5 and RTU #7 are full HVAC rooftop unit replacements changeouts. TekAir pricing for these two units includes labor only..."
                                        rows={3}
                                    />
                                </Card>

                                {/* Pricing & Estimate Disclaimer */}
                                <Card className="p-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                                            <Scale className="text-amber-500" size={18} />
                                            {t("Pricing & Estimate Disclaimer")}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setPricingDisclaimer((state.currentOrganization as any)?.pricingDisclaimer || (state.currentOrganization as any)?.proposalDisclaimer || "Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability.")}
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline cursor-pointer"
                                        >
                                            {t("Reset to Default")}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {t("Specify custom rate guarantee terms, supplier price validity, or contingency clauses displayed on this commercial proposal.")}
                                    </p>
                                    <Textarea
                                        value={pricingDisclaimer}
                                        onChange={(e) => setPricingDisclaimer(e.target.value)}
                                        placeholder="e.g. Pricing is valid for 30 days from issuance. Pricing reflects current material, equipment, and labor rates and is subject to market availability. Any unforeseen structural, electrical, or existing damage discovered during execution will be quoted separately."
                                        rows={3}
                                    />
                                    <div className="flex flex-wrap gap-2 pt-1">
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
                                            onClick={() => setPricingDisclaimer(prev => prev ? `${prev} Pricing is valid for 30 days from issuance.` : "Pricing is valid for 30 days from issuance.")}
                                            className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                        >
                                            + 30-Day Rate Guarantee
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPricingDisclaimer(prev => prev ? `${prev} Pricing subject to supplier availability and material surcharges.` : "Pricing subject to supplier availability and material surcharges.")}
                                            className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                        >
                                            + Material Escalation Notice
                                        </button>
                                    </div>
                                </Card>

                                {/* Warranty Terms & Service Guarantee */}
                                <Card className="p-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                                            <Shield className="text-indigo-500" size={18} />
                                            {t("Warranty Terms & Service Guarantee")}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setWarrantyTerms((state.currentOrganization as any)?.warrantyTerms || (state.currentOrganization as any)?.warrantyDisclaimer || '')}
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline cursor-pointer"
                                        >
                                            {t("Reset to Default")}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {t("Specify labor workmanship warranty duration, manufacturer parts coverage, and service guarantee clauses for this proposal.")}
                                    </p>
                                    <Textarea
                                        value={warrantyTerms}
                                        onChange={(e) => setWarrantyTerms(e.target.value)}
                                        placeholder="e.g. TekAir Inc. provides a 3-Year Workmanship Warranty on this HVAC system installation. The installed equipment includes a 10-Year Manufacturer Parts Warranty."
                                        rows={4}
                                    />
                                    <div className="flex flex-wrap gap-2 pt-1">
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
                                </Card>
                            </div>
                        )}

                        {/* 5. PRICING SUMMARY TAB */}
                        {editorTab === 'summary' && (() => {
                            const calculatedSubtotal = (roundedLaborProposal || laborSubtotal) + partsTotal + allowanceTotal;
                            const baseSubtotal = recommendedRoundedTotal || calculatedSubtotal;
                            const roundingAdjustment = recommendedRoundedTotal ? (recommendedRoundedTotal - calculatedSubtotal) : 0;
                            const calculatedTaxAmount = Number((baseSubtotal * (taxRate / 100)).toFixed(2));
                            const calculatedProcessingFeeAmount = Number(((baseSubtotal + calculatedTaxAmount) * (processingFeeRate / 100)).toFixed(2));
                            const grandTotal = baseSubtotal + calculatedTaxAmount + calculatedProcessingFeeAmount;
                            const calculatedDepositAmount = (requireDeposit && depositValue > 0)
                                ? (depositType === 'percentage'
                                    ? Number(((grandTotal * depositValue) / 100).toFixed(2))
                                    : Math.min(depositValue, grandTotal))
                                : 0;
                            const amountDueToday = requireDeposit && !depositPaid ? calculatedDepositAmount : 0;
                            const amountDueNet = requireDeposit && !depositPaid ? Math.max(0, grandTotal - calculatedDepositAmount) : grandTotal;

                            return (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                        {/* Left 2 columns: Pricing summary & Setup */}
                                        <Card className="p-6 lg:col-span-2 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
                                            <h3 className="text-lg font-black text-slate-950 dark:text-white border-b pb-2 flex items-center gap-2">
                                                <Landmark className="text-primary-600 dark:text-primary-400" size={20} />
                                                {t("Final Commercial Bid Summary")}
                                            </h3>

                                            {/* Pricing categories grid */}
                                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400">{t("Labor Subtotal")}</span>
                                                    <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(laborSubtotal)}</span>
                                                </div>
                                                {roundedLaborProposal > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{t("Rounded Labor Proposal")}</span>
                                                            <span className="text-[10px] text-slate-400 italic">({roundedLaborBasis})</span>
                                                        </div>
                                                        <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(roundedLaborProposal)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400">{preparedByOrg}-supplied repair parts</span>
                                                    <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(partsTotal)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400">{t("Logistics / Allowances")}</span>
                                                    <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(allowanceTotal)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-800/30 px-2 rounded">
                                                    <span className="font-bold text-slate-700 dark:text-slate-350">{t("Calculated HVAC Subtotal")}</span>
                                                    <span className="font-mono text-slate-950 dark:text-white font-bold">{formatCurrency(calculatedSubtotal)}</span>
                                                </div>
                                                {recommendedRoundedTotal > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                        <span className="font-bold text-slate-600 dark:text-slate-400">{t("Rounding/Discount Adjustment")}</span>
                                                        <span className={`font-mono font-bold ${roundingAdjustment < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {roundingAdjustment < 0 ? '-' : '+'}{formatCurrency(Math.abs(roundingAdjustment))}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50 bg-indigo-50/30 dark:bg-indigo-950/20 px-2 rounded">
                                                    <span className="font-black text-slate-800 dark:text-slate-200">{t("Adjusted Subtotal")}</span>
                                                    <span className="font-mono font-black text-slate-950 dark:text-white">{formatCurrency(baseSubtotal)}</span>
                                                </div>
                                                {taxRate > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                        <span className="font-bold text-slate-600 dark:text-slate-400">{t("Sales Tax")} ({taxRate}%)</span>
                                                        <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(calculatedTaxAmount)}</span>
                                                    </div>
                                                )}
                                                {processingFeeRate > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                                                        <span className="font-bold text-slate-600 dark:text-slate-400">{t("Processing/Convenience Fee")} ({processingFeeRate}%)</span>
                                                        <span className="font-mono text-slate-950 dark:text-white">{formatCurrency(calculatedProcessingFeeAmount)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2.5 border-t-2 border-slate-300 dark:border-slate-700 mt-2">
                                                    <span className="text-base font-black text-slate-800 dark:text-slate-250">{t("Final Grand Total")}</span>
                                                    <span className="text-xl font-black text-primary-600 dark:text-primary-400 font-mono">{formatCurrency(grandTotal)}</span>
                                                </div>
                                                {requireDeposit && calculatedDepositAmount > 0 && (
                                                    <>
                                                        <div className="flex justify-between items-center text-sm py-1.5 border-t border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 px-2 rounded">
                                                            <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                                                <DollarSign size={14} className="text-amber-600 dark:text-amber-400" />
                                                                {t("Required Deposit / Down Payment")}
                                                                {depositType === 'percentage' ? ` (${depositValue}%)` : ''}
                                                                {depositPaid ? ` (${t("Paid")})` : ''}
                                                            </span>
                                                            <span className="font-mono font-bold text-amber-950 dark:text-amber-200">{formatCurrency(calculatedDepositAmount)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50 px-2">
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{t("Amount Due Today")}</span>
                                                            <span className="font-mono font-black text-slate-900 dark:text-white">{formatCurrency(amountDueToday)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50 dark:border-slate-700/50 px-2">
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{t("Net Due upon Completion")}</span>
                                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(amountDueNet)}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Adjustments: Rounded & Taxes & Processing fees */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-850 pt-4">
                                                <div>
                                                    <Input 
                                                        label={t("Rounded Subtotal ($)")}
                                                        type="number"
                                                        value={recommendedRoundedTotal}
                                                        onChange={(e) => setRecommendedRoundedTotal(Number(e.target.value))}
                                                        placeholder="e.g. 48500"
                                                    />
                                                </div>
                                                <div>
                                                    <Input 
                                                        label={t("Sales Tax Rate (%)")}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={taxRate}
                                                        onChange={(e) => setTaxRate(Number(e.target.value))}
                                                        placeholder="e.g. 8.25"
                                                    />
                                                </div>
                                                <div>
                                                    <Input 
                                                        label={t("Processing Fee (%)")}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={processingFeeRate}
                                                        onChange={(e) => setProcessingFeeRate(Number(e.target.value))}
                                                        placeholder="e.g. 3.0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Deposit / Down Payment Configuration */}
                                            <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                            <DollarSign size={16} className="text-amber-500" />
                                                            {t("Deposit / Down Payment Requirement")}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {t("Specify an upfront deposit required from the customer before work begins.")}
                                                        </p>
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
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
                                                                    <option value="flat">{t("Flat Dollar ($)")}</option>
                                                                    <option value="percentage">{t("Percentage (%)")}</option>
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
                                                                    placeholder={depositType === 'percentage' ? "e.g. 50" : "e.g. 500"}
                                                                />
                                                            </div>
                                                            <div>
                                                                <Input
                                                                    label={t("Calculated Deposit Due")}
                                                                    type="text"
                                                                    disabled
                                                                    value={formatCurrency(calculatedDepositAmount)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                                            <div className="flex-1 w-full">
                                                                <Input
                                                                    label={t("Deposit Notes / Payment Instructions")}
                                                                    value={depositNotes}
                                                                    onChange={e => setDepositNotes(e.target.value)}
                                                                    placeholder={t("e.g. 50% deposit required prior to ordering equipment / scheduling")}
                                                                />
                                                            </div>
                                                            <label className="flex items-center gap-2 cursor-pointer pt-4 select-none whitespace-nowrap">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={depositPaid}
                                                                    onChange={e => setDepositPaid(e.target.checked)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                    {t("Deposit Marked Paid")} ({depositPaid ? t("YES") : t("NO")})
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Presentation Format Selector */}
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl">
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

                                            {/* Status select */}
                                            <div className="flex gap-4 items-end justify-between border-t border-slate-100 dark:border-slate-850 pt-4">
                                                <div className="w-48">
                                                    <Select 
                                                        label={t("Proposal Status")}
                                                        value={status}
                                                        onChange={(e) => setStatus(e.target.value as any)}
                                                    >
                                                        <option value="Draft">{t("Draft")}</option>
                                                        <option value="Sent">{t("Sent to Customer")}</option>
                                                        <option value="Accepted">{t("Approved/Closed")}</option>
                                                        <option value="Declined">{t("Declined/Rejected")}</option>
                                                    </Select>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        onClick={handleSendFromBuilder}
                                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                                    >
                                                        <Send size={16} />
                                                        {t("Send to Customer")}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button 
                                                    variant="secondary"
                                                    onClick={() => handleSave(false)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Save size={16} />
                                                    {t("Quick Save Draft")}
                                                </Button>
                                                <Button 
                                                    onClick={() => handleSave(true)}
                                                    className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0"
                                                >
                                                    <CheckCircle size={16} />
                                                    {t("Save & Finish")}
                                                </Button>
                                            </div>
                                        </Card>

                                        {/* Right Column: Tracking History Timeline */}
                                        <Card className="p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                                                <Clock size={14} />
                                                {t("Proposal Tracking History")}
                                            </h4>
                                            <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-800 space-y-5 py-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                                                {trackingHistory.map((entry, idx) => (
                                                    <div key={idx} className="relative">
                                                        <div className={`absolute -left-[27.5px] top-1 w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900 flex items-center justify-center ${
                                                            entry.status === 'Accepted' ? 'bg-emerald-500' :
                                                            entry.status === 'Declined' ? 'bg-rose-500' :
                                                            entry.status === 'Sent' ? 'bg-blue-500' :
                                                            entry.status === 'Opened' ? 'bg-indigo-500' :
                                                            entry.status === 'Reminder Sent' ? 'bg-orange-500' :
                                                            'bg-slate-400'
                                                        }`} />
                                                        <div className="text-xs text-left">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[9px] leading-none">
                                                                    {entry.status}
                                                                </span>
                                                                <span className="text-slate-400 text-[9px] mt-0.5 font-mono">
                                                                    {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                                                                {entry.notes}
                                                            </p>
                                                            <span className="text-[9px] text-slate-400 italic block mt-0.5">By: {entry.updatedBy}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {trackingHistory.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic">{t("No tracking history recorded yet.")}</p>
                                                )}
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            );
                        })()}

                    </div>
                </div>
            )}

            <RecipientSelectorModal
                isOpen={!!sendModalConfig}
                onClose={() => setSendModalConfig(null)}
                customerId={sendModalConfig?.customerId}
                locationId={sendModalConfig?.locationId}
                locationName={sendModalConfig?.locationName}
                documentType="proposal"
                title={t("Select Recipient Emails")}
                defaultAttachPdf={true}
                onConfirm={handleConfirmSend}
            />

            {/* Outbound SMS Modal */}
            {smsModalProposal && (
                <SendSMSModal
                    isOpen={!!smsModalProposal}
                    onClose={() => setSmsModalProposal(null)}
                    proposal={smsModalProposal}
                    customerId={smsModalProposal?.customerId}
                    recipientName={smsModalProposal?.customerName}
                    recipientPhone={smsModalProposal?.customerPhone}
                />
            )}
        </div>
    );
};

export default ProjectProposalsPage;
