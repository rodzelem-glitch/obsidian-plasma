import showToast from "lib/toast";
import { getBaseUrl, createEmailButtonHtml } from "lib/utils";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Job, InvoiceLineItem, SubLineItem, Organization, Customer } from 'types';
import { SignaturePadHandle } from 'components/ui/SignaturePad';
import { formatAddress, getPaymentTermsDays, formatFlatAddress, cleanUndefinedFields, resolveServiceLocation, matchTier, extractJobRecommendations } from 'lib/utils';
import { globalConfirm } from "lib/globalConfirm";
import { getNextInvoiceNumber, resolveJobInvoiceNumber } from 'lib/numbering';
import { fetchLinkedClusterForJob } from 'lib/linkedJobsHelper';
import { generateInvoicePdfAttachment } from 'lib/pdfHelper';
import { createSignaturePackage, handleDocumentEditWithSignatureCheck } from 'lib/signatureUtils';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { uploadFileToStorage } from 'lib/storageService';
import { calculateCustomerPartMarkup } from 'lib/estimatorRules';
import { isImpactCustomer, getImpactDefaultRecipients } from 'lib/impactDirectory';

export const sanitizeMcAlistersInvoice = (
    jobObj: any,
    itemsList: InvoiceLineItem[],
    currentBillToName: string,
    isTekAir: boolean,
    isMcAlisters: boolean
) => {
    return {
        items: itemsList,
        billToName: (jobObj?.invoice as any)?.billToName || currentBillToName || jobObj?.customerName || '',
        customerName: jobObj?.customerName || '',
        address: jobObj ? formatAddress(jobObj.address) : '',
        billToAddress: jobObj?.invoice?.billToAddress || (jobObj ? formatAddress(jobObj.address) : '')
    };
};

const formatServiceLocationAddress = (loc: any) => {
    if (!loc) return '';
    let addressStr = loc.address || '';
    
    const details = [];
    if (loc.city && !addressStr.includes(loc.city)) details.push(loc.city);
    if (loc.state && !addressStr.includes(loc.state)) details.push(loc.state);
    if (loc.zip && !addressStr.includes(loc.zip)) details.push(loc.zip);
    
    if (details.length > 0) {
        if (addressStr) {
            addressStr = `${addressStr}, ${details.join(', ')}`;
        } else {
            addressStr = details.join(', ');
        }
    }
    return addressStr;
};

export const getItemUnitPrice = (item: InvoiceLineItem): number => {
    if (item.subItems && item.subItems.length > 0) {
        const subSum = item.subItems.reduce((sum, sub) => sum + ((sub.quantity ?? 1) * (sub.unitPrice ?? 0)), 0);
        if (subSum > 0) return subSum;
    }
    return item.unitPrice || 0;
};

export const getItemTotal = (item: InvoiceLineItem): number => {
    if (item.type === 'Discount') {
        if (item.isPercentage) return item.total || 0;
        return item.unitPrice < 0 ? item.unitPrice * (item.quantity || 1) : -Math.abs((item.unitPrice || 0) * (item.quantity || 1));
    }
    const unitPrice = getItemUnitPrice(item);
    const qty = item.quantity ?? 1;
    return qty * unitPrice;
};

export const useInvoiceLogic = (jobId: string, isOpen: boolean, onClose: () => void) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, currentOrganization } = state;

    // Core State
    const [currentJob, setCurrentJob] = useState<Job | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
    const [taxRate, setTaxRate] = useState(8.25);
    const [isSaving, setIsSaving] = useState(false);
    const isSavedRef = useRef(false);
    
    // UI State
    const [customerName, setCustomerName] = useState('');
    const [address, setAddress] = useState('');
    const [billToName, setBillToName] = useState('');
    const [billToAddress, setBillToAddress] = useState('');
    const [overrideOrg, setOverrideOrg] = useState<Organization | null>(null);
    
    // Modal States
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSigningOpen, setIsSigningOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [discountConfig, setDiscountConfig] = useState({ scope: 'All' as 'All' | 'Labor' | 'Part', type: 'Percentage', value: 0 });
    const [isImportProposalModalOpen, setIsImportProposalModalOpen] = useState(false); 
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null); 

    // Warranty State
    const [workmanshipWarrantyMonths, setWorkmanshipWarrantyMonths] = useState<number>(0);
    const [partsWarrantyMonths, setPartsWarrantyMonths] = useState<number>(0);
    const [warrantyNotes, setWarrantyNotes] = useState<string>('');
    const [warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed] = useState<boolean>(false);
    const [membershipEnrollment, setMembershipEnrollment] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<string>('');
    const [importedProposalId, setImportedProposalId] = useState<string | null>(null);

    const [additionalFeePercent, setAdditionalFeePercent] = useState<number>(0);
    const [additionalFeeName, setAdditionalFeeName] = useState<string>('Processing Fee');
    const [retainagePercent, setRetainagePercent] = useState<number>(0);
    const [invoiceDate, setInvoiceDate] = useState<string>('');
    const [dueDate, setDueDate] = useState<string>('');
    const [paymentTerms, setPaymentTerms] = useState<string>('net_30');
    const [displayFormat, setDisplayFormat] = useState<'itemized' | 'progressive'>('itemized');

    // Deposit / Down Payment State
    const [requireDeposit, setRequireDeposit] = useState<boolean>(false);
    const [depositType, setDepositType] = useState<'flat' | 'percentage'>('flat');
    const [depositValue, setDepositValue] = useState<number>(0);
    const [depositNotes, setDepositNotes] = useState<string>('');
    const [depositPaid, setDepositPaid] = useState<boolean>(false);

    // Linked Jobs Billing States
    const [linkedJobs, setLinkedJobs] = useState<Job[]>([]);
    const [syncInvoiceWithLinked, setSyncInvoiceWithLinked] = useState<boolean>(false);

    const sigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        const loadJob = async () => {
            if (!jobId) return;
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (jobDoc.exists) {
                const job = { ...jobDoc.data(), id: jobDoc.id } as Job;
                
                let invoice = job.invoice;
                if (!invoice) {
                    // Check if there is a linked proposal that already has an invoice in the system
                    const linkedProposalId = job.proposalId;
                    let existingInvoice = null;
                    let existingJobWithInvoice = null;
                    
                    if (linkedProposalId && state.jobs) {
                        existingJobWithInvoice = state.jobs.find(j => 
                            j.id !== job.id && 
                            j.invoice && 
                            (j.invoice.proposalId === linkedProposalId || j.invoice.id === (state.proposals?.find(p => p.id === linkedProposalId)?.invoiceId))
                        );
                        if (existingJobWithInvoice && existingJobWithInvoice.invoice) {
                            existingInvoice = existingJobWithInvoice.invoice;
                        }
                    }
                    
                    if (existingInvoice && existingJobWithInvoice) {
                        const confirmLink = await globalConfirm(
                            `An invoice (${existingInvoice.id}) already exists for the proposal linked to this job. Would you like to link and reuse this existing invoice?`
                        );
                        if (confirmLink) {
                            invoice = existingInvoice;
                            try {
                                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ invoice }));
                                dispatch({ type: 'UPDATE_JOB', payload: { ...job, invoice } });
                            } catch (e) {
                                console.error("Failed to link existing invoice:", e);
                            }
                        }
                    }
                    
                    if (!invoice) {
                        const orgId = job.organizationId || currentOrganization?.id;
                        if (orgId) {
                            try {
                                const nextInvId = resolveJobInvoiceNumber(job, 0, state.jobs);
                                invoice = {
                                    id: nextInvId,
                                    status: 'Unpaid',
                                    items: [],
                                    subtotal: 0,
                                    taxRate: (currentOrganization?.taxRate || 8.25) / 100,
                                    taxAmount: 0,
                                    totalAmount: 0,
                                    amount: 0
                                };
                                // Keep initialized invoice in local memory (deferred save)
                                job.invoice = invoice;
                            } catch (err) {
                                console.error("Failed to initialize invoice on-demand:", err);
                            }
                        }
                    } else {
                        if (invoice.status === 'Failed') {
                            invoice.amountPaid = 0;
                        }
                        job.invoice = invoice;
                    }
                }

                if (job.invoice) {
                    if (!job.invoice.id) {
                        job.invoice.id = resolveJobInvoiceNumber(job, 0, state.jobs);
                    }
                    if (job.invoice.status === 'Failed') {
                        job.invoice.amountPaid = 0;
                    }
                }
                setCurrentJob(job);

                const draftKey = `draft_invoice_${jobId}`;
                const rawDraft = localStorage.getItem(draftKey);
                let restored = false;
                if (rawDraft) {
                    try {
                        const draft = JSON.parse(rawDraft);
                        const confirmRestore = await globalConfirm("We found an unsaved draft for this invoice. Would you like to restore it?");
                        if (confirmRestore) {
                            setLineItems(draft.lineItems || []);
                            setCustomerName(draft.customerName || job.customerName);
                            setAddress(draft.address || formatAddress(job.address));
                            setBillToName(draft.billToName || '');
                            setBillToAddress(draft.billToAddress || '');
                            setWorkmanshipWarrantyMonths(draft.workmanshipWarrantyMonths || 0);
                            setPartsWarrantyMonths(draft.partsWarrantyMonths || 0);
                            setWarrantyNotes(draft.warrantyNotes || '');
                            setWarrantyDisclaimerAgreed(draft.warrantyDisclaimerAgreed || false);
                            setMembershipEnrollment(draft.membershipEnrollment || null);
                            setRecommendations(draft.recommendations || '');
                            setRetainagePercent(draft.retainagePercent || 0);
                            setAdditionalFeePercent(draft.additionalFeePercent || 0);
                            setAdditionalFeeName(draft.additionalFeeName || 'Processing Fee');
                            setInvoiceDate(draft.invoiceDate || '');
                            setDueDate(draft.dueDate || '');
                            setPaymentTerms(draft.paymentTerms || 'net_30');
                            const hasDraftDep = draft.requireDeposit ?? ((draft.depositValue && draft.depositValue > 0) || (draft.depositAmount && draft.depositAmount > 0));
                            setRequireDeposit(Boolean(hasDraftDep));
                            setDepositType(draft.depositType || 'flat');
                            setDepositValue(draft.depositValue || 0);
                            setDepositNotes(draft.depositNotes || '');
                            setDepositPaid(draft.depositPaid || false);
                            setSyncInvoiceWithLinked(draft.syncInvoiceWithLinked || false);
                            const resolvedDraftTaxRate = (job.invoice?.taxRate !== undefined && job.invoice?.taxRate !== null)
                                ? Number(job.invoice.taxRate) * 100
                                : (currentOrganization?.taxRate !== undefined && currentOrganization?.taxRate !== null ? Number(currentOrganization.taxRate) : 8.25);
                            setTaxRate(resolvedDraftTaxRate);
                            setImportedProposalId(job.proposalId || job.invoice?.proposalId || null);
                            
                            if (job.customerId) {
                                db.collection('customers').doc(job.customerId).get().then(doc => {
                                    if (doc.exists) {
                                        const cust = { ...doc.data(), id: doc.id } as Customer;
                                        setCustomer(cust);
                                    }
                                });
                            }
                            if (job.linkedJobIds && job.linkedJobIds.length > 0) {
                                const jobsPromises = job.linkedJobIds.map(id => db.collection('jobs').doc(id).get());
                                Promise.all(jobsPromises).then(docs => {
                                    const loaded = docs.filter(d => d.exists).map(d => ({ ...d.data(), id: d.id } as Job));
                                    setLinkedJobs(loaded);
                                });
                            }
                            
                            showToast.success("Draft restored!");
                            restored = true;
                        } else {
                            localStorage.removeItem(draftKey);
                        }
                    } catch (e) {
                        console.error("Failed to restore invoice draft:", e);
                    }
                }

                if (!restored) {
                    const isCommercialInitial = !!(
                        (job as any).isProjectLevel
                    );
                    
                    const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                                        currentOrganization?.name?.toLowerCase().includes('tekair') || 
                                        job.organizationId === 'org-1765817997819';
                    
                    const isMcAlistersCust = job.customerName?.toLowerCase().includes('mcalister') || 
                                             job.customerName?.toLowerCase().includes('best choice') ||
                                             job.customerName === 'Best Choice Florida, LLC';

                    const initialItems = job.invoice?.items || [];
                    const initialBillToName = (job.invoice as any)?.billToName || job.customerName;

                    const sanitized = sanitizeMcAlistersInvoice(
                        job,
                        initialItems,
                        initialBillToName,
                        isTekAirOrg,
                        isMcAlistersCust
                    );

                    setLineItems(sanitized.items);
                    const resolvedInitialTaxRate = (job.invoice?.taxRate !== undefined && job.invoice?.taxRate !== null)
                        ? Number(job.invoice.taxRate) * 100
                        : (currentOrganization?.taxRate !== undefined && currentOrganization?.taxRate !== null ? Number(currentOrganization.taxRate) : 8.25);
                    setTaxRate(resolvedInitialTaxRate);
                    setCustomerName(sanitized.customerName || job.customerName);
                    setAddress(sanitized.address || formatAddress(job.address));
                    
                    // Load split billing / warranty fields
                    setBillToName(sanitized.billToName || (job.invoice as any)?.billToName || (job as any)?.billToName || '');
                    setBillToAddress(sanitized.billToAddress || (job.invoice as any)?.billToAddress || (job as any)?.billToAddress || formatAddress(job.address));
                    setWorkmanshipWarrantyMonths((job.invoice as any)?.workmanshipWarrantyMonths || 0);
                    setPartsWarrantyMonths((job.invoice as any)?.partsWarrantyMonths || 0);
                    setWarrantyNotes((job.invoice as any)?.warrantyNotes || '');
                    setWarrantyDisclaimerAgreed((job.invoice as any)?.warrantyDisclaimerAgreed || false);
                    setMembershipEnrollment((job.invoice as any)?.membershipEnrollment || null);
                    const defaultJobRecs = (job.invoice as any)?.recommendations || 
                        (job as any).recommendations || 
                        job.techRecommendations || 
                        (job.notes as any)?.recommendations || 
                        (job.workflowState as any)?.recommendations || 
                        '';
                    setRecommendations(defaultJobRecs);
                    let initialRetainage = 0;
                    let initialFeePercent = 0;
                    let initialFeeName = 'Processing Fee';

                    if (invoice) {
                        if ((invoice as any).retainagePercent !== undefined) {
                            initialRetainage = (invoice as any).retainagePercent;
                            initialFeePercent = invoice.additionalFeePercent || 0;
                            initialFeeName = invoice.additionalFeeName || 'Processing Fee';
                        } else {
                            if (invoice.additionalFeeName === 'Retainage') {
                                initialRetainage = invoice.additionalFeePercent || 0;
                                initialFeePercent = 0;
                                initialFeeName = 'Processing Fee';
                            } else {
                                initialRetainage = 0;
                                initialFeePercent = invoice.additionalFeePercent || 0;
                                initialFeeName = invoice.additionalFeeName || 'Processing Fee';
                            }
                        }
                    } else {
                        initialRetainage = 0;
                        initialFeePercent = 0;
                        initialFeeName = 'Processing Fee';
                    }

                    setRetainagePercent(initialRetainage);
                    setAdditionalFeePercent(initialFeePercent);
                    setAdditionalFeeName(initialFeeName);
                    setDisplayFormat((invoice as any)?.displayFormat || 'itemized');
                    setImportedProposalId(job.proposalId || job.invoice?.proposalId || null);

                    const hasInitialDep = (invoice as any)?.requireDeposit ?? (Number((invoice as any)?.depositValue || (job as any)?.invoice?.depositValue || 0) > 0 || Number((invoice as any)?.depositAmount || (job as any)?.invoice?.depositAmount || 0) > 0);
                    setRequireDeposit(Boolean(hasInitialDep));
                    setDepositType((invoice as any)?.depositType || (job as any)?.invoice?.depositType || (job as any)?.depositType || 'flat');
                    setDepositValue(Number((invoice as any)?.depositValue || (job as any)?.invoice?.depositValue || (job as any)?.depositValue || 0));
                    setDepositNotes((invoice as any)?.depositNotes || (job as any)?.invoice?.depositNotes || (job as any)?.depositNotes || '');
                    setDepositPaid(!!((invoice as any)?.depositPaid || (job as any)?.invoice?.depositPaid || (job as any)?.depositPaid));

                    const initialPaymentTerms = invoice?.paymentTerms || 'net_30';
                    setPaymentTerms(initialPaymentTerms);

                    const defaultInvoiceDate = invoice?.invoiceDate || invoice?.date || (job.appointmentTime ? new Date(job.appointmentTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                    const defaultDueDate = invoice?.dueDate || (() => {
                        const dateStr = invoice?.invoiceDate || invoice?.date || defaultInvoiceDate;
                        const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                        const dateObj = new Date(cleanStr.replace(/-/g, '/'));
                        if (isNaN(dateObj.getTime())) return defaultInvoiceDate;
                        const days = getPaymentTermsDays(initialPaymentTerms);
                        dateObj.setDate(dateObj.getDate() + days);
                        const yyyy = dateObj.getFullYear();
                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dd = String(dateObj.getDate()).padStart(2, '0');
                        return `${yyyy}-${mm}-${dd}`;
                    })();
                    setInvoiceDate(defaultInvoiceDate);
                    setDueDate(defaultDueDate);

                    if (job.customerId) {
                        db.collection('customers').doc(job.customerId).get().then(doc => {
                            if (doc.exists) {
                                const cust = { ...doc.data(), id: doc.id } as Customer;
                                setCustomer(cust);
                                
                                if (cust.taxExempt && cust.taxExemptCertUrl) {
                                    setTaxRate(0);
                                }

                                // Auto-populate Billing details with corporate customer details if new or defaulting to service target
                                const locForBilling = resolveServiceLocation({ address: job.address, locationId: job.locationId, locationName: job.locationName }, cust);
                                if (locForBilling?.billToSameAsSite) {
                                    const locBillName = locForBilling.billToName || locForBilling.propertyName || locForBilling.name || '';
                                    const locBillAddr = locForBilling.billToAddress || formatAddress(locForBilling.address);
                                    if (locBillName) setBillToName(locBillName);
                                    if (locBillAddr) setBillToAddress(locBillAddr);
                                } else {
                                    if (cust.name) {
                                        if (!job.invoice?.billToName && !(job as any)?.billToName) {
                                            setBillToName(cust.name);
                                        }
                                    }
                                    const mainCorpAddr = formatFlatAddress(cust);
                                    if (mainCorpAddr) {
                                        if (!job.invoice?.billToAddress && !(job as any)?.billToAddress) {
                                            setBillToAddress(mainCorpAddr);
                                        }
                                    }
                                }

                                if (cust.paymentTerms) {
                                    const effectiveTerms = cust.paymentTerms;
                                    setPaymentTerms(effectiveTerms);
                                    const days = getPaymentTermsDays(effectiveTerms);
                                    const dateStr = invoice?.invoiceDate || invoice?.date || defaultInvoiceDate;
                                    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                                    const dateObj = new Date(cleanStr.replace(/-/g, '/'));
                                    if (!isNaN(dateObj.getTime())) {
                                        dateObj.setDate(dateObj.getDate() + days);
                                        const yyyy = dateObj.getFullYear();
                                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                        const dd = String(dateObj.getDate()).padStart(2, '0');
                                        setDueDate(`${yyyy}-${mm}-${dd}`);
                                    }
                                }
                                const isCommercial = !!(
                                    (job as any).isProjectLevel || 
                                    cust.customerType === 'Commercial' ||
                                    cust.customerType === 'Property Management'
                                );
                                if (!job.invoice) {
                                    setRetainagePercent(0);
                                } else if ((job.invoice as any).retainagePercent === undefined && job.invoice.additionalFeeName !== 'Retainage') {
                                    setRetainagePercent(0);
                                }
                            }
                        });
                    }

                    if (job.source === 'PlatformAdmin') {
                        db.collection('organizations').doc('platform').get().then(doc => {
                             if(doc.exists) setOverrideOrg({ ...doc.data(), id: doc.id } as Organization);
                        });
                    }

                    try {
                        const cluster = await fetchLinkedClusterForJob(job);
                        setLinkedJobs(cluster.allJobs.filter(j => j.id !== job.id));
                        if (cluster.linkedProposals.length > 0 && !job.proposalId) {
                            setImportedProposalId(cluster.linkedProposals[0].id);
                        }
                    } catch (err) {
                        console.error("Failed to load linked jobs for invoicing", err);
                        setLinkedJobs([]);
                    }
                }
            }
        };
        if (isOpen) loadJob();
    }, [jobId, isOpen, currentOrganization?.taxRate]);

    useEffect(() => {
        if (linkedJobs.length > 0) {
            if (currentJob?.invoice) {
                const isSynced = linkedJobs.some(lj => lj.invoice?.id === currentJob.invoice?.id);
                setSyncInvoiceWithLinked(isSynced);
            } else {
                setSyncInvoiceWithLinked(false);
            }
        } else {
            setSyncInvoiceWithLinked(false);
        }
    }, [linkedJobs, currentJob?.invoice?.id]);

    useEffect(() => {
        const baseSubtotal = lineItems
            .filter(item => item.type !== 'Discount' && item.type !== 'Fee')
            .reduce((sum, item) => sum + getItemTotal(item), 0);

        let changed = false;
        const nextItems = lineItems.map(item => {
            if (item.type === 'Discount' && item.isPercentage && item.percentageRate !== undefined) {
                const targetVal = -parseFloat((baseSubtotal * (item.percentageRate / 100)).toFixed(2));
                if (item.unitPrice !== targetVal || item.total !== targetVal) {
                    changed = true;
                    return { ...item, unitPrice: targetVal, total: targetVal };
                }
            }
            return item;
        });

        if (changed) {
            setLineItems(nextItems);
        }
    }, [lineItems]);

    const sanitizedItemsAndBillTo = useMemo(() => {
        if (!currentJob) return { items: lineItems, billToName };
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        return sanitizeMcAlistersInvoice(
            currentJob,
            lineItems,
            billToName,
            isTekAirOrg,
            isMcAlistersCust
        );
    }, [currentJob, lineItems, billToName, currentOrganization]);

    const totals = useMemo(() => {
        const itemsToUse = sanitizedItemsAndBillTo.items;
        const subtotal = itemsToUse.reduce((sum, item) => sum + getItemTotal(item), 0);
        const isCustomerTaxExempt = !!(customer?.taxExempt && customer?.taxExemptCertUrl);
        const taxableAmount = isCustomerTaxExempt ? 0 : itemsToUse.filter(i => i.taxable !== false).reduce((sum, item) => sum + getItemTotal(item), 0);
        const tax = isCustomerTaxExempt ? 0 : taxableAmount * (taxRate / 100);
        let total = subtotal + tax;

        const additionalFeeAmount = additionalFeePercent ? (total * (additionalFeePercent / 100)) : 0;
        total += additionalFeeAmount;

        let calculatedDepositAmount = 0;
        if (requireDeposit && depositValue > 0) {
            calculatedDepositAmount = depositType === 'percentage'
                ? parseFloat(((total * depositValue) / 100).toFixed(2))
                : parseFloat(depositValue.toFixed(2));
        }

        return { 
            subtotal: parseFloat(subtotal.toFixed(2)), 
            tax: parseFloat(tax.toFixed(2)), 
            total: parseFloat(total.toFixed(2)), 
            additionalFeeAmount: parseFloat(additionalFeeAmount.toFixed(2)),
            depositAmount: calculatedDepositAmount
        };
    }, [sanitizedItemsAndBillTo.items, taxRate, additionalFeePercent, requireDeposit, depositType, depositValue, customer?.taxExempt, customer?.taxExemptCertUrl]);

    const handleAddItem = (
        type: InvoiceLineItem['type'] = 'Labor', 
        description: string = '', 
        unitPrice: number = 0, 
        taxable?: boolean
    ) => {
        const randomIdSuffix = Math.floor(Math.random() * 1000000);
        const isTaxExemptCust = !!(customer?.taxExempt && customer?.taxExemptCertUrl);
        const isCommercialCust = customer?.customerType === 'Commercial';

        let defaultTaxable = taxable;
        if (defaultTaxable === undefined) {
            if (isTaxExemptCust) {
                defaultTaxable = false;
            } else if (isCommercialCust) {
                defaultTaxable = type !== 'Discount';
            } else {
                defaultTaxable = type === 'Part' || type === 'Part/Labor';
            }
        }

        const newItem: InvoiceLineItem = { 
            id: `item-${Date.now()}-${randomIdSuffix}`, 
            name: 'New Item', 
            description, 
            quantity: 1, 
            unitPrice, 
            total: unitPrice, 
            type, 
            taxable: defaultTaxable 
        };
        setLineItems(prev => [...prev, newItem]);
    };

    const handleUpdateItem = (id: string, field: keyof InvoiceLineItem | 'vendorCost' | 'cost' | 'markupPct', value: any) => {
        const isTaxExemptCust = !!(customer?.taxExempt && customer?.taxExemptCertUrl);
        const isCommercialCust = customer?.customerType === 'Commercial';

        setLineItems(items => items.map(item => {
            if (item.id === id) {
                const updated: any = { ...item, [field]: value };

                if (field === 'cost' || field === 'vendorCost') {
                    const numericCost = Math.max(0, Number(value) || 0);
                    updated.cost = numericCost;
                    updated.vendorCost = numericCost;

                    if (numericCost > 0) {
                        const currentUnitPrice = Number(item.unitPrice) || 0;
                        if (item.markupPct !== undefined && item.markupPct !== null && item.markupPct > 0) {
                            const newUnitPrice = parseFloat((numericCost * (1 + item.markupPct / 100)).toFixed(2));
                            updated.unitPrice = newUnitPrice;
                        } else if (currentUnitPrice > numericCost) {
                            updated.markupPct = parseFloat((((currentUnitPrice - numericCost) / numericCost) * 100).toFixed(1));
                        } else {
                            const suggestedMarkup = calculateCustomerPartMarkup(
                                numericCost,
                                customer?.pricingRules?.partsMarkupRules,
                                customer?.pricingRules?.partsMarkupPercentage ?? customer?.pricingRules?.markupPercentage,
                                { tier1: customer?.pricingRules?.partsMarkupTier1, tier2: customer?.pricingRules?.partsMarkupTier2 }
                            );
                            updated.markupPct = suggestedMarkup;
                            updated.unitPrice = parseFloat((numericCost * (1 + suggestedMarkup / 100)).toFixed(2));
                        }
                    }
                } else if (field === 'markupPct') {
                    const markup = Number(value) || 0;
                    updated.markupPct = markup;
                    const cost = Number(item.cost ?? item.vendorCost ?? 0);
                    if (cost > 0) {
                        updated.unitPrice = parseFloat((cost * (1 + markup / 100)).toFixed(2));
                    }
                } else if (field === 'unitPrice') {
                    const newUnitPrice = Number(value) || 0;
                    const cost = Number(item.cost ?? item.vendorCost ?? 0);
                    if (cost > 0 && newUnitPrice > 0) {
                        updated.markupPct = parseFloat((((newUnitPrice - cost) / cost) * 100).toFixed(1));
                    }
                }

                if (field === 'type') {
                    if (value === 'Discount' || isTaxExemptCust) {
                        updated.unitPrice = value === 'Discount' ? -Math.abs(updated.unitPrice || 0) : Math.abs(updated.unitPrice || 0);
                        updated.taxable = false;
                    } else if (isCommercialCust) {
                        updated.unitPrice = Math.abs(updated.unitPrice || 0);
                        updated.taxable = true;
                    } else {
                        updated.unitPrice = Math.abs(updated.unitPrice || 0);
                        updated.taxable = value === 'Part' || value === 'Part/Labor';
                    }
                }
                if (field === 'unitPrice') {
                    if (updated.type === 'Discount') {
                        updated.unitPrice = -Math.abs(value || 0);
                    } else {
                        updated.unitPrice = value;
                    }
                }
                if (field === 'unitPrice' || field === 'quantity' || field === 'type' || field === 'subItems' || field === 'cost' || field === 'vendorCost' || field === 'markupPct') {
                    const unitPrice = getItemUnitPrice(updated);
                    updated.total = updated.quantity * (updated.type === 'Discount' ? unitPrice : Math.abs(unitPrice));
                }
                return updated;
            }
            return item;
        }));
    };

    const handleDeleteItem = (id: string) => {
        setLineItems(items => items.filter(i => i.id !== id));
    };

    const handleAddSubItem = (lineItemId: string) => {
        setLineItems(items => items.map(item => {
            if (item.id === lineItemId) {
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

    const handleUpdateSubItem = (lineItemId: string, subItemId: string, field: keyof SubLineItem, value: any) => {
        setLineItems(items => items.map(item => {
            if (item.id === lineItemId && item.subItems) {
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

    const handleDeleteSubItem = (lineItemId: string, subItemId: string) => {
        setLineItems(items => items.map(item => {
            if (item.id === lineItemId && item.subItems) {
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

    const handleManualDiscount = () => {
        if (discountConfig.value <= 0) return;
        if (discountConfig.type === 'Percentage') {
            const baseAmount = lineItems.reduce((sum, item) => {
                let matchesScope = false;
                if (discountConfig.scope === 'All') matchesScope = true;
                else if (discountConfig.scope === 'Labor' && (item.type === 'Labor' || item.type === 'Part/Labor')) matchesScope = true;
                else if (discountConfig.scope === 'Part' && (item.type === 'Part' || item.type === 'Part/Labor')) matchesScope = true;
                
                if (matchesScope && item.type !== 'Discount' && item.type !== 'Fee') {
                    return sum + (item.quantity * item.unitPrice);
                }
                return sum;
            }, 0);

            const discountAmount = -parseFloat((baseAmount * (discountConfig.value / 100)).toFixed(2));

            const discountItem: InvoiceLineItem = {
                id: `disc-${Date.now()}`,
                name: `${discountConfig.value}% Discount Applied`,
                description: `${discountConfig.value}% discount on ${discountConfig.scope.toLowerCase()} items`,
                quantity: 1,
                unitPrice: discountAmount,
                total: discountAmount,
                type: 'Discount',
                taxable: false,
                isPercentage: true,
                percentageRate: discountConfig.value
            };
            setLineItems(prev => [...prev, discountItem]);
        } else { 
            const discountItem: InvoiceLineItem = {
                id: `disc-${Date.now()}`,
                name: 'Discount Applied',
                description: `Manual Discount (${discountConfig.scope}) - $${discountConfig.value.toFixed(2)}`,
                quantity: 1,
                unitPrice: -parseFloat(discountConfig.value.toFixed(2)),
                total: -parseFloat(discountConfig.value.toFixed(2)),
                type: 'Discount',
                taxable: false
            };
            setLineItems(prev => [...prev, discountItem]);
        }
        setIsDiscountModalOpen(false);
        setDiscountConfig({ scope: 'All', type: 'Percentage', value: 0 });
    };

    const handleImportFromProposal = async (proposalId: string) => {
        const proposal = state.proposals.find(p => p.id === proposalId);
        if (!proposal) { showToast.warn("Proposal not found."); return; }
        if (currentJob?.customerId && proposal.customerId && proposal.customerId !== currentJob.customerId) { 
            if(!await globalConfirm("Warning: This proposal appears to be for a different customer. Import anyway?")) return; 
        }

        let newItems: InvoiceLineItem[] = [];

        if (proposal.isProjectLevel) {
            const laborItems = (proposal.laborItems || []).map((item, idx) => {
                const unitStr = item.unitName ? `[${item.unitName}] ` : '';
                const title = (item as any).title || item.unitName || 'Labor';
                const scopeDesc = item.scope || (item.hours ? `${item.hours} hours @ $${item.rate || 0}/hr` : (item.unitName ? `Labor hours for unit: ${item.unitName}` : ''));
                const hours = Number(item.hours || 1);
                const rate = Number(item.rate || 0);
                const total = Number(item.value ?? (hours * rate));
                const cost = Number((item as any).cost ?? (item as any).laborCost ?? 0) || undefined;

                return {
                    id: `prop-labor-${item.id || idx}-${Date.now()}`,
                    name: `${unitStr}${title}`,
                    description: scopeDesc,
                    quantity: hours,
                    unitPrice: rate,
                    total: total,
                    type: 'Labor' as const,
                    taxable: false,
                    cost: cost,
                    vendorCost: cost,
                    tier: 'Basic'
                };
            });

            const partItems = (proposal.partItems || []).map((item, idx) => {
                const partName = item.partName || (item as any).name || (item as any).description || 'Part';
                const unitStr = item.unitName ? `[${item.unitName}] ` : '';
                const availStr = item.availability ? ` • Availability: ${item.availability}` : '';
                const descStr = (item as any).partNumber 
                    ? `Part #: ${(item as any).partNumber}${availStr}` 
                    : ((item as any).description || (item.availability ? `Availability: ${item.availability}` : (item.unitName ? `Part for unit: ${item.unitName}` : '')));
                const qty = Number(item.quantity || 1);
                const unitPrice = Number(item.customerUnitPrice ?? (item as any).unitPrice ?? 0);
                const total = Number(item.customerLineTotal ?? (qty * unitPrice));
                const vendorCost = item.vendorCost !== undefined ? Number(item.vendorCost) : undefined;
                const markupPct = item.markupPct !== undefined ? Number(item.markupPct) : undefined;

                return {
                    id: `prop-part-${item.id || idx}-${Date.now()}`,
                    name: `${unitStr}${partName}`,
                    description: descStr,
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: total,
                    type: unitPrice < 0 ? ('Discount' as const) : ('Part' as const),
                    taxable: (item as any).taxable !== false && unitPrice >= 0,
                    vendorCost: vendorCost,
                    cost: vendorCost,
                    markupPct: markupPct,
                    tier: 'Basic'
                };
            });

            const allowanceItems = (proposal.allowanceItems || []).map((item, idx) => {
                const desc = item.description || (item as any).name || 'Allowance';
                const notes = item.basis ? `Scope basis: ${item.basis}` : ((item as any).notes || '');
                const amt = Number(item.amount ?? (item as any).cost ?? 0);
                const cost = Number((item as any).cost ?? item.amount ?? 0) || undefined;

                return {
                    id: `prop-allowance-${item.id || idx}-${Date.now()}`,
                    name: `Allowance: ${desc}`,
                    description: notes,
                    quantity: 1,
                    unitPrice: amt,
                    total: amt,
                    type: 'Fee' as const,
                    taxable: (item as any).taxable !== false,
                    vendorCost: cost,
                    cost: cost,
                    tier: 'Basic'
                };
            });

            newItems = [...laborItems, ...partItems, ...allowanceItems];
        } else {
            let itemsToImport = proposal.items || [];
            if (proposal.selectedOption && proposal.selectedOption !== 'None') {
                itemsToImport = itemsToImport.filter(item => !item.tier || matchTier(item.tier, proposal.selectedOption));
            }
            newItems = itemsToImport.map(pItem => {
                const unitPrice = Number(pItem.price ?? (pItem as any).unitPrice ?? 0);
                const qty = Number(pItem.quantity || 1);
                const lineTotal = Number(pItem.total !== undefined ? pItem.total : (unitPrice * qty));
                const rawCost = pItem.vendorCost ?? pItem.cost ?? pItem.partCost;
                const numericCost = rawCost !== undefined ? Number(rawCost) : undefined;
                const numericMarkup = pItem.markupPct !== undefined ? Number(pItem.markupPct) : undefined;

                return {
                    id: `prop-${pItem.id}-${Date.now()}`,
                    name: pItem.name || pItem.description || 'Proposal Item',
                    description: pItem.description || pItem.name || '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: lineTotal,
                    type: (pItem.type as any) || 'Part',
                    taxable: pItem.taxable !== false,
                    vendorCost: numericCost,
                    cost: numericCost,
                    markupPct: numericMarkup,
                    tier: pItem.tier,
                    isWarrantyWork: (pItem as any).isWarrantyWork,
                    isPercentage: (pItem as any).isPercentage,
                    percentageRate: (pItem as any).percentageRate,
                    subItems: pItem.subItems ? pItem.subItems.map(sub => ({
                        ...sub,
                        id: sub.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
                    })) : undefined
                };
            });
        }

        setLineItems(prev => [...prev, ...newItems]);
        setImportedProposalId(proposalId);

        // Map all Proposal-level fields into invoice state:
        if (proposal.additionalFeeName) {
            setAdditionalFeeName(proposal.additionalFeeName);
        }
        if (proposal.additionalFeePercent !== undefined && proposal.additionalFeePercent !== null) {
            setAdditionalFeePercent(Number(proposal.additionalFeePercent));
        }
        if (proposal.taxRate !== undefined && proposal.taxRate !== null) {
            const parsedTaxRate = Number(proposal.taxRate);
            setTaxRate(parsedTaxRate <= 1 ? parsedTaxRate * 100 : parsedTaxRate);
        }
        if ((proposal as any).paymentTerms) {
            setPaymentTerms((proposal as any).paymentTerms);
        }
        if (proposal.recommendations) {
            setRecommendations(prev => prev ? `${prev}\n\n${proposal.recommendations}` : proposal.recommendations);
        }
        if (proposal.warrantyTerms) {
            setWarrantyNotes(prev => prev ? `${prev}\n\n${proposal.warrantyTerms}` : proposal.warrantyTerms);
        }

        const hasProposalDeposit = proposal.requireDeposit ?? ((proposal.depositValue && proposal.depositValue > 0) || (proposal.depositAmount && proposal.depositAmount > 0));
        if (hasProposalDeposit) {
            setRequireDeposit(true);
            setDepositType(proposal.depositType === 'percentage' ? 'percentage' : 'flat');
            setDepositValue(Number(proposal.depositValue || 0));
            setDepositNotes(proposal.depositNotes || '');
            setDepositPaid(!!proposal.depositPaid);
        }

        if (proposal.poNumber && currentJob && !currentJob.poNumber) {
            setCurrentJob(prev => prev ? {
                ...prev,
                poNumber: proposal.poNumber,
                workOrderNumber: prev.workOrderNumber || proposal.poNumber,
                invoice: prev.invoice ? { ...prev.invoice, poNumber: proposal.poNumber } : prev.invoice
            } : null);
        }

        showToast.success(`Imported ${newItems.length} items from Proposal #${proposal.proposalNumber || proposal.id}!`);

        setIsImportProposalModalOpen(false);
        setSelectedProposalId(null);
    };

    const handleImportFromLinkedJobs = () => {
        if (linkedJobs.length === 0) return;
        
        const newItems: InvoiceLineItem[] = [];
        
        linkedJobs.forEach(linkedJob => {
            if (linkedJob.partsUsed && linkedJob.partsUsed.length > 0) {
                linkedJob.partsUsed.forEach(part => {
                    const randomIdSuffix = Math.floor(Math.random() * 1000000);
                    const unitPrice = part.unitPrice || 0;
                    newItems.push({
                        id: `linked-part-${part.id}-${Date.now()}-${randomIdSuffix}`,
                        name: `Part: ${part.name} (from Job #${linkedJob.id.toUpperCase()})`,
                        description: `SKU: ${part.sku || 'N/A'}${part.location ? ` | Location: ${part.location}` : ''}`,
                        quantity: part.quantity,
                        unitPrice: unitPrice,
                        total: part.quantity * unitPrice,
                        type: 'Part',
                        taxable: true
                    });
                });
            }
            
            if (linkedJob.invoice?.items && linkedJob.invoice.items.length > 0) {
                linkedJob.invoice.items.forEach(item => {
                    const randomIdSuffix = Math.floor(Math.random() * 1000000);
                    newItems.push({
                        ...item,
                        id: `linked-item-${item.id}-${Date.now()}-${randomIdSuffix}`,
                        name: `${item.name} (from Job #${linkedJob.id.toUpperCase()})`
                    });
                });
            }
            
            if ((!linkedJob.invoice?.items || linkedJob.invoice.items.length === 0) && linkedJob.tasks && linkedJob.tasks.length > 0) {
                linkedJob.tasks.forEach((task, idx) => {
                    const randomIdSuffix = Math.floor(Math.random() * 1000000);
                    newItems.push({
                        id: `linked-task-${idx}-${Date.now()}-${randomIdSuffix}`,
                        name: `Labor: ${task} (from Job #${linkedJob.id.toUpperCase()})`,
                        description: `Assigned task from linked job`,
                        quantity: 1,
                        unitPrice: 0,
                        total: 0,
                        type: 'Labor',
                        taxable: false
                    });
                });
            }
        });
        
        if (newItems.length > 0) {
            setLineItems(prev => [...prev, ...newItems]);
            showToast.success(`Imported ${newItems.length} items from linked jobs!`);
        } else {
            showToast.info("No billable items or parts found on linked jobs.");
        }
    };

    const handleImportJobRecommendations = async () => {
        if (!currentJob) {
            showToast.warn("No active job record found.");
            return;
        }
        const extracted = extractJobRecommendations(currentJob);
        if (!extracted || !extracted.trim()) {
            showToast.warn("No recommendations, unit inspection notes, or diagnostic findings found on this job record.");
            return;
        }

        if (recommendations && recommendations.trim()) {
            const shouldOverwrite = await globalConfirm(
                "Would you like to overwrite the existing recommendations or append to them?",
                "Import Job Recommendations",
                "Overwrite",
                "Append"
            );
            if (shouldOverwrite) {
                setRecommendations(extracted);
            } else {
                setRecommendations(prev => `${prev}\n\n${extracted}`);
            }
        } else {
            setRecommendations(extracted);
        }
        showToast.success("Recommendations successfully imported from job!");
    };

    const saveJobAndSyncInvoice = async (updatedJob: Job) => {
        if (!currentJob) return;
        isSavedRef.current = true;
        const cleanedPayload = cleanUndefinedFields(updatedJob);
        await db.collection('jobs').doc(currentJob.id).set(cleanUndefinedFields(cleanedPayload), { merge: true });
        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        
        const draftKey = `draft_invoice_${jobId}`;
        localStorage.removeItem(draftKey);
        
        // Maintain proposal linking and references without overwriting proposal items or quote scope
        const targetPropId = importedProposalId || currentJob.proposalId || updatedJob.invoice?.proposalId;
        if (targetPropId) {
            const proposal = state.proposals.find(p => p.id === targetPropId);
            if (proposal) {
                const invoiceId = updatedJob.invoice?.id || null;
                const poNum = updatedJob.poNumber || currentJob.poNumber || currentJob.workOrderNumber || null;
                const updatedJobIds = Array.from(new Set([...(proposal.linkedJobIds || []), currentJob.id]));
                
                // Only associate primary jobId / invoiceId if this proposal doesn't already belong to a different job
                const isPrimaryJob = !proposal.jobId || proposal.jobId === currentJob.id;
                const propUpdates: any = {
                    linkedJobIds: updatedJobIds,
                    poNumber: poNum || proposal.poNumber || null,
                    updatedAt: new Date().toISOString()
                };

                if (isPrimaryJob) {
                    if (invoiceId) propUpdates.invoiceId = invoiceId;
                    propUpdates.jobId = currentJob.id;
                }

                const updatedProp = {
                    ...proposal,
                    ...propUpdates
                };

                try {
                    await db.collection('proposals').doc(targetPropId).update(cleanUndefinedFields(propUpdates));
                    dispatch({
                        type: 'UPDATE_PROPOSAL',
                        payload: updatedProp
                    });
                } catch (error) {
                    console.error("Error linking proposal to invoice/job in saveJobAndSyncInvoice:", error);
                }
            }
        }

        if (syncInvoiceWithLinked && currentJob.linkedJobIds && currentJob.linkedJobIds.length > 0) {
            const batch = db.batch();
            const linkedUpdatePayload = cleanUndefinedFields({
                invoice: updatedJob.invoice,
                invoiceSignature: updatedJob.invoiceSignature || null,
                invoiceSignedDate: updatedJob.invoiceSignedDate || null,
                updatedAt: new Date().toISOString(),
                updatedById: currentUser?.id || currentUser?.uid || null,
                updatedByName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin'
            });
            for (const id of currentJob.linkedJobIds) {
                batch.update(db.collection('jobs').doc(id), cleanUndefinedFields(linkedUpdatePayload));
            }
            await batch.commit();
            
            for (const id of currentJob.linkedJobIds) {
                dispatch({
                    type: 'UPDATE_JOB',
                    payload: {
                        id,
                        invoice: updatedJob.invoice,
                        invoiceSignature: updatedJob.invoiceSignature || null,
                        invoiceSignedDate: updatedJob.invoiceSignedDate || null
                    }
                });
            }
        }
    };

    const getPreviewJob = () => {
        if (!currentJob) return null;
        
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        const sanitized = sanitizeMcAlistersInvoice(
            currentJob,
            lineItems,
            billToName,
            isTekAirOrg,
            isMcAlistersCust
        );

        // Compute totals based on sanitized items
        const subtotal = sanitized.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const taxableAmount = sanitized.items.filter(i => i.taxable !== false).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const tax = taxableAmount * (taxRate / 100);
        let total = subtotal + tax;
        const additionalFeeAmount = additionalFeePercent ? (total * (additionalFeePercent / 100)) : 0;
        total += additionalFeeAmount;

        const matchingLoc = resolveServiceLocation({ address, locationId: currentJob.locationId, locationName: currentJob.locationName }, customer);
        const resolvedPoNumber = currentJob.poNumber || currentJob.workOrderNumber || (currentJob.invoice as any)?.poNumber || null;

        const canonical = computeCanonicalFinancials({
            items: sanitized.items,
            taxRate: taxRate / 100,
            taxAmount: tax,
            subtotal: subtotal,
            additionalFeePercent: additionalFeePercent || 0,
            additionalFeeName: additionalFeeName || '',
            additionalFeeAmount: additionalFeeAmount,
            retainagePercent: retainagePercent || 0,
            requireDeposit,
            depositType: requireDeposit ? depositType : 'none',
            depositValue: requireDeposit ? depositValue : 0,
            depositAmount: requireDeposit ? totals.depositAmount : 0,
            depositPaid: requireDeposit ? depositPaid : false,
            depositPaidAmount: (requireDeposit && depositPaid) ? (totals.depositAmount || Number(depositValue) || (currentJob.invoice as any)?.depositPaidAmount || 0) : ((currentJob.invoice as any)?.depositPaidAmount || 0),
            depositNotes: requireDeposit ? depositNotes : '',
            amountPaid: (requireDeposit && depositPaid) 
                ? Math.max(Number(currentJob.invoice?.amountPaid || 0), totals.depositAmount || Number(depositValue) || 0)
                : (currentJob.invoice?.status === 'Failed' ? 0 : (currentJob.invoice?.amountPaid ?? 0)),
            paymentTerms: paymentTerms || 'net_30',
        });

        const previewJob: Job = {
            ...currentJob,
            customerName: (customer?.name && (customer.customerType === 'Commercial' || customer.customerType === 'Property Management' || (customer.serviceLocations && customer.serviceLocations.length > 0))) 
                ? customer.name 
                : (customerName || currentJob.customerName || ''),
            address: address || (currentJob.address ? formatAddress(currentJob.address) : ''),
            city: matchingLoc?.city || currentJob.city || (currentJob as any)?.serviceLocationCity || null,
            state: matchingLoc?.state || currentJob.state || (currentJob as any)?.serviceLocationState || null,
            zip: matchingLoc?.zip || currentJob.zip || (currentJob as any)?.serviceLocationZip || null,
            locationId: matchingLoc?.id || currentJob.locationId || null,
            locationName: matchingLoc?.propertyName || matchingLoc?.name || currentJob.locationName || null,
            serviceLocationCity: matchingLoc?.city || (currentJob as any)?.serviceLocationCity || currentJob.city || null,
            serviceLocationState: matchingLoc?.state || (currentJob as any)?.serviceLocationState || currentJob.state || null,
            serviceLocationZip: matchingLoc?.zip || (currentJob as any)?.serviceLocationZip || currentJob.zip || null,
            serviceLocationAddress: address || (currentJob as any)?.serviceLocationAddress || currentJob.address || null,
            billToName: sanitized.billToName || billToName || '',
            billToAddress: billToAddress || '',
            poNumber: resolvedPoNumber,
            workOrderNumber: currentJob.workOrderNumber || currentJob.poNumber || resolvedPoNumber || null,
            proposalId: importedProposalId || currentJob.proposalId || null,
            depositType: (canonical.depositType === 'percentage' ? 'percentage' : 'flat') as 'flat' | 'percentage',
            depositValue: canonical.depositValue,
            depositAmount: canonical.depositRequired,
            depositNotes: canonical.depositNotes,
            depositPaid: canonical.depositPaid,
            invoice: {
                ...currentJob.invoice,
                id: currentJob.invoice?.id || resolveJobInvoiceNumber(currentJob, 0, state.jobs),
                poNumber: resolvedPoNumber,
                proposalId: importedProposalId || currentJob.invoice?.proposalId || currentJob.proposalId || null,
                items: sanitized.items,
                subtotal: canonical.subtotal,
                taxRate: canonical.taxRate,
                taxAmount: canonical.taxAmount,
                totalAmount: canonical.grandTotal,
                amount: canonical.grandTotal,
                grandTotal: canonical.grandTotal,
                billToName: sanitized.billToName || billToName || '',
                billToAddress: billToAddress || '',
                workmanshipWarrantyMonths: workmanshipWarrantyMonths || 0,
                partsWarrantyMonths: partsWarrantyMonths || 0,
                warrantyNotes: warrantyNotes || '',
                warrantyDisclaimerAgreed: !!warrantyDisclaimerAgreed,
                warrantyIssuedDate: (currentJob.invoice as any)?.warrantyIssuedDate || (workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0 ? new Date().toISOString() : null),
                membershipEnrollment: membershipEnrollment || null,
                recommendations: recommendations || '',
                notes: recommendations || '',
                additionalFeePercent: canonical.additionalFeePercent,
                additionalFeeName: canonical.additionalFeeName,
                additionalFeeAmount: canonical.additionalFeeAmount,
                retainagePercent: canonical.retainagePercent,
                retainageAmount: canonical.retainageAmount,
                invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
                date: invoiceDate || new Date().toISOString().split('T')[0],
                dueDate: dueDate || '',
                paymentTerms: canonical.paymentTerms,
                paymentTermsLabel: canonical.paymentTermsLabel,
                amountPaid: canonical.amountPaid,
                balanceDue: canonical.balanceDue,
                balanceRemaining: canonical.balanceRemaining,
                amountDueToday: canonical.amountDueToday,
                amountDueNet: canonical.amountDueNet,
                financialStatus: canonical.financialStatus,
                depositType: (canonical.depositType === 'percentage' ? 'percentage' : 'flat') as 'flat' | 'percentage',
                depositValue: canonical.depositValue,
                depositAmount: canonical.depositRequired,
                depositRequired: canonical.depositRequired,
                depositNotes: canonical.depositNotes,
                depositPaid: canonical.depositPaid,
                depositPaidAmount: canonical.depositPaidAmount,
                displayFormat,
            },
            techRecommendations: recommendations || '',
            updatedAt: new Date().toISOString(),
            updatedById: currentUser?.id || currentUser?.uid || null,
            updatedByName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin'
        };

        return cleanUndefinedFields(previewJob);
    };

    const handleSave = async () => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            let updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for saving.");

            const editorName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Staff' : 'Staff';
            const { updatedDoc: jobWithArchivedSig, wasInvalidated, archivedVersion } = handleDocumentEditWithSignatureCheck(
                currentJob,
                editorName,
                'Invoice modified post-signature'
            );

            if (wasInvalidated) {
                updatedJob.invoiceSignature = null;
                updatedJob.invoiceSignedDate = null;
                updatedJob.signatureMetadata = null;
                updatedJob.signatureHistory = jobWithArchivedSig.signatureHistory;
                if (updatedJob.invoice) {
                    updatedJob.invoice.signatureUrl = null;
                    updatedJob.invoice.signatureMetadata = null;
                    updatedJob.invoice.signatureHistory = jobWithArchivedSig.signatureHistory;
                }
                showToast.info(`Invoice edited after signature. Previous signed version (v${archivedVersion}) was archived in audit history, and new draft requires re-signature.`);
            }

            await saveJobAndSyncInvoice(updatedJob);
            localStorage.removeItem(`draft_invoice_${jobId}`);
            showToast.success("Invoice saved successfully!");
            try {
                onClose();
            } catch (closeErr) {
                console.warn("onClose execution warning:", closeErr);
            }
        } catch (error: any) {
            console.error("Error saving invoice:", error);
            showToast.error(`Failed to save invoice: ${error?.message || "Unknown error"}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkPaid = async (paymentMethod?: string, proofUrl?: string, amount?: number, settleInFull: boolean = true) => {
        if (!currentJob) return;
        const total = totals.total;
        const currentPaid = currentJob.invoice.amountPaid || 0;
        const remaining = Math.max(0, total - currentPaid);
        const paymentAmount = amount !== undefined ? amount : remaining;

        const confirmMsg = settleInFull 
            ? `Mark as PAID and fully settled with a payment of $${paymentAmount.toFixed(2)}?`
            : `Log partial payment of $${paymentAmount.toFixed(2)}? (Remaining balance will be $${Math.max(0, remaining - paymentAmount).toFixed(2)})`;

        if (!await globalConfirm(confirmMsg)) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking paid.");

            const newAmountPaid = settleInFull 
                ? total 
                : parseFloat((currentPaid + paymentAmount).toFixed(2));
            
            updatedJob.invoice.amountPaid = newAmountPaid;

            if (newAmountPaid >= total) {
                updatedJob.invoice.status = 'Paid';
                updatedJob.invoice.paidDate = new Date().toISOString();
            } else {
                updatedJob.invoice.status = 'Partially Paid';
            }

            if (paymentMethod) {
                updatedJob.invoice.paymentMethod = paymentMethod;
            }
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }

            if (paymentMethod === 'Cash') {
                const amountToAdd = paymentAmount;
                if (amountToAdd > 0) {
                    const assignedUserId = updatedJob.assignedTechnicianId || currentUser?.id;
                    if (assignedUserId) {
                        try {
                             const { firebase } = await import('lib/firebase');
                             await db.collection('users').doc(assignedUserId).update(cleanUndefinedFields({
                                 cashBalance: firebase.firestore.FieldValue.increment(amountToAdd)
                             }));
                        } catch (e) {
                             console.warn("Cash logger error", e);
                        }
                    }
                }
            }

            if (updatedJob.invoice.membershipEnrollment && currentJob.customerId) {
                const enrollment = updatedJob.invoice.membershipEnrollment;
                const newId = 'm-' + Date.now();
                const agreement = {
                    id: newId,
                    organizationId: currentOrganization?.id || '',
                    customerId: currentJob.customerId,
                    customerName: currentJob.customerName,
                    planName: enrollment.planName,
                    price: enrollment.price,
                    billingCycle: enrollment.billingCycle,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + (enrollment.billingCycle === 'Annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'Active',
                    systemCount: enrollment.systemCount,
                    createdAt: new Date().toISOString()
                };
                try {
                    await db.collection('serviceAgreements').doc(newId).set(cleanUndefinedFields(agreement));
                } catch(e) { console.error("Error creating service agreement", e); }
            }

            await saveJobAndSyncInvoice(updatedJob);
            onClose();
        } catch (error) { console.error(error); } 
        finally { setIsSaving(false); }
    };

    const handleMarkUnpaid = async () => {
        if (!currentJob || !await globalConfirm("Revert to UNPAID?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking unpaid.");
            updatedJob.invoice.status = 'Unpaid';
            updatedJob.invoice.amountPaid = 0;
            updatedJob.invoice.paidDate = null; 
            updatedJob.invoice.paymentProofUrl = null;
            updatedJob.invoice.paymentProofDate = null;
            await saveJobAndSyncInvoice(updatedJob);
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleMarkPending = async (proofUrl?: string, paymentMethod?: string, amount?: number) => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not build updated job for marking pending.");
            updatedJob.invoice.status = 'Payment Pending';
            if (paymentMethod) updatedJob.invoice.paymentMethod = paymentMethod;
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }
            if (amount !== undefined) {
                updatedJob.invoice.amountPaid = amount;
            }
            await saveJobAndSyncInvoice(updatedJob);
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleAttachProof = async (proofUrl: string) => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for attaching proof.");
            updatedJob.invoice.paymentProofUrl = proofUrl;
            updatedJob.invoice.paymentProofDate = new Date().toISOString();
            await saveJobAndSyncInvoice(updatedJob);
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleSaveSignature = async (signature: string) => {
        if (!currentJob) return;
        try {
            const nowStr = new Date().toISOString();
            const signerName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Client' : 'Client';

            // 1. Upload signature image to Firebase Storage to eliminate Firestore 1MB document limit overflows
            let finalSignatureUrl = signature;
            if (signature && signature.startsWith('data:image')) {
                try {
                    const orgId = currentJob.organizationId || currentOrganization?.id || 'default';
                    const path = `organizations/${orgId}/jobs/${currentJob.id}/signatures/invoice_${Date.now()}.png`;
                    const storageUrl = await uploadFileToStorage(path, signature);
                    if (storageUrl) {
                        finalSignatureUrl = storageUrl;
                    }
                } catch (stErr) {
                    console.warn("Storage upload for invoice signature fallback:", stErr);
                }
            }

            const sigPackage = await createSignaturePackage(finalSignatureUrl, signerName, `Invoice #${currentJob.invoice?.id || currentJob.id}`, currentJob.id);

            const updatePayload: any = cleanUndefinedFields({
                invoiceSignature: finalSignatureUrl,
                invoiceSignedDate: nowStr,
                signatureMetadata: sigPackage,
                updatedAt: nowStr,
                updatedById: currentUser?.id || currentUser?.uid || null,
                updatedByName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin'
            });
            if (currentJob.invoice) {
                updatePayload.invoice = cleanUndefinedFields({
                    ...currentJob.invoice,
                    signatureUrl: finalSignatureUrl,
                    signatureMetadata: sigPackage
                });
            }
            await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(updatePayload));
            
            // 2. Synchronize currentJob with AppContext state immediately
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    ...currentJob,
                    ...updatePayload,
                    id: currentJob.id
                }
            });

            if (syncInvoiceWithLinked && currentJob.linkedJobIds && currentJob.linkedJobIds.length > 0) {
                const batch = db.batch();
                const linkedPayload = cleanUndefinedFields({
                    invoiceSignature: finalSignatureUrl,
                    invoiceSignedDate: nowStr,
                    signatureMetadata: sigPackage,
                    updatedAt: nowStr,
                    updatedById: currentUser?.id || currentUser?.uid || null,
                    updatedByName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin'
                });
                for (const id of currentJob.linkedJobIds) {
                    batch.update(db.collection('jobs').doc(id), cleanUndefinedFields(linkedPayload));
                }
                await batch.commit();
                
                for (const id of currentJob.linkedJobIds) {
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: {
                            id,
                            invoiceSignature: finalSignatureUrl,
                            invoiceSignedDate: nowStr
                        }
                    });
                }
            }

            setCurrentJob(prev => prev ? { 
                ...prev, 
                ...updatePayload, 
                invoiceSignature: finalSignatureUrl, 
                invoiceSignedDate: nowStr 
            } : null);
            setIsSigningOpen(false);
            showToast.success("Invoice signature saved successfully!");
        } catch (e) { 
            console.error("Error saving signature:", e);
            showToast.warn("Error saving signature."); 
        }
    };

    const handleSendInvoice = async (selectedEmails?: string[], attachPdf?: boolean) => {
        let emails = selectedEmails;
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob?.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob?.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob?.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob?.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        const isImpactCust = isImpactCustomer(
            { id: currentJob?.customerId, name: currentJob?.customerName },
            billToName
        );

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
        } else if (isImpactCust && !selectedEmails) {
            const impactDefaults = getImpactDefaultRecipients({
                locationName: currentJob?.locationName || (currentJob as any)?.serviceLocationName || (currentJob as any)?.siteLocationName || (currentJob as any)?.address,
                storeNumber: (currentJob as any)?.storeNumber,
                job: currentJob,
                isInvoice: true
            });
            emails = impactDefaults.defaultEmails;
        } else if (!emails) {
            let custData: any = null;
            if (currentJob?.customerId) {
                const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
                if (custDoc.exists) custData = custDoc.data();
            }

            const resolvedEmails: string[] = [];
            const activeLocId = currentJob?.locationId || (currentJob as any)?.serviceLocationId;

            // 1. Linked store POCs for any customer
            if (activeLocId && custData) {
                if (Array.isArray(custData.contacts)) {
                    custData.contacts.forEach((c: any) => {
                        if (c.email && (c.allowedLocationIds?.includes(activeLocId) || c.assignedLocationIds?.includes(activeLocId))) {
                            const em = c.email.toLowerCase();
                            if (!resolvedEmails.includes(em)) resolvedEmails.push(em);
                        }
                    });
                }
                const sLoc = (custData.serviceLocations || []).find((l: any) => l.id === activeLocId);
                if (sLoc) {
                    if (Array.isArray(sLoc.contacts)) {
                        sLoc.contacts.forEach((c: any) => {
                            if (c.email) {
                                const em = c.email.toLowerCase();
                                if (!resolvedEmails.includes(em)) resolvedEmails.push(em);
                            }
                        });
                    }
                    if (sLoc.accountManager?.email) {
                        const em = sLoc.accountManager.email.toLowerCase();
                        if (!resolvedEmails.includes(em)) resolvedEmails.push(em);
                    }
                }
            }

            // 2. Billing POC / customer email
            const billingEmail = custData?.billingContact?.email || custData?.email || currentJob?.customerEmail;
            if (billingEmail && !resolvedEmails.includes(billingEmail.toLowerCase())) {
                resolvedEmails.push(billingEmail.toLowerCase());
            }

            if (resolvedEmails.length === 0) {
                showToast.warn("Customer email missing. Please update the customer profile with a valid email address.");
                return;
            }
            emails = resolvedEmails;
        }

        if (!currentJob || (!selectedEmails && !await globalConfirm(`Send invoice #${currentJob.invoice.id} to ${emails.join(', ')}?`))) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");
            
            const sentAtDate = new Date().toISOString();
            if (updatedJob.invoice) {
                updatedJob.invoice.sentAt = sentAtDate;
            }

            await saveJobAndSyncInvoice(updatedJob);
            const link = `${getBaseUrl()}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';

            let pdfAttachments: any[] = [];
            if (attachPdf) {
                showToast.info("Generating invoice PDF attachment...");
                const invPdf = await generateInvoicePdfAttachment(updatedJob, currentOrganization);
                pdfAttachments.push(invPdf);
            }

            const fromDisplayName = `"${orgName.replace(/"/g, "'")}" <platform@tektrakker.com>`;
            const orgReplyEmail = currentOrganization?.email || currentUser?.email || 'Operations@tekairinc.com';

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: emails,
                from: fromDisplayName,
                replyTo: orgReplyEmail,
                message: {
                    from: fromDisplayName,
                    fromName: orgName,
                    subject: `Invoice #${updatedJob.invoice.id} from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;"><h2 style="color:#0f172a;margin-top:0;">Invoice Ready</h2><p style="font-size:15px;color:#334155;">Hi ${customerName},</p><p style="font-size:15px;color:#334155;">Your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> from <strong>${orgName}</strong> is ready for review.</p>${createEmailButtonHtml('View, Sign &amp; Pay Invoice', link, '#2563eb')}<p style="font-size:13px;color:#64748b;margin-top:20px;">Thank you for your business!</p></div>`,
                    text: `Invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is ready. Pay here: ${link}`,
                    replyTo: orgReplyEmail,
                    ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                },
                organizationId: currentOrganization?.id || currentJob.organizationId || null,
                type: 'Invoice',
                createdAt: new Date().toISOString()
            }));

            showToast.warn(`Invoice sent to ${emails.join(', ')}!`);
            onClose();
        } catch (e: any) { console.error("Error sending invoice:", e); showToast.error(`Error sending invoice: ${e?.message || 'Unknown error'}`); }
        finally { setIsSaving(false); }
    };

    const handleSendReceipt = async (selectedEmails?: string[]) => {
        let emails = selectedEmails;
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob?.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob?.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob?.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob?.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        const isImpactCust = isImpactCustomer(
            { id: currentJob?.customerId, name: currentJob?.customerName },
            billToName
        );

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
        } else if (isImpactCust && !selectedEmails) {
            const impactDefaults = getImpactDefaultRecipients({
                locationName: currentJob?.locationName || (currentJob as any)?.serviceLocationName || (currentJob as any)?.siteLocationName || (currentJob as any)?.address,
                storeNumber: (currentJob as any)?.storeNumber,
                job: currentJob,
                isInvoice: true
            });
            emails = impactDefaults.defaultEmails;
        } else if (!emails) {
            let email = currentJob?.customerEmail;
            if (!email && currentJob?.customerId) {
                const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
                if (custDoc.exists) email = custDoc.data()?.email;
            }
            if (!email) { showToast.warn("Customer email missing. Please update the customer profile with a valid email address."); return; }
            emails = [email];
        }

        if (!currentJob || (!selectedEmails && !await globalConfirm(`Send receipt for invoice #${currentJob.invoice.id} to ${emails.join(', ')}?`))) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare receipt for sending.");
            await saveJobAndSyncInvoice(updatedJob);
            const orgName = currentOrganization?.name || 'Service Provider';
            const fromDisplayName = `"${orgName.replace(/"/g, "'")}" <platform@tektrakker.com>`;
            const orgReplyEmail = currentOrganization?.email || currentUser?.email || 'Operations@tekairinc.com';

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: emails,
                from: fromDisplayName,
                replyTo: orgReplyEmail,
                message: {
                    from: fromDisplayName,
                    fromName: orgName,
                    subject: `Payment Receipt: Invoice #${updatedJob.invoice.id}`,
                    html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;"><h2 style="color:#059669;margin-top:0;">Payment Receipt</h2><p style="font-size:15px;color:#334155;">Hi ${customerName},</p><p style="font-size:15px;color:#334155;">Thank you for your payment of <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> to <strong>${orgName}</strong>.</p><div style="margin:20px 0;padding:16px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;"><p style="margin:4px 0;font-size:14px;color:#166534;"><strong>Invoice:</strong> #${updatedJob.invoice.id}</p><p style="margin:4px 0;font-size:14px;color:#166534;"><strong>Amount Paid:</strong> $${updatedJob.invoice.totalAmount?.toFixed(2)}</p><p style="margin:4px 0;font-size:14px;color:#166534;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p style="margin:4px 0;font-size:14px;color:#166534;"><strong>Status:</strong> PAID</p></div><p style="font-size:12px;color:#64748b;">This email serves as your official receipt. Please retain it for your records.</p></div>`,
                    text: `Payment Receipt for Invoice #${updatedJob.invoice.id}. Amount: $${updatedJob.invoice.totalAmount?.toFixed(2)}. Status: PAID.`,
                    replyTo: orgReplyEmail
                },
                organizationId: currentOrganization?.id || currentJob.organizationId || null,
                type: 'Receipt',
                createdAt: new Date().toISOString()
            }));
            showToast.warn(`Receipt sent to ${emails.join(', ')}!`);
        } catch (e: any) { console.error("Error sending receipt:", e); showToast.error(`Failed to send receipt: ${e?.message || 'Unknown error'}`); }
        finally { setIsSaving(false); }
    };

    const handleSendReminder = async (selectedEmails?: string[]) => {
        let emails = selectedEmails;
        let phone = currentJob?.customerPhone;
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob?.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob?.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob?.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob?.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        const isImpactCust = isImpactCustomer(
            { id: currentJob?.customerId, name: currentJob?.customerName },
            billToName
        );

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
        } else if (isImpactCust && !selectedEmails) {
            const impactDefaults = getImpactDefaultRecipients({
                locationName: currentJob?.locationName || (currentJob as any)?.serviceLocationName || (currentJob as any)?.siteLocationName || (currentJob as any)?.address,
                storeNumber: (currentJob as any)?.storeNumber,
                job: currentJob,
                isInvoice: true
            });
            emails = impactDefaults.defaultEmails;
        } else if (!emails) {
            let email = currentJob?.customerEmail;
            if (!email && currentJob?.customerId) {
                const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
                if (custDoc.exists) {
                    email = custDoc.data()?.email;
                    phone = custDoc.data()?.phone || phone;
                }
            }
            if (!email && !phone) { showToast.warn("Customer requires an email or phone number for reminders."); return; }
            emails = email ? [email] : [];
        }

        if (currentJob?.invoice?.remindersSent) {
            const alreadySentToday = currentJob.invoice.remindersSent.some((dateStr: string) => {
                try {
                    return new Date(dateStr).toLocaleDateString() === new Date().toLocaleDateString();
                } catch (e) {
                    return false;
                }
            });
            if (alreadySentToday) {
                if (!await globalConfirm("A reminder has already been sent to this customer today. Are you sure you want to send another one?")) {
                    return;
                } 
            }
        }

        const msgText = emails.length > 0 ? emails.join(', ') : 'this customer';
        if (!currentJob || (!selectedEmails && !await globalConfirm(`Send payment reminder for invoice #${currentJob.invoice.id} to ${msgText}?`))) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");
            const link = `${getBaseUrl()}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';
            const invTotal = Number(updatedJob.invoice.totalAmount) || Number(updatedJob.invoice.amount) || 0;
            
            const dueDateVal = updatedJob.invoice?.dueDate;
            const isLate = (() => {
                if (!dueDateVal) return false;
                const dueDateObj = new Date(dueDateVal);
                dueDateObj.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return today.getTime() > dueDateObj.getTime();
            })();

            const pastDueBanner = isLate ? `<div style="color:#dc2626;font-size:32px;font-weight:bold;margin-bottom:10px;text-align:left;border-bottom:2px solid #dc2626;padding-bottom:10px;">PAST DUE</div>` : '';

            const fromDisplayName = `"${orgName.replace(/"/g, "'")}" <platform@tektrakker.com>`;
            const orgReplyEmail = currentOrganization?.email || currentUser?.email || 'Operations@tekairinc.com';

            if (emails.length > 0) {
                await db.collection('mail_queue').add(cleanUndefinedFields({
                    to: emails,
                    from: fromDisplayName,
                    replyTo: orgReplyEmail,
                    message: {
                        from: fromDisplayName,
                        fromName: orgName,
                        subject: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${updatedJob.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #fee2e2;border-radius:12px;max-width:600px;margin:0 auto;background-color:#ffffff;">${pastDueBanner}<h2 style="color:#dc2626;margin-top:0;">Payment Reminder</h2><p style="font-size:15px;color:#334155;">Hi ${customerName},</p><p style="font-size:15px;color:#334155;">This is a friendly reminder that your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> from <strong>${orgName}</strong> is currently outstanding.</p>${createEmailButtonHtml('View &amp; Pay Invoice', link, '#dc2626')}<p style="font-size:13px;color:#64748b;margin-top:20px;">If you have already submitted payment, please disregard this notice.</p></div>`,
                        text: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${updatedJob.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`,
                        replyTo: orgReplyEmail
                    },
                    organizationId: currentOrganization?.id || currentJob.organizationId || null,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                }));
            }

            if (phone && !selectedEmails) {
                await db.collection('messages').add(cleanUndefinedFields({
                    to: phone,
                    body: `${isLate ? 'PAST DUE - ' : ''}Reminder from ${orgName}: Your invoice #${updatedJob.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: currentOrganization?.id || currentJob.organizationId || null,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                }));
            }

            // Record reminder date
            const reminderDate = new Date().toISOString();
            const currentReminders = updatedJob.invoice.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields({
                'invoice.remindersSent': newReminders
            }));
            if (currentJob.invoice) {
                currentJob.invoice.remindersSent = newReminders;
            }

            const sendModeText = emails.length > 0 ? 'email' : '';
            const smsText = (phone && !selectedEmails) ? 'SMS text' : '';
            showToast.warn(`Reminder sent via ${sendModeText} ${sendModeText && smsText ? 'and ' : ''}${smsText}!`);
            onClose();
        } catch (e) { console.error(e); showToast.warn("Error sending reminder."); }
        finally { setIsSaving(false); }
    };

    const handleUploadDocumentation = async (urls: string[]) => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const existingUrls = (currentJob as any).documentationUrls || [];
            const updatedUrls = [...existingUrls, ...urls];
            await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields({
                documentationUrls: updatedUrls,
                updatedAt: new Date().toISOString(),
                updatedById: currentUser?.id || currentUser?.uid || null,
                updatedByName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin'
            }));
            setCurrentJob(prev => prev ? { ...prev, documentationUrls: updatedUrls } : null);
            showToast.success("Documentation updated!");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to update documentation.");
        } finally {
            setIsSaving(false);
        }
    };

    const relevantProposals = useMemo(() => {
        if (!currentJob) return [];
        return state.proposals.filter(p => {
            if (p.jobId === currentJob.id) return true;
            
            const isSameCustomer = (currentJob.customerId && p.customerId === currentJob.customerId) || 
                                   (p.customerName && currentJob.customerName && p.customerName.toLowerCase() === currentJob.customerName.toLowerCase());
            
            if (!isSameCustomer) return false;
            
            // If both have locationId, require them to match to prevent cross-location mixups
            if (currentJob.locationId && p.locationId) {
                return p.locationId === currentJob.locationId;
            }
            return true;
        });
    }, [state.proposals, currentJob]);

    useEffect(() => {
        if (!jobId || !currentJob) return;

        const originalInvoice = currentJob.invoice;
        const hasChanges = (
            JSON.stringify(lineItems) !== JSON.stringify(originalInvoice?.items || []) ||
            customerName !== currentJob.customerName ||
            address !== formatAddress(currentJob.address) ||
            billToName !== ((originalInvoice as any)?.billToName || currentJob.customerName) ||
            billToAddress !== ((originalInvoice as any)?.billToAddress || formatAddress(currentJob.address)) ||
            workmanshipWarrantyMonths !== ((originalInvoice as any)?.workmanshipWarrantyMonths || 0) ||
            partsWarrantyMonths !== ((originalInvoice as any)?.partsWarrantyMonths || 0) ||
            warrantyNotes !== ((originalInvoice as any)?.warrantyNotes || '') ||
            warrantyDisclaimerAgreed !== ((originalInvoice as any)?.warrantyDisclaimerAgreed || false) ||
            JSON.stringify(membershipEnrollment) !== JSON.stringify((originalInvoice as any)?.membershipEnrollment || null) ||
            recommendations !== ((originalInvoice as any)?.recommendations || '') ||
            retainagePercent !== ((originalInvoice as any)?.retainagePercent || 0) ||
            additionalFeePercent !== (originalInvoice?.additionalFeePercent || 0) ||
            additionalFeeName !== (originalInvoice?.additionalFeeName || 'Processing Fee') ||
            invoiceDate !== (originalInvoice?.invoiceDate || '') ||
            dueDate !== (originalInvoice?.dueDate || '') ||
            paymentTerms !== (originalInvoice?.paymentTerms || 'net_30') ||
            depositType !== ((originalInvoice as any)?.depositType || (currentJob as any)?.depositType || 'flat') ||
            depositValue !== Number((originalInvoice as any)?.depositValue || (currentJob as any)?.depositValue || 0) ||
            depositNotes !== ((originalInvoice as any)?.depositNotes || (currentJob as any)?.depositNotes || '') ||
            depositPaid !== !!((originalInvoice as any)?.depositPaid || (currentJob as any)?.depositPaid) ||
            syncInvoiceWithLinked !== false
        );

        const draftKey = `draft_invoice_${jobId}`;
        if (hasChanges && !isSaving && !isSavedRef.current) {
            const draftData = {
                lineItems,
                customerName,
                address,
                billToName,
                billToAddress,
                workmanshipWarrantyMonths,
                partsWarrantyMonths,
                warrantyNotes,
                warrantyDisclaimerAgreed,
                membershipEnrollment,
                recommendations,
                additionalFeeName,
                additionalFeePercent,
                retainagePercent,
                invoiceDate,
                dueDate,
                paymentTerms,
                syncInvoiceWithLinked,
                depositType,
                depositValue,
                depositNotes,
                depositPaid
            };
            localStorage.setItem(draftKey, JSON.stringify(draftData));
        } else {
            localStorage.removeItem(draftKey);
        }
    }, [
        jobId,
        currentJob,
        lineItems,
        customerName,
        address,
        billToName,
        billToAddress,
        workmanshipWarrantyMonths,
        partsWarrantyMonths,
        warrantyNotes,
        warrantyDisclaimerAgreed,
        membershipEnrollment,
        recommendations,
        additionalFeeName,
        additionalFeePercent,
        retainagePercent,
        invoiceDate,
        dueDate,
        paymentTerms,
        syncInvoiceWithLinked
    ]);

    const handleMoveItem = (id: string, direction: 'up' | 'down') => {
        const index = lineItems.findIndex(i => i.id === id);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= lineItems.length) return;
        
        const updated = [...lineItems];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        setLineItems(updated);
    };

    return {
        currentJob,
        customer,
        customerName, setCustomerName,
        address, setAddress,
        billToName, setBillToName,
        billToAddress, setBillToAddress,
        lineItems, setLineItems,
        handleAddItem, handleUpdateItem, handleDeleteItem, handleMoveItem,
        handleAddSubItem, handleUpdateSubItem, handleDeleteSubItem,
        totals,
        taxRate, setTaxRate,
        isSaving, setIsSaving,
        handleSave,
        handleMarkPaid,
        handleMarkUnpaid,
        handleMarkPending,
        handleAttachProof,
        handleSendInvoice,
        handleSendReceipt,
        handleSendReminder,
        handleUploadDocumentation,
        getPreviewJob,
        handleSaveSignature,
        sigPadRef,
        isPreviewOpen, setIsPreviewOpen,
        isSigningOpen, setIsSigningOpen,
        isDiscountModalOpen, setIsDiscountModalOpen,
        discountConfig, setDiscountConfig,
        handleManualDiscount,
        isImportProposalModalOpen, setIsImportProposalModalOpen,
        selectedProposalId, setSelectedProposalId,
        handleImportFromProposal,
        relevantProposals,
        overrideOrg,
        // Warranty
        workmanshipWarrantyMonths, setWorkmanshipWarrantyMonths,
        partsWarrantyMonths, setPartsWarrantyMonths,
        warrantyNotes, setWarrantyNotes,
        warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed,
        membershipEnrollment, setMembershipEnrollment,
        recommendations, setRecommendations,
        handleImportJobRecommendations,
        additionalFeePercent, setAdditionalFeePercent,
        additionalFeeName, setAdditionalFeeName,
        retainagePercent, setRetainagePercent,
        invoiceDate, setInvoiceDate,
        dueDate, setDueDate,
        paymentTerms, setPaymentTerms,
        displayFormat, setDisplayFormat,
        linkedJobs,
        syncInvoiceWithLinked, setSyncInvoiceWithLinked,
        handleImportFromLinkedJobs,
        requireDeposit, setRequireDeposit,
        depositType, setDepositType,
        depositValue, setDepositValue,
        depositNotes, setDepositNotes,
        depositPaid, setDepositPaid,
        depositAmount: totals.depositAmount
    };
};
