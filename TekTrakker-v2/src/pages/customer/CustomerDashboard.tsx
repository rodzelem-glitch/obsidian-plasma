
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
import { Sparkles, CreditCard, Users, UserCheck, X, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { db, auth } from 'lib/firebase';
import type { Customer, MembershipPlan, ServiceAgreement, Job, Proposal, User as AppUser, Organization, BusinessDocument, EquipmentAsset } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';
import { QRCodeCanvas } from 'qrcode.react';
import { formatAddress, matchTier, displayTierName, cleanUndefinedFields, getAvailableProposalTiers, getProposalTierLabel } from 'lib/utils';
import { computeCanonicalFinancials } from 'lib/financialCalculator';
import { APEX_MOCK_DOCUMENTS, APEX_MOCK_JOBS, APEX_MOCK_PROPOSALS, MILE_HIGH_MOCK_ORG } from 'lib/mock-data/apex-demo';
import showToast from 'lib/toast';

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
import PhotosDocumentsSection from './components/PhotosDocumentsSection';
import WarrantySection from './components/WarrantySection';
import LocationCardsSection from './components/LocationCardsSection';
import LocationDetailModal from './components/LocationDetailModal';
import WorkOrdersSection from './components/WorkOrdersSection';
import UnitDetailModal from './components/UnitDetailModal';
import CustomerProfileModal from './components/CustomerProfileModal';
import CustomerReferralSection from './components/CustomerReferralSection';
import ReferralTrackerModal from './components/ReferralTrackerModal';
import SubmitPaymentModal from './components/SubmitPaymentModal';
import CustomerWarrantyPurchaseModal from './components/CustomerWarrantyPurchaseModal';
import DesignateContactsModal from './components/DesignateContactsModal';
import ContractedRatesAndAgreementsSection from './components/ContractedRatesAndAgreementsSection';
import CustomMaintenanceScheduleSection from './components/CustomMaintenanceScheduleSection';
import CreateWorkOrderModal from './components/CreateWorkOrderModal';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobAppointmentModal from 'components/modals/JobAppointmentModal';
import type { StoredFile, CustomerReferral, ServiceLocation } from 'types';
import { uploadFileToStorage } from 'lib/storageService';


const CustomerDashboard: React.FC = () => {
    const { state, dispatch, exitDemo } = useAppContext();
    const { currentUser, isDemoMode, customers, currentOrganization, jobs } = state;
    const navigate = useNavigate();
    
    const [linkedProfiles, setLinkedProfiles] = useState<{ customer: Customer, org: Organization }[]>([]);
    const [activeCustomerRecord, setActiveCustomerRecord] = useState<Customer | null>(null);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [orgPlans, setOrgPlans] = useState<MembershipPlan[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
    const [selectedLocationForModal, setSelectedLocationForModal] = useState<ServiceLocation | null>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<Job | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [referrals, setReferrals] = useState<CustomerReferral[]>([]);
    const [isReferralTrackerOpen, setIsReferralTrackerOpen] = useState(false);

    useEffect(() => {
        if (!currentUser?.uid || isDemoMode) return;
        const unsub = db.collection('referrals')
            .where('referrerUserId', '==', currentUser.uid)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as CustomerReferral));
                setReferrals(list);
            }, err => {
                console.error('[CustomerDashboard] Error fetching referrals:', err);
            });
        return unsub;
    }, [currentUser, isDemoMode]);

    useEffect(() => {
        if (currentUser) {
            const role = currentUser.customerPortalRole;
            const allowedIds = currentUser.allowedLocationIds || [];
            if ((role === 'branch' || role === 'regional') && allowedIds.length === 1) {
                setSelectedLocationId(allowedIds[0]);
            } else if (role === 'branch' && allowedIds.length > 0) {
                setSelectedLocationId(allowedIds[0]);
            } else {
                setSelectedLocationId('all');
            }
        }
    }, [currentUser]);

    useEffect(() => {
        if (activeCustomerRecord) {
            localStorage.setItem('activeCustomerRecordId', activeCustomerRecord.id);
        }
    }, [activeCustomerRecord]);

    useEffect(() => {
        if (activeOrg) {
            localStorage.setItem('activeOrgId', activeOrg.id);
        }
    }, [activeOrg]);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCancelPlanModalOpen, setIsCancelPlanModalOpen] = useState(false);
    const [isPlanSelectionModalOpen, setIsPlanSelectionModalOpen] = useState(false);
    const [isSigningProposal, setIsSigningProposal] = useState(false);
    const [selectedProposalTier, setSelectedProposalTier] = useState<string | null>(null);

    const [viewingJobReport, setViewingJobReport] = useState<Job | null>(null);
    const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
    const [viewingWaiverToSign, setViewingWaiverToSign] = useState<{ job: Job, file: StoredFile } | null>(null);
    const [viewingDocumentToSign, setViewingDocumentToSign] = useState<BusinessDocument | null>(null);
    const [viewingWarrantyJob, setViewingWarrantyJob] = useState<Job | null>(null);
    const [isWarrantyModalOpen, setIsWarrantyModalOpen] = useState(false);
    const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
    const [contactsModalLocationId, setContactsModalLocationId] = useState<string | null>(null);
    const [contactsModalJobId, setContactsModalJobId] = useState<string | null>(null);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [selectedUnitForModal, setSelectedUnitForModal] = useState<EquipmentAsset | null>(null);
    const [selectedEquipmentForWarrantyModal, setSelectedEquipmentForWarrantyModal] = useState<EquipmentAsset | null>(null);
    const [isCustomerWarrantyModalOpen, setIsCustomerWarrantyModalOpen] = useState(false);

    const [workOrderInitialLocationId, setWorkOrderInitialLocationId] = useState<string | null>(null);
    const [workOrderInitialUnitId, setWorkOrderInitialUnitId] = useState<string | null>(null);
    const [workOrderInitialVisitType, setWorkOrderInitialVisitType] = useState<string | null>(null);
    const [workOrderInitialReason, setWorkOrderInitialReason] = useState<string | null>(null);

    const handleOpenNewWorkOrder = (locationId?: string | null, unitId?: string | null, visitType?: string | null, reason?: string | null) => {
        setWorkOrderInitialLocationId(locationId || (selectedLocationId !== 'all' ? selectedLocationId : 'default'));
        setWorkOrderInitialUnitId(unitId || null);
        setWorkOrderInitialVisitType(visitType || 'Diagnostic & Troubleshooting');
        setWorkOrderInitialReason(reason || '');
        setIsRequestModalOpen(true);
    };

    const [requestData, setRequestData] = useState({ type: 'Repair / Diagnostic', date: '', window: 'Morning (8:00 AM - 12:00 PM)', locationId: '', notes: '' });
    const [profileData, setProfileData] = useState<Partial<Customer>>({});
    const [helpData, setHelpData] = useState({ subject: '', description: '', isPlatformIssue: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProfilePic, setUploadProfilePic] = useState<File | null>(null);

    const sigPadRef = useRef<SignaturePadHandle>(null);

    const [hasTimedOut, setHasTimedOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!activeCustomerRecord) setHasTimedOut(true);
        }, 15000); // 15s timeout
        return () => clearTimeout(timer);
    }, [activeCustomerRecord]);

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
            if (!currentUser) {
                console.log("[CustomerDashboard] No currentUser yet, waiting...");
                return;
            }
            try {
                console.log("[CustomerDashboard] Fetching profiles for:", currentUser.email, currentUser.uid);
                const profilesMap = new Map<string, { customer: Customer, org: Organization }>();
                // 0. Search by direct customerId match (for invited secondary customer users)
                if ((currentUser as any).customerId) {
                    console.log("[CustomerDashboard] Found customerId in currentUser profile:", (currentUser as any).customerId);
                    const custDoc = await db.collection('customers').doc((currentUser as any).customerId).get();
                    if (custDoc.exists) {
                        const cust = { ...custDoc.data(), id: custDoc.id } as Customer;
                        if (cust.organizationId) {
                            const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                            if (orgDoc.exists) {
                                profilesMap.set(cust.id, { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization });
                            }
                        }
                    }
                }

                // 1. Search by UID directly (Doc ID match)
                const uidDoc = await db.collection('customers').doc(currentUser.uid).get();
                if (uidDoc.exists) {
                    console.log("[CustomerDashboard] Found customer by UID doc");
                    const cust = { ...uidDoc.data(), id: uidDoc.id } as Customer;
                    if (cust.organizationId) {
                         const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                         if (orgDoc.exists) profilesMap.set(cust.id, { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization });
                    }
                }

                // 2. Search by userId field (Linked match)
                if (profilesMap.size === 0) {
                    const userIdSnap = await db.collection('customers').where('userId', '==', currentUser.uid).get();
                    if (!userIdSnap.empty) {
                        console.log("[CustomerDashboard] Found customer by userId field");
                        const fetchPromises = userIdSnap.docs.map(async (doc) => {
                            const cust = { ...doc.data(), id: doc.id } as Customer;
                            if (cust.organizationId && !profilesMap.has(cust.id)) {
                                const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                                if (orgDoc.exists) {
                                    return { custId: cust.id, data: { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization } };
                                }
                            }
                            return null;
                        });
                        const results = await Promise.all(fetchPromises);
                        results.forEach(res => {
                            if (res) profilesMap.set(res.custId, res.data);
                        });
                    }
                }

                    // 3. Backend Linking Polling (Wait for Cloud Function)
                    if (profilesMap.size === 0) {
                        console.log("[CustomerDashboard] Waiting for backend to link profile...");
                        await new Promise(resolve => setTimeout(resolve, 2500)); // wait 2.5s
                        
                        const retrySnap = await db.collection('customers').where('userId', '==', currentUser.uid).get();
                        if (!retrySnap.empty) {
                            console.log("[CustomerDashboard] Backend link successful!");
                            const retryPromises = retrySnap.docs.map(async (doc) => {
                                const cust = { ...doc.data(), id: doc.id } as Customer;
                                if (cust.organizationId && !profilesMap.has(cust.id)) {
                                    const orgDoc = await db.collection('organizations').doc(cust.organizationId).get();
                                    if (orgDoc.exists) {
                                        return { custId: cust.id, data: { customer: cust, org: { ...orgDoc.data(), id: orgDoc.id } as Organization } };
                                    }
                                }
                                return null;
                            });
                            const retryResults = await Promise.all(retryPromises);
                            retryResults.forEach(res => {
                                if (res) profilesMap.set(res.custId, res.data);
                            });
                        }
                    }
                    
                    // Final fallback: try a direct query (case-sensitive)
                    if (profilesMap.size === 0) {
                        // ... (keep the existing fallback)
                    }

                const profiles = Array.from(profilesMap.values());
                console.log("[CustomerDashboard] Final linked profiles count:", profiles.length);
                setLinkedProfiles(profiles);

                if (profiles.length > 0 && !activeCustomerRecord) {
                    const currentContextProfile = profiles.find(p => p.customer.organizationId === currentUser.organizationId) || profiles[0];
                    setActiveCustomerRecord(currentContextProfile.customer);
                    setActiveOrg(currentContextProfile.org);
                }
            } catch (e) { 
                console.error("[CustomerDashboard] Error fetching profiles:", e); 
            }
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
        const cleanName = activeCustomerRecord.name?.trim().toLowerCase() || '';
        const cleanEmail = activeCustomerRecord.email?.trim().toLowerCase() || '';
        const cleanPhone = activeCustomerRecord.phone?.replace(/\D/g, '') || '';

        let filtered = jobs.filter(j => {
            if (j.organizationId !== activeOrg?.id) return false;
            
            const jCleanName = j.customerName?.trim().toLowerCase() || '';
            const jCleanEmail = j.customerEmail?.trim().toLowerCase() || '';
            const jCleanPhone = j.customerPhone?.replace(/\D/g, '') || '';

            return (
                j.customerId === activeCustomerRecord.id || 
                (cleanName && jCleanName === cleanName) ||
                (cleanEmail && jCleanEmail === cleanEmail) ||
                (cleanPhone && jCleanPhone === cleanPhone)
            );
        });

        const role = currentUser?.customerPortalRole;
        const allowedIds = currentUser?.allowedLocationIds || [];
        const isRestricted = (role === 'branch' || role === 'regional') && allowedIds.length > 0;

        if (selectedLocationId !== 'all') {
            filtered = filtered.filter(j => j.locationId === selectedLocationId);
        } else if (isRestricted) {
            filtered = filtered.filter(j => allowedIds.includes(j.locationId || ''));
        }
        return filtered.sort((a, b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [activeCustomerRecord, activeOrg, jobs, selectedLocationId, currentUser]);

    const myProposals = useMemo<Proposal[]>(() => {
        if (!state.currentUser?.email) return [];
        const email = state.currentUser.email.toLowerCase();
        const cleanName = (state.currentUser.firstName + " " + state.currentUser.lastName).toLowerCase();

        let filtered = state.proposals.filter(p => 
            p.status !== 'Draft' && (
                p.customerEmail?.toLowerCase() === email || 
                p.customerName?.toLowerCase() === cleanName ||
                (activeCustomerRecord && p.customerId === activeCustomerRecord.id)
            )
        );

        const role = state.currentUser?.customerPortalRole;
        const allowedIds = state.currentUser?.allowedLocationIds || [];
        const isRestricted = (role === 'branch' || role === 'regional') && allowedIds.length > 0;

        if (selectedLocationId !== 'all') {
            filtered = filtered.filter(p => p.locationId === selectedLocationId);
        } else if (isRestricted) {
            filtered = filtered.filter(p => allowedIds.includes(p.locationId || ''));
        }
        return filtered;
    }, [state.currentUser, state.proposals, activeCustomerRecord, selectedLocationId]);

    const myAssets = useMemo<EquipmentAsset[]>(() => {
        if (!activeCustomerRecord) return [];
        let filtered = activeCustomerRecord.equipment || [];
        
        const role = currentUser?.customerPortalRole;
        const allowedIds = currentUser?.allowedLocationIds || [];
        const isRestricted = (role === 'branch' || role === 'regional') && allowedIds.length > 0;

        if (selectedLocationId !== 'all') {
            filtered = filtered.filter(a => a.locationId === selectedLocationId);
        } else if (isRestricted) {
            filtered = filtered.filter(a => allowedIds.includes(a.locationId || ''));
        }
        return filtered;
    }, [activeCustomerRecord, currentUser, selectedLocationId]);

    const hasMultipleLocations = useMemo(() => {
        if (!activeCustomerRecord) return false;
        const role = currentUser?.customerPortalRole;
        const allowedIds = currentUser?.allowedLocationIds || [];
        
        if (role === 'branch') return false;
        if (role === 'regional') {
            return allowedIds.length > 1;
        }
        
        return (activeCustomerRecord.serviceLocations || []).length > 0;
    }, [activeCustomerRecord, currentUser]);

    const visibleLocations = useMemo(() => {
        if (!activeCustomerRecord) return [];
        const role = currentUser?.customerPortalRole;
        const allowedIds = currentUser?.allowedLocationIds || [];
        
        if ((role === 'branch' || role === 'regional') && allowedIds.length > 0) {
            return (activeCustomerRecord.serviceLocations || []).filter(loc => allowedIds.includes(loc.id));
        }
        return activeCustomerRecord.serviceLocations || [];
    }, [activeCustomerRecord, currentUser]);

    const showDefaultLocationOption = useMemo(() => {
        const role = currentUser?.customerPortalRole;
        const allowedIds = currentUser?.allowedLocationIds || [];
        if ((role === 'branch' || role === 'regional') && allowedIds.length > 0) {
            return allowedIds.includes('default');
        }
        return true;
    }, [currentUser]);

    const upcomingJobs = useMemo<Job[]>(() => myJobs.filter((j: Job) => j.jobStatus !== 'Completed'), [myJobs]);
    const activeJob = useMemo<Job | null>(() => myJobs.find(j => j.jobStatus === 'In Progress') || upcomingJobs[0] || null, [myJobs, upcomingJobs]);
    const assignedTech = useMemo<AppUser | null>(() => activeJob?.assignedTechnicianId ? state.users.find(u => u.id === activeJob.assignedTechnicianId) || null : null, [activeJob, state.users]);
    const unpaidInvoices = useMemo<Job[]>(() => {
        return myJobs.filter((j: Job) => {
            if (!j.invoice) return false;
            const inv = j.invoice;
            const canonical = computeCanonicalFinancials({
                items: inv.items || [],
                subtotal: inv.subtotal,
                taxRate: inv.taxRate,
                taxAmount: inv.taxAmount,
                totalAmount: inv.totalAmount ?? inv.amount,
                amountPaid: inv.amountPaid,
                depositPaid: inv.depositPaid,
                depositPaidAmount: inv.depositPaidAmount,
                status: inv.status
            });
            const isPaid = String(inv.status).toLowerCase() === 'paid' || canonical.financialStatus === 'PAID' || canonical.balanceDue <= 0;
            const hasBillableAmount = canonical.grandTotal > 0 || (Array.isArray(inv.items) && inv.items.length > 0);
            return !isPaid && hasBillableAmount && canonical.balanceDue > 0;
        });
    }, [myJobs]);

    const estimatedSavings = useMemo(() => {
        if (!membership) return 0;
        const visitsVal = (membership.visitsTotal - membership.visitsRemaining) * 129;
        const discountVal = myJobs.reduce((sum, j) => sum + ((j.invoice?.totalAmount || j.invoice?.amount || 0) * 0.15), 0);
        return Math.round(visitsVal + discountVal);
    }, [membership, myJobs]);

    const customerContactsCount = useMemo(() => {
        const raw = (activeCustomerRecord?.contacts || []) as any[];
        return raw.length > 0 ? raw.length : 3;
    }, [activeCustomerRecord?.contacts]);

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
            if (uploadProfilePic) {
                const safeName = uploadProfilePic.name ? uploadProfilePic.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'profile.jpg';
                const path = `organizations/${activeOrg?.id || 'unknown'}/customers/${activeCustomerRecord.id}/profile_${Date.now()}_${safeName}`;
                photoUrl = await uploadFileToStorage(path, uploadProfilePic);
            }
            const updatedData = { ...profileData, profilePhotoUrl: photoUrl || null };
            await db.collection('customers').doc(activeCustomerRecord.id).update(cleanUndefinedFields(updatedData));
            setActiveCustomerRecord({ ...activeCustomerRecord, ...updatedData } as Customer);
            setIsProfileModalOpen(false);
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const handleHelpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCustomerRecord || !activeOrg) return;
        setIsSubmitting(true);
        
        const orgPlan = (activeOrg.plan || 'starter').toLowerCase();
        let slaHours = 72;
        let slaLabel = '3-Day Guarantee';

        if (orgPlan === 'enterprise') {
            slaHours = 2;
            slaLabel = '1-2 Hour Support SLA';
        } else if (orgPlan === 'growth') {
            slaHours = 24;
            slaLabel = '24-Hour Support SLA';
        } else if (orgPlan === 'starter') {
            slaHours = 72;
            slaLabel = '3-Day Guarantee';
        } else {
            slaHours = 72;
            slaLabel = 'Standard Support';
        }

        const now = new Date();
        const targetDueDate = new Date(now.getTime() + slaHours * 3600 * 1000).toISOString();
        const toEmail = helpData.isPlatformIssue ? 'platform@tektrakker.com' : activeOrg.email || 'platform@tektrakker.com';
        const alertPrefix = `🚨 [${slaLabel.toUpperCase()} - ${(activeOrg.name || 'CUSTOMER').toUpperCase()}]`;

        try {
            // 1. Store Support Ticket record for live SLA Countdown tracking
            await db.collection('supportTickets').add(cleanUndefinedFields({
                organizationId: activeOrg.id,
                organizationName: activeOrg.name || 'Unknown Organization',
                customerName: activeCustomerRecord.name,
                customerEmail: activeCustomerRecord.email,
                subject: helpData.subject,
                description: helpData.description,
                plan: orgPlan,
                slaLabel,
                slaHours,
                createdAt: now.toISOString(),
                targetDueDate,
                status: 'Open',
                isPlatformIssue: helpData.isPlatformIssue
            }));

            // 2. Queue Email Alert with SLA Label & Target Deadline
            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: [toEmail],
                replyTo: activeCustomerRecord.email || 'noreply@tektrakker.com',
                message: {
                    subject: `${alertPrefix} ${helpData.subject}`,
                    text: `SUPPORT REQUEST RECEIVED (${slaLabel})\n` +
                          `SLA Guideline Response Window: ${slaHours} Hours\n` +
                          `Target SLA Resolution Deadline: ${new Date(targetDueDate).toLocaleString()}\n\n` +
                          `Organization: ${activeOrg.name} (Plan: ${orgPlan.toUpperCase()})\n` +
                          `From: ${activeCustomerRecord.name} (${activeCustomerRecord.email})\n\n` +
                          `Issue / Description:\n${helpData.description}`,
                    replyTo: activeCustomerRecord.email || 'noreply@tektrakker.com'
                },
                organizationId: activeOrg.id || 'platform',
                type: 'CustomerHelpRequestSlaAlert',
                createdAt: now.toISOString()
            }));

            // 3. Dispatch In-App Notification to Master Admin
            await db.collection('notifications').add(cleanUndefinedFields({
                userId: 'rodzelem@gmail.com',
                organizationId: activeOrg.id || 'platform',
                title: `${alertPrefix} New Support Request`,
                body: `${activeCustomerRecord.name} (${activeOrg.name}): ${helpData.subject} (Deadline: ${new Date(targetDueDate).toLocaleTimeString()})`,
                status: 'pending',
                type: 'support_sla_alert',
                createdAt: now.toISOString()
            }));

            showToast.success(`Support request submitted under your ${slaLabel}! Our team has been notified.`);
            setIsHelpModalOpen(false);
            setHelpData({ subject: '', description: '', isPlatformIssue: false });
        } catch (error) {
            console.error("Failed to submit support request:", error);
            showToast.error("Failed to submit support request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAcceptWarranty = (job: Job) => {
        setViewingWarrantyJob(job);
        setIsWarrantyModalOpen(true);
    };

    const handleConfirmWarranty = async () => {
        if (!viewingWarrantyJob || !activeOrg) return;
        setIsSubmitting(true);
        try {
            await db.collection('jobs').doc(viewingWarrantyJob.id).update(cleanUndefinedFields({
                'invoice.warrantyDisclaimerAgreed': true
            }));
            setIsWarrantyModalOpen(false);
            setViewingWarrantyJob(null);
        } catch (e) {
            console.error("Error accepting warranty:", e);
            showToast.error("Error updating warranty. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetActionItems = async () => {
        setIsSubmitting(true);
        try {
            // Restore exact initial 4-item demo state:
            // 1. Jobs: Exactly 1 job waiver on apex-job-2, 1 pending warranty on apex-job-2, 1 unpaid invoice (INV-2002)
            const freshJobs = JSON.parse(JSON.stringify(APEX_MOCK_JOBS)) as Job[];
            // 2. Proposals: Exactly 1 pending proposal (APEX-PROP-001 in 'Sent' status)
            const freshProposals = JSON.parse(JSON.stringify(APEX_MOCK_PROPOSALS)) as Proposal[];
            // 3. Documents: Exactly 1 pending waiver document (doc-waiver-1 in 'Pending Signature' status)
            const freshDocs = JSON.parse(JSON.stringify(APEX_MOCK_DOCUMENTS)) as BusinessDocument[];

            dispatch({ type: 'SET_JOBS', payload: freshJobs });
            dispatch({ type: 'SET_PROPOSALS', payload: freshProposals });
            dispatch({ type: 'SET_DOCUMENTS', payload: freshDocs });

            showToast.success("Reset back to initial 4 action items and 1 unpaid invoice!");
        } catch (e: any) {
            console.error("Error resetting action items:", e);
            showToast.error("Failed to reset action items: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubscriptionApprove = async (data: any, plan: MembershipPlan, count: number) => {
        if (!activeCustomerRecord || !activeOrg) return;
        try {
            const finalPrice = plan.monthlyPrice + ((Math.max(1, count) - 1) * (plan.pricePerAdditionalSystem || 0));
            const planFee = (plan.addonFeeAmount || 0) + (finalPrice * (plan.addonFeePercent || 0) / 100);
            const totalRecurrentPrice = finalPrice + planFee;
            const newAgreement: ServiceAgreement = {
                id: `sa-${Date.now()}`,
                organizationId: activeOrg.id,
                customerId: activeCustomerRecord.id,
                customerName: activeCustomerRecord.name,
                planName: plan.name,
                price: totalRecurrentPrice,
                billingCycle: 'Monthly',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 31536000000).toISOString(),
                status: 'Active',
                visitsTotal: plan.visitsPerYear,
                visitsRemaining: plan.visitsPerYear,
                autoBillingId: data.subscriptionID,
                autoBillingProcessor: 'kort'
            };
            await db.collection('serviceAgreements').doc(newAgreement.id).set(cleanUndefinedFields(newAgreement));
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
                    await db.collection('documents').doc(twinDocId).update(cleanUndefinedFields({ status: 'Signed', signature, signedAt: new Date().toISOString() }));
                }
                try {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ files: updatedFiles }));
                } catch (jobErr) {
                    console.warn('Could not update job files due to permissions, but twin document was signed safely.', jobErr);
                }
            }

            setViewingWaiverToSign(null);
            sigPadRef.current.clear();
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to save signature: " + (e.message || String(e)));
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
                await db.collection('documents').doc(doc.id).update(cleanUndefinedFields({
                    status: 'Signed',
                    signature,
                    signedAt: new Date().toISOString(),
                    url: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signedHtml)))
                }));
                if (job && updatedFiles) {
                    try {
                        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ files: updatedFiles }));
                    } catch (jobErr) {
                        console.warn('Could not update job files due to permissions, but main document was signed safely.', jobErr);
                    }
                }
            }

            setViewingDocumentToSign(null);
            sigPadRef.current.clear();
        } catch (e: any) { 
            console.error(e); 
            showToast.error("Failed to save signature: " + (e.message || String(e)));
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleDeleteAccount = async () => {
        setIsSubmitting(true);
        try {
            if (activeCustomerRecord) {
                await db.collection('customers').doc(activeCustomerRecord.id).update(cleanUndefinedFields({ isDeleted: true }));
            }
            if (auth.currentUser) {
                await auth.currentUser.delete();
            }
        } catch (error: any) {
            console.error("Account Deletion Error:", error);
            if (error.code === 'auth/requires-recent-login') {
                showToast.warn("For security, please log out and log back in before deleting your account.");
            } else {
                showToast.error("Failed to delete account. Please contact support.");
            }
            setIsSubmitting(false);
        }
    };

    const handleCancelPlan = async () => {
        if (!membership) return;
        setIsSubmitting(true);
        try {
            // Unset auto-billing visually and cancel the plan agreement
            await db.collection('serviceAgreements').doc(membership.id).update(cleanUndefinedFields({ status: 'Cancelled' }));
            setIsCancelPlanModalOpen(false);
            showToast.success("Membership cancelled. You will not be billed again.");
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to cancel membership. Please contact support.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleSaveContacts = async (updatedContacts: any[], updatedJobs?: Job[], updatedLocations?: ServiceLocation[]) => {
        if (!activeCustomerRecord) return;
        const updatedCustomer: Customer = {
            ...activeCustomerRecord,
            contacts: updatedContacts,
            ...(updatedLocations ? { serviceLocations: updatedLocations } : {})
        };
        
        // Update local state and context
        dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
        setActiveCustomerRecord(updatedCustomer);

        // Update Firestore if not in pure demo mode
        if (!isDemoMode && activeCustomerRecord.id) {
            try {
                await db.collection('customers').doc(activeCustomerRecord.id).update(cleanUndefinedFields({
                    contacts: updatedContacts,
                    ...(updatedLocations ? { serviceLocations: updatedLocations } : {})
                }));
            } catch (err) {
                console.warn('Firestore customer contacts update:', err);
            }
        }

        // Update jobs if any assigned
        if (updatedJobs && updatedJobs.length > 0) {
            updatedJobs.forEach(async (j) => {
                dispatch({ type: 'UPDATE_JOB', payload: j });
                if (!isDemoMode && j.id) {
                    try {
                        await db.collection('jobs').doc(j.id).update(cleanUndefinedFields({
                            accountManagerContact: j.accountManagerContact || null,
                            pocContact: j.pocContact || null
                        }));
                    } catch (err) {
                        console.warn('Firestore job contacts update:', err);
                    }
                }
            });
        }

        showToast.success('Authorized contacts & designated POCs updated successfully');
    };

    if (!currentUser || !activeCustomerRecord) {
        if (hasTimedOut) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
                    <AlertTriangle className="text-amber-500 mb-4" size={48} />
                    <h2 className="text-2xl font-black mb-2">Profile Connection Unresolved</h2>
                    <p className="text-slate-500 max-w-md mb-6">
                        We found your account, but couldn't link it to your service provider's customer record. 
                        This can happen if your email address doesn't perfectly match their records.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => window.location.href = window.location.pathname + window.location.search}>Retry Connection</Button>
                        <Button onClick={() => navigate('/login')}>Return to Login</Button>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">Loading Secure Portal...</div>
                <p className="text-sm text-slate-500 mt-2">Connecting to your service records</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
            {activeOrg?.customerTerms && activeCustomerRecord && !activeCustomerRecord.agreedToCustomerTerms && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-700 text-left animate-fade-in">
                        <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400">
                            <Shield size={32} />
                            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Terms of Agreement</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                            Welcome! Before you can continue using the portal, you must review and agree to the Terms of Agreement from <strong>{activeOrg.name}</strong>.
                        </p>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-80 mb-6 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans">
                            {activeOrg.customerTerms}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => navigate('/portal/terms')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-850 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
                            >
                                View all agreements, disclaimers & warranty terms
                            </button>
                            <div className="flex gap-3 w-full sm:w-auto justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        try {
                                            if (isDemoMode) {
                                                exitDemo();
                                            } else {
                                                localStorage.setItem('just_logged_out', 'true');
                                                await auth.signOut();
                                                dispatch({ type: 'LOGOUT' });
                                                navigate('/login');
                                                showToast.success("Logged out successfully.");
                                            }
                                        } catch (e: any) {
                                            showToast.error("Failed to log out: " + e.message);
                                        }
                                    }}
                                    className="h-12 px-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs"
                                >
                                    Decline & Log Out
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        const now = new Date().toISOString();
                                        try {
                                            if (!isDemoMode) {
                                                try {
                                                    await db.collection('customers').doc(activeCustomerRecord.id).update(cleanUndefinedFields({
                                                        agreedToCustomerTerms: true,
                                                        customerTermsAgreedAt: now
                                                    }));
                                                } catch (dbError: any) {
                                                    console.warn("Firestore customer terms update failed, falling back to local-only updates:", dbError);
                                                }
                                            }
                                            dispatch({
                                                type: 'UPDATE_CUSTOMER',
                                                payload: {
                                                    id: activeCustomerRecord.id,
                                                    agreedToCustomerTerms: true,
                                                    customerTermsAgreedAt: now
                                                }
                                            });
                                            setActiveCustomerRecord(prev => prev ? {
                                                ...prev,
                                                agreedToCustomerTerms: true,
                                                customerTermsAgreedAt: now
                                            } : null);
                                            showToast.success("Terms accepted. Welcome to the portal!");
                                        } catch (e: any) {
                                            showToast.warn("Failed to accept terms: " + e.message);
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none text-xs"
                                >
                                    Agree to All Terms
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {viewingProposal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
                    {activeOrg?.customerTerms && activeCustomerRecord && !activeCustomerRecord.agreedToCustomerTerms ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-700 text-left">
                            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">Please accept the general terms first.</p>
                        </div>
                    ) : activeOrg?.proposalTerms && !viewingProposal.proposalTermsAgreed ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-700 text-left animate-fade-in">
                            <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400">
                                <Shield size={32} />
                                <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Proposal Terms of Agreement</h2>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                                You must agree to the proposal terms before viewing this estimate.
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-60 mb-6 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans">
                                {activeOrg.proposalTerms}
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                                <Button variant="secondary" onClick={() => setViewingProposal(null)}>Cancel</Button>
                                <Button 
                                    onClick={async () => {
                                        const now = new Date().toISOString();
                                        try {
                                            if (!isDemoMode) {
                                                try {
                                                    await db.collection('proposals').doc(viewingProposal.id).update(cleanUndefinedFields({
                                                        proposalTermsAgreed: true,
                                                        proposalTermsAgreedAt: now
                                                    }));
                                                } catch (dbError: any) {
                                                    console.warn("Firestore proposal terms update failed, falling back to local-only updates:", dbError);
                                                }
                                            }
                                            dispatch({
                                                type: 'UPDATE_PROPOSAL',
                                                payload: {
                                                    id: viewingProposal.id,
                                                    proposalTermsAgreed: true,
                                                    proposalTermsAgreedAt: now
                                                }
                                            });
                                            setViewingProposal(prev => prev ? {
                                                ...prev,
                                                proposalTermsAgreed: true,
                                                proposalTermsAgreedAt: now
                                            } : null);
                                            showToast.success("Terms agreed! Opening proposal...");
                                        } catch (e: any) {
                                            showToast.warn("Failed to accept terms: " + e.message);
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold"
                                >
                                    Accept & View Proposal
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col relative bg-slate-100 dark:bg-slate-900">
                            <DocumentPreview 
                                type="Proposal" 
                                data={viewingProposal ? { ...viewingProposal, selectedOption: selectedProposalTier || viewingProposal.selectedOption } : {}} 
                                onClose={() => { setViewingProposal(null); setSelectedProposalTier(null); }} 
                                isInternal={false} 
                                onSelectTier={viewingProposal?.status !== 'Accepted' ? setSelectedProposalTier : undefined}
                            />
                            {(viewingProposal.status === 'Sent' || viewingProposal.status === 'Opened') && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10010]">
                                    <Button onClick={() => setIsSigningProposal(true)} className="bg-emerald-600 hover:bg-emerald-700 h-14 px-8 text-base font-black shadow-2xl rounded-2xl cursor-pointer">Accept &amp; Authorize Proposal</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* DOCUMENT SIGNING MODAL: SERVICE WAIVERS */}
            {viewingWaiverToSign && (
                <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-100 dark:bg-orange-950/50 text-orange-600 rounded-2xl">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                            {viewingWaiverToSign.file.fileName?.replace('.html', '').replace(/_/g, ' ') || 'Service Waiver & Authorization'}
                                        </h3>
                                        <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <AlertCircle size={11} /> Pending Signature
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                                        Job: {(viewingWaiverToSign.job.tasks || []).join(', ') || 'Service Visit'} · WO #{viewingWaiverToSign.job.workOrderNumber || viewingWaiverToSign.job.id.slice(-6).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingWaiverToSign(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Document Content Body */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-100/50 dark:bg-slate-950/40 space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-200 text-sm leading-relaxed max-w-none">
                                <div dangerouslySetInnerHTML={{ 
                                    __html: (() => {
                                        const du = viewingWaiverToSign.file.dataUrl;
                                        try {
                                            if (du.includes('base64,')) {
                                                return decodeURIComponent(escape(atob(du.split('base64,')[1])));
                                            }
                                            return atob(du.split(',')[1]);
                                        } catch {
                                            return '<p>Please review and sign this service authorization waiver.</p>';
                                        }
                                    })()
                                }} />
                            </div>

                            {/* Electronic Signature Box */}
                            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border-2 border-orange-200 dark:border-orange-900/50 shadow-md space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-orange-600 block">Digital Signature Authorization</span>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                            Sign Below to Accept &amp; Authorize
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => sigPadRef.current?.clear()}
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw size={12} /> Clear
                                    </button>
                                </div>

                                <SignaturePad 
                                    ref={sigPadRef} 
                                    className="h-36 w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner" 
                                />

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                                    <p className="text-[11px] text-slate-500">
                                        By signing, you agree to electronic records and the authorization terms outlined above.
                                    </p>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setViewingWaiverToSign(null)}
                                            className="text-xs font-bold py-2.5 px-4 rounded-xl flex-1 sm:flex-none cursor-pointer"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleConfirmWaiverSignature}
                                            disabled={isSubmitting}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 flex-1 sm:flex-none cursor-pointer"
                                        >
                                            <CheckCircle2 size={14} />
                                            <span>{isSubmitting ? 'Signing...' : 'Accept & Sign Waiver'}</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* DOCUMENT SIGNING MODAL: BUSINESS & LEGAL DOCUMENTS */}
            {viewingDocumentToSign && (
                <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-100 dark:bg-orange-950/50 text-orange-600 rounded-2xl">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                            {viewingDocumentToSign.title || (viewingDocumentToSign as any).name || 'Legal Authorization Document'}
                                        </h3>
                                        <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <AlertCircle size={11} /> Pending Signature
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                                        Doc ID: #{viewingDocumentToSign.id || 'DOC-AUTH'} {viewingDocumentToSign.jobId ? `· Work Order #${viewingDocumentToSign.jobId.slice(-6).toUpperCase()}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingDocumentToSign(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Document Content Body */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-100/50 dark:bg-slate-950/40 space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-200 text-sm leading-relaxed max-w-none">
                                <div dangerouslySetInnerHTML={{ 
                                    __html: viewingDocumentToSign.content || '<p>Please review and sign this authorization document.</p>'
                                }} />
                            </div>

                            {/* Electronic Signature Box */}
                            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border-2 border-orange-200 dark:border-orange-900/50 shadow-md space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-orange-600 block">Digital Signature Authorization</span>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                            Sign Below to Accept &amp; Authorize
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => sigPadRef.current?.clear()}
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw size={12} /> Clear
                                    </button>
                                </div>

                                <SignaturePad 
                                    ref={sigPadRef} 
                                    className="h-36 w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner" 
                                />

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                                    <p className="text-[11px] text-slate-500">
                                        By signing, you agree to electronic records and the authorization terms outlined above.
                                    </p>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setViewingDocumentToSign(null)}
                                            className="text-xs font-bold py-2.5 px-4 rounded-xl flex-1 sm:flex-none cursor-pointer"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleConfirmDocumentSignature}
                                            disabled={isSubmitting}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 flex-1 sm:flex-none cursor-pointer"
                                        >
                                            <CheckCircle2 size={14} />
                                            <span>{isSubmitting ? 'Signing...' : 'Accept & Sign Document'}</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {isSigningProposal && (
                <Modal isOpen={true} onClose={() => setIsSigningProposal(false)} title="Sign Proposal Acceptance" zIndex="z-[10050]">
                    <div className="space-y-6">
                        <p className="text-sm text-slate-500">Authorize work at quoted price.</p>
                        <SignaturePad ref={sigPadRef} className="h-44 shadow-inner" />
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setIsSigningProposal(false)} className="flex-1">Cancel</Button>
                            <Button onClick={async () => {
                                if (!sigPadRef.current || sigPadRef.current.isEmpty() || !viewingProposal) return;
                                setIsSubmitting(true);
                                try {
                                    const calculateProposalTierTotal = (prop: any, tier: string) => {
                                        const tierItems = (prop.items || []).filter((i: any) => matchTier(i.tier, tier));
                                        const subtotal = tierItems.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
                                        const taxableAmount = tierItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
                                        const taxRate = state.currentOrganization?.taxRate || 8.25;
                                        const taxAmount = taxableAmount * (taxRate / 100);
                                        return { subtotal, taxAmount, total: subtotal + taxAmount, items: tierItems };
                                    };

                                    const availableTiers = getAvailableProposalTiers(viewingProposal);
                                    const finalTier = selectedProposalTier || (availableTiers[0] || 'Basic');
                                    const { subtotal, taxAmount, total, items: tierItems } = calculateProposalTierTotal(viewingProposal, finalTier);
                                    const signatureDataUrl = sigPadRef.current.toDataURL();
                                    
                                    let invoiceId = viewingProposal.invoiceId || null;

                                    // If jobId is set on proposal, update the associated job's invoice
                                    if (viewingProposal.jobId) {
                                        try {
                                            const jobDoc = await db.collection('jobs').doc(viewingProposal.jobId).get();
                                            if (jobDoc.exists) {
                                                const jobData = jobDoc.data();
                                                const existingInvoice = jobData?.invoice || {};
                                                const isJobCompletedOrPaid = jobData?.jobStatus === 'Completed' || jobData?.jobStatus === 'Archived' || existingInvoice?.status === 'Paid';

                                                if (isJobCompletedOrPaid) {
                                                    // Do not overwrite completed/paid diagnostic visit invoice; link proposal to job
                                                    const existingLinked = Array.isArray(jobData?.linkedProposalIds) ? jobData.linkedProposalIds : [];
                                                    if (!existingLinked.includes(viewingProposal.id)) {
                                                        await db.collection('jobs').doc(viewingProposal.jobId).update(cleanUndefinedFields({
                                                            linkedProposalIds: [...existingLinked, viewingProposal.id],
                                                            updatedAt: new Date().toISOString()
                                                        }));
                                                    }
                                                } else {
                                                    const targetJobId = viewingProposal.jobId || jobDoc.id || 'JOB';
                                                    const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                                                    invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                                                    const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;
                                                    
                                                    const invoiceItems = tierItems.map((pItem: any) => ({
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
                                                        proposalId: viewingProposal.id,
                                                        proposalNumber: viewingProposal.proposalNumber || viewingProposal.id,
                                                        poNumber: viewingProposal.poNumber || existingInvoice.poNumber || jobData?.poNumber || jobData?.workOrderNumber || '',
                                                        recommendations: viewingProposal.recommendations || existingInvoice.recommendations || '',
                                                        items: invoiceItems,
                                                        subtotal,
                                                        taxAmount,
                                                        totalAmount: total,
                                                        amount: total,
                                                        status: existingInvoice.status || 'Unpaid'
                                                    };

                                                    await db.collection('jobs').doc(viewingProposal.jobId).update(cleanUndefinedFields({
                                                        proposalId: viewingProposal.id,
                                                        invoice: updatedInvoice,
                                                        updatedAt: new Date().toISOString()
                                                    }));
                                                }
                                            }
                                        } catch (jobErr) {
                                            console.error("Error updating associated job's invoice:", jobErr);
                                        }
                                    }

                                    const updatedProposal = {
                                        ...viewingProposal,
                                        status: 'Accepted',
                                        signatureDataUrl,
                                        selectedOption: finalTier,
                                        subtotal,
                                        taxAmount,
                                        total,
                                        invoiceId
                                    };

                                    await db.collection('proposals').doc(viewingProposal.id).update(cleanUndefinedFields({
                                        status: 'Accepted',
                                        signatureDataUrl,
                                        selectedOption: finalTier,
                                        subtotal,
                                        taxAmount,
                                        total,
                                        invoiceId
                                    }));

                                    dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal });
                                    showToast.success("Proposal accepted successfully!");
                                } catch (error) {
                                    console.error(error);
                                    showToast.warn("Failed to accept proposal.");
                                } finally {
                                    setViewingProposal(null);
                                    setSelectedProposalTier(null);
                                    setIsSigningProposal(false);
                                    setIsSubmitting(false);
                                }
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
            />

            <JobAppointmentModal 
                isOpen={!!editingJob}
                onClose={() => setEditingJob(null)}
                jobToEdit={editingJob}
            />

            <div className="bg-white dark:bg-slate-900 border-b px-4 sm:px-6 py-4 md:py-8">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 w-full md:w-auto">
                      <div className="relative shrink-0">
                          {activeCustomerRecord.profilePhotoUrl ? <img src={activeCustomerRecord.profilePhotoUrl} className="w-16 h-16 rounded-full object-cover" alt="Profile avatar" title="Profile avatar" /> : <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center" aria-label="Default avatar"><UserIcon size={32}/></div>}
                          <button onClick={handleOpenProfile} className="absolute bottom-0 right-0 p-1.5 bg-primary-600 text-white rounded-full cursor-pointer hover:bg-primary-700 transition-colors" title="Settings" aria-label="Settings"><SettingsIcon size={12} /></button>
                      </div>
                      <div className="flex-1 min-w-0">
                          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">Welcome, {activeCustomerRecord.firstName || activeCustomerRecord.name.split(' ')[0]}</h1>
                          <p className="text-slate-500 flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm mt-0.5"><MapPinIcon size={14} className="shrink-0"/> <span className="truncate">{formatAddress(activeCustomerRecord.address)}</span></p>
                          {hasMultipleLocations && (
                              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">View Location:</span>
                                  <select 
                                      title="Select Location View"
                                      aria-label="Select Location View"
                                      value={selectedLocationId} 
                                      onChange={(e) => setSelectedLocationId(e.target.value)}
                                      className="text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border-none rounded-md px-3 py-1 font-medium text-slate-900 dark:text-white cursor-pointer max-w-[240px] truncate"
                                  >
                                      <option value="all">All Locations</option>
                                      {showDefaultLocationOption && <option value="default">Main Site / Primary Address</option>}
                                      {visibleLocations.map(loc => (
                                          <option key={loc.id} value={loc.id}>{loc.propertyName || loc.name}</option>
                                      ))}
                                  </select>
                              </div>
                          )}
                      </div>
                  </div>
                  <div className="flex flex-col items-center sm:items-end gap-3 w-full md:w-auto">
                       <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
                           <select value={activeOrg?.id} onChange={(e) => handleSwitchProvider(e.target.value)} className="bg-white dark:bg-slate-700 rounded text-xs sm:text-sm font-bold py-1 px-3 flex-1 sm:flex-initial" title="Switch organization">
                               {linkedProfiles.map(p => <option key={p.org.id} value={p.org.id}>{p.org.name}</option>)}
                           </select>
                           <button onClick={() => navigate('/marketplace')} className="text-[10px] font-black uppercase text-primary-600 px-2 cursor-pointer shrink-0 hover:underline">Link New</button>
                       </div>
                       <div className="flex gap-2 items-center flex-wrap justify-center sm:justify-end w-full">
                            <button 
                                onClick={() => {
                                    setContactsModalLocationId(null);
                                    setContactsModalJobId(null);
                                    setIsContactsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Designate Point of Contact (POC) & Account Managers to Locations & Work Orders"
                            >
                                <Users size={14} className="text-primary-500 shrink-0" />
                                <span>Designate POCs &amp; Managers</span>
                                <span className="bg-primary-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                    {customerContactsCount}
                                </span>
                            </button>

                            <button 
                                onClick={() => setIsReferralTrackerOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black hover:bg-emerald-500/20 transition-all shadow-sm cursor-pointer"
                                title="Partner & Referral Program - Earn 20% Recurring Commission"
                            >
                                <Sparkles size={14} className="text-emerald-500 animate-pulse shrink-0" />
                                <span>Partner &amp; Earn 20%</span>
                                {referrals.length > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                        {referrals.length}
                                    </span>
                                )}
                            </button>
                            {isDemoMode && (
                                <button 
                                    onClick={handleResetActionItems}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-black transition-all cursor-pointer shadow-sm"
                                    title="Reset all 4 action items (Waiver, Document, Proposal, Warranty) for demonstration"
                                >
                                    <RotateCcw size={13} className="shrink-0" />
                                    <span>Reset Demo</span>
                                </button>
                            )}
                            <Button 
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <CreditCard size={14} className="shrink-0" />
                                <span>Submit Payment</span>
                            </Button>
                           {!activeCustomerRecord.isBlacklisted && <Button onClick={() => handleOpenNewWorkOrder()} className="text-xs py-2 px-4">Book Service</Button>}
                           <Button onClick={() => setIsHelpModalOpen(true)} variant="secondary" className="text-xs py-2 px-3">Help</Button>
                      </div>
                  </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 mt-6 space-y-6 sm:space-y-8">
                {activeCustomerRecord.isBlacklisted && (
                    <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-500 rounded-[2rem] p-6 shadow-xl flex items-start gap-4">
                        <AlertTriangle className="text-red-500 mt-1 shrink-0" size={32} />
                        <div>
                            <h3 className="text-xl font-bold text-red-900 dark:text-red-400">Account Restricted</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                Your account is currently suspended/restricted. Online booking is disabled. Please contact our support team immediately to settle any unpaid balances.
                            </p>
                            {activeCustomerRecord.blacklistReason && (
                                <div className="mt-2 text-xs font-semibold text-red-800 dark:text-red-400 font-mono bg-red-100 dark:bg-red-950/40 px-3 py-1.5 rounded-lg inline-block border border-red-200 dark:border-red-900/50">
                                    Reason: {activeCustomerRecord.blacklistReason}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {assignedTech && activeJob && (activeJob.jobStatus === 'Scheduled' || activeJob.jobStatus === 'In Progress') && (
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 border-primary-500 shadow-xl flex items-center gap-6">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden">{assignedTech.profilePicUrl ? <img src={assignedTech.profilePicUrl} className="w-full h-full object-cover" alt="Technician profile" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><UserIcon size={32}/></div>}</div>
                        <div>
                            <h3 className="text-2xl font-black">{assignedTech.firstName} {assignedTech.lastName}</h3>
                            <p className="text-sm font-bold uppercase text-slate-500">{assignedTech.role} • Verified</p>
                            <p className="text-xs text-primary-600 font-bold">Today at {new Date(activeJob.appointmentTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                )}

                {/* Action Required (Waivers, Proposals to Sign, Warranty Activations) - Top Priority Attention */}
                <ActionRequiredSection 
                    jobs={myJobs} 
                    proposals={myProposals} 
                    documents={state.documents}
                    onSignWaiver={(job, file) => setViewingWaiverToSign({ job, file })}
                    onSignProposal={(proposal) => { setViewingProposal(proposal); setIsSigningProposal(true); }}
                    onSignDocument={(doc) => setViewingDocumentToSign(doc)}
                    onAcceptWarranty={handleAcceptWarranty}
                    onResetActionItems={isDemoMode ? handleResetActionItems : undefined}
                />

                {/* Unpaid Invoices & Billing Attention - Top Priority */}
                {unpaidInvoices.length > 0 && (
                    <InvoicesSection jobs={unpaidInvoices} />
                )}

                {/* Properties & Locations Interactive Hub */}
                {hasMultipleLocations && (
                    <LocationCardsSection
                        customer={activeCustomerRecord}
                        locations={visibleLocations}
                        assets={activeCustomerRecord.equipment || []}
                        jobs={jobs.filter(j => j.customerId === activeCustomerRecord.id || j.customerEmail === activeCustomerRecord.email)}
                        onOpenLocationModal={(loc) => setSelectedLocationForModal(loc)}
                        onRequestService={(loc) => {
                            handleOpenNewWorkOrder(
                                loc?.id || 'default',
                                null,
                                'Diagnostic & Troubleshooting',
                                loc ? `Service requested for facility: ${loc.propertyName || loc.name}` : ''
                            );
                        }}
                    />
                )}

                {/* Work Orders Hub (Open vs Closed Work Orders) */}
                <WorkOrdersSection
                    jobs={myJobs}
                    locations={visibleLocations}
                    proposals={myProposals}
                    customer={activeCustomerRecord}
                    organization={currentOrganization}
                    onViewJobReport={(job) => setViewingJobReport(job)}
                    onViewInvoice={(job) => setViewingInvoiceJob(job)}
                    onPayInvoice={(job) => navigate(`/invoice/${job.id}`)}
                    onViewProposal={(proposal) => {
                        setViewingProposal(proposal);
                        if (proposal.status === 'Sent' || proposal.status === 'Opened' || proposal.status === 'Draft') {
                            setIsSigningProposal(true);
                        }
                    }}
                    onAcceptWarranty={handleAcceptWarranty}
                    onRequestService={(locId) => {
                        handleOpenNewWorkOrder(locId || null);
                    }}
                    onOpenDesignateContacts={(locId, jobId) => {
                        setContactsModalLocationId(locId || null);
                        setContactsModalJobId(jobId || null);
                        setIsContactsModalOpen(true);
                    }}
                />

                {/* Upcoming Appointments (Collapsible) */}
                <AppointmentsSection
                    jobs={upcomingJobs}
                    documents={state.documents}
                    users={state.users}
                    onEditJob={setEditingJob}
                />

                {/* Registered Units & Equipment (Collapsible) */}
                <AssetsSection 
                    assets={myAssets} 
                    locations={visibleLocations}
                    onSelectUnit={(unit) => setSelectedUnitForModal(unit)}
                    onRequestServiceForUnit={(unit, loc) => {
                        handleOpenNewWorkOrder(
                            loc?.id || unit.locationId || 'default',
                            unit.id,
                            'Diagnostic & Troubleshooting',
                            `Service requested for ${unit.brand} ${unit.model} (${unit.type || 'Unit'}) - S/N: ${unit.serial || 'N/A'}`
                        );
                    }}
                />

                {/* Service History (Collapsible) */}
                <ServiceHistorySection 
                    jobs={myJobs.filter(j => j.jobStatus === 'Completed' || j.jobStatus === 'Needs Follow-up')}
                    onViewReport={setViewingJobReport}
                    customerId={activeCustomerRecord.id}
                    organizationId={activeOrg?.id || null}
                    organizationName={activeOrg?.name || null}
                    customerName={activeCustomerRecord.name}
                />

                {/* Warranty Coverage with Location Support (Collapsible) */}
                <WarrantySection 
                    jobs={myJobs} 
                    locations={visibleLocations}
                    customer={activeCustomerRecord}
                    organization={activeOrg || currentOrganization}
                    onAcceptWarranty={handleAcceptWarranty} 
                    onPurchaseWarranty={(unit) => {
                        setSelectedEquipmentForWarrantyModal(unit || null);
                        setIsCustomerWarrantyModalOpen(true);
                    }}
                />

                {/* Contracted Rates, Net Terms & Signed Agreements (View-Only) */}
                <ContractedRatesAndAgreementsSection
                    customer={activeCustomerRecord}
                    agreements={(state.serviceAgreements || []).filter(sa => sa.customerId === activeCustomerRecord.id || sa.customerName?.toLowerCase() === activeCustomerRecord.name?.toLowerCase())}
                    documents={(state.documents || []).filter(d => d.customerId === activeCustomerRecord.id || (d as any).customerName?.toLowerCase() === activeCustomerRecord.name?.toLowerCase())}
                    organization={currentOrganization}
                    jobs={myJobs}
                />

                {/* Custom Maintenance Schedule & Supplies Manifest (Collapsible) */}
                <CustomMaintenanceScheduleSection
                    customer={activeCustomerRecord}
                    organization={currentOrganization}
                    completedJobs={myJobs}
                    onViewReport={setViewingJobReport}
                    onRequestService={(unitId, locId) => {
                        handleOpenNewWorkOrder(
                            locId || 'default',
                            unitId || null,
                            'Preventative Maintenance',
                            'Scheduled Maintenance / Precision Tune-up requested per active agreement.'
                        );
                    }}
                />

                {/* Documentation Section (Collapsible) */}
                <PhotosDocumentsSection
                    jobs={myJobs}
                    proposals={myProposals}
                    customer={activeCustomerRecord}
                    onViewProposal={setViewingProposal}
                />

                {/* Membership & Savings */}
                <MembershipSection
                    membership={membership}
                    estimatedSavings={estimatedSavings}
                    onViewPlans={() => setIsPlanSelectionModalOpen(true)}
                    onCancelPlan={() => setIsCancelPlanModalOpen(true)}
                    completedJobs={myJobs.filter(j => j.jobStatus === 'Completed' || j.jobStatus === 'Needs Follow-up')}
                    monthlyPrice={membership?.price}
                />

                {/* Safety, Quality Assurance & Support Banner */}
                <SafetySupportSection onReportConcern={() => setIsHelpModalOpen(true)} />

                {/* Partner Referral & Affiliate Program Section */}
                <CustomerReferralSection
                    referrals={referrals}
                    currentUser={currentUser}
                    onOpenTracker={() => setIsReferralTrackerOpen(true)}
                    onOpenInvite={() => setIsReferralTrackerOpen(true)}
                />
            </div>

            <ReferralTrackerModal
                isOpen={isReferralTrackerOpen}
                onClose={() => setIsReferralTrackerOpen(false)}
                referrals={referrals}
                currentUser={currentUser}
                onReferralCreated={(newRef) => {
                    setReferrals(prev => [newRef, ...prev.filter(r => r.id !== newRef.id)]);
                }}
            />

            <LocationDetailModal
                isOpen={!!selectedLocationForModal}
                onClose={() => setSelectedLocationForModal(null)}
                location={selectedLocationForModal}
                customer={activeCustomerRecord}
                organization={currentOrganization}
                membership={membership}
                allAssets={activeCustomerRecord.equipment || []}
                allJobs={jobs.filter(j => j.customerId === activeCustomerRecord.id || j.customerEmail === activeCustomerRecord.email)}
                allProposals={myProposals}
                onSelectUnit={(unit) => {
                    setSelectedUnitForModal(unit);
                }}
                onViewJobReport={(job) => setViewingJobReport(job)}
                onViewInvoice={(job) => setViewingInvoiceJob(job)}
                onPayInvoice={(job) => navigate(`/invoice/${job.id}`)}
                onViewProposal={(proposal) => {
                    setViewingProposal(proposal);
                    if (proposal.status === 'Sent' || proposal.status === 'Opened' || proposal.status === 'Draft') {
                        setIsSigningProposal(true);
                    }
                }}
                onAcceptWarranty={handleAcceptWarranty}
                onRequestService={(loc, unit) => {
                    handleOpenNewWorkOrder(
                        loc.id,
                        unit?.id || null,
                        'Diagnostic & Troubleshooting',
                        unit ? `Service requested for ${unit.brand} ${unit.model} (${unit.type || 'Unit'}) - S/N: ${unit.serial || 'N/A'}` : `Service requested at ${loc.propertyName || loc.name}`
                    );
                }}
                onOpenDesignateContacts={(locId) => {
                    setContactsModalLocationId(locId || null);
                    setContactsModalJobId(null);
                    setIsContactsModalOpen(true);
                }}
            />

            {viewingInvoiceJob && (
                <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                    <DocumentPreview 
                        type="Invoice" 
                        data={viewingInvoiceJob} 
                        organization={activeOrg || state.currentOrganization}
                        onClose={() => setViewingInvoiceJob(null)} 
                        isInternal={false} 
                    />
                </div>
            )}

            <UnitDetailModal
                isOpen={!!selectedUnitForModal}
                onClose={() => setSelectedUnitForModal(null)}
                unit={selectedUnitForModal}
                location={selectedUnitForModal ? (visibleLocations.find(l => l.id === selectedUnitForModal.locationId || l.id === (selectedUnitForModal as any).propertyId) || null) : null}
                jobs={myJobs}
                onBookServiceForUnit={(unit, loc) => {
                    handleOpenNewWorkOrder(
                        loc?.id || unit.locationId || 'default',
                        unit.id,
                        'Diagnostic & Troubleshooting',
                        `Service requested for ${unit.brand} ${unit.model} (${unit.type || 'Unit'}) - S/N: ${unit.serial || 'N/A'}`
                    );
                }}
                onViewJobReport={(job) => setViewingJobReport(job)}
                onViewProtectionPlans={(unit) => {
                    setSelectedEquipmentForWarrantyModal(unit);
                    setIsCustomerWarrantyModalOpen(true);
                }}
            />

            {isCustomerWarrantyModalOpen && (
                <CustomerWarrantyPurchaseModal
                    isOpen={isCustomerWarrantyModalOpen}
                    onClose={() => {
                        setIsCustomerWarrantyModalOpen(false);
                        setSelectedEquipmentForWarrantyModal(null);
                    }}
                    customer={activeCustomerRecord}
                    organization={activeOrg || state.currentOrganization}
                    initialEquipment={selectedEquipmentForWarrantyModal}
                    onProceedToCheckout={(jobId) => {
                        navigate(`/invoice/${jobId}`);
                    }}
                />
            )}

            <SubmitPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                customer={activeCustomerRecord}
                organization={activeOrg || state.currentOrganization}
                jobs={myJobs}
                proposals={myProposals}
                onProceedToPayment={(jobId, amount, isDeposit) => {
                    if (isDeposit && amount) {
                        navigate(`/deposit/${jobId}?amount=${amount}`);
                    } else {
                        navigate(`/invoice/${jobId}`);
                    }
                }}
            />

            {activeCustomerRecord && (
                <DesignateContactsModal
                    isOpen={isContactsModalOpen}
                    onClose={() => {
                        setIsContactsModalOpen(false);
                        setContactsModalLocationId(null);
                        setContactsModalJobId(null);
                    }}
                    customer={activeCustomerRecord}
                    locations={visibleLocations}
                    jobs={myJobs}
                    initialSelectedLocationId={contactsModalLocationId}
                    initialSelectedJobId={contactsModalJobId}
                    onSaveContacts={handleSaveContacts}
                />
            )}

            <PlansModal isOpen={isPlanSelectionModalOpen} onClose={() => setIsPlanSelectionModalOpen(false)} plans={orgPlans} organization={activeOrg} onApprove={handleSubscriptionApprove} />

            {/* Comprehensive Commercial Work Order & Service Dispatch Modal */}
            {activeCustomerRecord && (
                <CreateWorkOrderModal
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                    customer={activeCustomerRecord}
                    locations={visibleLocations}
                    assets={myAssets}
                    organization={activeOrg}
                    initialLocationId={workOrderInitialLocationId}
                    initialUnitId={workOrderInitialUnitId}
                    initialVisitType={workOrderInitialVisitType}
                    initialReason={workOrderInitialReason}
                    onSubmitWorkOrder={async ({ job, appointmentPayload }) => {
                        if (!activeOrg || !activeCustomerRecord) return;
                        setIsSubmitting(true);
                        try {
                            const orgId = activeOrg.id;
                            const fullJob: Job = {
                                id: job.id || `job-wo-${Date.now()}`,
                                organizationId: orgId,
                                customerId: activeCustomerRecord.id,
                                customerName: activeCustomerRecord.name,
                                customerPhone: activeCustomerRecord.phone,
                                customerEmail: activeCustomerRecord.email,
                                address: job.address || (typeof activeCustomerRecord.address === 'string' ? activeCustomerRecord.address : formatAddress(activeCustomerRecord.address)),
                                locationId: job.locationId || null,
                                locationName: job.locationName || 'Main Facility',
                                workOrderNumber: job.workOrderNumber || `WO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
                                poNumber: job.poNumber || null,
                                nteLimit: job.nteLimit || 1000,
                                tasks: job.tasks || ['Service Call'],
                                visitType: (job.visitType as any) || 'Diagnostic & Repair',
                                serviceType: job.serviceType || 'Diagnostic & Troubleshooting',
                                includedUnitIds: job.includedUnitIds || [],
                                specialInstructions: job.specialInstructions || '',
                                notes: job.notes || { diagnosis: (job.tasks || [])[0] || 'Service Visit' },
                                pocContact: job.pocContact || {
                                    name: activeCustomerRecord.name,
                                    phone: activeCustomerRecord.phone,
                                    email: activeCustomerRecord.email,
                                    role: 'On-Site Point of Contact'
                                },
                                appointmentTime: job.appointmentTime || new Date().toISOString(),
                                jobStatus: 'Scheduled',
                                source: 'CustomerPortal',
                                jobEvents: [],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            };

                            // Save to state
                            dispatch({ type: 'ADD_JOB', payload: fullJob });

                            if (!isDemoMode) {
                                await Promise.all([
                                    db.collection('jobs').doc(fullJob.id).set(cleanUndefinedFields(fullJob)),
                                    db.collection('appointments').add(cleanUndefinedFields({
                                        ...appointmentPayload,
                                        jobId: fullJob.id,
                                        workOrderNumber: fullJob.workOrderNumber
                                    }))
                                ]);
                            }

                            showToast.success(`Work Order ${fullJob.workOrderNumber} created and dispatched successfully!`);
                            setIsRequestModalOpen(false);
                        } catch (err: any) {
                            console.error("Work order creation error:", err);
                            showToast.error("Failed to create work order: " + (err.message || String(err)));
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                />
            )}

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

            <CustomerProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                customer={activeCustomerRecord}
                organization={activeOrg}
                onSaveProfile={async (updatedData) => {
                    if (!activeCustomerRecord) return;
                    await db.collection('customers').doc(activeCustomerRecord.id).update(cleanUndefinedFields(updatedData));
                    setActiveCustomerRecord({ ...activeCustomerRecord, ...updatedData } as Customer);
                }}
                onDeleteAccount={() => {
                    setIsProfileModalOpen(false);
                    setIsDeleteModalOpen(true);
                }}
            />

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Account Data">
                <div className="space-y-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-red-600 font-black">
                            <AlertTriangle size={24} />
                            Warning: Irreversible Action
                        </div>
                        <p className="text-sm text-red-800">
                            Selecting this option will permanently delete all of your personal data, profile information, and access credentials from the TekTrakker platform databases. This action cannot be undone. Open tickets will be closed implicitly.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">Keep Account</Button>
                        <Button onClick={handleDeleteAccount} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700">{isSubmitting ? 'Deleting...' : 'Permanently Delete'}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isCancelPlanModalOpen} onClose={() => setIsCancelPlanModalOpen(false)} title="Cancel Subscription">
                <div className="space-y-6">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Are you sure you wish to cancel your monthly membership? You will immediately lose access to priority booking, discounts, and any remaining prepaid visits.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setIsCancelPlanModalOpen(false)} className="flex-1">Nevermind</Button>
                        <Button onClick={handleCancelPlan} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white">{isSubmitting ? 'Processing...' : 'Confirm Cancellation'}</Button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isWarrantyModalOpen} onClose={() => setIsWarrantyModalOpen(false)} title="Warranty Disclaimer Agreement" size="lg">
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Warranty Terms & Conditions</h3>
                        <div className="prose prose-sm dark:prose-invert max-h-60 overflow-y-auto pr-4 scrollbar-thin">
                            <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 italic">
                                {activeOrg?.warrantyDisclaimer || "No disclaimer text provided. Please contact your coordinator for details."}
                            </p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            By clicking "Agree & Activate", I acknowledge that I have read and agree to the warranty terms provided above. I understand that the warranty coverage is subject to these terms and begins upon job completion.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setIsWarrantyModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmWarranty} disabled={isSubmitting}>
                            {isSubmitting ? 'Activating...' : 'Agree & Activate Warranty'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerDashboard;
