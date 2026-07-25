import { cleanUndefinedFields } from '../../../lib/utils';
import showToast from "lib/toast";
import React, { useRef, useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from '../../../lib/firebase';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;
import { StoredFile, Job } from '../../../types';
import { Eye, Printer, Send, Check, Plus, Trash2 } from 'lucide-react';
import DocumentPreview from '../../../components/ui/DocumentPreview';

interface SubcontractorBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    onSave: (billFile: StoredFile) => void;
}

interface BillItem {
    description: string;
    quantity: number;
    rate: number;
}

export const SubcontractorBillModal: React.FC<SubcontractorBillModalProps> = ({ isOpen, onClose, job, onSave }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const sigCanvas = useRef<any>(null);

    const [billNo, setBillNo] = useState(() => `SUB-INV-${Date.now().toString().slice(-6)}`);
    const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [subName, setSubName] = useState(() => state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : '');
    const [subEmail, setSubEmail] = useState(() => state.currentUser?.email || '');
    const [items, setItems] = useState<BillItem[]>([
        { description: t('Labor Charges'), quantity: 1, rate: job.subcontractorWorkOrder?.nte || 150 }
    ]);
    const [memo, setMemo] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: keyof BillItem, value: any) => {
        const newItems = [...items];
        if (field === 'quantity') {
            newItems[index].quantity = Math.max(0.25, parseFloat(value) || 0);
        } else if (field === 'rate') {
            newItems[index].rate = Math.max(0, parseFloat(value) || 0);
        } else {
            newItems[index].description = value;
        }
        setItems(newItems);
    };

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    const generateHtmlContent = (signatureDataUrl: string) => {
        const orgName = state.currentOrganization?.name || 'Hiring Company';
        const orgLogo = state.currentOrganization?.logoUrl || '';
        const customerName = job.customerName || 'N/A';
        const customerAddress = typeof job.address === 'string' ? job.address : 'N/A';

        const itemRows = items.map(item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: left; font-size: 13px;">${item.description || 'Service Charges'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: center; font-size: 13px;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right; font-size: 13px;">$${item.rate.toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right; font-size: 13px; font-weight: bold;">$${(item.quantity * item.rate).toFixed(2)}</td>
            </tr>
        `).join('');

        return `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1a202c; background-color: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 25px;">
                    <div>
                        <h1 style="margin: 0; font-size: 26px; color: #4f46e5; font-weight: 800;">${subName || 'Subcontractor'}</h1>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #4b5563;">Email: ${subEmail}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 16px; color: #1f2937; font-weight: bold;">SUBCONTRACTOR BILL</h2>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #4b5563;">Bill #: ${billNo}</p>
                        <p style="margin: 2px 0 0 0; font-size: 13px; color: #4b5563;">Date: ${billDate}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 13px;">
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #f3f4f6;">
                        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; color: #1f2937; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Bill To</h3>
                        <p style="margin: 0 0 4px 0; font-weight: bold; color: #111827;">${orgName}</p>
                        <p style="margin: 0; color: #4b5563;">Job / WO #: ${job.poNumber || job.id || 'N/A'}</p>
                    </div>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #f3f4f6;">
                        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; color: #1f2937; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Service Site</h3>
                        <p style="margin: 0 0 4px 0; font-weight: bold; color: #111827;">${customerName}</p>
                        <p style="margin: 0; color: #4b5563;">${customerAddress}</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                    <thead>
                        <tr style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 10px; text-align: left; font-size: 12px; font-weight: bold; color: #4b5563; text-transform: uppercase;">Description</th>
                            <th style="padding: 10px; text-align: center; font-size: 12px; font-weight: bold; color: #4b5563; text-transform: uppercase;">Qty</th>
                            <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #4b5563; text-transform: uppercase;">Rate</th>
                            <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #4b5563; text-transform: uppercase;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 10px;"></td>
                            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 14px; border-top: 2px solid #edf2f7;">Total Amount Due:</td>
                            <td style="padding: 10px; text-align: right; font-weight: 800; font-size: 16px; color: #4f46e5; border-top: 2px solid #edf2f7;">$${subtotal.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                ${memo ? `<div style="margin-bottom: 25px; padding: 15px; border-radius: 8px; border: 1px solid #edf2f7; font-size: 13px; color: #4b5563;"><strong style="color: #2d3748; display: block; margin-bottom: 4px;">Memo / Notes:</strong>${memo}</div>` : ''}

                <div style="margin-top: 40px; display: flex; justify-content: flex-end;">
                    <div style="text-align: center; width: 250px;">
                        <img src="${signatureDataUrl}" style="max-height: 50px; max-width: 200px; display: block; margin: 0 auto 5px auto; object-fit: contain;" alt="Subcontractor Signature" />
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 12px; color: #718096; font-weight: bold; text-transform: uppercase;">Subcontractor Signature</div>
                    </div>
                </div>
            </div>
        `;
    };

    const handlePreview = () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            showToast.warn(t("Please sign the sheet before previewing."));
            return;
        }
        const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        setPreviewHtml(generateHtmlContent(signature));
        setIsPreviewOpen(true);
    };

    const handleSaveBill = async () => {
        if (!subName.trim()) {
            showToast.warn(t("Please enter your name."));
            return;
        }
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            showToast.warn(t("Please sign the invoice before submitting."));
            return;
        }

        setIsSaving(true);
        try {
            const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            const html = generateHtmlContent(signature);

            // 1. Generate StoredFile document object
            const billFile: StoredFile = {
                id: `sub-bill-${Date.now()}`,
                organizationId: job.organizationId,
                parentId: job.id,
                parentType: 'job',
                fileName: `Subcontractor_Bill_${billNo}.html`,
                fileType: 'text/html',
                dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(html))),
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : 'Subcontractor',
                type: 'Document',
                metadata: { label: 'Subcontractor Invoice' }
            };

            // 2. Submit Expense to the Sponsoring Organization
            const expense = {
                id: `exp-${Date.now()}`,
                organizationId: job.organizationId,
                userId: state.currentUser?.id,
                date: billDate,
                category: 'Subcontractor Labor',
                vendor: subName,
                description: `${t('Subcontractor Invoice')} #${billNo} - Job: ${job.customerName}`,
                amount: subtotal,
                paidBy: 'Company Account',
                status: 'Pending',
                projectId: job.id,
                receiptUrl: billFile.dataUrl // Base64 data URL containing HTML bill
            };

            // 3. Create a corresponding record in the 'payables' collection
            const payableRecord = {
                id: `pay-${Date.now()}`,
                organizationId: job.organizationId,
                subcontractorId: state.currentUser?.id || 'sub',
                jobId: job.id,
                amount: subtotal,
                status: 'Unpaid',
                createdAt: new Date().toISOString(),
                companyName: subName,
                customerName: job.customerName || 'N/A'
            };

            // Write both expense and payable records, and update the job document
            if (!state.isDemoMode) {
                await db.collection('expenses').doc(expense.id).set(cleanUndefinedFields(expense));
                await db.collection('payables').doc(payableRecord.id).set(cleanUndefinedFields(payableRecord));
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    subcontractorBill: {
                        billNo,
                        billDate,
                        subtotal,
                        memo,
                        items,
                        vendorName: subName
                    },
                    updatedAt: new Date().toISOString()
                }));
            }

            // Save document file reference
            onSave(billFile);
            showToast.success(t("Subcontractor invoice submitted to organization successfully!"));
            onClose();
        } catch (e) {
            console.error("Failed to save subcontractor bill:", e);
            showToast.error(t("Failed to submit subcontractor invoice."));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t("Create Subcontractor Bill")} size="lg">
                <div className="space-y-6 max-h-[85vh] overflow-y-auto p-1 text-slate-800 dark:text-slate-200 text-left">
                    <p className="text-sm text-slate-500">{t("Build an itemized bill for your subcontractor labor/materials to submit directly to the sponsoring organization's bookkeeping.")}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label={t("Bill / Invoice #")} value={billNo} onChange={e => setBillNo(e.target.value)} />
                        <Input label={t("Billing Date")} type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                        <Input label={t("Your Name / Business Name")} value={subName} onChange={e => setSubName(e.target.value)} />
                        <Input label={t("Your Email")} type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)} />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">{t("Line Items")}</h4>
                            <Button variant="secondary" onClick={handleAddItem} className="w-auto py-1 px-3 text-xs flex items-center gap-1">
                                <Plus size={14} /> {t("Add Row")}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative">
                                    <div className="flex-1">
                                        <Input 
                                            label={idx === 0 ? t("Description") : ""} 
                                            placeholder={t("e.g. Labor hours, Trip fee, parts, etc.")} 
                                            value={item.description} 
                                            onChange={e => handleUpdateItem(idx, 'description', e.target.value)} 
                                        />
                                    </div>
                                    <div className="w-full sm:w-20">
                                        <Input 
                                            label={idx === 0 ? t("Qty") : ""} 
                                            type="number" 
                                            step="0.25" 
                                            value={item.quantity} 
                                            onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)} 
                                        />
                                    </div>
                                    <div className="w-full sm:w-32">
                                        <Input 
                                            label={idx === 0 ? t("Rate ($)") : ""} 
                                            type="number" 
                                            step="0.01" 
                                            value={item.rate} 
                                            onChange={e => handleUpdateItem(idx, 'rate', e.target.value)} 
                                        />
                                    </div>
                                    <div className="w-full sm:w-32 text-right self-center sm:self-auto sm:pb-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5 sm:hidden">{t("Total")}</p>
                                        <span className="font-extrabold text-slate-700 dark:text-slate-200">${(item.quantity * item.rate).toFixed(2)}</span>
                                    </div>
                                    {items.length > 1 && (
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveItem(idx)}
                                            className="absolute top-2 right-2 sm:static sm:mb-2 p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors self-end sm:self-auto"
                                            title={t("Remove Item")}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end p-2 bg-slate-50 dark:bg-slate-900 border rounded-xl">
                            <span className="font-bold text-sm text-slate-500 mr-4 self-center">{t("Total Amount Due")}:</span>
                            <span className="font-black text-xl text-primary-600">${subtotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t("Memo / Note to Organization")}</label>
                        <textarea 
                            rows={3} 
                            placeholder={t("Add any invoice details, banking details, or notes here...")} 
                            value={memo} 
                            onChange={e => setMemo(e.target.value)}
                            className="w-full p-3 border rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t("Sign Here")}</label>
                        <div className="relative">
                            <SignatureCanvas 
                                ref={sigCanvas} 
                                penColor="black" 
                                canvasProps={{ className: "w-full h-40 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white cursor-pointer shadow-inner" }} 
                            />
                            <button 
                                type="button" 
                                onClick={() => sigCanvas.current?.clear()} 
                                className="absolute bottom-2 right-2 py-1 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            >
                                {t("Clear")}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t("Cancel")}</Button>
                        <Button variant="secondary" onClick={handlePreview} disabled={isSaving} className="flex items-center gap-1.5 w-auto">
                            <Eye size={16} /> {t("Preview")}
                        </Button>
                        <Button onClick={handleSaveBill} disabled={isSaving} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold px-6">
                            <Check size={16} /> {t("Submit Bill")}
                        </Button>
                    </div>
                </div>
            </Modal>

            {isPreviewOpen && (
                <DocumentPreview 
                    type="Other" 
                    data={{
                        id: `preview-sub-${job.id}`,
                        title: t("Subcontractor Bill Preview"),
                        htmlContent: previewHtml,
                        createdAt: new Date().toISOString()
                    } as any}
                    onClose={() => setIsPreviewOpen(false)} 
                />
            )}
        </>
    );
};

export default SubcontractorBillModal;
