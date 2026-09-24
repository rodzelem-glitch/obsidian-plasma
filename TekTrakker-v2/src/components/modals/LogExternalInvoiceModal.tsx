import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import { uploadFileToStorage } from '../../lib/storageService';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import showToast from 'lib/toast';
import { Upload, Paperclip, FileText, Building2, User as UserIcon, Calendar, DollarSign } from 'lucide-react';

interface LogExternalInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const LogExternalInvoiceModal: React.FC<LogExternalInvoiceModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { state } = useAppContext();
    const [subcontractorId, setSubcontractorId] = useState('');
    const [jobId, setJobId] = useState('');
    const [workOrderNumber, setWorkOrderNumber] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Build unified subcontractor selection options
    const subcontractorOptions = useMemo(() => {
        const list: { id: string; name: string; type: string }[] = [];
        
        (state.subcontractors || []).forEach(s => {
            list.push({
                id: s.id,
                name: s.companyName || s.contactName || 'Subcontractor',
                type: 'Partner / Organization'
            });
        });

        (state.users || []).forEach(u => {
            const isSub = u.role === 'Subcontractor' || (u as any).isSubcontractor || u.role?.toLowerCase() === 'subcontractor';
            if (isSub && !list.some(item => item.id === u.id)) {
                list.push({
                    id: u.id,
                    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Internal Subcontractor',
                    type: 'Internal 1099 Technician'
                });
            }
        });

        return list;
    }, [state.subcontractors, state.users]);

    // Active & completed jobs for selection
    const jobOptions = useMemo(() => {
        return (state.jobs || []).filter(j => j.organizationId === state.currentOrganization?.id);
    }, [state.jobs, state.currentOrganization]);

    const handleJobChange = (newJobId: string) => {
        setJobId(newJobId);
        const j = jobOptions.find(item => item.id === newJobId);
        if (j) {
            const wo = (j as any).workOrderNumber || j.poNumber || (j.invoice as any)?.poNumber;
            if (wo) {
                setWorkOrderNumber(wo);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subcontractorId) {
            showToast.warn("Please select a subcontractor.");
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            showToast.warn("Please enter a valid invoice amount.");
            return;
        }
        if (!state.currentOrganization) return;

        setIsUploading(true);
        try {
            let fileUrl: string | null = null;
            if (selectedFile) {
                const storagePath = `payables/${state.currentOrganization.id}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                fileUrl = await uploadFileToStorage(storagePath, selectedFile);
            }

            const selectedSub = subcontractorOptions.find(s => s.id === subcontractorId);
            const selectedJob = jobOptions.find(j => j.id === jobId);

            const docId = `payable-ext-${Date.now()}`;
            const subName = selectedSub ? selectedSub.name : 'External Subcontractor';
            const customerName = selectedJob ? selectedJob.customerName || 'N/A' : 'External Customer';
            const resolvedWo = workOrderNumber.trim() || (selectedJob as any)?.workOrderNumber || selectedJob?.poNumber || (selectedJob?.invoice as any)?.poNumber || undefined;

            // 1. Create Payables Record
            const payableDoc = {
                id: docId,
                organizationId: state.currentOrganization.id,
                subcontractorId,
                jobId: jobId || 'N/A',
                customerId: selectedJob?.customerId,
                workOrderNumber: resolvedWo,
                amount: numericAmount,
                status: 'Unpaid',
                createdAt: new Date(invoiceDate).toISOString(),
                companyName: subName,
                customerName,
                invoiceNumber: invoiceNumber.trim() || `EXT-${Date.now().toString().slice(-6)}`,
                externalInvoiceUrl: fileUrl,
                notes: notes.trim(),
                source: 'External Invoice Upload'
            };
            await db.collection('payables').doc(docId).set(cleanUndefinedFields(payableDoc));

            // 2. Create Expenses Record for P&L tracking
            const expenseDoc = {
                id: `exp-${docId}`,
                organizationId: state.currentOrganization.id,
                date: invoiceDate,
                category: 'Subcontractor Labor',
                vendor: subName,
                description: `External Invoice #${payableDoc.invoiceNumber} - Job: ${customerName}${resolvedWo ? ` (WO #${resolvedWo})` : ''}`,
                amount: numericAmount,
                paidBy: 'Company Account',
                status: 'Pending',
                projectId: jobId || 'N/A',
                receiptUrl: fileUrl
            };
            await db.collection('expenses').doc(expenseDoc.id).set(cleanUndefinedFields(expenseDoc));

            showToast.success(`External invoice logged successfully for ${subName}!`);
            setIsUploading(false);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error uploading external invoice:", error);
            showToast.warn("Failed to log external invoice.");
            setIsUploading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log External Subcontractor Invoice">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Select Subcontractor <span className="text-red-500">*</span>
                    </label>
                    <select
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-medium"
                        value={subcontractorId}
                        onChange={e => setSubcontractorId(e.target.value)}
                    >
                        <option value="">-- Choose Subcontractor --</option>
                        {subcontractorOptions.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Associated Job / Customer
                        </label>
                        <select
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-medium"
                            value={jobId}
                            onChange={e => handleJobChange(e.target.value)}
                        >
                            <option value="">-- Unlinked / No Job --</option>
                            {jobOptions.map(j => (
                                <option key={j.id} value={j.id}>#{j.id.slice(0, 8)} - {j.customerName} ({j.jobStatus || 'Scheduled'})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Work Order / PO #
                        </label>
                        <Input
                            placeholder="e.g. 566292"
                            value={workOrderNumber}
                            onChange={e => setWorkOrderNumber(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Invoice Date
                        </label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-medium"
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            External Invoice #
                        </label>
                        <Input
                            placeholder="e.g. INV-2026-88"
                            value={invoiceNumber}
                            onChange={e => setInvoiceNumber(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Billed Amount ($) <span className="text-red-500">*</span>
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Attach External Invoice File (PDF / Image)
                    </label>
                    <div className="flex items-center gap-3 p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <Paperclip className="text-slate-400" size={20} />
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            className="text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Notes / Line Item Details
                    </label>
                    <textarea
                        rows={2}
                        className="w-full p-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                        placeholder="Additional memo or descriptions..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-700">
                        {isUploading ? "Uploading & Saving..." : "Log External Invoice"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default LogExternalInvoiceModal;
