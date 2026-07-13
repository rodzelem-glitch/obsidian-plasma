import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Job, InvoiceLineItem, Organization, Customer } from 'types';
import { SignaturePadHandle } from 'components/ui/SignaturePad';
import { formatAddress } from 'lib/utils';
import { globalConfirm } from "lib/globalConfirm";
import { getNextInvoiceNumber } from 'lib/numbering';

export const sanitizeMcAlistersInvoice = (
    jobObj: any,
    itemsList: InvoiceLineItem[],
    currentBillToName: string,
    isTekAir: boolean,
    isMcAlisters: boolean
) => {
    if (!isTekAir || !isMcAlisters) {
        return {
            items: itemsList,
            billToName: currentBillToName,
            customerName: jobObj?.customerName || '',
            address: jobObj ? formatAddress(jobObj.address) : '',
            billToAddress: jobObj?.invoice?.billToAddress || (jobObj ? formatAddress(jobObj.address) : '')
        };
    }

    // 1. Identify disallowed items
    const disallowedKeywords = ['trip', 'fuel', 'apprentice', 'overtime', 'premium', 'shipping'];
    
    const disallowedItems = itemsList.filter(item => {
        const desc = (item.description || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const typeLower = (item.type || '').toLowerCase();
        return typeLower === 'fee' && (desc.includes('trip') || name.includes('trip') || desc.includes('travel') || name.includes('travel'))
            || disallowedKeywords.some(keyword => desc.includes(keyword) || name.includes(keyword));
    });

    const allowedItems = itemsList.filter(item => !disallowedItems.includes(item));
    
    // Group disallowed totals by taxability to keep total/tax exactly the same
    const taxableDisallowedSum = disallowedItems.filter(i => i.taxable !== false).reduce((sum, i) => sum + (i.total || (i.quantity * i.unitPrice) || 0), 0);
    const nonTaxableDisallowedSum = disallowedItems.filter(i => i.taxable === false).reduce((sum, i) => sum + (i.total || (i.quantity * i.unitPrice) || 0), 0);

    let updatedItems = allowedItems.map(i => ({ ...i }));

    // Distribute taxable disallowed sum
    if (taxableDisallowedSum > 0) {
        const targetIdx = updatedItems.findIndex(item => item.taxable !== false && item.type !== 'Discount');
        if (targetIdx !== -1) {
            const target = updatedItems[targetIdx];
            const qty = target.quantity || 1;
            const share = taxableDisallowedSum / qty;
            const shareCents = share * 100;
            const isExact = Math.abs(shareCents - Math.round(shareCents)) < 1e-9;
            
            if (isExact) {
                const roundedShare = Number(share.toFixed(2));
                target.unitPrice = Number((target.unitPrice + roundedShare).toFixed(2));
                target.total = Number((qty * target.unitPrice).toFixed(2));
                const note = `[Incorporated charges of $${taxableDisallowedSum.toFixed(2)}]`;
                if (!target.description?.includes(note)) {
                    target.description = target.description ? `${target.description}\n${note}` : note;
                }
            } else {
                // To prevent rounding errors, append a new taxable allowed item with quantity 1
                updatedItems.push({
                    id: `incorporated-taxable-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
                    name: 'Service Charge',
                    description: `HVAC service and diagnostic charge. [Incorporated charges of $${taxableDisallowedSum.toFixed(2)}]`,
                    quantity: 1,
                    unitPrice: taxableDisallowedSum,
                    total: taxableDisallowedSum,
                    type: 'Service',
                    taxable: true
                });
            }
        } else {
            // Create a taxable allowed item
            updatedItems.push({
                id: `incorporated-taxable-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
                name: 'Service Charge',
                description: `HVAC service and diagnostic charge. [Incorporated charges of $${taxableDisallowedSum.toFixed(2)}]`,
                quantity: 1,
                unitPrice: taxableDisallowedSum,
                total: taxableDisallowedSum,
                type: 'Service',
                taxable: true
            });
        }
    }

    // Distribute non-taxable disallowed sum
    if (nonTaxableDisallowedSum > 0) {
        const targetIdx = updatedItems.findIndex(item => item.taxable === false && item.type !== 'Discount');
        if (targetIdx !== -1) {
            const target = updatedItems[targetIdx];
            const qty = target.quantity || 1;
            const share = nonTaxableDisallowedSum / qty;
            const shareCents = share * 100;
            const isExact = Math.abs(shareCents - Math.round(shareCents)) < 1e-9;
            
            if (isExact) {
                const roundedShare = Number(share.toFixed(2));
                target.unitPrice = Number((target.unitPrice + roundedShare).toFixed(2));
                target.total = Number((qty * target.unitPrice).toFixed(2));
                const note = `[Incorporated charges of $${nonTaxableDisallowedSum.toFixed(2)}]`;
                if (!target.description?.includes(note)) {
                    target.description = target.description ? `${target.description}\n${note}` : note;
                }
            } else {
                // To prevent rounding errors, append a new non-taxable allowed item with quantity 1
                updatedItems.push({
                    id: `incorporated-nontaxable-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
                    name: 'Labor Charge',
                    description: `HVAC labor charge. [Incorporated charges of $${nonTaxableDisallowedSum.toFixed(2)}]`,
                    quantity: 1,
                    unitPrice: nonTaxableDisallowedSum,
                    total: nonTaxableDisallowedSum,
                    type: 'Labor',
                    taxable: false
                });
            }
        } else {
            // Create a non-taxable allowed item
            updatedItems.push({
                id: `incorporated-nontaxable-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
                name: 'Labor Charge',
                description: `HVAC labor charge. [Incorporated charges of $${nonTaxableDisallowedSum.toFixed(2)}]`,
                quantity: 1,
                unitPrice: nonTaxableDisallowedSum,
                total: nonTaxableDisallowedSum,
                type: 'Labor',
                taxable: false
            });
        }
    }

    // Add detailed service description with arrival/departure times to the first labor/service item
    const checkIn = jobObj.checkInTime || jobObj.appointmentTime || new Date().toISOString();
    const checkOut = jobObj.checkOutTime || new Date(new Date(checkIn).getTime() + 2 * 3600 * 1000).toISOString();
    const checkInStr = new Date(checkIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const checkOutStr = new Date(checkOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const dateStr = new Date(checkIn).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const timeLogNote = `Service Visit Date: ${dateStr} | Arrival: ${checkInStr} | Departure: ${checkOutStr}`;

    let laborServiceIdx = updatedItems.findIndex(item => item.type === 'Labor' || item.type === 'Service');
    if (laborServiceIdx !== -1) {
        const item = updatedItems[laborServiceIdx];
        if (!item.description?.includes('Arrival:')) {
            item.description = item.description ? `${item.description}\n${timeLogNote}` : timeLogNote;
        }
    }

    let storeNumber = jobObj.locationName || '';
    const nameStr = (jobObj.locationName || jobObj.customerName || '').toLowerCase();
    const addrStr = (formatAddress(jobObj.address) || jobObj.invoice?.billToAddress || '').toLowerCase();
    const idStr = (jobObj.id || '').toLowerCase();
    const parentIdStr = (jobObj.parentJobId || '').toLowerCase();
    const specInstructions = (jobObj.specialInstructions || '').toLowerCase();

    if (!storeNumber) {
        if (nameStr.includes('1404') || addrStr.includes('pat booker') || addrStr.includes('8121') || idStr.includes('127557') || parentIdStr.includes('127557') || specInstructions.includes('127557')) {
            storeNumber = '1404';
        } else if (nameStr.includes('1386') || addrStr.includes('military hwy') || addrStr.includes('16820')) {
            storeNumber = '1386';
        } else if (nameStr.includes('103139') || addrStr.includes('fm 78') || addrStr.includes('8540')) {
            storeNumber = '103139';
        } else if (nameStr.includes('101075') || addrStr.includes('se military') || addrStr.includes('2314')) {
            storeNumber = '101075';
        } else if (nameStr.includes('103135') || addrStr.includes('loop 1604') || addrStr.includes('7010')) {
            storeNumber = '103135';
        }
    }

    // Check assets in unitStates
    if (!storeNumber && jobObj.unitStates && jobObj.unitStates.length > 0) {
        for (const u of jobObj.unitStates) {
            const assetId = u.assetId || '';
            if (assetId.includes('1781049548128') || assetId.includes('1781049905036') || assetId.includes('1781064483880') || assetId.includes('1781064750798')) {
                storeNumber = '1404';
                break;
            } else if (assetId.includes('1780185429101')) {
                storeNumber = '101075';
                break;
            }
        }
    }

    const storeMap: { [key: string]: { name: string, address: string } } = {
        '1404': { name: 'McAlisters Deli #1404', address: '8121 Pat Booker Rd, Live Oak, TX 78233' },
        '1386': { name: 'McAlisters Deli #1386', address: '16820 NM Military Hwy, Shavano Park, TX 78231' },
        '103139': { name: 'McAlisters Deli #103139', address: '8540 FM 78, Converse, TX 78109' },
        '101075': { name: 'McAlisters Deli #101075', address: '2314 SE Military Dr, San Antonio, TX 78223' },
        '103135': { name: 'McAlisters Deli #103135', address: '7010 W. Loop 1604 N., San Antonio, TX 78254' }
    };

    const serviceLocationName = storeNumber && storeMap[storeNumber]
        ? storeMap[storeNumber].name
        : 'McAlisters Deli';

    const serviceLocationAddress = storeNumber && storeMap[storeNumber]
        ? storeMap[storeNumber].address
        : (typeof jobObj.address === 'string' && !jobObj.address.includes('Johnson') ? jobObj.address : '8121 Pat Booker Rd, Live Oak, TX 78233');

    return {
        items: updatedItems,
        billToName: 'Best Choice Florida, LLC',
        customerName: serviceLocationName,
        address: serviceLocationAddress,
        billToAddress: '4515 Lyndon B. Johnson Freeway, Dallas, TX 75244'
    };
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
                                await db.collection('jobs').doc(job.id).update({ invoice });
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
                                const nextInvId = await getNextInvoiceNumber(orgId);
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
                        job.invoice = invoice;
                    }
                }

                setCurrentJob(job);
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
                setTaxRate(job.invoice?.taxRate ? job.invoice.taxRate * 100 : (currentOrganization?.taxRate || 8.25));
                setCustomerName(sanitized.customerName || job.customerName);
                setAddress(sanitized.address || formatAddress(job.address));
                
                // Load split billing / warranty fields
                setBillToName(sanitized.billToName);
                setBillToAddress(sanitized.billToAddress || (job.invoice as any)?.billToAddress || formatAddress(job.address));
                setWorkmanshipWarrantyMonths((job.invoice as any)?.workmanshipWarrantyMonths || 0);
                setPartsWarrantyMonths((job.invoice as any)?.partsWarrantyMonths || 0);
                setWarrantyNotes((job.invoice as any)?.warrantyNotes || '');
                setWarrantyDisclaimerAgreed((job.invoice as any)?.warrantyDisclaimerAgreed || false);
                setMembershipEnrollment((job.invoice as any)?.membershipEnrollment || null);
                setRecommendations((job.invoice as any)?.recommendations || '');
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
                setImportedProposalId(job.proposalId || job.invoice?.proposalId || null);

                const defaultInvoiceDate = invoice?.invoiceDate || invoice?.date || (job.appointmentTime ? new Date(job.appointmentTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                const defaultDueDate = invoice?.dueDate || (invoice?.invoiceDate || invoice?.date 
                    ? new Date(new Date(invoice?.invoiceDate || invoice?.date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : new Date(new Date(defaultInvoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                setInvoiceDate(defaultInvoiceDate);
                setDueDate(defaultDueDate);

                if (job.customerId) {
                    db.collection('customers').doc(job.customerId).get().then(doc => {
                        if (doc.exists) {
                            const cust = { ...doc.data(), id: doc.id } as Customer;
                            setCustomer(cust);
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

                if (job.linkedJobIds && job.linkedJobIds.length > 0) {
                    try {
                        const fetchedJobs: Job[] = [];
                        for (const id of job.linkedJobIds) {
                            const doc = await db.collection('jobs').doc(id).get();
                            if (doc.exists) {
                                fetchedJobs.push({ ...doc.data(), id: doc.id } as Job);
                            }
                        }
                        setLinkedJobs(fetchedJobs);
                    } catch (err) {
                        console.error("Failed to load linked jobs for invoicing", err);
                    }
                } else {
                    setLinkedJobs([]);
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
                setSyncInvoiceWithLinked(true);
            }
        } else {
            setSyncInvoiceWithLinked(false);
        }
    }, [linkedJobs, currentJob?.invoice?.id]);

    useEffect(() => {
        const baseSubtotal = lineItems
            .filter(item => item.type !== 'Discount' && item.type !== 'Fee')
            .reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

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
        const subtotal = itemsToUse.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxableAmount = itemsToUse.filter(i => i.taxable !== false).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = taxableAmount * (taxRate / 100);
        let total = subtotal + tax;

        const additionalFeeAmount = additionalFeePercent ? (total * (additionalFeePercent / 100)) : 0;
        total += additionalFeeAmount;
        return { 
            subtotal: parseFloat(subtotal.toFixed(2)), 
            tax: parseFloat(tax.toFixed(2)), 
            total: parseFloat(total.toFixed(2)), 
            additionalFeeAmount: parseFloat(additionalFeeAmount.toFixed(2)) 
        };
    }, [sanitizedItemsAndBillTo.items, taxRate, additionalFeePercent]);

    const handleAddItem = (
        type: InvoiceLineItem['type'] = 'Labor', 
        description: string = '', 
        unitPrice: number = 0, 
        taxable: boolean = true
    ) => {
        const randomIdSuffix = Math.floor(Math.random() * 1000000);
        const newItem: InvoiceLineItem = { 
            id: `item-${Date.now()}-${randomIdSuffix}`, 
            name: 'New Item', 
            description, 
            quantity: 1, 
            unitPrice, 
            total: unitPrice, 
            type, 
            taxable 
        };
        setLineItems(prev => [...prev, newItem]);
    };

    const handleUpdateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
        setLineItems(items => items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'type') {
                    if (value === 'Discount') {
                        updated.unitPrice = -Math.abs(updated.unitPrice || 0);
                        updated.taxable = false;
                    } else {
                        updated.unitPrice = Math.abs(updated.unitPrice || 0);
                        updated.taxable = value === 'Part';
                    }
                }
                if (field === 'unitPrice') {
                    if (updated.type === 'Discount') {
                        updated.unitPrice = -Math.abs(value || 0);
                    } else {
                        updated.unitPrice = value;
                    }
                }
                if (field === 'unitPrice' || field === 'quantity' || field === 'type') {
                    updated.total = updated.quantity * updated.unitPrice; 
                }
                return updated;
            }
            return item;
        }));
    };

    const handleDeleteItem = (id: string) => {
        setLineItems(items => items.filter(i => i.id !== id));
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
            const laborItems = (proposal.laborItems || []).map(item => ({
                id: `prop-labor-${item.id || Math.random()}-${Date.now()}`,
                name: `${item.unitName || 'Labor'} - Hours`,
                description: item.scope || `Labor hours for unit: ${item.unitName}`,
                quantity: item.hours || 1,
                unitPrice: item.rate || 0,
                total: item.value || ((item.rate || 0) * (item.hours || 1)),
                type: 'Labor' as const,
                taxable: false
            }));

            const partItems = (proposal.partItems || []).map(item => ({
                id: `prop-part-${item.id || Math.random()}-${Date.now()}`,
                name: item.partName || 'Part',
                description: `Part for unit: ${item.unitName}`,
                quantity: item.quantity || 1,
                unitPrice: item.customerUnitPrice || 0,
                total: item.customerLineTotal || ((item.customerUnitPrice || 0) * (item.quantity || 1)),
                type: 'Part' as const,
                taxable: true
            }));

            const allowanceItems = (proposal.allowanceItems || []).map(item => ({
                id: `prop-allowance-${item.id || Math.random()}-${Date.now()}`,
                name: item.description || 'Allowance',
                description: `Scope basis: ${item.basis}`,
                quantity: 1,
                unitPrice: item.amount || 0,
                total: item.amount || 0,
                type: 'Fee' as const,
                taxable: true
            }));

            newItems = [...laborItems, ...partItems, ...allowanceItems];
        } else {
            let itemsToImport = proposal.items || [];
            if (proposal.selectedOption && proposal.selectedOption !== 'None') {
                itemsToImport = itemsToImport.filter(item => !item.tier || item.tier === proposal.selectedOption);
            }
            newItems = itemsToImport.map(pItem => ({
                id: `prop-${pItem.id}-${Date.now()}`,
                name: pItem.name || 'Proposal Item',
                description: pItem.description || '',
                quantity: pItem.quantity,
                unitPrice: pItem.price,
                total: pItem.total,
                type: pItem.type as any,
                taxable: true 
            }));
        }

        setLineItems(prev => [...prev, ...newItems]);
        setImportedProposalId(proposalId);

        // Defer writing proposal link in Firestore until actual save/pay action.

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

    const saveJobAndSyncInvoice = async (updatedJob: Job) => {
        if (!currentJob) return;
        await db.collection('jobs').doc(currentJob.id).update(updatedJob);
        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        
        // Save the proposal linking to Firestore and local state if we imported one
        if (importedProposalId) {
            const proposal = state.proposals.find(p => p.id === importedProposalId);
            if (proposal) {
                const invoiceId = updatedJob.invoice?.id || null;
                const poNum = updatedJob.poNumber || null;
                try {
                    await db.collection('proposals').doc(importedProposalId).update({
                        invoiceId: invoiceId,
                        jobId: currentJob.id || null,
                        poNumber: poNum
                    });
                    dispatch({
                        type: 'UPDATE_PROPOSAL',
                        payload: {
                            ...proposal,
                            invoiceId: invoiceId,
                            jobId: currentJob.id || null,
                            poNumber: poNum
                        }
                    });
                } catch (error) {
                    console.error("Error linking proposal to invoice/job in saveJobAndSyncInvoice:", error);
                }
            }
        }

        if (syncInvoiceWithLinked && currentJob.linkedJobIds && currentJob.linkedJobIds.length > 0) {
            const batch = db.batch();
            for (const id of currentJob.linkedJobIds) {
                batch.update(db.collection('jobs').doc(id), {
                    invoice: updatedJob.invoice,
                    invoiceSignature: updatedJob.invoiceSignature || null,
                    invoiceSignedDate: updatedJob.invoiceSignedDate || null,
                    updatedAt: new Date().toISOString(),
                    updatedById: currentUser?.id,
                    updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
                });
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
        const subtotal = sanitized.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxableAmount = sanitized.items.filter(i => i.taxable !== false).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = taxableAmount * (taxRate / 100);
        let total = subtotal + tax;
        const additionalFeeAmount = additionalFeePercent ? (total * (additionalFeePercent / 100)) : 0;
        total += additionalFeeAmount;

        return {
            ...currentJob,
            customerName,
            address,
            proposalId: importedProposalId || currentJob.proposalId || null,
            invoice: {
                ...currentJob.invoice,
                proposalId: importedProposalId || currentJob.invoice?.proposalId || currentJob.proposalId || null,
                items: sanitized.items,
                subtotal: parseFloat(subtotal.toFixed(2)),
                taxRate: taxRate / 100,
                taxAmount: parseFloat(tax.toFixed(2)),
                totalAmount: parseFloat(total.toFixed(2)),
                amount: parseFloat(total.toFixed(2)),
                billToName: sanitized.billToName,
                billToAddress,
                workmanshipWarrantyMonths,
                partsWarrantyMonths,
                warrantyNotes,
                warrantyDisclaimerAgreed,
                warrantyIssuedDate: (currentJob.invoice as any)?.warrantyIssuedDate || (workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0 ? new Date().toISOString() : null),
                membershipEnrollment: membershipEnrollment || null,
                recommendations: recommendations || '',
                additionalFeePercent,
                additionalFeeName,
                additionalFeeAmount: parseFloat(additionalFeeAmount.toFixed(2)),
                retainagePercent,
                invoiceDate,
                date: invoiceDate,
                dueDate,
            },
            updatedAt: new Date().toISOString(),
            updatedById: currentUser?.id,
            updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
        };
    };

    const handleSave = async () => {
        if (!currentJob) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for saving.");
            await saveJobAndSyncInvoice(updatedJob);
            onClose();
        } catch (error) { console.error(error); showToast.warn("Failed to save."); } 
        finally { setIsSaving(false); }
    };

    const handleMarkPaid = async (paymentMethod?: string, proofUrl?: string) => {
        if (!currentJob || !await globalConfirm("Mark as PAID?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking paid.");
            updatedJob.invoice.status = 'Paid';
            updatedJob.invoice.paidDate = new Date().toISOString();
            if (paymentMethod) {
                updatedJob.invoice.paymentMethod = paymentMethod;
            }
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }

            if (paymentMethod === 'Cash') {
                const amountToAdd = updatedJob.invoice.totalAmount || 0;
                if (amountToAdd > 0) {
                    const assignedUserId = updatedJob.assignedTechnicianId || currentUser?.id;
                    if (assignedUserId) {
                        try {
                             const { firebase } = await import('lib/firebase');
                             await db.collection('users').doc(assignedUserId).update({
                                 cashBalance: firebase.firestore.FieldValue.increment(amountToAdd)
                             });
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
                    await db.collection('serviceAgreements').doc(newId).set(agreement);
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
            updatedJob.invoice.paidDate = null; 
            updatedJob.invoice.paymentProofUrl = null;
            updatedJob.invoice.paymentProofDate = null;
            await saveJobAndSyncInvoice(updatedJob);
            onClose();
        } catch(e) { console.error(e) }
        finally { setIsSaving(false); }
    };

    const handleMarkPending = async (proofUrl?: string, paymentMethod?: string) => {
        if (!currentJob || !await globalConfirm("Mark as PENDING (Payment verifying/clearing)?")) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob(); 
            if (!updatedJob) throw new Error("Could not build updated job for marking pending.");
            updatedJob.invoice.status = 'Pending';
            if (proofUrl) {
                updatedJob.invoice.paymentProofUrl = proofUrl;
                updatedJob.invoice.paymentProofDate = new Date().toISOString();
            }
            if (paymentMethod) {
                updatedJob.invoice.paymentMethod = paymentMethod;
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
            const updatePayload: any = {
                invoiceSignature: signature,
                invoiceSignedDate: nowStr,
                updatedAt: nowStr,
                updatedById: currentUser?.id,
                updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
            };
            if (currentJob.invoice) {
                updatePayload.invoice = currentJob.invoice;
            }
            await db.collection('jobs').doc(currentJob.id).update(updatePayload);
            
            if (syncInvoiceWithLinked && currentJob.linkedJobIds && currentJob.linkedJobIds.length > 0) {
                const batch = db.batch();
                for (const id of currentJob.linkedJobIds) {
                    batch.update(db.collection('jobs').doc(id), {
                        invoiceSignature: signature,
                        invoiceSignedDate: nowStr,
                        updatedAt: nowStr,
                        updatedById: currentUser?.id,
                        updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
                    });
                }
                await batch.commit();
                
                for (const id of currentJob.linkedJobIds) {
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: {
                            id,
                            invoiceSignature: signature,
                            invoiceSignedDate: nowStr
                        }
                    });
                }
            }

            setCurrentJob(prev => prev ? { ...prev, invoiceSignature: signature, invoiceSignedDate: nowStr } : null);
            setIsSigningOpen(false);
        } catch (e) { showToast.warn("Error saving signature."); }
    };

    const handleSendInvoice = async (selectedEmails?: string[]) => {
        let emails = selectedEmails;
        const isTekAirOrg = currentOrganization?.id === 'org-1765817997819' || 
                            currentOrganization?.name?.toLowerCase().includes('tekair') || 
                            currentJob?.organizationId === 'org-1765817997819';
        
        const isMcAlistersCust = currentJob?.customerName?.toLowerCase().includes('mcalister') || 
                                 currentJob?.customerName?.toLowerCase().includes('best choice') ||
                                 billToName?.toLowerCase().includes('best choice') ||
                                 currentJob?.customerName === 'Best Choice Florida, LLC' ||
                                 billToName === 'Best Choice Florida, LLC';

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
        } else if (!emails) {
            let email = currentJob?.customerEmail;
            if (!email && currentJob?.customerId) {
                const custDoc = await db.collection('customers').doc(currentJob.customerId).get();
                if (custDoc.exists) email = custDoc.data()?.email;
            }
            if (!email) { showToast.warn("Customer email missing. Please update the customer profile with a valid email address."); return; }
            emails = [email];
        }

        if (!currentJob || (!selectedEmails && !await globalConfirm(`Send invoice #${currentJob.invoice.id} to ${emails.join(', ')}?`))) return;
        setIsSaving(true);
        try {
            const updatedJob = getPreviewJob();
            if (!updatedJob) throw new Error("Could not prepare invoice for sending.");
            await saveJobAndSyncInvoice(updatedJob);
            const link = `${getBaseUrl()}/#/invoice/${currentJob.id}`;
            const orgName = currentOrganization?.name || 'Service Provider';
            await db.collection('mail_queue').add({
                to: emails,
                replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Invoice #${updatedJob.invoice.id} from ${orgName}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#0284c7;">Invoice Ready</h2><p>Hi ${customerName},</p><p>Your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> is ready for review.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View, Sign &amp; Pay</a></div><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                    text: `Invoice #${updatedJob.invoice.id} for $${updatedJob.invoice.totalAmount?.toFixed(2)} is ready. Pay here: ${link}`,
                    replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: currentOrganization?.id,
                type: 'Invoice',
                createdAt: new Date().toISOString()
            });
            
            // Record initial invoice sent date
            const sentAtDate = new Date().toISOString();
            await db.collection('jobs').doc(currentJob.id).update({
                'invoice.sentAt': sentAtDate
            });
            if (currentJob.invoice) {
                currentJob.invoice.sentAt = sentAtDate;
            }

            showToast.warn(`Invoice sent to ${emails.join(', ')}!`);
            onClose();
        } catch (e) { console.error(e); showToast.warn("Error sending invoice."); }
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

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
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
            await db.collection('mail_queue').add({
                to: emails,
                replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Payment Receipt: Invoice #${updatedJob.invoice.id}`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#059669;">Payment Receipt</h2><p>Hi ${customerName},</p><p>Thank you for your payment of <strong>$${updatedJob.invoice.totalAmount?.toFixed(2)}</strong> to <strong>${orgName}</strong>.</p><div style="margin:20px 0;"><p style="margin:5px 0;"><strong>Invoice:</strong> #${updatedJob.invoice.id}</p><p style="margin:5px 0;"><strong>Amount Paid:</strong> $${updatedJob.invoice.totalAmount?.toFixed(2)}</p><p style="margin:5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p style="margin:5px 0;"><strong>Status:</strong> PAID</p></div><p style="font-size:12px;color:#666;">This email serves as your official receipt. Please retain it for your records.</p></div>`,
                    text: `Payment Receipt for Invoice #${updatedJob.invoice.id}. Amount: $${updatedJob.invoice.totalAmount?.toFixed(2)}. Status: PAID.`,
                    replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: currentOrganization?.id,
                type: 'Receipt',
                createdAt: new Date().toISOString()
            });
            showToast.warn(`Receipt sent to ${emails.join(', ')}!`);
        } catch (e) { console.error(e); showToast.warn("Failed to send receipt."); }
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

        if (isTekAirOrg && isMcAlistersCust && !selectedEmails) {
            emails = ['Mcalistersflapsun@onepayinvoices.com'];
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

            if (emails.length > 0) {
                await db.collection('mail_queue').add({
                    to: emails,
                    replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com',
                    message: {
                        subject: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${updatedJob.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;">${pastDueBanner}<h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${customerName},</p><p>This is a friendly reminder that your invoice <strong>#${updatedJob.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                        text: `${isLate ? 'PAST DUE: ' : ''}Reminder: Invoice #${updatedJob.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`,
                        replyTo: currentOrganization?.email || currentUser?.email || 'noreply@tektrakker.com'
                    },
                    organizationId: currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                });
            }

            if (phone && !selectedEmails) {
                await db.collection('messages').add({
                    to: phone,
                    body: `${isLate ? 'PAST DUE - ' : ''}Reminder from ${orgName}: Your invoice #${updatedJob.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: currentOrganization?.id,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                });
            }

            // Record reminder date
            const reminderDate = new Date().toISOString();
            const currentReminders = updatedJob.invoice.remindersSent || [];
            const newReminders = [...currentReminders, reminderDate];
            await db.collection('jobs').doc(currentJob.id).update({
                'invoice.remindersSent': newReminders
            });
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
            await db.collection('jobs').doc(currentJob.id).update({
                documentationUrls: updatedUrls,
                updatedAt: new Date().toISOString(),
                updatedById: currentUser?.id,
                updatedByName: `${currentUser?.firstName} ${currentUser?.lastName}`
            });
            setCurrentJob(prev => prev ? { ...prev, documentationUrls: updatedUrls } : null);
            showToast.warn("Documentation updated!");
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to update documentation.");
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

    return {
        currentJob,
        customer,
        customerName, setCustomerName,
        address, setAddress,
        billToName, setBillToName,
        billToAddress, setBillToAddress,
        lineItems, setLineItems,
        handleAddItem, handleUpdateItem, handleDeleteItem,
        totals,
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
        additionalFeePercent, setAdditionalFeePercent,
        additionalFeeName, setAdditionalFeeName,
        retainagePercent, setRetainagePercent,
        invoiceDate, setInvoiceDate,
        dueDate, setDueDate,
        linkedJobs,
        syncInvoiceWithLinked, setSyncInvoiceWithLinked,
        handleImportFromLinkedJobs,
    };
};
