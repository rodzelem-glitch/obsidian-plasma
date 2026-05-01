import showToast from "lib/toast";
import React from 'react';
import { FilePlus, Import, Send } from 'lucide-react';

interface BillingStepProps {
    handleGoToPayments: () => void;
    handleLeaveSite: () => void;
    onOpenInvoiceSelector: () => void;
}

const BillingStep: React.FC<BillingStepProps> = ({
    handleGoToPayments,
    handleLeaveSite,
    onOpenInvoiceSelector
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-center mb-6">Finalize Billing</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                    onClick={handleGoToPayments}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-primary-600 group text-left"
                >
                    <FilePlus size={40} className="mb-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                    <span className="font-bold whitespace-nowrap">Create Invoice</span>
                    <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">Generate an invoice from scratch based on today's workflow.</span>
                </button>

                <button 
                    onClick={onOpenInvoiceSelector}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-purple-600 group text-left"
                >
                    <Import size={40} className="mb-3 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    <span className="font-bold whitespace-nowrap">Import Invoice</span>
                    <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">Upload an existing invoice from another accounting software.</span>
                </button>

                <button 
                    onClick={() => {
                        showToast.warn("To send this invoice to the customer, click OK to open your Invoice Editor, and then click the 'Share' option.");
                        handleGoToPayments();
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-slate-700 dark:text-slate-300 hover:text-blue-600 group text-left"
                >
                    <Send size={40} className="mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="font-bold whitespace-nowrap">Review & Send</span>
                    <span className="text-xs text-slate-400 mt-2 text-center text-balance leading-relaxed">Review invoice details and broadcast via Email or SMS.</span>
                </button>
            </div>
            <p className="text-sm text-center text-slate-500 mt-8 pt-4">Click <strong>Complete Job</strong> below when you are ready to depart the site.</p>
        </div>
    );
};

export default BillingStep;
