import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { db } from 'lib/firebase';
import type { RefrigerantTransaction } from 'types';

const REFRIGERANTS = [
    'R22', 'R410A', 'R134a', 'R404A', 'R407C', 'R422B', 
    'R448A', 'R449A', 'R454B', 'R32', 'R290', 'R600a', 'Other'
];

interface LogEntry {
    id: string;
    date: string;
    type: 'Purchase' | 'Usage' | 'Adjustment' | string;
    refType: string;
    amount: number;
    reference: string;
    technician: string;
    cylinderNo: string;
    notes?: string;
}

const RefrigerantLog: React.FC = () => {
    const { state } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterType, setFilterType] = useState('All');
    
    // Custom Transactions from DB
    const [transactions, setTransactions] = useState<RefrigerantTransaction[]>([]);

    useEffect(() => {
        if (!state.currentOrganization) return;
        const unsub = db.collection('refrigerantTransactions')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as RefrigerantTransaction)));
            });
        return () => unsub();
    }, [state.currentOrganization]);

    const [entry, setEntry] = useState({
        action: 'Purchase', // 'Purchase' or 'Usage'
        date: new Date().toISOString().split('T')[0],
        vendor: '',
        customerId: '',
        refType: 'R410A',
        amount: 0,
        cylinderNo: '',
        cost: 0,
        notes: ''
    });

    const customers = state.customers || [];

    const logEntries = useMemo(() => {
        const entries: LogEntry[] = [];

        transactions.forEach(tx => {
            entries.push({
                id: tx.id,
                date: tx.date,
                type: tx.action,
                refType: tx.type || 'Unknown',
                amount: tx.action === 'Usage' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
                reference: tx.action === 'Usage' ? `${tx.customerName || 'Customer'}` : (tx.notes || 'Vendor'),
                technician: tx.technicianName || 'Admin',
                cylinderNo: tx.cylinderId || 'N/A',
                notes: tx.notes
            });
        });

        state.jobs.forEach(job => {
            if (job.refrigerantLog && job.refrigerantLog.length > 0) {
                job.refrigerantLog.forEach((log: any, idx: number) => {
                    entries.push({
                        id: `${job.id}-ref-${idx}`,
                        date: job.appointmentTime,
                        type: 'Usage',
                        refType: log.type,
                        amount: -Math.abs(log.amountLbs),
                        reference: `${job.customerName}`,
                        technician: job.assignedTechnicianName || 'Unknown',
                        cylinderNo: log.cylinderNumber || 'N/A',
                        notes: `Job #${job.id}`
                    });
                });
            }
        });

        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.jobs, transactions]);

    const totals = useMemo(() => {
        const bal: Record<string, number> = {};
        logEntries.forEach(e => {
            if (e.refType !== 'Unknown') {
                bal[e.refType] = (bal[e.refType] || 0) + e.amount;
            }
        });
        return bal;
    }, [logEntries]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entry.amount) return;

        let customerName = '';
        if (entry.action === 'Usage' && entry.customerId) {
            const cust = customers.find(c => c.id === entry.customerId);
            if (cust) customerName = cust.name || `${cust.firstName} ${cust.lastName}`;
        }

        const tx: RefrigerantTransaction = {
            id: `reftx-${Date.now()}`,
            organizationId: state.currentOrganization?.id || '',
            date: entry.date,
            action: entry.action,
            type: entry.refType,
            amount: entry.amount,
            cylinderId: entry.cylinderNo,
            customerId: entry.customerId,
            customerName: customerName,
            technicianId: state.currentUser?.id,
            technicianName: state.currentUser?.firstName + ' ' + state.currentUser?.lastName,
            notes: entry.action === 'Purchase' ? entry.vendor : entry.notes,
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('refrigerantTransactions').doc(tx.id).set(tx);
            setIsModalOpen(false);
            setEntry({ action: 'Purchase', date: new Date().toISOString().split('T')[0], vendor: '', customerId: '', refType: 'R410A', amount: 0, cylinderNo: '', cost: 0, notes: '' });
        } catch (err) {
            console.error(err);
            alert("Failed to save log entry.");
        }
    };

    const displayedEntries = filterType === 'All' ? logEntries : logEntries.filter(e => e.refType === filterType);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Refrigerant Logbook</h2>
                    <p className="text-gray-600 dark:text-gray-400">Track usage by customer to guarantee EPA compliance.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => window.print()} className="w-auto border-blue-200">Print Log</Button>
                    <Button onClick={() => setIsModalOpen(true)} className="w-auto bg-blue-600 hover:bg-blue-700 text-white">
                        + Log Activity
                    </Button>
                </div>
            </header>

            <div className="flex gap-4 overflow-x-auto pb-2">
                {Object.entries(totals).filter(([_,amt]) => amt !== 0).map(([type, amount]) => (
                    <Card key={type} className="min-w-[150px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">{type}</h4>
                        <p className={`text-2xl font-black ${amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{(amount as number).toFixed(2)} <span className="text-sm font-medium text-slate-400">lbs</span></p>
                    </Card>
                ))}
            </div>

            <Card className="p-0 overflow-hidden shadow-lg border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <Select label="" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="All">All Refrigerants</option>
                        {REFRIGERANTS.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                </div>
                <Table headers={['Date', 'Type', 'Activity', 'Amount (lbs)', 'Cylinder #', 'Target / Vendor', 'Tech']}>
                    {displayedEntries.map(entry => (
                        <tr key={entry.id} className={entry.type === 'Purchase' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-default'}>
                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{new Date(entry.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-black text-slate-900 dark:text-white tracking-tight">{entry.refType}</td>
                            <td className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">{entry.type}</td>
                            <td className={`px-6 py-4 font-mono font-bold ${entry.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{entry.cylinderNo}</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{entry.reference}</td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-500">{entry.technician}</td>
                        </tr>
                    ))}
                    {displayedEntries.length === 0 && <tr><td colSpan={7} className="p-6 md:p-12 text-center text-slate-400 italic">No refrigerant activity found.</td></tr>}
                </Table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Refrigerant Activity">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg flex-1 bg-slate-50 dark:bg-slate-800 border-emerald-200 dark:border-emerald-800">
                            <input type="radio" name="actionType" checked={entry.action === 'Purchase'} onChange={() => setEntry({...entry, action: 'Purchase'})} className="text-emerald-600"/>
                            <span className="font-bold text-emerald-800 dark:text-emerald-400">Inflow (Purchase)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg flex-1 bg-slate-50 dark:bg-slate-800 border-red-200 dark:border-red-800">
                            <input type="radio" name="actionType" checked={entry.action === 'Usage'} onChange={() => setEntry({...entry, action: 'Usage'})} className="text-red-600"/>
                            <span className="font-bold text-red-800 dark:text-red-400">Outflow (Job Usage)</span>
                        </label>
                    </div>

                    <Input label="Date" type="date" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} required />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Refrigerant Type" value={entry.refType} onChange={e => setEntry({...entry, refType: e.target.value})}>
                            {REFRIGERANTS.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                        <Input label="Amount (lbs)" type="number" step="0.01" value={entry.amount} onChange={e => setEntry({...entry, amount: parseFloat(e.target.value)})} required />
                    </div>
                    
                    <Input label="Cylinder #" value={entry.cylinderNo} onChange={e => setEntry({...entry, cylinderNo: e.target.value})} required />

                    {entry.action === 'Purchase' ? (
                        <div className="space-y-4">
                            <Input label="Vendor / Supply House" value={entry.vendor} onChange={e => setEntry({...entry, vendor: e.target.value})} required={entry.action === 'Purchase'} />
                            <Input label="Cost ($)" type="number" step="0.01" value={entry.cost} onChange={e => setEntry({...entry, cost: parseFloat(e.target.value)})} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Select label="Customer" value={entry.customerId} onChange={e => setEntry({...entry, customerId: e.target.value})} required={entry.action === 'Usage'}>
                                <option value="">Select Customer...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name || `${c.firstName || ''} ${c.lastName || ''}`}</option>)}
                            </Select>
                            <Input label="Job Notes" value={entry.notes} onChange={e => setEntry({...entry, notes: e.target.value})} placeholder="Fixed leak on AC unit..." />
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                        <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Record</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default RefrigerantLog;
