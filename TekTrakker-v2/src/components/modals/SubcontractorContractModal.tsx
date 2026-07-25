import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import showToast from '../../lib/toast';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import { FileText, Upload, CheckCircle2, ShieldCheck, PenTool, Calendar, DollarSign } from 'lucide-react';
import type { SubcontractorContract } from '../../types';

interface SubcontractorContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractorId?: string;
    subcontractorName?: string;
    subcontractorEmail?: string;
    existingContract?: SubcontractorContract | null;
    onSaveContract: (contract: SubcontractorContract) => void;
    isSubcontractorUser?: boolean;
}

const DEFAULT_MSA_CLAUSES = `SUBCONTRACTOR MASTER SERVICE AGREEMENT (MSA)

1. Scope of Work & Work Orders
The Subcontractor agrees to perform trade services as specified in individually dispatched Work Orders. All services must be executed in a professional, workmanlike manner in compliance with local trade codes and safety standards.

2. Independent Contractor Status
The Subcontractor is an independent contractor and not an employee of the Contractor. The Subcontractor is responsible for supplying their own tools, vehicles, business licenses, worker compensation, and business liability insurance.

3. Payment Terms & Invoicing
Payment shall be rendered upon completion and verification of assigned work orders within the agreed payment schedule. The Subcontractor must maintain an updated W-9 on file to receive payouts.

4. Non-Solicitation & Confidentiality
Subcontractor agrees not to solicit or accept direct business from clients introduced by the Contractor for a period of twelve (12) months following contract execution.`;

export const SubcontractorContractModal: React.FC<SubcontractorContractModalProps> = ({
    isOpen,
    onClose,
    subcontractorId,
    subcontractorName = 'Subcontractor',
    subcontractorEmail = '',
    existingContract,
    onSaveContract,
    isSubcontractorUser = false
}) => {
    const [mode, setMode] = useState<'fillable' | 'upload'>('fillable');
    const [title, setTitle] = useState('');
    const [contractType, setContractType] = useState<SubcontractorContract['contractType']>('Master Service Agreement');
    const [effectiveDate, setEffectiveDate] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [content, setContent] = useState(DEFAULT_MSA_CLAUSES);
    const [fileUrl, setFileUrl] = useState('');
    const [fileName, setFileName] = useState('');
    const [signatureName, setSignatureName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingContract) {
                setTitle(existingContract.title || '');
                setContractType(existingContract.contractType || 'Master Service Agreement');
                setEffectiveDate(existingContract.effectiveDate || '');
                setExpirationDate(existingContract.expirationDate || '');
                setContent(existingContract.content || DEFAULT_MSA_CLAUSES);
                setFileUrl(existingContract.fileUrl || '');
                setFileName(existingContract.fileName || '');
                setMode(existingContract.fileUrl ? 'upload' : 'fillable');
                setSignatureName(existingContract.signedByName || '');
            } else {
                setTitle(`Master Service Agreement - ${subcontractorName}`);
                setContractType('Master Service Agreement');
                setEffectiveDate(new Date().toISOString().split('T')[0]);
                // Default 1 year expiration
                const nextYr = new Date();
                nextYr.setFullYear(nextYr.getFullYear() + 1);
                setExpirationDate(nextYr.toISOString().split('T')[0]);
                setContent(DEFAULT_MSA_CLAUSES);
                setFileUrl('');
                setFileName('');
                setMode('fillable');
                setSignatureName('');
            }
        }
    }, [isOpen, existingContract, subcontractorName]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setFileUrl(reader.result as string);
            setFileName(file.name);
            showToast.success(`Attached ${file.name}`);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            showToast.error("Contract title is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            const isSigned = !!signatureName.trim();
            const now = new Date().toISOString();

            const contractObj: SubcontractorContract = {
                id: existingContract?.id || `contract-${Date.now()}`,
                title: title.trim(),
                contractType,
                effectiveDate,
                expirationDate,
                content: mode === 'fillable' ? content : undefined,
                fileUrl: mode === 'upload' ? fileUrl : undefined,
                fileName: mode === 'upload' ? fileName : undefined,
                status: isSigned ? 'Signed' : (existingContract?.status || 'Sent'),
                signedAt: isSigned ? (existingContract?.signedAt || now) : undefined,
                signedByName: signatureName.trim() || undefined,
                signedByEmail: subcontractorEmail || undefined,
                uploadedAt: existingContract?.uploadedAt || now
            };

            await onSaveContract(contractObj);
            showToast.success(isSigned ? "Contract signed and saved!" : "Contract saved successfully!");
            onClose();
        } catch (err: any) {
            console.error("Failed to save contract:", err);
            showToast.error("Error saving contract: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={existingContract ? `Manage Contract: ${existingContract.title}` : `New Contract for ${subcontractorName}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                {/* Mode Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                    <button
                        type="button"
                        onClick={() => setMode('fillable')}
                        className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                            mode === 'fillable' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'
                        }`}
                    >
                        <PenTool className="w-3.5 h-3.5" /> Interactive Agreement Template
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('upload')}
                        className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                            mode === 'upload' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'
                        }`}
                    >
                        <Upload className="w-3.5 h-3.5" /> Upload Executed PDF / Document
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                        label="Contract Title" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        placeholder="e.g. 2026 Master Subcontractor Agreement" 
                        required 
                    />
                    <Select 
                        label="Agreement Type" 
                        value={contractType} 
                        onChange={e => setContractType(e.target.value as any)}
                    >
                        <option value="Master Service Agreement">Master Service Agreement (MSA)</option>
                        <option value="Independent Contractor Agreement">Independent Contractor Agreement</option>
                        <option value="Work Order Sub-Contract">Work Order Sub-Contract</option>
                        <option value="NDA / Non-Compete">NDA & Non-Compete Agreement</option>
                        <option value="Custom Agreement">Custom Agreement</option>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                        label="Effective Date" 
                        type="date" 
                        value={effectiveDate} 
                        onChange={e => setEffectiveDate(e.target.value)} 
                    />
                    <Input 
                        label="Expiration Date" 
                        type="date" 
                        value={expirationDate} 
                        onChange={e => setExpirationDate(e.target.value)} 
                    />
                </div>

                {mode === 'fillable' ? (
                    <Textarea 
                        label="Agreement Terms & Clauses" 
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        rows={8}
                        className="font-mono text-xs"
                    />
                ) : (
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Upload Signed Document File (PDF, DOCX, PNG)
                        </label>
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 rounded-2xl cursor-pointer bg-indigo-50/30 dark:bg-indigo-950/20 transition-all text-center group">
                            <Upload className="w-8 h-8 text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block">
                                {fileName ? fileName : "Click or drag signed agreement file here"}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-1">
                                Supports PDF, DOCX, PNG up to 15MB
                            </span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" 
                                onChange={handleFileUpload} 
                            />
                        </label>
                        {fileUrl && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                                <span className="flex items-center gap-2 font-bold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Attached File: {fileName}
                                </span>
                                <button type="button" onClick={() => { setFileUrl(''); setFileName(''); }} className="text-[10px] underline font-bold text-red-500">Remove</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Subcontractor Digital Signature Section */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
                        <PenTool className="w-4 h-4 text-indigo-500" /> Digital E-Signature & Verification
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        To execute this contract digitally, enter the full legal name of the authorized subcontractor representative below.
                    </p>
                    <Input 
                        label="Full Legal Signature Name" 
                        value={signatureName} 
                        onChange={e => setSignatureName(e.target.value)} 
                        placeholder="e.g. Johnathan Smith, Owner" 
                    />
                    {signatureName.trim() && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                            <ShieldCheck className="w-4 h-4 text-indigo-500" /> Digitally Signed by {signatureName} on {new Date().toLocaleDateString()}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                        {isSubmitting ? "Saving..." : "Save Contract"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SubcontractorContractModal;
