import { cleanUndefinedFields, isPaymentProcessingFeeItem } from '../lib/utils';
import showToast from "lib/toast";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from 'lib/firebase';
import type { Job, Organization, PlatformSettings } from 'types';
import Card from 'components/ui/Card';
import { Printer, CheckCircle, FileText, Lock, ShieldCheck, Building2, User, MapPin, Clock, Calendar } from 'lucide-react';
import Button from 'components/ui/Button';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import SquarePaymentForm from 'components/payment/SquarePaymentForm';
import { KortPaymentForm } from 'components/payment/KortPaymentForm';
import { fetchLinkedClusterForJob, AggregatedLinkedCluster } from 'lib/linkedJobsHelper';

const roundTo2Decimals = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const CustomerPayment: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [linkedCluster, setLinkedCluster] = useState<AggregatedLinkedCluster | null>(null);
  const [proposal, setProposal] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [parentCustomer, setParentCustomer] = useState<any | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [partnerOrganization, setPartnerOrganization] = useState<Organization | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [paymentRecipient, setPaymentRecipient] = useState<'owner' | 'partner'>('owner');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'square' | 'kort'>('stripe');
  const [finished, setFinished] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'full' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState('');
  
  // Removed unused stripe state variables to fix build errors if not used
  // const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  // const [StripeComponents, setStripeComponents] = useState<any>(null);
  
  const sigPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!jobId) { setError("Invalid Link."); setLoading(false); return; }
    
    let isMounted = true;
    
    // Set up anonymous sign in if not logged in
    const signIn = async () => {
        if (!auth.currentUser) {
            try { 
                await auth.signInAnonymously(); 
            } catch (e: any) { 
                console.warn("Anonymous sign-in not available, proceeding unauthenticated:", e.message || e); 
            }
        }
    };
    signIn();

    // Listen to real-time updates on the job document
    const unsubscribe = db.collection('jobs').doc(jobId).onSnapshot(
        async (doc) => {
            if (!isMounted) return;
            if (!doc.exists) {
                setError("Invoice record not found.");
                setLoading(false);
                return;
            }
            const loadedJob = { ...doc.data(), id: doc.id } as Job;
            if (!loadedJob.invoice || (loadedJob.invoice.status !== 'Paid' && !loadedJob.invoice.sentAt)) {
                setError("Invoice record not found.");
                setLoading(false);
                return;
            }
            setJob(loadedJob);

            // Fetch full linked cluster (jobs, visits, proposals, invoices) for this work order / link chain
            fetchLinkedClusterForJob(loadedJob).then(cluster => {
                if (isMounted) {
                    setLinkedCluster(cluster);
                }
            }).catch(e => console.warn("Error fetching linked cluster:", e));

            // Auto-track invoice "Opened" state
            if (loadedJob.invoice && loadedJob.invoice.status !== 'Paid' && !loadedJob.invoice.opened) {
                try {
                    await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
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
                setError(err.message || "System Error");
                setLoading(false);
            }
        }
    );

    return () => {
        isMounted = false;
        unsubscribe();
    };
  }, [jobId]);

  // Update payment provider config when recipient or data changes
  useEffect(() => {
      const activeOrg = paymentRecipient === 'partner' ? partnerOrganization : organization;
      if (!activeOrg || !job) return;

      if (activeOrg.defaultPaymentGateway === 'kort' && activeOrg.kortAccountId) {
          setPaymentMethod('kort');
      } else if (activeOrg.defaultPaymentGateway === 'square' && activeOrg.squareApplicationId) {
          setPaymentMethod('square');
      } else if (activeOrg.defaultPaymentGateway === 'stripe' && activeOrg.stripePublicKey) {
          setPaymentMethod('stripe');
      } else {
          // Priority 2: Fallback logic based on available keys
          if (activeOrg.kortAccountId) {
              setPaymentMethod('kort');
          } else if (activeOrg.stripePublicKey && job.source !== 'PlatformAdmin') {
              setPaymentMethod('stripe');
          } else if (activeOrg.squareApplicationId && activeOrg.squareLocationId && job.source !== 'PlatformAdmin') {
              setPaymentMethod('square');
          } else {
              setPaymentMethod('kort');
          }
      }
  }, [organization, partnerOrganization, paymentRecipient, job]);

  const markJobPaid = async (paymentIntentId?: string, paymentAmount?: number, processingFee = 0, processingFeeName?: string) => {
      if (!job || !jobId) return;
      try {
          const paidThisTime = paymentAmount !== undefined ? paymentAmount : balanceDue;
          const currentItems = job.invoice?.items || [];
          
          // Strip out any pre-existing payment processing fee line items to prevent duplicate stacking
          const cleanBaseItems = currentItems.filter((item: any) => !isPaymentProcessingFeeItem(item));
          const cleanBaseTotal = roundTo2Decimals(cleanBaseItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0));

          let updatedItems = [...cleanBaseItems];
          let updatedTotal = cleanBaseTotal > 0 ? cleanBaseTotal : safeTotal;

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
              updatedTotal = roundTo2Decimals((cleanBaseTotal > 0 ? cleanBaseTotal : safeTotal) + processingFee);
          }

          const newAmountPaid = (job.invoice?.amountPaid || 0) + paidThisTime + processingFee;
          const isFullyPaid = newAmountPaid >= updatedTotal - 0.01;
          const newStatus = isFullyPaid ? 'Paid' : 'Partially Paid';

          const updateData: any = { 
              'invoice.status': newStatus, 
              'invoice.amountPaid': newAmountPaid,
              'invoice.paidDate': new Date().toISOString(),
              'invoice.paidTo': paymentRecipient === 'partner' ? partnerOrganization?.id : organization?.id,
              'invoice.paymentRecipientName': paymentRecipient === 'partner' ? partnerOrganization?.name : organization?.name,
              'invoice.items': updatedItems,
              'invoice.totalAmount': updatedTotal,
              'invoice.amount': updatedTotal
          };
          if (paymentIntentId) {
              updateData['invoice.paymentIntentId'] = paymentIntentId;
          }

          // Wrap direct database write in try-catch to ignore expected client permission errors.
          // The database will be updated securely in the background via payment webhooks anyway.
          try {
              await db.collection('jobs').doc(jobId).update(cleanUndefinedFields(updateData));
              if (isFullyPaid && job.source === 'PlatformAdmin' && job.customerId) {
                  await db.collection('organizations').doc(job.customerId).update(cleanUndefinedFields({ subscriptionStatus: 'active' }));
              }
          } catch (dbErr) {
              console.warn("Direct Firestore update failed (this is expected for public anonymous customer payments). Status will update automatically via payment webhook shortly.", dbErr);
          }
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const notificationContent = isFullyPaid 
                  ? `💰 Payment received for Invoice #${job.invoice?.id || job.id.substring(0,8)} from ${job.customerName}. Amount: $${(paidThisTime + processingFee).toFixed(2)} (Full payment).`
                  : `💰 Partial payment received for Invoice #${job.invoice?.id || job.id.substring(0,8)} from ${job.customerName}. Amount: $${(paidThisTime + processingFee).toFixed(2)}. Remaining Balance: $${(updatedTotal - newAmountPaid).toFixed(2)}.`;
              
              const recipientId = job.assignedTechnicianId;
              if (recipientId) {
                  await sendNotification(recipientId, { title: isFullyPaid ? 'Invoice Paid!' : 'Partial Payment Received', body: notificationContent, type: 'invoice_paid' }, job.organizationId);
              }
              await notifyAdmins(job.organizationId, { title: isFullyPaid ? 'Invoice Paid!' : 'Partial Payment Received', body: notificationContent, type: 'invoice_paid' });
          } catch(e) { console.error('Failed to send notifications', e); }

          setJob({ 
              ...job, 
              invoice: { 
                  ...job.invoice, 
                  status: newStatus, 
                  amountPaid: newAmountPaid,
                  items: updatedItems,
                  totalAmount: updatedTotal,
                  amount: updatedTotal
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
              showToast.success(`Partial payment of $${(paidThisTime + processingFee).toFixed(2)} successful!`);
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
          await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ invoiceSignature: sig, invoiceSignedDate: new Date().toISOString() }));
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const notificationContent = `✍️ ${job.customerName} has signed the invoice #${job.invoice?.id || job.id.substring(0,8)}.`;
              
              const recipientId = job.assignedTechnicianId;
              if (recipientId) {
                  await sendNotification(recipientId, { title: 'Invoice Signed', body: notificationContent, type: 'invoice_signed' }, job.organizationId);
              }
              await notifyAdmins(job.organizationId, { title: 'Invoice Signed', body: notificationContent, type: 'invoice_signed' });
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

  // Progressive Billing calculations for Commercial Invoices
  const progressiveData = useMemo(() => {
      if (!job) return null;
      
      const isPaid = job.invoice?.status === 'Paid';
      const rawItems = (job.invoice?.items || []).filter((item: any) => isPaid || !isPaymentProcessingFeeItem(item));
      
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
      const totalContractValue = roundTo2Decimals(baseContractValue + contractAdditionalFee);

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

      const currentAmountDue = roundTo2Decimals(Math.max(0, totalBilledToDate - retainageAmount - paymentsPreviouslyReceived));
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
  }, [isCommercialInvoice, job, proposal, customer]);

  const cleanBaseItems = useMemo(() => {
      if (!job?.invoice?.items) return [];
      const isPaid = job.invoice?.status === 'Paid';
      return job.invoice.items.filter((item: any) => isPaid || !isPaymentProcessingFeeItem(item));
  }, [job]);

  const safeTotal = useMemo(() => {
      if (!job) return 0;
      if (!job.invoice) return job.total || 0;
      const isPaid = job.invoice.status === 'Paid';
      if (isPaid && typeof job.invoice.totalAmount === 'number') {
          return job.invoice.totalAmount;
      }
      const itemsSum = cleanBaseItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
      return itemsSum > 0 ? roundTo2Decimals(itemsSum) : (typeof job.invoice.totalAmount === 'number' ? job.invoice.totalAmount : (job.invoice.amount || job.total || 0));
  }, [job, cleanBaseItems]);
  const amountPaid = job?.invoice.amountPaid || 0;
  const standardBalanceDue = Math.max(0, safeTotal - amountPaid);
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

  const headerDetails = useMemo(() => {
      if (!job) return {};

      const rawCAddr = customer?.address || (job as any)?.customerAddress || (proposal as any)?.customerAddress || (proposal as any)?.clientAddress || job.address;
      const cAddrStr = typeof rawCAddr === 'object' ? `${rawCAddr.street || ''} ${rawCAddr.city || ''} ${rawCAddr.state || ''} ${rawCAddr.zip || ''}`.trim() : (rawCAddr || '');

      // Box 1: Customer / Property Mgr
      const cName = parentCustomer?.name || (customer as any)?.propertyManagementCompany || (customer as any)?.billingCompany || (job as any)?.customerPropertyManager || (job as any)?.parentCustomerName || (proposal as any)?.clientName || (job as any)?.billToName || (proposal as any)?.billToName || (proposal as any)?.billingCompany || customer?.name || job.customerName || 'Customer / Property Manager';
      const rawCBoxAddr = parentCustomer?.address || (customer as any)?.propertyManagementAddress || (customer as any)?.billingAddress || (job as any)?.customerPropertyManagerAddress || (job as any)?.billToAddress || (proposal as any)?.billToAddress || (proposal as any)?.billingAddress || cAddrStr;
      const cBoxAddrStr = typeof rawCBoxAddr === 'object' ? `${rawCBoxAddr.street || ''} ${rawCBoxAddr.city || ''} ${rawCBoxAddr.state || ''} ${rawCBoxAddr.zip || ''}`.trim() : (rawCBoxAddr || '');

      // Box 2: Bill To (Paying Entity)
      const bName = (job as any)?.billToName || (proposal as any)?.billToName || (proposal as any)?.billingCompany || (customer as any)?.billingCompany || parentCustomer?.name || (customer as any)?.billingContact?.name || cName;
      const rawBAddr = (job as any)?.billToAddress || (proposal as any)?.billToAddress || (proposal as any)?.billingAddress || (customer as any)?.billingAddress || parentCustomer?.address || rawCBoxAddr;
      const bAddrStr = typeof rawBAddr === 'object' ? `${rawBAddr.street || ''} ${rawBAddr.city || ''} ${rawBAddr.state || ''} ${rawBAddr.zip || ''}`.trim() : (rawBAddr || '');

      // Box 3: Service Site Location
      const sName = (job as any)?.serviceLocationName || (job as any)?.locationName || (proposal as any)?.serviceLocationName || (proposal as any)?.siteName || (customer as any)?.siteName || (job.customerName !== bName ? job.customerName : customer?.name || job.customerName || 'Service Site Location');
      const rawSAddr = (job as any)?.serviceLocationAddress || (job as any)?.locationAddress || (proposal as any)?.serviceLocationAddress || (proposal as any)?.siteAddress || (proposal as any)?.locationAddress || job.address || cAddrStr;
      const sAddrStr = typeof rawSAddr === 'object' ? `${rawSAddr.street || ''} ${rawSAddr.city || ''} ${rawSAddr.state || ''} ${rawSAddr.zip || ''}`.trim() : (rawSAddr || '');

      const appt = job.appointmentTime ? new Date(job.appointmentTime).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const arrived = (job as any)?.geofenceEvents?.arrivedAt ? new Date((job as any).geofenceEvents.arrivedAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const departed = (job as any)?.geofenceEvents?.departedAt ? new Date((job as any).geofenceEvents.departedAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const durMinutes = (job as any)?.geofenceEvents?.durationMinutes || (job as any)?.timeOnSiteMinutes;
      const dur = durMinutes ? `${durMinutes}m` : null;

      const po = (job as any)?.poNumber || (job as any)?.workOrderNumber || job.invoice?.poNumber || (proposal as any)?.poNumber;
      const tech = job.assignedTechnicianName || 'Technician';

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
          technicianName: tech
      };
  }, [job, customer, parentCustomer, proposal]);

  const balanceDue = baseBalanceDue + overdueDetails.totalLateFees;
  const isPaid = job?.invoice.status === 'Paid' || (baseBalanceDue <= 0 && overdueDetails.totalLateFees <= 0) || success;
  const baseAmountToPay = !organization?.allowPartialPayments || paymentOption === 'full' ? baseBalanceDue : (parseFloat(customAmount) || 0);
  const amountToPay = baseAmountToPay + overdueDetails.totalLateFees;

  if (loading) return <div className="p-4 md:p-10 text-center">Loading Invoice...</div>;
  if (error) return <div className="p-4 md:p-10 text-center text-red-500">{error}</div>;

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
                  <DocumentPreview 
                      type="Invoice"
                      onClose={() => { setIsPreviewOpen(false); setAutoPrint(false); }} 
                      data={job} 
                      organization={organization}
                  />
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
            <div className="relative z-10">
                <div className={`p-6 border-b bg-white/80 backdrop-blur-sm flex justify-between items-center ${isCommercialInvoice ? 'border-[#1A2E40]' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                        {currentActiveOrg?.logoUrl && <img src={currentActiveOrg.logoUrl} className="h-14 md:h-18 w-auto max-w-[200px] object-contain shrink-0" alt="Logo"/>}
                        <div>
                            <h2 className={`font-bold text-base md:text-lg text-slate-800 ${isCommercialInvoice ? 'tracking-tight text-slate-800' : 'b2c-title text-[#2C5E43]'}`}>{headerDetails.customerName}</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Invoice #{job?.invoice.id || job?.id.substring(0,8)}</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] font-black uppercase text-slate-400">Due Date</p>
                        <p className="text-sm font-bold">{job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : 'Upon Receipt'}</p>
                    </div>
                </div>

                {/* 3-Box Customer, Bill To, Service Site & Visit Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-slate-100 bg-slate-50/50 text-xs">
                    {/* Box 1: Customer / Property Mgr */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 text-left shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">1. CUSTOMER / PROPERTY MGR</div>
                        <div className="font-bold text-sm text-slate-900">{headerDetails.customerName}</div>
                        <div className="text-xs text-slate-500 font-medium leading-relaxed">{headerDetails.customerAddress || 'Address on file'}</div>
                    </div>

                    {/* Box 2: Bill To (Paying Entity) */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 text-left shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">2. BILL TO (PAYING ENTITY)</div>
                        <div className="font-bold text-sm text-slate-900">{headerDetails.billToName}</div>
                        <div className="text-xs text-slate-500 font-medium leading-relaxed">{headerDetails.billToAddress || headerDetails.customerAddress || 'Address on file'}</div>
                        {headerDetails.poNumber && (
                            <div className="text-xs font-mono font-black text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 inline-block mt-1">
                                PO / WO #: {headerDetails.poNumber}
                            </div>
                        )}
                    </div>

                    {/* Box 3: Service Site Location & Visit Details */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 text-left shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">3. SERVICE SITE LOCATION</div>
                        <div className="font-bold text-sm text-slate-900">{headerDetails.serviceLocationName}</div>
                        <div className="flex items-start gap-1 text-xs text-slate-500 font-medium leading-relaxed">
                            <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                            <span>{headerDetails.serviceLocationAddress || headerDetails.customerAddress || 'Address on file'}</span>
                        </div>
                        
                        {/* Appointment Visit & Time Details */}
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                            {linkedCluster && linkedCluster.allVisits.length > 1 ? (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Linked Service Visits ({linkedCluster.allVisits.length})
                                    </div>
                                    {linkedCluster.allVisits.map((visit) => (
                                        <div key={visit.jobId} className="p-2 bg-slate-50 border border-slate-200/80 rounded-xl space-y-0.5">
                                            <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                                                <span>Visit #{visit.visitNumber}: {visit.visitType}</span>
                                                {visit.appointmentTime && (
                                                    <span className="text-[10px] font-mono text-slate-500">
                                                        {new Date(visit.appointmentTime).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-600">Tech: <strong className="font-bold text-slate-800">{visit.technicianName}</strong></div>
                                            {(visit.arrivedTimeFormatted || visit.departedTimeFormatted) ? (
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    {visit.arrivedTimeFormatted && <span>In: {visit.arrivedTimeFormatted}</span>}
                                                    {visit.departedTimeFormatted && <span> | Out: {visit.departedTimeFormatted}</span>}
                                                    {visit.durationFormatted && <span className="font-bold text-slate-700"> ({visit.durationFormatted})</span>}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-400 italic">Time on site logged</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {headerDetails.appointmentTimeFormatted && (
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} className="text-slate-400 shrink-0" />
                                            <span><strong className="font-bold">Appointment:</strong> {headerDetails.appointmentTimeFormatted}</span>
                                        </div>
                                    )}
                                    {headerDetails.technicianName && (
                                        <div className="flex items-center gap-1">
                                            <User size={12} className="text-slate-400 shrink-0" />
                                            <span><strong className="font-bold">Tech:</strong> {headerDetails.technicianName}</span>
                                        </div>
                                    )}
                                    {(headerDetails.arrivedTimeFormatted || headerDetails.departedTimeFormatted) ? (
                                        <div className="flex items-start gap-1 pt-0.5 text-slate-600">
                                            <Clock size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold text-slate-700">Time on Site (In/Out):</div>
                                                <div className="text-[10px] text-slate-500 font-medium leading-snug">
                                                    {headerDetails.arrivedTimeFormatted && <span>Arrived: {headerDetails.arrivedTimeFormatted}</span>}
                                                    {headerDetails.departedTimeFormatted && <div>Departed: {headerDetails.departedTimeFormatted}</div>}
                                                    {headerDetails.durationFormatted && <div className="font-bold text-slate-700">Duration: {headerDetails.durationFormatted}</div>}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-0.5">
                                            <Clock size={12} className="shrink-0" />
                                            <span>Time on Site: Completed</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Proposal / Estimate Link */}
                {job?.proposalId && (
                    <div className={`p-4 flex items-center justify-between no-print ${isCommercialInvoice ? 'bg-slate-100 border-b border-slate-200' : 'bg-blue-50/50 border-b border-blue-100/50'}`}>
                        <div className="flex items-center gap-2">
                            <FileText size={16} className={isCommercialInvoice ? 'text-[#1A2E40]' : 'text-[#1D4ED8]'} />
                            <span className={`text-xs font-bold ${isCommercialInvoice ? 'text-slate-700' : 'text-slate-800'}`}>Based on Approved Proposal</span>
                        </div>
                        <a 
                            href={`/#/proposal-view/${job.proposalId}`} 
                            className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg no-underline transition-all shadow-sm ${isCommercialInvoice ? 'bg-[#1A2E40] hover:bg-[#2C3E50] text-white' : 'bg-[#1D4ED8] hover:bg-blue-800 text-white'}`}
                        >
                            View Estimate
                        </a>
                    </div>
                )}

                {/* Recipient Selection */}
                {!isPaid && partnerOrganization && (
                    <div className="bg-blue-50/50 border-b border-blue-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={14} className="text-blue-600"/>
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Authorized Payment Recipient</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button 
                                onClick={() => setPaymentRecipient('owner')}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${paymentRecipient === 'owner' ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent text-slate-500'}`}
                            >
                                <Building2 size={18}/>
                                <span className="text-[10px] font-bold uppercase truncate w-full text-center">{organization?.name}</span>
                                <span className="text-[8px] opacity-60">Main Contractor</span>
                            </button>
                            <button 
                                onClick={() => setPaymentRecipient('partner')}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${paymentRecipient === 'partner' ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent text-slate-500'}`}
                            >
                                <User size={18}/>
                                <span className="text-[10px] font-bold uppercase truncate w-full text-center">{partnerOrganization.name}</span>
                                <span className="text-[8px] opacity-60">Subcontractor</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* B2C Welcome Summary & Guarantee Badges */}
                {isB2CInvoice && (
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 space-y-4 text-left">
                        <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl">
                            <h3 className="b2c-title text-xs font-black text-[#2C5E43] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                🏡 Your Home Comfort Summary
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                                Service Date: {job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Today'} | Lead Professional: {job?.assignedTechnicianName || 'Lead Tech'}
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed font-bold">
                                Hello {job?.firstName || job?.customerName?.split(' ')[0] || 'Valued Customer'},
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed mt-1 whitespace-pre-line">
                                We visited your home today. Our lead professional, {job?.assignedTechnicianName || 'our lead technician'}, successfully {job?.notes?.workNotes || job?.notes?.completion || job?.notes?.work || 'completed the scheduled system diagnostics and repairs, restoring comfort to your home.'}
                            </p>
                        </div>
                        
                        {/* Workmanship Warranty Badge */}
                        {hasActiveWarrantyBadge && (
                            <div className="p-4 bg-blue-50/30 border border-blue-150 rounded-2xl flex items-center gap-3">
                                <span className="text-2xl shrink-0">🛡️</span>
                                <div>
                                    <h4 className="b2c-title text-xs font-black text-[#1D4ED8] uppercase tracking-wider">
                                        100% Workmanship Warranty Active
                                    </h4>
                                    <p className="text-[10px] text-slate-655 mt-0.5 leading-relaxed">
                                        Your service is backed by our full workmanship guarantee. We respect your space and pledge to leave it clean and comfortable.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* B2B Compliance Overview */}
                {isCommercialInvoice && (
                    <div className="p-6 bg-slate-50/50 border-b border-slate-150 text-left space-y-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-l-4 border-[#1A2E40] pl-3">
                            Section 1: Compliance & Purchase Order Overview
                        </h3>
                        <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl bg-white text-xs">
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {job?.poNumber && (
                                        <tr className="border-b border-slate-100 bg-slate-50/30">
                                            <td className="p-3 font-bold text-slate-500 w-1/2">Purchase Order Reference</td>
                                            <td className="p-3 font-mono font-bold text-slate-900">{job.poNumber}</td>
                                        </tr>
                                    )}
                                    <tr className="border-b border-slate-100">
                                        <td className="p-3 font-bold text-slate-500">Contract Reference</td>
                                        <td className="p-3 font-mono font-bold text-slate-900">
                                            {(job as any)?.contractNumber || (job as any)?.contractRef || (proposal as any)?.contractNumber || ((job as any)?.workOrderNumber ? `CONT-${(job as any).workOrderNumber}` : (job?.proposalId ? `CONT-${job.proposalId}` : `CONT-${jobId?.replace('job-inv-', '').toUpperCase()}`))}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-slate-100 bg-slate-50/30">
                                        <td className="p-3 font-bold text-slate-500">Project Phase / Zone</td>
                                        <td className="p-3 font-bold text-slate-900">
                                            {(job as any)?.projectPhase || (job as any)?.phase || (job as any)?.trade || (job as any)?.serviceType || (job?.invoice.items?.find((i: any) => i.phase) as any)?.phase || (job?.tasks?.length ? job.tasks[0] : 'HVAC Diagnostics & Repair')}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-bold text-slate-500">Original Proposal Reference</td>
                                        <td className="p-3 font-mono font-bold text-slate-900">
                                            {job?.proposalId || (proposal as any)?.proposalNumber || (proposal as any)?.id || 'N/A'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Items & Progressive Summaries */}
                {isCommercialInvoice && progressiveData ? (
                    <div className="p-6 bg-slate-50/30 border-b border-slate-150 text-left space-y-6">
                        {/* SECTION 2: ITEMIZED CONTRACTED BILLING MATRIX */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-l-4 border-[#1A2E40] pl-3">
                                Section 2: Itemized Contracted Billing Progress Matrix
                            </h3>
                            <div className="overflow-hidden border border-slate-250 rounded-xl bg-white text-xs shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider w-16">Phase</th>
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider">Description of Work</th>
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider text-right w-24">Budgeted</th>
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider text-center w-14">% Prev</th>
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider text-center w-14">% Period</th>
                                                <th className="p-3 font-black text-slate-400 uppercase tracking-wider text-right w-24">Billed</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {progressiveData.contractedItems.length > 0 ? (
                                                progressiveData.contractedItems.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/30">
                                                        <td className="p-3 font-mono font-bold text-slate-500">{item.phase}</td>
                                                        <td className="p-3 font-bold text-slate-900 leading-relaxed">
                                                            {item.name}
                                                            {item.description && <div className="text-[10px] text-slate-500 font-medium mt-0.5 whitespace-pre-wrap">{item.description}</div>}
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-slate-650">${item.budgetedAmount.toFixed(2)}</td>
                                                        <td className="p-3 text-center font-mono text-slate-600">{item.percentPreviouslyBilled}%</td>
                                                        <td className="p-3 text-center font-mono font-bold text-slate-900">{item.percentThisPeriod}%</td>
                                                        <td className="p-3 text-right font-mono font-black text-slate-900">${item.total.toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="p-4 text-center text-slate-500 font-semibold">No progressive labor items specified.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: MATERIAL & LOGISTICS LOG */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-l-4 border-[#1A2E40] pl-3">
                                Section 3: Material & Logistics Log (T&M / Allowance Transparency)
                            </h3>
                            <div className="overflow-x-auto custom-scrollbar border border-slate-250 rounded-xl bg-white text-xs shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="p-3 font-black text-slate-400 tracking-wider">Item Description</th>
                                            <th className="p-3 font-black text-slate-400 tracking-wider text-center w-16">Qty</th>
                                            <th className="p-3 font-black text-slate-400 tracking-wider text-right w-24">Unit Price</th>
                                            <th className="p-3 font-black text-slate-400 tracking-wider text-right w-24">Total Billed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {progressiveData.materialItems.length > 0 ? (
                                            progressiveData.materialItems.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/30">
                                                    <td className="p-3 font-bold text-slate-900 leading-relaxed">
                                                        {item.name}
                                                        {item.description && <div className="text-[10px] text-slate-500 font-medium mt-0.5 whitespace-pre-wrap">{item.description}</div>}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-bold text-slate-600">{item.quantity}</td>
                                                    <td className="p-3 text-right font-mono text-slate-650">${item.unitPrice.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-mono font-black text-slate-900">${item.total.toFixed(2)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-500 font-semibold">No material or parts lines recorded.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : isB2CInvoice ? (
                    /* Flat-Rate Work Summary Table for B2C Residential */
                    <div className="p-6 bg-white space-y-4 text-left">
                        <h3 className="b2c-title text-xs font-black text-[#2C5E43] uppercase tracking-wider border-b pb-2">
                            🛠️ Services & Comfort Solutions Installed
                        </h3>
                        <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-2xl bg-white shadow-sm text-xs">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="p-4 font-black text-[#2C5E43] uppercase tracking-wider">Installed Solution</th>
                                        {hasActiveWarranty && (
                                            <th className="p-4 font-black text-[#2C5E43] uppercase tracking-wider">Benefits & Warranty</th>
                                        )}
                                        <th className="p-4 font-black text-[#2C5E43] uppercase tracking-wider text-right w-24">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(job?.invoice.items || []).map((item, i) => {
                                        let warranty = (item as any).warranty || getInvoiceWarrantyText();
                                        if (!warranty) {
                                            if ((item as any).isPercentage) {
                                                warranty = 'N/A';
                                            } else if (item.name?.toLowerCase().includes('filter') || item.name?.toLowerCase().includes('maintenance')) {
                                                warranty = '90-Day Filter Life';
                                            } else if (item.name?.toLowerCase().includes('wiring') || item.name?.toLowerCase().includes('control') || item.name?.toLowerCase().includes('compressor')) {
                                                warranty = '2-Year Parts & Labor';
                                            }
                                        }
                                        return (
                                            <tr key={i} className="border-b border-slate-50 last:border-none hover:bg-slate-50/20">
                                                <td className="p-4 font-bold text-slate-900">
                                                    <div>{item.name || item.description?.split('\n')[0] || 'Service Item'}</div>
                                                    {!hasActiveWarranty && item.description && (
                                                        <div className="mt-1 text-xs text-slate-550 font-medium whitespace-pre-wrap">{item.description}</div>
                                                    )}
                                                </td>
                                                {hasActiveWarranty && (
                                                    <td className="p-4 text-slate-500 leading-relaxed max-w-[200px]">
                                                        <div className="font-medium whitespace-pre-wrap">{item.description}</div>
                                                        {warranty && (
                                                            <span className="inline-block mt-2 text-[9px] font-bold text-[#2C5E43] bg-emerald-50 px-2 py-0.5 rounded-full">
                                                                🛡️ {warranty}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="p-4 text-right font-black text-slate-955">${(item.total || 0).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Default General Invoices Table fallback */
                    <div className="p-6 space-y-4 bg-slate-50/50 text-left">
                        {job?.invoice?.items && job.invoice.items.length > 0 ? (
                            <div className="space-y-4">
                                {job.invoice.items.map((item, i) => (
                                    <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                                        <div className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                                            {item.description || item.name}
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                                            <span className="font-bold text-slate-500 font-mono">Qty: {item.quantity || 1}</span>
                                            <span className="font-black text-base text-slate-900 font-mono">${(item.total || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-700">{job?.tasks.join(', ') || 'Service Provided'}</span>
                                <span className="font-black text-slate-900 font-mono">${safeTotal.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Accounting & Summary Matrix */}
                {isCommercialInvoice && progressiveData ? (
                    <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-2.5 font-mono text-xs text-left relative overflow-hidden">
                        <div className="flex justify-between items-center text-slate-655 border-b border-slate-200 pb-2">
                            <span className="font-bold uppercase tracking-wider">Total Contract Value:</span>
                            <span className="font-extrabold text-slate-900 text-sm">${progressiveData.totalContractValue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-655">
                            <span>Total Billed to Date:</span>
                            <span className="font-bold text-slate-900">${progressiveData.totalBilledToDate.toFixed(2)}</span>
                        </div>
                        {progressiveData.retainagePercent > 0 && (
                            <div className="flex justify-between items-center text-rose-600">
                                <span>Less Retainage ({progressiveData.retainagePercent}%):</span>
                                <span>{progressiveData.retainageAmount > 0 ? '-' : ''}${progressiveData.retainageAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {progressiveData.additionalFeePercent > 0 && (
                            <div className="flex justify-between items-center text-slate-655">
                                <span>Plus {progressiveData.additionalFeeName || 'Fee'} ({progressiveData.additionalFeePercent}%):</span>
                                <span className="font-bold text-slate-900">+${progressiveData.additionalFeeAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-slate-655 border-b border-slate-200 pb-2">
                            <span>Payments Previously Received:</span>
                            <span>{progressiveData.paymentsPreviouslyReceived > 0 ? '-' : ''}${progressiveData.paymentsPreviouslyReceived.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-[#333333] text-white p-3 rounded-xl">
                            <span className="font-bold uppercase tracking-widest text-[9px]">CURRENT AMOUNT DUE:</span>
                            <span className="font-black text-sm">${progressiveData.currentAmountDue.toFixed(2)}</span>
                        </div>
                        
                        {overdueDetails.lateFeeAmountApplied > 0 && (
                            <div className="flex justify-between items-center text-rose-600 font-bold">
                                <span>Late Fee:</span>
                                <span>+${overdueDetails.lateFeeAmountApplied.toFixed(2)}</span>
                            </div>
                        )}
                        {overdueDetails.interestAmountApplied > 0 && (
                            <div className="flex justify-between items-center text-rose-600 font-bold">
                                <span>Overdue Interest ({organization?.lateFeeInterestRate || 1.5}%):</span>
                                <span>+${overdueDetails.interestAmountApplied.toFixed(2)}</span>
                            </div>
                        )}
                        
                        <div className="p-5 bg-gradient-to-r from-amber-500 via-amber-400 to-[#F59E0B] rounded-2xl shadow-md text-white flex justify-between items-center my-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-950/80">
                                    {amountPaid > 0 ? 'Remaining Balance Due' : 'Total Amount Due'}
                                </p>
                                <p className="text-3xl font-black tracking-tight text-white drop-shadow-sm font-mono mt-0.5">
                                    ${(progressiveData.balanceDue + overdueDetails.totalLateFees).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex flex-col items-end">
                                {isPaid ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-800 rounded-full text-xs font-black uppercase shadow-sm">
                                        <CheckCircle size={14}/> Paid
                                    </div>
                                ) : amountPaid > 0 ? (
                                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-black uppercase">
                                        Partially Paid
                                    </div>
                                ) : (
                                    <span className="px-3 py-1.5 bg-black/10 text-white rounded-full text-xs font-black uppercase tracking-wider">
                                        Due Upon Receipt
                                    </span>
                                )}
                                {isPaid && (
                                    <span className="text-[9px] text-amber-100 font-bold uppercase mt-1">To: {job?.invoice.paymentRecipientName || organization?.name}</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-500 pt-2 text-[10px]">
                            <span>Remaining Unbilled Contract Balance:</span>
                            <span className="font-bold font-mono">${progressiveData.remainingUnbilledBalance.toFixed(2)}</span>
                        </div>
                    </div>
                ) : (
                    /* B2C / General Totals Box with Green Discounts and Gold Balance Due */
                    <div className="p-6 border-t border-slate-100 bg-slate-50/40 space-y-3 text-sm text-left">
                        {amountPaid > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Total Invoice Amount:</span>
                                <span className="font-black text-slate-700">${safeTotal.toFixed(2)}</span>
                            </div>
                        )}
                        {amountPaid > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 uppercase tracking-wider">
                                <span>Total Payments Received:</span>
                                <span className="font-black">${amountPaid.toFixed(2)}</span>
                            </div>
                        )}
                        
                        {/* Member/Savings discounts in green text */}
                        {!!job?.invoice?.additionalFeeAmount && job.invoice.additionalFeeAmount < 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 uppercase tracking-wider">
                                <span>💚 {job.invoice.additionalFeeName || 'Maintenance Savings'}:</span>
                                <span className="font-black">-${Math.abs(job.invoice.additionalFeeAmount).toFixed(2)}</span>
                            </div>
                        )}

                        {overdueDetails.lateFeeAmountApplied > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-rose-600 uppercase tracking-wider">
                                <span>Late Fee:</span>
                                <span className="font-black">+${overdueDetails.lateFeeAmountApplied.toFixed(2)}</span>
                            </div>
                        )}
                        {overdueDetails.interestAmountApplied > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-rose-600 uppercase tracking-wider">
                                <span>Overdue Interest ({organization?.lateFeeInterestRate || 1.5}%):</span>
                                <span className="font-black">+${overdueDetails.interestAmountApplied.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Gold Total Amount Due / Balance Due Card */}
                        <div className="p-5 bg-gradient-to-r from-amber-500 via-amber-400 to-[#F59E0B] rounded-2xl shadow-md text-white flex justify-between items-center my-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-950/80">
                                    {amountPaid > 0 ? 'Remaining Balance Due' : 'Total Amount Due'}
                                </p>
                                <p className="text-3xl font-black tracking-tight text-white drop-shadow-sm font-mono mt-0.5">
                                    ${balanceDue.toFixed(2)}
                                </p>
                            </div>
                            <div className="flex flex-col items-end">
                                {isPaid ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-800 rounded-full text-xs font-black uppercase shadow-sm">
                                        <CheckCircle size={14}/> Paid
                                    </div>
                                ) : amountPaid > 0 ? (
                                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-black uppercase">
                                        Partially Paid
                                    </div>
                                ) : (
                                    <span className="px-3 py-1.5 bg-black/10 text-white rounded-full text-xs font-black uppercase tracking-wider">
                                        Due Upon Receipt
                                    </span>
                                )}
                                {isPaid && (
                                    <span className="text-[9px] text-amber-100 font-bold uppercase mt-1">To: {job?.invoice.paymentRecipientName || organization?.name}</span>
                                )}
                            </div>
                        </div>
                        {!isPaid && isB2CInvoice && (
                            <div className="text-right text-[10px] text-amber-900/80 font-semibold mt-1">
                                Or split this payment into monthly options as low as <span className="font-black text-amber-950">${Math.round(balanceDue * 0.0125)}/mo</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Checkout Payments / Signing Gate */}
                <div className="p-6 bg-white">
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
                                    {/* Interactive Partial Payment Selector */}
                                    {!isPaid && organization?.allowPartialPayments && (
                                        <div className="p-6 border rounded-2xl bg-white mb-6 shadow-sm border-slate-100">
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 text-center">Select Payment Amount</p>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentOption('full')}
                                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                                                        paymentOption === 'full' 
                                                        ? isCommercialInvoice
                                                            ? 'bg-slate-50 border-[#1A2E40] text-slate-900 shadow-sm'
                                                            : 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                        : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="text-[10px] font-bold uppercase">Pay Remaining Balance</span>
                                                    <span className="text-base font-black mt-1">${balanceDue.toFixed(2)}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentOption('custom');
                                                        if (!customAmount) setCustomAmount((balanceDue / 2).toFixed(2));
                                                    }}
                                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
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
                                                    ) : amountToPay > balanceDue + 0.01 ? (
                                                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Payment cannot exceed remaining balance of ${balanceDue.toFixed(2)}.</p>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-center">Amount authorized to charge: ${amountToPay.toFixed(2)}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Pay Securely via Credit Card</p>

                                        {amountToPay >= 1.00 && amountToPay <= balanceDue + 0.01 ? (
                                            <>
                                                {paymentMethod === 'square' && currentActiveOrg?.squareApplicationId && currentActiveOrg?.squareLocationId && (
                                                    <div className="relative z-10 space-y-4">
                                                        {currentActiveOrg?.cardProcessingFeeEnabled && (
                                                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 text-xs text-slate-555 space-y-2 text-left">
                                                                <div className="flex justify-between">
                                                                    <span>Base Amount</span>
                                                                    <span className="font-bold text-slate-700">${amountToPay.toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-rose-600 font-bold">
                                                                    <span>Card Processing Fee ({currentActiveOrg.cardProcessingFeePercent}% + ${currentActiveOrg.cardProcessingFeeFlat.toFixed(2)})</span>
                                                                    <span>+${((amountToPay * currentActiveOrg.cardProcessingFeePercent / 100) + currentActiveOrg.cardProcessingFeeFlat).toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between border-t pt-2 text-sm font-black text-slate-800">
                                                                    <span>Total to Charge</span>
                                                                    <span>${((amountToPay * (1 + currentActiveOrg.cardProcessingFeePercent / 100)) + currentActiveOrg.cardProcessingFeeFlat).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <SquarePaymentForm 
                                                            applicationId={currentActiveOrg.squareApplicationId}
                                                            locationId={currentActiveOrg.squareLocationId}
                                                            amount={
                                                                currentActiveOrg?.cardProcessingFeeEnabled
                                                                    ? roundTo2Decimals((amountToPay * (1 + currentActiveOrg.cardProcessingFeePercent / 100)) + currentActiveOrg.cardProcessingFeeFlat)
                                                                    : amountToPay
                                                            }
                                                            organizationId={currentActiveOrg.id}
                                                            jobId={jobId}
                                                            customerEmail={job?.customerEmail || ''}
                                                            onSuccess={async (_paymentId) => {
                                                                const fee = currentActiveOrg?.cardProcessingFeeEnabled
                                                                    ? roundTo2Decimals((amountToPay * (currentActiveOrg.cardProcessingFeePercent / 100)) + currentActiveOrg.cardProcessingFeeFlat)
                                                                    : 0;
                                                                await markJobPaid(_paymentId, baseAmountToPay, fee, "Credit Card Processing Fee");
                                                                showToast.success("Payment Successful via Square");
                                                            }}
                                                            onError={(err) => {
                                                                setError(err);
                                                                showToast.error(err);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                
                                                {paymentMethod === 'kort' && (currentActiveOrg?.kortAccountId || currentActiveOrg?.name?.trim().toLowerCase() === 'tektestsub') && (
                                                    <div className="relative z-10 flex justify-center w-full">
                                                        <KortPaymentForm 
                                                            amount={amountToPay}
                                                            jobId={jobId}
                                                            accountId={currentActiveOrg?.kortAccountId}
                                                            organizationId={currentActiveOrg?.id}
                                                            organization={currentActiveOrg}
                                                            onSuccess={async (_paymentId, fee, feeName) => {
                                                                await markJobPaid(_paymentId, baseAmountToPay, fee, feeName);
                                                                showToast.success("Payment Successful via Kort");
                                                            }}
                                                            onError={async (err) => {
                                                                setError(err);
                                                                showToast.error(err);
                                                                if (jobId && job) {
                                                                    try {
                                                                        const cleanItems = (job.invoice?.items || []).filter((item: any) => !isPaymentProcessingFeeItem(item));
                                                                        const cleanTotal = roundTo2Decimals(cleanItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0));
                                                                        const resetTotal = cleanTotal > 0 ? cleanTotal : (job.invoice?.totalAmount || 0);

                                                                        await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                                                                            'invoice.status': 'Failed',
                                                                            'invoice.amountPaid': 0,
                                                                            'invoice.items': cleanItems,
                                                                            'invoice.totalAmount': resetTotal,
                                                                            'invoice.amount': resetTotal,
                                                                            'invoice.failedDate': new Date().toISOString(),
                                                                            'invoice.lastFailureReason': err
                                                                        }));
                                                                        setJob({
                                                                            ...job,
                                                                            invoice: {
                                                                                ...job.invoice,
                                                                                status: 'Failed',
                                                                                amountPaid: 0,
                                                                                items: cleanItems,
                                                                                totalAmount: resetTotal,
                                                                                amount: resetTotal,
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
                                                )}
                                            </>
                                        ) : (
                                            <div className="p-4 text-center bg-slate-50 border rounded-2xl border-slate-100">
                                                <p className="text-xs text-slate-500 font-bold uppercase">Enter a valid custom payment amount to authorize payment</p>
                                            </div>
                                        )}

                                        {paymentMethod === 'stripe' && (
                                            <div className="p-4 md:p-8 text-center border-2 border-dashed border-slate-200 rounded-[1.5rem] bg-slate-50">
                                                <Lock size={32} className="mx-auto text-slate-300 mb-2"/>
                                                <p className="text-sm font-bold text-slate-500 uppercase">Stripe integration coming soon</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Please use another payment method or contact {currentActiveOrg?.name || 'the service provider'}.</p>
                                            </div>
                                        )}
                                    </div>


                                </>
                            )}
                        </div>
                    )}

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
            </div>
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center relative z-10 text-xs">
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
                    <button onClick={() => setIsPreviewOpen(true)} className="text-[10px] font-black uppercase hover:text-blue-400 flex items-center gap-1 transition-colors">
                        <Printer size={12}/> Print
                    </button>
                </div>
            </div>
        </Card>
        
        <div className="mt-8 text-center text-slate-400 max-w-sm">
            <div className="flex justify-center gap-4 mb-4">
                <ShieldCheck size={20} className="opacity-40" />
                <Lock size={20} className="opacity-40" />
            </div>
            <p className="text-[10px] font-medium leading-relaxed uppercase tracking-widest opacity-60">
                Secure 256-bit Encrypted Transaction. Your data privacy and security are our top priorities.
            </p>
        </div>

        {/* Receipt Document Preview */}
        {isPreviewOpen && job && organization && (
            <DocumentPreview 
                type="Invoice"
                onClose={() => { setIsPreviewOpen(false); setAutoPrint(false); }} 
                data={job} 
                organization={organization}
                autoPrint={autoPrint}
            />
        )}
    </div>
  );
};

export default CustomerPayment;
