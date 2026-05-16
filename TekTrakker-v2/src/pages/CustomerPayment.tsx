import showToast from "lib/toast";

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { db, auth } from 'lib/firebase';
import type { Job, Organization, PlatformSettings } from 'types';
import Card from 'components/ui/Card';
import { Printer, CheckCircle, FileText, Lock, ShieldCheck, Building2, User } from 'lucide-react';
import Button from 'components/ui/Button';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import SquarePaymentForm from 'components/payment/SquarePaymentForm';
import { KortPaymentForm } from 'components/payment/KortPaymentForm';
const CustomerPayment: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
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
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'stripe' | 'square' | 'kort'>('paypal');
  const [finished, setFinished] = useState(false);
  
  // Removed unused stripe state variables to fix build errors if not used
  // const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  // const [StripeComponents, setStripeComponents] = useState<any>(null);
  
  const sigPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    const fetchData = async () => {
        if (!jobId) { setError("Invalid Link."); setLoading(false); return; }
        try {
            if (!auth.currentUser) { try { await auth.signInAnonymously(); } catch (e) { console.error(e); } }
            
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (!jobDoc.exists) throw new Error("Invoice record not found.");
            const loadedJob = { ...jobDoc.data(), id: jobDoc.id } as Job;
            setJob(loadedJob);

            // Fetch Owner Org
            const orgDoc = await db.collection('organizations').doc(loadedJob.organizationId).get();
            if (orgDoc.exists) {
                const orgData = { ...orgDoc.data(), id: orgDoc.id } as Organization;
                setOrganization(orgData);
            }

            // Fetch Partner Org if assigned AND allowed
            if (loadedJob.assignedPartnerId && loadedJob.partnerAllowDirectPayment) {
                const pOrgDoc = await db.collection('organizations').doc(loadedJob.assignedPartnerId).get();
                if (pOrgDoc.exists) {
                    setPartnerOrganization({ ...pOrgDoc.data(), id: pOrgDoc.id } as Organization);
                }
            }

            // Platform settings for subscription jobs
            if (loadedJob.source === 'PlatformAdmin') {
                const settingsDoc = await db.collection('platformSettings').doc('global').get();
                if (settingsDoc.exists) {
                    setPlatformSettings({ ...settingsDoc.data(), id: settingsDoc.id } as PlatformSettings);
                }
            }

            setLoading(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "System Error");
            setLoading(false);
        }
    };
    fetchData();
  }, [jobId]);

  // Update payment provider config when recipient or data changes
  useEffect(() => {
      const activeOrg = paymentRecipient === 'partner' ? partnerOrganization : organization;
      if (!activeOrg || !job) return;

      const isTestOrg = activeOrg.name?.trim().toLowerCase() === 'tektestsub';

      // Priority 1: Respect the explicit default payment gateway if set
      if (activeOrg.defaultPaymentGateway === 'kort' && activeOrg.kortAccountId && isTestOrg) {
          setPaymentMethod('kort');
      } else if (isTestOrg) {
          setPaymentMethod('kort');
      } else if (activeOrg.defaultPaymentGateway === 'square' && activeOrg.squareApplicationId) {
          setPaymentMethod('square');
      } else if (activeOrg.defaultPaymentGateway === 'stripe' && activeOrg.stripePublicKey) {
          setPaymentMethod('stripe');
      } else if (activeOrg.defaultPaymentGateway === 'paypal' && activeOrg.paypalClientId) {
          setPaymentMethod('paypal');
      } else {
          // Priority 2: Fallback logic based on available keys
          if (activeOrg.stripePublicKey && job.source !== 'PlatformAdmin') {
              setPaymentMethod('stripe');
          } else if (activeOrg.squareApplicationId && activeOrg.squareLocationId && job.source !== 'PlatformAdmin') {
              setPaymentMethod('square');
          } else {
              setPaymentMethod('paypal');
          }
      }
  }, [organization, partnerOrganization, paymentRecipient, job]);

  const markJobPaid = async (paymentIntentId?: string) => {
      if (!job || !jobId) return;
      try {
          const updateData: any = { 
              'invoice.status': 'Paid', 
              'invoice.paidDate': new Date().toISOString(),
              'invoice.paidTo': paymentRecipient === 'partner' ? partnerOrganization?.id : organization?.id,
              'invoice.paymentRecipientName': paymentRecipient === 'partner' ? partnerOrganization?.name : organization?.name
          };
          if (paymentIntentId) {
              updateData['invoice.paymentIntentId'] = paymentIntentId;
          }
          await db.collection('jobs').doc(jobId).update(updateData);
          if (job.source === 'PlatformAdmin' && job.customerId) await db.collection('organizations').doc(job.customerId).update({ subscriptionStatus: 'active' });
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const notificationContent = `💰 Payment received for Invoice #${job.invoice.id || job.id.substring(0,8)} from ${job.customerName}. Amount: $${(typeof job.invoice.totalAmount === 'number' ? job.invoice.totalAmount : (job.invoice.amount || 0)).toFixed(2)}.`;
              
              const recipientId = job.assignedTechnicianId;
              if (recipientId) {
                  await sendNotification(recipientId, { title: 'Invoice Paid!', body: notificationContent, type: 'invoice_paid' }, job.organizationId);
              }
              await notifyAdmins(job.organizationId, { title: 'Invoice Paid!', body: notificationContent, type: 'invoice_paid' });
          } catch(e) { console.error('Failed to send notifications', e); }

          setJob({ ...job, invoice: { ...job.invoice, status: 'Paid' } });
          setSuccess(true);
          
          // Post-payment reminder if not signed
          if (!job.invoiceSignature) {
              showToast.info("Payment received! Please don't forget to sign the authorization below.");
              setTimeout(() => {
                  document.getElementById('signature-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 1500);
          }
      } catch { showToast.warn("Failed to update status."); }
  };

  interface PayPalActions {
    order?: {
        capture: () => Promise<{ status?: string }>;
    };
  }

  const handlePayPalApprove = async (data: Record<string, unknown>, actions: PayPalActions) => {
    try {
        const details = await actions.order.capture();
        if (details.status === 'COMPLETED') await markJobPaid();
    } catch { showToast.warn("Transaction failed."); }
  };
  
  const handleSubscriptionApprove = async () => { await markJobPaid(); showToast.warn("Subscription Active!"); };

  const handleSignInvoice = async () => {
      if (!sigPadRef.current || sigPadRef.current.isEmpty() || !job) { showToast.warn("Sign first."); return; }
      setIsSigning(true);
      try {
          const sig = sigPadRef.current.toDataURL();
          await db.collection('jobs').doc(job.id).update({ invoiceSignature: sig, invoiceSignedDate: new Date().toISOString() });
          
          try {
              const { sendNotification, notifyAdmins } = await import('lib/notificationService');
              const notificationContent = `✍️ ${job.customerName} has signed the invoice #${job.invoice.id || job.id.substring(0,8)}.`;
              
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
  
  let activePaypalClientId = isPlatformSubscription ? platformSettings?.platformPaypalClientId : currentActiveOrg?.paypalClientId;
  let planIdToSubscribe = null;

  if (isPlatformSubscription && platformSettings && job) {
      const subtotal = job.invoice.subtotal || 0;
      const plans = platformSettings.plans;
      if (subtotal >= 499) planIdToSubscribe = plans.enterprise?.paypalMonthlyId;
      else if (subtotal >= 249) planIdToSubscribe = plans.growth?.paypalMonthlyId;
      else planIdToSubscribe = plans.starter?.paypalMonthlyId;
  }
  
  const safeTotal = job ? (typeof job.invoice.totalAmount === 'number' ? job.invoice.totalAmount : (job.invoice.amount || 0)) : 0;
  const isPaid = job?.invoice.status === 'Paid' || success;
  const showPayPal = !!activePaypalClientId && safeTotal > 0;

  if (loading) return <div className="p-4 md:p-10 text-center">Loading Invoice...</div>;
  if (error) return <div className="p-4 md:p-10 text-center text-red-500">{error}</div>;

  if (finished) {
      return (
          <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center justify-center text-center">
              <Card className="max-w-md w-full p-10 space-y-6 relative overflow-hidden">
                  {organization?.logoUrl && (
                      <img 
                          src={organization.logoUrl} 
                          alt="" 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] opacity-[0.04] pointer-events-none -rotate-12 z-0" 
                      />
                  )}
                  <div className="relative z-10 space-y-6">
                      <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-100 animate-bounce-short">
                          <CheckCircle size={40}/>
                      </div>
                      <div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight">All Set!</h2>
                          <p className="text-slate-500 font-medium mt-2">Thank you for your business. You may now close this window.</p>
                      </div>
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
                      autoPrint={autoPrint}
                  />
              )}
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-4 flex flex-col items-center">
        
        <Card className="max-w-xl w-full overflow-hidden mb-6 relative">
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
                <div className="p-6 border-b bg-white/80 backdrop-blur-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {currentActiveOrg?.logoUrl && <img src={currentActiveOrg.logoUrl} className="h-12 w-auto object-contain" alt="Logo"/>}
                    <div>
                        <h2 className="font-black text-xl text-slate-900">{job?.customerName}</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Invoice #{job?.invoice.id || job?.id.substring(0,8)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Due Date</p>
                    <p className="text-sm font-bold">{job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : 'Upon Receipt'}</p>
                </div>
            </div>

            {/* Recipient Selection */}
            {!isPaid && partnerOrganization && (
                <div className="bg-blue-50 border-b border-blue-100 p-4">
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
            
            <div className="p-6 space-y-4 bg-slate-50/50">
                {job?.invoice.items && job.invoice.items.length > 0 ? (
                    <div className="space-y-3">
                        {job.invoice.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700">{item.description}</span>
                                    {item.quantity && <span className="text-[10px] text-slate-400">Qty: {item.quantity}</span>}
                                </div>
                                <span className="font-black text-slate-900">${(item.total || 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-700">{job?.tasks.join(', ') || 'Service Provided'}</span>
                        <span className="font-black text-slate-900">${safeTotal.toFixed(2)}</span>
                    </div>
                )}
                
                <div className="pt-6 border-t border-slate-200 flex justify-between items-end">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Amount Due</p>
                        <p className="text-4xl font-black text-[#0284c7] tracking-tighter">${safeTotal.toFixed(2)}</p>
                    </div>
                    {isPaid && (
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase mb-1">
                                <CheckCircle size={12}/> Paid
                            </div>
                            <span className="text-[8px] text-slate-400 font-bold uppercase">To: {job?.invoice.paymentRecipientName || organization?.name}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 bg-white">
                {isPaid ? (
                    <div className="space-y-4">
                        <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[1.5rem] text-center">
                            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                                <CheckCircle size={24}/>
                            </div>
                            <h3 className="text-xl font-black text-emerald-900">Payment Successful</h3>
                            <p className="text-sm text-emerald-700 font-medium mt-1">A receipt has been sent to your email.</p>
                        </div>
                        <Button onClick={() => setIsPreviewOpen(true)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                            <Printer size={18}/> Print Receipt
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {safeTotal === 0 ? (
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
                                    This invoice has a $0.00 balance and requires confirmation to close.
                                </div>
                                <Button onClick={() => markJobPaid()} className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-black h-14 rounded-2xl shadow-lg shadow-blue-100 text-lg">
                                    Complete Transaction
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Pay Securely via {paymentMethod === 'paypal' ? 'PayPal' : 'Credit Card'}</p>
                                    {showPayPal && paymentMethod === 'paypal' && (
                                        <div className="relative z-10">
                                            <PayPalScriptProvider options={{ clientId: activePaypalClientId || '', intent: isPlatformSubscription ? 'subscription' : 'capture', vault: isPlatformSubscription }}>
                                                {isPlatformSubscription && planIdToSubscribe ? (
                                                    <PayPalButtons 
                                                        style={{ layout: "vertical", label: "subscribe", shape: "rect", height: 50 }} 
                                                        createSubscription={(data, actions) => actions.subscription.create({ plan_id: planIdToSubscribe })} 
                                                        onApprove={handleSubscriptionApprove} 
                                                    />
                                                ) : (
                                                    <PayPalButtons 
                                                        style={{ layout: "vertical", shape: "rect", height: 50 }} 
                                                        createOrder={(_, actions) => actions.order.create({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: 'USD', value: safeTotal.toFixed(2) } }] })} 
                                                        onApprove={handlePayPalApprove} 
                                                    />
                                                )}
                                            </PayPalScriptProvider>
                                        </div>
                                    )}

                                    {paymentMethod === 'square' && currentActiveOrg?.squareApplicationId && currentActiveOrg?.squareLocationId && (
                                        <div className="relative z-10">
                                            <SquarePaymentForm 
                                                applicationId={currentActiveOrg.squareApplicationId}
                                                locationId={currentActiveOrg.squareLocationId}
                                                amount={safeTotal}
                                                organizationId={currentActiveOrg.id}
                                                jobId={jobId}
                                                customerEmail={job?.customerEmail || ''}
                                                onSuccess={async (_paymentId) => {
                                                    await markJobPaid(_paymentId);
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
                                                amount={safeTotal}
                                                jobId={jobId}
                                                accountId={currentActiveOrg?.kortAccountId}
                                                organizationId={currentActiveOrg?.id}
                                                onSuccess={async (_paymentId) => {
                                                    await markJobPaid(_paymentId);
                                                    showToast.success("Payment Successful via Kort");
                                                }}
                                                onError={(err) => {
                                                    setError(err);
                                                    showToast.error(err);
                                                }}
                                            />
                                        </div>
                                    )}
                                    
                                    {paymentMethod === 'paypal' && !showPayPal && (
                                        <div className="p-4 md:p-8 text-center border-2 border-dashed border-slate-200 rounded-[1.5rem] bg-slate-50">
                                            <Lock size={32} className="mx-auto text-slate-300 mb-2"/>
                                            <p className="text-sm font-bold text-slate-500 uppercase">PayPal configuration pending</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Please contact {currentActiveOrg?.name || 'the service provider'} to complete payment.</p>
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
                    <div id="signature-section" className="pt-6 border-t border-slate-100 mt-6">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Customer Authorization Required</p>
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
                        <Button onClick={handleFinish} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-14 rounded-2xl shadow-xl shadow-slate-200 text-lg">
                            COMPLETE & FINISH
                        </Button>
                        <p className="text-[10px] text-slate-400 text-center mt-3 font-bold uppercase tracking-widest">Return to Customer Session</p>
                    </div>
                )}
            </div>
            </div>
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-[10px] font-black">TT</div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Powered by TekTrakker</span>
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
