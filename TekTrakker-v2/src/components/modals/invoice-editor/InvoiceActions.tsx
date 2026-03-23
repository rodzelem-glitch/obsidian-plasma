
import React from 'react';
import Button from 'components/ui/Button';
import { Eye, Send, Receipt, Save, CheckCircle2, RotateCcw } from 'lucide-react';
import type { Job } from 'types';

interface InvoiceActionsProps {
    status: string;
    isSaving: boolean;
    handlePreview: () => void;
    handleSend: () => void;
    handleReceipt: () => void;
    handleMarkPaid: () => void;
    handleMarkUnpaid: () => void;
    handleSave: () => void;
}

const InvoiceActions: React.FC<InvoiceActionsProps> = ({
    status,
    isSaving,
    handlePreview,
    handleSend,
    handleReceipt,
    handleMarkPaid,
    handleMarkUnpaid,
    handleSave
}) => {
    return (
        <div className="mt-8 flex flex-wrap justify-between items-center gap-4 border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex gap-2">
                <Button variant="secondary" onClick={handlePreview} className="text-xs font-bold px-5 flex items-center gap-2">
                    <Eye size={16}/> Preview
                </Button>
            </div>
            <div className="flex gap-3">
                {status !== 'Paid' && (
                   <Button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-5 text-white flex items-center gap-2">
                       <Send size={16}/> Send
                   </Button>
                )}
                {status === 'Paid' && (
                   <Button onClick={handleReceipt} className="bg-slate-600 hover:bg-slate-700 text-xs font-bold px-5 text-white flex items-center gap-2">
                       <Receipt size={16}/> Receipt
                   </Button>
                )}
                {status !== 'Paid' ? (
                    <Button variant="secondary" onClick={handleMarkPaid} className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 text-xs font-bold px-5 flex items-center gap-2">
                        <CheckCircle2 size={16}/> Mark Paid
                    </Button>
                ) : (
                    <Button variant="secondary" onClick={handleMarkUnpaid} className="text-slate-500 hover:text-slate-700 text-xs font-bold px-5 flex items-center gap-2">
                        <RotateCcw size={16}/> Mark Unpaid
                    </Button>
                )}
                <Button onClick={handleSave} disabled={isSaving} className="text-xs font-bold shadow-lg shadow-blue-500/20 px-4 md:px-8 flex items-center gap-2">
                    <Save size={16}/> Save
                </Button>
            </div>
        </div>
    );
};

export default InvoiceActions;
