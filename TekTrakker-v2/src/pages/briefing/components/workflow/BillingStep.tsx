import showToast from "lib/toast";
import React from 'react';
import { FilePlus, Import, Send, ClipboardCheck, Trash2, Eye, Plus } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import { StoredFile } from 'types';

interface BillingStepProps {
    handleGoToPayments: () => void;
    onOpenInvoiceSelector: () => void;
    onOpenSignOff: () => void;
    files: StoredFile[];
    onPreviewFile: (file: StoredFile) => void;
    onDeleteFile: (fileId: string) => void;
    onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    isSubcontractor?: boolean;
    onOpenSubBill?: () => void;
}

const BillingStep: React.FC<BillingStepProps> = ({
    handleGoToPayments,
    onOpenInvoiceSelector,
    onOpenSignOff,
    files,
    onPreviewFile,
    onDeleteFile,
    onUploadFile,
    isSubcontractor = false,
    onOpenSubBill
}) => {
    const { t } = useLanguage();

    const signOffFiles = files.filter(f => 
        f.fileName === 'SignOff_Sheet.html' || 
        f.metadata?.label === 'Sign-Off Sheet' ||
        f.id?.startsWith('signoff-doc')
    );

    const subInvoiceFiles = files.filter(f => 
        f.metadata?.label === 'Subcontractor Invoice'
    );

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-center mb-6">
                {isSubcontractor ? t("Subcontractor Billing") : t("Finalize Billing")}
            </h3>
            
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
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-primary-600 group text-left"
                        >
                            <FilePlus size={40} className="mb-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("Create Invoice")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Generate an invoice from scratch based on today's workflow.")}</span>
                        </button>
         
                        <button 
                            onClick={onOpenInvoiceSelector}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-purple-600 group text-left"
                        >
                            <Import size={40} className="mb-3 text-slate-400 group-hover:text-purple-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("Import Invoice")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Upload an existing invoice from another accounting software.")}</span>
                        </button>
         
                        <button 
                            onClick={() => {
                                showToast.warn("To send this invoice to the customer, click OK to open your Invoice Editor, and then click the 'Share' option.");
                                handleGoToPayments();
                            }}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-blue-600 group text-left"
                        >
                            <Send size={40} className="mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <span className="font-bold whitespace-nowrap">{t("Review & Send")}</span>
                            <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">{t("Review invoice details and broadcast via Email or SMS.")}</span>
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
