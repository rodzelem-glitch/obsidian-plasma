import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import { BusinessDocument, User, InspectionTemplate } from 'types';
import { FileText, CheckCircle, CheckSquare, Camera, Download, Upload, ExternalLink, ShieldCheck } from 'lucide-react';
import DOMPurify from 'dompurify';
import SignaturePad from 'components/ui/SignaturePad';
import { notifyAdmins } from 'lib/notificationService';
import { uploadFileToStorage } from 'lib/storageService';
import { useLanguage } from 'context/LanguageContext';

const FEDERAL_FORMS = [
    {
        id: 'federal-w4',
        name: 'IRS Form W-4',
        description: 'Employee\'s Withholding Certificate — required for federal tax withholding.',
        url: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf',
        source: 'IRS'
    },
    {
        id: 'federal-i9',
        name: 'USCIS Form I-9',
        description: 'Employment Eligibility Verification — required for all new hires.',
        url: 'https://www.uscis.gov/sites/default/files/document/forms/i-9-paper-version.pdf',
        source: 'USCIS'
    }
];

interface HiringPacketViewProps {
    employee: User;
    isSelf: boolean;
}

const HiringPacketView: React.FC<HiringPacketViewProps> = ({ employee, isSelf }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    
    const packets = useMemo(() => 
        state.documents.filter(d => d.type === 'Hiring Packet'),
    [state.documents]);
    
    const hiringForms = useMemo(() => 
        state.inspectionTemplates.filter(t => t.isHiringPacket),
    [state.inspectionTemplates]);
    
    const [viewDoc, setViewDoc] = useState<BusinessDocument | null>(null);
    const [viewForm, setViewForm] = useState<InspectionTemplate | null>(null);
    const [signatureName, setSignatureName] = useState('');
    const [formResponses, setFormResponses] = useState<Record<string, string>>({});
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    const [uploadingFederalId, setUploadingFederalId] = useState<string | null>(null);

    const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !employee) return;
        
        if (file.size > 10 * 1024 * 1024) {
            showToast.warn(t("Image must be less than 10MB"));
            return;
        }

        setUploadingItemId(itemId);
        try {
            const timestamp = Date.now();
            const ext = file.name.split('.').pop();
            const path = `organizations/${employee.organizationId}/users/${employee.id}/forms/${viewForm?.id}/${itemId}-${timestamp}.${ext}`;
            
            const url = await uploadFileToStorage(path, file);
            setFormResponses(prev => ({...prev, [itemId]: url}));
            showToast.success(t("Photo uploaded successfully"));
        } catch (error) {
            console.error("Failed to upload photo:", error);
            showToast.error(t("Failed to upload photo"));
        } finally {
            setUploadingItemId(null);
        }
    };

    const handleFederalFormUpload = async (formId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !employee) return;

        if (file.size > 25 * 1024 * 1024) {
            showToast.warn(t('File must be less than 25MB'));
            return;
        }

        setUploadingFederalId(formId);
        try {
            const timestamp = Date.now();
            const ext = file.name.split('.').pop();
            const path = `organizations/${employee.organizationId}/users/${employee.id}/federal-forms/${formId}-${timestamp}.${ext}`;
            const url = await uploadFileToStorage(path, file);

            const updatedFormSubmissions = {
                ...(employee.formSubmissions || {}),
                [formId]: {
                    timestamp: new Date().toISOString(),
                    fileUrl: url,
                    fileName: file.name
                }
            };

            await db.collection('users').doc(employee.id).update({ formSubmissions: updatedFormSubmissions });
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...employee, formSubmissions: updatedFormSubmissions } });

            if (state.currentOrganization?.id) {
                const formName = FEDERAL_FORMS.find(f => f.id === formId)?.name || formId;
                notifyAdmins(state.currentOrganization.id, {
                    title: 'Federal Form Uploaded',
                    body: `${employee.firstName} ${employee.lastName} uploaded their completed ${formName}`,
                    type: 'hiring_packet'
                });
            }

            showToast.success(t('Form uploaded successfully!'));
        } catch (error) {
            console.error('Failed to upload federal form:', error);
            showToast.error(t('Failed to upload form.'));
        } finally {
            setUploadingFederalId(null);
        }
    };

    const handleSign = async (docId: string) => {
        if (!employee || !signatureName) return;
        const timestamp = new Date().toISOString();
        
        const updatedSignedPolicies = {
            ...(employee.signedPolicies || {}),
            [docId]: timestamp
        };

        const updatedPolicySignatures = {
            ...(employee.policySignatures || {}),
            [docId]: signatureName
        };

        try {
            await db.collection('users').doc(employee.id).update({ 
                signedPolicies: updatedSignedPolicies,
                policySignatures: updatedPolicySignatures
            });

            dispatch({ 
                type: 'UPDATE_EMPLOYEE', 
                payload: { ...employee, signedPolicies: updatedSignedPolicies, policySignatures: updatedPolicySignatures } 
            });

            if (state.currentOrganization?.id) {
                notifyAdmins(state.currentOrganization.id, {
                    title: 'Hiring Packet Signed',
                    body: `${employee.firstName} ${employee.lastName} has signed a hiring packet: ${viewDoc?.title}`,
                    type: 'hiring_packet'
                });
            }
            
            showToast.success(t('Packet Acknowledged.'));
            setViewDoc(null);
            setSignatureName('');
        } catch {
            showToast.warn(t("Failed to save signature."));
        }
    };

    const handleSaveForm = async (formId: string) => {
        if (!employee) return;
        
        // Basic validation - check required fields
        if (viewForm) {
            for (const item of viewForm.items) {
                if (item.required && !formResponses[item.id]) {
                    showToast.warn(t("Please complete required field:") + " " + t(item.label));
                    return;
                }
            }
        }
        
        const timestamp = new Date().toISOString();
        
        const updatedFormSubmissions = {
            ...(employee.formSubmissions || {}),
            [formId]: {
                timestamp,
                responses: formResponses
            }
        };

        try {
            await db.collection('users').doc(employee.id).update({ 
                formSubmissions: updatedFormSubmissions
            });

            dispatch({ 
                type: 'UPDATE_EMPLOYEE', 
                payload: { ...employee, formSubmissions: updatedFormSubmissions } 
            });

            if (state.currentOrganization?.id) {
                notifyAdmins(state.currentOrganization.id, {
                    title: 'Hiring Form Submitted',
                    body: `${employee.firstName} ${employee.lastName} has submitted a hiring form: ${viewForm?.name}`,
                    type: 'hiring_packet'
                });
            }
            
            showToast.success(t('Form Submitted Successfully.'));
            setViewForm(null);
        } catch {
            showToast.warn(t("Failed to save form submission."));
        }
    };

    return (
        <div className="space-y-6">
            {viewDoc && (
                <Modal isOpen={true} onClose={() => setViewDoc(null)} title={viewDoc.title}>
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
                            {viewDoc.context ? (
                                <div className="text-center">
                                    <p className="mb-4">{t("This document is a file upload.")}</p>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); import('lib/downloadHelper').then(m => m.downloadFile(viewDoc.context!, viewDoc.title)); }} 
                                        className="text-blue-600 hover:underline font-bold"
                                    >
                                        {t("Open/Download to Read")}
                                    </button>
                                </div>
                            ) : (
                                <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(viewDoc.content)}} />
                            )}
                        </div>
                        
                        {!employee?.signedPolicies?.[viewDoc.id] && isSelf && (
                            <div className="border-t pt-4">
                                <p className="text-sm font-bold mb-2">{t("I have read and agree to this document.")}</p>
                                <div className="flex flex-col gap-4">
                                    <SignaturePad onEnd={(dataUrl) => setSignatureName(dataUrl)} />
                                    <Button type="button" onClick={() => handleSign(viewDoc.id)} disabled={!signatureName}>{t("Sign & Accept")}</Button>
                                </div>
                            </div>
                        )}
                        {!employee?.signedPolicies?.[viewDoc.id] && !isSelf && (
                            <div className="border-t pt-4">
                                <p className="text-red-600 font-bold flex items-center gap-2">{t("Employee has not signed this document yet.")}</p>
                            </div>
                        )}
                        {employee?.signedPolicies?.[viewDoc.id] && (
                            <div className="space-y-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <CheckCircle size={20} />
                                    <span>{t("Signed on")} {new Date(employee.signedPolicies[viewDoc.id]).toLocaleDateString()}</span>
                                </div>
                                {employee?.policySignatures?.[viewDoc.id] && (
                                    <div className="p-4 border rounded bg-white">
                                        <p className="text-xs text-slate-500 mb-2">{t("Signature:")}</p>
                                        <img src={employee.policySignatures[viewDoc.id]} alt="Signature" className="h-20" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {viewForm && (
                <Modal isOpen={true} onClose={() => setViewForm(null)} title={viewForm.name}>
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto space-y-4">
                            {viewForm.items?.map((item, idx) => (
                                <div key={item.id} className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {idx + 1}. {t(item.label)} {item.required && <span className="text-red-500">*</span>}
                                    </label>
                                    
                                    {item.type === 'Text' && (
                                        <Input 
                                            value={formResponses[item.id] || ''}
                                            onChange={e => setFormResponses(prev => ({...prev, [item.id]: e.target.value}))}
                                            placeholder={t("Enter answer...")}
                                            disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                        />
                                    )}
                                    {item.type === 'Textarea' && (
                                        <Textarea 
                                            value={formResponses[item.id] || ''}
                                            onChange={e => setFormResponses(prev => ({...prev, [item.id]: e.target.value}))}
                                            placeholder={t("Enter detailed answer...")}
                                            rows={3}
                                            disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                        />
                                    )}
                                    {item.type === 'PassFail' && (
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    name={`pf-${item.id}`} 
                                                    checked={formResponses[item.id] === 'Pass'}
                                                    onChange={() => setFormResponses(prev => ({...prev, [item.id]: 'Pass'}))}
                                                    disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                    className="text-primary-500 focus:ring-primary-500"
                                                /> {t("Yes/Pass")}
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    name={`pf-${item.id}`} 
                                                    checked={formResponses[item.id] === 'Fail'}
                                                    onChange={() => setFormResponses(prev => ({...prev, [item.id]: 'Fail'}))}
                                                    disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                    className="text-primary-500 focus:ring-primary-500"
                                                /> {t("No/Fail")}
                                            </label>
                                        </div>
                                    )}
                                    {item.type === 'Photo' && (
                                        <div className="text-sm text-slate-500 border border-dashed border-slate-300 p-4 text-center rounded relative overflow-hidden group">
                                            {formResponses[item.id] ? (
                                                <div className="relative inline-block">
                                                    <img src={formResponses[item.id]} alt="Uploaded" className="max-h-32 mx-auto rounded" />
                                                    {!employee?.formSubmissions?.[viewForm.id] && isSelf && (
                                                        <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded">
                                                            <span>{t("Change Photo")}</span>
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                className="hidden" 
                                                                onChange={(e) => handlePhotoUpload(item.id, e)} 
                                                                disabled={uploadingItemId === item.id}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className={`flex flex-col items-center gap-2 cursor-pointer ${(!isSelf || employee?.formSubmissions?.[viewForm.id]) ? 'pointer-events-none opacity-60' : 'hover:text-primary-600'}`}>
                                                    {uploadingItemId === item.id ? (
                                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
                                                    ) : (
                                                        <Camera size={24} className={(!isSelf || employee?.formSubmissions?.[viewForm.id]) ? 'text-slate-300' : 'text-slate-400'} />
                                                    )}
                                                    <p>{uploadingItemId === item.id ? t('Uploading...') : t('Click to upload photo')}</p>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        onChange={(e) => handlePhotoUpload(item.id, e)} 
                                                        disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf || uploadingItemId === item.id}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    )}
                                    {item.type === 'YesNo' && (
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    name={`yn-${item.id}`} 
                                                    checked={formResponses[item.id] === 'Yes'}
                                                    onChange={() => setFormResponses(prev => ({...prev, [item.id]: 'Yes'}))}
                                                    disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                    className="text-primary-500 focus:ring-primary-500"
                                                /> {t("Yes")}
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    name={`yn-${item.id}`} 
                                                    checked={formResponses[item.id] === 'No'}
                                                    onChange={() => setFormResponses(prev => ({...prev, [item.id]: 'No'}))}
                                                    disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                    className="text-primary-500 focus:ring-primary-500"
                                                /> {t("No")}
                                            </label>
                                        </div>
                                    )}
                                    {item.type === 'Checkbox' && (
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={formResponses[item.id] === 'true'}
                                                onChange={e => setFormResponses(prev => ({...prev, [item.id]: e.target.checked ? 'true' : 'false'}))}
                                                disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                className="rounded w-4 h-4 text-primary-500"
                                            />
                                            <span className="text-sm text-slate-600 dark:text-slate-300">{t("I confirm / agree")}</span>
                                        </label>
                                    )}
                                    {item.type === 'CheckboxGroup' && (
                                        <div className="space-y-2">
                                            {(item.options || []).map((opt, optIdx) => {
                                                const selectedOptions = formResponses[item.id] ? formResponses[item.id].split('|||') : [];
                                                const isChecked = selectedOptions.includes(opt);
                                                return (
                                                    <label key={optIdx} className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const updated = isChecked
                                                                    ? selectedOptions.filter(o => o !== opt)
                                                                    : [...selectedOptions, opt];
                                                                setFormResponses(prev => ({...prev, [item.id]: updated.filter(Boolean).join('|||')}));
                                                            }}
                                                            disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                                            className="rounded w-4 h-4 text-primary-500"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{t(opt)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {item.type === 'Date' && (
                                        <Input 
                                            type="date"
                                            value={formResponses[item.id] || ''}
                                            onChange={e => setFormResponses(prev => ({...prev, [item.id]: e.target.value}))}
                                            disabled={!!employee?.formSubmissions?.[viewForm.id] || !isSelf}
                                        />
                                    )}
                                    {item.type === 'Signature' && (
                                        <div>
                                            {formResponses[item.id] ? (
                                                <div className="border rounded p-3 bg-white dark:bg-slate-900">
                                                    <p className="text-xs text-slate-500 mb-1">{t("Signature:")}</p>
                                                    <img src={formResponses[item.id]} alt="Signature" className="h-20 mx-auto" />
                                                    {!employee?.formSubmissions?.[viewForm.id] && isSelf && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setFormResponses(prev => ({...prev, [item.id]: ''}))}
                                                            className="text-xs text-primary-600 hover:underline mt-2"
                                                        >{t("Re-sign")}</button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className={!isSelf || employee?.formSubmissions?.[viewForm.id] ? 'opacity-60 pointer-events-none' : ''}>
                                                    <SignaturePad onEnd={(dataUrl) => setFormResponses(prev => ({...prev, [item.id]: dataUrl}))} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {!employee?.formSubmissions?.[viewForm.id] && isSelf && (
                            <div className="border-t pt-4 flex justify-end">
                                <Button type="button" onClick={() => handleSaveForm(viewForm.id)}>{t("Submit Form")}</Button>
                            </div>
                        )}
                        {!employee?.formSubmissions?.[viewForm.id] && !isSelf && (
                            <div className="border-t pt-4">
                                <p className="text-red-600 font-bold flex items-center gap-2">{t("Employee has not submitted this form yet.")}</p>
                            </div>
                        )}
                        {employee?.formSubmissions?.[viewForm.id] && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle size={20} />
                                <span>{t("Submitted on")} {new Date(employee.formSubmissions[viewForm.id].timestamp).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Federal Forms Section */}
            <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-1"><ShieldCheck size={16}/> {t("Required Federal Forms")}</h4>
                <p className="text-[11px] text-slate-500 mb-4">{t("Download the official form, complete it, then upload the filled-out version.")}</p>
                <div className="flex flex-col gap-3">
                    {FEDERAL_FORMS.map(form => {
                        const submission = employee?.formSubmissions?.[form.id];
                        const isUploaded = !!submission;
                        return (
                            <div key={form.id} className={`p-4 rounded-lg ${isUploaded ? 'bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800/30' : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                                        <ShieldCheck className={isUploaded ? 'text-green-500 mt-0.5 shrink-0' : 'text-blue-500 mt-0.5 shrink-0'} size={20} />
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t(form.name)}</h4>
                                            <p className="text-[11px] text-slate-500 leading-snug">{t(form.description)}</p>
                                            {isUploaded && (
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <CheckCircle size={12} className="text-green-500" />
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                                        {t("Uploaded on")} {new Date(submission.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); import('lib/downloadHelper').then(m => m.downloadFile(form.url, form.name + '.pdf')); }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                                        >
                                            <Download size={13} /> {t("Download")}
                                        </button>
                                        {isSelf && (
                                            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                                                uploadingFederalId === form.id
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-wait'
                                                    : isUploaded
                                                        ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                            }`}>
                                                {uploadingFederalId === form.id ? (
                                                    <><div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" /> {t("Uploading...")}</>
                                                ) : isUploaded ? (
                                                    <><Upload size={13} /> {t("Re-upload")}</>
                                                ) : (
                                                    <><Upload size={13} /> {t("Upload Completed")}</>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="hidden"
                                                    onChange={(e) => handleFederalFormUpload(form.id, e)}
                                                    disabled={uploadingFederalId === form.id}
                                                />
                                            </label>
                                        )}
                                        {!isSelf && isUploaded && submission.fileUrl && (
                                            <a
                                                href={submission.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                                            >
                                                <ExternalLink size={13} /> {t("View Upload")}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Organization Hiring Packets */}
            <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-4"><FileText size={16}/> {t("Organization Hiring Packets")}</h4>
                <div className="flex flex-col gap-3">
                    {packets.map(doc => {
                        const isSigned = !!employee?.signedPolicies?.[doc.id];
                        return (
                            <div key={doc.id} className={`p-4 rounded-lg flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between sm:items-center ${isSigned ? 'bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800/30' : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                <div className="flex items-center gap-3 w-full">
                                    <FileText className={isSigned ? "text-green-500 shrink-0" : "text-slate-400 shrink-0"} size={20} />
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{doc.title}</h4>
                                        <p className="text-[10px] text-slate-500">{t("Updated:")} {new Date(doc.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <Button type="button" onClick={() => setViewDoc(doc)} variant="secondary" className="text-xs w-full sm:w-auto shrink-0" size="sm">
                                    {isSigned ? t('View') : (isSelf ? t('Read & Sign') : t('View Document'))}
                                </Button>
                            </div>
                        );
                    })}
                    {packets.length === 0 && <p className="text-slate-500 text-xs italic py-2">{t("No hiring packets assigned.")}</p>}
                </div>
            </div>

            {hiringForms.length > 0 && (
                <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-4"><CheckSquare size={16}/> {t("Hiring Forms & Questionnaires")}</h4>
                    <div className="flex flex-col gap-3">
                        {hiringForms.map(form => {
                            const isSubmitted = !!employee?.formSubmissions?.[form.id];
                            return (
                                <div key={form.id} className={`p-4 rounded-lg flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between sm:items-center ${isSubmitted ? 'bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800/30' : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        <CheckSquare className={isSubmitted ? "text-green-500 shrink-0" : "text-slate-400 shrink-0"} size={20} />
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{form.name}</h4>
                                            <p className="text-[10px] text-slate-500">{t("Items:")} {form.items?.length || 0}</p>
                                        </div>
                                    </div>
                                    <Button type="button" onClick={() => {
                                        if (isSubmitted) {
                                            setFormResponses(employee.formSubmissions![form.id].responses || {});
                                        } else {
                                            setFormResponses({});
                                        }
                                        setViewForm(form);
                                    }} variant="secondary" className="text-xs w-full sm:w-auto shrink-0" size="sm">
                                        {isSubmitted ? t('View Submission') : (isSelf ? t('Fill Out Form') : t('View Form'))}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HiringPacketView;
