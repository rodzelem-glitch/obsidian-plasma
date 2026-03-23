
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import { 
    MapPinIcon, UserIcon, CalendarIcon, Clock, AlertTriangle, ShieldCheck, 
    DollarSign, SettingsIcon, LogOut, HelpCircle, TrashIcon, Link as LinkIcon, 
    Search, Printer, Shield
} from '@constants';
import { db } from 'lib/firebase';
import type { Customer, MembershipPlan, ServiceAgreement, Job, Proposal, User as AppUser, Organization, BusinessDocument } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { QRCodeCanvas } from 'qrcode.react';
import { formatAddress } from 'lib/utils';
import { APEX_MOCK_DOCUMENTS, MILE_HIGH_MOCK_ORG } from 'lib/mock-data/apex-demo';

// Modular Components
import AppointmentsSection from './components/AppointmentsSection';
import ProposalsSection from './components/ProposalsSection';
import ServiceHistorySection from './components/ServiceHistorySection';
import InvoicesSection from './components/InvoicesSection';
import SafetySupportSection from './components/SafetySupportSection';
import MembershipSection from './components/MembershipSection';
import PlansModal from './components/PlansModal';
import ActionRequiredSection from './components/ActionRequiredSection';
import AssetsSection from './components/AssetsSection';
import JobDetailModal from 'components/modals/JobDetailModal';
import type { StoredFile } from 'types';

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX = 500;
                    if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
                    else { if (height > MAX) { width *= MAX / height; height = MAX; } }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
            } else {
                resolve(event.target?.result as string);
            }
        };
        reader.onerror = reject;
    });
};

const CustomerDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isDemoMode, customers, currentOrganization, jobs } = state;
    const navigate = useNavigate();
    
    const [linkedProfiles, setLinkedProfiles] = useState<{ customer: Customer, org: Organization }[]>([]);
    const [activeCustomerRecord, setActiveCustomerRecord] = useState<Customer | null>(null);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [orgPlans, setOrgPlans] = useState<MembershipPlan[]>([]);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isPlanSelectionModalOpen, setIsPlanSelectionModalOpen] = useState(false);
    const [isSigningProposal, setIsSigningProposal] = useState(false);

    const [viewingJobReport, setViewingJobReport] = useState<Job | null>(null);
    const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
    const [viewingWaiverToSign, setViewingWaiverToSign] = useState<{ job: Job, file: StoredFile } | null>(null);
    const [viewingDocumentToSign, setViewingDocumentToSign] = useState<BusinessDocument | null>(null);

    const [requestData, setRequestData] = useState({ type: 'Repair', date: '', window: 'Anytime', notes: '' });
    const [profileData, setProfileData] = useState<Partial<Customer>>({});
    const [helpData, setHelpData] = useState({ subject: '', description: '', isPlatformIssue: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProfilePic, setUploadProfilePic] = useState<File | null>(null);

    const sigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        if (isDemoMode) {
            const demoCustomer = customers.find(c => c.email === currentUser?.email);
            if (demoCustomer && currentOrganization) {
                const mockProfiles = [
                    { customer: demoCustomer, org: currentOrganization },
                    { customer: { ...demoCustomer, organizationId: 'mhm-org-789' }, org: MILE_HIGH_MOCK_ORG },
                ];
                setLinkedProfiles(mockProfiles);
                if (!activeCustomerRecord) {
                    setActiveCustomerRecord(demoCustomer);
                    setActiveOrg(currentOrganization);
                }
                 if (!state.documents.some(d => d.id === 'doc-waiver-1')) {
                    dispatch({ type: 'SET_DOCUMENTS', payload: [...state.documents, ...APEX_MOCK_DOCUMENTS] });
                }
                setOrgPlans(state.membershipPlans);
            }
            return;
        }

        const fetchProfiles = async () => {
            if (!currentUser) return;
            try {
                const profilesMap = new Map<string, { customer: Customer, org: Organization }>();

                // 1. Search by UID directly (Most accurate)
                const uidDoc = await db.collection('customers').doc(currentUser.uid).get();
                if (uidDoc.exists) {
                    const cust = { ...uidDoc.data(), id: uidDoc.id } as Customer;
                    if (cust.organizationId) {
                         const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                         if (orgDoc.exists) profilesMap.set(cust.id, { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization });
                    }
                }

                // 2. Search by Email as a fallback
                if (currentUser.email && profilesMap.size === 0) {
                    const emailSnap = await db.collection('customers').where('email', '==', currentUser.email).get();
                    for (const doc of emailSnap.docs) {
                        const cust = { ...doc.data(), id: doc.id } as Customer;
                        if (cust.organizationId && !profilesMap.has(cust.id)) {
                            const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                            if (orgDoc.exists) profilesMap.set(cust.id, { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization });
                        }
                    }
                }

                const profiles = Array.from(profilesMap.values());
                setLinkedProfiles(profiles);

                if (profiles.length > 0 && !activeCustomerRecord) {
                    const currentContextProfile = profiles.find(p => p.customer.organizationId === currentUser.organizationId) || profiles[0];
                    setActiveCustomerRecord(currentContextProfile.customer);
                    setActiveOrg(currentContextProfile.org);
                }
            } catch (e) { console.error("Error fetching profiles:", e); }
        };
        fetchProfiles();
    }, [currentUser, isDemoMode, customers, currentOrganization, activeCustomerRecord, dispatch, state.documents, state.membershipPlans]);

    useEffect(() => {
        if (!activeOrg || isDemoMode) return;
        const unsub = db.collection('membershipPlans')
            .where('organizationId', '==', activeOrg.id)
            .onSnapshot(snap => setOrgPlans(snap.docs.map(d => ({ ...d.data(), id: d.id } as MembershipPlan))));
        return unsub;
    }, [activeOrg, isDemoMode]);

    const handleSwitchProvider = (orgId: string) => {
        const selected = linkedProfiles.find(p => p.org.id === orgId);
        if (selected) {
            setActiveCustomerRecord(selected.customer);
            setActiveOrg(selected.org);
        }
    };

    const membership = useMemo<ServiceAgreement | null>(() => {
        if (!activeCustomerRecord) return null;
        return state.serviceAgreements.find(item => item.customerId === activeCustomerRecord.id && item.status === 'Active') || null;
    }, [activeCustomerRecord, state.serviceAgreements]);

    const myJobs = useMemo<Job[]>(() => {
        if (!activeCustomerRecord) return [];
        const cleanName = activeCustomerRecord.name.trim().toLowerCase();
        return jobs.filter(j => 
            j.organizationId === activeOrg?.id && 
            (j.customerId === activeCustomerRecord.id || j.customerName?.trim().toLowerCase() === cleanName)
        ).sort((a, b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [activeCustomerRecord, activeOrg, jobs]);

    const myProposals = useMemo<Proposal[]>(() => {
        if (!state.currentUser?.email) return [];
        const email = state.currentUser.email.toLowerCase();
        const cleanName = (state.currentUser.firstName + " " + state.currentUser.lastName).toLowerCase();

        return state.proposals.filter(p => 
            p.customerEmail?.toLowerCase() === email || 
            p.customerName?.toLowerCase() === cleanName ||
            (activeCustomerRecord && p.customerId === activeCustomerRecord.id)
        );
    }, [state.currentUser, state.proposals, activeCustomerRecord]);

    const upcomingJobs = useMemo<Job[]>(() => myJobs.filter((j: Job) => j.jobStatus !== 'Completed'), [myJobs]);
    const activeJob = useMemo<Job | null>(() => myJobs.find(j => j.jobStatus === 'In Progress') || upcomingJobs[0] || null, [myJobs, upcomingJobs]);
    const assignedTech = useMemo<AppUser | null>(() => activeJob?.assignedTechnicianId ? state.users.find(u => u.id === activeJob.assignedTechnicianId) || null : null, [activeJob, state.users]);
    const unpaidInvoices = useMemo<Job[]>(() => myJobs.filter((j: Job) => j.invoice?.status === 'Unpaid' || j.invoice?.status === 'Pending'), [myJobs]);

    const estimatedSavings = useMemo(() => {
        if (!membership) return 0;
        const visitsVal = (membership.visitsTotal - membership.visitsRemaining) * 129;
        const discountVal = myJobs.reduce((sum, j) => sum + ((j.invoice?.totalAmount || j.invoice?.amount || 0) * 0.15), 0);
        return Math.round(visitsVal + discountVal);
    }, [membership, myJobs]);

    const handleOpenProfile = () => {
        if (activeCustomerRecord) {
            setProfileData(activeCustomerRecord);
            setIsProfileModalOpen(true);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCustomerRecord) return;
        setIsSubmitting(true);
        try {
            let photoUrl = activeCustomerRecord.profilePhotoUrl;
            if (uploadProfilePic) photoUrl = await compressFile(uploadProfilePic);
            const updatedData = { ...profileData, profilePhotoUrl: photoUrl || null };
            await db.collection('customers').doc(activeCustomerRecord.id).update(updatedData);
            setActiveCustomerRecord({ ...activeCustomerRecord, ...updatedData } as Customer);
            setIsProfileModalOpen(false);
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const handleHelpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCustomerRecord || !activeOrg) return;
        setIsSubmitting(true);
        const toEmail = helpData.isPlatformIssue ? 'platform@tektrakker.com' : activeOrg.email || 'platform@tektrakker.com';
        const subjectPrefix = helpData.isPlatformIssue ? '[Platform Support]' : `[Service Request: ${activeOrg.name}]`;
        try {
            await db.collection('mail').add({
                to: [toEmail],
                message: {
                    subject: `${subjectPrefix} ${helpData.subject}`,
                    text: `Customer Help Request\nFrom: ${activeCustomerRecord.name} (${activeCustomerRecord.email})\n\n${helpData.description}`,
                },
            });
            setIsHelpModalOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubscriptionApprove = async (data: any, plan: MembershipPlan, count: number) => {
        if (!activeCustomerRecord || !activeOrg) return;
        try {
            const finalPrice = plan.monthlyPrice + ((Math.max(1, count) - 1) * (plan.pricePerAdditionalSystem || 0));
            const newAgreement: ServiceAgreement = {
                id: `sa-${Date.now()}`,
                organizationId: activeOrg.id,
                customerId: activeCustomerRecord.id,
                customerName: activeCustomerRecord.name,
                planName: plan.name,
                price: finalPrice,
                billingCycle: 'Monthly',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 31536000000).toISOString(),
                status: 'Active',
                visitsTotal: plan.visitsPerYear,
                visitsRemaining: plan.visitsPerYear,
                autoBillingId: data.subscriptionID,
                autoBillingProcessor: 'paypal'
            };
            await db.collection('serviceAgreements').doc(newAgreement.id).set(newAgreement);
            setIsPlanSelectionModalOpen(false);
        } catch (error) { console.error(error); }
    };

    const handleConfirmWaiverSignature = async () => {
        if (!sigPadRef.current || sigPadRef.current.isEmpty() || !viewingWaiverToSign) return;
        setIsSubmitting(true);
        try {
            const signature = sigPadRef.current.toDataURL();
            const { job, file } = viewingWaiverToSign;
            
            // Decoded the original HTML from the dataUrl
            const originalHtml = atob(file.dataUrl.split(',')[1]);
            const signedHtml = originalHtml.replace('</body>', `
                <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                    <p style="font-size: 12px; color: #666;">Signed Electronic Signature:</p>
                    <img src="${signature}" width="250" />
                    <p style="font-size: 10px; color: #999;">Signed on: ${new Date().toLocaleString()}</p>
                </div>
                </body>
            `);

            const updatedFile: StoredFile = {
                ...file,
                fileName: 'Signed_Waiver.html',
                dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signedHtml))),
                metadata: {
                    ...file.metadata,
                    status: 'Signed',
                    isActionRequired: false,
                    signedAt: new Date().toISOString()
                }
            };

            const updatedFiles = (job.files || []).map(f => f.id === file.id ? updatedFile : f);

            const twinDocId = state.documents.find(d => d.jobId === job.id && (d as any).status === 'Pending Signature' && d.url === file.dataUrl)?.id;

            if (isDemoMode) {
                if (twinDocId) {
                    const twinDoc = state.documents.find(d => d.id === twinDocId);
                    dispatch({ type: 'UPDATE_DOCUMENT', payload: { ...twinDoc, status: 'Signed', signature, signedAt: new Date().toISOString() } as BusinessDocument });
                }
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, files: updatedFiles } });
            } else {
                if (twinDocId) {
                    await db.collection('documents').doc(twinDocId).update({ status: 'Signed', signature, signedAt: new Date().toISOString() });
                }
                try {
                    await db.collection('jobs').doc(job.id).update({ files: updatedFiles });
                } catch (jobErr) {
                    console.warn('Could not update job files due to permissions, but twin document was signed safely.', jobErr);
                }
            }

            setViewingWaiverToSign(null);
            sigPadRef.current.clear();
        } catch (e: any) {
            console.error(e);
            alert("Failed to save signature: " + (e.message || String(e)));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmDocumentSignature = async () => {
        if (!sigPadRef.current || sigPadRef.current.isEmpty() || !viewingDocumentToSign) return;
        setIsSubmitting(true);
        try {
            const signature = sigPadRef.current.toDataURL();
            const doc = viewingDocumentToSign;
            
            const signedHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    ${doc.content}
                    <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        <p style="font-size: 12px; color: #666;">Signed Electronic Signature:</p>
                        <img src="${signature}" width="250" />
                        <p style="font-size: 10px; color: #999;">Signed on: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            `;

            const job = jobs.find(j => j.id === doc.jobId);
            let updatedFiles = job?.files;
            if (job) {
                const twinFile = job.files?.find(f => f.metadata?.status === 'Pending Signature' && f.dataUrl === doc.url);
                if (twinFile) {
                    const updatedFile = {
                        ...twinFile,
                        fileName: 'Signed_Waiver.html',
                        dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signedHtml))),
                        metadata: { ...twinFile.metadata, status: 'Signed', isActionRequired: false, signedAt: new Date().toISOString() }
                    };
                    updatedFiles = job.files?.map(f => f.id === twinFile.id ? updatedFile : f) || [];
                }
            }

            if (isDemoMode) {
                dispatch({ type: 'UPDATE_DOCUMENT', payload: { ...doc, status: 'Signed', url: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signedHtml))), signature } as BusinessDocument });
                if (job && updatedFiles) {
                    dispatch({ type: 'UPDATE_JOB', payload: { ...job, files: updatedFiles } });
                }
            } else {
                await db.collection('documents').doc(doc.id).update({
                    status: 'Signed',
                    signature,
                    signedAt: new Date().toISOString(),
                    url: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signedHtml)))
                });
                if (job && updatedFiles) {
                    try {
                        await db.collection('jobs').doc(job.id).update({ files: updatedFiles });
                    } catch (jobErr) {
                        console.warn('Could not update job files due to permissions, but main document was signed safely.', jobErr);
                    }
                }
            }

            setViewingDocumentToSign(null);
            sigPadRef.current.clear();
        } catch (e: any) { 
            console.error(e); 
            alert("Failed to save signature: " + (e.message || String(e)));
        } finally { 
            setIsSubmitting(false); 
        }
    };

    if (!currentUser || !activeCustomerRecord) {
        return <div className="p-4 md:p-10 text-center">Loading Secure Portal...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
            {viewingProposal && (
                <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                    <DocumentPreview type="Proposal" data={viewingProposal} onClose={() => setViewingProposal(null)} isInternal={false} />
                    {viewingProposal.status === 'Sent' && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110]">
                            <Button onClick={() => setIsSigningProposal(true)} className="bg-emerald-600 h-16 px-12 text-xl font-black">Accept & Authorize Proposal</Button>
                        </div>
                    )}
                </div>
            )}
            
            {viewingWaiverToSign && (
                <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                    <DocumentPreview 
                        type="Other" 
                        data={{ 
                            title: 'Review Waiver', 
                            htmlContent: atob(viewingWaiverToSign.file.dataUrl.split(',')[1]) 
                        }} 
                        onClose={() => setViewingWaiverToSign(null)} 
                        isInternal={false} 
                    />
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 w-[90%] md:w-[500px]">
                        <p className="text-sm font-black uppercase text-slate-500 mb-4 text-center">Sign Below to Authorize</p>
                        <SignaturePad ref={sigPadRef} className="h-44 shadow-inner mb-6 bg-slate-50 border border-slate-200 rounded-2xl" />
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setViewingWaiverToSign(null)} className="flex-1">Cancel</Button>
                            <Button onClick={handleConfirmWaiverSignature} disabled={isSubmitting} className="flex-1 bg-emerald-600">{isSubmitting ? '...' : 'Accept & Sign'}</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {viewingDocumentToSign && (
                <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                    <DocumentPreview 
                        type="Other" 
                        data={{ 
                            title: viewingDocumentToSign.title, 
                            htmlContent: viewingDocumentToSign.content 
                        }} 
                        onClose={() => setViewingDocumentToSign(null)} 
                        isInternal={false} 
                    />
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 w-[90%] md:w-[500px]">
                        <p className="text-sm font-black uppercase text-slate-500 mb-4 text-center">Sign Below to Authorize</p>
                        <SignaturePad ref={sigPadRef} className="h-44 shadow-inner mb-6 bg-slate-50 border border-slate-200 rounded-2xl" />
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setViewingDocumentToSign(null)} className="flex-1">Cancel</Button>
                            <Button onClick={handleConfirmDocumentSignature} disabled={isSubmitting} className="flex-1 bg-emerald-600">{isSubmitting ? '...' : 'Accept & Sign'}</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {isSigningProposal && (
                <Modal isOpen={true} onClose={() => setIsSigningProposal(false)} title="Sign Proposal Acceptance">
                    <div className="space-y-6">
                        <p className="text-sm text-slate-500">Authorize work at quoted price.</p>
                        <SignaturePad ref={sigPadRef} className="h-44 shadow-inner" />
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setIsSigningProposal(false)} className="flex-1">Cancel</Button>
                            <Button onClick={async () => {
                                if (!sigPadRef.current || sigPadRef.current.isEmpty()) return;
                                setIsSubmitting(true);
                                await db.collection('proposals').doc(viewingProposal!.id).update({ status: 'Accepted', signatureDataUrl: sigPadRef.current.toDataURL() });
                                setViewingProposal(null); setIsSigningProposal(false); setIsSubmitting(false);
                            }} disabled={isSubmitting} className="flex-1 bg-emerald-600">{isSubmitting ? '...' : 'Confirm Acceptance'}</Button>
                        </div>
                    </div>
                </Modal>
            )}

            <JobDetailModal 
                isOpen={!!viewingJobReport} 
                onClose={() => setViewingJobReport(null)} 
                job={viewingJobReport as Job}
                isAdmin={false}
                onPrint={() => window.print()}
            />

            <div className="bg-white dark:bg-slate-900 border-b px-6 py-4 md:py-8">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          {activeCustomerRecord.profilePhotoUrl ? <img src={activeCustomerRecord.profilePhotoUrl} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center"><UserIcon size={32}/></div>}
                          <button onClick={handleOpenProfile} className="absolute bottom-0 right-0 p-1.5 bg-primary-600 text-white rounded-full"><SettingsIcon size={12} /></button>
                      </div>
                      <div>
                          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Welcome, {activeCustomerRecord.firstName || activeCustomerRecord.name.split(' ')[0]}</h1>
                          <p className="text-slate-500 flex items-center gap-2"><MapPinIcon size={14}/> {formatAddress(activeCustomerRecord.address)}</p>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                       <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                           <select value={activeOrg?.id} onChange={(e) => handleSwitchProvider(e.target.value)} className="bg-white dark:bg-slate-700 rounded text-sm font-bold py-1 px-3">
                               {linkedProfiles.map(p => <option key={p.org.id} value={p.org.id}>{p.org.name}</option>)}
                           </select>
                           <button onClick={() => navigate('/marketplace')} className="text-[10px] font-black uppercase text-primary-600 px-2">Link New</button>
                       </div>
                       <div className="flex gap-3">
                          <Button onClick={() => setIsRequestModalOpen(true)}>Book Service</Button>
                          <Button onClick={() => setIsHelpModalOpen(true)} variant="secondary">Help</Button>
                      </div>
                  </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto w-full px-6 mt-8 space-y-8">
                {assignedTech && activeJob && (activeJob.jobStatus === 'Scheduled' || activeJob.jobStatus === 'In Progress') && (
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 border-primary-500 shadow-xl flex items-center gap-6">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden">{assignedTech.profilePicUrl ? <img src={assignedTech.profilePicUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><UserIcon size={32}/></div>}</div>
                        <div>
                            <h3 className="text-2xl font-black">{assignedTech.firstName} {assignedTech.lastName}</h3>
                            <p className="text-sm font-bold uppercase text-slate-500">{assignedTech.role} • Verified</p>
                            <p className="text-xs text-primary-600 font-bold">Today at {new Date(activeJob.appointmentTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                )}

                <ActionRequiredSection 
                    jobs={myJobs} 
                    proposals={myProposals} 
                    documents={state.documents}
                    onSignWaiver={(job, file) => setViewingWaiverToSign({ job, file })}
                    onSignProposal={(proposal) => { setViewingProposal(proposal); setIsSigningProposal(true); }}
                    onSignDocument={(doc) => setViewingDocumentToSign(doc)}
                />

                <AssetsSection assets={activeCustomerRecord.equipment || []} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <AppointmentsSection jobs={upcomingJobs} documents={state.documents} />
                        <ProposalsSection proposals={myProposals} onViewProposal={setViewingProposal} />
                        <ServiceHistorySection 
                            jobs={myJobs.filter(j => j.jobStatus === 'Completed')}
                            onViewReport={setViewingJobReport}
                            customerId={activeCustomerRecord.id}
                            organizationId={activeOrg?.id || null}
                            organizationName={activeOrg?.name || null}
                            customerName={activeCustomerRecord.name}
                        />
                    </div>
                    <div className="space-y-8">
                        <InvoicesSection jobs={unpaidInvoices} />
                        <SafetySupportSection onReportConcern={() => setIsHelpModalOpen(true)} />
                    </div>
                </div>
            </div>

            <PlansModal isOpen={isPlanSelectionModalOpen} onClose={() => setIsPlanSelectionModalOpen(false)} plans={orgPlans} organization={activeOrg} onApprove={handleSubscriptionApprove} />

            <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="New Request">
                <form onSubmit={async (e) => {
                    e.preventDefault(); setIsSubmitting(true);
                    await db.collection('appointments').add({
                        organizationId: activeOrg!.id, customerId: activeCustomerRecord.id, customerName: activeCustomerRecord.name,
                        customerPhone: activeCustomerRecord.phone, customerEmail: activeCustomerRecord.email, address: activeCustomerRecord.address,
                        tasks: [requestData.type], appointmentTime: new Date(requestData.date || Date.now()).toISOString(),
                        status: 'Pending', source: 'CustomerPortal', createdAt: new Date().toISOString()
                    });
                    setIsRequestModalOpen(false); setIsSubmitting(false);
                }} className="space-y-4">
                    <Select label="Type" value={requestData.type} onChange={e => setRequestData({...requestData, type: e.target.value})}><option value="Repair">Repair</option></Select>
                    <Input label="Date" type="date" value={requestData.date} onChange={e => setRequestData({...requestData, date: e.target.value})} />
                    <Button type="submit">Submit Request</Button>
                </form>
            </Modal>

            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Get Help">
                <form onSubmit={handleHelpSubmit} className="space-y-4">
                    <Input label="Subject" value={helpData.subject} onChange={e => setHelpData({ ...helpData, subject: e.target.value })} />
                    <Textarea label="Description" value={helpData.description} onChange={e => setHelpData({ ...helpData, description: e.target.value })} rows={5} />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="platform-issue" checked={helpData.isPlatformIssue} onChange={e => setHelpData({ ...helpData, isPlatformIssue: e.target.checked })} />
                        <label htmlFor="platform-issue" className="text-sm">This is about the TekTrakker platform itself.</label>
                    </div>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Request'}</Button>
                </form>
            </Modal>

             <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Profile & Preferences" size="lg">
                <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-200 bg-slate-100 flex items-center justify-center relative group">
                            {uploadProfilePic ? (
                                <img src={URL.createObjectURL(uploadProfilePic)} className="w-full h-full object-cover" />
                            ) : activeCustomerRecord.profilePhotoUrl ? (
                                <img src={activeCustomerRecord.profilePhotoUrl} className="w-full h-full object-cover" />
                            ) : <UserIcon size={40} className="text-slate-400"/>}
                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-xs font-bold">
                                Change <input type="file" className="hidden" accept="image/*" onChange={e => setUploadProfilePic(e.target.files?.[0] || null)} />
                            </label>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{activeCustomerRecord.name}</h3>
                            <p className="text-sm text-slate-500">{activeCustomerRecord.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <h4 className="font-bold text-sm border-b pb-2">Contact Info</h4>
                             <Input label="Name" value={profileData.name || ''} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                             <Input label="Phone" value={profileData.phone || ''} onChange={e => setProfileData({...profileData, phone: e.target.value})} />
                        </div>
                        <div className="space-y-4">
                             <h4 className="font-bold text-sm border-b pb-2">Property Details</h4>
                             <Input label="Address" value={profileData.address || ''} onChange={e => setProfileData({...profileData, address: e.target.value as any})} />
                        </div>
                    </div>
                     <div className="flex justify-between items-center pt-4 border-t">
                        <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="text-red-500 text-xs hover:underline flex items-center gap-1"><LogOut size={12}/> Delete Account</button>
                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Profile'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CustomerDashboard;
