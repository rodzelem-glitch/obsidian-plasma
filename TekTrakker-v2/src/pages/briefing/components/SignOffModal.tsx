import { cleanUndefinedFields } from '../../../lib/utils';
import showToast from "lib/toast";
import React, { useRef, useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from '../../../lib/firebase';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;
import { StoredFile, Job } from '../../../types';
import { Eye, Printer, Send, Check } from 'lucide-react';
import DocumentPreview from '../../../components/ui/DocumentPreview';

interface SignOffModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    onSave: (signOffFile: StoredFile) => void;
}

const SignOffModal: React.FC<SignOffModalProps> = ({ isOpen, onClose, job, onSave }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const sigCanvas = useRef<any>(null);

    const [managerName, setManagerName] = useState('');
    const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [visitTime, setVisitTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [scopeOfWork, setScopeOfWork] = useState(() => job.tasks?.join('\n') || '');
    const [workCompleted, setWorkCompleted] = useState(() => job.notes?.workNotes || job.notes?.work || '');
    const [jobNo, setJobNo] = useState(() => job.poNumber || job.id || '');
    const [techName, setTechName] = useState(() => job.assignedTechnicianName || '');
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const partsUsed = job.partsUsed || [];

    const generateHtmlContent = (signatureDataUrl: string) => {
        const orgName = state.currentOrganization?.name || 'TekTrakker Service Provider';
        const logoUrl = state.currentOrganization?.logoUrl || '';
        const customerName = job.customerName || 'N/A';
        const customerAddress = typeof job.address === 'string' ? job.address : 'N/A';

        let partsTableHtml = '';
        if (partsUsed.length > 0) {
            const rows = partsUsed.map(part => `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #edf2f7; text-align: left;">${part.name}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #edf2f7; text-align: center;">${part.quantity}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #edf2f7; text-align: right;">${part.sku || 'N/A'}</td>
                </tr>
            `).join('');
            
            partsTableHtml = `
                <div style="margin-bottom: 20px;">
                    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; text-align: left;">Materials & Parts Installed</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; border: 1px solid #e2e8f0;">
                        <thead>
                            <tr style="background-color: #f7fafc;">
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Item Name</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: center;">Qty</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: right;">SKU/Part #</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        return `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1a202c; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px;">
                    <div>
                        ${logoUrl ? `<img src="${logoUrl}" style="max-height: 50px; max-width: 200px; object-fit: contain; margin-bottom: 8px; display: block;" alt="${orgName}" />` : `<h1 style="margin: 0; font-size: 26px; color: #1e3a8a; font-weight: 800;">${orgName}</h1>`}
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563; font-weight: 500;">SERVICE SIGN-OFF & ACCEPTANCE</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1f2937;">Job / WO #: ${jobNo}</p>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #4b5563;">Visit Date: ${visitDate} ${visitTime}</p>
                    </div>
                </div>

                <div style="margin-bottom: 25px; background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #f3f4f6;">
                    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-weight: 700; text-align: left;">Customer & Service Details</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; color: #4b5563; width: 30%; text-align: left;">Customer Name:</td>
                            <td style="padding: 6px 0; color: #1f2937; text-align: left;">${customerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; color: #4b5563; text-align: left;">Service Address:</td>
                            <td style="padding: 6px 0; color: #1f2937; text-align: left;">${customerAddress}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: 600; color: #4b5563; text-align: left;">Lead Technician:</td>
                            <td style="padding: 6px 0; color: #1f2937; text-align: left;">${techName}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-bottom: 25px; text-align: left;">
                    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-weight: 700;">Scope of Work</h3>
                    <div style="white-space: pre-wrap; font-size: 14px; color: #1f2937; background: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; line-height: 1.6;">${scopeOfWork}</div>
                </div>

                <div style="margin-bottom: 25px; text-align: left;">
                    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-weight: 700;">Work Completed & Diagnostic Notes</h3>
                    <div style="white-space: pre-wrap; font-size: 14px; color: #1f2937; background: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; line-height: 1.6;">${workCompleted}</div>
                </div>

                ${partsTableHtml}

                ${additionalNotes ? `
                <div style="margin-bottom: 25px; text-align: left;">
                    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-weight: 700;">Technician Comments</h3>
                    <div style="white-space: pre-wrap; font-size: 14px; color: #1f2937; background: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; line-height: 1.6;">${additionalNotes}</div>
                </div>
                ` : ''}

                <div style="margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px;">
                        <div style="width: 280px; text-align: left;">
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1f2937;">Manager / Customer Signature</p>
                            <p style="margin: 4px 0 12px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">I confirm the service was performed satisfactorily and completed as detailed above.</p>
                            <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; background: #ffffff; height: 90px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 8px;">
                                ${signatureDataUrl ? `<img src="${signatureDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Signature" />` : `<div style="color: #9ca3af; font-size: 12px; font-style: italic;">No signature provided</div>`}
                            </div>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #111827;">Manager on Duty: ${managerName}</p>
                        </div>
                        <div style="text-align: right; margin-bottom: 8px;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Date Signed</p>
                            <p style="margin: 4px 0 0 0; font-size: 15px; color: #111827; font-weight: 700;">${new Date().toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const handleClear = () => {
        sigCanvas.current?.clear();
    };

    const handlePreview = () => {
        const signature = sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.toDataURL() : '';
        const html = generateHtmlContent(signature);
        setPreviewHtml(html);
        setIsPreviewOpen(true);
    };

    const handlePrint = () => {
        const signature = sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.toDataURL() : '';
        const html = generateHtmlContent(signature);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>Print Sign-Off Sheet</title>
                        <style>
                            body { background: white; padding: 20px; }
                            @media print {
                                body { padding: 0; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        ${html}
                    </body>
                </html>
            `);
            win.document.close();
            setTimeout(() => {
                win.print();
                win.close();
            }, 500);
        } else {
            showToast.warn(t("Print popup blocked. Please check your browser settings."));
        }
    };

    const handleSendEmail = async () => {
        if (!job.customerEmail) {
            showToast.warn(t("Customer email is missing."));
            return;
        }
        if (!managerName) {
            showToast.warn(t("Please enter the Manager on duty name."));
            return;
        }
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            showToast.warn(t("Please sign the sheet before emailing."));
            return;
        }

        setIsSending(true);
        try {
            const signature = sigCanvas.current.toDataURL();
            const html = generateHtmlContent(signature);

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: [job.customerEmail],
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `Signed Job Sign-off Sheet: WO #${jobNo}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2>Job Sign-Off Sheet Completed</h2>
                            <p>Hello,</p>
                            <p>Please find attached the signed sign-off sheet for the service work completed on ${visitDate}.</p>
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;"/>
                            ${html}
                        </div>
                    `,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                },
                organizationId: job.organizationId,
                type: 'SignOffSheet',
                createdAt: new Date().toISOString()
            }));

            showToast.success(t("Sign-off sheet successfully emailed to customer!"));
        } catch (e) {
            console.error("Email sending failed:", e);
            showToast.warn(t("Failed to send email."));
        } finally {
            setIsSending(false);
        }
    };

    const handleSave = () => {
        if (!managerName) {
            showToast.warn(t("Please enter the Manager on duty name."));
            return;
        }
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            showToast.warn(t("Please provide a signature before saving."));
            return;
        }

        const signature = sigCanvas.current.toDataURL();
        const html = generateHtmlContent(signature);

        try {
            const signOffFile: StoredFile = {
                id: `signoff-doc-${Date.now()}`,
                organizationId: job.organizationId,
                parentId: job.id,
                parentType: 'job',
                fileName: 'SignOff_Sheet.html',
                fileType: 'text/html',
                dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(html))),
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'tech',
                type: 'Document',
                metadata: { label: 'Sign-Off Sheet' }
            };

            onSave(signOffFile);
            showToast.success(t("Sign-off sheet saved successfully!"));
            onClose();
        } catch (e) {
            console.error("Error generating sign-off document:", e);
            showToast.warn(t("Failed to save sign-off document."));
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t("Generate Job Sign-off Sheet")} size="lg">
                <div className="space-y-6 max-h-[80vh] overflow-y-auto p-1 text-slate-800 dark:text-slate-200">
                    <p className="text-sm text-slate-500">{t("Verify details, fill out manager on duty name, and sign below to complete the validation sheet.")}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Job / WO Number")}</label>
                            <input 
                                type="text" 
                                value={jobNo}
                                onChange={(e) => setJobNo(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Technician Name")}</label>
                            <input 
                                type="text" 
                                value={techName}
                                onChange={(e) => setTechName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Date of Visit")}</label>
                            <input 
                                type="date" 
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Time of Visit")}</label>
                            <input 
                                type="time" 
                                value={visitTime}
                                onChange={(e) => setVisitTime(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Scope of Work Requested")}</label>
                        <textarea 
                            value={scopeOfWork}
                            onChange={(e) => setScopeOfWork(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 resize-y"
                            placeholder={t("Tasks and scope details...")}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Work Completed & Diagnostic Notes")}</label>
                        <textarea 
                            value={workCompleted}
                            onChange={(e) => setWorkCompleted(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 resize-y"
                            placeholder={t("Describe repairs and completed work...")}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Additional Technician Comments (Optional)")}</label>
                        <textarea 
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 resize-y"
                            placeholder={t("Notes, recommendations, or site conditions...")}
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">{t("Manager on Duty Signature")}</label>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Manager / Client Name (Required)")}</label>
                            <input 
                                type="text" 
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                placeholder={t("Enter name of signing officer...")}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white relative">
                            <div className="absolute top-2 left-3 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">{t("Signature Pad")}</div>
                            <SignatureCanvas 
                                ref={sigCanvas}
                                penColor="black"
                                canvasProps={{className: 'w-full h-44 cursor-crosshair'}} 
                            />
                            <button 
                                type="button" 
                                onClick={handleClear} 
                                className="absolute bottom-2 right-3 text-xs text-red-500 hover:text-red-700 bg-white/90 px-3 py-1.5 rounded-lg font-bold border border-red-100"
                            >
                                {t("Clear")}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex flex-wrap gap-2">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={handlePreview} 
                                className="flex items-center gap-2 h-12"
                            >
                                <Eye size={16}/> {t("Preview")}
                            </Button>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={handlePrint} 
                                className="flex items-center gap-2 h-12"
                            >
                                <Printer size={16}/> {t("Print")}
                            </Button>
                            {job.customerEmail && (
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={handleSendEmail} 
                                    disabled={isSending}
                                    className="flex items-center gap-2 h-12"
                                >
                                    <Send size={16}/> {isSending ? t("Sending...") : t("Send Email")}
                                </Button>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={onClose} 
                                className="h-12 px-6"
                            >
                                {t("Cancel")}
                            </Button>
                            <Button 
                                type="button" 
                                onClick={handleSave} 
                                className="bg-emerald-600 hover:bg-emerald-700 shadow-lg px-8 h-12 flex items-center gap-2 font-bold"
                            >
                                <Check size={16}/> {t("Sign & Save")}
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {isPreviewOpen && (
                <DocumentPreview 
                    type="Other" 
                    data={{
                        id: `preview-${job.id}`,
                        title: t("Job Sign-Off Sheet"),
                        htmlContent: previewHtml,
                        createdAt: new Date().toISOString()
                    } as any}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </>
    );
};

export default SignOffModal;
