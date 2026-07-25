import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import SearchableSelect, { SearchableSelectOption } from 'components/ui/SearchableSelect';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { 
    FileText, Sparkles, Trash2, Plus, Search, DollarSign, Edit2, Save, 
    ArrowLeft, Copy, ExternalLink, Clock, User, CheckCircle, AlertCircle, X,
    Layers, Landmark, ClipboardList, Info, FileSpreadsheet, Upload, Loader2, Send,
    ChevronUp, ChevronDown, MapPin
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Proposal, ProjectProposalLaborItem, ProjectProposalPartItem, ProjectProposalAllowanceItem } from 'types';
import RecipientSelectorModal from 'components/modals/RecipientSelectorModal';
import { getBaseUrl , cleanUndefinedFields } from 'lib/utils';
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
    const [customerName, setCustomerName] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [scid, setScid] = useState('');
    const [preparedByOrg, setPreparedByOrg] = useState('TekAir Inc');
    const [preparedByPhone, setPreparedByPhone] = useState('210-318-4197');
    const [preparedByLicence, setPreparedByLicence] = useState('TACLA73240E');
    const [status, setStatus] = useState<'Draft' | 'Sent' | 'Accepted' | 'Declined'>('Draft');

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
    const [recommendedRoundedTotal, setRecommendedRoundedTotal] = useState<number>(0);

    // Pricing & tracking states
    const [taxRate, setTaxRate] = useState<number>(0);
    const [processingFeeRate, setProcessingFeeRate] = useState<number>(0);
    const [trackingHistory, setTrackingHistory] = useState<any[]>([]);
    const [sendModalConfig, setSendModalConfig] = useState<{
        proposalId: string;
        customerId: string;
        locationId?: string | null;
    } | null>(null);

    // AI Generation / Parsing states
    const [aiPrompt, setAiPrompt] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [activeAiAction, setActiveAiAction] = useState<'prompt' | 'parse' | null>(null);

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
            totalCount: projectProposals.length,
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
                                    setCustomerName(draft.customerName || p.customerName || '');
                                    setLocationAddress(draft.locationAddress || p.locationAddress || '');
                                    setPoNumber(draft.poNumber || p.poNumber || '');
                                    setScid(draft.scid || p.scid || '');
                                    setPreparedByOrg(draft.preparedByOrg || p.preparedByOrganization || 'TekAir Inc');
                                    setPreparedByPhone(draft.preparedByPhone || p.preparedByPhone || '210-318-4197');
                                    setPreparedByLicence(draft.preparedByLicence || p.preparedByLicence || 'TACLA73240E');
                                    setStatus(draft.status || (p.status as any) || 'Draft');

                                    setLaborItems(draft.laborItems || p.laborItems || []);
                                    setRoundedLaborProposal(draft.roundedLaborProposal || p.roundedLaborProposal || 0);
                                    setRoundedLaborBasis(draft.roundedLaborBasis || p.roundedLaborBasis || 'Rounded for proposal presentation');

                                    setPartItems(draft.partItems || p.partItems || []);
                                    setAllowanceItems(draft.allowanceItems || p.allowanceItems || []);
                                    setClarifications(draft.clarifications || p.clarifications || []);
                                    setExclusions(draft.exclusions || p.exclusions || []);
                                    setImportantClarification(draft.importantClarification || p.importantClarification || '');
                                    setRecommendedRoundedTotal(draft.recommendedRoundedTotal || p.recommendedRoundedTotal || 0);
                                    setTaxRate(draft.taxRate || p.taxRate || 0);
                                    setProcessingFeeRate(draft.processingFeeRate || p.processingFeeRate || 0);
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
                            setCustomerName(p.customerName || '');
                            setLocationAddress(p.locationAddress || '');
                            setPoNumber(p.poNumber || '');
                            setScid(p.scid || '');
                            setPreparedByOrg(p.preparedByOrganization || 'TekAir Inc');
                            setPreparedByPhone(p.preparedByPhone || '210-318-4197');
                            setPreparedByLicence(p.preparedByLicence || 'TACLA73240E');
                            setStatus((p.status as any) || 'Draft');

                            setLaborItems(p.laborItems || []);
                            setRoundedLaborProposal(p.roundedLaborProposal || 0);
                            setRoundedLaborBasis(p.roundedLaborBasis || 'Rounded for proposal presentation');

                            setPartItems(p.partItems || []);
                            setAllowanceItems(p.allowanceItems || []);
                            setClarifications(p.clarifications || []);
                            setExclusions(p.exclusions || []);
                            setImportantClarification(p.importantClarification || '');
                            setRecommendedRoundedTotal(p.recommendedRoundedTotal || 0);
                            setTaxRate(p.taxRate || 0);
                            setProcessingFeeRate(p.processingFeeRate || 0);
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
                                setCustomerName(draft.customerName || '');
                                setLocationAddress(draft.locationAddress || '');
                                setPoNumber(draft.poNumber || '');
                                setScid(draft.scid || '');
                                setPreparedByOrg(draft.preparedByOrg || 'TekAir Inc');
                                setPreparedByPhone(draft.preparedByPhone || '210-318-4197');
                                setPreparedByLicence(draft.preparedByLicence || 'TACLA73240E');
                                setStatus(draft.status || 'Draft');

                                setLaborItems(draft.laborItems || []);
                                setRoundedLaborProposal(draft.roundedLaborProposal || 0);
                                setRoundedLaborBasis(draft.roundedLaborBasis || 'Rounded for proposal presentation');

                                setPartItems(draft.partItems || []);
                                setAllowanceItems(draft.allowanceItems || []);
                                setClarifications(draft.clarifications || []);
                                setExclusions(draft.exclusions || []);
                                setImportantClarification(draft.importantClarification || '');
                                setRecommendedRoundedTotal(draft.recommendedRoundedTotal || 0);
                                setTaxRate(draft.taxRate || 0);
                                setProcessingFeeRate(draft.processingFeeRate || 0);
                                setTrackingHistory(draft.trackingHistory || []);
                                showToast.success("Draft restored!");
                                restored = true;
                            } else {
                                localStorage.removeItem(draftKey);
                            }
                        } catch (e) {
                            console.error("Failed to restore new project proposal draft:", e);
                        }
                    }

                    if (!restored) {
                        const newId = `PROP-PROJ-${Math.floor(100000 + Math.random() * 900000)}`;
                        setProposalId(newId);
                        setTitle('HVAC Labor, Parts & Crane Pricing Breakdown');
                        setPoNumber('');
                        setScid('');
                        setStatus('Draft');

                        if (projectIdParam) {
                            setSelectedProjectId(projectIdParam);
                            const proj = state.projects.find(p => p.id === projectIdParam);
                            if (proj) {
                                setSelectedCustomerId(proj.customerId || '');
                                setCustomerName(proj.customerName || '');
                                setLocationAddress(proj.address || '');
                            }
                        } else {
                            setSelectedProjectId('');
                            setSelectedCustomerId('');
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
        const newItem: ProjectProposalLaborItem = {
            id: `l-${Math.random().toString(36).substr(2, 9)}`,
            unitName: '',
            scope: '',
            hours: 0,
            rate: 135,
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

            const systemPrompt = `You are an expert commercial HVAC estimator and proposal writer.
Based on the user's description, draft a commercial HVAC project proposal.
User description: "${aiPrompt}"

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
      "rate": number (default to 135)
    }
  ],
  "partItems": [
    {
      "unitName": "string (e.g. 'RTU #1')",
      "partName": "string (description of the part/material)",
      "quantity": number,
      "vendorCost": number (unit vendor cost before markup),
      "markupPct": number (suggested markup percent, e.g. 100 for costs under $500, 75 for $500-$750, 50 for $750-$1000, 35 for over $1000),
      "availability": "string (e.g., 'In stock' or '2-3 days')"
    }
  ],
  "allowanceItems": [
    {
      "description": "string (e.g. '60-ton crane allowance')",
      "basis": "string (explanation of the allowance, e.g. 'One scheduled crane mobilization allowance')",
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
3. Be professional and detailed. Use standard HVAC nomenclature (RTUs, contactor, actuator, compressor, belt, condenser fan motor, refrigerant, recovery, etc.) where appropriate.`;

            const result = await callGeminiAI({
                prompt: systemPrompt,
                modelName: "gemini-3.6-flash",
                config: {
                    responseMimeType: "application/json"
                }
            });

            const data = result.data as { text: string };
            const parsed = cleanAndParseJson(data.text);

            applyAiSuggestionData(parsed);
            showToast.success(t("AI suggestion applied successfully!"));
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

            const systemPrompt = `You are an expert commercial HVAC estimator and proposal quote parser.
Analyze the attached document (named "${fileName}" of type "${mimeType}") which represents a vendor quote, technician notes, invoice, or bid specifications.
Extract and match any labor rows, part rows, allowance rows, PO numbers, SCID numbers, customer name, and general descriptions.

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
      "rate": number (default to 135)
    }
  ],
  "partItems": [
    {
      "unitName": "string (e.g. 'RTU #1')",
      "partName": "string (description of the part/material)",
      "quantity": number,
      "vendorCost": number (unit vendor cost before markup),
      "markupPct": number (suggested markup percent, e.g. 100 for costs under $500, 75 for $500-$750, 50 for $750-$1000, 35 for over $1000),
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
3. If labor hours are not explicitly stated but tasks are described, estimate realistic labor hours at $135/hr.
4. Calculate markupPct based on vendorCost: Under $500 (100%), $500-$750 (75%), $750-$1,000 (50%), Over $1,000 (35%).`;

            const payload: any = {
                prompt: isBase64 ? systemPrompt : `${systemPrompt}\n\nDOCUMENT TEXT CONTENT:\n${fileData}`,
                modelName: "gemini-3.6-flash",
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

            applyAiSuggestionData(parsed);
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

    const applyAiSuggestionData = (parsed: any) => {
        const hasExisting = laborItems.length > 0 || partItems.length > 0 || allowanceItems.length > 0;
        const append = hasExisting ? window.confirm(t("You already have items in this proposal. Would you like to append/merge the new AI/parsed items to the existing ones? (Click OK to Append and Merge matching items, Cancel to Overwrite/Replace)")) : false;

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

        const payload: Proposal = {
            id: proposalId,
            organizationId: state.currentOrganization?.id || 'demo-org-123',
            customerId: selectedCustomerId || 'custom-customer',
            customerName,
            customerEmail: state.customers.find(c => c.id === selectedCustomerId)?.email || '',
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
            
            calculatedTotal: calculatedTotal,
            recommendedRoundedTotal: recommendedRoundedTotal || 0,
            subtotal: baseSubtotal,
            taxRate,
            taxAmount: calculatedTaxAmount,
            processingFeeRate,
            processingFeeAmount: calculatedProcessingFeeAmount,
            total: grandTotal,
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
            locationId: p.locationId || null
        });
    };

    const handleSendFromBuilder = async () => {
        if (!customerName) {
            showToast.warn('Customer Name is required before sending');
            return;
        }
        await handleSave(false);
        setSendModalConfig({
            proposalId: proposalId,
            customerId: selectedCustomerId || 'custom-customer',
            locationId: null
        });
    };

    const handleConfirmSend = async (selectedEmails: string[], attachPdf?: boolean) => {
        if (!sendModalConfig) return;
        const targetId = sendModalConfig.proposalId;
        const p = state.proposals.find(item => item.id === targetId) || (targetId === proposalId ? {
            id: proposalId,
            customerName,
            total: recommendedRoundedTotal || calculatedTotal,
            trackingHistory: trackingHistory
        } as Proposal : null);

        if (!p) {
            showToast.error("Proposal data not found to send.");
            return;
        }

        try {
            const proposalLink = `${window.location.origin}/#/project-proposal-view/${p.id}`;
            const orgName = preparedByOrg || state.currentOrganization?.name || 'Service Provider';
            
            // Calculate base and grand totals live
            const baseSub = targetId === proposalId 
                ? (recommendedRoundedTotal || calculatedTotal)
                : (p.subtotal || p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0);
            const tRate = targetId === proposalId ? taxRate : (p.taxRate || 0);
            const pRate = targetId === proposalId ? processingFeeRate : (p.processingFeeRate || 0);
            
            const taxAmt = Number((baseSub * (tRate / 100)).toFixed(2));
            const feeAmt = Number(((baseSub + taxAmt) * (pRate / 100)).toFixed(2));
            const totalVal = baseSub + taxAmt + feeAmt;

            let pdfAttachments: any[] = [];
            if (attachPdf) {
                showToast.info(t("Generating proposal PDF attachment..."));
                const pdfAtt = await generateProposalPdfAttachment(p, state.currentOrganization);
                pdfAttachments.push(pdfAtt);
            }

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: selectedEmails,
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `New Commercial HVAC Proposal from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e0f2fe;border-radius:8px;"><h2 style="color:#0284c7;">New Proposal Ready</h2><p>Hi ${p.customerName || customerName},</p><p>We have prepared a new commercial HVAC contract proposal for you (total: <strong>$${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>). Please review and sign it online:</p><div style="margin:20px 0;"><a href="${proposalLink}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Sign Proposal</a></div><p style="font-size:12px;color:#666;">Link: ${proposalLink}</p></div>`,
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
        if (window.confirm('Are you sure you want to delete this project proposal?')) {
            try {
                await db.collection('proposals').doc(id).delete();
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
        if (!window.confirm(t("Are you sure you want to mark this proposal as verbally accepted?"))) {
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

    const filteredProposals = useMemo(() => {
        return projectProposals.filter(p => {
            const matchesSearch = 
                (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.scid || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [projectProposals, searchTerm, statusFilter]);

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
                            </select>
                        </div>
                    </Card>

                    {/* Main Table List */}
                    <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl bg-white dark:bg-slate-900">
                        <Table headers={[t('Date'), t('Proposal ID'), t('Customer & Site Location'), t('PO / SCID'), t('Total Value'), t('Status')]}>
                            {filteredProposals.map((p) => {
                                const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
                                const siteLoc = (p as any).serviceLocationName || (p as any).siteAddress || (p as any).serviceAddress || (p as any).locationName || (p as any).address || p.projectName || '';

                                return (
                                    <tbody key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                                #{p.id.slice(-6).toUpperCase()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1 max-w-[220px]">
                                                    <div>
                                                        <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Customer</span>
                                                        <p className="font-black text-slate-950 dark:text-white text-xs truncate" title={p.customerName}>
                                                            {p.customerName}
                                                        </p>
                                                    </div>
                                                    {siteLoc && (
                                                        <div className="pt-0.5 border-t border-slate-100 dark:border-slate-800">
                                                            <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                                                                <MapPin size={9} /> Site Location
                                                            </span>
                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate" title={siteLoc}>
                                                                {siteLoc}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {p.title && !siteLoc && (
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
                                                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                                        p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                        p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                        p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800' :
                                                        (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {p.status}
                                                    </span>
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
                        <div className="flex items-center gap-2 mb-4 relative z-10">
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
                                                        setLocationAddress(cust.address || '');
                                                    }
                                                }
                                            }}
                                        />

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
                                                            <input 
                                                                type="number"
                                                                value={item.hours}
                                                                min="0"
                                                                onChange={(e) => updateLaborItem(item.id, 'hours', Number(e.target.value))}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="relative">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <input 
                                                                    type="number"
                                                                    value={item.rate}
                                                                    min="0"
                                                                    onChange={(e) => updateLaborItem(item.id, 'rate', Number(e.target.value))}
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
                                                            <input 
                                                                type="number"
                                                                value={item.quantity}
                                                                min="1"
                                                                onChange={(e) => updatePartItem(item.id, 'quantity', Number(e.target.value))}
                                                                className="px-2 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <div className="relative">
                                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <input 
                                                                    type="number"
                                                                    value={item.vendorCost}
                                                                    min="0"
                                                                    step="0.01"
                                                                    onChange={(e) => updatePartItem(item.id, 'vendorCost', Number(e.target.value))}
                                                                    className="pl-4 pr-1 py-1.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="number"
                                                                value={item.markupPct}
                                                                min="0"
                                                                onChange={(e) => updatePartItem(item.id, 'markupPct', Number(e.target.value))}
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
                                                                <input 
                                                                    type="number"
                                                                    value={item.amount}
                                                                    min="0"
                                                                    onChange={(e) => updateAllowanceItem(item.id, 'amount', Number(e.target.value))}
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
                                        rows={4}
                                    />
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
                title={t("Select Recipient Emails")}
                onConfirm={handleConfirmSend}
            />
        </div>
    );
    // Auto-save draft changes for project proposals
    useEffect(() => {
        if (!isEditing) return;

        const original = editIdParam ? state.proposals.find(p => p.id === editIdParam) : null;
        
        const hasChanges = !original ? (
            title !== 'HVAC Labor, Parts & Crane Pricing Breakdown' ||
            selectedProjectId !== '' ||
            selectedCustomerId !== '' ||
            customerName !== '' ||
            locationAddress !== '' ||
            poNumber !== '' ||
            scid !== '' ||
            preparedByOrg !== 'TekAir Inc' ||
            preparedByPhone !== '210-318-4197' ||
            preparedByLicence !== 'TACLA73240E' ||
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
            processingFeeRate !== 0
        ) : (
            title !== original.title ||
            selectedProjectId !== (original.projectId || '') ||
            selectedCustomerId !== (original.customerId || '') ||
            customerName !== (original.customerName || '') ||
            locationAddress !== (original.locationAddress || '') ||
            poNumber !== (original.poNumber || '') ||
            scid !== (original.scid || '') ||
            preparedByOrg !== (original.preparedByOrganization || 'TekAir Inc') ||
            preparedByPhone !== (original.preparedByPhone || '210-318-4197') ||
            preparedByLicence !== (original.preparedByLicence || 'TACLA73240E') ||
            status !== (original.status || 'Draft') ||
            JSON.stringify(laborItems) !== JSON.stringify(original.laborItems || []) ||
            roundedLaborProposal !== (original.roundedLaborProposal || 0) ||
            roundedLaborBasis !== (original.roundedLaborBasis || 'Rounded for proposal presentation') ||
            JSON.stringify(partItems) !== JSON.stringify(original.partItems || []) ||
            JSON.stringify(allowanceItems) !== JSON.stringify(original.allowanceItems || []) ||
            JSON.stringify(clarifications) !== JSON.stringify(original.clarifications || []) ||
            JSON.stringify(exclusions) !== JSON.stringify(original.exclusions || []) ||
            importantClarification !== (original.importantClarification || '') ||
            recommendedRoundedTotal !== (original.recommendedRoundedTotal || 0) ||
            taxRate !== (original.taxRate || 0) ||
            processingFeeRate !== (original.processingFeeRate || 0)
        );

        const draftKey = `draft_project_proposal_${editIdParam || 'new'}`;
        if (hasChanges) {
            const draftData = {
                proposalId,
                title,
                selectedProjectId,
                selectedCustomerId,
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
                recommendedRoundedTotal,
                taxRate,
                processingFeeRate,
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
        recommendedRoundedTotal,
        taxRate,
        processingFeeRate,
        trackingHistory
    ]);

};

export default ProjectProposalsPage;
