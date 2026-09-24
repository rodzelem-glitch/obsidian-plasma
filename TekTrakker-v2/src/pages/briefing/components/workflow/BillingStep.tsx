import showToast from "lib/toast";
import React from 'react';
import { FilePlus, Import, Send, ClipboardCheck, Trash2, Eye, Plus, ShieldCheck, AlertCircle } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import { StoredFile } from 'types';

interface BillingStepProps {
    handleGoToPayments: () => void;
    onCreateSecondaryInvoice?: () => void;
    onOpenInvoiceSelector: () => void;
    onOpenSignOff: () => void;
    existingInvoiceId?: string;
    files: StoredFile[];
    onPreviewFile: (file: StoredFile) => void;
    onDeleteFile: (fileId: string) => void;
    onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    isSubcontractor?: boolean;
    onOpenSubBill?: () => void;
    onOpenJobRecordReview?: () => void;
    isJobRecordSignedOff?: boolean;
    jobRecordSignedOffBy?: string;
    jobRecordSignedOffAt?: string;
    membershipOffered?: boolean;
    setMembershipOffered?: (val: boolean) => void;
}

const BillingStep: React.FC<BillingStepProps> = ({
    handleGoToPayments,
    onCreateSecondaryInvoice,
    onOpenInvoiceSelector,
    onOpenSignOff,
    existingInvoiceId,
    files,
    onPreviewFile,
    onDeleteFile,
    onUploadFile,
    isSubcontractor = false,
    onOpenSubBill,
    onOpenJobRecordReview,
    isJobRecordSignedOff = false,
    jobRecordSignedOffBy,
    jobRecordSignedOffAt,
    membershipOffered,
    setMembershipOffered
}) => {
    const { t } = useLanguage();

    const signOffFiles = files.filter(f => {
        const fAny = f as any;
        const metaLabel = String(f.metadata?.label || '');
        const metaCategory = String(f.metadata?.category || '');
        const fileLabel = String(f.label || '');
        const fileName = String(f.fileName || '');

        return (
            fileName === 'SignOff_Sheet.html' || 
            fileName.toLowerCase().includes('signoff') ||
            fileName.toLowerCase().includes('sign-off') ||
            fileName.toLowerCase().includes('sign_off') ||
            metaLabel === 'Sign-Off Sheet' ||
            metaLabel.toLowerCase().includes('sign-off') ||
            metaLabel.toLowerCase().includes('signoff') ||
            fileLabel.toLowerCase().includes('sign-off') ||
            fileLabel.toLowerCase().includes('signoff') ||
            f.id?.startsWith('signoff-doc') ||
            fAny.category === 'signoff' ||
            metaCategory === 'signoff'
        );
    });

    const subInvoiceFiles = files.filter(f => 
        f.metadata?.label === 'Subcontractor Invoice'
    );

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-black text-center mb-4">
                {isSubcontractor ? t("Subcontractor Billing & Sign Off") : t("Finalize Billing & Tech Sign Off")}
            </h3>
            
            {/* Tech Job Record Review & Mandatory Sign-Off Card */}
            <div className={`p-5 rounded-2xl border-2 transition-all text-left shadow-sm ${
                isJobRecordSignedOff 
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500' 
                    : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-500'
            }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {isJobRecordSignedOff ? (
                                <ShieldCheck className="text-emerald-600 dark:text-emerald-400 shrink-0" size={24} />
                            ) : (
                                <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" size={24} />
                            )}
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                                {t("Job Record Review & Sign-Off")}
                            </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                            {isJobRecordSignedOff ? (
                                `${t("Job record verified and signed off by")} ${jobRecordSignedOffBy || t("Technician")} ${jobRecordSignedOffAt ? `${t("on")} ${new Date(jobRecordSignedOffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.`
                            ) : (
                                t("Mandatory step: Review all notes, tool readings, parts, and quality checks to certify the complete job record before closing.")
                            )}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenJobRecordReview}
                        className={`w-full sm:w-auto px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                            isJobRecordSignedOff
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                        }`}
                    >
                        <ShieldCheck size={16} />
                        <span>{isJobRecordSignedOff ? t("Review Job Record") : t("Review & Sign Off Job Record")}</span>
                    </button>
                </div>
            </div>

            {/* Membership Reminder Card */}
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
                        checked={membershipOffered || false} 
                        onChange={(e) => setMembershipOffered && setMembershipOffered(e.target.checked)}
                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-purple-900 dark:text-purple-200">
                        {t("Yes, I discussed a membership plan with the customer")}
                    </span>
                </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isSubcontractor ? (
                    // Subcontractor billing buttons
                    <>
                        <button 
                            onClick={onOpenSubBill}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-primary-600 group text-left"
                        >
                            <FilePlus size={40} className="mb-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("Create Bill In App")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Build and sign an itemized labor/materials invoice for the organization.")}</span>
                        </button>

                        {onUploadFile && (
                            <label 
                                htmlFor="sub-invoice-upload-direct" 
                                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-purple-600 group text-left cursor-pointer"
                            >
                                <Import size={40} className="mb-3 text-slate-400 group-hover:text-purple-500 transition-colors" />
                                <span className="font-bold whitespace-nowrap">{t("Upload Invoice PDF")}</span>
                                <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Upload your pre-existing invoice file from QuickBooks or external software.")}</span>
                                <input 
                                    id="sub-invoice-upload-direct" 
                                    type="file" 
                                    accept="application/pdf,image/*" 
                                    onChange={(e) => onUploadFile(e, 'Subcontractor Invoice')} 
                                    className="hidden" 
                                />
                            </label>
                        )}
                    </>
                ) : (
                    // Regular technician customer-billing buttons
                    <>
                        <button 
                            onClick={handleGoToPayments}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-primary-600 group text-left cursor-pointer"
                        >
                            <FilePlus size={40} className="mb-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">
                                {existingInvoiceId ? `${t("Edit Invoice")} (INV-${existingInvoiceId})` : t("Open Invoice Editor")}
                            </span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">
                                {existingInvoiceId 
                                    ? t("Edit existing invoice line items, labor, parts, and warranties.")
                                    : t("Generate an itemized invoice linked directly to this job.")}
                            </span>
                        </button>

                        <button 
                            onClick={() => {
                                if (onCreateSecondaryInvoice) {
                                    onCreateSecondaryInvoice();
                                } else {
                                    handleGoToPayments();
                                }
                            }}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-blue-600 group text-left cursor-pointer"
                        >
                            <Plus size={40} className="mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("+ Create Secondary Invoice")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Start a brand new additional invoice for this job.")}</span>
                        </button>

                        <button 
                            onClick={onOpenInvoiceSelector}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-purple-600 group text-left cursor-pointer"
                        >
                            <Import size={40} className="mb-3 text-slate-400 group-hover:text-purple-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("Import Invoice")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Upload an existing invoice from another accounting software.")}</span>
                        </button>
                    </>
                )}

                {/* Shared Sign-Off Validation button */}
                {signOffFiles.length > 0 ? (
                    <div className="flex flex-col p-6 bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-xl shadow-sm space-y-4 min-h-[180px] justify-between text-left">
                        <div>
                            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                                <ClipboardCheck size={20} className="text-emerald-500" />
                                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Signed Validation")}</span>
                            </div>
                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                {signOffFiles.map((file, idx) => (
                                    <div key={file.id || idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                        <span className="font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                                            {t("Sign-Off")} #{idx + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => onPreviewFile(file)}
                                                className="p-1 hover:text-primary-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors border-none bg-transparent"
                                                title={t("Review Sign-Off")}
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button 
                                                onClick={() => onDeleteFile(file.id || '')}
                                                className="p-1 hover:text-red-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors border-none bg-transparent"
                                                title={t("Delete / Re-do")}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={onOpenSignOff}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-lg border border-emerald-200 dark:border-emerald-800 transition-all uppercase tracking-wider cursor-pointer"
                        >
                            <Plus size={14} /> {t("New Sign-Off")}
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={onOpenSignOff}
                        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-emerald-600 group text-left"
                    >
                        <ClipboardCheck size={40} className="mb-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        <span className="font-bold whitespace-nowrap">{t("Sign-Off Sheet")}</span>
                        <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Generate and sign a work validation sheet for the client.")}</span>
                    </button>
                )}
            </div>

            {subInvoiceFiles.length > 0 && (
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-sm text-left mt-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t("Submitted Invoice Files")}</h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {subInvoiceFiles.map((file, idx) => (
                            <div key={file.id || idx} className="flex justify-between items-center py-2 text-xs">
                                <div className="truncate max-w-[250px]">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{file.fileName}</p>
                                    <p className="text-[10px] text-slate-400">{t("Uploaded:")} {new Date(file.createdAt || (file as any).date || Date.now()).toLocaleDateString()} {t("by")} {file.uploadedBy}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => onPreviewFile(file)}
                                        className="p-1.5 hover:text-primary-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title={t("Preview")}
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button 
                                        onClick={() => onDeleteFile(file.id || '')}
                                        className="p-1.5 hover:text-red-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title={t("Delete")}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-sm text-center text-slate-500 mt-8 pt-4">{t("Click Complete Job below when you are ready to depart the site.")}</p>
        </div>
    );
};

export default BillingStep;
