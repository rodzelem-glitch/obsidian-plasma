import { getBaseUrl, getPaymentTermsLabel , cleanUndefinedFields } from "lib/utils";

import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db, firebase, functions } from 'lib/firebase';
import type { Customer, EquipmentAsset, ServiceAgreement, MembershipPlan, Job, StoredFile } from 'types';
import { TrashIcon, PlusCircle, Wrench, FileText, DollarSign, Image, User, Users, Mail, Printer, Sparkles, ShieldCheck, MessageSquare, CheckCircle, Edit, Share2, Copy, Upload, PhoneCall, PhoneOff, Calendar, XCircle, Clock, AlertCircle, PhoneOutgoing, Voicemail, UserCheck, Key } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { globalConfirm } from "lib/globalConfirm";
import { uploadFileToStorage } from 'lib/storageService';
import { sendEmail } from 'lib/notificationService';
import showToast from 'lib/toast';
import WarrantySection from 'pages/customer/components/WarrantySection';
import EquipmentHierarchy from 'pages/admin/projects/components/tabs/equipment/EquipmentHierarchy';
import { useLanguage } from 'context/LanguageContext';
import LocationPhotosLayoutModal from './LocationPhotosLayoutModal';
import JobDetailModal from './JobDetailModal';
import InvoiceEditorModal from './InvoiceEditorModal';
import { Paperclip, ExternalLink, FileCheck, Download, Send } from 'lucide-react';
import { Map as MapIcon } from 'lucide-react';
import SendEmailModal from './SendEmailModal';
import SendSMSModal from './SendSMSModal';
import LogCallModal from './LogCallModal';

interface CustomerMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
}

const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({ isOpen, onClose, customerId }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const customer = state.customers.find(c => c.id === customerId);
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
    const [historyLocationFilter, setHistoryLocationFilter] = useState('');
    const [editingInvoiceJobId, setEditingInvoiceJobId] = useState<string | null>(null);
    const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
    const [isSendSmsModalOpen, setIsSendSmsModalOpen] = useState(false);
    const [isLogCallModalOpen, setIsLogCallModalOpen] = useState(false);
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });

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
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    const [dragActiveDocs, setDragActiveDocs] = useState(false);
    const [dragActiveWarranties, setDragActiveWarranties] = useState(false);
    
    // Property Location State
    const [newLocation, setNewLocation] = useState<any>({ name: '', address: '', city: '', state: '', zip: '', notes: '' });
    const [isAddingLocation, setIsAddingLocation] = useState(false);

    // Contacts State
    const [newContact, setNewContact] = useState<any>({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined });
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

    const membership = state.serviceAgreements?.find(a => a.customerId === customerId && a.status === 'Active');

    const customerJobs = useMemo(() => {
        return state.jobs.filter(j => j.customerId === customerId);
    }, [state.jobs, customerId]);

    const filteredHistoryJobs = useMemo(() => {
        if (!historyLocationFilter) return customerJobs;
        return customerJobs.filter(j => {
            const locId = j.locationId || 'default';
            return locId === historyLocationFilter;
        });
    }, [customerJobs, historyLocationFilter]);

    const statementTotals = useMemo(() => {
        const invoiceJobs = customerJobs.filter(j => j.invoice);
        let totalBilled = 0;
        let totalPaid = 0;
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const aging = {
            current: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            older: 0
        };

        invoiceJobs.forEach(j => {
            const inv = j.invoice as any;
            const t = inv.totalAmount || inv.amount || 0;
            const p = inv.status === 'Failed' ? 0 : (inv.amountPaid || (inv.status === 'Paid' ? t : 0));
            totalBilled += t;
            totalPaid += p;
            
            if (inv.status !== 'Paid') {
                const bal = Math.max(0, t - p);
                const dateVal = inv.dueDate || j.appointmentTime || j.createdAt;
                if (dateVal) {
                    let dateObj = new Date(dateVal);
                    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                        dateObj = new Date(dateVal.replace(/-/g, '/'));
                    }
                    dateObj.setHours(0, 0, 0, 0);
                    
                    const daysOverdue = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
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
        const invoiceJobs = customerJobs.filter(j => j.invoice);
        
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
            const total = inv.totalAmount || inv.amount || 0;
            const paid = inv.status === 'Failed' ? 0 : (inv.amountPaid || (inv.status === 'Paid' ? total : 0));
            const balance = Math.max(0, total - paid);
            runningBalance += (total - paid);
            
            return {
                job: j,
                invoice: inv,
                total,
                paid,
                balance,
                runningBalance
            };
        });

        if (!statementUnpaidOnly) return mapped;
        return mapped.filter(tx => tx.balance > 0.01 && tx.invoice?.status !== 'Paid');
    }, [customerJobs, statementUnpaidOnly]);

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

    const handleSaveOverview = async () => {
        let finalPaymentTerms = formData.paymentTerms;
        if (formData.paymentTerms === 'custom' && (formData as any).paymentTermsDays) {
            finalPaymentTerms = `net_${(formData as any).paymentTermsDays}`;
        }
        const updated = { 
            ...customer, 
            ...formData, 
            paymentTerms: finalPaymentTerms
        };
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

        setIsEditing(false);
    };

    const handleAddLocation = async () => {
        if (!newLocation.propertyName && !newLocation.name) {
            showToast.warn("Property Name and Address are required.");
            return;
        }
        
        // Map legacy UI "name" to "propertyName" for the new schema
        const locPayload = {
            ...newLocation,
            name: newLocation.name || newLocation.propertyName,
            propertyName: newLocation.name || newLocation.propertyName,
            customerId: customer.id,
            organizationId: state.currentOrganization?.id || 'default'
        };

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
        setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '' });
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

    const handleToggleServicePlan = async (job: Job, e: React.MouseEvent) => {
        e.stopPropagation();

        const currentlyCovered = !!job.isServicePlan;

        if (!currentlyCovered) {
            // Toggling ON: Check for Residential Membership Plan or Commercial Maintenance Agreement
            const activeMembership = state.serviceAgreements?.find(
                a => a.customerId === customer.id && a.status === 'Active'
            );
            const maintenanceAgreement = customer.maintenanceAgreement;

            // 1. Residential / Membership Plan
            if (activeMembership) {
                if (activeMembership.visitsRemaining <= 0) {
                    showToast.warn(`Membership plan "${activeMembership.planName}" has 0 remaining visits available.`);
                }
                const newVisitsRemaining = Math.max(0, activeMembership.visitsRemaining - 1);
                const updatedAgreement = { ...activeMembership, visitsRemaining: newVisitsRemaining };

                try {
                    if (!state.isDemoMode) {
                        await db.collection('serviceAgreements').doc(activeMembership.id).update(cleanUndefinedFields({ visitsRemaining: newVisitsRemaining }));
                    }
                } catch (err) {
                    console.error("Failed to update membership visits remaining:", err);
                }
                dispatch({ type: 'UPDATE_AGREEMENT', payload: updatedAgreement });

                const jobPayload = {
                    ...job,
                    isServicePlan: true,
                    servicePlanType: 'membership' as const,
                    servicePlanId: activeMembership.id
                };
                try {
                    if (!state.isDemoMode) {
                        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ isServicePlan: true, servicePlanType: 'membership', servicePlanId: activeMembership.id }));
                    }
                } catch (err) {
                    console.error("Failed to update job service plan status:", err);
                }
                dispatch({ type: 'UPDATE_JOB', payload: jobPayload });
                showToast.success(`Marked as part of ${activeMembership.planName} Membership. Remaining visits: ${newVisitsRemaining}`);
                return;
            }

            // 2. Commercial / Maintenance Agreement
            if (maintenanceAgreement && maintenanceAgreement.status === 'Active' && maintenanceAgreement.visits) {
                const visits = [...maintenanceAgreement.visits];
                let targetSlotIndex = visits.findIndex(v => v.jobId === job.id);
                if (targetSlotIndex === -1) {
                    targetSlotIndex = visits.findIndex(v => v.status !== 'Completed' && !v.jobId);
                }
                if (targetSlotIndex === -1) {
                    targetSlotIndex = visits.findIndex(v => v.status !== 'Completed');
                }

                if (targetSlotIndex !== -1) {
                    visits[targetSlotIndex] = {
                        ...visits[targetSlotIndex],
                        status: 'Completed',
                        jobId: job.id,
                        completedAt: new Date().toISOString()
                    };

                    const updatedAgreement = { ...maintenanceAgreement, visits };
                    try {
                        if (!state.isDemoMode) {
                            await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ maintenanceAgreement: updatedAgreement }));
                        }
                    } catch (err) {
                        console.error("Failed to update maintenance agreement visit:", err);
                    }
                    dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });

                    const jobPayload = {
                        ...job,
                        isServicePlan: true,
                        servicePlanType: 'maintenanceAgreement' as const,
                        servicePlanId: maintenanceAgreement.id
                    };
                    try {
                        if (!state.isDemoMode) {
                            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ isServicePlan: true, servicePlanType: 'maintenanceAgreement', servicePlanId: maintenanceAgreement.id }));
                        }
                    } catch (err) {
                        console.error("Failed to update job service plan status:", err);
                    }
                    dispatch({ type: 'UPDATE_JOB', payload: jobPayload });
                    showToast.success(`Marked as part of Commercial Maintenance Agreement ("${maintenanceAgreement.agreementName}").`);
                    return;
                }
            }

            // 3. No active plan found
            showToast.warn("Customer is not enrolled in an active membership plan or commercial maintenance agreement.");
        } else {
            // Toggling OFF: Restore visit count / reset visit slot
            const planType = job.servicePlanType || (customer.customerType === 'Residential' ? 'membership' : 'maintenanceAgreement');

            if (planType === 'membership') {
                const activeMembership = state.serviceAgreements?.find(
                    a => a.customerId === customer.id && a.status === 'Active'
                ) || state.serviceAgreements?.find(a => a.id === job.servicePlanId);

                if (activeMembership) {
                    const maxVisits = activeMembership.visitsTotal || 99;
                    const newVisitsRemaining = Math.min(maxVisits, activeMembership.visitsRemaining + 1);
                    const updatedAgreement = { ...activeMembership, visitsRemaining: newVisitsRemaining };

                    try {
                        if (!state.isDemoMode) {
                            await db.collection('serviceAgreements').doc(activeMembership.id).update(cleanUndefinedFields({ visitsRemaining: newVisitsRemaining }));
                        }
                    } catch (err) {
                        console.error("Failed to restore membership visit count:", err);
                    }
                    dispatch({ type: 'UPDATE_AGREEMENT', payload: updatedAgreement });
                }
            } else if (planType === 'maintenanceAgreement' && customer.maintenanceAgreement) {
                const agreement = customer.maintenanceAgreement;
                const visits = (agreement.visits || []).map((v: any) => {
                    if (v.jobId === job.id) {
                        return {
                            ...v,
                            status: 'Pending',
                            jobId: undefined,
                            completedAt: undefined
                        };
                    }
                    return v;
                });
                const updatedAgreement = { ...agreement, visits };
                try {
                    if (!state.isDemoMode) {
                        await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ maintenanceAgreement: updatedAgreement }));
                    }
                } catch (err) {
                    console.error("Failed to reset maintenance agreement visit:", err);
                }
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, maintenanceAgreement: updatedAgreement } });
            }

            const jobPayload = {
                ...job,
                isServicePlan: false,
                servicePlanType: undefined,
                servicePlanId: undefined
            };
            try {
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ isServicePlan: false, servicePlanType: null, servicePlanId: null }));
                }
            } catch (err) {
                console.error("Failed to clear job service plan status:", err);
            }
            dispatch({ type: 'UPDATE_JOB', payload: jobPayload });
            showToast.info("Removed service plan coverage for visit.");
        }
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
        setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined });
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
            if (file.parentType === 'customer') {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayRemove(file)
                }));
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, files: (customer.files || []).filter((f: any) => f.id !== file.id) } });
            } else if (file.parentType === 'job' && file.parentId) {
                const jobToUpdate = state.jobs.find((j: Job) => j.id === file.parentId);
                if (jobToUpdate) {
                    await db.collection('jobs').doc(jobToUpdate.id).update(cleanUndefinedFields({
                        files: firebase.firestore.FieldValue.arrayRemove(file)
                    }));
                    dispatch({ type: 'UPDATE_JOB', payload: { id: jobToUpdate.id, files: (jobToUpdate.files || []).filter((f: any) => f.id !== file.id) } });
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
            // @ts-ignore - html2pdf has no types available right now
            const html2pdf = (await import('html2pdf.js')).default;
            
            const org = state.currentOrganization;
            const orgName = org?.name || 'Service Provider';
            const orgPhone = org?.phone || '';
            const orgEmail = org?.email || '';
            const orgAddress = org?.address ? `${org.address.street || ''}, ${org.address.city || ''}, ${org.address.state || ''} ${org.address.zip || ''}` : '';
            
            // Format date range
            const dates = statementJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
            const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
            const statementPeriod = `${minDate} - ${maxDate}`;
            const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

            const invoiceRows = statementJobs.map((tx, idx) => {
                const j = tx.job;
                const inv = tx.invoice;
                const t = tx.total;
                const p = tx.paid;
                const d = tx.balance;
                const rb = tx.runningBalance;
                const addressStr = typeof j.address === 'string' ? j.address : `${(j.address as any)?.street || ''}, ${(j.address as any)?.city || ''}`;
                const zebraStyle = idx % 2 === 0 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';
                const statusStyle = inv.status === 'Paid' 
                    ? 'color: #15803d; background-color: #f0fdf4; border: 1px solid #bbf7d0;' 
                    : 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;';
                
                return `
                    <tr style="${zebraStyle}">
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${new Date(j.appointmentTime || j.createdAt || '').toLocaleDateString()}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">#${inv.id || j.id.slice(0, 8)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                            <strong>${j.locationName || j.customerName || 'Main Address'}</strong><br/>
                            <span style="font-size: 10px; color: #64748b;">${addressStr}</span>
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${j.poNumber || '—'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${t.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${p.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${d > 0.01 ? '#dc2626' : '#1e293b'};">${d.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">${rb.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${inv.dueDate ? new Date(inv.dueDate.replace(/-/g, '/')).toLocaleDateString() : 'Upon Receipt'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
                            <span style="display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                                ${inv.status || 'Unpaid'}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

            const htmlContent = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 11px; line-height: 1.5; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr>
                            <td>
                                <h1 style="font-size: 24px; font-weight: 800; color: #123A63; text-transform: uppercase; letter-spacing: -0.5px; margin: 0;">Statement of Account</h1>
                                <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString()} | Statement #: ${statementNumber}</p>
                            </td>
                            <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                <strong style="font-size: 13px; color: #1e293b;">${orgName}</strong><br/>
                                ${orgAddress}<br/>
                                Phone: ${orgPhone} | Email: ${orgEmail}<br/>
                                ${org?.taxId ? `Tax ID: ${org.taxId}` : ''}
                            </td>
                        </tr>
                    </table>
                    
                    <div style="border-bottom: 2px solid #123A63; margin-bottom: 20px;"></div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr>
                            <td style="width: 50%; vertical-align: top;">
                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; width: 95%;">Client Information</div>
                                <div style="font-size: 11px; color: #334155;">
                                    <p style="margin: 3px 0;"><strong>${customer.name}</strong></p>
                                    <p style="margin: 3px 0;">${customer.address}</p>
                                    ${customer.email ? `<p style="margin: 3px 0;">Email: ${customer.email}</p>` : ''}
                                    ${customer.phone ? `<p style="margin: 3px 0;">Phone: ${customer.phone}</p>` : ''}
                                </div>
                            </td>
                            <td style="width: 50%; vertical-align: top;">
                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Account Summary & Terms</div>
                                <div style="font-size: 11px; color: #334155;">
                                    <p style="margin: 3px 0;">Client Code: <strong>${customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                    <p style="margin: 3px 0;">Account Number: <strong>${customer.id.replace(/\D/g, '')}</strong></p>
                                    <p style="margin: 3px 0;">Payment Terms: <strong>${customer.paymentTerms || 'Net 30'}</strong></p>
                                    <p style="margin: 3px 0;">Statement Period: <strong>${statementPeriod}</strong></p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #cbd5e1;">
                        <tr>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #cbd5e1;">Previous Balance</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #cbd5e1;">New Charges</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #cbd5e1;">Payments Received</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #cbd5e1;">Adjustments</th>
                            <th style="background-color: #0f2d50; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #cbd5e1;">Amount Due</th>
                        </tr>
                        <tr>
                            <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                            <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">${statementTotals.totalBilled.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">${statementTotals.totalPaid.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                            <td style="padding: 8px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">${statementTotals.totalDue.toFixed(2)}</td>
                        </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background: #123A63; color: #ffffff;">
                                <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 10%;">Date</th>
                                <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 12%;">Invoice #</th>
                                <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Property / Address</th>
                                <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 12%;">Ref / PO #</th>
                                <th style="padding: 6px 8px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 10%;">Billed (Dr)</th>
                                <th style="padding: 6px 8px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 10%;">Paid (Cr)</th>
                                <th style="padding: 6px 8px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 12%;">Balance</th>
                                <th style="padding: 6px 8px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 12%;">Running Bal</th>
                                <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 12%;">Due Date</th>
                                <th style="padding: 6px 8px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #0f2d50; width: 10%;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceRows}
                        </tbody>
                    </table>

                    <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Aging Analysis (Unpaid Balances)</div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #cbd5e1;">
                        <tr style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 9px; text-transform: uppercase; text-align: center;">
                            <th style="padding: 5px; border: 1px solid #cbd5e1;">Current</th>
                            <th style="padding: 5px; border: 1px solid #cbd5e1;">1 - 30 Days</th>
                            <th style="padding: 5px; border: 1px solid #cbd5e1;">31 - 60 Days</th>
                            <th style="padding: 5px; border: 1px solid #cbd5e1;">61 - 90 Days</th>
                            <th style="padding: 5px; border: 1px solid #cbd5e1;">90+ Days</th>
                            <th style="padding: 5px; border: 1px solid #cbd5e1; background-color: #123A63; color: #ffffff;">Total Outstanding</th>
                        </tr>
                        <tr style="text-align: center; font-size: 11px; font-weight: bold;">
                            <td style="padding: 8px; border: 1px solid #cbd5e1;">${statementTotals.aging.current.toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days30 > 0 ? '#b45309' : '#1e293b'}">${statementTotals.aging.days30.toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days60 > 0 ? '#b45309' : '#1e293b'}">${statementTotals.aging.days60.toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days90 > 0 ? '#dc2626' : '#1e293b'}">${statementTotals.aging.days90.toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${statementTotals.aging.older > 0 ? '#dc2626' : '#1e293b'}">${statementTotals.aging.older.toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; font-size: 12px; color: #dc2626;">${statementTotals.totalDue.toFixed(2)}</td>
                        </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; font-size: 9px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                        <tr>
                            <td style="width: 60%; vertical-align: top; padding-right: 20px;">
                                <strong style="color: #1e293b; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 6px;">Payment Instructions</strong>
                                Please submit check payments payable to <strong>${orgName}</strong>.<br/>
                                For direct bank remittance (ACH/Wire), please contact billing department at <strong>${orgEmail}</strong>.<br/>
                                Please reference the Statement Number on your remittance advice.
                            </td>
                            <td style="width: 40%; vertical-align: top; text-align: right; line-height: 1.4;">
                                <strong>Corporate Remittance Support</strong><br/>
                                Email: ${orgEmail}<br/>
                                Phone: ${orgPhone}<br/>
                                <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 10px;">CONFIDENTIALITY NOTICE: This document contains proprietary financial information intended solely for the corporate account holder.</span>
                            </td>
                        </tr>
                    </table>
                </div>
            `;

            const opt: any = {
                margin: 10,
                filename: `Statement-${customer.name.replace(/[^a-z0-9]/gi, '_')}-${statementNumber}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().from(htmlContent).set(opt).save();
            showToast.success("Statement PDF downloaded successfully!");
        } catch (error: any) {
            console.error("PDF generation error:", error);
            showToast.error("Failed to generate PDF: " + error.message);
        }
    };

        const renderInOutTimes = (job: Job) => {
        const checkIn = job.checkInTime || (job as any).clockIn;
        const checkOut = job.checkOutTime || (job as any).clockOut;
        
        if (!checkIn && !checkOut) {
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
        
        const formatTime = (isoString?: string) => {
            if (!isoString) return '—';
            try {
                return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
                return '—';
            }
        };
        
        return (
            <div className="flex flex-col text-[10px] leading-snug">
                {checkIn && (
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-slate-400 mr-0.5">In:</span> {formatTime(checkIn)}
                    </span>
                )}
                {checkOut && (
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-slate-400 mr-0.5">Out:</span> {formatTime(checkOut)}
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
                        title={p.title || `View Proposal #${p.id.slice(0, 8)}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors"
                    >
                        <FileText size={10} />
                        <span className="text-[9px] font-bold">{badgeLabel}</span>
                    </a>
                );
            });
        }

        // 3. Invoice badges (supporting multiple linked jobs/invoices)
        const relatedJobs = (state.jobs || []).filter((j: any) => 
            (j.id === job.id || 
             job.linkedJobIds?.includes(j.id) || 
             j.linkedJobIds?.includes(job.id) || 
             (j.invoice && job.linkedInvoiceIds?.includes(j.invoice.id))) && 
            j.invoice
        );

        if (relatedJobs.length === 0 && job.invoice) {
            docs.push(
                <a 
                    key={`inv-fallback-${job.id}`}
                    href={`/#/invoice/${job.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="View Invoice"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 transition-colors"
                >
                    <FileText size={10} />
                    <span className="text-[9px] font-bold">Inv</span>
                </a>
            );
        } else {
            relatedJobs.forEach((rj: any, idx: number) => {
                const badgeLabel = relatedJobs.length > 1 ? `Inv ${idx + 1}` : 'Inv';
                const dateStr = rj.appointmentTime ? new Date(rj.appointmentTime).toLocaleDateString() : '';
                docs.push(
                    <a 
                        key={`inv-${rj.id}`}
                        href={`/#/invoice/${rj.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={`View Invoice for Job ${rj.id.slice(0, 8)} ${dateStr ? `on ${dateStr}` : ''}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 transition-colors"
                    >
                        <FileText size={10} />
                        <span className="text-[9px] font-bold">{badgeLabel}</span>
                    </a>
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
                
                // Exclude photos/images
                const isImage = mimeType.startsWith('image/') || 
                                /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);
                if (isImage) return;

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
        
        if (!await globalConfirm(`Send Statement of Account directly to ${emailTarget}?`)) return;

        try {
            // Format date range
            const dates = statementJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
            const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
            const statementPeriod = `${minDate} - ${maxDate}`;
            const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

            const invoiceRows = statementJobs.map((tx, idx) => {
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
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${t.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${p.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${d > 0.01 ? '#dc2626' : '#1e293b'};">${d.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">${rb.toFixed(2)}</td>
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
                message: {
                    subject: `Statement of Account: ${customer.name}`,
                    html: `
                        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; line-height: 1.5; background-color: #ffffff;">
                            
                            <!-- Header Section -->
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                <tr>
                                    <td>
                                        <h2 style="font-size: 22px; font-weight: 800; color: #123A63; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Statement of Account</h2>
                                        <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString()} | Statement #: ${statementNumber}</p>
                                    </td>
                                    <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                        <strong style="font-size: 12px; color: #1e293b;">${orgName}</strong><br/>
                                        ${orgAddress}<br/>
                                        Phone: ${orgPhone}
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
                                        <p style="margin: 2px 0; color: #334155;">Account Number: <strong>${customer.id.replace(/\D/g, '')}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">Payment Terms: <strong>${customer.paymentTerms || 'Net 30'}</strong></p>
                                        <p style="margin: 2px 0; color: #334155;">Statement Period: <strong>${statementPeriod}</strong></p>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #334155; margin-bottom: 20px;">Dear Finance Team,</p>
                            <p style="color: #334155; margin-bottom: 25px;">Please find below the corporate Statement of Account for <strong>${customer.name}</strong> summarizing all recent service invoices, payments, and outstanding balances.</p>

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
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">${statementTotals.totalBilled.toFixed(2)}</td>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">${statementTotals.totalPaid.toFixed(2)}</td>
                                    <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                    <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">${statementTotals.totalDue.toFixed(2)}</td>
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
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1;">${statementTotals.aging.current.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days30 > 0 ? '#b45309' : '#1e293b'};">${statementTotals.aging.days30.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days60 > 0 ? '#b45309' : '#1e293b'};">${statementTotals.aging.days60.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days90 > 0 ? '#dc2626' : '#1e293b'};">${statementTotals.aging.days90.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.older > 0 ? '#dc2626' : '#1e293b'};">${statementTotals.aging.older.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #dc2626;">${statementTotals.totalDue.toFixed(2)}</td>
                                </tr>
                            </table>

                            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #64748b;">
                                <strong>Corporate Remittance Instructions:</strong><br/>
                                Please remit check payments payable to <strong>${orgName}</strong> or contact billing at <strong>${orgEmail}</strong> for ACH bank wiring details. Reference the statement number on your remittance advice.<br/>
                                <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 10px;">CONFIDENTIALITY DISCLAIMER: This email and any attachments contain confidential proprietary financial information intended solely for the customer named above.</span>
                            </div>
                        </div>
                    `,
                    text: `Statement of Account for ${customer.name}. Outstanding Balance: ${statementTotals.totalDue.toFixed(2)}.`,
                    replyTo: org?.email,
                },
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

    // --- Maintenance Schedule Tab States & Handlers ---
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

        const visit = customer.maintenanceAgreement?.visits.find((v: any) => v.id === visitId);
        if (!visit) return;

        setIsSendingNotification(true);

        const emailSubject = notificationTemplate === 'reminder'
            ? `Upcoming Preventative Maintenance Reminder - ${customer.name}`
            : `Action Required: Scheduled Maintenance Overdue - ${customer.name}`;

        const coveredAssets = (customer.equipment || []).filter((eq: any) => 
            customer.maintenanceAgreement?.coveredEquipmentIds.includes(eq.id)
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
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {customer.name}
                            {membership && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">Gold Member</span>}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {customer.address}
                            {customer.city && `, ${customer.city}`}
                            {customer.state && `, ${customer.state}`}
                            {customer.zip && ` ${customer.zip}`}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-start justify-end">
                        <Button onClick={handleCopyRef} variant="secondary" aria-label="Copy Reference" title="Copy Reference" className="text-xs p-2 shrink-0">
                            <Copy size={14} />
                        </Button>
                        <Button onClick={() => setShareModalOpen(true)} variant="secondary" aria-label="Share Customer" title="Share Customer" className="text-xs p-2 shrink-0">
                            <Share2 size={14} />
                        </Button>
                        <Button onClick={handleSendInvite} disabled={isSendingInvite} variant="secondary" className="text-xs flex items-center gap-2 shrink-0">
                            <Mail size={14} /> {isSendingInvite ? 'Sending...' : 'Send Portal Invite'}
                        </Button>
                        <Button onClick={handleDeleteCustomer} className="bg-red-700 text-white hover:bg-red-800 text-xs font-bold shadow-md border-none shrink-0">Delete</Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
                    {[
                        { id: 'overview', icon: User, label: 'Overview' },
                        { id: 'equipment', icon: Wrench, label: 'Equipment' },
                        { id: 'history', icon: FileText, label: 'Service History' },
                        { id: 'financials', icon: DollarSign, label: 'Financials' },
                        { id: 'maintenance', icon: Calendar, label: 'Maintenance Schedule' },
                        { id: 'warranties', icon: ShieldCheck, label: 'Warranties' },
                        { id: 'docs', icon: Image, label: 'Docs & Media' },
                        { id: 'communications', icon: MessageSquare, label: 'Communications Log' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <tab.icon size={16} /> {t(tab.label)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="h-[50vh] overflow-y-auto custom-scrollbar p-1">
                    
                    {activeTab === 'overview' && (
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
                                        <Input 
                                            label="Contracted Rate ($/hr)" 
                                            type="number" 
                                            value={formData.pricingRules?.contractedRate || ''} 
                                            onChange={e => setFormData({
                                                ...formData,
                                                pricingRules: {
                                                    ...(formData.pricingRules || {}),
                                                    contractedRate: e.target.value ? parseFloat(e.target.value) : undefined
                                                }
                                            })}
                                            placeholder="e.g. 85.00"
                                        />
                                        
                                        <Input label="Street Address" isBlock value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                                        <Input label="City" isBlock value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                                        <Input label="State" isBlock value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} />
                                        <Input label="Zip" isBlock value={formData.zip || ''} onChange={e => setFormData({...formData, zip: e.target.value})} />
                                        
                                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border dark:border-slate-700">
                                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Marketing Consent (Manual Override)</p>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.marketingConsent?.sms || false} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            marketingConsent: { 
                                                                ...formData.marketingConsent, 
                                                                sms: e.target.checked,
                                                                agreedAt: new Date().toISOString(),
                                                                source: 'Manual'
                                                            } as any
                                                        })} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300">SMS Opt-In</span>
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
                                                                agreedAt: new Date().toISOString(),
                                                                source: 'Manual'
                                                            } as any
                                                        })} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300">Email Opt-In</span>
                                                </label>
                                            </div>

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
                                                    <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                                        Exempt Active
                                                    </span>
                                                )}
                                            </div>

                                            {formData.taxExempt && (
                                                <div className="space-y-3 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 animate-fade-in">
                                                    <Input 
                                                        label="Tax Exemption Certificate # / Tax ID" 
                                                        value={(formData as any).taxExemptNumber || ''} 
                                                        onChange={e => setFormData({ ...formData, taxExemptNumber: e.target.value } as any)} 
                                                        placeholder="e.g. TX-12345678"
                                                    />
                                                    <div>
                                                        <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                                                            Upload Tax Exemption Certificate File (PDF / Image)
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
                                                                    Certificate File Uploaded
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
                                            <div className="col-span-2 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">🏛️</span>
                                                    <div>
                                                        <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 uppercase">Tax Exempt Customer</p>
                                                        {customer.taxExemptNumber && <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Exempt ID: {customer.taxExemptNumber}</p>}
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
                                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded border border-amber-200">
                                                        No Certificate Uploaded
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div><p className="text-gray-500">Type</p><p className="font-medium dark:text-white">{customer.customerType || 'Residential'}</p></div>
                                        <div><p className="text-gray-500">Email</p><p className="font-medium dark:text-white">{customer.email || 'N/A'}</p></div>
                                        <div><p className="text-gray-500">Phone</p><p className="font-medium dark:text-white">{customer.phone || 'N/A'}</p></div>
                                        {customer.pricingRules?.contractedRate !== undefined && customer.pricingRules.contractedRate > 0 && (
                                            <div><p className="text-gray-500">Contracted Rate</p><p className="font-bold text-emerald-600 dark:text-emerald-400">${customer.pricingRules.contractedRate.toFixed(2)}/hr</p></div>
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
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Site Properties</h4>
                                        <div className="flex gap-2">
                                            {customer.customerType === 'Property Management' && customer.serviceLocations && customer.serviceLocations.length > 0 && (
                                                <Button onClick={handleBulkAdHocPMs} variant="secondary" className="text-[10px] py-1 px-2 h-auto flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                                                    <Wrench size={12}/> Bulk Dispatch Maintenance
                                                </Button>
                                            )}
                                            <button title="Add Property" aria-label="Add Property" onClick={() => { setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '' }); setIsAddingLocation(true); }} className="text-primary-600 hover:text-primary-700">
                                                <PlusCircle size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 overflow-y-auto max-h-[30vh] custom-scrollbar pr-1">
                                        {customer.serviceLocations && customer.serviceLocations.length > 0 ? customer.serviceLocations.map((loc: any) => (
                                            <div key={loc.id} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex justify-between items-start transition-colors hover:border-primary-300">
                                                <div>
                                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{loc.name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{loc.address}</p>
                                                    {loc.city && <p className="text-[10px] text-slate-500">{loc.city}, {loc.state}</p>}
                                                    {loc.poNumber && <p className="text-[10px] font-black text-emerald-600 mt-1 uppercase tracking-widest">PO: {loc.poNumber}</p>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button title="Edit Property" aria-label="Edit Property" onClick={() => { setNewLocation({ ...loc, name: loc.name || loc.propertyName }); setIsAddingLocation(true); }} className="text-slate-400 hover:text-primary-600 transition-colors">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button title="Delete Property" aria-label="Delete Property" onClick={(e) => handleDeleteLocation(loc.id, e)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                        <TrashIcon size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )) : (
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
                                         <button title="Add Contact" aria-label="Add Contact" onClick={() => { setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false, portalRole: undefined, allowedLocationIds: [], portalUserStatus: undefined }); setIsAddingContact(true); }} className="text-primary-600 hover:text-primary-700">
                                             <PlusCircle size={18} />
                                         </button>
                                     </div>
                                     
                                     <div className="space-y-2 overflow-y-auto max-h-[30vh] custom-scrollbar pr-1">
                                         {customer.contacts && customer.contacts.length > 0 ? customer.contacts.map((contact: any) => (
                                             <div key={contact.id} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex justify-between items-start transition-colors hover:border-primary-300">
                                                 <div>
                                                     <p className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                                         {contact.name} 
                                                         {contact.isPrimary && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] rounded uppercase font-bold">Primary</span>}
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
                    )}

                    {activeTab === 'equipment' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white">Assets & Locations</h3>
                                <div className="flex gap-2">
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
                            {((customer.serviceLocations && customer.serviceLocations.length > 0) || customer.customerType === 'Property Management') && (
                                <div className="flex justify-end">
                                    <select 
                                        title="Filter History by Location"
                                        aria-label="Filter History by Location"
                                        className="text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={historyLocationFilter}
                                        onChange={(e) => setHistoryLocationFilter(e.target.value)}
                                    >
                                        <option value="">All Locations</option>
                                        <option value="default">Main Office / Unassigned</option>
                                        {customer.serviceLocations?.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.propertyName || loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        {((customer.serviceLocations && customer.serviceLocations.length > 0) || customer.customerType === 'Property Management') && <th className="px-4 py-2">Property</th>}
                                        <th className="px-4 py-2">Service</th>
                                        <th className="px-4 py-2">Tech</th>
                                        <th className="px-4 py-2">Total</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-4 py-2 text-center">Service Plan</th>
                                    </tr>
                                </thead>
                                <tbody id="history-tbody" className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredHistoryJobs.map(job => (
                                        <tr key={job.id} data-location={job.locationId || 'default'} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setSelectedJobForModal(job)}>
                                            <td className="px-4 py-3 text-gray-900 dark:text-white">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                            {((customer.serviceLocations && customer.serviceLocations.length > 0) || customer.customerType === 'Property Management') && (
                                                <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {job.locationName || 'Main Office'}
                                                </td>
                                            )}
                                            <td className="px-4 py-3">{job.tasks.join(', ')}</td>
                                            <td className="px-4 py-3">
                                                 <div>{job.assignedTechnicianName}</div>
                                                 {job.assistants && job.assistants.length > 0 && (
                                                     <div 
                                                         className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 cursor-help"
                                                         title={job.assistants.map((id: string) => {
                                                             const u = state.users?.find((user: any) => user.id === id);
                                                             return u ? `${u.firstName} ${u.lastName}` : '';
                                                         }).filter(Boolean).join(', ')}
                                                     >
                                                         + {job.assistants.length} Crew
                                                     </div>
                                                 )}
                                             </td>
                                            <td className="px-4 py-3 font-bold">${(job.invoice?.amount || 0).toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{job.jobStatus}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    title={job.isServicePlan ? "Part of Service Plan (click to remove)" : "Click to mark as part of Service Plan"}
                                                    onClick={(e) => handleToggleServicePlan(job, e)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 transition-all mx-auto ${
                                                        job.isServicePlan 
                                                            ? 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shadow-sm'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {job.isServicePlan ? (
                                                        <>
                                                            <CheckCircle size={13} className="text-purple-600 dark:text-purple-400" />
                                                            <span>Plan Visit</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlusCircle size={13} />
                                                            <span>Cover with Plan</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                                        {activeTab === 'financials' && (
                        <div className="space-y-6">
                            {/* 1. Active Membership Section */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Active Membership</h4>
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
                                                    className="p-3 bg-white dark:bg-gray-800 border-2 border-purple-100 dark:purple-800 rounded-lg hover:border-purple-500 text-left transition-all"
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
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full text-green-600">
                                                <ShieldCheck size={20}/>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-green-800 dark:text-green-300">{membership.planName} Membership</h4>
                                                <p className="text-xs text-green-700 dark:text-green-400">Valid until {new Date(membership.endDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="bg-green-200 text-green-800 text-[10px] px-2 py-1 rounded font-bold">ACTIVE</span>
                                            <p className="text-xs text-green-600 font-bold mt-1">{membership.visitsRemaining} Visits Left</p>
                                        </div>
                                    </div>
                                ) : !isEnrolling && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 italic">
                                        No active membership plan found.
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-200 dark:border-slate-800 my-6" />

                            {/* 2. Statement of Account Section */}
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Statement Header */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-5 border-b border-slate-200 dark:border-slate-800 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="p-1.5 rounded-lg bg-[#123A63]/10 text-[#123A63] dark:text-sky-400">
                                                <DollarSign size={20} />
                                            </span>
                                            <h4 className="font-extrabold text-2xl text-[#123A63] dark:text-sky-300 tracking-tight">Statement of Account</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Real-time ledger overview for corporate client and properties</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button 
                                            onClick={handleDownloadPDF} 
                                            variant="secondary"
                                            className="text-xs py-2 px-4 flex items-center gap-2 border-slate-200 dark:border-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-semibold rounded-lg shadow-sm"
                                        >
                                            <Download size={14}/> Download PDF
                                        </Button>
                                        <Button 
                                            onClick={handleEmailStatement} 
                                            className="text-xs py-2 px-4 flex items-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-semibold rounded-lg shadow-sm hover:shadow-[#123A63]/20 transition-all border-0"
                                        >
                                            <Mail size={14}/> Email Statement
                                        </Button>
                                    </div>
                                </div>

                                {/* Account Summary & Client Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-[#123A63] dark:text-sky-400 uppercase tracking-widest block">Client Information</span>
                                        <p className="font-extrabold text-base text-slate-800 dark:text-slate-100 leading-tight">{customer.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{customer.address}</p>
                                        {(customer.email || customer.phone) && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                                                {customer.email && <p>Email: {customer.email}</p>}
                                                {customer.phone && <p>Phone: {customer.phone}</p>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 md:text-right flex flex-col justify-between items-start md:items-end">
                                        <div>
                                            <span className="text-[10px] font-bold text-[#123A63] dark:text-sky-400 uppercase tracking-widest block">Account Summary</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-350 mt-1">Client Code: <strong className="font-mono text-slate-800 dark:text-slate-100">{customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                            <p className="text-xs text-slate-600 dark:text-slate-350">Account Number: <strong className="text-[#123A63] dark:text-sky-400 font-extrabold">{customer.id.replace(/\D/g, '')}</strong></p>
                                            <p className="text-xs text-slate-600 dark:text-slate-350">Payment Terms: <strong className="text-slate-800 dark:text-slate-100">{customer.paymentTerms || 'Net 30'}</strong></p>
                                            <p className="text-xs text-slate-600 dark:text-slate-350">Statement Date: <strong className="text-slate-800 dark:text-slate-100">{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong></p>
                                        </div>
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
                                <div className="flex justify-between items-center pt-2">
                                    <div className="flex gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setStatementUnpaidOnly(false)} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${!statementUnpaidOnly ? 'bg-[#123A63] text-white border-[#123A63] shadow-sm' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-800 hover:bg-slate-50'}`}
                                        >
                                            Show All Activity
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setStatementUnpaidOnly(true)} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${statementUnpaidOnly ? 'bg-[#123A63] text-white border-[#123A63] shadow-sm' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-800 hover:bg-slate-50'}`}
                                        >
                                            Show Open Invoices Only
                                        </button>
                                    </div>
                                </div>

                                {/* Ledger Table */}
                                <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 text-slate-500 font-extrabold uppercase text-[9px] tracking-wider">
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3">Invoice #</th>
                                                    <th className="px-4 py-3">Property Location</th>
                                                    <th className="px-4 py-3">Reference / PO #</th>
                                                    <th className="px-4 py-3 text-right">Debit (Dr)</th>
                                                    <th className="px-4 py-3 text-right">Credit (Cr)</th>
                                                    <th className="px-4 py-3 text-right">Balance</th>
                                                    <th className="px-4 py-3 text-right">Running Bal</th>
                                                    <th className="px-4 py-3">Due Date</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-center">Linked Documents</th>
                                                    <th className="px-4 py-3 text-center">Actions</th>
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
                                                        const isPaid = inv.status === 'Paid';
                                                        
                                                        return (
                                                            <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                                <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-semibold">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setEditingInvoiceJobId(job.id)} 
                                                                        className="text-xs text-[#123A63] hover:underline font-extrabold font-mono uppercase bg-transparent border-0 p-0 cursor-pointer"
                                                                    >
                                                                        #{inv.id || job.id.slice(0, 8)}
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-350">{job.locationName || 'Main Office'}</td>
                                                                <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{job.poNumber || 'N/A'}</td>
                                                                <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">${amount.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-450">${isPaid ? amount.toFixed(2) : '0.00'}</td>
                                                                <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">${(isPaid ? 0 : amount).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">${tx.runningBalance?.toFixed(2) || '0.00'}</td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-semibold">{inv.dueDate ? new Date(inv.dueDate.replace(/-/g, '/')).toLocaleDateString() : 'N/A'}</td>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                        isPaid 
                                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                                                    }`}>{inv.status || 'Unpaid'}</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {renderJobDocuments(job)}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center whitespace-nowrap">
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
                                </div>

                                {/* Aging Summary box */}
                                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-[#123A63] dark:text-sky-400 uppercase tracking-widest block">Aging Analysis (Open Receivables)</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">As of Today</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                                    </div>
                                </div>
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
                                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Warranty Disclaimer Agreements</h4>
                                <WarrantySection 
                                    jobs={customerJobs} 
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
                                                            ? <p>This is a friendly reminder that your upcoming preventative maintenance service is scheduled for the target month of <strong>{customer.maintenanceAgreement?.visits.find((v: any) => v.id === selectedVisitForNotification)?.targetMonth}</strong> under your agreement.</p>
                                                            : <p>We noticed that your scheduled preventative maintenance service for target month of <strong>{customer.maintenanceAgreement?.visits.find((v: any) => v.id === selectedVisitForNotification)?.targetMonth}</strong> is currently overdue.</p>
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
                        <div 
                            onDragEnter={handleDragDocs}
                            onDragOver={handleDragDocs}
                            onDragLeave={handleDragDocs}
                            onDrop={handleDropDocs}
                            className="space-y-6 relative"
                        >
                            {dragActiveDocs && (
                                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-primary-500 rounded-2xl p-6 text-center animate-fade-in">
                                    <div className="p-4 bg-primary-500/10 rounded-full border border-primary-500/30 mb-3 animate-bounce">
                                        <Upload className="w-10 h-10 text-primary-500" />
                                    </div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider">Drop here to upload to Documents</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports images and PDFs</p>
                                </div>
                            )}
                            {/* Upload Area & Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-805 shadow-sm">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Customer Documents & Media</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">View and manage photos, PDFs, and files uploaded for this customer or associated visits.</p>
                                </div>
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm shrink-0">
                                    <input type="file" onChange={(e) => handleFileUpload(e, 'document')} className="hidden" accept="image/*,application/pdf" />
                                    <PlusCircle size={16} />
                                    <span>Upload New File</span>
                                </label>
                            </div>

                            {/* Grouped Files List */}
                            {groupedFiles.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                    <FileText size={40} className="mx-auto text-gray-400 mb-3" />
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">No documents or media found</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Upload files or complete jobs to see photos and files here.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {groupedFiles.map(group => {
                                        const renderFileCard = (file: StoredFile) => (
                                            <div 
                                                key={file.id} 
                                                className="relative group bg-gray-100 dark:bg-gray-750 rounded-xl h-32 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
                                            >
                                                <button type="button" onClick={() => setViewingFile(file)} className="absolute inset-0 w-full h-full text-left cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all z-0 outline-none" title="View Document" aria-label="View Document">
                                                    {file.fileType.includes('image') ? (
                                                        <img src={file.dataUrl || (file as any).url} alt={file.fileName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 dark:text-gray-400 p-2 text-center">
                                                            <FileText size={24} className="mb-1 text-gray-400"/>
                                                            <span className="truncate w-full px-2">{file.fileName}</span>
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
                                                    className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10"
                                                    title="Delete File"
                                                    aria-label="Delete File"
                                                    style={{ border: 'none' }}
                                                >
                                                    <TrashIcon size={12}/>
                                                </button>
                                            </div>
                                        );

                                        return (
                                            <div key={group.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-800 shadow-sm overflow-hidden">
                                                {/* Group Header */}
                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                            {group.title}
                                                        </h4>
                                                        {group.subtitle && (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                                                                {group.subtitle}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
                                                        {(group.beforeFiles.length + group.afterFiles.length + group.otherFiles.length)} { (group.beforeFiles.length + group.afterFiles.length + group.otherFiles.length) === 1 ? 'file' : 'files' }
                                                    </span>
                                                </div>
                                                
                                                {/* Group Content */}
                                                <div className="p-4 space-y-6">
                                                    {/* Before and After Photos Grid */}
                                                    {(group.beforeFiles.length > 0 || group.afterFiles.length > 0) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {/* Before Section */}
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                                    <h5 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Before Repair</h5>
                                                                </div>
                                                                {group.beforeFiles.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-6 text-center bg-slate-50/50 dark:bg-slate-850/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                                                        No before photos
                                                                    </p>
                                                                ) : (
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                        {group.beforeFiles.map(renderFileCard)}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* After Section */}
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                    <h5 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">After Repair</h5>
                                                                </div>
                                                                {group.afterFiles.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-6 text-center bg-slate-50/50 dark:bg-slate-850/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                                                        No after photos
                                                                    </p>
                                                                ) : (
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                        {group.afterFiles.map(renderFileCard)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Documents and Other Files Section */}
                                                    {group.otherFiles.length > 0 && (
                                                        <div className={(group.beforeFiles.length > 0 || group.afterFiles.length > 0) ? "pt-4 border-t border-slate-100 dark:border-slate-800" : ""}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                                <h5 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Documents & Other Files</h5>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                                {group.otherFiles.map(renderFileCard)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* FILE PREVIEW MODAL */}
            {viewingFile && (
                <Modal isOpen={!!viewingFile} onClose={() => setViewingFile(null)} title={viewingFile.fileName || "File Preview"} size="lg">
                    <div className="space-y-4 p-4">
                        <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] shadow-2xl">
                            {viewingFile.fileType.includes('image') ? (
                                <img src={viewingFile.dataUrl || (viewingFile as any).url} className="max-w-full max-h-full object-contain" alt="Preview"/>
                            ) : viewingFile.fileType.includes('pdf') ? (
                                <iframe src={viewingFile.dataUrl} className="w-full h-[60vh] border-0" title="PDF Preview" />
                            ) : (
                                <div className="p-12 text-center text-white">
                                    <FileText size={64} className="mx-auto mb-4 text-slate-500"/>
                                    <p className="font-bold">No preview available</p>
                                    <p className="text-sm text-slate-400 mt-1 mb-6">This file type ({viewingFile.fileType}) cannot be previewed directly.</p>
                                    <a 
                                        href={viewingFile.dataUrl} 
                                        download={viewingFile.fileName} 
                                        className="bg-primary-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-700 transition-colors"
                                    >
                                        Download File
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewingFile.fileType}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{viewingFile.fileName}</p>
                            </div>
                            <Button variant="secondary" onClick={() => setViewingFile(null)} className="flex-shrink-0">Close Window</Button>
                        </div>
                    </div>
                </Modal>
            )}

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

            {isLogCallModalOpen && (
                <LogCallModal
                    isOpen={isLogCallModalOpen}
                    onClose={() => setIsLogCallModalOpen(false)}
                    customerId={customer?.id}
                    recipientPhone={customer?.phone}
                />
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

            {/* SITE PROPERTY MODAL */}
            {isAddingLocation && (
                <Modal
                    isOpen={isAddingLocation}
                    onClose={() => setIsAddingLocation(false)}
                    title={newLocation.id ? "Edit Site Property" : "Add New Site Property"}
                    size="lg"
                    zIndex="z-[300]"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Location Name (e.g. Primary, Warehouse)"
                                isBlock
                                value={newLocation.name || ''}
                                onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                            />
                            <Input
                                label="PO Number / Property Code"
                                isBlock
                                value={newLocation.poNumber || ''}
                                onChange={e => setNewLocation({ ...newLocation, poNumber: e.target.value })}
                                placeholder="e.g. PO-10293 or PROP-A1"
                            />
                        </div>
                        <Input
                            label="Street Address"
                            isBlock
                            value={newLocation.address || ''}
                            onChange={e => setNewLocation({ ...newLocation, address: e.target.value })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="City"
                                isBlock
                                value={newLocation.city || ''}
                                onChange={e => setNewLocation({ ...newLocation, city: e.target.value })}
                            />
                            <Input
                                label="State"
                                isBlock
                                value={newLocation.state || ''}
                                onChange={e => setNewLocation({ ...newLocation, state: e.target.value })}
                            />
                            <Input
                                label="Zip"
                                isBlock
                                value={newLocation.zip || ''}
                                onChange={e => setNewLocation({ ...newLocation, zip: e.target.value })}
                            />
                        </div>
                        <Textarea
                            label="Property Notes (Optional)"
                            value={newLocation.notes || ''}
                            onChange={e => setNewLocation({ ...newLocation, notes: e.target.value })}
                            placeholder="Access instructions, gate codes, property specifics..."
                        />
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setIsAddingLocation(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddLocation}>
                                Save Property
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* COMPANY CONTACT MODAL */}
            {isAddingContact && (
                <Modal
                    isOpen={isAddingContact}
                    onClose={() => setIsAddingContact(false)}
                    title={newContact.id ? "Edit Contact Details" : "Add New Contact"}
                    size="lg"
                    zIndex="z-[300]"
                >
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Full Name"
                                value={newContact.name || ''}
                                onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                            <Input
                                label="Title / Role (Optional)"
                                value={newContact.title || ''}
                                onChange={e => setNewContact({ ...newContact, title: e.target.value })}
                                placeholder="e.g. Facilities Manager"
                            />
                            <Input
                                label="Phone Number"
                                value={newContact.phone || ''}
                                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                                placeholder="e.g. (555) 000-0000"
                            />
                            <Input
                                label="Email Address"
                                value={newContact.email || ''}
                                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                placeholder="e.g. john@example.com"
                            />
                        </div>

                        {/* Customer Portal Access & Permissions */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-sm">
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
                                <span>Enable Customer Portal Access</span>
                            </label>

                            {newContact.portalRole && (
                                <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
                                    <Select 
                                        label="Portal Access Role" 
                                        value={newContact.portalRole} 
                                        onChange={e => setNewContact({
                                            ...newContact, 
                                            portalRole: e.target.value,
                                            allowedLocationIds: []
                                        })}
                                    >
                                        <option value="corporate">Corporate Owner (Full Access to All Properties)</option>
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
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Assign Regional Stores</p>
                                            <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-950 space-y-2 custom-scrollbar">
                                                {customer.serviceLocations && customer.serviceLocations.length > 0 ? (
                                                    customer.serviceLocations.map((loc: any) => {
                                                        const isChecked = newContact.allowedLocationIds?.includes(loc.id);
                                                        return (
                                                            <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs p-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded transition-colors">
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
                                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                                                                />
                                                                <span className="text-slate-800 dark:text-slate-200 font-medium">{loc.propertyName || loc.name}</span>
                                                            </label>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No storefront locations listed.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={newContact.isPrimary} 
                                    onChange={e => setNewContact({ ...newContact, isPrimary: e.target.checked })} 
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set as Primary Contact</span>
                            </label>
                            <div className="flex justify-end gap-3">
                                <Button variant="secondary" onClick={() => setIsAddingContact(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddContact}>
                                    Save Contact
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default CustomerMasterModal;
