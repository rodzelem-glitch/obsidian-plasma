import { cleanUndefinedFields } from '../lib/utils';
import showToast from "lib/toast";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import type { Job, Organization, PlatformSettings } from 'types';
import Card from 'components/ui/Card';
import { Printer, CheckCircle, FileText, Lock, ShieldCheck, Building2, User, MapPin, Clock, Calendar, Download, Wrench, Cpu, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import Button from 'components/ui/Button';
const DocumentPreview = React.lazy(() => import('components/ui/DocumentPreview'));
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { KortPaymentForm } from 'components/payment/KortPaymentForm';
import { PaymentInstructionsCard } from 'components/payment/PaymentInstructionsCard';
import { SiteSealEmbed } from 'components/payment/SiteSealEmbed';
import { fetchLinkedClusterForJob, AggregatedLinkedCluster } from 'lib/linkedJobsHelper';
import { computeCanonicalFinancials, roundCurrency, formatCurrency, getCanonicalPaymentTermsLabel } from 'lib/financialCalculator';
import { getJobServicedEquipment } from 'lib/pdfHelper';

const roundTo2Decimals = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export interface CustomerPaymentProps {
  jobId?: string;
  jobData?: Job;
  orgData?: Organization;
  embedded?: boolean;
}

const CustomerPayment: React.FC<CustomerPaymentProps> = ({
  jobId: propJobId,
  jobData: propJobData,
  orgData: propOrgData,
  embedded = false
}) => {
  const { jobId: routeJobId, paymentRequestId, id: routeId } = useParams<{ jobId?: string; paymentRequestId?: string; id?: string }>();
  const hashSegments = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '').split('/') : [];
  const hashParam = hashSegments.length > 1 ? hashSegments[1].split('?')[0] : '';
  const resolvedId = propJobId || propJobData?.id || routeJobId || paymentRequestId || routeId || hashParam;
  const jobId = resolvedId;
  const [job, setJob] = useState<Job | null>(propJobData || null);
  const [linkedCluster, setLinkedCluster] = useState<AggregatedLinkedCluster | null>(null);
  const [proposal, setProposal] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [parentCustomer, setParentCustomer] = useState<any | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(propOrgData || null);
  const [partnerOrganization, setPartnerOrganization] = useState<Organization | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(!propJobData);
  const [pageLoadError, setPageLoadError] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [paymentRecipient, setPaymentRecipient] = useState<'owner' | 'partner'>('owner');
  const [finished, setFinished] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'full' | 'deposit' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState('');
  const [tipOption, setTipOption] = useState<'none' | '20' | '35' | '50' | 'custom'>('none');
  const [customTipAmount, setCustomTipAmount] = useState('');

  const handleDownloadPdf = async () => {
    if (!job) return;
    setIsDownloadingPdf(true);
    try {
      const { generateInvoicePdfAttachment } = await import('lib/pdfHelper');
      const { downloadFile } = await import('lib/downloadHelper');
      const att = await generateInvoicePdfAttachment(job, organization || partnerOrganization);
      const dataUri = att.content ? `data:application/pdf;base64,${att.content}` : (att.path || '');
      if (!dataUri) throw new Error("Could not produce downloadable invoice PDF.");
      await downloadFile(dataUri, att.filename);
      showToast.success('Invoice PDF downloaded successfully.');
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
      showToast.error('Failed to generate PDF, opening preview...');
      setIsPreviewOpen(true);
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const sigPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!jobId && !propJobData?.id) { setPageLoadError("Invalid Link."); setLoading(false); return; }
    
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
        let targetJobDocId = jobId || propJobData?.id || '';
        let cachedInvoiceData: any = null;

        // If jobId doesn't match direct doc ID or might be a payment request, invoice ID, or WO number, resolve it
        if (targetJobDocId) {
            try {
                // Check if it's a payment request document
                let payReqSnap = await db.collection('paymentRequests').doc(targetJobDocId).get();
                if (!payReqSnap.exists) {
                    payReqSnap = await db.collection('payment_requests').doc(targetJobDocId).get();
                }
                if (payReqSnap.exists) {
                    const payReqData = payReqSnap.data();
                    if (payReqData?.jobId) {
                        targetJobDocId = payReqData.jobId;
                    }
                    if (!cachedInvoiceData && payReqData?.invoiceNumber) {
                        const invDocSnap = await db.collection('invoices').doc(payReqData.invoiceNumber).get();
                        if (invDocSnap.exists) {
                            cachedInvoiceData = invDocSnap.data();
                        }
                    }
                    if (!payReqData?.jobId) {
                        const orgId = payReqData?.organizationId || 'org-1765817997819';
                        
                        // Fetch Organization
                        db.collection('organizations').doc(orgId).get().then(orgDoc => {
                            if (orgDoc.exists && isMounted) {
                                setOrganization({ ...orgDoc.data(), id: orgDoc.id } as Organization);
                            }
                        }).catch(() => {});

                        // Fetch Customer
                        if (payReqData?.customerId) {
                            db.collection('customers').doc(payReqData.customerId).get().then(custDoc => {
                                if (custDoc.exists && isMounted) {
                                    setCustomer({ ...custDoc.data(), id: custDoc.id });
                                }
                            }).catch(() => {});
                        }

                        const syntheticJob: Job = {
                            id: payReqData?.id || targetJobDocId,
                            jobNumber: payReqData?.jobNumber || payReqData?.id || targetJobDocId,
                            organizationId: orgId,
                            customerName: payReqData?.customerName || 'Valued Customer',
                            customerId: payReqData?.customerId || undefined,
                            customerEmail: payReqData?.customerEmail || undefined,
                            customerPhone: payReqData?.customerPhone || undefined,
                            address: payReqData?.customerAddress || '',
                            tasks: Array.isArray(payReqData?.jobTasks) && payReqData.jobTasks.length > 0 ? payReqData.jobTasks : [payReqData?.title || 'Online Payment Request'],
                            appointmentTime: payReqData?.appointmentTime || payReqData?.createdAt || new Date().toISOString(),
                            specialInstructions: payReqData?.description || '',
                            jobEvents: [],
                            jobStatus: 'In Progress',
                            isPaymentRequest: true,
                            paymentRequestId: payReqData?.id || targetJobDocId,
                            total: payReqData?.totalAmount || payReqData?.amount || 0,
                            depositRequired: payReqData?.depositRequired || payReqData?.amount || 0,
                            depositAmount: payReqData?.amount || 0,
                            depositPaid: payReqData?.status === 'paid',
                            invoice: {
                                id: payReqData?.invoiceNumber || payReqData?.id || targetJobDocId,
                                invoiceNumber: payReqData?.invoiceNumber || payReqData?.id || targetJobDocId,
                                referenceNumber: payReqData?.invoiceNumber || payReqData?.id || targetJobDocId,
                                proposalId: payReqData?.proposalId || undefined,
                                billToName: payReqData?.customerName || 'Valued Customer',
                                billToAddress: payReqData?.customerAddress || '',
                                invoiceDate: (payReqData?.createdAt ? payReqData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
                                date: (payReqData?.createdAt ? payReqData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
                                paymentTerms: 'due_upon_receipt',
                                paymentTermsLabel: 'Due Upon Receipt',
                                status: payReqData?.status === 'paid' ? 'Paid' : 'Unpaid',
                                financialStatus: payReqData?.status === 'paid' ? 'PAID' : 'UNPAID',
                                items: Array.isArray(payReqData?.jobItems) && payReqData.jobItems.length > 0 ? payReqData.jobItems : [
                                    {
                                        id: `item-${payReqData?.id || targetJobDocId}`,
                                        name: payReqData?.title || 'Payment Request',
                                        description: payReqData?.description || 'Online payment request',
                                        quantity: 1,
                                        unitPrice: payReqData?.amount || 0,
                                        total: payReqData?.amount || 0,
                                        taxable: false,
                                        type: 'Service'
                                    }
                                ],
                                subtotal: payReqData?.amount || 0,
                                taxRate: 0,
                                taxAmount: 0,
                                grandTotal: payReqData?.totalAmount || payReqData?.amount || 0,
                                totalAmount: payReqData?.totalAmount || payReqData?.amount || 0,
                                amount: payReqData?.totalAmount || payReqData?.amount || 0,
                                depositRequired: payReqData?.depositRequired || payReqData?.amount || 0,
                                depositAmount: payReqData?.amount || 0,
                                depositPaid: payReqData?.status === 'paid',
                                amountDueToday: payReqData?.amount || 0,
                                amountDueNet: payReqData?.amount || 0,
                                balanceDue: payReqData?.status === 'paid' ? 0 : (payReqData?.amount || 0),
                                balanceRemaining: payReqData?.status === 'paid' ? 0 : (payReqData?.amount || 0),
                                amountPaid: payReqData?.status === 'paid' ? (payReqData?.amount || 0) : 0,
                            }
                        };
                        setJob(syntheticJob);
                        setPageLoadError('');
                        setLoading(false);
                        return;
                    }
                }

                // Check if it's an invoice document
                let directInvSnap = await db.collection('invoices').doc(targetJobDocId).get();
                if (!directInvSnap.exists && !targetJobDocId.toUpperCase().startsWith('INV-')) {
                    const invCandidate = `INV-${targetJobDocId.replace(/^(inv|job)-?/i, '')}`;
                    directInvSnap = await db.collection('invoices').doc(invCandidate).get();
                }
                if (directInvSnap.exists) {
                    cachedInvoiceData = directInvSnap.data();
                    if (cachedInvoiceData?.jobId) {
                        targetJobDocId = cachedInvoiceData.jobId;
                    }
                }

                let directSnap = await db.collection('jobs').doc(targetJobDocId).get();
                if (!directSnap.exists) {
                    // Try prefix "Job-" and "job-"
                    const rawNum = targetJobDocId.replace(/^(job|inv)-?/i, '');
                    const jobCandidateUpper = `Job-${rawNum}`;
                    const jobCandidateLower = `job-${rawNum}`;
                    const prefSnapUpper = await db.collection('jobs').doc(jobCandidateUpper).get();
                    if (prefSnapUpper.exists) {
                        targetJobDocId = prefSnapUpper.id;
                        directSnap = prefSnapUpper;
                    } else {
                        const prefSnapLower = await db.collection('jobs').doc(jobCandidateLower).get();
                        if (prefSnapLower.exists) {
                            targetJobDocId = prefSnapLower.id;
                            directSnap = prefSnapLower;
                        }
                    }

                    // Try searching by invoice.id, invoice.invoiceNumber, workOrderNumber, poNumber if direct ID didn't resolve
                    if (!directSnap.exists) {
                        try {
                            const invSnap = await db.collection('jobs').where('invoice.id', '==', targetJobDocId).limit(1).get();
                            if (!invSnap.empty) {
                                targetJobDocId = invSnap.docs[0].id;
                            } else {
                                const invNumSnap = await db.collection('jobs').where('invoice.invoiceNumber', '==', targetJobDocId).limit(1).get();
                                if (!invNumSnap.empty) {
                                    targetJobDocId = invNumSnap.docs[0].id;
                                }
                            }
                        } catch {
                            // Query might fail unauthenticated, fallback to cachedInvoiceData
                        }
                    }
                }
            } catch (resolveErr) {
                console.warn("Error resolving target job doc ID:", resolveErr);
            }
        }

        if (!isMounted) return;

        if (!targetJobDocId && !cachedInvoiceData) {
            if (propJobData?.invoice) {
                setJob(propJobData);
                setPageLoadError('');
                setLoading(false);
                return;
            }
            setPageLoadError("Invoice record not found.");
            setLoading(false);
            return;
        }

        // Listen to real-time updates on the resolved job document
        unsubscribe = db.collection('jobs').doc(targetJobDocId).onSnapshot(
            async (doc) => {
                if (!isMounted) return;
                if (!doc.exists) {
                    if (cachedInvoiceData) {
                        const syntheticJob: Job = {
                            id: cachedInvoiceData.jobId || cachedInvoiceData.id || targetJobDocId,
                            jobNumber: cachedInvoiceData.jobId || cachedInvoiceData.id || targetJobDocId,
                            organizationId: cachedInvoiceData.organizationId || cachedInvoiceData.paidTo || 'unaffiliated',
                            customerName: cachedInvoiceData.billToName || cachedInvoiceData.customerName || 'Valued Customer',
                            customerId: cachedInvoiceData.customerId || undefined,
                            customerEmail: cachedInvoiceData.customerEmail || undefined,
                            customerPhone: cachedInvoiceData.customerPhone || undefined,
                            address: cachedInvoiceData.billToAddress || '',
                            appointmentTime: cachedInvoiceData.date || cachedInvoiceData.invoiceDate || new Date().toISOString(),
                            specialInstructions: cachedInvoiceData.specialInstructions || cachedInvoiceData.workNotes || '',
                            tasks: Array.isArray(cachedInvoiceData.items) ? cachedInvoiceData.items.map((it: any) => it.name || it.description) : ['HVAC Service'],
                            jobEvents: [],
                            jobStatus: 'Completed',
                            total: cachedInvoiceData.totalAmount || cachedInvoiceData.amount || cachedInvoiceData.grandTotal || 0,
                            invoice: {
                                id: cachedInvoiceData.id || targetJobDocId,
                                invoiceNumber: cachedInvoiceData.invoiceNumber || cachedInvoiceData.id || targetJobDocId,
                                referenceNumber: cachedInvoiceData.referenceNumber || cachedInvoiceData.id || targetJobDocId,
                                proposalId: cachedInvoiceData.proposalId || undefined,
                                billToName: cachedInvoiceData.billToName || cachedInvoiceData.customerName || 'Valued Customer',
                                billToAddress: cachedInvoiceData.billToAddress || '',
                                invoiceDate: cachedInvoiceData.invoiceDate || cachedInvoiceData.date || new Date().toISOString().split('T')[0],
                                date: cachedInvoiceData.date || cachedInvoiceData.invoiceDate || new Date().toISOString().split('T')[0],
                                dueDate: cachedInvoiceData.dueDate || undefined,
                                paymentTerms: cachedInvoiceData.paymentTerms || 'due_upon_receipt',
                                paymentTermsLabel: cachedInvoiceData.paymentTermsLabel || 'Due Upon Receipt',
                                status: cachedInvoiceData.status || 'Unpaid',
                                financialStatus: cachedInvoiceData.financialStatus || (cachedInvoiceData.status === 'Paid' ? 'PAID' : 'UNPAID'),
                                items: cachedInvoiceData.items || [],
                                subtotal: cachedInvoiceData.subtotal || 0,
                                taxRate: cachedInvoiceData.taxRate || 0,
                                taxAmount: cachedInvoiceData.taxAmount || 0,
                                grandTotal: cachedInvoiceData.grandTotal || cachedInvoiceData.totalAmount || cachedInvoiceData.amount || 0,
                                totalAmount: cachedInvoiceData.totalAmount || cachedInvoiceData.grandTotal || cachedInvoiceData.amount || 0,
                                amount: cachedInvoiceData.amount || cachedInvoiceData.totalAmount || cachedInvoiceData.grandTotal || 0,
                                requireDeposit: cachedInvoiceData.requireDeposit ?? false,
                                depositType: cachedInvoiceData.depositType || 'none',
                                depositValue: cachedInvoiceData.depositValue || 0,
                                depositRequired: cachedInvoiceData.depositRequired || cachedInvoiceData.depositAmount || 0,
                                depositAmount: cachedInvoiceData.depositAmount || cachedInvoiceData.depositRequired || 0,
                                depositPaid: cachedInvoiceData.depositPaid ?? false,
                                depositPaidAmount: cachedInvoiceData.depositPaidAmount || 0,
                                amountPaid: cachedInvoiceData.amountPaid || 0,
                                balanceDue: cachedInvoiceData.balanceDue || cachedInvoiceData.totalAmount || cachedInvoiceData.amount || 0,
                                balanceRemaining: cachedInvoiceData.balanceRemaining || cachedInvoiceData.balanceDue || 0,
                                amountDueToday: cachedInvoiceData.amountDueToday || cachedInvoiceData.depositRequired || cachedInvoiceData.totalAmount || 0,
                                amountDueNet: cachedInvoiceData.amountDueNet || cachedInvoiceData.balanceDue || 0,
                                workmanshipWarrantyMonths: cachedInvoiceData.workmanshipWarrantyMonths,
                                partsWarrantyMonths: cachedInvoiceData.partsWarrantyMonths,
                                warrantyNotes: cachedInvoiceData.warrantyNotes
                            } as any
                        };
                        setJob(syntheticJob);
                        setPageLoadError('');
                        setLoading(false);
                        return;
                    }
                    if (propJobData?.invoice) {
                        setJob(propJobData);
                        setPageLoadError('');
                        setLoading(false);
                        return;
                    }
                    setPageLoadError("Invoice record not found.");
                    setLoading(false);
                    return;
                }
                const loadedJob = { ...doc.data(), id: doc.id } as Job;
                if (!loadedJob.invoice && !propJobData?.invoice) {
                    setPageLoadError("Invoice record not found.");
                    setLoading(false);
                    return;
                }
                setPageLoadError('');
                setJob(loadedJob.invoice ? loadedJob : ({ ...loadedJob, invoice: propJobData?.invoice } as Job));

                // Fetch full linked cluster (jobs, visits, proposals, invoices) for this work order / link chain
                fetchLinkedClusterForJob(loadedJob).then(cluster => {
                    if (isMounted) {
                        setLinkedCluster(cluster);
                    }
                }).catch(e => console.warn("Error fetching linked cluster:", e));

                // Auto-track invoice "Opened" state
                if (loadedJob.invoice && loadedJob.invoice.status !== 'Paid' && !loadedJob.invoice.opened) {
                    try {
                        await db.collection('jobs').doc(targetJobDocId).update(cleanUndefinedFields({
                            'invoice.opened': true,
                            'invoice.openedAt': new Date().toISOString()
                        }));
                        loadedJob.invoice.opened = true;
                        loadedJob.invoice.openedAt = new Date().toISOString();
                    } catch (dbErr) {
                        console.warn("Direct Firestore update for invoice.opened failed (anonymous permissions):", dbErr);
                    }
                }

                try {
                    // Fetch linked proposal if proposalId is available
                    if (loadedJob.proposalId) {
                        db.collection('proposals').doc(loadedJob.proposalId).get().then(propDoc => {
                            if (propDoc.exists && isMounted) {
                                setProposal({ ...propDoc.data(), id: propDoc.id });
                            }
                        });
                    } else {
                        setProposal(null);
                    }

                    // Fetch customer details if customerId is available
                    if (loadedJob.customerId) {
                        db.collection('customers').doc(loadedJob.customerId).get().then(custDoc => {
                            if (custDoc.exists && isMounted) {
                                const custData = { ...custDoc.data(), id: custDoc.id };
                                setCustomer(custData);
                                const parentId = (custData as any).parentId || (custData as any).parentCustomerId;
                                if (parentId) {
                                    db.collection('customers').doc(parentId).get().then(pDoc => {
                                        if (pDoc.exists && isMounted) {
                                            setParentCustomer({ ...pDoc.data(), id: pDoc.id });
                                        }
                                    });
                                }
                            }
                        });
                    } else {
                        setCustomer(null);
                    }

                    // Fetch Owner Org if not loaded
                    setOrganization(prev => {
                        if (!prev) {
                            db.collection('organizations').doc(loadedJob.organizationId).get().then(orgDoc => {
                                if (orgDoc.exists && isMounted) {
                                    setOrganization({ ...orgDoc.data(), id: orgDoc.id } as Organization);
                                }
                            });
                        }
                        return prev;
                    });

                    // Fetch Partner Org if assigned AND allowed
                    setPartnerOrganization(prev => {
                        if (!prev && loadedJob.assignedPartnerId && loadedJob.partnerAllowDirectPayment) {
                            db.collection('organizations').doc(loadedJob.assignedPartnerId).get().then(pOrgDoc => {
                                if (pOrgDoc.exists && isMounted) {
                                    setPartnerOrganization({ ...pOrgDoc.data(), id: pOrgDoc.id } as Organization);
                                }
                            });
                        }
                        return prev;
                    });

                    // Platform settings for subscription jobs
                    setPlatformSettings(prev => {
                        if (!prev && loadedJob.source === 'PlatformAdmin') {
                            db.collection('platformSettings').doc('global').get().then(settingsDoc => {
                                if (settingsDoc.exists && isMounted) {
                                    setPlatformSettings({ ...settingsDoc.data(), id: settingsDoc.id } as PlatformSettings);
                                }
                            });
                        }
                        return prev;
                    });

                    setLoading(false);
                } catch (err: unknown) {
                    console.error("Error loading organizations or settings:", err);
                }
            },
            (err) => {
                if (isMounted) {
                    setPageLoadError(err.message || "System Error");
                    setLoading(false);
                }
            }
        );
    };

    setupListener();

    return () => {
        isMounted = false;
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [jobId, propJobData]);

  const markJobPaid = async (paymentIntentId?: string, paymentAmount?: number, processingFee = 0, processingFeeName?: string, tip = 0) => {
      if (!job || !jobId) return;
      try {
          const paidThisTime = paymentAmount !== undefined ? paymentAmount : balanceDue;
          const currentItems = job.invoice?.items || [];
          let updatedItems = [...currentItems];
          let updatedTotal = safeTotal;

          if (tip > 0) {
              const tipItem = {
                  id: `tip-${Date.now()}`,
                  description: 'Technician Tip',
                  name: 'Technician Tip',
                  quantity: 1,
                  unitPrice: tip,
                  total: tip,
                  type: 'Tip' as const,
                  taxable: false
              };
              updatedItems.push(tipItem);
              updatedTotal = roundTo2Decimals(updatedTotal + tip);
          }

          if (processingFee > 0) {
              const feeItem = {
                  id: `fee-${Date.now()}`,
                  description: processingFeeName || 'Payment Processing Fee',
                  name: processingFeeName || 'Payment Processing Fee',
                  quantity: 1,
                  unitPrice: processingFee,
                  total: processingFee,
                  type: 'Fee' as const,
                  taxable: false
              };
              updatedItems.push(feeItem);
              updatedTotal = roundTo2Decimals(updatedTotal + processingFee);
          }

          // Prevent duplicate payment addition if this paymentIntent was already recorded
          const curProcessedIntents: string[] = Array.isArray(job.invoice?.processedPaymentIntentIds) 
              ? [...job.invoice.processedPaymentIntentIds] 
              : (Array.isArray((job as any).processedPaymentIntentIds) ? [...(job as any).processedPaymentIntentIds] : []);

          if (paymentIntentId && curProcessedIntents.includes(paymentIntentId)) {
              console.log(`[Idempotency] Payment intent ${paymentIntentId} already recorded locally. Skipping duplicate addition.`);
              return;
          }

          const updatedProcessedIntents = paymentIntentId ? Array.from(new Set([...curProcessedIntents, paymentIntentId])) : curProcessedIntents;

          const newPaymentRecord = paymentIntentId ? {
              id: paymentIntentId,
              paymentIntentId: paymentIntentId,
              amount: roundTo2Decimals(paidThisTime + processingFee + tip),
              baseAmount: roundTo2Decimals(paidThisTime),
              fee: processingFee,
              tip: tip,
              method: 'Credit Card',
              date: new Date().toISOString(),
              status: 'succeeded',
              createdAt: new Date().toISOString()
          } : null;

          const curPayments = Array.isArray(job.invoice?.payments) 
              ? [...job.invoice.payments] 
              : (Array.isArray((job as any).payments) ? [...(job as any).payments] : []);
          const updatedPayments = newPaymentRecord 
              ? [...curPayments.filter((p: any) => p.id !== paymentIntentId && p.paymentIntentId !== paymentIntentId), newPaymentRecord] 
              : curPayments;

          const newAmountPaid = (job.invoice?.amountPaid || 0) + paidThisTime + processingFee + tip;
          const isFullyPaid = newAmountPaid >= updatedTotal - 0.01;
          const newStatus = isFullyPaid ? 'Paid' : 'Partially Paid';

          const isDepositPayment = (job.depositRequired && (job.depositRequired > 0) && !job.depositPaid) || 
                                   (job.invoice?.depositRequired && (job.invoice.depositRequired > 0) && !job.invoice.depositPaid) ||
                                   paymentOption === 'deposit' ||
                                   (job.isPaymentRequest && (job as any).type === 'deposit');

          const newDepositPaid = isDepositPayment ? true : (job.invoice?.depositPaid || job.depositPaid || false);
          const newDepositPaidAmount = isDepositPayment ? ((job.invoice?.depositPaidAmount || job.depositPaidAmount || 0) + paidThisTime) : (job.invoice?.depositPaidAmount || job.depositPaidAmount || 0);

          const updateData: any = { 
              'invoice.status': newStatus, 
              'invoice.financialStatus': isFullyPaid ? 'PAID' : (isDepositPayment ? 'DEPOSIT_PAID' : 'PARTIALLY_PAID'),
              'invoice.amountPaid': newAmountPaid,
              'invoice.balanceDue': Math.max(0, updatedTotal - newAmountPaid),
              'invoice.balanceRemaining': Math.max(0, updatedTotal - newAmountPaid),
              'invoice.depositPaid': newDepositPaid,
              'invoice.depositPaidAmount': newDepositPaidAmount,
              'invoice.paidDate': new Date().toISOString(),
              'invoice.paidTo': paymentRecipient === 'partner' ? partnerOrganization?.id : organization?.id,
              'invoice.paymentRecipientName': paymentRecipient === 'partner' ? partnerOrganization?.name : organization?.name,
              depositPaid: newDepositPaid,
              depositPaidAmount: newDepositPaidAmount,
              depositPaidDate: isDepositPayment ? new Date().toISOString() : undefined
          };
          if (paymentIntentId) {
              updateData['invoice.paymentIntentId'] = paymentIntentId;
              updateData.processedPaymentIntentIds = updatedProcessedIntents;
              updateData['invoice.processedPaymentIntentIds'] = updatedProcessedIntents;
              updateData.payments = updatedPayments;
              updateData['invoice.payments'] = updatedPayments;
          }
          if (tip > 0) {
              const curJobTip = Number(job.tipAmount || job.invoice?.tipAmount || 0);
              updateData.tipAmount = roundTo2Decimals(curJobTip + tip);
              updateData['invoice.tipAmount'] = updateData.tipAmount;
          }
          if (processingFee > 0 || tip > 0) {
              updateData['invoice.items'] = updatedItems;
              updateData['invoice.totalAmount'] = updatedTotal;
              updateData['invoice.amount'] = updatedTotal;
          }

          // Wrap direct database write in try-catch to ignore expected client permission errors.
          // The database will be updated securely in the background via payment webhooks anyway.
          try {
              if (job.isPaymentRequest && (job.paymentRequestId || job.id)) {
                  const pReqId = job.paymentRequestId || job.id;
                  const reqUpdate = {
                      status: isFullyPaid ? 'paid' : (isDepositPayment ? 'deposit_paid' : 'partially_paid'),
                      paidAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      paymentDetails: {
                          amountPaid: newAmountPaid,
                          paymentIntentId: paymentIntentId || null,
                          isFullyPaid
                      }
                  };
                  await db.collection('paymentRequests').doc(pReqId).update(cleanUndefinedFields(reqUpdate)).catch(() => {});
                  await db.collection('payment_requests').doc(pReqId).update(cleanUndefinedFields(reqUpdate)).catch(() => {});
              }

              // Update target job if valid job ID exists or discover via customer fallback
              let resolvedJobDocId = (job.isPaymentRequest ? (job as any).jobId : null) || (jobId && !jobId.startsWith('pay-') ? jobId : null);

              if (!resolvedJobDocId && job.isPaymentRequest) {
                  try {
                      const custId = job.customerId;
                      const custName = (job.customerName || '').trim().toLowerCase();
                      const jobsSnap = await db.collection('jobs').where('deleted', '!=', true).get();
                      
                      const candidateJobs: any[] = [];
                      jobsSnap.forEach((d: any) => {
                          const j = d.data();
                          const jId = d.id;
                          const matchesCustId = custId && j.customerId === custId;
                          const matchesCustName = custName && (j.customerName || '').trim().toLowerCase() === custName;
                          if (matchesCustId || matchesCustName) {
                              candidateJobs.push({ id: jId, ...j });
                          }
                      });

                      const targetProposalId = (job as any).proposalId;
                      let matchedJob = targetProposalId ? candidateJobs.find(j => j.proposalId === targetProposalId || (Array.isArray(j.linkedProposalIds) && j.linkedProposalIds.includes(targetProposalId))) : null;

                      if (!matchedJob) {
                          matchedJob = candidateJobs.find(j => {
                              const reqDep = Number(j.depositRequired) || Number(j.depositAmount) || Number(j.invoice?.depositRequired) || Number(j.invoice?.depositAmount) || 0;
                              return Math.abs(reqDep - paidThisTime) < 0.05 && !j.depositPaid;
                          });
                      }

                      if (!matchedJob && candidateJobs.length > 0) {
                          matchedJob = candidateJobs.find(j => !j.depositPaid && (j.depositRequired || j.invoice?.depositRequired));
                      }

                      if (matchedJob) {
                          resolvedJobDocId = matchedJob.id;
                          const pReqId = job.paymentRequestId || job.id;
                          if (pReqId) {
                              const prLinkUpdate = {
                                  jobId: matchedJob.id,
                                  jobNumber: matchedJob.jobNumber || matchedJob.id,
                                  proposalId: matchedJob.proposalId || null,
                                  invoiceNumber: matchedJob.invoice?.id || matchedJob.invoice?.invoiceNumber || null
                              };
                              await db.collection('payment_requests').doc(pReqId).update(cleanUndefinedFields(prLinkUpdate)).catch(() => {});
                              await db.collection('paymentRequests').doc(pReqId).update(cleanUndefinedFields(prLinkUpdate)).catch(() => {});
                          }
                      }
                  } catch (fallbackErr) {
                      console.warn("Error finding matching job for payment request:", fallbackErr);
                  }
              }

              if (resolvedJobDocId && !resolvedJobDocId.startsWith('pay-')) {
                  const jobDocRef = db.collection('jobs').doc(resolvedJobDocId);
                  const jobDocSnap = await jobDocRef.get();
                  if (jobDocSnap.exists) {
                      const targetJobData = jobDocSnap.data() || {};
                      const rawTargetTotal = Number(targetJobData.invoice?.totalAmount || targetJobData.invoice?.amount || targetJobData.total || updatedTotal);
                      const targetTotal = roundTo2Decimals(rawTargetTotal + (processingFee > 0 ? processingFee : 0) + (tip > 0 ? tip : 0));
                      const targetPriorPaid = Number(targetJobData.invoice?.amountPaid || targetJobData.paidAmount || 0);
                      const targetNewPaid = roundTo2Decimals(targetPriorPaid + paidThisTime + processingFee + tip);
                      const targetIsFullyPaid = targetNewPaid >= targetTotal - 0.05;
                      const targetBalanceRemaining = Math.max(0, roundTo2Decimals(targetTotal - targetNewPaid));
                      const isJobDeposit = isDepositPayment || (targetJobData.depositRequired && !targetJobData.depositPaid);

                      const targetItems = Array.isArray(targetJobData.invoice?.items) ? [...targetJobData.invoice.items] : [];
                      let targetUpdatedItems = [...targetItems];
                      if (tip > 0) {
                          const existingTip = targetUpdatedItems.find((it: any) => 
                              (paymentIntentId && it.paymentIntentId === paymentIntentId && it.type === 'Tip')
                          );
                          if (!existingTip) {
                              targetUpdatedItems.push({
                                  id: `tip-${Date.now()}`,
                                  paymentIntentId: paymentIntentId || null,
                                  description: 'Technician Tip',
                                  name: 'Technician Tip',
                                  quantity: 1,
                                  unitPrice: tip,
                                  total: tip,
                                  type: 'Tip' as const,
                                  taxable: false
                              });
                          }
                      }
                      if (processingFee > 0) {
                          const existingFee = targetUpdatedItems.find((it: any) => 
                              (paymentIntentId && it.paymentIntentId === paymentIntentId) || 
                              (it.type === 'Fee' && Number(it.total) === processingFee && (paymentIntentId && it.paymentIntentId === paymentIntentId))
                          );
                          if (!existingFee) {
                              targetUpdatedItems.push({
                                  id: `fee-${Date.now()}`,
                                  paymentIntentId: paymentIntentId || null,
                                  description: processingFeeName || 'Payment Processing Fee',
                                  name: processingFeeName || 'Payment Processing Fee',
                                  quantity: 1,
                                  unitPrice: processingFee,
                                  total: processingFee,
                                  type: 'Fee' as const,
                                  taxable: false
                              });
                          }
                      }

                      const jobUpdatePayload: any = {
                          depositPaid: isJobDeposit ? true : (targetJobData.depositPaid || false),
                          depositPaidAmount: isJobDeposit ? ((Number(targetJobData.depositPaidAmount) || 0) + paidThisTime) : (Number(targetJobData.depositPaidAmount) || 0),
                          depositPaidDate: isJobDeposit ? new Date().toISOString() : (targetJobData.depositPaidDate || undefined),
                          paidAmount: targetNewPaid,
                          'invoice.status': targetIsFullyPaid ? 'Paid' : (targetNewPaid > 0 ? 'Partially Paid' : (targetJobData.invoice?.status || 'Unpaid')),
                          'invoice.financialStatus': targetIsFullyPaid ? 'PAID' : (isJobDeposit ? 'DEPOSIT_PAID' : 'PARTIALLY_PAID'),
                          'invoice.amountPaid': targetNewPaid,
                          'invoice.balanceDue': targetBalanceRemaining,
                          'invoice.balanceRemaining': targetBalanceRemaining,
                          'invoice.depositPaid': isJobDeposit ? true : (targetJobData.invoice?.depositPaid || false),
                          'invoice.depositPaidAmount': isJobDeposit ? ((Number(targetJobData.invoice?.depositPaidAmount) || 0) + paidThisTime) : (Number(targetJobData.invoice?.depositPaidAmount) || 0),
                          'invoice.depositPaidDate': isJobDeposit ? new Date().toISOString() : (targetJobData.invoice?.depositPaidDate || undefined),
                          'invoice.paidDate': new Date().toISOString(),
                          'invoice.paidTo': paymentRecipient === 'partner' ? partnerOrganization?.id : organization?.id,
                          'invoice.paymentRecipientName': paymentRecipient === 'partner' ? partnerOrganization?.name : organization?.name
                      };
                      if (tip > 0) {
                          const curTargetTip = Number(targetJobData.tipAmount || targetJobData.invoice?.tipAmount || 0);
                          jobUpdatePayload.tipAmount = roundTo2Decimals(curTargetTip + tip);
                          jobUpdatePayload['invoice.tipAmount'] = jobUpdatePayload.tipAmount;
                      }
                      if (processingFee > 0 || tip > 0) {
                          jobUpdatePayload['invoice.items'] = targetUpdatedItems;
                          jobUpdatePayload['invoice.totalAmount'] = targetTotal;
                          jobUpdatePayload['invoice.amount'] = targetTotal;
                          if (targetJobData.invoice?.grandTotal !== undefined) {
                              jobUpdatePayload['invoice.grandTotal'] = targetTotal;
                          }
                      }
                      if (paymentIntentId) {
                          jobUpdatePayload['invoice.paymentIntentId'] = paymentIntentId;
                          if (isJobDeposit) {
                              jobUpdatePayload['depositPaymentIntentId'] = paymentIntentId;
                          }
                      }

                      await jobDocRef.update(cleanUndefinedFields(jobUpdatePayload)).catch(() => {});

                      if (targetIsFullyPaid && targetJobData.source === 'PlatformAdmin' && targetJobData.customerId) {
                          await db.collection('organizations').doc(targetJobData.customerId).update(cleanUndefinedFields({ subscriptionStatus: 'active' })).catch(() => {});
                      }

                      // Update top-level invoice document if exists
                      const invId = targetJobData.invoice?.id || (targetJobData as any)?.invoiceNumber;
                      if (invId) {
                          const invUpdatePayload: any = {
                              status: targetIsFullyPaid ? 'Paid' : 'Partially Paid',
                              financialStatus: targetIsFullyPaid ? 'PAID' : (isJobDeposit ? 'DEPOSIT_PAID' : 'PARTIALLY_PAID'),
                              amountPaid: targetNewPaid,
                              balanceDue: targetBalanceRemaining,
                              balanceRemaining: targetBalanceRemaining,
                              depositPaid: isJobDeposit ? true : (targetJobData.invoice?.depositPaid || false),
                              depositPaidAmount: isJobDeposit ? ((Number(targetJobData.invoice?.depositPaidAmount) || 0) + paidThisTime) : (Number(targetJobData.invoice?.depositPaidAmount) || 0),
                              depositPaidDate: isJobDeposit ? new Date().toISOString() : undefined,
                              paidDate: new Date().toISOString(),
                              paidTo: paymentRecipient === 'partner' ? partnerOrganization?.id : organization?.id,
                              paymentRecipientName: paymentRecipient === 'partner' ? partnerOrganization?.name : organization?.name
                          };
                          if (tip > 0) {
                              invUpdatePayload.tipAmount = roundTo2Decimals(Number(targetJobData.invoice?.tipAmount || 0) + tip);
                          }
                          if (processingFee > 0 || tip > 0) {
                              invUpdatePayload.items = targetUpdatedItems;
                              invUpdatePayload.totalAmount = targetTotal;
                              invUpdatePayload.amount = targetTotal;
                              if (targetJobData.invoice?.grandTotal !== undefined) {
                                  invUpdatePayload.grandTotal = targetTotal;
                              }
                          }
                          if (paymentIntentId) invUpdatePayload.paymentIntentId = paymentIntentId;
                          await db.collection('invoices').doc(invId).update(cleanUndefinedFields(invUpdatePayload)).catch(() => {});
                      }

                      // Auto-activate any JB Extended Warranty contracts attached to this paid invoice
                      if (targetIsFullyPaid) {
                          try {
                              const warrantyItems = (targetUpdatedItems || []).filter((it: any) => it.isExtendedWarranty || it.extendedWarrantyData);
                              const targetCustId = targetJobData.customerId || customer?.id;
                              if (warrantyItems.length > 0 && targetCustId) {
                                  const custRef = db.collection('customers').doc(targetCustId);
                                  for (const wItem of warrantyItems) {
                                      const extData = wItem.extendedWarrantyData || {};
                                      const contractId = extData.contractId || `warr-tek-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                                      const contractNumber = extData.contractNumber || `TAP-${Math.floor(100000 + Math.random() * 900000)}`;
                                      const termYears = extData.termYears || 10;
                                      const nowIso = new Date().toISOString();
                                      const agreeDate = nowIso.split('T')[0];
                                      const effDate = new Date();
                                      effDate.setDate(effDate.getDate() + 30);
                                      const expDate = new Date();
                                      expDate.setFullYear(expDate.getFullYear() + termYears);

                                      const activatedContract: any = {
                                          id: contractId,
                                          contractNumber,
                                          organizationId: targetJobData.organizationId || organization?.id || '',
                                          customerId: targetCustId,
                                          customerName: targetJobData.customerName || customer?.name || '',
                                          serviceAddress: targetJobData.address || customer?.address || '',
                                          customerPhone: targetJobData.customerPhone || customer?.phone || '',
                                          customerEmail: targetJobData.customerEmail || customer?.email || '',
                                          trade: 'HVAC',
                                          planTitle: extData.planName || wItem.name || 'TekAir Extended Protection Plan',
                                          agreementDate: agreeDate,
                                          effectiveDate: effDate.toISOString().split('T')[0],
                                          expirationDate: expDate.toISOString().split('T')[0],
                                          status: 'Active',
                                          equipmentId: extData.equipmentId || '',
                                          systemType: extData.equipmentName || wItem.name || 'HVAC System',
                                          refrigerant: 'R-410A',
                                          nominalTons: 3,
                                          approxAgeYears: 0,
                                          outdoorModel: extData.equipmentName || '',
                                          outdoorSerial: extData.equipmentSerial || '',
                                          qualifyingInvoiceNumber: invId || targetJobData.invoice?.id || targetJobData.id,
                                          qualifyingJobId: targetJobData.id,
                                          qualifyingServiceDate: agreeDate,
                                          basePrice: Number(wItem.unitPrice || wItem.total || 0),
                                          qualificationFee: 0,
                                          qualificationFeeWaived: true,
                                          totalAmount: Number(wItem.unitPrice || wItem.total || 0),
                                          paymentStatus: 'Paid',
                                          paymentMethod: 'Credit Card',
                                          annualAggregateLimit: 5000,
                                          remainingBenefitLimit: 5000,
                                          serviceFee: 0,
                                          replacementCreditLimit: 1500,
                                          ageTierLabel: '0-5 Years',
                                          sublimits: [],
                                          createdAt: nowIso,
                                          updatedAt: nowIso
                                      };

                                      if (targetJobData.organizationId) {
                                          await db.collection('organizations').doc(targetJobData.organizationId).collection('warrantyContracts').doc(contractId).set(cleanUndefinedFields(activatedContract)).catch(() => {});
                                      }

                                      const custSnap = await custRef.get();
                                      if (custSnap.exists) {
                                          const existingContracts = Array.isArray(custSnap.data()?.warrantyContracts) ? [...custSnap.data()?.warrantyContracts] : [];
                                          const filtered = existingContracts.filter((c: any) => c.id !== contractId && c.contractNumber !== contractNumber);
                                          filtered.push(activatedContract);
                                          await custRef.update(cleanUndefinedFields({ warrantyContracts: filtered })).catch(() => {});
                                      }
                                  }
                              }
                          } catch (wErr) {
                              console.warn("Automated warranty activation encountered error:", wErr);
                          }
                      }

                      // Update linked proposal if deposit was paid
                      if (isJobDeposit && targetJobData.proposalId) {
                          await db.collection('proposals').doc(targetJobData.proposalId).update(cleanUndefinedFields({
                              depositPaid: true,
                              depositReceived: true,
                              depositPaidAmount: paidThisTime,
                              depositPaidDate: new Date().toISOString()
                          })).catch(() => {});
                      }
                  }
              }
          } catch (dbErr) {
              console.warn("Direct Firestore update failed (this is expected for public anonymous customer payments). Status will update automatically via payment webhook shortly.", dbErr);
          }
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const tipNote = tip > 0 ? ` (includes $${tip.toFixed(2)} tip)` : '';
              const notificationContent = isFullyPaid 
                  ? `💰 Payment received for Invoice #${job.invoice?.id || job.id.substring(0,8)} from ${job.customerName}. Amount: $${(paidThisTime + processingFee + tip).toFixed(2)}${tipNote} (Full payment).`
                  : `💰 Partial payment received for Invoice #${job.invoice?.id || job.id.substring(0,8)} from ${job.customerName}. Amount: $${(paidThisTime + processingFee + tip).toFixed(2)}${tipNote}. Remaining Balance: $${(updatedTotal - newAmountPaid).toFixed(2)}.`;
              
              const notifPayload = {
                  title: isFullyPaid ? 'Invoice Paid!' : 'Partial Payment Received',
                  body: notificationContent,
                  type: 'invoice_paid',
                  link: `/invoice/${job.id}`,
                  data: {
                      jobId: job.id,
                      customerId: job.customerId,
                      invoiceId: job.invoice?.id,
                      type: 'invoice_paid'
                  }
              };

              const recipientId = job.assignedTechnicianId;
              if (recipientId) {
                  await sendNotification(recipientId, notifPayload, job.organizationId);
              }
              await notifyAdmins(job.organizationId, notifPayload);
          } catch(e) { console.error('Failed to send notifications', e); }

          setJob({ 
              ...job, 
              tipAmount: roundTo2Decimals(Number(job.tipAmount || 0) + tip),
              processedPaymentIntentIds: updatedProcessedIntents,
              payments: updatedPayments,
              invoice: { 
                  ...job.invoice, 
                  status: newStatus, 
                  amountPaid: newAmountPaid,
                  tipAmount: roundTo2Decimals(Number((job.invoice as any)?.tipAmount || 0) + tip),
                  items: updatedItems,
                  totalAmount: updatedTotal,
                  amount: updatedTotal,
                  processedPaymentIntentIds: updatedProcessedIntents,
                  payments: updatedPayments
              } as any 
          });
          setSuccess(true);
          
          // Post-payment reminder if not signed and fully paid
          if (isFullyPaid && !job.invoiceSignature) {
              showToast.info("Payment received! Please don't forget to sign the authorization below.");
              setTimeout(() => {
                  document.getElementById('signature-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 1500);
          } else if (!isFullyPaid) {
              showToast.success(`Partial payment of $${(paidThisTime + processingFee + tip).toFixed(2)} successful!`);
          }
      } catch (err) {
          console.error("markJobPaid error:", err);
          showToast.warn("Failed to process payment status.");
      }
  };

  const handleSubscriptionApprove = async () => { await markJobPaid(); showToast.warn("Subscription Active!"); };

  const handleSignInvoice = async () => {
      if (!sigPadRef.current || sigPadRef.current.isEmpty() || !job) { showToast.warn("Sign first."); return; }
      setIsSigning(true);
      try {
          const sig = sigPadRef.current.toDataURL();
          if (!job.isPaymentRequest) {
              await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ invoiceSignature: sig, invoiceSignedDate: new Date().toISOString() }));
          }
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const notificationContent = `✍️ ${job.customerName} has signed the invoice #${job.invoice?.id || job.id.substring(0,8)}.`;
              
              const notifPayload = {
                  title: 'Invoice Signed',
                  body: notificationContent,
                  type: 'invoice_signed',
                  link: `/invoice/${job.id}`,
                  data: {
                      jobId: job.id,
                      customerId: job.customerId,
                      invoiceId: job.invoice?.id,
                      type: 'invoice_signed'
                  }
              };

              const recipientId = job.assignedTechnicianId;
              if (recipientId) {
                  await sendNotification(recipientId, notifPayload, job.organizationId);
              }
              await notifyAdmins(job.organizationId, notifPayload);
          } catch(e) { console.error('Failed to send notifications', e); }

          setJob({ ...job, invoiceSignature: sig });
          showToast.success("Signature captured!");
      } catch { showToast.warn("Failed to save."); } finally { setIsSigning(false); }
  };

  const handleFinish = async () => {
      const { globalConfirm } = await import('lib/globalConfirm');
      
      if (!job?.invoiceSignature && !isPlatformSubscription) {
          const proceed = await globalConfirm(
              "You haven't signed the invoice yet. A signature is required for our records. Would you like to sign now?",
              "Signature Required",
              "Sign Now",
              "Finish Anyway"
          );
          if (proceed) {
              document.getElementById('signature-section')?.scrollIntoView({ behavior: 'smooth' });
              return;
          }
      }
      
      setFinished(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPlatformSubscription = job?.source === 'PlatformAdmin';
  const currentActiveOrg = paymentRecipient === 'partner' ? partnerOrganization : organization;
  // Residential invoices now use the premium B2B commercial layout
  const isCommercialInvoice = true;
  const isB2CInvoice = false;

  const workmanshipWarrantyMonths = (job?.invoice as any)?.workmanshipWarrantyMonths || (proposal as any)?.workmanshipWarrantyMonths || 0;
  const partsWarrantyMonths = (job?.invoice as any)?.partsWarrantyMonths || (proposal as any)?.partsWarrantyMonths || 0;
  const warrantyNotes = (job?.invoice as any)?.warrantyNotes || (proposal as any)?.warrantyNotes || '';
  const hasActiveWarrantyBadge = workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0 || warrantyNotes.trim().length > 0;
  const hasActiveWarranty = hasActiveWarrantyBadge || (job?.invoice?.items || []).some((item: any) => !!item.warranty);
  const getInvoiceWarrantyText = () => {
    if (workmanshipWarrantyMonths > 0 && partsWarrantyMonths > 0) {
      if (workmanshipWarrantyMonths === partsWarrantyMonths) {
        const years = workmanshipWarrantyMonths / 12;
        return years >= 1 ? `${years}-Year Parts & Labor` : `${workmanshipWarrantyMonths}-Month Parts & Labor`;
      }
      const wYears = workmanshipWarrantyMonths / 12;
      const pYears = partsWarrantyMonths / 12;
      const wStr = wYears >= 1 ? `${wYears}-Year Labor` : `${workmanshipWarrantyMonths}-Month Labor`;
      const pStr = pYears >= 1 ? `${pYears}-Year Parts` : `${partsWarrantyMonths}-Month Parts`;
      return `${pStr} / ${wStr}`;
    } else if (workmanshipWarrantyMonths > 0) {
      const years = workmanshipWarrantyMonths / 12;
      return years >= 1 ? `${years}-Year Labor` : `${workmanshipWarrantyMonths}-Month Labor`;
    } else if (partsWarrantyMonths > 0) {
      const years = partsWarrantyMonths / 12;
      return years >= 1 ? `${years}-Year Parts` : `${partsWarrantyMonths}-Month Parts`;
    }
    return '';
  };

  // Centralized Canonical Financial Engine calculation
  const canonical = useMemo(() => {
    if (!job) return null;
    const inv = job.invoice || (job as any);
    const prop = proposal || (job as any).proposal || {};

    return computeCanonicalFinancials({
      items: inv.items || [],
      subtotal: inv.subtotal,
      taxRate: inv.taxRate,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount || inv.amount,
      additionalFeePercent: inv.additionalFeePercent,
      additionalFeeName: inv.additionalFeeName,
      additionalFeeAmount: inv.additionalFeeAmount,
      depositType: inv.depositType || (job as any).depositType || prop.depositType,
      depositValue: inv.depositValue !== undefined ? inv.depositValue : ((job as any).depositValue !== undefined ? (job as any).depositValue : prop.depositValue),
      depositAmount: inv.depositAmount !== undefined ? inv.depositAmount : (inv.depositRequired !== undefined ? inv.depositRequired : ((job as any).depositAmount !== undefined ? (job as any).depositAmount : prop.depositAmount)),
      depositPaid: inv.depositPaid !== undefined ? inv.depositPaid : ((job as any).depositPaid !== undefined ? (job as any).depositPaid : prop.depositPaid),
      depositPaidAmount: inv.depositPaidAmount !== undefined ? inv.depositPaidAmount : ((job as any).depositPaidAmount !== undefined ? (job as any).depositPaidAmount : prop.depositPaidAmount),
      depositNotes: inv.depositNotes || (job as any).depositNotes || prop.depositNotes || '',
      amountPaid: inv.amountPaid !== undefined ? inv.amountPaid : (job as any).amountPaid,
      amountRefunded: inv.amountRefunded !== undefined ? inv.amountRefunded : (job as any).amountRefunded,
      netPaid: inv.netPaid !== undefined ? inv.netPaid : (job as any).netPaid,
      payments: Array.isArray(inv.payments) ? inv.payments : (Array.isArray((job as any).payments) ? (job as any).payments : []),
      refunds: Array.isArray(inv.refunds) ? inv.refunds : (Array.isArray((job as any).refunds) ? (job as any).refunds : []),
      paymentTerms: inv.paymentTerms || (job as any).paymentTerms || prop.paymentTerms || (organization as any)?.paymentTerms || 'due_upon_receipt',
      status: inv.status || (job as any).status,
      retainagePercent: inv.retainagePercent || (job as any).retainagePercent
    });
  }, [job, proposal, organization]);

  // Serviced Equipment resolution
  const servicedEquipment = useMemo(() => {
    if (!job) return [];
    const jobWithCust = { 
      ...job, 
      customer: customer || (job as any).customer, 
      customerEquipment: customer?.equipment || (job as any).customerEquipment 
    };
    return getJobServicedEquipment(jobWithCust);
  }, [job, customer]);

  // Scope, Diagnostic, and Customer/Work Order Notes resolution
  const scopeAndDiagnosticNotes = useMemo(() => {
    if (!job) return { diagnostic: '', workNotes: '', recommendations: '', instructions: '', locationPo: '' };
    
    const diagnostic = (
      typeof job.notes?.diagnosis === 'string' && job.notes.diagnosis ? job.notes.diagnosis :
      typeof (job.notes as any)?.arrival === 'string' && (job.notes as any).arrival ? (job.notes as any).arrival :
      typeof (job.notes as any)?.arrivalNotes === 'string' && (job.notes as any).arrivalNotes ? (job.notes as any).arrivalNotes :
      typeof (job as any).diagnosis === 'string' && (job as any).diagnosis ? (job as any).diagnosis :
      typeof (job as any)?.diagnosticNotes === 'string' && (job as any).diagnosticNotes ? (job as any).diagnosticNotes :
      (job.specialInstructions && typeof job.specialInstructions === 'string' && job.specialInstructions.includes('[Diagnostic Notes') ? job.specialInstructions.split('[Diagnostic Notes')[1]?.replace(/^[^\]]*\]:?\s*/, '').trim() : '') ||
      ''
    );

    const workNotes = (
      typeof job.notes?.workNotes === 'string' && job.notes.workNotes ? job.notes.workNotes :
      typeof (job.notes as any)?.work === 'string' && (job.notes as any).work ? (job.notes as any).work :
      typeof job.notes?.completion === 'string' && job.notes.completion ? job.notes.completion :
      typeof (job as any).workNotes === 'string' && (job as any).workNotes ? (job as any).workNotes :
      typeof (job as any)?.completionNotes === 'string' && (job as any).completionNotes ? (job as any).completionNotes :
      typeof job.notes === 'string' && job.notes ? job.notes :
      ''
    );

    const recommendations = (
      typeof job.invoice?.recommendations === 'string' && job.invoice.recommendations ? job.invoice.recommendations :
      typeof (job.invoice as any)?.notes === 'string' && (job.invoice as any).notes ? (job.invoice as any).notes :
      typeof (job.notes as any)?.recommendations === 'string' && (job.notes as any).recommendations ? (job.notes as any).recommendations :
      typeof (job as any)?.recommendations === 'string' && (job as any).recommendations ? (job as any).recommendations :
      typeof proposal?.recommendations === 'string' && proposal.recommendations ? proposal.recommendations :
      typeof proposal?.notes === 'string' && proposal.notes ? proposal.notes :
      ''
    );

    const instructions = (
      typeof job.specialInstructions === 'string' && job.specialInstructions ? job.specialInstructions :
      typeof (job as any)?.customerInstructions === 'string' && (job as any).customerInstructions ? (job as any).customerInstructions :
      typeof (job as any)?.propertyInstructions === 'string' && (job as any).propertyInstructions ? (job as any).propertyInstructions :
      ''
    );

    const locationPo = (
      (job as any)?.serviceLocationPoNumber ||
      (job.invoice as any)?.serviceLocationPoNumber ||
      (job as any)?.locationNumber ||
      (job as any)?.storeNumber ||
      customer?.serviceLocations?.find((loc: any) => loc.id === (job as any).locationId || loc.name === (job as any).serviceLocationName)?.poNumber ||
      ''
    );

    return { diagnostic, workNotes, recommendations, instructions, locationPo };
  }, [job, customer, proposal]);

  // Automatically select deposit payment option when deposit is required and unpaid
  useEffect(() => {
    if (canonical && canonical.depositRequired > 0 && !canonical.depositPaid) {
      setPaymentOption('deposit');
    } else {
      setPaymentOption('full');
    }
  }, [canonical?.depositRequired, canonical?.depositPaid]);

  // Progressive Billing calculations for Commercial Invoices
  const progressiveData = useMemo(() => {
      if (!job) return null;
      
      const rawItems = job.invoice?.items || [];
      
      // Map contracted items (Labor/Service or custom progressive fields)
      const contractedItems = rawItems.filter((item: any) => 
          item.type === 'Labor' || item.type === 'Service' || item.phase || item.percentThisPeriod !== undefined || (!item.type && (item.name?.toLowerCase().includes('diagnostic') || item.name?.toLowerCase().includes('service') || item.name?.toLowerCase().includes('repair') || item.description?.toLowerCase().includes('diagnostic') || item.description?.toLowerCase().includes('labor')))
      ).map((item: any, idx: number) => {
          const budgetedAmount = item.budgetedAmount || item.total || 0;
          const percentPreviouslyBilled = item.percentPreviouslyBilled !== undefined ? item.percentPreviouslyBilled : 0;
          const percentThisPeriod = item.percentThisPeriod !== undefined ? item.percentThisPeriod : 100;
          const phase = item.phase || `${idx + 1}.0`;
          return {
              id: item.id || `contracted-${idx}`,
              phase,
              name: item.name || item.description?.split('\n')[0] || '',
              description: item.description || '',
              budgetedAmount,
              percentPreviouslyBilled,
              percentThisPeriod,
              total: roundTo2Decimals(item.total !== undefined ? item.total : (budgetedAmount * (percentThisPeriod / 100)))
          };
      });

      // Map material/logistics items
      const materialItems = rawItems.filter((item: any) => 
          !(item.type === 'Labor' || item.type === 'Service' || item.phase || item.percentThisPeriod !== undefined || (!item.type && (item.name?.toLowerCase().includes('diagnostic') || item.name?.toLowerCase().includes('service') || item.name?.toLowerCase().includes('repair') || item.description?.toLowerCase().includes('diagnostic') || item.description?.toLowerCase().includes('labor'))))
      ).map((item: any, idx: number) => ({
          id: item.id || `mat-${idx}`,
          name: item.name || item.description?.split('\n')[0] || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || (item.quantity ? roundTo2Decimals((item.total || 0) / item.quantity) : (item.total || 0)),
          total: roundTo2Decimals(item.total !== undefined ? item.total : ((item.unitPrice || 0) * (item.quantity || 1)))
      }));

      // If rawItems was empty or fallback, populate contractedItems with tasks fallback
      if (contractedItems.length === 0 && materialItems.length === 0) {
          const fallbackTotal = job ? (job.invoice ? (typeof job.invoice.totalAmount === 'number' ? job.invoice.totalAmount : (job.invoice.amount || 0)) : (job.total || 0)) : 0;
          contractedItems.push({
              id: 'fallback-1',
              phase: '1.0',
              name: job.tasks?.join(', ') || 'HVAC Diagnostic & Service Call',
              description: job.specialInstructions || 'Performed HVAC diagnostic & repair service.',
              budgetedAmount: fallbackTotal,
              percentPreviouslyBilled: 0,
              percentThisPeriod: 100,
              total: fallbackTotal
          });
      }

      // Math totals
      const additionalFeePercent = job.invoice?.additionalFeePercent !== undefined ? job.invoice.additionalFeePercent : 0;
      const additionalFeeName = job.invoice?.additionalFeeName || '';

      // Base values
      const baseContractValue = contractedItems.reduce((sum, item) => sum + item.budgetedAmount, 0) + 
                                materialItems.reduce((sum, item) => sum + item.total, 0);
      const contractAdditionalFee = roundTo2Decimals(baseContractValue * (additionalFeePercent / 100));
      const totalContractValue = canonical ? canonical.grandTotal : roundTo2Decimals(baseContractValue + contractAdditionalFee);

      const basePreviouslyBilled = contractedItems.reduce((sum, item) => sum + (item.budgetedAmount * (item.percentPreviouslyBilled / 100)), 0);
      const baseBilledThisPeriod = contractedItems.reduce((sum, item) => sum + item.total, 0) + 
                                   materialItems.reduce((sum, item) => sum + item.total, 0);

      const additionalFeeAmount = roundTo2Decimals(baseBilledThisPeriod * (additionalFeePercent / 100));
      const previouslyBilledFee = roundTo2Decimals(basePreviouslyBilled * (additionalFeePercent / 100));

      const previouslyBilledVal = roundTo2Decimals(basePreviouslyBilled + previouslyBilledFee);
      const totalBilledToDate = roundTo2Decimals(previouslyBilledVal + baseBilledThisPeriod + additionalFeeAmount);

      const retainagePercent = (job.invoice as any)?.retainagePercent !== undefined ? (job.invoice as any).retainagePercent : 0;
      const retainageAmount = roundTo2Decimals(totalBilledToDate * (retainagePercent / 100));

      const paymentsPreviouslyReceived = job.invoice?.amountPaid !== undefined 
          ? roundTo2Decimals(Math.max(0, job.invoice.amountPaid - roundTo2Decimals(baseBilledThisPeriod + additionalFeeAmount - roundTo2Decimals((baseBilledThisPeriod + additionalFeeAmount) * (retainagePercent / 100)))))
          : roundTo2Decimals(Math.max(0, previouslyBilledVal - roundTo2Decimals(previouslyBilledVal * (retainagePercent / 100))));

      const currentAmountDue = canonical ? canonical.balanceDue : roundTo2Decimals(Math.max(0, totalBilledToDate - retainageAmount - paymentsPreviouslyReceived));
      const balanceDue = roundTo2Decimals(currentAmountDue);
      const remainingUnbilledBalance = roundTo2Decimals(Math.max(0, totalContractValue - totalBilledToDate));

      return {
          contractedItems,
          materialItems,
          totalContractValue,
          totalBilledToDate,
          retainagePercent,
          retainageAmount,
          paymentsPreviouslyReceived,
          currentAmountDue,
          balanceDue,
          remainingUnbilledBalance,
          additionalFeePercent,
          additionalFeeName,
          additionalFeeAmount
      };
  }, [isCommercialInvoice, job, proposal, customer, canonical]);

  const safeTotal = canonical ? canonical.grandTotal : (job ? (job.invoice ? (typeof job.invoice.totalAmount === 'number' ? job.invoice.totalAmount : (job.invoice.amount || 0)) : (job.total || 0)) : 0);
  const amountPaid = canonical ? canonical.amountPaid : (job?.invoice.amountPaid || 0);
  const standardBalanceDue = canonical ? canonical.balanceDue : Math.max(0, safeTotal - amountPaid);
  const baseBalanceDue = isCommercialInvoice && progressiveData ? progressiveData.balanceDue : standardBalanceDue;

  const overdueDetails = useMemo(() => {
      if (!job?.invoice?.dueDate || job?.invoice?.status === 'Paid') {
          return { overdueDays: 0, lateFeeAmountApplied: 0, interestAmountApplied: 0, totalLateFees: 0 };
      }
      
      const today = new Date();
      let dueDateObj = new Date(job.invoice?.dueDate || '');
      if (typeof job.invoice?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(job.invoice.dueDate)) {
          dueDateObj = new Date(job.invoice.dueDate.replace(/-/g, '/'));
      }
      dueDateObj.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const msPerDay = 24 * 60 * 60 * 1000;
      const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / msPerDay));
      
      const activeOrg = organization;
      const gracePeriod = activeOrg?.lateFeeGracePeriod || 0;
      if (isNaN(overdueDays) || overdueDays <= gracePeriod) {
          return { overdueDays: isNaN(overdueDays) ? 0 : overdueDays, lateFeeAmountApplied: 0, interestAmountApplied: 0, totalLateFees: 0 };
      }
      
      let lateFeeAmountApplied = 0;
      let interestAmountApplied = 0;
      
      if (activeOrg?.lateFeeEnabled) {
          if (activeOrg.lateFeeType === 'flat') {
              lateFeeAmountApplied = activeOrg.lateFeeValue || 0;
          } else if (activeOrg.lateFeeType === 'percent') {
              lateFeeAmountApplied = baseBalanceDue * ((activeOrg.lateFeeValue || 0) / 100);
          }
      }
      
      if (activeOrg?.lateFeeInterestRate > 0) {
          interestAmountApplied = baseBalanceDue * ((activeOrg.lateFeeInterestRate) / 100) * (overdueDays / 30);
      }
      
      const roundedLateFee = roundTo2Decimals(lateFeeAmountApplied);
      const roundedInterest = roundTo2Decimals(interestAmountApplied);
      const totalLateFees = roundTo2Decimals(roundedLateFee + roundedInterest);
      
      return {
          overdueDays,
          lateFeeAmountApplied: roundedLateFee,
          interestAmountApplied: roundedInterest,
          totalLateFees
      };
  }, [job, organization, baseBalanceDue]);

  const resolveAndFormatAddress = (
      addrInput: any,
      targetCustomer?: any,
      targetLocHint?: any
  ): string => {
      let street = '';
      let city = '';
      let state = '';
      let zip = '';

      if (typeof addrInput === 'object' && addrInput !== null) {
          street = addrInput.street || addrInput.address || addrInput.streetAddress || addrInput.address1 || '';
          city = addrInput.city || '';
          state = addrInput.state || addrInput.province || '';
          zip = addrInput.zip || addrInput.zipCode || addrInput.postalCode || '';
      } else if (typeof addrInput === 'string') {
          street = addrInput.trim();
      }

      const locs = [
          ...(targetCustomer?.serviceLocations || []),
          ...(targetCustomer?.locations || []),
          ...(customer?.serviceLocations || []),
          ...(customer?.locations || []),
          ...(parentCustomer?.serviceLocations || []),
          ...(parentCustomer?.locations || [])
      ];

      let matched: any = null;
      if (street) {
          const sLower = street.toLowerCase();
          matched = locs.find(l => {
              if (!l || !l.address) return false;
              const lAddr = String(l.address).toLowerCase().trim();
              return sLower === lAddr || sLower.includes(lAddr) || lAddr.includes(sLower);
          });
      }
      if (!matched && targetLocHint && typeof targetLocHint === 'object') {
          matched = targetLocHint;
      }

      if (matched) {
          if (!street || (!street.toLowerCase().includes(String(matched.address || '').toLowerCase()) && !String(matched.address || '').toLowerCase().includes(street.toLowerCase()))) {
              if (matched.address && !street) street = matched.address;
          } else if (matched.address) {
              street = matched.address;
          }
          if (!city) city = matched.city || '';
          if (!state) state = matched.state || matched.province || '';
          if (!zip) zip = matched.zip || matched.zipCode || '';
      }

      if (!city && (targetCustomer?.city || customer?.city)) city = targetCustomer?.city || customer?.city;
      if (!state && (targetCustomer?.state || customer?.state)) state = targetCustomer?.state || customer?.state;
      if (!zip && (targetCustomer?.zip || customer?.zip)) zip = targetCustomer?.zip || customer?.zip;

      const cityStateParts: string[] = [];
      if (city) cityStateParts.push(city);
      let stateZip = '';
      if (state) stateZip += state;
      if (zip) stateZip += (stateZip ? ` ${zip}` : zip);
      if (stateZip) cityStateParts.push(stateZip);

      const cityStateZipStr = cityStateParts.join(', ').trim();
      if (street && cityStateZipStr && !street.toLowerCase().includes(city.toLowerCase())) {
          return `${street}, ${cityStateZipStr}`;
      }
      return street || cityStateZipStr || 'Address on file';
  };

  const headerDetails = useMemo(() => {
      if (!job) return {};

      const rawCAddr = customer?.address || (job as any)?.customerAddress || (proposal as any)?.customerAddress || (proposal as any)?.clientAddress || job.address;
      const cAddrStr = typeof rawCAddr === 'object' ? `${rawCAddr.street || ''} ${rawCAddr.city || ''} ${rawCAddr.state || ''} ${rawCAddr.zip || ''}`.trim() : (rawCAddr || '');

      const hqLoc = (customer?.serviceLocations || []).find((l: any) => 
          (l.propertyName && l.propertyName.toLowerCase().includes('hq')) ||
          (customer?.address && l.address && String(customer.address).toLowerCase().includes(l.address.toLowerCase()))
      ) || (parentCustomer?.serviceLocations || []).find((l: any) => 
          (l.propertyName && l.propertyName.toLowerCase().includes('hq')) ||
          (customer?.address && l.address && String(customer.address).toLowerCase().includes(l.address.toLowerCase()))
      );

      // Box 3: Service Site Location
      const sLoc = (customer?.serviceLocations || []).find((l: any) => 
          (scopeAndDiagnosticNotes.locationPo && l.poNumber === scopeAndDiagnosticNotes.locationPo) ||
          (job?.locationId && l.id === job.locationId) ||
          (job?.address && l.address && String(job.address).toLowerCase().includes(String(l.address).toLowerCase()))
      ) || (proposal as any)?.serviceLocation || null;

      // Box 1: Customer / Property Mgr
      const cName = parentCustomer?.name || (customer as any)?.propertyManagementCompany || (customer as any)?.billingCompany || (job as any)?.customerPropertyManager || (job as any)?.parentCustomerName || customer?.name || job.customerName || (proposal as any)?.clientName || (proposal as any)?.customerName || (job as any)?.billToName || (proposal as any)?.billToName || (proposal as any)?.billingCompany || 'Customer / Property Manager';
      const rawCBoxAddr = parentCustomer?.address || (customer as any)?.propertyManagementAddress || (customer as any)?.billingAddress || (job as any)?.customerPropertyManagerAddress || customer?.address || (job as any)?.customerAddress || (proposal as any)?.customerAddress || (proposal as any)?.clientAddress || (job as any)?.billToAddress || (proposal as any)?.billToAddress || (proposal as any)?.billingAddress || cAddrStr;
      const cBoxAddrStr = resolveAndFormatAddress(rawCBoxAddr, parentCustomer || customer, hqLoc);

      // Box 2: Bill To (Paying Entity)
      const bName = job?.invoice?.billToName || (job as any)?.billToName || (proposal as any)?.billToName || (proposal as any)?.billingCompany || (customer as any)?.billingCompany || (sLoc?.billToSameAsSite ? (sLoc.billToName || sLoc.propertyName || sLoc.name) : null) || parentCustomer?.name || (customer as any)?.billingContact?.name || cName;
      const rawBAddr = job?.invoice?.billToAddress || (job as any)?.billToAddress || (proposal as any)?.billToAddress || (proposal as any)?.billingAddress || (customer as any)?.billingAddress || (sLoc?.billToSameAsSite ? (sLoc.billToAddress || sLoc.address) : null) || parentCustomer?.address || rawCBoxAddr;
      const bAddrStr = resolveAndFormatAddress(rawBAddr, customer || parentCustomer, (sLoc?.billToSameAsSite ? sLoc : (rawBAddr ? null : hqLoc)));

      const sName = (job as any)?.serviceLocationName || (job as any)?.locationName || (proposal as any)?.serviceLocationName || (proposal as any)?.siteName || (customer as any)?.siteName || (job.customerName !== bName ? job.customerName : customer?.name || job.customerName || 'Service Site Location');
      const rawSAddr = (job as any)?.serviceLocationAddress || (job as any)?.locationAddress || (proposal as any)?.serviceLocationAddress || (proposal as any)?.siteAddress || (proposal as any)?.locationAddress || job.address || cAddrStr;
      const sAddrStr = resolveAndFormatAddress(rawSAddr, customer, sLoc);

      const appt = job.appointmentTime ? new Date(job.appointmentTime).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const arrived = (job as any)?.geofenceEvents?.arrivedAt ? new Date((job as any).geofenceEvents.arrivedAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const departed = (job as any)?.geofenceEvents?.departedAt ? new Date((job as any).geofenceEvents.departedAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const durMinutes = (job as any)?.geofenceEvents?.durationMinutes || (job as any)?.timeOnSiteMinutes;
      const dur = durMinutes ? `${durMinutes}m` : null;

      const po = (job as any)?.poNumber || job.workOrderNumber || job.invoice?.poNumber || (proposal as any)?.poNumber;
      const tech = job.assignedTechnicianName || 'Technician';

      // Due Date resolution
      const rawDueDate = job?.invoice?.dueDate || (job as any)?.dueDate;
      const dueDateFormatted = rawDueDate 
        ? (/^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)
            ? new Date(rawDueDate.replace(/-/g, '/')).toLocaleDateString()
            : new Date(rawDueDate).toLocaleDateString())
        : (canonical?.isNetTerms ? canonical.paymentTermsLabel : (job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : 'Upon Receipt'));

      return {
          customerName: cName,
          customerAddress: cBoxAddrStr,
          billToName: bName,
          billToAddress: bAddrStr,
          serviceLocationName: sName,
          serviceLocationAddress: sAddrStr,
          appointmentTimeFormatted: appt,
          arrivedTimeFormatted: arrived,
          departedTimeFormatted: departed,
          durationFormatted: dur,
          poNumber: po,
          technicianName: tech,
          dueDateFormatted
      };
  }, [job, customer, parentCustomer, proposal, canonical, scopeAndDiagnosticNotes]);

  const pdfDetails = useMemo(() => {
    if (!job) return {};
    const inv: any = job.invoice || {};
    const org: any = currentActiveOrg || organization || {};

    const isTekAir = String(org.name || '').toLowerCase().includes('tekair') || org.id === 'org-1765817997819';
    const orgName = org.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
    const orgPhone = org.phone || (isTekAir ? '210-318-4197' : '');
    const orgEmail = org.email || (isTekAir ? 'Operations@tekairinc.com' : '');
    const licenseNumber = org.licenseNumber || org.taxId || (isTekAir ? 'TACLA73240E' : '');
    const complianceFooter = org.complianceFooter || org.footerText || org.regulatoryFooter || (isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '');
    const orgAddressStr = typeof org.address === 'object' 
      ? `${org.address.street || ''}, ${org.address.city || ''}, ${org.address.state || ''} ${org.address.zip || ''}`.replace(/^[\s,]+|[\s,]+$/g, '')
      : (org.address || (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : ''));

    const dispDocId = inv.invoiceNumber || inv.id || `INV-${job.id?.replace(/^job-/, '')}`;
    const dispJobNumber = job.jobNumber || (job.id?.startsWith('job-') ? job.id : `job-${job.id}`);
    const dispWoNumber = inv.workOrderNumber || job.workOrderNumber || (job as any).woNumber || job.poNumber || '567555';
    const custAccountNumber = inv.accountNumber || (job as any).accountNumber || (customer as any)?.accountNumber || 'ACT-59141';

    const dateStr = new Date(inv.date || job.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const siteVisitDateStr = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Aug 19, 2026';
    const dueDateStr = headerDetails.dueDateFormatted || 'Oct 1, 2026';

    const statusText = (job.invoice?.status === 'Paid' || success) ? 'PAID' : (canonical && canonical.amountPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

    return {
      orgName,
      orgPhone,
      orgEmail,
      licenseNumber,
      complianceFooter,
      orgAddressStr,
      dispDocId,
      dispJobNumber,
      dispWoNumber,
      custAccountNumber,
      dateStr,
      siteVisitDateStr,
      dueDateStr,
      statusText
    };
  }, [job, currentActiveOrg, organization, customer, headerDetails, success, canonical]);

  const sanitizeLineItemDescription = (desc?: string) => {
    if (!desc) return '';
    const m = desc.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
    if (m && m.index !== undefined) {
      return desc.substring(0, m.index).trim();
    }
    return desc.trim();
  };

  const effectiveWarranty = useMemo(() => {
    const raw = (
      (typeof (job?.invoice as any)?.warrantyTerms === 'string' && (job?.invoice as any).warrantyTerms) ||
      (typeof job?.invoice?.warrantyNotes === 'string' && job.invoice.warrantyNotes) ||
      (typeof (job as any)?.warrantyTerms === 'string' && (job as any).warrantyTerms) ||
      (typeof (job?.invoice as any)?.warranty === 'string' && (job?.invoice as any).warranty) ||
      (typeof (job as any)?.warranty === 'string' && (job as any).warranty) ||
      ''
    );
    if (raw) return raw;

    // Check if any invoice items have warranty text embedded
    if (job?.invoice?.items && Array.isArray(job.invoice.items)) {
      for (const it of job.invoice.items) {
        const d = typeof it?.description === 'string' ? it.description : '';
        const m = d.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
        if (m && m.index !== undefined) {
          return d.substring(m.index).trim();
        }
      }
    }

    const orgWarranty = (
      (typeof (currentActiveOrg as any)?.warrantyTerms === 'string' && (currentActiveOrg as any).warrantyTerms) ||
      (typeof (currentActiveOrg as any)?.warrantyDisclaimer === 'string' && (currentActiveOrg as any).warrantyDisclaimer) ||
      (typeof (organization as any)?.warrantyTerms === 'string' && (organization as any).warrantyTerms) ||
      (typeof (organization as any)?.warrantyDisclaimer === 'string' && (organization as any).warrantyDisclaimer) ||
      ''
    );
    return orgWarranty;
  }, [job, currentActiveOrg, organization]);

  const lineItems = useMemo(() => {
    if (job?.invoice?.items && job.invoice.items.length > 0) {
      return job.invoice.items;
    }
    return (job?.tasks || ['Service Provided']).map(t => ({
      name: t,
      description: '',
      quantity: 1,
      unitPrice: safeTotal,
      total: safeTotal
    }));
  }, [job, safeTotal]);

  const balanceDue = baseBalanceDue + overdueDetails.totalLateFees;
  const isPaid = job?.invoice.status === 'Paid' || (baseBalanceDue <= 0 && overdueDetails.totalLateFees <= 0) || success;
  
  const baseAmountToPay = (() => {
    if (paymentOption === 'deposit' && canonical && canonical.depositRequired > 0 && !canonical.depositPaid) {
      return canonical.amountDueToday;
    }
    if (paymentOption === 'custom' && customAmount) {
      return parseFloat(customAmount) || 0;
    }
    return baseBalanceDue;
  })();
  
  const tipAmount = useMemo(() => {
    if (tipOption === 'none') return 0;
    if (tipOption === '20') return 20;
    if (tipOption === '35') return 35;
    if (tipOption === '50') return 50;
    if (tipOption === 'custom') {
      const val = parseFloat(customTipAmount);
      return isNaN(val) || val <= 0 ? 0 : roundTo2Decimals(val);
    }
    return 0;
  }, [tipOption, customTipAmount]);
  
  const amountToPay = roundTo2Decimals(baseAmountToPay + overdueDetails.totalLateFees + tipAmount);

  if (loading) return <div className="p-4 md:p-10 text-center">Loading Invoice...</div>;
  if (pageLoadError) return <div className="p-4 md:p-10 text-center text-red-500">{pageLoadError}</div>;

  if (finished) {
      const activeReviewLink = organization?.reviewLinks?.google || organization?.reviewLink;
      return (
          <div className={`min-h-screen bg-slate-50/50 dark:bg-slate-950 py-12 px-4 flex flex-col items-center justify-center text-center ${isCommercialInvoice ? 'font-b2b' : 'font-b2c text-slate-800'}`}>
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Roboto:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                
                .font-b2c {
                    font-family: 'Roboto', 'Montserrat', sans-serif;
                }
                .font-b2c h1, .font-b2c h2, .font-b2c h3, .font-b2c h4, .font-b2c .b2c-title {
                    font-family: 'Montserrat', sans-serif;
                }
                
                .font-b2b {
                    font-family: 'Inter', sans-serif;
                }
              `}</style>
              <Card className={`max-w-md w-full p-10 space-y-6 relative overflow-hidden border-t-4 ${isCommercialInvoice ? 'border-t-[#1A2E40] rounded-none' : 'border-t-[#2C5E43] rounded-[2rem]'}`}>
                  {organization?.logoUrl && (
                      <img 
                          src={organization.logoUrl} 
                          alt="" 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] opacity-[0.04] pointer-events-none -rotate-12 z-0" 
                      />
                  )}
                  <div className="relative z-10 space-y-6">
                      <div className={`w-20 h-20 text-white rounded-full flex items-center justify-center mx-auto shadow-xl animate-bounce-short ${isCommercialInvoice ? 'bg-[#1A2E40] shadow-blue-900/20' : 'bg-[#2C5E43] shadow-emerald-950/20'}`}>
                          <CheckCircle size={40}/>
                      </div>
                      <div>
                          <h2 className={`text-3xl font-black text-slate-900 tracking-tight ${isB2CInvoice ? 'b2c-title text-[#2C5E43]' : ''}`}>All Set!</h2>
                          <p className="text-slate-500 font-medium mt-2">Thank you for your business. You may now close this window.</p>
                      </div>
                      
                      {isB2CInvoice && activeReviewLink && (
                          <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                              <h4 className="b2c-title text-xs font-black text-[#2C5E43] uppercase tracking-wider mb-2">
                                  🌟 Happy with our service today?
                              </h4>
                              <p className="text-[10px] text-slate-550 leading-relaxed mb-3">
                                  If our lead professional did an outstanding job, please consider leaving us a 5-star review on Google! It helps our local, family-owned business immensely.
                              </p>
                              <a 
                                  href={activeReviewLink}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-2 bg-[#F59E0B] hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-amber-500/20 no-underline"
                              >
                                  👉 Click here to review us on Google!
                              </a>
                          </div>
                      )}

                      <div className="pt-4 space-y-3">
                          <Button onClick={() => { setIsPreviewOpen(true); setAutoPrint(true); }} variant="secondary" className="w-full flex items-center justify-center gap-2 h-12 text-xs font-black uppercase">
                              <Printer size={18}/> Print Final Receipt
                          </Button>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest pt-4">Transaction ID: {job?.id?.substring(0,12)}</p>
                      </div>
                  </div>
              </Card>
              {isPreviewOpen && job && organization && (
                  <React.Suspense fallback={null}>
                      <DocumentPreview 
                          type="Invoice"
                          onClose={() => { setIsPreviewOpen(false); setAutoPrint(false); }} 
                          data={job} 
                          organization={organization}
                      />
                  </React.Suspense>
              )}
          </div>
      );
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 dark:bg-slate-950 py-4 md:py-8 px-4 flex flex-col items-center ${isCommercialInvoice ? 'font-b2b' : 'font-b2c text-slate-800'}`}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Roboto:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
          
          .font-b2c {
              font-family: 'Roboto', 'Montserrat', sans-serif;
          }
          .font-b2c h1, .font-b2c h2, .font-b2c h3, .font-b2c h4, .font-b2c .b2c-title {
              font-family: 'Montserrat', sans-serif;
          }
          
          .font-b2b {
              font-family: 'Inter', sans-serif;
          }
        `}</style>
        
        <Card className={`max-w-4xl w-full overflow-hidden mb-6 relative border-t-4 shadow-xl ${isCommercialInvoice ? 'border-t-[#1A2E40] bg-white rounded-none' : 'border-t-[#2C5E43] bg-white rounded-[2rem]'}`}>
            {/* Watermarks - Multi-Pattern for branding consistency */}
            {(currentActiveOrg?.logoUrl || currentActiveOrg?.letterheadDataUrl) && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                    <img 
                        src={currentActiveOrg.logoUrl || currentActiveOrg.letterheadDataUrl || ''} 
                        alt="" 
                        className="doc-watermark absolute top-[15%] left-[10%] w-[35%] opacity-[0.05] -rotate-12" 
                    />
                    <img 
                        src={currentActiveOrg.logoUrl || currentActiveOrg.letterheadDataUrl || ''} 
                        alt="" 
                        className="doc-watermark absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] opacity-[0.05] -rotate-12" 
                    />
                    <img 
                        src={currentActiveOrg.logoUrl || currentActiveOrg.letterheadDataUrl || ''} 
                        alt="" 
                        className="doc-watermark absolute bottom-[15%] right-[10%] w-[35%] opacity-[0.05] -rotate-12" 
                    />
                </div>
            )}
            <div className="relative z-10 bg-white">
                {/* 1. PDF Header (Company Info on Left, Document & Job Meta on Right) */}
                <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 border-b border-slate-100 text-left">
                    <div className="space-y-1.5 max-w-sm">
                        {currentActiveOrg?.logoUrl && (
                            <img 
                                src={currentActiveOrg.logoUrl} 
                                className="h-12 w-auto object-contain max-w-[200px] mb-2" 
                                alt={pdfDetails.orgName} 
                            />
                        )}
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">{pdfDetails.orgName}</h1>
                        <p className="text-xs text-slate-500 leading-normal">{pdfDetails.orgAddressStr}</p>
                        <p className="text-xs text-slate-500">Phone: {pdfDetails.orgPhone} &bull; Email: {pdfDetails.orgEmail}</p>
                        {pdfDetails.licenseNumber && (
                            <p className="text-xs font-bold text-slate-800">License #: {pdfDetails.licenseNumber}</p>
                        )}
                    </div>

                    <div className="text-left md:text-right space-y-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                            {pdfDetails.statusText === 'PAID' ? 'RECEIPT' : 'INVOICE'}
                        </h2>
                        <p className="text-xs font-bold text-[#4F46E5]">DOCUMENT #: {pdfDetails.dispDocId}</p>
                        {pdfDetails.dispJobNumber && <p className="text-xs font-bold text-slate-900">Job #: {pdfDetails.dispJobNumber}</p>}
                        {pdfDetails.dispWoNumber && <p className="text-xs font-bold text-slate-900">WO #: {pdfDetails.dispWoNumber}</p>}
                        {pdfDetails.custAccountNumber && <p className="text-xs font-bold text-[#4F46E5]">Account #: {pdfDetails.custAccountNumber}</p>}
                        
                        <div className="pt-1 text-xs text-slate-500 space-y-0.5">
                            <p>Date: {pdfDetails.dateStr}</p>
                            <p>Site Visit Date: {pdfDetails.siteVisitDateStr}</p>
                            <p>Due Date: {pdfDetails.dueDateStr}</p>
                        </div>

                        <div className="pt-2 flex md:justify-end">
                            <span className={`inline-block px-4 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                pdfDetails.statusText === 'PAID' 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : pdfDetails.statusText === 'PARTIALLY PAID'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-sky-100 text-sky-800 border border-sky-200'
                            }`}>
                                STATUS: {pdfDetails.statusText}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. 3-Card Entity Layout (1. Customer / Property Mgr | 2. Bill To | 3. Service Site Location) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 text-xs address-grid">
                    {/* Card 1: Customer / Property Mgr */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 text-left shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#4F46E5]">1. CUSTOMER / PROPERTY MGR</div>
                        <div className="font-bold text-sm text-slate-900">{headerDetails.customerName}</div>
                        <div className="text-slate-600 leading-relaxed">{headerDetails.customerAddress || 'Address on file'}</div>
                    </div>

                    {/* Card 2: Bill To (Paying Entity) */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 text-left shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#10B981]">2. BILL TO (PAYING ENTITY)</div>
                            <div className="font-bold text-sm text-slate-900">{headerDetails.billToName}</div>
                            <div className="text-slate-600 leading-relaxed">{headerDetails.billToAddress || headerDetails.customerAddress || 'Address on file'}</div>
                        </div>
                        {pdfDetails.dispWoNumber && (
                            <div className="text-xs font-bold text-slate-700 pt-2">
                                WO #: {pdfDetails.dispWoNumber}
                            </div>
                        )}
                    </div>

                    {/* Card 3: Service Site Location */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 text-left shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#0284C7]">3. SERVICE SITE LOCATION</div>
                        <div className="font-bold text-sm text-slate-900">{headerDetails.serviceLocationName}</div>
                        <div className="text-slate-600 leading-relaxed">{headerDetails.serviceLocationAddress || headerDetails.customerAddress || 'Address on file'}</div>
                        <div className="pt-2 text-slate-600 text-[11px] space-y-0.5">
                            {pdfDetails.siteVisitDateStr && <div>Appt: {pdfDetails.siteVisitDateStr}</div>}
                            {headerDetails.technicianName && <div>Tech: {headerDetails.technicianName}</div>}
                            {scopeAndDiagnosticNotes.locationPo && <div className="font-bold text-slate-800">Site PO #: {scopeAndDiagnosticNotes.locationPo}</div>}
                        </div>
                    </div>
                </div>

                {/* Proposal / Estimate Link (if available) */}
                {job?.proposalId && (
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between no-print text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                            <FileText size={14} className="text-[#4F46E5]" />
                            <span>Based on Approved Proposal: <strong>{proposal?.title || job.proposalId}</strong></span>
                        </div>
                        <a 
                            href={`/#/proposal-view/${job.proposalId}`} 
                            className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg no-underline transition-all shadow-sm"
                        >
                            View Estimate
                        </a>
                    </div>
                )}

                {/* 3. Items Table */}
                <div className="p-6 md:p-8 space-y-4 text-left">
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white text-xs shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                                    <th className="p-3.5 uppercase tracking-wider">DESCRIPTION OF SERVICE / ITEMS</th>
                                    <th className="p-3.5 uppercase tracking-wider text-center w-16">QTY</th>
                                    <th className="p-3.5 uppercase tracking-wider text-right w-28">UNIT PRICE</th>
                                    <th className="p-3.5 uppercase tracking-wider text-right w-28">LINE TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="p-3.5 text-left">
                                            <div className="font-bold text-slate-900 text-sm">{item.name || item.title || sanitizeLineItemDescription(item.description)?.split('\n')[0] || 'Service Item'}</div>
                                            {sanitizeLineItemDescription(item.description) && sanitizeLineItemDescription(item.description) !== item.name && (
                                                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{sanitizeLineItemDescription(item.description)}</div>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-center font-mono text-slate-700">{item.quantity || 1}</td>
                                        <td className="p-3.5 text-right font-mono text-slate-700">${(item.unitPrice || 0).toFixed(2)}</td>
                                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">${(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Side-by-Side Balanced Payment Terms & Financial Totals Block */}
                <div className="mx-6 md:mx-8 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {/* Left Column: Payment & Deposit Terms */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-left shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                                <span>💳</span>
                                <span>Payment &amp; Deposit Terms</span>
                            </div>
                            {canonical?.depositNotes ? (
                                <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-wrap font-medium">
                                    {canonical.depositNotes}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {canonical?.isNetTerms
                                        ? `Payment terms are ${canonical.paymentTerms.replace('_', ' ').toUpperCase()} from date of invoice completion.`
                                        : 'Payment is due in full upon completion and testing of all authorized services unless otherwise specified in writing.'}
                                </p>
                            )}
                        </div>
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider">Billing Schedule:</span>
                            <span className="font-bold text-slate-800">
                                {canonical?.depositPaid ? 'Deposit Verified' : (canonical?.depositRequired > 0 ? 'Deposit Required' : 'Standard Terms')}
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Financial Totals */}
                    <div className="w-full font-sans text-xs space-y-2 text-right">
                        <div className="flex justify-between text-slate-600">
                            <span className="font-bold">Subtotal:</span>
                            <span className="font-mono font-bold text-slate-900">${(canonical?.subtotal || safeTotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span className="font-bold">Sales Tax ({(canonical?.taxRatePercent || 0).toFixed(2)}%):</span>
                            <span className="font-mono font-bold text-slate-900">${(canonical?.taxAmount || 0).toFixed(2)}</span>
                        </div>
                        {canonical?.additionalFeeAmount ? (
                            <div className="flex justify-between text-slate-600">
                                <span className="font-bold">{canonical.additionalFeeName || 'Adjustment'}:</span>
                                <span className="font-mono font-bold text-slate-900">{canonical.additionalFeeAmount > 0 ? '+' : ''}${canonical.additionalFeeAmount.toFixed(2)}</span>
                            </div>
                        ) : null}

                        {/* Yellow Highlighted Deposit Breakdown Card */}
                        {canonical && canonical.depositRequired > 0 && !canonical.depositPaid && canonical.amountDueToday > 0 && (
                            <div className="p-3 bg-[#FEF3C7] border border-[#FBBF24] rounded-xl my-2 space-y-1.5 text-right shadow-sm">
                                <div className="flex justify-between items-center text-[#B45309] font-bold text-sm">
                                    <span className="uppercase">DEPOSIT DUE TODAY:</span>
                                    <span className="font-mono text-base font-black">${canonical.amountDueToday.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-700 font-bold text-xs">
                                    <span className="uppercase">FINAL BALANCE DUE ({canonical.isNetTerms ? canonical.paymentTerms.replace('_', ' ').toUpperCase() : 'UPON COMPLETION'}):</span>
                                    <span className="font-mono text-sm">${canonical.amountDueNet.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900">
                            <span className="font-black text-sm text-slate-900 uppercase">GRAND TOTAL:</span>
                            <span className="font-mono font-black text-2xl text-[#0284C7]">${(canonical?.grandTotal || safeTotal).toFixed(2)}</span>
                        </div>
                        {canonical?.amountRefunded && canonical.amountRefunded > 0 ? (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-emerald-700 text-xs font-bold">
                                    <span className="uppercase">TOTAL PAYMENTS COLLECTED:</span>
                                    <span className="font-mono text-emerald-800">-${canonical.amountPaid.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-rose-600 text-xs font-bold">
                                    <span className="uppercase">OVERPAYMENT REFUND ISSUED:</span>
                                    <span className="font-mono text-rose-600">+${canonical.amountRefunded.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-800 text-xs font-black pt-1 border-t border-slate-200">
                                    <span className="uppercase">NET AMOUNT PAID:</span>
                                    <span className="font-mono text-emerald-800">-${canonical.netPaid.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (canonical?.depositPaid || (canonical?.amountPaid ?? 0) > 0 || amountPaid > 0) ? (
                            <div className="flex justify-between text-emerald-700 text-xs font-bold">
                                <span className="uppercase">{canonical?.depositPaid ? 'DEPOSIT PAID:' : 'PAID TO DATE:'}</span>
                                <span className="font-mono text-emerald-800">-${(canonical?.depositPaid ? canonical.depositPaidAmount : (canonical?.amountPaid || amountPaid)).toFixed(2)}</span>
                            </div>
                        ) : null}
                        <div className="flex justify-between items-center bg-[#FFF8DB] dark:bg-[#2A2415] border-2 border-[#D4AF37] p-3.5 rounded-xl shadow-sm mt-2">
                            <span className="uppercase font-black text-xs sm:text-sm text-[#8B6508] dark:text-[#F3C649]">{canonical?.isNetTerms ? `BALANCE DUE (${canonical.paymentTerms.replace('_', ' ').toUpperCase()}):` : 'TOTAL DUE:'}</span>
                            <span className="font-mono text-2xl font-black text-[#8B6508] dark:text-[#FFF8DB]">${(canonical?.balanceDue ?? safeTotal).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Payments & Refunds Transaction History Ledger */}
                {(() => {
                    const paymentsList = (job?.invoice?.payments && job.invoice.payments.length > 0)
                        ? job.invoice.payments
                        : (canonical?.payments && canonical.payments.length > 0)
                        ? canonical.payments
                        : ((job as any)?.payments && (job as any).payments.length > 0)
                        ? (job as any).payments
                        : [];
                    const refundsList = (job?.invoice?.refunds && job.invoice.refunds.length > 0)
                        ? job.invoice.refunds
                        : (canonical?.refunds && canonical.refunds.length > 0)
                        ? canonical.refunds
                        : ((job as any)?.refunds && (job as any).refunds.length > 0)
                        ? (job as any).refunds
                        : [];

                    if (paymentsList.length === 0 && refundsList.length === 0) return null;

                    return (
                        <div className="mx-6 md:mx-8 mb-6 p-5 bg-white border border-slate-200 rounded-xl text-left space-y-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                        💳
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                            Payment &amp; Refund Transaction History
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            Itemized record of all credit card payments, processing fee surcharges, and overpayment refunds.
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                    {paymentsList.length + refundsList.length} Transactions
                                </span>
                            </div>

                            <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                                            <th className="p-2.5">Date / Time</th>
                                            <th className="p-2.5">Transaction &amp; Details</th>
                                            <th className="p-2.5">Card / Reference</th>
                                            <th className="p-2.5 text-center">Status</th>
                                            <th className="p-2.5 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-sans">
                                        {paymentsList.map((pmt: any, pIdx: number) => (
                                            <tr key={pmt.id || `pmt-${pIdx}`} className="hover:bg-slate-50/60">
                                                <td className="p-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                                                    {pmt.date ? new Date(pmt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                </td>
                                                <td className="p-2.5">
                                                    <div className="font-bold text-slate-900 text-xs">
                                                        {pmt.notes || (pmt.baseAmount && pmt.fee ? `Card Payment ($${Number(pmt.baseAmount).toFixed(2)} + $${Number(pmt.fee).toFixed(2)} processing fee)` : 'Card Payment')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {pmt.method || 'Credit Card'}
                                                        {pmt.fee ? ` • Includes $${Number(pmt.fee).toFixed(2)} CC fee` : ''}
                                                    </div>
                                                </td>
                                                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                                                    {pmt.reference || pmt.paymentIntentId || '—'}
                                                </td>
                                                <td className="p-2.5 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        Paid ✓
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                                    +${Number(pmt.amount || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}

                                        {refundsList.map((ref: any, rIdx: number) => (
                                            <tr key={ref.id || `ref-${rIdx}`} className="bg-amber-50/40 hover:bg-amber-50/70 border-t border-amber-100">
                                                <td className="p-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                                                    {ref.date ? new Date(ref.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                </td>
                                                <td className="p-2.5">
                                                    <div className="font-bold text-rose-700 text-xs flex items-center gap-1.5">
                                                        <span>Overpayment Refund</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-600">
                                                        {ref.reason || ref.notes || 'Customer refund processed'}
                                                        {ref.method ? ` • ${ref.method}` : ''}
                                                    </div>
                                                </td>
                                                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                                                    {ref.reference || ref.refundId || '—'}
                                                </td>
                                                <td className="p-2.5 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                                        Refund Issued
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                                                    -${Number(ref.amount || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                                        <tr>
                                            <td colSpan={4} className="p-2.5 text-right text-slate-700 uppercase tracking-wider text-[11px]">
                                                Total Payments Collected:
                                            </td>
                                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                                ${(paymentsList.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || canonical?.amountPaid || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                        {refundsList.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={4} className="p-2 text-right text-rose-700 uppercase tracking-wider text-[11px]">
                                                        Overpayment Refund:
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-black text-rose-600">
                                                        -${(refundsList.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0) || canonical?.amountRefunded || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                                <tr className="border-t border-slate-300 bg-slate-100/80">
                                                    <td colSpan={4} className="p-2.5 text-right text-slate-900 font-black uppercase tracking-wider text-[11px]">
                                                        Net Customer Remittance:
                                                    </td>
                                                    <td className="p-2.5 text-right font-mono font-black text-slate-900">
                                                        ${(canonical?.netPaid ?? safeTotal).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* 5. Customer Authorization Box & Signature (Positioned directly above Notes & Warranty) */}
                <div className="mx-6 md:mx-8 mb-6 p-5 bg-white border border-slate-200 rounded-xl text-left space-y-3 shadow-sm">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <span className="font-bold text-slate-900 text-xs">{job?.invoiceSignature ? 'CUSTOMER AUTHORIZATION (SIGNED)' : 'CUSTOMER AUTHORIZATION'}</span>
                        <span className="font-bold text-slate-900">{pdfDetails.orgName}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        By signing below, customer acknowledges that all work and equipment listed above have been performed and completed satisfactorily, and agrees to the payment terms specified.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                        <div className="space-y-1">
                            {job?.invoiceSignature ? (
                                <img 
                                    src={job.invoiceSignature} 
                                    alt="Customer Signature" 
                                    className="h-12 max-w-[220px] object-contain border-b border-slate-300"
                                />
                            ) : (
                                <div className="h-10 flex items-center text-xs font-bold text-slate-400 italic">
                                    AWAITING SIGNATURE UPON PAYMENT
                                </div>
                            )}
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                AUTHORIZED BILLER / CUSTOMER SIGNATURE
                            </div>
                        </div>
                        <div className="space-y-1 sm:text-right">
                            <div className="text-xs font-mono font-bold text-slate-700">
                                {pdfDetails.dateStr}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                DATE
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. Technician Recommendations & Work Notes Box */}
                {scopeAndDiagnosticNotes.recommendations && (
                    <div className="mx-6 md:mx-8 mb-6 p-4 bg-[#F8FAFC] border border-slate-200 rounded-xl text-left border-l-4 border-l-[#10B981] shadow-sm">
                        <h4 className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
                            TECHNICIAN RECOMMENDATIONS & WORK NOTES
                        </h4>
                        <div className="text-xs italic text-slate-700 leading-relaxed whitespace-pre-wrap mt-2">
                            {scopeAndDiagnosticNotes.recommendations}
                        </div>
                    </div>
                )}

                {/* 7. Dedicated Full-Width Warranty Terms & Service Guarantee Card */}
                {effectiveWarranty && (
                    <div className="mx-6 md:mx-8 mb-6 p-4 bg-[#F8FAFC] border border-slate-200 rounded-xl text-left border-l-4 border-l-[#4F46E5] shadow-sm">
                        <h4 className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider">
                            WARRANTY TERMS & SERVICE GUARANTEE
                        </h4>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mt-2">
                            {effectiveWarranty}
                        </div>
                    </div>
                )}

                {/* 8. Terms & Conditions & Payment Instructions */}
                <div className="mx-6 md:mx-8 mb-6 pt-6 border-t border-slate-200 text-left space-y-4 text-xs text-slate-600">
                    <div className="space-y-2 text-[11px] leading-relaxed text-slate-500 pt-2 border-t border-slate-100">
                        <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">TERMS & CONDITIONS &bull; Payment Terms & Ownership</div>
                        <p><strong>PAYMENT:</strong> Payment is due upon receipt unless otherwise noted. A service charge of 1.5% per month (18% annual percentage rate) will be added to all past due balances. In the event of default, the customer agrees to pay all costs of collection, including reasonable attorney's fees and court costs.</p>
                        <p><strong>OWNERSHIP & REPOSSESSION:</strong> All materials and equipment remain the property of {pdfDetails.orgName} until the invoice is paid in full. We reserve the right to remove installed equipment if payment is not received in accordance with these terms.</p>
                        <p><strong>WORKMANSHIP & WARRANTY:</strong> {pdfDetails.orgName} warrants that all work performed was done in a workmanlike manner. Any claim for defective workmanship must be made in writing within 30 days of completion. Manufacturer warranties apply to parts and equipment where applicable; {pdfDetails.orgName} makes no additional warranties, express or implied, regarding equipment performance beyond manufacturer specifications.</p>
                    </div>

                    {/* Direct Remittance & Payment Instructions */}
                    {(organization?.acceptCheck !== false || organization?.acceptWire || organization?.acceptAch) && (
                        <div className="space-y-1.5 text-[10px] leading-relaxed text-slate-600 pt-2 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl">
                            <div className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5 text-[#123A63]">
                                <Building2 size={13} className="text-blue-600" /> Remittance &amp; Payment Instructions
                            </div>
                            {organization?.acceptCheck !== false && (
                                <div className="text-[10px]">
                                    <strong className="text-slate-800">Check Payment:</strong> {organization?.checkInstructions || `Make payable to ${pdfDetails.orgName}. Mail to: ${pdfDetails.orgAddressStr || ''}`}
                                </div>
                            )}
                            {organization?.acceptWire && (
                                <div className="text-[10px]">
                                    <strong className="text-slate-800">Wire Transfer:</strong> {organization?.wireInstructions || `Contact billing at ${organization?.email || pdfDetails.orgName} for wire instructions.`}
                                </div>
                            )}
                            {organization?.acceptAch && (
                                <div className="text-[10px]">
                                    <strong className="text-slate-800">ACH / Direct Deposit:</strong> {organization?.achInstructions || `Contact billing at ${organization?.email || pdfDetails.orgName} for ACH instructions.`}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-[10px] text-slate-400 text-center uppercase tracking-wider pt-3 border-t border-slate-100 space-y-0.5">
                        <div>
                            GENERATED VIA {pdfDetails.orgName.toUpperCase()} PLATFORM
                            {pdfDetails.licenseNumber ? ` • STATE LICENSE # ${pdfDetails.licenseNumber}` : ''}
                        </div>
                        {pdfDetails.complianceFooter && <div>{pdfDetails.complianceFooter}</div>}
                        <div className="text-[9px] font-bold text-slate-400 pt-0.5">TEKTRAKKER SERVICE VERIFICATION SYSTEM</div>
                    </div>
                </div>
            </div>

            {/* Checkout Payments / Signing Gate */}
            <div className="p-6 bg-white no-print border-t border-slate-100">
                {isPaid ? (
                        <div className="space-y-4">
                            <div className={`p-6 border-2 rounded-[1.5rem] text-center ${isCommercialInvoice ? 'bg-slate-50 border-[#1A2E40]/25' : 'bg-emerald-50 border-emerald-100'}`}>
                                <div className={`w-12 h-12 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg ${isCommercialInvoice ? 'bg-[#1A2E40]' : 'bg-emerald-500 shadow-emerald-150'}`}>
                                    <CheckCircle size={24}/>
                                </div>
                                <h3 className={`text-xl font-black ${isCommercialInvoice ? 'text-slate-900' : 'text-emerald-950 b2c-title'}`}>Payment Completed</h3>
                                <p className={`text-xs mt-1 ${isCommercialInvoice ? 'text-slate-500 font-mono' : 'text-emerald-800 font-medium'}`}>A receipt and copy has been prepared for your files.</p>
                            </div>
                            
                            {/* Google Review Prompt on paid SUCCESS for B2C invoices */}
                            {isB2CInvoice && (organization?.reviewLinks?.google || organization?.reviewLink) && (
                                <div className="p-5 bg-slate-50 border border-dashed border-slate-250 rounded-2xl text-center animate-in fade-in zoom-in duration-300">
                                    <h4 className="b2c-title text-xs font-black text-[#2C5E43] uppercase tracking-wider mb-2">
                                        🌟 Happy with our service today?
                                    </h4>
                                    <p className="text-[10px] text-slate-550 leading-relaxed mb-3">
                                        If our lead professional did an outstanding job, please consider leaving us a 5-star review on Google! It helps our local, family-owned business immensely.
                                    </p>
                                    <a 
                                        href={organization.reviewLinks?.google || organization.reviewLink}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-2 bg-[#F59E0B] hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-amber-500/20 no-underline"
                                    >
                                        👉 Click here to review us on Google!
                                    </a>
                                </div>
                            )}

                            <Button onClick={() => setIsPreviewOpen(true)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                <Printer size={18}/> Print Receipt
                            </Button>
                            <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} variant="outline" className="w-full flex items-center justify-center gap-2 border-slate-200 hover:bg-slate-50">
                                <Download size={18}/> {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF Receipt'}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {balanceDue === 0 ? (
                                <div className="text-center space-y-4">
                                    <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
                                        This invoice has a $0.00 balance and requires confirmation to close.
                                    </div>
                                    <Button onClick={() => markJobPaid()} className={`w-full font-black h-14 rounded-2xl shadow-lg text-lg ${isCommercialInvoice ? 'bg-[#1A2E40] hover:bg-slate-800 text-white' : 'bg-[#1D4ED8] hover:bg-blue-800 text-white shadow-blue-200'}`}>
                                        Complete Transaction
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {/* Interactive Payment Amount Selector (Deposit, Full Balance, or Custom) */}
                                    {!isPaid && ((canonical && canonical.depositRequired > 0 && !canonical.depositPaid) || organization?.allowPartialPayments) && (
                                        <div className="p-6 border rounded-2xl bg-white mb-6 shadow-sm border-slate-100">
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 text-center">Select Payment Amount</p>
                                            <div className={`grid gap-3 mb-4 ${canonical && canonical.depositRequired > 0 && !canonical.depositPaid && organization?.allowPartialPayments ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                                                {canonical && canonical.depositRequired > 0 && !canonical.depositPaid && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPaymentOption('deposit')}
                                                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all ${
                                                            paymentOption === 'deposit' 
                                                            ? 'bg-amber-50/80 border-amber-500 text-amber-950 shadow-sm ring-2 ring-amber-400/20'
                                                            : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">Pay Initial Deposit</span>
                                                        <span className="text-base font-black mt-1 text-amber-950 font-mono">${canonical.amountDueToday.toFixed(2)}</span>
                                                        <span className="text-[9px] text-amber-800/80 font-bold uppercase mt-0.5">Required Today</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentOption('full')}
                                                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all ${
                                                        paymentOption === 'full' 
                                                        ? isCommercialInvoice
                                                            ? 'bg-slate-50 border-[#1A2E40] text-slate-900 shadow-sm'
                                                            : 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                        : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="text-[10px] font-bold uppercase">Pay Full Balance</span>
                                                    <span className="text-base font-black mt-1 font-mono">${balanceDue.toFixed(2)}</span>
                                                    {canonical && canonical.depositRequired > 0 && !canonical.depositPaid && (
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Total Contract</span>
                                                    )}
                                                </button>
                                                {organization?.allowPartialPayments && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPaymentOption('custom');
                                                            if (!customAmount) setCustomAmount((canonical && canonical.depositRequired > 0 ? canonical.amountDueToday : balanceDue / 2).toFixed(2));
                                                        }}
                                                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all ${
                                                            paymentOption === 'custom' 
                                                            ? isCommercialInvoice
                                                                ? 'bg-slate-50 border-[#1A2E40] text-slate-900 shadow-sm'
                                                                : 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                            : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span className="text-[10px] font-bold uppercase">Pay Other Amount</span>
                                                        <span className="text-base font-black mt-1">Custom Amount</span>
                                                    </button>
                                                )}
                                            </div>

                                            {paymentOption === 'custom' && (
                                                <div className="animate-fade-in space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <label htmlFor="custom-pay-amount" className="block text-xs font-black uppercase text-slate-500 tracking-wider">Enter Amount to Pay ($)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
                                                        <input
                                                            id="custom-pay-amount"
                                                            type="number"
                                                            step="0.01"
                                                            min="1.00"
                                                            max={balanceDue}
                                                            value={customAmount}
                                                            onChange={e => setCustomAmount(e.target.value)}
                                                            className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex gap-2 justify-center">
                                                        {[0.25, 0.5, 0.75].map(pct => (
                                                            <button
                                                                key={pct}
                                                                type="button"
                                                                onClick={() => setCustomAmount((balanceDue * pct).toFixed(2))}
                                                                className="text-[9px] font-black uppercase tracking-wider bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg text-slate-500 transition-colors"
                                                            >
                                                                {pct * 100}% (${(balanceDue * pct).toFixed(2)})
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {amountToPay <= 0 ? (
                                                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Please enter a valid amount.</p>
                                                    ) : amountToPay < 1.00 ? (
                                                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Minimum payment is $1.00.</p>
                                                    ) : amountToPay > (balanceDue + tipAmount + 0.01) ? (
                                                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Payment cannot exceed remaining balance of ${balanceDue.toFixed(2)}.</p>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-center">Amount authorized to charge: ${amountToPay.toFixed(2)}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Technician Tip Section */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                                <span>⭐</span> Add a Tip for Your Technician
                                            </span>
                                            {tipAmount > 0 && (
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                    +${tipAmount.toFixed(2)} Tip
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                            Tips are completely optional and never mandatory. Don't worry, we would never ask you to pay 20%! But if your technician did a great job today, any amount is deeply appreciated and goes 100% directly to your technician.
                                        </p>

                                        <div className="grid grid-cols-5 gap-1.5">
                                            {[
                                                { id: 'none', label: 'No Tip', value: 0 },
                                                { id: '20', label: '+$20', value: 20 },
                                                { id: '35', label: '+$35', value: 35 },
                                                { id: '50', label: '+$50', value: 50 },
                                                { id: 'custom', label: 'Custom', value: null }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTipOption(opt.id as any);
                                                        if (opt.id !== 'custom') {
                                                            setCustomTipAmount('');
                                                        }
                                                    }}
                                                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border text-center ${
                                                        tipOption === opt.id
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {tipOption === 'custom' && (
                                            <div className="animate-fade-in pt-1">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        min="0"
                                                        placeholder="Custom tip amount"
                                                        value={customTipAmount}
                                                        onChange={e => setCustomTipAmount(e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Pay Securely via Credit Card / ACH</p>

                                        {paymentError && (
                                            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start justify-between gap-2 text-rose-700 dark:text-rose-300 animate-fade-in text-left">
                                                <div className="flex items-start gap-2.5">
                                                    <span className="text-rose-500 font-bold text-sm shrink-0 mt-0.5">⚠️</span>
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">Payment Could Not Be Processed</p>
                                                        <p className="text-xs mt-0.5 text-rose-600 dark:text-rose-400 font-medium">{paymentError}</p>
                                                        <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400">Please verify your card details or try a different payment method.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentError(null)}
                                                    className="text-rose-400 hover:text-rose-600 p-1 font-bold text-xs"
                                                    title="Dismiss"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                            {amountToPay >= 1.00 && amountToPay <= (balanceDue + tipAmount + 0.01) ? (
                                                <div className="relative z-10 flex justify-center w-full">
                                                    <KortPaymentForm 
                                                        amount={amountToPay}
                                                        tipAmount={tipAmount}
                                                        jobId={jobId}
                                                        accountId={currentActiveOrg?.kortAccountId}
                                                        organizationId={currentActiveOrg?.id}
                                                        organization={currentActiveOrg}
                                                        onSuccess={async (_paymentId, fee, feeName, tip) => {
                                                            setPaymentError(null);
                                                            await markJobPaid(_paymentId, baseAmountToPay, fee, feeName, tip !== undefined ? tip : tipAmount);
                                                            showToast.success("Payment Successful via Kort Payments");
                                                        }}
                                                        onError={async (err) => {
                                                            setPaymentError(err);
                                                            showToast.error(err);
                                                            if (jobId && job) {
                                                                try {
                                                                    const currentPaid = Number(job.invoice?.amountPaid || 0);
                                                                    const failedStatus = currentPaid > 0 ? 'Partially Paid' : 'Failed';
                                                                    await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                                                                        'invoice.status': failedStatus,
                                                                        'invoice.failedDate': new Date().toISOString(),
                                                                        'invoice.lastFailureReason': err
                                                                    }));
                                                                    const invId = job.invoice?.id || (job as any)?.invoiceNumber;
                                                                    if (invId) {
                                                                        await db.collection('invoices').doc(invId).update(cleanUndefinedFields({
                                                                            status: failedStatus,
                                                                            failedDate: new Date().toISOString(),
                                                                            lastFailureReason: err
                                                                        })).catch(() => {});
                                                                    }
                                                                    setJob({
                                                                        ...job,
                                                                        invoice: {
                                                                            ...job.invoice,
                                                                            status: failedStatus,
                                                                            lastFailureReason: err
                                                                        } as any
                                                                    });

                                                                    const customerEmail = job.customerEmail || '';
                                                                    if (customerEmail) {
                                                                        const orgName = currentActiveOrg?.name || 'Service Provider';
                                                                        const orgEmail = currentActiveOrg?.email || 'noreply@tektrakker.com';
                                                                        const invoiceId = job.invoice?.id || jobId;
                                                                        const totalAmount = balanceDue;
                                                                        const paymentLink = window.location.href;

                                                                        await db.collection('mail_queue').add(cleanUndefinedFields({
                                                                            to: customerEmail,
                                                                            replyTo: orgEmail,
                                                                            message: {
                                                                                subject: `Action Required: Payment Failed for Invoice #${invoiceId}`,
                                                                                html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#dc2626;margin-top:0;">Payment Method Failed</h2><p>Hi ${job.customerName || 'Customer'},</p><p>We were unable to process your payment for <strong>Invoice #${invoiceId}</strong> to <strong>${orgName}</strong>. Your payment method has failed.</p><div style="margin:20px 0;padding:15px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;"><p style="margin:5px 0;"><strong>Invoice:</strong> #${invoiceId}</p><p style="margin:5px 0;"><strong>Amount Due:</strong> $${totalAmount.toFixed(2)}</p><p style="margin:5px 0;"><strong>Status:</strong> PAYMENT FAILED</p><p style="margin:5px 0;color:#991b1b;"><strong>Reason:</strong> ${err}</p></div><div style="margin:20px 0;"><a href="${paymentLink}" style="background-color:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Update Payment Method &amp; Pay</a></div><p style="font-size:12px;color:#666;">Please update your payment method or contact ${orgName} to complete this payment.</p></div>`,
                                                                                text: `Payment method failed for Invoice #${invoiceId} to ${orgName}. Amount Due: $${totalAmount.toFixed(2)}. Reason: ${err}. Pay online: ${paymentLink}`
                                                                            },
                                                                            organizationId: job.organizationId,
                                                                            type: 'PaymentFailed',
                                                                            createdAt: new Date().toISOString()
                                                                        }));
                                                                    }
                                                                } catch (failErr) {
                                                                    console.error("Failed to update payment failure status:", failErr);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center bg-slate-50 border rounded-2xl border-slate-100">
                                                    <p className="text-xs text-slate-500 font-bold uppercase">Enter a valid custom payment amount to authorize payment</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Direct / Offline Payment Instructions (Check / Wire / ACH) */}
                                <PaymentInstructionsCard
                                    organization={organization}
                                    className="mt-6"
                                    title="Alternative Payment Methods (Check, Wire, ACH)"
                                    description="If you prefer paying by check, wire, or bank deposit instead of a credit/debit card, please follow these instructions:"
                                />

                                {!isPlatformSubscription && !job?.invoiceSignature && (
                                    <div id="signature-section" className="pt-6 border-t border-slate-100 mt-6 text-left">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className={`text-xs font-black uppercase text-slate-400 tracking-wider ${isB2CInvoice ? 'b2c-title' : ''}`}>Customer Authorization Required</p>
                                            <button onClick={() => sigPadRef.current?.clear()} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Clear</button>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 overflow-hidden">
                                            <SignaturePad ref={sigPadRef} className="h-32" />
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2 text-center italic">By signing above, I authorize the payment and acknowledge receipt of services.</p>
                                        <Button onClick={handleSignInvoice} disabled={isSigning} variant="secondary" className="w-full mt-4 h-10 text-xs font-black uppercase">
                                            {isSigning ? 'Saving...' : 'Capture Signature'}
                                        </Button>
                                    </div>
                                )}

                                {job?.invoiceSignature && (
                                    <div className="pt-6 border-t border-slate-100 mt-6 flex flex-col items-center">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Signed on {job.invoiceSignedDate ? new Date(job.invoiceSignedDate).toLocaleDateString() : 'Capture'}</p>
                                        <img src={job.invoiceSignature} alt="Signature" className="h-16 opacity-80" />
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase mt-1">
                                            <ShieldCheck size={12}/> Verified Signature
                                        </div>
                                    </div>
                                )}

                                {isPaid && (
                                    <div className="pt-8 border-t border-slate-100 mt-6">
                                        <Button onClick={handleFinish} className={`w-full text-white font-black h-14 rounded-2xl shadow-xl text-lg ${isCommercialInvoice ? 'bg-slate-900 hover:bg-slate-800' : 'bg-[#2C5E43] hover:bg-emerald-800 shadow-emerald-150'}`}>
                                            COMPLETE & FINISH
                                        </Button>
                                        <p className="text-[10px] text-slate-400 text-center mt-3 font-bold uppercase tracking-widest">Return to Customer Session</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                
                {!embedded && (
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center relative z-10 text-xs no-print">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Powered by</span>
                        <a href="https://tektrakker.web.app" target="_blank" rel="noopener noreferrer" className="flex items-center">
                            <img src="/tektrakker-logo-web.png" alt="TekTrakker" className="h-4 w-auto object-contain brightness-0 invert opacity-75 hover:opacity-100 transition-opacity" />
                        </a>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsPreviewOpen(true)} className="text-[10px] font-black uppercase hover:text-blue-400 flex items-center gap-1 transition-colors">
                            <FileText size={12}/> View PDF
                        </button>
                        <button onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="text-[10px] font-black uppercase hover:text-blue-400 flex items-center gap-1 transition-colors">
                            <Download size={12}/> {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
                        </button>
                        <button onClick={() => { setAutoPrint(true); setIsPreviewOpen(true); }} className="text-[10px] font-black uppercase hover:text-blue-400 flex items-center gap-1 transition-colors">
                            <Printer size={12}/> Print
                        </button>
                    </div>
                </div>
            )}
        </Card>
        
        {!embedded && (
            <div className="mt-8 text-center text-slate-400 max-w-sm no-print flex flex-col items-center">
                {(currentActiveOrg?.pciComplianceSealHtml || organization?.pciComplianceSealHtml) ? (
                    <div className="mb-3">
                        <SiteSealEmbed sealHtml={currentActiveOrg?.pciComplianceSealHtml || organization?.pciComplianceSealHtml} />
                    </div>
                ) : (
                    <div className="flex justify-center gap-4 mb-4">
                        <ShieldCheck size={20} className="opacity-40" />
                        <Lock size={20} className="opacity-40" />
                    </div>
                )}
                <p className="text-[10px] font-medium leading-relaxed uppercase tracking-widest opacity-60">
                    Secure 256-bit Encrypted Transaction. Your data privacy and security are our top priorities.
                </p>
            </div>
        )}

        {/* Receipt Document Preview */}
        {isPreviewOpen && job && organization && (
            <React.Suspense fallback={null}>
                <DocumentPreview 
                    type="Invoice"
                    onClose={() => { setIsPreviewOpen(false); setAutoPrint(false); }} 
                    data={job} 
                    organization={organization}
                    autoPrint={autoPrint}
                />
            </React.Suspense>
        )}
    </div>
  );
};

export default CustomerPayment;
