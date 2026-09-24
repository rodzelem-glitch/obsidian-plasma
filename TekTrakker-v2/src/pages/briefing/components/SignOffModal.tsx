import { cleanUndefinedFields } from '../../../lib/utils';
import showToast from "lib/toast";
import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from '../../../lib/firebase';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import SignaturePad, { SignaturePadHandle } from '../../../components/ui/SignaturePad';
import { StoredFile, Job } from '../../../types';
import { Eye, Printer, Send, Check, Upload, PenTool, ImageIcon, X, FileText, Trash2, RotateCcw, Download } from 'lucide-react';
import DocumentPreview from '../../../components/ui/DocumentPreview';
import { uploadFileToStorage } from 'lib/storageService';
import { globalConfirm } from 'lib/globalConfirm';
import { downloadStandaloneSignOffPdf } from 'lib/pdfHelper';

interface SignOffModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    onSave: (signOffFile: StoredFile, updatedJobFields?: Partial<Job>) => void;
}

const SignOffModal: React.FC<SignOffModalProps> = ({ isOpen, onClose, job, onSave }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const sigCanvas = useRef<SignaturePadHandle>(null);

    const existingSig = job.customerSignature || job.signature || (job as any).workflowState?.customerSignature || (job as any).workflowState?.siteManagerSignature || null;
    const existingSignerName = job.customerSignatureName || job.signerName || (job as any).workflowState?.customerSignatureName || (job as any).workflowState?.siteManagerName || job.customerName || '';

    const [managerName, setManagerName] = useState(() => existingSignerName);
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
    const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>(() => existingSig ? 'upload' : 'draw');
    const [uploadedSignatureDataUrl, setUploadedSignatureDataUrl] = useState<string | null>(() => existingSig);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(() => existingSig ? 'Captured_Customer_Signature.png' : null);
    const [uploadedFileType, setUploadedFileType] = useState<string | null>(() => existingSig ? 'image/png' : null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    useEffect(() => {
        if (isOpen) {
            const currentSig = job.customerSignature || job.signature || (job as any).workflowState?.customerSignature || (job as any).workflowState?.siteManagerSignature || null;
            const currentSigner = job.customerSignatureName || job.signerName || (job as any).workflowState?.customerSignatureName || (job as any).workflowState?.siteManagerName || job.customerName || '';
            setManagerName(currentSigner);
            setVisitDate(new Date().toISOString().split('T')[0]);
            const now = new Date();
            setVisitTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
            setScopeOfWork(job.tasks?.join('\n') || '');
            setWorkCompleted(job.notes?.workNotes || job.notes?.work || '');
            setJobNo(job.poNumber || job.id || '');
            setTechName(job.assignedTechnicianName || '');
            setAdditionalNotes('');
            setSignatureMode(currentSig ? 'upload' : 'draw');
            setUploadedSignatureDataUrl(currentSig);
            setUploadedFileName(currentSig ? 'Captured_Customer_Signature.png' : null);
            setUploadedFileType(currentSig ? 'image/png' : null);
            sigCanvas.current?.clear();
        }
    }, [isOpen, job.id, job.customerSignature, job.customerSignatureName, job.signature, job.signerName]);

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
                                ${signatureDataUrl ? (
                                    (signatureDataUrl.startsWith('data:application/pdf') || uploadedFileType === 'application/pdf')
                                        ? `<div style="text-align: center; color: #2563eb; font-weight: bold; font-size: 13px;">📄 Signed PDF Document Attached<br/><span style="font-size: 11px; color: #64748b;">${uploadedFileName || 'Signed_SignOff_Sheet.pdf'}</span></div>`
                                        : `<img src="${signatureDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Signature" />`
                                ) : `<div style="color: #9ca3af; font-size: 12px; font-style: italic;">No signature provided</div>`}
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
        setUploadedSignatureDataUrl(null);
        setUploadedFileName(null);
        setUploadedFileType(null);
    };

    const handleResetAllSignatures = () => {
        sigCanvas.current?.clear();
        setUploadedSignatureDataUrl(null);
        setUploadedFileName(null);
        setUploadedFileType(null);
        if (uploadInputRef.current) uploadInputRef.current.value = '';
    };

    const handleClearExistingSignOff = async () => {
        if (!await globalConfirm(
            t("Are you sure you want to clear this sign-off sheet and reset all signatures for this job?"),
            t("Clear Sign-Off"),
            t("Clear"),
            t("Cancel")
        )) return;

        handleResetAllSignatures();
        setManagerName('');

        const existingFiles = (job.files || []).filter((f: any) => {
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
            files: existingFiles,
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

        if (!state.isDemoMode && job.id) {
            try {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            } catch (e) {
                console.error("Failed to clear sign-off in DB:", e);
            }
        }
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
        showToast.success(t("Sign-off and signatures cleared."));
        onClose();
    };

    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(file.name);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        
        if (!isImage && !isPdf) {
            showToast.warn(t("Please upload an image file (JPG, PNG) or PDF document."));
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            showToast.warn(t("File is too large. Please upload a file under 25 MB."));
            return;
        }
        setUploadedFileName(file.name);
        setUploadedFileType(isPdf ? 'application/pdf' : (file.type || 'image/jpeg'));
        
        const reader = new FileReader();
        reader.onload = () => {
            setUploadedSignatureDataUrl(reader.result as string);
        };
        reader.onerror = () => {
            showToast.warn(t("Failed to read selected file."));
        };
        reader.readAsDataURL(file);
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    const handleClearUpload = () => {
        setUploadedSignatureDataUrl(null);
        setUploadedFileName(null);
        setUploadedFileType(null);
        if (uploadInputRef.current) uploadInputRef.current.value = '';
    };

    const getSignatureDataUrl = () => {
        if (signatureMode === 'upload' && uploadedSignatureDataUrl) {
            return uploadedSignatureDataUrl;
        }
        if (signatureMode === 'draw' && sigCanvas.current && !sigCanvas.current.isEmpty()) {
            return sigCanvas.current.toDataURL();
        }
        return '';
    };

    const handlePreview = () => {
        const signature = getSignatureDataUrl();
        const html = generateHtmlContent(signature);
        setPreviewHtml(html);
        setIsPreviewOpen(true);
    };

    const handlePrint = () => {
        const signature = getSignatureDataUrl();
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
        const hasSignature = signatureMode === 'upload' 
            ? !!uploadedSignatureDataUrl 
            : (sigCanvas.current && !sigCanvas.current.isEmpty());
        if (!hasSignature) {
            showToast.warn(t("Please provide a signature before emailing."));
            return;
        }

        setIsSending(true);
        try {
            const signature = getSignatureDataUrl();
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

    const [isExceptionMode, setIsExceptionMode] = useState(false);
    const [exceptionReason, setExceptionReason] = useState<'Customer Not Present' | 'Unattended Property' | 'Commercial Work Order' | 'Remote PM Approval' | 'Customer Declined' | 'Remote Approval Documented'>('Customer Not Present');
    const [customerPresenceStatus, setCustomerPresenceStatus] = useState<'Not Present' | 'Present - Declined' | 'Property Unattended' | 'Authorized Representative'>('Not Present');
    const [approvalMethod, setApprovalMethod] = useState('Remote Work Order Approval');
    const [exceptionNotes, setExceptionNotes] = useState('');

    const handleSave = async () => {
        if (!isExceptionMode) {
            if (!managerName) {
                showToast.warn(t("Please enter the Manager on duty name."));
                return;
            }
            const hasSignature = signatureMode === 'upload'
                ? !!uploadedSignatureDataUrl
                : (sigCanvas.current && !sigCanvas.current.isEmpty());
            if (!hasSignature) {
                showToast.warn(t("Please provide a signature or enable a Customer Sign-off Exception."));
                return;
            }
        } else {
            if (!exceptionReason) {
                showToast.warn(t("Please select a reason no signature was obtained."));
                return;
            }
        }

        const isUploadedPdf = signatureMode === 'upload' && (uploadedFileType === 'application/pdf' || uploadedSignatureDataUrl?.startsWith('data:application/pdf'));
        const rawSignature = (!isExceptionMode && !isUploadedPdf) ? getSignatureDataUrl() : '';

        try {
            const orgId = job.organizationId || state.currentOrganization?.id || 'default';

            // 1. If an image signature is present (drawn or uploaded), upload to Firebase Storage to prevent Firestore 1MB document overflow
            let finalSignatureUrl = rawSignature;
            if (rawSignature && rawSignature.startsWith('data:image')) {
                try {
                    const safeSigName = uploadedFileName ? uploadedFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_') : `Customer_Signature_${Date.now()}.png`;
                    const sigPath = `organizations/${orgId}/jobs/${job.id}/signatures/${Date.now()}_${safeSigName}`;
                    const storageSigUrl = await uploadFileToStorage(sigPath, rawSignature);
                    if (storageSigUrl) {
                        finalSignatureUrl = storageSigUrl;
                    }
                } catch (stErr) {
                    console.warn("Storage upload for customer signature fallback:", stErr);
                }
            }

            // 2. Generate HTML sign-off content with the persistent signature URL
            const html = generateHtmlContent(finalSignatureUrl);

            let finalDataUrl = isUploadedPdf 
                ? uploadedSignatureDataUrl! 
                : ('data:text/html;base64,' + btoa(unescape(encodeURIComponent(html))));

            // 3. Persist the sign-off document (PDF or HTML) to Firebase Storage
            if (isUploadedPdf && uploadedSignatureDataUrl?.startsWith('data:application/pdf')) {
                try {
                    const safeName = uploadedFileName ? uploadedFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_') : `SignOff_${Date.now()}.pdf`;
                    const path = `organizations/${orgId}/jobs/${job.id}/signoff/${Date.now()}_${safeName}`;
                    const storageUrl = await uploadFileToStorage(path, uploadedSignatureDataUrl);
                    if (storageUrl) {
                        finalDataUrl = storageUrl;
                    }
                } catch (stErr) {
                    console.warn("Storage upload for sign-off PDF fallback:", stErr);
                }
            } else if (!isUploadedPdf && finalDataUrl.startsWith('data:text/html')) {
                try {
                    const safeName = isExceptionMode ? `SignOff_Exception_${Date.now()}.html` : `SignOff_${Date.now()}.html`;
                    const path = `organizations/${orgId}/jobs/${job.id}/signoff/${Date.now()}_${safeName}`;
                    const storageUrl = await uploadFileToStorage(path, finalDataUrl);
                    if (storageUrl) {
                        finalDataUrl = storageUrl;
                    }
                } catch (stErr) {
                    console.warn("Storage upload for sign-off HTML fallback:", stErr);
                }
            }

            const signOffFile: StoredFile = {
                id: `signoff-doc-${Date.now()}`,
                organizationId: job.organizationId,
                parentId: job.id,
                parentType: 'job',
                fileName: isUploadedPdf ? (uploadedFileName || 'SignOff_Sheet.pdf') : (isExceptionMode ? 'SignOff_Exception_Sheet.html' : 'SignOff_Sheet.html'),
                fileType: isUploadedPdf ? 'application/pdf' : 'text/html',
                dataUrl: finalDataUrl,
                url: finalDataUrl,
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'tech',
                label: isExceptionMode ? 'Sign-Off Exception Sheet' : 'Sign-Off Sheet',
                metadata: { 
                    label: isExceptionMode ? 'Sign-Off Exception Sheet' : 'Sign-Off Sheet',
                    category: 'signoff',
                    phase: 'signoff',
                    isException: isExceptionMode,
                    exceptionReason: isExceptionMode ? exceptionReason : null,
                    customerPresenceStatus: isExceptionMode ? customerPresenceStatus : null,
                    approvalMethod: isExceptionMode ? approvalMethod : null,
                    technicianName: techName,
                    managerName: managerName || null,
                    dateOfService: visitDate,
                    timestamp: new Date().toISOString()
                }
            };

            const sheetUrl = finalDataUrl;
            const signOffData = {
                managerName: managerName || null,
                technicianName: techName || null,
                dateOfService: visitDate,
                timestamp: new Date().toISOString(),
                sheetUrl: sheetUrl,
                status: 'COMPLETED'
            };

            const signatureFile: StoredFile | null = (finalSignatureUrl && !isUploadedPdf) ? {
                id: `sig-doc-${Date.now()}`,
                organizationId: job.organizationId,
                parentId: job.id,
                parentType: 'job',
                fileName: 'Customer_Signature.png',
                fileType: 'image/png',
                dataUrl: finalSignatureUrl,
                url: finalSignatureUrl,
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'tech',
                label: 'Customer Sign-Off Signature',
                metadata: { 
                    category: 'signature',
                    phase: 'signoff',
                    signerName: managerName || null,
                    timestamp: new Date().toISOString()
                }
            } : null;

            const existingFiles = (job.files || []).filter((f: any) => f.id !== signOffFile.id && (!signatureFile || f.id !== signatureFile.id));
            const updatedFiles = [...existingFiles, signOffFile, ...(signatureFile ? [signatureFile] : [])];

            const updatedJobFields = {
                files: updatedFiles,
                signOffSheetUrl: sheetUrl,
                signoffSheetUrl: sheetUrl,
                customWorkOrderFormUrl: sheetUrl,
                signOff: signOffData,
                signOffSignature: sheetUrl || 'SIGNED_ON_FILE',
                customerSignature: finalSignatureUrl || job.customerSignature || null,
                signature: finalSignatureUrl || job.signature || null,
                customerSignatureName: managerName || job.customerSignatureName || null,
                signerName: managerName || job.signerName || null,
                signatureTimestamp: new Date().toISOString(),
                signedAt: new Date().toISOString(),
                jobRecordSignedOff: true,
                jobRecordSignedOffAt: new Date().toISOString(),
                jobRecordSignedOffBy: techName || state.currentUser?.name || state.currentUser?.firstName || 'Technician',
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode && job.id) {
                try {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updatedJobFields));
                } catch (dbErr) {
                    console.warn("Direct Firestore signoff write warning:", dbErr);
                }
            }

            onSave(signOffFile, updatedJobFields);
            showToast.success(isExceptionMode ? t("Sign-off exception sheet saved!") : t("Sign-off sheet saved successfully!"));
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
                    <p className="text-sm text-slate-500">{t("Verify details, fill out manager on duty name, and sign below or select a sign-off exception.")}</p>

                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">{t("Customer Sign-off Exception Override")}</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400">{t("Enable if customer signature cannot be physically obtained on site.")}</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <input 
                                type="checkbox"
                                checked={isExceptionMode}
                                onChange={e => setIsExceptionMode(e.target.checked)}
                                className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">{t("Enable Exception")}</span>
                        </label>
                    </div>

                    {isExceptionMode && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">{t("Sign-off Exception Documentation")}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Reason No Signature Obtained")}</label>
                                    <select
                                        value={exceptionReason}
                                        onChange={e => setExceptionReason(e.target.value as any)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    >
                                        <option value="Customer Not Present">{t("Customer Not Present")}</option>
                                        <option value="Unattended Property">{t("Unattended Property")}</option>
                                        <option value="Commercial Work Order">{t("Commercial Work Order")}</option>
                                        <option value="Remote PM Approval">{t("Remote PM Approval")}</option>
                                        <option value="Customer Declined">{t("Customer Declined")}</option>
                                        <option value="Remote Approval Documented">{t("Remote Approval Documented")}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Customer Presence Status")}</label>
                                    <select
                                        value={customerPresenceStatus}
                                        onChange={e => setCustomerPresenceStatus(e.target.value as any)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    >
                                        <option value="Not Present">{t("Not Present")}</option>
                                        <option value="Present - Declined">{t("Present - Declined")}</option>
                                        <option value="Property Unattended">{t("Property Unattended")}</option>
                                        <option value="Authorized Representative">{t("Authorized Representative")}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Approval Method")}</label>
                                    <input 
                                        type="text"
                                        value={approvalMethod}
                                        onChange={e => setApprovalMethod(e.target.value)}
                                        placeholder={t("e.g. Email approval from PM, Verbal phone auth")}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Technician Name")}</label>
                                    <input 
                                        type="text"
                                        value={techName}
                                        onChange={e => setTechName(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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

                        {!isExceptionMode ? (
                            <>
                                {/* Toggle: Draw vs Upload */}
                                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setSignatureMode('draw')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none ${
                                            signatureMode === 'draw'
                                                ? 'bg-primary-600 text-white'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <PenTool size={14} /> {t("Draw Signature")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSignatureMode('upload')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none ${
                                            signatureMode === 'upload'
                                                ? 'bg-primary-600 text-white'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <Upload size={14} /> {t("Upload Paper Signature / PDF")}
                                    </button>
                                </div>

                                {signatureMode === 'draw' ? (
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white relative">
                                        <div className="absolute top-2 left-3 text-[10px] font-bold text-slate-400 uppercase pointer-events-none z-10">{t("Signature Pad")}</div>
                                        <SignaturePad 
                                            ref={sigCanvas}
                                            className="border-none"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleClear} 
                                            className="absolute bottom-2 right-3 text-xs text-red-500 hover:text-red-700 bg-white/90 px-3 py-1.5 rounded-lg font-bold border border-red-100 z-10"
                                        >
                                            {t("Clear")}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                        {uploadedSignatureDataUrl ? (
                                            <div className="relative p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                        {uploadedFileType === 'application/pdf' || uploadedSignatureDataUrl.startsWith('data:application/pdf') ? (
                                                            <FileText size={14} />
                                                        ) : (
                                                            <ImageIcon size={14} />
                                                        )}
                                                        <span className="text-xs font-bold uppercase tracking-wider">
                                                            {uploadedFileType === 'application/pdf' || uploadedSignatureDataUrl.startsWith('data:application/pdf')
                                                                ? t("Uploaded Sign-Off PDF")
                                                                : t("Uploaded Signature")}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleClearUpload}
                                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 px-2.5 py-1.5 rounded-lg font-bold border border-red-200 dark:border-red-900 transition-colors cursor-pointer"
                                                    >
                                                        <X size={12} /> {t("Remove")}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700" style={{ minHeight: '120px' }}>
                                                    {uploadedFileType === 'application/pdf' || uploadedSignatureDataUrl.startsWith('data:application/pdf') ? (
                                                        <div className="w-full space-y-3">
                                                            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                <div className="p-2 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg shrink-0">
                                                                    <FileText size={22} />
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{uploadedFileName || "Signed_SignOff_Sheet.pdf"}</p>
                                                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">✓ PDF Attached & Verified</p>
                                                                </div>
                                                            </div>
                                                            <iframe 
                                                                src={uploadedSignatureDataUrl} 
                                                                className="w-full h-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white" 
                                                                title={t("PDF Preview")}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <img 
                                                            src={uploadedSignatureDataUrl} 
                                                            alt={t("Uploaded signature")} 
                                                            className="max-w-full max-h-40 object-contain rounded" 
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <label 
                                                htmlFor="signature-upload-input"
                                                className="flex flex-col items-center justify-center gap-3 p-8 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center">
                                                    <Upload size={24} className="text-primary-500" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t("Upload photo or signed PDF sign-off sheet")}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{t("Tap to take photo or choose file. JPG, PNG, PDF accepted.")}</p>
                                                </div>
                                            </label>
                                        )}
                                        <input
                                            ref={uploadInputRef}
                                            id="signature-upload-input"
                                            type="file"
                                            accept="image/*,application/pdf,.pdf"
                                            onChange={handleSignatureUpload}
                                            className="hidden"
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-dashed border-amber-300 rounded-xl text-center text-xs text-amber-800 dark:text-amber-300">
                                ℹ️ {t("Signature bypassed under exception override: ")} <strong>{exceptionReason}</strong>
                            </div>
                        )}
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
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => downloadStandaloneSignOffPdf(job, state.currentOrganization)} 
                                className="flex items-center gap-2 h-12 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900/50"
                            >
                                <Download size={16}/> {t("Download PDF")}
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
                            {(existingSig || job.signOff || job.signOffSheetUrl) && (
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={handleClearExistingSignOff} 
                                    className="flex items-center gap-2 h-12 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50"
                                >
                                    <Trash2 size={16}/> {t("Clear Sign-Off")}
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
