import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";
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
import { globalConfirm } from 'lib/globalConfirm';
import { Edit, Trash2, Database, ScanBarcode, FileText } from 'lucide-react';
import { BarcodeScannerButton } from 'components/ui/BarcodeScanner';

const REFRIGERANTS = [
    'R22', 'R410A', 'R134a', 'R404A', 'R407C', 'R422B', 
    'R448A', 'R449A', 'R454B', 'R32', 'R290', 'R600a', 'Other'
];

const normalizeRefType = (type: string) => {
    if (!type) return '';
    return type.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const getCanonicalRefType = (type: string): string => {
    if (!type) return 'Unknown';
    const normalized = type.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const found = REFRIGERANTS.find(r => r.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalized);
    return found || type;
};

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
    jobId?: string;
    customerId?: string;
}

const RefrigerantLog: React.FC = () => {
    const { state } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterType, setFilterType] = useState('All');
    const [activeTab, setActiveTab] = useState<'logs' | 'cylinders'>('logs');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Custom Transactions from DB
    const [transactions, setTransactions] = useState<RefrigerantTransaction[]>([]);
    const [cylinders, setCylinders] = useState<any[]>([]);

    useEffect(() => {
        if (!state.currentOrganization) return;
        const txUnsub = db.collection('refrigerantTransactions')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as RefrigerantTransaction)));
            });
            
        const cylUnsub = db.collection('refrigerantCylinders')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                setCylinders(snap.docs.map(d => ({ ...d.data(), id: d.id })));
            });
        return () => { txUnsub(); cylUnsub(); };
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
            const amountVal = Number(tx.amount || (tx as any).amountLbs || 0);
            
            // Auto-heal/resolve missing or Unknown types if linked to a cylinder
            let resolvedType = tx.type;
            if (!resolvedType || resolvedType === 'Unknown') {
                const linkedCyl = cylinders.find(c => c.id === tx.cylinderId || c.cylinderNo === tx.cylinderId);
                if (linkedCyl) {
                    resolvedType = linkedCyl.type;
                }
            }
            
            const canonicalType = getCanonicalRefType(resolvedType || 'Unknown');

            entries.push({
                id: tx.id,
                date: tx.date || new Date().toISOString(),
                type: tx.action || 'Purchase',
                refType: canonicalType,
                amount: tx.action === 'Usage' ? -Math.abs(amountVal) : Math.abs(amountVal),
                reference: tx.action === 'Usage' ? `${tx.customerName || 'Customer'}` : (tx.notes || 'Vendor'),
                technician: tx.technicianName || 'Admin',
                cylinderNo: tx.cylinderId || 'N/A',
                notes: tx.notes,
                customerId: tx.customerId || undefined,
                jobId: (tx as any).jobId || undefined
            });
        });

        state.jobs.forEach(job => {
            if (job.refrigerantLog && job.refrigerantLog.length > 0) {
                job.refrigerantLog.forEach((log: any, idx: number) => {
                    const amountVal = Number(log.amount || log.amountLbs || 0);
                    
                    // Auto-heal/resolve missing or Unknown types if linked to a cylinder
                    let resolvedType = log.type;
                    if (!resolvedType || resolvedType === 'Unknown') {
                        const linkedCyl = cylinders.find(c => c.id === (log.cylinderId || log.cylinderNumber) || c.cylinderNo === (log.cylinderId || log.cylinderNumber));
                        if (linkedCyl) {
                            resolvedType = linkedCyl.type;
                        }
                    }

                    const canonicalType = getCanonicalRefType(resolvedType || 'Unknown');

                    entries.push({
                        id: `${job.id}-ref-${idx}`,
                        date: job.appointmentTime || new Date().toISOString(),
                        type: 'Usage',
                        refType: canonicalType,
                        amount: -Math.abs(amountVal),
                        reference: `${job.customerName || 'Customer'}`,
                        technician: job.assignedTechnicianName || 'Unknown',
                        cylinderNo: log.cylinderNumber || log.cylinderId || 'N/A',
                        notes: `Job #${job.id}`,
                        jobId: job.id,
                        customerId: job.customerId
                    });
                });
            }
        });

        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.jobs, transactions, cylinders]);

    useEffect(() => {
        if (cylinders.length === 0 || logEntries.length === 0 || state.isDemoMode) return;

        const reconcileWeights = async () => {
            for (const cyl of cylinders) {
                const cylLogs = logEntries.filter(e => 
                    (e.cylinderNo === cyl.cylinderNo || e.cylinderNo === cyl.id) &&
                    normalizeRefType(e.refType) === normalizeRefType(cyl.type)
                );
                
                // Sum up log amounts: Purchases are positive, Usages are negative
                const netLogAmount = cylLogs.reduce((sum, e) => sum + e.amount, 0);
                
                const tareWeight = Number(cyl.tareWeight || 0);
                const targetCurrentWeight = tareWeight + Math.max(0, netLogAmount);
                const targetRemainingWeight = Math.max(0, netLogAmount);

                const currentWeight = Number(cyl.currentWeight || 0);
                const remainingWeight = Number(cyl.remainingWeight || 0);

                const weightDiff = Math.abs(currentWeight - targetCurrentWeight);
                const remainDiff = isNaN(remainingWeight) ? 999 : Math.abs(remainingWeight - targetRemainingWeight);

                // If they are out of sync by more than a tiny margin, auto-heal!
                if (weightDiff > 0.01 || remainDiff > 0.01) {
                    try {
                        await db.collection('refrigerantCylinders').doc(cyl.id).update(cleanUndefinedFields({
                            currentWeight: targetCurrentWeight,
                            remainingWeight: targetRemainingWeight,
                            updatedAt: new Date().toISOString()
                        }));
                    } catch (err) {
                        console.error("Auto-reconciliation failed for cylinder:", cyl.cylinderNo, err);
                    }
                }
            }
        };

        reconcileWeights();
    }, [cylinders, logEntries, state.isDemoMode]);

    const totals = useMemo(() => {
        const bal: Record<string, number> = {};
        logEntries.forEach(e => {
            if (e.refType !== 'Unknown') {
                bal[e.refType] = (bal[e.refType] || 0) + e.amount;
            }
        });
        return bal;
    }, [logEntries]);

    const renderLinkedDocsForRefrigerant = (entry: LogEntry) => {
        let files: any[] = [];
        
        if (entry.jobId) {
            const job = state.jobs?.find(j => j.id === entry.jobId);
            if (job?.files) {
                files = [...files, ...job.files];
            }
        }
        
        if (files.length === 0 && entry.customerId) {
            const customer = state.customers?.find(c => c.id === entry.customerId);
            if (customer?.files) {
                files = [...files, ...customer.files];
            }
        }
        
        if (files.length > 0) {
            return (
                <div className="flex flex-col gap-1 max-w-[150px]">
                    {files.map((file: any, index: number) => (
                        <a 
                            key={file.id || index} 
                            href={file.url || file.dataUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1.5 text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-bold truncate"
                            title={file.label || file.fileName || `Doc ${index+1}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FileText size={10} className="text-primary-500 shrink-0" />
                            <span className="truncate">{file.label || file.fileName || `Doc ${index+1}`}</span>
                        </a>
                    ))}
                </div>
            );
        }
        
        return <span className="text-slate-400 text-xs italic">-</span>;
    };

    const syncCylinderWeight = async (cylinderNo: string, deltaWeight: number, refType?: string) => {
        if (!cylinderNo) return;
        try {
            const snap = await db.collection('refrigerantCylinders')
                .where('organizationId', '==', state.currentOrganization?.id || '')
                .get();
            const cylDoc = snap.docs.find(d => {
                const data = d.data();
                const matchesTag = data.cylinderNo === cylinderNo || d.id === cylinderNo;
                if (!matchesTag) return false;
                if (refType) {
                    return normalizeRefType(data.type) === normalizeRefType(refType);
                }
                return true;
            });
            if (cylDoc) {
                const data = cylDoc.data();
                const currentWeight = Number(data.currentWeight || 0);
                const tareWeight = Number(data.tareWeight || 0);
                const newWeight = currentWeight + deltaWeight;
                await db.collection('refrigerantCylinders').doc(cylDoc.id).update(cleanUndefinedFields({
                    currentWeight: Math.max(tareWeight, newWeight),
                    remainingWeight: Math.max(0, newWeight - tareWeight)
                }));
            }
        } catch (e) {
            console.error("Failed to sync cylinder weight:", e);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entry.amount || isSaving) return;
        setIsSaving(true);

        let customerName = '';
        if (entry.action === 'Usage' && entry.customerId) {
            const cust = customers.find(c => c.id === entry.customerId);
            if (cust) customerName = cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim();
        }

        const tx: RefrigerantTransaction = {
            id: isEditing && editingId && !editingId.includes('-ref-') ? editingId : `reftx-${Date.now()}`,
            organizationId: state.currentOrganization?.id || '',
            date: entry.date || new Date().toISOString().split('T')[0],
            action: entry.action || 'Purchase',
            type: entry.refType || 'R410A',
            amount: entry.amount || 0,
            cylinderId: entry.cylinderNo || '',
            customerId: entry.customerId || '',
            customerName: customerName || '',
            technicianId: state.currentUser?.id || '',
            technicianName: `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim(),
            notes: (entry.action === 'Purchase' ? entry.vendor : entry.notes) || '',
            createdAt: new Date().toISOString()
        };

        try {
            if (isEditing && editingId) {
                if (editingId.includes('-ref-')) {
                    // Update job-linked refrigerant entry
                    const parts = editingId.split('-ref-');
                    const jobId = parts[0];
                    const idx = parseInt(parts[1], 10);
                    const job = state.jobs.find(j => j.id === jobId);
                    if (job && job.refrigerantLog && job.refrigerantLog[idx]) {
                        const oldLog = job.refrigerantLog[idx] as any;
                        const updatedLog = [...job.refrigerantLog];
                        updatedLog[idx] = {
                            ...updatedLog[idx],
                            type: entry.refType || 'R410A',
                            amount: entry.amount || 0,
                            amountLbs: entry.amount || 0,
                            cylinderNumber: entry.cylinderNo || ''
                        };
                        await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                            refrigerantLog: updatedLog
                        }));

                        // Revert old job-linked usage (which was outflow, so we add old amount back)
                        const oldAmt = Number(oldLog.amount || oldLog.amountLbs || 0);
                        await syncCylinderWeight(oldLog.cylinderNumber || oldLog.cylinderId, oldAmt, oldLog.type);
                        
                        // Apply new job-linked usage (which is outflow, so we subtract new amount)
                        await syncCylinderWeight(entry.cylinderNo, -entry.amount, entry.refType);

                        showToast.success("Job-linked log updated successfully.");
                    }
                } else {
                    // Update manual transaction
                    const oldTx = transactions.find(t => t.id === editingId);
                    await db.collection('refrigerantTransactions').doc(editingId).update(cleanUndefinedFields(tx));

                    if (oldTx) {
                        // Revert old transaction effect
                        const oldAmt = Number(oldTx.amount || (oldTx as any).amountLbs || 0);
                        const revertDelta = oldTx.action === 'Purchase' ? -oldAmt : oldAmt;
                        const oldType = oldTx.type || cylinders.find(c => c.id === oldTx.cylinderId || c.cylinderNo === oldTx.cylinderId)?.type;
                        await syncCylinderWeight(oldTx.cylinderId || (oldTx as any).cylinderNo, revertDelta, oldType);
                    }

                    // Apply new transaction effect
                    const newDelta = entry.action === 'Purchase' ? entry.amount : -entry.amount;
                    await syncCylinderWeight(entry.cylinderNo, newDelta, entry.refType);

                    showToast.success("Manual log updated successfully.");
                }
            } else {
                // Create new manual transaction
                await db.collection('refrigerantTransactions').doc(tx.id).set(cleanUndefinedFields(tx));

                // Apply new transaction weight changes
                const newDelta = entry.action === 'Purchase' ? entry.amount : -entry.amount;
                await syncCylinderWeight(entry.cylinderNo, newDelta, entry.refType);

                showToast.success("New activity logged successfully.");
            }
            setIsModalOpen(false);
            setIsEditing(false);
            setEditingId(null);
            setEntry({ action: 'Purchase', date: new Date().toISOString().split('T')[0], vendor: '', customerId: '', refType: 'R410A', amount: 0, cylinderNo: '', cost: 0, notes: '' });
        } catch (err) {
            console.error(err);
            showToast.warn("Failed to save log entry.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (entry: any) => {
        if (entry.id.includes('-ref-')) {
            // Job-linked log entry
            const parts = entry.id.split('-ref-');
            const jobId = parts[0];
            const idx = parseInt(parts[1], 10);
            const job = state.jobs.find(j => j.id === jobId);
            if (!job || !job.refrigerantLog || !job.refrigerantLog[idx]) return;
            const log = job.refrigerantLog[idx] as any;
            
            setEntry({
                action: 'Usage',
                date: new Date(job.appointmentTime || job.createdAt).toISOString().split('T')[0],
                vendor: '',
                customerId: job.customerId || '',
                refType: log.type || 'R410A',
                amount: Math.abs(Number(log.amount || log.amountLbs || 0)),
                cylinderNo: log.cylinderNumber || log.cylinderId || '',
                cost: 0,
                notes: log.notes || `Job #${job.id}`
            });
            setEditingId(entry.id);
            setIsEditing(true);
            setIsModalOpen(true);
            return;
        }

        // Manual transaction (reftx- or trans-)
        const tx = transactions.find(t => t.id === entry.id);
        if (!tx) {
            // Fallback populate from table entry values
            setEntry({
                action: entry.type || 'Purchase',
                date: new Date(entry.date).toISOString().split('T')[0],
                vendor: entry.type === 'Purchase' ? entry.notes || '' : '',
                customerId: '',
                refType: entry.refType || 'R410A',
                amount: Math.abs(Number(entry.amount) || 0),
                cylinderNo: entry.cylinderNo || '',
                cost: 0,
                notes: entry.type === 'Usage' ? entry.notes || '' : ''
            });
            setEditingId(entry.id);
            setIsEditing(true);
            setIsModalOpen(true);
            return;
        }
        
        setEntry({
            action: tx.action || 'Purchase',
            date: tx.date || new Date().toISOString().split('T')[0],
            vendor: tx.action === 'Purchase' ? tx.notes || '' : '',
            customerId: tx.customerId || '',
            refType: tx.type || 'R410A',
            amount: Math.abs(Number(tx.amount || (tx as any).amountLbs || 0)),
            cylinderNo: tx.cylinderId || '',
            cost: 0,
            notes: tx.action === 'Usage' ? tx.notes || '' : ''
        });
        setEditingId(tx.id);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (id.includes('-ref-')) {
            if (!await globalConfirm("Delete this refrigerant record from the job?")) return;
            try {
                const parts = id.split('-ref-');
                const jobId = parts[0];
                const idx = parseInt(parts[1], 10);
                const job = state.jobs.find(j => j.id === jobId);
                if (job && job.refrigerantLog && job.refrigerantLog[idx]) {
                    const deletedLog = job.refrigerantLog[idx] as any;
                    const updatedLog = [...job.refrigerantLog];
                    updatedLog.splice(idx, 1);
                    await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                        refrigerantLog: updatedLog
                    }));

                    // Revert old job-linked usage (which was outflow, so we add old amount back)
                    const oldAmt = Number(deletedLog.amount || deletedLog.amountLbs || 0);
                    await syncCylinderWeight(deletedLog.cylinderNumber || deletedLog.cylinderId, oldAmt, deletedLog.type);

                    showToast.success("Job-linked log deleted successfully.");
                }
            } catch (e) {
                showToast.warn("Delete failed");
            }
            return;
        }

        // Manual transaction (reftx- or trans-)
        if (!await globalConfirm("Delete this refrigerant record?")) return;
        try {
            const txToDelete = transactions.find(t => t.id === id);
            await db.collection('refrigerantTransactions').doc(id).delete();

            if (txToDelete) {
                // Revert transaction weight changes
                const oldAmt = Number(txToDelete.amount || (txToDelete as any).amountLbs || 0);
                const revertDelta = txToDelete.action === 'Purchase' ? -oldAmt : oldAmt;
                const oldType = txToDelete.type || cylinders.find(c => c.id === txToDelete.cylinderId || c.cylinderNo === txToDelete.cylinderId)?.type;
                await syncCylinderWeight(txToDelete.cylinderId || (txToDelete as any).cylinderNo, revertDelta, oldType);
            }

            showToast.success("Refrigerant record deleted successfully.");
        } catch (e) {
            showToast.warn("Delete failed");
        }
    };

    const displayedEntries = filterType === 'All' ? logEntries : logEntries.filter(e => e.refType === filterType);

    const [isCylinderModalOpen, setIsCylinderModalOpen] = useState(false);
    const [editingCylinder, setEditingCylinder] = useState<any>(null);

    const handleSaveCylinder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization?.id) {
            showToast.warn('Cannot save: organization not loaded.');
            return;
        }
        if (isSaving) return;
        setIsSaving(true);

        const data = editingCylinder;
        const id = data.id || `cyl-${Date.now()}`;
        const cylinder = {
            id,
            organizationId: state.currentOrganization.id,
            cylinderNo: data.cylinderNo || '',
            type: data.type || 'R410A',
            status: data.status || 'In Service',
            currentWeight: Number(data.currentWeight) || 0,
            tareWeight: Number(data.tareWeight) || 0,
            updatedAt: new Date().toISOString()
        };

        try {
            await db.collection('refrigerantCylinders').doc(id).set(cleanUndefinedFields(cylinder), { merge: true });
            setIsCylinderModalOpen(false);
            setEditingCylinder(null);
        } catch (err) {
            showToast.warn('Failed to save cylinder: ' + (err as any)?.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCylinder = async (id: string) => {
        if (!await globalConfirm("Delete this cylinder? This will not remove historical logs.")) return;
        try {
            await db.collection('refrigerantCylinders').doc(id).delete();
        } catch (e) {
            showToast.warn("Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => window.print()} className="w-auto border-blue-200">Print Log</Button>
                    <Button onClick={() => {
                        if (activeTab === 'cylinders') {
                            setEditingCylinder({ cylinderNo: '', type: 'R410A', status: 'In Service', currentWeight: 0, tareWeight: 0 });
                            setIsCylinderModalOpen(true);
                        } else {
                            setIsModalOpen(true);
                        }
                    }} className="w-auto bg-blue-600 hover:bg-blue-700 text-white">
                        {activeTab === 'cylinders' ? '+ Add Cylinder' : '+ Log Activity'}
                    </Button>
                </div>
            </header>

            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button 
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    Activity Logs
                </button>
                <button 
                    onClick={() => setActiveTab('cylinders')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'cylinders' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    Cylinders / Tanks
                </button>
            </div>

            {activeTab === 'cylinders' ? (
                 <Card className="p-0 overflow-hidden shadow-lg border-slate-200 dark:border-slate-700">
                    <Table headers={['Cylinder #', 'Type', 'Status', 'Current Wt (lbs)', 'Tare Wt', 'Net Content', 'Actions']}>
                        {cylinders.map(cyl => (
                            <tr key={cyl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                                <td className="px-6 py-4 font-black">{cyl.cylinderNo}</td>
                                <td className="px-6 py-4 text-xs font-bold uppercase">{cyl.type}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${cyl.status === 'Empty' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {cyl.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold">{cyl.currentWeight}</td>
                                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{cyl.tareWeight}</td>
                                <td className="px-6 py-4 font-bold text-blue-600">{(cyl.currentWeight - cyl.tareWeight).toFixed(2)} lbs</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setEditingCylinder(cyl); setIsCylinderModalOpen(true); }} className="text-blue-500 hover:text-blue-700" aria-label="Edit Cylinder" title="Edit Cylinder">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteCylinder(cyl.id)} className="text-red-500 hover:text-red-700" aria-label="Delete Cylinder" title="Delete Cylinder">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {cylinders.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">No cylinders registered. Add your first tank to track inventory.</td></tr>}
                    </Table>
                 </Card>
            ) : (
                <>
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
                        <Table headers={['Date', 'Type', 'Activity', 'Amount (lbs)', 'Cylinder #', 'Target / Vendor', 'Tech', 'Linked Documents', 'Actions']}>
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
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{renderLinkedDocsForRefrigerant(entry)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEdit(entry)} className="text-blue-500 hover:text-blue-700" aria-label="Edit Record" title="Edit Record">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(entry.id)} className="text-red-500 hover:text-red-700" aria-label="Delete Record" title="Delete Record">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {displayedEntries.length === 0 && <tr><td colSpan={9} className="p-6 md:p-12 text-center text-slate-400 italic">No refrigerant activity found.</td></tr>}
                        </Table>
                    </Card>
                </>
            )}

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
                    
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input label="Cylinder #" value={entry.cylinderNo} onChange={e => setEntry({...entry, cylinderNo: e.target.value})} required />
                        </div>
                        <BarcodeScannerButton onScan={(text) => setEntry({...entry, cylinderNo: text})} />
                    </div>

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
                        <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Record'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isCylinderModalOpen} onClose={() => setIsCylinderModalOpen(false)} title="Cylinder Management">
                {editingCylinder && (
                    <form onSubmit={handleSaveCylinder} className="space-y-4">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input label="Cylinder / Tank Serial #" value={editingCylinder.cylinderNo} onChange={e => setEditingCylinder({...editingCylinder, cylinderNo: e.target.value})} required />
                            </div>
                            <BarcodeScannerButton onScan={(text) => setEditingCylinder({...editingCylinder, cylinderNo: text})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Ref Type" value={editingCylinder.type} onChange={e => setEditingCylinder({...editingCylinder, type: e.target.value})}>
                                {REFRIGERANTS.map(r => <option key={r} value={r}>{r}</option>)}
                            </Select>
                            <Select label="Status" value={editingCylinder.status} onChange={e => setEditingCylinder({...editingCylinder, status: e.target.value})}>
                                <option value="In Service">In Service</option>
                                <option value="Standby">Standby</option>
                                <option value="Empty">Empty / Out</option>
                                <option value="Recycle">Recycle</option>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Current Weight (lbs)" type="number" step="0.01" value={editingCylinder.currentWeight} onChange={e => setEditingCylinder({...editingCylinder, currentWeight: parseFloat(e.target.value)})} required />
                            <Input label="Tare Weight (lbs)" type="number" step="0.01" value={editingCylinder.tareWeight} onChange={e => setEditingCylinder({...editingCylinder, tareWeight: parseFloat(e.target.value)})} required />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" type="button" onClick={() => setIsCylinderModalOpen(false)} disabled={isSaving}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Cylinder'}</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default RefrigerantLog;
