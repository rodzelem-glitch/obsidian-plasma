import { getBaseUrl, getPaymentTermsLabel, cleanUndefinedFields, getOrGenerateAccountNumber, formatFullAddress, sanitizeCustomer, sanitizeAddressFields, isInternalExpenseFile, resolveSiteLocationName } from "lib/utils";

import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { NumberInput } from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db, firebase, functions } from 'lib/firebase';
import type { Customer, EquipmentAsset, ServiceAgreement, MembershipPlan, Job, StoredFile, CustomerMarkupRule } from 'types';
import { 
    TrashIcon, PlusCircle, Wrench, FileText, DollarSign, Image, User, Users, Mail, Printer, Sparkles, ShieldCheck, ShieldAlert, MessageSquare, CheckCircle, Edit, Share2, Copy, Upload, PhoneCall, PhoneOff, Calendar, XCircle, Clock, AlertCircle, PhoneOutgoing, Voicemail, UserCheck, Key,
    MapPin, Briefcase, RotateCcw, Link2, Archive, CheckSquare, Square, Search, Filter, Trash2, CalendarPlus, AlignLeft, Eye, EyeOff, Inbox, LayoutGrid, ArrowLeft
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { globalConfirm } from "lib/globalConfirm";
import { uploadFileToStorage } from 'lib/storageService';
import { sendEmail } from 'lib/notificationService';
import showToast from 'lib/toast';
import WarrantySection from 'pages/customer/components/WarrantySection';
import IssueWarrantyModal from './IssueWarrantyModal';
import EquipmentHierarchy from 'pages/admin/projects/components/tabs/equipment/EquipmentHierarchy';
import { useLanguage } from 'context/LanguageContext';
import LocationPhotosLayoutModal from './LocationPhotosLayoutModal';
import JobDetailModal from './JobDetailModal';
import InvoiceEditorModal from './InvoiceEditorModal';
import { Paperclip, ExternalLink, FileCheck, Download, Send, Receipt, CreditCard, Percent } from 'lucide-react';
import { Map as MapIcon } from 'lucide-react';
import SendEmailModal from './SendEmailModal';
import EmailStatementModal from './EmailStatementModal';
import SendSMSModal from './SendSMSModal';
import LogCallModal from './LogCallModal';
import CreatePaymentLinkModal from './CreatePaymentLinkModal';
import LogReceivedPaymentModal from './LogReceivedPaymentModal';
import MallFilterRequisitionModal from './MallFilterRequisitionModal';
import JobAppointmentModal from './JobAppointmentModal';
import JobLinkingModal from './JobLinkingModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';
import { resolveDocumentDisplayId } from 'lib/numbering';
import { getOrgPaymentInstructions, formatPaymentInstructionsHtml } from 'lib/paymentInstructionsHelper';
import { PaymentInstructionsCard } from 'components/payment/PaymentInstructionsCard';
import { detectFileType } from 'lib/fileViewerHelper';
import { getJobTimeSummary } from 'lib/jobTimeHelper';
import CustomerDocumentDrive from '../features/CustomerDocumentDrive';
import { HardDrive } from 'lucide-react';
import { generateStatementOfAccountPdfAttachment } from 'lib/pdfHelper';
import { isRecurringMembership, formatAgreementDate } from 'lib/membershipHelper';

interface CustomerMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
}

const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({ isOpen, onClose, customerId }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [fetchedCustomer, setFetchedCustomer] = useState<Customer | null>(null);
    const customer = state.customers.find(c => c.id === customerId) || fetchedCustomer;

    useEffect(() => {
        if (!isOpen || !customerId) return;
        if (!state.customers.find(c => c.id === customerId)) {
            db.collection('customers').doc(customerId).get().then(doc => {
                if (doc.exists) {
                    const data = { id: doc.id, ...doc.data() } as Customer;
                    setFetchedCustomer(data);
                    dispatch({ type: 'ADD_CUSTOMER', payload: data });
                }
            }).catch(err => console.error("Error fetching customer in CustomerMasterModal:", err));
        }
    }, [isOpen, customerId, state.customers, dispatch]);

    const [calling, setCalling] = useState(false);

    const handleCallBridge = async () => {
        if (!customer?.phone) {
            showToast.error("Customer has no phone number registered.");
            return;
        }

        let techPhone = state.currentUser?.phone || '';
        
        if (!techPhone) {
            const inputPhone = window.prompt("We need your phone number to call you first. Please enter your phone number:", "+1");
            if (!inputPhone) return;
            techPhone = inputPhone;
        }

        try {
            setCalling(true);
            showToast.info("Calling your phone first to connect you...");
            const initiateCallBridge = functions.httpsCallable('initiateCallBridge');
            const res = await initiateCallBridge({
                technicianPhone: techPhone,
                customerPhone: customer.phone,
                organizationId: customer.organizationId || state.currentOrganization?.id
            });
            if (res.data?.success) {
                showToast.success("Connection initiated. Answer your phone to connect.");
            } else {
                showToast.error("Failed to connect call.");
            }
        } catch (error: any) {
            console.error("Call Bridge Error:", error);
            showToast.error(`Call failed: ${error.message}`);
        } finally {
            setCalling(false);
        }
    };
    



    const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'history' | 'financials' | 'warranties' | 'docs' | 'communications' | 'maintenance'>('overview');
    const [statementUnpaidOnly, setStatementUnpaidOnly] = useState(false);
    const [showPaymentsLedger, setShowPaymentsLedger] = useState(false);
    const [historyLocationFilter, setHistoryLocationFilter] = useState('');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
    const [editingInvoiceJobId, setEditingInvoiceJobId] = useState<string | null>(null);
    const [editingAppointmentJob, setEditingAppointmentJob] = useState<Job | null>(null);
    const [linkingJob, setLinkingJob] = useState<Job | null>(null);
    const [activeSignOffJob, setActiveSignOffJob] = useState<Job | null>(null);
    const [historyNotesJob, setHistoryNotesJob] = useState<Job | null>(null);
    const [historyInternalNotes, setHistoryInternalNotes] = useState('');
    const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
    const [isSendSmsModalOpen, setIsSendSmsModalOpen] = useState(false);
    const [isLogCallModalOpen, setIsLogCallModalOpen] = useState(false);
    const [isCreatePaymentLinkOpen, setIsCreatePaymentLinkOpen] = useState(false);
    const [isLogPaymentModalOpen, setIsLogPaymentModalOpen] = useState(false);
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
    const [isEmailStatementModalOpen, setIsEmailStatementModalOpen] = useState(false);
    const [isMallFilterModalOpen, setIsMallFilterModalOpen] = useState(false);

    const [showSmsReConsentModal, setShowSmsReConsentModal] = useState(false);
    const [reConsentCertify, setReConsentCertify] = useState(false);
    const [reConsentReason, setReConsentReason] = useState('Customer Verbal Request');
    const [reConsentNotes, setReConsentNotes] = useState('');

    const handleSyncRcCallerId = async () => {
        setIsSyncingRc(true);
        try {
            const orgId = state.currentOrganization?.id;
            if (!orgId) {
                showToast.warn("Organization profile missing.");
                return;
            }
            const syncFn = functions.httpsCallable('syncCustomerToRingCentral');
            const res: any = await syncFn({
                orgId,
                customerId: customerId || customer?.id
            });

            if (res.data?.success) {
                showToast.success(`Synced ${customer?.name || 'Customer'} to RingCentral Address Book! Incoming calls will display caller name.`);
            } else {
                showToast.warn(res.data?.reason || "Could not sync caller ID to RingCentral.");
            }
        } catch (err: any) {
            console.error("Sync RC Caller ID Error:", err);
            showToast.error("Failed to sync caller ID to RingCentral.");
        } finally {
            setIsSyncingRc(false);
        }
    };
    const [customCommLogs, setCustomCommLogs] = useState<any[]>([]);

    React.useEffect(() => {
        if (!customerId) return;
        const unsub = db.collection('customers').doc(customerId).collection('communications')
            .onSnapshot((snapshot) => {
                const logs: any[] = [];
                snapshot.forEach(doc => {
                    logs.push({ id: doc.id, ...doc.data() });
                });
                setCustomCommLogs(logs);
            }, (err) => {
                console.warn("Notice: Subcollection communications unavailable, falling back to primary messages timeline.", err?.message || err);
            });
        return () => unsub();
    }, [customerId]);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [showPortalPassword, setShowPortalPassword] = useState(false);
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    const [dragActiveDocs, setDragActiveDocs] = useState(false);
    const [dragActiveWarranties, setDragActiveWarranties] = useState(false);
    
    // Property Location State
    const [newLocation, setNewLocation] = useState<any>({ name: '', address: '', city: '', state: '', zip: '', notes: '', storeNumber: '', locationNumber: '' });
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const [locationSearchTerm, setLocationSearchTerm] = useState('');

    // Contacts State
    const [newContact, setNewContact] = useState<any>({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, isIncomingWorkOrderContact: false, contactRoles: [], portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined });
    const [isAddingContact, setIsAddingContact] = useState(false);

    // Membership Manual Enrollment State
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollSystemCount, setEnrollSystemCount] = useState(1);
    const [priceOverride, setPriceOverride] = useState<number | ''>('');
    const [isProcessingEnrollment, setIsProcessingEnrollment] = useState(false);

    // Modal States
    const [viewQrAsset, setViewQrAsset] = useState<EquipmentAsset | null>(null);
    const [viewingFile, setViewingFile] = useState<StoredFile | null>(null);
    const [selectedLocationForLayout, setSelectedLocationForLayout] = useState<any>(null);
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [autoOpenEquipmentId, setAutoOpenEquipmentId] = useState<string | null>(null);
    const [selectedCommForFullView, setSelectedCommForFullView] = useState<any | null>(null);
    const [isSyncingRc, setIsSyncingRc] = useState(false);
    const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);

    // Warranty Registration State
    const [isRegisteringWarranty, setIsRegisteringWarranty] = useState(false);
    const [warrantyRegistration, setWarrantyRegistration] = useState({
        equipmentId: '',
        manufacturerDurationMonths: 12,
        manufacturerStartDate: new Date().toISOString().split('T')[0],
        warrantyNotes: ''
    });

    // Sharing State
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareTargetId, setShareTargetId] = useState('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [isIssueWarrantyOpen, setIsIssueWarrantyOpen] = useState(false);

    // --- Maintenance Schedule Tab States ---
    const [isEditingAgreement, setIsEditingAgreement] = useState(false);
    const [agreementFormData, setAgreementFormData] = useState<any>({
        agreementName: '',
        status: 'Draft',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: 1200,
        billingFrequency: 'Annually',
        paymentTerms: 'net_30',
        coveredItems: ['Filter replacement', 'Coil cleaning', 'Belt inspection', 'Electrical check'],
        coveredEquipmentIds: [],
        frequency: 'Quarterly',
        visits: [],
        notes: ''
    });
    const [newCoveredItem, setNewCoveredItem] = useState('');
    const [notificationTemplate, setNotificationTemplate] = useState<'reminder' | 'overdue'>('reminder');
    const [notificationRecipient, setNotificationRecipient] = useState('');
    const [selectedVisitForNotification, setSelectedVisitForNotification] = useState<string | null>(null);
    const [isSendingNotification, setIsSendingNotification] = useState(false);

    // Initialize agreement form data when customer or editing state changes
    React.useEffect(() => {
        if (customer?.maintenanceAgreement) {
            setAgreementFormData(customer.maintenanceAgreement);
        } else {
            setAgreementFormData({
                agreementName: 'Commercial Comfort Plan',
                status: 'Draft',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                value: 1200,
                billingFrequency: 'Annually',
                paymentTerms: 'net_30',
                coveredItems: ['Filter replacement', 'Coil cleaning', 'Belt inspection', 'Electrical check'],
                coveredEquipmentIds: (customer?.equipment || []).map((e: any) => e.id),
                frequency: 'Quarterly',
                visits: [],
                notes: ''
            });
        }
    }, [customer?.id, customer?.maintenanceAgreement, isEditingAgreement]);

    const membership = state.serviceAgreements?.find(a => a.customerId === customerId && a.status === 'Active');

    const employees = useMemo(() => state.users?.filter((u: any) => 
        u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor'
    ) || [], [state.users]);

    const linkedPartners = useMemo(() => {
        if (!state.subcontractors) return [];
        const currentOrgId = state.currentOrganization?.id;
        return state.subcontractors.filter(s => 
            (s.organizationId === currentOrgId || s.linkedOrgId === currentOrgId) && 
            s.status !== 'Inactive'
        );
    }, [state.subcontractors, state.currentOrganization]);

    const customerJobs = useMemo(() => {
        return state.jobs.filter(j => j.customerId === customerId);
    }, [state.jobs, customerId]);

    const historyStats = useMemo(() => {
        const total = customerJobs.length;
        const completed = customerJobs.filter(j => j.jobStatus === 'Completed').length;
        const inProgress = customerJobs.filter(j => j.jobStatus === 'In Progress' || j.jobStatus === 'Scheduled').length;
        const needsFollowUp = customerJobs.filter(j => j.jobStatus === 'Needs Follow-up').length;
        const totalBilled = customerJobs.reduce((sum, j) => sum + Number(j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
        const totalPaid = customerJobs.reduce((sum, j) => {
            const inv = j.invoice as any;
            if (!inv) return sum;
            if (inv.status === 'Paid') return sum + Number(inv.totalAmount || inv.amount || 0);
            return sum + Number(inv.amountPaid || 0);
        }, 0);
        return { total, completed, inProgress, needsFollowUp, totalBilled, totalPaid };
    }, [customerJobs]);

    const filteredHistoryJobs = useMemo(() => {
        let list = [...customerJobs];
        
        // Filter by location
        if (historyLocationFilter) {
            list = list.filter(j => {
                const locId = j.locationId || 'default';
                return locId === historyLocationFilter;
            });
        }

        // Filter by status (only when not searching, so searching finds jobs regardless of status)
        if (historyStatusFilter !== 'ALL' && !historySearchTerm.trim()) {
            list = list.filter(j => j.jobStatus === historyStatusFilter);
        }

        // Filter by search query
        if (historySearchTerm.trim()) {
            const rawQuery = historySearchTerm.toLowerCase().trim();
            const cleanQuery = rawQuery.replace(/^[#\s]+/, '');
            const cleanAlphaNumeric = rawQuery.replace(/[^a-z0-9]/g, '');
            const searchTokens = rawQuery.split(/\s+/).filter(t => t.length > 0);

            list = list.filter(j => {
                const draft = (j as any).draftData || {};
                const idMatch = (j.id || '').toLowerCase();
                const jobNumber = (j.jobNumber || '').toLowerCase();
                const descMatch = ((j as any).description || '').toLowerCase();
                const taskMatch = Array.isArray(j.tasks) ? j.tasks.join(' ').toLowerCase() : '';
                const techMatch = (j.assignedTechnicianName || '').toLowerCase();
                const poMatch = (j.poNumber || (j as any).workOrderNumber || j.invoice?.poNumber || (j as any).referenceNumber || (j as any).legacyPoNumber || draft?.workOrderNo || '').toLowerCase();
                const invMatch = `${j.invoice?.id || ''} ${j.invoice?.invoiceNumber || ''} ${Array.isArray((j as any).linkedInvoiceIds) ? (j as any).linkedInvoiceIds.join(' ') : ''}`.toLowerCase();
                const propMatch = `${j.proposalId || ''} ${Array.isArray((j as any).linkedProposalIds) ? (j as any).linkedProposalIds.join(' ') : ''}`.toLowerCase();
                const locMatch = `${j.locationName || ''} ${(typeof j.address === 'string' ? j.address : '')} ${(j as any).serviceLocationName || ''} ${draft?.serviceAddress || ''}`.toLowerCase();
                const equipMatch = `${(j as any).hvacBrand || ''} ${(j as any).hvacType || ''} ${(j as any).modelNo || ''} ${(j as any).serialNo || ''} ${draft?.serialNo || ''} ${draft?.modelNo || ''} ${draft?.brand || ''}`.toLowerCase();
                const rawJobNotes = typeof j.notes === 'string' ? j.notes : Object.values(j.notes || {}).filter(v => typeof v === 'string').join(' ');
                const rawDraftNotes = typeof draft?.notes === 'string' ? draft.notes : Object.values(draft?.notes || {}).filter(v => typeof v === 'string').join(' ');
                const notesMatch = `${j.techRecommendations || ''} ${j.notes?.workNotes || ''} ${j.notes?.diagnosis || ''} ${draft?.workNotes || ''} ${(j.invoice as any)?.clientNotes || ''} ${rawJobNotes} ${rawDraftNotes}`.toLowerCase();
                const filesMatch = Array.isArray(j.files) ? j.files.map((f: any) => `${f.fileName || ''} ${f.label || ''} ${f.woNumber || ''}`).join(' ').toLowerCase() : '';

                const combinedJobText = `${idMatch} ${jobNumber} ${descMatch} ${taskMatch} ${techMatch} ${poMatch} ${invMatch} ${propMatch} ${locMatch} ${equipMatch} ${notesMatch} ${filesMatch}`;
                const combinedAlpha = combinedJobText.replace(/[^a-z0-9]/g, '');

                const matchesTokens = searchTokens.length > 0 && searchTokens.every(token => {
                    const cleanToken = token.replace(/^[#\s]+/, '').replace(/^inv-|^prop-|^wo-/, '');
                    const cleanTokenAlpha = token.replace(/[^a-z0-9]/g, '');
                    return (
                        combinedJobText.includes(token) ||
                        (cleanToken.length > 0 && combinedJobText.includes(cleanToken)) ||
                        (cleanTokenAlpha.length >= 3 && combinedAlpha.includes(cleanTokenAlpha))
                    );
                });

                return matchesTokens;
            });
        }

        // Sort newest first
        return list.sort((a, b) => {
            const timeA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
            const timeB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
            return timeB - timeA;
        });
    }, [customerJobs, historyLocationFilter, historyStatusFilter, historySearchTerm]);

    const handleJobStatusChange = async (job: Job, newStatus: string) => {
        try {
            const updates = { jobStatus: newStatus, updatedAt: new Date().toISOString() };
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            showToast.success(`Job status updated to ${newStatus}`);
        } catch (err: any) {
            console.error("Failed to update status:", err);
            showToast.error("Failed to update status");
        }
    };

    const handleJobAssignmentChange = async (job: Job, targetVal: string) => {
        try {
            let assignedTechnicianId: string | null = null;
            let assignedTechnicianName: string | null = null;
            let assignedPartnerId: string | null = null;

            if (targetVal.startsWith('partner:')) {
                assignedPartnerId = targetVal.replace('partner:', '');
                const partner = linkedPartners.find(p => p.linkedOrgId === assignedPartnerId || p.id === assignedPartnerId);
                assignedTechnicianName = partner?.companyName || 'Subcontractor';
            } else if (targetVal) {
                assignedTechnicianId = targetVal;
                const techUser = employees.find(u => u.id === targetVal);
                assignedTechnicianName = techUser ? `${techUser.firstName} ${techUser.lastName}` : null;
            }

            const updates: any = {
                assignedTechnicianId,
                assignedTechnicianName,
                assignedPartnerId,
                updatedAt: new Date().toISOString()
            };

            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            showToast.success("Technician assignment updated");
        } catch (err: any) {
            console.error("Failed to assign technician:", err);
            showToast.error("Failed to assign technician");
        }
    };

    const handleCopyJobRef = (jobId: string) => {
        const refStr = `JOB-${jobId.replace('job-', '')}`;
        navigator.clipboard.writeText(refStr);
        showToast.success(`Copied ${refStr} to clipboard`);
    };

    const handleSaveHistoryNotes = async () => {
        if (!historyNotesJob) return;
        try {
            const updates = { internalNotes: historyInternalNotes, updatedAt: new Date().toISOString() };
            dispatch({ type: 'UPDATE_JOB', payload: { ...historyNotesJob, ...updates } });
            await db.collection('jobs').doc(historyNotesJob.id).update(cleanUndefinedFields(updates));
            showToast.success("Internal notes updated successfully");
            setHistoryNotesJob(null);
            setHistoryInternalNotes('');
        } catch (err) {
            console.error("Failed to save notes:", err);
            showToast.error("Failed to save notes");
        }
    };

    const isJobCancelledOrVoid = (j: any) => {
        if (!j) return true;
        const js = String(j.jobStatus || j.status || '').toLowerCase().trim();
        const invs = String(j.invoice?.status || '').toLowerCase().trim();
        const invNotes = String(j.invoice?.notes || j.invoice?.internalNotes || '').toLowerCase();
        
        // 1. Explicit cancelled or void checks on job or invoice status
        if (js.includes('cancel') || js.includes('void') || invs.includes('cancel') || invs.includes('void')) {
            return true;
        }
        if (j.isCancelled === true || j.isVoid === true || j.invoice?.isCancelled === true || j.invoice?.isVoid === true) {
            return true;
        }
        
        // 2. Invoice notes or descriptions indicating zeroed out / cancelled
        if (invNotes.includes('zeroed out') || invNotes.includes('cancelled') || invNotes.includes('canceled') || invNotes.includes('void')) {
            return true;
        }

        // 3. Exclude empty zero-dollar shell tickets without invoice id or without items
        const total = Number(j.invoice?.totalAmount ?? j.invoice?.amount ?? j.invoice?.grandTotal ?? 0);
        const hasItems = Array.isArray(j.invoice?.items) && j.invoice.items.length > 0;
        if (!j.invoice?.id || (total <= 0.001 && !hasItems)) {
            return true;
        }

        return false;
    };

    const statementTotals = useMemo(() => {
        const invoiceJobs = customerJobs.filter(j => j.invoice && !isJobCancelledOrVoid(j));
        let totalBilled = 0;
        let totalPaid = 0;
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const aging = {
            current: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            older: 0,
            over45: 0
        };

        invoiceJobs.forEach(j => {
            const inv = j.invoice as any;
            const t = inv.totalAmount || inv.amount || 0;
            const p = inv.status === 'Failed' ? 0 : (inv.amountPaid || (inv.status === 'Paid' ? t : 0));
            totalBilled += t;
            totalPaid += p;
            
            if (inv.status !== 'Paid') {
                const bal = Math.max(0, t - p);
                const dateVal = j.appointmentTime || (j as any).completedDate || inv.dueDate || j.createdAt;
                if (dateVal) {
                    let dateObj = new Date(dateVal);
                    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                        dateObj = new Date(dateVal.replace(/-/g, '/'));
                    }
                    dateObj.setHours(0, 0, 0, 0);
                    
                    const daysOverdue = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysOverdue > 45) aging.over45 += bal;
                    if (daysOverdue <= 0) aging.current += bal;
                    else if (daysOverdue <= 30) aging.days30 += bal;
                    else if (daysOverdue <= 60) aging.days60 += bal;
                    else if (daysOverdue <= 90) aging.days90 += bal;
                    else aging.older += bal;
                } else {
                    aging.current += bal;
                }
            }
        });

        return {
            totalBilled,
            totalPaid,
            totalDue: Math.max(0, totalBilled - totalPaid),
            aging
        };
    }, [customerJobs]);

    const statementJobs = useMemo(() => {
        const invoiceJobs = customerJobs.filter(j => j.invoice && !isJobCancelledOrVoid(j));
        
        // Sort chronologically oldest first
        const sorted = [...invoiceJobs].sort((a, b) => {
            const dateA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
            const dateB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
            return dateA - dateB;
        });

        // Compute running balance
        let runningBalance = 0;
        const mapped = sorted.map(j => {
            const inv = j.invoice as any;
            const total = Number(inv.totalAmount ?? inv.amount ?? 0);
            const rawPaid = Number(inv.amountPaid || inv.depositPaidAmount || (inv.depositPaid ? (inv.depositAmount || 0) : 0) || 0);
            const paid = inv.status === 'Failed' ? 0 : (inv.status === 'Paid' ? (rawPaid > 0 ? rawPaid : total) : rawPaid);
            const clampedPaid = Math.min(total, Math.max(0, paid));
            const balance = Math.max(0, total - clampedPaid);
            runningBalance += (total - clampedPaid);
            
            return {
                job: j,
                invoice: inv,
                total,
                paid: clampedPaid,
                balance,
                runningBalance
            };
        });

        if (!statementUnpaidOnly) return mapped;
        return mapped.filter(tx => tx.balance > 0.01 && tx.invoice?.status !== 'Paid');
    }, [customerJobs, statementUnpaidOnly]);

    const filteredStatementJobs = useMemo(() => {
        return statementJobs.filter(tx => !isJobCancelledOrVoid(tx.job) && (tx.total > 0 || (Array.isArray(tx.invoice?.items) && tx.invoice.items.length > 0)));
    }, [statementJobs]);

    const customerPayments = useMemo(() => {
        const list: any[] = [];
        customerJobs.forEach(job => {
            if (isJobCancelledOrVoid(job)) return;
            const inv = job.invoice as any;
            if (!inv) return;
            const loc = customer?.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);
            const siteAddress = formatFullAddress(job.address || loc?.address || customer?.address || '');
            if (Array.isArray(inv.payments) && inv.payments.length > 0) {
                inv.payments.forEach((p: any) => {
                    list.push({
                        id: p.id || `pay-${job.id}-${Math.random()}`,
                        amount: Number(p.amount) || 0,
                        method: p.method || 'Check',
                        reference: p.reference || '',
                        date: p.date || p.createdAt?.split('T')[0] || job.appointmentTime?.split('T')[0] || 'N/A',
                        notes: p.notes || '',
                        jobId: job.id,
                        invoiceId: inv.id || job.id.slice(0, 8),
                        locationName: resolveSiteLocationName(job, loc) || 'Main Office',
                        address: siteAddress,
                        poNumber: job.poNumber
                    });
                });
            } else if (Number(inv.amountPaid || 0) > 0 && inv.status === 'Paid') {
                list.push({
                    id: `pay-settled-${job.id}`,
                    amount: Number(inv.amountPaid),
                    method: inv.paymentMethod || 'Manual',
                    reference: inv.paymentReference || '',
                    date: inv.paidDate ? inv.paidDate.split('T')[0] : (job.appointmentTime ? job.appointmentTime.split('T')[0] : 'N/A'),
                    notes: 'Settled on invoice completion',
                    jobId: job.id,
                    invoiceId: inv.id || job.id.slice(0, 8),
                    locationName: resolveSiteLocationName(job, loc) || 'Main Office',
                    address: siteAddress,
                    poNumber: job.poNumber
                });
            }
        });
        return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [customerJobs, customer]);

    const customerWarranties = useMemo(() => {
        return state.warrantyClaims?.filter(w => w.customerId === customerId) || [];
    }, [state.warrantyClaims, customerId]);

    const customerFiles = useMemo(() => {
        const files: StoredFile[] = [];
        if (customer?.files) files.push(...customer.files);
        customerJobs.forEach(j => {
            if (j.files) files.push(...j.files);
        });
        return files.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [customer, customerJobs]);

    const groupedFiles = useMemo(() => {
        const filtered = customerFiles.filter(f => f.metadata?.category !== 'warranty');
        
        interface FileGroup {
            id: string;
            title: string;
            subtitle?: string;
            timestamp: number;
            beforeFiles: StoredFile[];
            afterFiles: StoredFile[];
            otherFiles: StoredFile[];
        }
        
        const groupsMap: Record<string, FileGroup> = {};
        
        const getFileCategory = (file: StoredFile): 'before' | 'after' | 'other' => {
            const isImage = file.fileType?.toLowerCase().includes('image');
            if (!isImage) return 'other';
            
            const metaCat = (file.metadata?.category as string | undefined)?.toLowerCase();
            if (metaCat === 'before') return 'before';
            if (metaCat === 'after') return 'after';
            if (metaCat === 'specifications' || metaCat === 'spec') return 'other';
            
            const label = ((file.metadata?.label || file.label || file.fileName || '') as string).toLowerCase().trim();
            if (
                label.includes('after') ||
                label.includes('comp') ||
                label.includes('work') ||
                label.includes('post') ||
                label.includes('repair') ||
                label.includes('fix') ||
                label.includes('done') ||
                label.includes('validation') ||
                label.includes('sign') ||
                label.includes('approval')
            ) {
                return 'after';
            }
            
            return 'before';
        };

        filtered.forEach(file => {
            const associatedJob = customerJobs.find(j => j.files?.some(jf => jf.id === file.id));
            
            let groupId = '';
            let title = '';
            let subtitle = '';
            let timestamp = new Date(file.createdAt || 0).getTime();
            
            if (associatedJob) {
                groupId = `job-${associatedJob.id}`;
                const jobDate = associatedJob.appointmentTime || file.createdAt;
                const formattedDate = jobDate 
                    ? new Date(jobDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Unknown Date';
                const taskName = associatedJob.tasks?.join(', ') || 'Service Visit';
                title = `${formattedDate} — ${taskName}`;
                subtitle = associatedJob.assignedTechnicianName ? `Technician: ${associatedJob.assignedTechnicianName}` : 'Service Visit';
                timestamp = new Date(jobDate || 0).getTime();
            } else {
                const fileDate = file.createdAt;
                const formattedDate = fileDate 
                    ? new Date(fileDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Unknown Date';
                groupId = `direct-${formattedDate}`;
                title = `${formattedDate} — Direct Uploads`;
                subtitle = 'Uploaded directly to customer';
                timestamp = new Date(fileDate || 0).getTime();
            }
            
            if (!groupsMap[groupId]) {
                groupsMap[groupId] = {
                    id: groupId,
                    title,
                    subtitle,
                    timestamp,
                    beforeFiles: [],
                    afterFiles: [],
                    otherFiles: []
                };
            }
            
            const cat = getFileCategory(file);
            if (cat === 'before') {
                groupsMap[groupId].beforeFiles.push(file);
            } else if (cat === 'after') {
                groupsMap[groupId].afterFiles.push(file);
            } else {
                groupsMap[groupId].otherFiles.push(file);
            }
        });
        
        return Object.values(groupsMap).sort((a, b) => b.timestamp - a.timestamp);
    }, [customerFiles, customerJobs]);


    const normalizedCustomerPhone = useMemo(() => {
        if (!customer?.phone) return '';
        const digits = customer.phone.replace(/\\D/g, '');
        return digits.length === 11 && digits.startsWith('1') ? digits.substring(1) : digits;
    }, [customer?.phone]);

    const customerEmails = useMemo(() => {
        const emails = new Set<string>();
        if (customer?.email) emails.add(customer.email.trim().toLowerCase());
        if (customer?.contacts) {
            customer.contacts.forEach((c: any) => {
                if (c.email) emails.add(c.email.trim().toLowerCase());
            });
        }
        return Array.from(emails);
    }, [customer?.email, customer?.contacts]);

    const customerPhones = useMemo(() => {
        const phones = new Set<string>();
        const main = normalizedCustomerPhone;
        if (main) phones.add(main);
        if (customer?.contacts) {
            customer.contacts.forEach((c: any) => {
                if (c.phone) {
                    const dig = c.phone.replace(/\\D/g, '');
                    const ten = dig.length === 11 && dig.startsWith('1') ? dig.substring(1) : dig;
                    if (ten) phones.add(ten);
                }
            });
        }
        return Array.from(phones);
    }, [normalizedCustomerPhone, customer?.contacts]);

    const communicationTimeline = useMemo(() => {
        const items: any[] = [];

        // 1. Process Messages (SMS, Call logs, Emails) from state.messages
        if (state.messages) {
            state.messages.forEach((m: any) => {
                let isMatch = false;

                // Match by ID direct check
                if (
                    (customerId && m.customerId === customerId) ||
                    (customer?.id && m.customerId === customer?.id) ||
                    (customer?.id && (m.senderId === customer?.id || m.receiverId === customer?.id))
                ) {
                    isMatch = true;
                }

                // Match by normalized phones
                if (!isMatch) {
                    const sendDig = m.senderId ? m.senderId.replace(/\D/g, '') : '';
                    const sendTen = sendDig.length === 11 && sendDig.startsWith('1') ? sendDig.substring(1) : sendDig;
                    
                    const recvDig = m.receiverId ? m.receiverId.replace(/\D/g, '') : '';
                    const recvTen = recvDig.length === 11 && recvDig.startsWith('1') ? recvDig.substring(1) : recvDig;

                    if (customerPhones.some(p => p === sendTen || p === recvTen)) {
                        isMatch = true;
                    }
                }

                // Match by email (check senderId, receiverId, and to fields)
                if (!isMatch) {
                    const mSenderEmail = (m.senderId || '').trim().toLowerCase();
                    const mRecvEmail = (m.receiverId || '').trim().toLowerCase();
                    const mToEmail = (m.to || '').trim().toLowerCase();
                    
                    if (customerEmails.some(e => 
                        (mSenderEmail && (mSenderEmail === e || mSenderEmail.includes(e))) || 
                        (mRecvEmail && (mRecvEmail === e || mRecvEmail.includes(e))) || 
                        (mToEmail && (mToEmail === e || mToEmail.includes(e)))
                    )) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    const isOutbound = m.senderId === state.currentUser?.id || m.senderName?.toLowerCase().includes('staff') || m.senderName?.toLowerCase().includes('admin');
                    
                    let type = 'sms_in';
                    let icon = MessageSquare;
                    let iconColor = 'text-teal-500';
                    let badgeColor = 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
                    let badgeLabel = 'SMS Inbound';

                    if (m.type === 'email') {
                        type = isOutbound ? 'email_out' : 'email_in';
                        icon = Mail;
                        iconColor = isOutbound ? 'text-indigo-500' : 'text-blue-500';
                        badgeColor = isOutbound ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
                        badgeLabel = isOutbound ? 'Email Outbound' : 'Email Inbound';
                    } else if (m.type === 'call') {
                        const isMissed = m.status === 'missed' || m.content?.toLowerCase().includes('missed') || m.content?.toLowerCase().includes('failed');
                        const isVoicemail = m.status === 'voicemail';
                        const isCallOutbound = m.direction === 'outbound';
                        type = isMissed ? (isVoicemail ? 'call_voicemail' : 'call_missed') : (isCallOutbound ? 'call_out' : 'call_in');
                        icon = isMissed ? (isVoicemail ? Voicemail : PhoneOff) : (isCallOutbound ? PhoneOutgoing : PhoneCall);
                        iconColor = isMissed ? 'text-red-500' : (isCallOutbound ? 'text-blue-500' : 'text-emerald-500');
                        badgeColor = isMissed ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : (isCallOutbound ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-indigo-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400');
                        badgeLabel = isMissed ? (isVoicemail ? 'Voicemail' : 'Missed Call') : (isCallOutbound ? 'Outbound Call' : 'Inbound Call');
                    } else if (m.type === 'alert' || m.content?.toLowerCase().includes('call')) {
                        const isMissed = m.content?.toLowerCase().includes('missed');
                        type = isMissed ? 'call_missed' : 'call_in';
                        icon = isMissed ? PhoneOff : PhoneCall;
                        iconColor = isMissed ? 'text-red-500' : 'text-emerald-500';
                        badgeColor = isMissed ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
                        badgeLabel = isMissed ? 'Missed Call' : 'Call Received';
                    } else {
                        // Default SMS
                        type = isOutbound ? 'sms_out' : 'sms_in';
                        icon = MessageSquare;
                        iconColor = isOutbound ? 'text-teal-600' : 'text-cyan-500';
                        badgeColor = isOutbound ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
                        badgeLabel = isOutbound ? 'SMS Sent' : 'SMS Received';
                    }

                    items.push({
                        id: m.id || `msg-${Date.now()}-${Math.random()}`,
                        timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
                        type,
                        title: m.subject || badgeLabel,
                        subtitle: m.senderName ? `From: ${m.senderName}` : undefined,
                        content: m.content,
                        icon,
                        iconColor,
                        badgeColor,
                        badgeLabel,
                        recordingUrl: m.recordingUrl,
                        duration: m.duration
                    });
                }
            });
        }

        // 2. Process Appointment Lifecycle Events from customerJobs
        if (customerJobs) {
            customerJobs.forEach((job: any) => {
                if (job.createdAt) {
                    items.push({
                        id: `job-sched-${job.id}`,
                        timestamp: job.createdAt,
                        type: 'job_scheduled',
                        title: 'Work Order Created',
                        subtitle: `Job ID: #${job.id.slice(0, 8)}`,
                        content: `Scheduled for ${new Date(job.appointmentTime).toLocaleString()} | Tasks: ${job.tasks?.join(', ')}`,
                        icon: Calendar,
                        iconColor: 'text-amber-500',
                        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
                        badgeLabel: 'Scheduled'
                    });
                }

                if (job.jobStatus === 'Completed') {
                    const compTime = job.completionDate || job.appointmentTime || job.createdAt;
                    items.push({
                        id: `job-comp-${job.id}`,
                        timestamp: compTime,
                        type: 'job_completed',
                        title: 'Work Order Completed',
                        subtitle: `Job ID: #${job.id.slice(0, 8)}`,
                        content: `Completed by ${job.assignedTechnicianName || 'Unassigned'}. Invoice: ${job.invoice?.id || 'N/A'} | Total: $${(job.invoice?.amount || 0).toFixed(2)}`,
                        icon: CheckCircle,
                        iconColor: 'text-green-500',
                        badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                        badgeLabel: 'Completed'
                    });
                }

                if (job.jobStatus === 'Cancelled') {
                    const cancelEvent = job.jobEvents?.find((e: any) => e.status === 'Cancelled' || e.type?.toLowerCase().includes('cancel'));
                    const cancelTime = cancelEvent?.timestamp || job.appointmentTime || job.createdAt;
                    items.push({
                        id: `job-canc-${job.id}`,
                        timestamp: cancelTime,
                        type: 'job_cancelled',
                        title: 'Work Order Cancelled',
                        subtitle: `Job ID: #${job.id.slice(0, 8)}`,
                        content: `Job for ${new Date(job.appointmentTime).toLocaleString()} has been cancelled.`,
                        icon: XCircle,
                        iconColor: 'text-red-500',
                        badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                        badgeLabel: 'Cancelled'
                    });
                }

                if (job.jobEvents) {
                    job.jobEvents.forEach((ev: any, evIdx: number) => {
                        const isResched = ev.type === 'Rescheduled' || ev.status === 'Rescheduled' || ev.note?.toLowerCase().includes('resched');
                        if (isResched) {
                            items.push({
                                id: `job-resched-${job.id}-${evIdx}`,
                                timestamp: ev.timestamp || job.appointmentTime,
                                type: 'job_rescheduled',
                                title: 'Work Order Rescheduled',
                                subtitle: `Job ID: #${job.id.slice(0, 8)}`,
                                content: ev.note || `Appointment time updated to ${new Date(job.appointmentTime).toLocaleString()}`,
                                icon: Clock,
                                iconColor: 'text-purple-500',
                                badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                                badgeLabel: 'Rescheduled'
                            });
                        }
                    });
                }
            });
        }

        // 3. Process Custom Customer Communication Logs (from customers/{id}/communications)
        if (customCommLogs && customCommLogs.length > 0) {
            customCommLogs.forEach((log: any) => {
                if (items.some((it: any) => it.id === log.id)) return;

                let icon = Mail;
                let iconColor = 'text-indigo-500';
                let badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
                let badgeLabel = log.badgeLabel || 'Email Sent';

                if (log.type === 'portal_login') {
                    icon = UserCheck;
                    iconColor = 'text-emerald-500';
                    badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
                    badgeLabel = 'Portal Login';
                } else if (log.type === 'portal_invite' || log.type === 'PortalInvite') {
                    icon = Key;
                    iconColor = 'text-amber-500';
                    badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
                    badgeLabel = 'Portal Invite';
                } else if (log.type === 'sms_out' || log.type === 'sms') {
                    icon = MessageSquare;
                    iconColor = 'text-teal-500';
                    badgeColor = 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
                    badgeLabel = 'SMS Sent';
                } else if (log.type === 'call_out' || log.type === 'call_in' || log.type === 'call') {
                    icon = PhoneCall;
                    iconColor = 'text-blue-500';
                    badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
                    badgeLabel = 'Voice Call';
                } else if (log.type === 'invoice') {
                    icon = FileText;
                    iconColor = 'text-emerald-500';
                    badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
                    badgeLabel = 'Invoice Sent';
                }

                items.push({
                    id: log.id || `custom-comm-${Math.random()}`,
                    timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
                    type: log.type || 'email_out',
                    title: log.title || log.subject || badgeLabel,
                    subtitle: log.subtitle || (log.senderName ? `From: ${log.senderName}` : undefined),
                    content: log.content,
                    icon,
                    iconColor,
                    badgeColor: log.badgeColor || badgeColor,
                    badgeLabel: log.badgeLabel || badgeLabel,
                    recordingUrl: log.recordingUrl,
                    duration: log.duration
                });
            });
        }

        // 4. Smart Deduplication (collapses multiple docs generated for the same event within 15 seconds)
        const sorted = items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const uniqueItems: any[] = [];

        sorted.forEach((item: any) => {
            const isDup = uniqueItems.some((u: any) => {
                if (u.id === item.id) return true;
                const timeDiff = Math.abs(new Date(u.timestamp).getTime() - new Date(item.timestamp).getTime());
                if (timeDiff < 15000) {
                    const uContent = (u.content || '').trim();
                    const iContent = (item.content || '').trim();
                    if (uContent && iContent && (uContent === iContent || uContent.includes(iContent) || iContent.includes(uContent))) {
                        return true;
                    }
                }
                return false;
            });
            if (!isDup) {
                uniqueItems.push(item);
            }
        });

        return uniqueItems;
    }, [customer?.id, customerPhones, customerEmails, state.messages, customerJobs, state.currentUser?.id, customCommLogs]);

    if (!customer) return null;

    const processUploadedFile = async (file: File, category?: string) => {
        if (!state.currentOrganization) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast.warn("File too large — must be under 5MB. Please compress the file.");
            return;
        }
        
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'doc.pdf';
            const path = `organizations/${state.currentOrganization.id}/customers/${customer.id}/files/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);

            const newFile: StoredFile = {
                id: `file-${Date.now()}`,
                organizationId: state.currentOrganization.id,
                parentId: customer.id,
                parentType: 'customer',
                fileName: file.name,
                fileType: file.type,
                dataUrl: downloadUrl,
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'admin',
                metadata: category ? { category } : {}
            };
            
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                files: firebase.firestore.FieldValue.arrayUnion(newFile)
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, files: [...(customer.files || []), newFile] } });
            showToast.success("File uploaded successfully.");
        } catch (err) {
            console.error(err);
            showToast.error("Upload failed.");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processUploadedFile(file, category);
        e.target.value = '';
    };

    const handleDragDocs = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActiveDocs(true);
        } else if (e.type === "dragleave") {
            setDragActiveDocs(false);
        }
    };

    const handleDropDocs = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveDocs(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processUploadedFile(e.dataTransfer.files[0], 'document');
        }
    };

    const handleDragWarranties = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActiveWarranties(true);
        } else if (e.type === "dragleave") {
            setDragActiveWarranties(false);
        }
    };

    const handleDropWarranties = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveWarranties(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processUploadedFile(e.dataTransfer.files[0], 'warranty');
        }
    };

    const handleSaveWarrantyRegistration = async () => {
        if (!warrantyRegistration.equipmentId) {
            showToast.warn("Please select equipment.");
            return;
        }
        try {
            const updatedEquipment = (customer.equipment || []).map(eq => {
                if (eq.id === warrantyRegistration.equipmentId) {
                    return {
                        ...eq,
                        warranty: {
                            ...eq.warranty,
                            manufacturerDurationMonths: warrantyRegistration.manufacturerDurationMonths,
                            manufacturerStartDate: warrantyRegistration.manufacturerStartDate,
                            warrantyNotes: warrantyRegistration.warrantyNotes
                        }
                    };
                }
                return eq;
            });
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: updatedEquipment }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipment } });
            showToast.success("Warranty registered successfully.");
            setIsRegisteringWarranty(false);
        } catch (e) {
            console.error(e);
            showToast.error("Failed to register warranty.");
        }
    };

    const handleDeleteCustomer = async () => {
        if (!await globalConfirm(`REMOVE ${customer.name}? This customer and all their records will be detached from your organization and moved to the Master Admin Limbo queue.`)) return;
        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                organizationId: 'unaffiliated',
                isDeleted: true,
                detachedAt: new Date().toISOString(),
                originalOrganizationId: state.currentOrganization?.id || ''
            }));
            dispatch({ type: 'DELETE_CUSTOMER', payload: customer.id });
            onClose();
        } catch (e) {
            console.error(e);
            showToast.error("Removal failed. Please ensure you have permissions.");
        }
    };

    const handleAddMarkupRule = () => {
        const currentRules: CustomerMarkupRule[] = [
            ...(formData.pricingRules?.partsMarkupRules || (
                (formData.pricingRules?.partsMarkupTier1 || formData.pricingRules?.partsMarkupTier2) ? [
                    { id: `tier-under-1500`, condition: 'under' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier1 ?? 43, label: 'Standard Commercial Parts' },
                    { id: `tier-over-1500`, condition: 'over' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier2 ?? 23, label: 'RTUs, Compressors, Coils' }
                ] : []
            ))
        ];
        const newRule: CustomerMarkupRule = {
            id: `rule-${Date.now()}`,
            condition: 'under',
            threshold: 1500,
            rate: 24,
            label: ''
        };
        setFormData({
            ...formData,
            pricingRules: {
                ...(formData.pricingRules || {}),
                partsMarkupRules: [...currentRules, newRule]
            }
        });
    };

    const handleUpdateMarkupRule = (index: number, field: keyof CustomerMarkupRule, value: any) => {
        const currentRules: CustomerMarkupRule[] = [
            ...(formData.pricingRules?.partsMarkupRules || (
                (formData.pricingRules?.partsMarkupTier1 || formData.pricingRules?.partsMarkupTier2) ? [
                    { id: `tier-under-1500`, condition: 'under' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier1 ?? 43, label: 'Standard Commercial Parts' },
                    { id: `tier-over-1500`, condition: 'over' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier2 ?? 23, label: 'RTUs, Compressors, Coils' }
                ] : []
            ))
        ];
        const updated = [...currentRules];
        if (updated[index]) {
            updated[index] = { ...updated[index], [field]: value };
            setFormData({
                ...formData,
                pricingRules: {
                    ...(formData.pricingRules || {}),
                    partsMarkupRules: updated
                }
            });
        }
    };

    const handleDeleteMarkupRule = (index: number) => {
        const currentRules: CustomerMarkupRule[] = [
            ...(formData.pricingRules?.partsMarkupRules || (
                (formData.pricingRules?.partsMarkupTier1 || formData.pricingRules?.partsMarkupTier2) ? [
                    { id: `tier-under-1500`, condition: 'under' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier1 ?? 43, label: 'Standard Commercial Parts' },
                    { id: `tier-over-1500`, condition: 'over' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier2 ?? 23, label: 'RTUs, Compressors, Coils' }
                ] : []
            ))
        ];
        const updated = currentRules.filter((_, idx) => idx !== index);
        setFormData({
            ...formData,
            pricingRules: {
                ...(formData.pricingRules || {}),
                partsMarkupRules: updated
            }
        });
    };

    const handleSaveOverview = async () => {
        let finalPaymentTerms = formData.paymentTerms;
        if (formData.paymentTerms === 'custom' && (formData as any).paymentTermsDays) {
            finalPaymentTerms = `net_${(formData as any).paymentTermsDays}`;
        }
        const accountNumberToSave = formData.accountNumber || customer.accountNumber || getOrGenerateAccountNumber(customer);
        const updated = sanitizeCustomer({ 
            ...customer, 
            ...formData, 
            accountNumber: accountNumberToSave,
            paymentTerms: finalPaymentTerms
        });
        delete (updated as any).paymentTermsDays;

        try {
            if (!state.isDemoMode) {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields(updated));

                // Update team documents customerIds lists
                const orgId = state.currentOrganization?.id || '';
                const nextTeamIds = formData.dispatchTeamIds || [];
                const teamsToUpdate = state.teams.filter(t => t.organizationId === orgId);
                const teamUpdates = teamsToUpdate.map(async (team) => {
                    const shouldHaveCustomer = nextTeamIds.includes(team.id);
                    const currentCustomers = team.customerIds || [];
                    const hasCustomer = currentCustomers.includes(customer.id);

                    if (shouldHaveCustomer && !hasCustomer) {
                        await db.collection('teams').doc(team.id).update(cleanUndefinedFields({
                            customerIds: [...currentCustomers, customer.id]
                        }));
                    } else if (!shouldHaveCustomer && hasCustomer) {
                        await db.collection('teams').doc(team.id).update(cleanUndefinedFields({
                            customerIds: currentCustomers.filter(cId => cId !== customer.id)
                        }));
                    }
                });
                await Promise.all(teamUpdates);
            }
        } catch (err) {
            console.error("Failed to update customer in Firestore:", err);
            showToast.error("Failed to save changes in database.");
        }
        dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });

        // Update active/incomplete jobs for this customer
        const activeJobs = state.jobs.filter(j => 
            j.customerId === customer.id && 
            j.jobStatus !== 'Completed' && 
            j.jobStatus !== 'Cancelled'
        );

        const jobUpdates = activeJobs.map(async (job) => {
            const jobUpdatesPayload: Partial<Job> = {
                customerName: updated.name || job.customerName,
                customerEmail: updated.email || job.customerEmail,
                customerPhone: updated.phone || job.customerPhone,
            };

            if (updated.firstName) jobUpdatesPayload.firstName = updated.firstName;
            if (updated.lastName) jobUpdatesPayload.lastName = updated.lastName;

            // Update address only if the job's address matches the customer's old address
            if (updated.address && customer.address && job.address === customer.address) {
                jobUpdatesPayload.address = updated.address;
            }

            try {
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdatesPayload));
                }
            } catch (err) {
                console.error(`Failed to update job ${job.id}:`, err);
            }

            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdatesPayload } });
        });

        await Promise.all(jobUpdates).catch(err => {
            console.error("Failed to update active customer jobs:", err);
        });

        showToast.success("Customer saved successfully!");
        setIsEditing(false);
    };

    const handleAddLocation = async () => {
        if (!newLocation.propertyName && !newLocation.name) {
            showToast.warn("Property Name and Address are required.");
            return;
        }

        const cleanLoc = sanitizeAddressFields(newLocation.address, newLocation.city || customer.city, newLocation.state || customer.state, newLocation.zip || customer.zip);
        
        const storeNum = (newLocation.storeNumber || newLocation.locationNumber || '').trim();
        // Map legacy UI "name" to "propertyName" for the new schema
        const locPayload: any = {
            ...newLocation,
            storeNumber: storeNum || undefined,
            locationNumber: storeNum || undefined,
            address: cleanLoc.address,
            city: cleanLoc.city,
            state: cleanLoc.state,
            zip: cleanLoc.zip,
            name: (newLocation.name || newLocation.propertyName || 'Site Location').trim(),
            propertyName: (newLocation.name || newLocation.propertyName || 'Site Location').trim(),
            customerId: customer.id,
            organizationId: state.currentOrganization?.id || 'default'
        };
        delete locPayload.poNumber;

        let updatedLocations;
        if (locPayload.id) {
            updatedLocations = (customer.serviceLocations || []).map((l:any) => l.id === locPayload.id ? locPayload : l);
            try {
                if (!state.isDemoMode) {
                    await db.collection('serviceLocations').doc(locPayload.id).set(cleanUndefinedFields(locPayload), { merge: true });
                }
            } catch (err) {
                console.error("Failed to update service location:", err);
            }

            // Sync active/incomplete jobs pointing to this service location
            const activeJobs = state.jobs.filter(j => 
                j.customerId === customer.id && 
                j.locationId === locPayload.id &&
                j.jobStatus !== 'Completed' && 
                j.jobStatus !== 'Cancelled'
            );

            const jobUpdates = activeJobs.map(async (job) => {
                const jobUpdatesPayload = {
                    address: locPayload.address,
                    locationName: locPayload.propertyName || locPayload.name || null,
                };
                try {
                    if (!state.isDemoMode) {
                        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdatesPayload));
                    }
                } catch (err) {
                    console.error(`Failed to update job location ${job.id}:`, err);
                }
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdatesPayload } });
            });
            await Promise.all(jobUpdates).catch(console.error);

        } else {
            locPayload.id = `loc-${Date.now()}`;
            updatedLocations = [...(customer.serviceLocations || []), locPayload];
            try {
                if (!state.isDemoMode) {
                    await db.collection('serviceLocations').doc(locPayload.id).set(cleanUndefinedFields(locPayload));
                }
            } catch (err) {
                console.error("Failed to create service location:", err);
            }
        }
        
        try {
            if (!state.isDemoMode) {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ serviceLocations: updatedLocations }));
            }
        } catch (err) {
            console.error("Failed to update customer service locations:", err);
        }

        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });
        setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '', storeNumber: '', locationNumber: '' });
        setIsAddingLocation(false);
    };

    const handleDeleteLocation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await globalConfirm("Remove this property? Equipment or jobs mapped to it may lose context.")) return;
        const updatedLocations = (customer.serviceLocations || []).filter((l:any) => l.id !== id);
        
        try {
            if (!state.isDemoMode) {
                await db.collection('serviceLocations').doc(id).delete();
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ serviceLocations: updatedLocations }));
            }
        } catch (err) {
            console.error("Failed to delete service location:", err);
        }

        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });

        // Update active/incomplete jobs pointing to this service location
        const activeJobs = state.jobs.filter(j => 
            j.customerId === customer.id && 
            j.locationId === id &&
            j.jobStatus !== 'Completed' && 
            j.jobStatus !== 'Cancelled'
        );

        const jobUpdates = activeJobs.map(async (job) => {
            const jobUpdatesPayload = {
                locationId: null,
                locationName: null,
            };
            try {
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdatesPayload));
                }
            } catch (err) {
                console.error(`Failed to clear job location ${job.id}:`, err);
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdatesPayload } });
        });
        await Promise.all(jobUpdates).catch(console.error);
    };

    const cleanContactsForFirestore = (contactsList: any[]) => {
        return contactsList.map((c: any) => {
            const cleaned = { ...c };
            Object.keys(cleaned).forEach(key => {
                if (cleaned[key] === undefined) {
                    delete cleaned[key];
                }
            });
            return cleaned;
        });
    };

    const handleAddContact = async () => {
        if (!newContact.name || !newContact.phone) {
            showToast.warn("Contact Name and Phone are required.");
            return;
        }

        const contactPayload = { ...newContact };
        let updatedContacts;

        if (contactPayload.id) {
            updatedContacts = (customer.contacts || []).map((c:any) => c.id === contactPayload.id ? contactPayload : c);
        } else {
            contactPayload.id = `contact-${Date.now()}`;
            updatedContacts = [...(customer.contacts || []), contactPayload];
        }

        const cleanedContacts = cleanContactsForFirestore(updatedContacts);
        await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ contacts: cleanedContacts }));
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, contacts: cleanedContacts } });
        setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, isIncomingWorkOrderContact: false, contactRoles: [], portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined });
        setIsAddingContact(false);
        showToast.success("Contact saved.");
    };

    const handleDeleteContact = async (id: string) => {
        if (!await globalConfirm("Remove this contact?")) return;
        const updatedContacts = (customer.contacts || []).filter((c:any) => c.id !== id);
        const cleanedContacts = cleanContactsForFirestore(updatedContacts);
        await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ contacts: cleanedContacts }));
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, contacts: cleanedContacts } });
    };

    const handleDeleteFile = async (file: StoredFile, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await globalConfirm("Delete this file permanently?")) return;
        try {
            const fileUrl = file.url || file.dataUrl;
            if (file.parentType === 'customer') {
                const updatedFiles = (customer.files || []).filter((f: any) => {
                    if (file.id && f.id === file.id) return false;
                    if (fileUrl && (f.url === fileUrl || f.dataUrl === fileUrl)) return false;
                    return true;
                });
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, files: updatedFiles } });
            } else if (file.parentType === 'job' && file.parentId) {
                const jobToUpdate = state.jobs.find((j: Job) => j.id === file.parentId);
                if (jobToUpdate) {
                    const updatedFiles = (jobToUpdate.files || []).filter((f: any) => {
                        if (file.id && f.id === file.id) return false;
                        if (fileUrl && (f.url === fileUrl || f.dataUrl === fileUrl)) return false;
                        return true;
                    });
                    await db.collection('jobs').doc(jobToUpdate.id).update(cleanUndefinedFields({
                        files: updatedFiles,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({ type: 'UPDATE_JOB', payload: { id: jobToUpdate.id, files: updatedFiles } });
                }
            } else {
                showToast.error("Could not determine file origin.");
                return;
            }
            showToast.success("File deleted successfully.");
            if (viewingFile?.id === file.id) setViewingFile(null);
        } catch (err) {
            console.error(err);
            showToast.error("Failed to delete file.");
        }
    };


    const handleManualEnroll = async (plan: MembershipPlan) => {
        if (!state.currentOrganization || isProcessingEnrollment) return;
        setIsProcessingEnrollment(true);
        
        const orgId = state.currentOrganization.id;
        const agreementId = `sa-man-${Date.now()}`;
        
        // Calculate Price based on System Count
        const basePrice = plan.monthlyPrice;
        const extraCost = plan.pricePerAdditionalSystem || 0;
        let finalPrice = basePrice + ((Math.max(1, enrollSystemCount) - 1) * extraCost);

        if (typeof priceOverride === 'number') {
            finalPrice = priceOverride;
        }

        const planFee = (plan.addonFeeAmount || 0) + (finalPrice * (plan.addonFeePercent || 0) / 100);
        const totalRecurrentPrice = finalPrice + planFee;

        const newAgreement: ServiceAgreement = {
            id: agreementId,
            organizationId: orgId,
            customerId: customer.id,
            customerName: customer.name,
            planName: plan.name,
            price: totalRecurrentPrice,
            billingCycle: 'Monthly',
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
            status: 'Active',
            visitsTotal: plan.visitsPerYear,
            visitsRemaining: plan.visitsPerYear,
            termsAccepted: true,
            termsSignedDate: new Date().toISOString(),
            termsSignature: `Staff: ${state.currentUser?.firstName}`,
            systemCount: enrollSystemCount
        };

        const firstInvoiceJob: Job = {
            id: `job-mem-start-${Date.now()}`,
            organizationId: orgId,
            customerName: customer.name,
            customerId: customer.id,
            address: customer.address,
            tasks: [`Enrollment: ${plan.name}`],
            jobStatus: 'Completed',
            appointmentTime: new Date().toISOString(),
            source: 'ManualStaff',
            specialInstructions: '',
            divisionId: state.currentOrganization?.divisions?.[0]?.id || null,
            invoice: {
                id: `INV-MEM-${Date.now()}`,
                status: 'Unpaid',
                items: [
                    {
                        id: 'it-1',
                        description: `Join ${plan.name} Membership (${enrollSystemCount} Systems)`,
                        quantity: 1,
                        unitPrice: finalPrice,
                        total: finalPrice,
                        type: 'Service' as const,
                        taxable: false
                    },
                    ...((planFee > 0) ? [{
                        id: 'it-2',
                        description: `${plan.addonFeeName || 'Plan Fee'} - ${plan.name}`,
                        quantity: 1,
                        unitPrice: planFee,
                        total: planFee,
                        type: 'Fee' as const,
                        taxable: false
                    }] : [])
                ],
                subtotal: finalPrice + planFee,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: finalPrice + planFee,
                amount: finalPrice + planFee
            },
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await Promise.all([
                db.collection('serviceAgreements').doc(agreementId).set(cleanUndefinedFields(newAgreement)),
                db.collection('jobs').doc(firstInvoiceJob.id).set(cleanUndefinedFields(firstInvoiceJob))
            ]);
            setIsEnrolling(false);
            setEnrollSystemCount(1);
            setPriceOverride('');
            showToast.success(`Enrolled in ${plan.name} for ${enrollSystemCount} systems.`);
        } catch (e) {
            console.error(e);
            showToast.error("Enrollment failed.");
        } finally {
            setIsProcessingEnrollment(false);
        }
    };

    const handleSendInvite = async () => {
        if (!customer.email) {
            showToast.warn("Customer record is missing an email address.");
            return;
        }
        
        setIsSendingInvite(true);
        const org = state.currentOrganization;
        const orgName = org?.name || 'Service Provider';
        const normalizedEmail = customer.email.trim().toLowerCase();
        const inviteToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const portalLink = `${getBaseUrl()}/#/register?view=register_user&userType=customer&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(customer.name)}&oid=${customer.organizationId}&token=${inviteToken}`;


        try {
            // 1. Create a root user document (Acts as an INVITE for registration)
            const inviteDoc: any = {
                email: normalizedEmail,
                organizationId: org?.id || 'unaffiliated',
                role: 'customer',
                status: 'invited',
                inviteToken,
                firstName: customer.firstName || customer.name.split(' ')[0],
                lastName: customer.lastName || customer.name.split(' ').slice(1).join(' ') || '',
                phone: customer.phone || '',
                address: {
                    street: customer.address || '',
                    city: customer.city || '',
                    state: customer.state || '',
                    zip: customer.zip || ''
                },
                createdAt: new Date().toISOString(),
                preferences: { theme: 'dark' }
            };

            try {
                await db.collection('users').doc(normalizedEmail).set(cleanUndefinedFields(inviteDoc), { merge: true });
            } catch (err) {
                console.warn("Could not create stub user invite document due to permissions, but proceeding to send email link:", err);
            }
            
            // 2. Prepare Email Payload
            const mailPayload = {
                to: [normalizedEmail],
                customerId: customer.id,
                message: {
                    subject: `Portal Invitation: ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Welcome to the ${orgName} Customer Portal</h2>
                            <p>Hi ${customer.firstName || customer.name},</p>
                            <p>We've created a secure portal for you to view your service history, upcoming appointments, and invoices.</p>
                            <p style="margin: 30px 0;">
                                <a href="${portalLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Setup Your Account</a>
                            </p>
                            <p style="font-size: 13px; color: #475569;">If the link or button above does not work due to strict email security filters, you can also securely register directly:</p>
                            <ol style="font-size: 13px; color: #475569; padding-left: 20px;">
                                <li style="margin-bottom: 4px;">Go to <a href="${getBaseUrl()}/#/register" style="color: #2563eb;">${getBaseUrl()}/#/register</a></li>
                                <li style="margin-bottom: 4px;">Ensure "Customer" is selected at the top</li>
                                <li style="margin-bottom: 4px;">Use this email address to create your account: <strong>${normalizedEmail}</strong></li>
                            </ol>
                            <br/>
                            <p>Thanks,<br/>${orgName}</p>
                        </div>
                    `,
                    text: `Welcome to the ${orgName} Portal. Setup your account here: ${portalLink}`,
                    replyTo: org?.email,
                },
                senderUser: state.currentUser,
                type: 'PortalInvite'
            };

            await sendEmail(org, mailPayload);
            showToast.success(`Invitation sent to ${normalizedEmail}`);
        } catch (error) {
            console.error(error);
            showToast.error("Failed to send invitation.");
        } finally {
            setIsSendingInvite(false);
        }
    };

    const handleSendContactInvite = async (contact: any) => {
        if (!contact.email) {
            showToast.warn("Contact is missing an email address.");
            return;
        }
        
        const org = state.currentOrganization;
        const orgName = org?.name || 'Service Provider';
        const normalizedEmail = contact.email.trim().toLowerCase();
        const inviteToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const portalLink = `${getBaseUrl()}/#/register?view=register_user&userType=customer&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(contact.name)}&oid=${customer.organizationId}&token=${inviteToken}`;

        try {
            const inviteDoc: any = {
                email: normalizedEmail,
                organizationId: org?.id || 'unaffiliated',
                role: 'customer',
                status: 'invited',
                inviteToken,
                firstName: contact.name.split(' ')[0],
                lastName: contact.name.split(' ').slice(1).join(' ') || '',
                phone: contact.phone || '',
                createdAt: new Date().toISOString(),
                preferences: { theme: 'dark' },
                customerId: customer.id,
                customerPortalRole: contact.portalRole || 'corporate',
                allowedLocationIds: contact.allowedLocationIds || []
            };

            await db.collection('users').doc(normalizedEmail).set(cleanUndefinedFields(inviteDoc), { merge: true });
            
            const updatedContacts = (customer.contacts || []).map((c: any) => 
                c.id === contact.id ? { ...c, portalUserStatus: 'invited' } : c
            );
            const cleanedContacts = cleanContactsForFirestore(updatedContacts);
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ contacts: cleanedContacts }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, contacts: cleanedContacts } });

            const mailPayload = {
                to: [normalizedEmail],
                customerId: customer.id,
                message: {
                    subject: `Portal Invitation: ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Welcome to the ${orgName} Customer Portal</h2>
                            <p>Hi ${contact.name.split(' ')[0]},</p>
                            <p>We've created a secure portal for you to view service history, upcoming appointments, and invoices.</p>
                            <p style="margin: 30px 0;">
                                <a href="${portalLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Setup Your Account</a>
                            </p>
                            <p style="font-size: 13px; color: #475569;">If the link or button above does not work due to strict email security filters, you can also securely register directly:</p>
                            <ol style="font-size: 13px; color: #475569; padding-left: 20px;">
                                <li style="margin-bottom: 4px;">Go to <a href="${getBaseUrl()}/#/register" style="color: #2563eb;">${getBaseUrl()}/#/register</a></li>
                                <li style="margin-bottom: 4px;">Ensure "Customer" is selected at the top</li>
                                <li style="margin-bottom: 4px;">Use this email address to create your account: <strong>${normalizedEmail}</strong></li>
                            </ol>
                            <br/>
                            <p>Thanks,<br/>${orgName}</p>
                        </div>
                    `,
                    text: `Welcome to the ${orgName} Portal. Setup your account here: ${portalLink}`,
                    replyTo: org?.email,
                },
                senderUser: state.currentUser,
                type: 'PortalInvite'
            };

            await sendEmail(org, mailPayload);
            showToast.success(`Invitation sent to ${normalizedEmail}`);
        } catch (error) {
            console.error(error);
            showToast.error("Failed to send invitation.");
        }
    };

        const handleDownloadPDF = async () => {
            try {
                const org = state.currentOrganization;
                
                // Format date range & filter out any cancelled / void entries
                const filteredJobs = filteredStatementJobs;
                const dates = filteredJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
                const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
                const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
                const statementPeriod = `${minDate} - ${maxDate}`;
                const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

                const { doc, attachment } = await generateStatementOfAccountPdfAttachment({
                    customer,
                    org,
                    statementJobs: filteredJobs,
                    statementTotals,
                    statementPeriod,
                    statementNumber
                });

                doc.save(attachment.filename);
                showToast.success("Statement PDF downloaded successfully!");
            } catch (error: any) {
                console.error("PDF generation error:", error);
                showToast.error("Failed to generate PDF: " + error.message);
            }
        };

    const renderInOutTimes = (job: Job) => {
        const timeSummary = getJobTimeSummary(job);
        
        if (!timeSummary.hasTimeRecorded) {
            if (job.appointmentTime) {
                try {
                    const dateObj = new Date(job.appointmentTime);
                    return (
                        <div className="text-gray-400 dark:text-gray-500 text-[10px] leading-tight">
                            <span className="block font-medium">Scheduled</span>
                            <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    );
                } catch {
                    return <span className="text-gray-400 dark:text-gray-600">—</span>;
                }
            }
            return <span className="text-gray-400 dark:text-gray-600">—</span>;
        }
        
        return (
            <div className="flex flex-col text-[10px] leading-snug">
                {timeSummary.formattedInTime && (
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-slate-400 mr-0.5">In:</span> {timeSummary.formattedInTime}
                    </span>
                )}
                {timeSummary.formattedOutTime && (
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-slate-400 mr-0.5">Out:</span> {timeSummary.formattedOutTime}
                    </span>
                )}
                {timeSummary.status === 'in_progress' && (
                    <span className="text-amber-600 dark:text-amber-400 font-extrabold text-[9px] uppercase animate-pulse">
                        Active On Site
                    </span>
                )}
                {timeSummary.formattedDuration && (
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[9px]">
                        {timeSummary.formattedDuration}
                    </span>
                )}
            </div>
        );
    };

    const renderJobDocuments = (job: Job) => {
        const docs = [];
        
        // 1. Job History Record badge
        docs.push(
            <button 
                key="job-rec"
                type="button"
                onClick={() => setSelectedJobForModal(job)}
                title="View Job History Record"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-750 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
            >
                <Wrench size={10} className="shrink-0" />
                <span className="text-[9px] font-bold">Job</span>
            </button>
        );

        // 2. Proposal badges (supporting multiple)
        const relatedProps = (state.proposals || []).filter((p: any) => 
            p.id === job.proposalId || 
            p.id === job.projectId || 
            job.linkedProposalIds?.includes(p.id) || 
            p.linkedJobIds?.includes(job.id)
        );

        if (relatedProps.length === 0 && (job.proposalId || job.projectId)) {
            const fallbackId = job.proposalId || job.projectId || '';
            docs.push(
                <a 
                    key={`prop-fallback-${fallbackId}`}
                    href={`/#/proposal-view/${fallbackId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="View Proposal"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors"
                >
                    <FileText size={10} />
                    <span className="text-[9px] font-bold">Prop</span>
                </a>
            );
        } else {
            relatedProps.forEach((p: any, idx: number) => {
                const badgeLabel = relatedProps.length > 1 ? `Prop ${idx + 1}` : 'Prop';
                docs.push(
                    <a 
                        key={`prop-${p.id}`}
                        href={`/#/proposal-view/${p.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={p.title || `View Proposal #${p.proposalNumber || p.id}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors"
                    >
                        <FileText size={10} />
                        <span className="text-[9px] font-bold">{badgeLabel}</span>
                    </a>
                );
            });
        }

        // 3. Invoice badges (supporting multiple linked jobs/invoices)
        const isRealInvoiceObj = (inv: any) => {
            if (!inv || !inv.id) return false;
            const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
            const hasTotal = (Number(inv.totalAmount) || Number(inv.amount) || Number(inv.subtotal) || 0) > 0;
            const isPaidOrSent = inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Partially Paid';
            return hasItems || hasTotal || isPaidOrSent;
        };

        const rawRelatedJobs = (state.jobs || []).filter((j: any) => 
            (j.id === job.id || 
             job.linkedJobIds?.includes(j.id) || 
             j.linkedJobIds?.includes(job.id) || 
             (j.invoice && job.linkedInvoiceIds?.includes(j.invoice.id))) && 
            isRealInvoiceObj(j.invoice)
        );

        // Deduplicate related jobs by invoice ID
        const seenInvIds = new Set<string>();
        const relatedJobs: any[] = [];
        for (const rj of rawRelatedJobs) {
            const invId = rj.invoice.id;
            if (!seenInvIds.has(invId)) {
                seenInvIds.add(invId);
                relatedJobs.push(rj);
            }
        }

        if (relatedJobs.length === 0 && isRealInvoiceObj(job.invoice)) {
            docs.push(
                <button 
                    key={`inv-fallback-${job.id}`}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingInvoiceJobId(job.id); }}
                    title="Manage / View Invoice"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                    <FileText size={10} />
                    <span className="text-[9px] font-bold">Inv</span>
                </button>
            );
        } else {
            relatedJobs.forEach((rj: any, idx: number) => {
                const badgeLabel = relatedJobs.length > 1 ? `Inv ${idx + 1}` : 'Inv';
                const dateStr = rj.appointmentTime ? new Date(rj.appointmentTime).toLocaleDateString() : '';
                docs.push(
                    <button 
                        key={`inv-${rj.id}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingInvoiceJobId(rj.id); }}
                        title={`Manage / View Invoice for Job ${rj.id.slice(0, 8)} ${dateStr ? `on ${dateStr}` : ''}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                        <FileText size={10} />
                        <span className="text-[9px] font-bold">{badgeLabel}</span>
                    </button>
                );
            });
        }

        // 3.5 Signature / Receipt badge
        const inv = job.invoice as any;
        if (inv?.signatureUrl || inv?.customerSignature || (job as any).signatureUrl) {
            const sigUrl = inv?.signatureUrl || inv?.customerSignature || (job as any).signatureUrl;
            docs.push(
                <a 
                    key="sig"
                    href={sigUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="View Signature/Receipt"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors"
                >
                    <FileCheck size={10} />
                    <span className="text-[9px] font-bold">Sig</span>
                </a>
            );
        }

        // 4. Non-image Files & Receipts
        if (job.files && job.files.length > 0) {
            job.files.forEach((file: any, fIdx) => {
                const fileName = file.name || file.fileName || '';
                const mimeType = file.type || file.mimeType || file.fileType || '';
                const fileUrl = file.url || file.dataUrl || '';
                
                // Exclude photos/images and internal expense/vendor receipts
                const isImage = mimeType.startsWith('image/') || 
                                /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);
                if (isImage || isInternalExpenseFile(file)) return;

                // Skip files without a valid URL
                if (!fileUrl) return;

                const displayName = fileName || `File ${fIdx + 1}`;
                docs.push(
                    <a 
                        key={`file-${fIdx}`}
                        href={fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={displayName}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors truncate max-w-[70px]"
                    >
                        <Paperclip size={10} className="shrink-0" />
                        <span className="text-[9px] font-medium truncate">{displayName}</span>
                    </a>
                );
            });
        }

        if (docs.length === 0) return <span className="text-gray-400 dark:text-gray-600">—</span>;

        return <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">{docs}</div>;
    };

    

        const handleEmailStatement = async () => {
        const emailTarget = customer.billingContact?.email || customer.email;
        if (!emailTarget) {
            showToast.warn("This customer has no billing email address on file.");
            return;
        }

        const org = state.currentOrganization;
        const orgName = org?.name || 'Service Provider';
        const orgPhone = org?.phone || '';
        const orgEmail = org?.email || '';
        const orgAddress = org?.address ? `${org.address.street || ''}, ${org.address.city || ''}, ${org.address.state || ''} ${org.address.zip || ''}` : '';
        const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
        const licenseNumber = org?.licenseNumber || org?.taxId || (isTekAir ? 'TACLA73240E' : '');
        const orgLogo = org?.letterheadDataUrl || org?.logoUrl || '';
        
        if (!await globalConfirm(`Send Statement of Account directly to ${emailTarget}?`)) return;

        try {
            // Format date range & filter out any cancelled / void entries
            const filteredJobs = statementJobs.filter(tx => !isJobCancelledOrVoid(tx.job) && (tx.total > 0 || (Array.isArray(tx.invoice?.items) && tx.invoice.items.length > 0)));
            const dates = filteredJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
            const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
            const statementPeriod = `${minDate} - ${maxDate}`;
            const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

            // Generate official branded vector PDF attachment
            const { attachment } = await generateStatementOfAccountPdfAttachment({
                customer,
                org,
                statementJobs: filteredJobs,
                statementTotals,
                statementPeriod,
                statementNumber
            });

            const invoiceRows = filteredJobs.map((tx, idx) => {
                const j = tx.job;
                const inv = tx.invoice;
                const t = tx.total;
                const p = tx.paid;
                const d = tx.balance;
                const rb = tx.runningBalance;
                const addressStr = typeof j.address === 'string' ? j.address : `${(j.address as any)?.street || ''}, ${(j.address as any)?.city || ''}`;
                const zebraColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                const statusStyle = inv.status === 'Paid' 
                    ? 'color: #15803d; background-color: #f0fdf4; border: 1px solid #bbf7d0;' 
                    : 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;';
                
                return `
                    <tr style="background-color: ${zebraColor};">
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${new Date(j.appointmentTime || j.createdAt || '').toLocaleDateString()}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">#${inv.id || j.id.slice(0, 8)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                            <strong>${j.locationName || j.customerName || 'Main Address'}</strong><br/>
                            <span style="font-size: 10px; color: #64748b;">${addressStr}</span>
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${j.poNumber || '—'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">$${t.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">$${p.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${d > 0.01 ? '#dc2626' : '#1e293b'};">$${d.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">$${rb.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
                            <span style="display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                                ${inv.status || 'Unpaid'}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

            const mailPayload = {
                to: [emailTarget.trim().toLowerCase()],
                attachments: [attachment],
                message: {
                    subject: `Statement of Account: ${customer.name} - ${statementNumber}`,
                    attachments: [attachment],
                    html: `
                        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; line-height: 1.5; background-color: #ffffff;">
                            
                            <!-- Header Section -->
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                <tr>
                                    <td>
                                        ${orgLogo ? `<img src="${orgLogo}" style="max-height: 48px; max-width: 180px; margin-bottom: 8px; object-fit: contain;" alt="${orgName}"/><br/>` : ''}
                                        <h2 style="font-size: 22px; font-weight: 800; color: #123A63; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Statement of Account</h2>
                                        <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString()} | Statement #: ${statementNumber}</p>
                                    </td>
                                    <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                        <strong style="font-size: 13px; color: #1e293b;">${orgName}</strong><br/>
                                        ${orgAddress}<br/>
                                        Phone: ${orgPhone} | Email: ${orgEmail}<br/>
                                        ${licenseNumber ? `<span style="font-weight: bold; color: #123A63;">License #: ${licenseNumber}</span>` : ''}
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="border-bottom: 2px solid #123A63; margin-bottom: 20px;"></div>

                            <!-- Customer & Terms -->
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                <tr>
                                    <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                                        <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Client Information</div>
                                        <p style="margin: 2px 0;"><strong>${customer.name}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">${customer.address}</p>
                                    </td>
                                    <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                                        <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Account Summary & Terms</div>
                                        <p style="margin: 2px 0; color: #334155;">Client Code: <strong>${customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">Account Number: <strong>${customer.accountNumber || getOrGenerateAccountNumber(customer)}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">Payment Terms: <strong>${(customer.paymentTerms || 'Net 30').replace(/_/g, ' ').toUpperCase()}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">Statement Period: <strong>${statementPeriod}</strong></p>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #334155; margin-bottom: 12px;">Dear Finance Team,</p>
                            <p style="color: #334155; margin-bottom: 20px;">Please find below the corporate Statement of Account for <strong>${customer.name}</strong> summarizing all recent service invoices, payments, and outstanding balances. An official branded vector PDF is attached to this email for your accounting records.</p>

                            <!-- Financial Summary -->
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
                                <tr>
                                    <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Previous Balance</th>
                                    <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">New Charges</th>
                                    <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Payments Received</th>
                                    <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Adjustments</th>
                                    <th style="background-color: #0f2d50; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #0f2d50;">Amount Due</th>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$${statementTotals.totalBilled.toFixed(2)}</td>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">-$${statementTotals.totalPaid.toFixed(2)}</td>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                    <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">$${statementTotals.totalDue.toFixed(2)}</td>
                                </tr>
                            </table>

                            <!-- Transaction Ledger -->
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px;">
                                <thead>
                                    <tr style="background-color: #123A63;">
                                        <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Date</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Invoice #</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Property / Location</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Ref / PO #</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Debit (Dr)</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Credit (Cr)</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Balance</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Running Bal</th>
                                        <th style="color: #ffffff; padding: 8px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoiceRows}
                                </tbody>
                            </table>

                            <!-- Aging Summary -->
                            <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Aging Analysis (Unpaid Balances)</div>
                            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 35px;">
                                <tr>
                                    <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Current</th>
                                    <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">1 - 30 Days</th>
                                    <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">31 - 60 Days</th>
                                    <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">61 - 90 Days</th>
                                    <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">90+ Days</th>
                                    <th style="background-color: #123A63; color: #ffffff; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Total Outstanding</th>
                                </tr>
                                <tr>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1;">$${statementTotals.aging.current.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days30 > 0 ? '#b45309' : '#1e293b'};">$${statementTotals.aging.days30.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days60 > 0 ? '#b45309' : '#1e293b'};">$${statementTotals.aging.days60.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days90 > 0 ? '#dc2626' : '#1e293b'};">$${statementTotals.aging.days90.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.older > 0 ? '#dc2626' : '#1e293b'};">$${statementTotals.aging.older.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #dc2626;">$${statementTotals.totalDue.toFixed(2)}</td>
                                </tr>
                            </table>

                            ${formatPaymentInstructionsHtml(org)}

                            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #64748b;">
                                <strong>Corporate Remittance Support:</strong><br/>
                                Please reference Statement #${statementNumber} on your remittance advice. For inquiries, reply directly to this email or contact <strong>${orgEmail || orgPhone}</strong>.<br/>
                                ${licenseNumber ? `<span style="font-size: 9px; display: block; margin-top: 6px;">STATE LICENSE # ${licenseNumber} — ${orgName}</span>` : ''}
                                <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 6px;">CONFIDENTIALITY DISCLAIMER: This email and any attachments contain confidential proprietary financial information intended solely for the customer named above.</span>
                            </div>
                        </div>
                    `,
                    text: `Statement of Account for ${customer.name}. Total Outstanding Balance: $${statementTotals.totalDue.toFixed(2)}. An official PDF statement is attached.`,
                    replyTo: org?.email,
                },
                senderUser: state.currentUser,
                type: 'Statement'
            };

            await sendEmail(org, mailPayload);
            showToast.success(`Statement email successfully sent to ${emailTarget}`);
        } catch (error) {
            console.error("Email Statement Error:", error);
            showToast.error("Failed to email Statement of Account.");
        }
    };

    const handlePrintQr = () => {
        const printWindow = window.open('', '_blank');
        const qrCanvas = document.getElementById('asset-qr-canvas') as HTMLCanvasElement;
        
        if (printWindow && qrCanvas && viewQrAsset) {
            const qrDataUrl = qrCanvas.toDataURL('image/png');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Asset Tag - ${viewQrAsset.brand}</title>
                        <style>
                            body { font-family: sans-serif; text-align: center; padding: 20px; }
                            .tag { border: 2px solid black; padding: 20px; display: inline-block; border-radius: 10px; }
                            img { width: 200px; height: 200px; }
                            h2 { margin: 10px 0 5px; }
                            p { margin: 0; color: #555; }
                        </style>
                    </head>
                    <body>
                        <div class="tag">
                            <h2>Asset Tag</h2>
                            <img src="${qrDataUrl}" />
                            <h3>${viewQrAsset.brand} ${viewQrAsset.type}</h3>
                            <p>Serial: ${viewQrAsset.serial}</p>
                            <p>${customer.name}</p>
                        </div>
                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleBulkAdHocPMs = async () => {
        if (!customer.serviceLocations || customer.serviceLocations.length === 0) {
            return showToast.warn("This customer has no site properties listed.");
        }
        
        if (!await globalConfirm(`Schedule Maintenance for all ${customer.serviceLocations.length} properties? This will create Ad-Hoc Scheduled Work Orders for each location.`)) return;

        let generatedCount = 0;
        for (const loc of customer.serviceLocations) {
            const techId = (loc as any).preferredTechnicianId || null;
            const tech = techId ? state.users.find((u: any) => u.id === techId) : null;
            const techName = tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned (Queue)';

            const newJobId = `job-adhoc-pm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newJob = {
                id: newJobId,
                organizationId: state.currentOrganization?.id || '',
                customerName: customer.name,
                customerId: customer.id,
                address: loc.address || customer.address,
                locationId: loc.id !== 'default' ? loc.id : null,
                locationName: loc.propertyName || loc.name,
                tasks: ['Preventative Maintenance'],
                jobStatus: 'Scheduled',
                priority: 'Normal',
                appointmentTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Schedule 1 week out
                assignedTechnicianId: techId,
                assignedTechnicianName: techName,
                source: 'AdHoc-Bulk',
                specialInstructions: `Ad-Hoc Bulk Maintenance Request (Non-Membership).`,
                jobEvents: [],
                createdAt: new Date().toISOString(),
                divisionId: state.currentOrganization?.divisions?.[0]?.id || null
            };

            try {
                await db.collection('jobs').doc(newJobId).set(cleanUndefinedFields(newJob));
                generatedCount++;
            } catch (e) {
                console.error("Failed to generate PM:", e);
            }
        }

        if (generatedCount > 0) {
            showToast.success(`Successfully dispatched ${generatedCount} Ad-Hoc PM Work Orders.`);
        } else {
            showToast.error("Failed to generate PM Work Orders.");
        }
    };

    // --- Maintenance Schedule Tab Handlers ---
    const getVisitStatus = (visit: any) => {
        if (!visit.jobId) return visit.status;
        const linkedJob = state.jobs.find((j: any) => j.id === visit.jobId);
        if (!linkedJob) return visit.status;
        if (linkedJob.jobStatus === 'Completed') return 'Completed';
        if (linkedJob.jobStatus === 'Cancelled') return 'Pending';
        
        const todayStr = new Date().toISOString().substring(0, 7);
        if (visit.targetMonth < todayStr) return 'Overdue';
        
        return 'Scheduled';
    };

    const generateMaintenanceVisits = (startDateStr: string, endDateStr: string, frequency: string) => {
        if (!startDateStr || !endDateStr) return [];
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return [];

        let interval = 12;
        if (frequency === 'Monthly') interval = 1;
        else if (frequency === 'Bi-Monthly') interval = 2;
        else if (frequency === 'Quarterly') interval = 3;
        else if (frequency === 'Semi-Annually') interval = 6;
        else if (frequency === 'Annually') interval = 12;

        const visitsList: any[] = [];
        let current = new Date(start);
        let index = 1;

        while (current < end) {
            const year = current.getFullYear();
            const monthNum = current.getMonth() + 1;
            const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
            const targetMonth = `${year}-${monthStr}`;

            visitsList.push({
                id: `visit-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                targetMonth,
                status: 'Pending',
                notes: `Scheduled visit #${index}`
            });

            current.setMonth(current.getMonth() + interval);
            index++;
            if (interval <= 0) break;
        }

        return visitsList;
    };

    const handleSaveAgreement = async () => {
        let finalVisits = agreementFormData.visits || [];
        if (finalVisits.length === 0) {
            finalVisits = generateMaintenanceVisits(agreementFormData.startDate, agreementFormData.endDate, agreementFormData.frequency);
        }

        const newAgreement = {
            ...agreementFormData,
            id: customer.maintenanceAgreement?.id || `maint-ag-${Date.now()}`,
            visits: finalVisits
        };

        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: newAgreement
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: newAgreement } });
            showToast.success("Maintenance Agreement saved successfully.");
            setIsEditingAgreement(false);
        } catch (e: any) {
            console.error(e);
            showToast.error(`Failed to save agreement: ${e.message}`);
        }
    };

    const handleGenerateNewSchedule = () => {
        const generated = generateMaintenanceVisits(agreementFormData.startDate, agreementFormData.endDate, agreementFormData.frequency);
        setAgreementFormData((prev: any) => ({
            ...prev,
            visits: generated
        }));
        showToast.success(`Generated ${generated.length} visit slots based on frequency.`);
    };

    const handleAddManualVisit = async () => {
        const agreement = customer.maintenanceAgreement;
        if (!agreement) return;

        const defaultMonth = new Date().toISOString().substring(0, 7);
        const newVisit = {
            id: `visit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            targetMonth: defaultMonth,
            status: 'Pending',
            notes: 'Custom visit inspection'
        };

        const updatedAgreement = {
            ...agreement,
            visits: [...agreement.visits, newVisit]
        };

        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: updatedAgreement
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });
            showToast.success("Custom visit added.");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to add visit.");
        }
    };

    const handleDeleteVisit = async (visitId: string) => {
        const agreement = customer.maintenanceAgreement;
        if (!agreement) return;

        if (!await globalConfirm("Remove this scheduled visit slot?")) return;

        const updatedAgreement = {
            ...agreement,
            visits: agreement.visits.filter((v: any) => v.id !== visitId)
        };

        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: updatedAgreement
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });
            showToast.success("Visit slot removed.");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to remove visit.");
        }
    };

    const handleDispatchVisitJob = async (visitId: string, techId: string) => {
        const agreement = customer.maintenanceAgreement;
        if (!agreement) return;

        const visitIndex = agreement.visits.findIndex((v: any) => v.id === visitId);
        if (visitIndex === -1) return;
        const visit = agreement.visits[visitIndex];

        const tech = techId ? state.users.find((u: any) => u.id === techId) : null;
        const techName = tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned (Queue)';

        const newJobId = `job-maint-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const coveredAssets = (customer.equipment || []).filter((eq: any) => 
            agreement.coveredEquipmentIds.includes(eq.id)
        );

        const firstLocation = coveredAssets[0]?.locationId || 'default';
        const loc = (customer.serviceLocations || []).find((l: any) => l.id === firstLocation) || { id: 'default', address: customer.address, propertyName: 'Main Site', name: 'Main Site' };

        const targetDateStr = `${visit.targetMonth}-15`;

        const newJob: Job = {
            id: newJobId,
            organizationId: state.currentOrganization?.id || '',
            customerName: customer.name,
            customerId: customer.id,
            address: loc.address || customer.address,
            locationId: loc.id !== 'default' ? loc.id : null,
            locationName: loc.propertyName || loc.name || null,
            tasks: ['Preventative Maintenance'],
            jobStatus: 'Scheduled',
            appointmentTime: new Date(targetDateStr).toISOString(),
            assignedTechnicianId: techId || null,
            assignedTechnicianName: techName,
            source: 'MaintenanceAgreement',
            specialInstructions: `Preventative Maintenance visit for agreement "${agreement.agreementName}".\nCovered Units:\n${coveredAssets.map(a => `- ${a.brand} ${a.type} (S/N: ${a.serial}, Loc: ${a.physicalLocation || 'N/A'})`).join('\n')}\nNotes: ${agreement.notes || ''}`,
            jobEvents: [],
            createdAt: new Date().toISOString(),
            divisionId: state.currentOrganization?.divisions?.[0]?.id || null
        } as any;

        try {
            await db.collection('jobs').doc(newJobId).set(cleanUndefinedFields(newJob));
            dispatch({ type: 'ADD_JOB', payload: newJob });

            const updatedVisits = agreement.visits.map((v: any) => {
                if (v.id === visitId) {
                    return {
                        ...v,
                        status: 'Scheduled',
                        jobId: newJobId,
                        assignedTechId: techId || undefined,
                        assignedTechName: techName || undefined,
                        targetDate: targetDateStr
                    };
                }
                return v;
            });

            const updatedAgreement = {
                ...agreement,
                visits: updatedVisits
            };

            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: updatedAgreement
            }));

            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });
            showToast.success(`Job dispatched successfully for ${visit.targetMonth}!`);
        } catch (e: any) {
            console.error(e);
            showToast.error(`Failed to dispatch job: ${e.message}`);
        }
    };

    const handleLinkExistingJob = async (visitId: string, jobId: string) => {
        const agreement = customer.maintenanceAgreement;
        if (!agreement || !jobId) return;

        const linkedJob = state.jobs.find((j: any) => j.id === jobId);
        if (!linkedJob) return;

        const updatedVisits = agreement.visits.map((v: any) => {
            if (v.id === visitId) {
                return {
                    ...v,
                    status: linkedJob.jobStatus === 'Completed' ? 'Completed' : 'Scheduled',
                    jobId: linkedJob.id,
                    assignedTechId: linkedJob.assignedTechnicianId || undefined,
                    assignedTechName: linkedJob.assignedTechnicianName || undefined,
                    targetDate: linkedJob.appointmentTime?.split('T')[0] || undefined
                };
            }
            return v;
        });

        const updatedAgreement = {
            ...agreement,
            visits: updatedVisits
        };

        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: updatedAgreement
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });
            showToast.success("Job linked successfully.");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to link job.");
        }
    };

    const handleSendNotification = async (visitId: string) => {
        if (!customer.email) {
            showToast.error("Customer has no email registered.");
            return;
        }

        const visit = customer.maintenanceAgreement?.visits?.find((v: any) => v.id === visitId);
        if (!visit) return;

        setIsSendingNotification(true);

        const emailSubject = notificationTemplate === 'reminder'
            ? `Upcoming Preventative Maintenance Reminder - ${customer.name}`
            : `Action Required: Scheduled Maintenance Overdue - ${customer.name}`;

        const coveredAssets = (customer.equipment || []).filter((eq: any) => 
            customer.maintenanceAgreement?.coveredEquipmentIds?.includes(eq.id)
        );

        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 20px;">Maintenance Notification</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.8;">${state.currentOrganization?.name || 'TekTrakker Services'}</p>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.6;">
                    <p>Dear ${customer.name},</p>
                    
                    ${notificationTemplate === 'reminder' 
                        ? `<p>This is a friendly reminder that your upcoming preventative maintenance service is scheduled for the month of <strong>${visit.targetMonth}</strong> under your agreement <strong>"${customer.maintenanceAgreement.agreementName}"</strong>.</p>`
                        : `<p>We noticed that your scheduled preventative maintenance service for <strong>${visit.targetMonth}</strong> is currently overdue under your agreement <strong>"${customer.maintenanceAgreement.agreementName}"</strong>.</p>`
                    }
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px;">Agreement Highlights</h4>
                        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; font-weight: bold; width: 40%;">Billing Cycle:</td>
                                <td style="padding: 4px 0;">${customer.maintenanceAgreement.billingFrequency}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; font-weight: bold;">Payment Terms:</td>
                                <td style="padding: 4px 0;">${customer.maintenanceAgreement.paymentTerms.replace('_', ' ').toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; font-weight: bold;">Service Interval:</td>
                                <td style="padding: 4px 0;">${customer.maintenanceAgreement.frequency}</td>
                            </tr>
                        </table>
                    </div>

                    <h4 style="color: #0f172a; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Covered Equipment (${coveredAssets.length} Units)</h4>
                    <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
                        ${coveredAssets.map(a => `
                            <li style="margin-bottom: 8px;">
                                <strong>${a.type}</strong> - ${a.brand} (${a.model})<br/>
                                <span style="color: #64748b; font-size: 12px;">S/N: ${a.serial} | Loc: ${a.physicalLocation || 'N/A'}</span>
                            </li>
                        `).join('')}
                    </ul>

                    <p style="margin-top: 24px;">Our office will contact you soon to finalize the exact date and dispatch a technician. If you have any scheduling constraints, please reply directly to this email or call our desk.</p>
                    
                    <p style="margin-top: 32px; font-weight: bold; color: #0f172a;">Best Regards,</p>
                    <p style="margin: 0;">Service Dispatch Team</p>
                    <p style="margin: 0; color: #64748b; font-size: 13px;">${state.currentOrganization?.name || 'TekTrakker Services'}</p>
                </div>
                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; font-size: 11px; color: #94a3b8;">
                    This email was sent to ${customer.email} regarding your Commercial Maintenance Agreement.
                </div>
            </div>
        `;

        try {
            await sendEmail(state.currentOrganization, {
                to: customer.email,
                message: {
                    subject: emailSubject,
                    html: emailHtml
                }
            });

            const msgId = `msg-noti-${Date.now()}`;
            const logEntry: any = {
                id: msgId,
                organizationId: state.currentOrganization?.id || '',
                senderId: state.currentUser?.id || 'system',
                senderName: 'System Maintenance Desk',
                receiverId: customer.email,
                customerId: customer.id,
                content: `[Maintenance Notice Sent via Email]\nSubject: ${emailSubject}\nRecipient: ${customer.email}\nVisit Month: ${visit.targetMonth}`,
                type: 'email',
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                read: true
            };

            await db.collection('messages').doc(msgId).set(cleanUndefinedFields(logEntry));
            dispatch({ type: 'MERGE_MESSAGES', payload: [logEntry] });

            const updatedNotifications = [
                ...(customer.maintenanceAgreement.notificationsSent || []),
                {
                    sentAt: new Date().toISOString(),
                    type: 'Email' as const,
                    recipient: customer.email,
                    visitId
                }
            ];

            const updatedAgreement = {
                ...customer.maintenanceAgreement,
                notificationsSent: updatedNotifications
            };

            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: updatedAgreement
            }));

            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });

            showToast.success(`Maintenance notice sent successfully to ${customer.email}!`);
            setSelectedVisitForNotification(null);
        } catch (e: any) {
            console.error(e);
            showToast.error(`Failed to send notice: ${e.message}`);
        } finally {
            setIsSendingNotification(false);
        }
    };

    const handlePrintAgreement = () => {
        const agreement = customer.maintenanceAgreement;
        if (!agreement) return;

        const coveredAssets = (customer.equipment || []).filter((eq: any) => 
            agreement.coveredEquipmentIds.includes(eq.id)
        );

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Commercial Maintenance Agreement - ${agreement.agreementName}</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
                            .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                            .header h1 { margin: 0; font-size: 28px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
                            .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold; }
                            .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 30px 0 15px 0; }
                            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                            .info-block h4 { margin: 0 0 6px 0; color: #64748b; font-size: 12px; text-transform: uppercase; }
                            .info-block p { margin: 0; font-size: 14px; font-weight: 500; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                            th { background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold; color: #475569; }
                            td { border-bottom: 1px solid #e2e8f0; padding: 10px; }
                            .covered-items { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
                            .item-badge { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 12px; font-weight: 500; }
                            .signatures { display: grid; grid-template-cols: 1fr 1fr; gap: 60px; margin-top: 60px; }
                            .sig-line { border-top: 1px solid #94a3b8; margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; padding-top: 8px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Commercial Maintenance Agreement</h1>
                            <p>${state.currentOrganization?.name || 'TekTrakker Services'} &bull; ${state.currentOrganization?.phone || 'Dispatch Desk'}</p>
                        </div>
                        
                        <div class="grid">
                            <div>
                                <div class="section-title">Client Information</div>
                                <div class="info-block">
                                    <h4>Client Name</h4>
                                    <p>${customer.name}</p>
                                    <h4 style="margin-top:12px;">Service Address</h4>
                                    <p>${customer.address}</p>
                                    <h4 style="margin-top:12px;">Contact Info</h4>
                                    <p>${customer.email} &bull; ${customer.phone}</p>
                                </div>
                            </div>
                            <div>
                                <div class="section-title">Agreement Specifications</div>
                                <div class="info-block">
                                    <h4>Agreement Title</h4>
                                    <p>${agreement.agreementName} (Status: ${agreement.status})</p>
                                    <h4 style="margin-top:12px;">Contract Term</h4>
                                    <p>${agreement.startDate} to ${agreement.endDate}</p>
                                    <h4 style="margin-top:12px;">Contract Value & Terms</h4>
                                    <p>$${agreement.value.toFixed(2)} (${agreement.billingFrequency} Billing / ${agreement.paymentTerms.replace('_', ' ').toUpperCase()})</p>
                                </div>
                            </div>
                        </div>

                        <div class="section-title">Agreed Covered Items</div>
                        <div class="covered-items">
                            ${agreement.coveredItems.map((item: string) => `<span class="item-badge">&check; ${item}</span>`).join('')}
                        </div>

                        <div class="section-title">Covered Systems & Assets (${coveredAssets.length})</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Equipment Unit</th>
                                    <th>Brand / Model</th>
                                    <th>Serial Number</th>
                                    <th>Physical Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${coveredAssets.map(a => `
                                    <tr>
                                        <td><strong>${a.type}</strong></td>
                                        <td>${a.brand} / ${a.model}</td>
                                        <td style="font-family: monospace;">${a.serial}</td>
                                        <td>${a.physicalLocation || 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div class="section-title">Maintenance Service Visits Schedule</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Visit Slot</th>
                                    <th>Target Month</th>
                                    <th>Assigned Technician</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${agreement.visits.map((v: any, i: number) => `
                                    <tr>
                                        <td>Visit #${i + 1}</td>
                                        <td><strong>${v.targetMonth}</strong></td>
                                        <td>${v.assignedTechName || 'TBD'}</td>
                                        <td>${v.jobId ? 'DISPATCHED (Job #' + v.jobId.slice(0,8) + ')' : 'PENDING SCHEDULE'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div class="section-title">Special Instructions / Notes</div>
                        <p style="font-size: 13px; color: #475569; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                            ${agreement.notes || 'No special terms or annotations provided.'}
                        </p>

                        <div class="signatures">
                            <div>
                                <div class="sig-line">
                                    Authorized Client Representative Signature
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:8px; color:#64748b;">
                                    <span>Print Name: _________________</span>
                                    <span>Date: ____________</span>
                                </div>
                            </div>
                            <div>
                                <div class="sig-line">
                                    Authorized ${state.currentOrganization?.name || 'TekTrakker Services'} Representative Signature
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:8px; color:#64748b;">
                                    <span>Print Name: _________________</span>
                                    <span>Date: ____________</span>
                                </div>
                            </div>
                        </div>

                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleDeleteAgreement = async () => {
        if (!await globalConfirm("Are you sure you want to completely delete this Maintenance Agreement and all visit logs? This cannot be undone.")) return;

        try {
            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                maintenanceAgreement: firebase.firestore.FieldValue.delete()
            }));
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: null } });
            showToast.success("Maintenance Agreement deleted.");
            setIsEditingAgreement(false);
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to delete agreement.");
        }
    };
    // --- End Maintenance Schedule Tab States & Handlers ---

    const handleCopyRef = () => {
        navigator.clipboard.writeText(`#CUST-${customer.id}`);
        showToast.success("Customer reference copied!");
    };

    const handleShareCustomer = async () => {
        if (!shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this customer: #CUST-${customer.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.warn("Customer record shared successfully!");
            setShareModalOpen(false);
            setShareMessageText('');
        } catch (err) {
            console.error(err);
            showToast.warn("Failed to share.");
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <>
            <Modal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} title={`Share Customer: ${customer.name}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">Send this customer record to a staff member.</p>
                     <select 
                         aria-label="Select Share Recipient"
                         title="Select Share Recipient"
                         className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">Select Recipient...</option>
                         {state.users.filter((u: any) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: any) => (
                             <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                         ))}
                     </select>
                     <Textarea 
                         placeholder="Add an optional message..."
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalOpen(false)}>Cancel</Button>
                         <Button onClick={handleShareCustomer} disabled={!shareTargetId || isSharing}>
                             {isSharing ? 'Sending...' : 'Send Message'}
                         </Button>
                     </div>
                 </div>
             </Modal>
            <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
                {/* Custom Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-6">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                            <span className="truncate">{customer.name}</span>
                            {membership && (
                                <span className={`px-2 py-0.5 text-xs rounded-full font-bold shrink-0 ${
                                    isRecurringMembership(membership) 
                                        ? 'bg-yellow-100 text-yellow-800' 
                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                                }`}>
                                    {isRecurringMembership(membership) ? (membership.planName || 'Member') : 'Commercial Contract'}
                                </span>
                            )}
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                            {customer.address}
                            {customer.city && `, ${customer.city}`}
                            {customer.state && `, ${customer.state}`}
                            {customer.zip && ` ${customer.zip}`}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center justify-end shrink-0">
                        <Button onClick={handleCopyRef} variant="secondary" aria-label="Copy Reference" title="Copy Reference" className="text-xs p-2 shrink-0 cursor-pointer">
                            <Copy size={14} />
                        </Button>
                        <Button onClick={() => setShareModalOpen(true)} variant="secondary" aria-label="Share Customer" title="Share Customer" className="text-xs p-2 shrink-0 cursor-pointer">
                            <Share2 size={14} />
                        </Button>
                        <Button onClick={handleSendInvite} disabled={isSendingInvite} variant="secondary" className="text-xs flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer">
                            <Mail size={14} /> <span>{isSendingInvite ? 'Sending...' : 'Send Portal Invite'}</span>
                        </Button>
                        <Button onClick={handleDeleteCustomer} className="bg-red-700 text-white hover:bg-red-800 text-xs font-bold shadow-md border-none shrink-0 cursor-pointer">Delete</Button>
                    </div>
                </div>

                {/* Tab Navigation Breadcrumb */}
                {activeTab !== 'overview' && (
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-700">
                        <button 
                            type="button" 
                            onClick={() => setActiveTab('overview')} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
                        >
                            <ArrowLeft size={14} /> Back to Overview Hub
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {customer.name}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                            <span className="text-xs font-extrabold text-[#123A63] dark:text-sky-400 uppercase tracking-wider bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800">
                                {activeTab === 'financials' ? 'Statement & Financials' :
                                 activeTab === 'equipment' ? 'Equipment & Assets' :
                                 activeTab === 'history' ? 'Service History' :
                                 activeTab === 'maintenance' ? 'Maintenance Schedule' :
                                 activeTab === 'warranties' ? 'Warranties' :
                                 activeTab === 'docs' ? 'Document Drive' :
                                 activeTab === 'communications' ? 'Communications Log' : 'Details'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 min-h-[60vh] custom-scrollbar p-1 pb-8">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Management & Operations Hub Tiles */}
                            <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#123A63] dark:text-sky-400 flex items-center gap-1.5">
                                        <LayoutGrid size={14} />
                                        Customer Management Modules
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Direct Access</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Statement of Account */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('financials')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 group-hover:scale-110 transition-transform">
                                                <DollarSign size={16} />
                                            </span>
                                            {statementTotals.totalDue > 0 ? (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                                                    ${statementTotals.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                                            Statement &amp; Financials
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            {statementJobs.length} Invoices &bull; Ledger
                                        </div>
                                    </button>

                                    {/* Equipment */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('equipment')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 group-hover:scale-110 transition-transform">
                                                <Wrench size={16} />
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {(customer.equipment || []).length}
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                                            Equipment &amp; Assets
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Manage units &amp; systems
                                        </div>
                                    </button>

                                    {/* Service History */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('history')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 group-hover:scale-110 transition-transform">
                                                <FileText size={16} />
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {customerJobs.length}
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                                            Service History
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Jobs &amp; Work Orders
                                        </div>
                                    </button>

                                    {/* Maintenance Schedule */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('maintenance')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 group-hover:scale-110 transition-transform">
                                                <Calendar size={16} />
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                                            Maintenance Schedule
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Inspection agreements
                                        </div>
                                    </button>

                                    {/* Warranties */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('warranties')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 group-hover:scale-110 transition-transform">
                                                <ShieldCheck size={16} />
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                                            Warranties
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Coverage &amp; certs
                                        </div>
                                    </button>

                                    {/* Document Drive */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('docs')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 group-hover:scale-110 transition-transform">
                                                <HardDrive size={16} />
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {(customer.files || []).length + customerJobs.reduce((acc, j) => acc + (j.files?.length || 0), 0)}
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                                            Document Drive
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Cloud files &amp; blueprints
                                        </div>
                                    </button>

                                    {/* Communications Log */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('communications')}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-md transition-all text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 group-hover:scale-110 transition-transform">
                                                <MessageSquare size={16} />
                                            </span>
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                                            Communications
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Call, SMS &amp; email logs
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Contact Details</h3>
                                    <button onClick={() => { 
                                        if (!isEditing && customer) {
                                            const terms = customer.paymentTerms || 'net_30';
                                            const isStandard = ['due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'].includes(terms);
                                            setFormData({
                                                ...customer,
                                                paymentTerms: isStandard ? terms : 'custom',
                                                paymentTermsDays: isStandard ? undefined : (terms.startsWith('net_') ? parseInt(terms.replace('net_', ''), 10) : parseInt(terms, 10))
                                            } as any);
                                        } else {
                                            setFormData({});
                                        }
                                        setIsEditing(!isEditing); 
                                    }} className="text-xs text-primary-600 hover:underline">
                                        {isEditing ? 'Cancel' : 'Edit'}
                                    </button>
                                </div>
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <Input label="Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                        <Input label="Account Number" value={formData.accountNumber || ''} onChange={e => setFormData({...formData, accountNumber: e.target.value})} placeholder="e.g. ACT-1001" />
                                        <Select 
                                            label="Customer Type" 
                                            value={formData.customerType || 'Residential'} 
                                            onChange={e => setFormData({...formData, customerType: e.target.value as any})}
                                        >
                                            <option value="Residential">Residential</option>
                                            <option value="Commercial">Commercial</option>
                                            <option value="Property Management">Property Management</option>
                                        </Select>
                                        <Select 
                                            label="Payment Terms" 
                                            value={formData.paymentTerms || 'net_30'} 
                                            onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                                        >
                                            <option value="due_on_receipt">Due on Receipt</option>
                                            <option value="net_7">Net 7</option>
                                            <option value="net_15">Net 15</option>
                                            <option value="net_30">Net 30</option>
                                            <option value="net_45">Net 45</option>
                                            <option value="net_60">Net 60</option>
                                            <option value="net_90">Net 90</option>
                                            <option value="custom">Custom (Days)</option>
                                        </Select>
                                        {formData.paymentTerms === 'custom' && (
                                            <Input
                                                label="Custom Terms (Days)"
                                                type="number"
                                                value={(formData as any).paymentTermsDays || ''}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    paymentTermsDays: e.target.value ? parseInt(e.target.value, 10) : undefined
                                                } as any)}
                                                placeholder="e.g. 45"
                                            />
                                        )}
                                        <Input label="Email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                                        <Input label="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                        
                                        {(formData.customerType === 'Commercial' || formData.customerType === 'Property Management' || formData.vendorCompliance?.vendorStatus || formData.vendorCompliance?.vendorNumber) && (
                                            <div className="bg-purple-50/60 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-2.5">
                                                <p className="text-xs font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider flex items-center gap-1.5">
                                                    <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400" />
                                                    <span>Vendor Status &amp; Compliance</span>
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <Input 
                                                        label="Vendor Status" 
                                                        value={formData.vendorCompliance?.vendorStatus || ''} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            vendorCompliance: { 
                                                                ...(formData.vendorCompliance || {}), 
                                                                vendorStatus: e.target.value 
                                                            } 
                                                        })} 
                                                        placeholder="e.g. Temporary Vendor, Active" 
                                                    />
                                                    <Input 
                                                        label="Vendor Number" 
                                                        value={formData.vendorCompliance?.vendorNumber || ''} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            vendorCompliance: { 
                                                                ...(formData.vendorCompliance || {}), 
                                                                vendorNumber: e.target.value 
                                                            } 
                                                        })} 
                                                        placeholder="e.g. To be assigned or VEND-9921" 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 space-y-3">
                                            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                                Pricing &amp; Contract Rates
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <Input 
                                                    label="Contracted Rate ($/hr)" 
                                                    type="number" 
                                                    value={formData.pricingRules?.contractedRate ?? formData.pricingRules?.standardRate ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                contractedRate: val,
                                                                standardRate: val
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. 85.00"
                                                />
                                                <Input 
                                                    label="Overtime Labor Rate ($/hr)" 
                                                    type="number" 
                                                    value={formData.pricingRules?.overtimeRate ?? formData.pricingRules?.overtimeLaborRate ?? formData.pricingRules?.overtimeContractedRate ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                overtimeRate: val,
                                                                overtimeLaborRate: val,
                                                                overtimeContractedRate: val
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. 125.00"
                                                />
                                                <Input 
                                                    label="Emergency Contracted Rate ($/hr)" 
                                                    type="number" 
                                                    value={formData.pricingRules?.emergencyContractedRate ?? formData.pricingRules?.emergencyRate ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                emergencyContractedRate: val,
                                                                emergencyRate: val
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. 150.00"
                                                />
                                                <Input 
                                                    label="Trip Fee ($)" 
                                                    type="number" 
                                                    value={formData.pricingRules?.tripFee ?? formData.pricingRules?.tripCharge ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                tripFee: val,
                                                                tripCharge: val
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. 75.00"
                                                />
                                                <Input 
                                                    label="Emergency Trip Charge ($)" 
                                                    type="number" 
                                                    value={formData.pricingRules?.emergencyTripFee ?? formData.pricingRules?.emergencyTripCharge ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                emergencyTripFee: val,
                                                                emergencyTripCharge: val
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. 125.00"
                                                />
                                                <Input 
                                                    label="Travel Time Rule" 
                                                    value={formData.pricingRules?.travelTime ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setFormData({
                                                            ...formData,
                                                            pricingRules: {
                                                                ...(formData.pricingRules || {}),
                                                                travelTime: val,
                                                                travelIncluded: typeof val === 'string' ? val.toLowerCase().includes('included') : false
                                                            }
                                                        });
                                                    }}
                                                    placeholder="e.g. Included or $65/hr"
                                                />
                                                <div className="sm:col-span-2 space-y-3 pt-2">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-750">
                                                        <div>
                                                            <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                                                <Percent size={14} className="text-amber-500" />
                                                                <span>Custom Parts Markup &amp; Tiered Rules</span>
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                                Configure conditional markup rules by part cost (e.g. Under $1,500 &rarr; 43%, Over $1,500 &rarr; 23%), or set a flat fallback rate.
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddMarkupRule}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                                                        >
                                                            <PlusCircle size={14} />
                                                            <span>Add Rule</span>
                                                        </button>
                                                    </div>

                                                    {/* Tiered Rules Dynamic List */}
                                                    {(() => {
                                                        const activeMarkupRules: CustomerMarkupRule[] = formData.pricingRules?.partsMarkupRules || (
                                                            (formData.pricingRules?.partsMarkupTier1 || formData.pricingRules?.partsMarkupTier2) ? [
                                                                { id: 'tier-under-1500', condition: 'under' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier1 ?? 43, label: 'Standard Commercial Parts' },
                                                                { id: 'tier-over-1500', condition: 'over' as const, threshold: 1500, rate: formData.pricingRules?.partsMarkupTier2 ?? 23, label: 'RTUs, Compressors, Coils' }
                                                            ] : []
                                                        );

                                                        if (activeMarkupRules.length === 0) {
                                                            return (
                                                                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                        No conditional tiers defined. Click <strong>&ldquo;+ Add Rule&rdquo;</strong> to define cost-based markup thresholds (e.g. under $1,500 at 43%).
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                                                {activeMarkupRules.map((rule, idx) => (
                                                                    <div key={rule.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                                        <div className="sm:col-span-3">
                                                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">Trigger Condition</label>
                                                                            <select
                                                                                value={rule.condition}
                                                                                onChange={e => handleUpdateMarkupRule(idx, 'condition', e.target.value as 'under' | 'over')}
                                                                                className="w-full text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 py-1.5 px-2 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500"
                                                                            >
                                                                                <option value="under">Under / Up to (≤)</option>
                                                                                <option value="over">Over / Exceeding (&gt;)</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="sm:col-span-3">
                                                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">Cost Threshold ($)</label>
                                                                            <div className="relative">
                                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">$</span>
                                                                                <NumberInput
                                                                                    step="any"
                                                                                    value={rule.threshold ?? ''}
                                                                                    onChange={e => handleUpdateMarkupRule(idx, 'threshold', parseFloat(e.target.value) || 0)}
                                                                                    placeholder="1500"
                                                                                    className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="sm:col-span-2">
                                                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">Rate (%)</label>
                                                                            <div className="relative">
                                                                                <NumberInput
                                                                                    step="any"
                                                                                    value={rule.rate ?? ''}
                                                                                    onChange={e => handleUpdateMarkupRule(idx, 'rate', parseFloat(e.target.value) || 0)}
                                                                                    placeholder="24"
                                                                                    className="w-full pr-5 pl-2 py-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-1 focus:ring-amber-500"
                                                                                />
                                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="sm:col-span-3">
                                                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">Scope / Description</label>
                                                                            <input
                                                                                type="text"
                                                                                value={rule.label || ''}
                                                                                onChange={e => handleUpdateMarkupRule(idx, 'label', e.target.value)}
                                                                                placeholder="e.g. Standard parts"
                                                                                className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500"
                                                                            />
                                                                        </div>
                                                                        <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteMarkupRule(idx)}
                                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                                                                                title="Delete Rule"
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Fallback rate & Notes */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                        <Input 
                                                            label="Standard / Fallback Parts Markup (%)" 
                                                            type="number" 
                                                            value={formData.pricingRules?.partsMarkupPercentage ?? formData.pricingRules?.markupPercentage ?? ''} 
                                                            onChange={e => {
                                                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: {
                                                                        ...(formData.pricingRules || {}),
                                                                        partsMarkupPercentage: val,
                                                                        markupPercentage: val
                                                                    }
                                                                });
                                                            }}
                                                            placeholder="e.g. 23"
                                                        />
                                                        <Input 
                                                            label="Markup Rule Summary / Notes" 
                                                            value={formData.pricingRules?.partsMarkupNotes ?? ''} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: {
                                                                        ...(formData.pricingRules || {}),
                                                                        partsMarkupNotes: val
                                                                    }
                                                                });
                                                            }}
                                                            placeholder="e.g. Up to $1,500: 43% | Over $1,500: 23%"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Customer Portal Rate Visibility Toggles */}
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-750">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                                    <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                                        <Eye size={14} className="text-indigo-500" />
                                                        <span>Customer Portal Visibility</span>
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 font-medium">Select which rates are visible on customer dashboard</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showStandardRate !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showStandardRate: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Standard Labor Rate</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showOvertimeRate !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showOvertimeRate: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Overtime Labor Rate</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showEmergencyRate !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showEmergencyRate: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Emergency Diagnostic</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showTripFee !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showTripFee: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Diagnostic &amp; Trip Fee</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showEmergencyTripCharge !== false && formData.pricingRules?.visibility?.showEmergencyTripFee !== false}
                                                            onChange={e => {
                                                                const nextVis = { 
                                                                    ...(formData.pricingRules?.visibility || {}), 
                                                                    showEmergencyTripCharge: e.target.checked,
                                                                    showEmergencyTripFee: e.target.checked
                                                                };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Emergency Trip Fee</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showPartsMarkup !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showPartsMarkup: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Parts Markup (%)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.pricingRules?.visibility?.showPaymentTerms !== false}
                                                            onChange={e => {
                                                                const nextVis = { ...(formData.pricingRules?.visibility || {}), showPaymentTerms: e.target.checked };
                                                                setFormData({
                                                                    ...formData,
                                                                    pricingRules: { ...(formData.pricingRules || {}), visibility: nextVis }
                                                                });
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Payment &amp; Net Terms</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Third-Party Vendor Portal Credentials & Work Order Submission Rules */}
                                        <div className="bg-sky-50/70 dark:bg-sky-950/20 p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/50 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-black uppercase text-sky-800 dark:text-sky-300 tracking-wider flex items-center gap-1.5">
                                                    <Key size={14} className="text-sky-600 dark:text-sky-400" />
                                                    <span>Third-Party Vendor Portal &amp; Work Order Credentials</span>
                                                </p>
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-700 dark:text-sky-300">
                                                    <input 
                                                        type="checkbox"
                                                        checked={formData.submissionRules?.thirdPartyPortal?.required || !!formData.submissionRules?.thirdPartyPortal?.portalUrl || !!formData.submissionRules?.thirdPartyPortal?.username}
                                                        onChange={e => {
                                                            const isReq = e.target.checked;
                                                            setFormData({
                                                                ...formData,
                                                                submissionRules: {
                                                                    ...(formData.submissionRules || {}),
                                                                    thirdPartyPortal: {
                                                                        ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                        required: isReq
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-sky-300 dark:border-sky-700"
                                                    />
                                                    <span>Portal Required</span>
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Portal Provider</label>
                                                    <select
                                                        value={formData.submissionRules?.thirdPartyPortal?.portalName || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setFormData({
                                                                ...formData,
                                                                submissionRules: {
                                                                    ...(formData.submissionRules || {}),
                                                                    thirdPartyPortal: {
                                                                        ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                        portalName: val,
                                                                        required: true
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                                    >
                                                        <option value="">-- Select Portal Provider --</option>
                                                        <option value="NEST Facilitate / ISP Connect">NEST Facilitate / ISP Connect</option>
                                                        <option value="ServiceChannel">ServiceChannel</option>
                                                        <option value="Corrigo">Corrigo</option>
                                                        <option value="FM Pilot">FM Pilot</option>
                                                        <option value="Verisae">Verisae</option>
                                                        <option value="Fixx">Fixx</option>
                                                        <option value="OfficeTrax">OfficeTrax</option>
                                                        <option value="Other">Other / Custom</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Portal Login URL
                                                        {formData.submissionRules?.thirdPartyPortal?.portalUrl && (
                                                            <a 
                                                                href={formData.submissionRules.thirdPartyPortal.portalUrl.startsWith('http') ? formData.submissionRules.thirdPartyPortal.portalUrl : `https://${formData.submissionRules.thirdPartyPortal.portalUrl}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="ml-2 text-[10px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5"
                                                            >
                                                                Open Portal <ExternalLink size={10} />
                                                            </a>
                                                        )}
                                                    </label>
                                                    <Input 
                                                        value={formData.submissionRules?.thirdPartyPortal?.portalUrl || ''} 
                                                        onChange={e => setFormData({
                                                            ...formData,
                                                            submissionRules: {
                                                                ...(formData.submissionRules || {}),
                                                                thirdPartyPortal: {
                                                                    ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                    portalUrl: e.target.value,
                                                                    required: true
                                                                }
                                                            }
                                                        })}
                                                        placeholder="https://providers.enternest.com/login.aspx"
                                                    />
                                                </div>

                                                <Input 
                                                    label="Portal Username / Contractor ID" 
                                                    value={formData.submissionRules?.thirdPartyPortal?.username || ''} 
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                             thirdPartyPortal: {
                                                                ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                username: e.target.value,
                                                                required: true
                                                            }
                                                        }
                                                    })} 
                                                    placeholder="e.g. 52274 or contractor@email.com" 
                                                />

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Portal Password</label>
                                                    <div className="relative">
                                                        <Input 
                                                            type={showPortalPassword ? "text" : "password"} 
                                                            value={formData.submissionRules?.thirdPartyPortal?.password || ''} 
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: {
                                                                    ...(formData.submissionRules || {}),
                                                                    thirdPartyPortal: {
                                                                        ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                        password: e.target.value,
                                                                        required: true
                                                                    }
                                                                }
                                                            })} 
                                                            placeholder="••••••••" 
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setShowPortalPassword(!showPortalPassword)} 
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                            title={showPortalPassword ? "Hide password" : "Show password"}
                                                        >
                                                            {showPortalPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <Input 
                                                    label="IVR / Phone Check-In Number" 
                                                    value={formData.submissionRules?.thirdPartyPortal?.phoneNumber || ''} 
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                            thirdPartyPortal: {
                                                                required: !!formData.submissionRules?.thirdPartyPortal?.required,
                                                                ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                phoneNumber: e.target.value
                                                            }
                                                        }
                                                    })} 
                                                    placeholder="e.g. (856)-720-5100" 
                                                />

                                                <Input 
                                                    label="IVR PIN / Access Code" 
                                                    value={formData.submissionRules?.thirdPartyPortal?.pinCode || ''} 
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                            thirdPartyPortal: {
                                                                required: !!formData.submissionRules?.thirdPartyPortal?.required,
                                                                ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                pinCode: e.target.value
                                                            }
                                                        }
                                                    })} 
                                                    placeholder="e.g. 1234" 
                                                />

                                                <Input 
                                                    label="Default NTE Limit ($)" 
                                                    type="number"
                                                    value={formData.submissionRules?.defaultNteLimit ?? ''} 
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                            defaultNteLimit: e.target.value ? parseFloat(e.target.value) : undefined
                                                        }
                                                    })} 
                                                    placeholder="e.g. 500" 
                                                />

                                                <Input 
                                                    label="Invoice Submission Email" 
                                                    value={formData.submissionRules?.invoiceSubmissionEmail || ''} 
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                            invoiceSubmissionEmail: e.target.value
                                                        }
                                                    })} 
                                                    placeholder="e.g. vendorinvoices@portal.com" 
                                                />
                                            </div>

                                            {/* Work Order Submission Rules Checkboxes */}
                                            <div className="pt-2 border-t border-sky-200/80 dark:border-sky-900/40">
                                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Facility Work Order Rules</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.requirePoNumber || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), requirePoNumber: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>PO / WO# Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.requireSignedWorkOrder || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), requireSignedWorkOrder: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>Signed Sign-Off Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.requireBeforeAfterPhotos || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), requireBeforeAfterPhotos: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>Before/After Photos Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.requireEquipmentSerial || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), requireEquipmentSerial: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>Equipment Serial Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.doNotDiscussPricingWithStoreAssociate || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), doNotDiscussPricingWithStoreAssociate: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>Do Not Discuss Pricing with Site</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={formData.submissionRules?.allowEmergencyPaperSignOff || false}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                submissionRules: { ...(formData.submissionRules || {}), allowEmergencyPaperSignOff: e.target.checked }
                                                            })}
                                                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span>Allow Paper Sign-Off</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <Textarea 
                                                label="Portal / Submission Notes & Instructions" 
                                                value={formData.submissionRules?.thirdPartyPortal?.submissionNotes || formData.submissionRules?.customSubmissionNotes || ''} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        submissionRules: {
                                                            ...(formData.submissionRules || {}),
                                                            thirdPartyPortal: {
                                                                required: !!formData.submissionRules?.thirdPartyPortal?.required,
                                                                ...(formData.submissionRules?.thirdPartyPortal || {}),
                                                                submissionNotes: val
                                                            },
                                                            customSubmissionNotes: val
                                                        }
                                                    });
                                                }}
                                                placeholder="e.g. Must check in via IVR upon arrival. Upload signed work order and photos to portal before submitting invoice."
                                                className="text-xs"
                                            />
                                        </div>

                                        <Input label="Street Address" isBlock value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                                        <Input label="City" isBlock value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                                        <Input label="State" isBlock value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} />
                                        <Input label="Zip" isBlock value={formData.zip || ''} onChange={e => setFormData({...formData, zip: e.target.value})} />
                                        
                                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border dark:border-slate-700">
                                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Marketing Consent (TCPA Safeguarded)</p>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.marketingConsent?.sms || false} 
                                                        onChange={e => {
                                                            const isChecking = e.target.checked;
                                                            const isCurrentlyUnsubscribed = formData.marketingConsent?.sms === false || !!(formData.marketingConsent as any)?.unsubscribedAt || customer?.marketingConsent?.source?.includes('Opt-Out');
                                                            if (isChecking && isCurrentlyUnsubscribed) {
                                                                setReConsentCertify(false);
                                                                setReConsentReason('Customer Verbal Request');
                                                                setReConsentNotes('');
                                                                setShowSmsReConsentModal(true);
                                                            } else {
                                                                setFormData({
                                                                    ...formData, 
                                                                    marketingConsent: { 
                                                                        ...formData.marketingConsent, 
                                                                        sms: isChecking,
                                                                        agreedAt: isChecking ? new Date().toISOString() : (formData.marketingConsent?.agreedAt || null),
                                                                        unsubscribedAt: isChecking ? null : new Date().toISOString(),
                                                                        source: isChecking ? 'Manual Admin Consent' : 'Admin Manual Opt-Out'
                                                                    } as any
                                                                });
                                                            }
                                                        }} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300 font-semibold">SMS Opt-In</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.marketingConsent?.email || false} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            marketingConsent: { 
                                                                ...formData.marketingConsent, 
                                                                email: e.target.checked,
                                                                agreedAt: e.target.checked ? new Date().toISOString() : (formData.marketingConsent?.agreedAt || null),
                                                                source: e.target.checked ? 'Manual Admin Consent' : 'Admin Manual Email Opt-Out'
                                                            } as any
                                                        })} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300 font-semibold">Email Opt-In</span>
                                                </label>
                                            </div>
                                            {((formData.marketingConsent as any)?.unsubscribedAt || formData.marketingConsent?.source?.includes('Opt-Out')) && (
                                                <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 p-2 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                                                    <ShieldAlert size={14} className="shrink-0 text-amber-600" />
                                                    <span>Customer Opted-Out ({formData.marketingConsent?.source || 'SMS STOP'}). Re-subscribing requires TCPA certification.</span>
                                                </div>
                                            )}

                                         <div className="space-y-2 mt-4">
                                             <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Assigned Dispatch Teams</label>
                                             <div className="space-y-1.5 max-h-36 overflow-y-auto border rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                                                 {state.teams.filter(t => t.organizationId === state.currentOrganization?.id).map(team => {
                                                     const currentTeams = formData.dispatchTeamIds || [];
                                                     const isChecked = currentTeams.includes(team.id);
                                                     return (
                                                         <label key={team.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                                                             <input 
                                                                 type="checkbox"
                                                                 checked={isChecked}
                                                                 onChange={(e) => {
                                                                     const next = e.target.checked 
                                                                         ? [...currentTeams, team.id]
                                                                         : currentTeams.filter(id => id !== team.id);
                                                                     setFormData({ ...formData, dispatchTeamIds: next });
                                                                 }}
                                                                 className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                             />
                                                             {team.name}
                                                         </label>
                                                     );
                                                 })}
                                                 {state.teams.filter(t => t.organizationId === state.currentOrganization?.id).length === 0 && (
                                                     <p className="text-[10px] text-slate-500 italic">No dispatch teams defined in Settings.</p>
                                                 )}
                                             </div>
                                         </div>
                                        </div>

                                        <Textarea label="Internal Notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Gate codes, warnings, preferences..." />
                                        
                                        {/* Tax Exemption Section */}
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3 mt-3">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.taxExempt || false} 
                                                        onChange={e => setFormData({ ...formData, taxExempt: e.target.checked })} 
                                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                    />
                                                    <span>🏛️ Tax Exempt Organization</span>
                                                </label>
                                                {formData.taxExempt && (
                                                    formData.taxExemptCertUrl ? (
                                                        <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                                            Exempt Active
                                                        </span>
                                                    ) : (
                                                        <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                                            ⚠️ Cert Required
                                                        </span>
                                                    )
                                                )}
                                            </div>

                                            {formData.taxExempt && (
                                                <div className="space-y-3 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 animate-fade-in">
                                                    {!formData.taxExemptCertUrl && (
                                                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-lg text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
                                                            <span className="text-base shrink-0">⚠️</span>
                                                            <div>
                                                                <p className="font-bold">Tax Certification Upload Required</p>
                                                                <p className="text-[11px] opacity-90 mt-0.5">
                                                                    Commercial customer tax exemption is ONLY active when an official tax certificate file is uploaded. Invoices will be taxed as normal until a certificate file is attached.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <Input 
                                                        label="Tax Exemption Certificate # / Tax ID" 
                                                        value={(formData as any).taxExemptNumber || ''} 
                                                        onChange={e => setFormData({ ...formData, taxExemptNumber: e.target.value } as any)} 
                                                        placeholder="e.g. TX-12345678"
                                                    />
                                                    <div>
                                                        <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                                                            Upload Tax Exemption Certificate File (PDF / Image) <span className="text-amber-600 dark:text-amber-400 font-extrabold">*Required for Exemption*</span>
                                                        </label>
                                                        <input 
                                                            type="file" 
                                                            accept="image/*,application/pdf"
                                                            className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                try {
                                                                    showToast.info('Uploading tax certificate...');
                                                                    const path = `organizations/${state.currentOrganization?.id || 'unknown'}/customers/${customer.id}/tax_exempt_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
                                                                    const url = await uploadFileToStorage(path, file);
                                                                    setFormData(prev => ({ ...prev, taxExemptCertUrl: url }));
                                                                    showToast.success('Tax certificate uploaded successfully!');
                                                                } catch (err) {
                                                                    showToast.error('Failed to upload tax certificate.');
                                                                }
                                                            }}
                                                        />
                                                        {formData.taxExemptCertUrl && (
                                                            <div className="mt-2 flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                                                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-[200px]">
                                                                    ✓ Certificate File Uploaded
                                                                </span>
                                                                <a 
                                                                    href={formData.taxExemptCertUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                                >
                                                                    View File ↗
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800 space-y-2 mt-2">
                                             <label className="flex items-center gap-2 cursor-pointer font-bold text-red-800 dark:text-red-400 text-sm">
                                                 <input 
                                                     type="checkbox" 
                                                     checked={formData.isBlacklisted || false} 
                                                     onChange={e => setFormData({
                                                         ...formData, 
                                                         isBlacklisted: e.target.checked,
                                                         blacklistReason: e.target.checked ? (formData.blacklistReason || 'Non-payment') : '',
                                                         blacklistedAt: e.target.checked ? (formData.blacklistedAt || new Date().toISOString()) : '',
                                                         blacklistedBy: e.target.checked ? (formData.blacklistedBy || `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Staff') : ''
                                                     })} 
                                                 />
                                                 <span>🚫 Blacklist Customer (Non-payment / Restricted Service)</span>
                                             </label>
                                             {formData.isBlacklisted && (
                                                 <Input 
                                                     label="Reason for Blacklist" 
                                                     value={formData.blacklistReason || ''} 
                                                     onChange={e => setFormData({...formData, blacklistReason: e.target.value})} 
                                                     placeholder="Reason (e.g. Non-payment of invoices)"
                                                 />
                                             )}
                                         </div>

                                        <Button onClick={handleSaveOverview}>Save Changes</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        {customer.isBlacklisted && (
                                            <div className="col-span-2 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-2">
                                                <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={16} />
                                                <div>
                                                    <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase flex items-center gap-1">
                                                        <span>Blacklisted Customer</span>
                                                    </p>
                                                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mt-0.5">{customer.blacklistReason || 'Non-payment'}</p>
                                                    <p className="text-[10px] text-red-600 dark:text-red-500 mt-1">
                                                        Marked by {customer.blacklistedBy || 'Staff'} on {customer.blacklistedAt ? new Date(customer.blacklistedAt).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {customer.taxExempt && (
                                            <div className={`col-span-2 p-3 rounded-xl border flex items-center justify-between ${
                                                customer.taxExemptCertUrl 
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
                                                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{customer.taxExemptCertUrl ? '🏛️' : '⚠️'}</span>
                                                    <div>
                                                        <p className={`text-xs font-extrabold uppercase ${customer.taxExemptCertUrl ? 'text-emerald-900 dark:text-emerald-300' : 'text-amber-900 dark:text-amber-300'}`}>
                                                            {customer.taxExemptCertUrl ? 'Tax Exempt Customer (Cert Verified)' : 'Tax Exempt Pending Certificate'}
                                                        </p>
                                                        {customer.taxExemptNumber && <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Exempt ID: {customer.taxExemptNumber}</p>}
                                                        {!customer.taxExemptCertUrl && (
                                                            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                                                                * Certificate file missing: Invoices will be taxed until uploaded *
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {customer.taxExemptCertUrl ? (
                                                    <a 
                                                        href={customer.taxExemptCertUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                                                    >
                                                        View Certificate File ↗
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded border border-amber-300 dark:border-amber-700">
                                                        Upload Certificate Required
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div><p className="text-gray-500">Account #</p><p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{customer.accountNumber || getOrGenerateAccountNumber(customer)}</p></div>
                                        <div><p className="text-gray-500">Type</p><p className="font-medium dark:text-white">{customer.customerType || 'Residential'}</p></div>
                                        <div><p className="text-gray-500">Payment Terms</p><p className="font-bold text-slate-800 dark:text-slate-100">{customer.paymentTerms ? getPaymentTermsLabel(customer.paymentTerms) : 'Net 30'}</p></div>
                                        {customer.vendorCompliance?.vendorStatus && (
                                            <div>
                                                <p className="text-gray-500">Vendor Status</p>
                                                <p className="font-bold text-purple-600 dark:text-purple-400">{customer.vendorCompliance.vendorStatus}</p>
                                            </div>
                                        )}
                                        {customer.vendorCompliance?.vendorNumber && (
                                            <div>
                                                <p className="text-gray-500">Vendor #</p>
                                                <p className="font-bold text-purple-600 dark:text-purple-400">{customer.vendorCompliance.vendorNumber}</p>
                                            </div>
                                        )}
                                        <div><p className="text-gray-500">Email</p><p className="font-medium dark:text-white">{customer.email || 'N/A'}</p></div>
                                        <div><p className="text-gray-500">Phone</p><p className="font-medium dark:text-white">{customer.phone || 'N/A'}</p></div>
                                        
                                        {customer.pricingRules?.contractedRate !== undefined && customer.pricingRules.contractedRate > 0 && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Contracted Rate
                                                    {customer.pricingRules?.visibility?.showStandardRate === false && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                <p className="font-bold text-emerald-600 dark:text-emerald-400">${customer.pricingRules.contractedRate.toFixed(2)}/hr</p>
                                            </div>
                                        )}
                                        {(customer.pricingRules?.overtimeRate !== undefined && customer.pricingRules.overtimeRate > 0 || customer.pricingRules?.overtimeLaborRate !== undefined && customer.pricingRules.overtimeLaborRate > 0 || customer.pricingRules?.overtimeContractedRate !== undefined && customer.pricingRules.overtimeContractedRate > 0) && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Overtime Labor Rate
                                                    {customer.pricingRules?.visibility?.showOvertimeRate === false && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                <p className="font-bold text-blue-600 dark:text-blue-400">${(customer.pricingRules.overtimeRate ?? customer.pricingRules.overtimeLaborRate ?? customer.pricingRules.overtimeContractedRate)?.toFixed(2)}/hr</p>
                                            </div>
                                        )}
                                        {(customer.pricingRules?.emergencyContractedRate !== undefined && customer.pricingRules.emergencyContractedRate > 0 || customer.pricingRules?.emergencyRate !== undefined && customer.pricingRules.emergencyRate > 0) && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Emergency Rate
                                                    {customer.pricingRules?.visibility?.showEmergencyRate === false && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                <p className="font-bold text-rose-600 dark:text-rose-400">${(customer.pricingRules.emergencyContractedRate ?? customer.pricingRules.emergencyRate)?.toFixed(2)}/hr</p>
                                            </div>
                                        )}
                                        {(customer.pricingRules?.tripFee !== undefined && customer.pricingRules.tripFee > 0 || customer.pricingRules?.tripCharge !== undefined && customer.pricingRules.tripCharge > 0) && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Trip Fee
                                                    {customer.pricingRules?.visibility?.showTripFee === false && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                <p className="font-bold text-indigo-600 dark:text-indigo-400">${(customer.pricingRules.tripFee ?? customer.pricingRules.tripCharge)?.toFixed(2)}</p>
                                            </div>
                                        )}
                                        {(customer.pricingRules?.emergencyTripFee !== undefined && customer.pricingRules.emergencyTripFee > 0 || customer.pricingRules?.emergencyTripCharge !== undefined && customer.pricingRules.emergencyTripCharge > 0) && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Emergency Trip Fee
                                                    {(customer.pricingRules?.visibility?.showEmergencyTripFee === false || customer.pricingRules?.visibility?.showEmergencyTripCharge === false) && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                <p className="font-bold text-rose-600 dark:text-rose-400">${(customer.pricingRules.emergencyTripFee ?? customer.pricingRules.emergencyTripCharge)?.toFixed(2)}</p>
                                            </div>
                                        )}
                                        {customer.pricingRules?.travelTime && (
                                            <div>
                                                <p className="text-gray-500 flex items-center gap-1">Travel Time</p>
                                                <p className="font-bold text-sky-600 dark:text-sky-400">{customer.pricingRules.travelTime}</p>
                                            </div>
                                        )}
                                        {((customer.pricingRules?.partsMarkupRules && customer.pricingRules.partsMarkupRules.length > 0) || (customer.pricingRules?.partsMarkupPercentage !== undefined && customer.pricingRules.partsMarkupPercentage > 0) || (customer.pricingRules?.markupPercentage !== undefined && customer.pricingRules.markupPercentage > 0) || (customer.pricingRules?.partsMarkupTier1 !== undefined)) && (
                                            <div className="col-span-1 sm:col-span-2">
                                                <p className="text-gray-500 flex items-center gap-1">
                                                    Parts Markup
                                                    {customer.pricingRules?.visibility?.showPartsMarkup === false && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-bold">Portal Hidden</span>
                                                    )}
                                                </p>
                                                {customer.pricingRules?.partsMarkupRules && customer.pricingRules.partsMarkupRules.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        {customer.pricingRules.partsMarkupRules.map((rule, idx) => (
                                                            <div key={rule.id || idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs shadow-2xs">
                                                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                                                    {rule.condition === 'under' ? `≤ $${Number(rule.threshold).toLocaleString()}` : `> $${Number(rule.threshold).toLocaleString()}`}:
                                                                </span>
                                                                <span className="font-extrabold text-amber-700 dark:text-amber-400">+{rule.rate}%</span>
                                                                {rule.label && <span className="text-[10px] text-slate-400 font-medium">({rule.label})</span>}
                                                            </div>
                                                        ))}
                                                        {customer.pricingRules?.partsMarkupPercentage !== undefined && (
                                                            <span className="text-[10px] text-slate-400 font-semibold ml-1">
                                                                Fallback: +{customer.pricingRules.partsMarkupPercentage}%
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (customer.pricingRules?.partsMarkupTier1 && customer.pricingRules?.partsMarkupTier2) ? (
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs shadow-2xs">
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">≤ $1,500:</span>
                                                            <span className="font-extrabold text-amber-700 dark:text-amber-400">+{customer.pricingRules.partsMarkupTier1}%</span>
                                                            <span className="text-[10px] text-slate-400 font-medium">(Standard Parts)</span>
                                                        </div>
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs shadow-2xs">
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">&gt; $1,500:</span>
                                                            <span className="font-extrabold text-amber-700 dark:text-amber-400">+{customer.pricingRules.partsMarkupTier2}%</span>
                                                            <span className="text-[10px] text-slate-400 font-medium">(RTUs &amp; Equipment)</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="font-bold text-amber-600 dark:text-amber-400">+{customer.pricingRules?.partsMarkupPercentage ?? customer.pricingRules?.markupPercentage}%</p>
                                                )}
                                                {customer.pricingRules?.partsMarkupNotes && (
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic">
                                                        {customer.pricingRules.partsMarkupNotes}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(customer.submissionRules?.thirdPartyPortal?.required || customer.submissionRules?.thirdPartyPortal?.portalUrl || customer.submissionRules?.thirdPartyPortal?.username || customer.submissionRules?.requirePoNumber) && (
                                            <div className="col-span-2 bg-gradient-to-br from-sky-50 to-indigo-50/40 dark:from-sky-950/20 dark:to-indigo-950/20 p-4 rounded-xl border border-sky-200 dark:border-sky-800/60 space-y-3 shadow-xs">
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 dark:border-sky-800/50 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                                                            <Key size={15} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black uppercase text-sky-900 dark:text-sky-200 tracking-wider">
                                                                {customer.submissionRules.thirdPartyPortal?.portalName || 'Third-Party Vendor Portal'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                                Work Order &amp; Facility Management Credentials
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {customer.submissionRules.thirdPartyPortal?.portalUrl && (
                                                        <a 
                                                            href={customer.submissionRules.thirdPartyPortal.portalUrl.startsWith('http') ? customer.submissionRules.thirdPartyPortal.portalUrl : `https://${customer.submissionRules.thirdPartyPortal.portalUrl}`}
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                                                        >
                                                            Launch Portal <ExternalLink size={12} />
                                                        </a>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                                    {customer.submissionRules.thirdPartyPortal?.username && (
                                                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Username / Contractor ID</span>
                                                            <div className="flex items-center justify-between mt-0.5">
                                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{customer.submissionRules.thirdPartyPortal.username}</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(customer.submissionRules?.thirdPartyPortal?.username || '');
                                                                        showToast.success('Username copied to clipboard!');
                                                                    }}
                                                                    className="text-slate-400 hover:text-sky-600 transition-colors p-0.5"
                                                                    title="Copy Username"
                                                                >
                                                                    <Copy size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {customer.submissionRules.thirdPartyPortal?.password && (
                                                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Password</span>
                                                            <div className="flex items-center justify-between mt-0.5">
                                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                                                    {showPortalPassword ? customer.submissionRules.thirdPartyPortal.password : '••••••••'}
                                                                </span>
                                                                <div className="flex items-center gap-1">
                                                                    <button 
                                                                        onClick={() => setShowPortalPassword(!showPortalPassword)}
                                                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                                                                        title={showPortalPassword ? "Hide password" : "Show password"}
                                                                    >
                                                                        {showPortalPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(customer.submissionRules?.thirdPartyPortal?.password || '');
                                                                            showToast.success('Password copied to clipboard!');
                                                                        }}
                                                                        className="text-slate-400 hover:text-sky-600 transition-colors p-0.5"
                                                                        title="Copy Password"
                                                                    >
                                                                        <Copy size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {customer.submissionRules.thirdPartyPortal?.phoneNumber && (
                                                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">IVR Check-In Phone</span>
                                                            <div className="flex items-center justify-between mt-0.5">
                                                                <a href={`tel:${customer.submissionRules.thirdPartyPortal.phoneNumber.replace(/[^0-9+]/g, '')}`} className="font-bold text-sky-600 dark:text-sky-400 hover:underline">
                                                                    {customer.submissionRules.thirdPartyPortal.phoneNumber}
                                                                </a>
                                                                {customer.submissionRules.thirdPartyPortal.pinCode && (
                                                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-semibold">
                                                                        PIN: {customer.submissionRules.thirdPartyPortal.pinCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {customer.submissionRules.defaultNteLimit !== undefined && (
                                                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Default NTE Limit</span>
                                                            <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                                ${customer.submissionRules.defaultNteLimit.toFixed(2)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Compliance Badges */}
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {customer.submissionRules.requirePoNumber && (
                                                        <span className="text-[10px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                                            ✓ PO / WO# Required
                                                        </span>
                                                    )}
                                                    {customer.submissionRules.requireSignedWorkOrder && (
                                                        <span className="text-[10px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                                            ✓ Manager Sign-Off Required
                                                        </span>
                                                    )}
                                                    {customer.submissionRules.requireBeforeAfterPhotos && (
                                                        <span className="text-[10px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                                            ✓ Before/After Photos Required
                                                        </span>
                                                    )}
                                                    {customer.submissionRules.requireEquipmentSerial && (
                                                        <span className="text-[10px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                                            ✓ Equipment Serial Required
                                                        </span>
                                                    )}
                                                    {customer.submissionRules.doNotDiscussPricingWithStoreAssociate && (
                                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                                                            🔒 Do Not Discuss Pricing
                                                        </span>
                                                    )}
                                                </div>

                                                {(customer.submissionRules.thirdPartyPortal?.submissionNotes || customer.submissionRules.customSubmissionNotes) && (
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-sky-100 dark:border-sky-900/30 italic">
                                                        <span className="font-bold not-italic text-sky-700 dark:text-sky-300">Instructions: </span>
                                                        {customer.submissionRules.thirdPartyPortal?.submissionNotes || customer.submissionRules.customSubmissionNotes}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="col-span-2">
                                            <p className="text-gray-500">Address</p>
                                            <p className="font-medium dark:text-white">
                                                {customer.address}<br/>
                                                {customer.city ? `${customer.city}, ` : ''}{customer.state || ''} {customer.zip || ''}
                                            </p>
                                        </div>
                                        {customer.notes && (
                                            <div className="col-span-2 mt-2">
                                                <p className="text-gray-500">Notes</p>
                                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded text-gray-800 dark:text-gray-200 border border-yellow-100 dark:border-yellow-900/30 whitespace-pre-wrap">
                                                    {customer.notes}
                                                </div>
                                            </div>
                                        )}
                                        {/* Consent Display */}
                                        <div className="col-span-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase flex items-center gap-2">
                                                <MessageSquare size={12}/> Marketing Permissions
                                            </p>
                                            {customer.marketingConsent?.sms || customer.marketingConsent?.email ? (
                                                <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
                                                    <span className={`flex items-center gap-1 ${customer.marketingConsent.sms ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                                                        <CheckCircle size={14} className="text-green-500"/> SMS
                                                    </span>
                                                    <span className={`flex items-center gap-1 ${customer.marketingConsent.email ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                                                        <CheckCircle size={14} className="text-green-500"/> Email
                                                    </span>
                                                    <span className="text-slate-400 ml-auto">
                                                        Agreed: {new Date(customer.marketingConsent.agreedAt).toLocaleDateString()} via {customer.marketingConsent.source}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No consent recorded.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="md:col-span-1">
                                <div className="bg-gray-200 dark:bg-gray-700 w-full h-40 rounded flex items-center justify-center text-gray-500 text-xs overflow-hidden border border-gray-300 dark:border-gray-600 mb-4">
                                    <iframe 
                                        width="100%" 
                                        height="100%" 
                                        className="border-0"
                                        loading="lazy" 
                                        allowFullScreen 
                                        title="Customer Address Map"
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(customer.address + ' ' + (customer.city || '') + ' ' + (customer.state || '') + ' ' + (customer.zip || ''))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                    ></iframe>
                                </div>
                                
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            Site Properties 
                                            {customer.serviceLocations && customer.serviceLocations.length > 0 && (
                                                <span className="text-xs font-normal text-slate-500">
                                                    ({locationSearchTerm.trim() ? `${(customer.serviceLocations || []).filter((loc: any) => {
                                                        const term = locationSearchTerm.toLowerCase().trim();
                                                        const name = (loc.name || loc.propertyName || '').toLowerCase();
                                                        const address = (loc.address || '').toLowerCase();
                                                        const city = (loc.city || '').toLowerCase();
                                                        const state = (loc.state || '').toLowerCase();
                                                        const zip = (loc.zip || '').toLowerCase();
                                                        const storeNum = (loc.storeNumber || loc.locationNumber || loc.poNumber || '').toLowerCase();
                                                        return name.includes(term) || address.includes(term) || city.includes(term) || state.includes(term) || zip.includes(term) || storeNum.includes(term);
                                                    }).length} of ${customer.serviceLocations.length}` : customer.serviceLocations.length})
                                                </span>
                                            )}
                                        </h4>
                                        <div className="flex gap-2">
                                            {customer.customerType === 'Property Management' && customer.serviceLocations && customer.serviceLocations.length > 0 && (
                                                <Button onClick={handleBulkAdHocPMs} variant="secondary" className="text-[10px] py-1 px-2 h-auto flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                                                    <Wrench size={12}/> Bulk Dispatch Maintenance
                                                </Button>
                                            )}
                                            <button title="Add Property" aria-label="Add Property" onClick={() => { setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '', storeNumber: '', locationNumber: '' }); setIsAddingLocation(!isAddingLocation); }} className="text-primary-600 hover:text-primary-700">
                                                <PlusCircle size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Location Search Bar */}
                                    {customer.serviceLocations && customer.serviceLocations.length > 0 && (
                                        <div className="relative mb-2.5">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                                            <input
                                                type="text"
                                                placeholder={t("Search locations by name, store #, address, city...")}
                                                value={locationSearchTerm}
                                                onChange={e => setLocationSearchTerm(e.target.value)}
                                                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                                            />
                                            {locationSearchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLocationSearchTerm('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                    title="Clear search"
                                                >
                                                    <XCircle size={13} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    
                                    {isAddingLocation && (
                                        <div className="space-y-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 shadow-inner animate-in fade-in slide-in-from-top-2">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">{newLocation.id ? 'Edit Property' : 'Add Property'}</p>
                                            
                                            <Input label="Location Name (e.g. Primary, Warehouse)" isBlock value={newLocation.name || ''} onChange={e => setNewLocation({...newLocation, name: e.target.value})} />
                                            <Input label="Store # / Location Code" isBlock value={newLocation.storeNumber || newLocation.locationNumber || ''} onChange={e => setNewLocation({...newLocation, storeNumber: e.target.value, locationNumber: e.target.value})} placeholder="e.g. Store #4663, CK058, or PROP-A1" />
                                            <Input label="Street Address" isBlock value={newLocation.address || ''} onChange={e => setNewLocation({...newLocation, address: e.target.value})} />
                                            <Input label="City" isBlock value={newLocation.city || ''} onChange={e => setNewLocation({...newLocation, city: e.target.value})} />
                                            <Input label="State" isBlock value={newLocation.state || ''} onChange={e => setNewLocation({...newLocation, state: e.target.value})} />
                                            <Input label="Zip" isBlock value={newLocation.zip || ''} onChange={e => setNewLocation({...newLocation, zip: e.target.value})} />
                                            
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button variant="secondary" onClick={() => setIsAddingLocation(false)} className="text-xs py-1.5 px-3 h-auto">Cancel</Button>
                                                <Button onClick={handleAddLocation} className="text-xs py-1.5 px-3 h-auto">Save Property</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 overflow-y-auto max-h-[30vh] custom-scrollbar pr-1">
                                        {customer.serviceLocations && customer.serviceLocations.length > 0 ? (() => {
                                            const filteredLocs = customer.serviceLocations.filter((loc: any) => {
                                                if (!locationSearchTerm.trim()) return true;
                                                const term = locationSearchTerm.toLowerCase().trim();
                                                const name = (loc.name || loc.propertyName || '').toLowerCase();
                                                const address = (loc.address || '').toLowerCase();
                                                const city = (loc.city || '').toLowerCase();
                                                const state = (loc.state || '').toLowerCase();
                                                const zip = (loc.zip || '').toLowerCase();
                                                const storeNum = (loc.storeNumber || loc.locationNumber || loc.poNumber || '').toLowerCase();
                                                const notes = (loc.notes || '').toLowerCase();
                                                return name.includes(term) || address.includes(term) || city.includes(term) || state.includes(term) || zip.includes(term) || storeNum.includes(term) || notes.includes(term);
                                            });

                                            if (filteredLocs.length === 0) {
                                                return (
                                                    <div className="text-xs text-slate-500 italic p-4 text-center">
                                                        No locations matching "{locationSearchTerm}".
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setLocationSearchTerm('')} 
                                                            className="block mx-auto mt-1.5 text-primary-600 hover:underline font-semibold not-italic text-xs"
                                                        >
                                                            Clear search
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return filteredLocs.map((loc: any) => (
                                                <div key={loc.id} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex justify-between items-start transition-colors hover:border-primary-300">
                                                    <div>
                                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{loc.name || loc.propertyName}</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">{loc.address}</p>
                                                        {loc.city && <p className="text-[10px] text-slate-500">{loc.city}{loc.state ? `, ${loc.state}` : ''}{loc.zip ? ` ${loc.zip}` : ''}</p>}
                                                        {(loc.storeNumber || loc.locationNumber || loc.poNumber) && <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1 uppercase tracking-wider">Store #: {loc.storeNumber || loc.locationNumber || loc.poNumber}</p>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button title="Edit Property" aria-label="Edit Property" onClick={() => { setNewLocation({ ...loc, name: loc.name || loc.propertyName, storeNumber: loc.storeNumber || loc.locationNumber || loc.poNumber || '', locationNumber: loc.storeNumber || loc.locationNumber || loc.poNumber || '' }); setIsAddingLocation(true); }} className="text-slate-400 hover:text-primary-600 transition-colors">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button title="Delete Property" aria-label="Delete Property" onClick={(e) => handleDeleteLocation(loc.id, e)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                            <TrashIcon size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ));
                                        })() : (
                                            <p className="text-xs text-slate-500 italic p-2 center text-center">No multiple properties listed. Default address used.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Company Contacts */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mt-4">
                                     <div className="flex justify-between items-center mb-3">
                                         <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                             {customer.customerType === 'Residential' ? t('Additional Contacts') : t('Company Contacts')}
                                         </h4>
                                         <button title="Add Contact" aria-label="Add Contact" onClick={() => { setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, isIncomingWorkOrderContact: false, contactRoles: [], portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined }); setIsAddingContact(!isAddingContact); }} className="text-primary-600 hover:text-primary-700">
                                             <PlusCircle size={18} />
                                         </button>
                                     </div>
                                     
                                     {isAddingContact && (
                                         <div className="space-y-3 mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 shadow-inner animate-in fade-in slide-in-from-top-2">
                                             <p className="text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">{newContact.id ? 'Edit Contact' : 'Add Contact'}</p>
                                             
                                             <Input label="Name" value={newContact.name || ''} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                                             <Input label="Title/Role (Optional)" value={newContact.title || ''} onChange={e => setNewContact({...newContact, title: e.target.value})} />
                                             <Input label="Phone" value={newContact.phone || ''} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                                             <Input label="Email" value={newContact.email || ''} onChange={e => setNewContact({...newContact, email: e.target.value})} />

                                             {/* Incoming Work Orders Contact Toggle */}
                                             <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-1 mt-2">
                                                 <label className="flex items-center gap-2 cursor-pointer">
                                                     <input 
                                                         type="checkbox" 
                                                         checked={!!newContact.isIncomingWorkOrderContact} 
                                                         onChange={e => setNewContact({
                                                             ...newContact, 
                                                             isIncomingWorkOrderContact: e.target.checked,
                                                             contactRoles: e.target.checked
                                                                 ? Array.from(new Set([...(newContact.contactRoles || []), 'incoming_workorders']))
                                                                 : (newContact.contactRoles || []).filter((r: string) => r !== 'incoming_workorders')
                                                         })} 
                                                         className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4" 
                                                     />
                                                     <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                         <Inbox size={13} className="text-amber-500" />
                                                         Incoming Work Orders Contact
                                                     </span>
                                                 </label>
                                                 <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-6">
                                                     All incoming work orders from this customer will arrive from this email address. Emails from this contact will be flagged in the Inbox for 1-click Work Order conversion.
                                                 </p>
                                             </div>

                                             <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 mt-2">
                                                 <label className="flex items-center gap-2 cursor-pointer">
                                                     <input 
                                                         type="checkbox" 
                                                         checked={!!newContact.portalRole} 
                                                         onChange={e => setNewContact({
                                                             ...newContact, 
                                                             portalRole: e.target.checked ? 'corporate' : undefined,
                                                             allowedLocationIds: []
                                                         })} 
                                                         className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                                                     />
                                                     <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Enable Customer Portal Access</span>
                                                 </label>

                                                 {newContact.portalRole && (
                                                     <div className="space-y-3 border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                                                         <Select 
                                                             label="Portal Access Role" 
                                                             value={newContact.portalRole} 
                                                             onChange={e => setNewContact({
                                                                 ...newContact, 
                                                                 portalRole: e.target.value,
                                                                 allowedLocationIds: []
                                                             })}
                                                         >
                                                             <option value="corporate">Corporate Owner (Full Access)</option>
                                                             <option value="regional">Regional Manager (Access to Selected Stores)</option>
                                                             <option value="branch">Branch Manager (Access to Single Store)</option>
                                                         </Select>

                                                         {newContact.portalRole === 'branch' && (
                                                             <Select 
                                                                 label="Assign Single Store" 
                                                                 value={newContact.allowedLocationIds?.[0] || ''} 
                                                                 onChange={e => setNewContact({
                                                                     ...newContact, 
                                                                     allowedLocationIds: e.target.value ? [e.target.value] : []
                                                                 })}
                                                             >
                                                                 <option value="">-- Select Store --</option>
                                                                 {customer.serviceLocations?.map((loc: any) => (
                                                                     <option key={loc.id} value={loc.id}>{loc.propertyName || loc.name}</option>
                                                                 ))}
                                                             </Select>
                                                         )}

                                                         {newContact.portalRole === 'regional' && (
                                                             <div className="space-y-1.5">
                                                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Regional Stores</p>
                                                                 <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1 custom-scrollbar">
                                                                     {customer.serviceLocations && customer.serviceLocations.length > 0 ? (
                                                                         customer.serviceLocations.map((loc: any) => {
                                                                             const isChecked = newContact.allowedLocationIds?.includes(loc.id);
                                                                             return (
                                                                                 <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs">
                                                                                     <input 
                                                                                         type="checkbox" 
                                                                                         checked={isChecked || false} 
                                                                                         onChange={ev => {
                                                                                             const currentIds = newContact.allowedLocationIds || [];
                                                                                             const newIds = ev.target.checked 
                                                                                                 ? [...currentIds, loc.id] 
                                                                                                 : currentIds.filter((id: string) => id !== loc.id);
                                                                                             setNewContact({ ...newContact, allowedLocationIds: newIds });
                                                                                         }} 
                                                                                         className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" 
                                                                                     />
                                                                                     <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{loc.propertyName || loc.name}</span>
                                                                                 </label>
                                                                             );
                                                                         })
                                                                     ) : (
                                                                         <p className="text-[10px] text-slate-400 italic">No storefront locations listed.</p>
                                                                     )}
                                                                 </div>
                                                             </div>
                                                         )}
                                                     </div>
                                                 )}
                                             </div>

                                             <div className="flex items-center justify-between pt-2">
                                                 <label className="flex items-center gap-2 cursor-pointer">
                                                     <input type="checkbox" checked={newContact.isPrimary} onChange={e => setNewContact({...newContact, isPrimary: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                     <span className="text-xs font-medium dark:text-slate-300">Primary Contact</span>
                                                 </label>
                                                 <div className="flex justify-end gap-2">
                                                     <Button variant="secondary" onClick={() => setIsAddingContact(false)} className="text-xs py-1.5 px-3 h-auto">Cancel</Button>
                                                     <Button onClick={handleAddContact} className="text-xs py-1.5 px-3 h-auto">Save Contact</Button>
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     <div className="space-y-2 overflow-y-auto max-h-[30vh] custom-scrollbar pr-1">
                                         {customer.contacts && customer.contacts.length > 0 ? customer.contacts.map((contact: any) => (
                                             <div key={contact.id} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex justify-between items-start transition-colors hover:border-primary-300">
                                                 <div>
                                                     <p className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                                         {contact.name} 
                                                         {contact.isPrimary && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] rounded uppercase font-bold">Primary</span>}
                                                         {(contact.isIncomingWorkOrderContact || (contact.contactRoles && contact.contactRoles.includes('incoming_workorders'))) && (
                                                             <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[9px] rounded uppercase font-black flex items-center gap-1 border border-amber-300 dark:border-amber-700">
                                                                 <Inbox size={10} /> Incoming Work Orders
                                                             </span>
                                                         )}
                                                         {contact.portalRole && (
                                                             <span className={`px-1.5 py-0.5 text-[9px] rounded uppercase font-bold ${
                                                                 contact.portalRole === 'corporate' 
                                                                     ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' 
                                                                     : contact.portalRole === 'regional'
                                                                         ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                                                         : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                             }`}>
                                                                 {contact.portalRole}
                                                             </span>
                                                         )}
                                                         {contact.portalUserStatus && (
                                                             <span className={`px-1.5 py-0.5 text-[9px] rounded uppercase font-bold ${
                                                                 contact.portalUserStatus === 'active' 
                                                                     ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                                     : contact.portalUserStatus === 'invited'
                                                                         ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                                         : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                             }`}>
                                                                 {contact.portalUserStatus}
                                                             </span>
                                                         )}
                                                     </p>
                                                     {contact.title && <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">{contact.title}</p>}
                                                     <div className="flex flex-col gap-0.5 mt-1">
                                                         {contact.phone && <p className="text-[10px] text-slate-500 flex items-center gap-1"><span className="text-slate-400">P:</span> {contact.phone}</p>}
                                                         {contact.email && <p className="text-[10px] text-slate-500 flex items-center gap-1"><span className="text-slate-400">E:</span> {contact.email}</p>}
                                                     </div>
                                                 </div>
                                                 <div className="flex gap-2 items-center">
                                                     {contact.email && (
                                                         <button title="Send Portal Invite" aria-label="Send Portal Invite" onClick={() => handleSendContactInvite(contact)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                             <Mail size={14} />
                                                         </button>
                                                     )}
                                                     <button title="Edit Contact" aria-label="Edit Contact" onClick={() => { setNewContact(contact); setIsAddingContact(true); }} className="text-slate-400 hover:text-primary-600 transition-colors">
                                                         <Edit size={14} />
                                                     </button>
                                                     <button title="Delete Contact" aria-label="Delete Contact" onClick={() => handleDeleteContact(contact.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                         <TrashIcon size={14} />
                                                     </button>
                                                 </div>
                                             </div>
                                         )) : (
                                             <p className="text-xs text-slate-500 italic p-2 center text-center">No contacts listed.</p>
                                         )}
                                     </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'equipment' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white">Assets & Locations</h3>
                                <div className="flex gap-2">
                                    {(customer.id === 'cust-1787187506048' || (customer.serviceLocations && customer.serviceLocations.length > 1) || customer.name?.toLowerCase().includes('impact')) && (
                                        <Button 
                                            onClick={() => setIsMallFilterModalOpen(true)} 
                                            className="w-auto text-xs py-1 !bg-emerald-600 hover:!bg-emerald-700 !text-white border-0 flex items-center gap-1.5 shadow-sm font-bold"
                                            title="View aggregate filter pull sheet grouped by mall cluster"
                                        >
                                            <Filter size={14}/> Mall Filter Requisition
                                        </Button>
                                    )}
                                    <Button onClick={() => window.open(`#/report/equipment/${customer.id}`, '_blank')} className="w-auto text-xs py-1 !bg-indigo-600 hover:!bg-indigo-700 !text-white border-0 flex items-center gap-1"><Printer size={14}/> Equipment Report</Button>
                                </div>
                            </div>
                            <EquipmentHierarchy 
                                customer={customer} 
                                autoOpenEquipmentId={autoOpenEquipmentId}
                                onClearAutoOpen={() => setAutoOpenEquipmentId(null)}
                            />
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {/* Summary & Metrics Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                                <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Calls</span>
                                    <p className="text-base font-black text-slate-800 dark:text-white mt-0.5">{historyStats.total}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800">
                                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Completed</span>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{historyStats.completed}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
                                    <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">In Progress / Sched</span>
                                    <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">{historyStats.inProgress}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800">
                                    <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Needs Follow-Up</span>
                                    <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">{historyStats.needsFollowUp}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Billed</span>
                                    <p className="text-base font-bold text-slate-700 dark:text-slate-200 mt-0.5">${historyStats.totalBilled.toFixed(2)}</p>
                                </div>
                                <div className="p-3 text-center bg-emerald-50/20 dark:bg-emerald-950/20">
                                    <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Total Paid</span>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${historyStats.totalPaid.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Toolbar & Filters */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                                    {/* Search input */}
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Search by WO #, Invoice #, task, tech, location..."
                                            value={historySearchTerm}
                                            onChange={(e) => setHistorySearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                        />
                                        {historySearchTerm && (
                                            <button 
                                                type="button" 
                                                onClick={() => setHistorySearchTerm('')} 
                                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Status Filter */}
                                    <select 
                                        aria-label="Filter History by Status"
                                        className="text-xs py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={historyStatusFilter}
                                        onChange={(e) => setHistoryStatusFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Needs Follow-up">Needs Follow-up</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>

                                    {/* Location Filter */}
                                    {((customer.serviceLocations && customer.serviceLocations.length > 0) || customer.customerType === 'Property Management') && (
                                        <select 
                                            title="Filter History by Location"
                                            aria-label="Filter History by Location"
                                            className="text-xs py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-primary-500"
                                            value={historyLocationFilter}
                                            onChange={(e) => setHistoryLocationFilter(e.target.value)}
                                        >
                                            <option value="">All Locations</option>
                                            <option value="default">Main Office / Unassigned</option>
                                            {customer.serviceLocations?.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.propertyName || loc.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        type="button" 
                                        onClick={() => setEditingAppointmentJob({ customerId: customer.id, customerName: customer.name } as any)}
                                        className="text-xs py-1.5 px-3 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-lg shadow-xs flex items-center gap-1.5 border-0"
                                    >
                                        <PlusCircle size={14} /> + Book Service Call
                                    </Button>
                                </div>
                            </div>

                            {/* Operations-Style Service History Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[9px] tracking-wider sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 min-w-[200px]">{t("Site Location & Ref #")}</th>
                                                <th className="px-4 py-3 min-w-[180px]">{t("Appointment & Site Visit")}</th>
                                                <th className="px-4 py-3 min-w-[190px]">{t("Invoice & Doc Status")}</th>
                                                <th className="px-4 py-3 min-w-[170px]">{t("Linked Documents")}</th>
                                                <th className="px-4 py-3 min-w-[160px]">{t("Status & Assignment")}</th>
                                            </tr>
                                        </thead>
                                        {filteredHistoryJobs.length === 0 ? (
                                            <tbody>
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">
                                                        {historySearchTerm || historyStatusFilter !== 'ALL' || historyLocationFilter
                                                            ? "No service calls matched your filter criteria."
                                                            : "No service history recorded for this customer yet."}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        ) : (
                                            filteredHistoryJobs.map((job: Job) => {
                                                const loc = customer.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);
                                                const siteLocationName = resolveSiteLocationName(job, loc);
                                                const siteAddress = formatFullAddress(job.address || loc?.address || customer.address || '');

                                                const relatedProposals = (state.proposals || []).filter((p: any) =>
                                                    p.id === job.proposalId ||
                                                    p.id === job.projectId ||
                                                    p.jobId === job.id ||
                                                    job.linkedProposalIds?.includes(p.id) ||
                                                    p.linkedJobIds?.includes(job.id) ||
                                                    (job.invoice?.id && p.invoiceId === job.invoice.id)
                                                );

                                                const poNumber = job.poNumber || (job as any).workOrderNumber || job.invoice?.poNumber || relatedProposals.find((p: any) => p.poNumber)?.poNumber;
                                                const timeSummary = getJobTimeSummary(job);
                                                const formattedIn = timeSummary.formattedInTime;
                                                const formattedOut = timeSummary.formattedOutTime;
                                                const formattedDuration = timeSummary.formattedDuration;

                                                const techUser = employees.find(u => u.id === job.assignedTechnicianId);
                                                const isSubcontractor = !!(job.assignedPartnerId || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor'));

                                                return (
                                                    <tbody key={job.id} className="border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                        {/* Primary Row */}
                                                        <tr id={`history-job-${job.id}`}>
                                                            {/* 1. Site Location & Reference */}
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="flex flex-col gap-1 max-w-[230px]">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                            JOB-{job.id.replace('job-', '')}
                                                                        </span>
                                                                        {((job as any).jobType || (job as any).type) && (
                                                                            <span className="text-[10px] font-bold text-slate-500 truncate" title={(job as any).jobType || (job as any).type}>
                                                                                {(job as any).jobType || (job as any).type}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {(siteLocationName || siteAddress) && (
                                                                        <div className="pt-0.5 space-y-0.5">
                                                                            <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
                                                                                <MapPin size={9} className="text-indigo-500" /> Property / Location
                                                                            </span>
                                                                            {siteLocationName && (
                                                                                <strong className="text-slate-800 dark:text-slate-100 text-xs block truncate" title={siteLocationName}>
                                                                                    {siteLocationName}
                                                                                </strong>
                                                                            )}
                                                                            {siteAddress && (
                                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate" title={siteAddress}>
                                                                                    {siteAddress}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {poNumber && (
                                                                        <div className="pt-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: customer.id } });
                                                                                }}
                                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-xs font-mono"
                                                                                title="Click to view work order associations"
                                                                            >
                                                                                <Briefcase size={10} />
                                                                                <span>WO: {poNumber}</span>
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {job.tasks && job.tasks.length > 0 && (
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 italic mt-0.5">
                                                                            {job.tasks.join(', ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* 2. Appointment & Site Visit */}
                                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                <div className="flex flex-col gap-1 min-w-[170px]">
                                                                    <div>
                                                                        <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Scheduled Appt</span>
                                                                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                                                                            <Calendar size={13} className="text-primary-600 dark:text-sky-400 shrink-0" />
                                                                            <span>{new Date(job.appointmentTime || job.createdAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                                        </div>
                                                                        {job.appointmentTime && (
                                                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block ml-4">
                                                                                {new Date(job.appointmentTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {(formattedIn || formattedOut || formattedDuration) ? (
                                                                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5 mt-0.5">
                                                                            <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                                                                                <Clock size={9} /> Site Visit
                                                                            </span>
                                                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                                {formattedIn && <span className="text-emerald-700 dark:text-emerald-400">In: {formattedIn}</span>}
                                                                                {formattedOut && <span className="text-slate-600 dark:text-slate-400">Out: {formattedOut}</span>}
                                                                                {timeSummary.status === 'in_progress' && <span className="text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase animate-pulse">In Progress</span>}
                                                                            </div>
                                                                            {formattedDuration && (
                                                                                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 block">
                                                                                    Duration: {formattedDuration}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block pt-0.5">No check-in recorded</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* 3. Invoice & Doc Status */}
                                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                <div className="flex flex-col gap-1 max-w-[200px]">
                                                                    {/* Payment status pill & breakdown */}
                                                                    {(() => {
                                                                        const inv = job.invoice || (job as any).financials || {};
                                                                        const totalAmount = Number(inv.totalAmount || inv.amount || (job as any).totalCost || (job as any).estimatedCost || (job as any).quoteAmount || 0);

                                                                        let amountPaid = Number(inv.amountPaid ?? (job as any).amountPaid ?? 0);
                                                                        if (Array.isArray(inv.payments) && inv.payments.length > 0) {
                                                                            const sumP = inv.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                                                                            if (sumP > amountPaid) amountPaid = sumP;
                                                                        }

                                                                        const depositAmount = Number(inv.depositAmount || (job as any).depositAmount || 0);
                                                                        const isDepositPaid = inv.depositStatus === 'paid' || inv.depositPaid || (job as any).depositPaid;
                                                                        if (isDepositPaid && depositAmount > 0 && amountPaid < depositAmount) {
                                                                            amountPaid = depositAmount;
                                                                        }

                                                                        const isFullyPaid = inv.status === 'Paid' || (totalAmount > 0 && amountPaid >= totalAmount - 0.01);
                                                                        const remainingUnpaid = isFullyPaid ? 0 : Math.max(0, totalAmount - amountPaid);
                                                                        const isPartiallyPaid = !isFullyPaid && amountPaid > 0;

                                                                        return (
                                                                            <>
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs ${
                                                                                        isFullyPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' :
                                                                                        isPartiallyPaid ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800' :
                                                                                        inv.status === 'Unpaid' || inv.sentAt || totalAmount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800' :
                                                                                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                                    }`}>
                                                                                        {isFullyPaid ? `✓ Paid${totalAmount > 0 ? ` ($${totalAmount.toFixed(2)})` : ''}` :
                                                                                         isPartiallyPaid ? `Partially Paid` :
                                                                                         totalAmount > 0 ? `Unpaid ($${remainingUnpaid.toFixed(2)})` :
                                                                                         inv.status || 'No Invoice'}
                                                                                    </span>
                                                                                </div>

                                                                                {/* Partial / Deposit breakdown */}
                                                                                {isPartiallyPaid ? (
                                                                                    <div className="flex flex-col gap-0.5 text-[10px] bg-blue-50/80 dark:bg-blue-950/40 p-1.5 rounded-md border border-blue-200/60 dark:border-blue-800/50 my-0.5 shadow-xs">
                                                                                        <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-bold">
                                                                                            <span>{isDepositPaid ? 'Deposit Paid:' : 'Paid To Date:'}</span>
                                                                                            <span>${amountPaid.toFixed(2)}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-black">
                                                                                            <span>Unpaid Balance:</span>
                                                                                            <span>${remainingUnpaid.toFixed(2)}</span>
                                                                                        </div>
                                                                                        {totalAmount > 0 && (
                                                                                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[9px] pt-0.5 border-t border-blue-200/50 dark:border-blue-800/50">
                                                                                                <span>Total Invoice:</span>
                                                                                                <span>${totalAmount.toFixed(2)}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : !isFullyPaid && totalAmount > 0 && depositAmount > 0 && (
                                                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block truncate mt-0.5">
                                                                                        Deposit Req: ${depositAmount.toFixed(2)}
                                                                                    </span>
                                                                                )}

                                                                                {isFullyPaid && (inv.paidDate || inv.paymentMethod) && (
                                                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5">
                                                                                        {inv.paidDate ? `Paid ${new Date(inv.paidDate).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}` : ''}
                                                                                        {inv.paymentMethod ? ` (${inv.paymentMethod})` : ''}
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}

                                                                    {/* Sent Documents & Job Record Log */}
                                                                    <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                                                                        {/* Job Record Verification / Sent Status */}
                                                                        {job.jobRecordSignedOff || job.jobRecordSignedOffAt ? (
                                                                            <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1" title={job.jobRecordSignedOffBy ? `Verified by ${job.jobRecordSignedOffBy}` : 'Job Record Verified'}>
                                                                                <CheckCircle size={10} className="text-emerald-500 shrink-0" />
                                                                                <span>Job Record: <strong className="font-bold text-emerald-700 dark:text-emerald-400">{job.jobRecordSignedOffAt ? `Verified ${new Date(job.jobRecordSignedOffAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}` : 'Verified'}</strong></span>
                                                                            </span>
                                                                        ) : (job as any).sentAt || (job as any).workOrderSentAt ? (
                                                                            <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                                                                                <Send size={10} className="text-indigo-500 shrink-0" />
                                                                                <span>Job Record: <strong className="font-bold text-slate-800 dark:text-slate-200">Sent {new Date((job as any).sentAt || (job as any).workOrderSentAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}</strong></span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                                                                <Clock size={10} className="text-amber-500 shrink-0" />
                                                                                <span>Job Record: <strong className="font-normal text-slate-600 dark:text-slate-400">Pending Sign-off</strong></span>
                                                                            </span>
                                                                        )}

                                                                        {/* Invoice Sent */}
                                                                        {(() => {
                                                                            const invSentTime = job.invoice?.sentAt || (job as any).invoiceSentAt || (job.invoice as any)?.emailSentAt;
                                                                            if (!invSentTime) return null;
                                                                            const invDateStr = new Date(invSentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
                                                                            return (
                                                                                <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1" title={`Invoice sent ${new Date(invSentTime).toLocaleString()}`}>
                                                                                    <Send size={10} className="text-blue-500 shrink-0" />
                                                                                    <span>Invoice Sent: <strong className="font-bold text-slate-800 dark:text-slate-200">{invDateStr}</strong></span>
                                                                                </span>
                                                                            );
                                                                        })()}

                                                                        {/* Linked Proposals */}
                                                                        {relatedProposals.map((p: any) => {
                                                                            const propDisplay = resolveDocumentDisplayId('proposal', p).id;
                                                                            const sentTimestamp = p.sentAt || p.sentDate || (job as any).proposalSentAt || (p.status === 'Sent' || p.status === 'Opened' || p.status === 'Accepted' ? p.updatedAt : null);
                                                                            const dateStr = sentTimestamp ? new Date(sentTimestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' }) : null;
                                                                            return (
                                                                                <span key={`sent-prop-${p.id}`} className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                                                                                    <FileText size={10} className="text-purple-500 shrink-0" />
                                                                                    <span>Prop #{propDisplay}: <strong className="font-bold text-slate-800 dark:text-slate-200">{dateStr ? `Sent ${dateStr}` : (p.status || 'Draft')}</strong></span>
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* 4. Linked Documents */}
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                                    {renderJobDocuments(job)}
                                                                </div>
                                                            </td>

                                                            {/* 5. Status & Assignment */}
                                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                                                    {/* Status Selector */}
                                                                    <div>
                                                                        <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Status</span>
                                                                        <select 
                                                                            aria-label="Update Job Status"
                                                                            title="Update Job Status"
                                                                            value={job.jobStatus} 
                                                                            onChange={(e) => handleJobStatusChange(job, e.target.value)} 
                                                                            className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded p-1 w-full focus:ring-1 focus:ring-primary-500 font-bold"
                                                                        >
                                                                            <option value="Scheduled">Scheduled</option>
                                                                            <option value="In Progress">In Progress</option>
                                                                            <option value="Completed">Completed</option>
                                                                            <option value="Needs Follow-up">Needs Follow-up</option>
                                                                            <option value="Cancelled">Cancelled</option>
                                                                        </select>
                                                                    </div>

                                                                    {/* Technician Assignment */}
                                                                    <div>
                                                                        <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Assigned Tech</span>
                                                                        <select 
                                                                            aria-label="Assign Technician"
                                                                            title="Assign Technician"
                                                                            value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                                                            onChange={(e) => handleJobAssignmentChange(job, e.target.value)} 
                                                                            className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded p-1 w-full focus:ring-1 focus:ring-primary-500"
                                                                        >
                                                                            <option value="">Unassigned</option>
                                                                            <optgroup label="Internal Technicians">
                                                                                {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                                                            </optgroup>
                                                                            <optgroup label="Subcontractors & Partners">
                                                                                <option value="partner:generic_subcontractor">🏢 Subcontractor (Generic)</option>
                                                                                {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId || p.id}`}>{p.companyName} {!p.linkedOrgId ? '(Internal 1099)' : ''}</option>)}
                                                                            </optgroup>
                                                                        </select>
                                                                    </div>

                                                                    {job.assistants && job.assistants.length > 0 && (
                                                                        <div 
                                                                            className="text-[10px] text-slate-400 dark:text-slate-500 font-medium cursor-help flex items-center gap-1"
                                                                            title={job.assistants.map((id: string) => {
                                                                                const u = employees.find((user: any) => user.id === id);
                                                                                return u ? `${u.firstName} ${u.lastName}` : '';
                                                                            }).filter(Boolean).join(', ')}
                                                                        >
                                                                            <Users size={11} /> + {job.assistants.length} Crew Members
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Secondary Actions Sub-Row */}
                                                        <tr className="bg-slate-50/60 dark:bg-slate-900/30 border-t-0">
                                                            <td colSpan={5} className="px-4 py-2 border-t-0">
                                                                <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">Actions:</span>
                                                                    
                                                                    {/* View Details */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setSelectedJobForModal(job)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-[#123A63] dark:text-sky-300 hover:bg-slate-100 font-bold shadow-xs transition-colors"
                                                                        title="View Full Job Record & Work Details"
                                                                    >
                                                                        <Wrench size={12} />
                                                                        View Details
                                                                    </button>

                                                                    {/* Edit Job Appointment */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setEditingAppointmentJob(job)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100 font-bold shadow-xs transition-colors"
                                                                        title="Edit Appointment Details"
                                                                    >
                                                                        <Edit size={12} />
                                                                        Edit
                                                                    </button>

                                                                    {/* Invoice */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setEditingInvoiceJobId(job.id)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold shadow-xs transition-colors"
                                                                        title="Create or Manage Invoice"
                                                                    >
                                                                        <DollarSign size={12} />
                                                                        Invoice
                                                                    </button>

                                                                    {/* Send Email */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-bold shadow-xs transition-colors"
                                                                        title="Send Invoice or Job Record via Email"
                                                                    >
                                                                        <Mail size={12} />
                                                                        Send Email
                                                                    </button>

                                                                    {/* SMS */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setIsSendSmsModalOpen(true)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded text-[11px] text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-bold shadow-xs transition-colors"
                                                                        title="SMS Customer"
                                                                    >
                                                                        <MessageSquare size={12} />
                                                                        SMS
                                                                    </button>

                                                                    {/* Internal Notes */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setHistoryNotesJob(job);
                                                                            setHistoryInternalNotes((job as any).internalNotes || (job as any).notes || '');
                                                                        }} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold shadow-xs transition-colors"
                                                                        title="Manage Internal Notes"
                                                                    >
                                                                        <AlignLeft size={12} />
                                                                        Notes
                                                                    </button>

                                                                    {/* Associations */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setLinkingJob(job)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 rounded text-[11px] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 font-bold shadow-xs transition-colors"
                                                                        title="View & Associate Documents, Proposals, Invoices & Files"
                                                                    >
                                                                        <Link2 size={12} />
                                                                        Associations
                                                                    </button>

                                                                    {/* Copy Ref */}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleCopyJobRef(job.id)} 
                                                                        className="flex items-center gap-1 px-2 py-1 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold shadow-xs transition-colors"
                                                                        title="Copy JOB reference to clipboard"
                                                                    >
                                                                        <Copy size={12} />
                                                                        Copy Ref
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                );
                                            })
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Statement Header with Client & Account Summary */}
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="p-1.5 rounded-lg bg-[#123A63]/10 text-[#123A63] dark:text-sky-400">
                                                <DollarSign size={20} />
                                            </span>
                                            <h4 className="font-extrabold text-xl text-[#123A63] dark:text-sky-300 tracking-tight">Statement of Account</h4>
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                                                Terms: {customer.paymentTerms ? getPaymentTermsLabel(customer.paymentTerms) : 'Net 30'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap font-medium">
                                            <span>Client Code: <strong className="font-mono text-slate-700 dark:text-slate-200">{customer.id.slice(0, 8).toUpperCase()}</strong></span>
                                            <span>&bull;</span>
                                            <span>Account #: <strong className="font-mono text-[#123A63] dark:text-sky-400 font-bold">{customer.accountNumber || getOrGenerateAccountNumber(customer)}</strong></span>
                                            {customer.email && (
                                                <>
                                                    <span>&bull;</span>
                                                    <span>Email: <strong className="text-slate-700 dark:text-slate-200">{customer.email}</strong></span>
                                                </>
                                            )}
                                            {customer.phone && (
                                                <>
                                                    <span>&bull;</span>
                                                    <span>Phone: <strong className="text-slate-700 dark:text-slate-200">{customer.phone}</strong></span>
                                                </>
                                            )}
                                            <span>&bull;</span>
                                            <span>Date: <strong className="text-slate-700 dark:text-slate-200">{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong></span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0 w-full sm:w-auto">
                                        <button 
                                            type="button"
                                            onClick={() => setIsLogPaymentModalOpen(true)} 
                                            className="text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm hover:shadow-emerald-600/20 transition-all border-0 cursor-pointer whitespace-nowrap"
                                            title={t("Log Received Payment")}
                                        >
                                            <PlusCircle size={13}/> {t("Log Received Payment")}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setIsCreatePaymentLinkOpen(true)} 
                                            className="text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm hover:shadow-indigo-600/20 transition-all border-0 cursor-pointer whitespace-nowrap"
                                            title={t("Request Deposit / Payment Link")}
                                        >
                                            <DollarSign size={13}/> {t("Request Deposit / Payment Link")}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={handleDownloadPDF} 
                                            className="text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-lg shadow-sm border border-slate-600/50 dark:border-slate-700 transition-all cursor-pointer whitespace-nowrap"
                                            title={t("Download Statement PDF")}
                                        >
                                            <Download size={13}/> {t("Download PDF")}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setIsEmailStatementModalOpen(true)} 
                                            className="text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg shadow-sm hover:shadow-[#123A63]/20 transition-all border-0 cursor-pointer whitespace-nowrap"
                                            title={t("Email Statement of Account")}
                                        >
                                            <Mail size={13}/> {t("Email Statement")}
                                        </button>
                                    </div>
                                </div>

                                {/* Financial Summary Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-slate-200 dark:border-slate-855 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                                    <div className="p-4 text-center border-r border-slate-200 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-900/30">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Previous Balance</span>
                                        <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-1">$0.00</p>
                                    </div>
                                    <div className="p-4 text-center border-r border-slate-200 dark:border-slate-850">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">New Charges</span>
                                        <p className="text-base font-bold text-slate-800 dark:text-white mt-1">${statementTotals.totalBilled.toFixed(2)}</p>
                                    </div>
                                    <div className="p-4 text-center border-r border-slate-200 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-900/30">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Payments</span>
                                        <p className="text-base font-bold text-emerald-600 mt-1">-${statementTotals.totalPaid.toFixed(2)}</p>
                                    </div>
                                    <div className="p-4 text-center border-r border-slate-200 dark:border-slate-850">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Adjustments</span>
                                        <p className="text-base font-bold text-slate-800 dark:text-white mt-1">$0.00</p>
                                    </div>
                                    <div className="p-4 text-center bg-[#123A63]/5 dark:bg-sky-950/20">
                                        <span className="text-[9px] font-bold text-[#123A63] dark:text-sky-400 uppercase tracking-wider block font-extrabold">Amount Due</span>
                                        <p className="text-base font-black text-[#123A63] dark:text-sky-300 mt-1">${statementTotals.totalDue.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Statement Filters */}
                                <div className="flex flex-wrap justify-between items-center pt-2 gap-2">
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => { setStatementUnpaidOnly(false); setShowPaymentsLedger(false); }} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${!statementUnpaidOnly && !showPaymentsLedger ? 'bg-[#123A63] text-white border-[#123A63] shadow-sm' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-800 hover:bg-slate-50'}`}
                                        >
                                            Show All Activity
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => { setStatementUnpaidOnly(true); setShowPaymentsLedger(false); }} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${statementUnpaidOnly && !showPaymentsLedger ? 'bg-[#123A63] text-white border-[#123A63] shadow-sm' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-800 hover:bg-slate-50'}`}
                                        >
                                            Show Open Invoices Only
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPaymentsLedger(!showPaymentsLedger)} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${showPaymentsLedger ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-800 hover:bg-slate-50'}`}
                                        >
                                            <Receipt size={13} />
                                            Payment Receipts ({customerPayments.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Ledger / Receipts Table */}
                                {showPaymentsLedger ? (
                                    <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 animate-in fade-in duration-200">
                                        <div className="bg-slate-50/80 dark:bg-slate-850/50 px-4 py-3 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={16} className="text-emerald-600" />
                                                <span className="font-extrabold text-sm text-[#123A63] dark:text-sky-300">Customer Payment Receipts & Allocation History</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full">
                                                    {customerPayments.length} Total Receipts
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500 font-medium">Total Received: <strong className="text-emerald-600 font-mono font-bold">${statementTotals.totalPaid.toFixed(2)}</strong></span>
                                        </div>
                                        <div className="relative overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                                            <table className="w-full text-left border-separate border-spacing-0 text-xs">
                                                <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-xs">
                                                    <tr className="text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[9px] tracking-wider">
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Payment Date</th>
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Method</th>
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Check / Ref #</th>
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Applied Invoice</th>
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Property / Location</th>
                                                        <th className="px-4 py-3 text-right sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Amount Received</th>
                                                        <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Memo / Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                                                    {customerPayments.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No payment receipts recorded for this customer yet.</td>
                                                        </tr>
                                                    ) : (
                                                        customerPayments.map((p, pIdx) => (
                                                            <tr key={p.id || pIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                                <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800/40">{p.date || 'N/A'}</td>
                                                                <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100 dark:border-slate-800/40">
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                        {p.method || 'Check'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-350 font-bold border-b border-slate-100 dark:border-slate-800/40">{p.reference || '—'}</td>
                                                                <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100 dark:border-slate-800/40">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setEditingInvoiceJobId(p.jobId)} 
                                                                        className="text-xs text-[#123A63] hover:underline font-extrabold font-mono uppercase bg-transparent border-0 p-0 cursor-pointer"
                                                                    >
                                                                        #{p.invoiceId}
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-350 border-b border-slate-100 dark:border-slate-800/40">
                                                                    <div className="font-bold text-slate-800 dark:text-slate-100">{p.locationName || 'Main Office'}</div>
                                                                    {p.address && (
                                                                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 leading-tight">{p.address}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-450 font-mono text-sm border-b border-slate-100 dark:border-slate-800/40">${(Number(p.amount) || 0).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-slate-500 text-xs italic border-b border-slate-100 dark:border-slate-800/40">{p.notes || '—'}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative overflow-x-auto overflow-y-auto max-h-[550px] sm:max-h-[650px] custom-scrollbar rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                                        <table className="w-full text-left border-separate border-spacing-0 text-xs">
                                            <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-xs">
                                                <tr className="text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[9px] tracking-wider">
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Date</th>
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Invoice #</th>
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Property Location</th>
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Reference / PO #</th>
                                                    <th className="px-4 py-3 text-right sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Debit (Dr)</th>
                                                    <th className="px-4 py-3 text-right sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Credit (Cr)</th>
                                                    <th className="px-4 py-3 text-right sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Balance</th>
                                                    <th className="px-4 py-3 text-right sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Running Bal</th>
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Due Date</th>
                                                    <th className="px-4 py-3 sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                                                    <th className="px-4 py-3 text-center sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Linked Documents</th>
                                                    <th className="px-4 py-3 text-center sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Actions</th>
                                                </tr>
                                            </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                                                    {statementJobs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={11} className="px-4 py-8 text-center text-slate-400 italic">No transactions found for this customer.</td>
                                                        </tr>
                                                    ) : (
                                                        statementJobs.map((tx, idx) => {
                                                            const job = tx.job;
                                                            const inv = tx.invoice || {};
                                                            const amount = tx.total;
                                                            const clampedPaid = tx.paid;
                                                            const remaining = tx.balance;
                                                            const isPaid = inv.status === 'Paid' || (amount > 0 && remaining <= 0.01);
                                                            const isPartiallyPaid = !isPaid && (inv.status === 'Partially Paid' || (clampedPaid > 0 && remaining > 0.01));
                                                            const effectiveStatus = isPaid ? 'Paid' : isPartiallyPaid ? 'Partially Paid' : (inv.status || 'Unpaid');
                                                            
                                                            return (
                                                                <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800/40">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100 dark:border-slate-800/40">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => setEditingInvoiceJobId(job.id)} 
                                                                            className="text-xs text-[#123A63] hover:underline font-extrabold font-mono uppercase bg-transparent border-0 p-0 cursor-pointer"
                                                                        >
                                                                            #{inv.id || job.id.slice(0, 8)}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-350 border-b border-slate-100 dark:border-slate-800/40">
                                                                        {(() => {
                                                                            const loc = customer.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);
                                                                            const siteLocName = resolveSiteLocationName(job, loc) || 'Main Office';
                                                                            const siteAddress = formatFullAddress(job.address || loc?.address || customer.address || '');
                                                                            return (
                                                                                <>
                                                                                    <div className="font-bold text-slate-800 dark:text-slate-100">{siteLocName}</div>
                                                                                    {siteAddress && (
                                                                                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 leading-tight">{siteAddress}</div>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px] border-b border-slate-100 dark:border-slate-800/40">{job.poNumber || 'N/A'}</td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/40">${amount.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-450 border-b border-slate-100 dark:border-slate-800/40">
                                                                        <div>${clampedPaid.toFixed(2)}</div>
                                                                        {Array.isArray(inv.payments) && inv.payments.length > 0 && (
                                                                            <div className="text-[9px] font-normal text-slate-500 dark:text-slate-400 mt-0.5 space-y-0.5">
                                                                                {inv.payments.map((p: any, pIdx: number) => (
                                                                                    <div key={p.id || pIdx} className="truncate" title={`${p.method || 'Payment'}${p.reference ? ` #${p.reference}` : ''}: $${Number(p.amount).toFixed(2)} on ${p.date || 'N/A'}`}>
                                                                                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">${Number(p.amount).toFixed(2)}</span>
                                                                                        <span className="text-[8px] text-slate-400 ml-1">({p.method || 'Pay'}{p.reference ? ` #${p.reference}` : ''})</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/40">${remaining.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/40">${tx.runningBalance?.toFixed(2) || '0.00'}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800/40">{inv.dueDate ? new Date(inv.dueDate.replace(/-/g, '/')).toLocaleDateString() : 'N/A'}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100 dark:border-slate-800/40">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                            isPaid 
                                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                                : isPartiallyPaid
                                                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200'
                                                                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                                                        }`}>{effectiveStatus}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center border-b border-slate-100 dark:border-slate-800/40">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            {renderJobDocuments(job)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center whitespace-nowrap border-b border-slate-100 dark:border-slate-800/40">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => setSendInvoiceModalConfig({ isOpen: true, job })}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                            title={t("Send Invoice")}
                                                                        >
                                                                            <Send size={10} />
                                                                            {t("Send Invoice")}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                )}

                                {/* Aging Summary box */}
                                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-[#123A63] dark:text-sky-400 uppercase tracking-widest block">Aging Analysis (Open Receivables)</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">As of Today</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Current</span>
                                            <p className={`text-sm font-bold mt-1 ${statementTotals.aging.current > 0 ? 'text-slate-800 dark:text-slate-100 font-extrabold' : 'text-slate-700 dark:text-slate-250'}`}>${statementTotals.aging.current.toFixed(2)}</p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">1 - 30 Days</span>
                                            <p className={`text-sm font-bold mt-1 ${statementTotals.aging.days30 > 0 ? 'text-amber-600 dark:text-amber-450 font-extrabold' : 'text-slate-700 dark:text-slate-250'}`}>${statementTotals.aging.days30.toFixed(2)}</p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">31 - 60 Days</span>
                                            <p className={`text-sm font-bold mt-1 ${statementTotals.aging.days60 > 0 ? 'text-amber-600 dark:text-amber-450 font-extrabold' : 'text-slate-750 dark:text-slate-250'}`}>${statementTotals.aging.days60.toFixed(2)}</p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">61 - 90 Days</span>
                                            <p className={`text-sm font-bold mt-1 ${statementTotals.aging.days90 > 0 ? 'text-rose-600 dark:text-rose-450 font-extrabold' : 'text-slate-750 dark:text-slate-250'}`}>${statementTotals.aging.days90.toFixed(2)}</p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">90+ Days</span>
                                            <p className={`text-sm font-bold mt-1 ${statementTotals.aging.older > 0 ? 'text-rose-600 dark:text-rose-450 font-extrabold' : 'text-slate-750 dark:text-slate-250'}`}>${statementTotals.aging.older.toFixed(2)}</p>
                                        </div>
                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/60 text-center shadow-sm">
                                            <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase block">&gt; 45 Days</span>
                                            <p className={`text-sm font-black mt-1 ${statementTotals.aging.over45 > 0 ? 'text-rose-700 dark:text-rose-300 font-black' : 'text-slate-400'}`}>${statementTotals.aging.over45.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment & Remittance Instructions */}
                                <PaymentInstructionsCard 
                                    organization={state.currentOrganization}
                                    className="mt-4"
                                    title="Remittance & Payment Instructions (Wire, Check, ACH)"
                                    description="Customer remittance information configured by organization settings:"
                                />

                                <hr className="border-slate-200 dark:border-slate-800 my-6" />

                                {/* Active Membership Section */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <ShieldCheck size={18} className="text-purple-600" />
                                            <span>Active Membership &amp; Service Club</span>
                                        </h4>
                                        {!membership && (
                                            <Button 
                                                onClick={() => setIsEnrolling(!isEnrolling)} 
                                                className="w-auto text-xs py-1 flex items-center gap-1 bg-purple-600 hover:bg-purple-700"
                                            >
                                                <Sparkles size={14}/> Enroll Customer
                                            </Button>
                                        )}
                                    </div>

                                    {isEnrolling && (
                                        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-200 dark:border-purple-800 animate-fade-in mb-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <p className="text-xs font-bold text-purple-700 uppercase">Choose Plan for Staff Enrollment</p>
                                            </div>
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1">
                                                    <Input 
                                                        type="number" 
                                                        label="Number of Systems" 
                                                        min="1" 
                                                        value={enrollSystemCount.toString()} 
                                                        onChange={(e) => setEnrollSystemCount(Math.max(1, parseInt(e.target.value) || 1))} 
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Input 
                                                        type="number" 
                                                        label="Price Override ($)" 
                                                        placeholder="Optional custom price" 
                                                        value={priceOverride.toString()} 
                                                        onChange={(e) => setPriceOverride(e.target.value ? parseFloat(e.target.value) : '')} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 gap-3">
                                                {state.membershipPlans.map(plan => (
                                                    <button 
                                                        key={plan.id}
                                                        onClick={() => handleManualEnroll(plan)}
                                                        className="p-3 bg-white dark:bg-gray-800 border-2 border-purple-100 dark:purple-800 rounded-lg hover:border-purple-500 text-left transition-all cursor-pointer"
                                                    >
                                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{plan.name}</p>
                                                        <p className="text-xs text-primary-600 font-bold">${plan.monthlyPrice}/mo base</p>
                                                        {((plan.addonFeeAmount || 0) > 0 || (plan.addonFeePercent || 0) > 0) && (
                                                            <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                                                +{plan.addonFeeName || 'Fee'}: {
                                                                    (plan.addonFeeAmount || 0) > 0 && (plan.addonFeePercent || 0) > 0
                                                                        ? `${plan.addonFeeAmount.toFixed(2)} + ${plan.addonFeePercent}%`
                                                                        : (plan.addonFeeAmount || 0) > 0
                                                                            ? `${plan.addonFeeAmount.toFixed(2)}`
                                                                            : `${plan.addonFeePercent}%`
                                                                }
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-gray-400 mt-1">{plan.visitsPerYear} Visits • {plan.discountPercentage}% Off</p>
                                                    </button>
                                                ))}
                                            </div>
                                            <button onClick={() => setIsEnrolling(false)} className="text-xs text-gray-500 mt-3 hover:underline">Cancel Enrollment</button>
                                        </div>
                                    )}

                                    {membership ? (
                                        <div className={`p-4 rounded border flex justify-between items-center ${
                                            isRecurringMembership(membership)
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                                : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${
                                                    isRecurringMembership(membership)
                                                        ? 'bg-green-100 dark:bg-green-800 text-green-600'
                                                        : 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300'
                                                }`}>
                                                    <ShieldCheck size={20}/>
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold ${
                                                        isRecurringMembership(membership)
                                                            ? 'text-green-800 dark:text-green-300'
                                                            : 'text-indigo-900 dark:text-indigo-200'
                                                    }`}>
                                                        {membership.planName || (isRecurringMembership(membership) ? 'Active Membership' : 'Commercial Service Agreement')}
                                                    </h4>
                                                    <p className={`text-xs ${
                                                        isRecurringMembership(membership)
                                                            ? 'text-green-700 dark:text-green-400'
                                                            : 'text-indigo-700 dark:text-indigo-400'
                                                    }`}>
                                                        Valid: {formatAgreementDate(membership)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                                                    isRecurringMembership(membership)
                                                        ? 'bg-green-200 text-green-800'
                                                        : 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                                                }`}>ACTIVE</span>
                                                {isRecurringMembership(membership) ? (
                                                    <p className="text-xs text-green-600 font-bold mt-1">{membership.visitsRemaining} Visits Left</p>
                                                ) : (
                                                    <p className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold mt-1">Non-MRR Contract</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : !isEnrolling && (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 italic">
                                            No active membership plan found.
                                        </div>
                                    )}
                                </div>
                            </div>
                    )}

                    {activeTab === 'warranties' && (
                        <div 
                            onDragEnter={handleDragWarranties}
                            onDragOver={handleDragWarranties}
                            onDragLeave={handleDragWarranties}
                            onDrop={handleDropWarranties}
                            className="space-y-6 relative"
                        >
                            {dragActiveWarranties && (
                                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-primary-500 rounded-2xl p-6 text-center animate-fade-in">
                                    <div className="p-4 bg-primary-500/10 rounded-full border border-primary-500/30 mb-3 animate-bounce">
                                        <Upload className="w-10 h-10 text-primary-500" />
                                    </div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider">Drop here to upload Warranty Document</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports images and PDFs</p>
                                </div>
                            )}
                            <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-gray-900 dark:text-white">Manufacturer Warranty Claims & Docs</h4>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => setIsRegisteringWarranty(!isRegisteringWarranty)} className="bg-primary-600 hover:bg-primary-700">
                                        <PlusCircle size={16} className="mr-1" />
                                        Register Warranty
                                    </Button>
                                    <label className="cursor-pointer bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 border border-primary-200 dark:border-primary-800">
                                        <Upload size={16} />
                                        Upload Document
                                        <input type="file" onChange={(e) => handleFileUpload(e, 'warranty')} className="hidden" accept="image/*,application/pdf" />
                                    </label>
                                </div>
                            </div>
                            
                            {isRegisteringWarranty && (
                                <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800 mb-6 animate-fade-in">
                                    <h5 className="font-bold text-sm text-primary-800 dark:text-primary-300 mb-3">Register Equipment Warranty</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <Select 
                                            label="Select Equipment" 
                                            value={warrantyRegistration.equipmentId} 
                                            onChange={(e) => setWarrantyRegistration({...warrantyRegistration, equipmentId: e.target.value})}
                                        >
                                            <option value="">Select equipment...</option>
                                            {(customer.equipment || []).map(eq => (
                                                <option key={eq.id} value={eq.id}>{`${eq.brand} ${eq.model} (${eq.serial})`}</option>
                                            ))}
                                        </Select>
                                        <Input 
                                            type="date"
                                            label="Installation / Start Date" 
                                            value={warrantyRegistration.manufacturerStartDate} 
                                            onChange={(e) => setWarrantyRegistration({...warrantyRegistration, manufacturerStartDate: e.target.value})} 
                                        />
                                        <Input 
                                            type="number"
                                            label="Duration (Months)" 
                                            value={warrantyRegistration.manufacturerDurationMonths.toString()} 
                                            onChange={(e) => setWarrantyRegistration({...warrantyRegistration, manufacturerDurationMonths: parseInt(e.target.value) || 0})} 
                                        />
                                        <Input 
                                            label="Warranty Notes / Terms" 
                                            value={warrantyRegistration.warrantyNotes} 
                                            onChange={(e) => setWarrantyRegistration({...warrantyRegistration, warrantyNotes: e.target.value})} 
                                            placeholder="e.g. Requires annual maintenance"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" onClick={() => setIsRegisteringWarranty(false)} className="text-xs h-8">Cancel</Button>
                                        <Button onClick={handleSaveWarrantyRegistration} className="text-xs h-8">Save Registration</Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 border-b pb-2 dark:border-slate-700">Registered Equipment Warranties</h5>
                                    {customer.equipment?.filter(e => e.warranty?.manufacturerDurationMonths).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">No equipment warranties registered.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {customer.equipment?.filter(e => e.warranty?.manufacturerDurationMonths).map(eq => (
                                                <div key={eq.id} className="p-3 bg-white dark:bg-slate-800 border rounded text-sm shadow-sm">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white">{eq.brand} {eq.model}</p>
                                                            <p className="text-xs text-slate-500 mb-2">S/N: {eq.serial}</p>
                                                        </div>
                                                        <button 
                                                            onClick={async () => {
                                                                if (!await globalConfirm("Remove this warranty?")) return;
                                                                const updatedEq = (customer.equipment || []).map((e: any) => 
                                                                    e.id === eq.id ? { ...e, warranty: undefined } : e
                                                                );
                                                                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: updatedEq }));
                                                                dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEq } });
                                                                showToast.success("Warranty removed.");
                                                            }}
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Warranty"
                                                        >
                                                            <TrashIcon size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-4 text-xs">
                                                        <span className="font-medium text-emerald-600">Start: {eq.warranty?.manufacturerStartDate}</span>
                                                        <span className="font-medium text-blue-600">Duration: {eq.warranty?.manufacturerDurationMonths} mo</span>
                                                    </div>
                                                    {eq.warranty?.warrantyNotes && <p className="text-xs text-slate-500 mt-1 italic">{eq.warranty.warrantyNotes}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 border-b pb-2 dark:border-slate-700">Warranty Documents</h5>
                                    {customerFiles.filter(f => f.metadata?.category === 'warranty').length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">No warranty documents uploaded.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {customerFiles.filter(f => f.metadata?.category === 'warranty').map(file => (
                                                <div 
                                                    key={file.id} 
                                                    className="relative group bg-slate-100 dark:bg-slate-700 rounded h-24 overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm"
                                                >
                                                    <button type="button" onClick={() => setViewingFile(file)} className="absolute inset-0 w-full h-full text-left cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all z-0 outline-none" title="View Document" aria-label="View Document">
                                                        {file.fileType.includes('image') ? (
                                                            <img src={file.dataUrl || (file as any).url} alt={file.fileName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-500 p-2 text-center">
                                                                <FileText size={20} className="mb-1 text-slate-400"/>
                                                                <span className="truncate w-full">{file.fileName}</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] p-2 text-center pointer-events-none">
                                                            <p className="font-bold truncate w-full">{file.fileName}</p>
                                                            <p className="opacity-75">{new Date(file.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteFile(file, e)}
                                                        className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10 opacity-0 group-hover:opacity-100"
                                                        title="Delete Document"
                                                        aria-label="Delete Document"
                                                    >
                                                        <TrashIcon size={12}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6">
                                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 border-b pb-2 dark:border-slate-700">Active Claims</h5>
                                {customerWarranties.length === 0 ? (
                                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
                                        <ShieldCheck size={32} className="mx-auto mb-2 text-gray-300" />
                                        No manufacturer warranty claims found for this customer.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {customerWarranties.map(claim => {
                                            const equipment = customer.equipment?.find(e => e.id === claim.equipmentId);
                                            return (
                                            <div key={claim.id} className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded flex flex-col md:flex-row justify-between gap-4 shadow-sm">
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900 dark:text-white">{equipment?.model || 'Unknown Model'}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Mfr: {equipment?.brand || 'Unknown'} | Serial: {equipment?.serial || 'N/A'}</p>
                                                    {claim.rmaNumber && <p className="text-xs font-mono mt-2 text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 inline-block px-1.5 py-0.5 rounded border border-primary-200 dark:border-primary-800">RMA: {claim.rmaNumber}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                                        claim.status === 'Approved' || claim.status === 'Credit Received' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                                        claim.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                                        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                                    }`}>
                                                        {claim.status}
                                                    </span>
                                                    <p className="font-black text-lg text-gray-900 dark:text-white mt-1">${(claim.amountClaimed || 0).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                                <WarrantySection 
                                    jobs={customerJobs} 
                                    customer={customer}
                                    organization={state.currentOrganization}
                                    onIssueNewWarranty={() => setIsIssueWarrantyOpen(true)}
                                    onAcceptWarranty={async (job) => {
                                        const inv = job.invoice as any;
                                        const updatedJob = {
                                            ...job,
                                            invoice: {
                                                ...inv,
                                                warrantyDisclaimerAgreed: true,
                                                warrantyAgreedAt: new Date().toISOString(),
                                                warrantyAgreedBy: 'Staff'
                                            }
                                        };
                                        try {
                                            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ invoice: updatedJob.invoice }));
                                            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                                            showToast.success("Staff acknowledged warranty disclaimer for customer.");
                                        } catch (e) {
                                            showToast.error("Failed to accept warranty.");
                                            console.error(e);
                                        }
                                    }} 
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'communications' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center flex-wrap gap-3">
                                <div>
                                    <h3 className="font-bold text-gray-950 dark:text-white text-lg">Communications & Lifecycle Log</h3>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {communicationTimeline.length} total events tracked
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button 
                                        type="button"
                                        onClick={() => setIsSendEmailModalOpen(true)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md rounded-xl"
                                    >
                                        <Mail size={14} />
                                        {t("Send Email")}
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setIsSendSmsModalOpen(true)}
                                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md rounded-xl"
                                    >
                                        <MessageSquare size={14} />
                                        {t("Send SMS")}
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setIsCreatePaymentLinkOpen(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md rounded-xl"
                                    >
                                        <DollarSign size={14} />
                                        {t("Request Deposit")}
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setIsLogCallModalOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md rounded-xl"
                                    >
                                        <PhoneCall size={14} />
                                        {t("Log Call / Recording")}
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={handleSyncRcCallerId}
                                        disabled={isSyncingRc}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md rounded-xl"
                                    >
                                        <PhoneCall size={14} className={isSyncingRc ? 'animate-spin' : ''} />
                                        {isSyncingRc ? t("Syncing Caller ID...") : t("Sync Caller ID to RingCentral")}
                                    </Button>
                                </div>
                            </div>

                            {communicationTimeline.length === 0 ? (
                                <div className="p-12 text-center bg-white/50 dark:bg-slate-900/40 backdrop-blur-md border border-slate-100 dark:border-slate-800 rounded-2xl">
                                    <MessageSquare size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                                    <p className="font-bold text-slate-700 dark:text-slate-300">No communication logs recorded yet</p>
                                    <p className="text-sm text-slate-400 mt-1">SMS, calls, emails, and schedule updates will be tracked automatically here.</p>
                                </div>
                            ) : (
                                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-8 py-2">
                                    {communicationTimeline.map((item: any) => {
                                        const ItemIcon = item.icon;
                                        return (
                                            <div key={item.id} className="relative group animate-in fade-in slide-in-from-left-2 duration-300">
                                                {/* Bullet dot */}
                                                <span className={`absolute -left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 ring-4 ring-slate-50 dark:ring-slate-900 border-2 shadow-sm ${item.iconColor.replace('text-', 'border-')}`}>
                                                    <ItemIcon size={14} className={item.iconColor} />
                                                </span>

                                                {/* Premium Card */}
                                                <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/50 hover:bg-white/95 dark:hover:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700/60 p-4 rounded-xl shadow-sm transition-all duration-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.title}</h4>
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${item.badgeColor}`}>
                                                                {item.badgeLabel}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                                            {new Date(item.timestamp).toLocaleString(undefined, {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    {item.subtitle && (
                                                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">
                                                            {item.subtitle}
                                                        </p>
                                                    )}

                                                    {item.content && (
                                                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100/50 dark:border-slate-900/50 font-normal max-h-36 overflow-hidden relative">
                                                            {item.content.length > 250 ? `${item.content.slice(0, 250)}...` : item.content}
                                                        </div>
                                                    )}

                                                    {item.recordingUrl && (
                                                        <div className="mt-2.5 bg-slate-100/50 dark:bg-slate-950/30 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/80 flex flex-col gap-1.5">
                                                            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                                                <span>Call Recording</span>
                                                                {item.duration !== undefined && <span>{Math.floor(item.duration / 60)}m {item.duration % 60}s</span>}
                                                            </div>
                                                            <audio 
                                                                controls 
                                                                preload="none" 
                                                                className="w-full h-8 outline-none mt-1"
                                                                src={item.recordingUrl}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Full Word-for-Word Link Button */}
                                                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCommForFullView(item)}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                                        >
                                                            <FileText size={13} />
                                                            {t("View Full Word-for-Word Conversation")}
                                                        </button>
                                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                                            {item.content ? `${item.content.split(/\s+/).length} words` : 'Details'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'maintenance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Alert for Overdue Visits */}
                            {customer.maintenanceAgreement && customer.maintenanceAgreement.visits && customer.maintenanceAgreement.visits.some((v: any) => {
                                const status = getVisitStatus(v);
                                return status === 'Overdue';
                            }) && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm">Upcoming or Overdue Maintenance Actions Required</p>
                                        <p className="text-xs opacity-90">One or more preventative maintenance visits are currently overdue. Please dispatch a technician to keep the commercial agreement compliant.</p>
                                    </div>
                                </div>
                            )}

                            {!customer.maintenanceAgreement && !isEditingAgreement ? (
                                <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                                    <Calendar size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">No Active Maintenance Agreement</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                                        Establish a structured commercial preventative maintenance plan to track recurring visits, cover building equipment assets, lock in payment terms, and notify customers automatically.
                                    </p>
                                    <Button 
                                        onClick={() => setIsEditingAgreement(true)} 
                                        className="mt-6 bg-primary-600 text-white hover:bg-primary-700 font-semibold px-6 py-2.5 rounded-xl shadow-md border-none"
                                    >
                                        Create Commercial Agreement
                                    </Button>
                                </div>
                            ) : isEditingAgreement ? (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                            {customer.maintenanceAgreement ? 'Edit Maintenance Agreement' : 'New Commercial Agreement'}
                                        </h3>
                                        <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold rounded-full">
                                            {agreementFormData.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Field 1: Agreement Name */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agreement Name</label>
                                            <Input 
                                                value={agreementFormData.agreementName}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, agreementName: e.target.value }))}
                                                placeholder="e.g. Commercial RTU Maintenance Plan"
                                            />
                                        </div>

                                        {/* Field 2: Status */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agreement Status</label>
                                            <Select
                                                value={agreementFormData.status}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, status: e.target.value }))}
                                            >
                                                <option value="Draft">Draft</option>
                                                <option value="Active">Active</option>
                                                <option value="Cancelled">Cancelled</option>
                                                <option value="Expired">Expired</option>
                                            </Select>
                                        </div>

                                        {/* Field 3: Agreement Total Value */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agreement Annual Value ($)</label>
                                            <Input 
                                                type="number"
                                                value={agreementFormData.value}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>

                                        {/* Field 4: Start Date */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                                            <Input 
                                                type="date"
                                                value={agreementFormData.startDate}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, startDate: e.target.value }))}
                                            />
                                        </div>

                                        {/* Field 5: End Date */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Date</label>
                                            <Input 
                                                type="date"
                                                value={agreementFormData.endDate}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, endDate: e.target.value }))}
                                            />
                                        </div>

                                        {/* Field 6: Billing Cycle */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Billing Frequency</label>
                                            <Select
                                                value={agreementFormData.billingFrequency}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, billingFrequency: e.target.value }))}
                                            >
                                                <option value="One-Time">One-Time</option>
                                                <option value="Monthly">Monthly</option>
                                                <option value="Quarterly">Quarterly</option>
                                                <option value="Semi-Annually">Semi-Annually</option>
                                                <option value="Annually">Annually</option>
                                            </Select>
                                        </div>

                                        {/* Field 7: Payment Terms */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Terms</label>
                                            <Select
                                                value={agreementFormData.paymentTerms}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, paymentTerms: e.target.value }))}
                                            >
                                                <option value="due_on_receipt">Due on Receipt</option>
                                                <option value="net_7">Net 7</option>
                                                <option value="net_15">Net 15</option>
                                                <option value="net_30">Net 30</option>
                                                <option value="net_45">Net 45</option>
                                                <option value="net_60">Net 60</option>
                                                <option value="net_90">Net 90</option>
                                            </Select>
                                        </div>

                                        {/* Field 8: Service Interval Frequency */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maintenance Visit Frequency</label>
                                            <Select
                                                value={agreementFormData.frequency}
                                                onChange={e => setAgreementFormData((p: any) => ({ ...p, frequency: e.target.value }))}
                                            >
                                                <option value="Monthly">Monthly</option>
                                                <option value="Bi-Monthly">Bi-Monthly</option>
                                                <option value="Quarterly">Quarterly</option>
                                                <option value="Semi-Annually">Semi-Annually</option>
                                                <option value="Annually">Annually</option>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Checklist for Covered Items */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Agreed Covered Service Items</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(agreementFormData.coveredItems || []).map((item: string, idx: number) => (
                                                <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg border border-slate-200 dark:border-slate-700 font-medium">
                                                    {item}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setAgreementFormData((p: any) => ({ ...p, coveredItems: p.coveredItems.filter((_: any, i: number) => i !== idx) }))}
                                                        className="text-red-500 hover:text-red-700 font-bold ml-1 outline-none"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 max-w-md">
                                            <Input 
                                                value={newCoveredItem}
                                                onChange={e => setNewCoveredItem(e.target.value)}
                                                placeholder="Add service task (e.g. Coil Wash, Belt change)..."
                                                className="text-xs"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (newCoveredItem.trim()) {
                                                            setAgreementFormData((p: any) => ({ ...p, coveredItems: [...(p.coveredItems || []), newCoveredItem.trim()] }));
                                                            setNewCoveredItem('');
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button 
                                                onClick={() => {
                                                    if (newCoveredItem.trim()) {
                                                        setAgreementFormData((p: any) => ({ ...p, coveredItems: [...(p.coveredItems || []), newCoveredItem.trim()] }));
                                                        setNewCoveredItem('');
                                                    }
                                                }}
                                                variant="secondary"
                                                className="text-xs px-4"
                                            >
                                                Add Task
                                            </Button>
                                        </div>
                                    </div>

                                    {/* covered equipment list */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Covered Equipment Units</label>
                                            <div className="flex gap-4 text-xs font-semibold">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setAgreementFormData((p: any) => ({ ...p, coveredEquipmentIds: (customer.equipment || []).map((e: any) => e.id) }))}
                                                    className="text-primary-600 hover:underline"
                                                >
                                                    Select All
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setAgreementFormData((p: any) => ({ ...p, coveredEquipmentIds: [] }))}
                                                    className="text-slate-500 hover:underline"
                                                >
                                                    Select None
                                                </button>
                                            </div>
                                        </div>

                                        {(!customer.equipment || customer.equipment.length === 0) ? (
                                            <p className="text-xs text-slate-500">No equipment units registered for this customer yet. Please add equipment units in the Equipment tab first.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                {customer.equipment.map((eq: any) => {
                                                    const isChecked = agreementFormData.coveredEquipmentIds?.includes(eq.id);
                                                    return (
                                                        <label 
                                                            key={eq.id} 
                                                            className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                                                isChecked ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/10' : 'border-slate-200 dark:border-slate-800'
                                                            }`}
                                                        >
                                                            <input 
                                                                type="checkbox"
                                                                className="mt-0.5 border-slate-300 rounded text-primary-600"
                                                                checked={isChecked || false}
                                                                onChange={() => {
                                                                    const current = agreementFormData.coveredEquipmentIds || [];
                                                                    const next = current.includes(eq.id) 
                                                                        ? current.filter((id: string) => id !== eq.id)
                                                                        : [...current, eq.id];
                                                                    setAgreementFormData((p: any) => ({ ...p, coveredEquipmentIds: next }));
                                                                }}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{eq.type} ({eq.brand})</p>
                                                                <p className="text-[10px] text-slate-400 font-mono truncate">S/N: {eq.serial} | Loc: {eq.physicalLocation || 'N/A'}</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Special Notes / Agreement Terms</label>
                                        <Textarea 
                                            value={agreementFormData.notes || ''}
                                            onChange={e => setAgreementFormData((p: any) => ({ ...p, notes: e.target.value }))}
                                            placeholder="Specify emergency response parameters, custom labor discount, parts coverage exclusions, filter sizes..."
                                            rows={3}
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-6">
                                        <Button 
                                            onClick={handleGenerateNewSchedule}
                                            variant="secondary"
                                            className="text-xs border border-primary-500 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20"
                                        >
                                            Generate Visit Slots ({agreementFormData.frequency})
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" onClick={() => setIsEditingAgreement(false)}>Cancel</Button>
                                            <Button onClick={handleSaveAgreement} className="bg-primary-600 hover:bg-primary-700 text-white font-bold border-none">
                                                Save Agreement
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Agreement Overview Header */}
                                    <div className="backdrop-blur-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-black text-slate-800 dark:text-white">{customer.maintenanceAgreement.agreementName}</h3>
                                                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                                                    customer.maintenanceAgreement.status === 'Active' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                                }`}>
                                                    {customer.maintenanceAgreement.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 font-semibold">
                                                Term: {customer.maintenanceAgreement.startDate} to {customer.maintenanceAgreement.endDate} &bull; Service Frequency: {customer.maintenanceAgreement.frequency}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 flex-wrap shrink-0">
                                            <Button onClick={handlePrintAgreement} variant="secondary" className="text-xs flex items-center gap-2 p-2 px-3">
                                                <Printer size={14} /> Print Copy
                                            </Button>
                                            <Button onClick={() => setIsEditingAgreement(true)} variant="secondary" className="text-xs flex items-center gap-2 p-2 px-3">
                                                <Edit size={14} /> Edit Agreement
                                            </Button>
                                            <Button onClick={handleDeleteAgreement} className="bg-red-700 text-white hover:bg-red-800 border-none text-xs p-2 px-3 font-semibold shadow-md">
                                                Delete Plan
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Grid of Agreement Terms */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agreement Value</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-white mt-1">${(customer.maintenanceAgreement.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Cycle</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-white mt-1">{customer.maintenanceAgreement.billingFrequency}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Terms</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-white mt-1 capitalize">{customer.maintenanceAgreement.paymentTerms.replace('_', ' ')}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Covered Equipment</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-white mt-1">{(customer.maintenanceAgreement.coveredEquipmentIds || []).length} Units</p>
                                        </div>
                                    </div>

                                    {/* Covered Service Items */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agreed Scope of Covered Tasks</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {(customer.maintenanceAgreement.coveredItems || []).map((item: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-primary-50/40 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-bold rounded-lg border border-primary-100 dark:border-primary-900">
                                                    &check; {item}
                                                </span>
                                            ))}
                                            {(customer.maintenanceAgreement.coveredItems || []).length === 0 && (
                                                <p className="text-xs text-slate-500">No specific covered items highlighted.</p>
                                            )}
                                        </div>
                                        {customer.maintenanceAgreement.notes && (
                                            <div className="mt-3 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-900 italic">
                                                <strong>Terms Note:</strong> {customer.maintenanceAgreement.notes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Covered Equipment List Grid */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Covered Equipment Units Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {(customer.equipment || [])
                                                .filter((eq: any) => customer.maintenanceAgreement.coveredEquipmentIds?.includes(eq.id))
                                                .map((eq: any) => (
                                                    <div key={eq.id} className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 rounded-xl relative shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                                        <span className="absolute top-3 right-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                                                            {eq.condition || 'N/A'}
                                                        </span>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{eq.type}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{eq.brand} - {eq.model}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-2">S/N: {eq.serial}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">Location: {eq.physicalLocation || 'Main site'}</p>
                                                    </div>
                                                ))}
                                            {(customer.maintenanceAgreement.coveredEquipmentIds || []).length === 0 && (
                                                <p className="text-xs text-slate-500 col-span-3">No equipment units designated as covered under this agreement.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Visits Schedule Grid */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maintenance Service visits schedule & Dispatching</h4>
                                            <Button onClick={handleAddManualVisit} variant="secondary" className="text-xs p-1 px-3 flex items-center gap-1.5">
                                                <PlusCircle size={12} /> Add Visit Slot
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {(customer.maintenanceAgreement.visits || []).map((v: any, index: number) => {
                                                const vStatus = getVisitStatus(v);
                                                const isCompleted = vStatus === 'Completed';
                                                const isOverdue = vStatus === 'Overdue';
                                                const isScheduled = vStatus === 'Scheduled';

                                                return (
                                                    <div 
                                                        key={v.id} 
                                                        className={`p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                                                            isCompleted 
                                                                ? 'border-emerald-100 bg-emerald-50/10 dark:border-emerald-950/20 dark:bg-emerald-950/5' 
                                                                : isOverdue 
                                                                    ? 'border-red-200 bg-red-50/10 dark:border-red-950/20 dark:bg-red-950/5' 
                                                                    : 'border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-950/10'
                                                        }`}
                                                    >
                                                        {/* Visit Title and Target Month */}
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-bold text-sm text-slate-800 dark:text-white">Visit #{index + 1} - target: {v.targetMonth}</p>
                                                                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full tracking-wider border ${
                                                                    isCompleted 
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' 
                                                                        : isOverdue 
                                                                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' 
                                                                            : isScheduled 
                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' 
                                                                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                                }`}>
                                                                    {vStatus}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-1 font-semibold">
                                                                {v.jobId ? (
                                                                    <>
                                                                        Dispatched Work Order: 
                                                                        <button 
                                                                            onClick={() => {
                                                                                const targetJob = state.jobs.find((j: any) => j.id === v.jobId);
                                                                                if (targetJob) setSelectedJobForModal(targetJob);
                                                                            }}
                                                                            className="text-primary-600 font-bold ml-1 hover:underline outline-none"
                                                                        >
                                                                            #{v.jobId.slice(0, 8)}
                                                                        </button>
                                                                        {v.assignedTechName && ` &bull; Tech: ${v.assignedTechName}`}
                                                                    </>
                                                                ) : 'Pending Dispatch Scheduling'}
                                                            </p>
                                                        </div>

                                                        {/* Actions Panel */}
                                                        <div className="flex items-center gap-3 flex-wrap md:justify-end shrink-0 w-full md:w-auto">
                                                            {/* Tech Assign Dropdown (if job not yet completed) */}
                                                            {!isCompleted && !v.jobId && (
                                                                <select 
                                                                    aria-label="Assign Technician"
                                                                    title="Assign Technician"
                                                                    className="border rounded-lg text-xs p-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold outline-none"
                                                                    defaultValue=""
                                                                    onChange={e => {
                                                                        if (e.target.value) {
                                                                            handleDispatchVisitJob(v.id, e.target.value);
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Dispatch Tech...</option>
                                                                    {state.users.filter((u: any) => 
                                                                        u.organizationId === state.currentOrganization?.id && 
                                                                        u.role !== 'customer'
                                                                    ).map((u: any) => (
                                                                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                                                    ))}
                                                                </select>
                                                            )}

                                                            {/* Link Job Select */}
                                                            {!v.jobId && (
                                                                <select 
                                                                    aria-label="Link Job"
                                                                    title="Link Job"
                                                                    className="border rounded-lg text-xs p-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-500 font-semibold outline-none"
                                                                    defaultValue=""
                                                                    onChange={e => {
                                                                        if (e.target.value) {
                                                                            handleLinkExistingJob(v.id, e.target.value);
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Link Job...</option>
                                                                    {state.jobs.filter((j: any) => j.customerId === customer.id && j.tasks?.includes('Preventative Maintenance')).map((j: any) => (
                                                                        <option key={j.id} value={j.id}>#{j.id.slice(0, 8)} ({j.jobStatus})</option>
                                                                    ))}
                                                                </select>
                                                            )}

                                                            {/* Send Alert Button */}
                                                            <Button 
                                                                onClick={() => {
                                                                    setSelectedVisitForNotification(v.id);
                                                                    setNotificationRecipient(customer.email || '');
                                                                }}
                                                                variant="secondary"
                                                                className="text-xs p-1.5 px-3 flex items-center gap-1 hover:border-primary-500"
                                                                title="Notify Customer"
                                                            >
                                                                <Mail size={12} /> Send Notice
                                                            </Button>

                                                            {/* Delete visit slot */}
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleDeleteVisit(v.id)}
                                                                className="p-2 text-red-500 hover:text-red-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                title="Delete visit slot"
                                                            >
                                                                <TrashIcon size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(customer.maintenanceAgreement.visits || []).length === 0 && (
                                                <p className="text-xs text-slate-500 text-center py-4">No visits scheduled. Regenerate visits inside Edit Agreement.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Live Notification Previews (Popup Modal or Overlay panel when selected) */}
                                    {selectedVisitForNotification && (
                                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg space-y-4 animate-in slide-in-from-bottom duration-300">
                                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                                                <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Draft Maintenance Notice</h3>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setSelectedVisitForNotification(null)}
                                                    className="text-slate-400 hover:text-slate-600 font-bold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Left: Template & Parameters controls */}
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recipient Contact Email</label>
                                                        <Input 
                                                            value={notificationRecipient}
                                                            onChange={e => setNotificationRecipient(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notice Template</label>
                                                        <Select
                                                            value={notificationTemplate}
                                                            onChange={e => setNotificationTemplate(e.target.value as any)}
                                                        >
                                                            <option value="reminder">Upcoming visit reminder</option>
                                                            <option value="overdue">Overdue inspection notice</option>
                                                        </Select>
                                                    </div>

                                                    <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-2">
                                                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">SMS Quick Text Preview</p>
                                                        <div className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-300 text-xs p-3 rounded-2xl max-w-xs border border-slate-200 dark:border-slate-800 leading-relaxed font-normal shadow-sm">
                                                            {notificationTemplate === 'reminder' 
                                                                ? `TekTrakker Alert: Hello ${customer.name}, your preventative maintenance is scheduled this month. Please reply to schedule or call us.`
                                                                : `TekTrakker Alert: Hello ${customer.name}, your commercial maintenance visit is overdue. Please reply to schedule tech dispatch.`
                                                            }
                                                        </div>
                                                    </div>

                                                    <Button 
                                                        onClick={() => handleSendNotification(selectedVisitForNotification)}
                                                        disabled={isSendingNotification || !notificationRecipient}
                                                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold border-none flex items-center justify-center gap-2"
                                                    >
                                                        <Mail size={16} /> {isSendingNotification ? 'Sending Notification...' : 'Send Live Email Notice'}
                                                    </Button>
                                                </div>

                                                {/* Right: Live Responsive Email Preview */}
                                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-950 p-4 max-h-96 overflow-y-auto">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Email Preview Screen</p>
                                                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-700 leading-relaxed shadow-sm font-sans" style={{ color: '#334155' }}>
                                                        <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px 6px 0 0', textAlign: 'center', color: '#ffffff', marginBottom: '16px' }}>
                                                            <h2 style={{ margin: 0, fontSize: '16px' }}>Maintenance Notice</h2>
                                                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.8 }}>{state.currentOrganization?.name || 'TekTrakker Services'}</p>
                                                        </div>
                                                        <p>Dear {customer.name},</p>
                                                        {notificationTemplate === 'reminder'
                                                            ? <p>This is a friendly reminder that your upcoming preventative maintenance service is scheduled for the target month of <strong>{customer.maintenanceAgreement?.visits?.find((v: any) => v.id === selectedVisitForNotification)?.targetMonth}</strong> under your agreement.</p>
                                                            : <p>We noticed that your scheduled preventative maintenance service for target month of <strong>{customer.maintenanceAgreement?.visits?.find((v: any) => v.id === selectedVisitForNotification)?.targetMonth}</strong> is currently overdue.</p>
                                                        }
                                                        <div style={{ backgroundColor: '#f8fafc', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', margin: '15px 0' }}>
                                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '12px' }}>Agreed Terms</h4>
                                                            <p style={{ margin: 0, fontSize: '11px' }}>Billing: {customer.maintenanceAgreement?.billingFrequency} | Interval: {customer.maintenanceAgreement?.frequency}</p>
                                                        </div>
                                                        <p>Our office will contact you soon to finalize dates.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <CustomerDocumentDrive 
                            customer={customer} 
                            customerJobs={customerJobs} 
                        />
                    )}

                </div>
            </Modal>

            {/* FILE PREVIEW MODAL */}
            {viewingFile && (() => {
                const fileSrc = viewingFile.dataUrl || (viewingFile as any).url || '';
                const fileInfo = detectFileType(fileSrc, viewingFile.fileName, viewingFile.fileType);
                return (
                    <Modal isOpen={!!viewingFile} onClose={() => setViewingFile(null)} title={viewingFile.fileName || "File Preview"} size="xl">
                        <div className="space-y-4 p-4">
                            <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[350px] max-h-[70vh] shadow-2xl p-2">
                                {fileInfo.isImage ? (
                                    <img src={fileSrc} className="max-w-full max-h-[65vh] object-contain rounded-lg" alt={viewingFile.fileName || 'Preview'}/>
                                ) : fileInfo.isHtml ? (
                                    <iframe 
                                        srcDoc={fileSrc.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(fileSrc.split('base64,')[1]))) : undefined}
                                        src={!fileSrc.startsWith('data:text/html;base64,') ? fileSrc : undefined} 
                                        className="w-full h-[60vh] border-0 bg-white rounded-lg" 
                                        title={viewingFile.fileName || "HTML Preview"} 
                                    />
                                ) : fileInfo.isPdf ? (
                                    <div className="w-full h-[60vh] flex flex-col space-y-2">
                                        <iframe src={fileInfo.previewUrl} className="w-full h-full border-0 bg-white rounded-lg" title={viewingFile.fileName || "PDF Preview"} />
                                        <div className="text-center">
                                            <a 
                                                href={fileSrc} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-xs text-indigo-400 hover:underline font-bold"
                                            >
                                                Having trouble viewing? Tap here to open PDF in a new tab.
                                            </a>
                                        </div>
                                    </div>
                                ) : fileInfo.googleDocsViewerUrl ? (
                                    <iframe src={fileInfo.googleDocsViewerUrl} className="w-full h-[60vh] border-0 bg-white rounded-lg" title={viewingFile.fileName || "Document Preview"} />
                                ) : (
                                    <div className="p-12 text-center text-white">
                                        <FileText size={64} className="mx-auto mb-4 text-slate-500"/>
                                        <p className="font-bold">{viewingFile.fileName || 'Document'}</p>
                                        <p className="text-sm text-slate-400 mt-1 mb-6">Click below to open or download this file.</p>
                                        {fileSrc && (
                                            <a 
                                                href={fileSrc} 
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={viewingFile.fileName} 
                                                className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
                                            >
                                                <Download size={16} /> Open / Download File
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fileInfo.extension ? `.${fileInfo.extension}` : viewingFile.fileType}</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{viewingFile.fileName}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {fileSrc && (
                                        <a
                                            href={fileSrc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={viewingFile.fileName}
                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                        >
                                            <ExternalLink size={14} /> Open in New Tab
                                        </a>
                                    )}
                                    <Button variant="secondary" onClick={() => setViewingFile(null)}>Close Window</Button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                );
            })()}

            {/* QR CODE MODAL */}
            {viewQrAsset && (
                <Modal isOpen={!!viewQrAsset} onClose={() => setViewQrAsset(null)} title="Asset Tag QR">
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="bg-white p-4 rounded border-2 border-black">
                            <QRCodeCanvas 
                                id="asset-qr-canvas"
                                value={`${getBaseUrl()}/#/asset/${customerId}?assetId=${viewQrAsset.id}`} 
                                size={200}
                                level="H"
                            />
                        </div>
                        <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                            <p className="font-bold text-lg">{viewQrAsset.brand} {viewQrAsset.type}</p>
                            <p className="font-mono text-xs">S/N: {viewQrAsset.serial}</p>
                            <p className="mt-2 text-xs text-gray-500">Scan this code to view asset history.</p>
                        </div>
                        <Button onClick={handlePrintQr} className="w-auto flex items-center gap-2">
                            <Printer size={16} /> Print Label
                        </Button>
                    </div>
                </Modal>
            )}

            {selectedLocationForLayout && (
                <LocationPhotosLayoutModal 
                    isOpen={isLayoutModalOpen}
                    onClose={() => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                    }}
                    customerId={customer.id}
                    locationId={selectedLocationForLayout.id}
                    onSelectEquipment={(eq) => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                        setAutoOpenEquipmentId(eq.id);
                        setActiveTab('equipment');
                    }}
                />
            )}

            {selectedJobForModal && (
                <JobDetailModal 
                    isOpen={!!selectedJobForModal}
                    onClose={() => setSelectedJobForModal(null)}
                    job={selectedJobForModal}
                    isAdmin={true}
                />
            )}

            {editingInvoiceJobId && (
                <InvoiceEditorModal 
                    isOpen={true} 
                    onClose={() => setEditingInvoiceJobId(null)} 
                    jobId={editingInvoiceJobId} 
                />
            )}

            {isSendEmailModalOpen && (
                <SendEmailModal
                    isOpen={isSendEmailModalOpen}
                    onClose={() => setIsSendEmailModalOpen(false)}
                    customerId={customerId || customer?.id}
                    recipientEmail={customer?.email}
                    recipientName={customer?.name}
                    mode="email"
                />
            )}

            {sendInvoiceModalConfig.isOpen && sendInvoiceModalConfig.job && (
                <SendEmailModal
                    isOpen={sendInvoiceModalConfig.isOpen}
                    onClose={() => setSendInvoiceModalConfig({ isOpen: false, job: null })}
                    customerId={customer?.id}
                    job={sendInvoiceModalConfig.job}
                    invoice={sendInvoiceModalConfig.job.invoice}
                    mode="invoice"
                />
            )}

            {isSendSmsModalOpen && (
                <SendSMSModal
                    isOpen={isSendSmsModalOpen}
                    onClose={() => setIsSendSmsModalOpen(false)}
                    customerId={customer?.id}
                    recipientPhone={customer?.phone}
                    recipientName={customer?.name}
                />
            )}

            {isCreatePaymentLinkOpen && (
                <CreatePaymentLinkModal
                    isOpen={isCreatePaymentLinkOpen}
                    onClose={() => setIsCreatePaymentLinkOpen(false)}
                    defaultCustomerId={customer?.id}
                />
            )}

            {isLogPaymentModalOpen && customer && (
                <LogReceivedPaymentModal
                    isOpen={isLogPaymentModalOpen}
                    onClose={() => setIsLogPaymentModalOpen(false)}
                    customer={customer}
                    jobs={customerJobs}
                    zIndex="z-[10080]"
                />
            )}

            {isEmailStatementModalOpen && customer && (
                <EmailStatementModal
                    isOpen={isEmailStatementModalOpen}
                    onClose={() => setIsEmailStatementModalOpen(false)}
                    customer={customer}
                    org={state.currentOrganization}
                    statementJobs={filteredStatementJobs}
                    statementTotals={statementTotals}
                    zIndex="z-[10080]"
                />
            )}

            {isLogCallModalOpen && (
                <LogCallModal
                    isOpen={isLogCallModalOpen}
                    onClose={() => setIsLogCallModalOpen(false)}
                    customerId={customer?.id}
                    recipientPhone={customer?.phone}
                />
            )}

            {editingAppointmentJob && (
                <JobAppointmentModal
                    isOpen={!!editingAppointmentJob}
                    onClose={() => setEditingAppointmentJob(null)}
                    customerId={customer?.id}
                    jobToEdit={editingAppointmentJob.id ? editingAppointmentJob : undefined}
                />
            )}

            {linkingJob && (
                <JobLinkingModal
                    isOpen={!!linkingJob}
                    onClose={() => setLinkingJob(null)}
                    job={linkingJob}
                />
            )}

            {activeSignOffJob && (
                <SignOffModal
                    isOpen={!!activeSignOffJob}
                    onClose={() => setActiveSignOffJob(null)}
                    job={activeSignOffJob}
                    onSave={async (file: any, updatedFields?: any) => {
                        const existingFiles = activeSignOffJob.files || [];
                        const updatedFiles = updatedFields?.files || [...existingFiles, file];
                        const updates = {
                            files: updatedFiles,
                            ...(updatedFields || {})
                        };
                        dispatch({ type: 'UPDATE_JOB', payload: { ...activeSignOffJob, ...updates } });
                        setActiveSignOffJob(null);
                    }}
                />
            )}

            {historyNotesJob && (
                <Modal
                    isOpen={!!historyNotesJob}
                    onClose={() => { setHistoryNotesJob(null); setHistoryInternalNotes(''); }}
                    title={`Internal Notes - JOB-${historyNotesJob.id.replace('job-', '')}`}
                    size="md"
                >
                    <div className="space-y-4">
                        <Textarea
                            label="Internal Office & Technician Notes"
                            rows={5}
                            value={historyInternalNotes}
                            onChange={(e) => setHistoryInternalNotes(e.target.value)}
                            placeholder="Enter private job notes, instructions, access info..."
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => { setHistoryNotesJob(null); setHistoryInternalNotes(''); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveHistoryNotes}>
                                Save Notes
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {selectedCommForFullView && (
                <Modal
                    isOpen={!!selectedCommForFullView}
                    onClose={() => setSelectedCommForFullView(null)}
                    title={selectedCommForFullView.title || t("Full Word-for-Word Conversation")}
                    size="xl"
                >
                    <div className="space-y-4">
                        {/* Header Details Bar */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${selectedCommForFullView.badgeColor}`}>
                                    {selectedCommForFullView.badgeLabel}
                                </span>
                                {selectedCommForFullView.subtitle && (
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {selectedCommForFullView.subtitle}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-medium text-slate-400">
                                {new Date(selectedCommForFullView.timestamp).toLocaleString()}
                            </span>
                        </div>

                        {/* Audio Recording Player if present */}
                        {selectedCommForFullView.recordingUrl && (
                            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-900/50 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5"><PhoneCall size={14} /> Call Recording Audio</span>
                                    {selectedCommForFullView.duration && <span>{Math.floor(selectedCommForFullView.duration / 60)}m {selectedCommForFullView.duration % 60}s</span>}
                                </div>
                                <audio controls src={selectedCommForFullView.recordingUrl} className="w-full h-9 outline-none" />
                            </div>
                        )}

                        {/* Word-for-Word Full Conversation Text Area */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText size={13} className="text-indigo-500" />
                                    {t("Full Word-for-Word Text / Transcript")}
                                </span>
                                {selectedCommForFullView.content && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedCommForFullView.content);
                                            showToast.success("Copied full word-for-word text to clipboard!");
                                        }}
                                        className="text-xs h-6 px-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                                    >
                                        <Copy size={12} />
                                        {t("Copy Text")}
                                    </Button>
                                )}
                            </div>
                            
                            <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal whitespace-pre-wrap max-h-[60vh] overflow-y-auto shadow-inner select-text">
                                {selectedCommForFullView.content || t("No additional text recorded for this communication log.")}
                            </div>
                        </div>

                        {/* Footer Close Button */}
                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setSelectedCommForFullView(null)} size="sm">
                                {t("Close")}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* TCPA Compliance Re-Subscription Verification Modal */}
            {showSmsReConsentModal && (
                <Modal
                    isOpen={showSmsReConsentModal}
                    onClose={() => setShowSmsReConsentModal(false)}
                    title="TCPA Compliance: Re-Subscribe Customer to SMS"
                >
                    <div className="space-y-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <div className="bg-amber-50 dark:bg-amber-950/50 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100 text-sm">
                                <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                                <span>TCPA & Carrier Anti-Spam Safeguard</span>
                            </div>
                            <p>
                                This customer previously opted out of SMS alerts ({formData.marketingConsent?.source || 'Twilio SMS Opt-Out'}). Under Federal TCPA regulations, mobile carriers forbid sending messages to opted-out numbers without explicit written or verbal customer consent.
                            </p>
                            <p className="font-semibold text-amber-900 dark:text-amber-100">
                                ⚠️ Note: If the customer texted STOP to your Twilio number, Twilio carrier networks will still block outgoing SMS messages until the customer texts <strong>START</strong> to your number.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                                Re-Consent Verification Method <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={reConsentReason}
                                onChange={e => setReConsentReason(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="Customer Verbal Request">Customer Verbal Request (In Person / Phone)</option>
                                <option value="Customer Written Consent Form">Customer Written Consent Form</option>
                                <option value="Customer Email / Portal Request">Customer Email or Portal Opt-In Request</option>
                            </select>

                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                                Compliance Audit Notes (Optional)
                            </label>
                            <textarea
                                value={reConsentNotes}
                                onChange={e => setReConsentNotes(e.target.value)}
                                placeholder="e.g. Customer called customer service line on 8/10 requesting service updates via text..."
                                rows={2}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
                            />

                            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={reConsentCertify}
                                    onChange={e => setReConsentCertify(e.target.checked)}
                                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug">
                                    I certify under penalty of terms violation that this customer explicitly requested to re-subscribe to SMS alerts and that documentation is on file.
                                </span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setShowSmsReConsentModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                disabled={!reConsentCertify}
                                onClick={() => {
                                    const adminName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Admin';
                                    setFormData({
                                        ...formData,
                                        marketingConsent: {
                                            ...formData.marketingConsent,
                                            sms: true,
                                            agreedAt: new Date().toISOString(),
                                            unsubscribedAt: null,
                                            source: `Admin Manual Re-subscribe (${reConsentReason}) by ${adminName}`,
                                            optOutReason: null,
                                            auditNotes: reConsentNotes
                                        } as any
                                    });
                                    setShowSmsReConsentModal(false);
                                    showToast.success("Customer SMS re-subscription verified & updated.");
                                }}
                            >
                                Certify & Re-Subscribe
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {isIssueWarrantyOpen && customer && (
                <IssueWarrantyModal 
                    isOpen={isIssueWarrantyOpen}
                    onClose={() => setIsIssueWarrantyOpen(false)}
                    customer={customer}
                    organization={state.currentOrganization}
                    onSuccess={(newContract) => {
                        setIsIssueWarrantyOpen(false);
                    }}
                />
            )}

            {isMallFilterModalOpen && customer && (
                <MallFilterRequisitionModal
                    isOpen={isMallFilterModalOpen}
                    onClose={() => setIsMallFilterModalOpen(false)}
                    customer={customer}
                />
            )}
        </>
    );
};

export default CustomerMasterModal;
