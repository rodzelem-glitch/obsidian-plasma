
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/ui/Button';
import InvoiceEditorModal from '../../components/modals/InvoiceEditorModal';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import {
    Download, Calendar, Filter, FileText, TrendingUp, TrendingDown,
    MoreHorizontal, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
    PieChart, Briefcase, Calculator, Plus, User, Search, Paperclip, Users
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { uploadFileToStorage } from '../../lib/storageService';
import type { Expense, Job, Customer } from '../../types';
import { useNavigate, useSearchParams } from 'react-router-dom';

import FinancialOverview from './financials/components/FinancialOverview';
import InvoicesTab from './financials/components/InvoicesTab';
import ExpensesTab from './financials/components/ExpensesTab';
import PnLTab from './financials/components/PnLTab';
import SalesPipeline from './SalesPipeline';
import Payables from '../Payables';



const Financials: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    
    const [view, setView] = useState<'overview' | 'pnl' | 'invoices' | 'expenses' | 'sales' | 'accounting' | 'aging' | 'salestax' | 'payroll' | 'payables'>('overview');
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({ date: new Date().toISOString().split('T')[0], category: 'Materials', description: '', amount: 0, vendor: '', paidBy: state.currentUser?.firstName || 'Admin', projectId: '' });
    const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
    const [custSearch, setCustSearch] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [searchParams] = useSearchParams();

    React.useEffect(() => {
        const tab = searchParams.get('tab');
        const invId = searchParams.get('invoiceId');
        const expId = searchParams.get('expId');
        if (tab === 'invoices' && invId) {
            setView('invoices');
            const targetJob = state.jobs.find((j: any) => j.id === invId);
            if (targetJob) {
                setEditingInvoiceId(targetJob.id);
            }
        } else if (tab === 'expenses' && expId) {
            setView('expenses');
            const expensesList = state.expenses.map(e => ({...e, type: 'expense', sourceId: e.id}));
            const targetExp = expensesList.find((e: any) => e.sourceId === expId);
            if (targetExp) {
                setEditingExpense(targetExp);
                setIsExpenseModalOpen(true);
            }
        }
    }, [searchParams, state.jobs, state.expenses]);

    const allExpenses = useMemo(() => {
        const expenses = state.expenses.map(e => ({...e, type: 'expense', sourceId: e.id}));
        const vLogs = state.vehicleLogs.filter(v => v.cost > 0).map(v => ({ ...v, id: v.id, organizationId: v.organizationId, date: v.date, category: v.type === 'Fuel' ? 'Vehicle Fuel' : 'Vehicle Maint', description: v.notes, amount: v.cost, vendor: 'Fleet Expense', paidBy: v.userId, type: 'vehicleLog', sourceId: v.id }));
        return [...expenses, ...vLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.expenses, state.vehicleLogs]);

    const financialData = useMemo(() => {
        const allInvoices = state.jobs.filter((j: any) => j.invoice).map((j: any) => j.invoice);
        const totalBilled = allInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount) || Number(inv.amount) || 0), 0);
        const totalCollected = allInvoices.filter((i: any) => i.status === 'Paid').reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount) || Number(inv.amount) || 0), 0);
        const receivables = totalBilled - totalCollected;
        const totalExpenses = allExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const expenseCats: Record<string, number> = {};
        allExpenses.forEach((e: any) => { expenseCats[e.category] = (expenseCats[e.category] || 0) + (Number(e.amount) || 0); });
        const netIncome = totalCollected - totalExpenses;
        return { totalBilled, totalCollected, receivables, totalExpenses, netIncome, expenseCats };
    }, [state.jobs, allExpenses]);

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization || isSubmittingExpense || !state.currentUser) return;
        setIsSubmittingExpense(true);
        try {
            let finalReceiptData = editingExpense ? (editingExpense.receiptUrl || editingExpense.receiptData) : null;
            if (receiptFile) {
                const safeName = receiptFile.name ? receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg';
                const path = `organizations/${state.currentOrganization.id}/users/${state.currentUser.id}/receipts/${Date.now()}_${safeName}`;
                finalReceiptData = await uploadFileToStorage(path, receiptFile);
            } else if (receiptPreview && !finalReceiptData) {
                 finalReceiptData = receiptPreview;
            }

            const auditData = {
                updatedAt: new Date().toISOString(),
                updatedById: state.currentUser.id,
                updatedByName: `${state.currentUser.firstName} ${state.currentUser.lastName}`
            };

            if (editingExpense) {
                if (editingExpense.type === 'vehicleLog') { 
                    await db.collection('vehicleLogs').doc(editingExpense.id).update({ 
                        date: newExpense.date, 
                        cost: Number(newExpense.amount), 
                        notes: newExpense.description, 
                        receiptData: null,
                        receiptUrl: finalReceiptData,
                        ...auditData
                    }); 
                } else { 
                    await db.collection('expenses').doc(editingExpense.id).update({ 
                        date: newExpense.date, 
                        category: newExpense.category, 
                        description: newExpense.description, 
                        amount: Number(newExpense.amount), 
                        vendor: newExpense.vendor, 
                        paidBy: newExpense.paidBy, 
                        projectId: newExpense.projectId || null, 
                        receiptData: null,
                        receiptUrl: finalReceiptData,
                        ...auditData
                    }); 
                }
            } else {
                const exp = {
                    ...editingExpense,
                    id: editingExpense ? editingExpense.id : `exp-${Date.now()}`,
                    organizationId: state.currentOrganization.id,
                    date: newExpense.date,
                    category: newExpense.category,
                    description: newExpense.description,
                    amount: Number(newExpense.amount),
                    vendor: newExpense.vendor,
                    paidBy: newExpense.paidBy,
                    projectId: newExpense.projectId,
                    receiptData: null,
                    receiptUrl: finalReceiptData,
                    createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
                    createdById: editingExpense ? editingExpense.createdById : state.currentUser.id,
                    createdByName: editingExpense ? editingExpense.createdByName : `${state.currentUser.firstName} ${state.currentUser.lastName}`,
                    ...auditData
                };
                if (editingExpense) {
                    await db.collection('expenses').doc(exp.id).update(exp);
                } else {
                    await db.collection('expenses').doc(exp.id).set(exp);
                }
            }
            setIsExpenseModalOpen(false);
        } catch (error) { alert("Error saving expense."); } finally { setIsSubmittingExpense(false); }
    };

    const handleCreateInvoice = async (customer?: Customer) => {
        if (!state.currentUser) return;
        setIsCreatingInvoice(true); setIsCustomerSelectOpen(false);
        const id = `job-inv-${Date.now()}`;
        const newJob: Job = { 
            id, 
            organizationId: state.currentOrganization?.id || '', 
            customerName: customer ? customer.name : 'New Customer', 
            customerId: customer ? customer.id : null, 
            tasks: ['Service'], 
            jobStatus: 'Completed', 
            appointmentTime: new Date().toISOString(), 
            invoice: { 
                id: `INV-${Date.now()}`,
                status: 'Unpaid', 
                items: [], 
                subtotal: 0, 
                taxRate: (state.currentOrganization?.taxRate || 8.25) / 100, 
                taxAmount: 0, 
                totalAmount: 0, 
                amount: 0 
            }, 
            jobEvents: [], 
            createdAt: new Date().toISOString(),
            createdById: state.currentUser.id,
            createdByName: `${state.currentUser.firstName} ${state.currentUser.lastName}`,
            updatedAt: new Date().toISOString(),
            updatedById: state.currentUser.id,
            updatedByName: `${state.currentUser.firstName} ${state.currentUser.lastName}`,
            address: customer?.address || { street: 'N/A', city: 'N/A', state: 'N/A', zip: 'N/A' }, 
            specialInstructions: 'N/A' 
        };
        await db.collection('jobs').doc(id).set(newJob);
        setEditingInvoiceId(id); setIsCreatingInvoice(false);
    };

    const confirmDeleteInvoice = async () => {
        if (invoiceToDelete) {
            await db.collection('jobs').doc(invoiceToDelete).delete();
            dispatch({ type: 'DELETE_JOB', payload: invoiceToDelete });
            setInvoiceToDelete(null);
        }
    };

    const handleAttachToExisting = async (id: string, type: string, fileOrData: File | string) => {
        if (!state.currentUser) return;
        try {
            const orgId = state.currentOrganization?.id || 'unknown';
            const safeName = typeof fileOrData === 'string' ? 'capture.jpg' : (fileOrData.name ? fileOrData.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg');
            const path = `organizations/${orgId}/receipts/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, fileOrData);

            await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).update({
                receiptData: null,
                receiptUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
                updatedById: state.currentUser.id,
                updatedByName: `${state.currentUser.firstName} ${state.currentUser.lastName}`
            });
            alert("Receipt attached successfully.");
        } catch (e) {
            alert("Upload failed.");
        }
    };

    // Expose to window for the child component to call
    (window as any).handleAttachReceipt = handleAttachToExisting;

    const getReceiptSrc = (receipt: any): string | null => {
        if (!receipt) return null;
        if (typeof receipt === 'string') {
            if (receipt === 'embedded') return null;
            if (receipt.startsWith('data:') || receipt.startsWith('http')) return receipt;
            return null;
        }
        return null;
    };

    return (
        <div className="space-y-6 pb-24 p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Financial Hub</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Real-time revenue, spend tracking, and profitability.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/admin/proposal')} className="bg-purple-600 shadow-lg text-xs font-black uppercase">+ Proposal</Button>
                    <Button onClick={() => setIsCustomerSelectOpen(true)} className="bg-emerald-600 shadow-lg text-xs font-black uppercase">+ Invoice</Button>
                    <Button onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }} className="bg-blue-600 shadow-lg text-xs font-black uppercase">+ Expense</Button>
                </div>
            </header>

            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
                {[ 
                    { id: 'overview', icon: TrendingUp, label: 'Overview' }, 
                    { id: 'sales', icon: Briefcase, label: 'Pipeline' }, 
                    { id: 'pnl', icon: Calculator, label: 'P & L' }, 
                    { id: 'invoices', icon: FileText, label: 'Invoices' }, 
                    { id: 'expenses', icon: TrendingDown, label: 'Expenses' },
                    { id: 'payables', icon: Users, label: 'Payables' }
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setView(tab.id as any)} 
                        className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${view === tab.id ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon size={14}/> {tab.label}
                    </button>
                ))}
            </div>

            <div className="mt-6">
                {view === 'overview' && <FinancialOverview financialData={financialData} setView={setView} />}
                {view === 'sales' && <SalesPipeline />}
                {view === 'pnl' && <PnLTab financialData={financialData} setIsReportModalOpen={setIsReportModalOpen} />}
                {view === 'invoices' && <InvoicesTab jobs={state.jobs} setEditingInvoiceId={setEditingInvoiceId} handleDeleteInvoice={setInvoiceToDelete} />}
                {view === 'expenses' && <ExpensesTab allExpenses={allExpenses} handleEditExpense={(exp) => { setEditingExpense(exp); setIsExpenseModalOpen(true); }} handleDeleteExpense={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).delete(); }} handleDeleteReceipt={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).update({ receiptData: null, receiptUrl: null }); }} setViewingReceipt={setViewingReceipt} setIsExpenseModalOpen={setIsExpenseModalOpen} setNewExpense={setNewExpense} currentUser={state.currentUser} />}
                {view === 'payables' && <Payables />}
            </div>

            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}
            
            <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Manage Expense">
                <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} required />
                        <Input 
                            label="Amount" 
                            type="number" 
                            step="0.01" 
                            value={isNaN(newExpense.amount!) ? '' : newExpense.amount} 
                            onChange={e => setNewExpense({...newExpense, amount: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                            required 
                        />
                    </div>
                    <Input label="Vendor" value={newExpense.vendor} onChange={e => setNewExpense({...newExpense, vendor: e.target.value})} required />
                    <Button type="submit" className="w-full h-12 shadow-lg font-black uppercase">Save Expense Record</Button>
                </form>
            </Modal>

            <Modal isOpen={isCustomerSelectOpen} onClose={() => setIsCustomerSelectOpen(false)} title="Select Customer">
                <Input placeholder="Search customers..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                    <Button onClick={() => handleCreateInvoice()} variant="secondary" className="w-full text-xs font-bold mb-2">Create Blank Invoice</Button>
                    {state.customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0,10).map(c => (
                        <div key={c.id} onClick={() => handleCreateInvoice(c)} className="p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm">{c.name}</div>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title="Receipt Preview">
                <div className="flex flex-col items-center gap-4">
                    {viewingReceipt && (
                        <div className="flex justify-center bg-slate-900 p-2 md:p-4 rounded-2xl overflow-hidden max-h-[70vh] w-full">
                            <img 
                                src={viewingReceipt === 'embedded' ? 'https://placehold.co/400x400?text=Receipt+Not+Found' : viewingReceipt} 
                                className="max-w-full max-h-full object-contain rounded shadow-2xl" 
                                alt="Expense Receipt" 
                                onError={(e) => {
                                    console.error("Receipt load failed", viewingReceipt);
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Receipt+Not+Found';
                                }}
                            />
                        </div>
                    )}
                    <div className="flex justify-end w-full">
                        <Button onClick={() => setViewingReceipt(null)} variant="secondary">Close</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!invoiceToDelete} onClose={() => setInvoiceToDelete(null)} title="Confirm Deletion">
                <p>Are you sure you want to delete this invoice? This action cannot be undone.</p>
                <div className="flex justify-end gap-4 mt-4">
                    <Button onClick={() => setInvoiceToDelete(null)} variant="secondary">Cancel</Button>
                    <Button onClick={confirmDeleteInvoice} variant="danger">Delete</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Financials;
