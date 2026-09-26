
import React, { useState, useEffect, useMemo, useRef } from 'react';
import IoTDiagnosticsViewer from '../features/IoTDiagnosticsViewer';
import CompanyCamGallery from '../features/CompanyCamGallery';
import Modal from '../ui/Modal';
import { 
    Calendar, MapPin, Clock, CheckCircle, Package, 
    ShieldCheck, FileText, Droplets, 
    Thermometer, Wrench, DollarSign, Printer, Download,
    Check, Shield, Trash2, ChevronUp, ChevronDown, Mail, Heart, Info, Eye, Edit,
    CalendarPlus, Users, Link2, Send, Archive, ShieldAlert, CheckCircle2, Camera, Phone, AlertTriangle, Compass, ExternalLink
} from 'lucide-react';
import { Job, Proposal, DiagnosticReport } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import { db, functions } from '../../lib/firebase';
import firebase from 'firebase/compat/app';
import DocumentPreview from '../ui/DocumentPreview';
import { useAppContext } from '../../context/AppContext';
import { sendEmail } from '../../lib/notificationService';
import showToast from '../../lib/toast';
import { cleanUndefinedFields, formatDisplayId, hasPermission, safeFormatDateTimeString, safeFormatDateString, safeFormatTimeString, formatFullAddress, getAddressLines, isInternalExpenseFile, isFilePhoto, resolveServiceLocation, checkJobHasVerifiedEquipmentSerial, resolveSiteLocationName } from '../../lib/utils';
import { extractJobSlug } from '../../lib/numbering';
import { generateJobReportPdfAttachment, generateJobReportHtml, generateInvoicePdfAttachment, EmailAttachment, getStandardPdfFilename, downloadStandaloneSignOffPdf } from '../../lib/pdfHelper';
import JobAppointmentModal from './JobAppointmentModal';
import JobLinkingModal from './JobLinkingModal';
import DigitalSignatureStamp from '../ui/DigitalSignatureStamp';
import { PrintableFormPreviewModal } from './PrintableFormPreviewModal';
import { globalConfirm } from '../../lib/globalConfirm';
import SubcontractorWorkOrderModal from './SubcontractorWorkOrderModal';
import { isValidPoNumber } from '../../lib/linkedJobsHelper';
import OneClickCheckInWidget from '../ui/OneClickCheckInWidget';
import CommercialWorkOrderProcessGuide from '../ui/CommercialWorkOrderProcessGuide';
import { getJobTimeSummary, formatDateTimeForInput } from '../../lib/jobTimeHelper';


import LocationAuditModal from './LocationAuditModal';
import UnitWorkModal from '../../pages/briefing/components/UnitWorkModal';
import SendEmailModal from './SendEmailModal';
import IssueWarrantyModal from './IssueWarrantyModal';
import SubcontractorChargebackModal from './SubcontractorChargebackModal';
import type { Subcontractor } from '../../types';

interface JobDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    isAdmin?: boolean;
    onEditInvoice?: () => void;
    onEditRecord?: () => void;
    isReviewMode?: boolean;
    onSignOffJobRecord?: (signedOffBy: string, notes?: string) => void;
    isJobRecordSignedOff?: boolean;
}

interface ExtendedFile {
    id?: string;
    dataUrl?: string;
    url?: string;
    fileUrl?: string;
    label?: string;
    contentType?: string;
    fileType?: string;
    metadata?: { label?: string; category?: string };
    type?: string;
    fileName?: string;
    createdAt?: string | number;
}

const normalizeUnitStates = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') {
        return Object.entries(raw).map(([key, val]) => {
            if (val && typeof val === 'object') {
                return { assetId: key, ...(val as any) };
            }
            return { assetId: key, health: val, healthBefore: val };
        });
    }
    return [];
};

const extractJobNotes = (targetJob: any): Record<string, string> => {
    if (!targetJob) return {};
    const rawNotes = targetJob.notes;
    const initialNotes: Record<string, string> = typeof rawNotes === 'object' && rawNotes !== null ? { ...rawNotes } : {};
    if (typeof rawNotes === 'string' && rawNotes && !initialNotes.work && !initialNotes.workNotes) {
        initialNotes.work = rawNotes;
        initialNotes.workNotes = rawNotes;
    }
    if (targetJob.arrivalNotes && !initialNotes.arrival) initialNotes.arrival = targetJob.arrivalNotes;
    if ((targetJob.diagnosisNotes || targetJob.diagnosis) && !initialNotes.diagnosis) initialNotes.diagnosis = targetJob.diagnosisNotes || targetJob.diagnosis;
    if ((targetJob.workNotes || targetJob.workPerformedNotes) && !initialNotes.work) {
        initialNotes.work = targetJob.workNotes || targetJob.workPerformedNotes;
        initialNotes.workNotes = targetJob.workNotes || targetJob.workPerformedNotes;
    }
    if (targetJob.completionNotes && !initialNotes.completion) initialNotes.completion = targetJob.completionNotes;
    if (targetJob.customerFeedback && !initialNotes.customerFeedback) initialNotes.customerFeedback = targetJob.customerFeedback;
    if ((targetJob.employeeFeedback || targetJob.technicianNotes || targetJob.internalNotes) && !initialNotes.employeeFeedback) {
        const fb = targetJob.employeeFeedback || targetJob.technicianNotes || targetJob.internalNotes;
        initialNotes.employeeFeedback = fb;
        initialNotes.feedback = fb;
    }
    return initialNotes;
};

const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
    isOpen, onClose, job, isAdmin, 
    onEditInvoice, onEditRecord,
    isReviewMode, onSignOffJobRecord, isJobRecordSignedOff
}) => {
    const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Record<string, unknown> | null>(null);
    const [diagnostics, setDiagnostics] = useState<DiagnosticReport[]>([]);
    const [deletedFiles, setDeletedFiles] = useState<Set<string>>(new Set());
    const [isRefunding, setIsRefunding] = useState(false);
    const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({});
    const [isPropertyExpanded, setIsPropertyExpanded] = useState(false);
    const [isLocationAuditOpen, setIsLocationAuditOpen] = useState(false);
    const [selectedAssetForAssessment, setSelectedAssetForAssessment] = useState<any | null>(null);
    const { state, dispatch } = useAppContext();
    const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isPrintingTechSheet, setIsPrintingTechSheet] = useState(false);
    const [isSendSubcontractorModalOpen, setIsSendSubcontractorModalOpen] = useState(false);
    const [isChargebackModalOpen, setIsChargebackModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'technical' | 'preview'>('technical');
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localNotes, setLocalNotes] = useState<any>({});
    const [localUnitStates, setLocalUnitStates] = useState<any[]>([]);
    const [localFiles, setLocalFiles] = useState<any[]>([]);
    const [localTechRecs, setLocalTechRecs] = useState<string>('');
    const [localSubcontractorPhone, setLocalSubcontractorPhone] = useState<string>('');
    const [selectedPropToLink, setSelectedPropToLink] = useState('');
    const [selectedJobToLink, setSelectedJobToLink] = useState('');
    const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
    const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);

    const currentJob = useMemo(() => {
        return (state.jobs || []).find((j: any) => j.id === job?.id) || job;
    }, [state.jobs, job]);

    const timeSummary = useMemo(() => {
        return getJobTimeSummary(currentJob);
    }, [currentJob]);

    const [isEditingTimes, setIsEditingTimes] = useState(false);
    const [editCheckIn, setEditCheckIn] = useState('');
    const [editCheckOut, setEditCheckOut] = useState('');
    const [editTimeOnSite, setEditTimeOnSite] = useState<number | ''>('');
    const [isSavingTimes, setIsSavingTimes] = useState(false);

    const handleOpenTimeEditor = () => {
        setEditCheckIn(timeSummary.checkInTime ? formatDateTimeForInput(timeSummary.checkInTime) : (currentJob?.appointmentTime ? formatDateTimeForInput(currentJob.appointmentTime) : ''));
        setEditCheckOut(timeSummary.checkOutTime ? formatDateTimeForInput(timeSummary.checkOutTime) : '');
        setEditTimeOnSite(timeSummary.timeOnSiteMinutes ?? '');
        setIsEditingTimes(true);
    };

    const handleSaveTimeCorrections = async () => {
        if (!currentJob) return;
        setIsSavingTimes(true);
        try {
            const checkInIso = editCheckIn ? new Date(editCheckIn).toISOString() : null;
            const checkOutIso = editCheckOut ? new Date(editCheckOut).toISOString() : null;
            const timeOnSite = editTimeOnSite !== '' ? Number(editTimeOnSite) : null;

            const updatedEntries = [...(currentJob.timeEntries || [])];
            if (updatedEntries.length > 0) {
                const lastIdx = updatedEntries.length - 1;
                updatedEntries[lastIdx] = {
                    ...updatedEntries[lastIdx],
                    checkInTime: checkInIso || updatedEntries[lastIdx].checkInTime,
                    checkOutTime: checkOutIso || null,
                    timeOnSiteMinutes: timeOnSite !== null ? timeOnSite : null
                };
            } else if (checkInIso) {
                updatedEntries.push({
                    checkInTime: checkInIso,
                    checkOutTime: checkOutIso || null,
                    timeOnSiteMinutes: timeOnSite !== null ? timeOnSite : null
                });
            }

            const totalMins = updatedEntries.reduce((acc, entry) => acc + (entry.timeOnSiteMinutes || 0), 0) || (timeOnSite || 0);

            const updates: any = {
                checkInTime: checkInIso || firebase.firestore.FieldValue.delete(),
                checkOutTime: checkOutIso || firebase.firestore.FieldValue.delete(),
                timeOnSiteMinutes: totalMins > 0 ? totalMins : firebase.firestore.FieldValue.delete(),
                timeEntries: updatedEntries.length > 0 ? updatedEntries : firebase.firestore.FieldValue.delete()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(currentJob.id).update(updates);
            }

            const updatedJob = {
                ...currentJob,
                checkInTime: checkInIso || undefined,
                checkOutTime: checkOutIso || undefined,
                timeOnSiteMinutes: totalMins > 0 ? totalMins : undefined,
                timeEntries: updatedEntries
            };

            dispatch({ type: 'UPDATE_JOB', payload: updatedJob as Job });
            showToast.success('In & Out times updated successfully');
            setIsEditingTimes(false);
        } catch (err: any) {
            console.error('Failed to update in/out times:', err);
            showToast.error('Failed to save in/out times');
        } finally {
            setIsSavingTimes(false);
        }
    };

    const assignedSub = useMemo(() => {
        if (!currentJob) return null;
        const subId = (currentJob as any)?.subcontractorId || (currentJob as any)?.assignedPartnerId || currentJob.subcontractorWorkOrder?.subcontractorId;
        if (!subId) return null;
        return state.subcontractors?.find((s: any) => s.id === subId) || {
            id: subId,
            companyName: (currentJob as any)?.subcontractorName || (currentJob.subcontractorWorkOrder as any)?.subcontractorName || 'Assigned Subcontractor',
            email: (currentJob as any)?.subcontractorEmail || '',
            trade: 'Subcontractor'
        } as Subcontractor;
    }, [currentJob, state.subcontractors]);

    const poNumber = currentJob?.poNumber || currentJob?.workOrderNumber || currentJob?.invoice?.poNumber;

    const isValidRefNum = (num?: string) => {
        if (!num) return false;
        const clean = String(num).trim().toLowerCase();
        return clean !== '' && clean !== 'n/a' && clean !== 'none' && clean !== 'null' && clean !== 'undefined' && clean !== '0';
    };

    const linkedProposals = useMemo(() => {
        if (!currentJob) return [];
        return (state.proposals || []).filter((p: any) => 
            p.id === currentJob.proposalId || 
            p.id === currentJob.projectId || 
            p.jobId === currentJob.id ||
            currentJob.linkedProposalIds?.includes(p.id) || 
            p.linkedJobIds?.includes(currentJob.id) ||
            (isValidRefNum(poNumber) && p.customerId === currentJob.customerId && ((isValidRefNum(p.poNumber) && p.poNumber.trim().toLowerCase() === String(poNumber).trim().toLowerCase()) || (isValidRefNum(p.workOrderNumber) && p.workOrderNumber.trim().toLowerCase() === String(poNumber).trim().toLowerCase())))
        );
    }, [state.proposals, currentJob, poNumber]);

    const availableProposals = useMemo(() => {
        if (!currentJob) return [];
        return (state.proposals || []).filter((p: any) => 
            p.customerId === currentJob.customerId && 
            !linkedProposals.some((lp: any) => lp.id === p.id)
        );
    }, [state.proposals, currentJob, linkedProposals]);

    const linkedJobs = useMemo(() => {
        if (!currentJob) return [];
        const jobLocId = currentJob.locationId || currentJob.propertyId || currentJob.location?.id;
        return (state.jobs || []).filter((j: any) => {
            if (j.id === currentJob.id) return false;
            const jLocId = j.locationId || j.propertyId || j.location?.id;
            const isLocationMatch = !jobLocId || !jLocId || jobLocId === jLocId;
            if (!isLocationMatch) return false;

            return (
                currentJob.linkedJobIds?.includes(j.id) || 
                j.linkedJobIds?.includes(currentJob.id) ||
                j.parentJobId === currentJob.id ||
                (currentJob.parentJobId && j.id === currentJob.parentJobId) ||
                (currentJob.parentJobId && j.parentJobId === currentJob.parentJobId) ||
                (poNumber && isValidPoNumber(poNumber) && j.customerId === currentJob.customerId && (j.poNumber === poNumber || j.workOrderNumber === poNumber || j.invoice?.poNumber === poNumber))
            );
        });
    }, [state.jobs, currentJob, poNumber]);

    const availableJobs = useMemo(() => {
        if (!currentJob) return [];
        return (state.jobs || []).filter((j: any) => 
            j.id !== currentJob.id &&
            j.customerId === currentJob.customerId &&
            !linkedJobs.some((lj: any) => lj.id === j.id)
        );
    }, [state.jobs, currentJob, linkedJobs]);

    const linkedInvoices = useMemo(() => {
        const invoiceIds = job?.linkedInvoiceIds || [];
        return (state.jobs || [])
            .filter((j: any) => j.invoice && invoiceIds.includes(j.invoice.id))
            .map((j: any) => ({
                job: j,
                invoice: j.invoice!
            }));
    }, [state.jobs, job?.linkedInvoiceIds]);

    useEffect(() => {
        if (job) {
            setLocalNotes(extractJobNotes(job));
            setLocalTechRecs(job.techRecommendations || job.recommendations || '');
            setLocalUnitStates(normalizeUnitStates(job.unitStates));
            setLocalSubcontractorPhone((job as any).subcontractorPhone || job.subcontractorWorkOrder?.customSubPhone || '');
            
            const combinedFiles = [...(job.files || [])];

            // Ingest direct job photo arrays
            const directPhotoArrays = [
                { items: job.photos || job.images, defaultLabel: 'Job Photo', defaultPhase: '' },
                { items: job.beforePhotos, defaultLabel: 'Before Repair Photo', defaultPhase: 'before' },
                { items: job.afterPhotos, defaultLabel: 'After Repair Photo', defaultPhase: 'after' }
            ];

            directPhotoArrays.forEach(arr => {
                if (arr.items && Array.isArray(arr.items)) {
                    arr.items.forEach((p: any, pIdx: number) => {
                        const url = typeof p === 'string' ? p : (p?.dataUrl || p?.url || p?.fileUrl);
                        if (url && !combinedFiles.some((f: any) => (f.dataUrl || f.url || f.fileUrl) === url)) {
                            combinedFiles.push({
                                id: `photo-${job.id}-${pIdx}-${Math.random().toString(36).substring(2, 6)}`,
                                dataUrl: url,
                                url: url,
                                label: typeof p === 'object' ? (p.label || p.title || arr.defaultLabel) : arr.defaultLabel,
                                type: 'Photo',
                                fileType: 'image/jpeg',
                                metadata: {
                                    label: typeof p === 'object' ? (p.label || p.title || arr.defaultLabel) : arr.defaultLabel,
                                    phase: arr.defaultPhase || (typeof p === 'object' ? (p.phase || p.category) : '')
                                },
                                createdAt: job.appointmentTime
                            });
                        }
                    });
                }
            });

            const safeJobUnitStates = normalizeUnitStates(job.unitStates);
            if (safeJobUnitStates.length > 0) {
                safeJobUnitStates.forEach((us: any) => {
                    const usPhotos = Array.isArray(us.photos) ? us.photos : (us.photos ? [us.photos] : []);
                    const unitPhotos = [
                        { url: us.beforePhotoUrl, label: `Unit ${us.assetTag || us.assetId || us.name || us.unitName || ''} (Before Repair)`, assetId: us.assetId || us.id, phase: 'before' },
                        { url: us.afterPhotoUrl, label: `Unit ${us.assetTag || us.assetId || us.name || us.unitName || ''} (After Repair)`, assetId: us.assetId || us.id, phase: 'after' },
                        { url: us.photoUrl, label: `Unit ${us.assetTag || us.assetId || us.name || us.unitName || ''} Photo`, assetId: us.assetId || us.id },
                        ...usPhotos.map((p: any) => typeof p === 'string' ? { url: p, label: 'Unit Photo', assetId: us.assetId || us.id } : { ...p, assetId: us.assetId || us.id })
                    ];
                    unitPhotos.forEach((up: any) => {
                        if (up && up.url && !combinedFiles.some((f: any) => (f.dataUrl || f.url) === up.url)) {
                            combinedFiles.push({
                                id: `us-${job.id}-${Math.random().toString(36).substring(2, 7)}`,
                                dataUrl: up.url,
                                url: up.url,
                                label: up.label || 'Unit Photo',
                                type: 'Photo',
                                fileType: 'image/jpeg',
                                metadata: { label: up.label || 'Unit Photo', assetId: up.assetId, phase: up.phase || '' },
                                createdAt: job.appointmentTime
                            });
                        }
                    });
                });
            }

            // Include files & photos from explicitly linked jobs at the same location
            const jobLocId = job.locationId || job.propertyId || job.location?.id;
            linkedJobs.forEach((lj: any) => {
                const ljLocId = lj.locationId || lj.propertyId || lj.location?.id;
                if (!jobLocId || !ljLocId || jobLocId === ljLocId) {
                    if (lj.files && Array.isArray(lj.files)) {
                        lj.files.forEach((f: any) => {
                            if (!combinedFiles.some((existing: any) => (existing.id && existing.id === f.id) || (existing.dataUrl || existing.url) === (f.dataUrl || f.url))) {
                                combinedFiles.push({ ...f, jobId: lj.id });
                            }
                        });
                    }
                    const safeLjUnitStates = normalizeUnitStates(lj.unitStates);
                    if (safeLjUnitStates.length > 0) {
                        safeLjUnitStates.forEach((us: any) => {
                            const usPhotos = Array.isArray(us.photos) ? us.photos : (us.photos ? [us.photos] : []);
                            const unitPhotos = [
                                { url: us.beforePhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (Before Repair)`, assetId: us.assetId, phase: 'before' },
                                { url: us.afterPhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (After Repair)`, assetId: us.assetId, phase: 'after' },
                                { url: us.photoUrl, label: `Unit ${us.assetTag || us.assetId || ''} Photo`, assetId: us.assetId },
                                ...usPhotos.map((p: any) => typeof p === 'string' ? { url: p, label: 'Unit Photo', assetId: us.assetId } : { ...p, assetId: us.assetId })
                            ];
                            unitPhotos.forEach((up: any) => {
                                if (up && up.url && !combinedFiles.some((f: any) => (f.dataUrl || f.url) === up.url)) {
                                    combinedFiles.push({
                                        id: `us-${lj.id}-${Math.random().toString(36).substring(2, 7)}`,
                                        dataUrl: up.url,
                                        url: up.url,
                                        label: up.label || 'Unit Photo',
                                        type: 'Photo',
                                        fileType: 'image/jpeg',
                                        metadata: { label: up.label || 'Unit Photo', assetId: up.assetId, phase: up.phase || '' },
                                        createdAt: lj.appointmentTime
                                    });
                                }
                            });
                        });
                    }
                }
            });

            setLocalFiles(combinedFiles);
            setLocalTechRecs(job.techRecommendations || '');
        }
    }, [job, linkedJobs]);

    const customer = useMemo(() => {
        return state.customers?.find(c => c.id === job?.customerId);
    }, [state.customers, job?.customerId]);

    const serviceLocation = useMemo(() => {
        if (!customer || !job) return null;
        return resolveServiceLocation(job, customer, (state as any)?.serviceLocations);
    }, [customer, job, state.serviceLocations]);

    const jobAssets = useMemo(() => {
        if (!job) return [];
        let customerEquipment = customer?.equipment || [];
        const finalMap = new Map<string, any>();

        const getSubLocationIds = (parentId: string, locations: any[]): string[] => {
            const childIds = locations.filter(loc => loc.parentId === parentId).map(loc => loc.id);
            const nestedIds = childIds.flatMap(id => getSubLocationIds(id, locations));
            return [parentId, ...childIds, ...nestedIds];
        };

        // 1. Add customer equipment for this location IF no explicit unitStates exist on the job
        const safeJobUnits = normalizeUnitStates((currentJob || job).unitStates);
        const hasExplicitUnitStates = safeJobUnits.length > 0;
        const hasMultipleLocations = (customer?.serviceLocations?.length || 0) > 1;
        const jobLocId = job.locationId || job.serviceLocationId || job.propertyId || currentJob?.locationId;

        if (!hasExplicitUnitStates) {
            let filteredEquipment = customerEquipment;
            if (jobLocId && customer?.serviceLocations) {
                const validPropertyIds = getSubLocationIds(jobLocId, customer.serviceLocations);
                filteredEquipment = customerEquipment.filter(e => 
                    (e.propertyId && validPropertyIds.includes(e.propertyId)) || 
                    (e.locationId && validPropertyIds.includes(e.locationId)) ||
                    (!hasMultipleLocations && !e.propertyId && !e.locationId)
                );
            }
            filteredEquipment.forEach(eq => {
                if (eq && eq.id) {
                    finalMap.set(eq.id, { ...eq });
                }
            });
        }

        // 2. Add all unit states recorded directly on this job by the tech during the visit
        if (safeJobUnits.length > 0) {
            safeJobUnits.forEach((us: any, idx: number) => {
                const id = us.assetId || us.equipmentId || us.id || `unit-state-${idx}`;
                const existing = finalMap.get(id) || customerEquipment.find(ce => ce.id === id || (us.assetId && ce.id === us.assetId) || (us.assetTag && ce.assetTag === us.assetTag));
                
                const mergedUnit = {
                    ...(existing || {}),
                    id: existing?.id || id,
                    assetId: existing?.id || id,
                    name: us.name || us.unitName || us.title || existing?.name || `Serviced System #${(id || '').slice(-4).toUpperCase()}`,
                    type: us.type || us.unitType || existing?.type || 'Equipment Unit',
                    brand: us.brand || us.make || existing?.brand || 'Brand N/A',
                    model: us.model || us.modelNumber || existing?.model || '',
                    serial: us.serial || us.serialNumber || existing?.serial || 'N/A',
                    assetTag: us.assetTag || existing?.assetTag || `Tag: #${(id || '').slice(-4).toUpperCase()}`,
                    servesArea: us.servesArea || existing?.servesArea,
                    exactPlacement: us.exactPlacement || existing?.exactPlacement,
                    physicalLocation: us.physicalLocation || existing?.physicalLocation,
                    tonnage: us.tonnage || us.tons || existing?.tonnage,
                    refrigerantType: us.refrigerant || us.refrigerantType || existing?.refrigerantType,
                    electricityType: us.electricityType || existing?.electricityType,
                    heatType: us.heatType || existing?.heatType,
                    year: us.year || us.yearBuilt || existing?.year,
                    installDate: us.installDate || existing?.installDate,
                    condition: us.healthAfter || us.health || us.healthBefore || existing?.condition || 'Good',
                    serialPhotoUrl: us.serialPhotoUrl || us.unitTagPhotoUrl || us.platePhotoUrl || existing?.serialPhotoUrl,
                    unitTagPhotoUrl: us.unitTagPhotoUrl || existing?.unitTagPhotoUrl,
                    conditionPhotoUrl: us.conditionPhotoUrl || existing?.conditionPhotoUrl,
                    notes: us.notes || us.technicianNotes || existing?.notes
                };

                finalMap.set(mergedUnit.id, mergedUnit);
            });
        }

        // 3. Check any files with assetId metadata to make sure those assets are also present
        if (job.files && Array.isArray(job.files)) {
            job.files.forEach((f: any) => {
                const fileAssetId = f.metadata?.assetId || f.assetId;
                if (fileAssetId && !finalMap.has(fileAssetId)) {
                    const custEq = customerEquipment.find(ce => ce.id === fileAssetId);
                    if (custEq) {
                        finalMap.set(custEq.id, { ...custEq });
                    }
                }
            });
        }

        return Array.from(finalMap.values());
    }, [customer, job, currentJob]);

    const jobSubmissionAudit = useMemo(() => {
        if (!customer || !customer.submissionRules) return null;
        const rules = customer.submissionRules;
        const actualPo = currentJob?.poNumber || (currentJob as any)?.workOrderNumber || currentJob?.invoice?.poNumber || (currentJob as any)?.po || '';
        const poOk = !rules.requirePoNumber || (typeof actualPo === 'string' && actualPo.trim().length > 0);
        
        const sigOk = !rules.requireSignedWorkOrder || 
            !!currentJob?.customerSignature || 
            !!currentJob?.signature ||
            !!currentJob?.signOffSheetUrl ||
            !!(currentJob as any)?.signoffSheetUrl ||
            !!(currentJob as any)?.customWorkOrderFormUrl ||
            !!(currentJob as any)?.signOff?.sheetUrl ||
            (currentJob as any)?.signOff?.status === 'COMPLETED' ||
            !!(currentJob as any)?.invoiceSignature ||
            !!(currentJob as any)?.invoice?.signatureUrl ||
            !!(currentJob as any)?.workflowState?.customerSignature ||
            !!(currentJob as any)?.workflowState?.siteManagerSignature ||
            !!(currentJob as any)?.signatures?.length ||
            (localFiles || []).some((f: any) => 
                f.fileName?.includes('SignOff') || 
                f.fileName?.includes('Signature') || 
                f.label?.includes('Sign-Off') || 
                f.metadata?.category === 'signoff' || 
                f.metadata?.category === 'signature'
            );
        const photoOk = !rules.requireBeforeAfterPhotos || !!(currentJob?.photos && currentJob.photos.length > 0) || (localFiles && localFiles.length > 0);
        const serialOk = !rules.requireEquipmentSerial || checkJobHasVerifiedEquipmentSerial(currentJob || job, customer, state.equipment, jobAssets);

        const totalRulesCount = [rules.requirePoNumber, rules.requireSignedWorkOrder, rules.requireBeforeAfterPhotos, rules.requireEquipmentSerial].filter(Boolean).length;
        const passedRulesCount = [rules.requirePoNumber && poOk, rules.requireSignedWorkOrder && sigOk, rules.requireBeforeAfterPhotos && photoOk, rules.requireEquipmentSerial && serialOk].filter(Boolean).length;

        const isCompliant = poOk && sigOk && photoOk && serialOk;

        return {
            customerName: customer.name,
            rules,
            poOk,
            sigOk,
            photoOk,
            serialOk,
            totalRulesCount,
            passedRulesCount,
            isCompliant,
            portal: rules.thirdPartyPortal
        };
    }, [customer, currentJob, job, localFiles, jobAssets, state.equipment]);

    const isSubcontractor = state.currentUser?.role === 'Subcontractor';
    const siteLocationName = resolveSiteLocationName(job, serviceLocation) || 'Service Site Location';

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isIssueWarrantyOpen, setIsIssueWarrantyOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState(job?.customerEmail || '');
    const [emailSubject, setEmailSubject] = useState(`Service Report - ${job?.customerName || 'Client'} - Job #${job?.id}`);
    const [emailCustomMessage, setEmailCustomMessage] = useState('');
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [attachReportPdf, setAttachReportPdf] = useState(false);
    const [attachInvoicePdf, setAttachInvoicePdf] = useState(false);
    const [emailOptions, setEmailOptions] = useState({
        includeRecommendations: true,
        includeAssets: true,
        includePhotos: true,
        includeParts: true,
        includeTechnicalData: true,
        includeDiagnosisChecklist: true,
        includeQualityChecklist: true,
        includeArrivalNotes: true,
        includeDiagnosisNotes: true,
        includeWorkNotes: true,
        includeCompletionNotes: true,
        includeInternalNotes: false, // Default false for security
        includeCustomerFeedback: true,
        includeEmployeeFeedback: true,
        includeThankYouNote: true,
        includeInvoice: true,
        includeSignOff: true
    });

    const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);

    const hasInitializedEmailAttachmentsRef = useRef(false);
    useEffect(() => {
        if (!isEmailModalOpen) {
            hasInitializedEmailAttachmentsRef.current = false;
            return;
        }
        if (hasInitializedEmailAttachmentsRef.current) return;
        hasInitializedEmailAttachmentsRef.current = true;
        if (job) {
            const filesToAttach = (job.files || []).filter(f => !isInternalExpenseFile(f));
            setSelectedAttachments(filesToAttach.map(f => f.id || f.dataUrl));
        }
    }, [isEmailModalOpen, job]);

    const [selectedPocEmails, setSelectedPocEmails] = useState<string[]>([]);

    const availablePocs = useMemo(() => {
        if (!job) return [];
        const list: Array<{ name: string; email: string; role: string; type: 'location' | 'general' | 'primary' }> = [];
        
        // Primary Customer contact
        if ((customer?.email || job?.customerEmail) && (customer?.name || job?.customerName)) {
            list.push({
                name: customer?.name || job.customerName,
                email: customer?.email || job.customerEmail,
                role: 'Primary Customer',
                type: 'primary'
            });
        }

        // Location POCs
        const locId = job.locationId || serviceLocation?.id;
        if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
            customer.contacts.forEach((c: any) => {
                if (c && c.name && c.email && c.allowedLocationIds?.includes(locId)) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || c.title || 'Site POC',
                        type: 'location'
                    });
                }
            });
        }
        if (serviceLocation?.contacts && Array.isArray(serviceLocation.contacts)) {
            serviceLocation.contacts.forEach((c: any) => {
                if (c && c.name && c.email && !list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || 'Site POC',
                        type: 'location'
                    });
                }
            });
        }

        // Customer General POCs
        if (customer?.contacts && Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c && c.name && c.email && !list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || c.title || 'General Contact',
                        type: 'general'
                    });
                }
            });
        }

        return list;
    }, [job, serviceLocation, customer]);

    useEffect(() => {
        if (isOpen && job) {
            // Find location POCs
            const locPocs = serviceLocation?.contacts?.filter((c: any) => c && c.name && c.email) || [];
            let initialEmails: string[] = [];
            if (locPocs.length > 0) {
                initialEmails = locPocs.map((c: any) => c.email);
            } else if (customer?.email || job.customerEmail) {
                initialEmails = [customer?.email || job.customerEmail];
            }
            setSelectedPocEmails(initialEmails);
            setEmailRecipient(initialEmails.join(', '));
            setEmailSubject(`Service Report - ${customer?.name || job.customerName || 'Client'} - Job #${job.id}`);
            setEmailCustomMessage(
                `Hi,\n\nPlease find attached the service report for our visit on ${safeFormatDateString(job.appointmentTime)}.\n\nBest regards,\n${state.currentOrganization?.name || 'TekTrakker Service Team'}`
            );
        }
    }, [isOpen, job, serviceLocation, state.currentOrganization, customer]);


    const generateEmailHtml = (customerFacing = !isAdmin, isPdfOrPrint = false) => {
        const activeJob = currentJob || job;
        if (!activeJob) return '';

        const resolvedAssistants = Array.isArray(activeJob.assistants)
            ? activeJob.assistants.map((a: any) => {
                if (typeof a === 'object' && a !== null) return a;
                const u = state.users?.find((user: any) => user.id === a || user.uid === a);
                return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : a;
            })
            : [];

        return generateJobReportHtml(
            {
                ...activeJob,
                customer,
                serviceLocation,
                equipmentList: jobAssets.length > 0 ? jobAssets : (activeJob?.equipmentList || activeJob?.equipment || activeJob?.units || []),
                unitStates: localUnitStates.length > 0 ? localUnitStates : (activeJob?.unitStates || []),
                files: (() => {
                    const combined = [...(Array.isArray(activeJob?.files) ? activeJob.files : []), ...(Array.isArray(localFiles) ? localFiles : [])];
                    const seen = new Set<string>();
                    return combined.filter((f: any) => {
                        const key = f.id || f.dataUrl || f.url || f.fileName;
                        if (!key || seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                })(),
                notes: localNotes && Object.keys(localNotes).length > 0 ? localNotes : activeJob?.notes,
                arrivalNotes: localNotes?.arrival || activeJob?.arrivalNotes,
                diagnosisNotes: localNotes?.diagnosis || activeJob?.diagnosisNotes || activeJob?.diagnosis,
                workNotes: localNotes?.work || localNotes?.workNotes || activeJob?.workNotes || activeJob?.workPerformedNotes,
                completionNotes: localNotes?.completion || activeJob?.completionNotes,
                techRecommendations: localTechRecs || activeJob?.techRecommendations || activeJob?.recommendations,
                assistants: resolvedAssistants.length > 0 ? resolvedAssistants : activeJob.assistants,
                crewNames: resolvedAssistants.filter(Boolean).join(', ') || activeJob.crewNames
            },
            state.currentOrganization,
            undefined,
            {
                customerFacing,
                isPdfOrPrint,
                users: state.users,
                includeInvoice: (emailOptions as any)?.includeInvoice ?? true,
                includeSignOff: (emailOptions as any)?.includeSignOff ?? true,
                includeWarranty: true,
                includePhotos: emailOptions.includePhotos ?? true,
                includeRecommendations: emailOptions.includeRecommendations ?? true,
                includeThankYouNote: emailOptions.includeThankYouNote ?? true,
                includeAssets: emailOptions.includeAssets ?? true,
                includeArrivalNotes: emailOptions.includeArrivalNotes ?? true,
                includeDiagnosisNotes: emailOptions.includeDiagnosisNotes ?? true,
                includeWorkNotes: emailOptions.includeWorkNotes ?? true,
                includeCompletionNotes: emailOptions.includeCompletionNotes ?? true,
                includeCustomerFeedback: emailOptions.includeCustomerFeedback ?? true,
                includeEmployeeFeedback: emailOptions.includeEmployeeFeedback ?? true,
                localNotes,
                localUnitStates,
                localFiles,
                deletedFiles
            }
        );
    };


    const handleTogglePoc = (email: string, checked: boolean) => {
        const currentEmails = emailRecipient.split(',').map(e => e.trim()).filter(Boolean);
        let newEmails: string[];
        if (checked) {
            if (!currentEmails.some(e => e.toLowerCase() === email.toLowerCase())) {
                newEmails = [...currentEmails, email];
            } else {
                newEmails = currentEmails;
            }
        } else {
            newEmails = currentEmails.filter(e => e.toLowerCase() !== email.toLowerCase());
        }
        setEmailRecipient(newEmails.join(', '));
        const lowerNew = newEmails.map(e => e.toLowerCase());
        setSelectedPocEmails(availablePocs.map(p => p.email).filter(e => lowerNew.includes(e.toLowerCase())));
    };

    const handleRecipientInputChange = (val: string) => {
        setEmailRecipient(val);
        const currentEmails = val.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        setSelectedPocEmails(availablePocs.map(p => p.email).filter(e => currentEmails.includes(e.toLowerCase())));
    };

    const handleSendEmailReport = async () => {
        if (!emailRecipient.trim()) {
            alert("Please enter a recipient email address.");
            return;
        }
        
        setIsEmailSending(true);
        try {
            const htmlContent = generateEmailHtml(true);
            
            // Format selected attachments
            const emailAttachments: any[] = (localFiles || [])
                .filter(f => selectedAttachments.includes(f.id || f.dataUrl))
                .map(file => {
                    const isDataUrl = file.dataUrl && file.dataUrl.startsWith('data:');
                    if (isDataUrl) {
                        const base64Part = file.dataUrl.split('base64,')[1] || file.dataUrl;
                        return {
                            filename: file.fileName,
                            content: base64Part,
                            encoding: 'base64',
                            contentType: file.fileType || (file as any).contentType
                        };
                    } else {
                        return {
                            filename: file.fileName,
                            path: file.dataUrl,
                            contentType: file.fileType || (file as any).contentType
                        };
                    }
                });

            if (attachReportPdf) {
                const fullJobForPdf = {
                    ...job,
                    customer,
                    serviceLocation,
                    files: localFiles.length > 0 ? localFiles : (job.files || []),
                    notes: localNotes && Object.keys(localNotes).length > 0 ? localNotes : job.notes,
                    arrivalNotes: localNotes?.arrival || job?.arrivalNotes,
                    diagnosisNotes: localNotes?.diagnosis || job?.diagnosisNotes || job?.diagnosis,
                    workNotes: localNotes?.work || localNotes?.workNotes || job?.workNotes || job?.workPerformedNotes,
                    completionNotes: localNotes?.completion || job?.completionNotes,
                    techRecommendations: localTechRecs || job?.techRecommendations || job?.recommendations,
                    equipmentList: jobAssets.length > 0 ? jobAssets : (job.equipmentList || job.equipment || job.units || []),
                    unitStates: localUnitStates.length > 0 ? localUnitStates : (job.unitStates || []),
                    customerEquipment: customer?.equipment || []
                };
                const reportPdf = await generateJobReportPdfAttachment(fullJobForPdf, state.currentOrganization, emailCustomMessage);
                emailAttachments.push(reportPdf);
            }

            if (attachInvoicePdf && job.invoice) {
                const invPdf = await generateInvoicePdfAttachment(job, state.currentOrganization);
                emailAttachments.push(invPdf);
            }

            await sendEmail(state.currentOrganization, {
                to: emailRecipient,
                message: {
                    subject: emailSubject,
                    html: htmlContent,
                    text: `${emailCustomMessage}\n\nView the full service history report inside your Customer Portal.`,
                    attachments: emailAttachments
                } as any
            });
            alert("Service report email sent successfully!");
            setIsEmailModalOpen(false);
        } catch (e: any) {
            console.error("Error sending email:", e);
            alert(`Failed to send email: ${e.message || 'Unknown error'}`);
        } finally {
            setIsEmailSending(false);
        }
    };

    const handleRefund = async () => {
        if (!job.invoice?.paymentIntentId) return;
        
        const amountStr = window.prompt(
            "Enter the amount to refund (leave blank or enter full amount for a complete refund):",
            job.invoice?.amount ? job.invoice.amount.toString() : ""
        );
        
        if (amountStr === null) return; // User cancelled
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount.");
            return;
        }
        
        setIsRefunding(true);
        try {
            const refundCallable = functions.httpsCallable('refundKortPayment');
            await refundCallable({
                paymentIntentId: job.invoice?.paymentIntentId,
                organizationId: job.organizationId,
                amount: amount
            });
            alert("Refund initiated successfully.");
        } catch (error: any) {
            console.error("Refund error:", error);
            alert(`Refund failed: ${error.message}`);
        } finally {
            setIsRefunding(false);
        }
    };

    const handleDeletePhoto = async (file: ExtendedFile) => {
        if (!(await globalConfirm("Delete this photo permanently?", "Delete Photo", "Delete", "Cancel"))) return;
        try {
            setDeletedFiles(prev => new Set(prev).add(file.id || file.dataUrl));
            const updatedFiles = (job.files || []).filter((f: any) => {
                if (file.id && f.id === file.id) return false;
                const fileUrl = file.url || file.dataUrl;
                if (fileUrl && (f.url === fileUrl || f.dataUrl === fileUrl)) return false;
                return true;
            });
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, files: updatedFiles } });
            showToast.success("Photo deleted successfully.");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to delete photo.");
        }
    };

    const handleLinkProposal = async (proposalId: string) => {
        if (!proposalId) return;
        try {
            const currentJobData = (state.jobs || []).find((j: any) => j.id === job.id) || job;
            const updatedProposalIds = Array.from(new Set([...(currentJobData.linkedProposalIds || []), proposalId]));

            // Update Job
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    linkedProposalIds: updatedProposalIds
                }));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, linkedProposalIds: updatedProposalIds } });

            // Update Proposal
            if (!state.isDemoMode) {
                const propRef = db.collection('proposals').doc(proposalId);
                const propSnap = await propRef.get();
                if (propSnap.exists) {
                    const propData = propSnap.data() || {};
                    const updatedJobIds = Array.from(new Set([...(propData.linkedJobIds || []), job.id]));
                    const propRefNum = propData.referenceNumber || (propData.id?.startsWith('PROP-') && !propData.id.includes(extractJobSlug(job.id)) ? propData.id : null);
                    await propRef.update(cleanUndefinedFields({
                        linkedJobIds: updatedJobIds,
                        referenceNumber: propRefNum
                    }));
                    dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposalId, linkedJobIds: updatedJobIds, referenceNumber: propRefNum } });
                }
            }
            showToast.success("Proposal linked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link proposal: " + error.message);
        }
    };

    const handleUnlinkProposal = async (proposalId: string) => {
        try {
            const currentJobData = (state.jobs || []).find((j: any) => j.id === job.id) || job;
            const updatedProposalIds = (currentJobData.linkedProposalIds || []).filter((id: string) => id !== proposalId);
            const updates: any = { linkedProposalIds: updatedProposalIds };
            if (currentJobData.proposalId === proposalId) updates.proposalId = '';
            if (currentJobData.projectId === proposalId) updates.projectId = '';
            
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });

            // Update Proposal
            if (!state.isDemoMode) {
                const propRef = db.collection('proposals').doc(proposalId);
                const propSnap = await propRef.get();
                if (propSnap.exists) {
                    const propData = propSnap.data() || {};
                    const updatedJobIds = (propData.linkedJobIds || []).filter((id: string) => id !== job.id);
                    const propUpdates: any = { linkedJobIds: updatedJobIds };
                    if (propData.jobId === job.id) propUpdates.jobId = '';
                    await propRef.update(cleanUndefinedFields(propUpdates));
                    dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposalId, ...propUpdates } });
                }
            }
            showToast.success("Proposal unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink proposal: " + error.message);
        }
    };

    const handleLinkJob = async (targetJobId: string) => {
        if (!targetJobId) return;
        try {
            // Update current job
            const updatedCurrentJobIds = [...(job.linkedJobIds || [])];
            if (!updatedCurrentJobIds.includes(targetJobId)) {
                updatedCurrentJobIds.push(targetJobId);
            }
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    linkedJobIds: updatedCurrentJobIds
                }));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, linkedJobIds: updatedCurrentJobIds } });

            // Update target job
            if (!state.isDemoMode) {
                const targetRef = db.collection('jobs').doc(targetJobId);
                const targetSnap = await targetRef.get();
                if (targetSnap.exists) {
                    const targetData = targetSnap.data() || {};
                    const updatedTargetJobIds = [...(targetData.linkedJobIds || [])];
                    if (!updatedTargetJobIds.includes(job.id)) {
                        updatedTargetJobIds.push(job.id);
                    }
                    await targetRef.update(cleanUndefinedFields({
                        linkedJobIds: updatedTargetJobIds
                    }));
                    const targetJob = state.jobs.find(j => j.id === targetJobId);
                    if (targetJob) {
                        dispatch({ type: 'UPDATE_JOB', payload: { ...targetJob, linkedJobIds: updatedTargetJobIds } });
                    }
                }
            }
            showToast.success("Jobs linked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link jobs: " + error.message);
        }
    };

    const handleUnlinkJob = async (targetJobId: string) => {
        try {
            // Update current job
            const updatedCurrentJobIds = (job.linkedJobIds || []).filter((id: string) => id !== targetJobId);
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    linkedJobIds: updatedCurrentJobIds
                }));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, linkedJobIds: updatedCurrentJobIds } });

            // Update target job
            if (!state.isDemoMode) {
                const targetRef = db.collection('jobs').doc(targetJobId);
                const targetSnap = await targetRef.get();
                if (targetSnap.exists) {
                    const targetData = targetSnap.data() || {};
                    const updatedTargetJobIds = (targetData.linkedJobIds || []).filter((id: string) => id !== job.id);
                    await targetRef.update(cleanUndefinedFields({
                        linkedJobIds: updatedTargetJobIds
                    }));
                    const targetJob = state.jobs.find(j => j.id === targetJobId);
                    if (targetJob) {
                        dispatch({ type: 'UPDATE_JOB', payload: { ...targetJob, linkedJobIds: updatedTargetJobIds } });
                    }
                }
            }
            showToast.success("Jobs unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink jobs: " + error.message);
        }
    };

    const handleUnlinkInvoice = async (invoiceId: string) => {
        try {
            const updatedInvoiceIds = (job.linkedInvoiceIds || []).filter((id: string) => id !== invoiceId);
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    linkedInvoiceIds: updatedInvoiceIds
                }));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    ...job,
                    linkedInvoiceIds: updatedInvoiceIds
                }
            });
            showToast.success("Invoice unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink invoice: " + error.message);
        }
    };

    const handleArchiveToggle = async () => {
        if (!hasPermission(state.currentUser, 'manage_dispatch')) {
            showToast.warn("You do not have permission to archive jobs.");
            return;
        }
        const newArchived = !job.archived;
        const updates = {
            archived: newArchived,
            archivedAt: newArchived ? new Date().toISOString() : null,
            archivedBy: newArchived ? state.currentUser?.id : null
        };

        try {
            if (!state.isDemoMode) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            showToast.success(newArchived ? "Job taken off dispatch board (Archived)" : "Job restored to dispatch board");
        } catch (err: any) {
            console.error("Failed to update job archive status:", err);
            showToast.error("Failed to update job status");
        }
    };

    useEffect(() => {
        if (!state.currentUser || !job?.id) return;
        setProposal(null);

        const promises: Promise<Proposal | null>[] = [];

        // Query by jobId field (primary — this is how FieldProposal saves it)
        promises.push(
            db.collection('proposals').where('jobId', '==', job.id).limit(1).get()
                .then(snap => snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Proposal)
                .catch(() => null)
        );

        // Direct lookup by projectId (fallback for older records)
        if (job.projectId) {
            promises.push(
                db.collection('proposals').doc(job.projectId).get()
                    .then(doc => doc.exists ? { id: doc.id, ...doc.data() } as Proposal : null)
                    .catch(() => null)
            );
        }

        Promise.all(promises).then(results => {
            const found = results.find(r => r !== null);
            if (found) setProposal(found);
        });

        // Fetch measureQuick diagnostics
        const unsubDiags = db.collection('jobs').doc(job.id).collection('diagnostics').onSnapshot(snap => {
            setDiagnostics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiagnosticReport)));
        });

        return () => unsubDiags();
    }, [job?.id, job?.projectId, state.currentUser]);

    const formatAddress = (addr: unknown) => {
        if (typeof addr === 'string') return addr;
        if (!addr) return 'Address not recorded';
        const a = addr as Record<string, string>;
        return `${a.street || ''}, ${a.city || ''}, ${a.state || ''} ${a.zip || ''}`;
    };

    const attachableFiles = useMemo(() => {
        return (job?.files || []).filter(f => !isInternalExpenseFile(f));
    }, [job?.files]);

    const photoFiles = (localFiles || []).filter(f => 
        !deletedFiles.has(f.id || (f as ExtendedFile).dataUrl || '') &&
        isFilePhoto(f) &&
        (isAdmin || !isInternalExpenseFile(f))
    ) || [];

    const groupedPhotos = photoFiles.reduce((acc, f) => {
        const label = f.metadata?.label || (f as ExtendedFile).label || 'Uncategorized';
        if (!acc[label]) acc[label] = [];
        acc[label].push(f);
        return acc;
    }, {} as Record<string, any[]>);

    const docFiles = job?.files?.filter(f => 
        (f.type === 'Document' || 
        (f as ExtendedFile).contentType === 'application/pdf' || 
        (f as ExtendedFile).fileType === 'application/pdf' ||
        (f as ExtendedFile).fileType === 'text/html' ||
        f.fileName?.toLowerCase().endsWith('.html') ||
        f.fileName?.toLowerCase().endsWith('.pdf')) &&
        f.fileName !== 'Signed_Waivers.html' &&
        f.fileName !== 'Waiver_Pending_Signature.html' &&
        f.metadata?.label !== 'Legal Waiver' &&
        (f as ExtendedFile).label !== 'Legal Waiver' &&
        (isAdmin || !isInternalExpenseFile(f))
    ) || [];

    if (!job) return null;

    return (
        <>
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={isAdmin ? (job.workOrderNumber ? `Work Order #${job.workOrderNumber} — ${customer?.name || job.customerName || 'Job Record'}` : `Job Record #${job.id.replace('job-', '')} — ${customer?.name || job.customerName || 'Customer'}`) : `Service Report — WO #${job.workOrderNumber || job.id.slice(-6).toUpperCase()}`} 
            size="2xl"
            zIndex="z-[10060]"
        >
            <div className={isAdmin ? "p-3 sm:p-5" : "p-0"}>
                {/* Technician Review & Certification Banner */}
                {isReviewMode && (
                    <div className="mb-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border-2 border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-indigo-950 dark:text-indigo-100">
                                    Technician Job Record Review & Certification
                                </h4>
                                <p className="text-xs text-indigo-800/80 dark:text-indigo-300 font-medium">
                                    {isJobRecordSignedOff 
                                        ? "✓ This job record has been verified and certified by the technician."
                                        : "Review full service findings, readings, and photos before completing site departure."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {isJobRecordSignedOff ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-black text-xs">
                                    <CheckCircle2 size={16} /> Certified & Signed Off
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tech = state.currentUser?.name || `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';
                                        onSignOffJobRecord?.(tech);
                                        showToast.success("Job record successfully signed off and certified!");
                                        onClose();
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer border-none"
                                >
                                    <CheckCircle size={16} />
                                    <span>Certify & Sign Off Job Record</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Modern Command Toolbar & Tabs Header */}
                {isAdmin && (
                    <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-4 sticky top-0 bg-white dark:bg-slate-800 z-20 py-3 shadow-xs print:hidden">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                            {/* Left: Key Job Meta Badges */}
                            <div className="flex items-center flex-wrap gap-2">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-xs ${
                                    job.jobStatus === 'Completed' ? 'bg-emerald-500 text-white' : 
                                    (job.jobStatus === 'Needs Review' || job.needsAdminVerification) ? 'bg-amber-500 text-slate-950 font-black animate-pulse' :
                                    job.jobStatus === 'In Progress' ? 'bg-blue-500 text-white' : 
                                    'bg-slate-600 text-white'
                                }`}>
                                    {job.jobStatus === 'Needs Review' ? '⚠️ Needs Review' : job.jobStatus}
                                </span>

                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg">
                                    <Calendar size={12} className="text-indigo-600 dark:text-indigo-400" />
                                    {new Date(job.appointmentTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>

                                {(job.poNumber || job.workOrderNumber) && (
                                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg">
                                        PO: {job.poNumber || job.workOrderNumber}
                                    </span>
                                )}

                                {/* Segmented Tab Switcher */}
                                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'technical'
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        onClick={() => {
                                            setActiveTab('technical');
                                            setIsEditMode(false);
                                        }}
                                    >
                                        <FileText size={13} />
                                        <span>Full Job Record</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'preview'
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        onClick={() => {
                                            setActiveTab('preview');
                                            setIsEditMode(false);
                                        }}
                                    >
                                        <Eye size={13} />
                                        <span>Service Report (PDF View)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Right: Quick Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    onClick={() => setIsIssueWarrantyOpen(true)} 
                                    className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                >
                                    <ShieldCheck size={13} /> Issue Warranty
                                </Button>

                                <Button 
                                    onClick={() => setIsEmailModalOpen(true)} 
                                    className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                >
                                    <Mail size={13} /> Email Report
                                </Button>

                                <Button 
                                    disabled={isDownloadingPdf}
                                    onClick={async () => {
                                        setIsDownloadingPdf(true);
                                        try {
                                            const htmlContent = generateEmailHtml(!isAdmin, true);
                                            const { renderHtmlToSmartPdf, getStandardPdfFilename } = await import('../../lib/pdfHelper');
                                            const fileName = getStandardPdfFilename('Service_Report', {
                                                id: job.id,
                                                workOrderNumber: job.workOrderNumber,
                                                poNumber: job.poNumber,
                                                customerName: customer?.name || job.customerName,
                                                date: job.appointmentTime || job.scheduledDate || job.createdAt
                                            });
                                            
                                            const result = await renderHtmlToSmartPdf(htmlContent, {
                                                filename: fileName,
                                                margin: [0.25, 0.25, 0.25, 0.25],
                                                windowWidth: 740,
                                                pdfFormat: 'letter',
                                                pdfOrientation: 'portrait',
                                                scale: 2,
                                                quality: 0.98
                                            });

                                            const { downloadFile } = await import('../../lib/downloadHelper');
                                            await downloadFile(result.dataUri, fileName);
                                        } catch (err) {
                                            console.error('Failed to generate PDF:', err);
                                            showToast.error('Failed to download PDF report.');
                                        } finally {
                                            setIsDownloadingPdf(false);
                                        }
                                    }}
                                    className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                >
                                    <Download size={13} /> {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
                                </Button>

                                <Button 
                                    onClick={() => setIsPrintingTechSheet(true)}
                                    className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-white shadow-xs"
                                >
                                    <Printer size={13} /> Tech Sheet
                                </Button>

                                {isAdmin && onEditRecord && (
                                    <Button variant="secondary" onClick={onEditRecord} className="h-8 text-[11px] uppercase font-black tracking-wider px-3 shadow-xs">
                                        <Edit size={13} className="mr-1" /> Edit Record
                                    </Button>
                                )}

                                <Button 
                                    variant="secondary"
                                    onClick={() => setIsSendSubcontractorModalOpen(true)}
                                    className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap shadow-xs"
                                >
                                    <Send size={13}/> Send to Sub
                                </Button>

                                {assignedSub && (
                                    <Button 
                                        variant="secondary"
                                        onClick={() => setIsChargebackModalOpen(true)}
                                        className="h-8 text-[11px] uppercase font-black tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800 shadow-xs"
                                        title="Log site property damage or faulty workmanship chargeback against the assigned subcontractor"
                                    >
                                        <AlertTriangle size={13}/> Chargeback
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}



                {/* COMMERCIAL CUSTOMER WORK ORDER PROCESS GUIDE & 20-DAY COUNTDOWN */}
                {(customer?.submissionRules || customer?.id === 'cust-1787187506048') && (
                    <div className="mb-6">
                        <CommercialWorkOrderProcessGuide
                            job={currentJob || job}
                            customer={customer}
                            defaultExpanded={false}
                        />
                    </div>
                )}

                {/* COMMERCIAL CUSTOMER SUBMISSION QUALITY GATE ON JOB RECORD */}
                {isAdmin && jobSubmissionAudit && (jobSubmissionAudit.totalRulesCount > 0 || jobSubmissionAudit.portal?.required) && (
                    <div className={`mb-6 p-4 rounded-2xl border transition-all ${
                        jobSubmissionAudit.isCompliant 
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    }`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className={`px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-wider ${
                                    jobSubmissionAudit.isCompliant ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                                }`}>
                                    {jobSubmissionAudit.isCompliant ? '✅ Customer Submission Requirements Met' : `⚠️ Customer Submission Requirements (${jobSubmissionAudit.totalRulesCount - jobSubmissionAudit.passedRulesCount} Missing)`}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Client Standard: {jobSubmissionAudit.customerName}
                                </h4>
                            </div>

                            {jobSubmissionAudit.portal?.required && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-extrabold px-2.5 py-1 rounded bg-indigo-600 text-white uppercase shadow-sm">
                                        🌐 Portal Required: {jobSubmissionAudit.portal.portalName || '3rd Party Portal'}
                                    </span>
                                    {jobSubmissionAudit.portal.portalUrl && (
                                        <a 
                                            href={jobSubmissionAudit.portal.portalUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-bold px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded transition-colors"
                                        >
                                            Open Portal ↗
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                            {jobSubmissionAudit.rules.requirePoNumber && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    jobSubmissionAudit.poOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                    {jobSubmissionAudit.poOk ? '✓ WO / PO # Recorded' : '❌ WO / PO # Required'}
                                </span>
                            )}
                            {jobSubmissionAudit.rules.requireSignedWorkOrder && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    jobSubmissionAudit.sigOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                    {jobSubmissionAudit.sigOk ? '✓ Sign-off Captured' : '❌ Customer Signature Missing'}
                                </span>
                            )}
                            {jobSubmissionAudit.rules.requireBeforeAfterPhotos && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    jobSubmissionAudit.photoOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                    {jobSubmissionAudit.photoOk ? '✓ Job Photos Attached' : '❌ Job Photos (Before/After) Missing'}
                                </span>
                            )}
                            {jobSubmissionAudit.rules.requireEquipmentSerial && (
                                <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                    jobSubmissionAudit.serialOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                    {jobSubmissionAudit.serialOk ? '✓ Asset Serial Verified' : '❌ Equipment Specs/Serial Missing'}
                                </span>
                            )}
                            {jobSubmissionAudit.rules.submissionDeadlineDays && (() => {
                                const workDateStr = currentJob?.checkOutTime || currentJob?.appointmentTime || (currentJob as any)?.completedDate || currentJob?.invoice?.invoiceDate || currentJob?.createdAt;
                                const workDate = workDateStr ? new Date(workDateStr) : new Date();
                                const elapsed = Math.max(0, Math.floor((Date.now() - workDate.getTime()) / (1000 * 60 * 60 * 24)));
                                const left = (jobSubmissionAudit.rules.submissionDeadlineDays || 20) - elapsed;
                                const isSettled = currentJob?.invoice?.status === 'Paid';
                                return (
                                    <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${
                                        isSettled 
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : left < 0 
                                            ? 'bg-rose-900 text-white border-rose-600 animate-pulse'
                                            : left <= 5 
                                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                            : left <= 10
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-blue-50 text-blue-800 border-blue-200'
                                    }`}>
                                        {isSettled ? '✓ Invoice Paid' : left < 0 ? `🛑 ${Math.abs(left)}d Past Cutoff` : `⏱️ ${left}d Left (${jobSubmissionAudit.rules.submissionDeadlineDays}d Cutoff)`}
                                    </span>
                                );
                            })()}
                        </div>

                        {jobSubmissionAudit.rules.customSubmissionNotes && (
                            <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200 italic">
                                📌 Special Rules: {jobSubmissionAudit.rules.customSubmissionNotes}
                            </p>
                        )}

                        {/* 1-CLICK CHECK-IN / CHECK-OUT PROCEDURE ACTION BAR */}
                        {jobSubmissionAudit.rules.checkInProcedure?.required && (
                            <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-blue-900 dark:text-blue-300 block tracking-wider">
                                        📲 On-Site Check-In / Out ({jobSubmissionAudit.rules.checkInProcedure.method || 'SMS / IVR'}):
                                    </span>
                                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                        {jobSubmissionAudit.rules.checkInProcedure.instructions || 'Text WO # to 1-856-452-7719 or call IVR to clock in/out.'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {jobSubmissionAudit.rules.checkInProcedure.phoneNumber && (
                                        <a
                                            href={`sms:${jobSubmissionAudit.rules.checkInProcedure.phoneNumber.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(`WO ${poNumber || job.id}`)}`}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                                            title="1-Click Text Check-In"
                                        >
                                            💬 ⚡ 1-Click Text Check-In ({jobSubmissionAudit.rules.checkInProcedure.phoneNumber})
                                        </a>
                                    )}
                                    {jobSubmissionAudit.rules.checkInProcedure.phoneNumber && (
                                        <a
                                            href={`tel:${jobSubmissionAudit.rules.checkInProcedure.phoneNumber.replace(/[^0-9+]/g, '')}`}
                                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                                            title="1-Click Call IVR"
                                        >
                                            📞 Call IVR
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Persistent Job History & IVR Check-In Audit Trail */}
                        {job.checkInLogs && job.checkInLogs.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                                        ⏱️ Verified On-Site Check-In & IVR Audit History ({job.checkInLogs.length} events)
                                    </span>
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {job.checkInLogs.map((log: any, idx: number) => (
                                        <div key={log.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    log.action === 'check_in' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                                }`}>
                                                    {log.action === 'check_in' ? 'Check-In' : 'Check-Out'}
                                                </span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{log.method}</span>
                                                <span className="text-slate-500 text-[11px]">(WO #{log.woNumber || 'N/A'})</span>
                                            </div>
                                            <div className="text-right font-mono text-[10px] text-slate-500">
                                                <span>{log.techName || 'Tech'}</span> • <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Return Visit Suggestion Alert Banner */}
                {isAdmin && job.visitType === 'Diagnostic Only' && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-[2.5rem] shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500 p-2.5 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                                <Wrench size={20} />
                            </div>
                            <div className="text-left">
                                <h4 className="text-sm font-black text-amber-805 dark:text-amber-350 uppercase tracking-wider">Diagnostic Only Visit</h4>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium leading-relaxed">
                                    This visit was scheduled as a Diagnostic Only appointment. You can schedule and link a secondary Repair visit for this customer below.
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsScheduleFollowUpOpen(true)} 
                            className="h-10 text-[10px] uppercase font-black tracking-widest bg-amber-600 hover:bg-amber-700 text-white shrink-0 flex items-center gap-2 px-5 whitespace-nowrap"
                        >
                            <CalendarPlus size={14} /> Schedule Return Visit (Repair)
                        </Button>
                    </div>
                )}



                {activeTab === 'technical' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Notes & Tasks */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Summary Header Section (Printable) */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-4 print:bg-white print:border-slate-200">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                                <div className="space-y-1">
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight print:text-black flex items-center gap-2 flex-wrap">
                                        {isSubcontractor ? siteLocationName : (customer?.name || job.customerName)}
                                        {(serviceLocation as any)?.propertyName && (
                                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                                📍 {(serviceLocation as any).propertyName}
                                                {(serviceLocation as any).locationNumber ? ` (#${(serviceLocation as any).locationNumber})` : ''}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium print:text-slate-700">
                                        <MapPin size={14} className="text-slate-400 print:hidden shrink-0"/> 
                                        {formatAddress(job.address || serviceLocation?.address || customer?.address)}
                                        {(serviceLocation as any)?.building ? ` • Building: ${(serviceLocation as any).building}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {job.isServicePlan && (
                                        <span className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1 shadow-sm">
                                            ✓ Service Plan Covered
                                        </span>
                                    )}
                                    <span className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm print:border print:border-slate-300 ${
                                        job.jobStatus === 'Completed' ? 'bg-emerald-500 text-white print:text-emerald-700 print:bg-white' : 
                                        (job.jobStatus === 'Needs Review' || job.needsAdminVerification) ? 'bg-amber-500 text-slate-950 font-black animate-pulse print:text-amber-700 print:bg-white' :
                                        job.jobStatus === 'In Progress' ? 'bg-blue-500 text-white print:text-blue-700 print:bg-white' : 
                                        'bg-slate-500 text-white print:text-slate-700 print:bg-white'
                                    }`}>
                                        {job.jobStatus === 'Needs Review' ? '⚠️ Needs Review' : job.jobStatus}
                                    </span>
                                    <button
                                        onClick={handleArchiveToggle}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all flex items-center gap-1.5 shadow-sm print:hidden ${
                                            job.archived 
                                                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                        }`}
                                        title={job.archived ? "Click to restore job to active dispatch board" : "Click to take job off dispatch board without deleting"}
                                    >
                                        <Archive size={12} />
                                        <span>{job.archived ? "Archived (Restore)" : "Take Off Board"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* ADMIN VERIFICATION & ACCURACY REVIEW BANNER */}
                            {(job.jobStatus === 'Needs Review' || job.needsAdminVerification) && (
                                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-orange-500/15 border-2 border-amber-500/50 text-slate-800 dark:text-slate-100 shadow-xl animate-fade-in print:hidden">
                                    <div className="flex items-start justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-md">
                                                <ShieldAlert size={22} className="animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                                                    📋 Action Required: Technician Job Completion Review
                                                    <span className="px-2 py-0.5 text-[9px] rounded-full font-black bg-amber-500 text-slate-950 uppercase tracking-widest">
                                                        Pending Verification
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 font-medium">
                                                    Technician <strong>{job.assignedTechnicianName || 'Tech'}</strong> completed work on site. Please verify accuracy & completeness before releasing billing documents.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    // Mark job verified and open email dispatch modal
                                                    const updates = { jobStatus: 'Completed', needsAdminVerification: false };
                                                    if (!state.isDemoMode) {
                                                        await db.collection('jobs').doc(job.id).update(updates).catch(console.error);
                                                    }
                                                    dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } as any });
                                                    setIsEmailModalOpen(true);
                                                }}
                                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                                            >
                                                <CheckCircle2 size={16} />
                                                <span>Verify & Dispatch Billing Documents</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Verification Checklist Cards */}
                                    <div className="mt-4 pt-3 border-t border-amber-500/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-900/50 flex items-center gap-2 shadow-sm">
                                            <Clock size={16} className="text-amber-600 shrink-0" />
                                            <div>
                                                <p className="font-bold text-[11px]">1. Time Logs & Duration</p>
                                                <p className="text-[10px] text-slate-500">{job.timeOnSiteMinutes ? `${job.timeOnSiteMinutes}m on site` : 'Review in/out times'}</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-900/50 flex items-center gap-2 shadow-sm">
                                            <FileText size={16} className="text-amber-600 shrink-0" />
                                            <div>
                                                <p className="font-bold text-[11px]">2. Diagnosis & Notes</p>
                                                <p className="text-[10px] text-slate-500">{job.notes?.diagnosis ? 'Notes recorded' : 'Inspect tech notes'}</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-900/50 flex items-center gap-2 shadow-sm">
                                            <Camera size={16} className="text-amber-600 shrink-0" />
                                            <div>
                                                <p className="font-bold text-[11px]">3. Photos & Signatures</p>
                                                <p className="text-[10px] text-slate-500">{(job.files || []).length} site photos</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-900/50 flex items-center gap-2 shadow-sm">
                                            <DollarSign size={16} className="text-amber-600 shrink-0" />
                                            <div>
                                                <p className="font-bold text-[11px]">4. Pricing & Invoice</p>
                                                <p className="text-[10px] text-slate-500">${(job.invoice?.totalAmount || job.invoice?.amount || 0).toFixed(2)} Total</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 print:hidden">
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Appointment</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">{safeFormatDateTimeString(job.appointmentTime, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 print:hidden">
                                        <Wrench size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Technician</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {(() => {
                                                if (job.assignedTechnicianId) {
                                                    const tech = state.users?.find((u: any) => u.id === job.assignedTechnicianId);
                                                    if (tech) return `${tech.firstName} ${tech.lastName}`;
                                                }
                                                return job.assignedTechnicianName || 'Unassigned';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                                {((job as any).subcontractorPhone || job.subcontractorWorkOrder?.customSubPhone) && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 print:hidden">
                                            <Phone size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Subcontractor Phone</p>
                                            <a 
                                                href={`tel:${((job as any).subcontractorPhone || job.subcontractorWorkOrder?.customSubPhone).replace(/\D/g, '')}`}
                                                className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline print:text-black block font-mono"
                                            >
                                                {(job as any).subcontractorPhone || job.subcontractorWorkOrder?.customSubPhone}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {job.assistants && job.assistants.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 print:hidden">
                                            <Users size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Crew ({job.assistants.length})</p>
                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                {job.assistants.map((id: string) => {
                                                    const u = state.users?.find((user: any) => user.id === id);
                                                    return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
                                                }).join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center print:hidden ${
                                        timeSummary.formattedInTime 
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Arrived (In)</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {timeSummary.formattedInTime || <span className="text-slate-400 font-normal italic">Not Logged</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center print:hidden ${
                                        timeSummary.formattedOutTime 
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-650' 
                                            : (timeSummary.status === 'in_progress' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')
                                    }`}>
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Departed (Out)</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {timeSummary.formattedOutTime || (timeSummary.status === 'in_progress' ? <span className="text-amber-600 dark:text-amber-400 font-extrabold">Active On Site</span> : <span className="text-slate-400 font-normal italic">Not Logged</span>)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center print:hidden ${
                                        timeSummary.formattedDuration 
                                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Site Duration</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {timeSummary.formattedDuration || <span className="text-slate-400 font-normal italic">--</span>}
                                        </p>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={handleOpenTimeEditor}
                                        className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-slate-200 dark:border-slate-700 shrink-0 print:hidden cursor-pointer"
                                        title="Click to edit or adjust arrival/departure times"
                                    >
                                        <Clock size={12} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>Edit Times</span>
                                    </button>
                                )}
                                                      {/* Service Location details, Property info, Gate Code & Notes */}
                        </div>

                        {/* Collapsible Serviced Property Details Card */}
                        {(serviceLocation || job.poNumber || job.address) && (
                            <section className="bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-6 overflow-hidden">
                                <button 
                                    type="button"
                                    onClick={() => setIsPropertyExpanded(!isPropertyExpanded)}
                                    className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
                                            <MapPin size={16}/>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                                                Serviced Property & Location Details
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {resolveSiteLocationName(job, serviceLocation) || 'Property Location'} • {formatAddress(job.address)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsLocationAuditOpen(true);
                                            }}
                                            className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1"
                                            title="Click to view all work history, jobs & documents for this location"
                                        >
                                            View Location History & Docs ↗
                                        </button>
                                        {isPropertyExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                    </div>
                                </button>

                                {isPropertyExpanded && (
                                    <div className="p-6 pt-0 border-t border-slate-150/40 dark:border-slate-800 pl-8 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Street Address</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{formatAddress(job.address)}</p>
                                                </div>
                                                {serviceLocation?.gateCode && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gate Code / Access</p>
                                                        <p className="text-sm font-bold text-slate-850 dark:text-slate-200 mt-1 flex items-center gap-2">
                                                            <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold">{serviceLocation.gateCode}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                {serviceLocation?.notes && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Access Instructions</p>
                                                        <p className="text-xs italic text-slate-600 dark:text-slate-400 mt-1">{serviceLocation.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3 border-l border-slate-100 dark:border-slate-800 pl-6">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Billing Cross-Reference</p>
                                                    {job.poNumber ? (
                                                        <p className="mt-1 flex items-center gap-1.5">
                                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-md font-mono text-[10px] font-bold border border-emerald-250/20">PO/WO: {job.poNumber}</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic mt-1">No PO number associated with this location.</p>
                                                    )}
                                                </div>
                                                {job.locationName && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Billing Unit Name</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-350 mt-1">{job.locationName}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Property Contacts List */}
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-3">Associated Location Points of Contact (POCs)</p>
                                            {(() => {
                                                 const pocList: Array<{ name: string; phone?: string | null; email?: string | null; role: string }> = [];
                                                 
                                                 // Determine if the serviced location has its own contacts.
                                                 // If location contacts exist, we prioritize and show ONLY those contacts.
                                                 let hasLocationContacts = false;
                                                 const locId = job.locationId || serviceLocation?.id;
                                                 if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
                                                     customer.contacts.forEach((c: any) => {
                                                         if (c.name && c.allowedLocationIds?.includes(locId)) {
                                                             hasLocationContacts = true;
                                                             pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Site POC' });
                                                         }
                                                     });
                                                 }
                                                 if (serviceLocation?.contacts && Array.isArray(serviceLocation.contacts)) {
                                                     const validLocContacts = serviceLocation.contacts.filter((c: any) => c && c.name);
                                                     if (validLocContacts.length > 0) {
                                                         hasLocationContacts = true;
                                                         validLocContacts.forEach((c: any) => {
                                                             if (!pocList.some(p => p.name.trim().toLowerCase() === c.name.trim().toLowerCase())) {
                                                                 pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || 'Site POC' });
                                                             }
                                                         });
                                                     }
                                                 }

                                                 // Fall back to primary customer and account-level contacts only if no location contacts are defined.
                                                 if (!hasLocationContacts && !isSubcontractor) {
                                                     if (job.customerName && (job.customerPhone || job.customerEmail)) {
                                                         pocList.push({ name: job.customerName, phone: job.customerPhone, email: job.customerEmail, role: 'Primary Customer' });
                                                     }
                                                     if (customer?.contacts && Array.isArray(customer.contacts)) {
                                                         customer.contacts.forEach((c: any) => {
                                                             if (c.name) {
                                                                 pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Property Manager' });
                                                             }
                                                         });
                                                     }
                                                 }

                                                 const seenNames = new Set<string>();
                                                 const uniquePocs = pocList.filter(poc => {
                                                     const lowerName = poc.name.trim().toLowerCase();
                                                     if (seenNames.has(lowerName)) return false;
                                                     seenNames.add(lowerName);
                                                     return true;
                                                 }).slice(0, 3);

                                                if (uniquePocs.length === 0) {
                                                    return <p className="italic text-slate-400 text-xs">No contact POC documented for this job.</p>;
                                                }

                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {uniquePocs.map((poc, idx) => (
                                                            <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                                                                <p className="font-bold text-slate-805 dark:text-slate-200 text-xs flex items-center justify-between">
                                                                    <span>{poc.name}</span>
                                                                    <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-850 text-slate-500 px-1.5 py-0.5 rounded uppercase border border-slate-200/40">{poc.role}</span>
                                                                </p>
                                                                {poc.phone && <p className="text-[10px] text-slate-500 font-semibold mt-2">{poc.phone}</p>}
                                                                {poc.email && <p className="text-[10px] text-slate-450 truncate mt-0.5">{poc.email}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Property Level Photos */}
                                        {(() => {
                                            const propPhotos = [];
                                            if (serviceLocation) {
                                                const matchingAssetWithPropPhotos = jobAssets.find(a => a.wideLocationPhotoUrl || a.accessPointPhotoUrl);
                                                if (matchingAssetWithPropPhotos?.wideLocationPhotoUrl) {
                                                    propPhotos.push({ url: matchingAssetWithPropPhotos.wideLocationPhotoUrl, label: 'Property Front / Wide View' });
                                                }
                                                if (matchingAssetWithPropPhotos?.accessPointPhotoUrl) {
                                                    propPhotos.push({ url: matchingAssetWithPropPhotos.accessPointPhotoUrl, label: 'Access Path / Property Entry' });
                                                }
                                            }
                                            if (propPhotos.length === 0) return null;
                                            return (
                                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-3">Property Entry & Access Verification Photos</p>
                                                    <div className="flex flex-wrap gap-4">
                                                        {propPhotos.map((p, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setPreviewDoc({ fileUrl: p.url, name: p.label, type: 'Other' })}
                                                                    className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer p-0"
                                                                >
                                                                    <img src={p.url} className="w-full h-full object-cover hover:scale-105 transition-transform" alt={p.label} />
                                                                </button>
                                                                <span className="text-[9px] font-semibold text-slate-500 mt-1.5 uppercase text-center w-24 truncate">{p.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Site Visit & In/Out Time Audit Record */}
                        <section className="bg-white dark:bg-slate-900/90 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm mb-6 print:border-slate-300">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                            Site Visit & Time On Site Record
                                            {timeSummary.hasTimeRecorded ? (
                                                <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest ${
                                                    timeSummary.status === 'completed' 
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' 
                                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-300 dark:border-blue-800 animate-pulse'
                                                }`}>
                                                    {timeSummary.status === 'completed' ? 'Verified Logged' : 'Active On Site'}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                                    Pending / Not Logged
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                            Verified arrival & departure timestamps for this work order service.
                                        </p>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={handleOpenTimeEditor}
                                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs border border-slate-200 dark:border-slate-700 shrink-0 print:hidden cursor-pointer"
                                        title="Edit, adjust or backfill in/out times and visit duration for this record"
                                    >
                                        <Clock size={13} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>{timeSummary.hasTimeRecorded ? 'Edit / Correct Times' : '+ Log In & Out Times'}</span>
                                    </button>
                                )}
                            </div>

                            {/* Primary Times Summary Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-2">
                                {/* Check-In / Arrived */}
                                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                                            🟢 Check-In (Arrival)
                                        </span>
                                        {timeSummary.formattedInTime && (
                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                                                In
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                        {timeSummary.formattedInTime || <span className="text-slate-400 font-normal italic text-xs">Not recorded</span>}
                                    </p>
                                    {timeSummary.formattedInDate && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {timeSummary.formattedInDate}
                                        </p>
                                    )}
                                </div>

                                {/* Check-Out / Departed */}
                                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-400">
                                            🔴 Check-Out (Departure)
                                        </span>
                                        {timeSummary.formattedOutTime && (
                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.2 rounded">
                                                Out
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                        {timeSummary.formattedOutTime || (timeSummary.status === 'in_progress' ? <span className="text-amber-600 font-bold text-xs">In Progress / On Site</span> : <span className="text-slate-400 font-normal italic text-xs">Not recorded</span>)}
                                    </p>
                                    {timeSummary.formattedOutDate && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {timeSummary.formattedOutDate}
                                        </p>
                                    )}
                                </div>

                                {/* Duration On Site */}
                                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-400">
                                            ⏱️ Total Time On Site
                                        </span>
                                        {timeSummary.timeOnSiteMinutes && (
                                            <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded">
                                                {timeSummary.timeOnSiteMinutes}m
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                        {timeSummary.formattedDuration || <span className="text-slate-400 font-normal italic text-xs">--</span>}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                        {timeSummary.visits.length > 1 ? `${timeSummary.visits.length} Site Visits Logged` : 'Single Service Visit'}
                                    </p>
                                </div>
                            </div>

                            {/* Multi-Visit Breakdown List */}
                            {timeSummary.visits.length > 1 && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                        Detailed Visits Timeline ({timeSummary.visits.length} Visits)
                                    </span>
                                    <div className="space-y-1.5">
                                        {timeSummary.visits.map((visit, idx) => (
                                            <div key={visit.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="px-2 py-0.5 rounded-md font-mono text-[9px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                                        Visit #{idx + 1}
                                                    </span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {new Date(visit.checkInTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    {visit.method && (
                                                        <span className="text-[10px] text-slate-400">({visit.method})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-right">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        In: <strong className="text-emerald-600 dark:text-emerald-400">{new Date(visit.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
                                                        {visit.checkOutTime ? `  •  Out: ${new Date(visit.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ' (Active)'}
                                                    </span>
                                                    {visit.timeOnSiteMinutes !== null && visit.timeOnSiteMinutes !== undefined && (
                                                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                                            {visit.timeOnSiteMinutes >= 60 ? `${Math.floor(visit.timeOnSiteMinutes / 60)}h ${visit.timeOnSiteMinutes % 60}m` : `${visit.timeOnSiteMinutes}m`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>      </div>


                        {/* Direct Technician Recommendations */}
                        {job.techRecommendations && (
                            <section className="bg-emerald-50 dark:bg-emerald-950/15 p-6 rounded-[2rem] border-2 border-emerald-100 dark:border-emerald-900/50 shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                    <ShieldCheck size={60} className="text-emerald-700 dark:text-emerald-350" />
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <Wrench size={16}/>
                                    </div>
                                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">
                                        Direct Technician Recommendations
                                    </h4>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200 font-bold whitespace-pre-wrap leading-relaxed">
                                    {job.techRecommendations}
                                </p>
                            </section>
                        )}

                        {/* Serviced Systems & Asset Health Scoping (Separated per unit) */}
                        {jobAssets.length > 0 && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14} className="text-primary-500"/>
                                    Serviced Systems & Asset Health Scoping ({jobAssets.length} Units)
                                </h4>
                                <div className="space-y-4">
                                    {jobAssets.map((asset) => {
                                         const unitState = normalizeUnitStates(job.unitStates).find((s: any) => s.assetId === asset.id || s.id === asset.id);
                                         const healthBefore = unitState?.healthBefore || unitState?.health || asset.condition || 'Good';
                                         const healthAfter = unitState?.healthAfter || unitState?.health || 'Good';
                                         const isExpanded = !!expandedSystems[asset.id];
                                        
                                        // Retrieve matching job-level photos from job.files
                                         const matchingJobPhotos = photoFiles.filter((f: any) => {
                                             const fileAssetId = (f.metadata?.assetId || f.assetId || '').toLowerCase().trim();
                                             const fileLabel = (f.metadata?.label || f.label || '').toLowerCase().trim();
                                             const assetId = (asset.id || '').toLowerCase().trim();
                                             const assetTag = (asset.assetTag || '').toLowerCase().trim();
                                             const assetName = (asset.name || '').toLowerCase().trim();
                                             
                                             return (
                                                 (fileAssetId && assetId && fileAssetId === assetId) ||
                                                 (assetId && fileLabel === assetId) ||
                                                 (assetTag && fileLabel === assetTag) ||
                                                 (assetName && fileLabel === assetName) ||
                                                 (assetTag && fileLabel.includes(assetTag)) ||
                                                 (assetName && fileLabel.includes(assetName))
                                             );
                                         });
                                         
                                         // Retrieve photos uploaded to this asset directly on EquipmentAsset
                                         const assetPhotos = [];
                                         if (asset.serialPhotoUrl) assetPhotos.push({ url: asset.serialPhotoUrl, label: 'Serial Tag' });
                                         if (asset.unitTagPhotoUrl) assetPhotos.push({ url: asset.unitTagPhotoUrl, label: 'Unit Plate' });
                                         if (asset.conditionPhotoUrl) assetPhotos.push({ url: asset.conditionPhotoUrl, label: 'Condition' });
                                         if (asset.wideLocationPhotoUrl) assetPhotos.push({ url: asset.wideLocationPhotoUrl, label: 'Wide Location' });
                                         if (asset.accessPointPhotoUrl) assetPhotos.push({ url: asset.accessPointPhotoUrl, label: 'Access Path' });
                                         if (asset.qrCodePhotoUrl) assetPhotos.push({ url: asset.qrCodePhotoUrl, label: 'QR Tag' });
                                         
                                         // Merge matching job-level photos
                                         matchingJobPhotos.forEach((p: any) => {
                                             const url = p.dataUrl || p.url;
                                             const label = p.metadata?.label || p.label || 'Job Photo';
                                             if (url && !assetPhotos.some(ap => ap.url === url)) {
                                                 assetPhotos.push({ url, label });
                                             }
                                         });
                                        
                                        return (
                                            <div key={asset.id} id={`system-card-${asset.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                                                {/* Left decorative border color based on health */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                                                    healthAfter === 'Good' ? 'bg-emerald-500' :
                                                    healthAfter === 'Fair' ? 'bg-amber-500' :
                                                    healthAfter === 'Poor' ? 'bg-orange-500' :
                                                    'bg-rose-500'
                                                }`} />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedSystems(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))}
                                                    className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                                                >
                                                    <div className="pl-2">
                                                        <h5 className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                                            {asset.name || asset.type} {asset.brand ? `• ${asset.brand}` : ''} {asset.model ? `(${asset.model})` : ''}
                                                        </h5>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                                                            <span>Tag: {asset.assetTag || 'N/A'}</span>
                                                            <span>Serial: {asset.serial || 'N/A'}</span>
                                                            {asset.physicalLocation && <span>Location: {asset.physicalLocation}</span>}
                                                            {(() => {
                                                                const lat = typeof asset.gpsPin?.lat === 'number' ? asset.gpsPin.lat : (typeof asset.gpsLat === 'number' ? asset.gpsLat : undefined);
                                                                const lng = typeof asset.gpsPin?.lng === 'number' ? asset.gpsPin.lng : (typeof asset.gpsLng === 'number' ? asset.gpsLng : undefined);
                                                                if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                                                                    return (
                                                                        <a
                                                                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-mono lowercase tracking-normal hover:underline cursor-pointer"
                                                                            title="Open coordinates in Google Maps"
                                                                        >
                                                                            <Compass size={11} className="text-indigo-500 shrink-0" />
                                                                            <span>gps: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
                                                                            <ExternalLink size={10} className="opacity-70" />
                                                                        </a>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAssetForAssessment(asset);
                                                            }}
                                                            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-3.5 py-1.5 rounded-full text-xs font-black transition-all shadow-md cursor-pointer"
                                                        >
                                                            <Wrench size={13} />
                                                            <span>Unit Assessment (EPA & Temp Split)</span>
                                                        </button>
                                                        <label 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all"
                                                            title="Toggle whether this unit appears on the Work Order / Job Report PDF"
                                                        >
                                                            <input 
                                                                type="checkbox"
                                                                checked={unitState?.includeOnWorkOrder !== false}
                                                                onChange={(e) => {
                                                                    const newChecked = e.target.checked;
                                                                    const updated = [...(Array.isArray(job.unitStates) ? job.unitStates : (job.unitStates ? [job.unitStates] : []))];
                                                                    const idx = updated.findIndex(s => s.assetId === asset.id);
                                                                    if (idx > -1) {
                                                                        updated[idx] = { ...updated[idx], includeOnWorkOrder: newChecked };
                                                                    } else {
                                                                        updated.push({ assetId: asset.id, includeOnWorkOrder: newChecked });
                                                                    }
                                                                    setLocalUnitStates(updated);
                                                                    db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ unitStates: updated }));
                                                                    dispatch({ type: 'UPDATE_JOB', payload: { ...job, unitStates: updated } });
                                                                }}
                                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                                            />
                                                            <span className="text-[11px] text-slate-700 dark:text-slate-200">Include on Work Order</span>
                                                        </label>
                                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                                                            healthAfter === 'Good' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50' :
                                                            healthAfter === 'Fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50' :
                                                            healthAfter === 'Poor' ? 'bg-orange-100 text-orange-850 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/50' :
                                                            'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50'
                                                        }`}>
                                                            System Health: {healthBefore === healthAfter ? healthAfter : `${healthBefore} ➔ ${healthAfter}`}
                                                        </span>
                                                        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                                    </div>
                                                </button>
                                                
                                                {isExpanded && (
                                                    <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 pl-8 space-y-6">
                                                        {/* Unit Technical Specifications & Details */}
                                                        {(() => {
                                                            const specs = [
                                                                { label: 'Area Serviced', value: asset.servesArea },
                                                                { label: 'Exact Placement', value: asset.exactPlacement },
                                                                { label: 'Physical Location', value: asset.physicalLocation },
                                                                { label: 'System Type', value: asset.type },
                                                                { label: 'Tonnage / Capacity', value: asset.tonnage ? `${asset.tonnage} Tons` : null },
                                                                { label: 'Refrigerant', value: asset.refrigerantType },
                                                                { label: 'Electrical', value: asset.electricityType },
                                                                { label: 'Heat Type', value: asset.heatType },
                                                                { label: 'MFR Year', value: asset.year },
                                                                { label: 'Install Date', value: asset.installDate },
                                                            ].filter(spec => spec.value);

                                                            const warrantyInfo = [];
                                                            if (asset.warranty?.manufacturerDurationMonths) {
                                                                warrantyInfo.push({
                                                                    label: 'MFR Warranty',
                                                                    value: `${asset.warranty.manufacturerDurationMonths} Mos` + (asset.warranty.manufacturerStartDate ? ` (Starts: ${asset.warranty.manufacturerStartDate})` : '')
                                                                });
                                                            }
                                                            if (asset.warranty?.laborDurationMonths) {
                                                                warrantyInfo.push({
                                                                    label: 'Labor Warranty',
                                                                    value: `${asset.warranty.laborDurationMonths} Mos` + (asset.warranty.laborStartDate ? ` (Starts: ${asset.warranty.laborStartDate})` : '')
                                                                });
                                                            }

                                                            const linkedAssets = customer?.equipment?.filter((eq: any) => asset.linkedAssetIds?.includes(eq.id)) || [];

                                                            const hasSpecs = specs.length > 0 || warrantyInfo.length > 0 || asset.notes || linkedAssets.length > 0;

                                                            if (!hasSpecs) return null;

                                                            return (
                                                                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 mt-6">
                                                                    <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                                                        <Info size={12} />
                                                                        Unit Specifications & System Details
                                                                    </p>
                                                                    {specs.length > 0 && (
                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                            {specs.map((s, i) => (
                                                                                <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{s.label}</p>
                                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 truncate" title={s.value}>
                                                                                        {s.value}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {warrantyInfo.length > 0 && (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                                            {warrantyInfo.map((w, i) => (
                                                                                <div key={i} className="p-3 bg-indigo-600/5 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/30 dark:border-indigo-950/30 shadow-sm flex justify-between items-center">
                                                                                    <div>
                                                                                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-wider">{w.label}</p>
                                                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{w.value}</p>
                                                                                    </div>
                                                                                    {asset.warranty?.requiresMaintenance && (
                                                                                        <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Maint. Req</span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {linkedAssets.length > 0 && (
                                                                        <div className="p-3.5 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-150/40 dark:border-slate-850/40 mt-2">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-2">Linked Systems / Related Equipment</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {linkedAssets.map((la: any) => {
                                                                                    const isServiced = jobAssets.some(ja => ja.id === la.id);
                                                                                    return (
                                                                                        <button
                                                                                            key={la.id}
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                if (isServiced) {
                                                                                                    setExpandedSystems(prev => ({ ...prev, [la.id]: true }));
                                                                                                    const el = document.getElementById(`system-card-${la.id}`);
                                                                                                    if (el) {
                                                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            disabled={!isServiced}
                                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                                                                isServiced 
                                                                                                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200/50 hover:bg-indigo-100 hover:scale-[1.02] cursor-pointer' 
                                                                                                : 'bg-slate-105 text-slate-400 dark:bg-slate-950 dark:text-slate-600 border border-slate-200/30 cursor-not-allowed'
                                                                                            }`}
                                                                                            title={isServiced ? 'Click to jump to this system\'s checklist & details' : 'This linked system was not serviced during this appointment'}
                                                                                        >
                                                                                            <Wrench size={10} />
                                                                                            <span>{la.name || la.type || 'Linked Unit'}</span>
                                                                                            {la.brand && <span className="opacity-60">• {la.brand}</span>}
                                                                                            {la.serial && <span className="opacity-60">({la.serial})</span>}
                                                                                            {isServiced ? (
                                                                                                <span className="text-[8px] font-black bg-indigo-200/50 dark:bg-indigo-900/60 px-1 py-0.2 rounded uppercase">Serviced</span>
                                                                                            ) : (
                                                                                                <span className="text-[8px] font-black bg-slate-200/50 dark:bg-slate-800/60 px-1 py-0.2 rounded uppercase">Not Serviced</span>
                                                                                            )}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {asset.notes && (
                                                                        <div className="p-3 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-150/40 dark:border-slate-800/40 mt-2">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Asset Notes</p>
                                                                            <p className="text-xs text-slate-600 dark:text-slate-350 mt-1 font-medium italic">"{asset.notes}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Structured diagnostics/notes grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                                                            {/* Diagnosis */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-primary-500 uppercase tracking-widest mb-1.5">Diagnosis Findings</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.diagnosis || <span className="text-slate-400 italic">No specific issues detected during diagnosis.</span>}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Repairs */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Repairs & Adjustments</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.repair || <span className="text-slate-400 italic">No repairs or active fixes required for this visit.</span>}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Recommendations */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-purple-600 uppercase tracking-widest mb-1.5">System Recommendations</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.recommendations || <span className="text-slate-400 italic">System in good working order. Continue routine service.</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Unit photos inside card */}
                                                        {assetPhotos.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 pl-2">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Verification Photos ({asset.name || asset.type})</p>
                                                                <div className="flex flex-wrap gap-3">
                                                                    {assetPhotos.map((photo, index) => (
                                                                        <div key={index} className="flex flex-col items-center">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => setPreviewDoc({ fileUrl: photo.url, name: photo.label, type: 'Other' })} 
                                                                                className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer block p-0"
                                                                            >
                                                                                <img src={photo.url} className="w-full h-full object-cover hover:scale-105 transition-transform" alt={photo.label} />
                                                                            </button>
                                                                            <span className="text-[8px] font-semibold text-slate-500 mt-1 uppercase text-center w-20 truncate">{photo.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}


                        {/* Tasks Section */}
                        <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500"/> Tasks Performed
                            </h4>

                            <div className="flex flex-wrap gap-2">
                                {job.tasks.map((t, i) => (
                                    <span key={i} className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700 print:border-slate-200 print:text-black">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </section>

                        {/* Parts Used Section */}
                        {job.partsUsed && job.partsUsed.length > 0 && (
                            <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package size={14} className="text-amber-500"/> Parts & Materials Used
                                </h4>
                                <div className="space-y-2">
                                    {job.partsUsed.map((part, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm print:border-slate-200">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white print:text-black">{part.name}</p>
                                                {part.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {part.sku}</p>}
                                                {part.location && <p className="text-[9px] text-primary-500 font-bold uppercase">{part.location}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-white print:text-black">Qty: {part.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Service Checklists */}
                        {(() => {
                            const diagItems = (() => {
                                if (job.notes?.diagnosisChecklist && job.notes.diagnosisChecklist !== '[]') {
                                    try { return JSON.parse(job.notes.diagnosisChecklist); } catch { return []; }
                                }
                                if (job.requiredDiagnosisChecklistIds && job.requiredDiagnosisChecklistIds.length > 0) {
                                    const templates = job.embeddedData?.inspectionTemplates || state.inspectionTemplates || [];
                                    return job.requiredDiagnosisChecklistIds.flatMap(id => {
                                        const t = templates.find((tpl: any) => tpl.id === id);
                                        return t ? t.items.map((i: any, idx: number) => ({
                                            id: `auto-${t.id}-${idx}`,
                                            label: i.label,
                                            completed: false,
                                            hiddenFromCustomer: false
                                        })) : [];
                                    });
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const qualItems = (() => {
                                if (job.notes?.qualityChecklist && job.notes.qualityChecklist !== '[]') {
                                    try { return JSON.parse(job.notes.qualityChecklist); } catch { return []; }
                                }
                                if (job.requiredQualityChecklistIds && job.requiredQualityChecklistIds.length > 0) {
                                    const templates = job.embeddedData?.inspectionTemplates || state.inspectionTemplates || [];
                                    return job.requiredQualityChecklistIds.flatMap(id => {
                                        const t = templates.find((tpl: any) => tpl.id === id);
                                        return t ? t.items.map((i: any, idx: number) => ({
                                            id: `auto-${t.id}-${idx}`,
                                            label: i.label,
                                            completed: false,
                                            hiddenFromCustomer: false
                                        })) : [];
                                    });
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const generalItems = (() => {
                                if (job.notes?.checklist && job.notes.checklist !== '[]') {
                                    try { return JSON.parse(job.notes.checklist); } catch { return []; }
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const hasChecklists = (emailOptions.includeDiagnosisChecklist && diagItems.length > 0) || 
                                                  (emailOptions.includeQualityChecklist && qualItems.length > 0) || 
                                                  generalItems.length > 0;
                            if (!hasChecklists) return null;

                            return (
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle size={14} className="text-primary-500"/> Service Checklists & Compliance
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Diagnosis Checklist */}
                                        {emailOptions.includeDiagnosisChecklist && diagItems.length > 0 && (() => {
                                            const visibleItems = diagItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                                    <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-4">Diagnosis Checklist</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Quality Checklist */}
                                        {emailOptions.includeQualityChecklist && qualItems.length > 0 && (() => {
                                            const visibleItems = qualItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter mb-4">Quality & Safety Audit</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* General Job Checklist */}
                                        {generalItems.length > 0 && (() => {
                                            const visibleItems = generalItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200 col-span-1 md:col-span-2">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter mb-4">Job Service Checklist</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </section>
                            );
                        })()}

                        {/* Detailed Notes Matrix */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14}/> Technician Field Notes
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {typeof job.notes === 'object' && job.notes && [
                                    { label: 'Arrival Note', value: job.notes?.arrival },
                                    { label: 'Diagnosis', value: job.notes?.diagnosis },
                                    { label: 'Work Performed', value: job.notes?.work || job.notes?.workNotes },
                                    { label: 'Completion Notes', value: job.notes?.completion },
                                    { label: 'Customer Feedback (Notes)', value: job.notes?.customerFeedback },
                                    { label: 'Employee/Tech Feedback', value: job.notes?.employeeFeedback || job.notes?.feedback }
                                ].map((note, idx) => {
                                    if (!note.value) return null;
                                    return (
                                        <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">{note.label}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed print:text-black">{note.value}</p>
                                        </div>
                                    );
                                })}
                                {typeof job.notes === 'string' && job.notes && (
                                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200 col-span-2">
                                        <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">Service Notes</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed print:text-black">{job.notes}</p>
                                    </div>
                                )}
                                {(!job.notes || (typeof job.notes === 'object' && Object.values(job.notes).every(v => !v)) || (typeof job.notes === 'string' && !job.notes)) && (
                                    <p className="text-xs text-slate-400 italic col-span-2 p-4 text-center">No field notes were recorded for this service.</p>
                                )}
                            </div>
                        </section>

                        {/* Visit & Clock History */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14}/> Visit & Clock History ({timeSummary.visits.length})
                                </h4>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={handleOpenTimeEditor}
                                        className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline print:hidden cursor-pointer"
                                    >
                                        {timeSummary.hasTimeRecorded ? 'Edit In/Out Times' : '+ Log Times'}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm print:border-slate-200">
                                {timeSummary.visits.length > 0 ? (
                                    timeSummary.visits.map((entry, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-b-0 last:pb-0">
                                            <div className="space-y-1">
                                                <span className="font-black text-slate-400 dark:text-slate-500 uppercase text-[9px] tracking-wider block">Visit #{idx + 1}</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                    {new Date(entry.checkInTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium text-slate-650 dark:text-slate-400">
                                                    In: {new Date(entry.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    {entry.checkOutTime ? ` | Out: ${new Date(entry.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ' (Active)'}
                                                </div>
                                                {entry.timeOnSiteMinutes !== undefined && entry.timeOnSiteMinutes !== null && (
                                                    <span className="text-[10px] font-black text-primary-500 dark:text-primary-400 uppercase tracking-wider block mt-0.5">
                                                        {entry.timeOnSiteMinutes >= 60 
                                                            ? `${Math.floor(entry.timeOnSiteMinutes / 60)}h ${entry.timeOnSiteMinutes % 60}m`
                                                            : `${entry.timeOnSiteMinutes}m`
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-xs text-slate-400 italic">
                                        No check-in or arrival/departure timestamps were recorded for this service.
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* CompanyCam Integration */}
                        <CompanyCamGallery 
                            jobId={job.id} 
                            orgId={job.organizationId} 
                            address={formatAddress(job.address)} 
                        />

                        {/* IoT Smart Diagnostics */}
                        <section className="space-y-4 print:hidden">
                            <IoTDiagnosticsViewer 
                                jobId={job.id} 
                                customerName={job.customerName} 
                                orgId={job.organizationId} 
                            />
                        </section>

                        {/* Refrigerant & Technical Data */}
                        {( (job.refrigerantLog && job.refrigerantLog.length > 0) || (job.toolReadings && job.toolReadings.length > 0) || (job.qcAudits && job.qcAudits.length > 0) || (diagnostics.length > 0) ) && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14}/> Technical, Environmental & QC Data
                                </h4>
                                <div className="space-y-4">
                                    {/* MeasureQuick Diagnostics */}
                                    {diagnostics && diagnostics.length > 0 && (
                                        <div className="space-y-3">
                                            {diagnostics.map((diag, i) => (
                                                <div key={i} className="p-5 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-3xl print:bg-white print:border-slate-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                                        <Thermometer size={60} />
                                                    </div>
                                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-xl bg-purple-200 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300">
                                                                <Thermometer size={14}/>
                                                            </div>
                                                            <div>
                                                                <h5 className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                                                                    {diag.source === 'measureQuick' ? 'measureQuick Diagnostics' : 'Field Diagnostics'}
                                                                </h5>
                                                                {diag.systemType && <p className="text-[9px] font-bold text-slate-500 uppercase">{diag.systemType}</p>}
                                                            </div>
                                                        </div>
                                                        {diag.healthScore !== undefined && diag.healthScore !== null && (
                                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm border ${diag.healthScore >= 80 ? 'bg-emerald-500 border-emerald-400 text-white' : diag.healthScore >= 50 ? 'bg-amber-500 border-amber-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}>
                                                                System Health: {diag.healthScore}/100
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {diag.measurements && Object.keys(diag.measurements).length > 0 && (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 relative z-10">
                                                            {Object.entries(diag.measurements).map(([key, val]) => (
                                                                <div key={key} className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-purple-100/80 dark:border-purple-900/40 text-left shadow-sm">
                                                                    <p className="text-[9px] uppercase font-black text-slate-500 mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                                                    <p className="text-lg font-black text-purple-900 dark:text-purple-100 tracking-tight">{val as string | number}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {diag.diagnostics && diag.diagnostics.length > 0 && (
                                                        <div className="mb-4 space-y-1 relative z-10">
                                                            <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">Automated Analysis</p>
                                                            {diag.diagnostics.map((d, index) => (
                                                                <p key={index} className="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> {d}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {diag.pdfReportUrl && (
                                                        <a href={diag.pdfReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 text-[10px] w-full lg:w-auto font-black uppercase text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-500/20 px-5 py-2.5 rounded-xl transition-all relative z-10">
                                                            <FileText size={14}/> Download Official PDF Report 
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* AI Quality Audits */}
                                    {job.qcAudits && job.qcAudits.length > 0 && (
                                        <div className="space-y-3">
                                            {job.qcAudits.map((audit, i) => (
                                                <div key={i} className={`p-5 rounded-3xl border-2 print:border-slate-200 print:bg-white ${
                                                    audit.status === 'pass' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 
                                                    audit.status === 'fail' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 
                                                    'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                                                }`}>
                                                    <div className="flex items-start gap-4">
                                                        {audit.imageUrl && (
                                                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-sm border border-white dark:border-slate-800 flex-shrink-0 print:border-slate-200">
                                                                <img src={audit.imageUrl} className="w-full h-full object-cover" alt="QC Visual" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <h5 className="text-[10px] font-black text-primary-500 uppercase tracking-tighter">AI Visual QC Audit</h5>
                                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                    audit.status === 'pass' ? 'bg-emerald-500 text-white' : 
                                                                    audit.status === 'fail' ? 'bg-red-500 text-white' : 
                                                                    'bg-amber-500 text-white'
                                                                }`}>
                                                                    {audit.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed print:text-black">{audit.comments}</p>
                                                            <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">{new Date(audit.timestamp).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Parts Used */}
                                    {job.partsUsed && job.partsUsed.length > 0 && (
                                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Package size={14}/> Parts & Materials Consumed
                                            </p>
                                            <div className="space-y-2">
                                                {job.partsUsed.map((part, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{part.name}</span>
                                                            <p className="text-[8px] text-blue-500 uppercase font-black">Location: {part.location || 'Truck Stock'}</p>
                                                        </div>
                                                        <span className="font-black text-blue-700 dark:text-blue-300 print:text-black">Qty: {part.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Refrigerant Log */}
                                    {job.refrigerantLog && job.refrigerantLog.length > 0 && (
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Droplets size={14}/> Refrigerant Management Log
                                            </p>
                                            <div className="space-y-2">
                                                {job.refrigerantLog.map((entry, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{entry.type} {entry.action}</span>
                                                            {entry.cylinderNumber && <p className="text-[8px] text-indigo-500 uppercase font-black">Cylinder: {entry.cylinderNumber}</p>}
                                                        </div>
                                                        <span className="font-black text-indigo-700 dark:text-indigo-300 print:text-black">{entry.amount} {entry.unit || 'lbs'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tool Readings */}
                                    {job.toolReadings && job.toolReadings.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {job.toolReadings.map((reading, i) => (
                                                <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center gap-4 shadow-sm print:border-slate-200">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary-500 print:hidden">
                                                        <Thermometer size={18}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{reading.toolType}</p>
                                                        <p className="text-sm font-black text-slate-800 dark:text-white print:text-black">{reading.summary}</p>
                                                        {reading.reportUrl && (
                                                            <div className="mt-1 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-bold print:hidden">
                                                                <a href={reading.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                                                    <FileText size={12} />
                                                                    <span>View Attachment</span>
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column: Financials & Documentation */}
                    <div className="space-y-8">
                        {/* Financial Summary */}
                        <section className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden print:bg-white print:border-slate-200">
                            <div className="absolute top-0 right-0 p-8 opacity-10 print:hidden">
                                <DollarSign size={80} className="text-emerald-900 dark:text-emerald-100" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest print:text-slate-600">Job Invoice Total</p>
                                    {isAdmin && onEditInvoice && (
                                        <button onClick={onEditInvoice} className="text-[10px] text-primary-600 hover:underline font-black uppercase tracking-tighter print:hidden">Adjust Invoice</button>
                                    )}
                                </div>
                                <p className="text-4xl font-black text-emerald-900 dark:text-emerald-100 tracking-tight mb-4 print:text-black">
                                    ${(job.invoice?.totalAmount || 0).toFixed(2)}
                                </p>
                                
                                <div className="flex items-center gap-2 mb-6">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm print:border print:border-slate-300 ${
                                        job.invoice?.status === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                        {job.invoice?.status || 'Unpaid'}
                                    </span>
                                    {job.invoice?.paidDate && (
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-bold uppercase truncate print:text-black">
                                            Paid {new Date(job.invoice.paidDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                 {/* Line Items Preview */}
                                 {job.invoice?.items && job.invoice.items.length > 0 && (
                                     <div className="space-y-2 border-t border-emerald-200/50 dark:border-emerald-900/30 pt-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin print:max-h-none print:overflow-visible">
                                         {job.invoice?.items?.map((item, i) => {
                                             const itemQty = Number(item.quantity) || 1;
                                             const itemUnitPrice = Number(item.unitPrice) || 0;
                                             const itemTotal = Number(item.total != null ? item.total : (itemQty * itemUnitPrice));
                                             return (
                                                 <div key={i} className="flex justify-between items-start text-[11px]">
                                                     <div className="flex-1 pr-2">
                                                         <p className="font-black text-emerald-900 dark:text-emerald-200 uppercase print:text-black">{item.name || item.description || 'Line Item'}</p>
                                                         <p className="text-slate-500 italic">Qty: {itemQty} {item.unitPrice != null ? `@ $${itemUnitPrice.toFixed(2)} / unit` : ''}</p>
                                                     </div>
                                                     <p className="font-bold text-emerald-800 dark:text-emerald-300 print:text-black">${itemTotal.toFixed(2)}</p>
                                                 </div>
                                             );
                                         })}
                                     </div>
                                 )}
                                
                                {job.invoice && (() => {
                                     const invSubtotal = (job.invoice.subtotal !== undefined && job.invoice.subtotal !== null) ? job.invoice.subtotal : (job.invoice.items || []).reduce((s, i) => s + ((i.quantity || 1) * (i.unitPrice || 0)), 0);
                                     const invTax = (job.invoice.taxAmount !== undefined && job.invoice.taxAmount !== null) ? job.invoice.taxAmount : 0;
                                     const addFee = Number(job.invoice.additionalFeeAmount || 0);
                                     const invGrandTotal = (job.invoice.totalAmount !== undefined && job.invoice.totalAmount !== null && Number(job.invoice.totalAmount) > 0) ? Number(job.invoice.totalAmount) : (invSubtotal + invTax + addFee);
                                     const invPaid = Number(job.invoice.amountPaid || 0);
                                     const invBalance = Math.max(0, invGrandTotal - invPaid);
                                     const taxRatePctStr = ((job.invoice.taxRate || 0.0825) * 100).toFixed(2).replace(/\.00$/, '');

                                     return (
                                         <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-900/30 text-xs space-y-1 text-right">
                                             <div className="flex justify-between text-emerald-900 dark:text-emerald-200">
                                                 <span className="font-bold uppercase text-[10px]">Subtotal</span>
                                                 <span className="font-black">${invSubtotal.toFixed(2)}</span>
                                             </div>
                                             <div className="flex justify-between text-emerald-900 dark:text-emerald-200">
                                                 <span className="font-bold uppercase text-[10px]">Sales Tax ({taxRatePctStr}%)</span>
                                                 <span className="font-black">${invTax.toFixed(2)}</span>
                                             </div>
                                             <div className="flex justify-between text-emerald-950 dark:text-white pt-1 border-t border-emerald-200/30 font-bold">
                                                 <span className="font-black uppercase text-[10px]">Total</span>
                                                 <span className="font-black text-sm">${invGrandTotal.toFixed(2)}</span>
                                             </div>
                                             {invPaid > 0 && (
                                                 <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                                                     <span className="font-bold uppercase text-[10px]">Previously Paid (Deposit or Partial Payments)</span>
                                                     <span className="font-black">-${invPaid.toFixed(2)}</span>
                                                 </div>
                                             )}
                                             {invPaid > 0 && (
                                                 <div className="flex justify-between text-blue-900 dark:text-blue-200 pt-1 font-bold">
                                                     <span className="font-black uppercase text-[10px]">Balance Remaining Due</span>
                                                     <span className="font-black text-sm">${invBalance.toFixed(2)}</span>
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })()}

                                 {/* On-Site Customer Service Sign-Off */}
                                 {((currentJob || job).customerSignature || (currentJob || job as any).siteManagerSignature || (currentJob || job as any).signOff?.sheetUrl || (currentJob || job).signOffSheetUrl || (currentJob || job as any).signoffSheetUrl || (currentJob || job).signature) && (
                                     <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                         <div className="flex items-center justify-between mb-2">
                                             <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                 ✍️ On-Site Service Acceptance & Sign-off
                                             </p>
                                             <button
                                                 type="button"
                                                 onClick={() => downloadStandaloneSignOffPdf(currentJob || job, state.currentOrganization)}
                                                 className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-xs cursor-pointer"
                                             >
                                                 <Download size={11} />
                                                 Download Sign-Off PDF
                                             </button>
                                         </div>
                                         <DigitalSignatureStamp 
                                             signatureUrl={(currentJob || job).customerSignature || (currentJob || job as any).siteManagerSignature || (currentJob || job as any).signOff?.sheetUrl || (currentJob || job).signOffSheetUrl || (currentJob || job as any).signoffSheetUrl || (currentJob || job).signature}
                                             signedByName={(currentJob || job).customerSignatureName || (currentJob || job as any).siteManagerName || (currentJob || job as any).signOff?.managerName || (currentJob || job).signerName || (currentJob || job).customerName || 'Customer / Site Manager'}
                                             signedAt={(currentJob || job as any).signOff?.timestamp || (currentJob || job).signatureTimestamp || (currentJob || job).signedAt}
                                             geolocation={(currentJob || job as any).signatureMetadata?.geolocation}
                                             securityHash={(currentJob || job as any).signatureMetadata?.securityHash}
                                             documentTitle={`On-Site Sign-Off (WO #${(currentJob || job).poNumber || (currentJob || job).id})`}
                                         />
                                     </div>
                                 )}

                                 {/* Technician Certification Sign-Off */}
                                 {((currentJob || job).techSignature || (currentJob || job as any).workflowState?.techSignature) && (
                                     <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                         <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                             🧑‍🔧 Technician Certification & Verification
                                         </p>
                                         <DigitalSignatureStamp 
                                             signatureUrl={(currentJob || job).techSignature || (currentJob || job as any).workflowState?.techSignature}
                                             signedByName={(currentJob || job).techSignatureName || (currentJob || job as any).workflowState?.techSignatureName || (currentJob || job).assignedTechnicianName || 'Certified Technician'}
                                             signedAt={(currentJob || job as any).techSignatureTimestamp || (currentJob || job as any).workflowState?.techSignatureTimestamp || (currentJob || job).updatedAt}
                                             documentTitle={`Technician Certification (WO #${(currentJob || job).poNumber || (currentJob || job).id})`}
                                         />
                                     </div>
                                 )}

                                 {/* Customer Signature for Invoice */}
                                 {((currentJob || job).invoiceSignature || ((currentJob || job).invoice as any)?.signatureUrl) && (
                                     <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                         <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                             💳 Billing & Invoice Authorization
                                         </p>
                                         <DigitalSignatureStamp 
                                             signatureUrl={(currentJob || job).invoiceSignature || ((currentJob || job).invoice as any)?.signatureUrl}
                                             signedByName={(currentJob || job).customerName || 'Customer'}
                                             signedAt={(currentJob || job).invoiceSignedDate || ((currentJob || job).invoice as any)?.signedAt}
                                             geolocation={(currentJob || job).signatureMetadata?.geolocation || ((currentJob || job).invoice as any)?.signatureMetadata?.geolocation}
                                             securityHash={(currentJob || job).signatureMetadata?.securityHash || ((currentJob || job).invoice as any)?.signatureMetadata?.securityHash}
                                             documentTitle={`Invoice #${(currentJob || job).invoice?.id || (currentJob || job).id}`}
                                         />
                                     </div>
                                 )}

                                 {/* Archived Signature History Button */}
                                 {((job.signatureHistory && job.signatureHistory.length > 0) || ((job.invoice as any)?.signatureHistory && (job.invoice as any)?.signatureHistory.length > 0)) && (
                                     <div className="mt-4">
                                         <button
                                             type="button"
                                             onClick={() => setIsAuditHistoryOpen(true)}
                                             className="text-xs text-purple-700 dark:text-purple-300 font-bold hover:underline flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800"
                                         >
                                             <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400" />
                                             <span>View Signature Audit History ({(job.signatureHistory || (job.invoice as any)?.signatureHistory || []).length} Archived Versions)</span>
                                         </button>
                                     </div>
                                 )}
                            </div>
                        </section>

                        {/* Warranty Coverage */}
                        {((job.invoice as Record<string, unknown>)?.workmanshipWarrantyMonths as number > 0 || (job.invoice as Record<string, unknown>)?.partsWarrantyMonths as number > 0) && (() => {
                            const inv = job.invoice as Record<string, unknown>;
                            const wm: number = (inv?.workmanshipWarrantyMonths as number) || 0;
                            const pm: number = (inv?.partsWarrantyMonths as number) || 0;
                            const agreed: boolean = !!inv?.warrantyDisclaimerAgreed;
                            const issued = inv?.warrantyIssuedDate ? new Date(inv.warrantyIssuedDate as string) : new Date(job.appointmentTime);
                            const now = new Date();
                            const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
                            const wmExpiry = wm > 0 ? addMonths(issued, wm) : null;
                            const pmExpiry = pm > 0 ? addMonths(issued, pm) : null;
                            const monthsLeft = (d: Date | null) => d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : 0;
                            const wmActive = agreed && !!wmExpiry && wmExpiry > now;
                            const pmActive = agreed && !!pmExpiry && pmExpiry > now;

                            const getWidthClass = (percent: number) => {
                                if (percent <= 0) return 'w-0';
                                if (percent <= 10) return 'w-[10%]';
                                if (percent <= 20) return 'w-[20%]';
                                if (percent <= 30) return 'w-[30%]';
                                if (percent <= 40) return 'w-[40%]';
                                if (percent <= 50) return 'w-1/2';
                                if (percent <= 60) return 'w-[60%]';
                                if (percent <= 70) return 'w-[70%]';
                                if (percent <= 80) return 'w-[80%]';
                                if (percent <= 90) return 'w-[90%]';
                                return 'w-full';
                            };
                            return (
                                <section className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-sm print:bg-white print:border-slate-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Warranty Coverage</p>
                                        {!agreed && (
                                            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">Disclaimer Pending</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {wm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Workmanship</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {wmActive ? monthsLeft(wmExpiry) : '—'}
                                                    {wmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {wmExpiry && <p className="text-[9px] text-slate-400 mt-1">{wmActive ? `Exp. ${wmExpiry.toLocaleDateString()}` : `Expired ${wmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${wmActive ? 'bg-blue-500' : 'bg-slate-300'} ${getWidthClass(wmActive ? Math.min(100, (monthsLeft(wmExpiry) / wm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                        {pm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Parts</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {pmActive ? monthsLeft(pmExpiry) : '—'}
                                                    {pmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {pmExpiry && <p className="text-[9px] text-slate-400 mt-1">{pmActive ? `Exp. ${pmExpiry.toLocaleDateString()}` : `Expired ${pmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${pmActive ? 'bg-emerald-500' : 'bg-slate-300'} ${getWidthClass(pmActive ? Math.min(100, (monthsLeft(pmExpiry) / pm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {inv?.warrantyNotes && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic border-t border-blue-100 dark:border-blue-900/20 pt-3 mt-1">{inv.warrantyNotes as string}</p>
                                    )}
                                    {!agreed && (
                                        <p className="text-[10px] text-amber-600 font-bold mt-2">⚠️ Warranty not yet active — disclaimer agreement required.</p>
                                    )}
                                </section>
                            );
                        })()}

                        {photoFiles.length > 0 && (
                            <section className="mb-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Job Photos</h4>
                                <div className="space-y-4">
                                    {Object.entries(groupedPhotos).map(([label, photos]) => (
                                        <div key={label}>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 inline-block">{label}</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                {(photos as ExtendedFile[]).map((f: ExtendedFile, i: number) => {
                                                     const imgUrl = f.dataUrl || f.url || f.fileUrl;
                                                     return (
                                                         <div key={i} className="relative group">
                                                             <a href={imgUrl} target="_blank" rel="noreferrer" className="aspect-square bg-white dark:bg-slate-800 rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all block shadow-sm border border-slate-100 dark:border-slate-800">
                                                                 <img src={imgUrl} className="w-full h-full object-cover" alt={`Job Documentation - ${label}`} />
                                                             </a>
                                                             {isAdmin && (
                                                                 <button 
                                                                     onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePhoto(f); }}
                                                                     className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10"
                                                                     title="Delete Photo"
                                                                 >
                                                                     <Trash2 size={12}/>
                                                                 </button>
                                                             )}
                                                         </div>
                                                     );
                                                 })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Proposals, Invoices & Documentation */}
                        {(docFiles.length > 0 || (job.embeddedData?.waivers && job.embeddedData.waivers.length > 0) || job.waivers || proposal || job.invoice) && (
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-primary-500"/> Documentation & Invoices
                                </h4>
                                <div className="space-y-2">
                                    {/* Job Invoice / Receipt */}
                                    {job.invoice && (
                                        <button 
                                            type="button" 
                                            onClick={() => setPreviewDoc({ ...job, type: 'Invoice' })} 
                                            className="w-full text-left p-3 px-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center justify-between hover:bg-emerald-100 hover:text-emerald-700 transition-all shadow-sm cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2"><FileText size={12}/> {job.invoice.status === 'Paid' ? 'Official Receipt' : `Service Invoice (${job.invoice.status || 'Unpaid'})`}</span>
                                            <span className="text-emerald-500 font-bold">VIEW</span>
                                        </button>
                                    )}

                                    {/* Signed Proposal */}
                                    {proposal && (() => {
                                        const sig = (proposal as Record<string, unknown>).signatureDataUrl || (proposal as Record<string, unknown>).signatureImage || (proposal as Record<string, unknown>).signature;
                                        const isSigned = !!sig;
                                        return (
                                            <button onClick={() => setPreviewDoc({ ...proposal, type: 'Proposal', title: isSigned ? 'Signed Proposal' : 'Proposal' })} className="w-full text-left p-3 px-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <span className="flex items-center gap-2"><FileText size={12}/> {isSigned ? 'Signed Proposal' : 'Proposal'}</span>
                                                <span className={isSigned ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>{isSigned ? 'SIGNED' : 'UNSIGNED'}</span>
                                            </button>
                                        );
                                    })()}

                                    {/* Waivers list from job.waivers, job.embeddedData.waivers, and job.requiredWaiverIds */}
                                    {(() => {
                                        // 1. Resolve required waivers from state.documents using requiredWaiverIds
                                        const resolvedRequiredWaivers = (job.requiredWaiverIds || []).map(id => {
                                            const template = (job.embeddedData?.waivers || state.documents || []).find((d: any) => d.id === id);
                                            if (template) {
                                                return {
                                                    id: template.id,
                                                    title: template.title || 'Legal Waiver',
                                                    content: template.content,
                                                    type: 'Waiver Template'
                                                };
                                            }
                                            return null;
                                        }).filter(Boolean) as any[];

                                        // 2. Resolve signed and pending waiver files from job.files
                                        const isAnyWaiverSigned = (job.files || []).some(f => f.fileName === 'Signed_Waivers.html');
                                        const pendingWaiverFile = (job.files || []).find(f => f.fileName === 'Waiver_Pending_Signature.html');

                                        // 3. Build waivers array to display
                                        const displayWaivers: any[] = [];

                                        if (isAnyWaiverSigned) {
                                            const signedFile = (job.files || []).find(f => f.fileName === 'Signed_Waivers.html');
                                            if (signedFile) {
                                                displayWaivers.push({
                                                    ...signedFile,
                                                    id: signedFile.id,
                                                    title: 'Signed Waiver Agreement',
                                                    isSigned: true,
                                                    dataUrl: signedFile.dataUrl,
                                                    url: signedFile.url
                                                });
                                            }
                                        } else if (pendingWaiverFile) {
                                            displayWaivers.push({
                                                ...pendingWaiverFile,
                                                id: pendingWaiverFile.id,
                                                title: 'Waiver Agreement (Pending Signature)',
                                                isSigned: false,
                                                isPending: true,
                                                dataUrl: pendingWaiverFile.dataUrl,
                                                url: pendingWaiverFile.url
                                            });
                                        } else {
                                            // Show individual required waivers as REQUIRED
                                            resolvedRequiredWaivers.forEach(w => {
                                                displayWaivers.push({
                                                    ...w,
                                                    isSigned: false
                                                });
                                            });
                                        }

                                        // Add other legacy/explicit waivers in job.waivers or job.embeddedData.waivers if not already added
                                        const otherWaivers = [
                                            ...(Array.isArray(job.waivers) ? job.waivers : (job.waivers ? [job.waivers] : [])),
                                            ...(Array.isArray(job.embeddedData?.waivers) ? job.embeddedData.waivers : (job.embeddedData?.waivers ? [job.embeddedData.waivers] : []))
                                        ].filter(w => !displayWaivers.some(dw => dw.id === w.id || dw.title === w.title));

                                        otherWaivers.forEach(w => {
                                            const hasSig = !!(w.signatureImage || w.signatureDataUrl || w.signature);
                                            displayWaivers.push({
                                                ...w,
                                                isSigned: hasSig
                                            });
                                        });

                                        if (displayWaivers.length === 0) return null;

                                        return displayWaivers.map((waiver: Record<string, any>, idx: number) => {
                                            const isSigned = waiver.isSigned;
                                            const isPending = waiver.isPending;
                                            const title = waiver.title || waiver.fileName || 'Legal Waiver';
                                            
                                            // For previewing:
                                            const previewPayload = {
                                                ...waiver,
                                                type: 'Other',
                                                title: title
                                            };

                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => setPreviewDoc(previewPayload)} 
                                                    className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm cursor-pointer"
                                                >
                                                    <span className="flex items-center gap-2"><FileText size={12}/> {title}</span>
                                                    <span className={isSigned ? "text-emerald-500 font-bold" : isPending ? "text-amber-500 font-bold" : "text-amber-500 font-bold"}>
                                                        {isSigned ? 'SIGNED' : isPending ? 'PENDING SIGNATURE' : 'REQUIRED'}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}

                                    {/* Other Document Files */}
                                    {docFiles.map((file, i) => {
                                        const isHtml = file.fileName?.toLowerCase().endsWith('.html') || (file as ExtendedFile).dataUrl?.includes('text/html');
                                        const displayTitle = file.metadata?.label || file.fileName?.replace(/_/g, ' ').replace('.html', '').replace('.pdf', '') || 'Document';
                                        if (isHtml) {
                                            return (
                                                <button key={i} onClick={() => setPreviewDoc({ ...file, type: 'Other', title: displayTitle })} className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                    <span className="flex items-center gap-2"><FileText size={12}/> {displayTitle}</span>
                                                    <span className="text-emerald-500 font-bold">VIEW</span>
                                                </button>
                                            );
                                        }
                                        return (
                                            <a key={i} href={(file as ExtendedFile).dataUrl || (file as ExtendedFile).url} target="_blank" rel="noreferrer" className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <FileText size={12}/> {displayTitle}
                                            </a>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                        
                        {/* Proposal Link */}
                        {job.projectId && !proposal && (
                            <section className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl shadow-sm">
                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText size={14}/> Job Proposal / Estimate
                                </h4>
                                <a href={`/#/${isAdmin ? 'admin' : 'briefing'}/proposal?proposalId=${job.projectId}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline font-bold">
                                    View Original Proposal Context
                                </a>
                            </section>
                        )}

                        {/* Document Relations & Links */}
                        {isAdmin && (
                            <section className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-850">
                                    <h4 className="text-[10px] font-black text-[#123A63] dark:text-sky-400 uppercase tracking-widest flex items-center gap-2">
                                        <CalendarPlus size={14} className="text-[#123A63] dark:text-sky-400"/> Document Relations & Links
                                    </h4>
                                    <button 
                                        type="button"
                                        onClick={() => setIsLinkingModalOpen(true)}
                                        className="text-[9px] font-black uppercase tracking-wider text-primary-650 hover:text-primary-750 bg-primary-50 dark:bg-slate-900 border border-primary-200/50 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-1 transition-colors"
                                        title="Manage Associations"
                                    >
                                        <Link2 size={10} /> Link Manager
                                    </button>
                                </div>
                                
                                {/* Linked Proposals */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Proposals</div>
                                    {linkedProposals.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No proposals linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedProposals.map(lp => (
                                                <div key={lp.id} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                    <span 
                                                        onClick={() => setPreviewDoc({ ...lp, type: 'Proposal' })}
                                                        className="cursor-pointer hover:underline flex items-center gap-1"
                                                        title="View Proposal Preview"
                                                    >
                                                        <Eye size={12} className="text-indigo-500" />
                                                        Proposal #{formatDisplayId(lp.id)} {lp.title ? `(${lp.title})` : ''}
                                                    </span>
                                                    <button type="button" onClick={() => handleUnlinkProposal(lp.id)} className="text-indigo-500 hover:text-red-500 font-bold ml-1" title="Unlink proposal">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Link Proposal Form */}
                                    {availableProposals.length > 0 && (
                                        <div className="flex gap-2 items-center mt-2">
                                            <select 
                                                id="link-proposal-select-detail"
                                                title="Link Proposal"
                                                aria-label="Link Proposal Select"
                                                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-1 px-2 dark:bg-slate-850 dark:text-white flex-1"
                                                value={selectedPropToLink}
                                                onChange={e => setSelectedPropToLink(e.target.value)}
                                            >
                                                {availableProposals.map(p => {
                                                    const displayTitle = p.title || p.items?.[0]?.name || 'Service Proposal';
                                                    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
                                                    const amountStr = p.total != null ? ` ($${p.total.toFixed(2)})` : '';
                                                    const statusStr = p.status ? ` [${p.status}]` : '';
                                                    return (
                                                        <option key={p.id} value={p.id}>
                                                            #{formatDisplayId(p.id)} - {displayTitle}{amountStr}{statusStr}{dateStr ? ` (${dateStr})` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <Button onClick={() => { handleLinkProposal(selectedPropToLink); setSelectedPropToLink(''); }} className="text-[10px] py-1 px-2.5 h-auto bg-[#123A63] hover:bg-[#0f2d50] text-white rounded-lg font-semibold border-0 shrink-0">Link</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-slate-200 dark:border-slate-800 my-2"></div>

                                {/* Linked Jobs */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Jobs</div>
                                    {linkedJobs.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No other jobs linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedJobs.map(lj => {
                                                const jobDate = lj.appointmentTime ? new Date(lj.appointmentTime).toLocaleDateString() : '';
                                                return (
                                                    <div key={lj.id} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                        <span>Job #{lj.id.slice(0, 8)} {jobDate ? `(${jobDate})` : ''} {lj.invoice ? `- Invoice ($${(lj.invoice.totalAmount || lj.invoice.amount || 0).toFixed(2)})` : ''}</span>
                                                        <button type="button" onClick={() => handleUnlinkJob(lj.id)} className="text-emerald-500 hover:text-red-500 font-bold ml-1" title="Unlink job">×</button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Link Job Form */}
                                    {availableJobs.length > 0 && (
                                        <div className="flex gap-2 items-center mt-2">
                                            <select 
                                                id="link-job-select-detail"
                                                title="Link Job"
                                                aria-label="Link Job Select"
                                                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-1 px-2 dark:bg-slate-850 dark:text-white flex-1"
                                                value={selectedJobToLink}
                                                onChange={e => setSelectedJobToLink(e.target.value)}
                                            >
                                                <option value="">-- Link another Job --</option>
                                                {availableJobs.map(j => {
                                                    const dateStr = j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : '';
                                                    return (
                                                        <option key={j.id} value={j.id}>#{j.id.slice(0, 8)} - {dateStr} {j.tasks?.slice(0, 2).join(', ') || ''}</option>
                                                    );
                                                })}
                                            </select>
                                            <Button onClick={() => { handleLinkJob(selectedJobToLink); setSelectedJobToLink(''); }} className="text-[10px] py-1 px-2.5 h-auto bg-[#123A63] hover:bg-[#0f2d50] text-white rounded-lg font-semibold border-0 shrink-0">Link</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-slate-200 dark:border-slate-800 my-2"></div>

                                {/* Linked Invoices */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Invoices</div>
                                    {linkedInvoices.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No external invoices linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedInvoices.map(item => (
                                                <div key={item.invoice.id} className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                    <span 
                                                        onClick={() => setPreviewDoc({ ...item.job, type: 'Invoice' })}
                                                        className="cursor-pointer hover:underline flex items-center gap-1"
                                                        title="View Invoice Preview"
                                                    >
                                                        <Eye size={12} className="text-amber-500" />
                                                        Invoice #{item.invoice.id.slice(0, 8)} (${(item.invoice.amount || 0).toFixed(2)})
                                                    </span>
                                                    <button type="button" onClick={() => handleUnlinkInvoice(item.invoice.id)} className="text-amber-500 hover:text-red-500 font-bold ml-1" title="Unlink invoice">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Payment Details / Receipt */}
                        {['Paid', 'Refunded', 'Disputed'].includes(job.invoice?.status || '') && (
                            <section className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl shadow-sm print:hidden">
                                <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <DollarSign size={14}/> Payment Confirmation {job.invoice?.status === 'Refunded' ? '(REFUNDED)' : job.invoice?.status === 'Disputed' ? '(DISPUTED)' : ''}
                                </h4>
                                <div className="space-y-1">
                                    {job.invoice?.paymentMethod && (
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">Method: {job.invoice.paymentMethod}</p>
                                    )}
                                    {(job.invoice?.transactionId || job.invoice?.paymentIntentId) && (
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">Transaction: {job.invoice.transactionId || job.invoice.paymentIntentId}</p>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => setPreviewDoc({ ...job, type: 'Invoice' })}
                                        className="text-[10px] text-primary-600 hover:underline font-black uppercase mt-2 text-left block"
                                    >
                                        Download Official Receipt
                                    </button>
                                    
                                    {isAdmin && job.invoice?.status === 'Paid' && job.invoice?.paymentIntentId && (
                                        <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                            <Button 
                                                variant="danger" 
                                                size="sm"
                                                onClick={handleRefund}
                                                disabled={isRefunding}
                                                className="w-full sm:w-auto text-[10px] uppercase tracking-widest font-black"
                                            >
                                                {isRefunding ? 'Processing...' : 'Issue Refund'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                </div>
            </div>
            ) : (
                /* Report Preview & Editing view */
                isEditMode ? (
                    /* Editing Form */
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-8 print:hidden text-left">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                    Edit Service Report
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                                    Modify notes, system health, and photo labels. Unsaved changes are marked in yellow.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    onClick={() => {
                                        setLocalNotes(extractJobNotes(currentJob || job));
                                        setLocalUnitStates(normalizeUnitStates((currentJob || job).unitStates));
                                        setLocalFiles((currentJob || job).files || []);
                                        setLocalTechRecs((currentJob || job).techRecommendations || (currentJob || job).recommendations || '');
                                        setIsEditMode(false);
                                    }} 
                                    className="h-10 text-[10px] uppercase font-black tracking-widest px-4"
                                    disabled={isSaving}
                                >
                                    Discard
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        setIsSaving(true);
                                        try {
                                            let targetId = (currentJob?.id || job?.id || '').trim();
                                            if (!targetId) throw new Error("Job ID missing");

                                            if (targetId.startsWith('JOB-')) {
                                                targetId = targetId.replace(/^JOB-/, 'job-');
                                            }

                                            const updatedNotes = {
                                                ...(localNotes || {}),
                                                recommendations: localTechRecs || null,
                                            };

                                            const payload: any = {
                                                notes: updatedNotes,
                                                arrivalNotes: localNotes?.arrival || null,
                                                diagnosisNotes: localNotes?.diagnosis || null,
                                                diagnosis: localNotes?.diagnosis || null,
                                                workNotes: localNotes?.work || localNotes?.workNotes || null,
                                                workPerformedNotes: localNotes?.work || localNotes?.workNotes || null,
                                                completionNotes: localNotes?.completion || null,
                                                customerFeedback: localNotes?.customerFeedback || null,
                                                employeeFeedback: localNotes?.employeeFeedback || localNotes?.feedback || null,
                                                technicianNotes: localNotes?.employeeFeedback || localNotes?.feedback || null,
                                                internalNotes: localNotes?.employeeFeedback || localNotes?.feedback || null,
                                                techRecommendations: localTechRecs || null,
                                                recommendations: localTechRecs || null,
                                                unitStates: localUnitStates,
                                                files: localFiles,
                                                subcontractorPhone: localSubcontractorPhone ? localSubcontractorPhone.trim() : null,
                                                updatedAt: new Date().toISOString()
                                            };

                                            const cleanedPayload = cleanUndefinedFields(payload);
                                            await db.collection('jobs').doc(targetId).set(cleanedPayload, { merge: true });
                                            
                                            const updatedJob = {
                                                ...(currentJob || job),
                                                ...cleanedPayload
                                            };
                                            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                                            showToast.success("Report changes saved successfully!");
                                            setIsEditMode(false);
                                        } catch (e: any) {
                                            console.error("Error saving service report changes:", e);
                                            showToast.error(`Failed to save report changes: ${e?.message || 'Unknown error'}`);
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }} 
                                    className="h-10 text-[10px] uppercase font-black tracking-widest px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>

                        {/* Section 1: Completion Summary */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest text-left">
                                Completion Summary
                            </h4>
                            <Textarea
                                value={localNotes.completion || ''}
                                onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, completion: e.target.value }))}
                                placeholder="Write a summary of the completed work..."
                                rows={4}
                            />
                        </div>

                        {/* Section 2: Technician Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Arrival Note
                                </h4>
                                <Textarea
                                    value={localNotes.arrival || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, arrival: e.target.value }))}
                                    placeholder="Technician arrival notes..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Diagnosis Note
                                </h4>
                                <Textarea
                                    value={localNotes.diagnosis || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, diagnosis: e.target.value }))}
                                    placeholder="Findings during diagnostics..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3 col-span-1 md:col-span-2">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Work Performed Notes
                                </h4>
                                <Textarea
                                    value={localNotes.work || localNotes.workNotes || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, work: e.target.value, workNotes: e.target.value }))}
                                    placeholder="Details of the repairs/work completed..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3 col-span-1 md:col-span-2">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-355 uppercase tracking-widest text-left">
                                    Direct Recommendations
                                </h4>
                                <Textarea
                                    value={localTechRecs || ''}
                                    onChange={(e) => setLocalTechRecs(e.target.value)}
                                    placeholder="Future recommendations for this equipment..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Customer Feedback Notes
                                </h4>
                                <Textarea
                                    value={localNotes.customerFeedback || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, customerFeedback: e.target.value }))}
                                    placeholder="Feedback notes from customer..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Employee / Technician Feedback
                                </h4>
                                <Textarea
                                    value={localNotes.employeeFeedback || localNotes.feedback || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, employeeFeedback: e.target.value, feedback: e.target.value }))}
                                    placeholder="Internal feedback..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Section 3: Serviced Systems & Asset Health Scoping */}
                        {jobAssets.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest text-left">
                                    Serviced Systems Health & Findings
                                </h4>
                                <div className="space-y-6">
                                    {jobAssets.map((asset, assetIdx) => {
                                        const assetId = asset.id || (asset as any).equipmentId || (asset as any)._id || asset.assetTag || `unit-${assetIdx + 1}`;
                                        const safeStates = normalizeUnitStates(localUnitStates);
                                        const unitStateIdx = safeStates.findIndex(s => s.assetId === assetId);
                                        const unitState = unitStateIdx >= 0 ? safeStates[unitStateIdx] : {
                                            assetId: assetId,
                                            healthBefore: 'Good',
                                            healthAfter: 'Good',
                                            diagnosis: '',
                                            repair: '',
                                            recommendations: ''
                                        };

                                        const updateUnitStateField = (field: string, val: string) => {
                                            setLocalUnitStates(prevStates => {
                                                const updated = [...normalizeUnitStates(prevStates)];
                                                const idx = updated.findIndex(s => s.assetId === assetId);
                                                if (idx >= 0) {
                                                    updated[idx] = { ...updated[idx], [field]: val };
                                                } else {
                                                    updated.push({ assetId: assetId, healthBefore: 'Good', healthAfter: 'Good', [field]: val });
                                                }
                                                return updated;
                                            });
                                        };

                                        return (
                                            <div key={assetId} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 text-left">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <strong className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                        {asset.name || asset.type} {asset.brand ? `(${asset.brand})` : ''}
                                                    </strong>
                                                    <div className="flex gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Health Before:</span>
                                                            <select
                                                                value={unitState.healthBefore || 'Good'}
                                                                onChange={(e) => updateUnitStateField('healthBefore', e.target.value)}
                                                                className="text-xs font-bold rounded-lg border border-slate-205 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="Good">Good</option>
                                                                <option value="Fair">Fair</option>
                                                                <option value="Poor">Poor</option>
                                                                <option value="Down">Down</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Health After:</span>
                                                            <select
                                                                value={unitState.healthAfter || 'Good'}
                                                                onChange={(e) => updateUnitStateField('healthAfter', e.target.value)}
                                                                className="text-xs font-bold rounded-lg border border-slate-205 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2.5 py-1 text-slate-805 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="Good">Good</option>
                                                                <option value="Fair">Fair</option>
                                                                <option value="Poor">Poor</option>
                                                                <option value="Down">Down</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Diagnosis Findings</span>
                                                        <textarea
                                                            value={unitState.diagnosis || ''}
                                                            onChange={(e) => updateUnitStateField('diagnosis', e.target.value)}
                                                            placeholder="System diagnosis details..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Repairs Performed</span>
                                                        <textarea
                                                            value={unitState.repair || ''}
                                                            onChange={(e) => updateUnitStateField('repair', e.target.value)}
                                                            placeholder="System repairs completed..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Recommendations</span>
                                                        <textarea
                                                            value={unitState.recommendations || ''}
                                                            onChange={(e) => updateUnitStateField('recommendations', e.target.value)}
                                                            placeholder="System recommendations..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-805 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Section 4: Photo Labels & categories */}
                        {(() => {
                            const photoFiles = localFiles.filter(f => 
                                f.type === 'Photo' || 
                                f.contentType?.startsWith('image/') || 
                                f.fileType?.startsWith('image/') ||
                                f.dataUrl?.startsWith('data:image/') ||
                                f.url?.match(/\.(jpeg|jpg|gif|png|webp|heic|heif)($|\?)/i) ||
                                f.category === 'photo' ||
                                f.metadata?.category === 'photo'
                            );
                            if (photoFiles.length === 0) return null;
                            return (
                                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest text-left">
                                        Service Photos & Phase Tagging
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {photoFiles.map((file, idx) => {
                                        const updatePhotoLabel = (newLabel: string) => {
                                            const updated = localFiles.map(f => {
                                                if (f === file || (file.id && f.id === file.id) || (file.dataUrl && f.dataUrl === file.dataUrl) || (file.url && f.url === file.url)) {
                                                    return {
                                                        ...f,
                                                        label: newLabel,
                                                        title: newLabel,
                                                        metadata: {
                                                            ...(f.metadata || {}),
                                                            label: newLabel,
                                                            title: newLabel
                                                        }
                                                    };
                                                }
                                                return f;
                                            });
                                            setLocalFiles(updated);
                                        };

                                        const updatePhotoPhase = (phase: 'before' | 'after' | 'spec' | 'uncategorized') => {
                                            const cat = phase === 'spec' ? 'specifications' : phase;
                                            const updated = localFiles.map(f => {
                                                if (f === file || (file.id && f.id === file.id) || (file.dataUrl && f.dataUrl === file.dataUrl) || (file.url && f.url === file.url)) {
                                                    return {
                                                        ...f,
                                                        category: cat,
                                                        phase: phase,
                                                        metadata: {
                                                            ...(f.metadata || {}),
                                                            category: cat,
                                                            phase: phase
                                                        }
                                                    };
                                                }
                                                return f;
                                            });
                                            setLocalFiles(updated);
                                        };

                                        const currentPhase = (() => {
                                            const explicitCat = ((file.metadata?.phase || file.phase || file.metadata?.category || file.category || '') as string).toLowerCase().trim();
                                            if (explicitCat === 'spec' || explicitCat === 'specifications') return 'spec';
                                            if (explicitCat === 'after' || explicitCat === 'repair' || explicitCat === 'work' || explicitCat === 'summary' || explicitCat === 'completion') return 'after';
                                            if (explicitCat === 'before' || explicitCat === 'pre-work' || explicitCat === 'diagnosis' || explicitCat === 'arrival') return 'before';
                                            if (explicitCat === 'uncategorized' || explicitCat === 'other') return 'uncategorized';

                                            const labelLower = ((file.metadata?.label || file.label || file.title || '') as string).toLowerCase().trim();
                                            if (labelLower.includes('before') || labelLower.includes('pre-work') || labelLower.includes('prework') || labelLower.includes('initial') || labelLower.includes('arrival') || labelLower.includes('diag')) return 'before';
                                            if (labelLower.includes('after') || labelLower.includes('completed') || labelLower.includes('post') || labelLower.includes('repair') || labelLower.includes('summary')) return 'after';
                                            if (labelLower.includes('spec') || labelLower.includes('serial') || labelLower.includes('tag')) return 'spec';
                                            return 'before';
                                        })();

                                        const currentAssetId = file.metadata?.assetId || file.assetId || '';
                                        const updatePhotoAssetId = (assetId: string) => {
                                            const updated = localFiles.map(f => {
                                                if (f === file || (file.id && f.id === file.id) || (file.dataUrl && f.dataUrl === file.dataUrl) || (file.url && f.url === file.url)) {
                                                    const newMeta = { ...(f.metadata || {}) };
                                                    if (assetId) newMeta.assetId = assetId;
                                                    else delete newMeta.assetId;
                                                    return {
                                                        ...f,
                                                        assetId: assetId || undefined,
                                                        metadata: newMeta
                                                    };
                                                }
                                                return f;
                                            });
                                            setLocalFiles(updated);
                                        };

                                        return (
                                            <div key={file.id || idx} className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl items-center text-left">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shrink-0">
                                                    <img src={file.dataUrl || file.url} className="w-full h-full object-cover" alt="Service Photo" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="space-y-1">
                                                        <span className="text-[8px] font-black uppercase text-slate-400">1. Photo Label / Caption:</span>
                                                        <Input
                                                            value={file.label ?? file.metadata?.label ?? ''}
                                                            onChange={(e) => updatePhotoLabel(e.target.value)}
                                                            placeholder="Photo Label / Caption..."
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <span className="text-[8px] font-black uppercase text-slate-400">2. Report Section:</span>
                                                            <select
                                                                value={currentPhase}
                                                                onChange={(e) => updatePhotoPhase(e.target.value as any)}
                                                                className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="before">Before Repair Section</option>
                                                                <option value="after">After Repair Section</option>
                                                                <option value="spec">System Specifications (Serial Tag)</option>
                                                                <option value="uncategorized">Other / Uncategorized</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="text-[8px] font-black uppercase text-slate-400">3. Serviced Equipment Unit:</span>
                                                            <select
                                                                value={currentAssetId}
                                                                onChange={(e) => updatePhotoAssetId(e.target.value)}
                                                                className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="">Unassigned / General Job Photo</option>
                                                                {(customer?.equipment || []).map((eq: any) => (
                                                                    <option key={eq.id} value={eq.id}>{eq.name || `Unit #${eq.id.slice(-4)}`} {eq.brand ? `(${eq.brand})` : ''}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!(await globalConfirm("Remove this photo from the report?", "Remove Photo", "Remove", "Cancel"))) return;
                                                                setLocalFiles(prev => prev.filter(f => f.id !== file.id && f.dataUrl !== file.dataUrl && f.url !== file.url));
                                                                setDeletedFiles(prev => new Set(prev).add(file.id || file.dataUrl || ''));
                                                            }}
                                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-100 transition-all shrink-0 dark:bg-rose-950/20 dark:border-rose-900/30 flex items-center gap-1"
                                                        >
                                                            <Trash2 size={12} /> Remove Photo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                    </div>
                ) : (
                    /* HTML Preview */
                    <div className="space-y-6 text-left">
                        {isAdmin && (
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        Customer-Facing Service Report Document
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                        Formatted for standard letterhead PDF printing, email dispatch, and client records.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => {
                                            setLocalNotes(extractJobNotes(currentJob || job));
                                            setLocalTechRecs((currentJob || job).techRecommendations || (currentJob || job).recommendations || '');
                                            setLocalUnitStates(normalizeUnitStates((currentJob || job).unitStates));
                                            setLocalFiles((currentJob || job).files || []);
                                            setIsEditMode(true);
                                        }} 
                                        className="h-8 text-[11px] uppercase font-black tracking-wider px-3 flex items-center gap-1.5 shadow-xs"
                                    >
                                        <Wrench size={12} /> Edit Report Fields
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-center w-full py-2 print:bg-white print:border-none print:shadow-none print:p-0">
                            <div 
                                className="bg-white p-3 sm:p-6 md:p-8 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg text-black print:border-none print:shadow-none print:p-0 overflow-x-auto"
                                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: generateEmailHtml(!isAdmin, false) }}
                            />
                        </div>
                    </div>
                )
            )}
            </div>
        </Modal>

        {/* Email Service Report Modal (Standardized SendEmailModal) */}
        {isEmailModalOpen && (
            <SendEmailModal 
                isOpen={isEmailModalOpen} 
                onClose={() => setIsEmailModalOpen(false)} 
                job={{
                    ...job,
                    equipmentList: jobAssets.length > 0 ? jobAssets : (job?.equipmentList || job?.equipment || job?.units || []),
                    unitStates: localUnitStates.length > 0 ? localUnitStates : (job?.unitStates || []),
                    customerEquipment: customer?.equipment || [],
                    files: (localFiles.length > 0 ? localFiles : (job?.files || [])).filter(f => !isInternalExpenseFile(f)),
                    photos: (localFiles || []).filter(f => !deletedFiles.has(f.id || f.dataUrl || '') && isFilePhoto(f) && (isAdmin || !isInternalExpenseFile(f))).map(f => ({ url: f.dataUrl || f.url, label: f.metadata?.label || f.label || 'Job Photo' }))
                }}
                customerId={job?.customerId}
                recipientEmail={emailRecipient || customer?.email || (serviceLocation as any)?.email || job?.customerEmail || ''}
                recipientName={customer?.name || job?.customerName}
                mode="report"
                zIndex="z-[10080]"
                onSuccess={() => setIsEmailModalOpen(false)}
            />
        )}

        {/* Issue Warranty Modal */}
        {isIssueWarrantyOpen && (
            <IssueWarrantyModal 
                isOpen={isIssueWarrantyOpen}
                onClose={() => setIsIssueWarrantyOpen(false)}
                customer={customer}
                job={job}
                organization={state.currentOrganization}
                onSuccess={() => {
                    setIsIssueWarrantyOpen(false);
                }}
            />
        )}


        {/* Document Preview Modal */}
        {previewDoc && (
            <DocumentPreview 
                type={(previewDoc.type as 'Other' | 'Proposal' | 'Invoice') || 'Other'} 
                data={previewDoc} 
                onClose={() => setPreviewDoc(null)} 
            />
        )}

        {/* Nested JobAppointmentModal for return visit scheduling */}
        {isScheduleFollowUpOpen && (
            <JobAppointmentModal
                isOpen={isScheduleFollowUpOpen}
                onClose={() => setIsScheduleFollowUpOpen(false)}
                parentJobToLink={job}
            />
        )}

        {/* Nested JobLinkingModal for managing associations */}
        {isLinkingModalOpen && (
            <JobLinkingModal
                isOpen={isLinkingModalOpen}
                onClose={() => setIsLinkingModalOpen(false)}
                job={job}
            />
        )}

        {/* Signature Audit History Modal */}
        {isAuditHistoryOpen && (
            <Modal 
                isOpen={true} 
                onClose={() => setIsAuditHistoryOpen(false)} 
                title="Signature Audit History & Archives" 
                size="lg" 
                zIndex="z-[10070]"
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Below are previous signed snapshots of this document that were archived when post-signature edits occurred.
                    </p>
                    {((job.signatureHistory || (job.invoice as any)?.signatureHistory || []) as any[]).map((snap, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                <div>
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded-full border border-purple-300">
                                        Version #{snap.version || idx + 1} Snapshot
                                    </span>
                                    <span className="ml-2 text-xs text-slate-500 font-medium">
                                        Archived on {new Date(snap.archivedAt).toLocaleString()} by {snap.archivedByName || 'Staff'}
                                    </span>
                                </div>
                                <span className="text-[10px] italic text-slate-400">{snap.reason || 'Document edited'}</span>
                            </div>

                            <DigitalSignatureStamp 
                                signatureUrl={snap.signatureUrl || snap.signatureMetadata?.signatureUrl}
                                signedByName={snap.signatureMetadata?.signedByName || snap.documentSnapshot?.customerName || 'Customer'}
                                signedAt={snap.signatureMetadata?.signedAt || snap.archivedAt}
                                geolocation={snap.signatureMetadata?.geolocation}
                                securityHash={snap.signatureMetadata?.securityHash}
                                documentTitle={`Archived Version #${snap.version || idx + 1}`}
                            />
                        </div>
                    ))}
                </div>
            </Modal>
        )}

        <PrintableFormPreviewModal
            isOpen={isPrintingTechSheet}
            onClose={() => setIsPrintingTechSheet(false)}
            job={job}
            organization={state.currentOrganization}
        />

        <SubcontractorWorkOrderModal
            isOpen={isSendSubcontractorModalOpen}
            onClose={() => setIsSendSubcontractorModalOpen(false)}
            job={job}
            subcontractorId={(job as any)?.subcontractorId || (job as any)?.assignedPartnerId || ''}
        />
        <LocationAuditModal
            isOpen={isLocationAuditOpen}
            onClose={() => setIsLocationAuditOpen(false)}
            customerId={job.customerId}
            locationId={job.locationId || serviceLocation?.id || 'default'}
        />

        {selectedAssetForAssessment && (
            <UnitWorkModal
                isOpen={!!selectedAssetForAssessment}
                onClose={() => setSelectedAssetForAssessment(null)}
                asset={selectedAssetForAssessment}
                job={job}
                unitState={normalizeUnitStates(localUnitStates).find((s: any) => s.assetId === selectedAssetForAssessment.id) || { assetId: selectedAssetForAssessment.id }}
                onSaveUnitState={(updatedUnitState: any) => {
                    const updated = [...normalizeUnitStates(localUnitStates)];
                    const idx = updated.findIndex((s: any) => s.assetId === updatedUnitState.assetId);
                    if (idx > -1) {
                        updated[idx] = updatedUnitState;
                    } else {
                        updated.push(updatedUnitState);
                    }
                    setLocalUnitStates(updated);
                    db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ unitStates: updated }));
                    dispatch({ type: 'UPDATE_JOB', payload: { ...job, unitStates: updated } });
                    showToast.success('Unit assessment & EPA refrigerant log saved!');
                    setSelectedAssetForAssessment(null);
                }}
            />
        )}

        {isChargebackModalOpen && (
            <SubcontractorChargebackModal
                isOpen={isChargebackModalOpen}
                onClose={() => setIsChargebackModalOpen(false)}
                subcontractor={assignedSub || undefined}
                initialJob={job}
                onSaveSuccess={() => {
                    showToast.success("Subcontractor chargeback logged for this work order!");
                }}
            />
        )}
        {isEditingTimes && currentJob && (
            <Modal 
                isOpen={isEditingTimes} 
                onClose={() => setIsEditingTimes(false)} 
                title={`Edit In / Out Times: ${currentJob.customerName || 'Work Order'}`} 
                size="md"
                zIndex="z-[10080]"
            >
                <div className="space-y-4 p-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Manually update or backfill technician arrival and departure timestamps for this service history record.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Input 
                            label="Check-In (Arrival / In Time)" 
                            type="datetime-local" 
                            value={editCheckIn} 
                            onChange={e => {
                                setEditCheckIn(e.target.value);
                                if (e.target.value && editCheckOut) {
                                    const diffMs = new Date(editCheckOut).getTime() - new Date(e.target.value).getTime();
                                    setEditTimeOnSite(Math.max(0, Math.round(diffMs / 60000)));
                                }
                            }} 
                        />
                        <Input 
                            label="Check-Out (Departure / Out Time)" 
                            type="datetime-local" 
                            value={editCheckOut} 
                            onChange={e => {
                                setEditCheckOut(e.target.value);
                                if (editCheckIn && e.target.value) {
                                    const diffMs = new Date(e.target.value).getTime() - new Date(editCheckIn).getTime();
                                    setEditTimeOnSite(Math.max(0, Math.round(diffMs / 60000)));
                                }
                            }} 
                        />
                    </div>

                    <div>
                        <Input 
                            label="Total Time On Site (Minutes)" 
                            type="number" 
                            min="0"
                            value={editTimeOnSite} 
                            onChange={e => setEditTimeOnSite(e.target.value === '' ? '' : parseInt(e.target.value))} 
                            placeholder="e.g. 60"
                        />
                        {!!editTimeOnSite && (
                            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                Duration: {Math.floor(Number(editTimeOnSite) / 60)}h {Number(editTimeOnSite) % 60}m
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <Button variant="secondary" onClick={() => setIsEditingTimes(false)} disabled={isSavingTimes}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveTimeCorrections} disabled={isSavingTimes} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isSavingTimes ? 'Saving...' : 'Save In / Out Times'}
                        </Button>
                    </div>
                </div>
            </Modal>
        )}
        </>
    );
};

export default JobDetailModal;
