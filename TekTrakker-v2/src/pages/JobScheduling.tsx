import showToast from "lib/toast";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Trash2, MessageSquare, CheckCircle, Globe, Users, Clock, MapPin, 
    FileText, Edit, Share2, Copy, Calendar, AlignLeft, CalendarPlus, Briefcase, 
    ShieldCheck, DollarSign, Search, Link2, Archive, Send, Mail, ExternalLink, ChevronDown, RotateCcw,
    User as UserIcon
} from 'lucide-react';
import type { Job, User } from 'types';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import { formatAddress, cleanUndefinedFields, safeFormatTimeString, resolveSiteLocationName } from 'lib/utils';
import { globalConfirm } from "lib/globalConfirm";
import { getJobTimeSummary } from 'lib/jobTimeHelper';

import JobAppointmentModal from 'components/modals/JobAppointmentModal';
import DocumentPreview from 'components/ui/DocumentPreview';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobLinkingModal from 'components/modals/JobLinkingModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import LocationAuditModal from 'components/modals/LocationAuditModal';
import CustomerMasterModal from 'components/modals/CustomerMasterModal';
import { resolveDocumentDisplayId, resolveJobProposalNumber, resolveJobInvoiceNumber, resolveJobWorkOrderNumber, extractJobSlug } from 'lib/numbering';

const JobScheduling: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const highlightJobId = searchParams.get('jobId');
    const tableRef = useRef<HTMLDivElement>(null);

    // Modal States
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsJob, setSmsJob] = useState<Job | null>(null);
    const [smsMessage, setSmsMessage] = useState('');

    const [auditLocationTarget, setAuditLocationTarget] = useState<{ customerId?: string; locationId?: string } | null>(null);
    const [selectedCustomerMasterId, setSelectedCustomerMasterId] = useState<string | null>(null);
    const [activeSignOffJob, setActiveSignOffJob] = useState<Job | null>(null);
    const [viewingWorkOrderJob, setViewingWorkOrderJob] = useState<Job | null>(null);
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [viewingProposal, setViewingProposal] = useState<any | null>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<Job | null>(null);
    const [previewOtherDoc, setPreviewOtherDoc] = useState<any | null>(null);
    const [editingFullJob, setEditingFullJob] = useState<Job | null>(null);
    const [linkingJob, setLinkingJob] = useState<Job | null>(null);
    const [emailJob, setEmailJob] = useState<Job | null>(null);
    const [notesJob, setNotesJob] = useState<Job | null>(null);
    const [jobNotesText, setJobNotesText] = useState('');
    const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);

    const handleCopyRef = (jobId: string) => {
        const ref = `JOB-${jobId.replace('job-', '')}`;
        navigator.clipboard.writeText(ref);
        showToast.success(`Copied ${ref} to clipboard`);
    };

    const handleArchiveJob = async (job: Job) => {
        const newArchived = !job.archived;
        const updates = {
            archived: newArchived,
            archivedAt: newArchived ? new Date().toISOString() : null,
            archivedBy: newArchived ? state.currentUser?.id : null
        };
        try {
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            showToast.success(newArchived ? "Job taken off board (Archived)" : "Job restored to board");
        } catch (err) {
            console.error("Failed to archive job:", err);
            showToast.error("Failed to update job status");
        }
    };

    const openNotesModal = (job: Job) => {
        setNotesJob(job);
        setJobNotesText(job.notes || (job as any).internalNotes || '');
    };

    const handleSaveNotes = async () => {
        if (!notesJob) return;
        try {
            await db.collection('jobs').doc(notesJob.id).update(cleanUndefinedFields({ notes: jobNotesText }));
            dispatch({ type: 'UPDATE_JOB', payload: { ...notesJob, notes: jobNotesText } });
            showToast.success('Internal notes saved successfully');
            setNotesJob(null);
        } catch (err) {
            console.error("Failed to save notes:", err);
            showToast.error("Failed to save notes");
        }
    };

    const handleClearSignOff = async (job: Job) => {
        const confirmClear = await globalConfirm(
            t("Are you sure you want to remove the sign-off sheet and clear all recorded signatures for this job?"),
            t("Clear Sign-off"),
            t("Clear"),
            t("Cancel")
        );
        if (!confirmClear) return;

        try {
            const updatedFiles = (job.files || []).filter((f: any) => {
                const name = (f.fileName || '').toLowerCase();
                const label = (f.metadata?.label || f.label || '').toLowerCase();
                const id = f.id || '';
                return !name.includes('signoff') && 
                       !name.includes('sign-off') && 
                       !name.includes('sign_off') && 
                       !label.includes('signoff') && 
                       !label.includes('sign-off') && 
                       !id.startsWith('signoff-doc') &&
                       f.metadata?.category !== 'signoff';
            });

            const updates: any = {
                files: updatedFiles,
                signOff: null,
                signOffSheetUrl: null,
                signoffSheetUrl: null,
                customWorkOrderFormUrl: null,
                signOffSignature: null,
                customerSignature: null,
                customerSignatureName: null,
                siteManagerSignature: null,
                siteManagerName: null,
                techSignature: null,
                techSignatureName: null,
                signature: null,
                signerName: null,
                signatureTimestamp: null,
                signedAt: null,
                managerName: null,
                updatedAt: new Date().toISOString()
            };

            if (job.workflowState) {
                updates.workflowState = {
                    ...job.workflowState,
                    customerSignature: null,
                    customerSignatureName: null,
                    siteManagerSignature: null,
                    siteManagerName: null,
                    signature: null,
                    signerName: null,
                    signatureTimestamp: null
                };
            }

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            showToast.success(t("Sign-off and signatures cleared successfully."));
        } catch (err) {
            console.error("Failed to clear sign-off:", err);
            showToast.error(t("Failed to clear sign-off."));
        }
    };

    const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin';

    useEffect(() => {
        if (highlightJobId && tableRef.current) {
            const row = tableRef.current.querySelector(`[data-job-id="${highlightJobId}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [highlightJobId, state.jobs]);

    const employees = useMemo(() => state.users.filter((u: User) => u.organizationId === state.currentOrganization?.id && (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician')), [state.users, state.currentOrganization]);

    const allJobs = useMemo(() => {
        const activeJobs = (state.jobs as Job[]).filter((job: Job) => {
            const isCompleted = job.jobStatus === 'Completed';
            const isCancelled = job.jobStatus === 'Cancelled';
            const isPaid = job.invoice?.status === 'Paid';
            const isMine = job.assignedTechnicianId === state.currentUser?.id || 
                           job.assignedCrew?.includes(state.currentUser?.id || '') ||
                           job.assistants?.includes(state.currentUser?.id || '');

            if (!isAdmin) {
                if (!isMine) return false;
                if (isCompleted || isCancelled) return false;
                
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const jobTime = new Date(job.appointmentTime).getTime();
                if (jobTime < todayMidnight) return false;

                const endOfWeek = new Date(todayMidnight);
                const daysUntilEndOfWeek = 6 - now.getDay();
                endOfWeek.setDate(endOfWeek.getDate() + daysUntilEndOfWeek);
                const endOfWeekMidnight = endOfWeek.getTime() + 86400000;
                if (jobTime > endOfWeekMidnight) return false;
            } else {
                if (isCompleted && isPaid) return false;
            }

            return true;
        });

        return activeJobs.sort((a: Job, b: Job) => {
            const timeA = new Date(a.appointmentTime).getTime();
            const timeB = new Date(b.appointmentTime).getTime();
            const validA = !isNaN(timeA) ? timeA : 0;
            const validB = !isNaN(timeB) ? timeB : 0;
            return validA - validB; 
        });
    }, [state.jobs, state.currentUser, isAdmin]);

    const groupedJobs = useMemo(() => {
        if (isAdmin) return {};
        const groups: Record<string, Job[]> = {};
        allJobs.forEach(job => {
            const dateObj = new Date(job.appointmentTime);
            const dateStr = isNaN(dateObj.getTime()) 
                ? 'Invalid Date'
                : dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
            
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(job);
        });
        return groups;
    }, [allJobs, isAdmin]);

    const handleJobUpdate = async (jobId: string, field: keyof Job | 'assignedTechnicianId', value: unknown) => {
        const jobToUpdate = (allJobs as Job[]).find((job: Job) => job.id === jobId);
        if (!jobToUpdate) return;
        
        let updatedJob = { ...jobToUpdate, [field]: value };

        if (field === 'assignedTechnicianId') {
            const tech = employees.find((t: User) => t.id === value);
            updatedJob.assignedTechnicianName = tech ? `${tech.firstName} ${tech.lastName}` : undefined;
        }

        if (field === 'jobStatus' && value !== jobToUpdate.jobStatus) {
            updatedJob.jobEvents = [...(updatedJob.jobEvents || []), {
                type: 'Status Change',
                status: value as string,
                timestamp: new Date().toISOString(),
                userId: state.currentUser?.id
            }];
        }

        try {
            await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(updatedJob), { merge: true });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

            if (field === 'jobStatus' && value === 'Completed') {
                const customer = state.customers.find((c: {name: string; email?: string}) => c.name === updatedJob.customerName);
                const emailToSend = customer?.email || updatedJob.customerEmail;
                const org = state.currentOrganization;
                const orgName = org?.name || 'Service Provider';
                const smtp = org?.smtpConfig;
                
                if (emailToSend && org) {
                    const googleReviewLink = org.reviewLinks?.google;
                    const tektrakkerReviewLink = `${window.location.origin}/#/marketplace/${org.id}`;
                    
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #0284c7; text-align: center;">Thank You for Choosing ${orgName}!</h2>
                            <p>Hi ${updatedJob.customerName},</p>
                            <p>Our team has marked your service as complete. We hope everything is working perfectly.</p>
                            <p>As a local business, we rely on feedback from customers like you. Would you mind taking a moment to share your experience?</p>
                            <div style="text-align: center; margin: 30px 0;">
                                ${googleReviewLink ? `
                                <a href="${googleReviewLink}" style="background-color: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; margin-bottom: 15px; width: 80%; max-width: 300px;">
                                    ⭐ Google Review
                                </a><br/>
                                ` : ''}
                                <a href="${tektrakkerReviewLink}" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; width: 80%; max-width: 300px;">
                                    ⭐ TekTrakker Review
                                </a>
                            </div>
                            <p>If you have any remaining questions or concerns, please reply to this email or call us.</p>
                            ${org.socialLinks ? `
                            <div style="text-align: center; margin-top: 25px;">
                                <p style="font-size: 13px; font-weight: bold; color: #666;">Follow us to stay updated:</p>
                                <p>
                                    ${org.socialLinks.facebook ? `<a href="${org.socialLinks.facebook}" style="margin: 0 8px; color: #0284c7; text-decoration: none;">Facebook</a>` : ''}
                                    ${org.socialLinks.instagram ? `<a href="${org.socialLinks.instagram}" style="margin: 0 8px; color: #0284c7; text-decoration: none;">Instagram</a>` : ''}
                                    ${org.socialLinks.x ? `<a href="${org.socialLinks.x}" style="margin: 0 8px; color: #0284c7; text-decoration: none;">X (Twitter)</a>` : ''}
                                    ${org.socialLinks.linkedin ? `<a href="${org.socialLinks.linkedin}" style="margin: 0 8px; color: #0284c7; text-decoration: none;">LinkedIn</a>` : ''}
                                    ${org.socialLinks.youtube ? `<a href="${org.socialLinks.youtube}" style="margin: 0 8px; color: #0284c7; text-decoration: none;">YouTube</a>` : ''}
                                </p>
                            </div>
                            ` : ''}
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 12px; color: #666; text-align: center;">${orgName}</p>
                        </div>
                    `;

                    await db.collection('mail_queue').add(cleanUndefinedFields({
                        to: [emailToSend],
                        replyTo: org.email || 'noreply@tektrakker.com',
                        message: {
                            subject: `How did we do? - ${orgName}`,
                            html: htmlContent,
                            text: `Thank you for choosing ${orgName}! Please leave us a review: ${googleReviewLink} or ${tektrakkerReviewLink}`,
                            replyTo: org.email || 'noreply@tektrakker.com',
                        },
                        organizationId: org.id,
                        status: 'pending',
                        type: 'ReviewRequest',
                        createdAt: new Date().toISOString(),
                        transport: smtp ? {
                            host: smtp.host,
                            port: smtp.port,
                            auth: {
                                user: smtp.user,
                                pass: smtp.pass
                            },
                            from: `"${smtp.fromName}" <${smtp.fromEmail}>`
                        } : undefined
                    }));
                }
            }

        } catch (error) {
            console.error("Failed to update job:", error);
            showToast.warn("Failed to save changes.");
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if(await globalConfirm('Are you sure you want to delete this job record?')) {
            try {
                await db.collection('jobs').doc(jobId).delete();
                dispatch({ type: 'DELETE_JOB', payload: jobId });
            } catch (error) {
                console.error("Failed to delete job:", error);
            }
        }
    };
    
    const openSmsModal = (job: Job) => {
        setSmsJob(job);
        setSmsMessage(`Hi ${job.customerName}, this is ${state.currentOrganization?.name} verifying your appointment for ${new Date(job.appointmentTime).toLocaleDateString()}. Reply C to confirm.`);
        setIsSmsModalOpen(true);
    };

    const handleSendSms = async () => {
        if (!smsJob) return;
        showToast.warn('SMS Sent Successfully (Simulated)');
        setIsSmsModalOpen(false);
    };

    const formatDateTimeForInput = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const handleCreateProposalForJob = async (job: Job) => {
        try {
            const newPropNum = resolveJobProposalNumber(job, 0, state.proposals || []);
            const propId = newPropNum.startsWith('PROP-') ? newPropNum : `PROP-${newPropNum}`;
            
            const customer = state.customers?.find(c => c.id === job.customerId || c.name === job.customerName);
            const newProposal: any = {
                id: propId,
                proposalNumber: propId,
                organizationId: state.currentOrganization?.id || job.organizationId || 'org-demo',
                customerId: job.customerId || customer?.id || '',
                customerName: job.customerName || customer?.name || 'Customer',
                address: job.address || customer?.address || '',
                locationId: job.locationId || null,
                locationName: job.locationName || null,
                jobId: job.id,
                linkedJobIds: [job.id],
                poNumber: job.poNumber || '',
                title: `Service Proposal (Job #${job.jobNumber || job.id.replace('job-', '')})`,
                status: 'Draft',
                items: (job.tasks && job.tasks.length > 0 ? job.tasks : ['HVAC Service & Diagnostics']).map(t => ({
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    description: t,
                    quantity: 1,
                    unitPrice: 0,
                    amount: 0,
                    tier: 'Standard'
                })),
                subtotal: 0,
                total: 0,
                createdAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('proposals').doc(newProposal.id).set(cleanUndefinedFields(newProposal));
            }
            dispatch({ type: 'ADD_PROPOSAL', payload: newProposal });

            const updatedPropIds = Array.from(new Set([
                ...(job.linkedProposalIds || []),
                ...(job.proposalId ? [job.proposalId] : []),
                newProposal.id
            ]));
            const jobUpdates: any = {
                proposalId: job.proposalId || newProposal.id,
                linkedProposalIds: updatedPropIds,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { ...job, ...jobUpdates }
            });

            showToast.success(`Created Proposal #${newProposal.id} for ${job.customerName}!`);
            setViewingProposal(newProposal);
        } catch (err: any) {
            console.error("Failed to create proposal:", err);
            showToast.error("Failed to create proposal: " + (err.message || 'Unknown error'));
        }
    };

    const handleCreateInvoiceForJob = async (job: Job) => {
        try {
            let newInvoiceId = resolveJobInvoiceNumber(job, 0, state.jobs || []);
            if (!newInvoiceId || newInvoiceId.includes('undefined')) {
                newInvoiceId = `INV-${extractJobSlug(job.id)}`;
            }

            const newInvoice: any = {
                id: newInvoiceId,
                status: 'Unpaid',
                items: (job.tasks && job.tasks.length > 0 ? job.tasks : ['HVAC Service & Diagnostics']).map(t => ({
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    description: t,
                    quantity: 1,
                    unitPrice: 0,
                    amount: 0
                })),
                subtotal: 0,
                taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
                taxAmount: 0,
                totalAmount: 0,
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                poNumber: job.poNumber || ''
            };

            const jobUpdates: any = {
                invoice: newInvoice,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
            }
            const updatedJob = { ...job, ...jobUpdates };
            dispatch({
                type: 'UPDATE_JOB',
                payload: updatedJob
            });

            showToast.success(`Invoice #${newInvoice.id} created for ${job.customerName}!`);
            setViewingInvoiceJob(updatedJob);
        } catch (err: any) {
            console.error("Failed to create invoice:", err);
            showToast.error("Failed to create invoice: " + (err.message || 'Unknown error'));
        }
    };

    const handleCreateWorkOrderForJob = async (job: Job) => {
        try {
            const newWoNumber = resolveJobWorkOrderNumber(job, 0);
            const jobUpdates: any = {
                poNumber: newWoNumber,
                workOrderNumber: newWoNumber,
                linkedWorkOrderNumbers: Array.from(new Set([...(job.linkedWorkOrderNumbers || []), newWoNumber])),
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
            }
            const updatedJob = { ...job, ...jobUpdates };
            dispatch({
                type: 'UPDATE_JOB',
                payload: updatedJob
            });

            showToast.success(`Work Order #${newWoNumber} assigned to ${job.customerName}!`);
            dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: newWoNumber, customerId: job.customerId } });
        } catch (err: any) {
            console.error("Failed to assign work order:", err);
            showToast.error("Failed to assign work order: " + (err.message || 'Unknown error'));
        }
    };

    const renderJobDetailsAndBadges = (job: Job) => {
        const customer = state.customers?.find(c => c.id === job.customerId || c.name === job.customerName);
        const loc = customer?.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);
        const techUser = state.users?.find(u => u.id === job.assignedTechnicianId);
        const isSubcontractor = !!(job.assignedPartnerId || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor'));
        
        const relatedProposals = (state.proposals || []).filter((p: any) =>
            p.id === job.proposalId ||
            p.id === job.projectId ||
            p.jobId === job.id ||
            job.linkedProposalIds?.includes(p.id) ||
            p.linkedJobIds?.includes(job.id) ||
            (job.invoice?.id && p.invoiceId === job.invoice.id)
        );
        const poNumber = job.poNumber || job.invoice?.poNumber || relatedProposals.find((p: any) => p.poNumber)?.poNumber;
        const payingCustomerName = customer?.name || (customer as any)?.companyName || job.customerName || 'Customer';
        const siteLocationName = resolveSiteLocationName(job, loc);
        const siteAddress = formatAddress(job.address || loc?.address || customer?.address || '');

        const timeSummary = getJobTimeSummary(job);
        const formattedIn = timeSummary.formattedInTime;
        const formattedOut = timeSummary.formattedOutTime;
        const formattedDuration = timeSummary.formattedDuration;

        const jAny = job as any;
        const inv = job.invoice || jAny.financials || {};
        const totalAmount = Number(inv.totalAmount || inv.amount || jAny.totalCost || jAny.estimatedCost || jAny.quoteAmount || 0);

        let amountPaid = Number(inv.amountPaid ?? jAny.amountPaid ?? 0);
        if (Array.isArray(inv.payments) && inv.payments.length > 0) {
            const sumP = inv.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            if (sumP > amountPaid) amountPaid = sumP;
        }

        const depositAmount = Number(inv.depositAmount || jAny.depositAmount || 0);
        const isDepositPaid = inv.depositStatus === 'paid' || inv.depositPaid || jAny.depositPaid;
        if (isDepositPaid && depositAmount > 0 && amountPaid < depositAmount) {
            amountPaid = depositAmount;
        }

        const isFullyPaid = inv.status === 'Paid' || (totalAmount > 0 && amountPaid >= totalAmount - 0.01);
        const remainingUnpaid = isFullyPaid ? 0 : Math.max(0, totalAmount - amountPaid);
        const isPartiallyPaid = !isFullyPaid && amountPaid > 0;

        const signOffFile = (job.files || []).find((f: any) => 
            f.fileName === 'SignOff_Sheet.html' || 
            f.fileName?.toLowerCase().includes('signoff') ||
            f.fileName?.toLowerCase().includes('sign-off') ||
            f.fileName?.toLowerCase().includes('sign_off') ||
            f.metadata?.label === 'Sign-Off Sheet' || 
            f.metadata?.label?.toLowerCase().includes('sign-off') ||
            f.metadata?.label?.toLowerCase().includes('signoff') ||
            f.label?.toLowerCase().includes('sign-off') ||
            f.label?.toLowerCase().includes('signoff') ||
            f.category === 'signoff' ||
            f.metadata?.category === 'signoff' ||
            f.id?.startsWith('signoff-doc')
        );
        const subBillFile = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
        const isSubassigned = isSubcontractor || !!(jAny.assignedSubcontractorId || jAny.subcontractorId || jAny.subcontractorName || jAny.subcontractor || jAny.subcontractorCompany || jAny.subcontractorEmail);

        const allKnownJobs = [...(state.jobs || []), ...((state as any).historicalJobs || (state as any).archivedJobs || [])];
        const previousVisitJob = (() => {
            const prevId = job.parentJobId || jAny.previousJobId || jAny.followUpOfJobId || jAny.relatedJobId;
            if (prevId) {
                const found = allKnownJobs.find(j => j.id === prevId || j.id.replace('job-', '') === prevId.replace('job-', ''));
                if (found) return found;
            }
            const thisTime = new Date(job.appointmentTime || job.createdAt || 0).getTime();
            if (job.linkedJobIds && job.linkedJobIds.length > 0) {
                const earlierLinked = allKnownJobs.filter(j => 
                    j.id !== job.id && 
                    job.linkedJobIds?.includes(j.id) &&
                    new Date(j.appointmentTime || j.createdAt || 0).getTime() < thisTime
                ).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
                if (earlierLinked.length > 0) return earlierLinked[0];
            }
            const earlierParent = allKnownJobs.filter(j => 
                j.id !== job.id && 
                (j.customerId === job.customerId || (job.locationId && j.locationId === job.locationId)) &&
                (j.linkedJobIds?.includes(job.id) || j.id === job.parentJobId || (poNumber && (j.poNumber === poNumber || j.workOrderNumber === poNumber))) &&
                new Date(j.appointmentTime || j.createdAt || 0).getTime() < thisTime
            ).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
            return earlierParent.length > 0 ? earlierParent[0] : null;
        })();

        return {
            payingCustomerName,
            siteLocationName,
            siteAddress,
            relatedProposals,
            poNumber,
            formattedIn,
            formattedOut,
            formattedDuration,
            previousVisitJob,
            inv,
            totalAmount,
            amountPaid,
            depositAmount,
            isDepositPaid,
            isFullyPaid,
            remainingUnpaid,
            isPartiallyPaid,
            signOffFile,
            subBillFile,
            isSubassigned
        };
    };
    
    return (
        <div className="space-y-6">
             <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title="Send Customer SMS">
                 <div className="space-y-4">
                     <Textarea label="Message" value={smsMessage} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSmsMessage(e.target.value)} />
                     <div className="flex justify-end gap-4 pt-4">
                         <Button variant="secondary" onClick={() => setIsSmsModalOpen(false)}>Cancel</Button>
                         <Button onClick={handleSendSms}>Send Text</Button>
                     </div>
                 </div>
             </Modal>

             <header className="flex justify-between items-center bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/briefing')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-all shadow-xs"
                    >
                        <ArrowLeft size={16} />
                        Back to Briefing
                    </button>
                    <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{isAdmin ? 'Job Scheduling' : 'My Schedule'}</h1>
                </div>
                <Button onClick={() => window.open('/#/book', '_blank')} className="w-auto text-xs py-1.5">Open Booking Page</Button>
            </header>

            {isAdmin ? (
                <Card>
                    <div ref={tableRef}>
                        <Table headers={['Customer & Location', 'Scheduled Appt', 'Invoice & Payment', 'Linked Documents', 'Job Status', 'Assigned Tech', 'Actions']}>
                            {(allJobs as Job[]).map((job: Job) => {
                                const isHighlighted = job.id === highlightJobId;
                                const details = renderJobDetailsAndBadges(job);
                                
                                return (
                                <tr key={job.id} data-job-id={job.id} className={isHighlighted ? "bg-primary-50 dark:bg-primary-900/20" : ""}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col gap-1 max-w-[220px]">
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const targetCustId = job.customerId || state.customers.find(c => c.name?.toLowerCase().trim() === details.payingCustomerName.toLowerCase().trim())?.id;
                                                    if (targetCustId) {
                                                        setSelectedCustomerMasterId(targetCustId);
                                                    } else {
                                                        showToast.info(t("No customer profile found for this record."));
                                                    }
                                                }}
                                                className="cursor-pointer group/cust hover:bg-blue-50/70 dark:hover:bg-blue-950/50 p-1 -mx-1 rounded-lg transition-colors"
                                                title={t("Click to open customer profile and details")}
                                            >
                                                <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1 group-hover/cust:text-primary-600 dark:group-hover/cust:text-primary-400">
                                                    <UserIcon size={9} /> Customer ↗
                                                </span>
                                                <span className="text-slate-900 dark:text-white font-black text-xs tracking-tight block truncate group-hover/cust:text-primary-600 dark:group-hover/cust:text-primary-400 group-hover/cust:underline" title={details.payingCustomerName}>
                                                    {details.payingCustomerName}
                                                </span>
                                            </div>

                                            {(details.siteLocationName || details.siteAddress) && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAuditLocationTarget({
                                                            customerId: job.customerId,
                                                            locationId: job.locationId || 'default'
                                                        });
                                                    }}
                                                    className="pt-0.5 border-t border-slate-100 dark:border-slate-800 cursor-pointer group/loc hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 p-1 -mx-1 rounded-lg transition-colors"
                                                    title="Click to view all work history, jobs & documents for this site location"
                                                >
                                                    <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1 group-hover/loc:underline">
                                                        <MapPin size={9} /> Site Location ↗
                                                    </span>
                                                    {details.siteLocationName && details.siteLocationName !== details.payingCustomerName && (
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate group-hover/loc:text-indigo-600" title={details.siteLocationName}>
                                                            {details.siteLocationName}
                                                        </span>
                                                    )}
                                                    {details.siteAddress && (
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block truncate group-hover/loc:text-indigo-600" title={details.siteAddress}>
                                                            {details.siteAddress}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {details.relatedProposals.length > 0 && (
                                                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter mt-0.5">
                                                    <FileText size={10} /> {details.relatedProposals.length > 1 ? `${details.relatedProposals.length} Linked Proposals` : 'Linked Proposal'}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col gap-1 min-w-[150px]">
                                            <div>
                                                <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Scheduled Appt</span>
                                                <input 
                                                    type="datetime-local" 
                                                    aria-label="Appointment Time" 
                                                    title="Appointment Time" 
                                                    value={formatDateTimeForInput(job.appointmentTime)} 
                                                    onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())} 
                                                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs rounded p-1 focus:ring-1 focus:ring-primary-500 font-bold"
                                                />
                                            </div>
                                            {(details.formattedIn || details.formattedOut || details.formattedDuration) ? (
                                                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                                    <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                                                        <Clock size={9} /> Site Visit
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                        {details.formattedIn && <span className="text-emerald-700 dark:text-emerald-400">In: {details.formattedIn}</span>}
                                                        {details.formattedOut && <span className="text-slate-600 dark:text-slate-400">Out: {details.formattedOut}</span>}
                                                        {details.formattedIn && !details.formattedOut && <span className="text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase animate-pulse">In Progress</span>}
                                                    </div>
                                                    {details.formattedDuration && (
                                                        <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 block">
                                                            Duration: {details.formattedDuration}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block pt-0.5">No check-in recorded</span>
                                            )}

                                            {details.previousVisitJob && (
                                                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                                    <span className="text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                                                        <RotateCcw size={9} /> Follow-Up To
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingJob(details.previousVisitJob);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors w-max"
                                                        title={`View details for previous visit JOB-${details.previousVisitJob.id.replace('job-', '')}`}
                                                    >
                                                        <Briefcase size={10} />
                                                        <span>JOB-{details.previousVisitJob.id.replace('job-', '')}</span>
                                                        {details.previousVisitJob.appointmentTime && (
                                                            <span className="font-normal opacity-80">
                                                                ({new Date(details.previousVisitJob.appointmentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })})
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col gap-1 max-w-[210px]">
                                            <div className="flex items-center gap-1">
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs ${
                                                    details.isFullyPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' :
                                                    details.isPartiallyPaid ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800' :
                                                    details.inv.status === 'Unpaid' || details.inv.sentAt || details.totalAmount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                }`}>
                                                    {details.isFullyPaid ? `✓ Paid${details.totalAmount > 0 ? ` ($${details.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}` :
                                                     details.isPartiallyPaid ? `Partially Paid` :
                                                     details.totalAmount > 0 ? `Unpaid ($${details.remainingUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` :
                                                     details.inv.status || 'No Invoice'}
                                                </span>
                                            </div>

                                            {details.isPartiallyPaid ? (
                                                <div className="flex flex-col gap-0.5 text-[10px] bg-blue-50/80 dark:bg-blue-950/40 p-1.5 rounded-md border border-blue-200/60 dark:border-blue-800/50 my-0.5 shadow-xs">
                                                    <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-bold">
                                                        <span>{details.isDepositPaid ? 'Deposit Paid:' : 'Paid To Date:'}</span>
                                                        <span>${details.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-black">
                                                        <span>Unpaid Balance:</span>
                                                        <span>${details.remainingUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {details.totalAmount > 0 && (
                                                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[9px] pt-0.5 border-t border-blue-200/50 dark:border-blue-800/50">
                                                            <span>Total Invoice:</span>
                                                            <span>${details.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : !details.isFullyPaid && details.totalAmount > 0 && details.depositAmount > 0 && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block truncate">
                                                    Deposit Req: ${details.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            )}

                                            <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                                                {job.jobRecordSignedOff || job.jobRecordSignedOffAt ? (
                                                    <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                                                        <CheckCircle size={10} className="text-emerald-500 shrink-0" />
                                                        <span>Job Record: <strong className="font-bold text-emerald-700 dark:text-emerald-400">{job.jobRecordSignedOffAt ? `Verified ${new Date(job.jobRecordSignedOffAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}` : 'Verified'}</strong></span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                                        <Clock size={10} className="text-amber-500 shrink-0" />
                                                        <span>Job Record: <strong className="font-normal text-slate-600 dark:text-slate-400">Pending Sign-off</strong></span>
                                                    </span>
                                                )}

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

                                                {details.relatedProposals.map((p: any) => {
                                                    const propDisplay = resolveDocumentDisplayId('proposal', p).id;
                                                    const sentTimestamp = p.sentAt || p.sentDate || (job as any).proposalSentAt || (p.status === 'Sent' || p.status === 'Opened' || p.status === 'Accepted' ? p.updatedAt : null);
                                                    const dateStr = sentTimestamp ? new Date(sentTimestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' }) : null;
                                                    return (
                                                        <span key={`sent-prop-${p.id}`} className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1" title={`Proposal #${propDisplay} ${p.status ? `[${p.status}]` : ''} ${sentTimestamp ? `sent ${new Date(sentTimestamp).toLocaleString()}` : ''}`}>
                                                            <FileText size={10} className="text-purple-500 shrink-0" />
                                                            <span>Prop #{propDisplay}: <strong className="font-bold text-slate-800 dark:text-slate-200">{dateStr ? `Sent ${dateStr}` : (p.status || 'Draft')}</strong></span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                                            {/* Proposal Badges or Create Button */}
                                            {details.relatedProposals.length > 0 ? (
                                                details.relatedProposals.map((proposal: any) => {
                                                    const displayId = resolveDocumentDisplayId('proposal', proposal).id;
                                                    return (
                                                        <span 
                                                            key={`tbl-prop-${proposal.id}`}
                                                            onClick={() => setViewingProposal(proposal)}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors shadow-xs"
                                                            title={proposal.title || `Proposal ${displayId}`}
                                                        >
                                                            <Briefcase size={10} />
                                                            {displayId}
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span 
                                                    onClick={() => handleCreateProposalForJob(job)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 hover:border-blue-200 cursor-pointer transition-colors shadow-xs"
                                                    title={t("Create Proposal for this job")}
                                                >
                                                    <Briefcase size={10} />
                                                    {t("+ Proposal")}
                                                </span>
                                            )}

                                            {/* Job Badge */}
                                            <span 
                                                onClick={() => setViewingJob(job)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 cursor-pointer hover:bg-indigo-100 transition-colors shadow-xs"
                                                title={t("View Job Record Details")}
                                            >
                                                <Briefcase size={10} />
                                                {`JOB-${job.id.replace('job-', '')}`}
                                            </span>

                                            {/* Invoice Badge or Create Button */}
                                            {job.invoice ? (
                                                <span 
                                                    onClick={() => setViewingInvoiceJob(job)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 transition-colors shadow-xs"
                                                    title={t("View / Edit Invoice")}
                                                >
                                                    <DollarSign size={10} />
                                                    {job.invoice.id || job.invoice.invoiceNumber || job.invoice.number ? `INV-${String(job.invoice.id || job.invoice.invoiceNumber || job.invoice.number).replace(/^INV-?/i, '')}` : `INV-${job.jobNumber || String(job.id).replace(/^job-?/i, '')}`}
                                                </span>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCreateInvoiceForJob(job)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 hover:border-emerald-200 cursor-pointer transition-colors shadow-xs"
                                                    title={t("Create Invoice for this job")}
                                                >
                                                    <DollarSign size={10} />
                                                    {t("+ Invoice")}
                                                </span>
                                            )}

                                            {/* Work Order Badge or Create Button */}
                                            {details.poNumber ? (
                                                <span 
                                                    onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: details.poNumber, customerId: job.customerId } })}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                                    title={t("View Work Order Associations")}
                                                >
                                                    <Briefcase size={10} />
                                                    {`WO: ${details.poNumber}`}
                                                </span>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCreateWorkOrderForJob(job)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-300 hover:border-rose-200 cursor-pointer transition-colors shadow-xs"
                                                    title={t("Create / Assign Work Order Number")}
                                                >
                                                    <Briefcase size={10} />
                                                    {t("+ Work Order")}
                                                </span>
                                            )}

                                            {/* Sign-Off Sheet Badge */}
                                            {(() => {
                                                const hasSignOff = !!(details.signOffFile || job.signOff || job.signOffSheetUrl || job.customerSignature || job.signature);
                                                return (
                                                    <div className="inline-flex items-center rounded border border-amber-200 dark:border-amber-800/60 overflow-hidden shadow-xs">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                if (details.signOffFile) {
                                                                    setPreviewOtherDoc({ ...details.signOffFile, type: 'Other', title: t('Sign-Off Sheet') });
                                                                } else if (job.signOffSheetUrl) {
                                                                    setPreviewOtherDoc({ id: `signoff-${job.id}`, dataUrl: job.signOffSheetUrl, url: job.signOffSheetUrl, fileName: 'SignOff_Sheet.html', type: 'Other', title: t('Sign-Off Sheet') });
                                                                } else {
                                                                    setActiveSignOffJob(job);
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition-colors border-none ${
                                                                hasSignOff 
                                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100' 
                                                                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300'
                                                            }`}
                                                            title={hasSignOff ? t("View Sign-Off Sheet") : t("Open Blank Sign-off Sheet to Sign")}
                                                        >
                                                            <ShieldCheck size={10} />
                                                            {hasSignOff ? t('✍️ Sign-off') : t('✍️ + Sign-off')}
                                                        </button>
                                                        {hasSignOff && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveSignOffJob(job);
                                                                    }}
                                                                    className="px-1 py-0.5 text-[10px] font-bold bg-amber-100/80 hover:bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:hover:bg-amber-800/70 dark:text-amber-300 cursor-pointer border-l border-amber-200 dark:border-amber-800/60"
                                                                    title={t("Re-sign / Collect Sign-Off")}
                                                                >
                                                                    <Edit size={9} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleClearSignOff(job);
                                                                    }}
                                                                    className="px-1 py-0.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 cursor-pointer border-l border-amber-200 dark:border-amber-800/60"
                                                                    title={t("Clear Sign-off and Signatures")}
                                                                >
                                                                    <Trash2 size={9} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Subcontractor Bill Badge */}
                                            <span 
                                                onClick={() => {
                                                    if (details.subBillFile) {
                                                        setPreviewOtherDoc({ ...details.subBillFile, type: 'Other', title: t('Subcontractor Bill') });
                                                    } else {
                                                        setViewingWorkOrderJob(job);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-xs ${
                                                    details.subBillFile 
                                                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-800/50 hover:bg-teal-100' 
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 hover:border-teal-200'
                                                }`}
                                                title={details.subBillFile ? t("View Subcontractor Bill") : t("Create Subcontractor Work Order / Bill")}
                                            >
                                                <DollarSign size={10} />
                                                {details.subBillFile ? t('💵 Sub Bill') : t('💵 + Sub Bill')}
                                            </span>

                                            {/* Attached Non-Photo Document Files */}
                                            {(job.files || []).filter((f: any) => {
                                                const isSignoff = f.fileName === 'SignOff_Sheet.html' || 
                                                    f.fileName?.toLowerCase().includes('signoff') ||
                                                    f.fileName?.toLowerCase().includes('sign-off') ||
                                                    f.fileName?.toLowerCase().includes('sign_off') ||
                                                    f.metadata?.label === 'Sign-Off Sheet' || 
                                                    f.metadata?.label?.toLowerCase().includes('sign-off') ||
                                                    f.metadata?.label?.toLowerCase().includes('signoff') ||
                                                    f.label?.toLowerCase().includes('sign-off') ||
                                                    f.label?.toLowerCase().includes('signoff') ||
                                                    f.category === 'signoff' ||
                                                    f.metadata?.category === 'signoff' ||
                                                    f.id?.startsWith('signoff-doc');
                                                const isSubBill = f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_');
                                                const isImg = f.metadata?.label === 'Before' || f.metadata?.label === 'After' || f.metadata?.label === 'Specifications' || f.label === 'Before' || f.label === 'After' || (f.fileType && f.fileType.startsWith('image/')) || (f.type && f.type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.fileName || '');
                                                return !isSignoff && !isSubBill && !isImg;
                                            }).map((f: any, idx: number) => {
                                                const title = f.metadata?.label || f.label || f.fileName?.replace(/_/g, ' ').replace('.html', '').replace('.pdf', '') || `Doc ${idx + 1}`;
                                                return (
                                                    <span 
                                                        key={`tbl-attached-doc-${f.id || idx}`}
                                                        onClick={() => setPreviewOtherDoc({ ...f, type: 'Other', title })}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs"
                                                        title={title}
                                                    >
                                                        <FileText size={10} />
                                                        <span className="truncate max-w-[90px]">{title}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <select 
                                            aria-label="Job Status"
                                            title="Job Status"
                                            value={job.jobStatus}
                                            onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)}
                                            className={`block w-full border border-gray-300 dark:border-gray-600 rounded-md py-1 px-2 text-xs font-bold focus:ring-primary-500 focus:border-primary-500 ${job.jobStatus === 'Completed' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'}`}
                                        >
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        <select 
                                            aria-label="Assign Technician"
                                            title="Assign Technician"
                                            value={job.assignedTechnicianId || ''}
                                            onChange={(e) => handleJobUpdate(job.id, 'assignedTechnicianId', e.target.value)}
                                            className="block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-1 px-2 text-xs text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                                        >
                                            <option value="">Unassigned</option>
                                            {employees.map((tech: User) => (
                                                <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 flex items-center gap-2">
                                        <button aria-label="Send SMS Message" title="Send SMS" onClick={() => openSmsModal(job)} className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 p-1"><MessageSquare className="w-4 h-4" /></button>
                                        <button aria-label="Edit Job" title="Edit Job" onClick={() => setEditingFullJob(job)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 p-1"><Edit className="w-4 h-4" /></button>
                                        <button aria-label="Delete Job" title="Delete Job" onClick={() => handleDeleteJob(job.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 p-1"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                                );
                            })}
                            {allJobs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 md:py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                        No active jobs found. All completed and paid jobs are in History.
                                    </td>
                                </tr>
                            )}
                        </Table>
                    </div>
                </Card>
            ) : (
                <div className="space-y-8">
                    {Object.keys(groupedJobs).map((dateStr) => (
                        <div key={dateStr} className="space-y-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{dateStr}</h2>
                                <div className="h-px bg-gray-200 dark:bg-gray-700 w-full"></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {groupedJobs[dateStr].map(job => {
                                    const details = renderJobDetailsAndBadges(job);
                                    const isSubcontractorUser = state.currentUser?.role === 'Subcontractor';

                                    return (
                                        <div key={job.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3 relative overflow-hidden">
                                            <div className={`absolute top-0 left-0 w-1 h-full ${job.jobStatus === 'Completed' ? 'bg-green-500' : job.jobStatus === 'In Progress' ? 'bg-blue-500' : job.jobStatus === 'Cancelled' ? 'bg-red-500' : 'bg-primary-500'}`}></div>
                                            
                                            {/* Customer Name & Site Location Link */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const targetCustId = job.customerId || state.customers.find(c => c.name?.toLowerCase().trim() === (details.payingCustomerName || '').toLowerCase().trim())?.id;
                                                            if (targetCustId) {
                                                                setSelectedCustomerMasterId(targetCustId);
                                                            } else {
                                                                showToast.info(t("No customer profile found for this record."));
                                                            }
                                                        }}
                                                        className="font-bold text-gray-900 dark:text-white text-base cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 hover:underline flex items-center gap-1"
                                                        title={t("Click to open customer profile and details")}
                                                    >
                                                        {isSubcontractorUser ? (details.siteLocationName || details.payingCustomerName) : details.payingCustomerName}
                                                        <span className="text-[11px] text-primary-500 font-normal">↗</span>
                                                    </h3>
                                                    {(details.siteLocationName || details.siteAddress) && (
                                                        <div 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAuditLocationTarget({
                                                                    customerId: job.customerId,
                                                                    locationId: job.locationId || 'default'
                                                                });
                                                            }}
                                                            className="cursor-pointer group/loc hover:underline mt-0.5"
                                                            title="Click to view all work history, jobs & documents for this site location"
                                                        >
                                                            <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                                <MapPin size={10} /> Site Location ↗
                                                            </span>
                                                            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-[220px]">
                                                                {details.siteAddress || details.siteLocationName}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base font-black text-primary-600 dark:text-primary-400">
                                                        {safeFormatTimeString(job.appointmentTime)}
                                                    </div>
                                                    <span className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${details.isFullyPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                        {details.isFullyPaid ? '✓ Paid' : details.isPartiallyPaid ? 'Partially Paid' : (details.inv.status || 'Unpaid')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Linked Proposals Badge */}
                                            {details.relatedProposals.length > 0 && (
                                                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                                    <FileText size={12} />
                                                    <span>{details.relatedProposals.length > 1 ? `${details.relatedProposals.length} Linked Proposals` : 'Linked Proposal'}</span>
                                                </div>
                                            )}

                                            {/* Site Visit Check-in status */}
                                            <div className="text-[11px] bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg space-y-1">
                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                                                    <span>Site Visit:</span>
                                                    {details.formattedIn ? (
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                            In: {details.formattedIn} {details.formattedOut ? `| Out: ${details.formattedOut}` : '(In Progress)'}
                                                        </span>
                                                    ) : (
                                                        <span className="italic text-slate-400">No check-in recorded</span>
                                                    )}
                                                </div>

                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                                                    <span>Job Record:</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        {job.jobRecordSignedOff || job.jobRecordSignedOffAt ? 'Verified' : 'Pending Sign-off'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Document Badges (Sign-off, Sub Bill, WO, Job) */}
                                            <div className="flex flex-wrap gap-1.5">
                                                <span 
                                                    onClick={() => setViewingJob(job)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 cursor-pointer"
                                                >
                                                    <Briefcase size={11} />
                                                    {`JOB-${job.id.replace('job-', '')}`}
                                                </span>

                                                {details.poNumber && (
                                                    <span 
                                                        onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: details.poNumber, customerId: job.customerId } })}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer"
                                                    >
                                                        <Briefcase size={11} />
                                                        {`WO: ${details.poNumber}`}
                                                    </span>
                                                )}

                                                {(() => {
                                                    const hasSignOff = !!(details.signOffFile || job.signOff || job.signOffSheetUrl || job.customerSignature || job.signature);
                                                    return (
                                                        <div className="inline-flex items-center rounded border border-amber-200 dark:border-amber-800/60 overflow-hidden shadow-xs">
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    if (details.signOffFile) {
                                                                        setPreviewOtherDoc({ ...details.signOffFile, type: 'Other', title: 'Sign-Off Sheet' });
                                                                    } else if (job.signOffSheetUrl) {
                                                                        setPreviewOtherDoc({ id: `signoff-${job.id}`, dataUrl: job.signOffSheetUrl, url: job.signOffSheetUrl, fileName: 'SignOff_Sheet.html', type: 'Other', title: 'Sign-Off Sheet' });
                                                                    } else {
                                                                        setActiveSignOffJob(job);
                                                                    }
                                                                }}
                                                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold cursor-pointer border-none ${
                                                                    hasSignOff 
                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100' 
                                                                    : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300'
                                                                }`}
                                                            >
                                                                <ShieldCheck size={11} />
                                                                {hasSignOff ? '✍️ Sign-off' : '✍️ + Sign-off'}
                                                            </button>
                                                            {hasSignOff && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveSignOffJob(job);
                                                                        }}
                                                                        className="px-1.5 py-1 text-[11px] font-bold bg-amber-100/80 hover:bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:hover:bg-amber-800/70 dark:text-amber-300 cursor-pointer border-l border-amber-200 dark:border-amber-800/60"
                                                                        title={t("Re-sign / Collect Sign-Off")}
                                                                    >
                                                                        <Edit size={10} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleClearSignOff(job);
                                                                        }}
                                                                        className="px-1.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 cursor-pointer border-l border-amber-200 dark:border-amber-800/60"
                                                                        title={t("Clear Sign-off and Signatures")}
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {details.isSubassigned && (
                                                    <span 
                                                        onClick={() => {
                                                            if (details.subBillFile) {
                                                                setPreviewOtherDoc({ ...details.subBillFile, type: 'Other', title: 'Subcontractor Bill' });
                                                            } else {
                                                                setViewingWorkOrderJob(job);
                                                            }
                                                        }}
                                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                                            details.subBillFile 
                                                            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200' 
                                                            : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
                                                        }`}
                                                    >
                                                        <DollarSign size={11} />
                                                        {details.subBillFile ? '💵 Sub Bill' : '💵 + Sub Bill'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Full Labeled Actions Toolbar matching web version */}
                                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                                                <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">Actions:</span>
                                                    
                                                    <button
                                                        onClick={() => handleArchiveJob(job)}
                                                        className={`flex items-center gap-1.5 px-2 py-1 border rounded-md text-[11px] font-bold shadow-xs transition-colors ${
                                                            job.archived
                                                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                                                : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-100/80'
                                                        }`}
                                                        title={job.archived ? "Restore job to active board" : "Take off board without deleting"}
                                                    >
                                                        <Archive size={13} />
                                                        {job.archived ? "Restore" : "Take Off Board"}
                                                    </button>

                                                    <button 
                                                        onClick={() => setEditingFullJob(job)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 transition-colors font-bold shadow-xs"
                                                        title="Edit Appointment Details"
                                                    >
                                                        <Edit size={13} />
                                                        Edit
                                                    </button>

                                                    <button 
                                                        onClick={() => setEmailJob(job)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 transition-colors font-bold shadow-xs"
                                                        title="Send Email to Customer"
                                                    >
                                                        <Mail size={13} />
                                                        Send Email
                                                    </button>

                                                    <button 
                                                        onClick={() => openSmsModal(job)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-md text-[11px] text-sky-700 dark:text-sky-300 hover:bg-sky-100/80 transition-colors font-bold shadow-xs"
                                                        title="SMS Customer"
                                                    >
                                                        <MessageSquare size={13} />
                                                        SMS
                                                    </button>

                                                    <button 
                                                        onClick={() => openNotesModal(job)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 transition-colors font-bold shadow-xs"
                                                        title="Internal Notes"
                                                    >
                                                        <AlignLeft size={13} />
                                                        Notes
                                                    </button>

                                                    <button 
                                                        onClick={() => setLinkingJob(job)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 rounded-md text-[11px] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/80 transition-colors font-bold shadow-xs"
                                                        title="View & Associate Documents, Proposals, Invoices, Files & Jobs"
                                                    >
                                                        <Link2 size={13} />
                                                        Associations
                                                    </button>

                                                    {details.isSubassigned && (
                                                        <button 
                                                            onClick={() => setViewingWorkOrderJob(job)} 
                                                            className="flex items-center gap-1.5 px-2 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 transition-colors font-bold shadow-xs"
                                                            title="Subcontractor Work Order & Instructions"
                                                        >
                                                            <FileText size={13} />
                                                            Work Order
                                                        </button>
                                                    )}

                                                    <button 
                                                        onClick={() => handleCopyRef(job.id)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 transition-colors font-bold shadow-xs"
                                                        title="Copy Reference"
                                                    >
                                                        <Copy size={13} />
                                                        Copy Ref
                                                    </button>

                                                    <button 
                                                        onClick={() => handleDeleteJob(job.id)} 
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-[11px] text-red-700 dark:text-red-300 hover:bg-red-100/80 transition-colors font-bold shadow-xs"
                                                        title="Delete Job"
                                                    >
                                                        <Trash2 size={13} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {Object.keys(groupedJobs).length === 0 && (
                        <Card className="text-center py-12">
                            <p className="text-gray-500 dark:text-gray-400">No jobs scheduled for this week.</p>
                        </Card>
                    )}
                </div>
            )}

            {/* MODALS */}
            {auditLocationTarget && (
                <LocationAuditModal
                    isOpen={!!auditLocationTarget}
                    onClose={() => setAuditLocationTarget(null)}
                    customerId={auditLocationTarget.customerId}
                    locationId={auditLocationTarget.locationId}
                />
            )}

            {selectedCustomerMasterId && (
                <CustomerMasterModal
                    isOpen={true}
                    onClose={() => setSelectedCustomerMasterId(null)}
                    customerId={selectedCustomerMasterId}
                />
            )}

            {activeSignOffJob && (
                <SignOffModal
                    isOpen={!!activeSignOffJob}
                    onClose={() => setActiveSignOffJob(null)}
                    job={activeSignOffJob}
                    onSave={async (file: any, updatedFields?: any) => {
                        try {
                            const existingFiles = activeSignOffJob.files || [];
                            const updatedFiles = updatedFields?.files || [...existingFiles, file];
                            const sheetUrl = file.url || file.dataUrl;
                            const signOffData = updatedFields?.signOff || {
                                managerName: file.metadata?.managerName || null,
                                technicianName: file.metadata?.technicianName || activeSignOffJob.assignedTechnicianName || null,
                                dateOfService: file.metadata?.dateOfService || new Date().toISOString().split('T')[0],
                                sheetUrl: sheetUrl,
                                timestamp: new Date().toISOString(),
                                status: 'COMPLETED'
                            };
                            const updates = {
                                files: updatedFiles,
                                signOffSheetUrl: sheetUrl,
                                signoffSheetUrl: sheetUrl,
                                customWorkOrderFormUrl: sheetUrl,
                                signOff: signOffData,
                                signOffSignature: sheetUrl || 'SIGNED_ON_FILE',
                                ...(updatedFields || {})
                            };
                            await db.collection('jobs').doc(activeSignOffJob.id).update(cleanUndefinedFields(updates));
                            dispatch({ type: 'UPDATE_JOB', payload: { ...activeSignOffJob, ...updates } });
                            showToast.success("Sign-off sheet saved successfully!");
                        } catch (err) {
                            console.error("Error saving sign-off", err);
                        }
                        setActiveSignOffJob(null);
                    }}
                />
            )}

            {viewingWorkOrderJob && (
                <SubcontractorWorkOrderModal
                    isOpen={!!viewingWorkOrderJob}
                    onClose={() => setViewingWorkOrderJob(null)}
                    job={viewingWorkOrderJob}
                />
            )}

            {viewingJob && (
                <JobDetailModal
                    isOpen={!!viewingJob}
                    onClose={() => setViewingJob(null)}
                    job={viewingJob}
                />
            )}

            {editingFullJob && (
                <JobAppointmentModal
                    isOpen={!!editingFullJob}
                    onClose={() => setEditingFullJob(null)}
                    jobToEdit={editingFullJob}
                />
            )}

            {linkingJob && (
                <JobLinkingModal
                    isOpen={!!linkingJob}
                    onClose={() => setLinkingJob(null)}
                    job={linkingJob}
                />
            )}

            {emailJob && (
                <SendEmailModal
                    isOpen={!!emailJob}
                    onClose={() => setEmailJob(null)}
                    job={emailJob}
                />
            )}

            {viewingProposal && (
                <DocumentPreview
                    type="Proposal"
                    data={viewingProposal}
                    onClose={() => setViewingProposal(null)}
                />
            )}

            {viewingInvoiceJob && (
                <DocumentPreview
                    type="Invoice"
                    data={viewingInvoiceJob}
                    onClose={() => setViewingInvoiceJob(null)}
                    isInternal={true}
                />
            )}

            {previewOtherDoc && (
                <DocumentPreview
                    type="Other"
                    data={previewOtherDoc}
                    onClose={() => setPreviewOtherDoc(null)}
                    isInternal={true}
                />
            )}

            {notesJob && (
                <Modal isOpen={!!notesJob} onClose={() => setNotesJob(null)} title="Internal Job Notes">
                    <div className="space-y-4">
                        <Textarea label="Notes" value={jobNotesText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobNotesText(e.target.value)} rows={6} />
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setNotesJob(null)}>Cancel</Button>
                            <Button onClick={handleSaveNotes}>Save Notes</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default JobScheduling;
