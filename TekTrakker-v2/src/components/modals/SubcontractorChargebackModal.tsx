import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { uploadFileToStorage } from '../../lib/storageService';
import { cleanUndefinedFields } from '../../lib/utils';
import showToast from '../../lib/toast';
import { globalConfirm } from '../../lib/globalConfirm';
import {
    AlertTriangle,
    Camera,
    DollarSign,
    FileText,
    Image as ImageIcon,
    Loader2,
    Plus,
    Receipt,
    Trash2,
    Upload,
    Wrench,
    X,
    ExternalLink,
    Building2,
    Briefcase
} from 'lucide-react';
import type { Subcontractor, SubcontractorChargeback, ChargebackEvidencePhoto, ChargebackReceipt, Job } from '../../types';

interface SubcontractorChargebackModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor?: Subcontractor | null;
    initialJob?: Job | null;
    chargebackToEdit?: SubcontractorChargeback | null;
    onSaveSuccess?: (chargeback: SubcontractorChargeback) => void;
}

export const SubcontractorChargebackModal: React.FC<SubcontractorChargebackModalProps> = ({
    isOpen,
    onClose,
    subcontractor,
    initialJob,
    chargebackToEdit,
    onSaveSuccess
}) => {
    const { state } = useAppContext();
    const photoInputRef = useRef<HTMLInputElement>(null);
    const receiptInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [selectedSubId, setSelectedSubId] = useState<string>('');
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [category, setCategory] = useState<SubcontractorChargeback['category']>('property_damage');
    const [title, setTitle] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState<SubcontractorChargeback['status']>('Applied');
    const [description, setDescription] = useState<string>('');

    // Evidence Lists
    const [evidencePhotos, setEvidencePhotos] = useState<ChargebackEvidencePhoto[]>([]);
    const [receipts, setReceipts] = useState<ChargebackReceipt[]>([]);

    // Pending upload receipt temporary form
    const [pendingReceiptName, setPendingReceiptName] = useState<string>('');
    const [pendingReceiptAmount, setPendingReceiptAmount] = useState<string>('');
    const [pendingReceiptType, setPendingReceiptType] = useState<ChargebackReceipt['type']>('receipt');
    const [pendingReceiptNotes, setPendingReceiptNotes] = useState<string>('');

    // Upload & Loading states
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Selected photo preview lightbox
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        if (chargebackToEdit) {
            setSelectedSubId(chargebackToEdit.subcontractorId || '');
            setSelectedJobId(chargebackToEdit.jobId || '');
            setCategory(chargebackToEdit.category || 'property_damage');
            setTitle(chargebackToEdit.title || '');
            setAmount(chargebackToEdit.amount?.toString() || '');
            setDate(chargebackToEdit.date ? chargebackToEdit.date.split('T')[0] : new Date().toISOString().split('T')[0]);
            setStatus(chargebackToEdit.status || 'Applied');
            setDescription(chargebackToEdit.description || '');
            setEvidencePhotos(chargebackToEdit.evidencePhotos || []);
            setReceipts(chargebackToEdit.receiptsAndInvoices || []);
        } else {
            setSelectedSubId(subcontractor?.id || initialJob?.subcontractorId || initialJob?.assignedPartnerId || '');
            setSelectedJobId(initialJob?.id || '');
            setCategory('property_damage');
            setTitle('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setStatus('Applied');
            setDescription('');
            setEvidencePhotos([]);
            setReceipts([]);
        }
        setPendingReceiptName('');
        setPendingReceiptAmount('');
        setPendingReceiptNotes('');
    }, [isOpen, chargebackToEdit, subcontractor, initialJob]);

    if (!isOpen) return null;

    const availableSubs: Subcontractor[] = state.subcontractors || [];
    const activeOrgId = state.currentOrganization?.id || '';

    // Jobs filtered for the selected subcontractor or all organization jobs
    const availableJobs: Job[] = (state.jobs || []).filter(j => {
        if (j.organizationId !== activeOrgId) return false;
        if (!selectedSubId) return true;
        return j.subcontractorId === selectedSubId ||
               j.assignedPartnerId === selectedSubId ||
               j.assignedTechnicianId === selectedSubId ||
               j.subcontractorWorkOrder?.subcontractorId === selectedSubId;
    });

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !activeOrgId) return;

        setIsUploadingPhoto(true);
        try {
            const uploaded: ChargebackEvidencePhoto[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const storagePath = `organizations/${activeOrgId}/chargebacks/photos/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                const url = await uploadFileToStorage(storagePath, file);
                uploaded.push({
                    url,
                    caption: file.name.replace(/\.[^/.]+$/, ''),
                    timestamp: new Date().toISOString(),
                    uploadedBy: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : 'Admin'
                });
            }
            setEvidencePhotos(prev => [...prev, ...uploaded]);
            showToast.success(`${uploaded.length} damage evidence photo${uploaded.length > 1 ? 's' : ''} uploaded.`);
        } catch (err: any) {
            console.error("Error uploading photo:", err);
            showToast.error("Failed to upload evidence photo: " + (err.message || 'Storage error'));
        } finally {
            setIsUploadingPhoto(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
        }
    };

    const handleRemovePhoto = (index: number) => {
        setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdatePhotoCaption = (index: number, caption: string) => {
        setEvidencePhotos(prev => prev.map((p, i) => i === index ? { ...p, caption } : p));
    };

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !activeOrgId) return;

        setIsUploadingReceipt(true);
        try {
            const file = files[0];
            const storagePath = `organizations/${activeOrgId}/chargebacks/receipts/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
            const url = await uploadFileToStorage(storagePath, file);

            const parsedAmt = parseFloat(pendingReceiptAmount);
            const newReceipt: ChargebackReceipt = {
                url,
                name: pendingReceiptName.trim() || file.name,
                amount: !isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : undefined,
                type: pendingReceiptType || 'receipt',
                notes: pendingReceiptNotes.trim() || undefined
            };

            setReceipts(prev => [...prev, newReceipt]);
            
            // If main amount is empty or matches total receipts, optionally sum it up
            if (!amount || parseFloat(amount) === 0) {
                if (newReceipt.amount) {
                    setAmount(newReceipt.amount.toString());
                }
            }

            setPendingReceiptName('');
            setPendingReceiptAmount('');
            setPendingReceiptNotes('');
            showToast.success("Receipt / work order documentation uploaded.");
        } catch (err: any) {
            console.error("Error uploading receipt:", err);
            showToast.error("Failed to upload receipt document: " + (err.message || 'Storage error'));
        } finally {
            setIsUploadingReceipt(false);
            if (receiptInputRef.current) receiptInputRef.current.value = '';
        }
    };

    const handleRemoveReceipt = (index: number) => {
        setReceipts(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubId) {
            showToast.warn("Please select a subcontractor.");
            return;
        }
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            showToast.warn("Please enter a valid deduction amount ($).");
            return;
        }
        if (!title.trim()) {
            showToast.warn("Please enter a title/cause for the chargeback.");
            return;
        }
        if (!activeOrgId) {
            showToast.error("No active organization found.");
            return;
        }

        setIsSaving(true);
        try {
            const sub = availableSubs.find(s => s.id === selectedSubId);
            const subName = sub?.companyName || sub?.contactName || 'Subcontractor';

            const job = availableJobs.find(j => j.id === selectedJobId);
            const woNum = job?.workOrderNumber || job?.poNumber || job?.id?.slice(0, 8);
            const customerName = job?.customerName || '';

            const chargebackId = chargebackToEdit?.id || `cb-${Date.now()}`;
            const nowStr = new Date().toISOString();

            const payload: SubcontractorChargeback = {
                id: chargebackId,
                organizationId: activeOrgId,
                subcontractorId: selectedSubId,
                subcontractorName: subName,
                jobId: selectedJobId || undefined,
                workOrderNumber: woNum || undefined,
                customerName: customerName || undefined,
                category,
                title: title.trim(),
                description: description.trim(),
                amount: Math.round(parsedAmount * 100) / 100,
                date: new Date(date).toISOString(),
                status,
                evidencePhotos,
                receiptsAndInvoices: receipts,
                createdAt: chargebackToEdit?.createdAt || nowStr,
                updatedAt: nowStr,
                createdBy: chargebackToEdit?.createdBy || {
                    id: state.currentUser?.id || 'admin',
                    name: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : 'Admin'
                }
            };

            await db.collection('subcontractor_chargebacks')
                .doc(chargebackId)
                .set(cleanUndefinedFields(payload), { merge: true });

            showToast.success(chargebackToEdit ? "Chargeback updated successfully!" : "Subcontractor chargeback logged successfully!");
            if (onSaveSuccess) onSaveSuccess(payload);
            onClose();
        } catch (err: any) {
            console.error("Error saving subcontractor chargeback:", err);
            showToast.error("Failed to save chargeback: " + (err.message || 'Database error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!chargebackToEdit) return;
        if (!await globalConfirm(`Permanently delete chargeback "${chargebackToEdit.title}" ($${chargebackToEdit.amount})?`)) return;

        setIsSaving(true);
        try {
            await db.collection('subcontractor_chargebacks').doc(chargebackToEdit.id).delete();
            showToast.success("Chargeback record deleted.");
            onClose();
        } catch (err: any) {
            console.error("Error deleting chargeback:", err);
            showToast.error("Failed to delete chargeback.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={chargebackToEdit ? `Edit Subcontractor Chargeback - ${chargebackToEdit.title}` : "Log Subcontractor Property Damage & Rework Chargeback"}
            size="xl"
        >
            <form onSubmit={handleSave} className="space-y-6 max-h-[82vh] overflow-y-auto p-1 text-slate-900 dark:text-white">
                
                {/* Header Banner */}
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-lg text-rose-600 shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-rose-900 dark:text-rose-200">
                            Subcontractor Site Damage & Rework Deduction
                        </h4>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                            Chargebacks itemize property damage or workmanship rework. Upload photos of the damage and receipts for replacement materials/fix work orders to clearly show proof on their Payment Statement.
                        </p>
                    </div>
                </div>

                {/* Subcontractor & Job Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Subcontractor / Partner <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={selectedSubId}
                            onChange={e => {
                                setSelectedSubId(e.target.value);
                                setSelectedJobId('');
                            }}
                            required
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-bold"
                        >
                            <option value="">-- Select Subcontractor --</option>
                            {availableSubs.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.companyName || s.contactName} ({s.trade || 'Partner'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Associated Job / Work Order (Optional)
                        </label>
                        <select
                            value={selectedJobId}
                            onChange={e => setSelectedJobId(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-medium"
                        >
                            <option value="">-- General Site / Not Job-Specific --</option>
                            {availableJobs.map(j => {
                                const wo = j.workOrderNumber || j.poNumber || j.id.slice(0, 8);
                                return (
                                    <option key={j.id} value={j.id}>
                                        #{wo} - {j.customerName || 'Customer'} ({j.jobStatus || (j as any).status || 'Job'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* Chargeback Classification & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value as any)}
                            required
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-bold"
                        >
                            <option value="property_damage">Property Damage</option>
                            <option value="faulty_work">Faulty Workmanship / Rework</option>
                            <option value="material_loss">Material Loss / Scrap</option>
                            <option value="safety_violation">Safety Violation / Code Penalty</option>
                            <option value="other">Other Incident Chargeback</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Deduction Amount ($) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-2 border-rose-300 dark:border-rose-800/80 bg-white dark:bg-slate-800 font-mono font-bold text-rose-600 dark:text-rose-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Incident Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 font-medium"
                        />
                    </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Chargeback Cause / Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Broken Drywall & Punctured Water Line Behind Unit"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Detailed Description of Damage / Faulty Work & Resolution
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Provide comprehensive details of what property was damaged or what faulty work occurred, materials required to rectify, and technicians dispatched to fix it..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                        />
                    </div>
                </div>

                {/* Section: Photos of Damage & Faulty Work */}
                <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Camera size={16} className="text-rose-600" /> Damage & Faulty Work Photos ({evidencePhotos.length})
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Attach photos showing the site damage or improper work for proof on the subcontractor statement.
                            </p>
                        </div>
                        <div>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => photoInputRef.current?.click()}
                                disabled={isUploadingPhoto}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5"
                            >
                                {isUploadingPhoto ? (
                                    <><Loader2 size={13} className="animate-spin mr-1" /> Uploading...</>
                                ) : (
                                    <><Plus size={13} className="mr-1" /> Add Photos</>
                                )}
                            </Button>
                        </div>
                    </div>

                    {evidencePhotos.length === 0 ? (
                        <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 text-xs">
                            No damage photos attached yet. Click "Add Photos" to upload image proof.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                            {evidencePhotos.map((photo, idx) => (
                                <div key={idx} className="relative group border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                                    <div 
                                        onClick={() => setPreviewPhotoUrl(photo.url)}
                                        className="h-28 bg-slate-100 dark:bg-slate-900 overflow-hidden cursor-pointer flex items-center justify-center"
                                    >
                                        <img src={photo.url} alt="Damage Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    </div>
                                    <div className="p-2 space-y-1">
                                        <input
                                            type="text"
                                            placeholder="Caption/Note..."
                                            value={photo.caption || ''}
                                            onChange={e => handleUpdatePhotoCaption(idx, e.target.value)}
                                            className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 font-medium"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePhoto(idx)}
                                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-rose-600 transition-colors opacity-90 group-hover:opacity-100"
                                        title="Remove photo"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section: Receipts & Fix Work Orders */}
                <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Receipt size={16} className="text-emerald-600" /> Receipts, Materials & Repair Work Orders ({receipts.length})
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Attach receipts for replacement parts or repair work orders to substantiate the deduction amount.
                        </p>
                    </div>

                    {/* Receipt Upload Quick Form */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Receipt / Part Description</label>
                            <input
                                type="text"
                                placeholder="e.g. SupplyHouse - Replacement Copper Fittings"
                                value={pendingReceiptName}
                                onChange={e => setPendingReceiptName(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cost ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={pendingReceiptAmount}
                                onChange={e => setPendingReceiptAmount(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono"
                            />
                        </div>
                        <div>
                            <input
                                ref={receiptInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleReceiptUpload}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => receiptInputRef.current?.click()}
                                disabled={isUploadingReceipt}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2"
                            >
                                {isUploadingReceipt ? <Loader2 size={13} className="animate-spin mr-1" /> : <Upload size={13} className="mr-1" />}
                                Upload Document
                            </Button>
                        </div>
                    </div>

                    {/* Receipts List */}
                    {receipts.length > 0 && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                            {receipts.map((r, idx) => (
                                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText size={16} className="text-slate-400 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold truncate text-slate-900 dark:text-white">{r.name}</div>
                                            {r.notes && <div className="text-[10px] text-slate-500 truncate">{r.notes}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {r.amount && (
                                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                ${r.amount.toFixed(2)}
                                            </span>
                                        )}
                                        {r.url && (
                                            <a
                                                href={r.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-bold text-[11px]"
                                            >
                                                View <ExternalLink size={11} />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReceipt(idx)}
                                            className="text-slate-400 hover:text-rose-600 p-1"
                                            title="Delete receipt"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Status Picker & Form Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Status:</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value as any)}
                            className="text-xs font-black uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2"
                        >
                            <option value="Applied">Applied (Active Deduction)</option>
                            <option value="Pending">Pending Review</option>
                            <option value="Disputed">Disputed by Subcontractor</option>
                            <option value="Waived">Waived / Forgiven</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        {chargebackToEdit && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs font-bold px-3"
                            >
                                <Trash2 size={13} className="mr-1" /> Delete
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isSaving}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase px-4 shadow-sm"
                        >
                            {isSaving ? (
                                <><Loader2 size={13} className="animate-spin mr-1" /> Saving...</>
                            ) : (
                                chargebackToEdit ? "Save Changes" : "Log Chargeback Deduction"
                            )}
                        </Button>
                    </div>
                </div>

            </form>

            {/* Photo Lightbox Modal */}
            {previewPhotoUrl && (
                <div 
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
                >
                    <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-slate-900 p-2">
                        <img src={previewPhotoUrl} alt="Damage Full View" className="max-w-full max-h-[85vh] object-contain rounded" />
                        <button
                            onClick={() => setPreviewPhotoUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-black/70 text-white rounded-full hover:bg-rose-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default SubcontractorChargebackModal;
