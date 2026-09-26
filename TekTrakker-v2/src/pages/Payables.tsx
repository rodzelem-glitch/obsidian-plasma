import { cleanUndefinedFields } from '../lib/utils';
import showToast from "lib/toast";

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { db } from '../lib/firebase';
import Table from '../components/ui/Table';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { NumberInput } from '../components/ui/Input';
import { CheckCircle, Clock, Search, Building2, User, Sparkles, Edit2, DollarSign, Plus, FileText, ExternalLink, Save, X, Phone, Receipt, AlertTriangle } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import { calculateSubcontractorPayables, PayableRecord } from '../lib/payablesHelper';
import LogExternalInvoiceModal from '../components/modals/LogExternalInvoiceModal';
import SubcontractorStatementModal from '../components/modals/SubcontractorStatementModal';
import SubcontractorChargebackModal from '../components/modals/SubcontractorChargebackModal';
import type { Subcontractor, SubcontractorChargeback } from '../types';

const Payables: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'franchise_admin';
    const [dbPayables, setDbPayables] = useState<PayableRecord[]>([]);
    const [chargebacks, setChargebacks] = useState<SubcontractorChargeback[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'Unpaid' | 'Paid'>('all');
    
    // Modal states
    const [statementSub, setStatementSub] = useState<Subcontractor | null>(null);
    const [chargebackSub, setChargebackSub] = useState<Subcontractor | null>(null);

    // Inline edit states
    const [editingOrgNTEId, setEditingOrgNTEId] = useState<string | null>(null);
    const [editOrgNTEValue, setEditOrgNTEValue] = useState<string>('');

    const [editingSubNTEId, setEditingSubNTEId] = useState<string | null>(null);
    const [editSubNTEValue, setEditSubNTEValue] = useState<string>('');

    const [editingPayableId, setEditingPayableId] = useState<string | null>(null);
    const [editAmountValue, setEditAmountValue] = useState<string>('');

    const [isExternalInvoiceModalOpen, setIsExternalInvoiceModalOpen] = useState(false);

    useEffect(() => {
        if (!state.currentUser || !state.currentOrganization) return;
        const unsubPayables = db.collection('payables')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayableRecord));
                list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setDbPayables(list);
                setLoading(false);
            }, err => {
                console.error("Failed to load payables:", err);
                setLoading(false);
            });

        const unsubChargebacks = db.collection('subcontractor_chargebacks')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubcontractorChargeback));
                setChargebacks(list);
            }, err => {
                console.error("Failed to load chargebacks in Payables:", err);
            });

        return () => {
            unsubPayables();
            unsubChargebacks();
        };
    }, [state.currentOrganization, state.currentUser]);

    // Unified payables list combining persisted records and completed job auto-calculations
    const payables = useMemo(() => {
        return calculateSubcontractorPayables(
            state.jobs || [],
            state.subcontractors || [],
            state.users || [],
            dbPayables,
            state.currentOrganization?.id || ''
        );
    }, [state.jobs, state.subcontractors, state.users, dbPayables, state.currentOrganization]);

    const handleMarkPaid = async (record: PayableRecord, customAmount?: number) => {
        // Calculate matching chargebacks for this specific job
        const matchingCBs = chargebacks.filter(cb => {
            if (cb.status !== 'Applied' && cb.status !== 'Pending') return false;
            if (cb.subcontractorId !== record.subcontractorId) return false;
            if (cb.jobId && record.jobId) return cb.jobId === record.jobId;
            if (cb.workOrderNumber && (record.workOrderNumber || record.poNumber)) {
                return cb.workOrderNumber === record.workOrderNumber || cb.workOrderNumber === record.poNumber;
            }
            if ((cb as any).payableId && (cb as any).payableId === record.id) return true;
            return false;
        });
        const jobDeduction = matchingCBs.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
        const netPayable = Math.max(0, record.amount - jobDeduction);
        const finalAmount = customAmount !== undefined ? customAmount : (jobDeduction > 0 ? netPayable : record.amount);

        const confirmMsg = jobDeduction > 0 
            ? `Mark payable for ${record.companyName} as settled for Net $${finalAmount.toFixed(2)} ($${record.amount.toFixed(2)} gross - $${jobDeduction.toFixed(2)} damage/rework deduction)?`
            : `Mark payable for ${record.companyName} ($${finalAmount.toFixed(2)}) as settled?`;

        if (!await globalConfirm(confirmMsg)) return;
        try {
            const payableDocId = record.isAutoCalculated ? `payable-${record.jobId}` : record.id;
            const paidAtStr = new Date().toISOString();
            const payload: PayableRecord = {
                ...record,
                id: payableDocId,
                organizationId: record.organizationId,
                subcontractorId: record.subcontractorId,
                jobId: record.jobId,
                amount: finalAmount,
                status: 'Paid',
                createdAt: record.createdAt,
                companyName: record.companyName,
                customerName: record.customerName,
                paidAt: paidAtStr,
                isAutoCalculated: false
            };
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields(payload), { merge: true });

            // Mark the applied chargebacks for this job as Applied
            for (const cb of matchingCBs) {
                await db.collection('subcontractor_chargebacks').doc(cb.id).update(cleanUndefinedFields({
                    status: 'Applied',
                    updatedAt: paidAtStr
                }));
            }

            // Sync Expense Record for P&L tracking
            const expenseDocId = `exp-${payableDocId}`;
            const expenseDoc = {
                id: expenseDocId,
                organizationId: record.organizationId,
                date: paidAtStr.split('T')[0],
                category: 'Subcontractor Labor',
                vendor: record.companyName,
                description: `Subcontractor Payout - ${record.companyName} - Job: ${record.customerName}${jobDeduction > 0 ? ` (Net Payout after -$${jobDeduction.toFixed(2)} deduction)` : ''}`,
                amount: finalAmount,
                paidBy: 'Company Account',
                status: 'Paid',
                projectId: record.jobId,
                payableId: payableDocId,
                updatedAt: paidAtStr
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(expenseDoc), { merge: true });

            // Sync Job status to Completed if not already completed
            const targetJob = state.jobs.find(j => j.id === record.jobId);
            if (targetJob && (targetJob.jobStatus || (targetJob as any).status) !== 'Completed') {
                const jobUpdates = { jobStatus: 'Completed', status: 'Completed', updatedAt: paidAtStr };
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(jobUpdates));
                dispatch({ type: 'UPDATE_JOB', payload: { ...targetJob, ...jobUpdates } });
            }

            showToast.success(`Payable of $${finalAmount.toFixed(2)} marked as settled for ${record.companyName}.`);
            setEditingPayableId(null);
        } catch (e) { 
            console.error("Error settling payable:", e);
            showToast.warn("Failed to update status."); 
        }
    };

    // Save Organization's NTE adjustment
    const handleSaveOrgNTE = async (record: PayableRecord) => {
        const parsed = parseFloat(editOrgNTEValue);
        if (isNaN(parsed) || parsed < 0) {
            showToast.warn("Please enter a valid numeric amount for Organization's NTE.");
            return;
        }
        try {
            const payableDocId = record.isAutoCalculated ? `payable-${record.jobId}` : record.id;
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields({
                ...record,
                id: payableDocId,
                orgNTE: parsed,
                isAutoCalculated: false
            }), { merge: true });

            if (record.jobId) {
                const jobUpdates = { clientNTE: parsed, nte: parsed, updatedAt: new Date().toISOString() };
                await db.collection('jobs').doc(record.jobId).update(cleanUndefinedFields(jobUpdates));
                const targetJob = state.jobs.find(j => j.id === record.jobId);
                if (targetJob) dispatch({ type: 'UPDATE_JOB', payload: { ...targetJob, ...jobUpdates } });
            }

            showToast.success("Organization's NTE updated successfully.");
            setEditingOrgNTEId(null);
        } catch (e) {
            console.error("Error saving Org NTE:", e);
            showToast.warn("Failed to save Organization NTE.");
        }
    };

    // Save Subcontractor's NTE adjustment
    const handleSaveSubNTE = async (record: PayableRecord) => {
        const parsed = parseFloat(editSubNTEValue);
        if (isNaN(parsed) || parsed < 0) {
            showToast.warn("Please enter a valid numeric amount for Subcontractor's NTE.");
            return;
        }
        try {
            const payableDocId = record.isAutoCalculated ? `payable-${record.jobId}` : record.id;
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields({
                ...record,
                id: payableDocId,
                subNTE: parsed,
                isAutoCalculated: false
            }), { merge: true });

            if (record.jobId) {
                const jobUpdates = {
                    'subcontractorWorkOrder.nte': parsed,
                    'subcontractorWorkOrder.agreedAmount': parsed,
                    updatedAt: new Date().toISOString()
                };
                await db.collection('jobs').doc(record.jobId).update(cleanUndefinedFields(jobUpdates));
                const targetJob = state.jobs.find(j => j.id === record.jobId);
                if (targetJob) dispatch({ type: 'UPDATE_JOB', payload: { ...targetJob, ...jobUpdates } });
            }

            showToast.success("Subcontractor's NTE updated successfully.");
            setEditingSubNTEId(null);
        } catch (e) {
            console.error("Error saving Subcontractor NTE:", e);
            showToast.warn("Failed to save Subcontractor NTE.");
        }
    };

    // Save Actual Payable adjustment (e.g. upon receiving subcontractor invoice)
    const handleSaveAmount = async (record: PayableRecord) => {
        const parsed = parseFloat(editAmountValue);
        if (isNaN(parsed) || parsed < 0) {
            showToast.warn("Please enter a valid numeric payable amount.");
            return;
        }
        try {
            const payableDocId = record.isAutoCalculated ? `payable-${record.jobId}` : record.id;
            const payload: PayableRecord = {
                ...record,
                id: payableDocId,
                organizationId: record.organizationId,
                subcontractorId: record.subcontractorId,
                jobId: record.jobId,
                amount: parsed,
                status: record.status,
                createdAt: record.createdAt,
                companyName: record.companyName,
                customerName: record.customerName,
                isAutoCalculated: false
            };
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields(payload), { merge: true });

            // Sync Expense Record
            const expenseDocId = `exp-${payableDocId}`;
            const expenseDoc = {
                id: expenseDocId,
                organizationId: record.organizationId,
                date: record.paidAt ? record.paidAt.split('T')[0] : new Date().toISOString().split('T')[0],
                category: 'Subcontractor Labor',
                vendor: record.companyName,
                description: `Subcontractor Payout - ${record.companyName} - Job: ${record.customerName}`,
                amount: parsed,
                paidBy: 'Company Account',
                status: record.status === 'Paid' ? 'Paid' : 'Pending',
                projectId: record.jobId,
                payableId: payableDocId,
                updatedAt: new Date().toISOString()
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(expenseDoc), { merge: true });

            showToast.success("Subcontractor actual payable updated successfully.");
            setEditingPayableId(null);
        } catch (e) {
            console.error("Error saving payable amount:", e);
            showToast.warn("Failed to save amount.");
        }
    };

    const filteredPayables = useMemo(() => {
        return payables.filter(p => {
            const matchesSearch = (p.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (p.jobId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (p.workOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (p.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (p.subcontractorPhone || '').includes(searchTerm) ||
                                 ((p as any).invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [payables, searchTerm, filterStatus]);

    const activeChargebacks = useMemo(() => {
        return chargebacks.filter(cb => cb.status === 'Applied' || cb.status === 'Pending');
    }, [chargebacks]);

    const totalChargebackDeductions = useMemo(() => {
        return activeChargebacks.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
    }, [activeChargebacks]);

    const payableStats = useMemo(() => {
        const unpaid = payables.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);
        const paid = payables.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
        const totalOrgNTE = payables.reduce((sum, p) => sum + (p.orgNTE || 0), 0);
        const totalSubNTE = payables.reduce((sum, p) => sum + (p.subNTE || 0), 0);
        const totalJobs = payables.length;
        const netUnpaid = Math.max(0, unpaid - totalChargebackDeductions);
        return { unpaid, paid, totalOrgNTE, totalSubNTE, totalJobs, netUnpaid };
    }, [payables, totalChargebackDeductions]);

    if (loading) return <div className="p-4 md:p-8 text-center text-slate-500 font-medium">Loading Subcontractor Accounts Payable...</div>;

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-4.5 rounded-2xl shadow-md border border-slate-800">
                <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <Building2 className="text-amber-400" size={24} /> Subcontractor Accounts Payable & Budget NTEs
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        Manage Organization Client NTEs, Authorized Subcontractor NTEs, damage chargebacks, and payment statements in one unified view.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {isAdmin && (
                        <Button 
                            onClick={() => setIsExternalInvoiceModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold h-9 px-3 shrink-0"
                        >
                            <Plus size={14} className="mr-1" /> Log External Invoice
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-widest">Gross Outstanding Payable</p>
                    <p className="text-3xl font-black text-amber-900 dark:text-amber-200 mt-1">${payableStats.unpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <span className="text-[10px] text-amber-600 font-bold block mt-1">Authorized labor before deductions</span>
                </Card>
                <Card className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800">
                    <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest">Damage & Rework Deductions</p>
                    <p className="text-3xl font-black text-rose-900 dark:text-rose-200 mt-1">-${totalChargebackDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <span className="text-[10px] text-rose-600 font-bold block mt-1">{activeChargebacks.length} active site chargebacks</span>
                </Card>
                <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
                    <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">Net Payable Balance Due</p>
                    <p className="text-3xl font-black text-indigo-900 dark:text-indigo-200 mt-1">${payableStats.netUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <span className="text-[10px] text-indigo-600 font-bold block mt-1">After chargebacks applied</span>
                </Card>
                <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Total Settled (YTD)</p>
                    <p className="text-3xl font-black text-emerald-900 dark:text-emerald-200 mt-1">${payableStats.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">Completed subcontractor disbursements</span>
                </Card>
            </div>

            {/* Single Unified Payables Table */}
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            placeholder="Search by subcontractor, phone, customer, WO #, or invoice #..." 
                            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select 
                            title="Filter by status"
                            aria-label="Filter by status"
                            className="text-sm border border-slate-200 rounded-xl px-4 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 font-bold"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as any)}
                        >
                            <option value="all">All Statuses ({payables.length})</option>
                            <option value="Unpaid">Unpaid Only</option>
                            <option value="Paid">Paid Only</option>
                        </select>
                    </div>
                </div>

            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3.5 mb-6">
                {filteredPayables.map(p => {
                    const extUrl = (p as any).externalInvoiceUrl;
                    const invNo = (p as any).invoiceNumber;
                    const subPhone = p.subcontractorPhone;

                    const subObj = state.subcontractors?.find(s => s.id === p.subcontractorId) || {
                        id: p.subcontractorId,
                        companyName: p.companyName,
                        email: (p as any).subcontractorEmail || '',
                        phone: p.subcontractorPhone || '',
                        trade: 'Subcontractor'
                    } as Subcontractor;

                    const jobCBs = chargebacks.filter(cb => {
                        if (cb.status !== 'Applied' && cb.status !== 'Pending') return false;
                        if (cb.subcontractorId !== p.subcontractorId) return false;
                        if (cb.jobId && p.jobId) return cb.jobId === p.jobId;
                        if (cb.workOrderNumber && (p.workOrderNumber || p.poNumber)) {
                            return cb.workOrderNumber === p.workOrderNumber || cb.workOrderNumber === p.poNumber;
                        }
                        if ((cb as any).payableId && (cb as any).payableId === p.id) return true;
                        return false;
                    });
                    const jobCBDeduction = jobCBs.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
                    const netActualPayable = Math.max(0, p.amount - jobCBDeduction);

                    return (
                        <div key={`payable-card-${p.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3">
                            {/* Card Header: Subcontractor, Status & Date */}
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-slate-400 shrink-0" />
                                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                            {p.companyName}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {subPhone && (
                                            <a 
                                                href={`tel:${subPhone.replace(/\D/g, '')}`} 
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono"
                                            >
                                                <Phone size={10} /> {subPhone}
                                            </a>
                                        )}
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(p.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        p.status === 'Paid' 
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}>
                                        {p.status === 'Paid' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                        {p.status}
                                    </span>
                                </div>
                            </div>

                            {/* Job & Customer Details */}
                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer / Job</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                                        {p.customerName || 'N/A'}
                                    </span>
                                    {p.jobId && <span className="text-[10px] font-mono text-slate-400">Job #{p.jobId}</span>}
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Work Order / PO</span>
                                    {p.workOrderNumber || p.poNumber ? (
                                        <button
                                            type="button"
                                            onClick={() => dispatch({ 
                                                type: 'SET_VIEWING_WORK_ORDER', 
                                                payload: { 
                                                    workOrderNumber: p.workOrderNumber || p.poNumber, 
                                                    customerId: p.customerId || null 
                                                } 
                                            })}
                                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            {p.workOrderNumber || p.poNumber}
                                        </button>
                                    ) : (
                                        <span className="text-slate-400 text-xs">--</span>
                                    )}
                                </div>
                            </div>

                            {/* Chips: AutoCalculated, InvNo, ExtUrl, Chargeback Deduction */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {p.isAutoCalculated && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                        <Sparkles size={9} /> Completed Job
                                    </span>
                                )}
                                {invNo && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        #{invNo}
                                    </span>
                                )}
                                {jobCBDeduction > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStatementSub(subObj)}
                                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded"
                                    >
                                        <AlertTriangle size={9} className="text-rose-600" /> -${jobCBDeduction.toFixed(2)} Deduction
                                    </button>
                                )}
                                {extUrl && (
                                    <a 
                                        href={extUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded"
                                    >
                                        <ExternalLink size={9} /> Invoice File
                                    </a>
                                )}
                            </div>

                            {/* NTE & Actual Payable Breakout */}
                            <div className="grid grid-cols-3 gap-2 text-center bg-slate-100/70 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs">
                                <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Org NTE</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">
                                        {p.orgNTE ? `$${p.orgNTE.toFixed(2)}` : '--'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Sub NTE</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">
                                        {p.subNTE ? `$${p.subNTE.toFixed(2)}` : '--'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-indigo-500 font-bold uppercase block">Payable</span>
                                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                        ${(jobCBDeduction > 0 ? netActualPayable : p.amount).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Mobile Actions Bar */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setStatementSub(subObj)}
                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1"
                                        title="Statement"
                                    >
                                        <Receipt size={13} /> Statement
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChargebackSub(subObj)}
                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1"
                                        title="Log Chargeback"
                                    >
                                        <AlertTriangle size={13} />
                                    </button>
                                </div>

                                <div>
                                    {p.status === 'Unpaid' ? (
                                        isAdmin ? (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkPaid(p)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs text-xs"
                                            >
                                                <DollarSign size={13} /> Mark Paid
                                            </button>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400 uppercase italic">
                                                Unpaid
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                            ✓ Settled
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredPayables.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                        No subcontractor payables found.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
            <Table headers={['Subcontractor / Partner', 'Customer / Job', 'Work Order #', 'Date', "Organization's NTE", "Subcontractor's NTE", "Actual Payable", 'Status', 'Actions']}>
                    {filteredPayables.map(p => {
                        const extUrl = (p as any).externalInvoiceUrl;
                        const invNo = (p as any).invoiceNumber;
                        const subPhone = p.subcontractorPhone;
                        const isEditingOrgNTE = editingOrgNTEId === p.id;
                        const isEditingSubNTE = editingSubNTEId === p.id;
                        const isEditingPayable = editingPayableId === p.id;

                        // Find full subcontractor record for statement/chargeback modals
                        const subObj = state.subcontractors?.find(s => s.id === p.subcontractorId) || {
                            id: p.subcontractorId,
                            companyName: p.companyName,
                            email: (p as any).subcontractorEmail || '',
                            phone: p.subcontractorPhone || '',
                            trade: 'Subcontractor'
                        } as Subcontractor;

                        // Check active chargebacks specifically linked to this job or work order
                        const jobCBs = chargebacks.filter(cb => {
                            if (cb.status !== 'Applied' && cb.status !== 'Pending') return false;
                            if (cb.subcontractorId !== p.subcontractorId) return false;
                            
                            // Specific Job ID match:
                            if (cb.jobId && p.jobId) {
                                return cb.jobId === p.jobId;
                            }
                            // Specific Work Order # match:
                            if (cb.workOrderNumber && (p.workOrderNumber || p.poNumber)) {
                                return cb.workOrderNumber === p.workOrderNumber || cb.workOrderNumber === p.poNumber;
                            }
                            // Specific Payable ID match:
                            if ((cb as any).payableId && (cb as any).payableId === p.id) {
                                return true;
                            }
                            return false;
                        });
                        const jobCBDeduction = jobCBs.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);

                        return (
                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                
                                {/* Subcontractor Info */}
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-slate-400 shrink-0" />
                                        <div>
                                            <span className="font-extrabold text-slate-900 dark:text-white block">{p.companyName}</span>
                                            {subPhone && (
                                                <a 
                                                    href={`tel:${subPhone.replace(/\D/g, '')}`} 
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline font-mono"
                                                >
                                                    <Phone size={10} /> {subPhone}
                                                </a>
                                            )}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                {p.isAutoCalculated && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                        <Sparkles size={8} /> Completed Job
                                                    </span>
                                                )}
                                                {invNo && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        #{invNo}
                                                    </span>
                                                )}
                                                {jobCBDeduction > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setStatementSub(subObj)}
                                                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                                        title="Has active damage/rework chargeback on this job. Click to open Statement."
                                                    >
                                                        <AlertTriangle size={9} className="text-rose-600" /> -${jobCBDeduction.toFixed(2)} Deduction
                                                    </button>
                                                )}
                                                {extUrl && (
                                                    <a 
                                                        href={extUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded"
                                                    >
                                                        <ExternalLink size={9} /> View Invoice File
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Customer / Job */}
                                <td className="px-5 py-4">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{p.customerName || 'N/A'}</div>
                                    {p.jobId && <div className="text-[11px] font-mono text-slate-400">Job #{p.jobId}</div>}
                                </td>

                                {/* Work Order # / PO # */}
                                <td className="px-5 py-4 whitespace-nowrap">
                                    {p.workOrderNumber || p.poNumber ? (
                                        <button
                                            type="button"
                                            onClick={() => dispatch({ 
                                                type: 'SET_VIEWING_WORK_ORDER', 
                                                payload: { 
                                                    workOrderNumber: p.workOrderNumber || p.poNumber, 
                                                    customerId: p.customerId || null 
                                                } 
                                            })}
                                            className="inline-flex items-center gap-1.5 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                                            title="Click to view work order document"
                                        >
                                            <FileText size={12} className="text-indigo-500" />
                                            <span>#{p.workOrderNumber || p.poNumber}</span>
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400 font-mono italic">--</span>
                                    )}
                                </td>

                                {/* Date */}
                                <td className="px-5 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}
                                </td>

                                {/* 1. Organization's NTE (Client/Customer Authorized) */}
                                <td className="px-5 py-4">
                                    {isEditingOrgNTE ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400">$</span>
                                            <NumberInput 
                                                step="0.01" 
                                                className="w-20 px-2 py-1 text-xs border-2 border-indigo-500 rounded font-bold bg-white text-slate-900"
                                                value={editOrgNTEValue}
                                                onChange={e => setEditOrgNTEValue(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveOrgNTE(p)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Save size={14}/></button>
                                            <button onClick={() => setEditingOrgNTEId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                {p.orgNTE ? `$${p.orgNTE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                            </span>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => { setEditingOrgNTEId(p.id); setEditOrgNTEValue((p.orgNTE || 0).toString()); }}
                                                    className="text-slate-300 hover:text-indigo-600 transition-colors p-1"
                                                    title="Adjust Organization Client NTE"
                                                >
                                                    <Edit2 size={11} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>

                                {/* 2. Subcontractor's NTE (Work Order Authorized) */}
                                <td className="px-5 py-4">
                                    {isEditingSubNTE ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400">$</span>
                                            <NumberInput 
                                                step="0.01" 
                                                className="w-20 px-2 py-1 text-xs border-2 border-purple-500 rounded font-bold bg-white text-slate-900"
                                                value={editSubNTEValue}
                                                onChange={e => setEditSubNTEValue(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveSubNTE(p)} className="p-1 text-purple-600 hover:bg-purple-50 rounded"><Save size={14}/></button>
                                            <button onClick={() => setEditingSubNTEId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                                                {p.subNTE ? `$${p.subNTE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                            </span>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => { setEditingSubNTEId(p.id); setEditSubNTEValue((p.subNTE || 0).toString()); }}
                                                    className="text-slate-300 hover:text-purple-600 transition-colors p-1"
                                                    title="Adjust Subcontractor Work Order NTE"
                                                >
                                                    <Edit2 size={11} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>

                                {/* 3. Subcontractor's Actual Payable */}
                                <td className="px-5 py-4">
                                    {isEditingPayable ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400">$</span>
                                            <NumberInput 
                                                step="0.01" 
                                                className="w-20 px-2 py-1 text-xs border-2 border-emerald-500 rounded font-bold bg-white text-slate-900"
                                                value={editAmountValue}
                                                onChange={e => setEditAmountValue(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveAmount(p)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Save size={14}/></button>
                                            <button onClick={() => setEditingPayableId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                    ${(jobCBDeduction > 0 && p.status === 'Unpaid' ? Math.max(0, p.amount - jobCBDeduction) : p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {isAdmin && p.status === 'Unpaid' && (
                                                    <button 
                                                        onClick={() => { setEditingPayableId(p.id); setEditAmountValue(p.amount.toString()); }}
                                                        className="text-slate-300 hover:text-emerald-600 transition-colors p-1"
                                                        title="Adjust Subcontractor Actual Payable (from Invoice)"
                                                    >
                                                        <Edit2 size={11} />
                                                    </button>
                                                )}
                                            </div>
                                            {jobCBDeduction > 0 && p.status === 'Unpaid' && (
                                                <span className="text-[10px] text-slate-400 font-bold line-through">
                                                    Gross: ${p.amount.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>

                                {/* Status */}
                                <td className="px-5 py-4">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase w-fit ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {p.status === 'Paid' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                        {p.status}
                                    </div>
                                </td>

                                {/* Actions */}
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-1.5">
                                        {p.status === 'Unpaid' && (
                                            isAdmin ? (
                                                <Button size="sm" onClick={() => handleMarkPaid(p)} className="h-7 text-[10px] font-black uppercase px-2.5 bg-emerald-600 hover:bg-emerald-700">
                                                    Settle
                                                </Button>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                                                    Unpaid
                                                </span>
                                            )
                                        )}
                                        {p.status === 'Paid' && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase italic mr-1">
                                                Settled
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setStatementSub(subObj)}
                                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                            title="Generate Subcontractor Payment Statement"
                                        >
                                            <Receipt size={12} /> Statement
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChargebackSub(subObj)}
                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                            title="Log Site Damage / Faulty Work Chargeback"
                                        >
                                            <AlertTriangle size={12} />
                                        </button>
                                    </div>
                                </td>

                            </tr>
                        );
                    })}
                    {filteredPayables.length === 0 && (
                        <tr>
                            <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">No subcontractor payables found.</td>
                        </tr>
                    )}
                </Table>
                </div>
            </Card>

            {/* Subcontractor Statement Modal */}
            {statementSub && (
                <SubcontractorStatementModal
                    isOpen={!!statementSub}
                    onClose={() => setStatementSub(null)}
                    subcontractor={statementSub}
                />
            )}

            {/* Subcontractor Chargeback Modal */}
            {chargebackSub && (
                <SubcontractorChargebackModal
                    isOpen={!!chargebackSub}
                    onClose={() => setChargebackSub(null)}
                    subcontractor={chargebackSub}
                />
            )}

            {/* External Subcontractor Invoice Upload Modal */}
            <LogExternalInvoiceModal 
                isOpen={isExternalInvoiceModalOpen}
                onClose={() => setIsExternalInvoiceModalOpen(false)}
            />
        </div>
    );
};

export default Payables;
