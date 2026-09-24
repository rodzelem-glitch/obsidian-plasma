import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Briefcase, DollarSign, CheckCircle2, Clock, Edit2, Search, Building2, Calendar, Save, AlertCircle, X, ShieldCheck, ChevronDown, Receipt, AlertTriangle, Camera, Plus, ExternalLink } from 'lucide-react';
import type { Job, Subcontractor, SubcontractorChargeback } from '../../types';
import type { PayableRecord } from '../../lib/payablesHelper';
import SubcontractorStatementModal from './SubcontractorStatementModal';
import SubcontractorChargebackModal from './SubcontractorChargebackModal';
import { formatChargebackCategory } from '../../lib/chargebackHelper';

interface SubcontractorJobsModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: Subcontractor;
}

export const SubcontractorJobsModal: React.FC<SubcontractorJobsModalProps> = ({
    isOpen,
    onClose,
    subcontractor
}) => {
    const { state, dispatch } = useAppContext();
    const [dbPayables, setDbPayables] = useState<PayableRecord[]>([]);
    const [chargebacks, setChargebacks] = useState<SubcontractorChargeback[]>([]);
    const [loadingPayables, setLoadingPayables] = useState(true);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Unpaid' | 'Paid'>('all');
    const [activeTab, setActiveTab] = useState<'jobs' | 'chargebacks'>('jobs');
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isChargebackModalOpen, setIsChargebackModalOpen] = useState(false);
    const [chargebackToEdit, setChargebackToEdit] = useState<SubcontractorChargeback | null>(null);

    // Subscribe to Firestore payables and chargebacks for real-time synchronization
    useEffect(() => {
        if (!state.currentOrganization?.id || !subcontractor?.id) return;
        
        const unsubPayables = db.collection('payables')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayableRecord));
                setDbPayables(list);
                setLoadingPayables(false);
            }, err => {
                console.error("Failed to load payables for subcontractor modal:", err);
                setLoadingPayables(false);
            });

        const unsubChargebacks = db.collection('subcontractor_chargebacks')
            .where('organizationId', '==', state.currentOrganization.id)
            .where('subcontractorId', '==', subcontractor.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubcontractorChargeback));
                list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
                setChargebacks(list);
            }, err => {
                console.error("Failed to load subcontractor chargebacks:", err);
            });

        return () => {
            unsubPayables();
            unsubChargebacks();
        };
    }, [state.currentOrganization?.id, subcontractor?.id]);

    // Find all jobs assigned to / completed by this subcontractor (robust across internal <-> external transfers)
    const assignedJobs = useMemo(() => {
        if (!subcontractor) return [];
        const subId = subcontractor.id;
        const subEmail = (subcontractor.email || '').toLowerCase().trim();
        const subCompany = (subcontractor.companyName || (subcontractor as any).name || '').toLowerCase().trim();
        const subContact = (subcontractor.contactName || '').toLowerCase().trim();
        const linkedOrgId = subcontractor.linkedOrgId;
        const linkedUserId = (subcontractor as any).userId || (subcontractor as any).linkedUserId || (subcontractor as any).employeeId;

        // Build name tokens for flexible name matching ("Mckendrick John" <-> "John Mckendrick")
        const nameTokens = Array.from(new Set([
            ...subCompany.split(/\s+/),
            ...subContact.split(/\s+/)
        ])).filter(w => w.length > 1 && !['llc', 'inc', 'corp', 'co', 'services', 'hvac'].includes(w));

        const matchesNameTokens = (text?: string | null) => {
            if (!text || nameTokens.length === 0) return false;
            const normalizedText = text.toLowerCase().trim();
            return nameTokens.every(token => normalizedText.includes(token));
        };

        return (state.jobs || []).filter(job => {
            if (job.organizationId !== state.currentOrganization?.id) return false;

            // 1. Direct ID matches
            const isDirectSub = job.subcontractorId === subId;
            const isAssignedPartner = job.assignedPartnerId === subId || (linkedOrgId && job.assignedPartnerId === linkedOrgId);
            const isAssignedTech = job.assignedTechnicianId === subId || (linkedUserId && job.assignedTechnicianId === linkedUserId);
            const isAssignedTechs = ((job as any).assignedTechnicians || []).includes(subId) || (linkedUserId && ((job as any).assignedTechnicians || []).includes(linkedUserId));
            const isWOSubId = job.subcontractorWorkOrder?.subcontractorId === subId;

            // 2. Work order / Bill name matches
            const isWOSubName = matchesNameTokens((job.subcontractorWorkOrder as any)?.subcontractorName);
            const isBillSubName = matchesNameTokens((job as any).subcontractorBill?.vendorName);

            // 3. Assigned Technician Name matches (handles internal <-> external conversion)
            const isTechNameMatch = matchesNameTokens(job.assignedTechnicianName) || matchesNameTokens((job as any).subcontractorName);

            // 4. Email matches across tech users and direct job email fields
            const techUser = state.users.find(u => u.id === job.assignedTechnicianId || (linkedUserId && u.id === linkedUserId));
            const isEmailMatch = subEmail && (
                (techUser?.email && techUser.email.toLowerCase().trim() === subEmail) ||
                ((job as any).subcontractorEmail && (job as any).subcontractorEmail.toLowerCase().trim() === subEmail) ||
                ((job as any).assignedTechnicianEmail && (job as any).assignedTechnicianEmail.toLowerCase().trim() === subEmail)
            );

            // 5. Assistants / Crew matches
            const isCrewMatch = ((job as any).assistants || []).some((ast: any) => 
                ast === subId || ast === linkedUserId || matchesNameTokens(ast)
            );

            return isDirectSub || isAssignedPartner || isAssignedTech || isAssignedTechs || isWOSubId || isWOSubName || isBillSubName || isTechNameMatch || isEmailMatch || isCrewMatch;
        }).sort((a, b) => new Date(b.createdAt || b.appointmentTime || 0).getTime() - new Date(a.createdAt || a.appointmentTime || 0).getTime());
    }, [state.jobs, subcontractor, state.currentOrganization, state.users]);

    // Automatically ensure matched jobs carry subcontractorId in Firestore
    useEffect(() => {
        if (!subcontractor?.id || assignedJobs.length === 0) return;
        assignedJobs.forEach(async (job) => {
            if (!job.subcontractorId && !job.assignedPartnerId) {
                try {
                    const updates = { subcontractorId: subcontractor.id };
                    await db.collection('jobs').doc(job.id).update(updates);
                    dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                } catch (e) {
                    console.error("Auto-linking subcontractorId error:", e);
                }
            }
        });
    }, [assignedJobs, subcontractor?.id, dispatch]);

    // Build linked job chains across all jobs in organization
    const jobChainMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        const orgJobs = (state.jobs || []).filter(j => j.organizationId === state.currentOrganization?.id);
        orgJobs.forEach(j => {
            const chain = new Set<string>([j.id]);
            if (j.parentJobId) chain.add(j.parentJobId);
            if (Array.isArray(j.linkedJobIds)) j.linkedJobIds.forEach(id => chain.add(id));

            const po = j.poNumber || j.workOrderNumber || j.invoice?.poNumber;
            if (po && po.trim().length > 1) {
                const cleanPo = po.replace(/^[#\s]+/, '').trim().toLowerCase();
                if (cleanPo.length > 1) {
                    orgJobs.forEach(otherJob => {
                        if (otherJob.id !== j.id) {
                            const otherPo = otherJob.poNumber || otherJob.workOrderNumber || otherJob.invoice?.poNumber;
                            if (otherPo) {
                                const cleanOtherPo = otherPo.replace(/^[#\s]+/, '').trim().toLowerCase();
                                if (cleanOtherPo === cleanPo) {
                                    chain.add(otherJob.id);
                                }
                            }
                        }
                    });
                }
            }
            chain.forEach(id => map.set(id, chain));
        });

        orgJobs.forEach(j => {
            const chain = map.get(j.id);
            if (chain) {
                chain.forEach(id => {
                    const subChain = map.get(id);
                    if (subChain && subChain !== chain) {
                        subChain.forEach(x => chain.add(x));
                        map.set(id, chain);
                    }
                });
            }
        });

        return map;
    }, [state.jobs, state.currentOrganization?.id]);

    // Resolve payable details per job chain
    const jobItems = useMemo(() => {
        const processedChains = new Set<string>();
        const items: Array<{
            job: Job;
            amount: number;
            status: 'Unpaid' | 'Paid';
            paidAt?: string;
            existingPayable?: PayableRecord;
            isPersisted: boolean;
        }> = [];

        assignedJobs.forEach(job => {
            const chain = jobChainMap.get(job.id) || new Set([job.id]);
            const chainKey = Array.from(chain).sort().join('|');

            if (processedChains.has(chainKey)) return;
            processedChains.add(chainKey);

            // Find all assigned jobs in this chain
            const chainAssignedJobs = assignedJobs.filter(j => chain.has(j.id));
            
            // Find existing payable for ANY job in this chain (favoring 'Paid' if present)
            const chainPayables = dbPayables.filter(p => chainAssignedJobs.some(cj => cj.id === p.jobId));
            const existingPayable: PayableRecord | undefined = chainPayables.find(p => p.status === 'Paid') || chainPayables[0];

            // Select primary job (favoring invoice, bill, payable match, payout data)
            const primaryJob = chainAssignedJobs.find(x => 
                (x.invoice && ((x.invoice.totalAmount && x.invoice.totalAmount > 0) || (x.invoice.amount && x.invoice.amount > 0) || x.invoice.invoiceNumber)) ||
                (x as any).subcontractorBill ||
                dbPayables.some(p => p.jobId === x.id && p.amount > 0) ||
                ((x as any).partnerPayoutAmount && (x as any).partnerPayoutAmount > 0) ||
                ((x as any).subcontractorPayRate && (x as any).subcontractorPayRate > 0)
            ) || chainAssignedJobs.find(x => dbPayables.some(p => p.jobId === x.id))
              || chainAssignedJobs[0] || job;

            let amount = 0;
            let status: 'Unpaid' | 'Paid' = 'Unpaid';
            let paidAt: string | undefined = undefined;
            let isPersisted = false;

            if (existingPayable) {
                amount = existingPayable.amount;
                status = existingPayable.status;
                paidAt = existingPayable.paidAt;
                isPersisted = true;
            } else {
                const subBill = (primaryJob as any).subcontractorBill;
                const subWO = primaryJob.subcontractorWorkOrder as any;

                if (typeof (primaryJob as any).partnerPayoutAmount === 'number' && (primaryJob as any).partnerPayoutAmount > 0) {
                    amount = (primaryJob as any).partnerPayoutAmount;
                } else if (typeof (primaryJob as any).subcontractorPayRate === 'number' && (primaryJob as any).subcontractorPayRate > 0) {
                    amount = (primaryJob as any).subcontractorPayRate;
                } else if (typeof (primaryJob as any).subcontractorNteAmount === 'number' && (primaryJob as any).subcontractorNteAmount > 0) {
                    amount = (primaryJob as any).subcontractorNteAmount;
                } else if (subBill?.subtotal && subBill.subtotal > 0) {
                    amount = subBill.subtotal;
                } else if (subWO?.agreedAmount && subWO.agreedAmount > 0) {
                    amount = subWO.agreedAmount;
                } else if (subWO?.nte && subWO.nte > 0) {
                    amount = subWO.nte;
                } else {
                    const invoiceTotal = primaryJob.invoice?.totalAmount || primaryJob.invoice?.amount || (primaryJob as any).total || 0;
                    const pct = subcontractor.paymentPercentage ?? subWO?.paymentPercentage;
                    if (pct !== undefined && pct !== null && pct > 0) {
                        amount = (invoiceTotal * pct) / 100;
                    } else if (invoiceTotal > 0) {
                        amount = invoiceTotal;
                    }
                }
                amount = Math.round(amount * 100) / 100;
            }

            // If chain is paid or amount is $0, treat as Settled/Paid
            const isChainPaid = existingPayable?.status === 'Paid' || chainPayables.some(p => p.status === 'Paid');
            if (isChainPaid || amount === 0) {
                status = 'Paid';
            }

            items.push({
                job: primaryJob,
                amount,
                status,
                paidAt,
                existingPayable,
                isPersisted
            });
        });

        return items;
    }, [assignedJobs, dbPayables, subcontractor, jobChainMap]);

    const filteredJobItems = useMemo(() => {
        return jobItems.filter(item => {
            const query = searchQuery.toLowerCase().trim();
            const matchesQuery = !query || 
                (item.job.customerName || '').toLowerCase().includes(query) ||
                (item.job.id || '').toLowerCase().includes(query) ||
                ((item.job as any).serviceType || '').toLowerCase().includes(query) ||
                ((item.job.subcontractorWorkOrder as any)?.workOrderNumber || '').toLowerCase().includes(query) ||
                ((item.job.subcontractorWorkOrder as any)?.id || '').toLowerCase().includes(query);
            
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [jobItems, searchQuery, statusFilter]);

    // Financial KPI Summary with Chargeback Deductions
    const activeChargebacks = useMemo(() => {
        return chargebacks.filter(cb => cb.status === 'Applied' || cb.status === 'Pending');
    }, [chargebacks]);

    const totalChargebackDeductions = useMemo(() => {
        return activeChargebacks.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);
    }, [activeChargebacks]);

    const stats = useMemo(() => {
        const totalJobs = jobItems.length;
        const completedJobs = jobItems.filter(item => ((item.job.jobStatus || (item.job as any).status || '').toLowerCase() === 'completed')).length;
        const totalPayout = jobItems.reduce((sum, item) => sum + item.amount, 0);
        const paidPayout = jobItems.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
        const unpaidPayout = totalPayout - paidPayout;
        const netOutstandingDue = Math.max(0, unpaidPayout - totalChargebackDeductions);

        return { totalJobs, completedJobs, totalPayout, paidPayout, unpaidPayout, totalChargebackDeductions, netOutstandingDue };
    }, [jobItems, totalChargebackDeductions]);

    const handleSaveAmount = async (job: Job, currentStatus: 'Paid' | 'Unpaid') => {
        const parsed = parseFloat(editAmount);
        if (isNaN(parsed) || parsed < 0) {
            showToast.warn("Please enter a valid numeric payout amount.");
            return;
        }
        if (!state.currentOrganization) return;

        setIsSaving(true);
        try {
            const orgId = state.currentOrganization.id;
            const existingPayable = dbPayables.find(p => p.jobId === job.id);
            const payableDocId = existingPayable?.id || `payable-${job.id}`;
            const subName = subcontractor.companyName || subcontractor.contactName || 'Subcontractor';
            const customerName = job.customerName || 'N/A';

            // 1. Update Payables Doc
            const payableDoc: PayableRecord = {
                id: payableDocId,
                organizationId: orgId,
                subcontractorId: subcontractor.id,
                jobId: job.id,
                amount: parsed,
                status: currentStatus,
                createdAt: existingPayable?.createdAt || job.endTime || job.createdAt || new Date().toISOString(),
                companyName: subName,
                customerName: customerName,
                paidAt: existingPayable?.paidAt,
                isAutoCalculated: false
            };
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields(payableDoc), { merge: true });

            // 2. Update Expenses Doc for P&L tracking
            const expenseDocId = `exp-${payableDocId}`;
            const expenseDoc = {
                id: expenseDocId,
                organizationId: orgId,
                date: currentStatus === 'Paid' && existingPayable?.paidAt ? existingPayable.paidAt.split('T')[0] : (job.endTime ? job.endTime.split('T')[0] : new Date().toISOString().split('T')[0]),
                category: 'Subcontractor Labor',
                vendor: subName,
                description: `Subcontractor Payout - ${subName} - Job: ${customerName}`,
                amount: parsed,
                paidBy: 'Company Account',
                status: currentStatus === 'Paid' ? 'Paid' : 'Pending',
                projectId: job.id,
                payableId: payableDocId,
                updatedAt: new Date().toISOString()
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(expenseDoc), { merge: true });

            // 3. Update Job doc if Work Order exists
            if (job.subcontractorWorkOrder) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    'subcontractorWorkOrder.agreedAmount': parsed,
                    updatedAt: new Date().toISOString()
                }));
            }

            showToast.success(`Payout amount updated to $${parsed.toFixed(2)} for ${customerName}.`);
            setEditingJobId(null);
            setEditAmount('');
        } catch (e: any) {
            console.error("Error updating payout amount:", e);
            showToast.warn("Failed to update payout amount.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleJobStatusChange = async (job: Job, newJobStatus: string) => {
        setIsSaving(true);
        try {
            const updates = {
                jobStatus: newJobStatus,
                status: newJobStatus,
                updatedAt: new Date().toISOString()
            };
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
            showToast.success(`Job status updated to ${newJobStatus} for ${job.customerName || job.id}.`);
        } catch (e: any) {
            console.error("Error updating job status:", e);
            showToast.warn("Failed to update job status.");
        } finally {
            setIsSaving(false);
        }
    };


    const handleTogglePaidStatus = async (job: Job, currentStatus: 'Paid' | 'Unpaid', currentAmount: number) => {
        if (!state.currentOrganization) return;
        const newStatus: 'Paid' | 'Unpaid' = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
        const subName = subcontractor.companyName || subcontractor.contactName || 'Subcontractor';
        const customerName = job.customerName || 'N/A';

        if (!await globalConfirm(`Mark subcontractor payout for ${customerName} ($${currentAmount.toFixed(2)}) as ${newStatus}?`)) return;

        setIsSaving(true);
        try {
            const orgId = state.currentOrganization.id;
            const existingPayable = dbPayables.find(p => p.jobId === job.id);
            const payableDocId = existingPayable?.id || `payable-${job.id}`;
            const newPaidAt = newStatus === 'Paid' ? new Date().toISOString() : undefined;

            // 1. Update Payables Doc
            const payableDoc: PayableRecord = {
                id: payableDocId,
                organizationId: orgId,
                subcontractorId: subcontractor.id,
                jobId: job.id,
                amount: currentAmount,
                status: newStatus,
                createdAt: existingPayable?.createdAt || job.endTime || job.createdAt || new Date().toISOString(),
                companyName: subName,
                customerName: customerName,
                paidAt: newPaidAt,
                isAutoCalculated: false
            };
            await db.collection('payables').doc(payableDocId).set(cleanUndefinedFields(payableDoc), { merge: true });

            // 2. Update Expenses Doc
            const expenseDocId = `exp-${payableDocId}`;
            const expenseDoc = {
                id: expenseDocId,
                organizationId: orgId,
                date: newStatus === 'Paid' ? new Date().toISOString().split('T')[0] : (job.endTime ? job.endTime.split('T')[0] : new Date().toISOString().split('T')[0]),
                category: 'Subcontractor Labor',
                vendor: subName,
                description: `Subcontractor Payout - ${subName} - Job: ${customerName}`,
                amount: currentAmount,
                paidBy: 'Company Account',
                status: newStatus === 'Paid' ? 'Paid' : 'Pending',
                projectId: job.id,
                payableId: payableDocId,
                updatedAt: new Date().toISOString()
            };
            await db.collection('expenses').doc(expenseDocId).set(cleanUndefinedFields(expenseDoc), { merge: true });

            // 3. Auto-update Job status to Completed if marking payment Paid
            if (newStatus === 'Paid' && (job.jobStatus || (job as any).status) !== 'Completed') {
                const jobUpdates = {
                    jobStatus: 'Completed',
                    status: 'Completed',
                    updatedAt: new Date().toISOString()
                };
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
            }

            showToast.success(`Payout marked as ${newStatus} for ${customerName}!`);
        } catch (e: any) {
            console.error("Error updating payment status:", e);
            showToast.warn("Failed to update payment status.");
        } finally {
            setIsSaving(false);
        }
    };


    if (!isOpen) return null;

    const subName = subcontractor.companyName || (subcontractor as any).name || subcontractor.contactName || 'Subcontractor';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Jobs & Payout History - ${subName}`} size="full">
            <div className="space-y-6 max-h-[85vh] overflow-y-auto p-1">

                {/* Subcontractor Header Banner & Stats */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Building2 className="text-amber-400" size={24} />
                                <h3 className="text-xl font-black">{subName}</h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 uppercase">
                                    {subcontractor.trade || 'HVAC Partner'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                                <span>Contact: <strong className="text-slate-200">{subcontractor.contactName || 'N/A'}</strong></span>
                                <span>Email: <strong className="text-slate-200">{subcontractor.email}</strong></span>
                                {subcontractor.licenseNumber && <span>Lic #: <strong className="text-slate-200">{subcontractor.licenseNumber}</strong></span>}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button
                                size="sm"
                                onClick={() => {
                                    setChargebackToEdit(null);
                                    setIsChargebackModalOpen(true);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm"
                            >
                                <Plus size={13} className="mr-1" /> Add Chargeback
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setIsStatementModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm"
                            >
                                <Receipt size={13} className="mr-1" /> Payment Statement
                            </Button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned Jobs</span>
                            <span className="text-xl font-black text-white">{stats.totalJobs} <span className="text-xs text-emerald-400 font-medium">({stats.completedJobs} Completed)</span></span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Gross Labor Earnings</span>
                            <span className="text-xl font-black text-indigo-400">${stats.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Damage Deductions</span>
                            <span className="text-xl font-black text-rose-400">-${stats.totalChargebackDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Net Balance Due</span>
                            <span className="text-xl font-black text-amber-400">${stats.netOutstandingDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Sub-tab switcher */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('jobs')}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                            activeTab === 'jobs'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <Briefcase size={14} /> Assigned Jobs ({jobItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('chargebacks')}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                            activeTab === 'chargebacks'
                                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <AlertTriangle size={14} /> Damage & Rework Chargebacks ({chargebacks.length})
                    </button>
                </div>

                {activeTab === 'jobs' && (
                    <>
                        {/* Filter Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by customer, job ID, or work order #..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                                />
                            </div>
                            <div className="flex gap-2">
                                {(['all', 'Unpaid', 'Paid'] as const).map(st => (
                                    <button
                                        key={st}
                                        onClick={() => setStatusFilter(st)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                            statusFilter === st
                                                ? 'bg-indigo-600 text-white shadow'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                        }`}
                                    >
                                        {st === 'all' ? 'All Statuses' : st}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Jobs & Payout List Table */}
                        {loadingPayables ? (
                            <div className="p-8 text-center text-slate-500 font-medium">Syncing subcontractor jobs and payable records...</div>
                        ) : filteredJobItems.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                                <Briefcase size={36} className="mx-auto text-slate-400 opacity-60" />
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">No Jobs Found</h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto">
                                    {searchQuery || statusFilter !== 'all' 
                                        ? 'No jobs matched your current filter criteria.' 
                                        : 'There are no active or completed jobs currently assigned to this subcontractor.'}
                                </p>
                            </div>
                        ) : (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                                                <th className="p-3.5">Job / Customer</th>
                                                <th className="p-3.5">Job Status</th>
                                                <th className="p-3.5 text-right">Org NTE</th>
                                                <th className="p-3.5 text-right">Sub NTE</th>
                                                <th className="p-3.5 text-right">Actual Payout</th>
                                                <th className="p-3.5 text-center">Payment Status</th>
                                                <th className="p-3.5 text-right sticky right-0 z-10 bg-slate-100 dark:bg-slate-900 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                                            {filteredJobItems.map(({ job, amount, status, paidAt }) => {
                                                const isEditing = editingJobId === job.id;
                                                const rawStatus = job.jobStatus || (job as any).status || 'Scheduled';
                                                const isCompleted = rawStatus.toLowerCase() === 'completed';
                                                const jobStatusStr = isCompleted ? 'Completed' : rawStatus;
                                                
                                                const orgNTEVal = Number((job as any).clientNTE || (job as any).orgNTE || (job as any).nte || job.invoice?.totalAmount || 0);
                                                const subNTEVal = Number(job.subcontractorWorkOrder?.nte || (job.subcontractorWorkOrder as any)?.agreedAmount || 0);

                                                const statusBadgeClass = 
                                                    isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                                    jobStatusStr === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                                    jobStatusStr === 'Cancelled' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

                                                return (
                                                    <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                                        
                                                        {/* Customer & Job Info */}
                                                        <td className="p-3.5">
                                                            <div className="font-extrabold text-slate-900 dark:text-white">
                                                                {job.customerName || 'Unnamed Customer'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                                                <span>ID: {job.id}</span>
                                                                {job.appointmentTime && <span>• {new Date(job.appointmentTime).toLocaleDateString()}</span>}
                                                            </div>
                                                        </td>

                                                        {/* Job Status */}
                                                        <td className="p-3.5">
                                                            <select
                                                                value={jobStatusStr}
                                                                onChange={async (e) => {
                                                                    const newStatus = e.target.value;
                                                                    try {
                                                                        const updates = {
                                                                            jobStatus: newStatus,
                                                                            status: newStatus,
                                                                            updatedAt: new Date().toISOString(),
                                                                            ...(newStatus === 'Completed' ? { completedAt: new Date().toISOString() } : {})
                                                                        };
                                                                        dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                                                                        await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
                                                                        showToast.success(`Job #${job.id} status updated to ${newStatus}`);
                                                                    } catch (err) {
                                                                        console.error("Error updating job status:", err);
                                                                        showToast.error("Failed to update job status");
                                                                    }
                                                                }}
                                                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer outline-none transition-colors ${statusBadgeClass}`}
                                                            >
                                                                <option value="Scheduled" className="bg-white text-slate-900 font-bold">Scheduled</option>
                                                                <option value="In Progress" className="bg-white text-slate-900 font-bold">In Progress</option>
                                                                <option value="Completed" className="bg-white text-slate-900 font-bold">Completed Job</option>
                                                                <option value="Needs Follow-up" className="bg-white text-slate-900 font-bold">Needs Follow-up</option>
                                                                <option value="Cancelled" className="bg-white text-slate-900 font-bold">Cancelled</option>
                                                            </select>
                                                        </td>

                                                        {/* Organization NTE */}
                                                        <td className="p-3.5 text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            {orgNTEVal > 0 ? `$${orgNTEVal.toFixed(2)}` : <span className="text-slate-400 font-normal">--</span>}
                                                        </td>

                                                        {/* Subcontractor NTE */}
                                                        <td className="p-3.5 text-right font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                                                            {subNTEVal > 0 ? `$${subNTEVal.toFixed(2)}` : <span className="text-slate-400 font-normal">--</span>}
                                                        </td>

                                                        {/* Actual Payout Amount (Editable) */}
                                                        <td className="p-3.5 text-right font-mono font-bold">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <span className="text-slate-400">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={editAmount}
                                                                        onChange={e => setEditAmount(e.target.value)}
                                                                        className="w-24 px-2 py-1 text-xs border-2 border-indigo-500 rounded bg-white dark:bg-slate-900 text-right font-mono font-bold"
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                                                    ${amount.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Payment Completed Status */}
                                                        <td className="p-3.5 text-center">
                                                            <button
                                                                onClick={() => handleTogglePaidStatus(job, status, amount)}
                                                                disabled={isSaving || amount === 0}
                                                                className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all inline-flex items-center gap-1.5 ${
                                                                    status === 'Paid' || amount === 0
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                                                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                                                }`}
                                                                title={status === 'Paid' || amount === 0 ? `Settled${paidAt ? ` on ${new Date(paidAt).toLocaleDateString()}` : ''}.` : 'Click to mark payment completed.'}
                                                            >
                                                                {status === 'Paid' || amount === 0 ? (
                                                                    <>
                                                                        <CheckCircle2 size={13} className="text-emerald-600" /> Settled
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Clock size={13} className="text-amber-600" /> Unpaid
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="p-3.5 text-right sticky right-0 z-10 bg-white dark:bg-slate-800 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {isEditing ? (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => handleSaveAmount(job, status)}
                                                                            disabled={isSaving}
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1"
                                                                        >
                                                                            <Save size={12} className="mr-1" /> Save
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={() => { setEditingJobId(null); setEditAmount(''); }}
                                                                            disabled={isSaving}
                                                                            className="text-xs px-2 py-1"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        onClick={() => { setEditingJobId(job.id); setEditAmount(amount.toString()); }}
                                                                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                                                                        title="Edit Payout Amount"
                                                                    >
                                                                        <Edit2 size={12} className="mr-1" /> Edit Payout
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>

                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Chargebacks & Property Damage Tab */}
                {activeTab === 'chargebacks' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-800">
                            <div>
                                <h4 className="text-sm font-black text-rose-900 dark:text-rose-200 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Site Damage & Workmanship Deductions
                                </h4>
                                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                                    All damage incidents, material losses, and fix rework expenses logged against {subName}.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setChargebackToEdit(null);
                                    setIsChargebackModalOpen(true);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5"
                            >
                                <Plus size={13} className="mr-1" /> Log Chargeback
                            </Button>
                        </div>

                        {chargebacks.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                                <AlertTriangle size={36} className="mx-auto text-slate-400 opacity-60" />
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">No Chargebacks On Record</h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto">
                                    This subcontractor currently has zero property damage or rework deductions logged.
                                </p>
                            </div>
                        ) : (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                {chargebacks.map(cb => (
                                    <div key={cb.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                                                    {formatChargebackCategory(cb.category)}
                                                </span>
                                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">{cb.title}</h5>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    cb.status === 'Applied' ? 'bg-emerald-100 text-emerald-800' :
                                                    cb.status === 'Waived' ? 'bg-emerald-100 text-emerald-800' :
                                                    cb.status === 'Disputed' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {cb.status === 'Waived' ? 'Waived / Forgiven' : cb.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">{cb.description}</p>
                                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                                                <span>📅 {new Date(cb.date).toLocaleDateString()}</span>
                                                {cb.customerName && <span>Job: <strong>{cb.customerName}</strong> {cb.workOrderNumber ? `(#${cb.workOrderNumber})` : ''}</span>}
                                                {cb.evidencePhotos?.length > 0 && <span className="text-rose-600 font-bold">📷 {cb.evidencePhotos.length} Photos</span>}
                                                {cb.receiptsAndInvoices?.length > 0 && <span className="text-emerald-600 font-bold">🧾 {cb.receiptsAndInvoices.length} Receipts</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            {cb.status === 'Waived' ? (
                                                <div className="text-right">
                                                    <span className="font-mono text-xs line-through text-slate-400 block">
                                                        -${cb.amount.toFixed(2)}
                                                    </span>
                                                    <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400 block">
                                                        -$0.00
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-600 block uppercase">
                                                        (Forgiven)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                                                    -${cb.amount.toFixed(2)}
                                                </span>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                    setChargebackToEdit(cb);
                                                    setIsChargebackModalOpen(true);
                                                }}
                                                className="text-xs px-2.5 py-1"
                                            >
                                                <Edit2 size={12} className="mr-1" /> Edit
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Subcontractor Payment Statement Modal */}
            {isStatementModalOpen && (
                <SubcontractorStatementModal
                    isOpen={isStatementModalOpen}
                    onClose={() => setIsStatementModalOpen(false)}
                    subcontractor={subcontractor}
                />
            )}

            {/* Subcontractor Chargeback Modal */}
            {isChargebackModalOpen && (
                <SubcontractorChargebackModal
                    isOpen={isChargebackModalOpen}
                    onClose={() => {
                        setIsChargebackModalOpen(false);
                        setChargebackToEdit(null);
                    }}
                    subcontractor={subcontractor}
                    chargebackToEdit={chargebackToEdit}
                />
            )}
        </Modal>
    );
};

export default SubcontractorJobsModal;
