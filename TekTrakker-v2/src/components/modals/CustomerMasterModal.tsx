/* eslint-disable @typescript-eslint/no-explicit-any */
import { getBaseUrl } from "lib/utils";

import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { getNextInvoiceNumbers } from 'lib/numbering';
import type { Customer, EquipmentAsset, ServiceAgreement, MembershipPlan, Job, StoredFile } from 'types';
import { TrashIcon, PlusCircle, Wrench, FileText, DollarSign, Image, User, Mail, Printer, Sparkles, ShieldCheck, MessageSquare, CheckCircle, Edit, Share2, Copy, Upload, PhoneCall, PhoneOff, Calendar, XCircle, Clock, AlertCircle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { globalConfirm } from "lib/globalConfirm";
import { uploadFileToStorage } from 'lib/storageService';
import { sendEmail } from 'lib/notificationService';
import showToast from 'lib/toast';
import EquipmentHierarchy from 'pages/admin/projects/components/tabs/equipment/EquipmentHierarchy';
import WarrantySection from 'pages/customer/components/WarrantySection';

interface CustomerMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
}

const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({ isOpen, onClose, customerId }) => {
    const { state, dispatch } = useAppContext();
    const customer = state.customers.find(c => c.id === customerId);
    



    const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'history' | 'financials' | 'docs' | 'warranties' | 'communications'>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    
    // Property Location State
    const [newLocation, setNewLocation] = useState<any>({ name: '', address: '', city: '', state: '', zip: '', notes: '' });
    const [isAddingLocation, setIsAddingLocation] = useState(false);

    // Contacts State
    const [newContact, setNewContact] = useState<any>({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false });
    const [isAddingContact, setIsAddingContact] = useState(false);

    // Membership Manual Enrollment State
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollSystemCount, setEnrollSystemCount] = useState(1);
    const [priceOverride, setPriceOverride] = useState<number | ''>('');
    const [isProcessingEnrollment, setIsProcessingEnrollment] = useState(false);

    // Modal States
    const [viewQrAsset, setViewQrAsset] = useState<EquipmentAsset | null>(null);
    const [viewingFile, setViewingFile] = useState<StoredFile | null>(null);

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
                if (m.customerId === customer?.id || m.senderId === customer?.id || m.receiverId === customer?.id) {
                    isMatch = true;
                }

                // Match by normalized phones
                if (!isMatch) {
                    const sendDig = m.senderId ? m.senderId.replace(/\\D/g, '') : '';
                    const sendTen = sendDig.length === 11 && sendDig.startsWith('1') ? sendDig.substring(1) : sendDig;
                    
                    const recvDig = m.receiverId ? m.receiverId.replace(/\\D/g, '') : '';
                    const recvTen = recvDig.length === 11 && recvDig.startsWith('1') ? recvDig.substring(1) : recvDig;

                    if (customerPhones.some(p => p === sendTen || p === recvTen)) {
                        isMatch = true;
                    }
                }

                // Match by email
                if (!isMatch && m.type === 'email') {
                    const mSenderEmail = m.senderId ? m.senderId.trim().toLowerCase() : '';
                    const mRecvEmail = m.receiverId ? m.receiverId.trim().toLowerCase() : '';
                    if (customerEmails.some(e => e === mSenderEmail || e === mRecvEmail)) {
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
                        title: badgeLabel,
                        subtitle: m.senderName ? `From: ${m.senderName}` : undefined,
                        content: m.content,
                        icon,
                        iconColor,
                        badgeColor,
                        badgeLabel
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

        return items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [customer?.id, customerPhones, customerEmails, state.messages, customerJobs, state.currentUser?.id]);

    if (!customer) return null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category?: string) => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast.warn("File too large — must be under 5MB. Please compress the file.");
            e.target.value = '';
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
                dataUrl: downloadUrl, // Storing bucket URL instead of Base64
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'admin',
                metadata: category ? { category } : {}
            };
            
            const updatedFiles = [...(customer.files || []), newFile];
            await db.collection('customers').doc(customer.id).update({ files: updatedFiles });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, files: updatedFiles } });
        } catch (err) {
            console.error(err);
            showToast.error("Upload failed.");
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
            await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
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
            await db.collection('customers').doc(customer.id).update({
                organizationId: 'unaffiliated',
                isDeleted: true,
                detachedAt: new Date().toISOString(),
                originalOrganizationId: state.currentOrganization?.id || ''
            });
            dispatch({ type: 'DELETE_CUSTOMER', payload: customer.id });
            onClose();
        } catch (e) {
            console.error(e);
            showToast.error("Removal failed. Please ensure you have permissions.");
        }
    };

    const handleSaveOverview = async () => {
        const updated = { ...customer, ...formData };
        await db.collection('customers').doc(customer.id).update(updated);
        dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
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
            propertyName: newLocation.propertyName || newLocation.name,
            customerId: customer.id,
            organizationId: state.currentOrganization?.id || 'default'
        };

        let updatedLocations;
        if (locPayload.id) {
            updatedLocations = (customer.serviceLocations || []).map((l:any) => l.id === locPayload.id ? locPayload : l);
            await db.collection('serviceLocations').doc(locPayload.id).set(locPayload, { merge: true });
        } else {
            locPayload.id = `loc-${Date.now()}`;
            updatedLocations = [...(customer.serviceLocations || []), locPayload];
            await db.collection('serviceLocations').doc(locPayload.id).set(locPayload);
        }
        await db.collection('customers').doc(customer.id).update({ serviceLocations: updatedLocations });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });
        setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '' });
        setIsAddingLocation(false);
    };

    const handleDeleteLocation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await globalConfirm("Remove this property? Equipment or jobs mapped to it may lose context.")) return;
        const updatedLocations = (customer.serviceLocations || []).filter((l:any) => l.id !== id);
        await db.collection('serviceLocations').doc(id).delete();
        await db.collection('customers').doc(customer.id).update({ serviceLocations: updatedLocations });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });
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

        await db.collection('customers').doc(customer.id).update({ contacts: updatedContacts });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, contacts: updatedContacts } });
        setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false });
        setIsAddingContact(false);
        showToast.success("Contact saved.");
    };

    const handleDeleteContact = async (id: string) => {
        if (!await globalConfirm("Remove this contact?")) return;
        const updatedContacts = (customer.contacts || []).filter((c:any) => c.id !== id);
        await db.collection('customers').doc(customer.id).update({ contacts: updatedContacts });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, contacts: updatedContacts } });
    };

    const handleDeleteFile = async (file: StoredFile, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await globalConfirm("Delete this file permanently?")) return;
        try {
            if (file.parentType === 'customer') {
                const updatedFiles = (customer.files || []).filter((f: any) => f.id !== file.id);
                await db.collection('customers').doc(customer.id).update({ files: updatedFiles });
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, files: updatedFiles } });
            } else if (file.parentType === 'job' && file.parentId) {
                const jobToUpdate = state.jobs.find((j: Job) => j.id === file.parentId);
                if (jobToUpdate) {
                    const updatedFiles = (jobToUpdate.files || []).filter((f: any) => f.id !== file.id);
                    await db.collection('jobs').doc(jobToUpdate.id).update({ files: updatedFiles });
                    dispatch({ type: 'UPDATE_JOB', payload: { ...jobToUpdate, files: updatedFiles } });
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
                db.collection('serviceAgreements').doc(agreementId).set(newAgreement),
                db.collection('jobs').doc(firstInvoiceJob.id).set(firstInvoiceJob)
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
        const portalLink = `${getBaseUrl()}/#/register?view=register_user&userType=customer&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(customer.name)}&oid=${customer.organizationId}`;


        try {
            // 1. Create a root user document (Acts as an INVITE for registration)
            const inviteDoc: any = {
                email: normalizedEmail,
                organizationId: org?.id || 'unaffiliated',
                role: 'customer',
                status: 'invited',
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
                await db.collection('users').doc(normalizedEmail).set(inviteDoc, { merge: true });
            } catch (err) {
                console.warn("Could not create stub user invite document due to permissions, but proceeding to send email link:", err);
            }
            
            // 2. Prepare Email Payload
            const mailPayload = {
                to: [normalizedEmail],
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

        const generatedInvoiceIds = await getNextInvoiceNumbers(state.currentOrganization?.id || '', customer.serviceLocations.length);
        let pmIndex = 0;
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
                invoice: { id: generatedInvoiceIds[pmIndex++], status: 'Unpaid', items: [], subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, amount: 0 },
                jobEvents: [],
                createdAt: new Date().toISOString()
            };

            try {
                await db.collection('jobs').doc(newJobId).set(newJob);
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
            await db.collection('messages').doc(msgObj.id).set(msgObj);
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
                            <tab.icon size={16} /> {tab.label}
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
                                    <button onClick={() => { setIsEditing(!isEditing); setFormData(customer); }} className="text-xs text-primary-600 hover:underline">
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
                                        <Input label="Email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                                        <Input label="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                        
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
                                        </div>

                                        <Textarea label="Internal Notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Gate codes, warnings, preferences..." />
                                        
                                        <Button onClick={handleSaveOverview}>Save Changes</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div><p className="text-gray-500">Type</p><p className="font-medium dark:text-white">{customer.customerType || 'Residential'}</p></div>
                                        <div><p className="text-gray-500">Email</p><p className="font-medium dark:text-white">{customer.email || 'N/A'}</p></div>
                                        <div><p className="text-gray-500">Phone</p><p className="font-medium dark:text-white">{customer.phone || 'N/A'}</p></div>
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
                                            <button title="Add Property" aria-label="Add Property" onClick={() => { setNewLocation({ name: '', address: '', city: '', state: '', zip: '', notes: '' }); setIsAddingLocation(!isAddingLocation); }} className="text-primary-600 hover:text-primary-700">
                                                <PlusCircle size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {isAddingLocation && (
                                        <div className="space-y-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 shadow-inner animate-in fade-in slide-in-from-top-2">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">{newLocation.id ? 'Edit Property' : 'Add Property'}</p>
                                            
                                            <Input label="Location Name (e.g. Primary, Warehouse)" isBlock value={newLocation.name || ''} onChange={e => setNewLocation({...newLocation, name: e.target.value})} />
                                            <Input label="PO Number / Property Code" isBlock value={newLocation.poNumber || ''} onChange={e => setNewLocation({...newLocation, poNumber: e.target.value})} placeholder="e.g. PO-10293 or PROP-A1" />
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
                                        {customer.serviceLocations && customer.serviceLocations.length > 0 ? customer.serviceLocations.map((loc: any) => (
                                            <div key={loc.id} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex justify-between items-start transition-colors hover:border-primary-300">
                                                <div>
                                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{loc.name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{loc.address}</p>
                                                    {loc.city && <p className="text-[10px] text-slate-500">{loc.city}, {loc.state}</p>}
                                                    {loc.poNumber && <p className="text-[10px] font-black text-emerald-600 mt-1 uppercase tracking-widest">PO: {loc.poNumber}</p>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button title="Edit Property" aria-label="Edit Property" onClick={() => { setNewLocation(loc); setIsAddingLocation(true); }} className="text-slate-400 hover:text-primary-600 transition-colors">
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
                                {(customer.customerType === 'Property Management' || customer.customerType === 'Commercial') && (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Company Contacts</h4>
                                            <button title="Add Contact" aria-label="Add Contact" onClick={() => { setNewContact({ id: '', name: '', title: '', phone: '', email: '', isPrimary: false }); setIsAddingContact(!isAddingContact); }} className="text-primary-600 hover:text-primary-700">
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
                                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                                            {contact.name} {contact.isPrimary && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded uppercase font-bold">Primary</span>}
                                                        </p>
                                                        {contact.title && <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">{contact.title}</p>}
                                                        <div className="flex flex-col gap-0.5 mt-1">
                                                            {contact.phone && <p className="text-[10px] text-slate-500 flex items-center gap-1"><span className="text-slate-400">P:</span> {contact.phone}</p>}
                                                            {contact.email && <p className="text-[10px] text-slate-500 flex items-center gap-1"><span className="text-slate-400">E:</span> {contact.email}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
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
                                )}
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
                            <EquipmentHierarchy customer={customer} />
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {customer.customerType === 'Property Management' && (
                                <div className="flex justify-end">
                                    <select 
                                        title="Filter History by Location"
                                        aria-label="Filter History by Location"
                                        className="text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        onChange={(e) => {
                                            const filterVal = e.target.value;
                                            const tbody = document.getElementById('history-tbody');
                                            if (tbody) {
                                                Array.from(tbody.children).forEach((tr: any) => {
                                                    if (!filterVal || tr.getAttribute('data-location') === filterVal) {
                                                        tr.style.display = '';
                                                    } else {
                                                        tr.style.display = 'none';
                                                    }
                                                });
                                            }
                                        }}
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
                                        {customer.customerType === 'Property Management' && <th className="px-4 py-2">Property</th>}
                                        <th className="px-4 py-2">Service</th>
                                        <th className="px-4 py-2">Tech</th>
                                        <th className="px-4 py-2">Total</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="history-tbody" className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {customerJobs.map(job => (
                                        <tr key={job.id} data-location={job.locationId || 'default'} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                            <td className="px-4 py-3 text-gray-900 dark:text-white">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                            {customer.customerType === 'Property Management' && (
                                                <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {job.locationName || 'Main Office'}
                                                </td>
                                            )}
                                            <td className="px-4 py-3">{job.tasks.join(', ')}</td>
                                            <td className="px-4 py-3">{job.assignedTechnicianName}</td>
                                            <td className="px-4 py-3 font-bold">${(job.invoice?.amount || 0).toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{job.jobStatus}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
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
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-200 dark:border-purple-800 animate-fade-in">
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
                                                                ? `$${plan.addonFeeAmount.toFixed(2)} + ${plan.addonFeePercent}%`
                                                                : (plan.addonFeeAmount || 0) > 0
                                                                    ? `$${plan.addonFeeAmount.toFixed(2)}`
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
                            
                            <h4 className="font-bold text-gray-900 dark:text-white mt-6">Billing History</h4>
                            <div className="space-y-2">
                                {customerJobs.filter(j => j.invoice).map((job, idx) => {
                                    const inv = job.invoice as any;
                                    return (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 border rounded">
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">#{inv.id || job.id.slice(0, 8)}</p>
                                            <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900 dark:text-white">${(inv.total || 0).toFixed(2)}</p>
                                            <span className={`text-xs font-bold ${inv.status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>{inv.status || 'Unpaid'}</span>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                    )}

                    {activeTab === 'warranties' && (
                        <div className="space-y-6">
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
                                                                await db.collection('customers').doc(customer.id).update({ equipment: updatedEq });
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
                                            await db.collection('jobs').doc(job.id).update({ invoice: updatedJob.invoice });
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
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-gray-950 dark:text-white text-lg">Communications & Lifecycle Log</h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {communicationTimeline.length} total events tracked
                                </span>
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
                                                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100/50 dark:border-slate-900/50 font-normal">
                                                            {item.content}
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

                    {activeTab === 'docs' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
                            <label className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-400">
                                <input type="file" onChange={(e) => handleFileUpload(e, 'document')} className="hidden" accept="image/*,application/pdf" />
                                <PlusCircle size={24} />
                                <span className="text-xs mt-2">Upload</span>
                            </label>
                            {customerFiles.filter(f => f.metadata?.category !== 'warranty').map(file => (
                                                <div 
                                                    key={file.id} 
                                                    className="relative group bg-gray-100 dark:bg-gray-700 rounded h-32 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
                                                >
                                                    <button type="button" onClick={() => setViewingFile(file)} className="absolute inset-0 w-full h-full text-left cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all z-0 outline-none" title="View Document" aria-label="View Document">
                                                        {file.fileType.includes('image') ? (
                                                            <img src={file.dataUrl || (file as any).url} alt={file.fileName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 p-2 text-center">
                                                                <FileText size={24} className="mb-1 text-gray-400"/>
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
                                                        className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10"
                                                        title="Delete File"
                                                        aria-label="Delete File"
                                                    >
                                                        <TrashIcon size={12}/>
                                                    </button>
                                                </div>
                            ))}
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
        </>
    );
};

export default CustomerMasterModal;
