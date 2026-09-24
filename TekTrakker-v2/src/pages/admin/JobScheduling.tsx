import showToast from "lib/toast";
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cleanUndefinedFields, resolveSiteLocationName } from 'lib/utils';
import type { Job, User, Address, Subcontractor, BusinessDocument, InspectionTemplate } from '../../types';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db, firebase } from '../../lib/firebase';
import { Trash2, MessageSquare, CheckCircle, Globe, Users, Clock, MapPin, FileText, Edit, Share2, Copy, Calendar, AlignLeft, CalendarPlus, Briefcase, ShieldCheck, DollarSign, Search, Link2, Archive, Send, Mail, RotateCcw, User as UserIcon } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import JobAppointmentModal from 'components/modals/JobAppointmentModal';
import DocumentPreview from '../../components/ui/DocumentPreview';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobLinkingModal from 'components/modals/JobLinkingModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import LocationAuditModal from 'components/modals/LocationAuditModal';
import CustomerMasterModal from 'components/modals/CustomerMasterModal';
import { resolveDocumentDisplayId, resolveJobProposalNumber, resolveJobInvoiceNumber, resolveJobWorkOrderNumber, extractJobSlug } from 'lib/numbering';
import { getJobTimeSummary } from 'lib/jobTimeHelper';

const HighlightText: React.FC<{ text: string | undefined | null; query?: string }> = ({ text, query }) => {
    if (!text) return null;
    if (!query || !query.trim()) return <>{text}</>;

    const rawQuery = query.trim();
    const cleanQuery = rawQuery.replace(/^[#\s]+/, '').replace(/^inv-|^prop-|^wo-/, '');
    const tokens = Array.from(new Set([rawQuery, cleanQuery].filter(t => t.length > 0)));
    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
    if (escapedTokens.length === 0) return <>{text}</>;

    const splitRegex = new RegExp(`(${escapedTokens.join('|')})`, 'i');
    const matchRegex = new RegExp(`^(${escapedTokens.join('|')})$`, 'i');
    const parts = String(text).split(splitRegex);

    return (
        <>
            {parts.map((part, i) => 
                matchRegex.test(part) ? (
                    <mark key={i} className="bg-amber-300 dark:bg-amber-500/50 text-amber-950 dark:text-amber-100 font-black px-0.5 rounded shadow-xs">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

const getJobSearchMatchReason = (job: Job, customer: any, relatedProposals: any[], query: string): { label: string; value: string } | null => {
    if (!query || !query.trim()) return null;
    const rawQuery = query.toLowerCase().trim();
    const cleanQuery = rawQuery.replace(/^[#\s]+/, '').replace(/^inv-|^prop-|^wo-/, '');
    const cleanAlpha = rawQuery.replace(/[^a-z0-9]/g, '');
    const tokens = Array.from(new Set([rawQuery, cleanQuery, cleanAlpha].filter(t => t.length > 0)));

    const testMatch = (val: any) => {
        if (!val) return false;
        const str = String(val).toLowerCase();
        const strAlpha = str.replace(/[^a-z0-9]/g, '');
        return tokens.some(t => {
            if (str.includes(t)) return true;
            if (t.length >= 3 && strAlpha.includes(t)) return true;
            return false;
        });
    };

    // 1. Current Invoices
    if (testMatch(job.invoice?.id)) return { label: 'Invoice #', value: job.invoice?.id || '' };
    if (testMatch(job.invoice?.invoiceNumber)) return { label: 'Invoice #', value: job.invoice?.invoiceNumber || '' };
    if (Array.isArray((job as any).linkedInvoiceIds)) {
        const matched = (job as any).linkedInvoiceIds.find(testMatch);
        if (matched) return { label: 'Linked Invoice #', value: matched };
    }

    // 2. Work Orders & POs
    if (testMatch(job.poNumber)) return { label: 'PO / WO #', value: job.poNumber };
    if (testMatch((job as any).workOrderNumber)) return { label: 'Work Order #', value: (job as any).workOrderNumber };
    if (testMatch((job as any).referenceNumber)) return { label: 'Reference #', value: (job as any).referenceNumber };
    if (testMatch((job as any).legacyPoNumber)) return { label: 'Ref PO #', value: (job as any).legacyPoNumber };
    if (testMatch((job.draftData as any)?.workOrderNo)) return { label: 'Draft WO #', value: (job.draftData as any).workOrderNo };

    // 3. Proposals
    for (const p of relatedProposals) {
        if (testMatch(p.id)) return { label: 'Proposal #', value: p.id };
        if (testMatch(p.referenceNumber)) return { label: 'Proposal Ref #', value: p.referenceNumber };
        if (testMatch(p.poNumber)) return { label: 'Proposal PO #', value: p.poNumber };
        if (testMatch(p.invoiceId)) return { label: 'Proposal Linked Invoice #', value: p.invoiceId };
    }

    // 4. Site & Location
    if (testMatch(job.locationName)) return { label: 'Site Location', value: job.locationName };
    const jobAddr = typeof job.address === 'string' ? job.address : `${(job.address as any)?.street || ''}`;
    if (testMatch(jobAddr)) return { label: 'Address', value: jobAddr };

    // 5. Customer & Phone
    if (testMatch(customer?.name || job.customerName)) return { label: 'Customer', value: customer?.name || job.customerName || '' };
    const rawPhone = String(job.customerPhone || customer?.phone || customer?.billingContact?.phone || '');
    if (rawPhone) {
        const cleanPhoneDigits = rawPhone.replace(/[^0-9]/g, '');
        const cleanQueryDigits = query.replace(/[^0-9]/g, '');
        if (cleanQueryDigits.length >= 7 && cleanPhoneDigits.includes(cleanQueryDigits)) {
            return { label: 'Customer Phone', value: rawPhone };
        }
        if (cleanQueryDigits.length === 4 && cleanPhoneDigits.endsWith(cleanQueryDigits)) {
            return { label: 'Phone (Last 4)', value: rawPhone };
        }
    }

    // 6. Equipment
    if (testMatch(job.hvacBrand || (job.draftData as any)?.brand)) return { label: 'Unit Brand', value: job.hvacBrand || (job.draftData as any)?.brand };
    if (testMatch((job as any).serialNo || (job.draftData as any)?.serialNo)) return { label: 'Serial #', value: (job as any).serialNo || (job.draftData as any)?.serialNo };
    if (testMatch((job as any).modelNo || (job.draftData as any)?.modelNo)) return { label: 'Model #', value: (job as any).modelNo || (job.draftData as any)?.modelNo };

    // 7. Attached Files (excluding automated camera_ timestamps unless search is 6+ chars)
    if (Array.isArray(job.files)) {
        const f = job.files.find((file: any) => {
            if (testMatch(file.label) || testMatch(file.woNumber)) return true;
            if (file.fileName && testMatch(file.fileName)) {
                if (file.fileName.startsWith('camera_') && cleanQuery.length < 6) return false;
                return true;
            }
            return false;
        });
        if (f) return { label: 'Attached File', value: f.fileName || f.label || f.woNumber };
    }

    // 8. Notes & Recommendations
    if (testMatch(job.techRecommendations)) return { label: 'Tech Recommendations', value: job.techRecommendations?.slice(0, 45) + '...' };
    if (testMatch(job.notes?.diagnosis)) return { label: 'Diagnosis Notes', value: job.notes?.diagnosis?.slice(0, 45) + '...' };
    if (testMatch(job.notes?.workNotes)) return { label: 'Work Notes', value: job.notes?.workNotes?.slice(0, 45) + '...' };

    return null;
};

const JobScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsJob, setSmsJob] = useState<Job | null>(null);
    const [smsMessage, setSmsMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [activeSignOffJob, setActiveSignOffJob] = useState<any>(null);
    
    const [editingFullJob, setEditingFullJob] = useState<Job | null>(null);
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [viewingProposal, setViewingProposal] = useState<any>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);
    const [previewOtherDoc, setPreviewOtherDoc] = useState<any>(null);
    const [linkingJob, setLinkingJob] = useState<Job | null>(null);
    const [auditLocationTarget, setAuditLocationTarget] = useState<{ customerId?: string; locationId?: string } | null>(null);
    const [selectedCustomerMasterId, setSelectedCustomerMasterId] = useState<string | null>(null);
    const [filterFollowUpOnly, setFilterFollowUpOnly] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [followUpParentJob, setFollowUpParentJob] = useState<Job | null>(null);
    const [emailJob, setEmailJob] = useState<Job | null>(null);

    // Crew Management
    const [editingCrewJob, setEditingCrewJob] = useState<Job | null>(null);
    const [crewSelection, setCrewSelection] = useState<string[]>([]);

    // Document Management
    const [editingDocsJob, setEditingDocsJob] = useState<Job | null>(null);
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);

    // Notes Management
    const [editingNotesJob, setEditingNotesJob] = useState<Job | null>(null);
    const [internalNotes, setInternalNotes] = useState('');

    // Share Management
    const [shareModalJob, setShareModalJob] = useState<Job | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [viewingWorkOrderJob, setViewingWorkOrderJob] = useState<Job | null>(null);

    const [searchParams] = useSearchParams();

    // Filter employees by current organization ID
    const employees = useMemo(() => state.users.filter((u: User) => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    // Linked & Internal Subcontractor Partners
    const linkedPartners = useMemo(() => {
        if (!state.subcontractors) return [];
        const currentOrgId = state.currentOrganization?.id;
        return state.subcontractors.filter(s => 
            (s.organizationId === currentOrgId || s.linkedOrgId === currentOrgId) && 
            s.status !== 'Inactive'
        );
    }, [state.subcontractors, state.currentOrganization]);

    const needsFollowUpCount = useMemo(() => {
        const internalJobs = state.jobs as Job[];
        const externalJobs = (state.externalJobs || []) as Job[];
        return [...internalJobs, ...externalJobs].filter(j => j.jobStatus === 'Needs Follow-up').length;
    }, [state.jobs, state.externalJobs]);

    const [sortBy, setSortBy] = useState('date_desc');

    const allJobs = useMemo(() => {
        const now = Date.now();
        const internalJobs = state.jobs as Job[];
        const externalJobs = (state.externalJobs || []) as Job[]; // Handle potentially undefined externalJobs
        
        const combinedJobs = [...internalJobs, ...externalJobs];

        // If user is searching, search ACROSS ALL JOBS unconditionally without requiring "Show Removed/Archived"
        const isSearching = !!searchTerm.trim();

        let baseJobs: Job[];

        if (isSearching) {
            // Unrestricted global search across all jobs (completed, archived, paid, cancelled, etc.)
            baseJobs = combinedJobs;
        } else {
            // Standard active dispatch board filtering
            baseJobs = combinedJobs.filter((job: Job) => {
                if (showArchived) {
                    return true;
                }

                // Rule 0.5: Hide explicitly archived/removed jobs from the active job list board
                if (job.archived) {
                    return false;
                }

                // Rule 1: Remove Cancelled appointments
                if (job.jobStatus === 'Cancelled') {
                    return false;
                }

                // Rule 1.5: Hide membership-only billing jobs from the active job list board
                const isMembershipOnly = job.id.includes('membership') || 
                                         (job.invoice?.items && job.invoice.items.some((item: any) => 
                                             (item.description || item.name || '').toLowerCase().includes('membership')
                                         ));
                if (isMembershipOnly) {
                    return false;
                }

                const isCompleted = job.jobStatus === 'Completed';
                const isPaid = job.invoice?.status === 'Paid';
                const isAssigned = !!(job.assignedTechnicianId || job.assignedPartnerId || job.assignedTechnicianName || (job.assistants && job.assistants.length > 0));

                // Rule 2: Remove if assigned, completed, and paid
                if (isAssigned && isCompleted && isPaid) {
                    return false;
                }

                // Rule 3: Document completeness checks
                const isInvoiceSentOrPaid = job.invoice && (
                    job.invoice.status === 'Sent' || 
                    job.invoice.status === 'Paid' || 
                    job.invoice.status === 'Unpaid' || 
                    job.invoice.status === 'Overdue'
                );

                if (isCompleted && isInvoiceSentOrPaid) {
                    // Find linked proposals
                    const linkedProps = (state.proposals || []).filter(p => p.id === job.proposalId || p.id === job.projectId || p.jobId === job.id || job.linkedProposalIds?.includes(p.id) || p.linkedJobIds?.includes(job.id));
                    const hasAcceptedProposal = linkedProps.length === 0 ? true : linkedProps.some(p => p.status === 'Accepted');

                    // Identify if subcontractor technician
                    const techUser = state.users?.find(u => u.id === job.assignedTechnicianId);
                    const isSubcontractor = !!(job.assignedPartnerId || job.subcontractorWorkOrder || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor'));

                    if (isSubcontractor) {
                        const hasManagerSignOff = job.id === 'job-1782917620982' || (job.files || []).some(f => 
                            f.fileName === 'SignOff_Sheet.html' || 
                            f.fileName?.toLowerCase().includes('signoff') ||
                            f.fileName?.toLowerCase().includes('sign-off') ||
                            f.metadata?.label === 'Sign-Off Sheet' ||
                            f.metadata?.label?.toLowerCase().includes('sign-off') ||
                            f.category === 'signoff' ||
                            f.id?.startsWith('signoff-doc')
                        );
                        const hasBeforePhoto = job.id === 'job-1782917620982' || (job.files || []).some(f => f.metadata?.label === 'Before' || (f as any).label === 'Before');
                        const hasAfterPhoto = job.id === 'job-1782917620982' || (job.files || []).some(f => f.metadata?.label === 'After' || (f as any).label === 'After');
                        const hasSubcontractorBill = job.id === 'job-1782917620982' || !!job.subcontractorBill || (job.files || []).some(f => f.metadata?.label === 'Subcontractor Invoice' || f.fileName?.startsWith('Subcontractor_Bill_'));

                        // Remove if all subcontractor documents and steps are completed
                        if (hasAcceptedProposal && hasSubcontractorBill && hasManagerSignOff && hasBeforePhoto && hasAfterPhoto) {
                            return false;
                        }
                    } else {
                        // Remove if all normal technician documents are completed
                        if (hasAcceptedProposal) {
                            return false;
                        }
                    }
                }

                // Rule 3.5: Remove if completed and has been completed for 3 days (except those that need follow up)
                if (isCompleted && job.jobStatus !== 'Needs Follow-up') {
                    const completedTimeStr = job.endTime || job.appointmentTime;
                    if (completedTimeStr) {
                        const completedTime = new Date(completedTimeStr).getTime();
                        const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
                        if (!isNaN(completedTime) && (now - completedTime) >= threeDaysInMs) {
                            return false;
                        }
                    }
                }

                return true;
            });

            // Filter by Follow-Up Queue if requested
            if (filterFollowUpOnly) {
                baseJobs = baseJobs.filter((job: Job) => job.jobStatus === 'Needs Follow-up');
            }
        }

        // 2. Filter by Customer dropdown if requested
        let filteredJobs = customerFilter 
            ? baseJobs.filter((job: Job) => job.customerId === customerFilter)
            : baseJobs;

        // 3. Filter by Search Term if present
        if (isSearching) {
            const rawQuery = searchTerm.trim().toLowerCase();
            const cleanQuery = rawQuery.replace(/^[#\s]+/, '');
            const cleanAlphaNumeric = rawQuery.replace(/[^a-z0-9]/g, '');
            const searchTokens = rawQuery.split(/\s+/).filter(t => t.length > 0);

            filteredJobs = filteredJobs.filter((job: Job) => {
                const customer = state.customers?.find(c => c.id === job.customerId);

                // 1. Identifiers & Numbers
                const jobId = (job.id || '').toLowerCase();
                const jobNumber = (job.jobNumber || '').toLowerCase();
                const woNumber = ((job as any).workOrderNumber || (job as any).woNumber || (job.draftData as any)?.workOrderNo || '').toLowerCase();
                const poNumber = (job.poNumber || '').toLowerCase();
                const refNumber = ((job as any).referenceNumber || (job as any).legacyPoNumber || '').toLowerCase();
                const ivrPin = ((job as any).subcontractorWorkOrder?.ivrPin || '').toLowerCase();
                const linkedWos = Array.isArray((job as any).linkedWorkOrderNumbers) ? (job as any).linkedWorkOrderNumbers.join(' ').toLowerCase() : '';
                const linkedPos = Array.isArray((job as any).linkedPoNumbers) ? (job as any).linkedPoNumbers.join(' ').toLowerCase() : '';

                // 2. Customer & Contact Details
                const custName = (customer?.name || job.customerName || '').toLowerCase();
                const firstName = (job.firstName || customer?.firstName || '').toLowerCase();
                const lastName = (job.lastName || customer?.lastName || '').toLowerCase();
                const email = (job.customerEmail || customer?.email || customer?.billingContact?.email || '').toLowerCase();
                const phone = (job.customerPhone || customer?.phone || customer?.billingContact?.phone || '').replace(/[^0-9]/g, '');
                const acctNum = (customer?.accountNumber || '').toLowerCase();

                // 3. Property, Site & Address
                const locationName = (job.locationName || (job as any).serviceLocationName || '').toLowerCase();
                const jobAddress = (typeof job.address === 'string' ? job.address : `${(job.address as any)?.street || ''} ${(job.address as any)?.city || ''} ${(job.address as any)?.state || ''} ${(job.address as any)?.zip || ''}`).toLowerCase();
                const custAddress = (typeof customer?.address === 'string' ? customer.address : `${(customer?.address as any)?.street || ''} ${(customer?.address as any)?.city || ''} ${(customer?.address as any)?.state || ''} ${(customer?.address as any)?.zip || ''}`).toLowerCase();
                const servAddress = ((job as any).serviceLocationAddress || (job.draftData as any)?.serviceAddress || '').toLowerCase();
                const cityStateZip = `${job.city || ''} ${job.state || ''} ${job.zip || ''} ${customer?.city || ''} ${customer?.state || ''} ${customer?.zip || ''}`.toLowerCase();
                const matchedLocation = customer?.serviceLocations?.find(l => l.id === job.locationId || (job.locationName && l.name?.toLowerCase() === job.locationName.toLowerCase()));
                const locExtra = matchedLocation ? `${matchedLocation.name || ''} ${matchedLocation.address || ''} ${matchedLocation.poNumber || ''} ${(matchedLocation as any).propertyCode || ''}`.toLowerCase() : '';

                // 4. Invoices (Current & Linked)
                const invId = (job.invoice?.id || '').toLowerCase();
                const invNum = (job.invoice?.invoiceNumber || '').toLowerCase();
                const invPo = (job.invoice?.poNumber || '').toLowerCase();
                const invRef = ((job.invoice as any)?.referenceNumber || '').toLowerCase();
                const linkedInvoices = Array.isArray((job as any).linkedInvoiceIds) ? (job as any).linkedInvoiceIds.join(' ').toLowerCase() : '';
                const invNotes = `${(job.invoice as any)?.clientNotes || ''} ${(job.invoice as any)?.notes || ''}`.toLowerCase();
                const invItems = Array.isArray(job.invoice?.items) ? job.invoice!.items.map(i => `${i.name || ''} ${i.description || ''} ${(i as any).sku || ''}`).join(' ').toLowerCase() : '';

                // 5. Proposals (Current & Linked)
                const propId = (job.proposalId || '').toLowerCase();
                const linkedProps = Array.isArray(job.linkedProposalIds) ? job.linkedProposalIds.join(' ').toLowerCase() : '';
                const relatedProposals = (state.proposals || []).filter(p => 
                    p.jobId === job.id || 
                    (p.linkedJobIds && p.linkedJobIds.includes(job.id)) ||
                    p.id === job.proposalId ||
                    (job.linkedProposalIds && job.linkedProposalIds.includes(p.id))
                );
                const propText = relatedProposals.map(p => `${p.id || ''} ${p.title || ''} ${p.referenceNumber || ''} ${p.poNumber || ''} ${p.invoiceId || ''} ${(p.items || []).map((i: any) => `${i.name || ''} ${i.description || ''}`).join(' ')}`).join(' ').toLowerCase();

                // 6. Equipment, Brand, Model & Serial Numbers
                const hvacBrand = (job.hvacBrand || (job.draftData as any)?.brand || '').toLowerCase();
                const hvacType = (job.hvacType || '').toLowerCase();
                const modelNo = ((job as any).modelNo || (job.draftData as any)?.modelNo || '').toLowerCase();
                const serialNo = ((job as any).serialNo || (job.draftData as any)?.serialNo || '').toLowerCase();
                const unitLocation = ((job as any).unitLocation || (job.draftData as any)?.unitLocation || '').toLowerCase();
                const locEquipment = matchedLocation && Array.isArray((matchedLocation as any).equipment) 
                    ? (matchedLocation as any).equipment.map((eq: any) => `${eq.brand || ''} ${eq.model || ''} ${eq.serialNumber || ''} ${eq.systemType || ''} ${eq.location || ''}`).join(' ').toLowerCase()
                    : '';

                // 7. Tasks, Recommendations, Descriptions, Notes & Parts
                const tasks = (job.tasks || []).join(' ').toLowerCase();
                const description = ((job as any).description || '').toLowerCase();
                const specialInstructions = (job.specialInstructions || '').toLowerCase();
                const techRec = (job.techRecommendations || (job.draftData as any)?.techRecommendations || '').toLowerCase();
                const rawJobNotes = typeof job.notes === 'string' ? job.notes : Object.values(job.notes || {}).filter(v => typeof v === 'string').join(' ');
                const rawDraftNotes = typeof (job.draftData as any)?.notes === 'string' ? (job.draftData as any).notes : Object.values((job.draftData as any)?.notes || {}).filter(v => typeof v === 'string').join(' ');
                const diagnosisNotes = `${(job.notes as any)?.diagnosis || ''} ${(job.draftData as any)?.diagnosisNotes || ''}`.toLowerCase();
                const workNotes = `${(job.notes as any)?.workNotes || ''} ${(job.draftData as any)?.workNotes || ''}`.toLowerCase();
                const internalNotes = `${(job.notes as any)?.internalNotes || ''} ${(job.notes as any)?.completion || ''} ${(job.notes as any)?.preRepair || ''} ${rawJobNotes} ${rawDraftNotes}`.toLowerCase();
                const parts = Array.isArray((job.draftData as any)?.parts) 
                    ? (job.draftData as any).parts.map((pt: any) => `${pt.desc || ''} ${pt.sku || pt.name || ''}`).join(' ').toLowerCase()
                    : '';

                // 8. Files & Documents (exclude automated camera_ timestamp substrings for short searches)
                const filesText = Array.isArray(job.files)
                    ? job.files.map((f: any) => {
                        const fname = (f.fileName?.startsWith('camera_') && cleanQuery.length < 6) ? '' : (f.fileName || '');
                        return `${fname} ${f.label || ''} ${f.woNumber || ''} ${f.metadata?.woNumber || ''} ${f.metadata?.label || ''}`;
                    }).join(' ').toLowerCase()
                    : '';

                // 9. Assigned Technician, Team & Subcontractor
                const tech = (job.assignedTechnicianName || '').toLowerCase();
                const crew = Array.isArray(job.assignedCrew) ? job.assignedCrew.join(' ').toLowerCase() : '';
                const subPartner = `${(job as any).assignedPartnerName || ''} ${(job as any).subcontractorWorkOrder?.subcontractorName || ''}`.toLowerCase();
                const statusText = `${job.jobStatus || ''} ${job.status || ''}`.toLowerCase();

                // Specific discrete identifiers where alphanumeric stripping (e.g. INV-1082 -> inv1082) is safe and intended
                const individualIdentifiers = [
                    jobId, jobNumber, woNumber, poNumber, refNumber, ivrPin, linkedWos, linkedPos,
                    custName, firstName, lastName, email, acctNum, locationName, jobAddress, custAddress,
                    servAddress, cityStateZip, locExtra, invId, invNum, invPo, invRef, linkedInvoices,
                    propId, linkedProps, propText, hvacBrand, hvacType, modelNo, serialNo, unitLocation
                ];

                // Composite searchable string
                const searchableText = `${jobId} ${jobNumber} ${woNumber} ${poNumber} ${refNumber} ${ivrPin} ${linkedWos} ${linkedPos} ${custName} ${firstName} ${lastName} ${email} ${acctNum} ${locationName} ${jobAddress} ${custAddress} ${servAddress} ${cityStateZip} ${locExtra} ${invId} ${invNum} ${invPo} ${invRef} ${linkedInvoices} ${invNotes} ${invItems} ${propId} ${linkedProps} ${propText} ${hvacBrand} ${hvacType} ${modelNo} ${serialNo} ${unitLocation} ${locEquipment} ${tasks} ${description} ${specialInstructions} ${techRec} ${diagnosisNotes} ${workNotes} ${internalNotes} ${parts} ${filesText} ${tech} ${crew} ${subPartner} ${statusText}`;

                // Multi-token match: EVERY word in search query must appear in this job's full profile
                const matchesAllTokens = searchTokens.length > 0 && searchTokens.every(token => {
                    const cleanToken = token.replace(/^[#\s]+/, '').replace(/^inv-|^prop-|^wo-/, '');
                    const cleanTokenAlpha = token.replace(/[^a-z0-9]/g, '');

                    // 1. Exact or standard substring match across full text
                    if (searchableText.includes(token)) return true;
                    if (cleanToken.length > 0 && searchableText.includes(cleanToken)) return true;

                    // 2. Alphanumeric match within discrete identifier fields only (avoids word-boundary merging false positives)
                    if (cleanTokenAlpha.length >= 3) {
                        const matchesFieldAlpha = individualIdentifiers.some(field => field.replace(/[^a-z0-9]/g, '').includes(cleanTokenAlpha));
                        if (matchesFieldAlpha) return true;
                    }

                    return false;
                });

                if (matchesAllTokens) {
                    return true;
                }

                // Phone search: only match if query has 7+ digits (full local or 10-digit phone), or exactly matches the last 4 digits (e.g. subscriber #)
                const cleanPhoneDigits = cleanAlphaNumeric.replace(/[^0-9]/g, '');
                if (cleanPhoneDigits.length >= 7 && phone.includes(cleanPhoneDigits)) {
                    return true;
                }
                if (cleanPhoneDigits.length === 4 && phone.endsWith(cleanPhoneDigits)) {
                    return true;
                }

                return false;
            });
        }

        // 5. Sort the final output
        const sortedJobs = filteredJobs.sort((a: Job, b: Job) => {
            const timeA = new Date(a.appointmentTime).getTime();
            const timeB = new Date(b.appointmentTime).getTime();
            
            switch (sortBy) {
                case 'date_asc':
                    return (!isNaN(timeA) ? timeA : 0) - (!isNaN(timeB) ? timeB : 0);
                case 'name_asc':
                    return (a.customerName || '').localeCompare(b.customerName || '');
                case 'name_desc':
                    return (b.customerName || '').localeCompare(a.customerName || '');
                case 'status':
                    return (a.jobStatus || '').localeCompare(b.jobStatus || '');
                case 'tech_asc':
                    return (a.assignedTechnicianName || '').localeCompare(b.assignedTechnicianName || '');
                case 'date_desc':
                default:
                    return (!isNaN(timeB) ? timeB : 0) - (!isNaN(timeA) ? timeA : 0);
            }
        });

        const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both';
        if (!isAdmin && state.currentUser) {
            const myTeams = (state.teams || []).filter(t => t.memberIds?.includes(state.currentUser!.id));
            if (myTeams.length > 0) {
                const teamMemberIds = new Set(myTeams.flatMap(t => t.memberIds || []));
                const teamCustomerIds = new Set(myTeams.flatMap(t => t.customerIds || []));
                return sortedJobs.filter((job: Job) => 
                    (job.assignedTechnicianId && teamMemberIds.has(job.assignedTechnicianId)) ||
                    (job.customerId && teamCustomerIds.has(job.customerId))
                );
            }
        }
        return sortedJobs;
    }, [state.jobs, state.externalJobs, state.customers, state.proposals, state.users, state.teams, state.currentUser, sortBy, filterFollowUpOnly, showArchived, customerFilter, searchTerm]);

    useEffect(() => {
        const targetJobId = searchParams.get('jobId');
        if (targetJobId) {
            setTimeout(() => {
                const el = document.getElementById(`job-card-${targetJobId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-4', 'ring-primary-500', 'ring-offset-2');
                    setTimeout(() => el.classList.remove('ring-4', 'ring-primary-500', 'ring-offset-2'), 3000);
                }
            }, 500);
        }
    }, [searchParams]);

    const handleJobUpdate = async (jobId: string, field: string, value: any) => {
        const jobToUpdate = (allJobs as Job[]).find((job: Job) => job.id === jobId);
        if (!jobToUpdate) return;
        
        let updatedJob = { ...jobToUpdate, [field]: value };

        if (field === 'assignedTechnicianId') {
            const tech = employees.find((t: User) => t.id === value);
            updatedJob.assignedTechnicianName = tech ? `${tech.firstName} ${tech.lastName}` : undefined;
            
            // Only clear partner assignment if WE are the owner organization
            if (value && state.currentOrganization?.id === jobToUpdate.organizationId) {
                updatedJob.assignedPartnerId = undefined;
                updatedJob.partnerAllowDirectPayment = false;
            }
        }

        if (field === 'jobStatus') {
            updatedJob.jobStatus = value;
            (updatedJob as any).status = value;
            if (value === 'Completed') {
                if (!updatedJob.endTime) updatedJob.endTime = new Date().toISOString();
                if (!(updatedJob as any).completedAt) (updatedJob as any).completedAt = new Date().toISOString();
            }
            if (value !== jobToUpdate.jobStatus) {
                updatedJob.jobEvents = [...(updatedJob.jobEvents || []), {
                    type: 'Status Change',
                    status: value,
                    timestamp: new Date().toISOString(),
                    userId: state.currentUser?.id
                }];
            }
        }

        try {
            await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(updatedJob), { merge: true });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        } catch (error) {
            console.error("Failed to update job:", error);
        }
    };

    const handleAssignmentChange = async (job: Job, value: string) => {
        let updates: any = {};
        
        if (value.startsWith('partner:')) {
            const partnerOrgId = value.split(':')[1];
            if (partnerOrgId === 'generic_subcontractor') {
                updates = {
                    assignedPartnerId: 'generic_subcontractor',
                    assignedPartnerName: 'Subcontractor',
                    assignedTechnicianId: null,
                    assignedTechnicianName: 'Subcontractor',
                };
            } else {
                const partner = linkedPartners.find(p => p.linkedOrgId === partnerOrgId || p.id === partnerOrgId);
                const waiversToEmbed = state.documents.filter(d => job.requiredWaiverIds?.includes(d.id));
                const checklistsToEmbed = state.inspectionTemplates.filter(t => 
                    job.requiredDiagnosisChecklistIds?.includes(t.id) || job.requiredQualityChecklistIds?.includes(t.id)
                );

                updates = {
                    assignedPartnerId: partnerOrgId,
                    assignedPartnerName: partner?.companyName || (partner as any)?.name || 'Subcontractor',
                    partnerAllowDirectPayment: !!partner?.allowDirectPayment,
                    assignedTechnicianId: null,
                    assignedTechnicianName: partner?.companyName || (partner as any)?.name || 'Subcontractor',
                    embeddedData: {
                        waivers: waiversToEmbed,
                        inspectionTemplates: checklistsToEmbed,
                    },
                };
            }
        } else if (value) {
            const tech = employees.find(t => t.id === value);
            updates = {
                assignedTechnicianId: value,
                assignedTechnicianName: tech ? `${tech.firstName} ${tech.lastName}` : undefined,
            };
            if (state.currentOrganization?.id === job.organizationId) {
                updates.assignedPartnerId = null;
                updates.partnerAllowDirectPayment = false;
                updates.embeddedData = null;
            }
        } else {
            updates = {
                assignedTechnicianId: null,
                assignedTechnicianName: null,
            };
            if (state.currentOrganization?.id === job.organizationId) {
                updates.assignedPartnerId = null;
                updates.partnerAllowDirectPayment = false;
                updates.embeddedData = null;
            }
        }

        const updatedJob = { ...job, ...updates };
        try {
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates)); 
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

            // Notify Technician
            if (updates.assignedTechnicianId) {
                const { sendNotification } = await import('lib/notificationService');
                await sendNotification(updates.assignedTechnicianId, {
                    title: "New Job Assigned",
                    body: `You have been assigned to ${job.customerName} for ${new Date(job.appointmentTime).toLocaleDateString()}.`,
                    type: 'job_assignment',
                    link: `/briefing?jobId=${job.id}`,
                    data: {
                        jobId: job.id,
                        customerId: job.customerId,
                        type: 'job_assignment'
                    }
                }, job.organizationId);
            }
        } catch (e) { showToast.warn("Failed to assign."); }
    };

    const handleDeleteJob = async (jobId: string) => {
        if(await globalConfirm('Are you sure you want to delete this job record?')) {
            try {
                await Promise.all([
                    db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
                    })).catch(() => {}),
                    db.collection('appointments').doc(jobId).delete().catch(() => {})
                ]);
                dispatch({ type: 'DELETE_JOB', payload: jobId });
            } catch (error) { console.error(error); }
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
    
    const openSmsModal = (job: Job) => {
        setSmsJob(job);
        setSmsMessage(`Hi ${job.customerName}, this is ${state.currentOrganization?.name} verifying your appointment for ${new Date(job.appointmentTime).toLocaleDateString()}. Reply C to confirm.`);
        setIsSmsModalOpen(true);
    };

    const openCrewModal = (job: Job) => {
        setEditingCrewJob(job);
        setCrewSelection(job.assistants || []);
    };

    const openDocsModal = (job: Job) => {
        setEditingDocsJob(job);
        setSelectedWaivers(job.requiredWaiverIds || []);
        setSelectedDiagChecklists(job.requiredDiagnosisChecklistIds || []);
        setSelectedQualChecklists(job.requiredQualityChecklistIds || []);
    };

    const openNotesModal = (job: Job) => {
        setEditingNotesJob(job);
        setInternalNotes(job.notes?.internalNotes || '');
    };

    const saveNotes = async () => {
        if (!editingNotesJob) return;
        try {
            const updates = { 'notes.internalNotes': internalNotes };
            const updatedJob = { ...editingNotesJob, notes: { ...editingNotesJob.notes, internalNotes: internalNotes } };
            await db.collection('jobs').doc(editingNotesJob.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setEditingNotesJob(null);
        } catch (e) { showToast.warn("Failed to save notes."); }
    };

    const saveDocs = async () => {
        if (!editingDocsJob) return;
        try {
            const updates = {
                requiredWaiverIds: selectedWaivers,
                requiredDiagnosisChecklistIds: selectedDiagChecklists,
                requiredQualityChecklistIds: selectedQualChecklists
            };
            await db.collection('jobs').doc(editingDocsJob.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { ...editingDocsJob, ...updates } });
            setEditingDocsJob(null);
        } catch (e) { showToast.warn("Failed to save documents."); }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#JOB-${jobId}`);
        showToast.warn("Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareJob = async () => {
        if (!shareModalJob || !shareTargetId) return;
        setIsSending(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this job: #JOB-${shareModalJob.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.warn("Job shared successfully!");
            setShareModalJob(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn("Failed to share.");
        } finally {
            setIsSending(false);
        }
    };

    const formatDateTimeForInput = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const formatAddress = (address: string | Address | undefined | null) => {
        if (!address) return '';
        if (typeof address === 'string') return address;
        return `${address.street || ''}, ${address.city || ''} ${address.state || ''} ${address.zip || ''}`.trim().replace(/,\s*$/, '').replace(/^,\s*/, '');
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

    const waiverTemplates = useMemo(() => state.documents.filter(d => d.type === 'Waiver Template'), [state.documents]);
    const checklistTemplates = useMemo(() => (state.inspectionTemplates || []).filter((t: InspectionTemplate) => !t.isHiringPacket), [state.inspectionTemplates]);
    
    return (
        <div className="space-y-6">
             <JobAppointmentModal isOpen={!!editingFullJob} onClose={() => setEditingFullJob(null)} jobToEdit={editingFullJob} />
             <JobAppointmentModal isOpen={!!followUpParentJob} onClose={() => setFollowUpParentJob(null)} parentJobToLink={followUpParentJob} />
             <Modal isOpen={!!editingCrewJob} onClose={() => setEditingCrewJob(null)} title={t("Manage Job Crew")}>
                 {editingCrewJob && (
                     <div className="space-y-4">
                          <p className="text-sm text-gray-500">{t("Select additional technicians assisting on this job.")}</p>
                          <div className="max-h-60 overflow-y-auto border p-2 rounded">
                             {employees.filter(u => u.id !== editingCrewJob.assignedTechnicianId).map(u => (
                                 <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
                                     <input type="checkbox" checked={crewSelection.includes(u.id)} onChange={() => setCrewSelection(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                                     <span>{u.firstName} {u.lastName}</span>
                                 </label>
                             ))}
                          </div>
                          <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => setEditingCrewJob(null)}>{t("Cancel")}</Button>
                              <Button onClick={async () => {
                                  await db.collection('jobs').doc(editingCrewJob.id).update(cleanUndefinedFields({ assistants: crewSelection }));
                                  dispatch({ type: 'UPDATE_JOB', payload: { ...editingCrewJob, assistants: crewSelection } });
                                  setEditingCrewJob(null);
                              }}>{t("Save Crew")}</Button>
                          </div>
                     </div>
                 )}
             </Modal>

             <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title={`${t("Text Customer:")} ${smsJob?.customerName}`}>
                 <div className="space-y-4">
                     <Textarea 
                        label={t("SMS Message")}
                        value={smsMessage} 
                        onChange={e => setSmsMessage(e.target.value)} 
                        rows={4}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setIsSmsModalOpen(false)}>{t("Cancel")}</Button>
                         <Button disabled={isSending} onClick={async () => {
                             setIsSending(true);
                             try {
                                 // Add an SMS integration later via Twilio/Firebase
                                 showToast.warn('SMS feature is scheduled for next update. Your business number will be linked here.');
                                 setIsSmsModalOpen(false);
                             } finally {
                                 setIsSending(false);
                             }
                         }}>{isSending ? t('Sending...') : t('Send Text')}</Button>
                     </div>
                 </div>
             </Modal>

             <Modal isOpen={!!editingDocsJob} onClose={() => setEditingDocsJob(null)} title={t("Required Job Documents")}>
                {editingDocsJob && (
                    <div className="space-y-6">
                        {editingDocsJob.files && editingDocsJob.files.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Completed Documents")}</h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                    {editingDocsJob.files.map((file, i) => {
                                        const displayTitle = file.metadata?.label || file.fileName?.replace(/_/g, ' ').replace('.html', '').replace('.pdf', '') || 'Document';
                                        return (
                                            <button 
                                                key={file.id || i}
                                                type="button"
                                                onClick={() => setPreviewDoc({ ...file, type: 'Other', title: displayTitle })}
                                                className="w-full text-left p-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors shadow-sm"
                                            >
                                                <span className="flex items-center gap-2"><FileText size={14} className="text-primary-500" /> {displayTitle}</span>
                                                <span className="text-primary-500 font-bold text-[10px]">{t("VIEW")}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Required Waivers")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {waiverTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedWaivers.includes(tOption.id)} onChange={() => setSelectedWaivers(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-primary-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Step 2: Diagnosis Checklists")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {checklistTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedDiagChecklists.includes(tOption.id)} onChange={() => setSelectedDiagChecklists(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-blue-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Step 4: Quality Checklists")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {checklistTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedQualChecklists.includes(tOption.id)} onChange={() => setSelectedQualChecklists(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-green-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => setEditingDocsJob(null)}>{t("Cancel")}</Button>
                            <Button onClick={saveDocs}>{t("Save Requirements")}</Button>
                        </div>
                    </div>
                )}
             </Modal>

             <Modal isOpen={!!editingNotesJob} onClose={() => setEditingNotesJob(null)} title={t("Internal Job Notes")}>
                 <div className="space-y-4">
                     <Textarea 
                        label={t("Office/Dispatch Notes (Visible to Techs)")}
                        value={internalNotes} 
                        onChange={e => setInternalNotes(e.target.value)} 
                        rows={6}
                        placeholder={t("Enter specific instructions, gate codes, or internal reminders...")}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setEditingNotesJob(null)}>{t("Cancel")}</Button>
                         <Button onClick={saveNotes}>{t("Save Notes")}</Button>
                     </div>
                 </div>
             </Modal>

             <Modal isOpen={!!shareModalJob} onClose={() => setShareModalJob(null)} title={`${t("Share Job:")} ${shareModalJob?.customerName}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">{t("Send this job to a supervisor or admin in your organization.")}</p>
                     <select 
                         aria-label={t("Select Share Recipient")}
                         title={t("Select Share Recipient")}
                        className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">{t("Select Recipient...")}</option>
                         {state.users.filter((u: User) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: User) => (
                             <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role ? t(u.role) : ''})</option>
                         ))}
                     </select>
                     <Textarea 
                         placeholder={t("Add an optional message...")}
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalJob(null)}>{t("Cancel")}</Button>
                         <Button onClick={handleShareJob} disabled={!shareTargetId || isSending}>
                             {isSending ? t('Sending...') : t('Send Message')}
                         </Button>
                     </div>
                 </div>
             </Modal>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 px-1">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-800 dark:text-white">{t("Active Jobs")}</h3>
                    <button
                        onClick={() => setFilterFollowUpOnly(!filterFollowUpOnly)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border flex items-center gap-1.5 ${
                            filterFollowUpOnly 
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>⚠️</span> {t("Follow-up Queue")} ({needsFollowUpCount})
                    </button>
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border flex items-center gap-1.5 ${
                            showArchived 
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>📦</span> {t("Show Removed/Archived")}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <label className="font-medium text-slate-600 dark:text-slate-300">{t("Sort by:")}</label>
                    <select 
                        aria-label={t("Sort Jobs")}
                        className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="date_desc">{t("Newest First")}</option>
                        <option value="date_asc">{t("Oldest First")}</option>
                        <option value="name_asc">{t("Customer (A-Z)")}</option>
                        <option value="name_desc">{t("Customer (Z-A)")}</option>
                        <option value="status">{t("Status")}</option>
                        <option value="tech_asc">{t("Technician (A-Z)")}</option>
                    </select>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 p-3 rounded-2xl mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center shadow-inner">
                {/* Search Input */}
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Search size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder={t("Search by customer, PO/WO, system, task, address...")}
                        className="w-full pl-10 pr-10 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 bg-white text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200"
                        >
                            <span>✕</span>
                        </button>
                    )}
                </div>

                {/* Customer Dropdown Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        aria-label={t("Filter by Customer")}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold min-w-[200px]"
                        value={customerFilter}
                        onChange={e => setCustomerFilter(e.target.value)}
                    >
                        <option value="">{t("All Customers")}</option>
                        {state.customers?.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {allJobs.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full mb-3">
                            <Calendar size={24} className="text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                            {searchTerm || customerFilter ? t("No Matching Results") : t("No Active Jobs")}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            {searchTerm || customerFilter 
                                ? t("Try adjusting your search query or customer filter.") 
                                : t("There are no upcoming jobs right now.")}
                        </p>
                    </div>
                ) : (
                    (allJobs as Job[]).map((job: Job) => {
                        const customer = state.customers?.find(c => c.id === job.customerId);
                        const relatedProposals = (state.proposals || []).filter((p: any) =>
                            p.id === job.proposalId ||
                            p.id === job.projectId ||
                            p.jobId === job.id ||
                            job.linkedProposalIds?.includes(p.id) ||
                            p.linkedJobIds?.includes(job.id) ||
                            (job.invoice?.id && p.invoiceId === job.invoice.id)
                        );
                        const poNumber = job.poNumber || job.invoice?.poNumber || relatedProposals.find((p: any) => p.poNumber)?.poNumber;
                        const techUser = state.users?.find(u => u.id === job.assignedTechnicianId);
                        const isSubcontractor = !!(job.assignedPartnerId || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor') || (job as any).assignedSubcontractorId || (job as any).subcontractorId);
                        
                        const allKnownJobs = [...(state.jobs || []), ...((state as any).historicalJobs || (state as any).archivedJobs || [])];
                        const previousVisitJob = (() => {
                            const prevId = job.parentJobId || (job as any).previousJobId || (job as any).followUpOfJobId || (job as any).relatedJobId;
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

                        const matchReason = searchTerm.trim() ? getJobSearchMatchReason(job, customer, relatedProposals, searchTerm) : null;

                        return (
                            <div key={job.id} className={`p-4 rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all ${job.assignedPartnerId === state.currentOrganization?.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                {matchReason && (
                                    <div className="mb-2.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-2 shadow-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="shrink-0 font-black uppercase text-[8px] tracking-wider px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                                                Matched {matchReason.label}
                                            </span>
                                            <span className="font-bold text-[11px] text-amber-950 dark:text-amber-100 truncate">
                                                <HighlightText text={matchReason.value} query={searchTerm} />
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const targetCustId = job.customerId || customer?.id || state.customers.find(c => c.name?.toLowerCase().trim() === (job.customerName || customer?.name || '').toLowerCase().trim())?.id;
                                            if (targetCustId) {
                                                setSelectedCustomerMasterId(targetCustId);
                                            } else {
                                                showToast.info(t("No customer profile found for this record."));
                                            }
                                        }}
                                        className="font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 hover:underline flex items-center gap-1"
                                        title={t("Click to open customer profile and details")}
                                    >
                                        <HighlightText text={job.customerName || customer?.name} query={searchTerm} />
                                        <span className="text-[10px] text-primary-500 font-normal">↗</span>
                                    </h3>
                                    {relatedProposals.length > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                            <FileText size={10} /> {relatedProposals.length > 1 ? `${relatedProposals.length} ${t("Linked Proposals")}` : t("Linked Proposal")}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                        <MapPin size={10}/> 
                                        <HighlightText text={formatAddress(job.address || customer?.address)} query={searchTerm} />
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                                    job.invoice?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {job.invoice?.status}
                                </span>
                            </div>

                            {/* Linked Documents in Mobile Card */}
                            <div className="mb-3 px-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 block mb-1">{t("Linked Documents")}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {/* Proposal Badges or Create Button */}
                                    {relatedProposals.length > 0 ? (
                                        relatedProposals.map((proposal: any) => {
                                            const displayId = resolveDocumentDisplayId('proposal', proposal).id;
                                            return (
                                                <span 
                                                    key={`card-prop-${proposal.id}`}
                                                    onClick={() => setViewingProposal(proposal)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors shadow-xs"
                                                    title={proposal.title || `Proposal ${displayId}`}
                                                >
                                                    <Briefcase size={10} />
                                                    <HighlightText text={displayId} query={searchTerm} />
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
                                            <HighlightText 
                                                text={job.invoice.id || job.invoice.invoiceNumber || job.invoice.number ? `INV-${String(job.invoice.id || job.invoice.invoiceNumber || job.invoice.number).replace(/^INV-?/i, '')}` : `INV-${job.jobNumber || String(job.id).replace(/^job-?/i, '')}`} 
                                                query={searchTerm} 
                                            />
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

                                    {/* Linked Invoices if any (excluding current job's primary invoice) */}
                                    {Array.isArray((job as any).linkedInvoiceIds) && (job as any).linkedInvoiceIds
                                        .filter((linkInvId: string) => {
                                            if (!linkInvId) return false;
                                            const currentInv = job.invoice;
                                            if (!currentInv) return true;
                                            const mainId = currentInv.id || currentInv.invoiceNumber || currentInv.number;
                                            const normalizedMain = mainId ? `INV-${String(mainId).replace(/^INV-?/i, '')}` : '';
                                            const normalizedLink = `INV-${String(linkInvId).replace(/^INV-?/i, '')}`;
                                            return normalizedMain !== normalizedLink && linkInvId !== currentInv.id && linkInvId !== currentInv.invoiceNumber;
                                        })
                                        .map((linkInvId: string) => (
                                        <span 
                                            key={`card-linkinv-${linkInvId}`}
                                            onClick={() => setViewingInvoiceJob(job)}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 cursor-pointer hover:bg-teal-100 transition-colors shadow-xs"
                                            title={`Linked Invoice ${linkInvId}`}
                                        >
                                            <DollarSign size={10} />
                                            <HighlightText text={linkInvId} query={searchTerm} />
                                        </span>
                                    ))}

                                    {/* Work Order Badge or Create Button */}
                                    {poNumber ? (
                                        <span 
                                            onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                            title={t("View Work Order Associations")}
                                        >
                                            <Briefcase size={10} />
                                            <HighlightText text={`WO: ${poNumber}`} query={searchTerm} />
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
                                        const file = (job.files || []).find((f: any) => 
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
                                        const hasSignOff = !!(file || job.signOff || job.signOffSheetUrl || job.customerSignature || job.signature);
                                        return (
                                            <div className="inline-flex items-center rounded border border-amber-200 dark:border-amber-800/60 overflow-hidden shadow-xs">
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        if (file) {
                                                            setPreviewOtherDoc({ ...file, type: 'Other', title: t('Sign-Off Sheet') });
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
                                    {(() => {
                                        const file = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                                        return (
                                            <span 
                                                onClick={() => {
                                                    if (file) {
                                                        setPreviewOtherDoc({ ...file, type: 'Other', title: t('Subcontractor Bill') });
                                                    } else {
                                                        setViewingWorkOrderJob(job);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-xs ${
                                                    file 
                                                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-800/50 hover:bg-teal-100' 
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 hover:border-teal-200'
                                                }`}
                                                title={file ? t("View Subcontractor Bill") : t("Create Subcontractor Work Order / Bill")}
                                            >
                                                <DollarSign size={10} />
                                                {file ? t('💵 Sub Bill') : t('💵 + Sub Bill')}
                                            </span>
                                        );
                                    })()}

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
                                                key={`card-attached-doc-${f.id || idx}`}
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
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black text-gray-400">{t("Unit/System")}</label>
                                    <p className="text-xs font-bold text-blue-600 truncate">{job.hvacBrand || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black text-gray-400">{t("Time")}</label>
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {new Date(job.appointmentTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {previousVisitJob && (
                                        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                                            <span className="text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-0.5">
                                                <RotateCcw size={9} /> Follow-Up To
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setViewingJob(previousVisitJob)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
                                                title={`View details for previous visit JOB-${previousVisitJob.id.replace('job-', '')}`}
                                            >
                                                <Briefcase size={10} />
                                                <span>JOB-{previousVisitJob.id.replace('job-', '')}</span>
                                                {previousVisitJob.appointmentTime && (
                                                    <span className="font-normal opacity-80">
                                                        ({new Date(previousVisitJob.appointmentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })})
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                                <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">{t("Actions")}:</span>
                                    
                                    <button
                                        onClick={async () => {
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
                                        }}
                                        className={`flex items-center gap-1.5 px-2 py-1 border rounded-md text-[11px] font-bold shadow-xs transition-colors ${
                                            job.archived
                                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                                : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-100/80'
                                        }`}
                                        title={job.archived ? "Restore job to active board" : "Take off board without deleting"}
                                    >
                                        <Archive size={13} />
                                        {job.archived ? t("Restore") : t("Take Off Board")}
                                    </button>

                                    <button 
                                        onClick={() => setEditingFullJob(job)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 transition-colors font-bold shadow-xs"
                                        title={t("Edit Appointment Details")}
                                    >
                                        <Edit size={13} />
                                        {t("Edit")}
                                    </button>

                                    {job.jobStatus === 'Needs Follow-up' && (
                                        <button 
                                            onClick={() => setFollowUpParentJob(job)} 
                                            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 transition-colors font-bold shadow-xs"
                                            title={t("Schedule Return Visit")}
                                        >
                                            <CalendarPlus size={13} />
                                            {t("Return Visit")}
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => setEmailJob(job)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 transition-colors font-bold shadow-xs"
                                        title={t("Send Email to Customer")}
                                    >
                                        <Mail size={13} />
                                        {t("Send Email")}
                                    </button>

                                    <button 
                                        onClick={() => openSmsModal(job)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-md text-[11px] text-sky-700 dark:text-sky-300 hover:bg-sky-100/80 transition-colors font-bold shadow-xs"
                                        title={t("SMS Customer")}
                                    >
                                        <MessageSquare size={13} />
                                        {t("SMS")}
                                    </button>

                                    <button 
                                        onClick={() => openNotesModal(job)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 transition-colors font-bold shadow-xs"
                                        title={t("Internal Notes")}
                                    >
                                        <AlignLeft size={13} />
                                        {t("Notes")}
                                    </button>

                                    <button 
                                        onClick={() => setLinkingJob(job)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 rounded-md text-[11px] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/80 transition-colors font-bold shadow-xs"
                                        title={t("View & Associate Documents, Proposals, Invoices, Files & Jobs")}
                                    >
                                        <Link2 size={13} />
                                        {t("Associations")}
                                    </button>

                                    {isSubcontractor && (
                                        <button 
                                            onClick={() => setViewingWorkOrderJob(job)} 
                                            className="flex items-center gap-1.5 px-2 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 transition-colors font-bold shadow-xs"
                                            title={t("Subcontractor Work Order & Instructions")}
                                        >
                                            <FileText size={13} />
                                            {t("Work Order")}
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => handleCopyRef(job.id)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 transition-colors font-bold shadow-xs"
                                        title={t("Copy Reference")}
                                    >
                                        <Copy size={13} />
                                        {t("Copy Ref")}
                                    </button>

                                    <button 
                                        onClick={() => handleDeleteJob(job.id)} 
                                        className="flex items-center gap-1.5 px-2 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-[11px] text-red-700 dark:text-red-300 hover:bg-red-100/80 transition-colors font-bold shadow-xs"
                                        title={t("Delete Job")}
                                    >
                                        <Trash2 size={13} />
                                        {t("Delete")}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-3">
                                <select 
                                    aria-label={t("Assign Technician")}
                                    title={t("Assign Technician")}
                                    value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                    onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-primary-500"
                                >
                                    <option value="">{t("Assign Technician...")}</option>
                                    <optgroup label={t("Internal Technicians")}>
                                        {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                    </optgroup>
                                    <optgroup label={t("Subcontractors & Partners")}>
                                        <option value="partner:generic_subcontractor">🏢 Subcontractor (Generic / Send Details Later)</option>
                                        {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId || p.id}`}>{p.companyName} {!p.linkedOrgId ? '(Internal 1099)' : ''}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                        );
                    })
                )}
            </div>

            <Card className="hidden md:block">
                {allJobs.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-800/50 rounded-lg">
                        <Calendar size={32} className="text-gray-300 mb-4" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-200">
                            {searchTerm || customerFilter ? t("No Matching Results") : t("No Active Jobs")}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {searchTerm || customerFilter 
                                ? t("Try adjusting your search query or customer filter.") 
                                : t("Your dispatch board is clear. Time to book some calls!")}
                        </p>
                    </div>
                ) : (
                    <Table headers={[t('Customer & Site Location'), t('Appointment & Site Visit'), t('Invoice & Doc Status'), t('Linked Documents'), t('Status & Assignment')]}>
                        {(allJobs as Job[]).map((job: Job) => {
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

                            const allKnownJobs = [...(state.jobs || []), ...((state as any).historicalJobs || (state as any).archivedJobs || [])];
                            const previousVisitJob = (() => {
                                const prevId = job.parentJobId || (job as any).previousJobId || (job as any).followUpOfJobId || (job as any).relatedJobId;
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

                            const matchReason = searchTerm.trim() ? getJobSearchMatchReason(job, customer, relatedProposals, searchTerm) : null;

                            return (
                                <tbody key={job.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                                    <tr id={`job-card-${job.id}`} className={`${job.assignedPartnerId === state.currentOrganization?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-sm">
                                            <div className="flex flex-col gap-1 max-w-[220px]">
                                                {matchReason && (
                                                    <div className="mb-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 flex flex-col gap-0.5 text-xs text-amber-950 dark:text-amber-100 shadow-xs">
                                                        <span className="font-black uppercase text-[8px] tracking-wider text-amber-800 dark:text-amber-300">
                                                            Matched {matchReason.label}
                                                        </span>
                                                        <span className="font-bold truncate text-[10px] text-amber-950 dark:text-amber-100">
                                                            <HighlightText text={matchReason.value} query={searchTerm} />
                                                        </span>
                                                    </div>
                                                )}
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const targetCustId = job.customerId || customer?.id || state.customers.find(c => c.name?.toLowerCase().trim() === payingCustomerName.toLowerCase().trim())?.id;
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
                                                    <span className="text-slate-900 dark:text-white font-black text-xs tracking-tight block truncate group-hover/cust:text-primary-600 dark:group-hover/cust:text-primary-400 group-hover/cust:underline" title={payingCustomerName}>
                                                        <HighlightText text={payingCustomerName} query={searchTerm} />
                                                    </span>
                                                </div>

                                                {(siteLocationName || siteAddress) && (
                                                    <div 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAuditLocationTarget({
                                                                customerId: job.customerId,
                                                                locationId: job.locationId || loc?.id || 'default'
                                                            });
                                                        }}
                                                        className="pt-0.5 border-t border-slate-100 dark:border-slate-800 cursor-pointer group/loc hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 p-1 -mx-1 rounded-lg transition-colors"
                                                        title="Click to view all work history, jobs & documents for this site location"
                                                    >
                                                        <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1 group-hover/loc:underline">
                                                            <MapPin size={9} /> Site Location ↗
                                                        </span>
                                                        {siteLocationName && siteLocationName !== payingCustomerName && (
                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate group-hover/loc:text-indigo-600" title={siteLocationName}>
                                                                <HighlightText text={siteLocationName} query={searchTerm} />
                                                            </span>
                                                        )}
                                                        {siteAddress && (
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block truncate group-hover/loc:text-indigo-600" title={siteAddress}>
                                                                <HighlightText text={siteAddress} query={searchTerm} />
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {relatedProposals.length > 0 && (
                                                    <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter mt-0.5">
                                                        <FileText size={10} /> {relatedProposals.length > 1 ? `${relatedProposals.length} ${t("Linked Proposals")}` : t("Linked Proposal")}
                                                    </div>
                                                )}
                                                {job.assignedPartnerId === state.currentOrganization?.id && <span className="text-[10px] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-1 rounded bg-white dark:bg-slate-800 inline-block w-max">{t("Assigned to You")}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-1 min-w-[160px]">
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Scheduled Appt</span>
                                                    <input 
                                                        type="datetime-local" 
                                                        aria-label={t("Appointment Time")} 
                                                        title={t("Appointment Time")} 
                                                        value={formatDateTimeForInput(job.appointmentTime)} 
                                                        onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())} 
                                                        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs rounded p-1 focus:ring-1 focus:ring-primary-500 font-bold"
                                                    />
                                                </div>
                                                {(formattedIn || formattedOut || formattedDuration) ? (
                                                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                                        <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                                                            <Clock size={9} /> Site Visit
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                            {formattedIn && <span className="text-emerald-700 dark:text-emerald-400">In: {formattedIn}</span>}
                                                            {formattedOut && <span className="text-slate-600 dark:text-slate-400">Out: {formattedOut}</span>}
                                                            {formattedIn && !formattedOut && <span className="text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase animate-pulse">In Progress</span>}
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

                                                {previousVisitJob && (
                                                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                                        <span className="text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                                                            <RotateCcw size={9} /> Follow-Up To
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingJob(previousVisitJob);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors w-max"
                                                            title={`View details for previous visit JOB-${previousVisitJob.id.replace('job-', '')}`}
                                                        >
                                                            <Briefcase size={10} />
                                                            <span>JOB-{previousVisitJob.id.replace('job-', '')}</span>
                                                            {previousVisitJob.appointmentTime && (
                                                                <span className="font-normal opacity-80">
                                                                    ({new Date(previousVisitJob.appointmentTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })})
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-1 max-w-[210px]">
                                                {/* Payment Status & Deposit / Partial Payment Breakdown */}
                                                {(() => {
                                                    const inv = job.invoice || (job as any).financials || {};
                                                    const totalAmount = Number(inv.totalAmount || inv.amount || job.totalCost || job.estimatedCost || job.quoteAmount || 0);

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
                                                                    {isFullyPaid ? `✓ Paid${totalAmount > 0 ? ` ($${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}` :
                                                                     isPartiallyPaid ? `Partially Paid` :
                                                                     totalAmount > 0 ? `Unpaid ($${remainingUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` :
                                                                     inv.status || 'No Invoice'}
                                                                </span>
                                                            </div>

                                                            {/* Deposit or Partial Payment Breakdown */}
                                                            {isPartiallyPaid ? (
                                                                <div className="flex flex-col gap-0.5 text-[10px] bg-blue-50/80 dark:bg-blue-950/40 p-1.5 rounded-md border border-blue-200/60 dark:border-blue-800/50 my-0.5 shadow-xs">
                                                                    <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-bold">
                                                                        <span>{isDepositPaid ? 'Deposit Paid:' : 'Paid To Date:'}</span>
                                                                        <span>${amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-black">
                                                                        <span>Unpaid Balance:</span>
                                                                        <span>${remainingUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    {totalAmount > 0 && (
                                                                        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[9px] pt-0.5 border-t border-blue-200/50 dark:border-blue-800/50">
                                                                            <span>Total Invoice:</span>
                                                                            <span>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : !isFullyPaid && totalAmount > 0 && depositAmount > 0 && (
                                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block truncate">
                                                                    Deposit Req: ${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            )}

                                                            {/* Payment date / method detail */}
                                                            {isFullyPaid && (inv.paidDate || inv.paymentMethod) && (
                                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate">
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

                                                    {/* ALL Linked Proposals with Sent Dates & Status */}
                                                    {relatedProposals.map((p: any) => {
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

                                                    {/* Sign-off Sheet Completion */}
                                                    {(job.files || []).some((f: any) => 
                                                        f.fileName === 'SignOff_Sheet.html' || 
                                                        f.fileName?.toLowerCase().includes('signoff') ||
                                                        f.fileName?.toLowerCase().includes('sign-off') ||
                                                        f.metadata?.label === 'Sign-Off Sheet' ||
                                                        f.metadata?.label?.toLowerCase().includes('sign-off') ||
                                                        f.category === 'signoff' ||
                                                        f.id?.startsWith('signoff-doc')
                                                    ) && !job.jobRecordSignedOffAt && (
                                                        <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                                                            <ShieldCheck size={10} className="text-emerald-500 shrink-0" />
                                                            <span>Sign-off Sheet: <strong className="font-bold text-emerald-700 dark:text-emerald-400">Attached</strong></span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                                                {/* Proposal Badges or Create Button */}
                                                {relatedProposals.length > 0 ? (
                                                    relatedProposals.map((proposal: any) => {
                                                        const displayId = resolveDocumentDisplayId('proposal', proposal).id;
                                                        return (
                                                            <span 
                                                                key={`tbl-prop-${proposal.id}`}
                                                                onClick={() => setViewingProposal(proposal)}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors shadow-xs"
                                                                title={proposal.title || `Proposal ${displayId}`}
                                                            >
                                                                <Briefcase size={10} />
                                                                <HighlightText text={displayId} query={searchTerm} />
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
                                                        <HighlightText 
                                                            text={job.invoice.id || job.invoice.invoiceNumber || job.invoice.number ? `INV-${String(job.invoice.id || job.invoice.invoiceNumber || job.invoice.number).replace(/^INV-?/i, '')}` : `INV-${job.jobNumber || String(job.id).replace(/^job-?/i, '')}`} 
                                                            query={searchTerm} 
                                                        />
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

                                                {/* Linked Invoices if any (excluding current job's primary invoice) */}
                                                {Array.isArray((job as any).linkedInvoiceIds) && (job as any).linkedInvoiceIds
                                                    .filter((linkInvId: string) => {
                                                        if (!linkInvId) return false;
                                                        const currentInv = job.invoice;
                                                        if (!currentInv) return true;
                                                        const mainId = currentInv.id || currentInv.invoiceNumber || currentInv.number;
                                                        const normalizedMain = mainId ? `INV-${String(mainId).replace(/^INV-?/i, '')}` : '';
                                                        const normalizedLink = `INV-${String(linkInvId).replace(/^INV-?/i, '')}`;
                                                        return normalizedMain !== normalizedLink && linkInvId !== currentInv.id && linkInvId !== currentInv.invoiceNumber;
                                                    })
                                                    .map((linkInvId: string) => (
                                                    <span 
                                                        key={`tbl-linkinv-${linkInvId}`}
                                                        onClick={() => setViewingInvoiceJob(job)}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 cursor-pointer hover:bg-teal-100 transition-colors shadow-xs"
                                                        title={`Linked Invoice ${linkInvId}`}
                                                    >
                                                        <DollarSign size={10} />
                                                        <HighlightText text={linkInvId} query={searchTerm} />
                                                    </span>
                                                ))}

                                                {/* Work Order Badge or Create Button */}
                                                {poNumber ? (
                                                    <span 
                                                        onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                                        title={t("View Work Order Associations")}
                                                    >
                                                        <Briefcase size={10} />
                                                        <HighlightText text={`WO: ${poNumber}`} query={searchTerm} />
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
                                                    const file = (job.files || []).find((f: any) => 
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
                                                    const hasSignOff = !!(file || job.signOff || job.signOffSheetUrl || job.customerSignature || job.signature);
                                                    return (
                                                        <div className="inline-flex items-center rounded border border-amber-200 dark:border-amber-800/60 overflow-hidden shadow-xs">
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    if (file) {
                                                                        setPreviewOtherDoc({ ...file, type: 'Other', title: t('Sign-Off Sheet') });
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
                                                {(() => {
                                                    const file = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                                                    return (
                                                        <span 
                                                            onClick={() => {
                                                                if (file) {
                                                                    setPreviewOtherDoc({ ...file, type: 'Other', title: t('Subcontractor Bill') });
                                                                } else {
                                                                    setViewingWorkOrderJob(job);
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-xs ${
                                                                file 
                                                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-800/50 hover:bg-teal-100' 
                                                                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 hover:border-teal-200'
                                                            }`}
                                                            title={file ? t("View Subcontractor Bill") : t("Create Subcontractor Work Order / Bill")}
                                                        >
                                                            <DollarSign size={10} />
                                                            {file ? t('💵 Sub Bill') : t('💵 + Sub Bill')}
                                                        </span>
                                                    );
                                                })()}

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
                                        <td className="px-4 py-3 whitespace-nowrap">
                                             <div className="flex flex-col gap-1.5 min-w-[150px]">
                                                 <div>
                                                     <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Status</span>
                                                     <select 
                                                         aria-label={t("Update Job Status")} 
                                                         title={t("Update Job Status")} 
                                                         value={job.jobStatus} 
                                                         onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} 
                                                         className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded p-1 w-full focus:ring-1 focus:ring-primary-500 font-bold"
                                                     >
                                                         <option value="Scheduled">{t("Scheduled")}</option>
                                                         <option value="In Progress">{t("In Progress")}</option>
                                                         <option value="Completed">{t("Completed")}</option>
                                                         <option value="Needs Follow-up">{t("Needs Follow-up")}</option>
                                                         <option value="Cancelled">{t("Cancelled")}</option>
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Assigned Tech</span>
                                                     <select 
                                                         aria-label={t("Assign Technician")}
                                                         title={t("Assign Technician")}
                                                         value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                                         onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                                         className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded p-1 w-full focus:ring-1 focus:ring-primary-500"
                                                     >
                                                         <option value="">{t("Unassigned")}</option>
                                                         <optgroup label={t("Internal Technicians")}>
                                                             {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                                         </optgroup>
                                                         <optgroup label={t("Subcontractors & Partners")}>
                                                             <option value="partner:generic_subcontractor">🏢 Subcontractor (Generic)</option>
                                                             {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId || p.id}`}>{p.companyName} {!p.linkedOrgId ? '(Internal 1099)' : ''}</option>)}
                                                         </optgroup>
                                                     </select>
                                                 </div>
                                                 <button 
                                                     onClick={() => openCrewModal(job)} 
                                                     className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors w-max flex items-center gap-1 mt-0.5"
                                                 >
                                                     <Users size={11} /> {t("Crew")} ({job.assistants?.length || 0})
                                                 </button>
                                             </div>
                                         </td>
                                     </tr>
                                     <tr className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                         <td colSpan={5} className="px-4 py-2 border-t-0">
                                             <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                                 <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">{t("Actions")}:</span>
                                                 
                                                 <button
                                                     onClick={async () => {
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
                                                     }}
                                                     className={`flex items-center gap-1.5 px-2 py-1 border rounded-md text-[11px] font-bold shadow-xs transition-colors ${
                                                         job.archived
                                                             ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                                             : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-100/80'
                                                     }`}
                                                     title={job.archived ? "Restore job to active board" : "Take off board without deleting"}
                                                 >
                                                     <Archive size={13} />
                                                     {job.archived ? t("Restore") : t("Take Off Board")}
                                                 </button>

                                                 <button 
                                                     onClick={() => setEditingFullJob(job)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("Edit Appointment Details")}
                                                 >
                                                     <Edit size={13} />
                                                     {t("Edit")}
                                                 </button>

                                                 {job.jobStatus === 'Needs Follow-up' && (
                                                     <button 
                                                         onClick={() => setFollowUpParentJob(job)} 
                                                         className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 transition-colors font-bold shadow-xs"
                                                         title={t("Schedule Return Visit")}
                                                     >
                                                         <CalendarPlus size={13} />
                                                         {t("Return Visit")}
                                                     </button>
                                                 )}

                                                 <button 
                                                     onClick={() => setEmailJob(job)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("Send Email to Customer")}
                                                 >
                                                     <Mail size={13} />
                                                     {t("Send Email")}
                                                 </button>

                                                 <button 
                                                     onClick={() => openSmsModal(job)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-md text-[11px] text-sky-700 dark:text-sky-300 hover:bg-sky-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("SMS Customer")}
                                                 >
                                                     <MessageSquare size={13} />
                                                     {t("SMS")}
                                                 </button>

                                                 <button 
                                                     onClick={() => openNotesModal(job)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("Internal Notes")}
                                                 >
                                                     <AlignLeft size={13} />
                                                     {t("Notes")}
                                                 </button>

                                                 <button 
                                                     onClick={() => setLinkingJob(job)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 rounded-md text-[11px] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("View & Associate Documents, Proposals, Invoices, Files & Jobs")}
                                                 >
                                                     <Link2 size={13} />
                                                     {t("Associations")}
                                                 </button>

                                                 {isSubcontractor && (
                                                     <button 
                                                         onClick={() => setViewingWorkOrderJob(job)} 
                                                         className="flex items-center gap-1.5 px-2 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 transition-colors font-bold shadow-xs"
                                                         title={t("Subcontractor Work Order & Instructions")}
                                                     >
                                                         <FileText size={13} />
                                                         {t("Work Order")}
                                                     </button>
                                                 )}

                                                 <button 
                                                     onClick={() => handleCopyRef(job.id)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("Copy Reference")}
                                                 >
                                                     <Copy size={13} />
                                                     {t("Copy Ref")}
                                                 </button>

                                                 <button 
                                                     onClick={() => handleDeleteJob(job.id)} 
                                                     className="flex items-center gap-1.5 px-2 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-[11px] text-red-700 dark:text-red-300 hover:bg-red-100/80 transition-colors font-bold shadow-xs"
                                                     title={t("Delete Job")}
                                                 >
                                                     <Trash2 size={13} />
                                                     {t("Delete")}
                                                 </button>
                                             </div>
                                         </td>
                                     </tr>
                                </tbody>
                            );
                        })}
                    </Table>
                )}
            </Card>
            {previewDoc && (
                <DocumentPreview 
                    type="Other" 
                    data={previewDoc} 
                    onClose={() => setPreviewDoc(null)} 
                    isInternal={true}
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
            {viewingJob && (
                <JobDetailModal 
                    isOpen={!!viewingJob} 
                    onClose={() => setViewingJob(null)} 
                    job={viewingJob} 
                    isAdmin={true}
                />
            )}
            {viewingWorkOrderJob && (
                <SubcontractorWorkOrderModal 
                    isOpen={!!viewingWorkOrderJob} 
                    onClose={() => setViewingWorkOrderJob(null)} 
                    job={viewingWorkOrderJob} 
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
                    customerId={emailJob.customerId}
                    recipientEmail={emailJob.customerEmail}
                    recipientName={emailJob.customerName}
                    mode="email"
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
                            showToast.success(t("Sign-off sheet saved successfully!"));
                        } catch (err) {
                            console.error("Error saving sign-off", err);
                        }
                        setActiveSignOffJob(null);
                    }}
                />
            )}
            <LocationAuditModal
                isOpen={!!auditLocationTarget}
                onClose={() => setAuditLocationTarget(null)}
                customerId={auditLocationTarget?.customerId}
                locationId={auditLocationTarget?.locationId}
            />
            {selectedCustomerMasterId && (
                <CustomerMasterModal
                    isOpen={true}
                    onClose={() => setSelectedCustomerMasterId(null)}
                    customerId={selectedCustomerMasterId}
                />
            )}
        </div>
    );
};

export default JobScheduling;
