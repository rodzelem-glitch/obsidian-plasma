
import React, { useState, useRef } from 'react';
import Button from 'components/ui/Button';
import { Eye, Send, Receipt, Save, CheckCircle2, RotateCcw, Clock, Upload, Camera, Wallet, Bell } from 'lucide-react';
import type { Job } from 'types';

interface InvoiceActionsProps {
    status: string;
    isSaving: boolean;
    handlePreview: () => void;
    handleSend: () => void;
    handleReceipt: () => void;
    handleSendReminder: () => void;
    handleMarkPaid: (method?: string, proofUrl?: string) => void;
    handleMarkUnpaid: () => void;
    handleMarkPending: (method?: string, proofUrl?: string) => void;
    handleSave: () => void;
    handleUploadDocumentation: (urls: string[]) => void;
}

const InvoiceActions: React.FC<InvoiceActionsProps> = ({
    status,
    isSaving,
    handlePreview,
    handleSend,
    handleReceipt,
    handleSendReminder,
    handleMarkPaid,
    handleMarkUnpaid,
    handleMarkPending,
    handleSave,
    handleUploadDocumentation
}) => {
    const [showPaymentMenu, setShowPaymentMenu] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Credit Card');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const processPaymentAction = (type: 'paid' | 'pending') => {
        const file = fileInputRef.current?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const proofUrl = reader.result as string;
                if (type === 'paid') handleMarkPaid(paymentMethod, proofUrl);
                else handleMarkPending(proofUrl, paymentMethod);
                setShowPaymentMenu(false);
            };
            reader.readAsDataURL(file);
        } else {
            if (type === 'paid') handleMarkPaid(paymentMethod);
            else handleMarkPending(undefined, paymentMethod);
            setShowPaymentMenu(false);
        }
    };

    const onUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            const promise = new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
            });
            reader.readAsDataURL(file);
            urls.push(await promise);
        }
        handleUploadDocumentation(urls);
    };

    return (
        <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handlePreview} className="text-xs font-bold px-5 flex items-center gap-2">
                        <Eye size={16}/> Preview
                    </Button>
                    
                    <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Camera size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Job Documentation</span>
                        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onUploadDoc} />
                    </label>
                </div>
                <div className="flex gap-3">
                    {status !== 'Paid' && (
                        <>
                            <Button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-5 text-white flex items-center gap-2">
                                <Send size={16}/> Send
                            </Button>
                            <Button onClick={handleSendReminder} className="bg-rose-600 hover:bg-rose-700 text-xs font-bold px-5 text-white flex items-center gap-2">
                                <Bell size={16}/> Send Reminder
                            </Button>
                        </>
                    )}
                    {status === 'Paid' && (
                        <Button onClick={handleReceipt} className="bg-slate-600 hover:bg-slate-700 text-xs font-bold px-5 text-white flex items-center gap-2">
                            <Receipt size={16}/> Receipt
                        </Button>
                    )}
                    
                    {status !== 'Paid' ? (
                        <Button variant="secondary" onClick={() => setShowPaymentMenu(!showPaymentMenu)} className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 text-xs font-bold px-5 flex items-center gap-2">
                            <Wallet size={16}/> Log Payment
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={handleMarkUnpaid} className="text-slate-500 hover:text-slate-700 text-xs font-bold px-5 flex items-center gap-2">
                            <RotateCcw size={16}/> Revert Unpaid
                        </Button>
                    )}
                    
                    <Button onClick={handleSave} disabled={isSaving} className="text-xs font-bold shadow-lg shadow-blue-500/20 px-4 md:px-8 flex items-center gap-2">
                        <Save size={16}/> Save
                    </Button>
                </div>
            </div>

            {showPaymentMenu && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 w-full md:w-auto">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Payment Method</p>
                        <select 
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            title="Payment Method"
                            aria-label="Payment Method"
                            className="w-full md:w-auto bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold p-2"
                        >
                            <option value="Credit Card">Credit Card</option>
                            <option value="Cash">Cash (Legacy Logger)</option>
                            <option value="Check">Check</option>
                            <option value="Bank Transfer">Bank Transfer (ACH)</option>
                            <option value="Venmo/Zelle">Venmo / Zelle</option>
                        </select>
                    </div>

                    <div className="flex-1 w-full md:w-auto">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Attach Proof (Photo/Receipt)</p>
                        <label className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <Camera size={16} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Upload Image</span>
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" />
                        </label>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-end mt-4 md:mt-0">
                        <Button variant="secondary" onClick={() => processPaymentAction('pending')} className="text-xs font-bold flex items-center gap-2 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">
                            <Clock size={16}/> Mark Pending
                        </Button>
                        <Button onClick={() => processPaymentAction('paid')} className="text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 size={16}/> Mark Paid & Cleared
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceActions;

