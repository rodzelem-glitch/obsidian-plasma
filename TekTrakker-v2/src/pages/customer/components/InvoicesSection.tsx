
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, CreditCard } from 'lucide-react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import type { Job } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';
import { useAppContext } from 'context/AppContext';
import { computeCanonicalFinancials, formatCurrency } from 'lib/financialCalculator';

interface InvoicesSectionProps {
    jobs: Job[];
}

const InvoicesSection: React.FC<InvoicesSectionProps> = ({ jobs }) => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [previewJob, setPreviewJob] = useState<Job | null>(null);

    const validUnpaidJobs = jobs.filter(j => {
        if (!j.invoice) return false;
        const inv = j.invoice;
        const canonical = computeCanonicalFinancials({
            items: inv.items || [],
            subtotal: inv.subtotal,
            taxRate: inv.taxRate,
            taxAmount: inv.taxAmount,
            totalAmount: inv.totalAmount ?? inv.amount,
            amountPaid: inv.amountPaid,
            depositPaid: inv.depositPaid,
            depositPaidAmount: inv.depositPaidAmount,
            status: inv.status
        });
        const isPaid = String(inv.status).toLowerCase() === 'paid' || canonical.financialStatus === 'PAID' || canonical.balanceDue <= 0;
        const hasBillableAmount = canonical.grandTotal > 0 || (Array.isArray(inv.items) && inv.items.length > 0);
        return !isPaid && hasBillableAmount && canonical.balanceDue > 0;
    });

    if (validUnpaidJobs.length === 0) {
        return null;
    }

    return (
        <section className="animate-in fade-in slide-in-from-top duration-300">
            {previewJob && (
                <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                    <DocumentPreview 
                        type="Invoice" 
                        data={previewJob} 
                        organization={state.currentOrganization}
                        onClose={() => setPreviewJob(null)} 
                        isInternal={false} 
                    />
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Invoices &amp; Billing</h3>
                <Button onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," 
                        + "Invoice #,Property Location,PO Number,Balance Due,Status\n"
                        + validUnpaidJobs.map(j => {
                            const inv: any = j.invoice || {};
                            const canonical = computeCanonicalFinancials({
                                items: inv.items || [],
                                subtotal: inv.subtotal,
                                taxRate: inv.taxRate,
                                taxAmount: inv.taxAmount,
                                totalAmount: inv.totalAmount ?? inv.amount,
                                amountPaid: inv.amountPaid,
                                depositPaid: inv.depositPaid,
                                depositPaidAmount: inv.depositPaidAmount,
                                status: inv.status
                            });
                            return `"${inv.id || j.jobNumber || j.id}","${j.locationName || 'Main Office'}","${j.poNumber || ''}","${canonical.balanceDue}","${inv.status || 'Unpaid'}"`;
                        }).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Unpaid_Invoices_Export.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }} variant="secondary" size="sm" className="flex items-center gap-1 py-1">
                    <Download size={14} /> Export CSV
                </Button>
            </div>
            <div className="space-y-3">
                {validUnpaidJobs.map(j => {
                    const inv: any = j.invoice || {};
                    const canonical = computeCanonicalFinancials({
                        items: inv.items || [],
                        subtotal: inv.subtotal,
                        taxRate: inv.taxRate,
                        taxAmount: inv.taxAmount,
                        totalAmount: inv.totalAmount ?? inv.amount,
                        amountPaid: inv.amountPaid,
                        depositPaid: inv.depositPaid,
                        depositPaidAmount: inv.depositPaidAmount,
                        status: inv.status,
                        paymentTerms: inv.paymentTerms
                    });
                    const invoiceDisplayId = inv.id || (j.jobNumber && String(j.jobNumber).startsWith('job-') ? j.jobNumber.toUpperCase() : (j.jobNumber || `INV-${j.id.slice(-6).toUpperCase()}`));

                    return (
                        <Card key={j.id} className="p-4 border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-950/20">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-rose-600">
                                        {canonical.isNetTerms ? `Balance Due (${canonical.paymentTerms.replace('_', ' ').toUpperCase()})` : 'Unpaid Balance'}
                                    </p>
                                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(canonical.balanceDue)}</p>
                                    {canonical.amountPaid > 0 && (
                                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                            Total: {formatCurrency(canonical.grandTotal)} • Paid: {formatCurrency(canonical.amountPaid)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button 
                                        type="button" 
                                        onClick={() => setPreviewJob(j)}
                                        className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1 cursor-pointer flex-1 sm:flex-none"
                                    >
                                        <FileText size={12} /> View
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => navigate(`/invoice/${j.id}`)}
                                        className="bg-rose-600 text-white px-4 py-1.5 rounded-full text-xs font-black hover:bg-rose-700 flex items-center justify-center gap-1 cursor-pointer shadow-sm flex-1 sm:flex-none"
                                    >
                                        <CreditCard size={12} /> PAY NOW
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                                <p className="text-xs text-slate-500 font-bold uppercase">Invoice #{invoiceDisplayId}</p>
                                {j.locationName && <p className="text-[11px] text-slate-400 font-medium">{j.locationName}</p>}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
};

export default InvoicesSection;
