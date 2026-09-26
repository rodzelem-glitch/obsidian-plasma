import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import { uploadFileToStorage } from '../../lib/storageService';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import Card from '../ui/Card';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';
import {
    Building2, Store, Truck, Briefcase, FileText, DollarSign, Plus, Search,
    Copy, ExternalLink, CheckCircle2, AlertCircle, Calendar, ArrowRight, Upload,
    Trash2, Edit2, Paperclip, ShieldCheck, Layers, Percent, Phone, Mail, MapPin,
    UserCheck, Clock, Sparkles, Check, ChevronDown, ChevronUp, AlertTriangle, Link as LinkIcon
} from 'lucide-react';
import type { 
    TradePartner, 
    TradePartnerCategory, 
    TradePartnerPaymentTerms, 
    TradePartnerStatus,
    ExternalQuoteProposal,
    ExternalQuoteLineItem,
    ExternalQuoteStatus 
} from '../../types/tradePartner';
import type { Proposal, Job, Expense } from '../../types';

interface TradePartnersHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'directory' | 'quotes' | 'credit';
    preselectedJobId?: string;
}

const CATEGORY_CONFIG: Record<TradePartnerCategory, { label: string; color: string; icon: any }> = {
    parts_house: { label: 'Parts & Equipment Distributor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: Store },
    equipment_rental: { label: 'Equipment Rental & Cranes', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Truck },
    subcontractor: { label: 'Subcontractor / Fabricator', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800', icon: Briefcase },
    fabricator: { label: 'Custom Fabrication', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', icon: Layers },
    tools_fleet: { label: 'Tools, Fleet & Supplies', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800', icon: Building2 },
    disposal_reclaim: { label: 'Refrigerant Reclaim & Disposal', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: ShieldCheck }
};

export const TradePartnersHubModal: React.FC<TradePartnersHubModalProps> = ({
    isOpen,
    onClose,
    initialTab = 'directory',
    preselectedJobId
}) => {
    const { state, dispatch } = useAppContext();
    const orgId = state.currentOrganization?.id || '';

    const [activeTab, setActiveTab] = useState<'directory' | 'quotes' | 'credit'>(initialTab);
    const [partners, setPartners] = useState<TradePartner[]>([]);
    const [quotes, setQuotes] = useState<ExternalQuoteProposal[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Sub-states
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<TradePartner | null>(null);

    const [isUploadQuoteOpen, setIsUploadQuoteOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<ExternalQuoteProposal | null>(null);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [quoteToImport, setQuoteToImport] = useState<ExternalQuoteProposal | null>(null);

    const [isLinkJobModalOpen, setIsLinkJobModalOpen] = useState(false);
    const [quoteToLink, setQuoteToLink] = useState<ExternalQuoteProposal | null>(null);

    const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

    // Form state for Partner
    const [partnerForm, setPartnerForm] = useState<Partial<TradePartner>>({
        name: '',
        category: 'parts_house',
        trade: '',
        status: 'Active',
        hasCreditAccount: true,
        accountNumber: '',
        creditLimit: 25000,
        currentBalance: 0,
        paymentTerms: 'Net 30',
        phone: '',
        email: '',
        counterPhone: '',
        branchAddress: '',
        notes: ''
    });

    // Form state for Quote
    const [quoteForm, setQuoteForm] = useState<Partial<ExternalQuoteProposal>>({
        vendorName: '',
        quoteNumber: '',
        title: '',
        category: 'equipment_rental',
        quoteDate: new Date().toISOString().split('T')[0],
        totalAmount: 0,
        subtotal: 0,
        depositPercentage: 0,
        depositRequired: 0,
        paymentTerms: 'Net 30',
        status: 'Received',
        description: '',
        lineItems: []
    });
    const [quoteFile, setQuoteFile] = useState<File | null>(null);
    const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

    // Import into Proposal options
    const [targetProposalId, setTargetProposalId] = useState('');
    const [importDestination, setImportDestination] = useState<'allowances' | 'parts' | 'labor'>('allowances');
    const [markupPercent, setMarkupPercent] = useState<number>(25);
    const [isImporting, setIsImporting] = useState(false);

    // Link to Job options
    const [targetJobId, setTargetJobId] = useState(preselectedJobId || '');
    const [isLinkingJob, setIsLinkingJob] = useState(false);

    // Subscribe to Firestore Trade Partners & Quotes
    useEffect(() => {
        if (!orgId) return;

        const unsubPartners = db.collection('trade_partners')
            .where('organizationId', '==', orgId)
            .onSnapshot(snap => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradePartner));
                list.sort((a, b) => a.name.localeCompare(b.name));
                setPartners(list);
                setLoading(false);
            }, err => {
                console.error("Error loading trade partners:", err);
                setLoading(false);
            });

        const unsubQuotes = db.collection('external_quotes')
            .where('organizationId', '==', orgId)
            .onSnapshot(snap => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExternalQuoteProposal));
                list.sort((a, b) => new Date(b.quoteDate).getTime() - new Date(a.quoteDate).getTime());
                setQuotes(list);
            }, err => {
                console.error("Error loading external quotes:", err);
            });

        return () => {
            unsubPartners();
            unsubQuotes();
        };
    }, [orgId]);

    // Financial Metrics
    const metrics = useMemo(() => {
        const totalPartners = partners.length;
        const totalCreditLimit = partners.reduce((sum, p) => sum + (Number(p.creditLimit) || 0), 0);
        const totalCurrentBalance = partners.reduce((sum, p) => sum + (Number(p.currentBalance) || 0), 0);
        const totalAvailableCredit = Math.max(0, totalCreditLimit - totalCurrentBalance);
        const totalQuoteValue = quotes.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);
        return {
            totalPartners,
            totalCreditLimit,
            totalCurrentBalance,
            totalAvailableCredit,
            totalQuotes: quotes.length,
            totalQuoteValue
        };
    }, [partners, quotes]);

    // Filtered Partners
    const filteredPartners = useMemo(() => {
        return partners.filter(p => {
            if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(q);
                const matchAcct = p.accountNumber?.toLowerCase().includes(q);
                const matchTrade = p.trade?.toLowerCase().includes(q);
                const matchRep = p.insideSalesRep?.name?.toLowerCase().includes(q);
                const matchPhone = p.phone?.includes(q) || p.counterPhone?.includes(q);
                return matchName || matchAcct || matchTrade || matchRep || matchPhone;
            }
            return true;
        });
    }, [partners, selectedCategory, searchTerm]);

    // Filtered Quotes
    const filteredQuotes = useMemo(() => {
        return quotes.filter(q => {
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchVendor = q.vendorName?.toLowerCase().includes(term);
                const matchTitle = q.title?.toLowerCase().includes(term);
                const matchNumber = q.quoteNumber?.toLowerCase().includes(term);
                const matchJob = q.linkedJobName?.toLowerCase().includes(term) || q.linkedCustomerName?.toLowerCase().includes(term);
                return matchVendor || matchTitle || matchNumber || matchJob;
            }
            return true;
        });
    }, [quotes, searchTerm]);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast.success(`${label} copied to clipboard!`);
    };

    // Open Add/Edit Partner
    const handleOpenPartnerModal = (partner?: TradePartner) => {
        if (partner) {
            setEditingPartner(partner);
            setPartnerForm(partner);
        } else {
            setEditingPartner(null);
            setPartnerForm({
                name: '',
                category: 'parts_house',
                trade: 'Commercial & Residential HVAC',
                status: 'Active',
                hasCreditAccount: true,
                accountNumber: '',
                creditLimit: 25000,
                currentBalance: 0,
                paymentTerms: 'Net 30',
                phone: '',
                email: '',
                counterPhone: '',
                branchAddress: '',
                notes: ''
            });
        }
        setIsAddPartnerOpen(true);
    };

    // Save Partner
    const handleSavePartner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!partnerForm.name?.trim()) {
            showToast.warn("Partner name is required.");
            return;
        }

        try {
            const partnerId = editingPartner?.id || `tp-${Date.now()}`;
            const limit = Number(partnerForm.creditLimit) || 0;
            const balance = Number(partnerForm.currentBalance) || 0;
            const available = Math.max(0, limit - balance);

            const payload: TradePartner = {
                id: partnerId,
                organizationId: orgId,
                name: partnerForm.name.trim(),
                category: partnerForm.category || 'parts_house',
                trade: partnerForm.trade || '',
                status: partnerForm.status || 'Active',
                hasCreditAccount: partnerForm.hasCreditAccount ?? true,
                accountNumber: partnerForm.accountNumber?.trim() || '',
                creditLimit: limit,
                currentBalance: balance,
                availableCredit: available,
                paymentTerms: partnerForm.paymentTerms || 'Net 30',
                earlyPayDiscount: partnerForm.earlyPayDiscount || undefined,
                statementCycleDay: partnerForm.statementCycleDay || 25,
                phone: partnerForm.phone || '',
                email: partnerForm.email || '',
                website: partnerForm.website || '',
                counterPhone: partnerForm.counterPhone || '',
                emergencyAfterHoursPhone: partnerForm.emergencyAfterHoursPhone || '',
                branchAddress: partnerForm.branchAddress || '',
                insideSalesRep: partnerForm.insideSalesRep || undefined,
                authorizedPurchasers: partnerForm.authorizedPurchasers || ['Roderick (Master Admin)'],
                requirePoNumber: partnerForm.requirePoNumber ?? true,
                requireJobLink: partnerForm.requireJobLink ?? true,
                notes: partnerForm.notes || '',
                createdAt: editingPartner?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await db.collection('trade_partners').doc(partnerId).set(cleanUndefinedFields(payload), { merge: true });
            showToast.success(`Trade Partner ${payload.name} saved successfully.`);
            setIsAddPartnerOpen(false);
        } catch (err: any) {
            console.error("Failed to save partner:", err);
            showToast.error("Failed to save partner: " + err.message);
        }
    };

    // Open Upload Quote Modal
    const handleOpenUploadQuote = (partner?: TradePartner) => {
        setEditingQuote(null);
        setQuoteForm({
            vendorName: partner?.name || '',
            tradePartnerId: partner?.id || '',
            category: partner?.category || 'equipment_rental',
            quoteNumber: '',
            title: '',
            quoteDate: new Date().toISOString().split('T')[0],
            totalAmount: 0,
            subtotal: 0,
            depositPercentage: partner?.category === 'equipment_rental' ? 50 : 0,
            depositRequired: 0,
            paymentTerms: partner?.paymentTerms || 'Net 30',
            status: 'Received',
            description: '',
            lineItems: []
        });
        setQuoteFile(null);
        setIsUploadQuoteOpen(true);
    };

    // Add quote line item
    const handleAddQuoteLineItem = () => {
        const newItem: ExternalQuoteLineItem = {
            id: `li-${Date.now()}`,
            name: '',
            description: '',
            quantity: 1,
            unitCost: 0,
            totalCost: 0,
            category: 'equipment'
        };
        setQuoteForm(prev => ({
            ...prev,
            lineItems: [...(prev.lineItems || []), newItem]
        }));
    };

    // Save External Quote
    const handleSaveQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quoteForm.title?.trim() || !quoteForm.vendorName?.trim()) {
            showToast.warn("Please enter quote title and vendor name.");
            return;
        }

        setIsSubmittingQuote(true);
        try {
            const quoteId = editingQuote?.id || `quote-${Date.now()}`;
            let fileUrl = editingQuote?.fileUrl;
            let fileName = editingQuote?.fileName;
            let fileSize = editingQuote?.fileSize;

            if (quoteFile) {
                const storagePath = `organizations/${orgId}/internal_vendor_quotes/${Date.now()}_${quoteFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                fileUrl = await uploadFileToStorage(storagePath, quoteFile);
                fileName = quoteFile.name;
                fileSize = quoteFile.size;
            }

            const total = Number(quoteForm.totalAmount) || 0;
            const depositPct = Number(quoteForm.depositPercentage) || 0;
            const depositAmt = depositPct > 0 ? (total * (depositPct / 100)) : (Number(quoteForm.depositRequired) || 0);

            const payload: ExternalQuoteProposal = {
                id: quoteId,
                organizationId: orgId,
                tradePartnerId: quoteForm.tradePartnerId || undefined,
                vendorName: quoteForm.vendorName.trim(),
                quoteNumber: quoteForm.quoteNumber?.trim() || `Q-${Date.now().toString().slice(-6)}`,
                title: quoteForm.title.trim(),
                category: quoteForm.category || 'parts_house',
                quoteDate: quoteForm.quoteDate || new Date().toISOString().split('T')[0],
                expirationDate: quoteForm.expirationDate || undefined,
                totalAmount: total,
                subtotal: quoteForm.subtotal || total,
                taxAmount: quoteForm.taxAmount || 0,
                depositPercentage: depositPct,
                depositRequired: depositAmt,
                paymentTerms: quoteForm.paymentTerms || 'Net 30',
                status: quoteForm.status || 'Received',
                fileUrl,
                fileName,
                fileSize,
                description: quoteForm.description || '',
                lineItems: quoteForm.lineItems || [],
                linkedJobId: quoteForm.linkedJobId || undefined,
                linkedJobName: quoteForm.linkedJobName || undefined,
                linkedCustomerName: quoteForm.linkedCustomerName || undefined,
                linkedWorkOrderNumber: quoteForm.linkedWorkOrderNumber || undefined,
                linkedProposalId: quoteForm.linkedProposalId || undefined,
                linkedProposalNumber: quoteForm.linkedProposalNumber || undefined,
                internalNotes: quoteForm.internalNotes || '',
                createdAt: editingQuote?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await db.collection('external_quotes').doc(quoteId).set(cleanUndefinedFields(payload), { merge: true });
            showToast.success(`External Quote "${payload.title}" saved successfully.`);
            setIsUploadQuoteOpen(false);
        } catch (err: any) {
            console.error("Failed to save quote:", err);
            showToast.error("Failed to save quote: " + err.message);
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    // Action: Import into Customer Proposal
    const handleExecuteImportProposal = async () => {
        if (!quoteToImport || !targetProposalId) {
            showToast.warn("Please select a destination proposal.");
            return;
        }

        setIsImporting(true);
        try {
            const proposalDoc = await db.collection('proposals').doc(targetProposalId).get();
            if (!proposalDoc.exists) {
                showToast.error("Destination proposal not found.");
                return;
            }

            const currentProp = proposalDoc.data() as Proposal;
            const markupMultiplier = 1 + (markupPercent / 100);

            // If quote has line items, import each item; otherwise import the total as a lump sum
            const itemsToImport = quoteToImport.lineItems && quoteToImport.lineItems.length > 0
                ? quoteToImport.lineItems
                : [{
                    id: `item-${Date.now()}`,
                    name: quoteToImport.title,
                    description: `${quoteToImport.vendorName} Quote #${quoteToImport.quoteNumber}: ${quoteToImport.description || ''}`,
                    quantity: 1,
                    unitCost: quoteToImport.totalAmount,
                    totalCost: quoteToImport.totalAmount,
                    category: quoteToImport.category === 'equipment_rental' ? 'crane_rigging' : 'equipment'
                }];

            if (importDestination === 'allowances') {
                const newAllowances = itemsToImport.map((item, idx) => ({
                    id: `allow-${Date.now()}-${idx}`,
                    description: item.name,
                    basis: 'Contract Allowance',
                    amount: Math.round(item.totalCost * markupMultiplier * 100) / 100,
                    category: 'Subcontractor / Crane / Permit'
                }));

                const updatedAllowances = [...(currentProp.allowanceItems || []), ...newAllowances];
                await db.collection('proposals').doc(targetProposalId).update(cleanUndefinedFields({
                    allowanceItems: updatedAllowances,
                    updatedAt: new Date().toISOString()
                }));
            } else if (importDestination === 'parts') {
                const newParts = itemsToImport.map((item, idx) => ({
                    id: `part-${Date.now()}-${idx}`,
                    unitName: quoteToImport.vendorName,
                    partName: item.name,
                    quantity: item.quantity || 1,
                    unitCost: item.unitCost,
                    totalCost: item.totalCost,
                    customerPrice: Math.round(item.unitCost * markupMultiplier * 100) / 100,
                    customerLineTotal: Math.round(item.totalCost * markupMultiplier * 100) / 100
                }));

                const updatedParts = [...(currentProp.partItems || []), ...newParts];
                await db.collection('proposals').doc(targetProposalId).update(cleanUndefinedFields({
                    partItems: updatedParts,
                    updatedAt: new Date().toISOString()
                }));
            } else {
                const newLabor = itemsToImport.map((item, idx) => ({
                    id: `labor-${Date.now()}-${idx}`,
                    description: `${quoteToImport.vendorName} — ${item.name}`,
                    basis: 'Piece Rate',
                    amount: Math.round(item.totalCost * markupMultiplier * 100) / 100
                }));

                const updatedLabor = [...(currentProp.laborItems || []), ...newLabor];
                await db.collection('proposals').doc(targetProposalId).update(cleanUndefinedFields({
                    laborItems: updatedLabor,
                    updatedAt: new Date().toISOString()
                }));
            }

            // Update quote document status
            const propRefNum = (currentProp as any).proposalNumber || (currentProp as any).referenceNumber || targetProposalId;
            await db.collection('external_quotes').doc(quoteToImport.id).update(cleanUndefinedFields({
                status: 'Imported to Proposal',
                linkedProposalId: targetProposalId,
                linkedProposalNumber: propRefNum,
                updatedAt: new Date().toISOString()
            }));

            showToast.success(`Successfully imported items into Proposal #${propRefNum} with ${markupPercent}% customer markup!`);
            setIsImportModalOpen(false);
        } catch (err: any) {
            console.error("Failed to import into proposal:", err);
            showToast.error("Import failed: " + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    // Action: Link to Job
    const handleExecuteLinkJob = async () => {
        if (!quoteToLink || !targetJobId) {
            showToast.warn("Please select a destination job.");
            return;
        }

        setIsLinkingJob(true);
        try {
            const jobDoc = await db.collection('jobs').doc(targetJobId).get();
            if (!jobDoc.exists) {
                showToast.error("Target job not found.");
                return;
            }

            const currentJob = jobDoc.data() as Job;
            const woNum = currentJob.workOrderNumber || currentJob.poNumber || currentJob.id;
            const custName = currentJob.customerName || 'Customer';

            // Add internal confidential file to Job.files without leaking to customer
            const updatedFiles = [...(currentJob.files || [])];
            if (quoteToLink.fileUrl) {
                updatedFiles.push({
                    id: `file-quote-${Date.now()}`,
                    name: quoteToLink.fileName || `${quoteToLink.vendorName}_Quote_${quoteToLink.quoteNumber}.pdf`,
                    url: quoteToLink.fileUrl,
                    type: 'pdf',
                    size: quoteToLink.fileSize || 0,
                    category: 'subcontractor',
                    isInternal: true,
                    internalOnly: true,
                    isExpense: true,
                    isLocked: true,
                    uploadedAt: new Date().toISOString(),
                    metadata: {
                        vendor: quoteToLink.vendorName,
                        quoteNumber: quoteToLink.quoteNumber,
                        amount: quoteToLink.totalAmount,
                        confidential: true
                    }
                } as any);
            }

            // Append internal note
            const internalNote = `\n[Trade Partner Quote Linked]: ${quoteToLink.vendorName} (Quote #${quoteToLink.quoteNumber}) for $${quoteToLink.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} - ${quoteToLink.title}`;
            const existingNotes = (currentJob.notes as any)?.internalNotes || '';

            await db.collection('jobs').doc(targetJobId).update(cleanUndefinedFields({
                files: updatedFiles,
                'notes.internalNotes': existingNotes + internalNote,
                updatedAt: new Date().toISOString()
            }));

            // Update external quote
            await db.collection('external_quotes').doc(quoteToLink.id).update(cleanUndefinedFields({
                status: 'Linked to Job',
                linkedJobId: targetJobId,
                linkedJobName: currentJob.locationName || currentJob.tasks?.[0] || (currentJob as any).title || `Job ${woNum}`,
                linkedCustomerName: custName,
                linkedWorkOrderNumber: woNum,
                updatedAt: new Date().toISOString()
            }));

            showToast.success(`Quote successfully linked to Job ${woNum} (${custName}).`);
            setIsLinkJobModalOpen(false);
        } catch (err: any) {
            console.error("Failed to link quote to job:", err);
            showToast.error("Linking failed: " + err.message);
        } finally {
            setIsLinkingJob(false);
        }
    };

    // Action: Settle / Convert to Expense
    const handleSettleQuoteAsExpense = async (quote: ExternalQuoteProposal) => {
        const confirmMsg = `Convert quote from ${quote.vendorName} ($${quote.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}) into a settled Job Expense? This will post to Job Costing and update trade credit accounts.`;
        if (!await globalConfirm(confirmMsg)) return;

        try {
            const expenseDocId = `exp-quote-${quote.id}`;
            const payableDocId = `payable-quote-${quote.id}`;
            const nowIso = new Date().toISOString();
            const todayStr = nowIso.split('T')[0];

            // 1. Create Expense Record
            const expenseCategory = quote.category === 'equipment_rental' 
                ? 'Equipment Rental' 
                : (quote.category === 'subcontractor' ? 'Subcontractor Labor' : 'Materials');

            const newExpense: Partial<Expense> = {
                id: expenseDocId,
                organizationId: orgId,
                date: todayStr,
                category: expenseCategory,
                vendor: quote.vendorName,
                description: `Vendor Quote Settled - ${quote.vendorName} (Quote #${quote.quoteNumber}) - ${quote.title}`,
                amount: quote.totalAmount,
                subtotal: quote.subtotal || quote.totalAmount,
                taxAmount: quote.taxAmount || 0,
                paidBy: 'Company Trade Credit Account',
                projectId: quote.linkedJobId || null,
                receiptUrl: quote.fileUrl || null,
                createdAt: nowIso,
                updatedAt: nowIso
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(newExpense));

            // 2. If Trade Partner has an open credit account, update their current balance
            if (quote.tradePartnerId) {
                const tpDoc = await db.collection('trade_partners').doc(quote.tradePartnerId).get();
                if (tpDoc.exists) {
                    const tpData = tpDoc.data() as TradePartner;
                    const newBal = (Number(tpData.currentBalance) || 0) + quote.totalAmount;
                    const newAvail = Math.max(0, (Number(tpData.creditLimit) || 0) - newBal);
                    await db.collection('trade_partners').doc(quote.tradePartnerId).update(cleanUndefinedFields({
                        currentBalance: newBal,
                        availableCredit: newAvail,
                        updatedAt: nowIso
                    }));
                }
            }

            // 3. Mark Quote as Settled
            await db.collection('external_quotes').doc(quote.id).update(cleanUndefinedFields({
                status: 'Settled',
                settledExpenseId: expenseDocId,
                settledPayableId: payableDocId,
                settledAt: nowIso,
                settledAmount: quote.totalAmount,
                updatedAt: nowIso
            }));

            showToast.success(`Quote #${quote.quoteNumber} converted to Expense ($${quote.totalAmount.toFixed(2)}) and posted to Job Costing!`);
        } catch (err: any) {
            console.error("Failed to settle quote:", err);
            showToast.error("Failed to settle quote: " + err.message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Trade Partners & Commercial Open Accounts" size="full">
            <div className="flex flex-col h-[85vh] -mx-4 -my-4 sm:-mx-6 sm:-my-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                
                {/* Header Ribbon / Key Metrics */}
                <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                        Trade Partners & Commercial Accounts
                                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-300 dark:border-blue-700">
                                            TekAir Supply Chain
                                        </span>
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Manage wholesale parts houses, crane & equipment rentals, trade credit lines, and external vendor proposals.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button 
                                onClick={() => handleOpenPartnerModal()} 
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus size={15} /> Add Trade Partner
                            </Button>
                            <Button 
                                onClick={() => handleOpenUploadQuote()} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                                <Upload size={15} /> Upload External Quote
                            </Button>
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <span>Active Partners</span>
                                <Store size={15} className="text-blue-500" />
                            </div>
                            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                {metrics.totalPartners}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Supply houses, cranes, & subs</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <span>Approved Credit Line</span>
                                <DollarSign size={15} className="text-emerald-500" />
                            </div>
                            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                ${metrics.totalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Commercial lines of credit</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <span>Available Credit</span>
                                <ShieldCheck size={15} className="text-teal-500" />
                            </div>
                            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                ${metrics.totalAvailableCredit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                                ${metrics.totalCurrentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })} utilized
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <span>Vendor Proposals & Quotes</span>
                                <FileText size={15} className="text-purple-500" />
                            </div>
                            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                {metrics.totalQuotes} Quotes (${metrics.totalQuoteValue.toLocaleString('en-US', { minimumFractionDigits: 0 })})
                            </div>
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">LiftHigh, Carrier, etc.</div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mt-5 pt-1">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setActiveTab('directory')}
                                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                                    activeTab === 'directory'
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            >
                                <Store size={15} /> Trade Partners Directory ({partners.length})
                            </button>

                            <button
                                onClick={() => setActiveTab('quotes')}
                                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                                    activeTab === 'quotes'
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            >
                                <FileText size={15} /> External Proposals & Quotes ({quotes.length})
                            </button>

                            <button
                                onClick={() => setActiveTab('credit')}
                                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                                    activeTab === 'credit'
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            >
                                <DollarSign size={15} /> Lines of Credit & Net Terms
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative pb-2">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search partners, accts, quotes..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-56 md:w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

                    {/* TAB 1: DIRECTORY */}
                    {activeTab === 'directory' && (
                        <div className="space-y-4">
                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-2 flex-wrap pb-1">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                                        selectedCategory === 'all'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                    }`}
                                >
                                    All Categories ({partners.length})
                                </button>
                                {Object.entries(CATEGORY_CONFIG).map(([catKey, config]) => {
                                    const count = partners.filter(p => p.category === catKey).length;
                                    if (count === 0 && selectedCategory !== catKey) return null;
                                    return (
                                        <button
                                            key={catKey}
                                            onClick={() => setSelectedCategory(catKey)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                                                selectedCategory === catKey
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                            }`}
                                        >
                                            <config.icon size={13} />
                                            {config.label} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Partners Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredPartners.map(partner => {
                                    const catConfig = CATEGORY_CONFIG[partner.category] || CATEGORY_CONFIG.parts_house;
                                    const IconComponent = catConfig.icon;
                                    const creditLimit = partner.creditLimit || 0;
                                    const balance = partner.currentBalance || 0;
                                    const avail = Math.max(0, creditLimit - balance);
                                    const utilPercent = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;

                                    return (
                                        <div
                                            key={partner.id}
                                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                        >
                                            <div>
                                                {/* Top Row: Category & Status */}
                                                <div className="flex items-center justify-between gap-2 mb-3">
                                                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${catConfig.color}`}>
                                                        <IconComponent size={12} />
                                                        {catConfig.label}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        partner.status === 'Active' 
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                    }`}>
                                                        {partner.status}
                                                    </span>
                                                </div>

                                                {/* Name & Trade */}
                                                <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                                                    {partner.name}
                                                </h3>
                                                {partner.trade && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {partner.trade}
                                                    </p>
                                                )}

                                                {/* Account Number & Terms */}
                                                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono font-bold">
                                                        <span>Acct:</span>
                                                        <span className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                            {partner.accountNumber || 'Pending'}
                                                        </span>
                                                        {partner.accountNumber && (
                                                            <button 
                                                                onClick={() => handleCopy(partner.accountNumber!, 'Account Number')}
                                                                title="Copy Account Number"
                                                                className="text-slate-400 hover:text-blue-600 ml-0.5"
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                            {partner.paymentTerms}
                                                        </span>
                                                        {partner.earlyPayDiscount && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title={`${partner.earlyPayDiscount.percentage}% off if paid within ${partner.earlyPayDiscount.withinDays} days`}>
                                                                {partner.earlyPayDiscount.percentage}% 10d
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Credit Line Bar */}
                                                {creditLimit > 0 && (
                                                    <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                        <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                            <span>Line of Credit: ${creditLimit.toLocaleString()}</span>
                                                            <span className={avail < 2000 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}>
                                                                ${avail.toLocaleString()} Avail
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${
                                                                    utilPercent > 80 ? 'bg-red-500' : (utilPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500')
                                                                }`}
                                                                style={{ width: `${Math.min(100, utilPercent)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Key Contacts */}
                                                <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {partner.insideSalesRep && (
                                                        <div className="flex items-center gap-1.5">
                                                            <UserCheck size={12} className="text-slate-400 shrink-0" />
                                                            <span>Rep: <strong>{partner.insideSalesRep.name}</strong> ({partner.insideSalesRep.phone})</span>
                                                        </div>
                                                    )}
                                                    {partner.counterPhone && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Phone size={12} className="text-slate-400 shrink-0" />
                                                            <span>Counter Desk: <strong>{partner.counterPhone}</strong></span>
                                                        </div>
                                                    )}
                                                    {partner.branchAddress && (
                                                        <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                                                            <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                                            <span className="line-clamp-1">{partner.branchAddress}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleOpenPartnerModal(partner)}
                                                    className="text-xs h-8 flex items-center gap-1"
                                                >
                                                    <Edit2 size={12} /> Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    onClick={() => handleOpenUploadQuote(partner)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex items-center gap-1"
                                                >
                                                    <Upload size={12} /> + Quote
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: EXTERNAL PROPOSALS & QUOTES */}
                    {activeTab === 'quotes' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Uploaded Vendor Proposals & Quotes ({filteredQuotes.length})
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Import vendor items directly into customer proposals, link them to active jobs, or settle them into Job Costing expenses.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => handleOpenUploadQuote()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Upload size={15} /> Upload External Quote
                                </Button>
                            </div>

                            {/* Quotes List */}
                            <div className="space-y-4">
                                {filteredQuotes.map(quote => {
                                    const isExpanded = expandedQuoteId === quote.id;

                                    return (
                                        <div
                                            key={quote.id}
                                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4"
                                        >
                                            {/* Top Line: Vendor, Quote #, Status */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-800 shrink-0">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-base font-black text-slate-900 dark:text-white">
                                                                {quote.title}
                                                            </h4>
                                                            <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                                                Quote #{quote.quoteNumber}
                                                            </span>
                                                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                                                quote.status === 'Settled'
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300'
                                                                    : (quote.status === 'Linked to Job' || quote.status === 'Imported to Proposal')
                                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300'
                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300'
                                                            }`}>
                                                                {quote.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Vendor: <strong>{quote.vendorName}</strong> • Date: {quote.quoteDate} • Payment Terms: {quote.paymentTerms}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                                        ${quote.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    {quote.depositRequired && quote.depositRequired > 0 && (
                                                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                            50% Deposit Due: ${quote.depositRequired.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Linking & Relationship Badges */}
                                            <div className="flex items-center gap-3 flex-wrap text-xs">
                                                {quote.linkedJobName && (
                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                                        <LinkIcon size={12} />
                                                        <span>Linked Job: <strong>{quote.linkedJobName}</strong> ({quote.linkedCustomerName})</span>
                                                    </div>
                                                )}

                                                {quote.linkedProposalNumber && (
                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                                                        <Layers size={12} />
                                                        <span>Imported in Proposal: <strong>#{quote.linkedProposalNumber}</strong></span>
                                                    </div>
                                                )}

                                                {quote.settledExpenseId && (
                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                                                        <CheckCircle2 size={12} />
                                                        <span>Settled as Job Cost Expense</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Scope Description */}
                                            {quote.description && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    {quote.description}
                                                </p>
                                            )}

                                            {/* Line Items Accordion */}
                                            {quote.lineItems && quote.lineItems.length > 0 && (
                                                <div>
                                                    <button
                                                        onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                                                    >
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        {isExpanded ? 'Hide Line Items Breakdown' : `View ${quote.lineItems.length} Quote Line Items`}
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="mt-3">
                                                            {/* Mobile Line Items View */}
                                                            <div className="md:hidden space-y-2">
                                                                {quote.lineItems.map(item => (
                                                                    <div key={item.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 shadow-sm space-y-1.5">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</div>
                                                                                {item.description && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>}
                                                                            </div>
                                                                            <span className="capitalize px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-[10px] font-bold border border-slate-200 dark:border-slate-600 shrink-0">
                                                                                {item.category?.replace('_', ' ') || 'Equipment'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                                                            <div className="text-slate-500 dark:text-slate-400">
                                                                                Qty: <span className="font-bold text-slate-800 dark:text-slate-200">{item.quantity}</span> × ${item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                                                ${item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Desktop Table View */}
                                                            <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                                                        <tr>
                                                                            <th className="p-2.5">Scope / Item</th>
                                                                            <th className="p-2.5">Category</th>
                                                                            <th className="p-2.5 text-center">Qty</th>
                                                                            <th className="p-2.5 text-right">Unit Cost</th>
                                                                            <th className="p-2.5 text-right">Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                        {quote.lineItems.map(item => (
                                                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                                <td className="p-2.5">
                                                                                    <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                                                                                    {item.description && <div className="text-[11px] text-slate-400">{item.description}</div>}
                                                                                </td>
                                                                                <td className="p-2.5">
                                                                                    <span className="capitalize px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                                                                        {item.category?.replace('_', ' ') || 'Equipment'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-2.5 text-center">{item.quantity}</td>
                                                                                <td className="p-2.5 text-right">${item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                                <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                                                                                    ${item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Action Ribbon */}
                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    {quote.fileUrl && (
                                                        <a
                                                            href={quote.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                        >
                                                            <Paperclip size={13} /> View Attached PDF / Quote
                                                        </a>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setQuoteToLink(quote);
                                                            setTargetJobId(quote.linkedJobId || '');
                                                            setIsLinkJobModalOpen(true);
                                                        }}
                                                        className="text-xs h-8 flex items-center gap-1"
                                                    >
                                                        <LinkIcon size={13} /> Link to Job
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            setQuoteToImport(quote);
                                                            setIsImportModalOpen(true);
                                                        }}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 flex items-center gap-1"
                                                    >
                                                        <Sparkles size={13} /> Import into Proposal
                                                    </Button>

                                                    {quote.status !== 'Settled' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSettleQuoteAsExpense(quote)}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex items-center gap-1"
                                                        >
                                                            <CheckCircle2 size={13} /> Settle as Expense
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: CREDIT ACCOUNTS & NET TERMS */}
                    {activeTab === 'credit' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                    Commercial Trade Credit Lines & Open Accounts
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Track authorized credit limits, outstanding balances, and early-payment discounts across parts houses and rental suppliers.
                                </p>
                            </div>

                            {/* Mobile Lines of Credit Cards View */}
                            <div className="md:hidden space-y-3">
                                {partners.map(p => {
                                    const limit = p.creditLimit || 0;
                                    const bal = p.currentBalance || 0;
                                    const avail = Math.max(0, limit - bal);
                                    const util = limit > 0 ? (bal / limit) * 100 : 0;

                                    return (
                                        <div key={p.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="capitalize text-[11px] text-slate-500">
                                                            {p.category.replace('_', ' ')}
                                                        </span>
                                                        {p.accountNumber && (
                                                            <>
                                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                                                                    #{p.accountNumber}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                    util > 80 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {util > 80 ? 'High Utilization' : 'Good Standing'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Credit Limit</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                        ${limit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Balance</span>
                                                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                                                        ${bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Available</span>
                                                    <span className={`font-mono font-bold ${avail < 2000 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        ${avail.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-500 font-medium">Payment Terms:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.paymentTerms}</span>
                                                    {p.earlyPayDiscount && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                            {p.earlyPayDiscount.percentage}% 10d
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="p-3">Partner Name</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3 font-mono">Account #</th>
                                            <th className="p-3">Payment Terms</th>
                                            <th className="p-3 text-right">Credit Limit</th>
                                            <th className="p-3 text-right">Current Balance</th>
                                            <th className="p-3 text-right">Available Credit</th>
                                            <th className="p-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {partners.map(p => {
                                            const limit = p.creditLimit || 0;
                                            const bal = p.currentBalance || 0;
                                            const avail = Math.max(0, limit - bal);
                                            const util = limit > 0 ? (bal / limit) * 100 : 0;

                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                                                        {p.name}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="capitalize text-[11px]">
                                                            {p.category.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                        {p.accountNumber || '—'}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold">{p.paymentTerms}</span>
                                                            {p.earlyPayDiscount && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                    {p.earlyPayDiscount.percentage}% 10d
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                        ${limit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                                                        ${bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`p-3 text-right font-mono font-bold ${avail < 2000 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        ${avail.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            util > 80 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {util > 80 ? 'High Utilization' : 'Good Standing'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* SUB-MODAL 1: ADD / EDIT TRADE PARTNER */}
            {isAddPartnerOpen && (
                <Modal isOpen={isAddPartnerOpen} onClose={() => setIsAddPartnerOpen(false)} title={editingPartner ? "Edit Trade Partner" : "Add Trade Partner"} size="lg">
                    <form onSubmit={handleSavePartner} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Partner / Company Name *"
                                value={partnerForm.name || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })}
                                placeholder="e.g. Carrier Enterprise, Johnstone Supply"
                                required
                            />
                            <Select
                                label="Category *"
                                value={partnerForm.category}
                                onChange={e => setPartnerForm({ ...partnerForm, category: e.target.value as TradePartnerCategory })}
                            >
                                <option value="parts_house">Parts & Equipment Distributor</option>
                                <option value="equipment_rental">Equipment Rental & Cranes</option>
                                <option value="subcontractor">Subcontractor / Trade Specialist</option>
                                <option value="fabricator">Custom Fabrication Shop</option>
                                <option value="tools_fleet">Tools, Fleet & Supplies</option>
                                <option value="disposal_reclaim">Refrigerant Reclaim & Disposal</option>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Trade / Specialty"
                                value={partnerForm.trade || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, trade: e.target.value })}
                                placeholder="e.g. Commercial HVAC, Crane Rigging"
                            />
                            <Input
                                label="Company Account #"
                                value={partnerForm.accountNumber || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, accountNumber: e.target.value })}
                                placeholder="e.g. CE-448201"
                            />
                            <Select
                                label="Status"
                                value={partnerForm.status}
                                onChange={e => setPartnerForm({ ...partnerForm, status: e.target.value as TradePartnerStatus })}
                            >
                                <option value="Active">Active</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Inactive">Inactive</option>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Input
                                label="Credit Limit ($)"
                                type="number"
                                step="1000"
                                value={partnerForm.creditLimit || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, creditLimit: parseFloat(e.target.value) || 0 })}
                            />
                            <Select
                                label="Payment Terms"
                                value={partnerForm.paymentTerms}
                                onChange={e => setPartnerForm({ ...partnerForm, paymentTerms: e.target.value as TradePartnerPaymentTerms })}
                            >
                                <option value="Net 15">Net 15</option>
                                <option value="Net 30">Net 30</option>
                                <option value="Net 60">Net 60</option>
                                <option value="2% 10 Net 30">2% 10 Net 30</option>
                                <option value="Due on Receipt">Due on Receipt</option>
                                <option value="COD">COD</option>
                                <option value="Credit Card">Credit Card on File</option>
                            </Select>
                            <Input
                                label="Statement Closing Day"
                                type="number"
                                min="1"
                                max="31"
                                value={partnerForm.statementCycleDay || 25}
                                onChange={e => setPartnerForm({ ...partnerForm, statementCycleDay: parseInt(e.target.value) || 25 })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Main Phone"
                                value={partnerForm.phone || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                                placeholder="(210) 555-0100"
                            />
                            <Input
                                label="Counter Desk Phone"
                                value={partnerForm.counterPhone || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, counterPhone: e.target.value })}
                                placeholder="(210) 555-0105"
                            />
                            <Input
                                label="Orders Email"
                                type="email"
                                value={partnerForm.email || ''}
                                onChange={e => setPartnerForm({ ...partnerForm, email: e.target.value })}
                                placeholder="orders@distributor.com"
                            />
                        </div>

                        <Input
                            label="Branch / Counter Address"
                            value={partnerForm.branchAddress || ''}
                            onChange={e => setPartnerForm({ ...partnerForm, branchAddress: e.target.value })}
                            placeholder="Street, City, State, ZIP"
                        />

                        <Textarea
                            label="Internal Notes / Purchasing Rules"
                            value={partnerForm.notes || ''}
                            onChange={e => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                            rows={3}
                            placeholder="Special discount multipliers, authorized counter personnel, pickup instructions..."
                        />

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button type="button" variant="secondary" onClick={() => setIsAddPartnerOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                Save Trade Partner
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* SUB-MODAL 2: UPLOAD EXTERNAL PROPOSAL / QUOTE */}
            {isUploadQuoteOpen && (
                <Modal isOpen={isUploadQuoteOpen} onClose={() => setIsUploadQuoteOpen(false)} title="Upload External Vendor Proposal / Quote" size="lg">
                    <form onSubmit={handleSaveQuote} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select Existing Trade Partner
                                </label>
                                <select
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    value={quoteForm.tradePartnerId || ''}
                                    onChange={e => {
                                        const p = partners.find(item => item.id === e.target.value);
                                        if (p) {
                                            setQuoteForm({
                                                ...quoteForm,
                                                tradePartnerId: p.id,
                                                vendorName: p.name,
                                                category: p.category,
                                                paymentTerms: p.paymentTerms
                                            });
                                        }
                                    }}
                                >
                                    <option value="">-- Manual Vendor / Other --</option>
                                    {partners.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.paymentTerms})</option>
                                    ))}
                                </select>
                            </div>

                            <Input
                                label="Vendor Name *"
                                value={quoteForm.vendorName || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, vendorName: e.target.value })}
                                placeholder="e.g. LiftHigh Crane & Rigging, Carrier Enterprise"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Quote # / Reference"
                                value={quoteForm.quoteNumber || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })}
                                placeholder="e.g. SA-2377"
                            />
                            <Input
                                label="Quote Date"
                                type="date"
                                value={quoteForm.quoteDate || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })}
                            />
                            <Input
                                label="Expiration Date"
                                type="date"
                                value={quoteForm.expirationDate || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, expirationDate: e.target.value })}
                            />
                        </div>

                        <Input
                            label="Quote Title / Scope Summary *"
                            value={quoteForm.title || ''}
                            onChange={e => setQuoteForm({ ...quoteForm, title: e.target.value })}
                            placeholder="e.g. 550T Mobile Crane & Rigging — South Park Mall RTU"
                            required
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Input
                                label="Total Amount ($) *"
                                type="number"
                                step="0.01"
                                value={quoteForm.totalAmount || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, totalAmount: parseFloat(e.target.value) || 0 })}
                                required
                            />
                            <Input
                                label="Deposit Required (%)"
                                type="number"
                                step="1"
                                value={quoteForm.depositPercentage || ''}
                                onChange={e => {
                                    const pct = parseFloat(e.target.value) || 0;
                                    const total = quoteForm.totalAmount || 0;
                                    setQuoteForm({
                                        ...quoteForm,
                                        depositPercentage: pct,
                                        depositRequired: (total * pct) / 100
                                    });
                                }}
                                placeholder="e.g. 50"
                            />
                            <Input
                                label="Deposit Amount ($)"
                                type="number"
                                step="0.01"
                                value={quoteForm.depositRequired || ''}
                                onChange={e => setQuoteForm({ ...quoteForm, depositRequired: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Upload Vendor Quote Document (PDF, DOCX, Image)
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                onChange={e => setQuoteFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/40 dark:file:text-blue-300"
                            />
                        </div>

                        {/* Line Items Section */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Itemized Quote Breakdown (Optional)
                                </label>
                                <Button type="button" size="sm" variant="secondary" onClick={handleAddQuoteLineItem} className="text-xs h-7 flex items-center gap-1">
                                    <Plus size={12} /> Add Item
                                </Button>
                            </div>

                            {quoteForm.lineItems && quoteForm.lineItems.length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {quoteForm.lineItems.map((item, idx) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <input
                                                type="text"
                                                placeholder="Item / Scope"
                                                value={item.name}
                                                onChange={e => {
                                                    const updated = [...(quoteForm.lineItems || [])];
                                                    updated[idx].name = e.target.value;
                                                    setQuoteForm({ ...quoteForm, lineItems: updated });
                                                }}
                                                className="col-span-6 px-2 py-1 bg-white dark:bg-slate-900 border rounded text-xs"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Qty"
                                                value={item.quantity}
                                                onChange={e => {
                                                    const updated = [...(quoteForm.lineItems || [])];
                                                    updated[idx].quantity = parseFloat(e.target.value) || 1;
                                                    updated[idx].totalCost = updated[idx].quantity * updated[idx].unitCost;
                                                    setQuoteForm({ ...quoteForm, lineItems: updated });
                                                }}
                                                className="col-span-2 px-2 py-1 bg-white dark:bg-slate-900 border rounded text-xs"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Unit Cost"
                                                value={item.unitCost}
                                                onChange={e => {
                                                    const updated = [...(quoteForm.lineItems || [])];
                                                    updated[idx].unitCost = parseFloat(e.target.value) || 0;
                                                    updated[idx].totalCost = updated[idx].quantity * updated[idx].unitCost;
                                                    setQuoteForm({ ...quoteForm, lineItems: updated });
                                                }}
                                                className="col-span-3 px-2 py-1 bg-white dark:bg-slate-900 border rounded text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = quoteForm.lineItems?.filter((_, i) => i !== idx);
                                                    setQuoteForm({ ...quoteForm, lineItems: updated });
                                                }}
                                                className="col-span-1 text-red-500 hover:text-red-700 flex justify-center"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Textarea
                            label="Internal Scope Description / Rigging & Delivery Notes"
                            value={quoteForm.description || ''}
                            onChange={e => setQuoteForm({ ...quoteForm, description: e.target.value })}
                            rows={3}
                            placeholder="Detailed equipment specs, crane boom configuration, counterweights, permits..."
                        />

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button type="button" variant="secondary" onClick={() => setIsUploadQuoteOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmittingQuote} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                {isSubmittingQuote ? 'Uploading...' : 'Save & File Quote'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* SUB-MODAL 3: IMPORT QUOTE INTO CUSTOMER PROPOSAL */}
            {isImportModalOpen && quoteToImport && (
                <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import Vendor Quote into Customer Proposal" size="md">
                    <div className="space-y-4 text-xs">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-900">
                            <div className="font-bold text-indigo-900 dark:text-indigo-200">
                                {quoteToImport.vendorName} — Quote #{quoteToImport.quoteNumber}
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                                Scope: {quoteToImport.title} (${quoteToImport.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Select Destination Proposal *
                            </label>
                            <select
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={targetProposalId}
                                onChange={e => setTargetProposalId(e.target.value)}
                            >
                                <option value="">-- Choose Customer Proposal --</option>
                                {(state.proposals || []).map(p => {
                                    const refNum = (p as any).proposalNumber || (p as any).referenceNumber || p.id;
                                    const cust = (p as any).customerName || 'Customer';
                                    return (
                                        <option key={p.id} value={p.id}>
                                            #{refNum} — {cust} ({p.title || 'Proposal'})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Import Destination Tab
                                </label>
                                <select
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    value={importDestination}
                                    onChange={e => setImportDestination(e.target.value as any)}
                                >
                                    <option value="allowances">Allowances (Crane / Rigging / Subs)</option>
                                    <option value="parts">Parts & Equipment Items</option>
                                    <option value="labor">Mechanical Labor (Piece Rate)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Customer Markup (%)
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    value={markupPercent}
                                    onChange={e => setMarkupPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                            <span className="text-slate-500">Resulting Customer Price:</span>
                            <span className="font-black text-slate-900 dark:text-white text-sm">
                                ${(quoteToImport.totalAmount * (1 + markupPercent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleExecuteImportProposal} 
                                disabled={isImporting || !targetProposalId}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            >
                                {isImporting ? 'Importing...' : 'Import into Proposal'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* SUB-MODAL 4: LINK QUOTE TO JOB */}
            {isLinkJobModalOpen && quoteToLink && (
                <Modal isOpen={isLinkJobModalOpen} onClose={() => setIsLinkJobModalOpen(false)} title="Link Vendor Quote to Job" size="md">
                    <div className="space-y-4 text-xs">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
                            <div className="font-bold text-blue-900 dark:text-blue-200">
                                {quoteToLink.vendorName} — Quote #{quoteToLink.quoteNumber}
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                                Scope: {quoteToLink.title} (${quoteToLink.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Select Target Job *
                            </label>
                            <select
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={targetJobId}
                                onChange={e => setTargetJobId(e.target.value)}
                            >
                                <option value="">-- Choose Job --</option>
                                {(state.jobs || []).map(j => {
                                    const wo = j.workOrderNumber || j.poNumber || j.id;
                                    const cust = j.customerName || 'Customer';
                                    return (
                                        <option key={j.id} value={j.id}>
                                            WO #{wo} — {cust} ({j.locationName || j.tasks?.[0] || 'Service Call'})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Linking this quote will file the document under Job internal notes and internal expense files with strict privacy shielding. The customer will NOT be able to see vendor costs or crane rates.
                        </p>

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setIsLinkJobModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleExecuteLinkJob} 
                                disabled={isLinkingJob || !targetJobId}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                                {isLinkingJob ? 'Linking...' : 'Link to Job'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default TradePartnersHubModal;
