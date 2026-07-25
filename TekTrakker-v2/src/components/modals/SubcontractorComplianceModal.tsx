import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import showToast from '../../lib/toast';
import { db } from '../../lib/firebase';
import { sendNotification, sendEmail } from '../../lib/notificationService';
import { useAppContext } from '../../context/AppContext';
import { 
    ShieldCheck, FileText, Upload, CheckCircle2, AlertTriangle, Clock, 
    XCircle, Plus, Send, BadgeCheck, FileCheck, ExternalLink, Calendar 
} from 'lucide-react';
import { ALL_COMPLIANCE_DOCUMENTS, checkSubcontractorCompliance } from '../../lib/subcontractorCompliance';
import SubcontractorContractModal from './SubcontractorContractModal';
import type { Subcontractor, SubcontractorComplianceDoc, SubcontractorContract } from '../../types';

interface SubcontractorComplianceModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: Subcontractor;
    onUpdateSubcontractor: (updated: Subcontractor) => void;
}

export const SubcontractorComplianceModal: React.FC<SubcontractorComplianceModalProps> = ({
    isOpen,
    onClose,
    subcontractor,
    onUpdateSubcontractor
}) => {
    const { state } = useAppContext();
    const [selectedDocKey, setSelectedDocKey] = useState<string>('');
    const [fileUrl, setFileUrl] = useState('');
    const [fileName, setFileName] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [isContractModalOpen, setContractModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<SubcontractorContract | null>(null);
    const [isSendingReminder, setIsSendingReminder] = useState(false);

    const complianceResult = checkSubcontractorCompliance(
        subcontractor, 
        state.currentOrganization?.subcontractorComplianceSettings
    );

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const uploadedUrl = reader.result as string;
            const newDoc: SubcontractorComplianceDoc = {
                id: `doc-${docKey}-${Date.now()}`,
                docKey,
                name: file.name,
                fileUrl: uploadedUrl,
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
                expiresAt: expiresAt || undefined,
                status: 'pending'
            };

            const existingDocs = subcontractor.complianceDocs || [];
            const filteredDocs = existingDocs.filter(d => d.docKey !== docKey);
            const updatedDocs = [...filteredDocs, newDoc];

            const updatedSub: Subcontractor = {
                ...subcontractor,
                complianceDocs: updatedDocs
            };

            try {
                await db.collection('subcontractors').doc(subcontractor.id).update({
                    complianceDocs: updatedDocs
                });
                onUpdateSubcontractor(updatedSub);
                showToast.success(`Uploaded ${file.name} for review.`);
                setExpiresAt('');
            } catch (err: any) {
                console.error("Failed to upload compliance doc:", err);
                showToast.error("Failed to save upload: " + err.message);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateDocStatus = async (docKey: string, status: SubcontractorComplianceDoc['status']) => {
        const existingDocs = subcontractor.complianceDocs || [];
        const targetDoc = existingDocs.find(d => d.docKey === docKey);

        let updatedDocs: SubcontractorComplianceDoc[];
        if (targetDoc) {
            updatedDocs = existingDocs.map(d => d.docKey === docKey ? { ...d, status, verifiedAt: new Date().toISOString(), verifiedBy: state.currentUser?.email } : d);
        } else {
            const def = ALL_COMPLIANCE_DOCUMENTS.find(d => d.key === docKey);
            updatedDocs = [...existingDocs, {
                id: `doc-${docKey}-${Date.now()}`,
                docKey,
                name: def?.label || docKey,
                status,
                uploadedAt: new Date().toISOString(),
                verifiedAt: new Date().toISOString(),
                verifiedBy: state.currentUser?.email
            }];
        }

        const updatedSub: Subcontractor = {
            ...subcontractor,
            complianceDocs: updatedDocs
        };

        try {
            await db.collection('subcontractors').doc(subcontractor.id).update({
                complianceDocs: updatedDocs
            });
            onUpdateSubcontractor(updatedSub);
            showToast.success(`Updated document status to ${status.toUpperCase()}`);
        } catch (err: any) {
            console.error(err);
            showToast.error("Failed to update status: " + err.message);
        }
    };

    const handleSaveContract = async (contract: SubcontractorContract) => {
        const existingContracts = subcontractor.contracts || [];
        const filtered = existingContracts.filter(c => c.id !== contract.id);
        const updatedContracts = [...filtered, contract];

        const updatedSub: Subcontractor = {
            ...subcontractor,
            contracts: updatedContracts
        };

        try {
            await db.collection('subcontractors').doc(subcontractor.id).update({
                contracts: updatedContracts
            });
            onUpdateSubcontractor(updatedSub);
            showToast.success("Contract record updated.");
        } catch (err: any) {
            console.error(err);
            showToast.error("Failed to save contract: " + err.message);
        }
    };

    const handleSendComplianceReminder = async () => {
        if (!subcontractor.email) {
            showToast.error("No email on file for this subcontractor.");
            return;
        }

        setIsSendingReminder(true);
        try {
            const missingList = complianceResult.missingDocLabels.join(', ') || 'Form W-9, Business Insurance, Trade License';
            const orgName = state.currentOrganization?.name || 'Contractor';

            const payload = {
                title: `Action Required: Subcontractor Compliance Documents`,
                body: `${orgName} requires compliance documents (${missingList}) to be uploaded before work orders can be dispatched.`
            };

            if (subcontractor.linkedOrgId) {
                await sendNotification(subcontractor.linkedOrgId, payload, state.currentOrganization?.id);
            }

            await sendEmail(state.currentOrganization, {
                to: subcontractor.email,
                message: {
                    subject: `Compliance Document Requirement - ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
                            <h2 style="color: #4f46e5;">Action Required: Compliance Packet Submission</h2>
                            <p>Dear ${subcontractor.contactName || subcontractor.companyName},</p>
                            <p><strong>${orgName}</strong> requires updated compliance documents before work orders can be dispatched to your team.</p>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <h4 style="margin-top:0; color: #1f2937;">Required Documents:</h4>
                                <ul style="color: #4b5563;">
                                    ${complianceResult.missingDocLabels.map(l => `<li><strong>${l}</strong></li>`).join('')}
                                </ul>
                            </div>
                            <p>Please log in to your account or reply with attachments to fulfill your compliance packet.</p>
                            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">Sent via TekTrakker Subcontractor Compliance Engine</p>
                        </div>
                    `
                }
            });

            showToast.success(`Sent compliance reminder to ${subcontractor.email}`);
        } catch (err: any) {
            console.error("Failed to send reminder:", err);
            showToast.error("Error sending notification: " + err.message);
        } finally {
            setIsSendingReminder(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Compliance & Contracts: ${subcontractor.companyName}`}
        >
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
                {/* Summary Banner */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    complianceResult.isCompliant 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}>
                    <div className="flex items-center gap-3">
                        {complianceResult.isCompliant ? (
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                        )}
                        <div>
                            <span className="font-extrabold text-sm block">
                                {complianceResult.isCompliant 
                                    ? "Subcontractor Fully Compliant" 
                                    : `Pending ${complianceResult.missingDocKeys.length} Compliance Items`}
                            </span>
                            <p className="text-xs opacity-80 leading-normal">
                                {complianceResult.fulfilledCount} of {complianceResult.totalRequiredCount} required documents verified and active.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        onClick={handleSendComplianceReminder}
                        disabled={isSendingReminder}
                        className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold shrink-0"
                    >
                        <Send className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                        {isSendingReminder ? "Sending..." : "Send Reminder"}
                    </Button>
                </div>

                {/* Subcontractor Contracts & Master Agreements */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-indigo-500" /> Executed Contracts & Master Agreements
                        </h4>
                        <Button 
                            type="button" 
                            onClick={() => { setEditingContract(null); setContractModalOpen(true); }}
                            className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold py-1 px-3"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> New Contract
                        </Button>
                    </div>

                    {(!subcontractor.contracts || subcontractor.contracts.length === 0) ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                            No contract records created yet. Click <strong>+ New Contract</strong> to upload or create an interactive Master Service Agreement.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {subcontractor.contracts.map(contract => (
                                <div key={contract.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-slate-800 dark:text-slate-100">{contract.title}</span>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                contract.status === 'Signed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {contract.status}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            {contract.contractType} {contract.effectiveDate && `• Effective ${contract.effectiveDate}`} {contract.signedByName && `• Signed by ${contract.signedByName}`}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => { setEditingContract(contract); setContractModalOpen(true); }}
                                        className="text-[10px] py-1 px-2 h-7"
                                    >
                                        Edit / View
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Compliance Documents List */}
                <div className="space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-500" /> Compliance Documents Checklist
                    </h4>

                    <div className="space-y-3">
                        {ALL_COMPLIANCE_DOCUMENTS.map(def => {
                            const isRequired = state.currentOrganization?.subcontractorComplianceSettings?.requiredDocuments?.[def.key] ?? def.defaultRequired;
                            const doc = (subcontractor.complianceDocs || []).find(d => d.docKey === def.key);
                            const status = doc?.status || 'missing';

                            return (
                                <div 
                                    key={def.key} 
                                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                                        isRequired ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                                                    {def.label}
                                                </span>
                                                {isRequired && (
                                                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] font-black uppercase rounded">
                                                        Required
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                                                    status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                    status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500">{def.description}</p>
                                            {doc?.fileName && (
                                                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-1">
                                                    <FileText className="w-3 h-3" /> Attached: {doc.fileName}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Controls */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateDocStatus(def.key, 'verified')}
                                                className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                                                    status === 'verified' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-emerald-50'
                                                }`}
                                                title="Mark Verified"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateDocStatus(def.key, 'pending')}
                                                className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                                                    status === 'pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-amber-50'
                                                }`}
                                                title="Mark Pending Review"
                                            >
                                                <Clock className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateDocStatus(def.key, 'missing')}
                                                className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                                                    status === 'missing' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-red-50'
                                                }`}
                                                title="Mark Missing"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Upload Input */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                                        <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline flex items-center gap-1">
                                            <Upload className="w-3.5 h-3.5" /> Upload / Replace File
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="application/pdf,image/*,.doc,.docx"
                                                onChange={(e) => handleFileUpload(e, def.key)} 
                                            />
                                        </label>
                                        {doc?.fileUrl && (
                                            <a 
                                                href={doc.fileUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1"
                                            >
                                                View Document <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Contract Modal */}
            {isContractModalOpen && (
                <SubcontractorContractModal
                    isOpen={isContractModalOpen}
                    onClose={() => setContractModalOpen(false)}
                    subcontractorId={subcontractor.id}
                    subcontractorName={subcontractor.companyName}
                    subcontractorEmail={subcontractor.email}
                    existingContract={editingContract}
                    onSaveContract={handleSaveContract}
                />
            )}
        </Modal>
    );
};

export default SubcontractorComplianceModal;
