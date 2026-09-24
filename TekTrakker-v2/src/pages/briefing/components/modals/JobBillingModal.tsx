import React, { useState, useRef } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { db } from '../../../../lib/firebase';
import { cleanUndefinedFields } from '../../../../lib/utils';
import { getNextInvoiceNumber, resolveJobInvoiceNumber } from '../../../../lib/numbering';
import type { StoredFile } from '../../../../types';
import { uploadFileToStorage } from '../../../../lib/storageService';
import InvoiceEditorModal from '../../../../components/modals/InvoiceEditorModal';
import JobAppointmentModal from '../../../../components/modals/JobAppointmentModal';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  PenTool, 
  DollarSign, 
  Trash2, 
  Lock, 
  ShieldAlert,
  Send,
  FileCheck,
  Eye,
  UserCheck,
  Building,
  Info,
  User,
  Clock,
  ArrowRight,
  FileText,
  Plus,
  Upload,
  ImageIcon,
  X,
  Download
} from 'lucide-react';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;
import showToast from '../../../../lib/toast';
import DocumentPreview from '../../../../components/ui/DocumentPreview';
import { downloadStandaloneSignOffPdf } from '../../../../lib/pdfHelper';

interface JobBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  workflowState: any;
  unitStates: any[];
  onUpdateWorkflowState: (field: string, value: any) => void;
  onCompleteJob: () => void;
  onOpenJobRecordReview?: () => void;
  onOpenInvoiceEditor?: (forceNew?: boolean) => void;
}

export const JobBillingModal: React.FC<JobBillingModalProps> = ({
  isOpen,
  onClose,
  job,
  workflowState,
  unitStates,
  onUpdateWorkflowState,
  onCompleteJob,
  onOpenJobRecordReview,
  onOpenInvoiceEditor,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'outcome' | 'invoice' | 'signature'>('outcome');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceEditorOpen, setIsInvoiceEditorOpen] = useState(false);
  const [techSigRef, setTechSigRef] = useState<any>(null);
  const [siteManagerSigRef, setSiteManagerSigRef] = useState<any>(null);
  const [customerSigRef, setCustomerSigRef] = useState<any>(null);

  // Upload-based signature state for each card
  const [techSigMode, setTechSigMode] = useState<'draw' | 'upload'>('draw');
  const [siteManagerSigMode, setSiteManagerSigMode] = useState<'draw' | 'upload'>('draw');
  const [customerSigMode, setCustomerSigMode] = useState<'draw' | 'upload'>('draw');
  const [techUploadedSig, setTechUploadedSig] = useState<string | null>(null);
  const [siteManagerUploadedSig, setSiteManagerUploadedSig] = useState<string | null>(null);
  const [customerUploadedSig, setCustomerUploadedSig] = useState<string | null>(null);
  const techUploadRef = useRef<HTMLInputElement>(null);
  const siteManagerUploadRef = useRef<HTMLInputElement>(null);
  const customerUploadRef = useRef<HTMLInputElement>(null);

  const handleSignatureFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast.warn(t("Please upload an image file (JPG, PNG, etc.)."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast.warn(t("Image too large. Please upload under 10 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.onerror = () => showToast.warn(t("Failed to read image file."));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Deferred Billing / Roll Forward State
  const [rollTargetJobId, setRollTargetJobId] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

  const handleEditExistingInvoice = () => {
    if (onOpenInvoiceEditor) {
      onOpenInvoiceEditor(false);
    } else {
      setIsInvoiceEditorOpen(true);
    }
  };

  const handleCreateSecondaryInvoice = async () => {
    if (onOpenInvoiceEditor) {
      onOpenInvoiceEditor(true);
      return;
    }
    const orgId = job.organizationId || state.currentOrganization?.id;
    if (orgId) {
      try {
        const nextInvId = resolveJobInvoiceNumber(job, 1);
        const newInvoice = {
          id: nextInvId,
          status: 'Unpaid',
          items: [],
          subtotal: 0,
          taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
          taxAmount: 0,
          totalAmount: 0,
          amount: 0,
          createdAt: new Date().toISOString(),
          jobId: job.id
        };
        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ invoice: newInvoice }));
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, invoice: newInvoice } });
        showToast.success(t(`New secondary invoice ${nextInvId} created!`));
      } catch (err: any) {
        showToast.error("Failed to create secondary invoice: " + err.message);
      }
    }
    setIsInvoiceEditorOpen(true);
  };

  const customerOtherJobs = (state.jobs || []).filter(
    (j: any) => j.customerId === job?.customerId && j.id !== job?.id && j.jobStatus !== 'Completed'
  );

  const handleRollPaymentToJob = async (targetJobId: string) => {
    if (!targetJobId) return;
    setIsRolling(true);
    try {
      const targetJob = state.jobs.find((j: any) => j.id === targetJobId);
      if (targetJob) {
        const itemsToCopy = (job?.invoice?.items || []).map((item: any) => ({
          ...item,
          id: `roll-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          description: `${item.description || item.name} (Rolled from Job #${job?.id?.slice(-6).toUpperCase()})`
        }));

        const targetInvoice = targetJob.invoice || {
          id: `INV-${Date.now()}`,
          items: [],
          subtotal: 0,
          taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
          taxAmount: 0,
          totalAmount: 0,
          amount: 0,
          status: 'Unpaid'
        };

        const targetLines = [...(targetInvoice.items || []), ...itemsToCopy];
        const subtotalVal = targetLines.reduce((acc: number, l: any) => acc + (l.total || (l.quantity * l.unitPrice) || l.amount || 0), 0);
        const effectiveTaxRate = typeof targetInvoice.taxRate === 'number' ? targetInvoice.taxRate : 0.0825;
        const taxVal = typeof targetInvoice.taxAmount === 'number' ? targetInvoice.taxAmount : subtotalVal * effectiveTaxRate;
        const totalVal = subtotalVal + taxVal;

        const updatedTargetInvoice = {
          ...targetInvoice,
          items: targetLines,
          subtotal: subtotalVal,
          taxAmount: taxVal,
          totalAmount: totalVal,
          amount: totalVal,
          status: 'Unpaid' as const
        };

        if (!state.isDemoMode) {
          await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
            invoice: updatedTargetInvoice,
            parentJobId: job.id
          }));
        }
        dispatch({
          type: 'UPDATE_JOB',
          payload: {
            ...targetJob,
            invoice: updatedTargetInvoice,
            parentJobId: job.id
          }
        });

        showToast.success(t(`Charges rolled forward to Job #${targetJob.id.slice(-6).toUpperCase()}`));
        setRollTargetJobId('');
      }
    } catch (e: any) {
      showToast.warn(t("Failed to roll payment forward."));
    } finally {
      setIsRolling(false);
    }
  };

  const handleRollForwardClick = () => {
    if (!rollTargetJobId) return;
    if (rollTargetJobId === 'new') {
      setIsAppointmentModalOpen(true);
    } else {
      handleRollPaymentToJob(rollTargetJobId);
    }
  };

  const [techNameInput, setTechNameInput] = useState(
    workflowState?.techSignatureName || job?.assignedTechnicianName || ''
  );
  const [siteManagerNameInput, setSiteManagerNameInput] = useState(
    workflowState?.siteManagerName || ''
  );
  const [customerNameInput, setCustomerNameInput] = useState(
    workflowState?.customerSignatureName || job?.customerName || ''
  );

  // 5-choice Repair Verification Outcome
  const outcomeOptions = [
    { id: 'fixed', label: t("Fully Fixed & Operational"), desc: t("All issues resolved, operating within normal specs.") },
    { id: 'monitored', label: t("Repaired with Monitoring Needed"), desc: t("Repairs completed; advise customer to monitor performance.") },
    { id: 'patch', label: t("Temporary Patch / Follow-up Required"), desc: t("Temporary fix applied; requires formal follow-up visit.") },
    { id: 'parts_needed', label: t("Unresolved - Parts Required"), desc: t("Awaiting specialized OEM replacement parts.") },
    { id: 'replacement', label: t("System Replacement Recommended"), desc: t("Unit beyond economical repair; sales estimate requested.") },
  ];

  const selectedOutcome = workflowState?.repairOutcome || 'fixed';
  const isCompleted = job?.jobStatus === 'Completed';

  // Invoice calculations
  const invoiceItems = job?.invoice?.items || [];
  const subtotal = invoiceItems.reduce((sum: number, item: any) => sum + (item.total || item.amount || 0), 0);
  const taxAmount = typeof job?.invoice?.taxAmount === 'number'
    ? job.invoice.taxAmount
    : (typeof job?.invoice?.taxRate === 'number' ? subtotal * job.invoice.taxRate : 0);
  const totalAmount = typeof job?.invoice?.totalAmount === 'number' && job.invoice.totalAmount > 0
    ? job.invoice.totalAmount
    : subtotal + taxAmount;
  const amountPaid = Number(job?.invoice?.amountPaid || 0);
  const balanceRemainingDue = Math.max(0, totalAmount - amountPaid);

  const handleSaveTechSignature = async () => {
    let sigData = '';
    if (techSigMode === 'upload' && techUploadedSig) {
      sigData = techUploadedSig;
    } else if (techSigRef && !techSigRef.isEmpty()) {
      sigData = techSigRef.getTrimmedCanvas().toDataURL('image/png');
    }
    if (sigData) {
      const trimmedName = techNameInput.trim();
      const nowIso = new Date().toISOString();

      let finalSigUrl = sigData;
      if (sigData.startsWith('data:image')) {
        try {
          const orgId = job.organizationId || state.currentOrganization?.id || 'default';
          const path = `organizations/${orgId}/jobs/${job.id}/signatures/tech_${Date.now()}.png`;
          const storageUrl = await uploadFileToStorage(path, sigData);
          if (storageUrl) {
            finalSigUrl = storageUrl;
          }
        } catch (stErr) {
          console.warn("Storage upload for tech signature fallback:", stErr);
        }
      }

      onUpdateWorkflowState('techSignature', finalSigUrl);
      onUpdateWorkflowState('techSignatureName', trimmedName);
      onUpdateWorkflowState('techSignatureTimestamp', nowIso);
      onUpdateWorkflowState('jobRecordSignedOff', true);
      onUpdateWorkflowState('jobRecordSignedOffAt', nowIso);
      onUpdateWorkflowState('jobRecordSignedOffBy', trimmedName);

      const jobUpdates = {
        techSignature: finalSigUrl,
        techSignatureName: trimmedName,
        techSignatureTimestamp: nowIso,
        jobRecordSignedOff: true,
        jobRecordSignedOffAt: nowIso,
        jobRecordSignedOffBy: trimmedName,
        updatedAt: nowIso
      };

      try {
        if (!state.isDemoMode && job?.id) {
          await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
        }
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        showToast.success(t("Technician signature saved!"));
      } catch (err) {
        console.error("Failed to persist tech signature to job:", err);
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        showToast.warn(t("Technician signature saved locally."));
      }
    }
  };

  const handleClearTechSignature = async () => {
    if (techSigRef) techSigRef.clear();
    onUpdateWorkflowState('techSignature', null);
    onUpdateWorkflowState('techSignatureName', null);
    onUpdateWorkflowState('techSignatureTimestamp', null);
    const nowIso = new Date().toISOString();
    const jobUpdates = {
      techSignature: null,
      techSignatureName: null,
      techSignatureTimestamp: null,
      updatedAt: nowIso
    };
    try {
      if (!state.isDemoMode && job?.id) {
        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
      }
      dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
    } catch (err) {
      console.error("Failed to clear tech signature in job:", err);
      dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
    }
  };

  const handleSaveSiteManagerSignature = async () => {
    let sigData = '';
    if (siteManagerSigMode === 'upload' && siteManagerUploadedSig) {
      sigData = siteManagerUploadedSig;
    } else if (siteManagerSigRef && !siteManagerSigRef.isEmpty()) {
      sigData = siteManagerSigRef.getTrimmedCanvas().toDataURL('image/png');
    }
    if (sigData) {
      const trimmedName = siteManagerNameInput.trim();
      const nowIso = new Date().toISOString();

      let finalSigUrl = sigData;
      if (sigData.startsWith('data:image')) {
        try {
          const orgId = job.organizationId || state.currentOrganization?.id || 'default';
          const path = `organizations/${orgId}/jobs/${job.id}/signatures/sitemanager_${Date.now()}.png`;
          const storageUrl = await uploadFileToStorage(path, sigData);
          if (storageUrl) {
            finalSigUrl = storageUrl;
          }
        } catch (stErr) {
          console.warn("Storage upload for manager signature fallback:", stErr);
        }
      }

      onUpdateWorkflowState('siteManagerSignature', finalSigUrl);
      onUpdateWorkflowState('siteManagerName', trimmedName);
      onUpdateWorkflowState('siteManagerSignatureTimestamp', nowIso);
      onUpdateWorkflowState('jobRecordSignedOff', true);
      onUpdateWorkflowState('jobRecordSignedOffAt', nowIso);
      onUpdateWorkflowState('jobRecordSignedOffBy', trimmedName);

      const sigFile: StoredFile = {
        id: `sig-mgr-${Date.now()}`,
        organizationId: job.organizationId || state.currentOrganization?.id || 'unaffiliated',
        parentId: job.id,
        parentType: 'job',
        fileName: 'Site_Manager_Signature.png',
        fileType: 'image/png',
        dataUrl: finalSigUrl,
        url: finalSigUrl,
        createdAt: nowIso,
        uploadedBy: state.currentUser?.id || 'manager',
        label: 'Site Manager Sign-Off Signature',
        metadata: {
          category: 'signature',
          phase: 'signoff',
          signerName: trimmedName,
          timestamp: nowIso
        }
      };

      const existingFiles = (job.files || []).filter((f: any) => f.id !== sigFile.id);
      const updatedFiles = [...existingFiles, sigFile];

      const jobUpdates = {
        siteManagerSignature: finalSigUrl,
        siteManagerName: trimmedName,
        signature: finalSigUrl,
        signerName: trimmedName,
        signatureTimestamp: nowIso,
        jobRecordSignedOff: true,
        jobRecordSignedOffAt: nowIso,
        jobRecordSignedOffBy: trimmedName,
        files: updatedFiles,
        updatedAt: nowIso
      };

      try {
        if (!state.isDemoMode && job?.id) {
          await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
        }
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        showToast.success(t("Site Manager signature saved!"));
      } catch (err) {
        console.error("Failed to persist manager signature to job:", err);
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        showToast.warn(t("Site Manager signature saved locally."));
      }
    }
  };

  const handleClearSiteManagerSignature = async () => {
    if (siteManagerSigRef) siteManagerSigRef.clear();
    onUpdateWorkflowState('siteManagerSignature', null);
    onUpdateWorkflowState('siteManagerName', null);
    onUpdateWorkflowState('siteManagerSignatureTimestamp', null);
    const nowIso = new Date().toISOString();
    const jobUpdates = {
      siteManagerSignature: null,
      siteManagerName: null,
      siteManagerSignatureTimestamp: null,
      updatedAt: nowIso
    };
    try {
      if (!state.isDemoMode && job?.id) {
        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
      }
      dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
    } catch (err) {
      console.error("Failed to clear manager signature in job:", err);
    }
  };

  const handleSaveCustomerSignature = async () => {
    let sigData = '';
    if (customerSigMode === 'upload' && customerUploadedSig) {
      sigData = customerUploadedSig;
    } else if (customerSigRef && !customerSigRef.isEmpty()) {
      sigData = customerSigRef.getTrimmedCanvas().toDataURL('image/png');
    }
    if (sigData) {
      const trimmedName = customerNameInput.trim();
      const nowIso = new Date().toISOString();

      let finalSigUrl = sigData;
      if (sigData.startsWith('data:image') || sigData.startsWith('data:application/pdf')) {
        try {
          const orgId = job.organizationId || state.currentOrganization?.id || 'default';
          const path = `organizations/${orgId}/jobs/${job.id}/signatures/customer_${Date.now()}.png`;
          const storageUrl = await uploadFileToStorage(path, sigData);
          if (storageUrl) {
            finalSigUrl = storageUrl;
          }
        } catch (stErr) {
          console.warn("Storage upload for customer signature in billing modal fallback:", stErr);
        }
      }

      onUpdateWorkflowState('customerSignature', finalSigUrl);
      onUpdateWorkflowState('customerSignatureName', trimmedName);
      onUpdateWorkflowState('signatureTimestamp', nowIso);
      onUpdateWorkflowState('jobRecordSignedOff', true);
      onUpdateWorkflowState('jobRecordSignedOffAt', nowIso);
      onUpdateWorkflowState('jobRecordSignedOffBy', trimmedName);

      const sigFile: StoredFile = {
        id: `sig-cust-${Date.now()}`,
        organizationId: job.organizationId || state.currentOrganization?.id || 'unaffiliated',
        parentId: job.id,
        parentType: 'job',
        fileName: 'Customer_Signature.png',
        fileType: 'image/png',
        dataUrl: finalSigUrl,
        url: finalSigUrl,
        createdAt: nowIso,
        uploadedBy: state.currentUser?.id || 'customer',
        label: 'Customer Sign-Off Signature',
        metadata: {
          category: 'signature',
          phase: 'signoff',
          signerName: trimmedName,
          timestamp: nowIso
        }
      };

      const existingFiles = (job.files || []).filter((f: any) => f.id !== sigFile.id);
      const updatedFiles = [...existingFiles, sigFile];

      const jobUpdates = {
        customerSignature: finalSigUrl,
        customerSignatureName: trimmedName,
        signature: finalSigUrl,
        signerName: trimmedName,
        signatureTimestamp: nowIso,
        signedAt: nowIso,
        jobRecordSignedOff: true,
        jobRecordSignedOffAt: nowIso,
        jobRecordSignedOffBy: trimmedName,
        files: updatedFiles,
        updatedAt: nowIso
      };

      try {
        if (!state.isDemoMode && job?.id) {
          await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
        }
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        showToast.success(t("Customer signature saved!"));
      } catch (err) {
        console.error("Failed to persist customer signature to job:", err);
        showToast.warn(t("Customer signature saved locally."));
      }
    }
  };

  const handleClearCustomerSignature = async () => {
    if (customerSigRef) customerSigRef.clear();
    onUpdateWorkflowState('customerSignature', null);
    onUpdateWorkflowState('customerSignatureName', null);
    onUpdateWorkflowState('signatureTimestamp', null);
    const nowIso = new Date().toISOString();
    const jobUpdates = {
      customerSignature: null,
      customerSignatureName: null,
      signatureTimestamp: null,
      updatedAt: nowIso
    };
    try {
      if (!state.isDemoMode && job?.id) {
        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
      }
      dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
    } catch (err) {
      console.error("Failed to clear customer signature in job:", err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <CreditCard className="text-emerald-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("Billing, Verification & Sign-Off")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Repair verification outcomes, invoice review, customer sign-off signature, & job completion.")}
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pb-4">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('outcome')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'outcome'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{t("Verification Outcome")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('signature')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'signature'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <PenTool size={16} />
            <span>{t("Sign-Off")}</span>
            {(workflowState?.techSignature || workflowState?.siteManagerSignature || workflowState?.customerSignature) && (
              <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'invoice'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign size={16} />
            <span>{t("Invoice Summary")}</span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full font-mono">
              ${totalAmount.toFixed(2)}
            </span>
          </button>
        </div>

        {/* Tab 1: 5-Choice Repair Verification Outcome */}
        {activeTab === 'outcome' && (
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              {t("Select Service Visit Repair Outcome")}
            </h3>

            <div className="space-y-2.5">
              {outcomeOptions.map((opt) => {
                const isSelected = selectedOutcome === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => onUpdateWorkflowState('repairOutcome', opt.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{opt.label}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}>
                      {isSelected && <CheckCircle2 size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Invoice Summary & Invoice Editor Controls */}
        {activeTab === 'invoice' && (
          <div className="space-y-4">
            {/* Invoice Editor Controls Card */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-3 shadow-sm text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                    {t("Invoice Editor")}
                    {job?.invoice?.id && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono font-bold">
                        {job.invoice.id.startsWith('INV-') ? job.invoice.id : `INV-${job.invoice.id}`}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300/80">
                    {job?.invoice?.id 
                      ? t("Edit existing invoice line items, labor, parts, tax rates, and warranties linked to this job.")
                      : t("Create and link an itemized invoice for this job.")}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                  <Button
                    type="button"
                    onClick={handleEditExistingInvoice}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>{job?.invoice?.id ? `${t("Edit Invoice")} (${job.invoice.id.startsWith('INV-') ? job.invoice.id : `INV-${job.invoice.id}`})` : t("Open Invoice Editor")}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleCreateSecondaryInvoice}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{t("+ Create Secondary Invoice")}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  {t("Invoice Line Items")} ({invoiceItems.length})
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {t("WO #")} {job.poNumber || job.id.slice(-6).toUpperCase()}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-3">
                {invoiceItems.length > 0 ? (
                  invoiceItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs pt-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{item.name || item.description}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">${(item.total || item.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">{t("No invoice line items billed yet.")}</p>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>{t("Subtotal")}</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{t("Tax")}</span>
                    <span className="font-mono">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span>{t("Total (Grand Total)")}</span>
                    <span className="font-mono text-emerald-600">${totalAmount.toFixed(2)}</span>
                  </div>
                  {amountPaid > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{t("Previously Paid (Deposit or Partial Payments)")}</span>
                      <span className="font-mono">-${amountPaid.toFixed(2)}</span>
                    </div>
                  )}
                  {amountPaid > 0 && (
                    <div className="flex justify-between text-base font-black text-blue-900 dark:text-blue-200 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>{t("Balance Remaining Due")}</span>
                      <span className="font-mono text-blue-600">${balanceRemainingDue.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Accept Payment Button */}
                  <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      <CreditCard size={16} />
                      <span>{t("Accept Payment")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Membership Reminder */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 rounded-2xl space-y-2 text-left shadow-sm">
              <h4 className="font-extrabold text-xs text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>✨</span> {t("Membership Reminder")}
              </h4>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {t("Did you offer the customer a membership plan to save money on today's visit?")}
              </p>
              <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  checked={workflowState?.membershipOffered || false} 
                  onChange={(e) => onUpdateWorkflowState('membershipOffered', e.target.checked)}
                  className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-xs font-extrabold text-purple-900 dark:text-purple-200">
                  {t("Yes, I discussed a membership plan with the customer")}
                </span>
              </label>
            </div>

            {/* Deferred Billing / Roll to Next Visit Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={16} className="text-amber-600" />
                  {t("Deferred Billing / Roll to Next Visit")}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t("If parts need to be ordered or a follow-up visit is required, you can defer this payment to a future scheduled job.")}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <select 
                  value={rollTargetJobId}
                  onChange={(e) => setRollTargetJobId(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="">{t("Select Job or Create New...")}</option>
                  <option value="new">{t("+ Create New Follow-up Job")}</option>
                  {customerOtherJobs.map((j: any) => (
                    <option key={j.id} value={j.id}>
                      {t("Job")} #{j.id.slice(-6).toUpperCase()} - {j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : t("Unscheduled")}
                    </option>
                  ))}
                </select>

                <Button 
                  type="button"
                  onClick={handleRollForwardClick}
                  disabled={!rollTargetJobId || isRolling}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl whitespace-nowrap shadow-sm"
                >
                  {isRolling ? t("Rolling...") : t("Roll Forward")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 3-Role Sign-Off */}
        {activeTab === 'signature' && (
          <div className="space-y-5">
            {/* View Full Job History Record Button */}
            {onOpenJobRecordReview && (
              <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                <div>
                  <h4 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <FileCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                    {t("Complete Job History Record")}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t("Review complete service history, diagnostic readings, photos, unit states, & formal sign-off record.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenJobRecordReview}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0"
                >
                  <Eye size={15} />
                  <span>{t("View Job Record")}</span>
                </button>
              </div>
            )}

            {/* Informational Callout Notice */}
            <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-3">
              <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-extrabold text-blue-900 dark:text-blue-200 block mb-0.5">
                  {t("Recommended Job Sign-Offs")}
                </span>
                <p>
                  {t("Capturing sign-offs verifies work for commercial sites and records. Signatures are recommended, but optional if site contacts or customers are unavailable.")}
                </p>
              </div>
            </div>

            {/* 1. Technician Signature Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={16} className="text-emerald-600" />
                    {t("1. Technician Sign-Off")}
                    <span className="text-[10px] text-slate-400 font-normal lowercase">({t("recommended")})</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("Signing that everything was completed and accurate prior to departure.")}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t("Technician Name")}</label>
                <input
                  type="text"
                  value={techNameInput}
                  onChange={(e) => setTechNameInput(e.target.value)}
                  placeholder={t("Enter technician name")}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              {workflowState?.techSignature ? (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      {t("Technician Signature Captured")}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearTechSignature}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={13} />
                      {t("Clear")}
                    </button>
                  </div>
                  <img
                    src={workflowState.techSignature}
                    alt="Technician Signature"
                    className="max-h-24 mx-auto border border-emerald-300 rounded bg-white p-1"
                  />
                  {workflowState.techSignatureTimestamp && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">
                      {t("Signed at:")} {new Date(workflowState.techSignatureTimestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-1">
                    <button type="button" onClick={() => setTechSigMode('draw')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${techSigMode === 'draw' ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <PenTool size={12} /> {t("Draw")}
                    </button>
                    <button type="button" onClick={() => setTechSigMode('upload')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${techSigMode === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <Upload size={12} /> {t("Upload Photo")}
                    </button>
                  </div>
                  {techSigMode === 'draw' ? (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden touch-none">
                      <SignatureCanvas
                        ref={(ref: any) => setTechSigRef(ref)}
                        canvasProps={{ className: 'w-full h-28 cursor-crosshair touch-none' }}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
                      {techUploadedSig ? (
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><ImageIcon size={12} /> {t("Uploaded")}</span>
                            <button type="button" onClick={() => { setTechUploadedSig(null); if (techUploadRef.current) techUploadRef.current.value = ''; }} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5 font-bold cursor-pointer bg-transparent border-none"><X size={12} /> {t("Remove")}</button>
                          </div>
                          <img src={techUploadedSig} alt={t("Uploaded signature")} className="max-h-24 mx-auto object-contain rounded" />
                        </div>
                      ) : (
                        <label htmlFor="tech-sig-upload" className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <Upload size={20} className="text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500">{t("Tap to upload photo of signature")}</span>
                        </label>
                      )}
                      <input ref={techUploadRef} id="tech-sig-upload" type="file" accept="image/*" onChange={(e) => handleSignatureFileUpload(e, setTechUploadedSig)} className="hidden" />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {techSigMode === 'draw' && (
                      <Button type="button" variant="secondary" onClick={() => techSigRef?.clear()} className="text-[11px] py-1 px-3">
                        {t("Clear")}
                      </Button>
                    )}
                    <Button type="button" onClick={handleSaveTechSignature} className="bg-emerald-600 text-white font-bold text-[11px] py-1 px-3.5 rounded-xl">
                      {t("Save Technician Signature")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Site Manager Signature Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Building size={16} className="text-blue-600" />
                    {t("2. Site Manager Sign-Off")}
                    <span className="text-[10px] text-slate-400 font-normal lowercase">({t("recommended")})</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("Signing that the technician did what they said they did on site.")}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t("Site Manager / Facility Contact Name")}</label>
                <input
                  type="text"
                  value={siteManagerNameInput}
                  onChange={(e) => setSiteManagerNameInput(e.target.value)}
                  placeholder={t("Enter site manager name")}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              {workflowState?.siteManagerSignature ? (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      {t("Site Manager Signature Captured")}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSiteManagerSignature}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={13} />
                      {t("Clear")}
                    </button>
                  </div>
                  <img
                    src={workflowState.siteManagerSignature}
                    alt="Site Manager Signature"
                    className="max-h-24 mx-auto border border-emerald-300 rounded bg-white p-1"
                  />
                  {workflowState.siteManagerSignatureTimestamp && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">
                      {t("Signed at:")} {new Date(workflowState.siteManagerSignatureTimestamp).toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => downloadStandaloneSignOffPdf(job, state.currentOrganization)}
                      className="text-[11px] py-1 px-3 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 hover:bg-emerald-50"
                    >
                      <Download size={13} />
                      {t("Download Sign-Off PDF")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-1">
                    <button type="button" onClick={() => setSiteManagerSigMode('draw')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${siteManagerSigMode === 'draw' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <PenTool size={12} /> {t("Draw")}
                    </button>
                    <button type="button" onClick={() => setSiteManagerSigMode('upload')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${siteManagerSigMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <Upload size={12} /> {t("Upload Photo")}
                    </button>
                  </div>
                  {siteManagerSigMode === 'draw' ? (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden touch-none">
                      <SignatureCanvas
                        ref={(ref: any) => setSiteManagerSigRef(ref)}
                        canvasProps={{ className: 'w-full h-28 cursor-crosshair touch-none' }}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
                      {siteManagerUploadedSig ? (
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1"><ImageIcon size={12} /> {t("Uploaded")}</span>
                            <button type="button" onClick={() => { setSiteManagerUploadedSig(null); if (siteManagerUploadRef.current) siteManagerUploadRef.current.value = ''; }} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5 font-bold cursor-pointer bg-transparent border-none"><X size={12} /> {t("Remove")}</button>
                          </div>
                          <img src={siteManagerUploadedSig} alt={t("Uploaded signature")} className="max-h-24 mx-auto object-contain rounded" />
                        </div>
                      ) : (
                        <label htmlFor="site-manager-sig-upload" className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <Upload size={20} className="text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500">{t("Tap to upload photo of signature")}</span>
                        </label>
                      )}
                      <input ref={siteManagerUploadRef} id="site-manager-sig-upload" type="file" accept="image/*" onChange={(e) => handleSignatureFileUpload(e, setSiteManagerUploadedSig)} className="hidden" />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {siteManagerSigMode === 'draw' && (
                      <Button type="button" variant="secondary" onClick={() => siteManagerSigRef?.clear()} className="text-[11px] py-1 px-3">
                        {t("Clear")}
                      </Button>
                    )}
                    <Button type="button" onClick={handleSaveSiteManagerSignature} className="bg-blue-600 text-white font-bold text-[11px] py-1 px-3.5 rounded-xl">
                      {t("Save Site Manager Signature")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Customer Sign-Off Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <User size={16} className="text-purple-600" />
                    {t("3. Customer Sign-Off")}
                    <span className="text-[10px] text-slate-400 font-normal lowercase">({t("recommended")})</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("Accepting that they received confirmation of the job completion.")}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t("Customer / Property Manager Name")}</label>
                <input
                  type="text"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  placeholder={t("Enter customer name")}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              {workflowState?.customerSignature ? (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      {t("Customer Sign-Off Captured")}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearCustomerSignature}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={13} />
                      {t("Clear")}
                    </button>
                  </div>
                  <img
                    src={workflowState.customerSignature}
                    alt="Customer Signature"
                    className="max-h-24 mx-auto border border-emerald-300 rounded bg-white p-1"
                  />
                  {workflowState.signatureTimestamp && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">
                      {t("Signed at:")} {new Date(workflowState.signatureTimestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-1">
                    <button type="button" onClick={() => setCustomerSigMode('draw')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${customerSigMode === 'draw' ? 'bg-purple-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <PenTool size={12} /> {t("Draw")}
                    </button>
                    <button type="button" onClick={() => setCustomerSigMode('upload')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${customerSigMode === 'upload' ? 'bg-purple-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <Upload size={12} /> {t("Upload Photo")}
                    </button>
                  </div>
                  {customerSigMode === 'draw' ? (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden touch-none">
                      <SignatureCanvas
                        ref={(ref: any) => setCustomerSigRef(ref)}
                        canvasProps={{ className: 'w-full h-28 cursor-crosshair touch-none' }}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
                      {customerUploadedSig ? (
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-600 flex items-center gap-1"><ImageIcon size={12} /> {t("Uploaded")}</span>
                            <button type="button" onClick={() => { setCustomerUploadedSig(null); if (customerUploadRef.current) customerUploadRef.current.value = ''; }} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5 font-bold cursor-pointer bg-transparent border-none"><X size={12} /> {t("Remove")}</button>
                          </div>
                          <img src={customerUploadedSig} alt={t("Uploaded signature")} className="max-h-24 mx-auto object-contain rounded" />
                        </div>
                      ) : (
                        <label htmlFor="customer-sig-upload" className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <Upload size={20} className="text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500">{t("Tap to upload photo of signature")}</span>
                        </label>
                      )}
                      <input ref={customerUploadRef} id="customer-sig-upload" type="file" accept="image/*" onChange={(e) => handleSignatureFileUpload(e, setCustomerUploadedSig)} className="hidden" />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {customerSigMode === 'draw' && (
                      <Button type="button" variant="secondary" onClick={() => customerSigRef?.clear()} className="text-[11px] py-1 px-3">
                        {t("Clear")}
                      </Button>
                    )}
                    <Button type="button" onClick={handleSaveCustomerSignature} className="bg-purple-600 text-white font-bold text-[11px] py-1 px-3.5 rounded-xl">
                      {t("Save Customer Signature")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions: Complete Job */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs font-bold px-4 py-2">
            {t("Cancel")}
          </Button>

          <Button
            type="button"
            onClick={() => {
              onClose();
              onCompleteJob();
            }}
            disabled={isCompleted}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md"
          >
            <FileCheck size={16} />
            {isCompleted ? t("Job Already Completed") : t("Complete Service Visit")}
          </Button>
        </div>
      </div>

      {isPaymentModalOpen && (
        <DocumentPreview
          type="Invoice"
          data={job}
          isInternal={false}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {isAppointmentModalOpen && (
        <JobAppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          customerId={job?.customerId}
          parentJobToLink={job}
        />
      )}

      {isInvoiceEditorOpen && job?.id && (
        <InvoiceEditorModal
          isOpen={true}
          onClose={() => setIsInvoiceEditorOpen(false)}
          jobId={job.id}
        />
      )}
    </Modal>
  );
};

export default JobBillingModal;
