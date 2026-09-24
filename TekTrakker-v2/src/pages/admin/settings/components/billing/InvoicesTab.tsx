import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import { FileText, Download, Printer, CheckCircle, Clock, AlertTriangle, ExternalLink, Search, RefreshCw, X } from 'lucide-react';
import { db } from 'lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface InvoiceRecord {
    id: string;
    organizationId: string;
    amount: number;
    date: string;
    status: 'paid' | 'pending' | 'failed';
    paymentIntentId?: string;
    description: string;
}

interface InvoicesTabProps {
    orgId: string;
    orgName: string;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({ orgId, orgName }) => {
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

    const fetchInvoices = async () => {
        if (!orgId) return;
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'platformInvoices'),
                where('organizationId', '==', orgId)
            );
            const snap = await getDocs(q);
            const list: InvoiceRecord[] = [];
            snap.forEach(doc => {
                const data = doc.data();
                list.push({
                    id: doc.id,
                    organizationId: data.organizationId,
                    amount: data.amount || 0,
                    date: data.date || new Date().toISOString(),
                    status: data.status || 'paid',
                    paymentIntentId: data.paymentIntentId || doc.id,
                    description: data.description || 'TekTrakker Platform Charge'
                });
            });

            // Sort by date descending
            list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setInvoices(list);
        } catch (error) {
            console.error("Failed to load platform invoices:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, [orgId]);

    const filteredInvoices = invoices.filter(inv => 
        inv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.paymentIntentId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePrintInvoice = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <FileText className="text-blue-600" size={24} /> Invoices & Billing Transaction History
                    </h2>
                    <p className="text-xs text-slate-500">
                        View, search, and download tax receipts for platform subscriptions and add-on charges.
                    </p>
                </div>

                <button
                    onClick={fetchInvoices}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 transition"
                    title="Refresh Invoices"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search invoices by description or transaction ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
            </div>

            {/* Invoices List */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-0">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-500" /> Loading billing history...
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                        {searchQuery ? 'No invoices match your search query.' : 'No billing receipts found on record for this account.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Transaction ID</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Receipt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                        <td className="p-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                            {new Date(inv.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="p-4 font-mono text-[11px] text-slate-500">
                                            {inv.paymentIntentId ? inv.paymentIntentId.slice(0, 16) + '...' : inv.id}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                                            {inv.description}
                                        </td>
                                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                                            ${inv.amount.toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            {inv.status === 'paid' && (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                                    <CheckCircle size={10} /> Paid
                                                </span>
                                            )}
                                            {inv.status === 'pending' && (
                                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                                    <Clock size={10} /> Pending
                                                </span>
                                            )}
                                            {inv.status === 'failed' && (
                                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-red-200 dark:border-red-800">
                                                    <AlertTriangle size={10} /> Failed
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedInvoice(inv)}
                                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                            >
                                                View Receipt <ExternalLink size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Printable Receipt Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">TekTrakker Tax Receipt</h3>
                                <p className="text-xs text-slate-500 font-mono">Invoice #{selectedInvoice.id}</p>
                            </div>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                                <div>
                                    <span className="text-slate-400 font-medium block">Billed To:</span>
                                    <span className="font-bold text-slate-900 dark:text-white block">{orgName}</span>
                                    <span className="text-slate-500 block font-mono text-[10px]">SID: {orgId}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-medium block">Invoice Date:</span>
                                    <span className="font-bold text-slate-900 dark:text-white block">
                                        {new Date(selectedInvoice.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span>Item Description</span>
                                    <span>Amount</span>
                                </div>
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                    <span>{selectedInvoice.description}</span>
                                    <span className="font-mono">${selectedInvoice.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <span>Total Paid</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">${selectedInvoice.amount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                                Processed via TekTrakker Custom Payment Processing. Thank you for choosing TekTrakker!
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={handlePrintInvoice}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                            >
                                <Printer size={14} /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
