import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { Mail, Send, User, X, Plus, Check, Paperclip, FileText, AlertCircle, Layers, Wrench, Image as ImageIcon, FileEdit, ClipboardCheck, Receipt, Calendar, RefreshCw } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { sendEmail } from 'lib/notificationService';
import { db } from 'lib/firebase';
import { getBaseUrl, cleanUndefinedFields, createEmailButtonHtml, autoLinkifyText, isInternalExpenseFile, isFilePhoto, getOrGenerateAccountNumber } from 'lib/utils';
import showToast from 'lib/toast';
import { generateMultiDocumentPdfAttachments, EmailAttachment, isSignOffFile } from 'lib/pdfHelper';
import { generateUserEmailSignatureHtml } from 'lib/signatureHelper';
import { computeCustomerStatementJobs, computeCustomerStatementTotals } from 'lib/statementHelper';
import { 
    isImpactCustomer, 
    IMPACT_GENERAL_INFO, 
    IMPACT_MARICO_BETONIO, 
    resolveImpactContactsForLocation 
} from 'lib/impactDirectory';

export type CommunicationType = 'email' | 'invoice' | 'proposal' | 'report' | 'statement' | 'confirmation';

export interface SendEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientEmail?: string | string[];
    recipientName?: string;
    customerId?: string | null;
    job?: any;
    invoice?: any;
    proposal?: any;
    paymentRequest?: any;
    mode?: CommunicationType;
    defaultSubject?: string;
    defaultMessage?: string;
    onSuccess?: () => void;
    zIndex?: string;
}

const SendEmailModal: React.FC<SendEmailModalProps> = ({
    isOpen,
    onClose,
    recipientEmail,
    recipientName,
    customerId,
    job,
    invoice,
    proposal,
    paymentRequest,
    mode = 'email',
    defaultSubject,
    defaultMessage,
    onSuccess,
    zIndex = 'z-[10080]'
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [recipients, setRecipients] = useState<string[]>([]);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Multi-document inclusion states
    const [activeType, setActiveType] = useState<CommunicationType>(() => {
        if (mode === 'invoice') return 'invoice';
        if (mode === 'report') return 'report';
        if (mode === 'proposal') return 'proposal';
        if (mode === 'statement') return 'statement';
        if (mode === 'confirmation') return 'confirmation';
        if (proposal && !invoice) return 'proposal';
        return 'email';
    });
    const [includeInvoice, setIncludeInvoice] = useState(false);
    const [includeReport, setIncludeReport] = useState(false);
    const [includeProposal, setIncludeProposal] = useState(false);
    const [includeStatement, setIncludeStatement] = useState(false);
    const [includeSignOff, setIncludeSignOff] = useState(false);
    const [hasUserEditedMessage, setHasUserEditedMessage] = useState(false);

    // Delivery options (Default: Interactive links ON, PDF attachments OFF)
    const [attachInteractiveLinks, setAttachInteractiveLinks] = useState(true);
    const [attachPdfFiles, setAttachPdfFiles] = useState(false);
    const [generatedPdfAttachments, setGeneratedPdfAttachments] = useState<EmailAttachment[]>([]);
    const [isGeneratingPdfs, setIsGeneratingPdfs] = useState(false);
    const [showSitePhotos, setShowSitePhotos] = useState(false);
    const [includeSignature, setIncludeSignature] = useState<boolean>(() => state.currentUser?.includeSignatureInOutbound !== false);
    const [showSignaturePreview, setShowSignaturePreview] = useState(false);
    const lastGeneratedConfigKeyRef = useRef<string>('');

    // Generate active sender user signature
    const activeUserSignature = useMemo(() => {
        if (state.currentUser?.emailSignatureHtml) {
            return state.currentUser.emailSignatureHtml;
        }
        return generateUserEmailSignatureHtml(state.currentUser, state.currentOrganization);
    }, [state.currentUser, state.currentOrganization]);

    const senderDisplayName = useMemo(() => {
        return `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || state.currentUser?.name || state.currentUser?.username || 'Sender';
    }, [state.currentUser]);

    // Find customer doc if customerId provided or from job
    const customer = useMemo(() => {
        const cId = customerId || job?.customerId || invoice?.job?.customerId;
        if (!cId) return null;
        return state.customers?.find((c: any) => c.id === cId) || null;
    }, [state.customers, customerId, job, invoice]);

    // Customer jobs & proposals fallback resolution
    const customerJobs = useMemo(() => {
        const cId = customer?.id || customerId;
        const cName = (customer?.name || recipientName || '').toLowerCase();
        if (!cId && !cName) return [];
        const rawJobs = (state.jobs || []).filter((j: any) => 
            (cId && j.customerId === cId) || 
            (cName && j.customerName?.toLowerCase().includes(cName))
        );

        // Sort newest jobs first (by timestamp, createdAt, appointmentTime, date, or numeric ID)
        return [...rawJobs].sort((a: any, b: any) => {
            const timeA = Math.max(
                new Date(a.createdAt || a.appointmentTime || a.date || a.updatedAt || 0).getTime(),
                typeof a.id === 'string' && a.id.includes('-') ? parseInt(a.id.split('-').pop() || '0') || 0 : 0
            );
            const timeB = Math.max(
                new Date(b.createdAt || b.appointmentTime || b.date || b.updatedAt || 0).getTime(),
                typeof b.id === 'string' && b.id.includes('-') ? parseInt(b.id.split('-').pop() || '0') || 0 : 0
            );
            return timeB - timeA;
        });
    }, [state.jobs, customer, customerId, recipientName]);

    const customerProposals = useMemo(() => {
        const cId = customer?.id || customerId;
        const cName = (customer?.name || recipientName || '').toLowerCase();
        if (!cId && !cName) return [];
        return (state.proposals || []).filter((p: any) => 
            (cId && p.customerId === cId) || 
            (cName && p.customerName?.toLowerCase().includes(cName))
        );
    }, [state.proposals, customer, customerId, recipientName]);

    // Customer statement of account calculations
    const statementJobs = useMemo(() => {
        return computeCustomerStatementJobs(customerJobs, false);
    }, [customerJobs]);

    const statementTotals = useMemo(() => {
        return computeCustomerStatementTotals(customerJobs);
    }, [customerJobs]);

    const statementPeriod = useMemo(() => {
        const dates = (statementJobs || []).map((tx: any) => new Date(tx.job?.appointmentTime || tx.job?.createdAt || 0).getTime()).filter((t: number) => !isNaN(t) && t > 0);
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
        return `${minDate} - ${maxDate}`;
    }, [statementJobs]);

    const statementNumber = useMemo(() => {
        return `SOA-${(customer?.id || customerId || 'CUST').slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    }, [customer?.id, customerId]);

    const hasStatementData = statementJobs.length > 0;

    const [selectedJobId, setSelectedJobId] = useState<string>('');

    useEffect(() => {
        if (!isOpen) return;
        if (job?.id) {
            setSelectedJobId(job.id);
        } else if (invoice?.jobId) {
            setSelectedJobId(invoice.jobId);
        } else if (customerJobs.length > 0) {
            setSelectedJobId(customerJobs[0].id);
        }
    }, [isOpen, job, invoice, customerJobs]);

    const targetJobRaw = useMemo(() => {
        const directJobId = job?.id || invoice?.job?.id || selectedJobId;
        const liveStateJob = directJobId ? state.jobs?.find((j: any) => j.id === directJobId) : null;
        if (liveStateJob) {
            return {
                ...(job || {}),
                ...liveStateJob,
                files: (liveStateJob.files && liveStateJob.files.length > 0) ? liveStateJob.files : (job?.files || liveStateJob.files || [])
            };
        }
        if (job) return job;
        if (invoice?.job) return invoice.job;
        if (selectedJobId) return customerJobs.find((j: any) => j.id === selectedJobId) || customerJobs[0] || null;
        return customerJobs[0] || null;
    }, [job, invoice, selectedJobId, customerJobs, state.jobs]);

    const targetCustomer = useMemo(() => {
        if (customer) return customer;
        const cId = targetJobRaw?.customerId || customerId;
        if (cId) return state.customers?.find((c: any) => c.id === cId) || null;
        const cName = (targetJobRaw?.customerName || recipientName || '').toLowerCase().trim();
        if (cName) return state.customers?.find((c: any) => c.name?.toLowerCase().trim() === cName) || null;
        return null;
    }, [customer, customerId, recipientName, targetJobRaw, state.customers]);

    const targetJob = useMemo(() => {
        if (!targetJobRaw) return null;
        const custEquip = targetCustomer?.equipment || targetJobRaw.customerEquipment || [];
        const explicitUnits = (Array.isArray(targetJobRaw.unitStates) && targetJobRaw.unitStates.length > 0)
            ? targetJobRaw.unitStates
            : ((Array.isArray(targetJobRaw.equipmentList) && targetJobRaw.equipmentList.length > 0) ? targetJobRaw.equipmentList : null);

        const techUser = targetJobRaw.assignedTechnicianId
            ? state.users?.find((u: any) => u.id === targetJobRaw.assignedTechnicianId)
            : (targetJobRaw.tech || targetJobRaw.assignedTechnician);

        return {
            ...targetJobRaw,
            customer: targetCustomer || targetJobRaw.customer,
            customerEquipment: custEquip,
            equipmentList: explicitUnits || targetJobRaw.jobAssets || [],
            unitStates: targetJobRaw.unitStates || [],
            tech: techUser || targetJobRaw.tech,
            assignedTechnician: techUser || targetJobRaw.assignedTechnician,
            files: (Array.isArray(targetJobRaw.files) && targetJobRaw.files.length > 0) ? targetJobRaw.files : (targetJobRaw.files || [])
        };
    }, [targetJobRaw, targetCustomer, state.users]);

    const getJobWoNumber = (j: any) => {
        if (!j) return 'N/A';
        return j.workOrderNumber || j.poNumber || (j.id ? `WO-${j.id.slice(-6).toUpperCase()}` : 'N/A');
    };

    const getJobInvoiceNumber = (j: any) => {
        if (!j) return 'None';
        const inv = j.invoice || (j.id === targetJob?.id ? targetInvoice : null);
        if (!inv) return 'None';
        return inv.invoiceNumber || inv.id || `INV-${j.id.slice(-6).toUpperCase()}`;
    };

    const getJobSiteLocation = (j: any, cust: any) => {
        if (!j) return 'N/A';
        if (j.locationName) return j.locationName;
        if (j.siteLocationName) return j.siteLocationName;
        if (j.serviceLocationName) return j.serviceLocationName;
        if (j.address) return j.address;
        if (j.serviceLocationAddress) return j.serviceLocationAddress;
        if (j.locationId || j.serviceLocationId) {
            const foundLoc = cust?.serviceLocations?.find((loc: any) => loc.id === (j.locationId || j.serviceLocationId));
            if (foundLoc?.name) return foundLoc.name;
            if (foundLoc?.address) return foundLoc.address;
        }
        return cust?.address || 'Main Site Location';
    };

    const getJobVisitDate = (j: any) => {
        if (!j) return 'N/A';
        const rawDate = j.appointmentTime || j.scheduledDate || j.date || j.createdAt;
        if (!rawDate) return 'Unscheduled';
        try {
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return String(rawDate);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return String(rawDate);
        }
    };

    const targetInvoice = useMemo(() => {
        if (invoice) return invoice;
        if (targetJob?.invoice) return targetJob.invoice;
        if (targetJob?.id) {
            const foundJob = (state.jobs || []).find((j: any) => j.id === targetJob.id && j.invoice);
            if (foundJob?.invoice) return foundJob.invoice;
        }
        return null;
    }, [invoice, targetJob, state.jobs]);

    const linkedProposals = useMemo(() => {
        if (!targetJob) return proposal ? [proposal] : [];
        const list: any[] = [];
        if (proposal && !list.some(p => p.id === proposal.id)) {
            list.push(proposal);
        }

        const targetJobId = targetJob.id;
        const targetCustId = targetJob.customerId || customer?.id || customerId;
        const targetWo = (targetJob.workOrderNumber || '').trim();
        const targetPo = (targetJob.poNumber || targetInvoice?.poNumber || '').trim();

        const isValidRefNum = (num?: string) => {
            if (!num) return false;
            const clean = num.trim().toLowerCase();
            return clean !== '' && clean !== 'n/a' && clean !== 'none' && clean !== 'null' && clean !== 'undefined' && clean !== '0';
        };

        (state.proposals || []).forEach((p: any) => {
            const propWo = (p.workOrderNumber || '').trim();
            const propPo = (p.poNumber || '').trim();

            const isDirectIdMatch = targetJob && (
                (targetJob.proposalId && p.id === targetJob.proposalId) ||
                (targetJob.projectId && p.id === targetJob.projectId) ||
                (Array.isArray(targetJob.linkedProposalIds) && targetJob.linkedProposalIds.includes(p.id)) ||
                (Array.isArray(p.linkedJobIds) && targetJobId && p.linkedJobIds.includes(targetJobId)) ||
                (p.jobId && targetJobId && p.jobId === targetJobId)
            );

            const isCustomerMatch = !targetCustId || p.customerId === targetCustId;

            const isRefNumMatch = isCustomerMatch && (
                (isValidRefNum(targetWo) && isValidRefNum(propWo) && targetWo.toLowerCase() === propWo.toLowerCase()) ||
                (isValidRefNum(targetPo) && isValidRefNum(propPo) && targetPo.toLowerCase() === propPo.toLowerCase()) ||
                (isValidRefNum(targetWo) && isValidRefNum(propPo) && targetWo.toLowerCase() === propPo.toLowerCase()) ||
                (isValidRefNum(targetPo) && isValidRefNum(propWo) && targetPo.toLowerCase() === propPo.toLowerCase())
            );

            const isLinkedToTargetJob = isDirectIdMatch || isRefNumMatch;

            if (isLinkedToTargetJob && !list.some(item => item.id === p.id)) {
                list.push(p);
            }
        });
        return list;
    }, [proposal, targetJob, targetInvoice, customer, customerId, state.proposals]);

    const availableProposals = useMemo(() => {
        if (targetJob) {
            return linkedProposals;
        }
        if (proposal) {
            return [proposal];
        }
        return customerProposals || [];
    }, [targetJob, linkedProposals, proposal, customerProposals]);

    const getJobFileKey = (f: any, idx: number) => f.id || f.fileName || f.name || f.label || f.fileUrl || f.dataUrl || f.url || `file-${idx}`;

    const sitePhotoCount = useMemo(() => {
        if (!targetJob?.files || !Array.isArray(targetJob.files)) return 0;
        return targetJob.files.filter((f: any) => (f.dataUrl || f.url || f.fileUrl || f.path || f.downloadUrl || f.fileDataUrl) && !isInternalExpenseFile(f) && isFilePhoto(f)).length;
    }, [targetJob?.files]);

    const availableJobFiles = useMemo(() => {
        if (!targetJob?.files || !Array.isArray(targetJob.files)) return [];
        return targetJob.files.filter((f: any) => {
            if (!f.dataUrl && !f.url && !f.fileUrl && !f.path && !f.downloadUrl && !f.fileDataUrl) return false;
            if (isInternalExpenseFile(f)) return false; // Strictly exclude expense receipts, internal supplier invoices, and subcontractor bills
            const isPhoto = isFilePhoto(f);
            return showSitePhotos ? true : !isPhoto;
        });
    }, [targetJob?.files, showSitePhotos]);

    const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
    const [selectedJobFileIds, setSelectedJobFileIds] = useState<string[]>([]);

    const prevSelectedJobIdRef = useRef(selectedJobId);
    useEffect(() => {
        if (!isOpen) return;
        if (prevSelectedJobIdRef.current !== selectedJobId) {
            prevSelectedJobIdRef.current = selectedJobId;
            if (mode === 'proposal' && proposal?.id) {
                setSelectedProposalIds([proposal.id]);
            } else {
                setSelectedProposalIds([]);
            }
            setSelectedJobFileIds([]);
        }
    }, [isOpen, selectedJobId, proposal, mode]);

    const targetProposal = useMemo(() => {
        if (proposal) return proposal;
        if (targetJob?.proposalId) {
            const found = state.proposals?.find((p: any) => p.id === targetJob.proposalId);
            if (found) return found;
        }
        return availableProposals[0] || customerProposals[0] || null;
    }, [proposal, targetJob, availableProposals, customerProposals, state.proposals]);

    const hasInvoiceData = !!targetInvoice || !!targetJob?.invoice;
    const hasReportData = !!targetJob;
    const hasProposalData = !!targetProposal || availableProposals.length > 0;
    const hasSignOffData = useMemo(() => {
        if (!targetJob) return false;
        if (targetJob.signOffSheetUrl || targetJob.signoffSheetUrl || targetJob.customWorkOrderFormUrl || targetJob.signOff) return true;
        if (targetJob.siteManagerSignature || targetJob.signature || targetJob.customerSignature) return true;
        if ((targetJob as any)?.workflowState?.siteManagerSignature || (targetJob as any)?.workflowState?.signature) return true;
        return (targetJob.files || []).some((f: any) => isSignOffFile(f));
    }, [targetJob]);

    const signOffFile = useMemo(() => {
        if (!targetJob) return null;
        const fileFromList = (targetJob.files || []).find((f: any) => isSignOffFile(f) && (f.fileType === 'application/pdf' || f.fileName?.toLowerCase().endsWith('.pdf')));
        if (fileFromList) return fileFromList;
        if (targetJob.signOffSheetUrl || targetJob.signoffSheetUrl || targetJob.customWorkOrderFormUrl) {
            return {
                fileName: 'Signed_WorkOrder_SignOff.pdf',
                dataUrl: targetJob.signOffSheetUrl || targetJob.signoffSheetUrl || targetJob.customWorkOrderFormUrl,
                url: targetJob.signOffSheetUrl || targetJob.signoffSheetUrl || targetJob.customWorkOrderFormUrl,
                fileType: 'application/pdf',
                label: 'Sign-Off Sheet',
                metadata: {
                    label: 'Sign-Off Sheet',
                    category: 'signoff',
                    managerName: (targetJob as any).signOff?.managerName || targetJob.siteManagerName || targetJob.signerName,
                    technicianName: (targetJob as any).signOff?.technicianName || targetJob.assignedTechnicianName
                }
            };
        }
        if (targetJob.siteManagerSignature || targetJob.signature || (targetJob as any)?.workflowState?.siteManagerSignature || (targetJob as any)?.workflowState?.signature || targetJob.signOff) {
            const cleanId = String(targetJob.poNumber || targetJob.workOrderNumber || targetJob.jobNumber || targetJob.id || 'JOB').replace(/^#/, '');
            return {
                fileName: `SignOff_Sheet_WO_${cleanId}.pdf`,
                fileType: 'application/pdf',
                label: 'On-Site Manager Sign-Off Sheet',
                metadata: {
                    label: 'On-Site Manager Sign-Off Sheet',
                    category: 'signoff',
                    managerName: targetJob.siteManagerName || targetJob.signerName || (targetJob as any).signOff?.managerName,
                    technicianName: targetJob.assignedTechnicianName
                }
            };
        }
        return null;
    }, [targetJob]);

    const isImpact = useMemo(() => {
        return isImpactCustomer(customer, targetJob?.customerName || recipientName);
    }, [customer, targetJob?.customerName, recipientName]);

    const storeLocation = useMemo(() => {
        if (!customer) return null;
        const locId = targetJob?.locationId || targetJob?.serviceLocationId || proposal?.locationId || invoice?.locationId;
        const locName = targetJob?.locationName || targetJob?.siteLocationName || targetJob?.serviceLocationName || proposal?.locationName || targetJob?.address;
        if (!locId && !locName) return null;

        const locKey = (locId || locName || '').trim().toLowerCase();
        return customer.serviceLocations?.find((loc: any) =>
            (loc.id && loc.id.toLowerCase() === locKey) ||
            (loc.storeNumber && loc.storeNumber.toLowerCase() === locKey) ||
            (loc.name && loc.name.toLowerCase() === locKey) ||
            (loc.name && locKey.includes(loc.name.toLowerCase())) ||
            (loc.id && locKey.includes(loc.id.toLowerCase()))
        ) || null;
    }, [customer, targetJob, proposal, invoice]);

    // Available contact emails for quick selection
    const availableContacts = useMemo(() => {
        const list: Array<{ label: string; email: string; role: string }> = [];

        const locName = storeLocation?.name || targetJob?.locationName || proposal?.locationName || targetJob?.siteLocationName || targetJob?.address || '';
        const storeNum = storeLocation?.storeNumber || targetJob?.storeNumber;
        const resolvedImpact = isImpact ? resolveImpactContactsForLocation(locName, storeNum) : { accountManager: null, projectCoordinator: null, matchedBrand: null };

        // 1. Job / Proposal / Location Account Manager (for ANY customer)
        const amContact = targetJob?.accountManagerContact || proposal?.accountManagerContact || (storeLocation as any)?.accountManager || resolvedImpact.accountManager;
        if (amContact?.email && amContact?.name) {
            list.push({
                label: `${amContact.name} (Account Manager${resolvedImpact.matchedBrand ? ` - ${resolvedImpact.matchedBrand}` : ''})`,
                email: amContact.email.toLowerCase(),
                role: 'Store AM'
            });
        }

        // 2. Job / Proposal / Location Project Coordinator (for ANY customer)
        const pcContact = targetJob?.pocContact || proposal?.pocContact || resolvedImpact.projectCoordinator;
        if (pcContact?.email && pcContact?.name && !list.some(i => i.email === pcContact.email.toLowerCase())) {
            list.push({
                label: `${pcContact.name} (Project Coordinator${resolvedImpact.matchedBrand ? ` - ${resolvedImpact.matchedBrand}` : ''})`,
                email: pcContact.email.toLowerCase(),
                role: 'Store PC'
            });
        }

        // 3. Location contacts from storeLocation (for ANY customer)
        if (Array.isArray(storeLocation?.contacts)) {
            storeLocation.contacts.forEach((c: any) => {
                if (c.email && !list.some(i => i.email === c.email.toLowerCase())) {
                    list.push({
                        label: `${c.name} (${c.role || 'Store Contact'})`,
                        email: c.email.toLowerCase(),
                        role: 'Store POC'
                    });
                }
            });
        }

        // 4. Customer contacts linked to this store location via allowedLocationIds or assignedLocationIds (for ANY customer)
        if (storeLocation?.id && Array.isArray(customer?.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c.email && (c.allowedLocationIds?.includes(storeLocation.id) || c.assignedLocationIds?.includes(storeLocation.id))) {
                    if (!list.some(i => i.email === c.email.toLowerCase())) {
                        list.push({
                            label: `${c.name} (${c.title || c.role || 'Store Contact'})`,
                            email: c.email.toLowerCase(),
                            role: 'Store POC'
                        });
                    }
                }
            });
        }

        // 5. Impact-specific corporate contacts
        if (isImpact) {
            // Always add Marico Betonio
            if (!list.some(i => i.email === IMPACT_MARICO_BETONIO.email.toLowerCase())) {
                list.push({
                    label: `${IMPACT_MARICO_BETONIO.name} (Vendor Management)`,
                    email: IMPACT_MARICO_BETONIO.email.toLowerCase(),
                    role: 'Vendor Management'
                });
            }

            // Add Invoicing
            if (!list.some(i => i.email === IMPACT_GENERAL_INFO.invoicingEmail.toLowerCase())) {
                list.push({
                    label: `Impact Invoicing (Bill Submissions)`,
                    email: IMPACT_GENERAL_INFO.invoicingEmail.toLowerCase(),
                    role: 'Invoicing'
                });
            }

            // Add Dispatch
            if (!list.some(i => i.email === IMPACT_GENERAL_INFO.dispatchEmail.toLowerCase())) {
                list.push({
                    label: `Impact Dispatch`,
                    email: IMPACT_GENERAL_INFO.dispatchEmail.toLowerCase(),
                    role: 'Dispatch'
                });
            }

            // Add Vendor Admin
            if (!list.some(i => i.email === IMPACT_GENERAL_INFO.vendorAdminEmail.toLowerCase())) {
                list.push({
                    label: `Impact Vendor Admin`,
                    email: IMPACT_GENERAL_INFO.vendorAdminEmail.toLowerCase(),
                    role: 'Vendor Admin'
                });
            }
        }

        if (customer) {
            if (customer.email && !list.some(item => item.email.toLowerCase() === customer.email.toLowerCase())) {
                list.push({ label: customer.name || 'Primary Customer', email: customer.email.toLowerCase(), role: 'Primary' });
            }
            if (customer.billingContact?.email && customer.billingContact.email !== customer.email && !list.some(item => item.email.toLowerCase() === customer.billingContact.email.toLowerCase())) {
                list.push({ label: customer.billingContact.name || 'Billing Contact', email: customer.billingContact.email.toLowerCase(), role: 'Billing' });
            }
            if (Array.isArray(customer.contacts)) {
                customer.contacts.forEach((c: any) => {
                    if (c.email && !list.some(item => item.email.toLowerCase() === c.email.toLowerCase())) {
                        list.push({ label: c.name || 'Contact', email: c.email.toLowerCase(), role: c.role || 'Contact' });
                    }
                });
            }
        }
        if (targetJob?.customerEmail && !list.some(item => item.email.toLowerCase() === targetJob.customerEmail.toLowerCase())) {
            list.push({ label: targetJob.customerName || 'Job Customer', email: targetJob.customerEmail.toLowerCase(), role: 'Job Email' });
        }
        return list;
    }, [customer, targetJob, proposal, storeLocation, isImpact]);

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            hasInitializedRef.current = false;
            return;
        }

        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        // Determine initial communication type first:
        let initialType: CommunicationType = 'email';
        if (mode === 'invoice') initialType = 'invoice';
        else if (mode === 'report') initialType = 'report';
        else if (mode === 'proposal') initialType = 'proposal';
        else if (mode === 'statement') initialType = 'statement';
        else if (mode === 'confirmation') initialType = 'confirmation';
        else if (proposal && !invoice) initialType = 'proposal';
        else if (mode === 'email') initialType = 'email';

        // Populate recipients
        const initialRecipients: string[] = [];
        if (Array.isArray(recipientEmail)) {
            recipientEmail.forEach(e => { 
                if (e && !initialRecipients.some(r => r.toLowerCase() === e.toLowerCase())) {
                    initialRecipients.push(e.toLowerCase()); 
                }
            });
        } else if (recipientEmail) {
            initialRecipients.push(recipientEmail.toLowerCase());
        }

        if (isImpact) {
            const isInvoiceDoc = initialType === 'invoice' || mode === 'invoice' || !!invoice;

            // 1. Store POCs: When sending a document related to their stores, select the correct person by default
            const storePOCs = availableContacts.filter(c => c.role === 'Store AM' || c.role === 'Store PC' || c.role === 'Store POC');
            storePOCs.forEach(c => {
                const em = c.email.toLowerCase();
                if (!initialRecipients.some(r => r.toLowerCase() === em)) {
                    initialRecipients.push(em);
                }
            });

            // 2. Include Marico by default on all Impact documents
            const maricoEmail = IMPACT_MARICO_BETONIO.email.toLowerCase();
            if (!initialRecipients.some(r => r.toLowerCase() === maricoEmail)) {
                initialRecipients.push(maricoEmail);
            }

            // 3. Include invoicing email by default on all invoices
            if (isInvoiceDoc) {
                const invEmail = IMPACT_GENERAL_INFO.invoicingEmail.toLowerCase();
                if (!initialRecipients.some(r => r.toLowerCase() === invEmail)) {
                    initialRecipients.push(invEmail);
                }
            }
        } else {
            // Universal recipient defaults for all other customers / organizations
            const isInvoiceDoc = initialType === 'invoice' || mode === 'invoice' || !!invoice;
            const hasStoreLocation = Boolean(storeLocation || targetJob?.locationId || proposal?.locationId || invoice?.locationId);

            // 1. When sending a document related to a store/location, auto-select all linked store POCs by default
            if (hasStoreLocation) {
                const storePOCs = availableContacts.filter(c => 
                    c.role === 'Store AM' || c.role === 'Store PC' || c.role === 'Store POC'
                );
                storePOCs.forEach(c => {
                    const em = c.email.toLowerCase();
                    if (!initialRecipients.some(r => r.toLowerCase() === em)) {
                        initialRecipients.push(em);
                    }
                });
            }

            // 2. For invoices, also include billing contacts / primary customer email by default
            if (isInvoiceDoc) {
                const billingContacts = availableContacts.filter(c => c.role === 'Billing' || c.role === 'Primary');
                billingContacts.forEach(c => {
                    const em = c.email.toLowerCase();
                    if (!initialRecipients.some(r => r.toLowerCase() === em)) {
                        initialRecipients.push(em);
                    }
                });
            }

            // Fallback if still empty:
            if (initialRecipients.length === 0) {
                if (customer?.email) {
                    initialRecipients.push(customer.email.toLowerCase());
                } else if (targetJob?.customerEmail) {
                    initialRecipients.push(targetJob.customerEmail.toLowerCase());
                }
            }
        }
        setRecipients(initialRecipients);

        const is23rd = initialRecipients.some(r => r.toLowerCase().includes('23rdgroup')) || 
            customer?.name?.toLowerCase().includes('23rd') || 
            targetJob?.customerName?.toLowerCase().includes('23rd');

        setActiveType(initialType);
        setHasUserEditedMessage(false);

        // Auto-select document defaults:
        const isInitialInvoice = initialType === 'invoice';
        const isInitialReport = initialType === 'report';
        const isInitialProposal = initialType === 'proposal';
        const isInitialStatement = initialType === 'statement';

        const shouldAutoIncludeSignOff = is23rd || isInitialReport || (isInitialInvoice && hasSignOffData);

        setIncludeInvoice(isInitialInvoice);
        setIncludeReport(isInitialReport || is23rd);
        setIncludeProposal(isInitialProposal);
        setIncludeStatement(isInitialStatement);
        setIncludeSignOff(shouldAutoIncludeSignOff);

        if (isInitialProposal && proposal?.id) {
            setSelectedProposalIds([proposal.id]);
        } else {
            setSelectedProposalIds([]);
        }

        // All additional file attachments unchecked by default
        setSelectedJobFileIds([]);

        // Default attachPdfFiles to false unless 23rd Group (which strictly requires PDFs)
        setAttachPdfFiles(is23rd);

        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || targetJob?.customerName || 'Valued Customer';

        if (is23rd) {
            setAttachPdfFiles(true);
            setAttachInteractiveLinks(false);
            const woNum = targetJob?.workOrderNumber || targetJob?.poNumber || targetJob?.id || '565621';
            const invId = targetInvoice?.id || targetJob?.id?.slice(0, 8) || woNum;
            const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);

            setSubject(defaultSubject || `Invoice, Sign-Off & Photos — WO #${woNum}`);
            setMessage(defaultMessage || `23rd Group Facility Services,

Please find the completed invoice #${invId}${totalAmt > 0 ? ` for $${totalAmt.toFixed(2)}` : ''}, signed work order sign-off sheet, and site photo report attached directly to this email as PDF files for Work Order #${woNum}.

(All documents are attached strictly as raw PDF files per 23rd Group submission requirements).

Thank you for your business!

Best regards,
${orgName}`);
        } else if (initialType === 'invoice') {
            const invId = targetInvoice?.id || targetJob?.id?.slice(0, 8) || 'N/A';
            const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);
            const invLink = targetJob?.id ? `${getBaseUrl()}/#/invoice/${targetJob.id}` : (targetInvoice?.id ? `${getBaseUrl()}/#/invoice/${targetInvoice.id}` : getBaseUrl());

            setSubject(defaultSubject || `Invoice #${invId} from ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Please find your invoice #${invId} for $${totalAmt.toFixed(2)} attached below.

You can view, download, and pay your invoice securely online here:
${invLink}

Thank you for your business!

Best regards,
${orgName}`);
        } else if (initialType === 'report') {
            const repLink = targetJob?.id ? `${getBaseUrl()}/#/service-report/${targetJob.id}` : getBaseUrl();
            setSubject(defaultSubject || `Service Report — Job #${targetJob?.id?.slice(-8).toUpperCase() || 'N/A'} — ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Thank you for choosing ${orgName}. Please review your completed service report details, technician findings, and site documentation online here:
${repLink}

Best regards,
${orgName}`);
        } else if (initialType === 'proposal') {
            const propId = proposal?.id || targetJob?.proposalId || (availableProposals[0]?.id) || 'N/A';
            const propLink = `${getBaseUrl()}/#/proposal-view/${propId}`;
            const isCommercialCust = !!(
                customer?.customerType === 'Commercial' ||
                customer?.customerType === 'Property Management' ||
                (customer?.serviceLocations && customer.serviceLocations.length > 0) ||
                targetJob?.customer?.customerType === 'Commercial' ||
                (proposal as any)?.customerType === 'Commercial' ||
                (proposal as any)?.isProjectLevel === true ||
                (proposal as any)?.isCommercial === true
            );
            const propLabel = isCommercialCust ? 'Commercial Proposal' : 'Proposal';
            setSubject(defaultSubject || `${propLabel} from ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Thank you for choosing ${orgName}. Please review your ${isCommercialCust ? 'commercial ' : ''}proposal details and authorize online here:
${propLink}

Best regards,
${orgName}`);
        } else if (initialType === 'statement') {
            const dueAmt = Number(statementTotals?.totalDue || 0);
            const custAcc = getOrGenerateAccountNumber(customer);
            setSubject(defaultSubject || `Statement of Account: ${clientName} - ${statementNumber}`);
            setMessage(defaultMessage || `Dear ${clientName},

Please find your latest Statement of Account attached below from ${orgName}.

• Customer Account: ${custAcc || 'Primary Account'}
• Statement Period: ${statementPeriod}
• Statement Number: ${statementNumber}
• Outstanding Balance: $${dueAmt.toFixed(2)}

Please review your statement and remit payment for any open balance. If payment has already been sent, please disregard this notice.

Thank you for your business!

Best regards,
${orgName}`);
        } else if (initialType === 'confirmation') {
            const jobStr = targetJob ? `Job #${targetJob.id.slice(-8).toUpperCase()} (${targetJob.serviceType || 'Service Call'})` : 'Scheduled Service Call';
            const dateStr = targetJob?.appointmentTime ? new Date(targetJob.appointmentTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'As scheduled';
            const locStr = targetJob?.address || customer?.address || 'Site Address';

            setSubject(defaultSubject || `Confirmation: Service Appointment with ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

This is a confirmation for your upcoming service appointment with ${orgName}.

• Service Call: ${jobStr}
• Scheduled Date/Time: ${dateStr}
• Location: ${locStr}

Please let us know if you need to make any changes or have any questions prior to our visit.

Best regards,
${orgName}`);
        } else {
            // General communication mode (default for communications tab)
            setSubject(defaultSubject || `Message from ${orgName}`);
            setMessage(defaultMessage || `Hi ${clientName},

Thank you for choosing ${orgName}. If you have any questions or require assistance, please reply directly to this email.

Best regards,
${orgName}`);
        }
    }, [isOpen, recipientEmail, recipientName, customer, targetJob, targetInvoice, proposal, availableProposals, mode, defaultSubject, defaultMessage, state.currentOrganization, statementNumber, statementPeriod, statementTotals]);

    const handleSelectTemplate = (templateKey: CommunicationType) => {
        const orgName = state.currentOrganization?.name || 'Service Provider';
        const clientName = recipientName || customer?.name || targetJob?.customerName || 'Valued Customer';

        if (templateKey === 'email') {
            setSubject(`Message from ${orgName}`);
            setMessage(`Hi ${clientName},\n\nThank you for choosing ${orgName}. If you have any questions or require assistance, please reply directly to this email.\n\nBest regards,\n${orgName}`);
            setIncludeInvoice(false);
            setIncludeReport(false);
            setIncludeProposal(false);
            setIncludeStatement(false);
            setIncludeSignOff(false);
        } else if (templateKey === 'confirmation') {
            const jobStr = targetJob ? `Job #${targetJob.id.slice(-8).toUpperCase()} (${targetJob.serviceType || 'Service Call'})` : 'Scheduled Service Call';
            const dateStr = targetJob?.appointmentTime ? new Date(targetJob.appointmentTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'As scheduled';
            const locStr = targetJob?.address || customer?.address || 'Site Address';

            setSubject(`Confirmation: Service Appointment with ${orgName}`);
            setMessage(`Hi ${clientName},\n\nThis is a confirmation for your upcoming service appointment with ${orgName}.\n\n• Service Call: ${jobStr}\n• Scheduled Date/Time: ${dateStr}\n• Location: ${locStr}\n\nPlease let us know if you need to make any changes or have any questions prior to our visit.\n\nBest regards,\n${orgName}`);
            setIncludeInvoice(false);
            setIncludeReport(false);
            setIncludeProposal(false);
            setIncludeStatement(false);
            setIncludeSignOff(false);
        } else if (templateKey === 'report') {
            const repLink = targetJob?.id ? `${getBaseUrl()}/#/service-report/${targetJob.id}` : getBaseUrl();
            setSubject(`Service Report — Job #${targetJob?.id?.slice(-8).toUpperCase() || 'N/A'} — ${orgName}`);
            setMessage(`Hi ${clientName},\n\nThank you for choosing ${orgName}. Please review your completed service report details, technician findings, and site documentation online here:\n${repLink}\n\nBest regards,\n${orgName}`);
            setIncludeReport(true);
            setIncludeInvoice(false);
            setIncludeProposal(false);
            setIncludeStatement(false);
            if (hasSignOffData) setIncludeSignOff(true);
        } else if (templateKey === 'invoice') {
            const invId = targetInvoice?.id || targetJob?.id?.slice(0, 8) || 'N/A';
            const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);
            const invLink = targetJob?.id ? `${getBaseUrl()}/#/invoice/${targetJob.id}` : (targetInvoice?.id ? `${getBaseUrl()}/#/invoice/${targetInvoice.id}` : getBaseUrl());

            setSubject(`Invoice #${invId} from ${orgName}`);
            setMessage(`Hi ${clientName},\n\nPlease find your invoice #${invId} for $${totalAmt.toFixed(2)} attached below.\n\nYou can view, download, and pay your invoice securely online here:\n${invLink}\n\nThank you for your business!\n\nBest regards,\n${orgName}`);
            setIncludeInvoice(true);
            setIncludeReport(false);
            setIncludeProposal(false);
            setIncludeStatement(false);
            if (hasSignOffData) setIncludeSignOff(true);
        } else if (templateKey === 'proposal') {
            const propId = proposal?.id || targetJob?.proposalId || (availableProposals[0]?.id) || 'N/A';
            const propLink = `${getBaseUrl()}/#/proposal-view/${propId}`;
            const isCommercialCust = !!(
                customer?.customerType === 'Commercial' ||
                customer?.customerType === 'Property Management' ||
                (customer?.serviceLocations && customer.serviceLocations.length > 0) ||
                targetJob?.customer?.customerType === 'Commercial' ||
                (proposal as any)?.customerType === 'Commercial' ||
                (proposal as any)?.isProjectLevel === true ||
                (proposal as any)?.isCommercial === true
            );
            const propLabel = isCommercialCust ? 'Commercial Proposal' : 'Proposal';

            setSubject(`${propLabel} from ${orgName}`);
            setMessage(`Hi ${clientName},\n\nThank you for choosing ${orgName}. Please review your ${isCommercialCust ? 'commercial ' : ''}proposal details and authorize online here:\n${propLink}\n\nBest regards,\n${orgName}`);
            setIncludeProposal(true);
            setIncludeInvoice(false);
            setIncludeReport(false);
            setIncludeStatement(false);
            setIncludeSignOff(false);
            if (availableProposals.length > 0 && selectedProposalIds.length === 0) {
                setSelectedProposalIds([availableProposals[0].id]);
            }
        } else if (templateKey === 'statement') {
            const dueAmt = Number(statementTotals?.totalDue || 0);
            const custAcc = getOrGenerateAccountNumber(customer);
            setSubject(`Statement of Account: ${clientName} - ${statementNumber}`);
            setMessage(`Dear ${clientName},\n\nPlease find your latest Statement of Account attached below from ${orgName}.\n\n• Customer Account: ${custAcc || 'Primary Account'}\n• Statement Period: ${statementPeriod}\n• Statement Number: ${statementNumber}\n• Outstanding Balance: $${dueAmt.toFixed(2)}\n\nPlease review your statement and remit payment for any open balance. If payment has already been sent, please disregard this notice.\n\nThank you for your business!\n\nBest regards,\n${orgName}`);
            setIncludeStatement(true);
            setIncludeInvoice(false);
            setIncludeReport(false);
            setIncludeProposal(false);
            setIncludeSignOff(false);
        }
    };

    const handleSelectType = async (newType: CommunicationType) => {
        setActiveType(newType);
        handleSelectTemplate(newType);
        setHasUserEditedMessage(false);
        if (attachPdfFiles) {
            await handleGeneratePdfAttachments({
                incInv: newType === 'invoice',
                incRep: newType === 'report',
                incProp: newType === 'proposal',
                incStmt: newType === 'statement',
                incSign: (newType === 'invoice' || newType === 'report') && hasSignOffData
            });
        }
    };

    const handleAddEmail = () => {
        const trimmed = newEmailInput.trim().toLowerCase();
        if (!trimmed) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            showToast.warn("Please enter a valid email address.");
            return;
        }
        if (recipients.some(r => r.toLowerCase() === trimmed)) {
            showToast.warn("Email already added.");
            return;
        }
        setRecipients(prev => [...prev, trimmed]);
        setNewEmailInput('');
    };

    const handleRemoveEmail = (emailToRemove: string) => {
        setRecipients(prev => prev.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase()));
    };

    const toggleContactSelect = (email: string) => {
        const lower = email.toLowerCase();
        if (recipients.some(r => r.toLowerCase() === lower)) {
            setRecipients(prev => prev.filter(e => e.toLowerCase() !== lower));
        } else {
            setRecipients(prev => [...prev, lower]);
        }
    };

    const getAttachmentConfigKey = (
        incInv = includeInvoice,
        incRep = includeReport,
        incProp = includeProposal,
        incStmt = includeStatement,
        incSign = includeSignOff,
        propIds = selectedProposalIds,
        fileIds = selectedJobFileIds,
        targetJId = targetJob?.id,
        targetInvId = targetInvoice?.id,
        customMsg = message.trim()
    ) => {
        return JSON.stringify({
            targetJId: targetJId || '',
            targetInvId: targetInvId || '',
            incInv,
            incRep,
            incProp,
            incStmt,
            incSign,
            propIds: [...propIds].sort(),
            fileIds: [...fileIds].sort(),
            customMsg
        });
    };

    const handleGeneratePdfAttachments = async (
        overrideFlags?: { incInv?: boolean; incRep?: boolean; incProp?: boolean; incStmt?: boolean; incSign?: boolean },
        overridePropIds?: string[],
        overrideFileIds?: string[]
    ) => {
        setIsGeneratingPdfs(true);
        try {
            const incInv = overrideFlags?.incInv ?? includeInvoice;
            const incRep = overrideFlags?.incRep ?? includeReport;
            const incProp = overrideFlags?.incProp ?? includeProposal;
            const incStmt = overrideFlags?.incStmt ?? includeStatement;
            const incSign = overrideFlags?.incSign ?? includeSignOff;
            const propIds = overridePropIds ?? selectedProposalIds;
            const fileIds = overrideFileIds ?? selectedJobFileIds;

            showToast.info(t("Generating selected PDF attachments..."));
            const chosenProps = availableProposals.filter((p: any) => propIds.includes(p.id));
            const chosenJobFiles = availableJobFiles.filter((f: any, idx: number) => {
                const fKey = getJobFileKey(f, idx);
                return fileIds.includes(fKey) && !isInternalExpenseFile(f);
            });

            const resolvedTargetCustomer = customer || (targetJob?.customerId ? state.customers?.find((c: any) => c.id === targetJob.customerId) : null);
            const enrichedJobForPdf = targetJob ? {
                ...targetJob,
                customer: resolvedTargetCustomer || targetJob?.customer,
                customerEquipment: resolvedTargetCustomer?.equipment || targetJob?.customerEquipment || [],
                files: targetJob.files || []
            } : targetJob;

            const generated = await generateMultiDocumentPdfAttachments(
                {
                    job: enrichedJobForPdf,
                    customer: resolvedTargetCustomer,
                    invoice: targetInvoice,
                    proposal: chosenProps[0] || targetProposal,
                    proposals: chosenProps,
                    selectedJobFiles: chosenJobFiles,
                    includeInvoice: incInv,
                    includeReport: incRep,
                    includeProposal: incProp && (chosenProps.length > 0 || !!targetProposal || !!proposal || !!targetJob?.proposalId),
                    includeStatement: incStmt,
                    statementJobs,
                    statementTotals,
                    statementPeriod,
                    statementNumber,
                    includeSignOff: incSign,
                    signOffFile: signOffFile,
                    customMessage: message.trim()
                },
                state.currentOrganization
            );

            if (generated.length > 0) {
                setGeneratedPdfAttachments(generated);
                lastGeneratedConfigKeyRef.current = getAttachmentConfigKey(incInv, incRep, incProp, incStmt, incSign, propIds, fileIds);
                setAttachPdfFiles(true);
                showToast.success(t(`Generated ${generated.length} PDF file attachment(s)!`));
            } else {
                setGeneratedPdfAttachments([]);
                lastGeneratedConfigKeyRef.current = '';
                showToast.warn(t("Please select at least one document or file to attach."));
            }
        } catch (e: any) {
            console.error("PDF generation error:", e);
            showToast.warn(t("Could not generate PDF documents. Please try again."));
        } finally {
            setIsGeneratingPdfs(false);
        }
    };

    const handleSend = async () => {
        if (recipients.length === 0) {
            showToast.warn("Please add at least one recipient email.");
            return;
        }
        if (!subject.trim()) {
            showToast.warn("Please enter a subject line.");
            return;
        }
        if (!message.trim()) {
            showToast.warn("Please enter a message body.");
            return;
        }

        setIsSending(true);
        try {
            const orgName = (state.currentOrganization?.name || 'TekAir Inc.').trim();
            const fromDisplayName = `"${orgName.replace(/"/g, "'")}" <platform@tektrakker.com>`;
            const orgReplyEmail = state.currentOrganization?.email || state.currentUser?.email || 'Operations@tekairinc.com';
            let htmlContent = autoLinkifyText(message.replace(/\n/g, '<br/>'));

            // 1. Standard Interactive Links (Default option - keeps signatures & tracking in system)
            if (attachInteractiveLinks) {
                let linksBlock = '';

                if (includeInvoice && (targetJob?.id || targetInvoice)) {
                    const invId = targetInvoice?.id || targetJob?.id?.slice(0, 8);
                    const totalAmt = Number(targetInvoice?.totalAmount || targetInvoice?.amount || targetJob?.invoice?.totalAmount || 0);
                    const invLink = targetJob?.id ? `${getBaseUrl()}/#/invoice/${targetJob.id}` : (targetInvoice?.id ? `${getBaseUrl()}/#/invoice/${targetInvoice.id}` : getBaseUrl());
                    linksBlock += `
                        <div style="margin-top: 20px; padding: 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: left;">
                            <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: bold;">Invoice #${invId}${totalAmt > 0 ? ` — $${totalAmt.toFixed(2)}` : ''}</h4>
                            <p style="margin: 0 0 10px 0; color: #475569; font-size: 13px;">View, sign, and pay your invoice securely online.</p>
                            ${createEmailButtonHtml('View &amp; Pay Invoice Online', invLink, '#2563eb')}
                        </div>
                    `;
                }

                if (includeReport && targetJob?.id) {
                    const reportLink = `${getBaseUrl()}/#/service-report/${targetJob.id}`;
                    linksBlock += `
                        <div style="margin-top: 20px; padding: 18px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: left;">
                            <h4 style="margin: 0 0 6px 0; color: #166534; font-size: 16px; font-weight: bold;">Service History Report #${targetJob.id.slice(-8).toUpperCase()}</h4>
                            <p style="margin: 0 0 10px 0; color: #15803d; font-size: 13px;">Access complete technician notes, completion status, and site documentation online.</p>
                            ${createEmailButtonHtml('View Service Report Online', reportLink, '#16a34a')}
                        </div>
                    `;
                }

                if (includeProposal && (proposal || targetJob?.proposalId || selectedProposalIds.length > 0 || availableProposals.length > 0)) {
                    const chosenProps = availableProposals.filter((p: any) => selectedProposalIds.includes(p.id));
                    const propsToRender = chosenProps.length > 0 ? chosenProps : (proposal ? [proposal] : (targetProposal ? [targetProposal] : []));

                    propsToRender.forEach((p: any) => {
                        const propId = p.id;
                        const propTitle = p.title || `Commercial Contract Proposal #${propId}`;
                        const propTotal = Number(p.total || p.totalAmount || p.recommendedRoundedTotal || p.calculatedTotal || 0);
                        const propLink = `${getBaseUrl()}/#/proposal-view/${propId}`;
                        linksBlock += `
                            <div style="margin-top: 20px; padding: 18px; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; text-align: left;">
                                <h4 style="margin: 0 0 6px 0; color: #0369a1; font-size: 16px; font-weight: bold;">${propTitle}${propTotal > 0 ? ` — $${propTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}` : ''}</h4>
                                <p style="margin: 0 0 10px 0; color: #0284c7; font-size: 13px;">Review option tiers, scope of work, and authorize your proposal online.</p>
                                ${createEmailButtonHtml('View &amp; Sign Proposal Online', propLink, '#0284c7')}
                            </div>
                        `;
                    });
                }

                if (paymentRequest && paymentRequest.id) {
                    const payLink = `${getBaseUrl()}/#/pay/${paymentRequest.id}`;
                    const payAmt = Number(paymentRequest.amount || 0);
                    linksBlock += `
                        <div style="margin-top: 20px; padding: 18px; background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; text-align: left;">
                            <h4 style="margin: 0 0 6px 0; color: #3730a3; font-size: 16px; font-weight: bold;">${paymentRequest.title || 'Online Payment Request'}${payAmt > 0 ? ` — $${payAmt.toFixed(2)}` : ''}</h4>
                            <p style="margin: 0 0 10px 0; color: #4338ca; font-size: 13px;">Pay your deposit securely online with any major credit card.</p>
                            ${createEmailButtonHtml(`Pay $${payAmt.toFixed(2)} Deposit Online`, payLink, '#4f46e5')}
                        </div>
                    `;
                }

                if (includeStatement) {
                    const custAcc = getOrGenerateAccountNumber(customer || targetCustomer);
                    const dueAmt = Number(statementTotals?.totalDue || 0);
                    linksBlock += `
                        <div style="margin-top: 20px; padding: 18px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; text-align: left;">
                            <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: bold;">Statement of Account: ${statementNumber}</h4>
                            <p style="margin: 0 0 6px 0; color: #475569; font-size: 13px;"><strong>Account:</strong> ${custAcc || 'Primary Account'} &bull; <strong>Period:</strong> ${statementPeriod}</p>
                            <p style="margin: 0 0 10px 0; color: ${dueAmt > 0 ? '#b91c1c' : '#15803d'}; font-size: 14px; font-weight: bold;">Outstanding Balance: $${dueAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                            <p style="margin: 0; color: #64748b; font-size: 12px;">Full ledger history of open invoices and payments is attached to this email.</p>
                        </div>
                    `;
                }

                if (linksBlock) {
                    htmlContent += `<div style="margin-top: 24px;">${linksBlock}</div>`;
                }
            }

            // Append User Email Signature (if enabled)
            if (includeSignature && activeUserSignature) {
                htmlContent += `<br/><br/>${activeUserSignature}`;
            }

            // Confidentiality & Security Notice for sensitive document links and financial materials
            const confidentialityNoticeHtml = `
                <div style="margin-top: 24px; padding: 12px 14px; background-color: #f8fafc; border-left: 3px solid #94a3b8; border-radius: 6px; font-size: 11px; color: #64748b; line-height: 1.45; text-align: left;">
                    <strong style="color: #334155;">🔒 Confidentiality &amp; Security Notice:</strong> This message, along with any linked documents, invoices, proposals, reports, or attachments, contains confidential business and financial information intended exclusively for the authorized recipient. Please do not forward or share these secure links or documents with unauthorized viewers. If you received this transmission in error, please immediately notify the sender and delete this email.
                </div>
            `;
            htmlContent += confidentialityNoticeHtml;

            // 2. Prepare PDF & File Attachments dynamically strictly matching user-selected items
            let pdfAttachments: EmailAttachment[] = [];
            
            if (attachPdfFiles) {
                const currentConfigKey = getAttachmentConfigKey();
                const isCacheValid = generatedPdfAttachments.length > 0 && lastGeneratedConfigKeyRef.current === currentConfigKey;

                if (isCacheValid) {
                    // Reuse already generated attachments directly - instant send!
                    pdfAttachments = generatedPdfAttachments;
                } else {
                    // Only generate once if not yet generated or configuration modified
                    let chosenProps = availableProposals.filter((p: any) => selectedProposalIds.includes(p.id));
                    if (chosenProps.length === 0 && includeProposal) {
                        const fallbackProp = targetProposal || proposal || (targetJob?.proposalId ? state.proposals.find(p => p.id === targetJob?.proposalId) : null);
                        if (fallbackProp) {
                            chosenProps = [fallbackProp];
                        }
                    }
                    const chosenJobFiles = availableJobFiles.filter((f: any, idx: number) => {
                        const fKey = getJobFileKey(f, idx);
                        return selectedJobFileIds.includes(fKey) && !isInternalExpenseFile(f);
                    });
                    const hasSelectedDocsOrFiles = includeInvoice || includeReport || includeSignOff || (includeProposal && (chosenProps.length > 0 || !!targetProposal || !!proposal)) || includeStatement || chosenJobFiles.length > 0;
                    
                    if (hasSelectedDocsOrFiles) {
                        setIsGeneratingPdfs(true);
                        showToast.info(t("Generating requested PDF documents & attachments..."));

                        try {
                            const resolvedTargetCustomer = customer || (targetJob?.customerId ? state.customers?.find((c: any) => c.id === targetJob.customerId) : null);
                            const enrichedJobForPdf = targetJob ? {
                                ...targetJob,
                                customer: resolvedTargetCustomer || targetJob?.customer,
                                customerEquipment: resolvedTargetCustomer?.equipment || targetJob?.customerEquipment || [],
                                files: targetJob.files || []
                            } : targetJob;

                            pdfAttachments = await generateMultiDocumentPdfAttachments(
                                {
                                    job: enrichedJobForPdf,
                                    customer: resolvedTargetCustomer,
                                    invoice: targetInvoice,
                                    proposal: chosenProps[0] || targetProposal || proposal || null,
                                    proposals: chosenProps.length > 0 ? chosenProps : (targetProposal ? [targetProposal] : (proposal ? [proposal] : [])),
                                    selectedJobFiles: chosenJobFiles,
                                    includeInvoice: includeInvoice,
                                    includeReport: includeReport,
                                    includeProposal: includeProposal && (chosenProps.length > 0 || !!targetProposal || !!proposal),
                                    includeStatement: includeStatement,
                                    statementJobs,
                                    statementTotals,
                                    statementPeriod,
                                    statementNumber,
                                    includeSignOff: includeSignOff,
                                    signOffFile: signOffFile,
                                    customMessage: message.trim()
                                },
                                state.currentOrganization
                            );
                            setGeneratedPdfAttachments(pdfAttachments);
                            lastGeneratedConfigKeyRef.current = currentConfigKey;
                        } finally {
                            setIsGeneratingPdfs(false);
                        }
                    }
                }
            }

            const isInvoice = activeType === 'invoice' || includeInvoice;
            const isProposal = activeType === 'proposal' || includeProposal;
            const isStatement = activeType === 'statement' || includeStatement;
            const isReport = activeType === 'report' || includeReport;

            const mailPayload = {
                to: recipients,
                from: fromDisplayName,
                replyTo: orgReplyEmail,
                message: {
                    from: fromDisplayName,
                    subject: subject.trim(),
                    html: `<div style="font-family: Arial, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">${htmlContent}</div>`,
                    text: message.trim(),
                    replyTo: orgReplyEmail,
                    ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {})
                },
                type: isInvoice ? 'Invoice' : isProposal ? 'Proposal' : isStatement ? 'Statement' : isReport ? 'ServiceReport' : 'CustomerEmail',
                skipAutoLog: true,
                createdAt: new Date().toISOString()
            };

            await sendEmail(state.currentOrganization, mailPayload);

            // Record sent date on invoice ONLY if invoice was explicitly included or active
            const sentAtDate = new Date().toISOString();
            if (isInvoice && targetJob?.id) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                    'invoice.sentAt': sentAtDate,
                    'invoiceSentAt': sentAtDate,
                    ...(targetJob.invoice?.status === 'Draft' ? { 'invoice.status': 'Unpaid' } : {})
                })).catch(() => {});
            }

            // Record sent date on proposal if applicable
            if ((isProposal || includeProposal) && (selectedProposalIds.length > 0 || targetProposal?.id || proposal?.id)) {
                const propIdsToUpdate = Array.from(new Set([
                    ...selectedProposalIds,
                    ...(targetProposal?.id ? [targetProposal.id] : []),
                    ...(proposal?.id ? [proposal.id] : [])
                ])).filter(Boolean);

                for (const propId of propIdsToUpdate) {
                    const existingProp = state.proposals?.find((p: any) => p.id === propId);
                    const newStatus = (!existingProp?.status || existingProp.status === 'Draft') ? 'Sent' : existingProp.status;
                    await db.collection('proposals').doc(propId).update(cleanUndefinedFields({
                        sentAt: sentAtDate,
                        sentDate: sentAtDate,
                        status: newStatus,
                        updatedAt: sentAtDate
                    })).catch(() => {});
                }

                if (targetJob?.id) {
                    await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                        proposalSentAt: sentAtDate
                    })).catch(() => {});
                }
            }

            // Record service report sent date if applicable
            if (isReport && targetJob?.id) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                    serviceReportSentAt: sentAtDate
                })).catch(() => {});
            }

            const targetCustomerId = customerId || customer?.id || targetJob?.customerId;

            // 1. Record in global messages collection for system-wide messaging & timeline tracking
            const msgObj: any = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderId: state.currentUser?.id || 'staff',
                senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
                receiverId: recipients[0] || customer?.email || '',
                customerId: targetCustomerId || null,
                to: recipients.join(', '),
                content: message.trim(),
                subject: subject.trim(),
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || customer?.organizationId || 'unaffiliated',
                type: 'email'
            };
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj)).catch((err) => console.error("Error saving message:", err));

            // 2. Record communication log entry for customer subcollection
            if (targetCustomerId) {
                const commType = isInvoice ? 'invoice' : isProposal ? 'proposal' : isStatement ? 'statement' : isReport ? 'report' : 'email';
                const commBadgeLabel = pdfAttachments.length > 0
                    ? `${pdfAttachments.length} PDF(s) Attached`
                    : isInvoice
                    ? 'Invoice Sent'
                    : isProposal
                    ? 'Proposal Sent'
                    : isStatement
                    ? 'Statement Sent'
                    : isReport
                    ? 'Report Sent'
                    : 'Email Sent';

                const commBadgeColor = pdfAttachments.length > 0
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    : isInvoice
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : isProposal
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
                    : isStatement
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    : isReport
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';

                const commEntry = {
                    id: `comm-${Date.now()}`,
                    type: commType,
                    title: subject.trim(),
                    subtitle: `To: ${recipients.join(', ')}`,
                    content: message.trim(),
                    badgeLabel: commBadgeLabel,
                    badgeColor: commBadgeColor,
                    timestamp: sentAtDate,
                    senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'System'
                };
                
                await db.collection('customers').doc(targetCustomerId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
            }

            const successToastMsg = pdfAttachments.length > 0
                ? "Email sent with PDF attachment(s)!"
                : isInvoice
                ? "Invoice sent successfully!"
                : isProposal
                ? "Proposal sent successfully!"
                : isStatement
                ? "Statement sent successfully!"
                : isReport
                ? "Service report sent successfully!"
                : "Email sent successfully!";
            showToast.success(t(successToastMsg));
            if (onSuccess) onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Error sending email:", e);
            showToast.warn(t("Failed to send email. Please try again."));
        } finally {
            setIsSending(false);
        }
    };

    const modalTitle = useMemo(() => {
        switch (activeType) {
            case 'invoice': return t("Send Invoice Email");
            case 'proposal': return t("Send Proposal / Quote");
            case 'report': return t("Send Service Report");
            case 'statement': return t("Send Account Statement");
            case 'confirmation': return t("Send Appointment Confirmation");
            default: return t("Compose & Send Email");
        }
    }, [activeType, t]);

    const modalSubtitle = useMemo(() => {
        switch (activeType) {
            case 'invoice': return t("Email Invoice to Customer");
            case 'proposal': return t("Email Proposal & Estimate to Customer");
            case 'report': return t("Email Completed Job & Service Report");
            case 'statement': return t("Email Statement of Account & Ledger");
            case 'confirmation': return t("Email Appointment Schedule & Details");
            default: return t("Direct Customer Email");
        }
    }, [activeType, t]);

    const sendButtonLabel = useMemo(() => {
        switch (activeType) {
            case 'invoice': return t("Send Invoice");
            case 'proposal': return t("Send Proposal");
            case 'report': return t("Send Report");
            case 'statement': return t("Send Statement");
            case 'confirmation': return t("Send Confirmation");
            default: return t("Send Email");
        }
    }, [activeType, t]);

    const modalHeaderTheme = useMemo(() => {
        switch (activeType) {
            case 'invoice':
                return {
                    icon: <Receipt size={20} />,
                    iconClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
                };
            case 'proposal':
                return {
                    icon: <FileEdit size={20} />,
                    iconClass: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400',
                };
            case 'report':
                return {
                    icon: <ClipboardCheck size={20} />,
                    iconClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
                };
            case 'statement':
                return {
                    icon: <Receipt size={20} />,
                    iconClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
                };
            case 'confirmation':
                return {
                    icon: <Calendar size={20} />,
                    iconClass: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400',
                };
            default:
                return {
                    icon: <Mail size={20} />,
                    iconClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
                };
        }
    }, [activeType]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="xl"
            zIndex={zIndex}
        >
            <div className="p-6 space-y-5">
                {/* Header Subtitle */}
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${modalHeaderTheme.iconClass}`}>
                        {modalHeaderTheme.icon}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                            {modalSubtitle}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {targetJob ? `${t("Job")} #${targetJob.id.slice(-6).toUpperCase()} ${targetJob.customerName ? `• ${targetJob.customerName}` : ''}` : (customer?.name || t("Customize subject & message before sending."))}
                        </p>
                    </div>
                </div>

                {/* Communication & Document Purpose Selector */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            {t("Communication & Document Purpose:")}
                        </label>
                        {hasUserEditedMessage && (
                            <button
                                type="button"
                                onClick={() => handleSelectTemplate(activeType)}
                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                title={t("Restore standard text template for this type")}
                            >
                                <RefreshCw size={11} />
                                <span>{t("Reset to Default Template")}</span>
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {/* General Email */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('email')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'email'
                                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200 shadow-md scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Mail size={13} />
                            <span className="truncate">{t("General Email")}</span>
                        </button>

                        {/* Invoice */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('invoice')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'invoice'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300'
                            }`}
                        >
                            <FileText size={13} />
                            <span className="truncate">{t("Invoice")}</span>
                            {hasInvoiceData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>}
                        </button>

                        {/* Proposal / Quote */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('proposal')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'proposal'
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/20 scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300'
                            }`}
                        >
                            <FileEdit size={13} />
                            <span className="truncate">{t("Proposal / Quote")}</span>
                            {hasProposalData && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>}
                        </button>

                        {/* Service Report */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('report')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'report'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300'
                            }`}
                        >
                            <ClipboardCheck size={13} />
                            <span className="truncate">{t("Service Report")}</span>
                            {hasReportData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>}
                        </button>

                        {/* Account Statement */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('statement')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'statement'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20 scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300'
                            }`}
                        >
                            <Receipt size={13} />
                            <span className="truncate">{t("Statement")}</span>
                            {hasStatementData && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                    ${statementTotals.totalDue.toFixed(0)}
                                </span>
                            )}
                        </button>

                        {/* Appointment Confirmation */}
                        <button
                            type="button"
                            onClick={() => handleSelectType('confirmation')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                                activeType === 'confirmation'
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20 scale-[1.01]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300'
                            }`}
                        >
                            <Calendar size={13} />
                            <span className="truncate">{t("Confirmation")}</span>
                        </button>
                    </div>
                </div>

                {/* Recipient Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        {t("Recipients (To)")} <span className="text-rose-500">*</span>
                    </label>

                    {/* Chips for selected recipients */}
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[44px]">
                        {recipients.map(email => (
                            <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-xs font-semibold shadow-sm">
                                <Mail size={12} />
                                {email}
                                <button type="button" onClick={() => handleRemoveEmail(email)} className="hover:text-rose-600 transition-colors p-0.5 rounded-full">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}

                        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                            <input
                                type="email"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                placeholder={recipients.length === 0 ? t("Enter recipient email address...") : t("Add another email...")}
                                className="w-full text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 py-1"
                            />
                            <button
                                type="button"
                                onClick={handleAddEmail}
                                className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap"
                            >
                                + {t("Add")}
                            </button>
                        </div>
                    </div>

                    {/* Available Contacts Shortcuts */}
                    {availableContacts.length > 0 && (
                        <div className="pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                {t("Quick Add Contacts:")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {availableContacts.map(c => {
                                    const isSelected = recipients.some(r => r.toLowerCase() === c.email.toLowerCase());
                                    return (
                                        <button
                                            key={c.email}
                                            type="button"
                                            onClick={() => toggleContactSelect(c.email)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            {isSelected ? <Check size={12} /> : <User size={12} />}
                                            <span>{c.label} ({c.email})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Message Templates */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t("Quick Message Templates:")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleSelectTemplate('email')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
                        >
                            ✉️ {t("General Communication")}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectTemplate('confirmation')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 transition-all shadow-sm"
                        >
                            📅 {t("Appointment Confirmation")}
                        </button>
                        {hasProposalData && (
                            <button
                                type="button"
                                onClick={() => handleSelectTemplate('proposal')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-all shadow-sm"
                            >
                                📝 {t("Proposal / Quote")}
                            </button>
                        )}
                        {hasReportData && (
                            <button
                                type="button"
                                onClick={() => handleSelectTemplate('report')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-all shadow-sm"
                            >
                                📋 {t("Service Report")}
                            </button>
                        )}
                        {hasInvoiceData && (
                            <button
                                type="button"
                                onClick={() => handleSelectTemplate('invoice')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all shadow-sm"
                            >
                                📄 {t("Invoice Notice")}
                            </button>
                        )}
                        {hasStatementData && (
                            <button
                                type="button"
                                onClick={() => handleSelectTemplate('statement')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-all shadow-sm"
                            >
                                🧾 {t("Account Statement")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Subject */}
                <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        {t("Subject Line")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={subject}
                        onChange={(e) => {
                            setSubject(e.target.value);
                            setHasUserEditedMessage(true);
                        }}
                        placeholder={t("Enter email subject...")}
                        className="text-xs font-medium"
                    />
                </div>

                {/* Message Body */}
                <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        {t("Message Body")} <span className="text-rose-500">*</span>
                    </label>
                    <Textarea
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            setHasUserEditedMessage(true);
                        }}
                        rows={6}
                        placeholder={t("Write your email message here...")}
                        className="text-xs leading-relaxed font-sans"
                    />
                </div>

                {/* Sender Email Signature Section */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeSignature}
                                onChange={(e) => setIncludeSignature(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {t("Include Official Email Signature")} <span className="font-normal text-slate-500 dark:text-slate-400 font-sans">({senderDisplayName})</span>
                            </span>
                        </label>
                        {includeSignature && (
                            <button
                                type="button"
                                onClick={() => setShowSignaturePreview(prev => !prev)}
                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                                <span>{showSignaturePreview ? t("Hide Preview") : t("Preview Signature")}</span>
                            </button>
                        )}
                    </div>
                    {includeSignature && showSignaturePreview && activeUserSignature && (
                        <div className="mt-2 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg overflow-x-auto shadow-inner">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                {t("Signature Preview:")}
                            </div>
                            <div 
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeUserSignature || '') }} 
                                className="transform origin-top-left scale-[0.95] sm:scale-100"
                            />
                        </div>
                    )}
                </div>

                {/* Multi-Document Selection Section */}
                {(hasInvoiceData || hasReportData || hasProposalData || hasStatementData || targetJob) && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                        {/* Header & Target Job Selector */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                    <Layers size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>{t("Select Job & Documents to Include in Email")}</span>
                                </div>
                                {targetJob?.jobStatus && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        {targetJob.jobStatus || targetJob.status}
                                    </span>
                                )}
                            </div>

                            {/* Job Dropdown Selector (always visible if jobs exist) */}
                            {customerJobs.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                        {t("Linked Job / Work Order:")}
                                    </label>
                                    <select
                                        value={selectedJobId}
                                        onChange={async (e) => {
                                            const newId = e.target.value;
                                            setSelectedJobId(newId);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments();
                                            }
                                        }}
                                        className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    >
                                        {customerJobs.map((j: any) => {
                                             const woNum = getJobWoNumber(j);
                                             const invNum = getJobInvoiceNumber(j);
                                             const siteLoc = getJobSiteLocation(j, customer);
                                             const visitDt = getJobVisitDate(j);
                                             const isSelected = j.id === selectedJobId;
                                             return (
                                                 <option key={j.id} value={j.id}>
                                                     {isSelected ? '★ ' : ''}WO: {woNum} | Inv: {invNum} | Site: {siteLoc} | Visit: {visitDt} ({j.serviceType || 'Service Call'})
                                                 </option>
                                             );
                                        })}
                                    </select>
                                </div>
                            )}

                            {/* Rich Linked Job Information Grid Banner */}
                            {targetJob && (
                                <div className="p-3 bg-white dark:bg-slate-950 border border-indigo-100 dark:border-indigo-900/40 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shadow-inner">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Site Location</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5" title={getJobSiteLocation(targetJob, customer)}>
                                            {getJobSiteLocation(targetJob, customer)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Site Visit Date</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-0.5">
                                            {getJobVisitDate(targetJob)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">WO Number</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                                            {getJobWoNumber(targetJob)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Invoice Number</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                                            {getJobInvoiceNumber(targetJob)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Primary Record Selection Checkboxes (Invoice, Job Report, Sign-Off Sheet, Proposals for selected job, Account Statement) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                            {hasInvoiceData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeInvoice ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 text-indigo-900 dark:text-indigo-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeInvoice}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeInvoice(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incInv: checked });
                                            }
                                        }}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>📄 {t("Job Invoice")} ({getJobInvoiceNumber(targetJob)})</span>
                                </label>
                            )}

                            {hasReportData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeReport ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeReport}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeReport(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incRep: checked });
                                            }
                                        }}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>📋 {t("Job Report")}</span>
                                </label>
                            )}

                            {hasSignOffData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeSignOff ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeSignOff}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeSignOff(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incSign: checked });
                                            }
                                        }}
                                        className="rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="truncate">
                                        <span>✍️ {t("Sign-Off Sheet")}</span>
                                        {signOffFile?.fileName && (
                                            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                                                {signOffFile.fileName}
                                            </span>
                                        )}
                                    </div>
                                </label>
                            )}

                            {hasProposalData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeProposal ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 text-sky-900 dark:text-sky-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeProposal}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeProposal(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incProp: checked });
                                            }
                                        }}
                                        className="rounded text-sky-600 focus:ring-sky-500"
                                    />
                                    <span>📝 {t("Proposals")} {availableProposals.length > 0 ? `(${availableProposals.length})` : ''}</span>
                                </label>
                            )}

                            {hasStatementData && (
                                <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                                    includeStatement ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={includeStatement}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            setIncludeStatement(checked);
                                            if (attachPdfFiles) {
                                                await handleGeneratePdfAttachments({ incStmt: checked });
                                            }
                                        }}
                                        className="rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="truncate">
                                        <span>🧾 {t("Account Statement")}</span>
                                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                                            {statementJobs.length} {t("invoices")} (${statementTotals.totalDue.toFixed(2)})
                                        </span>
                                    </div>
                                </label>
                            )}
                        </div>

                        {/* Itemized Proposal Checkboxes (Strictly Job-Linked Proposals) */}
                        {includeProposal && availableProposals.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-sky-700 dark:text-sky-400 uppercase tracking-wider block">
                                        {t("Proposal(s) Linked to Selected Job:")}
                                    </label>
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                        {availableProposals.map((p: any) => {
                                            const isSelected = selectedProposalIds.includes(p.id);
                                            const title = p.title || p.items?.[0]?.name || (p.isProjectLevel || p.customerType === 'Commercial' ? 'Commercial Proposal' : 'Proposal');
                                            const total = p.total != null ? `$${Number(p.total).toFixed(2)}` : '';
                                            return (
                                                <label key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                                    isSelected ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 text-sky-900 dark:text-sky-200 font-semibold' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                const updated = checked ? [...selectedProposalIds, p.id] : selectedProposalIds.filter(id => id !== p.id);
                                                                setSelectedProposalIds(updated);
                                                                if (attachPdfFiles) {
                                                                    await handleGeneratePdfAttachments({ incProp: updated.length > 0 }, updated);
                                                                }
                                                            }}
                                                            className="rounded text-sky-600 focus:ring-sky-500"
                                                        />
                                                        <span className="truncate">📝 {title} <span className="text-[10px] text-slate-400 font-mono">({p.proposalNumber || p.id})</span></span>
                                                    </div>
                                                    {total && <span className="font-bold text-xs shrink-0 ml-2">{total}</span>}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Uploaded Job Document Attachments */}
                        {(availableJobFiles.length > 0 || sitePhotoCount > 0) && (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                        {t("Uploaded Job Documents:")}
                                    </label>
                                    {sitePhotoCount > 0 && (
                                        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer font-medium hover:text-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={showSitePhotos}
                                                onChange={(e) => setShowSitePhotos(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <ImageIcon size={12} className="text-slate-400" />
                                            <span>Show {sitePhotoCount} site photo(s)</span>
                                        </label>
                                    )}
                                </div>

                                {availableJobFiles.length > 0 ? (
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                        {availableJobFiles.map((f: any, idx: number) => {
                                            const fileKey = getJobFileKey(f, idx);
                                            const isSelected = selectedJobFileIds.includes(fileKey);
                                            const name = f.fileName || f.label || f.name || f.title || 'Attached Document';
                                            const fileTypeLabel = f.isExternalWorkOrder ? 'Work Order PDF' : f.type || 'File';
                                            return (
                                                <label key={fileKey} className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                                    isSelected ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-200 font-semibold' : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                const updated = checked ? [...selectedJobFileIds, fileKey] : selectedJobFileIds.filter(id => id !== fileKey);
                                                                setSelectedJobFileIds(updated);
                                                                if (attachPdfFiles) {
                                                                    await handleGeneratePdfAttachments(undefined, undefined, updated);
                                                                }
                                                            }}
                                                            className="rounded text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <span className="truncate">📎 {name}</span>
                                                    </div>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase shrink-0 ml-2">{fileTypeLabel}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400 italic">No document attachments uploaded for this job.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Delivery Method Options */}
                <div className="space-y-2.5 pt-1">
                    {/* Option 1: Standard Interactive Links (Default ON) */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <FileText size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    {t("Include Standard Interactive Web Links (Default)")}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    {t("Keeps online approvals, payments, and signature tracking active inside TekTrakker")}
                                </span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={attachInteractiveLinks}
                            onChange={(e) => setAttachInteractiveLinks(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>

                    {/* Option 2: Attach as PDF Files (Opt-In OFF by default) */}
                    <div className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Paperclip size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                <div>
                                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                                        {t("Attach Selected Documents as PDF Files (Customer Request)")}
                                    </span>
                                    <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 block">
                                        {t("Checking this box generates and attaches printable PDF file(s) immediately")}
                                    </span>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={attachPdfFiles}
                                onChange={async (e) => {
                                    const checked = e.target.checked;
                                    setAttachPdfFiles(checked);
                                    if (checked) {
                                        await handleGeneratePdfAttachments();
                                    } else {
                                        setGeneratedPdfAttachments([]);
                                        lastGeneratedConfigKeyRef.current = '';
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                        </div>

                        {/* PDF Generation Status / Attachment Preview Chips */}
                        {attachPdfFiles && (
                            <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40 space-y-2">
                                {isGeneratingPdfs ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 animate-pulse">
                                        <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>{t("Generating and rendering PDF attachment(s)... Please wait...")}</span>
                                    </div>
                                ) : generatedPdfAttachments.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                                <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                                                {t("Attached PDF Files Ready to Send:")} ({generatedPdfAttachments.length})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleGeneratePdfAttachments()}
                                                className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                                            >
                                                <span>⚡ {t("Re-Generate PDFs")}</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {generatedPdfAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700/60 rounded-md text-[11px] font-medium text-slate-800 dark:text-slate-200 shadow-sm">
                                                    <span>📄 {att.filename}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGeneratedPdfAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-slate-400 hover:text-rose-600 transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-amber-700 dark:text-amber-400">
                                            {t("No PDF files generated yet.")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleGeneratePdfAttachments()}
                                            className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                                        >
                                            <span>⚡ {t("Generate PDFs Now")}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSending || isGeneratingPdfs}
                        className="text-xs"
                    >
                        {t("Cancel")}
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={isSending || isGeneratingPdfs}
                        className={`font-bold text-xs px-5 flex items-center gap-2 shadow-md transition-all ${
                            isSending || isGeneratingPdfs
                                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-300 dark:border-slate-700 opacity-80'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                    >
                        {isSending || isGeneratingPdfs ? (
                            <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                        ) : (
                            <Send size={14} />
                        )}
                        {isSending
                            ? t("Sending...")
                            : isGeneratingPdfs
                            ? t("Generating PDFs...")
                            : sendButtonLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SendEmailModal;
