
import React from 'react';
import Card from 'components/ui/Card';
import type { Job } from 'types';

interface InvoicesSectionProps {
    jobs: Job[];
}

const InvoicesSection: React.FC<InvoicesSectionProps> = ({ jobs }) => {
    return (
        <section>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Invoices & Billing</h3>
            <div className="space-y-3">
                {jobs.map(j => (
                    <Card key={j.id} className="p-4 border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-950/20">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase text-rose-600">Unpaid Balance</p>
                                <p className="text-lg font-black text-slate-900 dark:text-white">${(j.invoice.totalAmount || j.invoice.amount).toFixed(2)}</p>
                            </div>
                            <a href={`/#/invoice/${j.id}`} className="bg-rose-600 text-white px-4 py-1.5 rounded-full text-xs font-black hover:bg-rose-700">PAY NOW</a>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Invoice #{j.invoice.id}</p>
                    </Card>
                ))}
                {jobs.length === 0 && <div className="p-4 text-center text-xs text-slate-400">No unpaid invoices.</div>}
            </div>
        </section>
    );
};

export default InvoicesSection;
